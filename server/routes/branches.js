const express = require('express');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(verifyToken);

// GET /api/branches
router.get('/', async (req, res) => {
  try {
    const { search, is_active, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let idx = 1;

    // Branch admin sees only their branch
    if (req.user.role === 'branch_admin') {
      conditions.push(`b.id = $${idx++}`);
      params.push(req.user.branch_id);
    }

    if (is_active !== undefined) { conditions.push(`b.is_active = $${idx++}`); params.push(is_active === 'true'); }
    if (search) { conditions.push(`b.name ILIKE $${idx++}`); params.push(`%${search}%`); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM branches b ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT b.*,
        COUNT(DISTINCT CASE WHEN u.role = 'teacher' THEN u.id END) as teacher_count,
        COUNT(DISTINCT CASE WHEN u.role = 'student' THEN u.id END) as student_count,
        COUNT(DISTINCT g.id) as group_count
       FROM branches b
       LEFT JOIN users u ON u.branch_id = b.id AND u.is_active = true
       LEFT JOIN groups g ON g.branch_id = b.id AND g.is_active = true
       ${where}
       GROUP BY b.id ORDER BY b.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/branches/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'branch_admin' && req.user.branch_id !== id) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await query(
      `SELECT b.*,
        COUNT(DISTINCT CASE WHEN u.role = 'teacher' THEN u.id END) as teacher_count,
        COUNT(DISTINCT CASE WHEN u.role = 'student' THEN u.id END) as student_count,
        COUNT(DISTINCT CASE WHEN u.role = 'branch_admin' THEN u.id END) as admin_count,
        COUNT(DISTINCT g.id) as group_count
       FROM branches b
       LEFT JOIN users u ON u.branch_id = b.id AND u.is_active = true
       LEFT JOIN groups g ON g.branch_id = b.id AND g.is_active = true
       WHERE b.id = $1 GROUP BY b.id`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Branch not found' });

    // Groups in this branch
    const { rows: groups } = await query(
      `SELECT g.id, g.name, g.max_students, g.is_active,
         CONCAT(t.first_name, ' ', t.last_name) as teacher_name,
         COUNT(gs.student_id) as student_count
       FROM groups g
       LEFT JOIN users t ON g.teacher_id = t.id
       LEFT JOIN group_students gs ON gs.group_id = g.id
       WHERE g.branch_id = $1
       GROUP BY g.id, t.first_name, t.last_name
       ORDER BY g.created_at DESC`,
      [id]
    );

    // Branch admins assigned to this branch
    const { rows: admins } = await query(
      `SELECT id, first_name, last_name, username, avatar_url
       FROM users WHERE branch_id = $1 AND role = 'branch_admin' AND is_active = true`,
      [id]
    );

    res.json({ ...rows[0], groups, admins });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/branches
router.post('/', requireRole('super_admin'), async (req, res) => {
  try {
    const { name, address, phone, email } = req.body;
    if (!name) return res.status(400).json({ error: 'Branch name required' });

    const { rows } = await query(
      'INSERT INTO branches (name, address, phone, email) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, address || null, phone || null, email || null]
    );
    await log(req.user.id, 'BRANCH_CREATED', 'branch', rows[0].id, { name }, req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/branches/:id
router.put('/:id', requireRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, email, is_active } = req.body;

    const updates = []; const params = []; let idx = 1;
    if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
    if (address !== undefined) { updates.push(`address = $${idx++}`); params.push(address); }
    if (phone !== undefined) { updates.push(`phone = $${idx++}`); params.push(phone); }
    if (email !== undefined) { updates.push(`email = $${idx++}`); params.push(email); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); params.push(is_active); }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(id);

    const { rows } = await query(
      `UPDATE branches SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params
    );
    if (!rows.length) return res.status(404).json({ error: 'Branch not found' });
    await log(req.user.id, 'BRANCH_UPDATED', 'branch', id, null, req.ip);
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/branches/:id
router.delete('/:id', requireRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query('DELETE FROM branches WHERE id = $1 RETURNING id, name', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Branch not found' });
    await log(req.user.id, 'BRANCH_DELETED', 'branch', id, { name: rows[0].name }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
