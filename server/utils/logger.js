const { query } = require('../db');

const log = async (userId, action, entityType = null, entityId = null, details = null, ipAddress = null) => {
  try {
    await query(
      `INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId || null, action, entityType, entityId || null, details ? JSON.stringify(details) : null, ipAddress]
    );
  } catch (err) {
    console.error('Failed to write activity log:', err.message);
  }
};

module.exports = { log };
