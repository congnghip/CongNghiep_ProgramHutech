// HUTECH Program — Server
if (typeof process.loadEnvFile === 'function') {
  process.loadEnvFile();
}

const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const docxParser = require('./services/docx-parser');
const syllabusPdfImport = require('./services/syllabus-pdf-import');

const { pool, initDB, getUserPermissions, getUserRoles, hasPermission, isAdmin } = require('./db');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3600;
const JWT_SECRET = process.env.JWT_SECRET || 'hutech-program-secret';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
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

function normalizeImportData(rawData) {
  return docxParser.normalizeImportData(rawData);
}

async function getImportSessionOrThrow(sessionId) {
  const result = await pool.query('SELECT * FROM docx_import_sessions WHERE id = $1', [sessionId]);
  if (!result.rows.length) {
    const error = new Error('Không tìm thấy phiên làm việc');
    error.statusCode = 404;
    throw error;
  }
  return result.rows[0];
}

async function assertImportSessionAccess(session, user) {
  const admin = await isAdmin(user.id);
  if (session.user_id !== user.id && !admin) {
    const error = new Error('Bạn không có quyền truy cập phiên làm việc này');
    error.statusCode = 403;
    throw error;
  }
}

function normalizeJsonObject(value, fallback = {}) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
}

function normalizeJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function parseSyllabusImportSession(row) {
  const aiMetadata = syllabusPdfImport.buildImportMetadata(normalizeJsonObject(row.ai_metadata));
  return {
    ...row,
    extraction_data: normalizeJsonObject(row.extraction_data),
    canonical_payload: normalizeJsonObject(row.canonical_payload),
    review_payload: normalizeJsonObject(row.review_payload),
    validation_errors: normalizeJsonArray(row.validation_errors),
    warnings: normalizeJsonArray(row.warnings),
    diagnostics: normalizeJsonObject(row.diagnostics),
    ai_metadata: aiMetadata
  };
}

async function getSyllabusImportSessionOrThrow(sessionId) {
  const result = await pool.query('SELECT * FROM syllabus_import_sessions WHERE id = $1', [sessionId]);
  if (!result.rows.length) {
    const error = new Error('Không tìm thấy phiên import đề cương PDF');
    error.statusCode = 404;
    throw error;
  }
  return parseSyllabusImportSession(result.rows[0]);
}

async function assertSyllabusImportSessionAccess(session, user) {
  const admin = await isAdmin(user.id);
  if (session.user_id !== user.id && !admin) {
    const error = new Error('Bạn không có quyền truy cập phiên import đề cương này');
    error.statusCode = 403;
    throw error;
  }
}

