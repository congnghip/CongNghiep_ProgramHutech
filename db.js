// HUTECH Program — Database Layer
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5434'),
  database: process.env.DB_NAME || 'program_db',
  user: process.env.DB_USER || 'program',
  password: process.env.DB_PASS || 'program123',
});

// ============ SCHEMA ============
async function initDB() {
  const client = await pool.connect();
  try {
    await client.query(`
      -- Departments (tree structure)
      CREATE TABLE IF NOT EXISTS departments (
        id SERIAL PRIMARY KEY,
        parent_id INT REFERENCES departments(id),
        code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(200) NOT NULL,
        type VARCHAR(20) NOT NULL DEFAULT 'KHOA',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Users
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(200) NOT NULL,
        email VARCHAR(200),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Roles (6 roles)
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        code VARCHAR(30) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        level INT NOT NULL DEFAULT 1,
        is_system BOOLEAN DEFAULT true
      );

      -- Permissions (36 permissions)
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        code VARCHAR(60) UNIQUE NOT NULL,
        module VARCHAR(30) NOT NULL,
        description VARCHAR(200)
      );

      -- Role-Permission mapping
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_id INT REFERENCES roles(id) ON DELETE CASCADE,
        permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
        PRIMARY KEY (role_id, permission_id)
      );

      -- User-Role mapping (department-scoped)
      CREATE TABLE IF NOT EXISTS user_roles (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        role_id INT REFERENCES roles(id) ON DELETE CASCADE,
        department_id INT REFERENCES departments(id) ON DELETE CASCADE,
        UNIQUE(user_id, role_id, department_id)
      );

      -- Programs (CTDT - ngành học)
      CREATE TABLE IF NOT EXISTS programs (
        id SERIAL PRIMARY KEY,
        department_id INT REFERENCES departments(id),
        name VARCHAR(300) NOT NULL,
        name_en VARCHAR(300),
        code VARCHAR(30),
        degree VARCHAR(50) DEFAULT 'Đại học',
        total_credits INT,
        institution VARCHAR(300),
        degree_name VARCHAR(300),
        training_mode VARCHAR(100),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      -- Program Versions (phiên bản theo năm học)
      CREATE TABLE IF NOT EXISTS program_versions (
        id SERIAL PRIMARY KEY,
        program_id INT REFERENCES programs(id) ON DELETE CASCADE,
        academic_year VARCHAR(20) NOT NULL,
        version_name VARCHAR(300),
        status VARCHAR(30) DEFAULT 'draft',
        is_locked BOOLEAN DEFAULT false,
        copied_from_id INT REFERENCES program_versions(id),
        completion_pct INT DEFAULT 0,
        total_credits INT,
        training_duration VARCHAR(50),
        change_type VARCHAR(50),
        effective_date DATE,
        change_summary TEXT,
        grading_scale TEXT,
        graduation_requirements TEXT,
        job_positions TEXT,
        further_education TEXT,
        reference_programs TEXT,
        training_process TEXT,
        admission_targets TEXT,
        admission_criteria TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        is_rejected BOOLEAN DEFAULT false,
        rejection_reason TEXT,
        general_objective TEXT,
        UNIQUE(program_id, academic_year)
      );
      -- Version Objectives (PO)
      CREATE TABLE IF NOT EXISTS version_objectives (
        id SERIAL PRIMARY KEY,
        version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
        code VARCHAR(20) NOT NULL,
        description TEXT
      );

      -- Version PLOs
      CREATE TABLE IF NOT EXISTS version_plos (
        id SERIAL PRIMARY KEY,
        version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
        code VARCHAR(20) NOT NULL,
        bloom_level INT DEFAULT 1,
        description TEXT
      );

      -- PLO Performance Indicators (PI)
      CREATE TABLE IF NOT EXISTS plo_pis (
        id SERIAL PRIMARY KEY,
        plo_id INT REFERENCES version_plos(id) ON DELETE CASCADE,
        pi_code VARCHAR(20) NOT NULL,
        description TEXT
      );

      -- Courses (master list)
      CREATE TABLE IF NOT EXISTS courses (
        id SERIAL PRIMARY KEY,
        code VARCHAR(20) UNIQUE NOT NULL,
        name VARCHAR(300) NOT NULL,
        credits INT DEFAULT 3,
        credits_theory INT DEFAULT 0,
        credits_practice INT DEFAULT 0,
        credits_project INT DEFAULT 0,
        credits_internship INT DEFAULT 0,
        department_id INT REFERENCES departments(id),
        description TEXT
      );

      -- Version Courses (HP in CTDT version)
      CREATE TABLE IF NOT EXISTS version_courses (
        id SERIAL PRIMARY KEY,
        version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
        course_id INT REFERENCES courses(id) ON DELETE CASCADE,
        semester INT,
        course_type VARCHAR(20) DEFAULT 'required',
        prerequisite_course_ids INT[],
        corequisite_course_ids INT[],
        elective_group VARCHAR(100)
      );

      -- PI to Courses Map
      CREATE TABLE IF NOT EXISTS version_pi_courses (
        id SERIAL PRIMARY KEY,
        version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
        pi_id INT REFERENCES plo_pis(id) ON DELETE CASCADE,
        course_id INT REFERENCES version_courses(id) ON DELETE CASCADE,
        contribution_level INT DEFAULT 0,
        UNIQUE(pi_id, course_id)
      );

      -- PO-PLO Map
      CREATE TABLE IF NOT EXISTS po_plo_map (
        version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
        po_id INT REFERENCES version_objectives(id) ON DELETE CASCADE,
        plo_id INT REFERENCES version_plos(id) ON DELETE CASCADE,
        PRIMARY KEY (po_id, plo_id)
      );

      -- Course-PLO Map
      CREATE TABLE IF NOT EXISTS course_plo_map (
        version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
        course_id INT REFERENCES version_courses(id) ON DELETE CASCADE,
        plo_id INT REFERENCES version_plos(id) ON DELETE CASCADE,
        contribution_level INT DEFAULT 0,
        PRIMARY KEY (course_id, plo_id)
      );

      -- Course CLOs
      CREATE TABLE IF NOT EXISTS course_clos (
        id SERIAL PRIMARY KEY,
        version_course_id INT REFERENCES version_courses(id) ON DELETE CASCADE,
        code VARCHAR(20),
        description TEXT
      );

      -- CLO-PLO Map
      CREATE TABLE IF NOT EXISTS clo_plo_map (
        clo_id INT REFERENCES course_clos(id) ON DELETE CASCADE,
        plo_id INT REFERENCES version_plos(id) ON DELETE CASCADE,
        contribution_level INT DEFAULT 1,
        PRIMARY KEY (clo_id, plo_id)
      );

      -- Version Syllabi (đề cương)
      CREATE TABLE IF NOT EXISTS version_syllabi (
        id SERIAL PRIMARY KEY,
        version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
        course_id INT REFERENCES courses(id),
        author_id INT REFERENCES users(id),
        status VARCHAR(30) DEFAULT 'draft',
        content JSONB DEFAULT '{}',
        is_rejected BOOLEAN DEFAULT false,
        rejection_reason TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Syllabus Assignments (phân công GV soạn đề cương)
      CREATE TABLE IF NOT EXISTS syllabus_assignments (
        id SERIAL PRIMARY KEY,
        version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
        course_id INT REFERENCES courses(id) ON DELETE CASCADE,
        assigned_to INT REFERENCES users(id),
        assigned_by INT REFERENCES users(id),
        assigner_role_level INT DEFAULT 1,
        deadline DATE,
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(version_id, course_id)
      );
      CREATE INDEX IF NOT EXISTS idx_sa_assigned_to ON syllabus_assignments(assigned_to);
      CREATE INDEX IF NOT EXISTS idx_sa_version ON syllabus_assignments(version_id);

      -- Assessment Plans
      CREATE TABLE IF NOT EXISTS assessment_plans (
        id SERIAL PRIMARY KEY,
        version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
        plo_id INT REFERENCES version_plos(id) ON DELETE CASCADE,
        pi_id INT REFERENCES plo_pis(id),
        sample_course_id INT REFERENCES courses(id),
        assessment_tool VARCHAR(200),
        criteria VARCHAR(200),
        threshold VARCHAR(200),
        semester VARCHAR(30),
        assessor VARCHAR(200),
        dept_code VARCHAR(20),
        direct_evidence VARCHAR(200),
        expected_result VARCHAR(200),
        contributing_course_codes TEXT
      );

      -- Approval Logs
      CREATE TABLE IF NOT EXISTS approval_logs (
        id SERIAL PRIMARY KEY,
        entity_type VARCHAR(30) NOT NULL,
        entity_id INT NOT NULL,
        step VARCHAR(30) NOT NULL,
        action VARCHAR(20) NOT NULL,
        reviewer_id INT REFERENCES users(id),
        notes TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Notifications (approval and syllabus assignment inbox)
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        body TEXT,
        entity_type VARCHAR(50),
        entity_id INT,
        link_page VARCHAR(80),
        link_params JSONB DEFAULT '{}',
        dedupe_key VARCHAR(200),
        is_read BOOLEAN DEFAULT false,
        read_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_dedupe ON notifications(user_id, dedupe_key);

      -- Knowledge blocks (curriculum structure)
      CREATE TABLE IF NOT EXISTS knowledge_blocks (
        id SERIAL PRIMARY KEY,
        version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        parent_id INT REFERENCES knowledge_blocks(id) ON DELETE CASCADE,
        total_credits INT DEFAULT 0,
        required_credits INT DEFAULT 0,
        elective_credits INT DEFAULT 0,
        sort_order INT DEFAULT 0
      );

      ALTER TABLE knowledge_blocks ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;

      ALTER TABLE version_courses ADD COLUMN IF NOT EXISTS knowledge_block_id INT REFERENCES knowledge_blocks(id) ON DELETE SET NULL;

      ALTER TABLE programs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;

      -- Teaching plan (detailed per-semester schedule)
      CREATE TABLE IF NOT EXISTS teaching_plan (
        id SERIAL PRIMARY KEY,
        version_course_id INT REFERENCES version_courses(id) ON DELETE CASCADE,
        total_hours INT DEFAULT 0,
        hours_theory INT DEFAULT 0,
        hours_practice INT DEFAULT 0,
        hours_project INT DEFAULT 0,
        hours_internship INT DEFAULT 0,
        software VARCHAR(500),
        managing_dept VARCHAR(200),
        batch VARCHAR(10),
        notes TEXT
      );

      CREATE UNIQUE INDEX IF NOT EXISTS teaching_plan_vc_unique ON teaching_plan(version_course_id);

      -- Audit Logs
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INT,
        action VARCHAR(100),
        target VARCHAR(200),
        details TEXT,
        ip VARCHAR(50),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    console.log('  ✅ Database schema initialized');
    await seedData(client);
  } finally {
    client.release();
  }
}

// ============ SEED ============
async function seedData(client) {
  // Seed roles
  const roles = [
    { code: 'GIANG_VIEN', name: 'Giảng viên', level: 1 },
    { code: 'TRUONG_NGANH', name: 'Trưởng ngành / Trưởng BM', level: 2 },
    { code: 'LANH_DAO_KHOA', name: 'Lãnh đạo Khoa/Viện/TT', level: 3 },
    { code: 'PHONG_DAO_TAO', name: 'Phòng Đào tạo', level: 4 },
    { code: 'BAN_GIAM_HIEU', name: 'Ban Giám Hiệu', level: 5 },
    { code: 'ADMIN', name: 'Quản trị hệ thống', level: 99 },
  ];
  for (const r of roles) {
    await client.query(
      `INSERT INTO roles (code, name, level) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING`,
      [r.code, r.name, r.level]
    );
  }

  // Seed departments
  const depts = [
    { code: 'HUTECH', name: 'Trường Đại học Công nghệ TP.HCM', type: 'ROOT', parent: null },
    { code: 'BGH', name: 'Ban Giám Hiệu', type: 'PHONG', parent: 'HUTECH' },
    { code: 'PDT', name: 'Phòng Đào tạo', type: 'PHONG', parent: 'HUTECH' },
    { code: 'K.TQH', name: 'Khoa Trung Quốc học', type: 'KHOA', parent: 'HUTECH' },
    { code: 'K.CNTT', name: 'Khoa CNTT', type: 'KHOA', parent: 'HUTECH' },
    { code: 'K.TA', name: 'Khoa Tiếng Anh', type: 'KHOA', parent: 'HUTECH' },
    { code: 'K.QTKD', name: 'Khoa QTKD', type: 'KHOA', parent: 'HUTECH' },
    { code: 'K.LUAT', name: 'Khoa Luật', type: 'KHOA', parent: 'HUTECH' },
    { code: 'K.NBH', name: 'Khoa Nhật Bản học', type: 'KHOA', parent: 'HUTECH' },
    { code: 'VJIT', name: 'Viện CNTT Việt-Nhật', type: 'VIEN', parent: 'HUTECH' },
    { code: 'V.KHUD', name: 'Viện Khoa học ứng dụng', type: 'VIEN', parent: 'HUTECH' },
    { code: 'TT.GDTC', name: 'TT Giáo dục Thể chất', type: 'TRUNG_TAM', parent: 'HUTECH' },
    { code: 'TT.GDCT-QP', name: 'TT Giáo dục CT-QP', type: 'TRUNG_TAM', parent: 'HUTECH' },
    { code: 'TT.TH-NN-KN', name: 'TT Tin học-NN-KN', type: 'TRUNG_TAM', parent: 'HUTECH' },
    // Ngành (BO_MON) — đơn vị con của Khoa
    { code: 'N.CNPM', name: 'Ngành Công nghệ phần mềm', type: 'BO_MON', parent: 'K.CNTT' },
    { code: 'N.HTTT', name: 'Ngành Hệ thống thông tin', type: 'BO_MON', parent: 'K.CNTT' },
    { code: 'N.KTPM', name: 'Ngành Kỹ thuật phần mềm', type: 'BO_MON', parent: 'K.CNTT' },
    { code: 'N.TTNT', name: 'Ngành Trí tuệ nhân tạo', type: 'BO_MON', parent: 'K.CNTT' },
    { code: 'N.TMDT', name: 'Ngành Thương mại điện tử', type: 'BO_MON', parent: 'K.QTKD' },
    { code: 'N.QTKD-TH', name: 'Ngành Quản trị kinh doanh tổng hợp', type: 'BO_MON', parent: 'K.QTKD' },
    { code: 'N.TACN', name: 'Ngành Tiếng Anh chuyên ngành', type: 'BO_MON', parent: 'K.TA' },
    { code: 'N.TATM', name: 'Ngành Tiếng Anh thương mại', type: 'BO_MON', parent: 'K.TA' },
  ];
  for (const d of depts) {
    let parentId = null;
    if (d.parent) {
      const p = await client.query('SELECT id FROM departments WHERE code=$1', [d.parent]);
      if (p.rows.length) parentId = p.rows[0].id;
    }
    await client.query(
      `INSERT INTO departments (code, name, type, parent_id) VALUES ($1, $2, $3, $4) ON CONFLICT (code) DO NOTHING`,
      [d.code, d.name, d.type, parentId]
    );
  }

  // Seed permissions (25)
  // First, clear old plo permissions as requested by user to merge into CTDT edit
  await client.query("DELETE FROM permissions WHERE module = 'plo'");
  await client.query("DELETE FROM permissions WHERE module = 'rbac'");
  await client.query("DELETE FROM permissions WHERE module = 'programs_granular'");

  const perms = [
    // Programs (13)
    ['programs.view_published', 'programs', 'Xem CTĐT đã công bố'],
    ['programs.view_draft', 'programs', 'Xem CTĐT bản nháp'],
    ['programs.create', 'programs', 'Tạo mới CTĐT'],
    ['programs.edit', 'programs', 'Chỉnh sửa CTĐT'],
    ['programs.delete_draft', 'programs', 'Xóa CTĐT bản nháp'],
    ['programs.submit', 'programs', 'Nộp CTĐT để phê duyệt'],
    ['programs.approve_khoa', 'programs', 'Duyệt CTĐT cấp Khoa'],
    ['programs.approve_pdt', 'programs', 'Duyệt CTĐT cấp Phòng ĐT'],
    ['programs.approve_bgh', 'programs', 'Phê duyệt CTĐT cấp BGH'],
    ['programs.export', 'programs', 'Xuất báo cáo CTĐT'],
    ['programs.import_word', 'programs', 'Import CTĐT từ Word'],
    ['programs.manage_all', 'programs', 'Quản lý CTĐT toàn trường'],
    ['programs.create_version', 'programs', 'Tạo phiên bản CTĐT mới'],
    // Syllabus (9)
    ['syllabus.view', 'syllabus', 'Xem đề cương đã công bố'],
    ['syllabus.create', 'syllabus', 'Tạo đề cương'],
    ['syllabus.edit', 'syllabus', 'Chỉnh sửa đề cương'],
    ['syllabus.submit', 'syllabus', 'Nộp đề cương để phê duyệt'],
    ['syllabus.approve_tbm', 'syllabus', 'Duyệt cấp Trưởng BM'],
    ['syllabus.approve_khoa', 'syllabus', 'Duyệt cấp Trưởng Khoa'],
    ['syllabus.approve_pdt', 'syllabus', 'Duyệt cấp Phòng ĐT'],
    ['syllabus.approve_bgh', 'syllabus', 'Phê duyệt cấp BGH'],
    ['syllabus.assign', 'syllabus', 'Phân công GV soạn đề cương'],
    // Courses (3)
    ['courses.view', 'courses', 'Xem danh mục học phần'],
    ['courses.create', 'courses', 'Tạo học phần mới'],
    ['courses.edit', 'courses', 'Chỉnh sửa học phần'],
  ];
  for (const [code, module, desc] of perms) {
    await client.query(
      `INSERT INTO permissions (code, module, description) 
       VALUES ($1, $2, $3) 
       ON CONFLICT (code) DO UPDATE SET module=EXCLUDED.module, description=EXCLUDED.description`,
      [code, module, desc]
    );
  }

  // Role-Permission mapping (from RBAC analysis doc)
  const rolePerms = {
    GIANG_VIEN: ['programs.view_published', 'syllabus.view', 'syllabus.create', 'syllabus.edit', 'syllabus.submit', 'courses.view'],
    TRUONG_NGANH: ['programs.view_published', 'programs.view_draft', 'syllabus.view', 'syllabus.approve_tbm', 'syllabus.assign', 'courses.view'],
    LANH_DAO_KHOA: ['programs.view_published', 'programs.view_draft', 'programs.create', 'programs.edit', 'programs.delete_draft', 'programs.submit', 'programs.approve_khoa', 'programs.export', 'programs.import_word', 'syllabus.view', 'syllabus.create', 'syllabus.edit', 'syllabus.submit', 'syllabus.approve_khoa', 'syllabus.assign', 'courses.view'],
    PHONG_DAO_TAO: ['programs.view_published', 'programs.view_draft', 'programs.create', 'programs.edit', 'programs.delete_draft', 'programs.approve_pdt', 'programs.export', 'programs.import_word', 'programs.manage_all', 'programs.create_version', 'syllabus.view', 'syllabus.create', 'syllabus.edit', 'syllabus.approve_pdt', 'syllabus.assign', 'courses.view', 'courses.create', 'courses.edit'],
    BAN_GIAM_HIEU: ['programs.view_published', 'programs.view_draft', 'programs.approve_bgh', 'programs.export', 'syllabus.view', 'syllabus.approve_bgh', 'syllabus.assign', 'courses.view'],
    ADMIN: ['programs.view_published', 'programs.view_draft', 'programs.delete_draft', 'programs.manage_all', 'programs.create_version', 'syllabus.view', 'courses.view'],
  };

  for (const [roleCode, permCodes] of Object.entries(rolePerms)) {
    const roleRes = await client.query('SELECT id FROM roles WHERE code=$1', [roleCode]);
    if (!roleRes.rows.length) continue;
    const roleId = roleRes.rows[0].id;
    for (const pc of permCodes) {
      const permRes = await client.query('SELECT id FROM permissions WHERE code=$1', [pc]);
      if (!permRes.rows.length) continue;
      await client.query(
        `INSERT INTO role_permissions (role_id, permission_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [roleId, permRes.rows[0].id]
      );
    }
  }

  // Seed admin user
  const existing = await client.query('SELECT id FROM users WHERE username=$1', ['admin']);
  if (!existing.rows.length) {
    const hash = await bcrypt.hash('admin123', 10);
    const res = await client.query(
      `INSERT INTO users (username, password_hash, display_name) VALUES ('admin', $1, 'Quản trị viên') RETURNING id`,
      [hash]
    );
    // Assign ADMIN role at root department
    const rootDept = await client.query("SELECT id FROM departments WHERE code='HUTECH'");
    const adminRole = await client.query("SELECT id FROM roles WHERE code='ADMIN'");
    if (rootDept.rows.length && adminRole.rows.length) {
      await client.query(
        `INSERT INTO user_roles (user_id, role_id, department_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [res.rows[0].id, adminRole.rows[0].id, rootDept.rows[0].id]
      );
    }
    console.log('  ✅ Admin user created (admin/admin123)');
  } else {
    console.log('  ✅ Admin user exists');
  }

  await client.query(`
    INSERT INTO notifications
      (user_id, type, title, body, entity_type, entity_id, link_page, link_params, dedupe_key)
    SELECT
      oa.user_id,
      'assignment',
      'Bạn được phân công soạn đề cương',
      oa.course_code || ' - ' || oa.course_name || ' trong CTĐT ' || oa.program_name || ' (' || oa.academic_year || ').',
      'syllabus_assignment',
      oa.assignment_id,
      'my-assignments',
      jsonb_build_object('assignmentId', oa.assignment_id),
      'backfill:assignment:' || oa.assignment_id
    FROM (
      SELECT sa.id AS assignment_id,
             sa.assigned_to AS user_id,
             c.code AS course_code,
             c.name AS course_name,
             p.name AS program_name,
             pv.academic_year
      FROM syllabus_assignments sa
      JOIN users u ON u.id = sa.assigned_to AND u.is_active = true
      JOIN courses c ON sa.course_id = c.id
      JOIN program_versions pv ON sa.version_id = pv.id
      JOIN programs p ON pv.program_id = p.id
      LEFT JOIN version_syllabi vs ON vs.version_id = sa.version_id AND vs.course_id = sa.course_id
      WHERE pv.is_locked = false
        AND COALESCE(vs.status, 'draft') != 'published'
        AND NOT EXISTS (
          SELECT 1
          FROM notifications n
          WHERE n.user_id = sa.assigned_to
            AND n.type = 'assignment'
            AND n.entity_type = 'syllabus_assignment'
            AND n.entity_id = sa.id
        )
    ) oa
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
  `);

  await client.query(`
    INSERT INTO notifications
      (user_id, type, title, body, entity_type, entity_id, link_page, link_params, dedupe_key)
    WITH program_perm_map(status, perm_code) AS (
      VALUES
        ('submitted', 'programs.approve_khoa'),
        ('approved_khoa', 'programs.approve_pdt'),
        ('approved_pdt', 'programs.approve_bgh')
    ),
    pending_programs AS (
      SELECT pv.id, pv.status, pv.academic_year, p.name AS program_name, p.department_id
      FROM program_versions pv
      JOIN programs p ON pv.program_id = p.id
      WHERE pv.status IN ('submitted', 'approved_khoa', 'approved_pdt')
    )
    SELECT DISTINCT
      u.id,
      'approval_needed',
      'Có CTĐT cần phê duyệt',
      pp.program_name || ' (' || pp.academic_year || ') đang chờ bạn xử lý.',
      'program_version',
      pp.id,
      'version-editor',
      jsonb_build_object('versionId', pp.id),
      'backfill:approval:program_version:' || pp.id || ':' || pp.status
    FROM pending_programs pp
    JOIN program_perm_map ppm ON ppm.status = pp.status
    JOIN users u ON u.is_active = true
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    LEFT JOIN role_permissions rp ON ur.role_id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE (p.code = ppm.perm_code OR r.code = 'ADMIN')
      AND (
        r.level >= 4
        OR (
          pp.department_id IS NOT NULL
          AND (
            ur.department_id = pp.department_id
            OR ur.department_id = (SELECT parent_id FROM departments WHERE id = pp.department_id)
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM notifications n
        WHERE n.user_id = u.id
          AND n.type = 'approval_needed'
          AND n.entity_type = 'program_version'
          AND n.entity_id = pp.id
          AND (
            n.dedupe_key = 'backfill:approval:program_version:' || pp.id || ':' || pp.status
            OR n.dedupe_key LIKE 'approval:program_version:' || pp.id || ':' || pp.status || ':pending:%'
          )
      )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
  `);

  await client.query(`
    INSERT INTO notifications
      (user_id, type, title, body, entity_type, entity_id, link_page, link_params, dedupe_key)
    WITH syllabus_perm_map(status, perm_code) AS (
      VALUES
        ('submitted', 'syllabus.approve_tbm'),
        ('approved_tbm', 'syllabus.approve_khoa'),
        ('approved_khoa', 'syllabus.approve_pdt'),
        ('approved_pdt', 'syllabus.approve_bgh')
    ),
    pending_syllabi AS (
      SELECT vs.id, vs.status, c.code AS course_code, c.name AS course_name, p.department_id
      FROM version_syllabi vs
      JOIN courses c ON vs.course_id = c.id
      JOIN program_versions pv ON vs.version_id = pv.id
      JOIN programs p ON pv.program_id = p.id
      WHERE vs.status IN ('submitted', 'approved_tbm', 'approved_khoa', 'approved_pdt')
    )
    SELECT DISTINCT
      u.id,
      'approval_needed',
      'Có đề cương cần phê duyệt',
      ps.course_code || ' - ' || ps.course_name || ' đang chờ bạn xử lý.',
      'syllabus',
      ps.id,
      'syllabus-editor',
      jsonb_build_object('syllabusId', ps.id),
      'backfill:approval:syllabus:' || ps.id || ':' || ps.status
    FROM pending_syllabi ps
    JOIN syllabus_perm_map spm ON spm.status = ps.status
    JOIN users u ON u.is_active = true
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    LEFT JOIN role_permissions rp ON ur.role_id = rp.role_id
    LEFT JOIN permissions p ON rp.permission_id = p.id
    WHERE (p.code = spm.perm_code OR r.code = 'ADMIN')
      AND (
        r.level >= 4
        OR (
          ps.department_id IS NOT NULL
          AND (
            ur.department_id = ps.department_id
            OR ur.department_id = (SELECT parent_id FROM departments WHERE id = ps.department_id)
          )
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM notifications n
        WHERE n.user_id = u.id
          AND n.type = 'approval_needed'
          AND n.entity_type = 'syllabus'
          AND n.entity_id = ps.id
          AND (
            n.dedupe_key = 'backfill:approval:syllabus:' || ps.id || ':' || ps.status
            OR n.dedupe_key LIKE 'approval:syllabus:' || ps.id || ':' || ps.status || ':pending:%'
          )
      )
    ON CONFLICT (user_id, dedupe_key) DO NOTHING
  `);

}

// ============ RBAC HELPERS ============
async function getUserPermissions(userId) {
  const result = await pool.query(`
    SELECT DISTINCT p.code, p.module, ur.department_id, d.code as dept_code
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    JOIN departments d ON ur.department_id = d.id
    WHERE ur.user_id = $1
  `, [userId]);
  return result.rows;
}

async function getUserRoles(userId) {
  const result = await pool.query(`
    SELECT r.code as role_code, r.name as role_name, r.level,
           d.code as dept_code, d.name as dept_name, ur.department_id,
           pd.name as parent_dept_name
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    JOIN departments d ON ur.department_id = d.id
    LEFT JOIN departments pd ON d.parent_id = pd.id
    WHERE ur.user_id = $1
    ORDER BY r.level DESC
  `, [userId]);
  return result.rows;
}

async function hasPermission(userId, permCode, deptId = null) {
  if (deptId !== null) {
    // Check permission with hierarchical dept matching:
    // User assigned at Khoa level also has access to child departments (Ngành)
    const result = await pool.query(`
      SELECT 1 FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      JOIN roles r ON ur.role_id = r.id
      WHERE ur.user_id = $1 AND p.code = $2
        AND (r.level >= 4
             OR ur.department_id = $3
             OR ur.department_id = (SELECT parent_id FROM departments WHERE id = $3))
      LIMIT 1
    `, [userId, permCode, parseInt(deptId)]);
    return result.rows.length > 0;
  } else {
    // No dept context — check if user has this permission in ANY context
    const result = await pool.query(`
      SELECT 1 FROM user_roles ur
      JOIN role_permissions rp ON ur.role_id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE ur.user_id = $1 AND p.code = $2
      LIMIT 1
    `, [userId, permCode]);
    return result.rows.length > 0;
  }
}

// Check if user is ADMIN (bypass all)
async function isAdmin(userId) {
  const result = await pool.query(`
    SELECT 1 FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = $1 AND r.code = 'ADMIN'
  `, [userId]);
  return result.rows.length > 0;
}

// Get department IDs in scope for a given department + role level
// BO_MON (Ngành) depts also include parent Khoa (courses often live at Khoa level)
async function getDepartmentScope(departmentId, roleLevel) {
  if (roleLevel >= 4) return null; // null = no filtering (system-wide)
  const ids = [departmentId];
  // If dept is BO_MON (Ngành), include parent Khoa so courses at Khoa level are visible
  const dept = await pool.query(
    'SELECT type, parent_id FROM departments WHERE id = $1', [departmentId]
  );
  if (dept.rows.length && dept.rows[0].type === 'BO_MON' && dept.rows[0].parent_id) {
    ids.push(dept.rows[0].parent_id);
  }
  // Include child departments for level >= 2
  if (roleLevel >= 2) {
    const children = await pool.query(
      'SELECT id FROM departments WHERE parent_id = $1', [departmentId]
    );
    children.rows.forEach(r => ids.push(r.id));
  }
  return ids;
}

module.exports = {
  pool, initDB,
  getUserPermissions, getUserRoles, hasPermission, isAdmin, getDepartmentScope,
};
