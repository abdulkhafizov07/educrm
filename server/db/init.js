const fs = require('fs');
const path = require('path');
const { pool } = require('./index');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDatabase() {
  console.log('Initializing database...');
  const client = await pool.connect();
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema created successfully');

    // Check if super admin exists
    const { rows } = await client.query("SELECT id FROM users WHERE role = 'super_admin' LIMIT 1");
    if (rows.length === 0) {
      const hash = await bcrypt.hash('Admin@123', 12);
      await client.query(`
        INSERT INTO users (username, email, password_hash, first_name, last_name, role)
        VALUES ('superadmin', 'admin@educrm.com', $1, 'Super', 'Admin', 'super_admin')
      `, [hash]);
      console.log('Default super admin created:');
      console.log('  Username: superadmin');
      console.log('  Password: Admin@123');
      console.log('  CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!');
    }
    console.log('Database initialization complete');
  } catch (err) {
    console.error('Database initialization failed:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  initDatabase().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { initDatabase };
