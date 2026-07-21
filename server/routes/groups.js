const express = require('express');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(verifyToken);

// O'qituvchining boshqa faol guruhlarida vaqt to'qnashuvini tekshiradi.
// To'qnashuv bo'lsa xabar (string), bo'lmasa null. excludeGroupId yangi guruhda null bo'ladi.
async function teacherConflict(teacherId, excludeGroupId, days, startTime, endTime) {
  if (!teacherId || !Array.isArray(days) || !days.length) return null;
  const valid = [...new Set(days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))];
  if (!valid.length) return null;
  const start = startTime || '09:00';
  const end = endTime || '11:00';
  const { rows } = await query(
    `SELECT g.name, s.start_time, s.end_time
     FROM schedules s JOIN groups g ON s.group_id = g.id
     WHERE g.teacher_id = $1 AND ($2::uuid IS NULL OR g.id != $2) AND g.is_active = true
       AND s.day_of_week = ANY($3) AND s.start_time < $5 AND s.end_time > $4
     LIMIT 1`,
    [teacherId, excludeGroupId || null, valid, start, end]
  );
  if (!rows.length) return null;
  const c = rows[0];
  const hhmm = (t) => String(t).slice(0, 5);
  return `O'qituvchi bu vaqtda boshqa guruhda darsda: "${c.name}" (${hhmm(c.start_time)}–${hhmm(c.end_time)})`;
}

// Replace a group's weekly lesson schedule with the given weekdays (0=Sun..6=Sat).
// `days` undefined => leave existing schedule untouched; [] => clear it.
async function replaceSchedules(groupId, days, startTime, endTime) {
  if (!Array.isArray(days)) return;
  await query('DELETE FROM schedules WHERE group_id = $1', [groupId]);
  const valid = [...new Set(days.map(Number).filter(d => Number.isInteger(d) && d >= 0 && d <= 6))];
  if (!valid.length) return;
  const start = startTime || '09:00';
  const end = endTime || '11:00';
  for (const d of valid) {
    await query(
      'INSERT INTO schedules (group_id, day_of_week, start_time, end_time) VALUES ($1, $2, $3, $4)',
      [groupId, d, start, end]
    );
  }
}

