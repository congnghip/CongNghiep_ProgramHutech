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
      ALTER TABLE teaching_plan ADD CONSTRAINT IF NOT EXISTS teaching_plan_vc_unique UNIQUE (version_course_id);

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

  // ── Seed sample CTDT data ──────────────────────────────────────────
  const hasProg = await client.query("SELECT id FROM programs WHERE code='7480201'");
  if (!hasProg.rows.length) {
    const kCNTT = await client.query("SELECT id FROM departments WHERE code='K.CNTT'");
    const deptId = kCNTT.rows[0]?.id || 1;

    // Program
    const prog = await client.query(
      `INSERT INTO programs (name, name_en, code, department_id, degree, total_credits, institution, degree_name, training_mode)
       VALUES ('Công nghệ thông tin', 'Information Technology', '7480201', $1, 'Đại học', 130, 'Trường Đại học Công nghệ TP.HCM', 'Cử nhân Công nghệ thông tin', 'Chính quy')
       RETURNING id`, [deptId]
    );
    const progId = prog.rows[0].id;

    // Version
    const ver = await client.query(
      `INSERT INTO program_versions (program_id, academic_year, version_name, status, total_credits, training_duration,
         general_objective, grading_scale, graduation_requirements, job_positions, further_education, training_process)
       VALUES ($1, '2025-2026', 'CTĐT CNTT 2025-2026', 'draft', 130, '4 năm',
         'Đào tạo kỹ sư CNTT có năng lực chuyên môn, tư duy sáng tạo, đạo đức nghề nghiệp, đáp ứng nhu cầu xã hội và hội nhập quốc tế.',
         'Thang điểm 10 quy đổi sang thang 4 và xếp loại A/B/C/D/F',
         'Hoàn thành tối thiểu 130 TC, đạt chuẩn ngoại ngữ, không nợ học phí',
         'Lập trình viên, Kỹ sư phần mềm, Quản trị mạng, Chuyên viên CNTT, Tư vấn giải pháp CNTT',
         'Thạc sĩ CNTT, Thạc sĩ Khoa học máy tính, MBA chuyên ngành CNTT',
         'Đào tạo theo hệ thống tín chỉ, kết hợp lý thuyết và thực hành')
       RETURNING id`, [progId]
    );
    const verId = ver.rows[0].id;

    // POs
    const poData = [
      ['PO1', 'Vận dụng kiến thức nền tảng CNTT để phân tích, thiết kế và phát triển phần mềm'],
      ['PO2', 'Áp dụng quy trình phát triển phần mềm chuyên nghiệp và công nghệ hiện đại'],
      ['PO3', 'Có năng lực làm việc nhóm, giao tiếp hiệu quả và phát triển nghề nghiệp liên tục'],
    ];
    const poIds = {};
    for (const [code, desc] of poData) {
      const r = await client.query('INSERT INTO version_objectives (version_id, code, description) VALUES ($1,$2,$3) RETURNING id', [verId, code, desc]);
      poIds[code] = r.rows[0].id;
    }

    // PLOs
    const ploData = [
      ['PLO1', 3, 'Áp dụng kiến thức toán học, khoa học tự nhiên và CNTT vào giải quyết bài toán thực tế'],
      ['PLO2', 4, 'Phân tích yêu cầu, thiết kế kiến trúc và triển khai hệ thống phần mềm'],
      ['PLO3', 3, 'Lập trình thành thạo ít nhất 2 ngôn ngữ lập trình hiện đại'],
      ['PLO4', 4, 'Thiết kế và quản trị cơ sở dữ liệu quan hệ và NoSQL'],
      ['PLO5', 2, 'Làm việc nhóm hiệu quả, giao tiếp chuyên nghiệp bằng tiếng Việt và tiếng Anh'],
      ['PLO6', 5, 'Nghiên cứu, đánh giá và ứng dụng công nghệ mới vào dự án thực tế'],
    ];
    const ploIds = {};
    for (const [code, bloom, desc] of ploData) {
      const r = await client.query('INSERT INTO version_plos (version_id, code, bloom_level, description) VALUES ($1,$2,$3,$4) RETURNING id', [verId, code, bloom, desc]);
      ploIds[code] = r.rows[0].id;
    }

    // PIs
    const piData = [
      ['PLO1', 'PI1.1', 'Giải các bài toán tối ưu và xác suất thống kê trong CNTT'],
      ['PLO1', 'PI1.2', 'Áp dụng cấu trúc dữ liệu và giải thuật phù hợp cho bài toán'],
      ['PLO2', 'PI2.1', 'Phân tích yêu cầu chức năng và phi chức năng của hệ thống'],
      ['PLO2', 'PI2.2', 'Thiết kế kiến trúc hệ thống theo mô hình phân lớp'],
      ['PLO3', 'PI3.1', 'Viết mã nguồn sạch, có cấu trúc theo chuẩn coding convention'],
      ['PLO4', 'PI4.1', 'Thiết kế lược đồ CSDL chuẩn hóa đến 3NF'],
      ['PLO5', 'PI5.1', 'Trình bày ý tưởng kỹ thuật rõ ràng trước nhóm và khách hàng'],
      ['PLO6', 'PI6.1', 'Đánh giá ưu nhược điểm của công nghệ mới so với giải pháp hiện tại'],
    ];
    const piIds = {};
    for (const [ploCode, piCode, desc] of piData) {
      const r = await client.query('INSERT INTO plo_pis (plo_id, pi_code, description) VALUES ($1,$2,$3) RETURNING id', [ploIds[ploCode], piCode, desc]);
      piIds[piCode] = r.rows[0].id;
    }

    // PO-PLO map
    const poPloMap = [['PO1','PLO1'],['PO1','PLO2'],['PO1','PLO3'],['PO1','PLO4'],['PO2','PLO2'],['PO2','PLO3'],['PO2','PLO6'],['PO3','PLO5'],['PO3','PLO6']];
    for (const [po, plo] of poPloMap) {
      await client.query('INSERT INTO po_plo_map (version_id, po_id, plo_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING', [verId, poIds[po], ploIds[plo]]);
    }

    // Courses (with credit breakdown)
    const courseData = [
      ['IT001','Nhập môn lập trình',3,2,1,0,0,'Giới thiệu tư duy lập trình, cú pháp C/C++, cấu trúc điều khiển, hàm, mảng'],
      ['IT002','Cấu trúc dữ liệu và giải thuật',3,2,1,0,0,'Danh sách liên kết, ngăn xếp, hàng đợi, cây, đồ thị, sắp xếp, tìm kiếm'],
      ['IT003','Cơ sở dữ liệu',3,2,1,0,0,'Mô hình quan hệ, SQL, chuẩn hóa, transaction, thiết kế CSDL'],
      ['IT004','Lập trình hướng đối tượng',3,2,1,0,0,'OOP với Java: class, kế thừa, đa hình, interface, design pattern cơ bản'],
      ['IT005','Mạng máy tính',3,2,1,0,0,'Mô hình OSI/TCP-IP, định tuyến, giao thức mạng, bảo mật mạng cơ bản'],
      ['IT006','Công nghệ phần mềm',3,2,1,0,0,'Quy trình SDLC, Agile/Scrum, UML, kiểm thử phần mềm, quản lý dự án'],
      ['IT007','Phát triển ứng dụng Web',3,1,2,0,0,'HTML/CSS/JS, React/Vue, Node.js, REST API, triển khai ứng dụng web'],
      ['IT008','Trí tuệ nhân tạo',3,2,1,0,0,'Tìm kiếm, học máy, mạng nơ-ron, xử lý ngôn ngữ tự nhiên, ứng dụng AI'],
      ['IT009','Đồ án chuyên ngành',3,0,0,3,0,'Thực hiện dự án CNTT theo nhóm, áp dụng quy trình phát triển phần mềm'],
      ['IT010','Thực tập doanh nghiệp',3,0,0,0,3,'Thực tập tại doanh nghiệp CNTT, báo cáo kết quả thực tập'],
      ['GE001','Triết học Mác - Lênin',3,3,0,0,0,'Các nguyên lý cơ bản của chủ nghĩa Mác-Lênin về triết học'],
      ['GE002','Tiếng Anh 1',3,2,1,0,0,'Ngữ pháp, từ vựng, kỹ năng nghe-nói-đọc-viết trình độ A2-B1'],
      ['GE003','Toán cao cấp',3,3,0,0,0,'Đại số tuyến tính, giải tích, xác suất thống kê ứng dụng trong CNTT'],
      ['GE004','Vật lý đại cương',3,2,1,0,0,'Cơ học, điện từ, quang học — nền tảng cho kỹ thuật phần cứng'],
      ['IT011','An toàn thông tin',3,2,1,0,0,'Mã hóa, xác thực, bảo mật hệ thống, tấn công và phòng thủ mạng'],
      ['IT012','Điện toán đám mây',3,1,2,0,0,'AWS/Azure/GCP, container, microservices, CI/CD, serverless'],
    ];
    const courseIds = {};
    for (const [code,name,credits,lt,th,da,tt,desc] of courseData) {
      const r = await client.query(
        `INSERT INTO courses (code, name, credits, credits_theory, credits_practice, credits_project, credits_internship, department_id, description)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
        [code, name, credits, lt, th, da, tt, deptId, desc]
      );
      courseIds[code] = r.rows[0].id;
    }

    // Version courses (semester assignment)
    const vcData = [
      ['GE001',1,'required',null],['GE002',1,'required',null],['GE003',1,'required',null],['GE004',1,'required',null],
      ['IT001',1,'required',null],
      ['IT002',2,'required',null],['IT004',2,'required',null],
      ['IT003',3,'required',null],['IT005',3,'required',null],
      ['IT006',4,'required',null],['IT007',4,'required',null],
      ['IT008',5,'required',null],['IT011',5,'elective','An toàn & Đám mây'],['IT012',5,'elective','An toàn & Đám mây'],
      ['IT009',6,'required',null],
      ['IT010',7,'required',null],
    ];
    const vcIds = {};
    for (const [code,sem,type,group] of vcData) {
      const r = await client.query(
        `INSERT INTO version_courses (version_id, course_id, semester, course_type, elective_group) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [verId, courseIds[code], sem, type, group]
      );
      vcIds[code] = r.rows[0].id;
    }

    // Course-PLO map (contribution levels)
    const cploMap = [
      ['IT001','PLO1',2],['IT001','PLO3',3],
      ['IT002','PLO1',3],['IT002','PLO3',2],
      ['IT003','PLO4',3],['IT003','PLO2',2],
      ['IT004','PLO2',2],['IT004','PLO3',3],
      ['IT005','PLO1',1],['IT005','PLO2',2],
      ['IT006','PLO2',3],['IT006','PLO5',2],['IT006','PLO6',1],
      ['IT007','PLO2',2],['IT007','PLO3',3],['IT007','PLO6',2],
      ['IT008','PLO1',2],['IT008','PLO6',3],
      ['IT009','PLO2',3],['IT009','PLO5',2],['IT009','PLO6',2],
      ['IT010','PLO5',3],['IT010','PLO6',2],
    ];
    for (const [cc,plo,lvl] of cploMap) {
      if (vcIds[cc] && ploIds[plo]) {
        await client.query('INSERT INTO course_plo_map (version_id, course_id, plo_id, contribution_level) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [verId, vcIds[cc], ploIds[plo], lvl]);
      }
    }

    // Course-PI map
    const cpiMap = [
      ['IT001','PI1.2',2],['IT001','PI3.1',3],
      ['IT002','PI1.1',2],['IT002','PI1.2',3],
      ['IT003','PI4.1',3],['IT003','PI2.1',2],
      ['IT004','PI2.2',2],['IT004','PI3.1',3],
      ['IT006','PI2.1',3],['IT006','PI2.2',2],['IT006','PI5.1',2],
      ['IT007','PI2.2',2],['IT007','PI3.1',3],['IT007','PI6.1',2],
      ['IT008','PI1.2',2],['IT008','PI6.1',3],
    ];
    for (const [cc,pi,lvl] of cpiMap) {
      if (vcIds[cc] && piIds[pi]) {
        await client.query('INSERT INTO version_pi_courses (version_id, pi_id, course_id, contribution_level) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
          [verId, piIds[pi], vcIds[cc], lvl]);
      }
    }

    // Knowledge blocks
    const kbData = [
      ['Kiến thức giáo dục đại cương', null, 12, 12, 0],
      ['Lý luận chính trị', 'Kiến thức giáo dục đại cương', 3, 3, 0],
      ['Ngoại ngữ', 'Kiến thức giáo dục đại cương', 3, 3, 0],
      ['Toán & Khoa học tự nhiên', 'Kiến thức giáo dục đại cương', 6, 6, 0],
      ['Kiến thức giáo dục chuyên nghiệp', null, 48, 42, 6],
      ['Cơ sở ngành', 'Kiến thức giáo dục chuyên nghiệp', 15, 15, 0],
      ['Chuyên ngành', 'Kiến thức giáo dục chuyên nghiệp', 18, 12, 6],
      ['Thực tập & Đồ án', 'Kiến thức giáo dục chuyên nghiệp', 6, 6, 0],
    ];
    const kbIds = {};
    let kbOrder = 0;
    for (const [name, parent, total, req, elec] of kbData) {
      kbOrder++;
      const parentId = parent ? (kbIds[parent] || null) : null;
      const r = await client.query(
        'INSERT INTO knowledge_blocks (version_id, name, parent_id, total_credits, required_credits, elective_credits, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
        [verId, name, parentId, total, req, elec, kbOrder]
      );
      kbIds[name] = r.rows[0].id;
    }

    // Teaching plan
    const tpData = [
      ['IT001',45,30,15,0,0,null,'K.CNTT','A'],
      ['IT002',45,30,15,0,0,null,'K.CNTT','A'],
      ['IT003',45,30,15,0,0,'MySQL Workbench','K.CNTT','B'],
      ['IT004',45,30,15,0,0,'IntelliJ IDEA','K.CNTT','A'],
      ['IT005',45,30,15,0,0,'Cisco Packet Tracer','K.CNTT','B'],
      ['IT006',45,30,15,0,0,'Jira, Draw.io','K.CNTT','A'],
      ['IT007',45,15,30,0,0,'VS Code, Node.js','K.CNTT','B'],
      ['IT008',45,30,15,0,0,'Python, Jupyter','K.CNTT','A'],
      ['IT009',90,0,0,90,0,null,'K.CNTT','A'],
      ['IT010',135,0,0,0,135,null,'K.CNTT','B'],
    ];
    for (const [cc,total,lt,th,da,tt,sw,dept,batch] of tpData) {
      if (vcIds[cc]) {
        await client.query(
          'INSERT INTO teaching_plan (version_course_id, total_hours, hours_theory, hours_practice, hours_project, hours_internship, software, managing_dept, batch) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [vcIds[cc], total, lt, th, da, tt, sw, dept, batch]
        );
      }
    }

    // Assessment plans
    const assessData = [
      ['PLO1',null,'IT002','Bài kiểm tra cuối kỳ','Giải đúng bài toán CTDL','≥70% SV đạt từ 5/10','HK2','GV phụ trách'],
      ['PLO2',null,'IT006','Đồ án môn học','Thiết kế đúng quy trình UML','≥70% SV đạt yêu cầu','HK4','GV + Doanh nghiệp'],
      ['PLO3',null,'IT007','Bài tập thực hành','Chạy đúng chức năng web app','≥80% SV hoàn thành','HK4','GV phụ trách'],
      ['PLO4',null,'IT003','Bài kiểm tra cuối kỳ','Thiết kế CSDL chuẩn 3NF','≥70% SV đạt từ 5/10','HK3','GV phụ trách'],
      ['PLO5',null,'IT009','Báo cáo nhóm','Trình bày rõ ràng, logic','≥75% SV đạt','HK6','Hội đồng chấm'],
      ['PLO6',null,'IT008','Tiểu luận','Phân tích công nghệ AI mới','≥70% SV đạt','HK5','GV phụ trách'],
    ];
    for (const [ploCode, piId, cc, tool, criteria, threshold, sem, assessor] of assessData) {
      await client.query(
        `INSERT INTO assessment_plans (version_id, plo_id, sample_course_id, assessment_tool, criteria, threshold, semester, assessor)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [verId, ploIds[ploCode], courseIds[cc] || null, tool, criteria, threshold, sem, assessor]
      );
    }

    console.log('  ✅ Sample CTDT CNTT seeded (program + version + 16 courses + PO/PLO/PI + matrices + knowledge blocks + teaching plan + assessments)');
  }
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

module.exports = {
  pool, initDB,
  getUserPermissions, getUserRoles, hasPermission, isAdmin,
};
