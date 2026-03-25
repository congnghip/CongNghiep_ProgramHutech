const fs = require('fs');
const { Pool } = require('pg');

const BASE_URL = 'http://127.0.0.1:3600';
const pool = new Pool({
  host: '127.0.0.1',
  port: 5434,
  user: 'program',
  password: 'program123',
  database: 'program_db'
});

const prefix = `rbp${Date.now().toString().slice(-6)}`;
const state = {
  deptIds: {},
  userIds: {},
  cookies: {},
  createdProgramIds: [],
  createdCourseIds: [],
  createdDeptIds: [],
  createdRoleIds: [],
  createdUserIds: [],
  createdVersionIds: [],
  createdSyllabusIds: [],
  createdObjectiveIds: [],
  createdPloIds: [],
  createdAssessmentIds: [],
  tempIds: {}
};

function record(permission, ok, detail, meta = {}) {
  return { permission, ok, detail, ...meta };
}

async function login(username, password = 'admin123') {
  const res = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  const data = await res.json().catch(() => ({}));
  if (res.status !== 200) {
    throw new Error(`Login failed for ${username}: ${res.status} ${JSON.stringify(data)}`);
  }
  return res.headers.get('set-cookie')?.split(';')[0] || '';
}

async function request(cookie, method, path, body, extraHeaders = {}) {
  const headers = { ...extraHeaders, Cookie: cookie };
  let finalBody;
  if (body !== undefined) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    finalBody = headers['Content-Type'] === 'application/json' ? JSON.stringify(body) : body;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: finalBody
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

async function expectStatus(cookie, method, path, expectedStatus, body, detail) {
  const res = await request(cookie, method, path, body);
  if (res.status !== expectedStatus) {
    throw new Error(`${detail}: expected ${expectedStatus}, got ${res.status} -> ${JSON.stringify(res.data)}`);
  }
  return res;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function ensureAppReady() {
  const res = await fetch(`${BASE_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`App is not healthy: ${res.status}`);
  }
}

async function loadSeedContext() {
  const depts = await pool.query(`
    SELECT code, id, parent_id
    FROM departments
    WHERE code IN ('N.KTPM', 'K.CNTT', 'K.TA', 'HUTECH')
  `);
  for (const row of depts.rows) {
    state.deptIds[row.code] = row.id;
  }

  const users = await pool.query(`
    SELECT username, id
    FROM users
    WHERE username IN ('admin', 'gv_cntt', 'tn_cntt', 'lanhdaokhoa', 'phongdaotao', 'bangiamhieu')
  `);
  for (const row of users.rows) {
    state.userIds[row.username] = row.id;
  }

  for (const username of ['admin', 'gv_cntt', 'tn_cntt', 'lanhdaokhoa', 'phongdaotao', 'bangiamhieu']) {
    state.cookies[username] = await login(username);
  }
}

async function createTempUser(username, roleId = null, departmentId = null) {
  const adminHash = (await queryOne(`SELECT password_hash FROM users WHERE username = 'admin'`)).password_hash;
  const user = await queryOne(
    `INSERT INTO users (username, password_hash, display_name, is_active, department_id)
     VALUES ($1, $2, $3, true, $4)
     RETURNING id`,
    [username, adminHash, username, departmentId]
  );
  state.createdUserIds.push(user.id);
  if (roleId) {
    await pool.query(
      `INSERT INTO user_roles (user_id, role_id, department_id) VALUES ($1, $2, $3)`,
      [user.id, roleId, departmentId]
    );
  }
  state.cookies[username] = await login(username);
  return user.id;
}

async function createTempRole(code, level, permissionCodes) {
  const role = await queryOne(
    `INSERT INTO roles (code, name, level, is_system) VALUES ($1, $2, $3, false) RETURNING id`,
    [code, code, level]
  );
  state.createdRoleIds.push(role.id);

  for (const permissionCode of permissionCodes) {
    const perm = await queryOne(`SELECT id FROM permissions WHERE code = $1`, [permissionCode]);
    if (!perm) throw new Error(`Permission not found: ${permissionCode}`);
    await pool.query(`INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2)`, [role.id, perm.id]);
  }
  return role.id;
}

async function setupFixtures() {
  const deptId = state.deptIds['N.KTPM'];
  const authorId = state.userIds.gv_cntt;

  for (let i = 1; i <= 7; i++) {
    const course = await queryOne(
      `INSERT INTO courses (code, name, credits, department_id, description)
       VALUES ($1, $2, 3, $3, $4) RETURNING id`,
      [`${prefix.toUpperCase()}_C${i}`, `${prefix} course ${i}`, deptId, `${prefix} course ${i}`]
    );
    state.createdCourseIds.push(course.id);
    state.tempIds[`course${i}`] = course.id;
  }

  const program = await queryOne(
    `INSERT INTO programs (name, name_en, code, department_id, degree, total_credits, institution, degree_name, training_mode, notes)
     VALUES ($1, $2, $3, $4, 'Đại học', 120, 'HUTECH', 'Cu nhan', 'Chính quy', $5)
     RETURNING id`,
    [`${prefix} program`, `${prefix} program`, `${prefix.toUpperCase()}_P`, deptId, prefix]
  );
  state.createdProgramIds.push(program.id);
  state.tempIds.programId = program.id;

  const versionDefs = [
    ['published', '2090-2091'],
    ['draft', '2091-2092'],
    ['submitted', '2092-2093'],
    ['approved_khoa', '2093-2094'],
    ['approved_pdt', '2094-2095']
  ];

  for (const [status, academicYear] of versionDefs) {
    const version = await queryOne(
      `INSERT INTO program_versions (program_id, academic_year, status, version_name, total_credits, is_locked)
       VALUES ($1, $2, $3, $4, 120, false)
       RETURNING id`,
      [program.id, academicYear, status, `${prefix} ${status}`]
    );
    state.createdVersionIds.push(version.id);
    state.tempIds[`version_${status}`] = version.id;
  }

  const baseObjective = await queryOne(
    `INSERT INTO version_objectives (version_id, code, description)
     VALUES ($1, $2, $3) RETURNING id`,
    [state.tempIds.version_draft, `${prefix.toUpperCase()}_PO1`, 'Base PO']
  );
  state.createdObjectiveIds.push(baseObjective.id);
  state.tempIds.baseObjectiveId = baseObjective.id;

  const basePlo = await queryOne(
    `INSERT INTO version_plos (version_id, code, bloom_level, description)
     VALUES ($1, $2, 3, $3) RETURNING id`,
    [state.tempIds.version_draft, `${prefix.toUpperCase()}_PLO1`, 'Base PLO']
  );
  state.createdPloIds.push(basePlo.id);
  state.tempIds.basePloId = basePlo.id;

  for (const [versionKey, courseKey] of [
    ['version_published', 'course1'],
    ['version_draft', 'course2'],
    ['version_draft', 'course3'],
    ['version_draft', 'course4'],
    ['version_draft', 'course5'],
    ['version_draft', 'course6'],
    ['version_draft', 'course7']
  ]) {
    await pool.query(
      `INSERT INTO version_courses (version_id, course_id, semester, course_type)
       VALUES ($1, $2, 1, 'required')`,
      [state.tempIds[versionKey], state.tempIds[courseKey]]
    );
  }

  const syllabusDefs = [
    ['published', 'course1', 'published'],
    ['draft', 'course2', 'draft'],
    ['submitted', 'course4', 'submitted'],
    ['approved_tbm', 'course5', 'approved_tbm'],
    ['approved_khoa', 'course6', 'approved_khoa'],
    ['approved_pdt', 'course7', 'approved_pdt']
  ];

  for (const [name, courseKey, status] of syllabusDefs) {
    const syllabus = await queryOne(
      `INSERT INTO version_syllabi (version_id, course_id, author_id, status, content)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [
        name === 'published' ? state.tempIds.version_published : state.tempIds.version_draft,
        state.tempIds[courseKey],
        authorId,
        status,
        JSON.stringify({ title: `${prefix} ${name}` })
      ]
    );
    state.createdSyllabusIds.push(syllabus.id);
    state.tempIds[`syllabus_${name}`] = syllabus.id;
  }

  for (const syllabusId of [
    state.tempIds.syllabus_draft,
    state.tempIds.syllabus_submitted,
    state.tempIds.syllabus_approved_tbm,
    state.tempIds.syllabus_approved_khoa,
    state.tempIds.syllabus_approved_pdt
  ]) {
    await pool.query(
      `INSERT INTO syllabus_assignments (syllabus_id, user_id) VALUES ($1, $2)`,
      [syllabusId, authorId]
    );
  }
}