async function getVersionSyllabusImportContext(versionId) {
  const [versionCourses, versionPlos, syllabi] = await Promise.all([
    pool.query(`
      SELECT vc.id, vc.course_id, vc.semester, vc.course_type, c.code AS course_code, c.name AS course_name, c.credits
      FROM version_courses vc
      JOIN courses c ON vc.course_id = c.id
      WHERE vc.version_id = $1
      ORDER BY vc.semester, c.code
    `, [versionId]),
    pool.query('SELECT id, code FROM version_plos WHERE version_id = $1 ORDER BY code', [versionId]),
    pool.query('SELECT id, course_id, status FROM version_syllabi WHERE version_id = $1', [versionId])
  ]);

  return {
    versionCourses: versionCourses.rows,
    versionPlos: versionPlos.rows,
    syllabi: syllabi.rows
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

async function requireViewSyllabus(req, res, next) {
  try {
    const admin = await isAdmin(req.user.id);
    if (admin) return next();

    const syllabusId = req.params.sId || req.params.id;
    if (!syllabusId) return res.status(400).json({ error: 'Thiếu mã đề cương' });

    const syllabusRes = await pool.query(`
      SELECT vs.id, pv.status, p.department_id
      FROM version_syllabi vs
      JOIN program_versions pv ON vs.version_id = pv.id
      JOIN programs p ON pv.program_id = p.id
      WHERE vs.id = $1
    `, [syllabusId]);

    if (!syllabusRes.rows.length) {
      return res.status(404).json({ error: 'Không tìm thấy đề cương.' });
    }

    const syllabus = syllabusRes.rows[0];
    const hasRoleBasedSyllabusView = await hasPermission(req.user.id, 'syllabus.view', syllabus.department_id);
    if (hasRoleBasedSyllabusView) return next();

    const isAssigned = await pool.query(
      'SELECT 1 FROM syllabus_assignments WHERE syllabus_id = $1 AND user_id = $2 LIMIT 1',
      [syllabus.id, req.user.id]
    );
    if (isAssigned.rows.length > 0) return next();

    return res.status(403).json({ error: 'Không có quyền xem đề cương này' });
  } catch (e) { res.status(500).json({ error: e.message }); }
}

async function isUserAssignedToSyllabus(userId, syllabusId) {
  const assigned = await pool.query(
    'SELECT 1 FROM syllabus_assignments WHERE syllabus_id = $1 AND user_id = $2 LIMIT 1',
    [syllabusId, userId]
  );
  return assigned.rows.length > 0;
}

async function getSyllabusAssignmentScope(userId, syllabusId) {
  const admin = await isAdmin(userId);
  const syllabusRes = await pool.query(`
    SELECT vs.id, p.department_id, d.parent_id
    FROM version_syllabi vs
    JOIN program_versions pv ON vs.version_id = pv.id
    JOIN programs p ON pv.program_id = p.id
    JOIN departments d ON p.department_id = d.id
    WHERE vs.id = $1
  `, [syllabusId]);

  if (!syllabusRes.rows.length) {
    throw new Error('Không tìm thấy đề cương');
  }

  const scope = syllabusRes.rows[0];
  if (admin) {
    return {
      mode: 'all',
      departmentId: scope.department_id,
      parentDepartmentId: scope.parent_id,
    };
  }

  const canAssign = await hasPermission(userId, 'syllabus.assign', scope.department_id);
  if (!canAssign) {
    return null;
  }

  const roles = await getUserRoles(userId);
  const schoolWideRoles = new Set(['PHONG_DAO_TAO', 'BAN_GIAM_HIEU']);
  const departmentScopedRoles = new Set(['TRUONG_NGANH']);
  const facultyScopedRoles = new Set(['LANH_DAO_KHOA']);

  const matchingRoles = roles.filter((role) => {
    if (schoolWideRoles.has(role.role_code)) return true;
    if (!departmentScopedRoles.has(role.role_code) && !facultyScopedRoles.has(role.role_code)) return false;
    return role.department_id === scope.department_id || role.department_id === scope.parent_id;
  });

  if (matchingRoles.some(role => schoolWideRoles.has(role.role_code))) {
    return {
      mode: 'all',
      departmentId: scope.department_id,
      parentDepartmentId: scope.parent_id,
    };
  }

  if (matchingRoles.some(role => facultyScopedRoles.has(role.role_code) && role.department_id === scope.parent_id)) {
    return {
      mode: 'faculty',
      departmentId: scope.department_id,
      parentDepartmentId: scope.parent_id,
    };
  }

  if (matchingRoles.some(role => departmentScopedRoles.has(role.role_code) && role.department_id === scope.department_id)) {
    return {
      mode: 'department',
      departmentId: scope.department_id,
      parentDepartmentId: scope.parent_id,
    };
  }

  return null;
}

async function listAssignableUsers(scope) {
  const params = [];
  let deptFilter = '';

  if (scope.mode === 'department') {
    params.push(scope.departmentId);
    deptFilter = ` AND ur.department_id = $${params.length}`;
  } else if (scope.mode === 'faculty') {
    params.push(scope.parentDepartmentId);
    deptFilter = ` AND (
      ur.department_id = $${params.length}
      OR ur.department_id IN (SELECT id FROM departments WHERE parent_id = $${params.length})
    )`;
  }

  const result = await pool.query(`
    SELECT DISTINCT u.id, u.display_name, u.username, d.name as dept_name
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    LEFT JOIN departments d ON ur.department_id = d.id
    WHERE u.is_active = true
      AND r.code = 'GIANG_VIEN'
      ${deptFilter}
    ORDER BY u.display_name, u.username
  `, params);

  return result.rows;
}

async function getSyllabusOwnerDepartmentId(syllabusId) {
  const assignedDept = await pool.query(`
    SELECT ur.department_id
    FROM syllabus_assignments sa
    JOIN user_roles ur ON ur.user_id = sa.user_id
    JOIN roles r ON r.id = ur.role_id
    WHERE sa.syllabus_id = $1
      AND r.code = 'GIANG_VIEN'
      AND ur.department_id IS NOT NULL
    ORDER BY sa.id ASC
    LIMIT 1
  `, [syllabusId]);
  if (assignedDept.rows.length) return assignedDept.rows[0].department_id;

  const authorDept = await pool.query(`
    SELECT ur.department_id
    FROM version_syllabi vs
    JOIN user_roles ur ON ur.user_id = vs.author_id
    JOIN roles r ON r.id = ur.role_id
    WHERE vs.id = $1
      AND r.code = 'GIANG_VIEN'
      AND ur.department_id IS NOT NULL
    LIMIT 1
  `, [syllabusId]);
  if (authorDept.rows.length) return authorDept.rows[0].department_id;

  const courseDept = await pool.query(`
    SELECT c.department_id
    FROM version_syllabi vs
    JOIN courses c ON c.id = vs.course_id
    WHERE vs.id = $1
    LIMIT 1
  `, [syllabusId]);
  return courseDept.rows[0]?.department_id || null;
}

async function canReviewSyllabusAtCurrentStep(userId, syllabusId, status, requiredPerm) {
  const admin = await isAdmin(userId);
  if (admin) return true;

  if (status === 'submitted' && requiredPerm === 'syllabus.approve_tbm') {
    const ownerDeptId = await getSyllabusOwnerDepartmentId(syllabusId);
    if (!ownerDeptId) return false;
    const result = await pool.query(`
      SELECT 1
      FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id = ur.role_id
      JOIN permissions p ON p.id = rp.permission_id
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = $1
        AND p.code = $2
        AND r.code = 'TRUONG_NGANH'
        AND ur.department_id = $3
      LIMIT 1
    `, [userId, requiredPerm, ownerDeptId]);
    return result.rows.length > 0;
  }

  const deptRes = await pool.query(
    'SELECT c.department_id FROM version_syllabi vs JOIN courses c ON vs.course_id = c.id WHERE vs.id = $1',
    [syllabusId]
  );
  const deptId = deptRes.rows[0]?.department_id;
  return deptId ? hasPermission(userId, requiredPerm, deptId) : false;
}

async function canTrackProgramForUser(userId, roles, item) {
  const admin = await isAdmin(userId);
  if (admin) return true;

  const trackingPerms = [
    'programs.approve_khoa',
    'programs.approve_pdt',
    'programs.approve_bgh'
  ];
  for (const perm of trackingPerms) {
    if (await hasPermission(userId, perm, item.department_id)) return true;
  }
  return false;
}

async function canTrackSyllabusForUser(userId, roles, item) {
  const admin = await isAdmin(userId);
  if (admin) return true;

  const ownerDeptId = await getSyllabusOwnerDepartmentId(item.id);
  const courseDeptId = item.department_id;
  const ownerDeptRes = ownerDeptId
    ? await pool.query('SELECT parent_id FROM departments WHERE id = $1', [ownerDeptId])
    : { rows: [] };
  const ownerParentId = ownerDeptRes.rows[0]?.parent_id || null;

  if (roles.some(role => role.role_code === 'TRUONG_NGANH' && role.department_id === ownerDeptId)) {
    return true;
  }
  if (roles.some(role => role.role_code === 'LANH_DAO_KHOA' && role.department_id === ownerParentId)) {
    return true;
  }

  const trackingPerms = [
    'syllabus.approve_khoa',
    'syllabus.approve_pdt',
    'syllabus.approve_bgh'
  ];
  for (const perm of trackingPerms) {
    if (courseDeptId && await hasPermission(userId, perm, courseDeptId)) return true;
  }
  return false;
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

app.post('/api/departments', authMiddleware, requirePerm('rbac.manage_departments'), async (req, res) => {
  const { code, name, type, parent_id } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO departments (code, name, type, parent_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [code, name, type || 'KHOA', parent_id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/departments/:id', authMiddleware, requirePerm('rbac.manage_departments'), async (req, res) => {
  const { name, type } = req.body;
  try {
    const result = await pool.query('UPDATE departments SET name=$1, type=COALESCE($2,type) WHERE id=$3 RETURNING *', [name, type, req.params.id]);
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/departments/:id', authMiddleware, requirePerm('rbac.manage_departments'), async (req, res) => {
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
app.get('/api/users', authMiddleware, requirePerm('rbac.manage_users'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.id, u.username, u.display_name, u.email, u.is_active, u.created_at, u.department_id,
        dept.name as dept_name,
        COALESCE(json_agg(json_build_object('role_code', r.code, 'role_name', r.name, 'dept_code', d.code, 'dept_name', d.name, 'department_id', ur.department_id, 'parent_dept_name', pd.name))
        FILTER (WHERE r.id IS NOT NULL), '[]') as roles
      FROM users u
      LEFT JOIN departments dept ON u.department_id = dept.id
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      LEFT JOIN departments d ON ur.department_id = d.id
      LEFT JOIN departments pd ON d.parent_id = pd.id
      GROUP BY u.id, dept.name ORDER BY u.created_at
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/assignable', authMiddleware, async (req, res) => {
  try {
    const syllabusId = parseInt(req.query.syllabus_id, 10);
    if (!syllabusId) {
      return res.status(400).json({ error: 'Thiếu syllabus_id' });
    }

    const scope = await getSyllabusAssignmentScope(req.user.id, syllabusId);
    if (!scope) {
      return res.status(403).json({ error: 'Không có quyền phân công đề cương này' });
    }

    const users = await listAssignableUsers(scope);
    res.json(users);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.post('/api/users', authMiddleware, requirePerm('rbac.manage_users'), async (req, res) => {
  const { username, password, display_name, email, department_id } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, display_name, email, department_id) VALUES ($1,$2,$3,$4,$5) RETURNING id, username, display_name',
      [username, hash, display_name, email, department_id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/users/:id', authMiddleware, requirePerm('rbac.manage_users'), async (req, res) => {
  const { display_name, email, password, is_active, department_id } = req.body;
  try {
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await pool.query('UPDATE users SET password_hash=$1 WHERE id=$2', [hash, req.params.id]);
    }
    const result = await pool.query(
      'UPDATE users SET display_name=COALESCE($1,display_name), email=COALESCE($2,email), is_active=COALESCE($3,is_active), department_id=COALESCE($4,department_id) WHERE id=$5 RETURNING id, username, display_name',
      [display_name, email, is_active, department_id, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Assign role to user
app.post('/api/users/:id/roles', authMiddleware, requirePerm('rbac.manage_users'), async (req, res) => {
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
app.delete('/api/users/:userId/roles/:roleCode/:deptId', authMiddleware, requirePerm('rbac.manage_users'), async (req, res) => {
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
app.delete('/api/users/:id', authMiddleware, requirePerm('rbac.manage_users'), async (req, res) => {
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
app.put('/api/users/:id/toggle-active', authMiddleware, requirePerm('rbac.manage_users'), async (req, res) => {
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

app.post('/api/roles', authMiddleware, requirePerm('rbac.manage_roles'), async (req, res) => {
  const { code, name, level } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO roles (code, name, level, is_system) VALUES ($1,$2,$3,false) RETURNING *',
      [code, name, level || 1]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/roles/:id', authMiddleware, requirePerm('rbac.manage_roles'), async (req, res) => {
  const { name, level } = req.body;
  try {
    const result = await pool.query(
      'UPDATE roles SET name=COALESCE($1,name), level=COALESCE($2,level) WHERE id=$3 RETURNING *',
      [name, level, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/roles/:id', authMiddleware, requirePerm('rbac.manage_roles'), async (req, res) => {
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
app.get('/api/permissions', authMiddleware, requirePerm('rbac.manage_roles'), async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM permissions ORDER BY module, code');
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update role permissions (batch)
app.put('/api/roles/:id/permissions', authMiddleware, requirePerm('rbac.manage_roles'), async (req, res) => {
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
  const { academic_year, copy_from_version_id, version_name, total_credits, training_duration,
          change_type, effective_date, change_summary, grading_scale, graduation_requirements,
          job_positions, further_education, reference_programs, training_process,
          admission_targets, admission_criteria } = req.body;
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
      `INSERT INTO program_versions (
        program_id, academic_year, copied_from_id, version_name, total_credits,
        training_duration, change_type, effective_date, change_summary, grading_scale,
        graduation_requirements, job_positions, further_education, reference_programs,
        training_process, admission_targets, admission_criteria
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *`,
      [req.params.programId, academic_year, copy_from_version_id || null, version_name,
       total_credits, training_duration, change_type, effective_date || null, change_summary,
       grading_scale, graduation_requirements, job_positions, further_education,
       reference_programs, training_process, admission_targets, admission_criteria]
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
    await pool.query('DELETE FROM courses WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { 
    if (e.code === '23503') {
      return res.status(400).json({ error: 'Học phần này hiện đang nằm trong mục tiêu hoặc ma trận CTĐT. Không thể xóa!' });
    }
    res.status(400).json({ error: e.message }); 
  }
});

// ============ VERSION COURSES ============
app.get('/api/versions/:vId/courses', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vc.*, c.code as course_code, c.name as course_name, c.credits, c.description as course_desc,
             d.name as dept_name
      FROM version_courses vc
      JOIN courses c ON vc.course_id = c.id
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE vc.version_id = $1
      ORDER BY vc.semester, c.code
    `, [req.params.vId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
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
    const admin = await isAdmin(req.user.id);
    if (!admin) {
      const deptRes = await pool.query(`
        SELECT p.department_id
        FROM program_versions pv
        JOIN programs p ON pv.program_id = p.id
        WHERE pv.id = $1
      `, [req.params.vId]);
      const deptId = deptRes.rows[0]?.department_id;
      const hasSyllabusView = deptId ? await hasPermission(req.user.id, 'syllabus.view', deptId) : false;
      if (!hasSyllabusView) {
        return res.status(403).json({ error: 'Không có quyền xem danh sách đề cương của phiên bản này' });
      }
    }

    const result = await pool.query(`
      SELECT vs.*, c.code as course_code, c.name as course_name, c.credits,
             (SELECT json_agg(json_build_object('id', u.id, 'display_name', u.display_name))
              FROM syllabus_assignments sa
              JOIN users u ON sa.user_id = u.id
              WHERE sa.syllabus_id = vs.id) as authors
      FROM version_syllabi vs
      JOIN courses c ON vs.course_id = c.id
      WHERE vs.version_id = $1 ORDER BY c.code
    `, [req.params.vId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ SYLLABUS ASSIGNMENTS ============
app.get('/api/my-syllabi', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vs.*, c.code as course_code, c.name as course_name, c.credits,
             pv.id as version_id, pv.academic_year, p.id as program_id,
             p.name as program_name, d.name as dept_name
      FROM syllabus_assignments sa
      JOIN version_syllabi vs ON sa.syllabus_id = vs.id
      JOIN courses c ON vs.course_id = c.id
      JOIN program_versions pv ON vs.version_id = pv.id
      JOIN programs p ON pv.program_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE sa.user_id = $1
      ORDER BY pv.academic_year DESC, c.code
    `, [req.user.id]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/assignments/:sId', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sa.*, u.display_name, u.username, d.name as dept_name
      FROM syllabus_assignments sa
      JOIN users u ON sa.user_id = u.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE sa.syllabus_id = $1
    `, [req.params.sId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/assignments', authMiddleware, async (req, res) => {
  const { syllabus_id, user_ids } = req.body; // Expect array of user_ids
  try {
    const syllabusId = parseInt(syllabus_id, 10);
    const normalizedUserIds = Array.isArray(user_ids)
      ? [...new Set(user_ids.map(id => parseInt(id, 10)).filter(Number.isInteger))]
      : [];

    if (!syllabusId) {
      return res.status(400).json({ error: 'Thiếu syllabus_id hợp lệ' });
    }

    const scope = await getSyllabusAssignmentScope(req.user.id, syllabusId);
    if (!scope) {
      return res.status(403).json({ error: 'Không có quyền phân công đề cương này' });
    }

    const assignableUsers = await listAssignableUsers(scope);
    const assignableUserIds = new Set(assignableUsers.map(user => user.id));
    const invalidUserIds = normalizedUserIds.filter(id => !assignableUserIds.has(id));
    if (invalidUserIds.length > 0) {
      return res.status(403).json({ error: 'Danh sách giảng viên phân công vượt quá phạm vi cho phép' });
    }

    await pool.query('BEGIN');
    await pool.query('DELETE FROM syllabus_assignments WHERE syllabus_id = $1', [syllabusId]);
    if (normalizedUserIds.length > 0) {
      for (const uid of normalizedUserIds) {
        await pool.query(
          'INSERT INTO syllabus_assignments (syllabus_id, user_id) VALUES ($1, $2)',
          [syllabusId, uid]
        );
      }
    }
    await pool.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await pool.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/versions/:vId/syllabi', authMiddleware, requireDraft('vId', 'syllabus.create'), async (req, res) => {
  const { course_id, content } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO version_syllabi (version_id, course_id, author_id, content) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.vId, course_id, req.user.id, JSON.stringify(content || {})]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.get('/api/syllabi/:id', authMiddleware, requireViewSyllabus, async (req, res) => {
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
    const sylRes = await pool.query('SELECT version_id, id, status FROM version_syllabi WHERE id=$1', [req.params.id]);
    if (!sylRes.rows.length) throw new Error('Không tìm thấy đề cương');
    const versionId = sylRes.rows[0].version_id;
    const syllabusId = sylRes.rows[0].id;
    const syllabusStatus = sylRes.rows[0].status;

    // RBAC Check
    const roles = await getUserRoles(req.user.id);
    const highestRole = roles[0];
    const admin = await isAdmin(req.user.id);
    const isAssignedLecturer = !admin && highestRole && highestRole.level === 1 && await isUserAssignedToSyllabus(req.user.id, syllabusId);

    // If level 1 (GIANG_VIEN), check if assigned
    if (!admin && highestRole && highestRole.level === 1) {
      if (!isAssignedLecturer) {
        return res.status(403).json({ error: 'Bạn không được phân công soạn đề cương này' });
      }
    }

    if (isAssignedLecturer) {
      if (syllabusStatus !== 'draft') {
        return res.status(403).json({ error: 'Chỉ có thể chỉnh sửa đề cương ở trạng thái nháp' });
      }
    } else {
      await checkVersionEditAccess(req.user.id, versionId, 'syllabus.edit');
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

// ============ CLOs per Syllabus ============
app.get('/api/syllabi/:sId/clos', authMiddleware, requireViewSyllabus, async (req, res) => {
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
app.get('/api/syllabi/:sId/clo-plo-map', authMiddleware, requireViewSyllabus, async (req, res) => {
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

// ============ PDF SYLLABUS IMPORT ============
app.post('/api/versions/:vId/syllabus-import-pdf/session', authMiddleware, requireDraft('vId', 'syllabus.create'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Vui lòng chọn file PDF để import.' });
    }
    if (req.file.mimetype !== 'application/pdf' && !req.file.originalname.toLowerCase().endsWith('.pdf')) {
      return res.status(400).json({ error: 'Chỉ hỗ trợ file PDF cho chức năng này.' });
    }

    const context = await getVersionSyllabusImportContext(req.params.vId);
    const startedAt = Date.now();
    const engine = req.body?.mock === '1' ? 'mock' : syllabusPdfImport.DEFAULT_ENGINE;
    console.info(`[syllabus-pdf-import] start session user=${req.user.id} version=${req.params.vId} file="${req.file.originalname}" size=${req.file.size} engine=${engine}`);
    const processed = await syllabusPdfImport.processPdfImportWithMode({
      buffer: req.file.buffer,
      versionCourses: context.versionCourses,
      existingSyllabi: context.syllabi,
      mode: engine
    });
    const validation = syllabusPdfImport.validateCanonicalPayload(
      processed.canonical,
      context.versionCourses,
      context.versionPlos
    );

    const warnings = [
      ...(processed.canonical.warnings || []),
      ...validation.warnings.map(item => item.msg)
    ];

    const aiMetadata = syllabusPdfImport.buildImportMetadata(processed.canonical.import_metadata);
    const insert = await pool.query(
      `INSERT INTO syllabus_import_sessions (
        user_id, version_id, status, source_filename, source_mime, extraction_text,
        extraction_data, canonical_payload, review_payload, validation_errors,
        warnings, diagnostics, ai_metadata, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      RETURNING *`,
      [
        req.user.id,
        req.params.vId,
        validation.valid ? 'review' : 'needs_review',
        req.file.originalname,
        req.file.mimetype,
        processed.extraction.text,
        JSON.stringify(processed.extraction.diagnostics || {}),
        JSON.stringify(processed.canonical),
        JSON.stringify(processed.canonical),
        JSON.stringify(validation.errors),
        JSON.stringify(warnings),
        JSON.stringify({
          ...processed.extraction.diagnostics,
          processing_ms: Date.now() - startedAt
        }),
        JSON.stringify(syllabusPdfImport.buildImportMetadata({
          ...processed.canonical.import_metadata,
          engine: aiMetadata.engine,
          provider: processed.canonical.import_metadata?.provider,
          model: processed.canonical.import_metadata?.model || processed.canonical.import_metadata?.ai_model || syllabusPdfImport.DEFAULT_MODEL,
          prompt_version: processed.canonical.import_metadata?.prompt_version || syllabusPdfImport.HYBRID_PROMPT_VERSION || syllabusPdfImport.PROMPT_VERSION
        }))
      ]
    );

    console.info(`[syllabus-pdf-import] session created id=${insert.rows[0].id} processingMs=${Date.now() - startedAt} engine=${aiMetadata.engine} provider=${aiMetadata.provider} model=${aiMetadata.model}`);
    res.json(parseSyllabusImportSession(insert.rows[0]));
  } catch (e) {
    console.warn(`[syllabus-pdf-import] create session failed version=${req.params.vId}: ${e.message}`);
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/syllabus-import-pdf/session/:id', authMiddleware, async (req, res) => {
  try {
    const session = await getSyllabusImportSessionOrThrow(req.params.id);
    await assertSyllabusImportSessionAccess(session, req.user);
    res.json(session);
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.put('/api/syllabus-import-pdf/session/:id', authMiddleware, async (req, res) => {
  try {
    const session = await getSyllabusImportSessionOrThrow(req.params.id);
    await assertSyllabusImportSessionAccess(session, req.user);
    const { review_payload } = req.body;
    const normalized = syllabusPdfImport.normalizeCanonicalPayload(review_payload || session.review_payload || session.canonical_payload);
    const updated = await pool.query(
      `UPDATE syllabus_import_sessions
       SET review_payload = $1, status = $2, updated_at = NOW()
       WHERE id = $3
       RETURNING *`,
      [JSON.stringify(normalized), 'review', req.params.id]
    );
    res.json(parseSyllabusImportSession(updated.rows[0]));
  } catch (e) {
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/syllabus-import-pdf/session/:id/validate', authMiddleware, async (req, res) => {
  try {
    const session = await getSyllabusImportSessionOrThrow(req.params.id);
    await assertSyllabusImportSessionAccess(session, req.user);
    const context = await getVersionSyllabusImportContext(session.version_id);
    const payload = syllabusPdfImport.normalizeCanonicalPayload(session.review_payload || session.canonical_payload);
    const validation = syllabusPdfImport.validateCanonicalPayload(payload, context.versionCourses, context.versionPlos);
    const warnings = [
      ...(payload.warnings || []),
      ...validation.warnings.map(item => item.msg)
    ];
    const updated = await pool.query(
      `UPDATE syllabus_import_sessions
       SET review_payload = $1, validation_errors = $2, warnings = $3, status = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        JSON.stringify(payload),
        JSON.stringify(validation.errors),
        JSON.stringify(warnings),
        validation.valid ? 'validated' : 'needs_review',
        req.params.id
      ]
    );
    console.info(`[syllabus-pdf-import] validated session id=${req.params.id} valid=${validation.valid} errors=${validation.errors.length} warnings=${validation.warnings.length}`);
    res.json({
      success: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
      session: parseSyllabusImportSession(updated.rows[0])
    });
  } catch (e) {
    console.warn(`[syllabus-pdf-import] validate failed session=${req.params.id}: ${e.message}`);
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/syllabus-import-pdf/session/:id/retry', authMiddleware, async (req, res) => {
  try {
    const session = await getSyllabusImportSessionOrThrow(req.params.id);
    await assertSyllabusImportSessionAccess(session, req.user);
    if (!session.extraction_text) {
      return res.status(400).json({ error: 'Session chưa có extraction text để retry.' });
    }
    const context = await getVersionSyllabusImportContext(session.version_id);
    const engine = syllabusPdfImport.normalizeImportEngine(session.ai_metadata?.engine || session.ai_metadata?.mode);
    const canonical = await syllabusPdfImport.reprocessPdfTextWithMode({
      extractionText: session.extraction_text,
      versionCourses: context.versionCourses,
      existingSyllabi: context.syllabi,
      mode: engine
    });
    const validation = syllabusPdfImport.validateCanonicalPayload(canonical, context.versionCourses, context.versionPlos);
    const warnings = [
      ...(canonical.warnings || []),
      ...validation.warnings.map(item => item.msg)
    ];
    const updated = await pool.query(
      `UPDATE syllabus_import_sessions
       SET canonical_payload = $1, review_payload = $1, validation_errors = $2, warnings = $3,
           ai_metadata = $4, status = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        JSON.stringify(canonical),
        JSON.stringify(validation.errors),
        JSON.stringify(warnings),
        JSON.stringify(syllabusPdfImport.buildImportMetadata({
          ...canonical.import_metadata,
          engine: canonical.import_metadata?.engine || engine,
          provider: canonical.import_metadata?.provider,
          model: canonical.import_metadata?.model || canonical.import_metadata?.ai_model || syllabusPdfImport.DEFAULT_MODEL,
          prompt_version: canonical.import_metadata?.prompt_version || syllabusPdfImport.HYBRID_PROMPT_VERSION || syllabusPdfImport.PROMPT_VERSION,
          diagnostics: {
            ...canonical.import_metadata?.diagnostics,
            retried_at: new Date().toISOString()
          }
        })),
        validation.valid ? 'review' : 'needs_review',
        req.params.id
      ]
    );
    const retryMetadata = syllabusPdfImport.buildImportMetadata(canonical.import_metadata);
    console.info(`[syllabus-pdf-import] retried session id=${req.params.id} valid=${validation.valid} engine=${retryMetadata.engine} provider=${retryMetadata.provider} model=${retryMetadata.model}`);
    res.json(parseSyllabusImportSession(updated.rows[0]));
  } catch (e) {
    console.warn(`[syllabus-pdf-import] retry failed session=${req.params.id}: ${e.message}`);
    res.status(e.statusCode || 400).json({ error: e.message });
  }
});

app.post('/api/syllabus-import-pdf/session/:id/commit', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  let startedTransaction = false;
  try {
    const session = await getSyllabusImportSessionOrThrow(req.params.id);
    await assertSyllabusImportSessionAccess(session, req.user);
    await checkVersionEditAccess(req.user.id, session.version_id, 'syllabus.create');

    const context = await getVersionSyllabusImportContext(session.version_id);
    const payload = syllabusPdfImport.normalizeCanonicalPayload(session.review_payload || session.canonical_payload);
    const validation = syllabusPdfImport.validateCanonicalPayload(payload, context.versionCourses, context.versionPlos);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Phiên import còn lỗi nghiêm trọng. Vui lòng validate và chỉnh sửa trước khi commit.', errors: validation.errors });
    }

    const targetCourseId = Number(payload.target?.course_id);
    const versionCourse = context.versionCourses.find(item => Number(item.course_id) === targetCourseId);
    if (!versionCourse) {
      throw new Error('Không tìm thấy học phần đích trong CTĐT.');
    }

    const existingSyllabusRes = await client.query(
      'SELECT * FROM version_syllabi WHERE version_id = $1 AND course_id = $2 LIMIT 1',
      [session.version_id, targetCourseId]
    );
    const existingSyllabus = existingSyllabusRes.rows[0];
    if (existingSyllabus && existingSyllabus.status !== 'draft') {
      throw new Error('Chỉ có thể import vào đề cương đang ở trạng thái nháp.');
    }

    await client.query('BEGIN');
    startedTransaction = true;

    const content = syllabusPdfImport.mapPayloadToSyllabusContent(payload);
    let syllabusId = existingSyllabus?.id || null;

    if (existingSyllabus) {
      await client.query(
        'UPDATE version_syllabi SET content = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(content), existingSyllabus.id]
      );
    } else {
      const created = await client.query(
        'INSERT INTO version_syllabi (version_id, course_id, author_id, content) VALUES ($1,$2,$3,$4) RETURNING id',
        [session.version_id, targetCourseId, req.user.id, JSON.stringify(content)]
      );
      syllabusId = created.rows[0].id;
    }

    await client.query('DELETE FROM clo_plo_map WHERE clo_id IN (SELECT id FROM course_clos WHERE version_course_id = $1)', [versionCourse.id]);
    await client.query('DELETE FROM course_clos WHERE version_course_id = $1', [versionCourse.id]);

    const ploCodeMap = new Map(context.versionPlos.map(plo => [String(plo.code).toUpperCase(), plo.id]));
    for (const clo of payload.clos || []) {
      const inserted = await client.query(
        'INSERT INTO course_clos (version_course_id, code, description) VALUES ($1,$2,$3) RETURNING id',
        [versionCourse.id, clo.code, clo.description]
      );
      const cloId = inserted.rows[0].id;
      if (String(clo.confidence || 'medium').toLowerCase() === 'low') {
        continue;
      }
      for (const ploCode of clo.plo_mapping || []) {
        const ploId = ploCodeMap.get(String(ploCode).toUpperCase());
        if (!ploId) continue;
        await client.query(
          'INSERT INTO clo_plo_map (clo_id, plo_id, contribution_level) VALUES ($1,$2,$3)',
          [cloId, ploId, 1]
        );
      }
    }

    const updatedSession = await client.query(
      `UPDATE syllabus_import_sessions
       SET review_payload = $1, validation_errors = $2, warnings = $3, status = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        JSON.stringify({
          ...payload,
          target: {
            course_id: targetCourseId,
            syllabus_id: syllabusId
          }
        }),
        JSON.stringify(validation.errors),
        JSON.stringify((payload.warnings || []).concat(validation.warnings.map(item => item.msg))),
        'completed',
        req.params.id
      ]
    );

    await client.query('COMMIT');
    console.info(`[syllabus-pdf-import] commit success session=${req.params.id} syllabus=${syllabusId} course=${targetCourseId}`);
    res.json({
      success: true,
      syllabusId,
      session: parseSyllabusImportSession(updatedSession.rows[0])
    });
  } catch (e) {
    if (startedTransaction) await client.query('ROLLBACK');
    console.warn(`[syllabus-pdf-import] commit failed session=${req.params.id}: ${e.message}`);
    res.status(e.statusCode || 400).json({ error: e.message });
  } finally {
    client.release();
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

    const current = await pool.query(`SELECT ${statusField} as status, id FROM ${table} WHERE id=$1`, [entity_id]);
    if (!current.rows.length) return res.status(404).json({ error: 'Not found' });
    if (current.rows[0].status !== 'draft') return res.status(400).json({ error: 'Chỉ có thể nộp bản nháp' });

    if (entity_type === 'program_version') {
      const admin = await isAdmin(req.user.id);
      if (!admin) {
        const deptRes = await pool.query(`
          SELECT p.department_id
          FROM program_versions pv
          JOIN programs p ON pv.program_id = p.id
          WHERE pv.id = $1
        `, [entity_id]);
        const deptId = deptRes.rows[0]?.department_id;
        const canSubmit = deptId ? await hasPermission(req.user.id, 'programs.submit', deptId) : false;
        if (!canSubmit) return res.status(403).json({ error: 'Không có quyền nộp CTĐT này' });
      }
    }

    if (entity_type === 'syllabus') {
      const admin = await isAdmin(req.user.id);
      if (!admin) {
        const assigned = await isUserAssignedToSyllabus(req.user.id, entity_id);
        const roles = await getUserRoles(req.user.id);
        const highestRole = roles[0];
        const isAssignedLecturer = highestRole && highestRole.level === 1 && assigned;
        if (!isAssignedLecturer) {
          const deptRes = await pool.query(`
            SELECT p.department_id
            FROM version_syllabi vs
            JOIN program_versions pv ON vs.version_id = pv.id
            JOIN programs p ON pv.program_id = p.id
            WHERE vs.id = $1
          `, [entity_id]);
          const deptId = deptRes.rows[0]?.department_id;
          const canSubmit = deptId ? await hasPermission(req.user.id, 'syllabus.submit', deptId) : false;
          if (!canSubmit) return res.status(403).json({ error: 'Không có quyền nộp đề cương này' });
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
      const resSyl = await pool.query('SELECT c.department_id FROM version_syllabi vs JOIN courses c ON vs.course_id = c.id WHERE vs.id = $1', [entity_id]);
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
      const has = entity_type === 'syllabus'
        ? await canReviewSyllabusAtCurrentStep(req.user.id, entity_id, status, requiredPerm)
        : await hasPermission(req.user.id, requiredPerm, deptId);
      if (!has) return res.status(403).json({ error: `Không có quyền thực hiện bước này (${requiredPerm})` });
    }

    if (action === 'reject') {
      // Reject returns the item to the previous workflow step by default.
      let nextState = target_status;
      if (!nextState) {
        if (entity_type === 'program_version') {
          const revFlow = { 'submitted': 'draft', 'approved_khoa': 'submitted', 'approved_pdt': 'approved_khoa' };
          nextState = revFlow[status] || 'draft';
        } else {
          const revFlow = {
            submitted: 'draft',
            approved_tbm: 'submitted',
            approved_khoa: 'approved_tbm',
            approved_pdt: 'approved_khoa'
          };
          nextState = revFlow[status] || 'draft';
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

    const isLocking = entity_type === 'program_version' && nextStatus === 'published';
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
    const userRoles = admin ? [] : await getUserRoles(req.user.id);
    // Get programs needing approval
    const programs = await pool.query(`
      SELECT pv.id, pv.academic_year, pv.status, pv.is_rejected, pv.rejection_reason,
             p.name as program_name, d.name as dept_name, p.department_id,
             'program_version' as entity_type
      FROM program_versions pv
      JOIN programs p ON pv.program_id = p.id
      JOIN departments d ON p.department_id = d.id
      WHERE pv.status IN ('submitted','approved_khoa','approved_pdt','published')
         OR COALESCE(pv.is_rejected, false) = true
      ORDER BY pv.updated_at DESC
    `);
    // Get syllabi needing approval
    const syllabi = await pool.query(`
      SELECT vs.id, vs.status, vs.is_rejected, vs.rejection_reason, c.code as course_code, c.name as course_name,
             c.department_id,
             (SELECT string_agg(u.display_name, ', ') 
              FROM syllabus_assignments sa 
              JOIN users u ON sa.user_id = u.id 
             WHERE sa.syllabus_id = vs.id) as author_name, 
             'syllabus' as entity_type
      FROM version_syllabi vs
      JOIN courses c ON vs.course_id = c.id
      WHERE vs.status IN ('submitted','approved_tbm','approved_khoa','approved_pdt','published')
         OR COALESCE(vs.is_rejected, false) = true
      ORDER BY vs.updated_at DESC
    `);

    if (admin) {
      const adminProgramPerms = new Set(['submitted', 'approved_khoa', 'approved_pdt']);
      const adminSyllabusPerms = new Set(['submitted', 'approved_tbm', 'approved_khoa', 'approved_pdt']);
      return res.json({
        programs: programs.rows.map(item => ({
          ...item,
          can_approve: !item.is_rejected && adminProgramPerms.has(item.status),
          display_status: item.is_rejected ? 'rejected' : item.status
        })),
        syllabi: syllabi.rows.map(item => ({
          ...item,
          can_approve: !item.is_rejected && adminSyllabusPerms.has(item.status),
          display_status: item.is_rejected ? 'rejected' : item.status
        }))
      });
    }

    const programPerms = {
      submitted: 'programs.approve_khoa',
      approved_khoa: 'programs.approve_pdt',
      approved_pdt: 'programs.approve_bgh'
    };
    const syllabusPerms = {
      submitted: 'syllabus.approve_tbm',
      approved_tbm: 'syllabus.approve_khoa',
      approved_khoa: 'syllabus.approve_pdt',
      approved_pdt: 'syllabus.approve_bgh'
    };

    const visiblePrograms = [];
    for (const item of programs.rows) {
      const requiredPerm = programPerms[item.status];
      const canApprove = requiredPerm && await hasPermission(req.user.id, requiredPerm, item.department_id);
      const canTrack = await canTrackProgramForUser(req.user.id, userRoles, item);
      if (canTrack) {
        visiblePrograms.push({
          ...item,
          can_approve: !!canApprove,
          display_status: item.is_rejected ? 'rejected' : item.status
        });
      }
    }

    const visibleSyllabi = [];
    for (const item of syllabi.rows) {
      const requiredPerm = syllabusPerms[item.status];
      const canApprove = requiredPerm
        ? await canReviewSyllabusAtCurrentStep(req.user.id, item.id, item.status, requiredPerm)
        : false;
      const canTrack = await canTrackSyllabusForUser(req.user.id, userRoles, item);
      if (canTrack) {
        visibleSyllabi.push({
          ...item,
          can_approve: !!canApprove,
          display_status: item.is_rejected ? 'rejected' : item.status
        });
      }
    }

    res.json({ programs: visiblePrograms, syllabi: visibleSyllabi });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============ DASHBOARD STATS ============
app.get('/api/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const canViewAuditLogs = await hasPermission(req.user.id, 'rbac.view_audit_logs');
    const [programs, versions, courses, syllabi, users, pending, depts, recentLogs] = await Promise.all([
      pool.query('SELECT COUNT(*) as c FROM programs'),
      pool.query("SELECT status, COUNT(*) as c FROM program_versions GROUP BY status"),
      pool.query('SELECT COUNT(*) as c FROM courses'),
      pool.query("SELECT status, COUNT(*) as c FROM version_syllabi GROUP BY status"),
      pool.query('SELECT COUNT(*) as c FROM users WHERE is_active=true'),
      pool.query("SELECT COUNT(*) as c FROM program_versions WHERE status IN ('submitted','approved_khoa','approved_pdt')"),
      pool.query("SELECT type, COUNT(*) as c FROM departments GROUP BY type"),
      canViewAuditLogs ? pool.query(`
        SELECT al.action, al.target, al.created_at, u.display_name
        FROM audit_logs al LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC LIMIT 15
      `) : Promise.resolve({ rows: [] }),
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
app.get('/api/audit-logs', authMiddleware, requirePerm('rbac.view_audit_logs'), async (req, res) => {
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

// ============ DOCX IMPORT SESSION API ============
app.post('/api/import/docx/session', authMiddleware, requirePerm('programs.import_word'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Hãy chọn file .docx' });
  try {
    const rawData = normalizeImportData(await docxParser.parseDocx(req.file.buffer));
    const result = await pool.query(
      'INSERT INTO docx_import_sessions (user_id, status, raw_data) VALUES ($1, $2, $3) RETURNING id',
      [req.user.id, 'processing', rawData]
    );
    res.json({ id: result.rows[0].id, rawData });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/import/docx/session/:id', authMiddleware, async (req, res) => {
  try {
    const session = await getImportSessionOrThrow(req.params.id);
    await assertImportSessionAccess(session, req.user);
    res.json({
      ...session,
      raw_data: normalizeImportData(session.raw_data)
    });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.put('/api/import/docx/session/:id', authMiddleware, async (req, res) => {
  const { raw_data } = req.body;
  try {
    const session = await getImportSessionOrThrow(req.params.id);
    await assertImportSessionAccess(session, req.user);
    const normalized = normalizeImportData(raw_data);
    const result = await pool.query(
      'UPDATE docx_import_sessions SET raw_data = $1 WHERE id = $2 RETURNING *',
      [normalized, req.params.id]
    );
    res.json({
      ...result.rows[0],
      raw_data: normalized
    });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.post('/api/import/docx/session/:id/validate', authMiddleware, async (req, res) => {
  try {
    const session = await getImportSessionOrThrow(req.params.id);
    await assertImportSessionAccess(session, req.user);

    const data = normalizeImportData(session.raw_data);
    const errors = [];
    const academicYearMatch = /^(\d{4})-(\d{4})$/.exec(data.academic_year || '');
    const totalCreditsMissing = data.total_credits === '' || data.total_credits === null || data.total_credits === undefined;

    if (!data.program_name) errors.push({ type: 'error', msg: 'Thiếu tên chương trình đào tạo.' });
    if (!data.program_code) errors.push({ type: 'error', msg: 'Thiếu mã chương trình đào tạo.' });
    if (!data.academic_year) errors.push({ type: 'error', msg: 'Thiếu năm học của phiên bản.' });
    if (!data.version_name) errors.push({ type: 'error', msg: 'Thiếu tên phiên bản.' });
    if (data.academic_year && !academicYearMatch) {
      errors.push({ type: 'error', msg: 'Năm học phải đúng định dạng YYYY-YYYY, ví dụ 2025-2026.' });
    }
    if (academicYearMatch && parseInt(academicYearMatch[2], 10) !== parseInt(academicYearMatch[1], 10) + 1) {
      errors.push({ type: 'error', msg: 'Năm học phải là 2 năm liên tiếp, ví dụ 2025-2026.' });
    }
    if (!data.degree) errors.push({ type: 'error', msg: 'Thiếu bậc đào tạo.' });
    if (totalCreditsMissing) {
      errors.push({ type: 'error', msg: 'Thiếu tổng tín chỉ.' });
    }
    if (!totalCreditsMissing && Number.isNaN(Number(data.total_credits))) {
      errors.push({ type: 'error', msg: 'Tổng tín chỉ phải là số hợp lệ.' });
    }

    if (data.program_code) {
      const existingProgramRes = await pool.query(
        'SELECT id, name, code FROM programs WHERE LOWER(TRIM(code)) = LOWER(TRIM($1)) LIMIT 1',
        [data.program_code]
      );

      if (existingProgramRes.rows.length > 0) {
        const existingProgram = existingProgramRes.rows[0];
        errors.push({
          type: 'error',
          msg: `Mã CTĐT "${data.program_code}" đã tồn tại trong hệ thống${existingProgram.name ? ` (${existingProgram.name})` : ''}.`
        });

        if (data.version_name || data.academic_year) {
          const versionDupRes = await pool.query(
            `SELECT version_name, academic_year
             FROM program_versions
             WHERE program_id = $1 AND (version_name = $2 OR academic_year = $3)`,
            [existingProgram.id, data.version_name || null, data.academic_year || null]
          );

          versionDupRes.rows.forEach(version => {
            if (data.version_name && version.version_name === data.version_name) {
              errors.push({
                type: 'error',
                msg: `Tên phiên bản "${data.version_name}" đã tồn tại cho CTĐT có mã "${data.program_code}".`
              });
            }
            if (data.academic_year && version.academic_year === data.academic_year) {
              errors.push({
                type: 'error',
                msg: `Năm học "${data.academic_year}" đã tồn tại cho CTĐT có mã "${data.program_code}".`
              });
            }
          });
        }
      }
    }
    if (!data.pos || data.pos.length === 0) errors.push({ type: 'warning', msg: 'Không tìm thấy Mục tiêu đào tạo (PO).' });
    if (!data.plos || data.plos.length === 0) errors.push({ type: 'warning', msg: 'Không tìm thấy Chuẩn đầu ra (PLO).' });

    const poIds = new Set((data.pos || []).map(po => po.id));
    const ploIds = new Set((data.plos || []).map(plo => plo.id));
    const courseIds = new Set((data.courses || []).map(course => course.id));
    const piIds = new Set((data.pis || []).map(pi => pi.id));

    (data.courses || []).forEach(c => {
      if (!c.course_code) errors.push({ type: 'error', msg: `Học phần "${c.course_name || 'Chưa rõ tên'}" thiếu mã học phần.` });
      if (!c.course_name) errors.push({ type: 'warning', msg: `Học phần "${c.course_code || 'Chưa rõ mã'}" thiếu tên học phần.` });
      if (!c.credits) errors.push({ type: 'warning', msg: `Học phần "${c.course_code || 'Chưa rõ mã'}" có số tín chỉ bằng 0.` });
    });

    (data.pis || []).forEach(pi => {
      if (!pi.plo_id || !ploIds.has(pi.plo_id)) {
        errors.push({ type: 'error', msg: `PI "${pi.pi_code || 'Chưa có mã'}" chưa gắn với PLO hợp lệ.` });
      }
    });

    (data.po_plo_map || []).forEach(mapping => {
      if (!poIds.has(mapping.po_id) || !ploIds.has(mapping.plo_id)) {
        errors.push({ type: 'error', msg: 'Ma trận PO ↔ PLO chứa liên kết không hợp lệ.' });
      }
    });

    (data.course_plo_map || []).forEach(mapping => {
      if (!courseIds.has(mapping.course_id) || !ploIds.has(mapping.plo_id)) {
        errors.push({ type: 'error', msg: 'Ma trận HP ↔ PLO chứa liên kết không hợp lệ.' });
      }
    });

    (data.course_pi_map || []).forEach(mapping => {
      if (!courseIds.has(mapping.course_id) || !piIds.has(mapping.pi_id)) {
        errors.push({ type: 'error', msg: 'Ma trận HP ↔ PI chứa liên kết không hợp lệ.' });
      }
    });

    await pool.query(
      'UPDATE docx_import_sessions SET raw_data = $1, validation_errors = $2, status = $3 WHERE id = $4',
      [data, JSON.stringify(errors), 'validated', req.params.id]
    );

    res.json({ success: true, errors, rawData: data });
  } catch (e) {
    res.status(e.statusCode || 500).json({ error: e.message });
  }
});

app.post('/api/import/docx/session/:id/commit', authMiddleware, requirePerm('programs.import_word'), async (req, res) => {
  const client = await pool.connect();
  let startedTransaction = false;
  try {
    const session = await getImportSessionOrThrow(req.params.id);
    await assertImportSessionAccess(session, req.user);
    const data = normalizeImportData(session.raw_data);
    const academicYearMatch = /^(\d{4})-(\d{4})$/.exec(data.academic_year || '');
    const totalCreditsMissing = data.total_credits === '' || data.total_credits === null || data.total_credits === undefined;
    const poIdMap = new Map();
    const ploIdMap = new Map();
    const courseIdMap = new Map();
    const piIdMap = new Map();

    if (!data.program_name || !data.program_code || !data.academic_year || !data.degree || !data.version_name || totalCreditsMissing) {
      throw new Error('Phiên import còn thiếu thông tin bắt buộc ở tab Thông tin.');
    }
    if (!academicYearMatch || parseInt(academicYearMatch[2], 10) !== parseInt(academicYearMatch[1], 10) + 1) {
      throw new Error('Năm học phải đúng định dạng 2 năm liên tiếp, ví dụ 2025-2026.');
    }
    if (Number.isNaN(Number(data.total_credits))) {
      throw new Error('Tổng tín chỉ phải là số hợp lệ.');
    }

    const existingProgramRes = await client.query(
      'SELECT id, name, code FROM programs WHERE LOWER(TRIM(code)) = LOWER(TRIM($1)) LIMIT 1',
      [data.program_code]
    );
    if (existingProgramRes.rows.length > 0) {
      const existingProgram = existingProgramRes.rows[0];
      throw new Error(`Mã CTĐT "${data.program_code}" đã tồn tại trong hệ thống${existingProgram.name ? ` (${existingProgram.name})` : ''}.`);
    }

    await client.query('BEGIN');
    startedTransaction = true;

    const progRes = await client.query(
      `INSERT INTO programs (name, code, department_id, degree, total_credits)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.program_name || 'Ngành học mới (Import)', data.program_code || 'IMPORT', 1, data.degree || 'Đại học', data.total_credits || 0]
    );
    const programId = progRes.rows[0].id;

    const verRes = await client.query(
      `INSERT INTO program_versions (program_id, academic_year, status, version_name, total_credits)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [programId, data.academic_year || '2025-2026', 'draft', data.version_name || 'Phiên bản Import', data.total_credits || 0]
    );
    const versionId = verRes.rows[0].id;

    if (data.pos && Array.isArray(data.pos)) {
      for (const po of data.pos) {
        const inserted = await client.query(
          'INSERT INTO version_objectives (version_id, code, description) VALUES ($1, $2, $3) RETURNING id',
          [versionId, po.code, po.description]);
        poIdMap.set(po.id, inserted.rows[0].id);
      }
    }

    if (data.plos && Array.isArray(data.plos)) {
      for (const plo of data.plos) {
        const inserted = await client.query(
          'INSERT INTO version_plos (version_id, code, bloom_level, description) VALUES ($1, $2, $3, $4) RETURNING id',
          [versionId, plo.code, plo.bloom_level || 3, plo.description]
        );
        ploIdMap.set(plo.id, inserted.rows[0].id);
      }
    }

    if (data.courses && Array.isArray(data.courses)) {
      for (const c of data.courses) {
        let courseId;
        const code = c.course_code;
        const name = c.course_name;
        if (!code) throw new Error(`Học phần "${name || 'Chưa rõ tên'}" thiếu mã học phần, không thể commit.`);

        const existing = await client.query('SELECT id FROM courses WHERE code = $1', [code]);
        if (existing.rows.length) {
          courseId = existing.rows[0].id;
        } else {
          const newCourse = await client.query(
            'INSERT INTO courses (code, name, credits) VALUES ($1, $2, $3) RETURNING id',
            [code, name || code, c.credits || 0]
          );
          courseId = newCourse.rows[0].id;
        }
        const inserted = await client.query(
          'INSERT INTO version_courses (version_id, course_id, semester, course_type) VALUES ($1, $2, $3, $4) RETURNING id',
          [versionId, courseId, c.semester || 1, c.course_type || 'required']);
        courseIdMap.set(c.id, inserted.rows[0].id);
      }
    }

    for (const pi of data.pis || []) {
      const realPloId = ploIdMap.get(pi.plo_id);
      if (!realPloId) continue;

      const insertedPi = await client.query(
        'INSERT INTO plo_pis (plo_id, pi_code, description) VALUES ($1, $2, $3) RETURNING id',
        [realPloId, pi.pi_code, pi.description]
      );
      const realPiId = insertedPi.rows[0].id;
      piIdMap.set(pi.id, realPiId);
    }

    const finalCoursePiMap = new Map();
    for (const mapping of data.course_pi_map || []) {
      if (mapping.contribution_level > 0) {
        finalCoursePiMap.set(`${mapping.pi_id}-${mapping.course_id}`, mapping.contribution_level);
      }
    }
    for (const pi of data.pis || []) {
      for (const tempCourseId of pi.course_ids || []) {
        const key = `${pi.id}-${tempCourseId}`;
        if (!finalCoursePiMap.has(key)) {
          finalCoursePiMap.set(key, 1);
        }
      }
    }

    const inferredCoursePloMap = new Map();
    for (const [key, level] of finalCoursePiMap.entries()) {
      const [piId, courseId] = key.split('-');
      const realPiId = piIdMap.get(piId);
      const realCourseId = courseIdMap.get(courseId);
      if (!realPiId || !realCourseId) continue;
      
      await client.query(
        'INSERT INTO version_pi_courses (version_id, pi_id, course_id, contribution_level) VALUES ($1, $2, $3, $4)',
        [versionId, realPiId, realCourseId, level]
      );

      const pi = (data.pis || []).find(p => `${p.id}` === piId);
      if (pi && pi.plo_id) {
        const ploKey = `${courseId}-${pi.plo_id}`;
        if (!inferredCoursePloMap.has(ploKey)) {
          inferredCoursePloMap.set(ploKey, 1);
        }
      }
    }

    for (const mapping of data.po_plo_map || []) {
      const realPoId = poIdMap.get(mapping.po_id);
      const realPloId = ploIdMap.get(mapping.plo_id);
      if (!realPoId || !realPloId) continue;
      await client.query(
        'INSERT INTO po_plo_map (version_id, po_id, plo_id) VALUES ($1, $2, $3)',
        [versionId, realPoId, realPloId]
      );
    }

    for (const mapping of data.course_plo_map || []) {
      if (mapping.contribution_level > 0) {
        inferredCoursePloMap.set(`${mapping.course_id}-${mapping.plo_id}`, mapping.contribution_level);
      }
    }

    for (const [key, level] of inferredCoursePloMap.entries()) {
      const [courseId, ploId] = key.split('-');
      const realCourseId = courseIdMap.get(courseId);
      const realPloId = ploIdMap.get(ploId);
      if (!realCourseId || !realPloId) continue;
      await client.query(
        'INSERT INTO course_plo_map (version_id, course_id, plo_id, contribution_level) VALUES ($1, $2, $3, $4)',
        [versionId, realCourseId, realPloId, level]
      );
    }


    await client.query('UPDATE docx_import_sessions SET raw_data = $1, status = $2 WHERE id = $3', [data, 'completed', req.params.id]);
    await client.query('COMMIT');

    res.json({ success: true, versionId });
  } catch (e) {
    if (startedTransaction) await client.query('ROLLBACK');
    res.status(e.statusCode || 500).json({ error: e.message });
  } finally {
    client.release();
  }
});

// ============ EXPORT ============
app.get('/api/export/version/:vId', authMiddleware, requireViewVersion, requirePerm('programs.export'), async (req, res) => {
  try {
    const vId = req.params.vId;
    const [version, pos, plos, vCourses, poploMap, cploMap, assessments, syllabi] = await Promise.all([
      pool.query(`SELECT pv.*, p.name as program_name, p.code as program_code, p.degree, p.total_credits, d.name as dept_name
        FROM program_versions pv JOIN programs p ON pv.program_id=p.id JOIN departments d ON p.department_id=d.id WHERE pv.id=$1`, [vId]),
      pool.query('SELECT * FROM version_objectives WHERE version_id=$1 ORDER BY code', [vId]),
      pool.query(`SELECT vp.*, (SELECT json_agg(json_build_object('id',pi.id,'code',pi.pi_code,'description',pi.description)) FROM plo_pis pi WHERE pi.plo_id=vp.id) as pis FROM version_plos vp WHERE vp.version_id=$1 ORDER BY code`, [vId]),
      pool.query(`SELECT vc.*, c.code as course_code, c.name as course_name, c.credits, c.description as course_desc, d.name as dept_name
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
