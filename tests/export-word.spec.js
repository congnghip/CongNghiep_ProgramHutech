const path = require('path');
const JSZip = require('jszip');
const { test, expect } = require('@playwright/test');

const { exportVersionToDocx } = require('../word-exporter');

const baseUrl = process.env.HUTECH_TEST_BASE_URL || '';
const pageBaseUrl = process.env.HUTECH_TEST_BASE_URL || '/';

const fixture = {
  version: {
    program_name: 'Ngôn ngữ Trung Quốc Test',
    program_name_en: 'Chinese Language Test',
    program_code: '7220204T',
    degree: 'Đại học',
    degree_name: 'Cử nhân Ngôn ngữ Trung Quốc',
    dept_name: 'Khoa Trung Quốc học',
    total_credits: 125,
    program_total_credits: 125,
    training_mode: 'Chính quy',
    training_duration: '3.5 năm',
    institution: 'Trường Đại học Công nghệ TP.HCM',
    academic_year: '2026',
    general_objective: 'Đào tạo cử nhân có năng lực sử dụng tiếng Trung trong môi trường nghề nghiệp.',
    grading_scale: 'Theo quy chế hiện hành.',
    graduation_requirements: 'Hoàn thành chương trình đào tạo.',
    job_positions: 'Biên phiên dịch viên.',
    further_education: 'Có thể học sau đại học.',
    reference_programs: 'Chương trình tham khảo.',
    training_process: 'Theo quy trình đào tạo của Trường.',
    admission_targets: 'Tốt nghiệp THPT.',
    admission_criteria: 'Theo đề án tuyển sinh.',
  },
  objectives: [
    { code: 'PO1', description: 'Ứng dụng kiến thức nền tảng vào thực tiễn.' },
    { code: 'PO2', description: 'Sử dụng tiếng Trung hiệu quả.' },
  ],
  plos: [
    { id: 1, code: 'PLO1', description: 'Vận dụng kiến thức cơ bản.', bloom_level: 3, pis: [{ id: 1, code: 'PI.1.1', pi_code: 'PI.1.1', description: 'Nhận biết vấn đề chuyên môn.' }] },
    { id: 2, code: 'PLO2', description: 'Sử dụng kỹ năng ngôn ngữ.', bloom_level: 4, pis: [{ id: 2, code: 'PI.2.1', pi_code: 'PI.2.1', description: 'Thực hiện giao tiếp tiếng Trung.' }] },
  ],
  courses: [
    {
      id: 10,
      course_id: 100,
      course_code: 'CHN107',
      course_name: 'Tiếng Trung - Nghe 1',
      credits: 3,
      credits_theory: 3,
      credits_practice: 0,
      credits_project: 0,
      credits_internship: 0,
      semester: 1,
      course_type: 'required',
      elective_group: null,
      prerequisite_codes: [],
      corequisite_codes: [],
      knowledge_block_name: 'Kiến thức giáo dục chuyên nghiệp',
      course_desc: 'Học phần rèn luyện kỹ năng nghe tiếng Trung cơ bản.',
      total_hours: 45,
      hours_theory: 45,
      hours_practice: 0,
      hours_project: 0,
      hours_internship: 0,
      software: '',
      managing_dept: 'K.TQH',
      batch: 'A',
      notes: '',
    },
  ],
  knowledgeBlocks: [
    { id: 1, name: 'Kiến thức giáo dục chuyên nghiệp', parent_id: null, level: 1, total_credits: 81, required_credits: 72, elective_credits: 9, sort_order: 1 },
  ],
  poploMap: [{ po_code: 'PO1', plo_code: 'PLO1' }],
  coursePloMap: [{ course_code: 'CHN107', plo_code: 'PLO1', contribution_level: 2 }],
  coursePiMap: [{ course_code: 'CHN107', pi_code: 'PI.1.1', contribution_level: 2 }],
  assessments: [
    {
      plo_code: 'PLO1',
      pi_code: 'PI.1.1',
      criteria: 'Nhận biết vấn đề chuyên môn.',
      contributing_course_codes: 'CHN107',
      course_code: 'CHN107',
      direct_evidence: 'Bài kiểm tra',
      assessment_tool: 'Rubric',
      threshold: 'Tối thiểu 70%',
      expected_result: 'Đạt',
      semester: 'HK1 / năm 1',
      assessor: 'Giảng viên phụ trách',
      dept_code: 'K.TQH',
    },
  ],
  syllabi: [],
};

