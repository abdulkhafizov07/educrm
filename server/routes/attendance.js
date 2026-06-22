const express = require('express');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(verifyToken);

// GET /api/attendance/sessions
router.get('/sessions', async (req, res) => {
  try {
    const { group_id, from_date, to_date, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.user.role === 'teacher') {
      conditions.push(`s.teacher_id = $${idx++}`); params.push(req.user.id);
    } else if (req.user.role === 'branch_admin') {
      conditions.push(`g.branch_id = $${idx++}`); params.push(req.user.branch_id);
    }

    if (group_id) { conditions.push(`s.group_id = $${idx++}`); params.push(group_id); }
    if (from_date) { conditions.push(`s.session_date >= $${idx++}`); params.push(from_date); }
    if (to_date) { conditions.push(`s.session_date <= $${idx++}`); params.push(to_date); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(
      `SELECT COUNT(*) FROM attendance_sessions s JOIN groups g ON s.group_id = g.id ${where}`, params
    );
    const total = parseInt(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT s.*, g.name as group_name, b.name as branch_name,
         CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
         COUNT(ar.id) as total_records,
         SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
         SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
         SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count
       FROM attendance_sessions s
       JOIN groups g ON s.group_id = g.id
       LEFT JOIN branches b ON g.branch_id = b.id
       LEFT JOIN users t ON s.teacher_id = t.id
       LEFT JOIN attendance_records ar ON ar.session_id = s.id
       ${where}
       GROUP BY s.id, g.name, b.name, t.first_name, t.last_name
       ORDER BY s.session_date DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/sessions/:id
router.get('/sessions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: sessions } = await query(
      `SELECT s.*, g.name as group_name, CONCAT(t.first_name, ' ', t.last_name) as teacher_name
       FROM attendance_sessions s
       JOIN groups g ON s.group_id = g.id
       LEFT JOIN users t ON s.teacher_id = t.id
       WHERE s.id = $1`,
      [id]
    );
    if (!sessions.length) return res.status(404).json({ error: 'Session not found' });

    const { rows: records } = await query(
      `SELECT ar.*, CONCAT(u.first_name, ' ', u.last_name) as student_name, u.username, u.avatar_url
       FROM attendance_records ar
       JOIN users u ON ar.student_id = u.id
       WHERE ar.session_id = $1 ORDER BY u.first_name`,
      [id]
    );

    res.json({ ...sessions[0], records });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attendance/sessions — create or update a session with all records
router.post('/sessions', requireRole('super_admin', 'branch_admin', 'teacher'), async (req, res) => {
  try {
    const { group_id, session_date, start_time, notes, records } = req.body;
    if (!group_id || !session_date || !start_time) {
      return res.status(400).json({ error: 'group_id, session_date, and start_time required' });
    }

    // Validate teacher access
    if (req.user.role === 'teacher') {
      const { rows } = await query('SELECT id FROM groups WHERE id = $1 AND teacher_id = $2', [group_id, req.user.id]);
      if (!rows.length) return res.status(403).json({ error: 'Not assigned to this group' });
    }

    const client = await require('../db').getClient();
    try {
      await client.query('BEGIN');

      // Upsert session
      const { rows: sessions } = await client.query(
        `INSERT INTO attendance_sessions (group_id, teacher_id, session_date, start_time, notes)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (group_id, session_date)
         DO UPDATE SET start_time = EXCLUDED.start_time, notes = EXCLUDED.notes, teacher_id = EXCLUDED.teacher_id
         RETURNING *`,
        [group_id, req.user.id, session_date, start_time, notes || null]
      );
      const session = sessions[0];

      // Upsert attendance records
      if (records && Array.isArray(records)) {
        for (const rec of records) {
          const { student_id, status, arrival_time, late_minutes } = rec;
          if (!student_id || !status) continue;

          const lateMin = status === 'late' ? (late_minutes || 0) : 0;
          await client.query(
            `INSERT INTO attendance_records (session_id, student_id, status, arrival_time, late_minutes)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (session_id, student_id)
             DO UPDATE SET status = EXCLUDED.status, arrival_time = EXCLUDED.arrival_time, late_minutes = EXCLUDED.late_minutes`,
            [session.id, student_id, status, arrival_time || null, lateMin]
          );
        }
      }

      await client.query('COMMIT');
      await log(req.user.id, 'ATTENDANCE_SAVED', 'attendance_session', session.id, { group_id, session_date }, req.ip);
      res.status(201).json(session);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/student/:studentId — student attendance history
router.get('/student/:studentId', async (req, res) => {
  try {
    const { studentId } = req.params;
    const { from_date, to_date, group_id } = req.query;

    if (req.user.role === 'student' && req.user.id !== studentId) return res.status(403).json({ error: 'Access denied' });

    const conditions = [`ar.student_id = $1`];
    const params = [studentId];
    let idx = 2;

    if (from_date) { conditions.push(`s.session_date >= $${idx++}`); params.push(from_date); }
    if (to_date) { conditions.push(`s.session_date <= $${idx++}`); params.push(to_date); }
    if (group_id) { conditions.push(`s.group_id = $${idx++}`); params.push(group_id); }

    const where = 'WHERE ' + conditions.join(' AND ');
    const { rows } = await query(
      `SELECT ar.*, s.session_date, s.start_time, g.name as group_name,
         CONCAT(t.first_name, ' ', t.last_name) as teacher_name
       FROM attendance_records ar
       JOIN attendance_sessions s ON ar.session_id = s.id
       JOIN groups g ON s.group_id = g.id
       LEFT JOIN users t ON s.teacher_id = t.id
       ${where}
       ORDER BY s.session_date DESC`,
      params
    );

    // Stats
    const total = rows.length;
    const present = rows.filter(r => r.status === 'present').length;
    const absent = rows.filter(r => r.status === 'absent').length;
    const late = rows.filter(r => r.status === 'late').length;
    const avgLate = late > 0 ? Math.round(rows.filter(r => r.status === 'late').reduce((s, r) => s + (r.late_minutes || 0), 0) / late) : 0;
    const attendancePct = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    res.json({ records: rows, stats: { total, present, absent, late, avgLate, attendancePct } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/stats — overall stats
router.get('/stats', async (req, res) => {
  try {
    const { branch_id, group_id, from_date, to_date } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.user.role === 'branch_admin') {
      conditions.push(`g.branch_id = $${idx++}`); params.push(req.user.branch_id);
    } else if (branch_id) {
      conditions.push(`g.branch_id = $${idx++}`); params.push(branch_id);
    }
    if (group_id) { conditions.push(`s.group_id = $${idx++}`); params.push(group_id); }
    if (from_date) { conditions.push(`s.session_date >= $${idx++}`); params.push(from_date); }
    if (to_date) { conditions.push(`s.session_date <= $${idx++}`); params.push(to_date); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(
      `SELECT
         COUNT(ar.id) as total,
         SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
         SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
         SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
         ROUND(AVG(CASE WHEN ar.status = 'late' THEN ar.late_minutes END)) as avg_late_minutes
       FROM attendance_records ar
       JOIN attendance_sessions s ON ar.session_id = s.id
       JOIN groups g ON s.group_id = g.id
       ${where}`,
      params
    );

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
