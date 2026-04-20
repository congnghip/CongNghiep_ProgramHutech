# Base Syllabus Full Template — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện đề cương cơ bản đủ 17 mục theo mẫu BM03/QT2b/DBCL, có CLO↔PLO/PI mapping qua canonical version, và export PDF + DOCX.

**Architecture:**
- `db.js`: thêm 5 cột vào `courses`, tạo 2 bảng `base_clo_plo_map` + `base_clo_pi_map`.
- `server.js`: mở rộng PUT courses, 3 endpoint CLO mapping, 1 endpoint validate, 2 endpoint export (PDF/DOCX), 1 helper `buildRenderModel`.
- `public/js/pages/base-syllabus-editor.js`: mở rộng cả 5 tab + thêm nút export + dialog validate.
- `server/render/`: module mới gồm `render-model.js`, `pdf-template.ejs`, `docx-builder.js`.
- `Dockerfile`: thêm `chromium` system package cho Puppeteer.

**Tech Stack:** Node.js + Express + PostgreSQL 15, vanilla JS frontend. Dependencies mới: `puppeteer`, `docx`, `ejs`. Không có test framework → dùng smoke test script và manual browser verification.

**Spec:** [docs/superpowers/specs/2026-04-18-base-syllabus-full-template-design.md](../specs/2026-04-18-base-syllabus-full-template-design.md)

---

## File Structure

**Modify (4 files):**
- [db.js](../../../db.js) — ALTER courses (5 cột), CREATE 2 mapping tables.
- [server.js](../../../server.js) — PUT courses update, 3 mapping endpoints, 1 validate, 2 export, render helpers require.
- [public/js/pages/base-syllabus-editor.js](../../../public/js/pages/base-syllabus-editor.js) — 5 tab mở rộng, nút export, validate dialog.
- [Dockerfile](../../../Dockerfile) — thêm chromium package.

**Create (5 files):**
- `server/render/render-model.js` — build render model từ DB.
- `server/render/content-upgrade.js` — v2 → v3 lazy upgrader.
- `server/render/pdf-template.ejs` — HTML template cho Puppeteer.
- `server/render/docx-builder.js` — xây DOCX bằng thư viện `docx`.
- `scripts/smoke-base-syllabus.js` — smoke test toàn flow.

---

## Phase 1 — Schema & master API

## Task 1: Schema migrations in `db.js`

**Files:**
- Modify: [db.js](../../../db.js) — thêm ALTER TABLE cho `courses`, CREATE TABLE cho 2 mapping tables.

- [ ] **Step 1: Thêm ALTER TABLE cho `courses`**

Mở [db.js](../../../db.js), tìm block migration (section các `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` đã có sẵn). Thêm:

```sql
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS name_en VARCHAR(300);
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS knowledge_area VARCHAR(20);
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_requirement VARCHAR(20);
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS training_level VARCHAR(30) DEFAULT 'Đại học';
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS canonical_version_id INT REFERENCES program_versions(id) ON DELETE SET NULL;
```

- [ ] **Step 2: Thêm 2 mapping tables**

Trong cùng `initDB()`, ngay sau block `CREATE TABLE IF NOT EXISTS base_syllabus_clos` (dòng ~237), thêm:

```sql
      -- Base CLO → PLO mapping (FK to version_plos của canonical version)
      CREATE TABLE IF NOT EXISTS base_clo_plo_map (
        id SERIAL PRIMARY KEY,
        base_clo_id INT REFERENCES base_syllabus_clos(id) ON DELETE CASCADE,
        plo_id INT REFERENCES version_plos(id) ON DELETE CASCADE,
        UNIQUE(base_clo_id, plo_id)
      );
      CREATE INDEX IF NOT EXISTS idx_bc_plo_clo ON base_clo_plo_map(base_clo_id);

      -- Base CLO → PI mapping
      CREATE TABLE IF NOT EXISTS base_clo_pi_map (
        id SERIAL PRIMARY KEY,
        base_clo_id INT REFERENCES base_syllabus_clos(id) ON DELETE CASCADE,
        pi_id INT REFERENCES plo_pis(id) ON DELETE CASCADE,
        UNIQUE(base_clo_id, pi_id)
      );
      CREATE INDEX IF NOT EXISTS idx_bc_pi_clo ON base_clo_pi_map(base_clo_id);
```

- [ ] **Step 3: Verify syntax + restart**

```bash
node --check db.js
```
Expected: exit 0.

Restart dev server (`make dev` hoặc `docker compose restart app`), sau đó:

```bash
docker exec -i program-db psql -U program -d program_db -c "\d courses" | grep -E "name_en|knowledge_area|course_requirement|training_level|canonical_version_id"
docker exec -i program-db psql -U program -d program_db -c "\d base_clo_plo_map"
docker exec -i program-db psql -U program -d program_db -c "\d base_clo_pi_map"
```
Expected: cả 5 column `courses` + 2 table mới đều hiện ra.

- [ ] **Step 4: Commit**

```bash
git add db.js
git commit -m "feat(db): add master fields to courses + base CLO mapping tables"
```

---

## Task 2: Mở rộng `PUT /api/courses/:id`

