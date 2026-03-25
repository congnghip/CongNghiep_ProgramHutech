// HUTECH Program — Server
require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { pool, initDB, getUserPermissions, getUserRoles, hasPermission, isAdmin } = require('./db');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const { parseWordFile } = require('./word-parser');
const { parseSyllabusPdf } = require('./pdf-syllabus-parser');

const app = express();
const PORT = process.env.PORT || 3600;
const JWT_SECRET = process.env.JWT_SECRET || 'hutech-program-secret';

app.use(express.json({ limit: '5mb' }));
app.use(cookieParser());
app.use(express.static('public'));

// ============ AUDIT LOG MIDDLEWARE ============
const AUDIT_METHODS = ['POST', 'PUT', 'DELETE'];
app.use('/api', (req, res, next) => {
  if (!AUDIT_METHODS.includes(req.method)) return next();
  if (req.path.includes('/auth/')) return next();
  const origSend = res.json.bind(res);
  res.json = (body) => {
    if (req.user && res.statusCode < 400) {
      pool.query(
        'INSERT INTO audit_logs (user_id, action, target, details, ip) VALUES ($1,$2,$3,$4,$5)',
        [req.user.id, `${req.method} ${req.path}`, req.path, JSON.stringify({ params: req.params, bodyKeys: Object.keys(req.body || {}) }).substring(0, 500), req.ip]
      ).catch(() => { });
    }
    return origSend(body);
  };
  next();
});

// ============ AUTH MIDDLEWARE ============
function authMiddleware(req, res, next) {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) { return res.status(401).json({ error: 'Token hết hạn' }); }
}

// Admin-only middleware
function requireAdmin() {
  return async (req, res, next) => {
    try {
      const admin = await isAdmin(req.user.id);
      if (!admin) return res.status(403).json({ error: 'Không có quyền truy cập' });
      next();
    } catch (e) { res.status(500).json({ error: e.message }); }
  };
}

// Permission middleware factory
function requirePerm(permCode) {
  return async (req, res, next) => {
    try {
      const admin = await isAdmin(req.user.id);
      if (admin) return next();

      let deptId = req.params.deptId || req.body.department_id || null;

      // Auto-detect department from id or programId if not provided
      if (!deptId) {
        if (req.params.id || req.params.programId) {
          const id = req.params.id || req.params.programId;
          const resProg = await pool.query('SELECT department_id FROM programs WHERE id = $1', [id]);
          if (resProg.rows.length) deptId = resProg.rows[0].department_id;
        } else if (req.params.vId) {
          const resVer = await pool.query('SELECT p.department_id FROM program_versions pv JOIN programs p ON pv.program_id = p.id WHERE pv.id = $1', [req.params.vId]);
          if (resVer.rows.length) deptId = resVer.rows[0].department_id;
        }
      }

      const has = await hasPermission(req.user.id, permCode, deptId);
      if (!has) return res.status(403).json({ error: 'Không có quyền truy cập' });
      next();
    } catch (e) { res.status(500).json({ error: e.message }); }
  };
}

// Helper to check version editability and get department for PLO/PI access
async function checkVersionEditAccess(userId, vId, requiredPerm = 'programs.edit') {
  const admin = await isAdmin(userId);
  const result = await pool.query(`
    SELECT pv.status, pv.is_locked, p.department_id 
    FROM program_versions pv
    JOIN programs p ON pv.program_id = p.id
    WHERE pv.id = $1
  `, [vId]);

  if (!result.rows.length) throw new Error('Phiên bản không tồn tại');
  const context = result.rows[0];

  if (admin) return context;
  if (context.is_locked) throw new Error('Phiên bản đã bị khóa, không thể chỉnh sửa.');

  // Role-based editing logic for intermediate states
  const canEditByStatus = {
    'draft': 'programs.edit',
    'submitted': 'programs.approve_khoa',
    'approved_khoa': 'programs.approve_pdt',
    'approved_pdt': 'programs.approve_bgh'
  };

  const statusPerm = canEditByStatus[context.status];
  if (!statusPerm) {
    throw new Error(`Trạng thái "${context.status}" không cho phép chỉnh sửa.`);
  }

  // 1. Check if user has either the original edit perm OR the specific step approval perm
  const hasEditPerm = await hasPermission(userId, requiredPerm, context.department_id);
  const hasStepPerm = await hasPermission(userId, statusPerm, context.department_id);

  if (!hasEditPerm && !hasStepPerm) {
    throw new Error('Bạn không có quyền chỉnh sửa ở giai đoạn này.');
  }

  // ALLOW current reviewer to edit (hasStepPerm means they are the reviewer at this step)
  // Or if it's draft, the regular editor can edit.
  if (context.status !== 'draft' && !hasStepPerm) {
    throw new Error('Chỉ người phê duyệt ở bước này mới có quyền chỉnh sửa.');
  }

  return context;
}

// Middleware to ensure a version is in draft status before editing
function requireDraft(vIdParam = 'vId', requiredPerm = 'programs.edit') {
  return async (req, res, next) => {
    try {
      const vId = req.params[vIdParam] || (vIdParam === 'vId' ? req.params.id : req.params.vId);
      await checkVersionEditAccess(req.user.id, vId, requiredPerm);
      next();
    } catch (e) {
      res.status(400).json({ error: e.message });
    }
  };
}

// Middleware to check view permission for a specific version based on its status
// Middleware to check view permission for a specific version based on its status
async function requireViewVersion(req, res, next) {
  try {
    const admin = await isAdmin(req.user.id);
    if (admin) return next();

    let vId = req.params.vId || (req.path.includes('/api/versions/') ? req.params.id : null);
    let sId = req.params.sId || (req.path.includes('/api/syllabi/') ? req.params.id : null);

    // Export and Approval specific detection
    if (req.path.includes('/api/export/version/')) vId = req.params.vId;
    if (req.params.entityType === 'program_version') vId = req.params.entityId;
    if (req.params.entityType === 'syllabus') sId = req.params.entityId;

    // Bypass: GV được phân công trong version này → cho phép xem
    let resolvedVId = vId;
    if (!resolvedVId && sId) {
      const sylVer = await pool.query('SELECT version_id FROM version_syllabi WHERE id=$1', [sId]);
      if (sylVer.rows.length) resolvedVId = sylVer.rows[0].version_id;
    }
    if (resolvedVId) {
      const assigned = await pool.query(
        'SELECT 1 FROM syllabus_assignments WHERE version_id=$1 AND assigned_to=$2 LIMIT 1',
        [resolvedVId, req.user.id]
      );
      if (assigned.rows.length) return next();
    }

    let query = '';
    let params = [];

    if (vId) {
      query = `
        SELECT pv.status, p.department_id
        FROM program_versions pv
        JOIN programs p ON pv.program_id = p.id
        WHERE pv.id = $1
      `;
      params = [vId];
    } else if (sId) {
      query = `
        SELECT pv.status, p.department_id
        FROM version_syllabi vs
        JOIN program_versions pv ON vs.version_id = pv.id
        JOIN programs p ON pv.program_id = p.id
        WHERE vs.id = $1
      `;
      params = [sId];
    } else {
      return next();
    }

    const result = await pool.query(query, params);
    if (!result.rows.length) return res.status(404).json({ error: 'Không tìm thấy phiên bản hoặc đề cương.' });
    const version = result.rows[0];

    const perm = version.status === 'published' ? 'programs.view_published' : 'programs.view_draft';
    const has = await hasPermission(req.user.id, perm, version.department_id);

    if (!has) return res.status(403).json({ error: 'Không có quyền xem nội dung này (yêu cầu ' + perm + ')' });
    next();
  } catch (e) { res.status(500).json({ error: e.message }); }
}

