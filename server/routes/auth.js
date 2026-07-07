const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../db');
const { verifyToken } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();

const generateTokens = (userId, role, branchId) => {
  const access = jwt.sign(
    { userId, role, branchId },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
  const refresh = jwt.sign(
    { userId },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
  return { access, refresh };
};

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const { rows } = await query(
      `SELECT u.*, b.name as branch_name, b.logo_url as branch_logo,
              st.logo_url as app_logo, st.app_name
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       LEFT JOIN app_settings st ON st.id = 1
       WHERE u.username = $1`,
      [username.toLowerCase().trim()]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];
    if (!user.is_active) return res.status(401).json({ error: 'Account is deactivated' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const { access, refresh } = generateTokens(user.id, user.role, user.branch_id);

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, refresh, expiresAt]
    );

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);
    await log(user.id, 'USER_LOGIN', 'user', user.id, null, req.ip);

    const { password_hash, ...safeUser } = user;
    res.json({ accessToken: access, refreshToken: refresh, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(401).json({ error: 'Refresh token required' });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const { rows } = await query(
      'SELECT * FROM refresh_tokens WHERE token = $1 AND user_id = $2 AND expires_at > NOW()',
      [refreshToken, decoded.userId]
    );
    if (!rows.length) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    const { rows: users } = await query(
      'SELECT id, role, branch_id, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (!users.length || !users[0].is_active) return res.status(401).json({ error: 'User not found' });

    const user = users[0];
    const { access, refresh: newRefresh } = generateTokens(user.id, user.role, user.branch_id);

    await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await query('INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)', [user.id, newRefresh, expiresAt]);

    res.json({ accessToken: access, refreshToken: newRefresh });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', verifyToken, async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    }
    await log(req.user.id, 'USER_LOGOUT', 'user', req.user.id, null, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
              u.role, u.branch_id, u.avatar_url, u.is_active, u.last_login, u.created_at,
              b.name as branch_name, b.logo_url as branch_logo,
              st.logo_url as app_logo, st.app_name
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       LEFT JOIN app_settings st ON st.id = 1
       WHERE u.id = $1`,
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);
    await log(req.user.id, 'PASSWORD_CHANGED', 'user', req.user.id, null, req.ip);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
