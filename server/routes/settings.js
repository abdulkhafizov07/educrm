const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(verifyToken);

// ===== App logo upload (multer) =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(process.cwd(), 'uploads', 'app');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `app-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
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

// GET /api/settings — app branding (logo + name)
router.get('/', async (req, res) => {
  try {
    const { rows } = await query('SELECT app_name, logo_url FROM app_settings WHERE id = 1');
    res.json(rows[0] || { app_name: 'EduCRM', logo_url: null });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/settings — super admin updates the app branding
router.put('/', requireRole('super_admin'), handleLogoUpload, async (req, res) => {
  try {
    const { app_name } = req.body;
    const sets = [];
    const params = [];
    let idx = 1;

    if (app_name !== undefined) { sets.push(`app_name = $${idx++}`); params.push(app_name || null); }

    if (req.file) {
      const cur = await query('SELECT logo_url FROM app_settings WHERE id = 1');
      const old = cur.rows[0]?.logo_url;
      sets.push(`logo_url = $${idx++}`);
      params.push(`/uploads/app/${req.file.filename}`);
      if (old) {
        const abs = path.join(process.cwd(), old);
        fs.existsSync(abs) && fs.unlink(abs, () => {});
      }
    }

    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });
    sets.push('updated_at = NOW()');

    await query(
      `INSERT INTO app_settings (id) VALUES (1)
       ON CONFLICT (id) DO UPDATE SET ${sets.join(', ')}`,
      params
    );
    await log(req.user.id, 'APP_SETTINGS_UPDATED', 'settings', null, null, req.ip);

    const { rows } = await query('SELECT app_name, logo_url FROM app_settings WHERE id = 1');
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
