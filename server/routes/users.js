const express = require('express');
const bcrypt = require('bcryptjs');
const ExcelJS = require('exceljs');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(verifyToken);

const USER_FIELDS = `
  u.id, u.username, u.email, u.first_name, u.last_name, u.phone,
  u.role, u.branch_id, u.avatar_url, u.is_active, u.last_login, u.created_at,
  u.address, u.mother_phone, u.birth_year, u.father_name, u.mother_name,
  u.graduated_at, u.graduation_note, u.graduated_branch_id, u.graduated_group_id,
  b.name as branch_name, gb.name as graduated_branch_name, gg.name as graduated_group_name
`;
const USER_JOINS = `
  LEFT JOIN branches b ON u.branch_id = b.id
  LEFT JOIN branches gb ON u.graduated_branch_id = gb.id
  LEFT JOIN groups gg ON u.graduated_group_id = gg.id
`;

// Shared WHERE-clause builder for the list endpoint and the two Excel export endpoints.
// `forcedRole` overrides any `role`/`roles` query param (used by /students/export and /graduates/export).
function buildUserConditions(req, q, forcedRole) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (req.user.role === 'branch_admin') {
    conditions.push(`u.branch_id = $${idx++}`); params.push(req.user.branch_id);
  } else if (q.branch_id) {
    conditions.push(`u.branch_id = $${idx++}`); params.push(q.branch_id);
  }

  if (forcedRole) {
    conditions.push(`u.role = $${idx++}`); params.push(forcedRole);
  } else if (q.role) {
    conditions.push(`u.role = $${idx++}`); params.push(q.role);
  }
  if (!forcedRole && q.roles) {
    const list = String(q.roles).split(',').map(r => r.trim()).filter(Boolean);
    if (list.length) { conditions.push(`u.role = ANY($${idx++})`); params.push(list); }
  }

  if (q.is_active !== undefined) { conditions.push(`u.is_active = $${idx++}`); params.push(q.is_active === 'true'); }
  if (q.graduated !== undefined) {
    conditions.push(q.graduated === 'true' ? 'u.graduated_at IS NOT NULL' : 'u.graduated_at IS NULL');
  }
  if (q.group_id) { conditions.push(`u.graduated_group_id = $${idx++}`); params.push(q.group_id); }
  if (q.date_from) { conditions.push(`u.created_at::date >= $${idx++}`); params.push(q.date_from); }
  if (q.date_to) { conditions.push(`u.created_at::date <= $${idx++}`); params.push(q.date_to); }
  if (q.graduated_from) { conditions.push(`u.graduated_at::date >= $${idx++}`); params.push(q.graduated_from); }
  if (q.graduated_to) { conditions.push(`u.graduated_at::date <= $${idx++}`); params.push(q.graduated_to); }

  if (q.search) {
    conditions.push(`(u.username ILIKE $${idx} OR u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${q.search}%`); idx++;
  }

  // Teachers and students can only see themselves
  if (req.user.role === 'teacher' || req.user.role === 'student') {
    conditions.push(`u.id = $${idx++}`); params.push(req.user.id);
  }

  return { where: conditions.length ? 'WHERE ' + conditions.join(' AND ') : '', params, nextIdx: idx };
}

