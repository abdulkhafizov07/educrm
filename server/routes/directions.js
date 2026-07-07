const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(verifyToken);

// ===== Direction logo upload (multer) =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'directions');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `direction-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});
const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.svg'];
  if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
  else cb(new Error('Only image files are allowed'), false);
};
const uploadLogo = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }).single('logo');
const handleLogoUpload = (req, res, next) => {
  uploadLogo(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};
const removeUpload = (relPath) => {
  if (!relPath) return;
  const abs = path.join(process.cwd(), relPath);
  fs.existsSync(abs) && fs.unlink(abs, () => {});
};

// GET /api/directions — list directions (belong to a branch) with group/student stats
router.get('/', async (req, res) => {
  try {
    const { search, branch_id } = req.query;
    const conditions = [];
    const params = [];
    let idx = 1;

    // Branch admin only sees directions of their own branch
    if (req.user.role === 'branch_admin') {
      conditions.push(`d.branch_id = $${idx++}`); params.push(req.user.branch_id);
    } else if (branch_id) {
      conditions.push(`d.branch_id = $${idx++}`); params.push(branch_id);
    }
    if (search) { conditions.push(`d.name ILIKE $${idx++}`); params.push(`%${search}%`); }
    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const { rows } = await query(
      `SELECT d.*, b.name AS branch_name,
        COUNT(DISTINCT g.id) AS group_count,
        COUNT(DISTINCT gs.student_id) AS student_count,
        COUNT(DISTINCT g.teacher_id) AS teacher_count
       FROM directions d
       LEFT JOIN branches b ON d.branch_id = b.id
       LEFT JOIN groups g ON g.direction_id = d.id AND g.is_active = true
       LEFT JOIN group_students gs ON gs.group_id = g.id
       ${where}
       GROUP BY d.id, b.name
       ORDER BY d.created_at DESC`,
      params
    );
    res.json({ data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/directions/:id — direction + its groups
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await query(
      `SELECT d.*, b.name AS branch_name,
        COUNT(DISTINCT g.id) AS group_count,
        COUNT(DISTINCT gs.student_id) AS student_count,
        COUNT(DISTINCT g.teacher_id) AS teacher_count
       FROM directions d
       LEFT JOIN branches b ON d.branch_id = b.id
       LEFT JOIN groups g ON g.direction_id = d.id AND g.is_active = true
       LEFT JOIN group_students gs ON gs.group_id = g.id
       WHERE d.id = $1 GROUP BY d.id, b.name`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Direction not found' });
    if (req.user.role === 'branch_admin' && rows[0].branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Groups in this direction
    const { rows: groups } = await query(
      `SELECT g.id, g.name, g.max_students, g.is_active,
        CONCAT(t.first_name, ' ', t.last_name) AS teacher_name,
        COUNT(gs.student_id) AS student_count
       FROM groups g
       LEFT JOIN users t ON g.teacher_id = t.id
       LEFT JOIN group_students gs ON gs.group_id = g.id
       WHERE g.direction_id = $1
       GROUP BY g.id, t.first_name, t.last_name
       ORDER BY g.created_at DESC`,
      [id]
    );

    res.json({ ...rows[0], groups });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/directions — a direction belongs to a branch
router.post('/', requireRole('super_admin', 'branch_admin'), handleLogoUpload, async (req, res) => {
  try {
    const { name, description, color } = req.body;
    // Branch admin can only create directions inside their own branch
    const branch_id = req.user.role === 'branch_admin' ? req.user.branch_id : req.body.branch_id;
    if (!name || !branch_id) {
      if (req.file) removeUpload(`/uploads/directions/${req.file.filename}`);
      return res.status(400).json({ error: 'Direction name and branch_id required' });
    }
    const logoUrl = req.file ? `/uploads/directions/${req.file.filename}` : null;
    const { rows } = await query(
      'INSERT INTO directions (name, description, color, logo_url, branch_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, description || null, color || 'blue', logoUrl, branch_id]
    );
    await log(req.user.id, 'DIRECTION_CREATED', 'direction', rows[0].id, { name }, req.ip);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/directions/:id
router.put('/:id', requireRole('super_admin', 'branch_admin'), handleLogoUpload, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, is_active, branch_id } = req.body;

    // Access check + branch scope for branch admins
    const { rows: cur } = await query('SELECT branch_id FROM directions WHERE id = $1', [id]);
    if (!cur.length) {
      if (req.file) removeUpload(`/uploads/directions/${req.file.filename}`);
      return res.status(404).json({ error: 'Direction not found' });
    }
    if (req.user.role === 'branch_admin' && cur[0].branch_id !== req.user.branch_id) {
      if (req.file) removeUpload(`/uploads/directions/${req.file.filename}`);
      return res.status(403).json({ error: 'Access denied' });
    }

    const updates = []; const params = []; let idx = 1;
    if (name !== undefined) { updates.push(`name = $${idx++}`); params.push(name); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); params.push(description); }
    if (color !== undefined) { updates.push(`color = $${idx++}`); params.push(color); }
    if (is_active !== undefined) { updates.push(`is_active = $${idx++}`); params.push(is_active === 'true' || is_active === true); }
    // Only super admin may move a direction to another branch
    if (branch_id !== undefined && req.user.role === 'super_admin') { updates.push(`branch_id = $${idx++}`); params.push(branch_id); }

    let oldLogo = null;
    if (req.file) {
      const cur = await query('SELECT logo_url FROM directions WHERE id = $1', [id]);
      oldLogo = cur.rows[0]?.logo_url || null;
      updates.push(`logo_url = $${idx++}`);
      params.push(`/uploads/directions/${req.file.filename}`);
    }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    params.push(id);

    const { rows } = await query(`UPDATE directions SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`, params);
    if (!rows.length) {
      if (req.file) removeUpload(`/uploads/directions/${req.file.filename}`);
      return res.status(404).json({ error: 'Direction not found' });
    }
    if (oldLogo) removeUpload(oldLogo);
    await log(req.user.id, 'DIRECTION_UPDATED', 'direction', id, null, req.ip);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/directions/:id
router.delete('/:id', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'branch_admin') {
      const { rows: cur } = await query('SELECT branch_id FROM directions WHERE id = $1', [id]);
      if (!cur.length) return res.status(404).json({ error: 'Direction not found' });
      if (cur[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });
    }
    const { rows } = await query('DELETE FROM directions WHERE id = $1 RETURNING id, name, logo_url', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Direction not found' });
    removeUpload(rows[0].logo_url);
    await log(req.user.id, 'DIRECTION_DELETED', 'direction', id, { name: rows[0].name }, req.ip);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
