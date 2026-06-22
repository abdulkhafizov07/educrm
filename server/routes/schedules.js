const express = require('express');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

// GET /api/schedules
router.get('/', async (req, res) => {
  try {
    const { group_id } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    if (req.user.role === 'teacher') {
      conditions.push(`g.teacher_id = $${idx++}`); params.push(req.user.id);
    } else if (req.user.role === 'student') {
      conditions.push(`gs.student_id = $${idx++}`); params.push(req.user.id);
    } else if (req.user.role === 'branch_admin') {
      conditions.push(`g.branch_id = $${idx++}`); params.push(req.user.branch_id);
    }

    if (group_id) { conditions.push(`s.group_id = $${idx++}`); params.push(group_id); }

    const studentJoin = req.user.role === 'student' ? 'JOIN group_students gs ON gs.group_id = s.group_id' : 'LEFT JOIN group_students gs ON gs.group_id = s.group_id';
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(
      `SELECT DISTINCT s.*, g.name as group_name, b.name as branch_name,
         CONCAT(t.first_name, ' ', t.last_name) as teacher_name
       FROM schedules s
       JOIN groups g ON s.group_id = g.id
       LEFT JOIN branches b ON g.branch_id = b.id
       LEFT JOIN users t ON g.teacher_id = t.id
       ${studentJoin}
       ${where}
       ORDER BY s.day_of_week, s.start_time`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/schedules
router.post('/', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { group_id, day_of_week, start_time, end_time, classroom } = req.body;
    if (!group_id || day_of_week === undefined || !start_time || !end_time) {
      return res.status(400).json({ error: 'group_id, day_of_week, start_time, end_time required' });
    }

    const { rows } = await query(
      'INSERT INTO schedules (group_id, day_of_week, start_time, end_time, classroom) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [group_id, day_of_week, start_time, end_time, classroom || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/schedules/:id
router.put('/:id', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { day_of_week, start_time, end_time, classroom } = req.body;
    const updates = []; const params = []; let idx = 1;
    if (day_of_week !== undefined) { updates.push(`day_of_week = $${idx++}`); params.push(day_of_week); }
    if (start_time !== undefined) { updates.push(`start_time = $${idx++}`); params.push(start_time); }
    if (end_time !== undefined) { updates.push(`end_time = $${idx++}`); params.push(end_time); }
    if (classroom !== undefined) { updates.push(`classroom = $${idx++}`); params.push(classroom); }
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(id);
    const { rows } = await query(`UPDATE schedules SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    if (!rows.length) return res.status(404).json({ error: 'Schedule not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/schedules/:id
router.delete('/:id', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('DELETE FROM schedules WHERE id = $1 RETURNING id', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Schedule not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