**Files:**
- Modify: [server.js:1078-1090](../../../server.js#L1078-L1090) — chấp nhận 5 field mới.

- [ ] **Step 1: Sửa PUT route**

Thay [server.js:1078-1090](../../../server.js#L1078-L1090) bằng:

```javascript
app.put('/api/courses/:id', authMiddleware, requirePerm('courses.edit'), async (req, res) => {
  const {
    code, name, name_en, credits,
    credits_theory, credits_practice, credits_project, credits_internship,
    department_id, description,
    knowledge_area, course_requirement, training_level, canonical_version_id,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE courses SET
        code=COALESCE($1,code), name=COALESCE($2,name), name_en=COALESCE($3,name_en),
        credits=COALESCE($4,credits),
        credits_theory=COALESCE($5,credits_theory), credits_practice=COALESCE($6,credits_practice),
        credits_project=COALESCE($7,credits_project), credits_internship=COALESCE($8,credits_internship),
        department_id=COALESCE($9,department_id), description=COALESCE($10,description),
        knowledge_area=COALESCE($11,knowledge_area), course_requirement=COALESCE($12,course_requirement),
        training_level=COALESCE($13,training_level), canonical_version_id=COALESCE($14,canonical_version_id)
        WHERE id=$15 RETURNING *`,
      [code, name, name_en, credits,
        credits_theory, credits_practice, credits_project, credits_internship,
        department_id, description,
        knowledge_area, course_requirement, training_level, canonical_version_id,
        req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 2: Smoke test với curl**

Lấy 1 course_id bất kỳ (VD `3`) và 1 version_id thuộc khoa đó (VD `5`). Login lấy cookie token trước, sau đó:

```bash
curl -X PUT http://localhost:3600/api/courses/3 \
  -H "Content-Type: application/json" \
  -b "token=<TOKEN>" \
  -d '{"name_en":"Applied AI","knowledge_area":"general","course_requirement":"required","training_level":"Đại học","canonical_version_id":5}'
```
Expected: HTTP 200, JSON trả về có đủ 5 field mới.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(api): extend PUT /api/courses to accept 5 master fields"
```

---

## Phase 2 — CLO ↔ PLO/PI mapping endpoints

## Task 3: API mapping CLO → PLO/PI

**Files:**
- Modify: [server.js](../../../server.js) — thêm 2 endpoint sau block "BASE SYLLABUS CLOs" (~dòng 2540).

- [ ] **Step 1: Thêm GET mapping endpoint**

Ngay sau `app.delete('/api/base-clos/:id', ...)` (sau dòng 2539), thêm:

```javascript
// ============ BASE CLO MAPPINGS ============
app.get('/api/base-clos/:id/mappings', authMiddleware, requirePerm('courses.view'), async (req, res) => {
  try {
    const plos = await pool.query(
      'SELECT plo_id FROM base_clo_plo_map WHERE base_clo_id = $1', [req.params.id]
    );
    const pis = await pool.query(
      'SELECT pi_id FROM base_clo_pi_map WHERE base_clo_id = $1', [req.params.id]
    );
    res.json({
      plo_ids: plos.rows.map(r => r.plo_id),
      pi_ids: pis.rows.map(r => r.pi_id),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/base-clos/:id/mappings', authMiddleware, requirePerm('courses.edit'), async (req, res) => {
  const { plo_ids = [], pi_ids = [] } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM base_clo_plo_map WHERE base_clo_id = $1', [req.params.id]);
    await client.query('DELETE FROM base_clo_pi_map WHERE base_clo_id = $1', [req.params.id]);
    for (const ploId of plo_ids) {
      await client.query(
        'INSERT INTO base_clo_plo_map (base_clo_id, plo_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [req.params.id, ploId]
      );
    }
    for (const piId of pi_ids) {
      await client.query(
        'INSERT INTO base_clo_pi_map (base_clo_id, pi_id) VALUES ($1,$2) ON CONFLICT DO NOTHING',
        [req.params.id, piId]
      );
    }
    await client.query('COMMIT');
    res.json({ success: true, plo_ids, pi_ids });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});
```

- [ ] **Step 2: Smoke test**

Chọn 1 `base_clo.id` có sẵn (từ seed hoặc tạo mới). Lấy 2 PLO ID và 2 PI ID từ canonical version của course đó.

```bash
curl -X PUT http://localhost:3600/api/base-clos/1/mappings \
  -H "Content-Type: application/json" -b "token=<TOKEN>" \
  -d '{"plo_ids":[10,11],"pi_ids":[20,21]}'
curl http://localhost:3600/api/base-clos/1/mappings -b "token=<TOKEN>"
```
Expected: GET trả `{"plo_ids":[10,11],"pi_ids":[20,21]}`.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(api): CLO to PLO/PI mapping endpoints"
```

---

## Phase 3 — Content upgrade + validation

## Task 4: Content v2 → v3 upgrade helper

**Files:**
- Create: `server/render/content-upgrade.js` — pure function upgrader.
- Modify: [server.js:1107-1119](../../../server.js#L1107-L1119) — GET base-syllabus trả content đã upgrade.

- [ ] **Step 1: Tạo helper module**

Tạo file `server/render/content-upgrade.js`:

```javascript
// Upgrade base syllabus content from v2 → v3.
// v2 shape (partial): { hours, learning_methods, course_requirements: {software, hardware, lab_equipment, classroom_setup}, assessment_methods[].assessment_tool }
// v3 shape: see spec section 5.3.

function upgradeContent(content) {
  const c = content && typeof content === 'object' ? { ...content } : {};
  if (c._schema_version >= 3) return c;

  // Outline: hours → lt_hours, th_hours=0; add self_study_*, clo_codes
  if (Array.isArray(c.course_outline)) {
    c.course_outline = c.course_outline.map(l => ({
      lesson: l.lesson,
      title: l.title || '',
      lt_hours: typeof l.lt_hours === 'number' ? l.lt_hours : (l.hours || 0),
      th_hours: typeof l.th_hours === 'number' ? l.th_hours : 0,
      topics: Array.isArray(l.topics) ? l.topics : [],
      teaching_methods: l.teaching_methods || '',
      clo_codes: Array.isArray(l.clo_codes) ? l.clo_codes : (Array.isArray(l.clos) ? l.clos : []),
      self_study_hours: typeof l.self_study_hours === 'number' ? l.self_study_hours : 0,
      self_study_tasks: Array.isArray(l.self_study_tasks) ? l.self_study_tasks : [],
    }));
  }

  // learning_methods: string → teaching_methods[]
  if (!Array.isArray(c.teaching_methods)) {
    const raw = typeof c.learning_methods === 'string'
      ? c.learning_methods
      : (Array.isArray(c.learning_methods) ? c.learning_methods.join('\n') : '');
    c.teaching_methods = raw
      .split('\n').map(s => s.trim()).filter(Boolean)
      .map(line => ({ method: line, objective: '' }));
  }
  delete c.learning_methods;

  // course_requirements.* → tools[], other_requirements
  if (!Array.isArray(c.tools)) {
    const req = c.course_requirements || {};
    const tools = [];
    if (Array.isArray(req.software) && req.software.length) tools.push({ category: 'Phần mềm', items: req.software });
    if (Array.isArray(req.hardware) && req.hardware.length) tools.push({ category: 'Phần cứng', items: req.hardware });
    if (Array.isArray(req.lab_equipment) && req.lab_equipment.length) tools.push({ category: 'Thiết bị phòng thí nghiệm', items: req.lab_equipment });
    c.tools = tools;
    if (req.classroom_setup && !c.other_requirements) {
      c.other_requirements = 'Yêu cầu phòng học: ' + req.classroom_setup;
    }
  }
  delete c.course_requirements;

  // assessment_methods: assessment_tool → description; add task_ref, clo_codes
  if (Array.isArray(c.assessment_methods)) {
    c.assessment_methods = c.assessment_methods.map(a => ({
      component: a.component || '',
      description: a.description || a.assessment_tool || '',
      task_ref: a.task_ref || '',
      weight: typeof a.weight === 'number' ? a.weight : parseInt(a.weight) || 0,
      clo_codes: Array.isArray(a.clo_codes) ? a.clo_codes : (Array.isArray(a.clos) ? a.clos : []),
    }));
  }

  // Defaults for v3 new fields
  if (typeof c.other_requirements !== 'string') c.other_requirements = c.other_requirements || '';
  if (!Array.isArray(c.tools)) c.tools = [];

  c._schema_version = 3;
  return c;
}

module.exports = { upgradeContent };
```

- [ ] **Step 2: Wire vào GET base-syllabus**

Ở [server.js](../../../server.js), thêm require lên đầu (gần require khác):

```javascript
const { upgradeContent } = require('./server/render/content-upgrade');
```

Sửa endpoint GET tại [server.js:1107-1119](../../../server.js#L1107-L1119):

```javascript
app.get('/api/courses/:courseId/base-syllabus', authMiddleware, requirePerm('courses.view'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bs.*, u.display_name as updated_by_name
       FROM course_base_syllabi bs
       LEFT JOIN users u ON bs.updated_by = u.id
       WHERE bs.course_id = $1`,
      [req.params.courseId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Chưa có đề cương cơ bản' });
    const row = result.rows[0];
    const parsed = typeof row.content === 'string' ? JSON.parse(row.content) : (row.content || {});
    row.content = upgradeContent(parsed);
    res.json(row);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Smoke test**

```bash
node --check server.js
node --check server/render/content-upgrade.js
```
Expected: exit 0 cả 2.

Restart server. Lấy 1 course đã có base syllabus v2, gọi GET:

```bash
curl http://localhost:3600/api/courses/3/base-syllabus -b "token=<TOKEN>" | jq '.content._schema_version'
```
Expected: `3`.

- [ ] **Step 4: Commit**

```bash
git add server/render/content-upgrade.js server.js
git commit -m "feat(api): content v2 to v3 lazy upgrade on read"
```

---

## Task 5: Validation endpoint

**Files:**
- Modify: [server.js](../../../server.js) — thêm `POST /api/courses/:id/base-syllabus/validate` sau endpoint PUT base-syllabus (~dòng 1134).

- [ ] **Step 1: Thêm endpoint**

Sau [server.js:1134](../../../server.js#L1134), thêm:

```javascript
app.post('/api/courses/:courseId/base-syllabus/validate', authMiddleware, requirePerm('courses.view'), async (req, res) => {
  try {
    const courseId = parseInt(req.params.courseId);
    const courseRes = await pool.query('SELECT * FROM courses WHERE id = $1', [courseId]);
    if (!courseRes.rows.length) return res.status(404).json({ error: 'Course not found' });
    const course = courseRes.rows[0];

    const bsRes = await pool.query('SELECT content FROM course_base_syllabi WHERE course_id = $1', [courseId]);
    const raw = bsRes.rows.length
      ? (typeof bsRes.rows[0].content === 'string' ? JSON.parse(bsRes.rows[0].content) : bsRes.rows[0].content)
      : {};
    const content = upgradeContent(raw);

    const clos = (await pool.query('SELECT * FROM base_syllabus_clos WHERE course_id = $1 ORDER BY code', [courseId])).rows;

    const issues = [];
    if (!course.canonical_version_id) issues.push({ code: 'NO_CANONICAL', message: 'Chưa chọn CTĐT chuẩn' });
    if (!course.name_en) issues.push({ code: 'NO_NAME_EN', message: 'Chưa nhập tên tiếng Anh' });
    if (!course.knowledge_area) issues.push({ code: 'NO_KNOWLEDGE_AREA', message: 'Chưa chọn khối kiến thức' });
    if (!course.course_requirement) issues.push({ code: 'NO_COURSE_REQUIREMENT', message: 'Chưa chọn bắt buộc/tự chọn' });

    for (const clo of clos) {
      const ploMap = await pool.query('SELECT 1 FROM base_clo_plo_map WHERE base_clo_id = $1 LIMIT 1', [clo.id]);
      if (!ploMap.rows.length) issues.push({ code: 'CLO_NO_PLO', clo_code: clo.code, message: `${clo.code} chưa map PLO` });
      const piMap = await pool.query('SELECT 1 FROM base_clo_pi_map WHERE base_clo_id = $1 LIMIT 1', [clo.id]);
      if (!piMap.rows.length) issues.push({ code: 'CLO_NO_PI', clo_code: clo.code, message: `${clo.code} chưa map PI` });
    }

    const outline = Array.isArray(content.course_outline) ? content.course_outline : [];
    outline.forEach(l => {
      if (!Array.isArray(l.clo_codes) || !l.clo_codes.length) {
        issues.push({ code: 'LESSON_NO_CLO', lesson: l.lesson, message: `Bài ${l.lesson} chưa chọn CLO đáp ứng` });
      }
    });

    const assessments = Array.isArray(content.assessment_methods) ? content.assessment_methods : [];
    const totalWeight = assessments.reduce((s, a) => s + (parseInt(a.weight) || 0), 0);
    if (assessments.length && totalWeight !== 100) {
      issues.push({ code: 'WEIGHT_SUM', actual: totalWeight, message: `Tổng trọng số đánh giá = ${totalWeight}% (cần 100%)` });
    }

    res.json({ ok: issues.length === 0, issues });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: Smoke test**

```bash
curl -X POST http://localhost:3600/api/courses/3/base-syllabus/validate -b "token=<TOKEN>" | jq
```
Expected: JSON `{ok: false, issues: [...]}` liệt kê các thiếu sót (dự kiến khi base chưa đủ).

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(api): validate base syllabus completeness endpoint"
```

---

## Phase 4 — Editor UI (5 tabs)

## Task 6: Tab 0 — Master fields UI

**Files:**
- Modify: [public/js/pages/base-syllabus-editor.js](../../../public/js/pages/base-syllabus-editor.js) — mở rộng `renderGeneralTab` + thêm fetch versions.

- [ ] **Step 1: Thêm fetch versions của khoa**

Trong [public/js/pages/base-syllabus-editor.js:12-38](../../../public/js/pages/base-syllabus-editor.js#L12-L38) (`async render`), sau khi set `this.course`, thêm fetch tất cả versions và filter theo department:

```javascript
      // Fetch versions của khoa (để chọn canonical_version_id)
      try {
        const vRes = await fetch('/api/versions').then(r => r.ok ? r.json() : []);
        this.departmentVersions = (Array.isArray(vRes) ? vRes : [])
          .filter(v => v.department_id === this.course.department_id);
      } catch (_) { this.departmentVersions = []; }
```

- [ ] **Step 2: Thay `renderGeneralTab`**

Thay toàn bộ hàm `renderGeneralTab` ([public/js/pages/base-syllabus-editor.js:147-159](../../../public/js/pages/base-syllabus-editor.js#L147-L159)) bằng:

```javascript
  renderGeneralTab(body, editable, c) {
    const dis = editable ? '' : 'disabled';
    const co = this.course;
    const versions = this.departmentVersions || [];
    const creditsDisplay = `${co.credits || 0} (${co.credits_theory || 0}, ${co.credits_practice || 0})`;
    body.innerHTML = `
      <div style="max-width:820px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Thông tin chung</h3>

        <div style="display:flex;gap:12px;">
          <div class="input-group" style="flex:1;"><label>Tên tiếng Việt</label><input type="text" id="bs-name-vi" ${dis} value="${(co.name || '').replace(/"/g,'&quot;')}"></div>
          <div class="input-group" style="flex:1;"><label>Tên tiếng Anh</label><input type="text" id="bs-name-en" ${dis} value="${(co.name_en || '').replace(/"/g,'&quot;')}"></div>
        </div>

        <div style="display:flex;gap:12px;">
          <div class="input-group" style="width:160px;"><label>Mã HP</label><input type="text" disabled value="${co.code || ''}"></div>
          <div class="input-group" style="flex:1;"><label>Số tín chỉ (TC, LT, TH)</label><input type="text" disabled value="${creditsDisplay} TC"></div>
          <div class="input-group" style="flex:1;"><label>Khoa quản lý</label><input type="text" disabled value="${co.dept_name || ''}"></div>
        </div>

        <div style="display:flex;gap:12px;">
          <div class="input-group" style="flex:1;">
            <label>Khối kiến thức</label>
            <select id="bs-knowledge-area" ${dis}>
              <option value="">-- Chọn --</option>
              <option value="general" ${co.knowledge_area==='general'?'selected':''}>GD đại cương</option>
              <option value="professional" ${co.knowledge_area==='professional'?'selected':''}>GD chuyên nghiệp</option>
            </select>
          </div>
          <div class="input-group" style="flex:1;">
            <label>Yêu cầu</label>
            <select id="bs-course-req" ${dis}>
              <option value="">-- Chọn --</option>
              <option value="required" ${co.course_requirement==='required'?'selected':''}>Bắt buộc</option>
              <option value="elective" ${co.course_requirement==='elective'?'selected':''}>Tự chọn</option>
            </select>
          </div>
          <div class="input-group" style="flex:1;">
            <label>Trình độ đào tạo</label>
            <select id="bs-training-level" ${dis}>
              <option value="Đại học" ${(co.training_level||'Đại học')==='Đại học'?'selected':''}>Đại học</option>
              <option value="Sau đại học" ${co.training_level==='Sau đại học'?'selected':''}>Sau đại học</option>
            </select>
          </div>
        </div>

        <div class="input-group">
          <label>CTĐT chuẩn <span style="color:var(--text-muted);font-weight:normal;">(dùng để map CLO → PLO/PI)</span></label>
          <select id="bs-canonical-version" ${dis}>
            <option value="">-- Chưa chọn --</option>
            ${versions.map(v => `<option value="${v.id}" ${co.canonical_version_id===v.id?'selected':''}>${v.code || v.academic_year || ('Version #'+v.id)}</option>`).join('')}
          </select>
        </div>

        <div style="display:flex;gap:12px;">
          <div class="input-group" style="flex:1;"><label>Học phần tiên quyết (mục 6)</label><input type="text" id="bs-prereq" ${dis} value="${c.prerequisites || ''}"></div>
          <div class="input-group" style="flex:1;"><label>Ngôn ngữ giảng dạy</label><input type="text" id="bs-lang-inst" ${dis} value="${c.language_instruction || ''}"></div>
        </div>

        <div class="input-group"><label>Mục tiêu học phần (mục 7)</label><textarea id="bs-course-obj" ${dis} rows="3">${c.course_objectives || ''}</textarea></div>
        <div class="input-group"><label>Mô tả tóm tắt nội dung HP (mục 11)</label><textarea id="bs-course-desc" ${dis} rows="3">${c.course_description || ''}</textarea></div>

        <h4 style="font-size:14px;font-weight:600;margin:20px 0 8px;">Phương pháp, hình thức tổ chức dạy học (mục 12)</h4>
        <table class="data-table" id="bs-teaching-methods-table">
          <thead><tr><th style="width:35%;">Phương pháp</th><th>Mục tiêu</th>${editable?'<th style="width:50px;"></th>':''}</tr></thead>
          <tbody>
            ${(Array.isArray(c.teaching_methods)?c.teaching_methods:[]).map((t,i)=>`<tr>
              <td><input type="text" data-field="method" value="${(t.method||'').replace(/"/g,'&quot;')}" ${dis} style="${BS_INP}"></td>
              <td><input type="text" data-field="objective" value="${(t.objective||'').replace(/"/g,'&quot;')}" ${dis} style="${BS_INP}"></td>
              ${editable?`<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>`:''}
            </tr>`).join('')}
          </tbody>
        </table>
        ${editable?'<button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="window.BaseSyllabusEditorPage.addTeachingMethodRow()">+ Thêm dòng</button>':''}
      </div>
    `;
  },

  addTeachingMethodRow() {
    const tbody = document.querySelector('#bs-teaching-methods-table tbody');
    tbody.insertAdjacentHTML('beforeend', `<tr>
      <td><input type="text" data-field="method" style="${BS_INP}"></td>
      <td><input type="text" data-field="objective" style="${BS_INP}"></td>
      <td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`);
  },
```

- [ ] **Step 3: Sửa `_collectGeneral` để gồm tất cả field + tách master vs content**

Thay `_collectGeneral` ([public/js/pages/base-syllabus-editor.js:161-172](../../../public/js/pages/base-syllabus-editor.js#L161-L172)) bằng:

```javascript
  _collectGeneral() {
    const desc = document.getElementById('bs-course-desc');
    if (!desc) return;
    // Content fields (JSONB)
    const tmTable = document.getElementById('bs-teaching-methods-table');
    const teaching_methods = tmTable
      ? Array.from(tmTable.querySelectorAll('tbody tr')).map(r => ({
          method: r.querySelector('[data-field="method"]').value,
          objective: r.querySelector('[data-field="objective"]').value,
        })).filter(t => t.method || t.objective)
      : [];
    this.baseSyllabus.content = {
      ...this.baseSyllabus.content,
      course_description: desc.value,
      course_objectives: document.getElementById('bs-course-obj').value,
      prerequisites: document.getElementById('bs-prereq').value,
      language_instruction: document.getElementById('bs-lang-inst').value,
      teaching_methods,
    };
    // Master fields (stored separately, saved via PUT /api/courses/:id)
    this._pendingCourseUpdate = {
      name: document.getElementById('bs-name-vi').value,
      name_en: document.getElementById('bs-name-en').value,
      knowledge_area: document.getElementById('bs-knowledge-area').value || null,
      course_requirement: document.getElementById('bs-course-req').value || null,
      training_level: document.getElementById('bs-training-level').value,
      canonical_version_id: parseInt(document.getElementById('bs-canonical-version').value) || null,
    };
  },
```

- [ ] **Step 4: Cập nhật `saveAll` để PUT course master fields**

Thay `saveAll` ([public/js/pages/base-syllabus-editor.js:469-486](../../../public/js/pages/base-syllabus-editor.js#L469-L486)) bằng:

```javascript
  async saveAll() {
    try {
      this._collectCurrentTabIntoState();

      // 1. Save master fields (if any)
      if (this._pendingCourseUpdate) {
        const r = await fetch(`/api/courses/${this.course.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this._pendingCourseUpdate),
        });
        if (!r.ok) throw new Error((await r.json()).error || 'Lỗi lưu thông tin HP');
        Object.assign(this.course, await r.json());
        this._pendingCourseUpdate = null;
      }

      // 2. Save content
      const res = await fetch(`/api/courses/${this.courseId}/base-syllabus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: this.baseSyllabus.content }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi lưu');
      const saved = await res.json();
      this.baseSyllabus = { ...this.baseSyllabus, ...saved };
      this.baseSyllabus.content = typeof saved.content === 'string' ? JSON.parse(saved.content) : saved.content;
      this.isNew = false;
      window.toast.success('Đã lưu đề cương cơ bản');
    } catch (e) {
      window.toast.error(e.message);
    }
  },
```

- [ ] **Step 5: Manual test**

Mở app: navigate to 1 course → base syllabus → tab Thông tin chung. Nhập các field mới, bấm "Lưu tất cả". Reload trang và verify các field được lưu đúng.

- [ ] **Step 6: Commit**

```bash
git add public/js/pages/base-syllabus-editor.js
git commit -m "feat(ui): tab Thông tin chung with master fields + teaching methods table"
```

---

## Task 7: Tab 1 — CLO với PLO/PI multi-select

**Files:**
- Modify: [public/js/pages/base-syllabus-editor.js](../../../public/js/pages/base-syllabus-editor.js) — mở rộng `renderCLOTab`, `saveBaseCLO`, thêm fetch PLO/PI từ canonical.

- [ ] **Step 1: Thêm fetch PLO/PI của canonical version**

Trong `async render()` (~dòng 30), sau khi fetch `departmentVersions`, thêm:

```javascript
      // Fetch PLO/PI của canonical version (nếu có)
      this.canonicalPlos = [];
      this.canonicalPis = [];
      if (this.course.canonical_version_id) {
        try {
          this.canonicalPlos = await fetch(`/api/versions/${this.course.canonical_version_id}/plos`).then(r => r.ok ? r.json() : []);
          this.canonicalPis = await fetch(`/api/versions/${this.course.canonical_version_id}/pis`).then(r => r.ok ? r.json() : []);
        } catch (_) {}
      }
```

- [ ] **Step 2: Thay `renderCLOTab`**

Thay toàn bộ hàm `renderCLOTab` ([public/js/pages/base-syllabus-editor.js:175-224](../../../public/js/pages/base-syllabus-editor.js#L175-L224)) bằng:

```javascript
  async renderCLOTab(body, editable) {
    const bloomLabels = ['', '1 — Nhớ', '2 — Hiểu', '3 — Áp dụng', '4 — Phân tích', '5 — Đánh giá', '6 — Sáng tạo'];
    let clos = [];
    try {
      clos = await fetch(`/api/courses/${this.courseId}/base-syllabus/clos`).then(r => r.json());
    } catch (e) { /* empty */ }

    // Fetch mappings for each CLO
    const mappings = {};
    for (const c of clos) {
      try {
        mappings[c.id] = await fetch(`/api/base-clos/${c.id}/mappings`).then(r => r.json());
      } catch (_) { mappings[c.id] = { plo_ids: [], pi_ids: [] }; }
    }

    const plos = this.canonicalPlos || [];
    const pis = this.canonicalPis || [];
    const noCanonical = !this.course.canonical_version_id;

    body.innerHTML = `
      ${noCanonical ? '<div class="alert alert-warning" style="margin-bottom:12px;">⚠️ Chưa chọn CTĐT chuẩn ở tab Thông tin chung — chưa thể map PLO/PI.</div>' : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Chuẩn đầu ra môn học (CLO) — Mục 10</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.showBaseCLOForm()">+ Thêm CLO</button>' : ''}
      </div>
      <table class="data-table">
        <thead><tr>
          <th style="width:80px;">Mã</th>
          <th>Mô tả</th>
          <th style="width:110px;">Bloom</th>
          <th style="width:180px;">PLO đáp ứng</th>
          <th style="width:180px;">PI đáp ứng</th>
          ${editable ? '<th style="width:100px;"></th>' : ''}
        </tr></thead>
        <tbody>
          ${clos.length === 0 ? `<tr><td colspan="${editable ? 6 : 5}" style="color:var(--text-muted);text-align:center;">Chưa có CLO</td></tr>` : clos.map(c => {
            const m = mappings[c.id] || { plo_ids: [], pi_ids: [] };
            const ploCodes = m.plo_ids.map(id => (plos.find(p => p.id === id) || {}).code).filter(Boolean).join(', ');
            const piCodes = m.pi_ids.map(id => (pis.find(p => p.id === id) || {}).code).filter(Boolean).join(', ');
            return `
            <tr>
              <td><strong style="color:var(--primary);">${c.code || ''}</strong></td>
              <td style="font-size:13px;">${c.description || ''}</td>
              <td><span class="badge badge-info">${bloomLabels[c.bloom_level] || c.bloom_level}</span></td>
              <td style="font-size:12px;">${ploCodes || '<span style="color:var(--text-muted);">—</span>'}</td>
              <td style="font-size:12px;">${piCodes || '<span style="color:var(--text-muted);">—</span>'}</td>
              ${editable ? `<td style="white-space:nowrap;">
                <button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.editBaseCLO(${c.id})">Sửa</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.BaseSyllabusEditorPage.deleteBaseCLO(${c.id})">Xóa</button>
              </td>` : ''}
            </tr>
          `; }).join('')}
        </tbody>
      </table>
      <div id="bs-clo-form" style="display:none;margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
        <input type="hidden" id="bs-clo-edit-id">
        <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;">
          <div class="input-group" style="width:100px;margin:0;"><label>Mã</label><input type="text" id="bs-clo-code" placeholder="CLO1"></div>
          <div class="input-group" style="flex:1;min-width:200px;margin:0;"><label>Mô tả</label><input type="text" id="bs-clo-desc"></div>
          <div class="input-group" style="width:140px;margin:0;">
            <label>Bloom Level</label>
            <select id="bs-clo-bloom">
              <option value="1">1 — Nhớ</option>
              <option value="2">2 — Hiểu</option>
              <option value="3">3 — Áp dụng</option>
              <option value="4">4 — Phân tích</option>
              <option value="5">5 — Đánh giá</option>
              <option value="6">6 — Sáng tạo</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <div class="input-group" style="flex:1;margin:0;">
            <label>PLO đáp ứng</label>
            <select id="bs-clo-plos" multiple size="4" ${noCanonical ? 'disabled' : ''}>
              ${plos.map(p => `<option value="${p.id}">${p.code} — ${(p.description||'').substring(0,60)}</option>`).join('')}
            </select>
          </div>
          <div class="input-group" style="flex:1;margin:0;">
            <label>PI đáp ứng</label>
            <select id="bs-clo-pis" multiple size="4" ${noCanonical ? 'disabled' : ''}>
              ${pis.map(p => `<option value="${p.id}">${p.code} — ${(p.description||'').substring(0,60)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="margin-top:10px;display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.saveBaseCLO()">Lưu</button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('bs-clo-form').style.display='none'">Hủy</button>
        </div>
      </div>
    `;
  },
```

- [ ] **Step 3: Thay `showBaseCLOForm`, `editBaseCLO`, `saveBaseCLO`**

Thay cả 3 hàm ở [public/js/pages/base-syllabus-editor.js:226-259](../../../public/js/pages/base-syllabus-editor.js#L226-L259) bằng:

```javascript
  showBaseCLOForm(id, code, desc, bloom, ploIds, piIds) {
    document.getElementById('bs-clo-edit-id').value = id || '';
    document.getElementById('bs-clo-code').value = code || '';
    document.getElementById('bs-clo-desc').value = desc || '';
    document.getElementById('bs-clo-bloom').value = bloom || 1;
    const ploSel = document.getElementById('bs-clo-plos');
    const piSel = document.getElementById('bs-clo-pis');
    Array.from(ploSel.options).forEach(o => o.selected = (ploIds || []).includes(parseInt(o.value)));
    Array.from(piSel.options).forEach(o => o.selected = (piIds || []).includes(parseInt(o.value)));
    document.getElementById('bs-clo-form').style.display = 'block';
  },

  async editBaseCLO(id) {
    const [clos, mappings] = await Promise.all([
      fetch(`/api/courses/${this.courseId}/base-syllabus/clos`).then(r => r.json()),
      fetch(`/api/base-clos/${id}/mappings`).then(r => r.json()),
    ]);
    const c = clos.find(x => x.id === id);
    if (c) this.showBaseCLOForm(c.id, c.code, c.description, c.bloom_level, mappings.plo_ids, mappings.pi_ids);
  },

  async saveBaseCLO() {
    const id = document.getElementById('bs-clo-edit-id').value;
    const code = document.getElementById('bs-clo-code').value.trim();
    const description = document.getElementById('bs-clo-desc').value.trim();
    const bloom_level = parseInt(document.getElementById('bs-clo-bloom').value) || 1;
    const plo_ids = Array.from(document.getElementById('bs-clo-plos').selectedOptions).map(o => parseInt(o.value));
    const pi_ids = Array.from(document.getElementById('bs-clo-pis').selectedOptions).map(o => parseInt(o.value));
    if (!code) { window.toast.warning('Nhập mã CLO'); return; }
    try {
      const url = id ? `/api/base-clos/${id}` : `/api/courses/${this.courseId}/base-syllabus/clos`;
      const res = await fetch(url, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, description, bloom_level })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const saved = await res.json();
      // Save mappings
      await fetch(`/api/base-clos/${saved.id}/mappings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plo_ids, pi_ids }),
      });
      window.toast.success(id ? 'Đã cập nhật CLO' : 'Đã thêm CLO');
      document.getElementById('bs-clo-form').style.display = 'none';
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },
```

- [ ] **Step 4: Manual test**

Mở base syllabus editor → tab CLO. Nếu chưa set canonical version → thấy cảnh báo + multi-select disabled. Set canonical version ở tab Thông tin chung → lưu → reload → tab CLO có PLO/PI list. Thêm/sửa CLO với mapping → verify hiển thị.

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/base-syllabus-editor.js
git commit -m "feat(ui): CLO tab with PLO/PI multi-select mapping"
```

---

## Task 8: Tab 2 — Outline với LT/TH hours, CLO, tự học

**Files:**
- Modify: [public/js/pages/base-syllabus-editor.js](../../../public/js/pages/base-syllabus-editor.js) — `renderOutlineTab`, `_outlineRowHtml`, `submitAddOutline`, `_collectOutline`, modal HTML.

- [ ] **Step 1: Cập nhật modal "Thêm bài"**

Sửa HTML modal ở [public/js/pages/base-syllabus-editor.js:77-109](../../../public/js/pages/base-syllabus-editor.js#L77-L109) (đoạn `<div id="bs-outline-add-modal" ...>`) thành:

```html
      <div id="bs-outline-add-modal" class="modal-overlay">
        <div class="modal" style="max-width:720px;">
          <div class="modal-header"><h2>Thêm bài học</h2></div>
          <div class="modal-body">
            <form id="bs-outline-add-form">
              <div class="input-group">
                <label>Tên bài <span class="required-mark">*</span></label>
                <input type="text" id="bs-outline-add-title" required placeholder="VD: BÀI 1 — Giới thiệu">
              </div>
              <div style="display:flex;gap:12px;">
                <div class="input-group" style="flex:1;"><label>LT (tiết)</label><input type="number" id="bs-outline-add-lt" min="0" value="0"></div>
                <div class="input-group" style="flex:1;"><label>TH (tiết)</label><input type="number" id="bs-outline-add-th" min="0" value="0"></div>
                <div class="input-group" style="flex:1;"><label>Tự học (tiết)</label><input type="number" id="bs-outline-add-ss" min="0" value="0"></div>
              </div>
              <div class="input-group">
                <label>Nội dung chi tiết (mỗi dòng = 1 mục)</label>
                <textarea id="bs-outline-add-topics" rows="3"></textarea>
              </div>
              <div class="input-group">
                <label>Phương pháp dạy học</label>
                <textarea id="bs-outline-add-methods" rows="2"></textarea>
              </div>
              <div class="input-group">
                <label>Nhiệm vụ tự học của SV (mỗi dòng = 1 nhiệm vụ)</label>
                <textarea id="bs-outline-add-sstasks" rows="2"></textarea>
              </div>
              <div class="modal-error" id="bs-outline-add-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('bs-outline-add-modal').classList.remove('active')">Hủy</button>
                <button type="submit" class="btn btn-primary">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      </div>
```

- [ ] **Step 2: Cập nhật `submitAddOutline`**

Thay [public/js/pages/base-syllabus-editor.js:318-345](../../../public/js/pages/base-syllabus-editor.js#L318-L345) bằng:

```javascript
  submitAddOutline() {
    const title = document.getElementById('bs-outline-add-title').value.trim();
    const errorEl = document.getElementById('bs-outline-add-error');
    if (!title) { errorEl.textContent = 'Nhập tên bài'; errorEl.classList.add('show'); return; }
    const lt_hours = parseFloat(document.getElementById('bs-outline-add-lt').value) || 0;
    const th_hours = parseFloat(document.getElementById('bs-outline-add-th').value) || 0;
    const self_study_hours = parseFloat(document.getElementById('bs-outline-add-ss').value) || 0;
    const topics = document.getElementById('bs-outline-add-topics').value.split('\n').map(s=>s.trim()).filter(Boolean);
    const teaching_methods = document.getElementById('bs-outline-add-methods').value;
    const self_study_tasks = document.getElementById('bs-outline-add-sstasks').value.split('\n').map(s=>s.trim()).filter(Boolean);

    this._collectOutline();

    const existing = this.baseSyllabus.content.course_outline || [];
    this.baseSyllabus.content = {
      ...this.baseSyllabus.content,
      course_outline: [
        ...existing,
        { lesson: existing.length + 1, title, lt_hours, th_hours, topics, teaching_methods, clo_codes: [], self_study_hours, self_study_tasks },
      ],
    };

    document.getElementById('bs-outline-add-modal').classList.remove('active');
    window.toast.success('Đã thêm bài (chưa lưu)');
    this.renderTab();
  },
```

- [ ] **Step 3: Thay `renderOutlineTab` + `_outlineRowHtml`**

Thay [public/js/pages/base-syllabus-editor.js:275-306](../../../public/js/pages/base-syllabus-editor.js#L275-L306) bằng:

```javascript
  async renderOutlineTab(body, editable, c) {
    const lessons = c.course_outline || [];
    // Load CLO codes from current course for multi-select options
    let cloCodes = [];
    try {
      const clos = await fetch(`/api/courses/${this.courseId}/base-syllabus/clos`).then(r => r.json());
      cloCodes = clos.map(x => x.code).filter(Boolean);
    } catch (_) {}
    this._currentCloCodes = cloCodes;

    const totals = lessons.reduce((acc, l) => ({
      lt: acc.lt + (l.lt_hours || 0),
      th: acc.th + (l.th_hours || 0),
      ss: acc.ss + (l.self_study_hours || 0),
    }), { lt: 0, th: 0, ss: 0 });

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Nội dung chi tiết học phần (mục 13 + 16)</h3>
        ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.openAddOutlineModal()">+ Thêm bài</button>' : ''}
      </div>
      <div id="bs-outline-container">
        ${lessons.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có nội dung. Bấm "+ Thêm bài" để bắt đầu.</p>' :
          lessons.map((l, i) => this._outlineRowHtml(l, i, editable, cloCodes)).join('')}
      </div>
      ${lessons.length ? `<div style="margin-top:12px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius);font-size:13px;">
        <strong>Tổng:</strong> LT ${totals.lt} tiết &nbsp;|&nbsp; TH ${totals.th} tiết &nbsp;|&nbsp; Tự học ${totals.ss} tiết
      </div>` : ''}
    `;
  },

  _outlineRowHtml(l, i, editable, cloCodes) {
    const dis = editable ? '' : 'disabled';
    const topicsStr = Array.isArray(l.topics) ? l.topics.join('\n') : '';
    const tasksStr = Array.isArray(l.self_study_tasks) ? l.self_study_tasks.join('\n') : '';
    const codes = Array.isArray(cloCodes) ? cloCodes : [];
    const selected = Array.isArray(l.clo_codes) ? l.clo_codes : [];
    return `<div class="outline-row" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        <strong style="color:var(--primary);white-space:nowrap;">Bài ${l.lesson || i + 1}</strong>
        <input type="text" data-field="title" value="${(l.title || '').replace(/"/g, '&quot;')}" ${dis} placeholder="Tên bài" style="flex:1;${BS_INP}">
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;">LT:</label><input type="number" data-field="lt_hours" value="${l.lt_hours || 0}" ${dis} min="0" style="width:56px;${BS_INP}text-align:center;"></div>
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;">TH:</label><input type="number" data-field="th_hours" value="${l.th_hours || 0}" ${dis} min="0" style="width:56px;${BS_INP}text-align:center;"></div>
        ${editable ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('.outline-row').remove()">✕</button>` : ''}
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nội dung chi tiết (mỗi dòng = 1 mục)</label><textarea data-field="topics" ${dis} rows="3" style="${BS_INP}">${topicsStr}</textarea></div>
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Phương pháp dạy học</label><textarea data-field="teaching_methods" ${dis} rows="3" style="${BS_INP}">${l.teaching_methods || ''}</textarea></div>
      </div>
      <div class="input-group" style="margin-bottom:10px;"><label style="font-size:12px;">CLO đáp ứng</label>
        <select data-field="clo_codes" multiple size="3" ${dis} style="${BS_INP}">
          ${codes.map(c => `<option value="${c}" ${selected.includes(c) ? 'selected' : ''}>${c}</option>`).join('')}
        </select>
      </div>
      <details style="margin-top:6px;">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--primary);">▸ Hướng dẫn tự học (mục 16)</summary>
        <div style="display:flex;gap:12px;margin-top:8px;">
          <div class="input-group" style="width:150px;margin:0;"><label style="font-size:12px;">Số tiết tự học</label><input type="number" data-field="self_study_hours" value="${l.self_study_hours || 0}" ${dis} min="0" style="${BS_INP}text-align:center;"></div>
          <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nhiệm vụ SV (mỗi dòng = 1)</label><textarea data-field="self_study_tasks" ${dis} rows="3" style="${BS_INP}">${tasksStr}</textarea></div>
        </div>
      </details>
    </div>`;
  },
```

- [ ] **Step 4: Thay `_collectOutline`**

Thay [public/js/pages/base-syllabus-editor.js:347-360](../../../public/js/pages/base-syllabus-editor.js#L347-L360) bằng:

```javascript
  _collectOutline() {
    const container = document.getElementById('bs-outline-container');
    if (!container) return;
    const rows = container.querySelectorAll('.outline-row');
    const course_outline = Array.from(rows).map((r, i) => ({
      lesson: i + 1,
      title: r.querySelector('[data-field="title"]').value,
      lt_hours: parseFloat(r.querySelector('[data-field="lt_hours"]').value) || 0,
      th_hours: parseFloat(r.querySelector('[data-field="th_hours"]').value) || 0,
      topics: r.querySelector('[data-field="topics"]').value.split('\n').map(s => s.trim()).filter(Boolean),
      teaching_methods: r.querySelector('[data-field="teaching_methods"]').value,
      clo_codes: Array.from(r.querySelector('[data-field="clo_codes"]').selectedOptions).map(o => o.value),
      self_study_hours: parseFloat(r.querySelector('[data-field="self_study_hours"]').value) || 0,
      self_study_tasks: r.querySelector('[data-field="self_study_tasks"]').value.split('\n').map(s => s.trim()).filter(Boolean),
    }));
    this.baseSyllabus.content = { ...this.baseSyllabus.content, course_outline };
  },
```

- [ ] **Step 5: Reset modal defaults**

Sửa `openAddOutlineModal` ở [public/js/pages/base-syllabus-editor.js:308-316](../../../public/js/pages/base-syllabus-editor.js#L308-L316):

```javascript
  openAddOutlineModal() {
    document.getElementById('bs-outline-add-form').reset();
    document.getElementById('bs-outline-add-lt').value = '0';
    document.getElementById('bs-outline-add-th').value = '0';
    document.getElementById('bs-outline-add-ss').value = '0';
    const errorEl = document.getElementById('bs-outline-add-error');
    errorEl.classList.remove('show');
    errorEl.textContent = '';
    document.getElementById('bs-outline-add-modal').classList.add('active');
    App.modalGuard('bs-outline-add-modal', () => this.submitAddOutline());
  },
```

- [ ] **Step 6: Manual test**

Mở tab Nội dung giảng dạy. Thêm 1 bài với LT=5, TH=0, tự học=10, chọn vài CLO, nhập nhiệm vụ SV. Lưu tất cả. Reload → verify dữ liệu giữ nguyên. Verify tổng LT/TH/tự học ở footer đúng.

- [ ] **Step 7: Commit**

```bash
git add public/js/pages/base-syllabus-editor.js
git commit -m "feat(ui): outline tab with LT/TH hours, CLO mapping, self-study"
```

---

## Task 9: Tab 3 — Đánh giá với 3 cột mới

**Files:**
- Modify: [public/js/pages/base-syllabus-editor.js](../../../public/js/pages/base-syllabus-editor.js) — `renderGradingTab`, `addGradingRow`, `_collectGrading`.

- [ ] **Step 1: Thay `renderGradingTab`**

Thay [public/js/pages/base-syllabus-editor.js:363-383](../../../public/js/pages/base-syllabus-editor.js#L363-L383) bằng:

```javascript
  async renderGradingTab(body, editable, c) {
    const items = c.assessment_methods || [];
    const dis = editable ? '' : 'disabled';
    // Load CLO codes for multi-select
    let cloCodes = [];
    try {
      const clos = await fetch(`/api/courses/${this.courseId}/base-syllabus/clos`).then(r => r.json());
      cloCodes = clos.map(x => x.code).filter(Boolean);
    } catch (_) {}
    this._gradingCloCodes = cloCodes;

    const totalWeight = items.reduce((s, g) => s + (parseInt(g.weight) || 0), 0);
    const weightColor = totalWeight === 100 ? 'var(--success)' : 'var(--danger)';

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Phương pháp kiểm tra/đánh giá (mục 14)</h3>
        <div style="font-size:13px;">Tổng trọng số: <strong style="color:${weightColor};">${totalWeight}%</strong></div>
      </div>
      <table class="data-table" id="bs-grading-table">
        <thead><tr>
          <th style="width:180px;">Thành phần</th>
          <th>Quy định</th>
          <th style="width:140px;">Bài đánh giá</th>
          <th style="width:80px;">%</th>
          <th style="width:160px;">CLO đáp ứng</th>
          ${editable ? '<th style="width:50px;"></th>' : ''}
        </tr></thead>
        <tbody>
          ${items.map((g, i) => this._gradingRowHtml(g, i, editable, cloCodes, dis)).join('')}
        </tbody>
      </table>
      ${editable ? '<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="window.BaseSyllabusEditorPage.addGradingRow()">+ Thêm dòng</button>' : ''}
    `;
  },

  _gradingRowHtml(g, i, editable, cloCodes, dis) {
    const selected = Array.isArray(g.clo_codes) ? g.clo_codes : [];
    return `<tr data-idx="${i}">
      <td><input type="text" value="${(g.component || '').replace(/"/g,'&quot;')}" data-field="component" ${dis} style="${BS_INP}" placeholder="VD: Điểm đánh giá quá trình"></td>
      <td><input type="text" value="${(g.description || '').replace(/"/g,'&quot;')}" data-field="description" ${dis} style="${BS_INP}" placeholder="VD: Bài tập nhóm"></td>
      <td><input type="text" value="${(g.task_ref || '').replace(/"/g,'&quot;')}" data-field="task_ref" ${dis} style="${BS_INP}" placeholder="VD: Bài 1,2,3,5"></td>
      <td><input type="number" value="${g.weight || 0}" data-field="weight" ${dis} min="0" max="100" style="${BS_INP}text-align:center;"></td>
      <td>
        <select data-field="clo_codes" multiple size="3" ${dis} style="${BS_INP}font-size:12px;">
          ${cloCodes.map(c => `<option value="${c}" ${selected.includes(c)?'selected':''}>${c}</option>`).join('')}
        </select>
      </td>
      ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>` : ''}
    </tr>`;
  },
```

- [ ] **Step 2: Thay `addGradingRow` + `_collectGrading`**

Thay [public/js/pages/base-syllabus-editor.js:385-406](../../../public/js/pages/base-syllabus-editor.js#L385-L406) bằng:

```javascript
  addGradingRow() {
    const tbody = document.querySelector('#bs-grading-table tbody');
    const codes = this._gradingCloCodes || [];
    tbody.insertAdjacentHTML('beforeend', this._gradingRowHtml({}, tbody.children.length, true, codes, ''));
  },

  _collectGrading() {
    const table = document.getElementById('bs-grading-table');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    const assessment_methods = Array.from(rows).map(r => ({
      component: r.querySelector('[data-field="component"]').value,
      description: r.querySelector('[data-field="description"]').value,
      task_ref: r.querySelector('[data-field="task_ref"]').value,
      weight: parseInt(r.querySelector('[data-field="weight"]').value) || 0,
      clo_codes: Array.from(r.querySelector('[data-field="clo_codes"]').selectedOptions).map(o => o.value),
    }));
    this.baseSyllabus.content = { ...this.baseSyllabus.content, assessment_methods };
  },
```

- [ ] **Step 3: Manual test**

Tab Đánh giá → thêm 3 dòng với thành phần/quy định/bài/trọng số/CLO. Verify tổng % ở header cập nhật sau khi reload.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/base-syllabus-editor.js
git commit -m "feat(ui): assessment tab with quy định/bài đánh giá/CLO columns"
```

---

## Task 10: Tab 4 — Tài liệu + công cụ phân loại + yêu cầu HP

**Files:**
- Modify: [public/js/pages/base-syllabus-editor.js](../../../public/js/pages/base-syllabus-editor.js) — `renderResourcesTab`, `_collectResources`.

- [ ] **Step 1: Thay `renderResourcesTab`**

Thay [public/js/pages/base-syllabus-editor.js:409-439](../../../public/js/pages/base-syllabus-editor.js#L409-L439) bằng:

```javascript
  renderResourcesTab(body, editable, c) {
    const textbooks = Array.isArray(c.textbooks) ? c.textbooks : [];
    const references = Array.isArray(c.references) ? c.references : [];
    const tools = Array.isArray(c.tools) ? c.tools : [];
    const dis = editable ? '' : 'disabled';

    body.innerHTML = `
      <div style="max-width:820px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Tài liệu phục vụ học phần (mục 15)</h3>
        <div class="input-group"><label>Tài liệu/giáo trình chính (mỗi dòng = 1 tài liệu)</label>
          <textarea id="bs-textbooks" ${dis} rows="3" placeholder="Tên sách, Tác giả, NXB">${textbooks.join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Tài liệu tham khảo/bổ sung (mỗi dòng = 1 tài liệu)</label>
          <textarea id="bs-references" ${dis} rows="3">${references.join('\n')}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:20px 0 8px;">Các công cụ theo lĩnh vực</h4>
        <div id="bs-tools-container">
          ${tools.map((t, i) => this._toolCategoryHtml(t, i, editable, dis)).join('')}
        </div>
        ${editable ? '<button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="window.BaseSyllabusEditorPage.addToolCategory()">+ Thêm lĩnh vực</button>' : ''}

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Các yêu cầu của HP (mục 17)</h4>
        <div class="input-group">
          <textarea id="bs-other-req" ${dis} rows="3" placeholder="Yêu cầu khác (nếu có)">${c.other_requirements || ''}</textarea>
        </div>
      </div>
    `;
  },

  _toolCategoryHtml(t, i, editable, dis) {
    const items = Array.isArray(t.items) ? t.items.join('\n') : '';
    return `<div class="tool-category" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:8px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;">
        <label style="font-size:12px;white-space:nowrap;">Lĩnh vực:</label>
        <input type="text" data-field="category" value="${(t.category || '').replace(/"/g,'&quot;')}" ${dis} placeholder="VD: Kỹ thuật - Công nghệ" style="flex:1;${BS_INP}">
        ${editable ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('.tool-category').remove()">✕</button>` : ''}
      </div>
      <textarea data-field="items" ${dis} rows="3" placeholder="Mỗi dòng = 1 công cụ" style="${BS_INP}">${items}</textarea>
    </div>`;
  },

  addToolCategory() {
    const container = document.getElementById('bs-tools-container');
    container.insertAdjacentHTML('beforeend', this._toolCategoryHtml({ category: '', items: [] }, container.children.length, true, ''));
  },
```

- [ ] **Step 2: Thay `_collectResources`**

Thay [public/js/pages/base-syllabus-editor.js:441-456](../../../public/js/pages/base-syllabus-editor.js#L441-L456) bằng:

```javascript
  _collectResources() {
    const textbooksEl = document.getElementById('bs-textbooks');
    if (!textbooksEl) return;
    const toArr = id => (document.getElementById(id)?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
    const toolsContainer = document.getElementById('bs-tools-container');
    const tools = toolsContainer ? Array.from(toolsContainer.querySelectorAll('.tool-category')).map(div => ({
      category: div.querySelector('[data-field="category"]').value,
      items: div.querySelector('[data-field="items"]').value.split('\n').map(s => s.trim()).filter(Boolean),
    })).filter(t => t.category || t.items.length) : [];
    this.baseSyllabus.content = {
      ...this.baseSyllabus.content,
      textbooks: toArr('bs-textbooks'),
      references: toArr('bs-references'),
      tools,
      other_requirements: document.getElementById('bs-other-req')?.value || '',
    };
    // Drop legacy v2 course_requirements if still present
    delete this.baseSyllabus.content.course_requirements;
  },
```

- [ ] **Step 3: Manual test**

Tab Tài liệu → thêm 2 lĩnh vực với items, nhập yêu cầu khác. Lưu, reload → verify hiển thị lại đầy đủ.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/base-syllabus-editor.js
git commit -m "feat(ui): resources tab with categorized tools + other requirements"
```

---

## Phase 5 — Export buttons + validation dialog

## Task 11: Export buttons + validation dialog

**Files:**
- Modify: [public/js/pages/base-syllabus-editor.js](../../../public/js/pages/base-syllabus-editor.js) — page header actions + `validateAndExport` method.

- [ ] **Step 1: Thêm 2 nút Export vào page header**

Sửa [public/js/pages/base-syllabus-editor.js:63-66](../../../public/js/pages/base-syllabus-editor.js#L63-L66) (phần `page-header-actions`) thành:

```javascript
          <div class="page-header-actions" style="display:flex;gap:8px;">
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.saveAll()">Lưu tất cả</button>' : ''}
            <button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.validateAndExport('pdf')">Xuất PDF</button>
            <button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.validateAndExport('docx')">Xuất DOCX</button>
          </div>
```

- [ ] **Step 2: Thêm method `validateAndExport`**

Sau `saveAll` ([public/js/pages/base-syllabus-editor.js:486](../../../public/js/pages/base-syllabus-editor.js#L486)), thêm:

```javascript
  async validateAndExport(format) {
    try {
      const v = await fetch(`/api/courses/${this.courseId}/base-syllabus/validate`, { method: 'POST' }).then(r => r.json());
      if (!v.ok) {
        const list = v.issues.map(i => `• ${i.message}`).join('<br>');
        const proceed = await window.ui.confirm({
          title: 'Đề cương chưa đầy đủ',
          message: `Còn các vấn đề sau:<br>${list}<br><br>Bạn vẫn muốn xuất?`,
          confirmText: 'Xuất dù vậy', cancelText: 'Hủy', tone: 'warning',
        });
        if (!proceed) return;
      }
      const url = `/api/courses/${this.courseId}/base-syllabus/export.${format}`;
      window.open(url, '_blank');
    } catch (e) { window.toast.error(e.message); }
  },
```

- [ ] **Step 3: Manual test**

Mở base syllabus của 1 HP chưa đầy đủ → bấm "Xuất PDF" → verify dialog hiển thị danh sách lỗi. Bấm "Hủy" → không mở tab mới. Bấm "Xuất dù vậy" → tab mới mở (sẽ 404 tạm thời vì endpoint chưa có — OK, test ở Task 13/15).

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/base-syllabus-editor.js
git commit -m "feat(ui): export buttons with validation dialog"
```

---

## Phase 6 — Render model + PDF export

## Task 12: Build render model helper

**Files:**
- Create: `server/render/render-model.js` — pure function `buildRenderModel(pool, courseId)`.

- [ ] **Step 1: Tạo module**

Tạo `server/render/render-model.js`:

```javascript
const { upgradeContent } = require('./content-upgrade');

async function buildRenderModel(pool, courseId) {
  const courseRes = await pool.query(
    `SELECT c.*, d.name as dept_name, d.code as dept_code
     FROM courses c LEFT JOIN departments d ON c.department_id = d.id
     WHERE c.id = $1`, [courseId]
  );
  if (!courseRes.rows.length) throw new Error('Course not found: ' + courseId);
  const co = courseRes.rows[0];

  const bsRes = await pool.query('SELECT content FROM course_base_syllabi WHERE course_id = $1', [courseId]);
  const rawContent = bsRes.rows.length
    ? (typeof bsRes.rows[0].content === 'string' ? JSON.parse(bsRes.rows[0].content) : bsRes.rows[0].content)
    : {};
  const content = upgradeContent(rawContent);

  const closRes = await pool.query('SELECT * FROM base_syllabus_clos WHERE course_id = $1 ORDER BY code', [courseId]);
  const clos = [];
  for (const clo of closRes.rows) {
    const plos = await pool.query(
      `SELECT vp.code, vp.description FROM base_clo_plo_map m
       JOIN version_plos vp ON vp.id = m.plo_id WHERE m.base_clo_id = $1 ORDER BY vp.code`, [clo.id]
    );
    const pis = await pool.query(
      `SELECT pp.code, pp.description FROM base_clo_pi_map m
       JOIN plo_pis pp ON pp.id = m.pi_id WHERE m.base_clo_id = $1 ORDER BY pp.code`, [clo.id]
    );
    clos.push({
      code: clo.code,
      description: clo.description,
      bloom_level: clo.bloom_level,
      plo_codes: plos.rows.map(r => r.code),
      pi_codes: pis.rows.map(r => r.code),
    });
  }

  // PLO matrix row for mục 9 (trích ngang từ canonical version)
  let plo_matrix = { plo_codes: [], pi_codes: [], cell_values: {} };
  if (co.canonical_version_id) {
    const plos = await pool.query('SELECT code FROM version_plos WHERE version_id = $1 ORDER BY code', [co.canonical_version_id]);
    const pis = await pool.query(
      `SELECT pp.code, pp.plo_id FROM plo_pis pp
       JOIN version_plos vp ON vp.id = pp.plo_id
       WHERE vp.version_id = $1 ORDER BY pp.code`, [co.canonical_version_id]
    );
    plo_matrix.plo_codes = plos.rows.map(r => r.code);
    plo_matrix.pi_codes = pis.rows.map(r => r.code);
    // Build cell values: for each PI column, highest bloom level of CLO mapping to that PI, else '-'
    for (const piCode of plo_matrix.pi_codes) {
      const mapped = clos.filter(c => c.pi_codes.includes(piCode));
      plo_matrix.cell_values[piCode] = mapped.length
        ? Math.max(...mapped.map(c => c.bloom_level || 1)).toString()
        : '-';
    }
  }

  // Assessment groups (group by component)
  const assessments = Array.isArray(content.assessment_methods) ? content.assessment_methods : [];
  const groupsMap = new Map();
  for (const a of assessments) {
    const key = a.component || '';
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key).push(a);
  }
  const assessment_groups = Array.from(groupsMap.entries()).map(([component, items]) => ({ component, items }));

  // Self-study derived from outline
  const outline = Array.isArray(content.course_outline) ? content.course_outline : [];
  const self_study = outline.map(l => ({
    lesson: l.lesson, title: l.title,
    hours: l.self_study_hours || 0,
    tasks: Array.isArray(l.self_study_tasks) ? l.self_study_tasks : [],
  }));

  const outline_totals = outline.reduce((acc, l) => ({
    lt: acc.lt + (l.lt_hours || 0),
    th: acc.th + (l.th_hours || 0),
  }), { lt: 0, th: 0 });

  const creditsDisplay = `${co.credits || 0} (${co.credits_theory || 0}, ${co.credits_practice || 0}) TC`;
  const facultyName = co.dept_name || '';

  return {
    form_code: 'BM03/QT2b/DBCL',
    faculty: facultyName,
    course: {
      code: co.code,
      name_vi: co.name,
      name_en: co.name_en,
      knowledge_area: co.knowledge_area,
      course_requirement: co.course_requirement,
      training_level: co.training_level || 'Đại học',
      credits_display: creditsDisplay,
      prerequisites: content.prerequisites || '',
      managing_unit: facultyName,
      objectives: content.course_objectives || '',
      description: content.course_description || '',
      language_instruction: content.language_instruction || '',
    },
    teaching_methods: Array.isArray(content.teaching_methods) ? content.teaching_methods : [],
    plo_matrix,
    clos,
    outline: outline.map(l => ({
      lesson: l.lesson, title: l.title,
      lt_hours: l.lt_hours || 0, th_hours: l.th_hours || 0,
      topics: Array.isArray(l.topics) ? l.topics : [],
      teaching_methods: l.teaching_methods || '',
      clo_codes: Array.isArray(l.clo_codes) ? l.clo_codes : [],
    })),
    outline_totals,
    assessment_groups,
    resources: {
      textbooks: Array.isArray(content.textbooks) ? content.textbooks : [],
      references: Array.isArray(content.references) ? content.references : [],
      tools: Array.isArray(content.tools) ? content.tools : [],
    },
    self_study,
    other_requirements: content.other_requirements || '',
    signatures: { date: '', khoa_vien: '', nganh: '', nguoi_bien_soan: '' },
  };
}

module.exports = { buildRenderModel };
```

- [ ] **Step 2: Thêm endpoint debug `GET .../render-model`**

Sau `POST .../validate` (endpoint đã thêm ở Task 5), thêm:

```javascript
const { buildRenderModel } = require('./server/render/render-model');

app.get('/api/courses/:courseId/base-syllabus/render-model', authMiddleware, requirePerm('courses.view'), async (req, res) => {
  try {
    const model = await buildRenderModel(pool, parseInt(req.params.courseId));
    res.json(model);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

Đặt require lên đầu file server.js gần các require khác (không trong route handler).

- [ ] **Step 3: Smoke test**

```bash
node --check server/render/render-model.js
node --check server.js
```
Expected: exit 0 cả 2.

Restart, gọi:

```bash
curl http://localhost:3600/api/courses/3/base-syllabus/render-model -b "token=<TOKEN>" | jq '.course, .outline_totals, (.clos | length)'
```
Expected: object có đủ field `course`, `outline_totals` và số CLO.

- [ ] **Step 4: Commit**

```bash
git add server/render/render-model.js server.js
git commit -m "feat(api): buildRenderModel + render-model debug endpoint"
```

---

## Task 13: Install Puppeteer + Dockerfile + PDF endpoint

**Files:**
- Modify: [package.json](../../../package.json) — add `puppeteer` and `ejs` deps.
- Modify: [Dockerfile](../../../Dockerfile) — install chromium system package.
- Create: `server/render/pdf-template.ejs` — HTML template.
- Modify: [server.js](../../../server.js) — PDF endpoint.

- [ ] **Step 1: Install deps**

```bash
npm install puppeteer ejs
```

**Note:** Repo tracks `node_modules` — đây là expected (see memory). Commit cùng với code sử dụng nó.

- [ ] **Step 2: Update Dockerfile**

Mở [Dockerfile](../../../Dockerfile). Thêm lệnh cài `chromium` (location phụ thuộc base image). Ví dụ nếu dùng `node:20-slim`:

```dockerfile
# Install Chromium for Puppeteer (after existing apt-get installs or as new RUN)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium chromium-sandbox \
    fonts-liberation \
 && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium (skip download)
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

Đặt ở vị trí phù hợp với base image hiện có. Nếu Dockerfile hiện dùng `alpine`, thay package name thành `chromium chromium-chromedriver ttf-freefont` và điều chỉnh path tương ứng.

- [ ] **Step 3: Tạo template EJS**

Tạo `server/render/pdf-template.ejs`. Đây là bản rút gọn — render đầy đủ 17 mục trong table chính:

```html
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title><%= course.code %> — Đề cương chi tiết</title>
  <style>
    @page { size: A4; margin: 20mm 15mm 20mm 20mm; }
    body { font-family: 'Times New Roman', serif; font-size: 12pt; color: #000; }
    .form-code { text-align: right; font-style: italic; }
    .title { text-align: center; font-size: 16pt; font-weight: bold; margin: 16px 0; }
    .school { text-align: center; font-weight: bold; }
    .faculty { text-align: center; font-weight: bold; text-decoration: underline; }
    table { border-collapse: collapse; width: 100%; margin-top: 6px; }
    td, th { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
    .no-border td { border: none; }
    .signatures { margin-top: 40px; display: flex; justify-content: space-between; text-align: center; font-weight: bold; }
    .right-italic { text-align: right; font-style: italic; margin-top: 20px; }
    .section-num { font-weight: bold; }
    ul { margin: 0; padding-left: 20px; }
  </style>
</head>
<body>
  <div class="form-code"><%= form_code %></div>
  <div class="school">TRƯỜNG ĐẠI HỌC CÔNG NGHỆ TP. HCM</div>
  <div class="faculty"><%= (faculty || '').toUpperCase() %></div>
  <div class="title">ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN</div>

  <table>
    <tr><td style="width:160px;"><span class="section-num">1.</span> Tên học phần</td>
      <td>
        Tên tiếng Việt: <strong><%= (course.name_vi || '').toUpperCase() %></strong><br>
        Tên tiếng Anh: <strong><%= course.name_en || '' %></strong>
      </td></tr>
    <tr><td><span class="section-num">2.</span> Mã học phần</td><td><%= course.code || '' %></td></tr>
    <tr><td><span class="section-num">3.</span> Thuộc khối kiến thức</td>
      <td>
        <% const isGeneral = course.knowledge_area === 'general'; const isProf = course.knowledge_area === 'professional'; const isReq = course.course_requirement === 'required'; const isElec = course.course_requirement === 'elective'; %>
        <table style="margin:0;">
          <tr>
            <th colspan="2">Kiến thức GD đại cương</th><th colspan="2">Kiến thức GD chuyên nghiệp</th>
          </tr>
          <tr>
            <td><%= isGeneral && isReq ? '☑' : '☐' %> Bắt buộc</td>
            <td><%= isGeneral && isElec ? '☑' : '☐' %> Tự chọn</td>
            <td><%= isProf && isReq ? '☑' : '☐' %> Bắt buộc</td>
            <td><%= isProf && isElec ? '☑' : '☐' %> Tự chọn</td>
          </tr>
        </table>
      </td></tr>
    <tr><td><span class="section-num">4.</span> Trình độ đào tạo</td><td><%= course.training_level || '' %></td></tr>
    <tr><td><span class="section-num">5.</span> Số tín chỉ</td><td><%= course.credits_display %></td></tr>
    <tr><td><span class="section-num">6.</span> Học phần học trước</td><td><%= course.prerequisites || '' %></td></tr>
    <tr><td><span class="section-num">7.</span> Mục tiêu của học phần</td><td><%- (course.objectives || '').replace(/\n/g, '<br>') %></td></tr>
    <tr><td><span class="section-num">8.</span> Đơn vị quản lý học phần</td><td><%= course.managing_unit || '' %></td></tr>
  </table>

  <p><span class="section-num">9.</span> Bảng trích ngang ma trận sự đóng góp của mỗi học phần cho CĐR của CTĐT</p>
  <% if (plo_matrix.pi_codes.length) { %>
  <table>
    <tr><th rowspan="2">Mã HP</th><th rowspan="2">Học phần</th><% plo_matrix.plo_codes.forEach(function(plo){ %><th colspan="<%= plo_matrix.pi_codes.filter(function(pi){return pi.indexOf(plo.replace('PLO','')+'.')===-1 ? false : true;}).length || 1 %>"><%= plo %></th><% }) %></tr>
    <tr><% plo_matrix.pi_codes.forEach(function(pi){ %><th style="font-size:10pt;"><%= pi %></th><% }) %></tr>
    <tr>
      <td><%= course.code %></td><td><%= course.name_vi %></td>
      <% plo_matrix.pi_codes.forEach(function(pi){ %><td style="text-align:center;"><%= plo_matrix.cell_values[pi] %></td><% }) %>
    </tr>
  </table>
  <% } else { %><p><em>(Chưa có CTĐT chuẩn để trích ma trận)</em></p><% } %>

  <p><span class="section-num">10.</span> Chuẩn đầu ra của học phần (CLO)</p>
  <table>
    <tr><th>Chuẩn đầu ra học phần (Course Learning Outcome)</th><th>Chỉ số đo lường (PI)</th><th>Tương ứng CĐR CTĐT</th></tr>
    <% clos.forEach(function(c){ %>
    <tr>
      <td>- <strong><%= c.code %>:</strong> <%= c.description %></td>
      <td style="text-align:center;"><%= c.pi_codes.join(', ') %></td>
      <td style="text-align:center;"><%= c.plo_codes.join(', ') %></td>
    </tr>
    <% }) %>
  </table>

  <p><span class="section-num">11.</span> Mô tả tóm tắt nội dung học phần</p>
  <p><%- (course.description || '').replace(/\n/g, '<br>') %></p>

  <p><span class="section-num">12.</span> Phương pháp, hình thức tổ chức dạy học của học phần</p>
  <table>
    <tr><th style="width:35%;">Phương pháp</th><th>Mục tiêu</th></tr>
    <% teaching_methods.forEach(function(t){ %><tr><td><%= t.method %></td><td><%= t.objective %></td></tr><% }) %>
  </table>

  <p><span class="section-num">13.</span> Nội dung chi tiết học phần</p>
  <table>
    <tr><th>BÀI SỐ</th><th>TÊN BÀI</th><th style="width:60px;">LT</th><th style="width:60px;">TH</th><th>Phương pháp, hình thức tổ chức dạy học</th><th style="width:80px;">Đáp ứng CĐR của HP</th></tr>
    <% outline.forEach(function(l){ %>
    <tr>
      <td style="text-align:center;"><strong>BÀI <%= l.lesson %></strong></td>
      <td><strong><%= l.title %></strong><% if (l.topics.length){ %><ul><% l.topics.forEach(function(t){ %><li><%= t %></li><% }) %></ul><% } %></td>
      <td style="text-align:center;"><%= l.lt_hours %></td>
      <td style="text-align:center;"><%= l.th_hours %></td>
      <td><%- (l.teaching_methods || '').replace(/\n/g,'<br>') %></td>
      <td style="text-align:center;"><%= l.clo_codes.join('<br>') %></td>
    </tr>
    <% }) %>
    <tr><td colspan="2" style="text-align:right;"><strong>TỔNG CỘNG:</strong></td><td style="text-align:center;"><strong><%= outline_totals.lt %></strong></td><td style="text-align:center;"><strong><%= outline_totals.th %></strong></td><td colspan="2"></td></tr>
  </table>

  <p><span class="section-num">14.</span> Phương pháp kiểm tra/đánh giá của học phần</p>
  <table>
    <tr><th>Điểm thành phần</th><th>Quy định</th><th>Bài đánh giá</th><th>Trọng số</th><th>Đáp ứng CĐR của HP</th></tr>
    <% assessment_groups.forEach(function(g){ g.items.forEach(function(it, idx){ %>
    <tr>
      <% if (idx === 0){ %><td rowspan="<%= g.items.length %>"><%= g.component %></td><% } %>
      <td><%= it.description %></td>
      <td><%= it.task_ref %></td>
      <td style="text-align:center;"><%= it.weight %>%</td>
      <td style="text-align:center;"><%= (it.clo_codes || []).join('<br>') %></td>
    </tr>
    <% }) }) %>
  </table>

  <p><span class="section-num">15.</span> Tài liệu phục vụ học phần</p>
  <table>
    <tr><td style="width:200px;">Tài liệu/giáo trình chính</td>
      <td><% resources.textbooks.forEach(function(t, i){ %><%= (i+1) %>. <%= t %><br><% }) %></td></tr>
    <tr><td>Tài liệu tham khảo/bổ sung</td>
      <td><% resources.references.forEach(function(t, i){ %><%= (i+1) %>. <%= t %><br><% }) %></td></tr>
    <tr><td>Các công cụ</td>
      <td><% resources.tools.forEach(function(g){ %>- <strong><%= g.category %>:</strong> <%= g.items.join(', ') %><br><% }) %></td></tr>
  </table>

  <p><span class="section-num">16.</span> Hướng dẫn sinh viên tự học</p>
  <table>
    <tr><th>Nội dung</th><th style="width:80px;">Số tiết</th><th>Nhiệm vụ của sinh viên</th></tr>
    <% self_study.forEach(function(s){ %>
    <tr>
      <td><strong>BÀI <%= s.lesson %>: <%= s.title %></strong></td>
      <td style="text-align:center;"><%= s.hours %></td>
      <td><% s.tasks.forEach(function(t){ %><%= t %><br><% }) %></td>
    </tr>
    <% }) %>
  </table>

  <p><span class="section-num">17.</span> Các yêu cầu của HP</p>
  <p><%- (other_requirements || '').replace(/\n/g,'<br>') %></p>

  <div class="right-italic">TP. Hồ Chí Minh, ngày… tháng… năm <%= new Date().getFullYear() %></div>
  <div class="signatures">
    <div style="flex:1;">Trưởng khoa/viện</div>
    <div style="flex:1;">Trưởng ngành/bộ môn</div>
    <div style="flex:1;">Người biên soạn</div>
  </div>
</body>
</html>
```

- [ ] **Step 4: Thêm PDF endpoint vào server.js**

Thêm require lên đầu:

```javascript
const ejs = require('ejs');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
```

Sau endpoint `render-model` (Task 12), thêm:

```javascript
app.get('/api/courses/:courseId/base-syllabus/export.pdf', authMiddleware, requirePerm('courses.view'), async (req, res) => {
  let browser;
  try {
    const model = await buildRenderModel(pool, parseInt(req.params.courseId));
    const tpl = fs.readFileSync(path.join(__dirname, 'server', 'render', 'pdf-template.ejs'), 'utf8');
    const html = ejs.render(tpl, model);

    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '15mm' },
      printBackground: true,
    });
    await browser.close();

    const fname = `${model.course.code || 'course'}_de-cuong.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${fname}"`);
    res.end(pdf);
  } catch (e) {
    if (browser) await browser.close().catch(() => {});
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 5: Smoke test**

```bash
node --check server.js
```
Expected: exit 0.

Rebuild Docker (`make down && make up` hoặc `docker compose build app`). Sau khi app up:

```bash
curl -o /tmp/test.pdf http://localhost:3600/api/courses/3/base-syllabus/export.pdf -b "token=<TOKEN>"
file /tmp/test.pdf
```
Expected: file type `PDF document`. Mở file bằng PDF viewer, verify 17 mục hiển thị đầy đủ.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json node_modules server.js server/render/pdf-template.ejs Dockerfile
git commit -m "feat(export): PDF export via Puppeteer + EJS template"
```

---

## Phase 7 — DOCX export

## Task 14: Install docx + DOCX builder + endpoint

**Files:**
- Modify: [package.json](../../../package.json) — add `docx`.
- Create: `server/render/docx-builder.js` — build DOCX from render model.
- Modify: [server.js](../../../server.js) — DOCX endpoint.

- [ ] **Step 1: Install dep**

```bash
npm install docx
```

- [ ] **Step 2: Tạo builder**

Tạo `server/render/docx-builder.js`:

```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle, HeightRule } = require('docx');

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: opts.before || 0, after: opts.after || 0 },
    children: [new TextRun({ text: String(text || ''), bold: !!opts.bold, italics: !!opts.italic, size: opts.size || 22 })],
  });
}

function tc(children, opts = {}) {
  const kids = Array.isArray(children) ? children : [children];
  const paras = kids.map(k => typeof k === 'string' ? p(k, { size: 22 }) : k);
  return new TableCell({
    children: paras,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shading ? { fill: opts.shading } : undefined,
    columnSpan: opts.colSpan,
    rowSpan: opts.rowSpan,
  });
}

function row(cells) { return new TableRow({ children: cells }); }

function buildDocx(model) {
  const children = [];

  children.push(p(model.form_code, { align: AlignmentType.RIGHT, italic: true }));
  children.push(p('TRƯỜNG ĐẠI HỌC CÔNG NGHỆ TP. HCM', { align: AlignmentType.CENTER, bold: true }));
  children.push(p((model.faculty || '').toUpperCase(), { align: AlignmentType.CENTER, bold: true }));
  children.push(p('ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN', { align: AlignmentType.CENTER, bold: true, size: 32, before: 200, after: 200 }));

  // Main info table (mục 1-8)
  const isGen = model.course.knowledge_area === 'general';
  const isProf = model.course.knowledge_area === 'professional';
  const isReq = model.course.course_requirement === 'required';
  const isElec = model.course.course_requirement === 'elective';
  const chk = b => b ? '☑' : '☐';
  const mainTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([tc('1. Tên học phần', { width: 20 }), tc([p(`Tên tiếng Việt: ${model.course.name_vi || ''}`, { bold: true }), p(`Tên tiếng Anh: ${model.course.name_en || ''}`, { bold: true })])]),
      row([tc('2. Mã học phần'), tc(model.course.code || '')]),
      row([tc('3. Thuộc khối kiến thức'), tc(`${chk(isGen && isReq)} GD đại cương - Bắt buộc   ${chk(isGen && isElec)} GD đại cương - Tự chọn   ${chk(isProf && isReq)} GD chuyên nghiệp - Bắt buộc   ${chk(isProf && isElec)} GD chuyên nghiệp - Tự chọn`)]),
      row([tc('4. Trình độ đào tạo'), tc(model.course.training_level || '')]),
      row([tc('5. Số tín chỉ'), tc(model.course.credits_display || '')]),
      row([tc('6. Học phần học trước'), tc(model.course.prerequisites || '')]),
      row([tc('7. Mục tiêu của học phần'), tc(model.course.objectives || '')]),
      row([tc('8. Đơn vị quản lý học phần'), tc(model.course.managing_unit || '')]),
    ],
  });
  children.push(mainTable);

  // Mục 9 - PLO matrix
  children.push(p('9. Bảng trích ngang ma trận sự đóng góp của mỗi học phần cho CĐR của CTĐT', { bold: true, before: 200 }));
  if (model.plo_matrix.pi_codes.length) {
    const headerRow = row([tc('Mã HP'), tc('Học phần'), ...model.plo_matrix.pi_codes.map(pi => tc(pi))]);
    const dataRow = row([tc(model.course.code || ''), tc(model.course.name_vi || ''), ...model.plo_matrix.pi_codes.map(pi => tc(model.plo_matrix.cell_values[pi] || '-'))]);
    children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [headerRow, dataRow] }));
  } else {
    children.push(p('(Chưa có CTĐT chuẩn để trích ma trận)', { italic: true }));
  }

  // Mục 10 — CLO
  children.push(p('10. Chuẩn đầu ra của học phần (CLO)', { bold: true, before: 200 }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([tc(p('Chuẩn đầu ra học phần', { bold: true })), tc(p('PI', { bold: true })), tc(p('PLO', { bold: true }))]),
      ...model.clos.map(c => row([
        tc(`- ${c.code}: ${c.description || ''}`),
        tc(c.pi_codes.join(', ')),
        tc(c.plo_codes.join(', ')),
      ])),
    ],
  }));

  // Mục 11
  children.push(p('11. Mô tả tóm tắt nội dung học phần', { bold: true, before: 200 }));
  children.push(p(model.course.description || ''));

  // Mục 12
  children.push(p('12. Phương pháp, hình thức tổ chức dạy học của học phần', { bold: true, before: 200 }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([tc(p('Phương pháp', { bold: true })), tc(p('Mục tiêu', { bold: true }))]),
      ...model.teaching_methods.map(t => row([tc(t.method), tc(t.objective)])),
    ],
  }));

  // Mục 13 — outline
  children.push(p('13. Nội dung chi tiết học phần', { bold: true, before: 200 }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([tc(p('Bài số', { bold: true })), tc(p('Tên bài', { bold: true })), tc(p('LT', { bold: true })), tc(p('TH', { bold: true })), tc(p('Phương pháp', { bold: true })), tc(p('CĐR của HP', { bold: true }))]),
      ...model.outline.map(l => row([
        tc(`BÀI ${l.lesson}`),
        tc([p(l.title, { bold: true }), ...l.topics.map(t => p('• ' + t))]),
        tc(String(l.lt_hours)),
        tc(String(l.th_hours)),
        tc(l.teaching_methods || ''),
        tc(l.clo_codes.join('\n')),
      ])),
      row([tc(p('TỔNG CỘNG:', { bold: true }), { colSpan: 2 }), tc(p(String(model.outline_totals.lt), { bold: true })), tc(p(String(model.outline_totals.th), { bold: true })), tc(''), tc('')]),
    ],
  }));

  // Mục 14
  children.push(p('14. Phương pháp kiểm tra/đánh giá của học phần', { bold: true, before: 200 }));
  const assessmentRows = [row([tc(p('Điểm thành phần', { bold: true })), tc(p('Quy định', { bold: true })), tc(p('Bài đánh giá', { bold: true })), tc(p('Trọng số', { bold: true })), tc(p('CĐR', { bold: true }))])];
  model.assessment_groups.forEach(g => {
    g.items.forEach((it, idx) => {
      const cells = [];
      if (idx === 0) cells.push(tc(g.component, { rowSpan: g.items.length }));
      cells.push(tc(it.description || ''));
      cells.push(tc(it.task_ref || ''));
      cells.push(tc(it.weight + '%'));
      cells.push(tc((it.clo_codes || []).join(', ')));
      assessmentRows.push(row(cells));
    });
  });
  children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: assessmentRows }));

  // Mục 15
  children.push(p('15. Tài liệu phục vụ học phần', { bold: true, before: 200 }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([tc('Tài liệu/giáo trình chính', { width: 25 }), tc(model.resources.textbooks.map((t, i) => `${i+1}. ${t}`).join('\n') || '')]),
      row([tc('Tài liệu tham khảo/bổ sung'), tc(model.resources.references.map((t, i) => `${i+1}. ${t}`).join('\n') || '')]),
      row([tc('Các công cụ'), tc(model.resources.tools.map(g => `- ${g.category}: ${g.items.join(', ')}`).join('\n') || '')]),
    ],
  }));

  // Mục 16
  children.push(p('16. Hướng dẫn sinh viên tự học', { bold: true, before: 200 }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([tc(p('Nội dung', { bold: true })), tc(p('Số tiết', { bold: true })), tc(p('Nhiệm vụ của sinh viên', { bold: true }))]),
      ...model.self_study.map(s => row([tc(`BÀI ${s.lesson}: ${s.title}`), tc(String(s.hours)), tc(s.tasks.join('\n'))])),
    ],
  }));

  // Mục 17
  children.push(p('17. Các yêu cầu của HP', { bold: true, before: 200 }));
  children.push(p(model.other_requirements || ''));

  // Signatures
  children.push(p(`TP. Hồ Chí Minh, ngày… tháng… năm ${new Date().getFullYear()}`, { align: AlignmentType.RIGHT, italic: true, before: 400 }));
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE }, insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE } },
    rows: [row([
      tc(p('Trưởng khoa/viện', { bold: true, align: AlignmentType.CENTER })),
      tc(p('Trưởng ngành/bộ môn', { bold: true, align: AlignmentType.CENTER })),
      tc(p('Người biên soạn', { bold: true, align: AlignmentType.CENTER })),
    ])],
  }));

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

