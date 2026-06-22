const express = require('express');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

// GET /api/notifications
router.get('/', async (req, res) => {
  try {
    const { is_read, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [`user_id = $1`];
    const params = [req.user.id];
    let idx = 2;
    if (is_read !== undefined) { conditions.push(`is_read = $${idx++}`); params.push(is_read === 'true'); }
    const where = 'WHERE ' + conditions.join(' AND ');
    const countRes = await query(`SELECT COUNT(*) FROM notifications ${where}`, params);
    const total = parseInt(countRes.rows[0].count);
    const unread = await query('SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false', [req.user.id]);
    const { rows } = await query(
      `SELECT * FROM notifications ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, parseInt(limit), offset]
    );
    res.json({ data: rows, total, unreadCount: parseInt(unread.rows[0].count), page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req, res) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/notifications — super admin send notification to users
router.post('/', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { user_id, title, message, type } = req.body;
    if (!user_id || !title || !message) return res.status(400).json({ error: 'user_id, title, message required' });
    const { rows } = await query(
      'INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4) RETURNING *',
      [user_id, title, message, type || 'info']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req, res) => {
  try {
    await query('DELETE FROM notifications WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