test('exportVersionToDocx creates a valid docx with replaced CTDT data', async () => {
  const buffer = await exportVersionToDocx(fixture, {
    templatePath: path.resolve(__dirname, '../mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx'),
  });

  expect(Buffer.isBuffer(buffer)).toBe(true);
  expect(buffer.length).toBeGreaterThan(1000);

  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');

  expect(documentXml).toContain('Ngôn ngữ Trung Quốc Test');
  expect(documentXml).toContain('7220204T');
  expect(documentXml).toContain('PO1');
  expect(documentXml).toContain('PLO1');
  expect(documentXml).toContain('CHN107');
});

async function loginRequest(request) {
  const response = await request.post(`${baseUrl}/api/auth/login`, {
    data: { username: 'admin', password: 'admin123' },
  });
  expect(response.ok()).toBe(true);
}

test('DOCX export route returns a downloadable Word document', async ({ request }) => {
  await loginRequest(request);

  const programsResponse = await request.get(`${baseUrl}/api/programs`);
  expect(programsResponse.ok()).toBe(true);
  const programs = await programsResponse.json();
  const programWithVersions = programs.find(program => Number(program.version_count || 0) > 0) || programs[0];
  expect(programWithVersions).toBeTruthy();

  const versionsResponse = await request.get(`${baseUrl}/api/programs/${programWithVersions.id}/versions`);
  expect(versionsResponse.ok()).toBe(true);
  const versions = await versionsResponse.json();
  expect(versions.length).toBeGreaterThan(0);

  const response = await request.get(`${baseUrl}/api/export/version/${versions[0].id}/docx`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  expect(response.headers()['content-disposition']).toContain('.docx');

  const buffer = await response.body();
  expect(buffer.length).toBeGreaterThan(1000);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml').async('string');
  const documentText = documentXml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  expect(documentText.length).toBeGreaterThan(1000);
  expect(documentText).toContain('CHƯƠNG TRÌNH ĐÀO TẠO');
});

async function loginPage(page, username = 'admin', password = 'admin123') {
  await page.context().clearCookies();
  await page.goto(pageBaseUrl);
  await page.locator('#login-user').fill(username);
  await page.locator('#login-pass').fill(password);
  await page.locator('#login-form button[type="submit"]').click();
  await page.locator('.sidebar').waitFor({ state: 'visible', timeout: 10000 });
  await page.waitForFunction(() => !document.querySelector('#page-content .spinner'), null, { timeout: 10000 });
}

test('version editor exposes DOCX export download action', async ({ page }) => {
  await loginPage(page);
  const versionId = await page.evaluate(async () => {
    const programs = await fetch('/api/programs').then(response => response.json());
    const program = programs.find(item => Number(item.version_count || 0) > 0) || programs[0];
    const versions = await fetch(`/api/programs/${program.id}/versions`).then(response => response.json());
    return versions[0].id;
  });

  await page.evaluate(id => window.App.navigate('version-editor', { versionId: id }), versionId);
  await expect(page.locator('button', { hasText: 'Xuất DOCX' })).toBeVisible();
});

test('version editor refuses an HTML fallback when exporting DOCX', async ({ page }) => {
  await loginPage(page);
  const versionId = await page.evaluate(async () => {
    const programs = await fetch('/api/programs').then(response => response.json());
    const program = programs.find(item => Number(item.version_count || 0) > 0) || programs[0];
    const versions = await fetch(`/api/programs/${program.id}/versions`).then(response => response.json());
    return versions[0].id;
  });

  await page.route('**/api/export/version/*/docx', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/html; charset=UTF-8',
      body: '<!doctype html><html><body>SPA fallback</body></html>',
    });
  });

  await page.evaluate(id => window.App.navigate('version-editor', { versionId: id }), versionId);
  const downloadPromise = page.waitForEvent('download', { timeout: 1000 }).then(() => true).catch(() => false);
  await page.locator('button', { hasText: 'Xuất DOCX' }).click();

  await expect(page.locator('.toast-error').first()).toContainText('Không thể xuất DOCX', { timeout: 5000 });
  expect(await downloadPromise).toBe(false);
});