async function cleanup() {
  if (state.createdUserIds.length) {
    await pool.query(`DELETE FROM approval_logs WHERE reviewer_id = ANY($1::int[])`, [state.createdUserIds]);
    await pool.query(`DELETE FROM audit_logs WHERE user_id = ANY($1::int[])`, [state.createdUserIds]);
    await pool.query(`DELETE FROM user_roles WHERE user_id = ANY($1::int[])`, [state.createdUserIds]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1::int[])`, [state.createdUserIds]);
  }
  if (state.createdRoleIds.length) {
    await pool.query(`DELETE FROM role_permissions WHERE role_id = ANY($1::int[])`, [state.createdRoleIds]);
    await pool.query(`DELETE FROM roles WHERE id = ANY($1::int[])`, [state.createdRoleIds]);
  }
  if (state.createdDeptIds.length) {
    await pool.query(`DELETE FROM departments WHERE id = ANY($1::int[])`, [state.createdDeptIds]);
  }
  if (state.createdProgramIds.length) {
    await pool.query(`DELETE FROM programs WHERE id = ANY($1::int[])`, [state.createdProgramIds]);
  }
  if (state.createdCourseIds.length) {
    await pool.query(`DELETE FROM courses WHERE id = ANY($1::int[])`, [state.createdCourseIds]);
  }
}

async function main() {
  await ensureAppReady();
  await loadSeedContext();
  await setupFixtures();

  const results = [];
  const admin = state.cookies.admin;
  const gv = state.cookies.gv_cntt;
  const tn = state.cookies.tn_cntt;
  const ldk = state.cookies.lanhdaokhoa;
  const pdt = state.cookies.phongdaotao;
  const bgh = state.cookies.bangiamhieu;

  const createdProgram = await expectStatus(
    ldk,
    'POST',
    '/api/programs',
    200,
    {
      name: `${prefix} create program`,
      name_en: `${prefix} create program`,
      code: `${prefix.toUpperCase()}_CREATE`,
      department_id: state.deptIds['N.KTPM'],
      total_credits: 120
    },
    'programs.create'
  );
  state.createdProgramIds.push(createdProgram.data.id);

  const deletableProgram = await queryOne(
    `INSERT INTO programs (name, name_en, code, department_id, degree, total_credits)
     VALUES ($1, $2, $3, $4, 'Đại học', 120)
     RETURNING id`,
    [`${prefix} delete program`, `${prefix} delete program`, `${prefix.toUpperCase()}_DELETE`, state.deptIds['N.KTPM']]
  );
  state.createdProgramIds.push(deletableProgram.id);

  const submittedViaPermission = await queryOne(
    `INSERT INTO program_versions (program_id, academic_year, status, version_name, total_credits, is_locked)
     VALUES ($1, $2, 'draft', $3, 120, false)
     RETURNING id`,
    [state.tempIds.programId, '2095-2096', `${prefix} submit target`]
  );
  state.createdVersionIds.push(submittedViaPermission.id);

  const manageAllTarget = await queryOne(
    `INSERT INTO program_versions (program_id, academic_year, status, version_name, total_credits, is_locked)
     VALUES ($1, $2, 'draft', $3, 120, false)
     RETURNING id`,
    [state.tempIds.programId, '2097-2098', `${prefix} manage-all target`]
  );
  state.createdVersionIds.push(manageAllTarget.id);

  const noRoleUser = `${prefix}_norole`;
  await createTempUser(noRoleUser, null, state.deptIds['N.KTPM']);

  const manageAllRole = await createTempRole(`${prefix.toUpperCase()}_MANAGE_ALL`, 4, ['programs.manage_all']);
  const noManageAllRole = await createTempRole(`${prefix.toUpperCase()}_NO_MANAGE_ALL`, 4, []);
  const manageAllUser = `${prefix}_manageall`;
  const noManageAllUser = `${prefix}_nomanageall`;
  await createTempUser(manageAllUser, manageAllRole, state.deptIds['K.TA']);
  await createTempUser(noManageAllUser, noManageAllRole, state.deptIds['K.TA']);

  const run = async (permission, fn) => {
    try {
      const detail = await fn();
      results.push(record(permission, true, detail));
    } catch (error) {
      results.push(record(permission, false, error.message));
    }
  };

  await run('programs.view_published', async () => {
    await expectStatus(gv, 'GET', `/api/versions/${state.tempIds.version_published}`, 200, undefined, 'programs.view_published');
    return 'GV can view published version';
  });

  await run('programs.view_draft', async () => {
    await expectStatus(tn, 'GET', `/api/versions/${state.tempIds.version_draft}`, 200, undefined, 'programs.view_draft');
    return 'TN can view draft version';
  });

  await run('programs.create', async () => `Created program ${createdProgram.data.id}`);

  await run('programs.edit', async () => {
    await expectStatus(
      ldk,
      'PUT',
      `/api/programs/${createdProgram.data.id}`,
      200,
      { name: `${prefix} edited program` },
      'programs.edit'
    );
    return 'LDK can edit program';
  });

  await run('programs.delete_draft', async () => {
    await expectStatus(ldk, 'DELETE', `/api/programs/${deletableProgram.id}`, 200, undefined, 'programs.delete_draft');
    return 'LDK can delete draft program';
  });

  await run('programs.submit', async () => {
    await expectStatus(
      ldk,
      'POST',
      '/api/approval/submit',
      200,
      { entity_type: 'program_version', entity_id: submittedViaPermission.id },
      'programs.submit'
    );
    return 'LDK can submit draft version';
  });

  await run('programs.approve_khoa', async () => {
    await expectStatus(
      ldk,
      'POST',
      '/api/approval/review',
      200,
      { entity_type: 'program_version', entity_id: state.tempIds.version_submitted, action: 'approve', notes: 'ok' },
      'programs.approve_khoa'
    );
    return 'LDK can approve submitted version';
  });

  await run('programs.approve_pdt', async () => {
    await expectStatus(
      pdt,
      'POST',
      '/api/approval/review',
      200,
      { entity_type: 'program_version', entity_id: state.tempIds.version_approved_khoa, action: 'approve', notes: 'ok' },
      'programs.approve_pdt'
    );
    return 'PDT can approve approved_khoa version';
  });

  await run('programs.approve_bgh', async () => {
    await expectStatus(
      bgh,
      'POST',
      '/api/approval/review',
      200,
      { entity_type: 'program_version', entity_id: state.tempIds.version_approved_pdt, action: 'approve', notes: 'ok' },
      'programs.approve_bgh'
    );
    return 'BGH can approve approved_pdt version';
  });

  await run('programs.export', async () => {
    await expectStatus(ldk, 'GET', `/api/export/version/${state.tempIds.version_draft}`, 200, undefined, 'programs.export');
    return 'LDK can export version';
  });

  await run('programs.import_word', async () => {
    await expectStatus(ldk, 'POST', '/api/import/docx/session', 400, undefined, 'programs.import_word');
    return 'Import route passes permission and stops at file validation';
  });

  await run('programs.manage_all', async () => {
    const denyRes = await request(state.cookies[noManageAllUser], 'POST', '/api/approval/submit', { entity_type: 'program_version', entity_id: manageAllTarget.id });
    if (denyRes.status !== 403) {
      throw new Error(`Expected no-manage-all user to be denied, got ${denyRes.status}`);
    }
    const allowRes = await request(state.cookies[manageAllUser], 'POST', '/api/approval/submit', { entity_type: 'program_version', entity_id: manageAllTarget.id });
    if (allowRes.status !== 200) {
      throw new Error(`Expected manage-all user to pass permission gate, got ${allowRes.status}`);
    }
    return 'Level-4 role with only programs.manage_all passes program-scoped permission gate';
  });

  await run('programs.create_version', async () => {
    await expectStatus(
      pdt,
      'POST',
      `/api/programs/${state.tempIds.programId}/versions`,
      200,
      { academic_year: '2096-2097', version_name: `${prefix} extra version` },
      'programs.create_version'
    );
    return 'PDT can create program version';
  });

  await run('programs.po.edit', async () => {
    const res = await expectStatus(
      ldk,
      'POST',
      `/api/versions/${state.tempIds.version_draft}/objectives`,
      200,
      { code: `${prefix.toUpperCase()}_POX`, description: 'temp objective' },
      'programs.po.edit'
    );
    state.createdObjectiveIds.push(res.data.id);
    return 'LDK can create objective';
  });

  await run('programs.plo.edit', async () => {
    const res = await expectStatus(
      ldk,
      'POST',
      `/api/versions/${state.tempIds.version_draft}/plos`,
      200,
      { code: `${prefix.toUpperCase()}_PLOX`, bloom_level: 3, description: 'temp plo' },
      'programs.plo.edit'
    );
    state.createdPloIds.push(res.data.id);
    return 'LDK can create PLO';
  });

  await run('programs.courses.edit', async () => {
    await expectStatus(
      ldk,
      'POST',
      `/api/versions/${state.tempIds.version_draft}/courses`,
      200,
      { course_id: state.tempIds.course1, semester: 2, course_type: 'elective' },
      'programs.courses.edit'
    );
    return 'LDK can add version course';
  });

  await run('programs.matrix.edit', async () => {
    await expectStatus(
      ldk,
      'PUT',
      `/api/versions/${state.tempIds.version_draft}/po-plo-map`,
      200,
      { mappings: [{ po_id: state.tempIds.baseObjectiveId, plo_id: state.tempIds.basePloId }] },
      'programs.matrix.edit'
    );
    return 'LDK can update PO-PLO map';
  });

  await run('programs.assessment.edit', async () => {
    const res = await expectStatus(
      ldk,
      'POST',
      `/api/versions/${state.tempIds.version_draft}/assessments`,
      200,
      {
        plo_id: state.tempIds.basePloId,
        sample_course_id: state.tempIds.course2,
        assessment_tool: 'Rubric',
        criteria: 'Pass',
        threshold: '70%'
      },
      'programs.assessment.edit'
    );
    state.createdAssessmentIds.push(res.data.id);
    return 'LDK can create assessment plan';
  });

  await run('syllabus.view', async () => {
    await expectStatus(gv, 'GET', `/api/syllabi/${state.tempIds.syllabus_published}`, 200, undefined, 'syllabus.view');
    return 'GV can view published syllabus';
  });

  await run('syllabus.create', async () => {
    const res = await expectStatus(
      gv,
      'POST',
      `/api/versions/${state.tempIds.version_draft}/syllabi`,
      200,
      { course_id: state.tempIds.course3, content: { title: 'new syllabus' } },
      'syllabus.create'
    );
    state.createdSyllabusIds.push(res.data.id);
    return 'GV can create syllabus in draft version';
  });

  await run('syllabus.edit', async () => {
    await expectStatus(
      gv,
      'PUT',
      `/api/syllabi/${state.tempIds.syllabus_draft}`,
      200,
      { content: { title: 'edited syllabus' } },
      'syllabus.edit'
    );
    return 'Assigned GV can edit draft syllabus';
  });

  await run('syllabus.submit', async () => {
    await expectStatus(
      gv,
      'POST',
      '/api/approval/submit',
      200,
      { entity_type: 'syllabus', entity_id: state.tempIds.syllabus_draft },
      'syllabus.submit'
    );
    return 'Assigned GV can submit draft syllabus';
  });

  await run('syllabus.approve_tbm', async () => {
    await expectStatus(
      tn,
      'POST',
      '/api/approval/review',
      200,
      { entity_type: 'syllabus', entity_id: state.tempIds.syllabus_submitted, action: 'approve', notes: 'ok' },
      'syllabus.approve_tbm'
    );
    return 'TN can approve submitted syllabus';
  });

  await run('syllabus.approve_khoa', async () => {
    await expectStatus(
      ldk,
      'POST',
      '/api/approval/review',
      200,
      { entity_type: 'syllabus', entity_id: state.tempIds.syllabus_approved_tbm, action: 'approve', notes: 'ok' },
      'syllabus.approve_khoa'
    );
    return 'LDK can approve approved_tbm syllabus';
  });

  await run('syllabus.approve_pdt', async () => {
    await expectStatus(
      pdt,
      'POST',
      '/api/approval/review',
      200,
      { entity_type: 'syllabus', entity_id: state.tempIds.syllabus_approved_khoa, action: 'approve', notes: 'ok' },
      'syllabus.approve_pdt'
    );
    return 'PDT can approve approved_khoa syllabus';
  });

  await run('syllabus.approve_bgh', async () => {
    await expectStatus(
      bgh,
      'POST',
      '/api/approval/review',
      200,
      { entity_type: 'syllabus', entity_id: state.tempIds.syllabus_approved_pdt, action: 'approve', notes: 'ok' },
      'syllabus.approve_bgh'
    );
    return 'BGH can approve approved_pdt syllabus';
  });

  await run('syllabus.assign', async () => {
    await expectStatus(
      tn,
      'POST',
      '/api/assignments',
      200,
      { syllabus_id: state.tempIds.syllabus_submitted, user_ids: [state.userIds.gv_cntt] },
      'syllabus.assign'
    );
    return 'TN can assign lecturer within department scope';
  });

  await run('courses.view', async () => {
    await expectStatus(gv, 'GET', '/api/courses', 200, undefined, 'courses.view');
    return 'GV can view course catalog';
  });

  let courseForEditId = null;
  await run('courses.create', async () => {
    const res = await expectStatus(
      pdt,
      'POST',
      '/api/courses',
      200,
      {
        code: `${prefix.toUpperCase()}_MASTER`,
        name: `${prefix} master course`,
        credits: 3,
        department_id: state.deptIds['N.KTPM'],
        description: prefix
      },
      'courses.create'
    );
    courseForEditId = res.data.id;
    state.createdCourseIds.push(courseForEditId);
    return 'PDT can create master course';
  });

  await run('courses.edit', async () => {
    await expectStatus(
      pdt,
      'PUT',
      `/api/courses/${courseForEditId}`,
      200,
      { name: `${prefix} updated master course` },
      'courses.edit'
    );
    return 'PDT can edit master course';
  });

  await run('portfolio.own', async () => {
    const server = fs.readFileSync('server.js', 'utf8');
    const matrix = fs.readFileSync('docs/rbac-permission-matrix.md', 'utf8');
    if (server.includes('portfolio.own')) throw new Error('portfolio.own unexpectedly appears in live backend routes');
    if (!matrix.includes('| `portfolio.own`') || !matrix.includes('dormant')) throw new Error('portfolio.own is not documented as dormant');
    return 'Documented dormant, no live capability';
  });

  await run('portfolio.view_dept', async () => {
    const server = fs.readFileSync('server.js', 'utf8');
    const matrix = fs.readFileSync('docs/rbac-permission-matrix.md', 'utf8');
    if (server.includes('portfolio.view_dept')) throw new Error('portfolio.view_dept unexpectedly appears in live backend routes');
    if (!matrix.includes('| `portfolio.view_dept`') || !matrix.includes('dormant')) throw new Error('portfolio.view_dept is not documented as dormant');
    return 'Documented dormant, no live capability';
  });

  await run('rbac.manage_users', async () => {
    const res = await expectStatus(
      admin,
      'POST',
      '/api/users',
      200,
      {
        username: `${prefix}_api_user`,
        password: 'admin123',
        display_name: `${prefix} api user`,
        email: `${prefix}@example.com`,
        department_id: state.deptIds['N.KTPM']
      },
      'rbac.manage_users'
    );
    state.createdUserIds.push(res.data.id);
    return 'Admin can create user';
  });

  await run('rbac.manage_roles', async () => {
    const res = await expectStatus(
      admin,
      'POST',
      '/api/roles',
      200,
      { code: `${prefix.toUpperCase()}_API_ROLE`, name: `${prefix} API role`, level: 1 },
      'rbac.manage_roles'
    );
    state.createdRoleIds.push(res.data.id);
    return 'Admin can create role';
  });

  await run('rbac.manage_departments', async () => {
    const res = await expectStatus(
      admin,
      'POST',
      '/api/departments',
      200,
      { code: `${prefix.toUpperCase()}_DEPT`, name: `${prefix} dept`, type: 'NGANH', parent_id: state.deptIds['K.CNTT'] },
      'rbac.manage_departments'
    );
    state.createdDeptIds.push(res.data.id);
    return 'Admin can create department';
  });

  await run('rbac.view_audit_logs', async () => {
    await expectStatus(admin, 'GET', '/api/audit-logs', 200, undefined, 'rbac.view_audit_logs');
    return 'Admin can view audit logs';
  });

  await run('rbac.system_config', async () => {
    const server = fs.readFileSync('server.js', 'utf8');
    const matrix = fs.readFileSync('docs/rbac-permission-matrix.md', 'utf8');
    if (server.includes('rbac.system_config')) throw new Error('rbac.system_config unexpectedly appears in live backend routes');
    if (!matrix.includes('| `rbac.system_config`') || !matrix.includes('dormant')) throw new Error('rbac.system_config is not documented as dormant');
    return 'Documented dormant, no live capability';
  });

  const summary = {
    total: results.length,
    passed: results.filter(r => r.ok).length,
    failed: results.filter(r => !r.ok).length,
    results
  };

  console.log(JSON.stringify(summary, null, 2));
  if (summary.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ fatal: true, error: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } finally {
      await pool.end();
    }
  });