// GET /api/users
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { where, params, nextIdx } = buildUserConditions(req, req.query);

    const countRes = await query(`SELECT COUNT(*) FROM users u ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    const { rows } = await query(
      `SELECT ${USER_FIELDS} FROM users u ${USER_JOINS}
       ${where} ORDER BY u.created_at DESC LIMIT $${nextIdx} OFFSET $${nextIdx + 1}`,
      [...params, parseInt(limit), offset]
    );

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/users/students/export — Excel of the (filtered) active students list
router.get('/students/export', async (req, res) => {
  try {
    const { where, params } = buildUserConditions(req, { ...req.query, graduated: 'false' }, 'student');

    const { rows } = await query(
      `SELECT u.first_name, u.last_name, u.username, u.phone, u.email, u.created_at, u.is_active,
              u.address, u.mother_phone, u.birth_year, u.father_name, u.mother_name,
              b.name as branch_name,
              (SELECT string_agg(g.name, ', ') FROM group_students gs JOIN groups g ON gs.group_id = g.id WHERE gs.student_id = u.id) as group_names
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       ${where}
       ORDER BY u.first_name, u.last_name`,
      params
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Students');
    ws.mergeCells('A1', 'P1');
    ws.getCell('A1').value = "O'quvchilar ro'yxati";
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.addRow([]);

    const header = ws.addRow(['#', 'Ism', 'Familiya', 'Login', 'Telefon', 'Email', 'Filial', 'Guruhlar', 'Yashash manzili', 'Otasining ismi', 'Onasining ismi', 'Ota-onasining telefon raqami', "Tug'ilgan yil", 'Yosh', "Qo'shilgan sana", 'Holat']);
    header.font = { bold: true };
    header.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });

    const currentYear = new Date().getFullYear();
    rows.forEach((r, i) => {
      ws.addRow([
        i + 1, r.first_name, r.last_name, r.username, r.phone || '', r.email || '',
        r.branch_name || '', r.group_names || '',
        r.address || '', r.father_name || '', r.mother_name || '', r.mother_phone || '', r.birth_year || '',
        r.birth_year ? currentYear - r.birth_year : '',
        r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
        r.is_active ? 'Faol' : 'Nofaol',
      ]);
    });

    ws.columns = [{ width: 5 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 24 }, { width: 18 }, { width: 28 }, { width: 26 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 12 }, { width: 8 }, { width: 14 }, { width: 10 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/users/graduates/export — Excel of the (filtered) graduated students list
router.get('/graduates/export', async (req, res) => {
  try {
    const { where, params } = buildUserConditions(req, { ...req.query, graduated: 'true' }, 'student');

    const { rows } = await query(
      `SELECT u.first_name, u.last_name, u.username, u.graduated_at, u.graduation_note,
              gb.name as branch_name, gg.name as group_name
       FROM users u
       LEFT JOIN branches gb ON u.graduated_branch_id = gb.id
       LEFT JOIN groups gg ON u.graduated_group_id = gg.id
       ${where}
       ORDER BY u.graduated_at DESC`,
      params
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Graduates');
    ws.mergeCells('A1', 'H1');
    ws.getCell('A1').value = "Bitiruvchilar ro'yxati";
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.addRow([]);

    const header = ws.addRow(['#', 'Ism', 'Familiya', 'Login', 'Filial', 'Guruh', 'Bitirgan sana', 'Izoh']);
    header.font = { bold: true };
    header.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });

    rows.forEach((r, i) => {
      ws.addRow([
        i + 1, r.first_name, r.last_name, r.username,
        r.branch_name || '', r.group_name || '',
        r.graduated_at ? new Date(r.graduated_at).toISOString().slice(0, 10) : '',
        r.graduation_note || '',
      ]);
    });

    ws.columns = [{ width: 5 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 18 }, { width: 22 }, { width: 14 }, { width: 40 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="graduates-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// GET /api/users/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.role === 'student' && req.user.id !== id) return res.status(403).json({ error: 'Access denied' });
    if (req.user.role === 'teacher' && req.user.id !== id) return res.status(403).json({ error: 'Access denied' });

    const { rows } = await query(
      `SELECT ${USER_FIELDS} FROM users u ${USER_JOINS} WHERE u.id = $1`,
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

    // Optional manual join date; if omitted, the created_at column default (NOW()) applies
    const cols = ['username', 'email', 'password_hash', 'first_name', 'last_name', 'phone', 'role', 'branch_id'];
    const vals = [username.toLowerCase().trim(), email || null, hash, first_name, last_name, phone || null, role, assignedBranch];
    if (req.body.created_at) { cols.push('created_at'); vals.push(req.body.created_at); }
    if (req.body.address !== undefined) { cols.push('address'); vals.push(req.body.address || null); }
    if (req.body.mother_phone !== undefined) { cols.push('mother_phone'); vals.push(req.body.mother_phone || null); }
    if (req.body.birth_year !== undefined) { cols.push('birth_year'); vals.push(req.body.birth_year || null); }
    if (req.body.father_name !== undefined) { cols.push('father_name'); vals.push(req.body.father_name || null); }
    if (req.body.mother_name !== undefined) { cols.push('mother_name'); vals.push(req.body.mother_name || null); }
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');

    const { rows } = await query(
      `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id, username, role`,
      vals
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
    const { first_name, last_name, email, phone, branch_id, is_active, username, role, address, mother_phone, birth_year, father_name, mother_name } = req.body;

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
    if (address !== undefined) { updates.push(`address = $${paramIdx++}`); params.push(address || null); }
    if (mother_phone !== undefined) { updates.push(`mother_phone = $${paramIdx++}`); params.push(mother_phone || null); }
    if (birth_year !== undefined) { updates.push(`birth_year = $${paramIdx++}`); params.push(birth_year || null); }
    if (father_name !== undefined) { updates.push(`father_name = $${paramIdx++}`); params.push(father_name || null); }
    if (mother_name !== undefined) { updates.push(`mother_name = $${paramIdx++}`); params.push(mother_name || null); }
    if (req.user.role === 'super_admin' || req.user.role === 'branch_admin') {
      if (username !== undefined) { updates.push(`username = $${paramIdx++}`); params.push(username.toLowerCase().trim()); }
      if (branch_id !== undefined && req.user.role === 'super_admin') { updates.push(`branch_id = $${paramIdx++}`); params.push(branch_id || null); }
      if (is_active !== undefined) { updates.push(`is_active = $${paramIdx++}`); params.push(is_active); }
      if (req.body.created_at) { updates.push(`created_at = $${paramIdx++}`); params.push(req.body.created_at); }
      if (role !== undefined) {
        const validRoles = ['super_admin', 'branch_admin', 'teacher', 'student'];
        if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });
        // Branch admins cannot promote anyone to super admin
        if (req.user.role === 'branch_admin' && role === 'super_admin') return res.status(403).json({ error: 'Cannot assign super admin' });
        updates.push(`role = $${paramIdx++}`); params.push(role);
      }
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

// POST /api/users/:id/graduate — mark a student as graduated, or edit an existing graduation record
router.post('/:id/graduate', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { group_id, note } = req.body;

    const { rows: existing } = await query('SELECT id, role, branch_id, graduated_at FROM users WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });
    const student = existing[0];
    if (student.role !== 'student') return res.status(400).json({ error: 'Only students can be graduated' });
    if (req.user.role === 'branch_admin' && student.branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });

    if (group_id) {
      const { rows: grp } = await query('SELECT id, branch_id FROM groups WHERE id = $1', [group_id]);
      if (!grp.length) return res.status(400).json({ error: 'Group not found' });
      if (req.user.role === 'branch_admin' && grp[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });
    }

    // First call sets graduated_at; re-calling (edit) preserves the original date
    const { rows } = await query(
      `UPDATE users SET
         graduated_at = COALESCE(graduated_at, NOW()),
         graduation_note = $1,
         graduated_group_id = $2,
         graduated_branch_id = branch_id,
         is_active = false
       WHERE id = $3
       RETURNING id, first_name, last_name, graduated_at, graduation_note, graduated_group_id, graduated_branch_id`,
      [note || null, group_id || null, id]
    );

    await log(req.user.id, student.graduated_at ? 'STUDENT_GRADUATION_UPDATED' : 'STUDENT_GRADUATED', 'user', id, { group_id: group_id || null }, req.ip);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/users/:id/graduate — revert a graduation (re-activates the account)
router.delete('/:id/graduate', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { rows: existing } = await query('SELECT id, role, branch_id FROM users WHERE id = $1', [id]);
    if (!existing.length) return res.status(404).json({ error: 'User not found' });
    if (req.user.role === 'branch_admin' && existing[0].branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Access denied' });

    await query(
      `UPDATE users SET graduated_at = NULL, graduation_note = NULL, graduated_branch_id = NULL, graduated_group_id = NULL, is_active = true WHERE id = $1`,
      [id]
    );
    await log(req.user.id, 'STUDENT_GRADUATION_REVERTED', 'user', id, null, req.ip);
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