// GET /api/groups
router.get('/', async (req, res) => {
  try {
    const { branch_id, direction_id, teacher_id, student_id, search, is_active, page = 1, limit = 20 } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    if (req.user.role === 'branch_admin') {
      conditions.push(`g.branch_id = $${idx++}`); params.push(req.user.branch_id);
    } else if (req.user.role === 'teacher') {
      conditions.push(`g.teacher_id = $${idx++}`); params.push(req.user.id);
    } else if (req.user.role === 'student') {
      conditions.push(`gs.student_id = $${idx++}`); params.push(req.user.id);
    } else if (branch_id) {
      conditions.push(`g.branch_id = $${idx++}`); params.push(branch_id);
    }

    // Admins can look up a specific student's groups (e.g. the graduate-a-student flow)
    if (student_id && req.user.role !== 'student') { conditions.push(`gs.student_id = $${idx++}`); params.push(student_id); }
    if (direction_id) { conditions.push(`g.direction_id = $${idx++}`); params.push(direction_id); }
    if (teacher_id) { conditions.push(`g.teacher_id = $${idx++}`); params.push(teacher_id); }
    if (is_active !== undefined) { conditions.push(`g.is_active = $${idx++}`); params.push(is_active === 'true'); }
    if (search) { conditions.push(`g.name ILIKE $${idx++}`); params.push(`%${search}%`); }

    const studentJoin = (req.user.role === 'student' || student_id) ? 'JOIN group_students gs ON gs.group_id = g.id' : 'LEFT JOIN group_students gs ON gs.group_id = g.id';
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(
      `SELECT COUNT(DISTINCT g.id) FROM groups g ${studentJoin} ${where}`, params
    );
    const total = parseInt(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT g.*, b.name as branch_name, dir.name as direction_name, dir.color as direction_color,
         CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
         COUNT(DISTINCT gs2.student_id) as student_count
       FROM groups g
       LEFT JOIN branches b ON g.branch_id = b.id
       LEFT JOIN directions dir ON g.direction_id = dir.id
       LEFT JOIN users t ON g.teacher_id = t.id
       ${studentJoin}
       LEFT JOIN group_students gs2 ON gs2.group_id = g.id
       ${where}
       GROUP BY g.id, b.name, dir.name, dir.color, t.first_name, t.last_name
       ORDER BY g.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/groups/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `SELECT g.*, b.name as branch_name, dir.name as direction_name, dir.color as direction_color,
         CONCAT(t.first_name, ' ', t.last_name) as teacher_name, t.id as teacher_user_id,
         t.first_name as teacher_first_name, t.last_name as teacher_last_name,
         t.avatar_url as teacher_avatar_url, t.phone as teacher_phone, t.email as teacher_email
       FROM groups g
       LEFT JOIN branches b ON g.branch_id = b.id
       LEFT JOIN directions dir ON g.direction_id = dir.id
       LEFT JOIN users t ON g.teacher_id = t.id
       WHERE g.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Group not found' });

    if (req.user.role === 'branch_admin' && rows[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });
    // Teachers may only open their own groups; students don't browse group rosters at all
    if (req.user.role === 'teacher' && rows[0].teacher_id !== req.user.id) return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'student') return res.status(403).json({ error: 'Access denied' });

    // Get students in this group
    const { rows: students } = await query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, gs.enrolled_at
       FROM group_students gs JOIN users u ON gs.student_id = u.id
       WHERE gs.group_id = $1 ORDER BY u.first_name`,
      [id]
    );

    // Get schedule
    const { rows: schedules } = await query('SELECT * FROM schedules WHERE group_id = $1 ORDER BY day_of_week, start_time', [id]);

    // Dashboard-style attendance stats scoped to this group
    const [attendanceToday, attendanceTrend, overall] = await Promise.all([
      query(
        `SELECT COUNT(ar.id) as total,
           SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
           SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
           SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count
         FROM attendance_records ar
         JOIN attendance_sessions s ON ar.session_id = s.id
         WHERE s.session_date = CURRENT_DATE AND s.group_id = $1`,
        [id]
      ),
      query(
        `SELECT s.session_date,
           SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
           SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
           SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
           COUNT(ar.id) as total
         FROM attendance_sessions s
         JOIN attendance_records ar ON ar.session_id = s.id
         WHERE s.session_date >= CURRENT_DATE - INTERVAL '7 days' AND s.group_id = $1
         GROUP BY s.session_date ORDER BY s.session_date`,
        [id]
      ),
      query(
        `SELECT COUNT(ar.id) as total,
           SUM(CASE WHEN ar.status IN ('present', 'late') THEN 1 ELSE 0 END) as attended,
           COUNT(DISTINCT s.id) as sessions
         FROM attendance_records ar
         JOIN attendance_sessions s ON ar.session_id = s.id
         WHERE s.group_id = $1`,
        [id]
      ),
    ]);

    const o = overall.rows[0];
    const totalRecords = parseInt(o.total) || 0;
    res.json({
      ...rows[0], students, schedules,
      attendanceToday: attendanceToday.rows[0],
      attendanceTrend: attendanceTrend.rows,
      stats: {
        sessions: parseInt(o.sessions) || 0,
        attendancePct: totalRecords ? Math.round((parseInt(o.attended) / totalRecords) * 100) : 0,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/groups
router.post('/', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { name, branch_id, direction_id, teacher_id, description, max_students,
            start_date, schedule_days, start_time, end_time } = req.body;
    if (!name || !branch_id) return res.status(400).json({ error: 'Name and branch_id required' });

    if (req.user.role === 'branch_admin' && branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });

    // O'qituvchining boshqa guruhlari bilan vaqt to'qnashuvini oldindan tekshiramiz
    if (teacher_id && Array.isArray(schedule_days)) {
      const conflict = await teacherConflict(teacher_id, null, schedule_days, start_time, end_time);
      if (conflict) return res.status(409).json({ error: conflict });
    }

    // start_date left blank => fall back to today (COALESCE keeps the column's default behaviour)
    const { rows } = await query(
      `INSERT INTO groups (name, branch_id, direction_id, teacher_id, description, max_students, start_date)
       VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7, CURRENT_DATE)) RETURNING *`,
      [name, branch_id, direction_id || null, teacher_id || null, description || null, max_students || 30, start_date || null]
    );

    // Lesson days -> weekly schedule, so the attendance register auto-opens the month's cells
    await replaceSchedules(rows[0].id, schedule_days, start_time, end_time);

    await log(req.user.id, 'GROUP_CREATED', 'group', rows[0].id, { name }, req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/groups/:id
router.put('/:id', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, teacher_id, description, max_students, is_active, direction_id,
            start_date, schedule_days, start_time, end_time } = req.body;

    const { rows: existing } = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'branch_admin' && existing[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });

    // O'qituvchi bandligi: yangi jadval yuborilgan bo'lsa — shu jadval bilan;
    // faqat o'qituvchi almashsa — guruhning mavjud jadval kunlari bilan tekshiramiz
    const effTeacher = teacher_id !== undefined ? (teacher_id || null) : existing[0].teacher_id;
    if (effTeacher) {
      let conflict = null;
      if (Array.isArray(schedule_days)) {
        conflict = await teacherConflict(effTeacher, id, schedule_days, start_time, end_time);
      } else if (teacher_id !== undefined && teacher_id !== existing[0].teacher_id) {
        const { rows: curSch } = await query('SELECT day_of_week, start_time, end_time FROM schedules WHERE group_id = $1', [id]);
        for (const s of curSch) {
          conflict = await teacherConflict(effTeacher, id, [s.day_of_week], s.start_time, s.end_time);
          if (conflict) break;
        }
      }
      if (conflict) return res.status(409).json({ error: conflict });
    }

    const updates = []; const params = []; let idx = 1;
    if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
    if (direction_id !== undefined) { updates.push(`direction_id = $${idx++}`); params.push(direction_id || null); }
    if (teacher_id !== undefined) { updates.push(`teacher_id = $${idx++}`); params.push(teacher_id || null); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
    if (max_students !== undefined) { updates.push(`max_students = $${idx++}`); params.push(max_students); }
    if (start_date !== undefined) { updates.push(`start_date = COALESCE($${idx++}, CURRENT_DATE)`); params.push(start_date || null); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); params.push(is_active); }

    if (updates.length) {
      params.push(id);
      await query(`UPDATE groups SET ${updates.join(', ')} WHERE id = $${idx}`, params);
    }

    // Update the weekly lesson schedule when the form sends it (array). Undefined = leave as-is.
    await replaceSchedules(id, schedule_days, start_time, end_time);

    const { rows } = await query('SELECT * FROM groups WHERE id = $1', [id]);
    await log(req.user.id, 'GROUP_UPDATED', 'group', id, null, req.ip);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/groups/:id
router.delete('/:id', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: existing } = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'branch_admin' && existing[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });
    await query('DELETE FROM groups WHERE id = $1', [id]);
    await log(req.user.id, 'GROUP_DELETED', 'group', id, { name: existing[0].name }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/groups/:id/students — add one (student_id) or many (student_ids[]) at once
router.post('/:id/students', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const ids = Array.isArray(req.body.student_ids)
      ? req.body.student_ids.filter(Boolean)
      : (req.body.student_id ? [req.body.student_id] : []);
    if (!ids.length) return res.status(400).json({ error: 'student_id(s) required' });

    const { rows: group } = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!group.length) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'branch_admin' && group[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });

    const { rows: countRows } = await query('SELECT COUNT(*) FROM group_students WHERE group_id = $1', [id]);
    const room = group[0].max_students - parseInt(countRows[0].count);
    if (room <= 0) return res.status(400).json({ error: 'Group is at maximum capacity' });

    // Don't exceed capacity even if more were selected
    const toAdd = ids.slice(0, room);
    let added = 0;
    for (const sid of toAdd) {
      const r = await query('INSERT INTO group_students (group_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, sid]);
      added += r.rowCount;
    }
    await log(req.user.id, 'STUDENT_ADDED_TO_GROUP', 'group', id, { count: added }, req.ip);
    res.json({ success: true, added });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/groups/:id/students/:studentId
router.delete('/:id/students/:studentId', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const { rows: group } = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!group.length) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'branch_admin' && group[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });

    await query('DELETE FROM group_students WHERE group_id = $1 AND student_id = $2', [id, studentId]);
    await log(req.user.id, 'STUDENT_REMOVED_FROM_GROUP', 'group', id, { studentId }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
