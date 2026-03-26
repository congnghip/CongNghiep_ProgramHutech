# Role-Based Dashboard Filtering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Filter dashboard stats by user's highest role and department scope so each user sees only data relevant to their role.

**Architecture:** Add `getDepartmentScope()` helper in `db.js`, then rewrite the single `/api/dashboard/stats` endpoint in `server.js` to branch queries by role level. Frontend unchanged — same JSON response shape.

**Tech Stack:** Node.js/Express, PostgreSQL, existing RBAC helpers in `db.js`

---

### Task 1: Add `getDepartmentScope` helper in `db.js`

**Files:**
- Modify: `db.js:755-767` (before `module.exports`, add function + export it)

- [ ] **Step 1: Add the helper function**

Add before `module.exports` at line 764 in `db.js`:

```javascript
// Get department IDs in scope for a given department + role level
async function getDepartmentScope(departmentId, roleLevel) {
  if (roleLevel >= 4) return null; // null = no filtering (system-wide)
  const ids = [departmentId];
  if (roleLevel >= 2) {
    const children = await pool.query(
      'SELECT id FROM departments WHERE parent_id = $1', [departmentId]
    );
    children.rows.forEach(r => ids.push(r.id));
  }
  return ids;
}
```

- [ ] **Step 2: Export the function**

Update `module.exports` to include `getDepartmentScope`:

```javascript
module.exports = {
  pool, initDB,
  getUserPermissions, getUserRoles, hasPermission, isAdmin, getDepartmentScope,
};
```

- [ ] **Step 3: Commit**

```bash
git add db.js
git commit -m "feat: add getDepartmentScope helper for role-based filtering"
```

---

### Task 2: Import `getDepartmentScope` in `server.js`

**Files:**
- Modify: `server.js` (the require line for `db.js`)

- [ ] **Step 1: Find and update the require/destructure**

Find the existing `require('./db')` line and add `getDepartmentScope`:

