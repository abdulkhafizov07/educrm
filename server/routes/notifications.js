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

// POST /api/notifications — send to selected users or to a whole audience
// target: 'user' (user_ids array, or legacy single user_id) | 'students' | 'teachers' | 'branch' (everyone in a branch)
router.post('/', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { target = 'user', user_id, user_ids, branch_id, title, message, type } = req.body;
    if (!title || !message) return res.status(400).json({ error: 'title and message required' });

    let recipientIds = [];

    if (target === 'user') {
      const ids = [...new Set(Array.isArray(user_ids) ? user_ids : (user_id ? [user_id] : []))];
      if (!ids.length) return res.status(400).json({ error: 'user_ids required' });
      // Branch admins may only message users inside their own branch
      if (req.user.role === 'branch_admin') {
        const { rows } = await query('SELECT id FROM users WHERE id = ANY($1::uuid[]) AND branch_id = $2', [ids, req.user.branch_id]);
        if (rows.length !== ids.length) return res.status(403).json({ error: 'Access denied' });
      }
      recipientIds = ids;
    } else {
      const conds = ['is_active = true'];
      const params = [];
      let idx = 1;

      // Branch scope: branch admins are locked to their branch; super admins may pick one
      if (req.user.role === 'branch_admin') {
        conds.push(`branch_id = $${idx++}`); params.push(req.user.branch_id);
      } else if (branch_id) {
        conds.push(`branch_id = $${idx++}`); params.push(branch_id);
      }

      if (target === 'students') {
        conds.push(`role = $${idx++}`); params.push('student');
      } else if (target === 'teachers') {
        conds.push(`role = $${idx++}`); params.push('teacher');
      } else if (target === 'branch') {
        if (req.user.role !== 'branch_admin' && !branch_id) return res.status(400).json({ error: 'branch_id required' });
        conds.push(`role <> 'super_admin'`); // everyone in the branch except super admins
      } else {
        return res.status(400).json({ error: 'Invalid target' });
      }

      const { rows } = await query(`SELECT id FROM users WHERE ${conds.join(' AND ')}`, params);
      recipientIds = rows.map(r => r.id);
    }

    // Never notify the sender themselves
    recipientIds = recipientIds.filter(id => id !== req.user.id);
    if (!recipientIds.length) return res.status(400).json({ error: 'No recipients found' });

    const { rows } = await query(
      `INSERT INTO notifications (user_id, title, message, type)
       SELECT uid, $2, $3, $4 FROM unnest($1::uuid[]) AS uid
       RETURNING id`,
      [recipientIds, title, message, type || 'info']
    );

    res.status(201).json({ success: true, count: rows.length });
  } catch (err) {
    console.error(err);
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
