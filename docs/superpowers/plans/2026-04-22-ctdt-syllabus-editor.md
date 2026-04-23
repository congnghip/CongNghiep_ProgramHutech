# CTDT Syllabus Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the CTDT syllabus editor inherit the base syllabus once, render like the base syllabus, and allow editing only sections 3, 9, and 10.

**Architecture:** Keep the existing `syllabus-editor.js` entry point, but replace its editable surface with a locked-by-default CTDT view. Avoid risky raw `PUT /api/syllabi/:id` writes by adding dedicated endpoints for CTDT section 3 and section 9, while reusing the existing syllabus CLO↔PI mapping route for section 10. Keep copied syllabus content stable after the initial base copy; do not auto-sync from the base syllabus later.

**Tech Stack:** Express.js, PostgreSQL 15, vanilla JS SPA frontend, existing syllabus/base-syllabus APIs

---

## File Structure

**Modify (3 files):**
- [server.js](/home/congnghiep/work/CongNghiep_ProgramHutech/server.js) — enrich syllabus payload, normalize base-copy paths, add CTDT-only endpoints for section 3 and section 9.
- [public/js/pages/syllabus-editor.js](/home/congnghiep/work/CongNghiep_ProgramHutech/public/js/pages/syllabus-editor.js) — replace the old wide-open editor with a locked CTDT editor that only edits sections 3, 9, and 10.
- [docs/superpowers/specs/2026-04-22-ctdt-syllabus-editor-design.md](/home/congnghiep/work/CongNghiep_ProgramHutech/docs/superpowers/specs/2026-04-22-ctdt-syllabus-editor-design.md) — reference only; do not modify unless a mismatch is found during implementation.

**Create (1 file):**
- `docs/superpowers/plans/2026-04-22-ctdt-syllabus-editor.md` — this implementation plan.

**Do not modify in this task:**
- `public/js/pages/base-syllabus-editor.js`
- `server/render/*`
- export routes

The current worktree already has unrelated edits in base-syllabus files. This plan deliberately isolates CTDT work to avoid conflicts.

---

### Task 1: Backend — enrich syllabus payload and normalize base copy

**Files:**
- Modify: [server.js](/home/congnghiep/work/CongNghiep_ProgramHutech/server.js)

- [ ] **Step 1: Extend `GET /api/syllabi/:id` with the course master fields the CTDT editor needs**

Replace the select list in `app.get('/api/syllabi/:id', ...)` so the route returns the extra course fields used to render sections `1–8` like the base syllabus:

