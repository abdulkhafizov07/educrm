const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const ExcelJS = require('exceljs');
const { query } = require('../db');
const { verifyToken, requireRole } = require('../middleware/auth');
const { log } = require('../utils/logger');

const router = express.Router();
router.use(verifyToken);

const USER_FIELDS = `
  u.id, u.username, u.email, u.first_name, u.last_name, u.middle_name, u.phone,
  u.role, u.branch_id, u.avatar_url, u.is_active, u.last_login, u.created_at,
  u.address, u.mother_phone, u.birth_year, u.father_name, u.mother_name,
  u.birth_date, u.document_number, u.pinfl, u.school_number, u.school_grade, u.direction_id,
  u.graduated_at, u.graduation_note, u.graduated_branch_id, u.graduated_group_id,
  b.name as branch_name, gb.name as graduated_branch_name, gg.name as graduated_group_name,
  d.name as direction_name, d.color as direction_color,
  (SELECT string_agg(g2.name, ', ') FROM group_students gs2 JOIN groups g2 ON gs2.group_id = g2.id
   WHERE gs2.student_id = u.id) as group_names
`;
const USER_JOINS = `
  LEFT JOIN branches b ON u.branch_id = b.id
  LEFT JOIN branches gb ON u.graduated_branch_id = gb.id
  LEFT JOIN groups gg ON u.graduated_group_id = gg.id
  LEFT JOIN directions d ON u.direction_id = d.id
`;

// Student passwords stay visible to admins — include the clear-text column only for them
const fieldsFor = (req) => ['super_admin', 'branch_admin'].includes(req.user.role)
  ? `${USER_FIELDS}, u.plain_password` : USER_FIELDS;

// Random 8-char password from an unambiguous charset (no 0/O, 1/l/i)
const generatePassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(8)).map(b => chars[b % chars.length]).join('');
};