module.exports = { buildDocx };
```

- [ ] **Step 3: DOCX endpoint**

Thêm require lên đầu server.js:

```javascript
const { buildDocx } = require('./server/render/docx-builder');
```

Sau PDF endpoint, thêm:

```javascript
app.get('/api/courses/:courseId/base-syllabus/export.docx', authMiddleware, requirePerm('courses.view'), async (req, res) => {
  try {
    const model = await buildRenderModel(pool, parseInt(req.params.courseId));
    const buf = await buildDocx(model);
    const fname = `${model.course.code || 'course'}_de-cuong.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${fname}"`);
    res.end(buf);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 4: Smoke test**

```bash
node --check server/render/docx-builder.js
node --check server.js
```

Restart, gọi:

```bash
curl -o /tmp/test.docx http://localhost:3600/api/courses/3/base-syllabus/export.docx -b "token=<TOKEN>"
file /tmp/test.docx
```
Expected: file type `Microsoft Word 2007+`. Mở bằng LibreOffice/Word, verify 17 mục.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json node_modules server.js server/render/docx-builder.js
git commit -m "feat(export): DOCX export via docx library"
```

---

## Phase 8 — Smoke test + verification

## Task 15: Smoke test script + manual checklist

**Files:**
- Create: `scripts/smoke-base-syllabus.js` — end-to-end smoke test.

- [ ] **Step 1: Tạo smoke script**

Tạo `scripts/smoke-base-syllabus.js`:

```javascript
// Smoke test for base syllabus full template endpoints.
// Usage: TOKEN=<jwt> COURSE_ID=3 VERSION_ID=5 PLO_ID=10 PI_ID=20 node scripts/smoke-base-syllabus.js

const http = require('http');

const BASE = process.env.BASE_URL || 'http://localhost:3600';
const TOKEN = process.env.TOKEN;
const COURSE_ID = parseInt(process.env.COURSE_ID || '3');
const VERSION_ID = parseInt(process.env.VERSION_ID || '0');
const PLO_ID = parseInt(process.env.PLO_ID || '0');
const PI_ID = parseInt(process.env.PI_ID || '0');

if (!TOKEN) { console.error('Set TOKEN env var'); process.exit(1); }

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Cookie': `token=${TOKEN}`, 'Content-Type': 'application/json' },
    };
    const r = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, body: buf, json: () => { try { return JSON.parse(buf.toString()); } catch (_) { return null; } } });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function expect(label, promise, check) {
  const r = await promise;
  const ok = check(r);
  console.log(`${ok ? '✓' : '✗'} ${label} (status ${r.status})`);
  if (!ok) { console.log('  body:', r.body.toString().substring(0, 200)); process.exitCode = 1; }
  return r;
}

