const express = require('express');
const { query } = require('../db');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();
router.use(verifyToken);

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const role = req.user.role;
    const uid = req.user.id;          // from verified JWT
    const bid = req.user.branch_id;

    const branchFilter = role === 'branch_admin' ? `AND branch_id = '${bid}'` : '';

    // Group-level scope: branch_admin -> own branch, teacher -> own groups, student -> enrolled groups
    let gScope = '';
    if (role === 'branch_admin') gScope = `AND g.branch_id = '${bid}'`;
    else if (role === 'teacher') gScope = `AND g.teacher_id = '${uid}'`;
    else if (role === 'student') gScope = `AND EXISTS (SELECT 1 FROM group_students gss WHERE gss.group_id = g.id AND gss.student_id = '${uid}')`;

    // Attendance scope: a student only ever sees their OWN records
    const attScope = role === 'student' ? `AND ar.student_id = '${uid}'` : gScope;

    const scopedPeople = role === 'teacher' || role === 'student';

    // Scope recent activity by role
    let activityWhere = '';
    const activityParams = [];
    if (role === 'branch_admin') {
      activityWhere = 'WHERE u.branch_id = $1';
      activityParams.push(bid);
    } else if (role === 'teacher' || role === 'student') {
      activityWhere = 'WHERE al.user_id = $1';
      activityParams.push(uid);
    }

    const [students, teachers, branches, groups, recentActivity, attendanceToday] = await Promise.all([
      scopedPeople
        ? query(`SELECT COUNT(DISTINCT gs.student_id) AS count FROM group_students gs JOIN groups g ON gs.group_id = g.id WHERE g.is_active = true ${gScope}`)
        : role === 'branch_admin'
          // Branch students = directly assigned (users.branch_id) OR enrolled in one of the branch's active groups
          ? query(
              `SELECT COUNT(DISTINCT u.id) AS count FROM users u
               WHERE u.role = 'student' AND u.is_active = true
                 AND (u.branch_id = $1 OR EXISTS (
                   SELECT 1 FROM group_students gs JOIN groups g ON gs.group_id = g.id
                   WHERE gs.student_id = u.id AND g.branch_id = $1 AND g.is_active = true))`,
              [bid]
            )
          : query(`SELECT COUNT(*) FROM users WHERE role = 'student' AND is_active = true ${branchFilter}`),
      role === 'teacher'
        ? query(`SELECT 1 as count`)
        : role === 'student'
          ? query(`SELECT COUNT(DISTINCT g.teacher_id) AS count FROM groups g WHERE g.teacher_id IS NOT NULL ${gScope}`)
          : role === 'branch_admin'
            // Branch teachers = directly assigned (users.branch_id) OR teaching one of the branch's active groups
            ? query(
                `SELECT COUNT(DISTINCT u.id) AS count FROM users u
                 WHERE u.role = 'teacher' AND u.is_active = true
                   AND (u.branch_id = $1 OR EXISTS (
                     SELECT 1 FROM groups g
                     WHERE g.teacher_id = u.id AND g.branch_id = $1 AND g.is_active = true))`,
                [bid]
              )
            : query(`SELECT COUNT(*) FROM users WHERE role = 'teacher' AND is_active = true ${branchFilter}`),
      role === 'super_admin'
        ? query(`SELECT COUNT(*) FROM branches WHERE is_active = true`)
        : query(`SELECT 1 as count`),
      query(`SELECT COUNT(*) FROM groups g WHERE g.is_active = true ${gScope}`),
      query(
        `SELECT al.action, al.entity_type, al.created_at,
           CONCAT(u.first_name, ' ', u.last_name) as user_name, u.role
         FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id
         ${activityWhere}
         ORDER BY al.created_at DESC LIMIT 10`,
        activityParams
      ),
      query(
        `SELECT
           COUNT(ar.id) as total,
           SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
           SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
           SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count
         FROM attendance_records ar
         JOIN attendance_sessions s ON ar.session_id = s.id
         JOIN groups g ON s.group_id = g.id
         WHERE s.session_date = CURRENT_DATE ${attScope}`
      ),
    ]);

    // Attendance trend (last 7 days)
    const { rows: trend } = await query(
      `SELECT s.session_date,
         SUM(CASE WHEN ar.status = 'present' THEN 1 ELSE 0 END) as present_count,
         SUM(CASE WHEN ar.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
         SUM(CASE WHEN ar.status = 'late' THEN 1 ELSE 0 END) as late_count,
         COUNT(ar.id) as total
       FROM attendance_sessions s
       JOIN attendance_records ar ON ar.session_id = s.id
       JOIN groups g ON s.group_id = g.id
       WHERE s.session_date >= CURRENT_DATE - INTERVAL '7 days' ${attScope}
       GROUP BY s.session_date ORDER BY s.session_date`
    );

    res.json({
      stats: {
        students: parseInt(students.rows[0].count),
        teachers: parseInt(teachers.rows[0].count),
        branches: role === 'super_admin' ? parseInt(branches.rows[0].count) : null,
        groups: parseInt(groups.rows[0].count),
      },
      attendanceToday: attendanceToday.rows[0],
      attendanceTrend: trend,
      recentActivity: recentActivity.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/search
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ users: [], groups: [], branches: [] });

    const search = `%${q}%`;
    const branchFilter = req.user.role === 'branch_admin' ? `AND u.branch_id = '${req.user.branch_id}'` : '';

    const [users, groups, branches] = await Promise.all([
      req.user.role !== 'student' && req.user.role !== 'teacher'
        ? query(
            `SELECT id, username, first_name, last_name, role, avatar_url FROM users u
             WHERE (username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1) ${branchFilter}
             LIMIT 5`,
            [search]
          )
        : { rows: [] },
      query(
        `SELECT g.id, g.name, b.name as branch_name FROM groups g LEFT JOIN branches b ON g.branch_id = b.id
         WHERE g.name ILIKE $1 ${req.user.role === 'branch_admin' ? `AND g.branch_id = '${req.user.branch_id}'` : ''}
         LIMIT 5`,
        [search]
      ),
      req.user.role === 'super_admin'
        ? query('SELECT id, name, address FROM branches WHERE name ILIKE $1 LIMIT 5', [search])
        : { rows: [] },
    ]);

    res.json({ users: users.rows, groups: groups.rows, branches: branches.rows });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/dashboard/activity-logs
router.get('/activity-logs', async (req, res) => {
  try {
    if (req.user.role !== 'super_admin' && req.user.role !== 'branch_admin') {
      return res.status(403).json({ error: 'Access denied' });
    }
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    // Branch admin sees only their branch's activity
    const where = req.user.role === 'branch_admin' ? 'WHERE u.branch_id = $1' : '';
    const scopeParams = req.user.role === 'branch_admin' ? [req.user.branch_id] : [];
    const p = scopeParams.length;

    const { rows } = await query(
      `SELECT al.*, CONCAT(u.first_name, ' ', u.last_name) as user_name, u.role
       FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id
       ${where}
       ORDER BY al.created_at DESC LIMIT $${p + 1} OFFSET $${p + 2}`,
      [...scopeParams, parseInt(limit), offset]
    );
    const countRes = await query(
      `SELECT COUNT(*) FROM activity_logs al LEFT JOIN users u ON al.user_id = u.id ${where}`,
      scopeParams
    );
    res.json({ data: rows, total: parseInt(countRes.rows[0].count) });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