// Extra profile columns accepted from create/update payloads (all optional)
const EXTRA_FIELDS = ['middle_name', 'address', 'mother_phone', 'birth_year', 'father_name', 'mother_name',
  'birth_date', 'document_number', 'pinfl', 'school_number', 'school_grade', 'direction_id'];

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
    conditions.push(`(u.username ILIKE $${idx} OR u.first_name ILIKE $${idx} OR u.last_name ILIKE $${idx} OR u.middle_name ILIKE $${idx} OR u.email ILIKE $${idx})`);
    params.push(`%${q.search}%`); idx++;
  }

  // Students can only see themselves; teachers additionally see ONLY the
  // students enrolled in their own groups (so they can view and add students).
  // Observers have full read access (no extra condition).
  if (req.user.role === 'student') {
    conditions.push(`u.id = $${idx++}`); params.push(req.user.id);
  } else if (req.user.role === 'teacher') {
    conditions.push(`(u.id = $${idx} OR (u.role = 'student' AND EXISTS (
      SELECT 1 FROM group_students tgs JOIN groups tg ON tgs.group_id = tg.id
      WHERE tgs.student_id = u.id AND tg.teacher_id = $${idx})))`);
    params.push(req.user.id); idx++;
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
      `SELECT ${fieldsFor(req)} FROM users u ${USER_JOINS}
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
      `SELECT u.first_name, u.last_name, u.middle_name, u.username, u.phone, u.email, u.created_at, u.is_active,
              u.address, u.mother_phone, u.birth_year, u.father_name, u.mother_name,
              u.birth_date, u.document_number, u.pinfl, u.school_number, u.school_grade,
              b.name as branch_name, d.name as direction_name,
              (SELECT string_agg(g.name, ', ') FROM group_students gs JOIN groups g ON gs.group_id = g.id WHERE gs.student_id = u.id) as group_names
       FROM users u
       LEFT JOIN branches b ON u.branch_id = b.id
       LEFT JOIN directions d ON u.direction_id = d.id
       ${where}
       ORDER BY u.first_name, u.last_name`,
      params
    );

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Students');
    ws.mergeCells('A1', 'V1');
    ws.getCell('A1').value = "O'quvchilar ro'yxati";
    ws.getCell('A1').font = { bold: true, size: 14 };
    ws.addRow([]);

    const header = ws.addRow(['#', 'Ism', 'Familiya', 'Otchestva', 'Login', 'Telefon', 'Email', 'Filial', "Yo'nalish", 'Guruhlar', "Tug'ilgan sana", 'Guvohnoma/Passport', 'JSHSHIR', 'Maktab №', 'Sinf', 'Yashash manzili', 'Otasining ismi', 'Onasining ismi', 'Ota-onasining telefon raqami', 'Yosh', "Qo'shilgan sana", 'Holat']);
    header.font = { bold: true };
    header.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });

    const currentYear = new Date().getFullYear();
    rows.forEach((r, i) => {
      ws.addRow([
        i + 1, r.first_name, r.last_name, r.middle_name || '', r.username, r.phone || '', r.email || '',
        r.branch_name || '', r.direction_name || '', r.group_names || '',
        r.birth_date ? new Date(r.birth_date).toISOString().slice(0, 10) : (r.birth_year || ''),
        r.document_number || '', r.pinfl || '', r.school_number || '', r.school_grade || '',
        r.address || '', r.father_name || '', r.mother_name || '', r.mother_phone || '',
        r.birth_year ? currentYear - r.birth_year : '',
        r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
        r.is_active ? 'Faol' : 'Nofaol',
      ]);
    });

    ws.columns = [{ width: 5 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 16 }, { width: 16 }, { width: 24 }, { width: 18 }, { width: 18 }, { width: 28 }, { width: 14 }, { width: 20 }, { width: 18 }, { width: 12 }, { width: 10 }, { width: 26 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 8 }, { width: 14 }, { width: 10 }];

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="students-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Export failed' });
  }
});

// ===== Student Excel import =====
// File is parsed in memory — nothing is written to disk
const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.xlsx$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Faqat .xlsx fayl yuklash mumkin'));
  },
});
// Wrap multer so its errors return clean JSON instead of crashing
const handleExcelUpload = (req, res, next) => {
  uploadExcel.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    next();
  });
};

// Column headers recognized in the uploaded file (matched case-insensitively,
// apostrophe variants stripped). Uzbek names mirror the export/template files.
const IMPORT_HEADER_MAP = {
  'ism': 'first_name', 'first name': 'first_name', 'имя': 'first_name',
  'familiya': 'last_name', 'last name': 'last_name', 'фамилия': 'last_name',
  'otchestva': 'middle_name', 'otchestvo': 'middle_name', 'sharifi': 'middle_name',
  'middle name': 'middle_name', 'отчество': 'middle_name',
  'login': 'username', 'username': 'username', 'логин': 'username',
  'parol': 'password', 'password': 'password', 'пароль': 'password',
  'telefon': 'phone', 'phone': 'phone', 'телефон': 'phone',
  'email': 'email',
  'filial': 'branch', 'branch': 'branch', 'филиал': 'branch',
  'yonalish': 'direction', 'direction': 'direction', 'направление': 'direction',
  'guruh': 'groups', 'guruhlar': 'groups', 'groups': 'groups', 'группа': 'groups', 'группы': 'groups',
  'tugilgan sana': 'birth_date', 'birth date': 'birth_date', 'дата рождения': 'birth_date',
  'guvohnoma/passport': 'document_number', 'guvohnoma': 'document_number', 'passport': 'document_number',
  'jshshir': 'pinfl', 'pinfl': 'pinfl', 'пинфл': 'pinfl',
  'maktab №': 'school_number', 'maktab': 'school_number', 'maktab raqami': 'school_number',
  'sinf': 'school_grade', 'class': 'school_grade', 'класс': 'school_grade',
  'yashash manzili': 'address', 'manzil': 'address', 'address': 'address', 'адрес': 'address',
  'otasining ismi': 'father_name', 'father name': 'father_name',
  'onasining ismi': 'mother_name', 'mother name': 'mother_name',
  'ota-onasining telefon raqami': 'mother_phone', 'onasining telefoni': 'mother_phone', 'ota-ona telefoni': 'mother_phone',
  'qoshilgan sana': 'created_at', 'joined': 'created_at',
};

const IMPORT_TEMPLATE_HEADERS = ['Ism', 'Familiya', 'Otchestva', 'Login', 'Parol', 'Telefon', 'Email', 'Filial', "Yo'nalish",
  'Guruhlar', "Tug'ilgan sana", 'Guvohnoma/Passport', 'JSHSHIR', 'Maktab №', 'Sinf', 'Yashash manzili',
  'Otasining ismi', 'Onasining ismi', 'Ota-onasining telefon raqami', "Qo'shilgan sana"];

const normHeader = (s) => String(s).toLowerCase().replace(/[’'ʼ`´]/g, '').replace(/\s+/g, ' ').trim();

