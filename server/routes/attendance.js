const express = require('express');
const ExcelJS = require('exceljs');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(verifyToken);

// Build the list of lesson dates in a month for the given weekdays (0=Sun..6=Sat)
function lessonDatesInMonth(year, month /* 1-12 */, days) {
  const dates = [];
  const last = new Date(year, month, 0).getDate();
  for (let d = 1; d <= last; d++) {
    const dow = new Date(Date.UTC(year, month - 1, d)).getUTCDay();
    if (days.includes(dow)) {
      dates.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }
  }
  return dates;
}

// Verify the current user may manage attendance for a group
async function assertGroupAccess(req, groupId) {
  const { rows } = await query('SELECT id, branch_id, teacher_id, start_date FROM groups WHERE id = $1', [groupId]);
  if (!rows.length) return { ok: false, code: 404, error: 'Group not found' };
  const g = rows[0];
  if (req.user.role === 'teacher' && g.teacher_id !== req.user.id) return { ok: false, code: 403, error: 'Not assigned to this group' };
  if (req.user.role === 'branch_admin' && g.branch_id !== req.user.branch_id) return { ok: false, code: 403, error: 'Access denied' };
  if (req.user.role === 'student') return { ok: false, code: 403, error: 'Access denied' };
  return { ok: true, group: g };
}

