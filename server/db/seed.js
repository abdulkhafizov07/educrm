// Test ma'lumotlari: 5 filial, yo'nalishlar, guruhlar, o'qituvchilar, o'quvchilar,
// dars jadvallari va davomat yozuvlari.
// Ishga tushirish: node server/db/seed.js
const bcrypt = require('bcryptjs');
const { pool } = require('./index');
require('dotenv').config();

const PASSWORD = 'Test@123'; // barcha seed foydalanuvchilar uchun

const BRANCHES = [
  { name: 'Chilonzor filiali', address: "Toshkent sh., Chilonzor tumani, Bunyodkor ko'chasi 12", phone: '+998 71 200 10 01', email: 'chilonzor@educrm.uz', colors: ['#2563eb', '#1e40af'] },
  { name: 'Yunusobod filiali', address: "Toshkent sh., Yunusobod tumani, Amir Temur ko'chasi 45", phone: '+998 71 200 10 02', email: 'yunusobod@educrm.uz', colors: ['#16a34a', '#166534'] },
  { name: "Mirzo Ulug'bek filiali", address: "Toshkent sh., Mirzo Ulug'bek tumani, Buyuk Ipak Yo'li 78", phone: '+998 71 200 10 03', email: 'ulugbek@educrm.uz', colors: ['#dc2626', '#991b1b'] },
  { name: 'Samarqand filiali', address: "Samarqand sh., Registon ko'chasi 5", phone: '+998 66 200 10 04', email: 'samarqand@educrm.uz', colors: ['#9333ea', '#6b21a8'] },
  { name: 'Sergeli filiali', address: "Toshkent sh., Sergeli tumani, Yangi Sergeli ko'chasi 21", phone: '+998 71 200 10 05', email: 'sergeli@educrm.uz', colors: ['#ea580c', '#9a3412'] },
];

// Har filialga beriladigan yo'nalishlar (nomi, rangi, guruh nom-prefikslari)
const DIRECTION_POOL = [
  { name: 'Ingliz tili', color: 'blue', desc: "Umumiy ingliz tili kurslari (Beginner - IELTS)", groups: ['Beginner', 'Elementary', 'Pre-Intermediate', 'IELTS'] },
  { name: 'Matematika', color: 'green', desc: 'Maktab va abituriyentlar uchun matematika', groups: ['Algebra', 'Geometriya', 'Abituriyent'] },
  { name: 'Dasturlash', color: 'purple', desc: 'Frontend va backend dasturlash kurslari', groups: ['Frontend', 'Backend', 'Python'] },
  { name: 'Rus tili', color: 'red', desc: 'Rus tili grammatika va og`zaki nutq', groups: ['Boshlang`ich', 'Davomiy'] },
  { name: 'Fizika', color: 'orange', desc: 'Fizika fanidan tayyorlov kurslari', groups: ['Mexanika', 'Abituriyent'] },
];

const MALE_FIRST = ['Sardor', 'Jasur', 'Bekzod', 'Aziz', 'Doston', 'Sherzod', 'Ulug`bek', 'Javohir', 'Otabek', 'Nodir', 'Farrux', 'Shohruh', 'Bobur', 'Temur', 'Alisher', 'Diyor', 'Islom', 'Kamron', 'Muhammad', 'Samandar'];
const FEMALE_FIRST = ['Malika', 'Nilufar', 'Zarina', 'Dilnoza', 'Gulnora', 'Madina', 'Sevara', 'Kamola', 'Nargiza', 'Shahzoda', 'Umida', 'Feruza', 'Laylo', 'Munisa', 'Zilola', 'Dildora', 'Nozima', 'Rayhona', 'Sitora', 'Xushnida'];
const LAST_NAMES = ['Karimov', 'Rahimov', 'Toshmatov', 'Yusupov', 'Aliyev', 'Ismoilov', 'Saidov', 'Nazarov', 'Qodirov', 'Ergashev', 'Mirzayev', 'Abdullayev', 'Sultonov', 'Xolmatov', 'Umarov', 'Berdiyev', 'Jo`rayev', 'Tursunov', 'Ochilov', 'Haydarov'];
const FATHER_NAMES = ['Akmal', 'Botir', 'G`ayrat', 'Ilhom', 'Mansur', 'Odil', 'Rustam', 'Shavkat', 'Tohir', 'Zafar'];
const MOTHER_NAMES = ['Dilbar', 'Gulchehra', 'Hulkar', 'Mavluda', 'Nasiba', 'Oydin', 'Ra`no', 'Saida', 'Tursunoy', 'Zulfiya'];
const STREETS = ['Bog`ishamol', 'Navro`z', 'Istiqlol', 'Mustaqillik', 'Do`stlik', 'Yoshlik', 'Guliston', 'Paxtakor'];