// ExcelJS cell values can be Date/richText/hyperlink/formula objects — reduce all to plain text
function cellText(cell) {
  const v = cell && cell.value;
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map(t => t.text).join('').trim();
    if (v.text !== undefined) return String(v.text).trim();
    if (v.result !== undefined) return String(v.result).trim();
    return '';
  }
  return String(v).trim();
}

// Accepts 'yyyy-mm-dd' and 'dd.mm.yyyy' / 'dd/mm/yyyy'
function parseDateStr(s) {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

// Cyrillic → Latin for auto-generated logins (names often arrive in Cyrillic)
const CYR_TO_LAT = {
  'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'j', 'з': 'z', 'и': 'i',
  'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't',
  'у': 'u', 'ф': 'f', 'х': 'x', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sh', 'ъ': '', 'ы': 'i', 'ь': '',
  'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o', 'қ': 'q', 'ғ': 'g', 'ҳ': 'h',
};
const translit = (s) => String(s).toLowerCase()
  .split('').map(c => CYR_TO_LAT[c] !== undefined ? CYR_TO_LAT[c] : c).join('')
  .replace(/[’'ʼ`´]/g, '').replace(/[^a-z0-9]/g, '');

async function generateUsername(first, last, usedInBatch) {
  const base = `${translit(first)}.${translit(last)}`.replace(/^\.+|\.+$/g, '') || 'student';
  for (let i = 0; i < 500; i++) {
    const candidate = i === 0 ? base : `${base}${i}`;
    if (usedInBatch.has(candidate)) continue;
    const { rows } = await query('SELECT 1 FROM users WHERE username = $1', [candidate]);
    if (!rows.length) return candidate;
  }
  return `${base}${Date.now() % 100000}`;
}

// GET /api/users/students/import/template — empty Excel template for bulk student import
router.get('/students/import/template', requireRole('super_admin', 'branch_admin'), async (req, res) => {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Students');
    const header = ws.addRow(IMPORT_TEMPLATE_HEADERS);
    header.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF111827' } }; c.font = { bold: true, color: { argb: 'FFFFFFFF' } }; });
    ws.addRow(['Ali', 'Valiyev', 'Valijonovich', 'ali.valiyev', 'ali12345', '+998901234567', 'ali@example.com', '', '', '',
      '2010-05-14', 'AA 1234567', '', '25', '9', 'Toshkent sh.', 'Vali', 'Zuhra', '+998901234568', '']);
    ws.columns = IMPORT_TEMPLATE_HEADERS.map(h => ({ width: Math.max(14, h.length + 4) }));

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="students-import-template.xlsx"');
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Template failed' });
  }
});

// POST /api/users/students/import — bulk-create students from an uploaded Excel file.
// Bad rows are skipped and reported; good rows are still imported (partial success).
router.post('/students/import', requireRole('super_admin', 'branch_admin'), handleExcelUpload, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.worksheets[0];
    if (!ws) return res.status(400).json({ error: 'Fayl bo\'sh' });

    // Header row can be row 1 (template) or row 3 (export file) — find it by content
    let headerRowNum = 0;
    const colMap = {};
    for (let r = 1; r <= Math.min(10, ws.rowCount) && !headerRowNum; r++) {
      const map = {};
      ws.getRow(r).eachCell({ includeEmpty: false }, (cell, col) => {
        const field = IMPORT_HEADER_MAP[normHeader(cellText(cell))];
        if (field && map[field] === undefined) map[field] = col;
      });
      if (map.first_name && map.last_name) { headerRowNum = r; Object.assign(colMap, map); }
    }
    if (!headerRowNum) {
      return res.status(400).json({ error: "Sarlavha qatori topilmadi: faylda 'Ism' va 'Familiya' ustunlari bo'lishi kerak" });
    }
    if (ws.rowCount - headerRowNum > 2000) {
      return res.status(400).json({ error: "Bir faylda ko'pi bilan 2000 qator bo'lishi mumkin" });
    }

    // Branch/direction/group lookups are resolved by name, once per import
    const { rows: branchRows } = await query('SELECT id, name FROM branches');
    const { rows: directionRows } = await query('SELECT id, name, branch_id FROM directions');
    const { rows: groupRows } = await query('SELECT id, name, branch_id, direction_id FROM groups');
    const branchByName = new Map(branchRows.map(b => [b.name.toLowerCase().trim(), b.id]));

    const errors = [];   // row skipped
    const warnings = []; // row imported, but something wasn't matched
    let created = 0;
    let total = 0;
    const usedUsernames = new Set();
    const hashCache = new Map(); // same password (usually the default) is hashed once

    for (let r = headerRowNum + 1; r <= ws.rowCount; r++) {
      const row = ws.getRow(r);
      const val = (field) => (colMap[field] ? cellText(row.getCell(colMap[field])) : '');

      const firstName = val('first_name');
      const lastName = val('last_name');
      if (!firstName && !lastName) continue; // empty row
      total++;
      if (!firstName || !lastName) {
        errors.push({ row: r, message: "Ism yoki familiya yo'q" });
        continue;
      }

      // Branch: branch_admin always imports into their own branch
      let branchId = req.user.role === 'branch_admin' ? req.user.branch_id : null;
      if (req.user.role === 'super_admin' && val('branch')) {
        branchId = branchByName.get(val('branch').toLowerCase()) || null;
        if (!branchId) warnings.push({ row: r, message: `Filial topilmadi: ${val('branch')}` });
      }

      let directionId = null;
      if (val('direction')) {
        const dn = val('direction').toLowerCase();
        const matches = directionRows.filter(d => d.name.toLowerCase().trim() === dn);
        const match = matches.find(d => !branchId || d.branch_id === branchId || !d.branch_id) || matches[0];
        if (match) directionId = match.id;
        else warnings.push({ row: r, message: `Yo'nalish topilmadi: ${val('direction')}` });
      }

      const groupIds = [];
      if (val('groups')) {
        for (const gn of val('groups').split(',').map(s => s.trim()).filter(Boolean)) {
          const matches = groupRows.filter(g => g.name.toLowerCase().trim() === gn.toLowerCase());
          const match = matches.find(g => !branchId || g.branch_id === branchId) || matches[0];
          // Branch admins may only enroll into their own branch's groups
          if (match && (req.user.role !== 'branch_admin' || match.branch_id === req.user.branch_id)) {
            groupIds.push(match.id);
            if (!directionId && match.direction_id) directionId = match.direction_id;
          } else {
            warnings.push({ row: r, message: `Guruh topilmadi: ${gn}` });
          }
        }
      }

      // Username: taken from the file or generated from the name
      let username = val('username').toLowerCase().trim();
      if (username) {
        const { rows: existing } = await query('SELECT 1 FROM users WHERE username = $1', [username]);
        if (existing.length || usedUsernames.has(username)) {
          errors.push({ row: r, message: `Login band: ${username}` });
          continue;
        }
      } else {
        username = await generateUsername(firstName, lastName, usedUsernames);
      }
      usedUsernames.add(username);

      // No password in the file -> generate a unique one per student
      const password = val('password') || generatePassword();
      let hash = hashCache.get(password);
      if (!hash) { hash = await bcrypt.hash(password, 12); hashCache.set(password, hash); }

      // Birth column accepts a full date or just a year
      let birthDate = null;
      let birthYear = null;
      const birthRaw = val('birth_date');
      if (/^\d{4}$/.test(birthRaw)) birthYear = parseInt(birthRaw);
      else if (birthRaw) {
        birthDate = parseDateStr(birthRaw);
        if (birthDate) birthYear = new Date(birthDate).getFullYear();
        else warnings.push({ row: r, message: `Tug'ilgan sana noto'g'ri: ${birthRaw}` });
      }

      const cols = ['username', 'email', 'password_hash', 'plain_password', 'first_name', 'last_name', 'middle_name', 'phone', 'role', 'branch_id',
        'direction_id', 'address', 'mother_phone', 'birth_year', 'father_name', 'mother_name', 'birth_date',
        'document_number', 'pinfl', 'school_number', 'school_grade'];
      const vals = [username, val('email') || null, hash, password, firstName, lastName, val('middle_name') || null, val('phone') || null, 'student', branchId,
        directionId, val('address') || null, val('mother_phone') || null, birthYear, val('father_name') || null,
        val('mother_name') || null, birthDate, val('document_number') || null, val('pinfl') || null,
        val('school_number') || null, val('school_grade') || null];
      const createdAt = parseDateStr(val('created_at'));
      if (createdAt) { cols.push('created_at'); vals.push(createdAt); }

      try {
        const { rows: inserted } = await query(
          `INSERT INTO users (${cols.join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING id`,
          vals
        );
        for (const gid of groupIds) {
          await query('INSERT INTO group_students (group_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [gid, inserted[0].id]);
        }
        created++;
      } catch (err) {
        if (err.code === '23505') errors.push({ row: r, message: `Login yoki email band: ${username}` });
        else { console.error(err); errors.push({ row: r, message: 'Saqlashda xatolik' }); }
      }
    }

    await log(req.user.id, 'STUDENTS_IMPORTED', 'user', null, { created, total, errors: errors.length }, req.ip);
    res.json({ created, total, errors, warnings });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Import failed' });
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

// GET /api/users/:id/teacher-stats — dashboard-like statistics for a teacher's profile
router.get('/:id/teacher-stats', async (req, res) => {
  try {
    const { id } = req.params;
    const allowed = ['super_admin', 'branch_admin', 'observer'].includes(req.user.role) || req.user.id === id;
    if (!allowed) return res.status(403).json({ error: 'Access denied' });

    const { rows: target } = await query('SELECT id, role, branch_id FROM users WHERE id = $1', [id]);
    if (!target.length) return res.status(404).json({ error: 'User not found' });
    if (target[0].role !== 'teacher') return res.status(400).json({ error: 'Not a teacher' });
    if (req.user.role === 'branch_admin' && target[0].branch_id && target[0].branch_id !== req.user.branch_id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [groups, students, attendanceToday, trend, overall] = await Promise.all([
      query(`SELECT COUNT(*) FROM groups WHERE teacher_id = $1 AND is_active = true`, [id]),
      query(
        `SELECT COUNT(DISTINCT gs.student_id) AS count FROM group_students gs
         JOIN groups g ON gs.group_id = g.id WHERE g.teacher_id = $1 AND g.is_active = true`,
        [id]
      ),
      query(
        `SELECT COUNT(ar.id) as total,
           SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
           SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
           SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count
         FROM attendance_records ar
         JOIN attendance_sessions s ON ar.session_id = s.id
         JOIN groups g ON s.group_id = g.id
         WHERE s.session_date = CURRENT_DATE AND g.teacher_id = $1`,
        [id]
      ),
      query(
        `SELECT s.session_date,
           SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
           SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
           SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
           COUNT(ar.id) as total
         FROM attendance_sessions s
         JOIN attendance_records ar ON ar.session_id = s.id
         JOIN groups g ON s.group_id = g.id
         WHERE s.session_date >= CURRENT_DATE - INTERVAL '7 days' AND g.teacher_id = $1
         GROUP BY s.session_date ORDER BY s.session_date`,
        [id]
      ),
      query(
        `SELECT COUNT(ar.id) as total,
           SUM(CASE WHEN ar.status IN ('present', 'late') THEN 1 ELSE 0 END) as attended,
           COUNT(DISTINCT s.id) as sessions
         FROM attendance_records ar
         JOIN attendance_sessions s ON ar.session_id = s.id
         JOIN groups g ON s.group_id = g.id
         WHERE g.teacher_id = $1`,
        [id]
      ),
    ]);

    const o = overall.rows[0];
    const totalRecords = parseInt(o.total) || 0;
    res.json({
      stats: {
        groups: parseInt(groups.rows[0].count),
        students: parseInt(students.rows[0].count),
        sessions: parseInt(o.sessions) || 0,
        attendancePct: totalRecords ? Math.round((parseInt(o.attended) / totalRecords) * 100) : 0,
      },
      attendanceToday: attendanceToday.rows[0],
      attendanceTrend: trend.rows,
    });
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
    if (req.user.role === 'teacher' && req.user.id !== id) {
      // Teachers may only open profiles of students enrolled in their own groups
      const { rows: visible } = await query(
        `SELECT 1 FROM users s WHERE s.id = $1 AND s.role = 'student' AND
           EXISTS (SELECT 1 FROM group_students gs JOIN groups g ON gs.group_id = g.id
                   WHERE gs.student_id = s.id AND g.teacher_id = $2)`,
        [id, req.user.id]
      );
      if (!visible.length) return res.status(403).json({ error: 'Access denied' });
    }

    const { rows } = await query(
      `SELECT ${fieldsFor(req)} FROM users u ${USER_JOINS} WHERE u.id = $1`,
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

// POST /api/users — admins create any allowed role; teachers may only create students
router.post('/', requireRole('super_admin', 'branch_admin', 'teacher'), async (req, res) => {
  try {
    let { username, password } = req.body;
    const { email, first_name, last_name, phone, role, branch_id, group_id } = req.body;
    if (!first_name || !last_name || !role) {
      return res.status(400).json({ error: 'Required fields: first_name, last_name, role' });
    }
    const validRoles = ['super_admin', 'branch_admin', 'teacher', 'student', 'observer'];
    if (!validRoles.includes(role)) return res.status(400).json({ error: 'Invalid role' });

    // Students: missing credentials are generated automatically; staff must provide both
    if (role === 'student') {
      if (!username) username = await generateUsername(first_name, last_name, new Set());
      if (!password) password = generatePassword();
    } else if (!username || !password) {
      return res.status(400).json({ error: 'Required fields: username, password' });
    }

    // Branch admin can only create branch_admin(same branch), teacher, student
    if (req.user.role === 'branch_admin') {
      if (role === 'super_admin' || role === 'observer') return res.status(403).json({ error: 'Cannot create this role' });
      if (role === 'branch_admin' && branch_id !== req.user.branch_id) return res.status(403).json({ error: 'Cannot assign to other branch' });
    }
    // Teachers can only create students (no delete rights anywhere).
    // Group is required for them — a student outside the teacher's groups
    // would be invisible to the teacher right after creation.
    if (req.user.role === 'teacher') {
      if (role !== 'student') return res.status(403).json({ error: 'Teachers can only add students' });
      if (!group_id) return res.status(400).json({ error: 'group_id required' });
    }

    // Optional group enrollment (student's Guruh field) — validate scope before creating
    if (group_id) {
      const { rows: grp } = await query('SELECT id, branch_id, teacher_id FROM groups WHERE id = $1', [group_id]);
      if (!grp.length) return res.status(400).json({ error: 'Group not found' });
      if (req.user.role === 'branch_admin' && grp[0].branch_id !== req.user.branch_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      // Teachers may only enroll into groups they teach themselves
      if (req.user.role === 'teacher' && grp[0].teacher_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const hash = await bcrypt.hash(password, 12);
    const assignedBranch = req.user.role === 'super_admin' ? (branch_id || null) : (req.user.branch_id || branch_id || null);

    // Optional manual join date; if omitted, the created_at column default (NOW()) applies
    const cols = ['username', 'email', 'password_hash', 'first_name', 'last_name', 'phone', 'role', 'branch_id'];
    const vals = [username.toLowerCase().trim(), email || null, hash, first_name, last_name, phone || null, role, assignedBranch];
    // Clear-text copy kept for students only, so admins can look the password up later
    if (role === 'student') { cols.push('plain_password'); vals.push(password); }
    if (req.body.created_at) { cols.push('created_at'); vals.push(req.body.created_at); }
    // birth_date also keeps the legacy birth_year column in sync (age filters/exports)
    if (req.body.birth_date && req.body.birth_year === undefined) {
      req.body.birth_year = new Date(req.body.birth_date).getFullYear() || null;
    }
    for (const f of EXTRA_FIELDS) {
      if (req.body[f] !== undefined) { cols.push(f); vals.push(req.body[f] || null); }
    }
    const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');

    const { rows } = await query(
      `INSERT INTO users (${cols.join(', ')}) VALUES (${placeholders}) RETURNING id, username, role`,
      vals
    );

    if (group_id && role === 'student') {
      await query('INSERT INTO group_students (group_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [group_id, rows[0].id]);
    }

    await log(req.user.id, 'USER_CREATED', 'user', rows[0].id, { role, username }, req.ip);
    // Echo the credentials back so the UI can show them (esp. when auto-generated)
    res.status(201).json(role === 'student' ? { ...rows[0], password } : rows[0]);
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
    const { first_name, last_name, email, phone, branch_id, is_active, username, role } = req.body;

    // Permission checks — observers are strictly read-only
    if (req.user.role === 'observer') return res.status(403).json({ error: 'Access denied' });
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
    // birth_date also keeps the legacy birth_year column in sync
    if (req.body.birth_date && req.body.birth_year === undefined) {
      req.body.birth_year = new Date(req.body.birth_date).getFullYear() || null;
    }
    for (const f of EXTRA_FIELDS) {
      if (req.body[f] !== undefined) { updates.push(`${f} = $${paramIdx++}`); params.push(req.body[f] || null); }
    }
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

    // Optional group enrollment (student's Guruh field) — admins only
    if (req.body.group_id && ['super_admin', 'branch_admin'].includes(req.user.role) && existing[0].role === 'student') {
      const { rows: grp } = await query('SELECT id, branch_id FROM groups WHERE id = $1', [req.body.group_id]);
      if (grp.length && (req.user.role === 'super_admin' || grp[0].branch_id === req.user.branch_id)) {
        await query('INSERT INTO group_students (group_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.body.group_id, id]);
      }
    }

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
    // Keep the admin-visible clear-text copy in sync (students only)
    if (rows[0].role === 'student') {
      await query('UPDATE users SET password_hash = $1, plain_password = $2 WHERE id = $3', [hash, newPassword, id]);
    } else {
      await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, id]);
    }
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