(async () => {
  // 1. GET base syllabus returns v3 content
  await expect('GET base-syllabus upgrades to v3', req('GET', `/api/courses/${COURSE_ID}/base-syllabus`),
    r => r.status === 200 && (r.json()?.content?._schema_version === 3 || r.status === 404));

  // 2. PUT course with master fields
  if (VERSION_ID) {
    await expect('PUT course master fields', req('PUT', `/api/courses/${COURSE_ID}`, {
      name_en: 'Smoke Test Course', knowledge_area: 'professional', course_requirement: 'required',
      training_level: 'Đại học', canonical_version_id: VERSION_ID,
    }), r => r.status === 200 && r.json()?.name_en === 'Smoke Test Course');
  }

  // 3. CLO + mappings
  const cloRes = await expect('POST base CLO', req('POST', `/api/courses/${COURSE_ID}/base-syllabus/clos`, {
    code: 'CLO_SMOKE', description: 'Smoke test CLO', bloom_level: 2,
  }), r => r.status === 200 && r.json()?.id);
  const cloId = cloRes.json().id;

  if (PLO_ID && PI_ID) {
    await expect('PUT CLO mappings', req('PUT', `/api/base-clos/${cloId}/mappings`, {
      plo_ids: [PLO_ID], pi_ids: [PI_ID],
    }), r => r.status === 200);
    await expect('GET CLO mappings', req('GET', `/api/base-clos/${cloId}/mappings`),
      r => r.status === 200 && r.json()?.plo_ids?.includes(PLO_ID));
  }

  // 4. Validate
  await expect('POST validate', req('POST', `/api/courses/${COURSE_ID}/base-syllabus/validate`),
    r => r.status === 200 && typeof r.json()?.ok === 'boolean');

  // 5. Render model
  await expect('GET render-model', req('GET', `/api/courses/${COURSE_ID}/base-syllabus/render-model`),
    r => r.status === 200 && r.json()?.course?.code);

  // 6. PDF export
  await expect('GET export.pdf', req('GET', `/api/courses/${COURSE_ID}/base-syllabus/export.pdf`),
    r => r.status === 200 && r.body.slice(0, 4).toString() === '%PDF');

  // 7. DOCX export
  await expect('GET export.docx', req('GET', `/api/courses/${COURSE_ID}/base-syllabus/export.docx`),
    r => r.status === 200 && r.body.slice(0, 2).toString('hex') === '504b');  // ZIP magic (DOCX is ZIP)

  // Cleanup
  await req('DELETE', `/api/base-clos/${cloId}`);
  console.log('\nSmoke test complete.');
})();
```

- [ ] **Step 2: Chạy smoke test**

Login bằng browser, copy cookie `token`. Lấy `PLO_ID` và `PI_ID` của canonical version:

```bash
docker exec -i program-db psql -U program -d program_db -c "SELECT id, code FROM version_plos WHERE version_id = 5 LIMIT 3;"
docker exec -i program-db psql -U program -d program_db -c "SELECT pp.id, pp.code FROM plo_pis pp JOIN version_plos vp ON vp.id = pp.plo_id WHERE vp.version_id = 5 LIMIT 3;"
```

Sau đó:

```bash
TOKEN="<jwt>" COURSE_ID=3 VERSION_ID=5 PLO_ID=10 PI_ID=20 node scripts/smoke-base-syllabus.js
```
Expected: tất cả `✓`, `Smoke test complete.`.

- [ ] **Step 3: Manual test checklist — tạo 1 HP đối chiếu AIT129.pdf**

Trong browser:

1. Tạo/chọn 1 HP mới (VD mã `SMOKE01`, tên `Test Smoke`).
2. Vào base syllabus editor:
   - **Tab Thông tin chung:** nhập tên Việt/Anh, chọn khối kiến thức (GD đại cương → Bắt buộc), trình độ "Đại học", chọn CTĐT chuẩn, nhập HP tiên quyết, ngôn ngữ "Tiếng Việt", mục tiêu, mô tả, 3 dòng phương pháp dạy học.
   - **Tab CLO:** thêm 4 CLO với PLO/PI mapping (mô phỏng CLO1→PI6.04/PLO6, CLO4→PI1.01/PLO1 như AIT129).
   - **Tab Nội dung giảng dạy:** thêm 6 bài với LT/TH khác nhau, CLO codes, tự học tasks.
   - **Tab Đánh giá:** 4 dòng với `component` trùng nhau để test group (VD 3 dòng "Điểm đánh giá quá trình" + 1 dòng "Điểm thi kết thúc HP", tổng = 100%).
   - **Tab Tài liệu:** nhập 2 textbook, 3 reference, 3 category tools, 1 dòng other_requirements.
3. Lưu tất cả.
4. Reload trang, verify tất cả field giữ nguyên.
5. Bấm **Xuất PDF** → tab mới mở PDF → so sánh cấu trúc 17 mục với [AIT129.pdf](../../../AIT129.pdf).
6. Bấm **Xuất DOCX** → download file, mở bằng Word/LibreOffice → verify layout tương đương.

Checklist đạt tiêu chuẩn khi:
- [ ] 17 mục đều hiện trong PDF
- [ ] 17 mục đều hiện trong DOCX
- [ ] Tổng LT/TH cuối bảng mục 13 khớp tổng các bài
- [ ] Rowspan của mục 14 gộp đúng theo component
- [ ] Validation dialog bắt được trường hợp thiếu CLO mapping
- [ ] Content v2 cũ mở lại bằng editor, hiển thị đầy đủ sau lazy upgrade

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-base-syllabus.js
git commit -m "test: add smoke test script for base syllabus full template"
```

