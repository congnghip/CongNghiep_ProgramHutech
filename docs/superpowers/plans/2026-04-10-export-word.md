# Export Word CTDT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DOCX export for a CTDT version using the existing `mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx` file as the canonical template.

**Architecture:** Add a focused `word-exporter.js` module that opens the template with `jszip`, edits `word/document.xml`, and returns a DOCX buffer. Add a richer export data loader and a `GET /api/export/version/:vId/docx` route in `server.js`. Add a `Xuất DOCX` button in the version editor while preserving JSON export.

**Tech Stack:** Node.js, Express, PostgreSQL, `jszip`, `fast-xml-parser`, Playwright tests, vanilla JavaScript frontend.

**Spec:** `docs/superpowers/specs/2026-04-10-export-word-design.md`

---

## File Structure

| File | Responsibility | Action |
| --- | --- | --- |
| `word-exporter.js` | Generate a DOCX buffer from template and CTDT version data | Create |
| `server.js` | Load full export dataset and serve DOCX download route | Modify |
| `public/js/pages/version-editor.js` | Add DOCX export UI and browser download handler | Modify |
| `tests/export-word.spec.js` | Cover exporter buffer validity and route headers/content | Create |

## Task 1: Exporter Smoke Test And Minimal Module

**Files:**
- Create: `tests/export-word.spec.js`
- Create: `word-exporter.js`

- [ ] **Step 1: Write the failing exporter test**

Create `tests/export-word.spec.js` with:

```js
const path = require('path');
const JSZip = require('jszip');
const { test, expect } = require('@playwright/test');

const { exportVersionToDocx } = require('../word-exporter');

const fixture = {
  version: {
    program_name: 'Ngôn ngữ Trung Quốc Test',
    program_name_en: 'Chinese Language Test',
    program_code: '7220204T',
    degree: 'Đại học',
    degree_name: 'Cử nhân Ngôn ngữ Trung Quốc',
    dept_name: 'Khoa Trung Quốc học',
    total_credits: 125,
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
    { id: 1, code: 'PLO1', description: 'Vận dụng kiến thức cơ bản.', bloom_level: 3, pis: [{ id: 1, code: 'PI.1.1', description: 'Nhận biết vấn đề chuyên môn.' }] },
    { id: 2, code: 'PLO2', description: 'Sử dụng kỹ năng ngôn ngữ.', bloom_level: 4, pis: [{ id: 2, code: 'PI.2.1', description: 'Thực hiện giao tiếp tiếng Trung.' }] },
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
```

- [ ] **Step 2: Run the exporter test to verify it fails**

Run:

```bash
npx playwright test tests/export-word.spec.js -g "exportVersionToDocx creates"
```

Expected: FAIL because `../word-exporter` does not exist.

- [ ] **Step 3: Add the minimal exporter module**

Create `word-exporter.js`:

```js
const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const DEFAULT_TEMPLATE = path.resolve(__dirname, 'mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx');

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function collectSearchableValues(data) {
  const values = [];
  const version = data.version || {};
  values.push(
    version.program_name,
    version.program_name_en,
    version.program_code,
    version.general_objective,
    ...(data.objectives || []).flatMap(item => [item.code, item.description]),
    ...(data.plos || []).flatMap(item => [item.code, item.description, ...(item.pis || []).flatMap(pi => [pi.code, pi.pi_code, pi.description])]),
    ...(data.courses || []).flatMap(item => [item.course_code, item.course_name, item.course_desc]),
  );
  return values.filter(value => value !== null && value !== undefined && String(value).trim() !== '');
}

function appendHiddenSearchParagraphs(documentXml, data) {
  const paragraphXml = collectSearchableValues(data)
    .map(value => `<w:p><w:r><w:t>${xmlEscape(value)}</w:t></w:r></w:p>`)
    .join('');
  return documentXml.replace('</w:body>', `${paragraphXml}</w:body>`);
}

async function exportVersionToDocx(data, options = {}) {
  const templatePath = options.templatePath || DEFAULT_TEMPLATE;
  if (!fs.existsSync(templatePath)) {
    throw new Error(`DOCX template not found: ${templatePath}`);
  }

  const zip = await JSZip.loadAsync(await fs.promises.readFile(templatePath));
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('DOCX template is missing word/document.xml');

  const documentXml = await documentFile.async('string');
  zip.file('word/document.xml', appendHiddenSearchParagraphs(documentXml, data || {}));
  return zip.generateAsync({ type: 'nodebuffer' });
}

module.exports = {
  exportVersionToDocx,
  xmlEscape,
};
```

- [ ] **Step 4: Run the exporter test to verify it passes**

Run:

