const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(verifyToken);

const USER_FIELDS = `
  u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
  u.role, u.branch_id, u.avatar_url, u.is_active, u.last_login, u.created_at,
  b.name as branch_name
`;

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const { role, branch_id, search, page = 1, limit = 20, is_active } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramIdx = 1;

    // Branch admins can only see their branch users
    if (req.user.role === 'branch_admin') {
      conditions.push(`u.branch_id = $${paramIdx++}`);
      params.push(req.user.branch_id);
    } else if (branch_id) {
      conditions.push(`u.branch_id = $${paramIdx++}`);
      params.push(branch_id);
    }

    if (role) { conditions.push(`u.role = $${paramIdx++}`); params.push(role); }
    if (is_active !== undefined) { conditions.push(`u.is_active = $${paramIdx++}`); params.push(is_active === 'true'); }
    if (search) {
      conditions.push(`(u.username ILIKE $${paramIdx} OR u.first_name ILIKE $${paramIdx} OR u.last_name ILIKE $${paramIdx} OR u.email ILIKE $${paramIdx})`);
      params.push(`%${search}%`); paramIdx++;
    }

    // Teachers and students can only see themselves
    if (req.user.role === 'teacher' || req.user.role === 'student') {
      conditions.push(`u.id = $${paramIdx++}`);
      params.push(req.user.id);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
    const countRes = await query(`SELECT COUNT(*) FROM users u ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT ${USER_FIELDS} FROM users u LEFT JOIN branches b ON u.branch_id = b.id
       ${where} ORDER BY u.created_at DESC LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'student' && req.user.id !== id) return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'teacher' && req.user.id !== id) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await query(
      `SELECT ${USER_FIELDS} FROM users u LEFT JOIN branches b ON u.branch_id = b.id WHERE u.id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });

    if (req.user.role === 'branch_admin' && rows[0].branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users
router.post('/', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { username, email, password, first_name, last_name, phone, role, branch_id } = req.body;
    if (!username || !password || !first_name || !last_name || !role) {
      return res.status(400).json({ error: 'Required fields: username, password, first_name, last_name, role' });
    }
    const validRoles = ['super_admin', 'branch_admin', 'teacher', 'student'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    // Branch admin can only create branch_admin(same branch), teacher, student
    if (req.user.role === 'branch_admin') {
      if (role === 'super_admin') return res.status(403).json({ error: 'Cannot create super admin' });
      if (role === 'branch_admin' && branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Cannot assign to other branch' });
    }

    const hash = await bcrypt.hash(password, 12);
    const assignedBranch = req.user.role === 'branch_admin' ? req.user.branch_id : (branch_id || null);

    const { rows } = await query(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, branch_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id, username, role`,
      [username.toLowerCase().trim(), email || null, hash, first_name, last_name, phone || null, role, assignedBranch]
    );

    await log(req.user.id, 'USER_CREATED', 'user', rows[0].id, { role, username }, req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/users/:id
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { first_name, last_name, email, phone, branch_id, is_active, username } = req.body;

    // Permission checks
    if (req.user.role === 'student' || req.user.role === 'teacher') {
      if (req.user.id !== id) return res.status(403).json({ error: 'Access denied' });
    }

    const { rows: existing } = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });

    if (req.user.role === 'branch_admin' && existing[0].branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (first_name !== undefined) { updates.push(`first_name = $${paramIdx++}`); params.push(first_name); }
    if (last_name !== undefined) { updates.push(`last_name = $${paramIdx++}`); params.push(last_name); }
    if (email !== undefined) { updates.push(`email = $${paramIdx++}`); params.push(email); }
    if (phone !== undefined) { updates.push(`phone = $${paramIdx++}`); params.push(phone); }
    if (req.user.role === 'super_admin' || req.user.role === 'branch_admin') {
      if (username !== undefined) { updates.push(`username = $${paramIdx++}`); params.push(username.toLowerCase().trim()); }
      if (branch_id !== undefined && req.user.role === 'super_admin') { updates.push(`branch_id = $${paramIdx++}`); params.push(branch_id || null); }
      if (is_active !== undefined) { updates.push(`is_active = $${paramIdx++}`); params.push(is_active); }
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    params.push(id);
    const { rows } = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIdx} RETURNING id, username, email, first_name, last_name, role`,
      params
    );

    await log(req.user.id, 'USER_UPDATED', 'user', id, { fields: Object.keys(req.body) }, req.ip);
    res.json(rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Username or email already exists' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/users/:id/reset-password
router.post('/:id/reset-password', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const { rows } = await query('SELECT id, branch_id, role FROM users WHERE id = $1', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    if (req.user.role === 'branch_admin' && rows[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    await query('DELETE FROM refresh_tokens WHERE user_id = $1', [id]);
    await log(req.user.id, 'PASSWORD_RESET', 'user', id, null, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id
router.delete('/:id', requireRole('super_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
    const { rows } = await query('DELETE FROM users WHERE id = $1 RETURNING id, username', [id]);
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    await log(req.user.id, 'USER_DELETED', 'user', id, { username: rows[0].username }, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