// GET /api/attendance/sessions
router.get('/sessions', async (req, res) => {
  try {
    // Students never see the group session list — only their own attendance (see /student/:id)
    if (req.user.role === 'student') return res.status(403).json({ error: 'Access denied' });
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

// Shared WHERE-clause builder for the grouped (one row per group) attendance overview + its export
function buildGroupSummaryConditions(req, q) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (req.user.role === 'teacher') {
    conditions.push(`g.teacher_id = $${idx++}`); params.push(req.user.id);
  } else if (req.user.role === 'branch_admin') {
    conditions.push(`g.branch_id = $${idx++}`); params.push(req.user.branch_id);
  } else if (q.branch_id) {
    conditions.push(`g.branch_id = $${idx++}`); params.push(q.branch_id);
  }
  if (q.search) { conditions.push(`g.name ILIKE $${idx++}`); params.push(`%${q.search}%`); }

  return { where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '', params, nextIdx: idx };
}

// GET /api/attendance/groups-summary — one row per group (not per session) with aggregate attendance stats
router.get('/groups-summary', async (req, res) => {
  try {
    if (req.user.role === 'student') return res.status(403).json({ error: 'Access denied' });
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { where, params, nextIdx } = buildGroupSummaryConditions(req, req.query);

    const countRes = await query(`SELECT COUNT(*) FROM groups g ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT g.id, g.name, b.name as branch_name, CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
         COUNT(DISTINCT s.id) as total_sessions,
         MAX(s.session_date) as last_session_date,
         SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
         SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
         SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count
       FROM groups g
       LEFT JOIN branches b ON g.branch_id = b.id
       LEFT JOIN users t ON g.teacher_id = t.id
       LEFT JOIN attendance_sessions s ON s.group_id = g.id AND s.is_exam = false
       LEFT JOIN attendance_records ar ON ar.session_id = s.id
       ${where}
       GROUP BY g.id, b.name, t.first_name, t.last_name
       ORDER BY g.name
       LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({
      data: rows.map(r => ({
        ...r,
        total_sessions: parseInt(r.total_sessions),
        present_count: parseInt(r.present_count || 0),
        absent_count: parseInt(r.absent_count || 0),
        late_count: parseInt(r.late_count || 0),
      })),
      total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/groups-summary/export — Excel of the grouped attendance overview
router.get('/groups-summary/export', async (req, res) => {
  try {
    if (req.user.role === 'student') return res.status(403).json({ error: 'Access denied' });
    const { where, params } = buildGroupSummaryConditions(req, req.query);

    const { rows } = await query(
      `SELECT g.name, b.name as branch_name, CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
         COUNT(DISTINCT s.id) as total_sessions,
         MAX(s.session_date) as last_session_date,
         SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
         SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
         SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count
       FROM groups g
       LEFT JOIN branches b ON g.branch_id = b.id
       LEFT JOIN users t ON g.teacher_id = t.id
       LEFT JOIN attendance_sessions s ON s.group_id = g.id AND s.is_exam = false
       LEFT JOIN attendance_records ar ON ar.session_id = s.id
       ${where}
       GROUP BY g.id, b.name, t.first_name, t.last_name
       ORDER BY g.name`,
      params
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Attendance Summary');
    ws.mergeCells('A1', 'J1');
    ws.getCell('A1').value = "Guruhlar bo'yicha davomat";
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.addRow([]);

    const header = ws.addRow(['#', 'Guruh', 'Filial', "O'qituvchi", 'Jami dars', 'Keldi', 'Kelmadi', 'Kech qoldi', 'Oxirgi dars', 'Davomat %']);
    header.font = { bold: true };
    header.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });

    rows.forEach((r, i) => {
      const total = parseInt(r.total_sessions);
      const present = parseInt(r.present_count || 0);
      const absent = parseInt(r.absent_count || 0);
      const late = parseInt(r.late_count || 0);
      const pct = total ? Math.round(((present + late) / total) * 100) : 0;
      ws.addRow([
        i + 1, r.name, r.branch_name || '', r.teacher_name?.trim() || '',
        total, present, absent, late,
        r.last_session_date ? new Date(r.last_session_date).toISOString().slice(0, 10) : '',
        total ? `${pct}%` : '',
      ]);
    });

    ws.columns = [{ width: 5 }, { width: 24 }, { width: 18 }, { width: 20 }, { width: 12 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 14 }, { width: 12 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-summary-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
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

// GET /api/attendance/grid?group_id=&month=YYYY-MM — register grid for a month
router.get('/grid', async (req, res) => {
  try {
    const { group_id, month } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });

    const access = await assertGroupAccess(req, group_id);
    if (!access.ok) return res.status(access.code).json({ error: access.error });

    const now = new Date();
    const [y, m] = (month && /^\d{4}-\d{2}$/.test(month))
      ? month.split('-').map(Number)
      : [now.getFullYear(), now.getMonth() + 1];

    // Students enrolled in the group
    const { rows: students } = await query(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.avatar_url
       FROM group_students gs JOIN users u ON gs.student_id = u.id
       WHERE gs.group_id = $1 AND (u.is_active = true OR u.graduated_at IS NOT NULL)
       ORDER BY u.first_name, u.last_name`,
      [group_id]
    );

    // Schedule weekdays + start times
    const { rows: schedules } = await query(
      'SELECT day_of_week, start_time FROM schedules WHERE group_id = $1 ORDER BY day_of_week',
      [group_id]
    );
    const days = [...new Set(schedules.map(s => s.day_of_week))];
    const startByDay = {};
    schedules.forEach(s => { if (!startByDay[s.day_of_week]) startByDay[s.day_of_week] = s.start_time; });

    const scheduledDates = days.length ? lessonDatesInMonth(y, m, days) : [];

    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const last = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;

    // All sessions in the month — so exam days appear even before any grade is entered
    const { rows: sess } = await query(
      `SELECT TO_CHAR(session_date, 'YYYY-MM-DD') AS session_date, is_exam
       FROM attendance_sessions WHERE group_id = $1 AND session_date BETWEEN $2 AND $3`,
      [group_id, first, last]
    );
    const examDates = sess.filter(s => s.is_exam).map(s => String(s.session_date).slice(0, 10));
    const sessionDates = sess.map(s => String(s.session_date).slice(0, 10));

    // Existing records for the month (status for normal days, grade for exam days)
    const { rows: recs } = await query(
      `SELECT TO_CHAR(s.session_date, 'YYYY-MM-DD') AS session_date, ar.student_id, ar.status, ar.late_minutes, ar.grade
       FROM attendance_sessions s
       JOIN attendance_records ar ON ar.session_id = s.id
       WHERE s.group_id = $1 AND s.session_date BETWEEN $2 AND $3`,
      [group_id, first, last]
    );

    const records = {};
    for (const r of recs) {
      const dateKey = String(r.session_date).slice(0, 10);
      records[dateKey] = records[dateKey] || {};
      records[dateKey][r.student_id] = { status: r.status, late_minutes: r.late_minutes, grade: r.grade };
    }

    // Columns = scheduled lesson days ∪ any day that already has a session/records,
    // so both marked attendance and exam days are always shown in the register.
    const dates = [...new Set([...scheduledDates, ...sessionDates])].sort();

    res.json({ year: y, month: m, students, dates, records, examDates, startByDay });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/overview?group_id=&from_date=&to_date= — cumulative stats since the group started
// (or a custom range), per enrolled student. Exam sessions are excluded, and late is kept separate from absent.
router.get('/overview', async (req, res) => {
  try {
    const { group_id, from_date, to_date } = req.query;
    if (!group_id) return res.status(400).json({ error: 'group_id required' });

    const access = await assertGroupAccess(req, group_id);
    if (!access.ok) return res.status(access.code).json({ error: access.error });

    const from = from_date || access.group.start_date;
    const to = to_date || new Date().toISOString().slice(0, 10);

    const { rows: totalRows } = await query(
      `SELECT COUNT(*) FROM attendance_sessions
       WHERE group_id = $1 AND is_exam = false AND session_date BETWEEN $2 AND $3`,
      [group_id, from, to]
    );

    const { rows: students } = await query(
      `SELECT u.id, u.first_name, u.last_name, u.username, u.avatar_url,
         COUNT(ar.id) as total,
         SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present,
         SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent,
         SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late
       FROM group_students gs
       JOIN users u ON gs.student_id = u.id
       LEFT JOIN attendance_sessions s ON s.group_id = gs.group_id AND s.is_exam = false AND s.session_date BETWEEN $2 AND $3
       LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = u.id
       WHERE gs.group_id = $1 AND (u.is_active = true OR u.graduated_at IS NOT NULL)
       GROUP BY u.id, u.first_name, u.last_name, u.username, u.avatar_url
       ORDER BY u.first_name, u.last_name`,
      [group_id, from, to]
    );

    res.json({
      from_date: from,
      to_date: to,
      total_sessions: parseInt(totalRows[0].count),
      students: students.map(s => ({
        ...s,
        total: parseInt(s.total), present: parseInt(s.present), absent: parseInt(s.absent), late: parseInt(s.late),
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attendance/mark — set one student's status for one date
router.post('/mark', requireRole('super_admin', 'branch_admin', 'teacher'), async (req, res) => {
  try {
    const { group_id, session_date, student_id, status, late_minutes, start_time } = req.body;
    if (!group_id || !session_date || !student_id || !status) {
      return res.status(400).json({ error: 'group_id, session_date, student_id and status required' });
    }
    if (!['present', 'absent', 'late'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    const access = await assertGroupAccess(req, group_id);
    if (!access.ok) return res.status(access.code).json({ error: access.error });

    const { rows: sessions } = await query(
      `INSERT INTO attendance_sessions (group_id, teacher_id, session_date, start_time)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (group_id, session_date)
       DO UPDATE SET teacher_id = COALESCE(attendance_sessions.teacher_id, EXCLUDED.teacher_id)
       RETURNING id`,
      [group_id, req.user.id, session_date, start_time || '00:00']
    );
    const sessionId = sessions[0].id;
    const lateMin = status === 'late' ? (late_minutes || 0) : 0;

    await query(
      `INSERT INTO attendance_records (session_id, student_id, status, late_minutes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (session_id, student_id)
       DO UPDATE SET status = EXCLUDED.status, late_minutes = EXCLUDED.late_minutes`,
      [sessionId, student_id, status, lateMin]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attendance/exam — mark/unmark a date as an exam (test) day
router.post('/exam', requireRole('super_admin', 'branch_admin', 'teacher'), async (req, res) => {
  try {
    const { group_id, session_date, is_exam, start_time } = req.body;
    if (!group_id || !session_date) return res.status(400).json({ error: 'group_id and session_date required' });

    const access = await assertGroupAccess(req, group_id);
    if (!access.ok) return res.status(access.code).json({ error: access.error });

    await query(
      `INSERT INTO attendance_sessions (group_id, teacher_id, session_date, start_time, is_exam)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (group_id, session_date)
       DO UPDATE SET is_exam = EXCLUDED.is_exam,
                     teacher_id = COALESCE(attendance_sessions.teacher_id, EXCLUDED.teacher_id)`,
      [group_id, req.user.id, session_date, start_time || '00:00', !!is_exam]
    );
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/attendance/grade — set one student's exam grade (0-100) for one date
router.post('/grade', requireRole('super_admin', 'branch_admin', 'teacher'), async (req, res) => {
  try {
    const { group_id, session_date, student_id, grade, start_time } = req.body;
    if (!group_id || !session_date || !student_id) {
      return res.status(400).json({ error: 'group_id, session_date and student_id required' });
    }

    const access = await assertGroupAccess(req, group_id);
    if (!access.ok) return res.status(access.code).json({ error: access.error });

    // Clamp the grade to 0-100, or null to clear it
    const g = (grade === null || grade === undefined || grade === '')
      ? null
      : Math.max(0, Math.min(100, Math.round(Number(grade)) || 0));

    // The date is an exam day; ensure the session exists and is flagged as exam
    const { rows: sessions } = await query(
      `INSERT INTO attendance_sessions (group_id, teacher_id, session_date, start_time, is_exam)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (group_id, session_date)
       DO UPDATE SET is_exam = true,
                     teacher_id = COALESCE(attendance_sessions.teacher_id, EXCLUDED.teacher_id)
       RETURNING id`,
      [group_id, req.user.id, session_date, start_time || '00:00']
    );
    const sessionId = sessions[0].id;

    await query(
      `INSERT INTO attendance_records (session_id, student_id, status, grade)
       VALUES ($1, $2, 'present', $3)
       ON CONFLICT (session_id, student_id)
       DO UPDATE SET grade = EXCLUDED.grade`,
      [sessionId, student_id, g]
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/attendance/export?group_id=&date=YYYY-MM-DD — Excel of that date's attendance
router.get('/export', async (req, res) => {
  try {
    const { group_id, date } = req.query;
    if (!group_id || !date) return res.status(400).json({ error: 'group_id and date required' });

    const access = await assertGroupAccess(req, group_id);
    if (!access.ok) return res.status(access.code).json({ error: access.error });

    const { rows: ginfo } = await query(
      `SELECT g.name as group_name, b.name as branch_name FROM groups g
       LEFT JOIN branches b ON g.branch_id = b.id WHERE g.id = $1`,
      [group_id]
    );
    const groupName = ginfo[0]?.group_name || 'Group';

    // All enrolled students with that date's status (left join so absent-of-record show blank)
    const { rows } = await query(
      `SELECT u.first_name, u.last_name, u.username, u.phone, u.email,
              ar.status, ar.arrival_time, ar.late_minutes
       FROM group_students gs
       JOIN users u ON gs.student_id = u.id
       LEFT JOIN attendance_sessions s ON s.group_id = gs.group_id AND s.session_date = $2
       LEFT JOIN attendance_records ar ON ar.session_id = s.id AND ar.student_id = u.id
       WHERE gs.group_id = $1 AND (u.is_active = true OR u.graduated_at IS NOT NULL)
       ORDER BY u.first_name, u.last_name`,
      [group_id, date]
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Davomat');
    ws.mergeCells('A1', 'G1');
    ws.getCell('A1').value = `${groupName} — ${date}`;
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.addRow([]);

    const header = ws.addRow(['#', 'Talaba', 'Login', 'Telefon', 'Holat', 'Kelish vaqti', 'Kechikish (daq)']);
    header.font = { bold: true };
    header.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });

    const statusLabel = { present: 'Keldi', absent: 'Kelmadi', late: 'Kech qoldi' };
    rows.forEach((r, i) => {
      ws.addRow([
        i + 1,
        `${r.first_name} ${r.last_name}`,
        r.username,
        r.phone || '',
        r.status ? statusLabel[r.status] : '—',
        r.arrival_time || '',
        r.status === 'late' ? (r.late_minutes || 0) : '',
      ]);
    });

    ws.columns = [
      { width: 5 }, { width: 28 }, { width: 18 }, { width: 16 }, { width: 12 }, { width: 12 }, { width: 12 },
    ];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="attendance-${date}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
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
      `SELECT ar.*, s.session_date, s.start_time, s.is_exam, g.name as group_name,
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
    const grades = rows.filter(r => r.is_exam && r.grade !== null).map(r => r.grade);
    const avgGrade = grades.length > 0 ? Math.round(grades.reduce((s, g) => s + g, 0) / grades.length) : null;

    res.json({ records: rows, stats: { total, present, absent, late, avgLate, attendancePct, avgGrade } });
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
