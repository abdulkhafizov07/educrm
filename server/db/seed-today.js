// Bugungi kun uchun davomat sessiyalarini yaratadi (faqat seed filiallar uchun).
// Dashborddagi "Bugungi davomat" ko'rsatkichini test qilishga yordam beradi.
// Ishga tushirish: node server/db/seed-today.js
const { pool } = require('./index');
require('dotenv').config();

const rndInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

async function seedToday() {
  const client = await pool.connect();
  try {
    const dow = new Date().getDay();

    // Bugun dars jadvali bo'lgan seed-guruhlar (o'z qo'lda kiritilgan filiallarga tegilmaydi)
    const { rows: groups } = await client.query(
      `SELECT g.id, g.teacher_id, s.start_time
       FROM groups g
       JOIN branches b ON b.id = g.branch_id
       JOIN schedules s ON s.group_id = g.id AND s.day_of_week = $1
       WHERE g.is_active = true AND g.teacher_id IS NOT NULL
         AND b.email LIKE '%@educrm.uz'`,
      [dow]
    );

    if (groups.length === 0) {
      console.log('Bugun jadvali bor seed-guruh topilmadi (hafta kuni:', dow, ').');
      return;
    }

    await client.query('BEGIN');
    let sessions = 0, records = 0;

    for (const g of groups) {
      const { rows: sesRows } = await client.query(
        `INSERT INTO attendance_sessions (group_id, teacher_id, session_date, start_time)
         VALUES ($1, $2, CURRENT_DATE, $3)
         ON CONFLICT (group_id, session_date) DO NOTHING
         RETURNING id`,
        [g.id, g.teacher_id, g.start_time]
      );
      if (sesRows.length === 0) continue; // bugungi sessiya allaqachon bor
      sessions++;

      const { rows: students } = await client.query(
        `SELECT student_id FROM group_students WHERE group_id = $1`, [g.id]
      );
      for (const st of students) {
        const roll = Math.random();
        let status = 'present', late = 0;
        if (roll < 0.08) status = 'absent';
        else if (roll < 0.18) { status = 'late'; late = rndInt(5, 25); }
        await client.query(
          `INSERT INTO attendance_records (session_id, student_id, status, late_minutes)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (session_id, student_id) DO NOTHING`,
          [sesRows[0].id, st.student_id, status, late]
        );
        records++;
      }
    }

    await client.query('COMMIT');
    console.log(`Bugungi davomat yaratildi: ${sessions} sessiya, ${records} yozuv.`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Xato:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seedToday().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { seedToday };