const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rndInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
const phone = () => `+998 9${rndInt(0, 9)} ${rndInt(100, 999)} ${String(rndInt(0, 99)).padStart(2, '0')} ${String(rndInt(0, 99)).padStart(2, '0')}`;

// Jadval variantlari: [hafta kunlari], boshlanish vaqtlari
const SCHEDULE_PATTERNS = [
  { days: [1, 3, 5], times: ['09:00', '11:00', '14:00', '16:00', '18:00'] }, // Du-Chor-Ju
  { days: [2, 4, 6], times: ['09:00', '11:00', '14:00', '16:00', '18:00'] }, // Se-Pay-Shan
];

async function seed() {
  const client = await pool.connect();
  try {
    const existing = await client.query("SELECT COUNT(*)::int AS n FROM branches WHERE email LIKE '%@educrm.uz'");
    if (existing.rows[0].n > 0) {
      console.log('Seed ma`lumotlari allaqachon mavjud ko`rinadi (…@educrm.uz filiallari topildi).');
      console.log('Qayta yaratish uchun avval ularni o`chiring yoki skriptni moslang.');
      return;
    }

    const hash = await bcrypt.hash(PASSWORD, 12);
    let userSeq = 1;

    const insertUser = async (fields) => {
      const { rows } = await client.query(
        `INSERT INTO users (username, email, password_hash, first_name, last_name, phone, role, branch_id,
                            address, mother_phone, birth_year, father_name, mother_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [fields.username, fields.email || null, hash, fields.first_name, fields.last_name, fields.phone || null,
         fields.role, fields.branch_id || null, fields.address || null, fields.mother_phone || null,
         fields.birth_year || null, fields.father_name || null, fields.mother_name || null]
      );
      return rows[0].id;
    };

    await client.query('BEGIN');

    let totals = { branches: 0, directions: 0, groups: 0, teachers: 0, students: 0, admins: 0, sessions: 0 };

    for (let b = 0; b < BRANCHES.length; b++) {
      const br = BRANCHES[b];
      const { rows: brRows } = await client.query(
        `INSERT INTO branches (name, address, phone, email, colors) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [br.name, br.address, br.phone, br.email, br.colors]
      );
      const branchId = brRows[0].id;
      totals.branches++;

      // Filial admini
      await insertUser({
        username: `admin_${b + 1}`, email: `admin${b + 1}@educrm.uz`,
        first_name: rnd(MALE_FIRST), last_name: rnd(LAST_NAMES),
        phone: phone(), role: 'branch_admin', branch_id: branchId,
      });
      totals.admins++;

      // O'qituvchilar (har filialga 3 ta)
      const teacherIds = [];
      for (let t = 0; t < 3; t++) {
        const male = Math.random() < 0.5;
        const id = await insertUser({
          username: `teacher_${b + 1}_${t + 1}`, email: `teacher${b + 1}${t + 1}@educrm.uz`,
          first_name: male ? rnd(MALE_FIRST) : rnd(FEMALE_FIRST), last_name: rnd(LAST_NAMES),
          phone: phone(), role: 'teacher', branch_id: branchId,
        });
        teacherIds.push(id);
        totals.teachers++;
      }

      // Yo'nalishlar: har filialga 3 ta (aylanma tanlov bilan har xil bo'lsin)
      const dirs = [DIRECTION_POOL[b % 5], DIRECTION_POOL[(b + 1) % 5], DIRECTION_POOL[(b + 2) % 5]];
      for (const dir of dirs) {
        const { rows: dirRows } = await client.query(
          `INSERT INTO directions (name, description, color, branch_id) VALUES ($1,$2,$3,$4) RETURNING id`,
          [dir.name, dir.desc, dir.color, branchId]
        );
        const directionId = dirRows[0].id;
        totals.directions++;

        // Har yo'nalishda 2 ta guruh
        const groupNames = [...dir.groups].sort(() => Math.random() - 0.5).slice(0, 2);
        for (const gname of groupNames) {
          const teacherId = rnd(teacherIds);
          const startDaysAgo = rndInt(30, 120);
          const { rows: gRows } = await client.query(
            `INSERT INTO groups (name, branch_id, direction_id, teacher_id, description, max_students, start_date)
             VALUES ($1,$2,$3,$4,$5,$6, CURRENT_DATE - $7::int) RETURNING id`,
            [`${dir.name} - ${gname}`, branchId, directionId, teacherId, `${dir.name} yo'nalishi, ${gname} guruhi`, 20, startDaysAgo]
          );
          const groupId = gRows[0].id;
          totals.groups++;

          // Dars jadvali: haftasiga 3 kun, bir xil vaqt
          const pattern = rnd(SCHEDULE_PATTERNS);
          const startTime = rnd(pattern.times);
          const endTime = `${String(parseInt(startTime) + 2).padStart(2, '0')}:${startTime.slice(3)}`;
          for (const day of pattern.days) {
            await client.query(
              `INSERT INTO schedules (group_id, day_of_week, start_time, end_time, classroom)
               VALUES ($1,$2,$3,$4,$5)`,
              [groupId, day, startTime, endTime, `${rndInt(1, 3)}0${rndInt(1, 9)}-xona`]
            );
          }

          // O'quvchilar: har guruhga 10-15 ta
          const studentIds = [];
          const nStudents = rndInt(10, 15);
          for (let s = 0; s < nStudents; s++) {
            const male = Math.random() < 0.5;
            const first = male ? rnd(MALE_FIRST) : rnd(FEMALE_FIRST);
            let last = rnd(LAST_NAMES);
            if (!male) last += 'a';
            const id = await insertUser({
              username: `student_${String(userSeq).padStart(3, '0')}`,
              email: `student${userSeq}@educrm.uz`,
              first_name: first, last_name: last,
              phone: phone(), role: 'student', branch_id: branchId,
              address: `${rnd(STREETS)} ko'chasi ${rndInt(1, 99)}-uy`,
              mother_phone: phone(), birth_year: rndInt(2005, 2015),
              father_name: `${rnd(FATHER_NAMES)} ${last.replace(/a$/, '')}`,
              mother_name: `${rnd(MOTHER_NAMES)} ${last.endsWith('a') ? last : last + 'a'}`,
            });
            userSeq++;
            studentIds.push(id);
            totals.students++;
            await client.query(
              `INSERT INTO group_students (group_id, student_id, enrolled_at)
               VALUES ($1,$2, NOW() - ($3 || ' days')::interval)`,
              [groupId, id, rndInt(5, startDaysAgo)]
            );
          }

          // Davomat: oxirgi 2 haftadagi jadval kunlari bo'yicha sessiyalar
          const today = new Date();
          for (let d = 14; d >= 1; d--) {
            const date = new Date(today);
            date.setDate(today.getDate() - d);
            if (!pattern.days.includes(date.getDay())) continue;
            const dateStr = date.toISOString().slice(0, 10);
            const isExam = d <= 2; // eng oxirgi dars — imtihon kuni
            const { rows: sesRows } = await client.query(
              `INSERT INTO attendance_sessions (group_id, teacher_id, session_date, start_time, is_exam)
               VALUES ($1,$2,$3,$4,$5) RETURNING id`,
              [groupId, teacherId, dateStr, startTime, isExam]
            );
            totals.sessions++;
            for (const sid of studentIds) {
              const roll = Math.random();
              let status = 'present', late = 0, grade = null;
              if (roll < 0.08) status = 'absent';
              else if (roll < 0.18) { status = 'late'; late = rndInt(5, 25); }
              if (isExam && status !== 'absent') grade = rndInt(55, 100);
              await client.query(
                `INSERT INTO attendance_records (session_id, student_id, status, late_minutes, grade)
                 VALUES ($1,$2,$3,$4,$5)`,
                [sesRows[0].id, sid, status, late, grade]
              );
            }
          }
        }
      }
    }

    await client.query('COMMIT');

    console.log('Seed muvaffaqiyatli yakunlandi:');
    console.log(`  Filiallar:     ${totals.branches}`);
    console.log(`  Yo'nalishlar:  ${totals.directions}`);
    console.log(`  Guruhlar:      ${totals.groups}`);
    console.log(`  Adminlar:      ${totals.admins} (admin_1..admin_5)`);
    console.log(`  O'qituvchilar: ${totals.teachers} (teacher_1_1..teacher_5_3)`);
    console.log(`  O'quvchilar:   ${totals.students} (student_001...)`);
    console.log(`  Davomat sessiyalari: ${totals.sessions}`);
    console.log(`  Barcha seed foydalanuvchilar paroli: ${PASSWORD}`);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Seed xatosi:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { seed };
