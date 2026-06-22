const express = require('express');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(verifyToken);

// GET /api/groups
router.get('/', async (req, res) => {
  try {
    const { branch_id, teacher_id, search, is_active, page = 1, limit = 20 } = req.query;
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
    } else {
      if (branch_id) { conditions.push(`g.branch_id = $${idx++}`); params.push(branch_id); }
    }

    if (teacher_id) { conditions.push(`g.teacher_id = $${idx++}`); params.push(teacher_id); }
    if (is_active !== undefined) { conditions.push(`g.is_active = $${idx++}`); params.push(is_active === 'true'); }
    if (search) { conditions.push(`g.name ILIKE $${idx++}`); params.push(`%${search}%`); }

    const studentJoin = req.user.role === 'student' ? 'JOIN group_students gs ON gs.group_id = g.id' : 'LEFT JOIN group_students gs ON gs.group_id = g.id';
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const countRes = await query(
      `SELECT COUNT(DISTINCT g.id) FROM groups g ${studentJoin} ${where}`, params
    );
    const total = parseInt(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT g.*, b.name as branch_name,
         CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
         COUNT(DISTINCT gs2.student_id) as student_count
       FROM groups g
       LEFT JOIN branches b ON g.branch_id = b.id
       LEFT JOIN users t ON g.teacher_id = t.id
       ${studentJoin}
       LEFT JOIN group_students gs2 ON gs2.group_id = g.id
       ${where}
       GROUP BY g.id, b.name, t.first_name, t.last_name
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
      `SELECT g.*, b.name as branch_name,
         CONCAT(t.first_name, ' ', t.last_name) as teacher_name, t.id as teacher_user_id
       FROM groups g
       LEFT JOIN branches b ON g.branch_id = b.id
       LEFT JOIN users t ON g.teacher_id = t.id
       WHERE g.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Group not found' });

    if (req.user.role === 'branch_admin' && rows[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });

    // Get students in this group
    const { rows: students } = await query(
      `SELECT u.id, u.username, u.first_name, u.last_name, u.email, u.phone, u.avatar_url, gs.enrolled_at
       FROM group_students gs JOIN users u ON gs.student_id = u.id
       WHERE gs.group_id = $1 ORDER BY u.first_name`,
      [id]
    );

    // Get schedule
    const { rows: schedules } = await query('SELECT * FROM schedules WHERE group_id = $1 ORDER BY day_of_week, start_time', [id]);

    res.json({ ...rows[0], students, schedules });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/groups
router.post('/', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { name, branch_id, teacher_id, description, max_students } = req.body;
    if (!name || !branch_id) return res.status(400).json({ error: 'Name and branch_id required' });

    if (req.user.role === 'branch_admin' && branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await query(
      `INSERT INTO groups (name, branch_id, teacher_id, description, max_students)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, branch_id, teacher_id || null, description || null, max_students || 30]
    );
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
    const { name, teacher_id, description, max_students, is_active } = req.body;

    const { rows: existing } = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'branch_admin' && existing[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });

    const updates = []; const params = []; let idx = 1;
    if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
    if (teacher_id !== undefined) { updates.push(`teacher_id = $${idx++}`); params.push(teacher_id || null); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
    if (max_students !== undefined) { updates.push(`max_students = $${idx++}`); params.push(max_students); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); params.push(is_active); }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(id);

    const { rows } = await query(`UPDATE groups SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params);
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

// POST /api/groups/:id/students
router.post('/:id/students', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id required' });

    const { rows: group } = await query('SELECT * FROM groups WHERE id = $1', [id]);
    if (!group.length) return res.status(404).json({ error: 'Group not found' });
    if (req.user.role === 'branch_admin' && group[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });

    const { rows: countRows } = await query('SELECT COUNT(*) FROM group_students WHERE group_id = $1', [id]);
    if (parseInt(countRows[0].count) >= group[0].max_students) return res.status(400).json({ error: 'Group is at maximum capacity' });

    await query('INSERT INTO group_students (group_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, student_id]);
    await log(req.user.id, 'STUDENT_ADDED_TO_GROUP', 'group', id, { student_id }, req.ip);
    res.json({ success: true });
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