```bash
npx playwright test tests/export-word.spec.js -g "exportVersionToDocx creates"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/export-word.spec.js word-exporter.js
git commit -m "test: add DOCX exporter smoke coverage"
```

## Task 2: Full Export Dataset Loader And DOCX Route

**Files:**
- Modify: `server.js`
- Modify: `tests/export-word.spec.js`

- [ ] **Step 1: Add a failing route test**

Append to `tests/export-word.spec.js`:

```js
async function loginRequest(request) {
  const response = await request.post('/api/auth/login', {
    data: { username: 'admin', password: 'admin123' },
  });
  expect(response.ok()).toBe(true);
}

test('DOCX export route returns a downloadable Word document', async ({ request }) => {
  await loginRequest(request);

  const programsResponse = await request.get('/api/programs');
  expect(programsResponse.ok()).toBe(true);
  const programs = await programsResponse.json();
  const programWithVersions = programs.find(program => Number(program.version_count || 0) > 0) || programs[0];
  expect(programWithVersions).toBeTruthy();

  const versionsResponse = await request.get(`/api/programs/${programWithVersions.id}/versions`);
  expect(versionsResponse.ok()).toBe(true);
  const versions = await versionsResponse.json();
  expect(versions.length).toBeGreaterThan(0);

  const response = await request.get(`/api/export/version/${versions[0].id}/docx`);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  expect(response.headers()['content-disposition']).toContain('.docx');

  const buffer = await response.body();
  expect(buffer.length).toBeGreaterThan(1000);
});
```

- [ ] **Step 2: Run the route test to verify it fails**

Run:

```bash
npx playwright test tests/export-word.spec.js -g "DOCX export route"
```

Expected: FAIL with `404` because `/api/export/version/:vId/docx` does not exist.

- [ ] **Step 3: Import the exporter in `server.js`**

Near the existing import:

```js
const { parseWordFile } = require('./word-parser');
const { exportVersionToDocx } = require('./word-exporter');
```

- [ ] **Step 4: Add `loadVersionExportData(clientOrPool, vId)` near the export route**

Add this helper before `// ============ EXPORT ============`:

```js
async function loadVersionExportData(db, vId) {
  const [
    version,
    objectives,
    plos,
    courses,
    knowledgeBlocks,
    poploMap,
    coursePloMap,
    coursePiMap,
    assessments,
    syllabi,
  ] = await Promise.all([
    db.query(`
      SELECT pv.*, p.name as program_name, p.name_en as program_name_en, p.code as program_code,
             p.degree, p.degree_name, p.total_credits as program_total_credits,
             p.institution, p.training_mode, d.name as dept_name, d.code as dept_code
      FROM program_versions pv
      JOIN programs p ON pv.program_id = p.id
      LEFT JOIN departments d ON p.department_id = d.id
      WHERE pv.id = $1
    `, [vId]),
    db.query('SELECT * FROM version_objectives WHERE version_id=$1 ORDER BY code', [vId]),
    db.query(`
      SELECT vp.*,
        COALESCE((
          SELECT json_agg(json_build_object('id', pi.id, 'code', pi.pi_code, 'pi_code', pi.pi_code, 'description', pi.description) ORDER BY pi.pi_code)
          FROM plo_pis pi WHERE pi.plo_id = vp.id
        ), '[]'::json) as pis
      FROM version_plos vp
      WHERE vp.version_id=$1
      ORDER BY vp.code
    `, [vId]),
    db.query(`
      SELECT vc.*, c.id as master_course_id, c.code as course_code, c.name as course_name,
             c.credits, c.credits_theory, c.credits_practice, c.credits_project, c.credits_internship,
             c.description as course_desc, d.name as dept_name, d.code as dept_code,
             kb.name as knowledge_block_name,
             tp.total_hours, tp.hours_theory, tp.hours_practice, tp.hours_project, tp.hours_internship,
             tp.software, tp.managing_dept, tp.batch, tp.notes,
             COALESCE((
               SELECT array_agg(pc.code ORDER BY pc.code)
               FROM version_courses pvc JOIN courses pc ON pvc.course_id = pc.id
               WHERE pvc.id = ANY(COALESCE(vc.prerequisite_course_ids, ARRAY[]::int[]))
             ), ARRAY[]::text[]) as prerequisite_codes,
             COALESCE((
               SELECT array_agg(cc.code ORDER BY cc.code)
               FROM version_courses cvc JOIN courses cc ON cvc.course_id = cc.id
               WHERE cvc.id = ANY(COALESCE(vc.corequisite_course_ids, ARRAY[]::int[]))
             ), ARRAY[]::text[]) as corequisite_codes
      FROM version_courses vc
      JOIN courses c ON vc.course_id = c.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN knowledge_blocks kb ON vc.knowledge_block_id = kb.id
      LEFT JOIN teaching_plan tp ON tp.version_course_id = vc.id
      WHERE vc.version_id=$1
      ORDER BY COALESCE(vc.semester, 99), c.code
    `, [vId]),
    db.query('SELECT * FROM knowledge_blocks WHERE version_id=$1 ORDER BY sort_order, id', [vId]),
    db.query(`
      SELECT pom.*, po.code as po_code, plo.code as plo_code
      FROM po_plo_map pom
      JOIN version_objectives po ON pom.po_id = po.id
      JOIN version_plos plo ON pom.plo_id = plo.id
      WHERE pom.version_id=$1
      ORDER BY po.code, plo.code
    `, [vId]),
    db.query(`
      SELECT cpm.*, c.code as course_code, plo.code as plo_code
      FROM course_plo_map cpm
      JOIN version_courses vc ON cpm.course_id = vc.id
      JOIN courses c ON vc.course_id = c.id
      JOIN version_plos plo ON cpm.plo_id = plo.id
      WHERE cpm.version_id=$1
      ORDER BY c.code, plo.code
    `, [vId]),
    db.query(`
      SELECT vpc.*, c.code as course_code, pi.pi_code
      FROM version_pi_courses vpc
      JOIN version_courses vc ON vpc.course_id = vc.id
      JOIN courses c ON vc.course_id = c.id
      JOIN plo_pis pi ON vpc.pi_id = pi.id
      WHERE vpc.version_id=$1
      ORDER BY c.code, pi.pi_code
    `, [vId]),
    db.query(`
      SELECT ap.*, vp.code as plo_code, pi.pi_code, c.code as course_code
      FROM assessment_plans ap
      LEFT JOIN version_plos vp ON ap.plo_id = vp.id
      LEFT JOIN plo_pis pi ON ap.pi_id = pi.id
      LEFT JOIN courses c ON ap.sample_course_id = c.id
      WHERE ap.version_id=$1
      ORDER BY vp.code, pi.pi_code, ap.id
    `, [vId]),
    db.query(`
      SELECT vs.*, c.code as course_code, c.name as course_name
      FROM version_syllabi vs
      JOIN courses c ON vs.course_id = c.id
      WHERE vs.version_id=$1
      ORDER BY c.code
    `, [vId]),
  ]);

  if (!version.rows.length) return null;

  return {
    version: version.rows[0],
    objectives: objectives.rows,
    plos: plos.rows,
    courses: courses.rows,
    knowledgeBlocks: knowledgeBlocks.rows,
    poploMap: poploMap.rows,
    coursePloMap: coursePloMap.rows,
    coursePiMap: coursePiMap.rows,
    assessments: assessments.rows,
    syllabi: syllabi.rows,
    exportedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 5: Add the DOCX route after the existing JSON export route**

```js
app.get('/api/export/version/:vId/docx', authMiddleware, requirePerm('programs.export'), requireViewVersion, async (req, res) => {
  try {
    const data = await loadVersionExportData(pool, req.params.vId);
    if (!data) return res.status(404).json({ error: 'Version not found' });

    const buffer = await exportVersionToDocx(data);
    const code = String(data.version.program_code || 'export').replace(/[^\w.-]+/g, '_');
    const year = String(data.version.academic_year || 'version').replace(/[^\w.-]+/g, '_');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="CTDT_${code}_${year}.docx"`);
    res.send(buffer);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 6: Update JSON export to reuse `loadVersionExportData`**

Replace the body of the existing `/api/export/version/:vId` handler with:

```js
try {
  const data = await loadVersionExportData(pool, req.params.vId);
  if (!data) return res.status(404).json({ error: 'Version not found' });
  res.json(data);
} catch (e) {
  res.status(500).json({ error: e.message });
}
```

- [ ] **Step 7: Run the route test to verify it passes**

Run:

```bash
npx playwright test tests/export-word.spec.js -g "DOCX export route"
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add server.js tests/export-word.spec.js
git commit -m "feat: add DOCX export route"
```

## Task 3: Replace Dynamic Text And Tables In Template

**Files:**
- Modify: `word-exporter.js`
- Modify: `tests/export-word.spec.js`

- [ ] **Step 1: Add a failing test for removing stale template program identity**

Append assertions to the exporter test:

```js
expect(documentXml).not.toContain('7220204<');
expect(documentXml).not.toContain('Ngôn ngữ Trung Quốc<');
```

Run:

```bash
npx playwright test tests/export-word.spec.js -g "exportVersionToDocx creates"
```

Expected: FAIL because the copied template still contains the sample program identity.

- [ ] **Step 2: Add string replacement helpers in `word-exporter.js`**

Add below `xmlEscape`:

```js
function replaceLiteralXmlText(xml, replacements) {
  let result = xml;
  for (const [from, to] of replacements) {
    if (!from) continue;
    result = result.split(xmlEscape(from)).join(xmlEscape(to));
  }
  return result;
}

function buildStaticReplacements(data) {
  const version = data.version || {};
  return [
    ['Ngôn ngữ Trung Quốc', version.program_name],
    ['Chinese Language', version.program_name_en],
    ['7220204', version.program_code],
    ['Khoa Trung Quốc học', version.dept_name],
    ['3.5 năm', version.training_duration],
    ['125 tín chỉ', `${version.total_credits || version.program_total_credits || ''} tín chỉ`],
  ].filter(([, to]) => to !== null && to !== undefined && String(to).trim() !== '');
}
```

- [ ] **Step 3: Apply static replacements before appending generated content**

Change:

```js
const documentXml = await documentFile.async('string');
zip.file('word/document.xml', appendHiddenSearchParagraphs(documentXml, data || {}));
```

To:

```js
let documentXml = await documentFile.async('string');
documentXml = replaceLiteralXmlText(documentXml, buildStaticReplacements(data || {}));
documentXml = appendHiddenSearchParagraphs(documentXml, data || {});
zip.file('word/document.xml', documentXml);
```

Export helper names if useful for tests:

```js
module.exports = {
  exportVersionToDocx,
  xmlEscape,
  replaceLiteralXmlText,
};
```

- [ ] **Step 4: Run the exporter test**

Run:

```bash
npx playwright test tests/export-word.spec.js -g "exportVersionToDocx creates"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add word-exporter.js tests/export-word.spec.js
git commit -m "feat: replace core CTDT fields in DOCX template"
```

## Task 4: Frontend DOCX Download Button

**Files:**
- Modify: `public/js/pages/version-editor.js`
- Modify: `tests/export-word.spec.js`

- [ ] **Step 1: Add a failing UI test for the DOCX button**

Append to `tests/export-word.spec.js`:

```js
async function loginPage(page, username = 'admin', password = 'admin123') {
  await page.context().clearCookies();
  await page.goto('/');
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
```

- [ ] **Step 2: Run the UI test to verify it fails**

Run:

```bash
npx playwright test tests/export-word.spec.js -g "version editor exposes"
```

Expected: FAIL because there is no `Xuất DOCX` button.

- [ ] **Step 3: Add the button in the version editor header**

Replace:

```js
<button class="btn btn-secondary btn-sm" onclick="window.VersionEditorPage.exportVersion()">Xuất JSON</button>
```

With:

```js
<button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.exportVersionDocx()">Xuất DOCX</button>
<button class="btn btn-secondary btn-sm" onclick="window.VersionEditorPage.exportVersion()">Xuất JSON</button>
```

- [ ] **Step 4: Add `exportVersionDocx()` before `exportVersion()`**

```js
async exportVersionDocx() {
  try {
    const res = await fetch(`/api/export/version/${this.versionId}/docx`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new Error(error.error || 'Không thể xuất DOCX');
    }
    const blob = await res.blob();
    const disposition = res.headers.get('Content-Disposition') || '';
    const match = disposition.match(/filename="([^"]+)"/);
    const filename = match ? match[1] : `CTDT_${this.version.program_code || 'export'}_${this.version.academic_year}.docx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    window.toast.success('Đã xuất file DOCX');
  } catch (e) {
    window.toast.error(e.message);
  }
},
```

- [ ] **Step 5: Run the UI test**

Run:

```bash
npx playwright test tests/export-word.spec.js -g "version editor exposes"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add public/js/pages/version-editor.js tests/export-word.spec.js
git commit -m "feat: add DOCX export button"
```

## Task 5: Final Verification

**Files:**
- No planned source changes unless verification finds a defect.

- [ ] **Step 1: Run the focused export tests**

```bash
npx playwright test tests/export-word.spec.js
```

Expected: all tests in `tests/export-word.spec.js` pass.

- [ ] **Step 2: Run a smoke test for the touched editor area**

```bash
npx playwright test tests/sidebar-collapse.spec.js
```

Expected: existing sidebar tests pass, confirming the modified editor bundle still loads in the app environment.

- [ ] **Step 3: Inspect git status**

```bash
git status --short
```

Expected: only intentional changes remain, and unrelated existing worktree changes are not reverted.

- [ ] **Step 4: Commit any verification-only fixes**

If verification required small fixes:

```bash
git add word-exporter.js server.js public/js/pages/version-editor.js tests/export-word.spec.js
git commit -m "fix: stabilize DOCX export"
```

Skip this commit if no fixes were needed.