// ============ AUTH ROUTES ============
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE username=$1 AND is_active=true', [username]);
    if (!result.rows.length) return res.status(401).json({ error: 'Sai tên đăng nhập' });
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Sai mật khẩu' });

    const roles = await getUserRoles(user.id);
    const token = jwt.sign({ id: user.id, username: user.username, display_name: user.display_name }, JWT_SECRET, { expiresIn: '24h' });
    res.cookie('token', token, { httpOnly: true, maxAge: 86400000 });
    res.json({ user: { id: user.id, username: user.username, display_name: user.display_name }, roles });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true });
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const roles = await getUserRoles(req.user.id);
    const perms = await getUserPermissions(req.user.id);
    const admin = await isAdmin(req.user.id);
    res.json({
      user: req.user,
      roles,
      permissions: perms.map(p => p.code),
      isAdmin: admin,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ DEPARTMENTS API ============
app.get('/api/departments', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM departments ORDER BY parent_id NULLS FIRST, name');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/departments', authMiddleware, requireAdmin(), async (req, res) => {
  const { code, name, type, parent_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO departments (code, name, type, parent_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [code, name, type || 'KHOA', parent_id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/departments/:id', authMiddleware, requireAdmin(), async (req, res) => {
  const { name, type } = req.body;
  try {
    const result = await pool.query('UPDATE departments SET name=$1, type=COALESCE($2,type) WHERE id=$3 RETURNING *', [name, type, req.params.id]);
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/departments/:id', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const id = req.params.id;
    // Check constraints
    const children = await pool.query('SELECT id FROM departments WHERE parent_id=$1 LIMIT 1', [id]);
    if (children.rows.length) return res.status(409).json({ error: 'Không thể xóa: đơn vị có đơn vị con.' });
    const users = await pool.query('SELECT id FROM user_roles WHERE department_id=$1 LIMIT 1', [id]);
    if (users.rows.length) return res.status(409).json({ error: 'Không thể xóa: đơn vị có người dùng được gán.' });
    const progs = await pool.query('SELECT id FROM programs WHERE department_id=$1 LIMIT 1', [id]);
    if (progs.rows.length) return res.status(409).json({ error: 'Không thể xóa: đơn vị có chương trình ĐT.' });
    await pool.query('DELETE FROM departments WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ USERS API ============
app.get('/api/users', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.display_name, u.email, u.is_active, u.created_at,
        COALESCE(json_agg(json_build_object('role_code', r.code, 'role_name', r.name, 'dept_code', d.code, 'dept_name', d.name, 'department_id', ur.department_id, 'parent_dept_name', pd.name))
        FILTER (WHERE r.id IS NOT NULL), '[]') as roles
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN departments d ON ur.department_id = d.id
      LEFT JOIN departments pd ON d.parent_id = pd.id
      GROUP BY u.id ORDER BY u.created_at
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', authMiddleware, requireAdmin(), async (req, res) => {
  const { username, password, display_name, email } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, display_name, email) VALUES ($1,$2,$3,$4) RETURNING id, username, display_name',
      [username, hash, display_name, email]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/users/:id', authMiddleware, requireAdmin(), async (req, res) => {
  const { display_name, email, password, is_active } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
    }
    const result = await pool.query(
      'UPDATE users SET display_name=COALESCE($1,display_name), email=COALESCE($2,email), is_active=COALESCE($3,is_active) WHERE id=$4 RETURNING id, username, display_name',
      [display_name, email, is_active, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Assign role to user
app.post('/api/users/:id/roles', authMiddleware, requireAdmin(), async (req, res) => {
  const { role_code, department_id } = req.body;
  try {
    const role = await pool.query('SELECT id FROM roles WHERE code=$1', [role_code]);
    if (!role.rows.length) return res.status(400).json({ error: 'Role không tồn tại' });
    await pool.query(
      'INSERT INTO user_roles (user_id, role_id, department_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
      [req.params.id, role.rows[0].id, department_id]
    );
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Remove role from user
app.delete('/api/users/:userId/roles/:roleCode/:deptId', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const role = await pool.query('SELECT id FROM roles WHERE code=$1', [req.params.roleCode]);
    if (!role.rows.length) return res.status(400).json({ error: 'Role không tồn tại' });
    await pool.query(
      'DELETE FROM user_roles WHERE user_id=$1 AND role_id=$2 AND department_id=$3',
      [req.params.userId, role.rows[0].id, req.params.deptId]
    );
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Delete user
app.delete('/api/users/:id', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const id = req.params.id;
    if (parseInt(id) === req.user.id) return res.status(400).json({ error: 'Không thể xóa chính mình.' });
    // Check if user authored syllabi
    const syllabi = await pool.query('SELECT id FROM version_syllabi WHERE author_id=$1 LIMIT 1', [id]);
    if (syllabi.rows.length) return res.status(409).json({ error: 'Không thể xóa: user đã soạn đề cương. Hãy khóa tài khoản thay vì xóa.' });
    await pool.query('DELETE FROM user_roles WHERE user_id=$1', [id]);
    await pool.query('DELETE FROM users WHERE id=$1', [id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Toggle active
app.put('/api/users/:id/toggle-active', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET is_active = NOT is_active WHERE id=$1 RETURNING id, is_active',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Change own password
app.put('/api/auth/change-password', authMiddleware, async (req, res) => {
  const { current_password, new_password } = req.body;
  try {
    const user = await pool.query('SELECT password_hash FROM users WHERE id=$1', [req.user.id]);
    const valid = await bcrypt.compare(current_password, user.rows[0].password_hash);
    if (!valid) return res.status(400).json({ error: 'Mật khẩu hiện tại không đúng.' });
    const hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.user.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ ROLES API ============
app.get('/api/roles', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, 
        (SELECT COUNT(*) FROM user_roles WHERE role_id=r.id) as user_count,
        (SELECT COUNT(*) FROM role_permissions WHERE role_id=r.id) as perm_count
      FROM roles r ORDER BY r.level
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/roles', authMiddleware, requireAdmin(), async (req, res) => {
  const { code, name, level } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO roles (code, name, level, is_system) VALUES ($1,$2,$3,false) RETURNING *',
      [code, name, level || 1]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/roles/:id', authMiddleware, requireAdmin(), async (req, res) => {
  const { name, level } = req.body;
  try {
    const result = await pool.query(
      'UPDATE roles SET name=COALESCE($1,name), level=COALESCE($2,level) WHERE id=$3 RETURNING *',
      [name, level, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/roles/:id', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const role = await pool.query('SELECT is_system FROM roles WHERE id=$1', [req.params.id]);
    if (role.rows[0]?.is_system) return res.status(400).json({ error: 'Không thể xóa vai trò hệ thống.' });
    const users = await pool.query('SELECT id FROM user_roles WHERE role_id=$1 LIMIT 1', [req.params.id]);
    if (users.rows.length) return res.status(409).json({ error: 'Không thể xóa: vai trò đang được gán cho user.' });
    await pool.query('DELETE FROM role_permissions WHERE role_id=$1', [req.params.id]);
    await pool.query('DELETE FROM roles WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/roles/:id/permissions', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.* FROM permissions p
      JOIN role_permissions rp ON p.id = rp.permission_id
      WHERE rp.role_id = $1 ORDER BY p.module, p.code
    `, [req.params.id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// List all permissions
app.get('/api/permissions', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM permissions ORDER BY module, code');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update role permissions (batch)
app.put('/api/roles/:id/permissions', authMiddleware, requireAdmin(), async (req, res) => {
  const { permission_ids } = req.body; // array of permission IDs
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM role_permissions WHERE role_id=$1', [req.params.id]);
    for (const pid of permission_ids) {
      await client.query('INSERT INTO role_permissions (role_id, permission_id) VALUES ($1,$2)', [req.params.id, pid]);
    }
    await client.query('COMMIT');
    res.json({ success: true, count: permission_ids.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});

// ============ PROGRAMS API ============
app.get('/api/programs', authMiddleware, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    
    let query = `
      WITH user_perms AS (
        SELECT p.code, ur.department_id, r.level
        FROM user_roles ur
        JOIN role_permissions rp ON ur.role_id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        JOIN roles r ON ur.role_id = r.id
        WHERE ur.user_id = $1
      )
      SELECT p.*, d.name as dept_name, d.code as dept_code, d.type as dept_type,
             pd.id as parent_dept_id, pd.name as parent_dept_name, pd.code as parent_dept_code,
             (SELECT COUNT(*) FROM program_versions pv WHERE pv.program_id=p.id
               ${!admin ? ` AND (
                 (pv.status = 'published' AND EXISTS (SELECT 1 FROM user_perms up WHERE up.code = 'programs.view_published' AND (up.department_id = p.department_id OR up.department_id = (SELECT parent_id FROM departments WHERE id = p.department_id) OR up.level >= 4)))
                 OR
                 (pv.status != 'published' AND EXISTS (SELECT 1 FROM user_perms up WHERE up.code = 'programs.view_draft' AND (up.department_id = p.department_id OR up.department_id = (SELECT parent_id FROM departments WHERE id = p.department_id) OR up.level >= 4)))
               )` : ""}
             ) as version_count
      FROM programs p
      JOIN departments d ON p.department_id = d.id
      LEFT JOIN departments pd ON d.parent_id = pd.id
    `;
    const params = [req.user.id];
    const conditions = [];

    if (!admin) {
      // Must have at least one allowed version to see the program in the list
      conditions.push(`EXISTS (
        SELECT 1 FROM program_versions pv WHERE pv.program_id = p.id
        AND (
          (pv.status = 'published' AND EXISTS (SELECT 1 FROM user_perms up WHERE up.code = 'programs.view_published' AND (up.department_id = p.department_id OR up.department_id = (SELECT parent_id FROM departments WHERE id = p.department_id) OR up.level >= 4)))
          OR
          (pv.status != 'published' AND EXISTS (SELECT 1 FROM user_perms up WHERE up.code = 'programs.view_draft' AND (up.department_id = p.department_id OR up.department_id = (SELECT parent_id FROM departments WHERE id = p.department_id) OR up.level >= 4)))
        )
      )`);
    }

    if (conditions.length > 0) {
      query += ` WHERE ` + conditions.join(' AND ');
    }

    query += ` ORDER BY COALESCE(pd.name, d.name), d.name, p.name`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/programs', authMiddleware, requirePerm('programs.create'), async (req, res) => {
  const { name, name_en, code, department_id, degree, total_credits, institution, degree_name, training_mode, notes } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO programs (name, name_en, code, department_id, degree, total_credits, institution, degree_name, training_mode, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [name, name_en, code, department_id, degree || 'Đại học', total_credits, institution, degree_name, training_mode, notes]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/programs/:id', authMiddleware, requirePerm('programs.delete_draft'), async (req, res) => {
  try {
    // 1. Check if program has any published versions
    const check = await pool.query('SELECT id FROM program_versions WHERE program_id = $1 AND status = \'published\' LIMIT 1', [req.params.id]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: 'Không thể xóa CTĐT đã công bố. Hãy liên hệ Admin nếu cần xóa triệt để.' });
    }

    // 2. Cascade delete will be handled by DB foreign keys (ON DELETE CASCADE)
    await pool.query('DELETE FROM programs WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ VERSIONS API ============
app.get('/api/programs/:programId/versions', authMiddleware, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    const progRes = await pool.query('SELECT department_id FROM programs WHERE id = $1', [req.params.programId]);
    if (!progRes.rows.length) return res.status(404).json({ error: 'CTĐT không tồn tại' });
    const deptId = progRes.rows[0].department_id;

    let query = 'SELECT * FROM program_versions WHERE program_id=$1';
    const params = [req.params.programId];

    if (!admin) {
      const hasViewPublished = await hasPermission(req.user.id, 'programs.view_published', deptId);
      const hasViewDraft = await hasPermission(req.user.id, 'programs.view_draft', deptId);

      if (!hasViewPublished && !hasViewDraft) {
        return res.status(403).json({ error: 'Không có quyền xem phiên bản của CTĐT này' });
      }

      if (hasViewPublished && !hasViewDraft) {
        query += " AND status = 'published'";
      } else if (!hasViewPublished && hasViewDraft) {
        query += " AND status != 'published'";
      }
    }

    query += ' ORDER BY academic_year DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/programs/:programId/versions', authMiddleware, requirePerm('programs.create_version'), async (req, res) => {
  const { academic_year, copy_from_version_id } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Check for duplicate academic_year
    const dup = await client.query(
      'SELECT id FROM program_versions WHERE program_id=$1 AND academic_year=$2',
      [req.params.programId, academic_year]
    );
    if (dup.rows.length > 0) {
      client.release();
      return res.status(409).json({ error: `Phiên bản năm học "${academic_year}" đã tồn tại. Vui lòng chọn năm học khác.` });
    }
    // Create new version
    const ver = await client.query(
      'INSERT INTO program_versions (program_id, academic_year, copied_from_id) VALUES ($1,$2,$3) RETURNING *',
      [req.params.programId, academic_year, copy_from_version_id || null]
    );
    const newVersionId = ver.rows[0].id;

    // If copying from existing version
    if (copy_from_version_id) {
      // Lock old version
      await client.query('UPDATE program_versions SET is_locked=true WHERE id=$1', [copy_from_version_id]);

      // Copy POs
      await client.query(`
        INSERT INTO version_objectives (version_id, code, description)
        SELECT $1, code, description FROM version_objectives WHERE version_id=$2
      `, [newVersionId, copy_from_version_id]);

      // Copy PLOs
      const oldPlos = await client.query('SELECT * FROM version_plos WHERE version_id=$1', [copy_from_version_id]);
      const ploMap = {};
      for (const oldPlo of oldPlos.rows) {
        const newPlo = await client.query(
          'INSERT INTO version_plos (version_id, code, bloom_level, description) VALUES ($1,$2,$3,$4) RETURNING id',
          [newVersionId, oldPlo.code, oldPlo.bloom_level, oldPlo.description]
        );
        ploMap[oldPlo.id] = newPlo.rows[0].id;
        // Copy PIs
        await client.query(`
          INSERT INTO plo_pis (plo_id, pi_code, description)
          SELECT $1, pi_code, description FROM plo_pis WHERE plo_id=$2
        `, [newPlo.rows[0].id, oldPlo.id]);
      }

      // Copy version_courses
      const oldCourses = await client.query('SELECT * FROM version_courses WHERE version_id=$1', [copy_from_version_id]);
      for (const oc of oldCourses.rows) {
        await client.query(
          'INSERT INTO version_courses (version_id, course_id, semester, course_type) VALUES ($1,$2,$3,$4)',
          [newVersionId, oc.course_id, oc.semester, oc.course_type]
        );
      }

      // Copy syllabi
      await client.query(`
        INSERT INTO version_syllabi (version_id, course_id, author_id, status, content)
        SELECT $1, course_id, author_id, 'draft', content FROM version_syllabi WHERE version_id=$2
      `, [newVersionId, copy_from_version_id]);
    }

    await client.query('COMMIT');
    res.json(ver.rows[0]);
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});

// ============ PROGRAM EDIT ============
app.put('/api/programs/:id', authMiddleware, requirePerm('programs.edit'), async (req, res) => {
  const { name, name_en, code, department_id, degree, total_credits, institution, degree_name, training_mode, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE programs SET name=COALESCE($1,name), name_en=$2, code=COALESCE($3,code), department_id=COALESCE($4,department_id),
       degree=COALESCE($5,degree), total_credits=COALESCE($6,total_credits), institution=$7, degree_name=$8, training_mode=$9, notes=$10
       WHERE id=$11 RETURNING *`,
      [name, name_en, code, department_id, degree, total_credits, institution, degree_name, training_mode, notes, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ VERSION DETAIL + UPDATE ============
app.get('/api/versions/:id', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const v = await pool.query(`
      SELECT pv.*, p.name as program_name, p.code as program_code, p.degree, p.total_credits,
             p.degree_name, p.training_mode, p.institution,
             p.department_id, d.name as dept_name
      FROM program_versions pv
      JOIN programs p ON pv.program_id = p.id
      JOIN departments d ON p.department_id = d.id
      WHERE pv.id = $1
    `, [req.params.id]);
    if (!v.rows.length) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(v.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/versions/:id', authMiddleware, requireDraft('id'), async (req, res) => {
  const { status, completion_pct, academic_year, version_name, total_credits, training_duration,
          change_type, effective_date, change_summary, grading_scale, graduation_requirements,
          job_positions, further_education, reference_programs, training_process,
          admission_targets, admission_criteria } = req.body;
  try {
    const result = await pool.query(
      `UPDATE program_versions SET
        status=COALESCE($1,status), completion_pct=COALESCE($2,completion_pct),
        academic_year=COALESCE($3,academic_year), version_name=$4, total_credits=$5,
        training_duration=$6, change_type=$7, effective_date=$8, change_summary=$9,
        grading_scale=$10, graduation_requirements=$11, job_positions=$12,
        further_education=$13, reference_programs=$14, training_process=$15,
        admission_targets=$16, admission_criteria=$17, updated_at=NOW()
      WHERE id=$18 RETURNING *`,
      [status, completion_pct, academic_year, version_name, total_credits,
       training_duration, change_type, effective_date || null, change_summary,
       grading_scale, graduation_requirements, job_positions,
       further_education, reference_programs, training_process,
       admission_targets, admission_criteria, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/versions/:id', authMiddleware, requirePerm('programs.delete_draft'), async (req, res) => {
  try {
    const check = await pool.query('SELECT status FROM program_versions WHERE id=$1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Không tìm thấy phiên bản' });
    if (check.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Chỉ có thể xóa phiên bản ở trạng thái "Bản nháp".' });
    }
    await pool.query('DELETE FROM program_versions WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ============ OBJECTIVES (PO) API ============
app.get('/api/versions/:vId/objectives', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM version_objectives WHERE version_id=$1 ORDER BY code', [req.params.vId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/versions/:vId/objectives', authMiddleware, requireDraft('vId', 'programs.po.edit'), async (req, res) => {
  const { code, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO version_objectives (version_id, code, description) VALUES ($1,$2,$3) RETURNING *',
      [req.params.vId, code, description]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/objectives/:id', authMiddleware, async (req, res) => {
  const { code, description } = req.body;
  try {
    const objRes = await pool.query('SELECT version_id FROM version_objectives WHERE id=$1', [req.params.id]);
    if (!objRes.rows.length) throw new Error('Không tìm thấy PO');
    await checkVersionEditAccess(req.user.id, objRes.rows[0].version_id, 'programs.po.edit');

    const result = await pool.query(
      'UPDATE version_objectives SET code=COALESCE($1,code), description=COALESCE($2,description) WHERE id=$3 RETURNING *',
      [code, description, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/objectives/:id', authMiddleware, async (req, res) => {
  try {
    const objRes = await pool.query('SELECT version_id FROM version_objectives WHERE id=$1', [req.params.id]);
    if (!objRes.rows.length) throw new Error('Không tìm thấy PO');
    await checkVersionEditAccess(req.user.id, objRes.rows[0].version_id, 'programs.po.edit');

    await pool.query('DELETE FROM version_objectives WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ PLOs API ============
app.get('/api/versions/:vId/plos', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const plos = await pool.query('SELECT * FROM version_plos WHERE version_id=$1 ORDER BY code', [req.params.vId]);
    // Also fetch PIs for each PLO, including mapped courses
    for (const plo of plos.rows) {
      const pis = await pool.query(`
        SELECT p.*, COALESCE(array_agg(vpc.course_id) FILTER (WHERE vpc.course_id IS NOT NULL), '{}') as course_ids
        FROM plo_pis p
        LEFT JOIN version_pi_courses vpc ON p.id = vpc.pi_id
        WHERE p.plo_id=$1
        GROUP BY p.id
        ORDER BY p.pi_code
      `, [plo.id]);
      plo.pis = pis.rows;
    }
    res.json(plos.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/versions/:vId/plos', authMiddleware, async (req, res) => {
  const { code, bloom_level, description } = req.body;
  try {
    await checkVersionEditAccess(req.user.id, req.params.vId, 'programs.plo.edit');
    const result = await pool.query(
      'INSERT INTO version_plos (version_id, code, bloom_level, description) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.vId, code, bloom_level || 1, description]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/plos/:id', authMiddleware, async (req, res) => {
  const { code, bloom_level, description } = req.body;
  try {
    const ploRes = await pool.query('SELECT version_id FROM version_plos WHERE id=$1', [req.params.id]);
    if (!ploRes.rows.length) throw new Error('Không tìm thấy PLO');
    await checkVersionEditAccess(req.user.id, ploRes.rows[0].version_id, 'programs.plo.edit');

    const result = await pool.query(
      'UPDATE version_plos SET code=COALESCE($1,code), bloom_level=COALESCE($2,bloom_level), description=COALESCE($3,description) WHERE id=$4 RETURNING *',
      [code, bloom_level, description, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/plos/:id', authMiddleware, async (req, res) => {
  try {
    const ploRes = await pool.query('SELECT version_id FROM version_plos WHERE id=$1', [req.params.id]);
    if (!ploRes.rows.length) throw new Error('Không tìm thấy PLO');
    await checkVersionEditAccess(req.user.id, ploRes.rows[0].version_id, 'programs.plo.edit');

    await pool.query('DELETE FROM version_plos WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ PIs API ============
app.post('/api/plos/:ploId/pis', authMiddleware, async (req, res) => {
  const { pi_code, description, course_ids } = req.body;
  const client = await pool.connect();
  try {
    const ploRes = await client.query('SELECT version_id FROM version_plos WHERE id=$1', [req.params.ploId]);
    if (!ploRes.rows.length) throw new Error('Không tìm thấy PLO');
    const versionId = ploRes.rows[0].version_id;
    await checkVersionEditAccess(req.user.id, versionId, 'programs.plo.edit');

    await client.query('BEGIN');
    
    if (course_ids && course_ids.length > 0) {
      const mapRes = await client.query('SELECT course_id FROM course_plo_map WHERE plo_id=$1 AND contribution_level > 0', [req.params.ploId]);
      const validIds = new Set(mapRes.rows.map(r => r.course_id));
      for (const cid of course_ids) {
        if (!validIds.has(parseInt(cid))) throw new Error('Học phần chưa được map với PLO này hoặc mức đóng góp là 0');
      }
    }

    const result = await client.query(
      'INSERT INTO plo_pis (plo_id, pi_code, description) VALUES ($1,$2,$3) RETURNING *',
      [req.params.ploId, pi_code, description]
    );
    const piId = result.rows[0].id;
    
    if (course_ids && course_ids.length > 0) {
      for (const cid of course_ids) {
        await client.query('INSERT INTO version_pi_courses (version_id, pi_id, course_id) VALUES ($1,$2,$3)', [versionId, piId, cid]);
      }
    }
    
    await client.query('COMMIT');
    res.json({ ...result.rows[0], course_ids: course_ids || [] });
  } catch (e) { 
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message }); 
  } finally { client.release(); }
});

app.put('/api/pis/:id', authMiddleware, async (req, res) => {
  const { pi_code, description, course_ids } = req.body;
  const client = await pool.connect();
  try {
    const piRes = await client.query('SELECT plo_id FROM plo_pis WHERE id=$1', [req.params.id]);
    if (!piRes.rows.length) throw new Error('Không tìm thấy PI');
    const ploId = piRes.rows[0].plo_id;
    const ploRes = await client.query('SELECT version_id FROM version_plos WHERE id=$1', [ploId]);
    const versionId = ploRes.rows[0].version_id;
    await checkVersionEditAccess(req.user.id, versionId, 'programs.plo.edit');

    await client.query('BEGIN');
    if (course_ids) {
      if (course_ids.length > 0) {
        const mapRes = await client.query('SELECT course_id FROM course_plo_map WHERE plo_id=$1 AND contribution_level > 0', [ploId]);
        const validIds = new Set(mapRes.rows.map(r => r.course_id));
        for (const cid of course_ids) {
          if (!validIds.has(parseInt(cid))) throw new Error('Học phần chưa được map với PLO này hoặc mức đóng góp là 0');
        }
      }
      await client.query('DELETE FROM version_pi_courses WHERE pi_id=$1', [req.params.id]);
      for (const cid of course_ids) {
        await client.query('INSERT INTO version_pi_courses (version_id, pi_id, course_id) VALUES ($1,$2,$3)', [versionId, req.params.id, cid]);
      }
    }

    const result = await client.query(
      'UPDATE plo_pis SET pi_code=COALESCE($1,pi_code), description=COALESCE($2,description) WHERE id=$3 RETURNING *',
      [pi_code, description, req.params.id]
    );
    await client.query('COMMIT');
    res.json({ ...result.rows[0], course_ids: course_ids });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});

app.delete('/api/pis/:id', authMiddleware, async (req, res) => {
  try {
    const piRes = await pool.query('SELECT plo_id FROM plo_pis WHERE id=$1', [req.params.id]);
    if (!piRes.rows.length) throw new Error('Không tìm thấy PI');
    const ploRes = await pool.query('SELECT version_id FROM version_plos WHERE id=$1', [piRes.rows[0].plo_id]);
    await checkVersionEditAccess(req.user.id, ploRes.rows[0].version_id, 'programs.plo.edit');

    await pool.query('DELETE FROM plo_pis WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ COURSES MASTER LIST ============
app.get('/api/courses', authMiddleware, requirePerm('courses.view'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, d.name as dept_name, d.code as dept_code
      FROM courses c LEFT JOIN departments d ON c.department_id = d.id
      ORDER BY c.code
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/courses', authMiddleware, requirePerm('courses.create'), async (req, res) => {
  const { code, name, credits, department_id, description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO courses (code, name, credits, department_id, description) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [code, name, credits || 3, department_id, description]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/courses/:id', authMiddleware, requirePerm('courses.edit'), async (req, res) => {
  const { code, name, credits, department_id, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE courses SET code=COALESCE($1,code), name=COALESCE($2,name), credits=COALESCE($3,credits), department_id=COALESCE($4,department_id), description=COALESCE($5,description) WHERE id=$6 RETURNING *',
      [code, name, credits, department_id, description, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/courses/:id', authMiddleware, requirePerm('courses.edit'), async (req, res) => {
  try {
    // Check if course is referenced by any version
    const refs = await pool.query(
      'SELECT COUNT(*) as c FROM version_courses WHERE course_id=$1', [req.params.id]
    );
    if (parseInt(refs.rows[0].c) > 0) {
      return res.status(400).json({ error: 'Không thể xóa: học phần đang được sử dụng trong CTĐT.' });
    }
    await pool.query('DELETE FROM courses WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ VERSION COURSES ============
app.get('/api/versions/:vId/courses', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vc.*, c.code as course_code, c.name as course_name, c.credits,
             c.credits_theory, c.credits_practice, c.credits_project, c.credits_internship,
             c.description as course_desc, d.name as dept_name
      FROM version_courses vc
      JOIN courses c ON vc.course_id = c.id
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE vc.version_id = $1
      ORDER BY vc.semester, c.code
    `, [req.params.vId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/versions/:vId/knowledge-blocks', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM knowledge_blocks WHERE version_id = $1 ORDER BY sort_order, id`,
      [req.params.vId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/versions/:vId/teaching-plan', authMiddleware, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT tp.*, vc.semester, c.code as course_code, c.name as course_name, c.credits
       FROM teaching_plan tp
       JOIN version_courses vc ON tp.version_course_id = vc.id
       JOIN courses c ON vc.course_id = c.id
       WHERE vc.version_id = $1
       ORDER BY vc.semester, c.code`,
      [req.params.vId]
    );
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/versions/:vId/courses', authMiddleware, requireDraft('vId', 'programs.courses.edit'), async (req, res) => {
  const { course_id, semester, course_type } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO version_courses (version_id, course_id, semester, course_type) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.vId, course_id, semester || 1, course_type || 'required']
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/version-courses/:id', authMiddleware, async (req, res) => {
  const { semester, course_type } = req.body;
  try {
    const vcRes = await pool.query('SELECT version_id FROM version_courses WHERE id=$1', [req.params.id]);
    if (!vcRes.rows.length) throw new Error('Không tìm thấy HP trong phiên bản');
    await checkVersionEditAccess(req.user.id, vcRes.rows[0].version_id, 'programs.courses.edit');

    const result = await pool.query(
      'UPDATE version_courses SET semester=COALESCE($1,semester), course_type=COALESCE($2,course_type) WHERE id=$3 RETURNING *',
      [semester, course_type, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/version-courses/:id', authMiddleware, async (req, res) => {
  try {
    const vcRes = await pool.query('SELECT version_id FROM version_courses WHERE id=$1', [req.params.id]);
    if (!vcRes.rows.length) throw new Error('Không tìm thấy HP trong phiên bản');
    await checkVersionEditAccess(req.user.id, vcRes.rows[0].version_id, 'programs.courses.edit');

    await pool.query('DELETE FROM version_courses WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ PO-PLO MAP ============
app.get('/api/versions/:vId/po-plo-map', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM po_plo_map WHERE version_id=$1', [req.params.vId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/versions/:vId/po-plo-map', authMiddleware, requireDraft('vId', 'programs.matrix.edit'), async (req, res) => {
  const { mappings } = req.body; // [{ po_id, plo_id }]
  try {
    await pool.query('DELETE FROM po_plo_map WHERE version_id=$1', [req.params.vId]);
    for (const m of mappings) {
      await pool.query('INSERT INTO po_plo_map (version_id, po_id, plo_id) VALUES ($1,$2,$3)', [req.params.vId, m.po_id, m.plo_id]);
    }
    res.json({ success: true, count: mappings.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ COURSE-PLO MAP ============
app.get('/api/versions/:vId/course-plo-map', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM course_plo_map WHERE version_id=$1', [req.params.vId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/versions/:vId/course-plo-map', authMiddleware, requireDraft('vId', 'programs.matrix.edit'), async (req, res) => {
  const { mappings } = req.body; // [{ course_id, plo_id, contribution_level }]
  try {
    await pool.query('DELETE FROM course_plo_map WHERE version_id=$1', [req.params.vId]);
    for (const m of mappings) {
      await pool.query(
        'INSERT INTO course_plo_map (version_id, course_id, plo_id, contribution_level) VALUES ($1,$2,$3,$4)',
        [req.params.vId, m.course_id, m.plo_id, m.contribution_level]
      );
    }
    
    // Cleanup orphaned PI-Course mappings
    await pool.query(`
      DELETE FROM version_pi_courses vpc
      WHERE vpc.version_id = $1 
      AND NOT EXISTS (
        SELECT 1 FROM plo_pis p
        JOIN course_plo_map c ON p.plo_id = c.plo_id
        WHERE c.version_id = $1 AND c.contribution_level > 0
        AND p.id = vpc.pi_id AND c.course_id = vpc.course_id
      )
    `, [req.params.vId]);

    res.json({ success: true, count: mappings.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/versions/:vId/course-pi-map', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM version_pi_courses WHERE version_id=$1', [req.params.vId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/versions/:vId/course-pi-map', authMiddleware, requireDraft('vId', 'programs.matrix.edit'), async (req, res) => {
  const { pi_mappings } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const m of pi_mappings) {
      await client.query(
        `INSERT INTO version_pi_courses (version_id, pi_id, course_id, contribution_level)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (pi_id, course_id) DO UPDATE SET contribution_level = EXCLUDED.contribution_level`,
        [req.params.vId, m.pi_id, m.course_id, m.contribution_level]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, count: pi_mappings.length });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});

// ============ ASSESSMENT PLANS ============
app.get('/api/versions/:vId/assessments', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ap.*, c.code as course_code, c.name as course_name
      FROM assessment_plans ap
      LEFT JOIN courses c ON ap.sample_course_id = c.id
      WHERE ap.version_id = $1 ORDER BY ap.id
    `, [req.params.vId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/versions/:vId/assessments', authMiddleware, requireDraft('vId', 'programs.assessment.edit'), async (req, res) => {
  const { plo_id, pi_id, sample_course_id, assessment_tool, criteria, threshold, semester, assessor, dept_code } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO assessment_plans (version_id, plo_id, pi_id, sample_course_id, assessment_tool, criteria, threshold, semester, assessor, dept_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [req.params.vId, plo_id, pi_id, sample_course_id, assessment_tool, criteria, threshold, semester, assessor, dept_code]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/assessments/:id', authMiddleware, async (req, res) => {
  try {
    const aRes = await pool.query('SELECT version_id FROM assessment_plans WHERE id=$1', [req.params.id]);
    if (!aRes.rows.length) throw new Error('Không tìm thấy kế hoạch đánh giá');
    await checkVersionEditAccess(req.user.id, aRes.rows[0].version_id, 'programs.assessment.edit');

    await pool.query('DELETE FROM assessment_plans WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ SYLLABI API ============
app.get('/api/versions/:vId/syllabi', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vs.*, c.code as course_code, c.name as course_name, c.credits,
             u.display_name as author_name
      FROM version_syllabi vs
      JOIN courses c ON vs.course_id = c.id
      LEFT JOIN users u ON vs.author_id = u.id
      WHERE vs.version_id = $1 ORDER BY c.code
    `, [req.params.vId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/versions/:vId/syllabi', authMiddleware, async (req, res) => {
  const { course_id, content } = req.body;
  try {
    // Bypass permission if user is assigned to this course in this version
    const assignRes = await pool.query(
      'SELECT 1 FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2 AND assigned_to=$3',
      [req.params.vId, course_id, req.user.id]
    );
    if (!assignRes.rows.length) {
      await checkVersionEditAccess(req.user.id, req.params.vId, 'syllabus.edit');
    }

    const result = await pool.query(
      'INSERT INTO version_syllabi (version_id, course_id, author_id, content) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.vId, course_id, req.user.id, JSON.stringify(content || {})]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/syllabi/:id', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vs.*, c.code as course_code, c.name as course_name, c.credits,
             u.display_name as author_name, d.name as dept_name
      FROM version_syllabi vs
      JOIN courses c ON vs.course_id = c.id
      LEFT JOIN users u ON vs.author_id = u.id
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE vs.id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/syllabi/:id', authMiddleware, async (req, res) => {
  const { content, status } = req.body;
  try {
    const sylRes = await pool.query('SELECT version_id, course_id FROM version_syllabi WHERE id=$1', [req.params.id]);
    if (!sylRes.rows.length) throw new Error('Không tìm thấy đề cương');

    // Check if user is the assigned GV — allow edit without syllabus.edit permission
    const assignRes = await pool.query(
      'SELECT id FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2 AND assigned_to=$3',
      [sylRes.rows[0].version_id, sylRes.rows[0].course_id, req.user.id]
    );
    if (!assignRes.rows.length) {
      await checkVersionEditAccess(req.user.id, sylRes.rows[0].version_id, 'syllabus.edit');
    }

    const updates = [];
    const values = [];
    let idx = 1;
    if (content !== undefined) { updates.push(`content=$${idx++}`); values.push(JSON.stringify(content)); }
    if (status !== undefined) { updates.push(`status=$${idx++}`); values.push(status); }
    updates.push(`updated_at=NOW()`);
    values.push(req.params.id);
    const result = await pool.query(
      `UPDATE version_syllabi SET ${updates.join(',')} WHERE id=$${idx} RETURNING *`, values
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/syllabi/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM version_syllabi WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ SYLLABUS ASSIGNMENTS ============

// Helper: get eligible GV list scoped by assigner's role
async function getEligibleGV(userId, versionId) {
  const verRes = await pool.query(`
    SELECT p.department_id, d.parent_id as khoa_id
    FROM program_versions pv
    JOIN programs p ON pv.program_id = p.id
    JOIN departments d ON p.department_id = d.id
    WHERE pv.id = $1
  `, [versionId]);
  if (!verRes.rows.length) throw new Error('Phiên bản không tồn tại');
  const { department_id, khoa_id } = verRes.rows[0];

  const roles = await getUserRoles(userId);
  const maxLevel = Math.max(...roles.map(r => r.level), 0);

  let scopeWhere, scopeParams;
  if (maxLevel >= 4) {
    scopeWhere = '';
    scopeParams = [];
  } else if (maxLevel >= 3 && khoa_id) {
    scopeWhere = 'AND (ur.department_id = $1 OR ur.department_id IN (SELECT id FROM departments WHERE parent_id = $1))';
    scopeParams = [khoa_id];
  } else {
    scopeWhere = 'AND ur.department_id = $1';
    scopeParams = [department_id];
  }

  const result = await pool.query(`
    SELECT DISTINCT u.id, u.display_name, u.email, d.name as dept_name
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    JOIN departments d ON ur.department_id = d.id
    WHERE r.code = 'GIANG_VIEN' AND u.is_active = true ${scopeWhere}
    ORDER BY u.display_name
  `, scopeParams);

  return { gvList: result.rows, maxLevel };
}

// GET eligible GV for assignment
app.get('/api/assignments/eligible-gv', authMiddleware, async (req, res) => {
  try {
    const versionId = req.query.version_id;
    if (!versionId) return res.status(400).json({ error: 'Thiếu version_id' });
    const hasPerm = await hasPermission(req.user.id, 'syllabus.assign');
    const admin = await isAdmin(req.user.id);
    if (!hasPerm && !admin) return res.status(403).json({ error: 'Không có quyền' });
    const { gvList } = await getEligibleGV(req.user.id, versionId);
    res.json(gvList);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET assignments for a version
app.get('/api/versions/:vId/assignments', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sa.*,
             u1.display_name as assignee_name,
             u2.display_name as assigner_name,
             c.code as course_code, c.name as course_name, c.credits,
             vs.id as syllabus_id, vs.status as syllabus_status
      FROM syllabus_assignments sa
      JOIN users u1 ON sa.assigned_to = u1.id
      JOIN users u2 ON sa.assigned_by = u2.id
      JOIN courses c ON sa.course_id = c.id
      LEFT JOIN version_syllabi vs ON vs.version_id = sa.version_id AND vs.course_id = sa.course_id
      WHERE sa.version_id = $1
      ORDER BY c.code
    `, [req.params.vId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create/update assignment
app.post('/api/versions/:vId/assignments', authMiddleware, requirePerm('syllabus.assign'), async (req, res) => {
  const { course_id, assigned_to, deadline, notes } = req.body;
  const vId = req.params.vId;
  try {
    // Validate version not locked
    const verRes = await pool.query(`
      SELECT pv.status, pv.is_locked FROM program_versions pv WHERE pv.id = $1
    `, [vId]);
    if (!verRes.rows.length) return res.status(404).json({ error: 'Phiên bản không tồn tại' });
    if (verRes.rows[0].is_locked) return res.status(400).json({ error: 'Phiên bản đã bị khóa' });

    // Validate course belongs to version
    const vcRes = await pool.query(
      'SELECT id FROM version_courses WHERE version_id=$1 AND course_id=$2', [vId, course_id]
    );
    if (!vcRes.rows.length) return res.status(400).json({ error: 'Học phần không thuộc CTĐT này' });

    // Validate assigned_to is active GV in scope
    const { gvList, maxLevel } = await getEligibleGV(req.user.id, vId);
    if (!gvList.find(g => g.id === assigned_to)) {
      return res.status(400).json({ error: 'Giảng viên không hợp lệ hoặc ngoài phạm vi' });
    }

    // Check existing assignment — override logic
    const existingRes = await pool.query(
      'SELECT id, assigner_role_level FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2', [vId, course_id]
    );
    if (existingRes.rows.length) {
      const existing = existingRes.rows[0];
      if (maxLevel < existing.assigner_role_level) {
        return res.status(403).json({ error: 'Không thể thay đổi phân công của vai trò cao hơn' });
      }
      // Check syllabus status — only allow reassign when draft or no syllabus
      const sylRes = await pool.query(
        'SELECT status FROM version_syllabi WHERE version_id=$1 AND course_id=$2', [vId, course_id]
      );
      if (sylRes.rows.length && sylRes.rows[0].status !== 'draft') {
        return res.status(400).json({ error: 'Phải trả đề cương về nháp trước khi đổi GV' });
      }
    }

    // Upsert assignment
    const result = await pool.query(`
      INSERT INTO syllabus_assignments (version_id, course_id, assigned_to, assigned_by, assigner_role_level, deadline, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (version_id, course_id) DO UPDATE SET
        assigned_to = EXCLUDED.assigned_to,
        assigned_by = EXCLUDED.assigned_by,
        assigner_role_level = EXCLUDED.assigner_role_level,
        deadline = EXCLUDED.deadline,
        notes = EXCLUDED.notes,
        updated_at = NOW()
      RETURNING *
    `, [vId, course_id, assigned_to, req.user.id, maxLevel, deadline || null, notes || null]);

    // If syllabus exists, update author_id to new assignee
    await pool.query(
      'UPDATE version_syllabi SET author_id=$1, updated_at=NOW() WHERE version_id=$2 AND course_id=$3',
      [assigned_to, vId, course_id]
    );

    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// DELETE assignment
app.delete('/api/versions/:vId/assignments/:courseId', authMiddleware, requirePerm('syllabus.assign'), async (req, res) => {
  const { vId, courseId } = req.params;
  try {
    // Check syllabus status
    const sylRes = await pool.query(
      'SELECT status FROM version_syllabi WHERE version_id=$1 AND course_id=$2', [vId, courseId]
    );
    if (sylRes.rows.length && sylRes.rows[0].status !== 'draft') {
      return res.status(400).json({ error: 'Phải trả đề cương về nháp trước khi xóa phân công' });
    }
    await pool.query('DELETE FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2', [vId, courseId]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// GET my assignments (for GV — cross-program)
app.get('/api/my-assignments', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sa.id as assignment_id, sa.version_id, sa.course_id, sa.deadline, sa.notes, sa.created_at as assigned_at,
             c.code as course_code, c.name as course_name, c.credits,
             p.name as program_name, p.code as program_code,
             pv.academic_year, pv.status as version_status,
             d.name as dept_name,
             u.display_name as assigned_by_name,
             vs.id as syllabus_id, vs.status as syllabus_status
      FROM syllabus_assignments sa
      JOIN courses c ON sa.course_id = c.id
      JOIN program_versions pv ON sa.version_id = pv.id
      JOIN programs p ON pv.program_id = p.id
      JOIN departments d ON p.department_id = d.id
      JOIN users u ON sa.assigned_by = u.id
      LEFT JOIN version_syllabi vs ON vs.version_id = sa.version_id AND vs.course_id = sa.course_id
      WHERE sa.assigned_to = $1
      ORDER BY sa.deadline ASC NULLS LAST, sa.created_at DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST create syllabus from assignment
app.post('/api/my-assignments/:assignmentId/create-syllabus', authMiddleware, async (req, res) => {
  try {
    const aRes = await pool.query('SELECT * FROM syllabus_assignments WHERE id=$1', [req.params.assignmentId]);
    if (!aRes.rows.length) return res.status(404).json({ error: 'Không tìm thấy phân công' });
    const assignment = aRes.rows[0];

    if (assignment.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không được phân công cho đề cương này' });
    }

    // Check no syllabus exists yet
    const existRes = await pool.query(
      'SELECT id FROM version_syllabi WHERE version_id=$1 AND course_id=$2',
      [assignment.version_id, assignment.course_id]
    );
    if (existRes.rows.length) {
      return res.status(400).json({ error: 'Đề cương đã tồn tại', syllabus_id: existRes.rows[0].id });
    }

    // Check version not locked
    const verRes = await pool.query('SELECT is_locked FROM program_versions WHERE id=$1', [assignment.version_id]);
    if (verRes.rows.length && verRes.rows[0].is_locked) {
      return res.status(400).json({ error: 'Phiên bản đã bị khóa' });
    }

    const result = await pool.query(
      'INSERT INTO version_syllabi (version_id, course_id, author_id, content) VALUES ($1,$2,$3,$4) RETURNING *',
      [assignment.version_id, assignment.course_id, req.user.id, '{}']
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ CLOs per Syllabus ============
app.get('/api/syllabi/:sId/clos', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    // Get version_course_id from syllabus
    const syl = await pool.query('SELECT version_id, course_id FROM version_syllabi WHERE id=$1', [req.params.sId]);
    if (!syl.rows.length) return res.status(404).json({ error: 'Syllabus not found' });
    const vc = await pool.query('SELECT id FROM version_courses WHERE version_id=$1 AND course_id=$2',
      [syl.rows[0].version_id, syl.rows[0].course_id]);
    if (!vc.rows.length) return res.json([]);
    const clos = await pool.query('SELECT * FROM course_clos WHERE version_course_id=$1 ORDER BY code', [vc.rows[0].id]);
    res.json(clos.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/syllabi/:sId/clos', authMiddleware, async (req, res) => {
  const { code, description } = req.body;
  try {
    const syl = await pool.query('SELECT version_id, course_id FROM version_syllabi WHERE id=$1', [req.params.sId]);
    if (!syl.rows.length) return res.status(404).json({ error: 'Syllabus not found' });
    let vc = await pool.query('SELECT id FROM version_courses WHERE version_id=$1 AND course_id=$2',
      [syl.rows[0].version_id, syl.rows[0].course_id]);
    if (!vc.rows.length) {
      vc = await pool.query('INSERT INTO version_courses (version_id, course_id) VALUES ($1,$2) RETURNING id',
        [syl.rows[0].version_id, syl.rows[0].course_id]);
    }
    const result = await pool.query(
      'INSERT INTO course_clos (version_course_id, code, description) VALUES ($1,$2,$3) RETURNING *',
      [vc.rows[0].id, code, description]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/clos/:id', authMiddleware, async (req, res) => {
  const { code, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE course_clos SET code=COALESCE($1,code), description=COALESCE($2,description) WHERE id=$3 RETURNING *',
      [code, description, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/clos/:id', authMiddleware, async (req, res) => {
  try {
    await pool.query('DELETE FROM course_clos WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ CLO-PLO MAP ============
app.get('/api/syllabi/:sId/clo-plo-map', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const syl = await pool.query('SELECT version_id, course_id FROM version_syllabi WHERE id=$1', [req.params.sId]);
    if (!syl.rows.length) return res.json([]);
    const vc = await pool.query('SELECT id FROM version_courses WHERE version_id=$1 AND course_id=$2',
      [syl.rows[0].version_id, syl.rows[0].course_id]);
    if (!vc.rows.length) return res.json([]);
    const result = await pool.query(`
      SELECT cm.*, cc.code as clo_code, vp.code as plo_code
      FROM clo_plo_map cm
      JOIN course_clos cc ON cm.clo_id = cc.id
      JOIN version_plos vp ON cm.plo_id = vp.id
      WHERE cc.version_course_id = $1
    `, [vc.rows[0].id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/syllabi/:sId/clo-plo-map', authMiddleware, async (req, res) => {
  const { mappings } = req.body; // [{ clo_id, plo_id, contribution_level }]
  try {
    const syl = await pool.query('SELECT version_id, course_id FROM version_syllabi WHERE id=$1', [req.params.sId]);
    if (!syl.rows.length) return res.status(404).json({ error: 'Not found' });
    const vc = await pool.query('SELECT id FROM version_courses WHERE version_id=$1 AND course_id=$2',
      [syl.rows[0].version_id, syl.rows[0].course_id]);
    if (!vc.rows.length) return res.status(400).json({ error: 'No version course' });
    // Delete old mappings for this course's CLOs
    await pool.query('DELETE FROM clo_plo_map WHERE clo_id IN (SELECT id FROM course_clos WHERE version_course_id=$1)', [vc.rows[0].id]);
    for (const m of mappings) {
      await pool.query('INSERT INTO clo_plo_map (clo_id, plo_id, contribution_level) VALUES ($1,$2,$3)',
        [m.clo_id, m.plo_id, m.contribution_level || 1]);
    }
    res.json({ success: true, count: mappings.length });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// ============ SYLLABUS PDF IMPORT ============
app.post('/api/syllabi/:id/import-pdf', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    // Validate file
    if (!req.file) return res.status(400).json({ error: 'Chưa chọn file' });
    if (req.file.mimetype !== 'application/pdf') return res.status(400).json({ error: 'Chỉ hỗ trợ file PDF' });

    // Get syllabus + check exists and draft
    const sylRes = await pool.query('SELECT version_id, course_id, status FROM version_syllabi WHERE id=$1', [req.params.id]);
    if (!sylRes.rows.length) return res.status(404).json({ error: 'Không tìm thấy đề cương' });
    if (sylRes.rows[0].status !== 'draft') return res.status(400).json({ error: 'Chỉ có thể import khi đề cương ở trạng thái nháp' });

    const { version_id, course_id } = sylRes.rows[0];

    // Permission check: assigned GV or syllabus.edit
    const assignRes = await pool.query(
      'SELECT id FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2 AND assigned_to=$3',
      [version_id, course_id, req.user.id]
    );
    if (!assignRes.rows.length) {
      await checkVersionEditAccess(req.user.id, version_id, 'syllabus.edit');
    }

    // Parse PDF via Gemini
    const data = await parseSyllabusPdf(req.file.buffer, version_id, course_id, pool);
    res.json({ success: true, data });
  } catch (e) {
    const status = e.message.includes('Không tìm thấy') ? 404 : e.message.includes('quyền') ? 403 : 500;
    res.status(status).json({ error: e.message });
  }
});

// ============ APPROVAL WORKFLOW ============
// Submit for approval
app.post('/api/approval/submit', authMiddleware, async (req, res) => {
  const { entity_type, entity_id } = req.body; // entity_type: 'program_version' or 'syllabus'
  try {
    let table, statusField;
    if (entity_type === 'program_version') { table = 'program_versions'; statusField = 'status'; }
    else if (entity_type === 'syllabus') { table = 'version_syllabi'; statusField = 'status'; }
    else return res.status(400).json({ error: 'Invalid entity_type' });

    const current = await pool.query(`SELECT ${statusField} as status, id${entity_type === 'syllabus' ? ', version_id, course_id' : ''} FROM ${table} WHERE id=$1`, [entity_id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Not found' });
    if (current.rows[0].status !== 'draft') return res.status(400).json({ error: 'Chỉ có thể nộp bản nháp' });

    // Check submit permission
    const admin = await isAdmin(req.user.id);
    if (!admin) {
      if (entity_type === 'program_version') {
        const progRes = await pool.query('SELECT p.department_id FROM program_versions pv JOIN programs p ON pv.program_id = p.id WHERE pv.id = $1', [entity_id]);
        const deptId = progRes.rows.length ? progRes.rows[0].department_id : null;
        const hasPerm = await hasPermission(req.user.id, 'programs.submit', deptId);
        if (!hasPerm) return res.status(403).json({ error: 'Không có quyền nộp CTĐT (yêu cầu programs.submit)' });
      } else if (entity_type === 'syllabus') {
        // Bypass if user is the assigned GV for this syllabus
        const assignBypass = await pool.query(
          'SELECT 1 FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2 AND assigned_to=$3',
          [current.rows[0].version_id, current.rows[0].course_id, req.user.id]
        );
        if (!assignBypass.rows.length) {
          const sylRes = await pool.query('SELECT p.department_id FROM version_syllabi vs JOIN program_versions pv ON vs.version_id = pv.id JOIN programs p ON pv.program_id = p.id WHERE vs.id = $1', [entity_id]);
          const deptId = sylRes.rows.length ? sylRes.rows[0].department_id : null;
          const hasPerm = await hasPermission(req.user.id, 'syllabus.submit', deptId);
          if (!hasPerm) return res.status(403).json({ error: 'Không có quyền nộp đề cương (yêu cầu syllabus.submit)' });
        }
      }
    }

    // For syllabus: verify submitter is the assigned GV or has higher role
    if (entity_type === 'syllabus') {
      const assignCheck = await pool.query(
        'SELECT assigned_to FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2',
        [current.rows[0].version_id, current.rows[0].course_id]
      );
      if (assignCheck.rows.length && assignCheck.rows[0].assigned_to !== req.user.id) {
        const adminCheck = await isAdmin(req.user.id);
        const roles = await getUserRoles(req.user.id);
        const maxLvl = Math.max(...roles.map(r => r.level), 0);
        if (!adminCheck && maxLvl < 2) {
          return res.status(403).json({ error: 'Chỉ giảng viên được phân công mới có thể nộp đề cương' });
        }
      }
    }

    await pool.query(`UPDATE ${table} SET ${statusField}='submitted', is_rejected=false, updated_at=NOW() WHERE id=$1`, [entity_id]);
    await pool.query(
      'INSERT INTO approval_logs (entity_type, entity_id, step, action, reviewer_id, notes) VALUES ($1,$2,$3,$4,$5,$6)',
      [entity_type, entity_id, 'submit', 'submitted', req.user.id, 'Nộp duyệt']
    );
    res.json({ success: true, new_status: 'submitted' });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Approve or reject
app.post('/api/approval/review', authMiddleware, async (req, res) => {
  const { entity_type, entity_id, action, notes, target_status } = req.body; // action: 'approve' or 'reject'
  try {
    let table;
    if (entity_type === 'program_version') table = 'program_versions';
    else if (entity_type === 'syllabus') table = 'version_syllabi';
    else return res.status(400).json({ error: 'Invalid entity_type' });

    // 1. Get info
    let deptId;
    if (entity_type === 'program_version') {
      const resProg = await pool.query('SELECT p.department_id FROM program_versions pv JOIN programs p ON pv.program_id = p.id WHERE pv.id = $1', [entity_id]);
      if (resProg.rows.length) deptId = resProg.rows[0].department_id;
    } else {
      const resSyl = await pool.query(
        `SELECT p.department_id FROM version_syllabi vs
         JOIN program_versions pv ON vs.version_id = pv.id
         JOIN programs p ON pv.program_id = p.id
         WHERE vs.id = $1`, [entity_id]);
      if (resSyl.rows.length) deptId = resSyl.rows[0].department_id;
    }

    const itemRes = await pool.query(`SELECT status FROM ${table} WHERE id=$1`, [entity_id]);
    if (!itemRes.rows.length) return res.status(404).json({ error: 'Not found' });
    const status = itemRes.rows[0].status;

    // 2. Permission Check based on Status and Entity Type
    let requiredPerm = '';
    if (entity_type === 'program_version') {
      const perms = {
        submitted: 'programs.approve_khoa',
        approved_khoa: 'programs.approve_pdt',
        approved_pdt: 'programs.approve_bgh',
        approved_bgh: 'programs.approve_bgh' 
      };
      requiredPerm = perms[status];
    } else {
      const perms = {
        submitted: 'syllabus.approve_tbm',
        approved_tbm: 'syllabus.approve_khoa',
        approved_khoa: 'syllabus.approve_pdt',
        approved_pdt: 'syllabus.approve_bgh'
      };
      requiredPerm = perms[status];
    }

    if (!requiredPerm) return res.status(400).json({ error: 'Trạng thái này không thể duyệt tiếp' });

    const admin = await isAdmin(req.user.id);
    if (!admin) {
      const has = await hasPermission(req.user.id, requiredPerm, deptId);
      if (!has) return res.status(403).json({ error: `Không có quyền thực hiện bước này (${requiredPerm})` });
    }

    if (action === 'reject') {
      // Allow backtracking to draft or previous step
      let nextState = target_status;
      if (!nextState) {
        if (entity_type === 'program_version') {
          const revFlow = { 'submitted': 'draft', 'approved_khoa': 'submitted', 'approved_pdt': 'approved_khoa' };
          nextState = revFlow[status] || 'draft';
        } else {
          nextState = 'draft';
        }
      }

      await pool.query(
        `UPDATE ${table} SET status=$1, is_rejected=true, rejection_reason=$2, updated_at=NOW() WHERE id=$3`,
        [nextState, notes || 'Yêu cầu chỉnh sửa', entity_id]
      );
      await pool.query(
        'INSERT INTO approval_logs (entity_type, entity_id, step, action, reviewer_id, notes) VALUES ($1,$2,$3,$4,$5,$6)',
        [entity_type, entity_id, status, 'rejected', req.user.id, notes || 'Yêu cầu chỉnh sửa']
      );
      return res.json({ success: true, new_status: nextState });
    }

    // Determine next status
    let nextStatus;
    if (entity_type === 'program_version') {
      const flow = {
        submitted: 'approved_khoa',
        approved_khoa: 'approved_pdt',
        approved_pdt: 'published'
      };
      nextStatus = flow[status];
    } else {
      const flow = {
        submitted: 'approved_tbm',
        approved_tbm: 'approved_khoa',
        approved_khoa: 'approved_pdt',
        approved_pdt: 'published'
      };
      nextStatus = flow[status];
    }

    if (!nextStatus) return res.status(400).json({ error: `Không thể duyệt ở trạng thái "${status}"` });

    const isLocking = (nextStatus === 'published');
    await pool.query(
      `UPDATE ${table} SET status=$1, is_rejected=false, rejection_reason=NULL, updated_at=NOW() ${isLocking ? ', is_locked=true' : ''} WHERE id=$2`,
      [nextStatus, entity_id]
    );
    await pool.query(
      'INSERT INTO approval_logs (entity_type, entity_id, step, action, reviewer_id, notes) VALUES ($1,$2,$3,$4,$5,$6)',
      [entity_type, entity_id, status, 'approved', req.user.id, notes || 'Đã duyệt']
    );
    res.json({ success: true, new_status: nextStatus });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Approval history
app.get('/api/approval/history/:entityType/:entityId', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT al.*, u.display_name as reviewer_name
      FROM approval_logs al LEFT JOIN users u ON al.reviewer_id = u.id
      WHERE al.entity_type = $1 AND al.entity_id = $2
      ORDER BY al.created_at DESC
    `, [req.params.entityType, req.params.entityId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Pending approvals for current user
app.get('/api/approval/pending', authMiddleware, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);

    // Get user's role-department scopes for filtering
    const userRoles = admin ? [] : await getUserRoles(req.user.id);
    const maxLevel = Math.max(...userRoles.map(r => r.level), 0);

    // Map: status → required permission code
    const programPermMap = {
      submitted: 'programs.approve_khoa',
      approved_khoa: 'programs.approve_pdt',
      approved_pdt: 'programs.approve_bgh'
    };
    const syllabusPermMap = {
      submitted: 'syllabus.approve_tbm',
      approved_tbm: 'syllabus.approve_khoa',
      approved_khoa: 'syllabus.approve_pdt',
      approved_pdt: 'syllabus.approve_bgh'
    };

    // Get all pending programs
    const programs = await pool.query(`
      SELECT pv.id, pv.academic_year, pv.status, pv.is_rejected, pv.rejection_reason,
             p.name as program_name, p.department_id, d.name as dept_name, d.parent_id as dept_parent_id,
             'program_version' as entity_type
      FROM program_versions pv
      JOIN programs p ON pv.program_id = p.id
      JOIN departments d ON p.department_id = d.id
      WHERE pv.status IN ('submitted','approved_khoa','approved_pdt')
      ORDER BY pv.updated_at DESC
    `);

    // Get all pending syllabi
    const syllabi = await pool.query(`
      SELECT vs.id, vs.status, vs.is_rejected, vs.rejection_reason,
             c.code as course_code, c.name as course_name,
             u.display_name as author_name, p.department_id, d.name as dept_name, d.parent_id as dept_parent_id,
             p.name as program_name, pv.academic_year,
             'syllabus' as entity_type
      FROM version_syllabi vs
      JOIN courses c ON vs.course_id = c.id
      LEFT JOIN users u ON vs.author_id = u.id
      JOIN program_versions pv ON vs.version_id = pv.id
      JOIN programs p ON pv.program_id = p.id
      JOIN departments d ON p.department_id = d.id
      WHERE vs.status IN ('submitted','approved_tbm','approved_khoa','approved_pdt')
      ORDER BY vs.updated_at DESC
    `);

    if (admin) {
      return res.json({ programs: programs.rows, syllabi: syllabi.rows });
    }

    // Filter: only show items the user has the required approval permission for (dept-scoped)
    const userPerms = await getUserPermissions(req.user.id);

    const hasApprovalPerm = (permCode, itemDeptId, itemDeptParentId) => {
      return userPerms.some(p =>
        p.code === permCode && (
          maxLevel >= 4 ||
          p.department_id === itemDeptId ||
          p.department_id === itemDeptParentId
        )
      );
    };

    const filteredPrograms = programs.rows.filter(p => {
      const requiredPerm = programPermMap[p.status];
      return requiredPerm && hasApprovalPerm(requiredPerm, p.department_id, p.dept_parent_id);
    });

    const filteredSyllabi = syllabi.rows.filter(s => {
      const requiredPerm = syllabusPermMap[s.status];
      return requiredPerm && hasApprovalPerm(requiredPerm, s.department_id, s.dept_parent_id);
    });

    res.json({ programs: filteredPrograms, syllabi: filteredSyllabi });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ DASHBOARD STATS ============
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const [programs, versions, courses, syllabi, users, pending, depts, recentLogs] = await Promise.all([
      pool.query('SELECT COUNT(*) as c FROM programs'),
      pool.query("SELECT status, COUNT(*) as c FROM program_versions GROUP BY status"),
      pool.query('SELECT COUNT(*) as c FROM courses'),
      pool.query("SELECT status, COUNT(*) as c FROM version_syllabi GROUP BY status"),
      pool.query('SELECT COUNT(*) as c FROM users WHERE is_active=true'),
      pool.query("SELECT COUNT(*) as c FROM program_versions WHERE status IN ('submitted','approved_khoa','approved_pdt')"),
      pool.query("SELECT type, COUNT(*) as c FROM departments GROUP BY type"),
      pool.query(`
        SELECT al.action, al.target, al.created_at, u.display_name
        FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC LIMIT 15
      `),
    ]);

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
      pendingApprovals: parseInt(pending.rows[0].c),
      departments: deptStats,
      recentActivity: recentLogs.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ AUDIT LOGS ============
app.get('/api/audit-logs', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const result = await pool.query(`
      SELECT al.*, u.display_name as user_name
      FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
      ORDER BY al.created_at DESC LIMIT $1 OFFSET $2
    `, [limit, offset]);
    const countRes = await pool.query('SELECT COUNT(*) as c FROM audit_logs');
    res.json({ logs: result.rows, total: parseInt(countRes.rows[0].c) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ EXPORT ============
app.get('/api/export/version/:vId', authMiddleware, requirePerm('programs.export'), requireViewVersion, async (req, res) => {
  try {
    const vId = req.params.vId;
    const [version, pos, plos, vCourses, poploMap, cploMap, assessments, syllabi] = await Promise.all([
      pool.query(`SELECT pv.*, p.name as program_name, p.code as program_code, p.degree, p.total_credits, d.name as dept_name
        FROM program_versions pv JOIN programs p ON pv.program_id=p.id JOIN departments d ON p.department_id=d.id WHERE pv.id=$1`, [vId]),
      pool.query('SELECT * FROM version_objectives WHERE version_id=$1 ORDER BY code', [vId]),
      pool.query(`SELECT vp.*, (SELECT json_agg(json_build_object('id',pi.id,'code',pi.pi_code,'description',pi.description)) FROM plo_pis pi WHERE pi.plo_id=vp.id) as pis FROM version_plos vp WHERE vp.version_id=$1 ORDER BY code`, [vId]),
      pool.query(`SELECT vc.*, c.code as course_code, c.name as course_name, c.credits, c.credits_theory, c.credits_practice, c.credits_project, c.credits_internship, c.description as course_desc, d.name as dept_name
        FROM version_courses vc JOIN courses c ON vc.course_id=c.id LEFT JOIN departments d ON c.department_id=d.id WHERE vc.version_id=$1 ORDER BY vc.semester, c.code`, [vId]),
      pool.query('SELECT * FROM po_plo_map WHERE version_id=$1', [vId]),
      pool.query('SELECT * FROM course_plo_map WHERE version_id=$1', [vId]),
      pool.query(`SELECT ap.*, vp.code as plo_code, c.code as course_code FROM assessment_plans ap
        LEFT JOIN version_plos vp ON ap.plo_id=vp.id LEFT JOIN courses c ON ap.sample_course_id=c.id WHERE ap.version_id=$1`, [vId]),
      pool.query(`SELECT vs.*, c.code as course_code, c.name as course_name FROM version_syllabi vs
        JOIN courses c ON vs.course_id=c.id WHERE vs.version_id=$1 ORDER BY c.code`, [vId]),
    ]);

    if (!version.rows.length) return res.status(404).json({ error: 'Version not found' });

    res.json({
      version: version.rows[0],
      objectives: pos.rows,
      plos: plos.rows,
      courses: vCourses.rows,
      poploMap: poploMap.rows,
      coursePloMap: cploMap.rows,
      assessments: assessments.rows,
      syllabi: syllabi.rows,
      exportedAt: new Date().toISOString(),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ HEALTH ============
app.get('/api/health', (req, res) => res.json({ status: 'healthy', app: 'HUTECH Program', port: PORT }));

// ============ WORD IMPORT ============

// POST /api/import/parse-word — parse a .docx file, return structured data
app.post('/api/import/parse-word', authMiddleware, requirePerm('programs.import_word'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'No file uploaded' });
    const data = await parseWordFile(req.file.buffer);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/import/save — save a parsed CTDT object to the database in one transaction
app.post('/api/import/save', authMiddleware, requirePerm('programs.import_word'), async (req, res) => {
  const {
    program, version, general_objective,
    objectives, plos, pis,
    poploMatrix, knowledgeBlocks,
    courses, coursePIMatrix,
    teachingPlan, assessmentPlan,
    courseDescriptions,
    department_id,
  } = req.body;

  if (!program || !program.code) return res.status(400).json({ success: false, error: 'Missing program.code' });
  if (!department_id) return res.status(400).json({ success: false, error: 'Missing department_id' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── Step 1: Check duplicate program code ──────────────────────────────
    const dupCheck = await client.query('SELECT id FROM programs WHERE code=$1', [program.code]);
    if (dupCheck.rows.length) {
      await client.query('ROLLBACK');
      return res.status(409).json({ success: false, error: `Program with code "${program.code}" already exists` });
    }

    // ── Step 2: INSERT programs ───────────────────────────────────────────
    const progRes = await client.query(
      `INSERT INTO programs (department_id, name, name_en, code, degree, total_credits, institution, degree_name, training_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        department_id,
        program.name || '',
        program.name_en || null,
        program.code,
        program.degree || 'Đại học',
        program.total_credits || null,
        program.institution || null,
        program.degree_name || null,
        program.training_mode || null,
      ]
    );
    const program_id = progRes.rows[0].id;

    // ── Step 3: INSERT program_versions ──────────────────────────────────
    const verRes = await client.query(
      `INSERT INTO program_versions
         (program_id, academic_year, version_name, status, total_credits, training_duration,
          grading_scale, graduation_requirements, job_positions, further_education,
          reference_programs, training_process, admission_targets, admission_criteria, general_objective)
       VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [
        program_id,
        (version && version.academic_year) ? version.academic_year : new Date().getFullYear().toString(),
        (version && version.version_name) ? version.version_name : null,
        program.total_credits || null,
        (version && version.training_duration) ? version.training_duration : (program.duration || null),
        (version && version.grading_scale) ? version.grading_scale : null,
        (version && version.graduation_requirements) ? version.graduation_requirements : null,
        (version && version.job_positions) ? version.job_positions : null,
        (version && version.further_education) ? version.further_education : null,
        (version && version.reference_programs) ? version.reference_programs : null,
        (version && version.training_process) ? version.training_process : null,
        (version && version.admission_targets) ? version.admission_targets : null,
        (version && version.admission_criteria) ? version.admission_criteria : null,
        general_objective || null,
      ]
    );
    const version_id = verRes.rows[0].id;

    // ── Step 4: INSERT version_objectives (PO) ───────────────────────────
    const poMap = {}; // code → id
    for (const obj of (objectives || [])) {
      const r = await client.query(
        `INSERT INTO version_objectives (version_id, code, description) VALUES ($1,$2,$3) RETURNING id`,
        [version_id, obj.code, obj.description || null]
      );
      poMap[obj.code] = r.rows[0].id;
    }

    // ── Step 5: INSERT version_plos → ploMap (code→id) ───────────────────
    const ploMap = {}; // code → id
    for (const plo of (plos || [])) {
      const r = await client.query(
        `INSERT INTO version_plos (version_id, code, description, bloom_level) VALUES ($1,$2,$3,$4) RETURNING id`,
        [version_id, plo.code, plo.description || null, plo.bloom_level || 1]
      );
      ploMap[plo.code] = r.rows[0].id;
    }

    // ── Step 6: INSERT plo_pis → piMap (code→id) ─────────────────────────
    const piMap = {}; // pi_code → id
    for (const pi of (pis || [])) {
      const ploId = ploMap[pi.plo_code];
      if (!ploId) continue;
      const r = await client.query(
        `INSERT INTO plo_pis (plo_id, pi_code, description) VALUES ($1,$2,$3) RETURNING id`,
        [ploId, pi.pi_code, pi.description || null]
      );
      piMap[pi.pi_code] = r.rows[0].id;
    }

    // ── Step 7: UPSERT courses → courseMap (code→id) ─────────────────────
    const courseMap = {}; // code → courses.id
    for (const c of (courses || [])) {
      const r = await client.query(
        `INSERT INTO courses (code, name, credits, department_id, credits_theory, credits_practice, credits_project, credits_internship)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (code) DO UPDATE SET
           name=EXCLUDED.name,
           credits=EXCLUDED.credits,
           credits_theory=EXCLUDED.credits_theory,
           credits_practice=EXCLUDED.credits_practice,
           credits_project=EXCLUDED.credits_project,
           credits_internship=EXCLUDED.credits_internship
         RETURNING id`,
        [
          c.code, c.name || c.code, c.credits || 0, department_id,
          c.credits_theory || 0, c.credits_practice || 0,
          c.credits_project || 0, c.credits_internship || 0,
        ]
      );
      courseMap[c.code] = r.rows[0].id;
    }

    // ── Step 8: INSERT version_courses (resolve prereq/coreq) → vcMap (code→version_course_id) ──
    const vcMap = {}; // course_code → version_courses.id
    // First pass: insert all without prereq/coreq
    for (const c of (courses || [])) {
      const cid = courseMap[c.code];
      if (!cid) continue;
      const r = await client.query(
        `INSERT INTO version_courses (version_id, course_id, semester, course_type, elective_group)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [version_id, cid, c.semester || null, c.course_type || 'required', c.elective_group || null]
      );
      vcMap[c.code] = r.rows[0].id;
    }
    // Second pass: set prereq/coreq IDs now that all vcMap entries exist
    for (const c of (courses || [])) {
      const vcId = vcMap[c.code];
      if (!vcId) continue;
      const prereqIds = (c.prerequisite_codes || []).map(code => vcMap[code]).filter(Boolean);
      const coreqIds = (c.corequisite_codes || []).map(code => vcMap[code]).filter(Boolean);
      if (prereqIds.length || coreqIds.length) {
        await client.query(
          `UPDATE version_courses SET prerequisite_course_ids=$1, corequisite_course_ids=$2 WHERE id=$3`,
          [
            prereqIds.length ? prereqIds : null,
            coreqIds.length ? coreqIds : null,
            vcId,
          ]
        );
      }
    }

    // ── Step 9: INSERT knowledge_blocks (with parent_id resolution) ───────
    const blockNameToId = {};
    for (const blk of (knowledgeBlocks || [])) {
      const parentId = blk.parent_name ? (blockNameToId[blk.parent_name] || null) : null;
      const r = await client.query(
        `INSERT INTO knowledge_blocks (version_id, name, parent_id, total_credits, required_credits, elective_credits, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          version_id, blk.name, parentId,
          blk.total_credits || 0, blk.required_credits || 0,
          blk.elective_credits || 0, blk.sort_order || 0,
        ]
      );
      blockNameToId[blk.name] = r.rows[0].id;
    }

    // ── Step 10: INSERT po_plo_map ────────────────────────────────────────
    for (const m of (poploMatrix || [])) {
      const poId = poMap[m.po_code];
      const ploId = ploMap[m.plo_code];
      if (!poId || !ploId) continue;
      await client.query(
        `INSERT INTO po_plo_map (version_id, po_id, plo_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [version_id, poId, ploId]
      );
    }

    // ── Step 11: INSERT course_plo_map (aggregated from Course-PI matrix) ─
    // Derive PLO from PI code: "PI.1.01" → "PLO1"
    // Take max contribution_level per (course_code, plo_code) pair
    const coursePloAgg = {}; // "courseCode|ploCode" → max contribution_level
    for (const m of (coursePIMatrix || [])) {
      // PI code format: "PI.X.Y" → PLO is "PLO{X}"
      const piMatch = m.pi_code.match(/PI[\.\s]*(\d+)/i);
      if (!piMatch) continue;
      const ploCode = `PLO${parseInt(piMatch[1], 10)}`;
      const key = `${m.course_code}|${ploCode}`;
      const existing = coursePloAgg[key] || 0;
      if ((m.contribution_level || 0) > existing) {
        coursePloAgg[key] = m.contribution_level || 0;
      }
    }
    for (const [key, level] of Object.entries(coursePloAgg)) {
      const [courseCode, ploCode] = key.split('|');
      const vcId = vcMap[courseCode];
      const ploId = ploMap[ploCode];
      if (!vcId || !ploId) continue;
      await client.query(
        `INSERT INTO course_plo_map (version_id, course_id, plo_id, contribution_level) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [version_id, vcId, ploId, level]
      );
    }

    // ── Step 12: INSERT version_pi_courses (FK → version_courses.id) ─────
    for (const m of (coursePIMatrix || [])) {
      const vcId = vcMap[m.course_code];
      const piId = piMap[m.pi_code];
      if (!vcId || !piId) continue;
      await client.query(
        `INSERT INTO version_pi_courses (version_id, pi_id, course_id, contribution_level) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING`,
        [version_id, piId, vcId, m.contribution_level || 0]
      );
    }

    // ── Step 13: INSERT teaching_plan (resolve course_code→version_course_id) ──
    for (const tp of (teachingPlan || [])) {
      const vcId = vcMap[tp.code];
      if (!vcId) continue;
      await client.query(
        `INSERT INTO teaching_plan (version_course_id, total_hours, hours_theory, hours_practice, hours_project, hours_internship, software, managing_dept, batch, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [
          vcId,
          tp.total_hours || 0, tp.hours_theory || 0, tp.hours_practice || 0,
          tp.hours_project || 0, tp.hours_internship || 0,
          tp.software || null, tp.department || null, tp.batch || null, tp.notes || null,
        ]
      );
    }

    // ── Step 14: INSERT assessment_plans ─────────────────────────────────
    for (const ap of (assessmentPlan || [])) {
      const ploId = ploMap[ap.plo_code] || null;
      const piId = piMap[ap.pi_code] || null;
      // sample_course_id references courses.id (master), not version_courses
      const sampleCourseId = ap.sample_course ? (courseMap[ap.sample_course] || null) : null;
      await client.query(
        `INSERT INTO assessment_plans
           (version_id, plo_id, pi_id, sample_course_id, assessment_tool, criteria, threshold,
            semester, assessor, dept_code, direct_evidence, expected_result, contributing_course_codes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          version_id, ploId, piId, sampleCourseId,
          ap.assessment_tool || null,
          ap.description || null,      // criteria = $6 → ap.description
          ap.expected_result || null,  // threshold = $7 → ap.expected_result
          ap.schedule || null,
          ap.instructor || null,
          ap.unit || null,
          ap.direct_evidence || null,
          ap.standard || null,
          ap.contributing_courses ? ap.contributing_courses.join(',') : null,
        ]
      );
    }

    // ── Step 15: UPDATE courses.description ──────────────────────────────
    for (const cd of (courseDescriptions || [])) {
      const cid = courseMap[cd.code];
      if (!cid) continue;
      await client.query(
        `UPDATE courses SET description=$1 WHERE id=$2`,
        [cd.description, cid]
      );
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      program_id,
      version_id,
      summary: {
        objectives: (objectives || []).length,
        plos: (plos || []).length,
        pis: (pis || []).length,
        courses: Object.keys(courseMap).length,
        version_courses: Object.keys(vcMap).length,
        knowledge_blocks: Object.keys(blockNameToId).length,
        po_plo_map: (poploMatrix || []).length,
        course_plo_map: Object.keys(coursePloAgg).length,
        course_pi_map: (coursePIMatrix || []).length,
        teaching_plan: (teachingPlan || []).length,
        assessment_plans: (assessmentPlan || []).length,
        course_descriptions: (courseDescriptions || []).length,
      },
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(500).json({ success: false, error: e.message });
  } finally {
    client.release();
  }
});

// SPA fallback
app.get('*', (req, res) => res.sendFile(__dirname + '/public/index.html'));

// ============ START ============
async function start() {
  console.log('  ⏳ Connecting to database...');
  await initDB();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  🚀 HUTECH Program running at http://0.0.0.0:${PORT}`);
    console.log(`  🌐 Production URL: https://program.eduteam.vn\n`);
  });
}
start().catch(e => { console.error('Fatal:', e); process.exit(1); });