```javascript
const { pool, initDB, getUserPermissions, getUserRoles, hasPermission, isAdmin, getDepartmentScope } = require('./db');
```

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "feat: import getDepartmentScope in server.js"
```

---

### Task 3: Rewrite `/api/dashboard/stats` endpoint with role-based filtering

**Files:**
- Modify: `server.js:2122-2157` (the entire dashboard stats endpoint)

- [ ] **Step 1: Replace the endpoint**

Replace the full endpoint block (lines 2122-2157) with:

```javascript
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    // Determine user's highest role and department scope
    const roles = await getUserRoles(req.user.id);
    const highest = roles.length ? roles[0] : null; // already sorted by level DESC
    const level = highest ? highest.level : 0;
    const roleCode = highest ? highest.role_code : null;
    const deptIds = highest ? await getDepartmentScope(highest.department_id, level) : null;

    // Build WHERE clause for department-scoped filtering
    // deptIds = null means system-wide (no filter)
    const deptFilter = deptIds ? 'AND p.department_id = ANY($1)' : '';
    const deptFilterCourse = deptIds ? 'AND c.department_id = ANY($1)' : '';
    const deptParams = deptIds ? [deptIds] : [];

    // --- Programs ---
    const programs = await pool.query(
      `SELECT COUNT(*) as c FROM programs p WHERE 1=1 ${deptFilter}`,
      deptParams
    );

    // --- Versions (grouped by status) ---
    const versions = await pool.query(
      `SELECT pv.status, COUNT(*) as c
       FROM program_versions pv
       JOIN programs p ON pv.program_id = p.id
       WHERE 1=1 ${deptFilter}
       GROUP BY pv.status`,
      deptParams
    );

    // --- Courses ---
    const courses = await pool.query(
      `SELECT COUNT(*) as c FROM courses c WHERE 1=1 ${deptFilterCourse}`,
      deptParams
    );

    // --- Syllabi (grouped by status) ---
    const syllabi = await pool.query(
      `SELECT vs.status, COUNT(*) as c
       FROM version_syllabi vs
       JOIN courses c ON vs.course_id = c.id
       WHERE 1=1 ${deptFilterCourse}
       GROUP BY vs.status`,
      deptParams
    );

    // --- Users (with role assignment in dept scope) ---
    const users = deptIds
      ? await pool.query(
          `SELECT COUNT(DISTINCT u.id) as c FROM users u
           JOIN user_roles ur ON u.id = ur.user_id
           WHERE u.is_active = true AND ur.department_id = ANY($1)`,
          [deptIds]
        )
      : await pool.query('SELECT COUNT(*) as c FROM users WHERE is_active = true');

    // --- Pending Approvals (role-specific) ---
    let pendingQuery;
    if (roleCode === 'GIANG_VIEN') {
      // No approval rights
      pendingQuery = { rows: [{ c: '0' }] };
    } else if (roleCode === 'TRUONG_NGANH') {
      // Syllabi at 'submitted' waiting for TBM approval
      pendingQuery = await pool.query(
        `SELECT COUNT(*) as c FROM version_syllabi vs
         JOIN courses c ON vs.course_id = c.id
         WHERE vs.status = 'submitted' ${deptFilterCourse}`,
        deptParams
      );
    } else if (roleCode === 'LANH_DAO_KHOA') {
      // Versions at 'submitted' + syllabi at 'approved_tbm'
      const [pendV, pendS] = await Promise.all([
        pool.query(
          `SELECT COUNT(*) as c FROM program_versions pv
           JOIN programs p ON pv.program_id = p.id
           WHERE pv.status = 'submitted' ${deptFilter}`,
          deptParams
        ),
        pool.query(
          `SELECT COUNT(*) as c FROM version_syllabi vs
           JOIN courses c ON vs.course_id = c.id
           WHERE vs.status = 'approved_tbm' ${deptFilterCourse}`,
          deptParams
        ),
      ]);
      pendingQuery = { rows: [{ c: String(parseInt(pendV.rows[0].c) + parseInt(pendS.rows[0].c)) }] };
    } else if (roleCode === 'PHONG_DAO_TAO') {
      // System-wide: versions at 'approved_khoa' + syllabi at 'approved_khoa'
      const [pendV, pendS] = await Promise.all([
        pool.query("SELECT COUNT(*) as c FROM program_versions WHERE status = 'approved_khoa'"),
        pool.query("SELECT COUNT(*) as c FROM version_syllabi WHERE status = 'approved_khoa'"),
      ]);
      pendingQuery = { rows: [{ c: String(parseInt(pendV.rows[0].c) + parseInt(pendS.rows[0].c)) }] };
    } else if (roleCode === 'BAN_GIAM_HIEU') {
      // System-wide: versions at 'approved_pdt' + syllabi at 'approved_pdt'
      const [pendV, pendS] = await Promise.all([
        pool.query("SELECT COUNT(*) as c FROM program_versions WHERE status = 'approved_pdt'"),
        pool.query("SELECT COUNT(*) as c FROM version_syllabi WHERE status = 'approved_pdt'"),
      ]);
      pendingQuery = { rows: [{ c: String(parseInt(pendV.rows[0].c) + parseInt(pendS.rows[0].c)) }] };
    } else {
      // ADMIN: all pending across all statuses
      pendingQuery = await pool.query(
        "SELECT COUNT(*) as c FROM program_versions WHERE status IN ('submitted','approved_khoa','approved_pdt')"
      );
    }

    // --- Departments ---
    const depts = await pool.query("SELECT type, COUNT(*) as c FROM departments GROUP BY type");

    // --- Recent Activity (filtered by dept scope) ---
    // Filter by users who have roles in the department scope
    let recentLogs;
    if (deptIds) {
      recentLogs = await pool.query(
        `SELECT al.action, al.target, al.created_at, u.display_name
         FROM audit_logs al
         LEFT JOIN users u ON al.user_id = u.id
         WHERE al.user_id IN (
           SELECT DISTINCT ur2.user_id FROM user_roles ur2 WHERE ur2.department_id = ANY($1)
         )
         ORDER BY al.created_at DESC LIMIT 15`,
        [deptIds]
      );
    } else {
      recentLogs = await pool.query(
        `SELECT al.action, al.target, al.created_at, u.display_name
         FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
         ORDER BY al.created_at DESC LIMIT 15`
      );
    }

    // --- Build response (same shape as before) ---
    const versionStats = {};
    versions.rows.forEach(r => { versionStats[r.status] = parseInt(r.c); });
    const syllabusStats = {};
    syllabi.rows.forEach(r => { syllabusStats[r.status] = parseInt(r.c); });
    const deptStats = {};
    depts.rows.forEach(r => { deptStats[r.type] = parseInt(r.c); });

    res.json({
      programs: parseInt(programs.rows[0].c),
      versions: versionStats,
      courses: parseInt(courses.rows[0].c),
      syllabi: syllabusStats,
      users: parseInt(users.rows[0].c),
      pendingApprovals: parseInt(pendingQuery.rows[0].c),
      departments: deptStats,
      recentActivity: recentLogs.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "feat: filter dashboard stats by user role and department scope"
```

---

### Task 4: Manual testing

- [ ] **Step 1: Start the dev server**

```bash
make dev
```

- [ ] **Step 2: Test with ADMIN user**

Login as admin → Dashboard should show system-wide stats (same as before).

- [ ] **Step 3: Test with department-scoped user**

Create or use a GIANG_VIEN / TRUONG_NGANH / LANH_DAO_KHOA user → Dashboard should show only stats within their department scope. Verify:
- Programs/versions/courses/syllabi counts are filtered
- "Chờ duyệt" shows role-appropriate count
- Recent activity shows only department-scoped entries

- [ ] **Step 4: Verify API response shape is unchanged**

Check browser DevTools → Network → `/api/dashboard/stats` response. Confirm same JSON keys: `programs`, `versions`, `courses`, `syllabi`, `users`, `pendingApprovals`, `departments`, `recentActivity`.