```js
app.get('/api/syllabi/:id', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vs.*,
             c.code as course_code,
             c.name as course_name,
             c.name_en as course_name_en,
             c.credits,
             c.credits_theory,
             c.credits_practice,
             c.training_level,
             c.knowledge_area,
             c.course_requirement,
             c.is_proposed,
             u.display_name as author_name,
             d.name as dept_name,
             p.name as program_name,
             pv.academic_year,
             (cbs.id IS NOT NULL) as has_base_syllabus
      FROM version_syllabi vs
      JOIN courses c ON vs.course_id = c.id
      LEFT JOIN users u ON vs.author_id = u.id
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN program_versions pv ON vs.version_id = pv.id
      LEFT JOIN programs p ON pv.program_id = p.id
      LEFT JOIN course_base_syllabi cbs ON cbs.course_id = c.id
      WHERE vs.id = $1
    `, [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: Normalize base content when a CTDT syllabus is created from base**

In both syllabus creation flows, wrap copied base content with `upgradeContent(...)` before inserting:

1. `POST /api/versions/:vId/syllabi`
2. `POST /api/my-assignments/:assignmentId/create-syllabus`

Use this pattern in both places:

```js
    let initialContent = content || {};
    let noBaseSyllabus = false;
    if (!content || Object.keys(content).length === 0) {
      const baseRes = await pool.query(
        'SELECT content FROM course_base_syllabi WHERE course_id = $1',
        [course_id]
      );
      if (baseRes.rows.length) {
        const rawBase = typeof baseRes.rows[0].content === 'string'
          ? JSON.parse(baseRes.rows[0].content)
          : (baseRes.rows[0].content || {});
        initialContent = upgradeContent(rawBase);
      } else {
        noBaseSyllabus = true;
      }
    }
```

For the assignment route, use `assignment.course_id` instead of `course_id`.

- [ ] **Step 3: Normalize base content when `Lấy từ ĐC cơ bản` overwrites an existing CTDT syllabus**

In `app.post('/api/syllabi/:sId/load-from-base', ...)`, change the overwrite block to normalize before storing:

```js
    const baseRes = await pool.query('SELECT content FROM course_base_syllabi WHERE course_id = $1', [course_id]);
    if (!baseRes.rows.length) return res.status(400).json({ error: 'Học phần này chưa có đề cương cơ bản' });

    const rawBase = typeof baseRes.rows[0].content === 'string'
      ? JSON.parse(baseRes.rows[0].content)
      : (baseRes.rows[0].content || {});
    const normalizedBase = upgradeContent(rawBase);

    await pool.query(
      'UPDATE version_syllabi SET content=$1, updated_at=NOW() WHERE id=$2',
      [JSON.stringify(normalizedBase), req.params.sId]
    );
```

- [ ] **Step 4: Verify syntax**

Run:

```bash
node --check server.js
```

Expected: exit code `0`, no output.

- [ ] **Step 5: Smoke check the enriched syllabus payload**

Use a valid syllabus id and auth cookie:

```bash
curl -s http://localhost:3600/api/syllabi/1 -b "token=<TOKEN>" | jq '{course_code, course_name_en, credits_theory, credits_practice, training_level, knowledge_area, course_requirement}'
```

Expected: JSON object with the six added keys present. Values may be `null` if the course is incomplete; the keys must exist.

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "feat(api): enrich syllabus payload and normalize base content copy"
```

---

### Task 2: Backend — add dedicated CTDT endpoints for section 3 and section 9

**Files:**
- Modify: [server.js](/home/congnghiep/work/CongNghiep_ProgramHutech/server.js)

- [ ] **Step 1: Add helper functions near the syllabus routes**

Add these helpers before the new endpoints so the route code stays small and consistent:

```js
function parseJsonContent(raw) {
  if (!raw) return {};
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

function ensureCtdtOverrides(content) {
  const c = content && typeof content === 'object' ? { ...content } : {};
  if (!c.ctdt_overrides || typeof c.ctdt_overrides !== 'object') c.ctdt_overrides = {};
  if (!c.ctdt_overrides.section3 || typeof c.ctdt_overrides.section3 !== 'object') {
    c.ctdt_overrides.section3 = { knowledge_area: null, course_requirement: null };
  }
  return c;
}

async function getSyllabusContext(syllabusId) {
  const result = await pool.query(
    'SELECT id, version_id, course_id FROM version_syllabi WHERE id = $1',
    [syllabusId]
  );
  return result.rows[0] || null;
}
```

- [ ] **Step 2: Add `PUT /api/syllabi/:id/ctdt-section3`**

Add a dedicated route that only updates the CTDT override for section 3 and never rewrites the rest of `content`:

```js
app.put('/api/syllabi/:id/ctdt-section3', authMiddleware, async (req, res) => {
  const { knowledge_area = null, course_requirement = null } = req.body || {};
  try {
    const syl = await getSyllabusContext(req.params.id);
    if (!syl) return res.status(404).json({ error: 'Không tìm thấy đề cương' });

    const assignRes = await pool.query(
      'SELECT id FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2 AND assigned_to=$3',
      [syl.version_id, syl.course_id, req.user.id]
    );
    if (!assignRes.rows.length) {
      await checkVersionEditAccess(req.user.id, syl.version_id, 'syllabus.edit');
    }

    const currentRes = await pool.query('SELECT content FROM version_syllabi WHERE id=$1', [req.params.id]);
    const current = ensureCtdtOverrides(parseJsonContent(currentRes.rows[0].content));
    current.ctdt_overrides.section3 = {
      knowledge_area,
      course_requirement,
    };

    await pool.query(
      'UPDATE version_syllabi SET content=$1, updated_at=NOW() WHERE id=$2',
      [JSON.stringify(current), req.params.id]
    );

    res.json({ success: true, section3: current.ctdt_overrides.section3 });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 3: Add `GET /api/syllabi/:id/ctdt-section9`**

This route returns only the mappings relevant to the current syllabus course:

```js
app.get('/api/syllabi/:id/ctdt-section9', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const syl = await getSyllabusContext(req.params.id);
    if (!syl) return res.status(404).json({ error: 'Không tìm thấy đề cương' });

    const [plosRes, coursePloRes, coursePiRes] = await Promise.all([
      pool.query('SELECT * FROM version_plos WHERE version_id=$1 ORDER BY code', [syl.version_id]),
      pool.query('SELECT * FROM course_plo_map WHERE version_id=$1 AND course_id=$2', [syl.version_id, syl.course_id]),
      pool.query('SELECT * FROM version_pi_courses WHERE version_id=$1 AND course_id=$2', [syl.version_id, syl.course_id]),
    ]);

    const ploIds = plosRes.rows.map(r => r.id);
    const pisRes = ploIds.length
      ? await pool.query(
          'SELECT * FROM plo_pis WHERE plo_id = ANY($1::int[]) ORDER BY pi_code',
          [ploIds]
        )
      : { rows: [] };

    res.json({
      plos: plosRes.rows,
      pis: pisRes.rows,
      course_plo_map: coursePloRes.rows,
      course_pi_map: coursePiRes.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 4: Add `PUT /api/syllabi/:id/ctdt-section9`**

This route replaces only the current course’s section 9 mappings, leaving other courses in the same version untouched:

```js
app.put('/api/syllabi/:id/ctdt-section9', authMiddleware, async (req, res) => {
  const { plo_mappings = [], pi_mappings = [] } = req.body || {};
  const client = await pool.connect();
  try {
    const syl = await getSyllabusContext(req.params.id);
    if (!syl) {
      client.release();
      return res.status(404).json({ error: 'Không tìm thấy đề cương' });
    }

    const assignRes = await pool.query(
      'SELECT id FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2 AND assigned_to=$3',
      [syl.version_id, syl.course_id, req.user.id]
    );
    if (!assignRes.rows.length) {
      await checkVersionEditAccess(req.user.id, syl.version_id, 'syllabus.edit');
    }

    await client.query('BEGIN');

    await client.query(
      'DELETE FROM course_plo_map WHERE version_id=$1 AND course_id=$2',
      [syl.version_id, syl.course_id]
    );
    for (const m of plo_mappings) {
      await client.query(
        `INSERT INTO course_plo_map (version_id, course_id, plo_id, contribution_level)
         VALUES ($1,$2,$3,$4)`,
        [syl.version_id, syl.course_id, m.plo_id, m.contribution_level]
      );
    }

    await client.query(
      'DELETE FROM version_pi_courses WHERE version_id=$1 AND course_id=$2',
      [syl.version_id, syl.course_id]
    );
    for (const m of pi_mappings) {
      await client.query(
        `INSERT INTO version_pi_courses (version_id, pi_id, course_id, contribution_level)
         VALUES ($1,$2,$3,$4)`,
        [syl.version_id, m.pi_id, syl.course_id, m.contribution_level]
      );
    }

    await client.query('COMMIT');
    res.json({
      success: true,
      plo_count: plo_mappings.length,
      pi_count: pi_mappings.length,
    });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally {
    client.release();
  }
});
```

- [ ] **Step 5: Verify syntax**

Run:

```bash
node --check server.js
```

Expected: exit code `0`, no output.

- [ ] **Step 6: Smoke check section 3 endpoint**

```bash
curl -s -X PUT http://localhost:3600/api/syllabi/1/ctdt-section3 \
  -H "Content-Type: application/json" \
  -b "token=<TOKEN>" \
  -d '{"knowledge_area":"professional","course_requirement":"required"}' | jq .
```

Expected: `success: true` and the echoed `section3` object.

- [ ] **Step 7: Smoke check section 9 endpoints**

```bash
curl -s http://localhost:3600/api/syllabi/1/ctdt-section9 -b "token=<TOKEN>" | jq '{plos: (.plos|length), pis: (.pis|length), course_plo_map: (.course_plo_map|length), course_pi_map: (.course_pi_map|length)}'
```

Expected: all four keys present with integer counts.

- [ ] **Step 8: Commit**

```bash
git add server.js
git commit -m "feat(api): add CTDT syllabus section 3 and section 9 endpoints"
```

---

### Task 3: Frontend — normalize CTDT syllabus data and rebuild the editor shell

**Files:**
- Modify: [public/js/pages/syllabus-editor.js](/home/congnghiep/work/CongNghiep_ProgramHutech/public/js/pages/syllabus-editor.js)

- [ ] **Step 1: Replace the old migration helper with a CTDT-normalizer that preserves copied content**

Replace the top-level helper `migrateOldToNew(c)` with a new function that reads both old CTDT content and newer base-style content, but does not rewrite locked sections during save:

```js
function normalizeCtdtSyllabusContent(raw) {
  const c = raw && typeof raw === 'object' ? { ...raw } : {};

  const normalized = {
    _schema_version: 4,
    course_description: c.course_description || c.summary || '',
    course_objectives: c.course_objectives || c.objectives || '',
    prerequisites: c.prerequisites || '',
    prerequisites_concurrent: c.prerequisites_concurrent || '',
    language_instruction: c.language_instruction || '',
    teaching_methods: Array.isArray(c.teaching_methods)
      ? c.teaching_methods
      : String(c.learning_methods || c.methods || '')
          .split('\n')
          .map(s => s.trim())
          .filter(Boolean)
          .map(line => ({ method: line, objective: '' })),
    course_outline: Array.isArray(c.course_outline)
      ? c.course_outline.map((l, idx) => ({
          lesson: l.lesson || idx + 1,
          title: l.title || '',
          lt_hours: typeof l.lt_hours === 'number' ? l.lt_hours : (l.hours || 0),
          th_hours: typeof l.th_hours === 'number' ? l.th_hours : 0,
          topics: Array.isArray(l.topics) ? l.topics : [],
          teaching_methods: l.teaching_methods || '',
          clo_codes: Array.isArray(l.clo_codes) ? l.clo_codes : (Array.isArray(l.clos) ? l.clos : []),
          self_study_hours: typeof l.self_study_hours === 'number' ? l.self_study_hours : 0,
          self_study_tasks: Array.isArray(l.self_study_tasks) ? l.self_study_tasks : [],
        }))
      : [],
    assessment_methods: Array.isArray(c.assessment_methods)
      ? c.assessment_methods.map(a => ({
          component: a.component || '',
          description: a.description || a.assessment_tool || '',
          task_ref: a.task_ref || '',
          weight: typeof a.weight === 'number' ? a.weight : parseInt(a.weight) || 0,
          clo_codes: Array.isArray(a.clo_codes) ? a.clo_codes : (Array.isArray(a.clos) ? a.clos : []),
        }))
      : [],
    textbooks: Array.isArray(c.textbooks) ? c.textbooks : [],
    references: Array.isArray(c.references) ? c.references : [],
    tools: Array.isArray(c.tools) ? c.tools : [],
    other_requirements: c.other_requirements || '',
    instructor: c.instructor || { name: '', title: '', address: '', phone: '', email: '', website: '' },
    assistant_instructor: c.assistant_instructor || { name: '', title: '', address: '', phone: '', email: '', website: '' },
    contact_info: c.contact_info || '',
    signature_date: c.signature_date || '',
    ctdt_overrides: c.ctdt_overrides || {
      section3: { knowledge_area: null, course_requirement: null },
    },
  };

  if (!normalized.ctdt_overrides.section3) {
    normalized.ctdt_overrides.section3 = { knowledge_area: null, course_requirement: null };
  }

  return normalized;
}
```

- [ ] **Step 2: Add the new page state fields the editor needs**

At the top of `window.SyllabusEditorPage`, replace old writable-tab state with CTDT-focused state:

```js
  section9Data: null,
  section10Clos: [],
  section10Mappings: [],
  section3Draft: null,
```

Reset them in `render()`:

```js
    this.section9Data = null;
    this.section10Clos = [];
    this.section10Mappings = [];
    this.section3Draft = null;
```

- [ ] **Step 3: Normalize syllabus content on load**

Replace the existing `migrateOldToNew(...)` call in `render()` with:

```js
      let content = typeof this.syllabus.content === 'string'
        ? JSON.parse(this.syllabus.content)
        : (this.syllabus.content || {});
      content = normalizeCtdtSyllabusContent(content);
      this.syllabus.content = content;
      this.section3Draft = {
        knowledge_area: content.ctdt_overrides?.section3?.knowledge_area ?? null,
        course_requirement: content.ctdt_overrides?.section3?.course_requirement ?? null,
      };
```

- [ ] **Step 4: Replace the page header actions to match the locked CTDT workflow**

In the page header, remove actions that no longer apply and keep only the safe ones:

```js
          <div class="page-header-actions">
            ${editable && s.has_base_syllabus ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.loadFromBase()">Lấy từ ĐC cơ bản</button>' : ''}
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveAll()">Lưu mục 3, 9, 10</button>' : ''}
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.submitForApproval()">Nộp duyệt</button>' : ''}
          </div>
```

Do not show:

- `Import từ PDF`
- add/edit/delete CLO actions
- old per-tab save buttons for locked tabs

- [ ] **Step 5: Replace the old tab bar with CTDT-specific tabs**

Use a layout that mirrors the base syllabus more closely:

```js
      <div class="tab-bar" id="syl-tabs">
        <div class="tab-item active" data-tab="0">Mục 1–8</div>
        <div class="tab-item" data-tab="1">Mục 9</div>
        <div class="tab-item" data-tab="2">Mục 10</div>
        <div class="tab-item" data-tab="3">Mục 11–17</div>
      </div>
```

And update `renderSylTab()` to dispatch to:

```js
      switch (this.activeTab) {
        case 0: await this.renderSections1To8(body, editable); break;
        case 1: await this.renderSection9(body, editable); break;
        case 2: await this.renderSection10(body, editable); break;
        case 3: this.renderSections11To17(body); break;
      }
```

- [ ] **Step 6: Verify syntax**

Run:

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: exit code `0`, no output.

- [ ] **Step 7: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat(frontend): normalize CTDT syllabus content and rebuild editor shell"
```

---

### Task 4: Frontend — implement section 1–8 with only section 3 editable

**Files:**
- Modify: [public/js/pages/syllabus-editor.js](/home/congnghiep/work/CongNghiep_ProgramHutech/public/js/pages/syllabus-editor.js)

- [ ] **Step 1: Add `renderSections1To8()`**

Add a renderer that shows sections `1–8` in the base-syllabus style and only unlocks section 3:

```js
  async renderSections1To8(body, editable) {
    const s = this.syllabus;
    const c = this.syllabus.content || {};
    const section3 = this.section3Draft || { knowledge_area: null, course_requirement: null };
    const knowledgeArea = section3.knowledge_area ?? s.knowledge_area ?? '';
    const courseRequirement = section3.course_requirement ?? s.course_requirement ?? '';
    const creditsDisplay = `${s.credits || 0} (${s.credits_theory || 0}, ${s.credits_practice || 0}) TC`;

    body.innerHTML = `
      <div style="max-width:900px;">
        <div style="margin-bottom:12px;padding:12px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-secondary);font-size:13px;color:var(--text-muted);">
          Các mục ngoài 3, 9, 10 được kế thừa từ đề cương gốc và không chỉnh sửa trong đề cương CTDT.
        </div>

        <table class="data-table">
          <tbody>
            <tr><th style="width:180px;">1. Tên học phần</th><td>Tên tiếng Việt: <strong>${s.course_name || ''}</strong><br>Tên tiếng Anh: <strong>${s.course_name_en || ''}</strong></td></tr>
            <tr><th>2. Mã học phần</th><td>${s.course_code || ''}</td></tr>
            <tr>
              <th>3. Thuộc khối kiến thức</th>
              <td>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                  <select id="ctdt-sec3-knowledge" ${editable ? '' : 'disabled'} style="${INP}max-width:240px;">
                    <option value="">-- Chọn khối kiến thức --</option>
                    <option value="general" ${knowledgeArea === 'general' ? 'selected' : ''}>GD đại cương</option>
                    <option value="professional" ${knowledgeArea === 'professional' ? 'selected' : ''}>GD chuyên nghiệp</option>
                    <option value="non_credit" ${knowledgeArea === 'non_credit' ? 'selected' : ''}>Không tích lũy</option>
                  </select>
                  <select id="ctdt-sec3-requirement" ${editable ? '' : 'disabled'} style="${INP}max-width:240px;">
                    <option value="">-- Chọn tính chất --</option>
                    <option value="required" ${courseRequirement === 'required' ? 'selected' : ''}>Bắt buộc</option>
                    <option value="elective" ${courseRequirement === 'elective' ? 'selected' : ''}>Tự chọn</option>
                  </select>
                </div>
              </td>
            </tr>
            <tr><th>4. Trình độ đào tạo</th><td>${s.training_level || ''}</td></tr>
            <tr><th>5. Số tín chỉ</th><td>${creditsDisplay}</td></tr>
            <tr><th>6. Học phần học trước/ song hành</th><td>${c.prerequisites || ''}${c.prerequisites_concurrent ? `<br>Song hành: ${c.prerequisites_concurrent}` : ''}</td></tr>
            <tr><th>7. Mục tiêu học phần</th><td style="white-space:pre-wrap;">${c.course_objectives || ''}</td></tr>
            <tr><th>8. Đơn vị quản lý học phần</th><td>${s.dept_name || ''}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  },
```

- [ ] **Step 2: Add a collector and saver for section 3**

Add these methods:

```js
  collectSection3() {
    const knowledgeEl = document.getElementById('ctdt-sec3-knowledge');
    const requirementEl = document.getElementById('ctdt-sec3-requirement');
    if (!knowledgeEl || !requirementEl) return;
    this.section3Draft = {
      knowledge_area: knowledgeEl.value || null,
      course_requirement: requirementEl.value || null,
    };
  },

  async saveSection3() {
    this.collectSection3();
    const res = await fetch(`/api/syllabi/${this.syllabusId}/ctdt-section3`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(this.section3Draft || {}),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi lưu mục 3');
    this.syllabus.content = {
      ...this.syllabus.content,
      ctdt_overrides: {
        ...(this.syllabus.content.ctdt_overrides || {}),
        section3: data.section3,
      },
    };
  },
```

- [ ] **Step 3: Update tab-switch collection**

Replace `_collectCurrentTabIntoState()` so it only tracks editable CTDT sections:

```js
  _collectCurrentTabIntoState() {
    switch (this.activeTab) {
      case 0: this.collectSection3(); break;
      case 1: this.collectSection9(); break;
      case 2: this._collectCloPiMap(); break;
    }
  },
```

- [ ] **Step 4: Verify in browser**

Manual check:

1. Open one syllabus with base content.
2. Go to tab `Mục 1–8`.
3. Confirm sections `1, 2, 4, 5, 6, 7, 8` are read-only.
4. Confirm only section `3` has editable selects.

Expected: nothing else on the tab is editable.

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat(frontend): lock sections 1-8 and keep only section 3 editable"
```

---

### Task 5: Frontend — implement section 9 and section 10 editing surfaces

**Files:**
- Modify: [public/js/pages/syllabus-editor.js](/home/congnghiep/work/CongNghiep_ProgramHutech/public/js/pages/syllabus-editor.js)

- [ ] **Step 1: Add `renderSection9()` and `collectSection9()`**

Use the dedicated backend endpoint so the editor only touches the current course’s mappings:

```js
  async renderSection9(body, editable) {
    const data = await fetch(`/api/syllabi/${this.syllabusId}/ctdt-section9`).then(r => r.json());
    this.section9Data = data;

    const ploMap = new Map((data.course_plo_map || []).map(m => [`${m.plo_id}`, m.contribution_level]));
    const piMap = new Map((data.course_pi_map || []).map(m => [`${m.pi_id}`, m.contribution_level]));

    body.innerHTML = `
      <div style="display:grid;gap:20px;">
        <div>
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">9. Ma trận học phần ↔ PLO</h3>
          <table class="data-table" id="ctdt-section9-plo-table">
            <thead><tr><th>PLO</th><th>Mô tả</th><th style="width:120px;">Mức độ</th></tr></thead>
            <tbody>
              ${(data.plos || []).map(plo => `
                <tr>
                  <td><strong>${plo.code}</strong></td>
                  <td>${plo.description || ''}</td>
                  <td>
                    <select data-plo-id="${plo.id}" ${editable ? '' : 'disabled'} style="${INP}">
                      <option value="0" ${(ploMap.get(String(plo.id)) || 0) === 0 ? 'selected' : ''}>—</option>
                      <option value="1" ${(ploMap.get(String(plo.id)) || 0) === 1 ? 'selected' : ''}>1</option>
                      <option value="2" ${(ploMap.get(String(plo.id)) || 0) === 2 ? 'selected' : ''}>2</option>
                      <option value="3" ${(ploMap.get(String(plo.id)) || 0) === 3 ? 'selected' : ''}>3</option>
                    </select>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div>
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">9. Ma trận học phần ↔ PI</h3>
          <table class="data-table" id="ctdt-section9-pi-table">
            <thead><tr><th>PI</th><th>Mô tả</th><th style="width:120px;">Mức độ</th></tr></thead>
            <tbody>
              ${(data.pis || []).map(pi => `
                <tr>
                  <td><strong>${pi.pi_code}</strong></td>
                  <td>${pi.description || ''}</td>
                  <td>
                    <select data-pi-id="${pi.id}" ${editable ? '' : 'disabled'} style="${INP}">
                      <option value="0" ${(piMap.get(String(pi.id)) || 0) === 0 ? 'selected' : ''}>—</option>
                      <option value="1" ${(piMap.get(String(pi.id)) || 0) === 1 ? 'selected' : ''}>1</option>
                      <option value="2" ${(piMap.get(String(pi.id)) || 0) === 2 ? 'selected' : ''}>2</option>
                      <option value="3" ${(piMap.get(String(pi.id)) || 0) === 3 ? 'selected' : ''}>3</option>
                    </select>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  collectSection9() {
    const ploTable = document.getElementById('ctdt-section9-plo-table');
    const piTable = document.getElementById('ctdt-section9-pi-table');
    if (!ploTable || !piTable) return;

    const plo_mappings = Array.from(ploTable.querySelectorAll('select'))
      .map(sel => ({
        plo_id: parseInt(sel.dataset.ploId, 10),
        contribution_level: parseInt(sel.value, 10) || 0,
      }))
      .filter(m => m.contribution_level > 0);

    const pi_mappings = Array.from(piTable.querySelectorAll('select'))
      .map(sel => ({
        pi_id: parseInt(sel.dataset.piId, 10),
        contribution_level: parseInt(sel.value, 10) || 0,
      }))
      .filter(m => m.contribution_level > 0);

    this.section9Data = { ...(this.section9Data || {}), plo_mappings, pi_mappings };
  },
```

- [ ] **Step 2: Add `saveSection9()`**

```js
  async saveSection9() {
    this.collectSection9();
    const res = await fetch(`/api/syllabi/${this.syllabusId}/ctdt-section9`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plo_mappings: this.section9Data?.plo_mappings || [],
        pi_mappings: this.section9Data?.pi_mappings || [],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Lỗi lưu mục 9');
  },
```

- [ ] **Step 3: Replace the old editable CLO tab with a read-only section 10**

Add a new `renderSection10()` that loads CLOs read-only and keeps only the CLO↔PI matrix editable:

```js
  async renderSection10(body, editable) {
    const [clos, maps, section9] = await Promise.all([
      fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json()),
      fetch(`/api/syllabi/${this.syllabusId}/clo-pi-map`).then(r => r.json()),
      fetch(`/api/syllabi/${this.syllabusId}/ctdt-section9`).then(r => r.json()),
    ]);

    this.section10Clos = clos;
    const allPIs = section9.pis || [];
    const mapObj = {};
    maps.forEach(m => { mapObj[`${m.clo_id}-${m.pi_id}`] = m.contribution_level; });

    body.innerHTML = `
      <div style="display:grid;gap:20px;">
        <div>
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">10. CLO kế thừa từ đề cương gốc</h3>
          <table class="data-table">
            <thead><tr><th style="width:100px;">Mã</th><th>Mô tả</th><th style="width:120px;">Bloom</th></tr></thead>
            <tbody>
              ${clos.length ? clos.map(c => `
                <tr>
                  <td><strong>${c.code}</strong></td>
                  <td>${c.description || ''}</td>
                  <td>${c.bloom_level || ''}</td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Chưa có CLO</td></tr>'}
            </tbody>
          </table>
        </div>

        <div>
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">10. CLO ↔ PI trong CTDT</h3>
          <table class="data-table" id="clo-pi-table">
            <thead>
              <tr>
                <th>CLO</th>
                ${allPIs.map(pi => `<th style="min-width:60px;text-align:center;">${pi.pi_code}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${clos.map(c => `
                <tr>
                  <td><strong>${c.code}</strong></td>
                  ${allPIs.map(pi => {
                    const val = mapObj[`${c.id}-${pi.id}`] || 0;
                    return `<td style="text-align:center;">
                      <select data-clo="${c.id}" data-pi="${pi.id}" ${editable ? '' : 'disabled'} style="width:48px;padding:2px;">
                        <option value="0" ${val===0?'selected':''}>—</option>
                        <option value="1" ${val===1?'selected':''}>1</option>
                        <option value="2" ${val===2?'selected':''}>2</option>
                        <option value="3" ${val===3?'selected':''}>3</option>
                      </select>
                    </td>`;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },
```

- [ ] **Step 4: Remove old UI actions that conflict with locked section 10**

Delete or stop calling these methods from the UI flow:

- `renderCLOTab()`
- `openAddCLOModal()`
- `submitAddCLO()`
- `saveCLO()`
- `deleteCLO()`
- imported-CLO flows

Do not remove the existing `clo-pi-map` save route usage. Keep `_collectCloPiMap()` and the section 10 save path for mapping only.

- [ ] **Step 5: Verify in browser**

Manual check:

1. Open one CTDT syllabus copied from base.
2. Go to `Mục 9`, change one PLO contribution and one PI contribution.
3. Go to `Mục 10`, confirm CLO rows are read-only and only the matrix selects are editable.

Expected:

- no button to add/edit/delete CLO
- section 9 tables show only the current course’s mappings
- section 10 matrix remains editable

- [ ] **Step 6: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat(frontend): add CTDT section 9 editor and mapping-only section 10"
```

---

### Task 6: Frontend — render sections 11–17 read-only and wire `saveAll()`

**Files:**
- Modify: [public/js/pages/syllabus-editor.js](/home/congnghiep/work/CongNghiep_ProgramHutech/public/js/pages/syllabus-editor.js)

- [ ] **Step 1: Add `renderSections11To17()`**

Use the normalized copied content and render it as display-only content:

```js
  renderSections11To17(body) {
    const c = this.syllabus.content || {};
    body.innerHTML = `
      <div style="display:grid;gap:20px;max-width:960px;">
        <div><h3 style="font-size:15px;font-weight:600;">11. Mô tả tóm tắt nội dung học phần</h3><div style="white-space:pre-wrap;">${c.course_description || ''}</div></div>
        <div><h3 style="font-size:15px;font-weight:600;">12. Phương pháp, hình thức tổ chức dạy học</h3>
          <table class="data-table">
            <thead><tr><th>Phương pháp</th><th>Mục tiêu</th></tr></thead>
            <tbody>
              ${(c.teaching_methods || []).map(t => `<tr><td>${t.method || ''}</td><td>${t.objective || ''}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div><h3 style="font-size:15px;font-weight:600;">13. Nội dung chi tiết học phần</h3>
          ${(c.course_outline || []).map(l => `
            <div style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:8px;">
              <strong>Bài ${l.lesson}: ${l.title || ''}</strong><br>
              LT ${l.lt_hours || 0} · TH ${l.th_hours || 0}<br>
              ${(l.topics || []).join('<br>')}
            </div>
          `).join('')}
        </div>
        <div><h3 style="font-size:15px;font-weight:600;">14. Đánh giá</h3>
          <table class="data-table">
            <thead><tr><th>Thành phần</th><th>Quy định</th><th>Bài đánh giá</th><th>%</th><th>CLO</th></tr></thead>
            <tbody>
              ${(c.assessment_methods || []).map(a => `<tr><td>${a.component || ''}</td><td>${a.description || ''}</td><td>${a.task_ref || ''}</td><td>${a.weight || 0}</td><td>${(a.clo_codes || []).join(', ')}</td></tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div><h3 style="font-size:15px;font-weight:600;">15. Tài liệu</h3><div>${(c.textbooks || []).join('<br>')}</div><hr><div>${(c.references || []).join('<br>')}</div></div>
        <div><h3 style="font-size:15px;font-weight:600;">16. Tự học</h3>
          ${(c.course_outline || []).map(l => `<div style="margin-bottom:8px;"><strong>Bài ${l.lesson}:</strong> ${l.title || ''}<br>${(l.self_study_tasks || []).join('<br>')}</div>`).join('')}
        </div>
        <div><h3 style="font-size:15px;font-weight:600;">17. Các yêu cầu của học phần</h3><div style="white-space:pre-wrap;">${c.other_requirements || ''}</div></div>
      </div>
    `;
  },
```

- [ ] **Step 2: Rework `saveAll()` so it only persists sections 3, 9, and 10**

Replace the old raw-content save flow with:

```js
  async saveAll() {
    try {
      this._collectCurrentTabIntoState();

      await this.saveSection3();
      await this.saveSection9();

      if (this.dirtyMapChanges) {
        const res = await fetch(`/api/syllabi/${this.syllabusId}/clo-pi-map`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mappings: this.dirtyMapChanges }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi lưu mục 10');
        this.dirtyMapChanges = null;
      }

      window.toast.success('Đã lưu mục 3, 9, 10');
      await this.render(document.getElementById('page-content'), this.syllabusId);
    } catch (e) {
      window.toast.error(e.message);
    }
  },
```

- [ ] **Step 3: Update `loadFromBase()` confirmation text to reflect the locked CTDT behavior**

Replace the confirmation message with:

```js
      message: 'Tải đề cương cơ bản sẽ ghi đè nội dung đề cương CTDT hiện tại. Sau khi tải, chỉ các mục 3, 9, 10 được phép chỉnh sửa. Tiếp tục?',
```

- [ ] **Step 4: Verify syntax**

Run:

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: exit code `0`, no output.

- [ ] **Step 5: Manual end-to-end verification**

1. Open a syllabus with base content.
2. Click `Lấy từ ĐC cơ bản`.
3. Edit section 3.
4. Edit one section 9 PLO row and one PI row.
5. Edit one section 10 CLO↔PI cell.
6. Click `Lưu mục 3, 9, 10`.
7. Reload the page.

Expected:

- sections outside `3, 9, 10` remain unchanged and locked
- section 3 keeps the override
- section 9 keeps the current course’s mappings
- section 10 keeps the CLO↔PI mappings

- [ ] **Step 6: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat(frontend): lock inherited CTDT syllabus sections and save only 3 9 10"
```

---

### Task 7: Verification sweep

**Files:**
- Modify: none

- [ ] **Step 1: Run syntax verification**

```bash
node --check server.js
node --check public/js/pages/syllabus-editor.js
echo "ALL CHECKS PASSED"
```

Expected:

- both `node --check` commands exit `0`
- final output line is `ALL CHECKS PASSED`

- [ ] **Step 2: Run API smoke checks**

```bash
curl -s http://localhost:3600/api/syllabi/1 -b "token=<TOKEN>" | jq '{course_name_en, knowledge_area, course_requirement}'
curl -s http://localhost:3600/api/syllabi/1/ctdt-section9 -b "token=<TOKEN>" | jq '{plos: (.plos|length), pis: (.pis|length)}'
curl -s http://localhost:3600/api/syllabi/1/clos -b "token=<TOKEN>" | jq 'length'
```

Expected:

- first command returns the three keys
- second returns `plos` and `pis` counts
- third returns an integer count for CLOs

- [ ] **Step 3: Manual regression check**

Verify these flows still work:

1. Open syllabus editor for a draft syllabus.
2. `Lấy từ ĐC cơ bản` still copies content and CLOs.
3. `Nộp duyệt` still submits successfully.
4. Opening a syllabus with no base syllabus still shows the warning banner.

Expected: no JS errors in browser console; no broken route navigation.

- [ ] **Step 4: Commit verification-only notes if implementation changed during checks**

If fixes were required during verification:

```bash
git add server.js public/js/pages/syllabus-editor.js
git commit -m "fix: address CTDT syllabus editor verification findings"
```

If no fixes were required, skip this commit.

---

## Self-Review

### Spec coverage

- Copy-once inheritance from base syllabus: covered in Task 1
- Only section 3 editable in `1–8`: covered in Task 4
- Section 9 editable as version/course mapping: covered in Tasks 2 and 5
- Section 10 mapping-only, CLO read-only: covered in Task 5
- Locked render for sections `11–17`: covered in Task 6
- No raw overwrite of locked content from the new CTDT UI: covered by dedicated endpoints in Task 2 and `saveAll()` rewrite in Task 6

### Placeholder scan

- No `TODO`/`TBD`
- All new routes and methods have concrete code blocks
- All verification steps have exact commands

### Type consistency

- `section3Draft` uses `{ knowledge_area, course_requirement }` consistently
- `section9Data` uses `{ plo_mappings, pi_mappings }` consistently
- Section 10 continues using `dirtyMapChanges` in the existing `{ clo_id, pi_id, contribution_level }` shape

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-22-ctdt-syllabus-editor.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
