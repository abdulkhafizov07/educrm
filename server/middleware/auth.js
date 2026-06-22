const jwt = require('jsonwebtoken');
const { query } = require('../db');

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await query('SELECT id, username, role, branch_id, is_active FROM users WHERE id = $1', [decoded.userId]);
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }
    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }
  next();
};

const requireBranchAccess = async (req, res, next) => {
  if (req.user.role === 'super_admin') return next();
  const branchId = req.params.branchId || req.body.branch_id || req.query.branch_id;
  if (branchId && branchId !== req.user.branch_id) {
    return res.status(403).json({ error: 'Access denied to this branch' });
  }
  next();
};

module.exports = { verifyToken, requireRole, requireBranchAccess };