---

## Verification

Sau khi hoàn tất toàn bộ Phase 1-8, kiểm tra:

- [ ] Tất cả 15 task đều xanh checkbox
- [ ] `node --check db.js server.js server/render/*.js scripts/smoke-base-syllabus.js` — exit 0 toàn bộ
- [ ] Smoke test script pass
- [ ] Manual checklist (Task 15 Step 3) pass
- [ ] Container startup clean (`docker compose logs app` không có error)
- [ ] So sánh PDF output với [AIT129.pdf](../../../AIT129.pdf) — layout 17 mục khớp

---

## Notes

**Dependencies node_modules:** Repo tracks `node_modules` trong git. Khi thêm `puppeteer` + `docx` + `ejs` sẽ tạo thousands of file diffs — đây là expected behavior của repo. Commit các file này cùng với code sử dụng (Task 13, 14).

**Docker Chromium:** Puppeteer mặc định download Chromium khi install. Đã set `PUPPETEER_SKIP_DOWNLOAD=true` trong Dockerfile để dùng system chromium, giảm image size. Env này cần được set TRƯỚC `npm install` khi build Docker image (có thể cần thêm `.npmrc` với `puppeteer_skip_download=true` nếu build order không thuận lợi).

**Upgrade v2 → v3 is idempotent:** `upgradeContent` check `_schema_version >= 3` và return nguyên vẹn → gọi nhiều lần vẫn an toàn.

**Giới hạn hiện tại:**
- PLO matrix mục 9 render đơn giản (một hàng duy nhất cho HP hiện tại); hàng ngang đầy đủ các HP khác của CTĐT là feature của tool CTĐT-level (out of scope).
- "Bản chính thức" / "Bản dự thảo" checkbox trong header in rỗng — user tự tick tay.
