# Syllabus Editor "Lưu tất cả" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a page-header **"Lưu tất cả"** button on the syllabus editor that saves edits from all 6 tabs in a single action, with in-memory dirty state synced on tab switches so no edits are lost when navigating between tabs.

**Architecture:** Frontend-only. Extract each content tab's DOM→payload logic into pure `_collectXxx()` methods that update `this.syllabus.content` in place. Wire those collectors into the tab-click handler so switching tabs auto-captures DOM state. Add a `saveAll()` method that runs one content PUT plus optional CLO/mapping persistence. Existing per-tab **Lưu** buttons are refactored to reuse the same collectors.

**Tech Stack:** Vanilla JS (no framework), DOM APIs, `fetch` against existing Express endpoints `PUT /api/syllabi/:id`, `POST/DELETE /api/clos`, `PUT /api/syllabi/:id/clo-plo-map`. No backend, schema, or dependency changes.

**Constraint:** The project has no test framework configured (per CLAUDE.md). Each task verifies via `node --check` for syntax and manual browser steps for behaviour. Browser verification uses the running `make dev` server on `http://localhost:3600`.

**Reference spec:** [docs/superpowers/specs/2026-04-06-syllabus-editor-save-all-design.md](../specs/2026-04-06-syllabus-editor-save-all-design.md)

---

## File structure

All changes land in a single file:

- **Modify:** `public/js/pages/syllabus-editor.js` — add state field, 5 collectors, 1 dispatcher, 1 persistence helper, 1 `saveAll()` method, 1 header button, and modify the tab click handler.

No new files. No backend touched. No tests to create (no framework).

## Commit convention

Match existing project style (see `git log --oneline -5`). Use `refactor(syllabus-editor): …` for extraction tasks and `feat(syllabus-editor): …` for the Save All addition. No `Co-Authored-By` footer — project commits don't use one.

---

## Task 1: Add `dirtyMapChanges` state field

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (state object + `render()` resets)

- [ ] **Step 1: Add `dirtyMapChanges: null` to the state object**

Use the Edit tool with this `old_string`:

```js
window.SyllabusEditorPage = {
  syllabusId: null,
  syllabus: null,
  clos: [],
  plos: [],
  activeTab: 0,
  importedClos: null,
  importedMappings: null,
```

Replace with:

```js
window.SyllabusEditorPage = {
  syllabusId: null,
  syllabus: null,
  clos: [],
  plos: [],
  activeTab: 0,
  importedClos: null,
  importedMappings: null,
  dirtyMapChanges: null,
```

- [ ] **Step 2: Reset `dirtyMapChanges` in `render()`**

Use the Edit tool with this `old_string`:

```js
  async render(container, syllabusId) {
    this.syllabusId = syllabusId;
    this.importedClos = null;
    this.importedMappings = null;
```

Replace with:

```js
  async render(container, syllabusId) {
    this.syllabusId = syllabusId;
    this.importedClos = null;
    this.importedMappings = null;
    this.dirtyMapChanges = null;
```

- [ ] **Step 3: Syntax check**

Run:

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output (syntax OK). Any error must be fixed before proceeding.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "refactor(syllabus-editor): add dirtyMapChanges state field"
```

---

## Task 2: Extract `_collectGeneral()` and refactor `saveGeneral()`

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (`saveGeneral` method)

- [ ] **Step 1: Replace `saveGeneral()` with collector + slim save**

Use the Edit tool with this `old_string`:

```js
  async saveGeneral() {
    const content = { ...this.syllabus.content,
      course_description: document.getElementById('syl-course-desc').value,
      course_objectives: document.getElementById('syl-course-obj').value,
      prerequisites: document.getElementById('syl-prereq').value,
      language_instruction: document.getElementById('syl-lang-inst').value,
      learning_methods: document.getElementById('syl-learning-methods').value,
    };
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
      this.syllabus.content = content;
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },
```

Replace with:

```js
  _collectGeneral() {
    const desc = document.getElementById('syl-course-desc');
    if (!desc) return; // Tab 0 not mounted
    this.syllabus.content = {
      ...this.syllabus.content,
      course_description: desc.value,
      course_objectives: document.getElementById('syl-course-obj').value,
      prerequisites: document.getElementById('syl-prereq').value,
      language_instruction: document.getElementById('syl-lang-inst').value,
      learning_methods: document.getElementById('syl-learning-methods').value,
    };
  },

  async saveGeneral() {
    this._collectGeneral();
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: this.syllabus.content }) });
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },
```

- [ ] **Step 2: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 3: Manual browser verification (regression)**

1. Make sure the dev server is running (`make dev` or `docker compose restart program-app`).
2. Open `http://localhost:3600`, log in as the lecturer (user 2 "Huy").
3. Open a **draft** syllabus in the editor.
4. On **Thông tin chung** (Tab 0), change "Mô tả tóm tắt nội dung học phần" to a new test string (e.g. `"Task 2 test"`).
5. Click **Lưu nháp**. Expect the toast "Đã lưu".
6. Reload the page. Expect the new value to be present.
7. Revert the value back to the original and save again.

Expected: regression passes — per-tab save behaviour unchanged.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "refactor(syllabus-editor): extract _collectGeneral collector"
```

---

## Task 3: Extract `_collectOutline()` and refactor `saveOutline()`

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (`saveOutline` method)

- [ ] **Step 1: Replace `saveOutline()` with collector + slim save**

Use the Edit tool with this `old_string`:

```js
  async saveOutline() {
    const rows = document.querySelectorAll('#outline-container .outline-row');
    const course_outline = Array.from(rows).map((r, i) => ({
      lesson: i + 1,
      title: r.querySelector('[data-field="title"]').value,
      hours: parseFloat(r.querySelector('[data-field="hours"]').value) || 0,
      topics: r.querySelector('[data-field="topics"]').value.split('\n').map(s => s.trim()).filter(Boolean),
      teaching_methods: r.querySelector('[data-field="teaching_methods"]').value,
      clos: r.querySelector('[data-field="clos"]').value.split(',').map(s => s.trim()).filter(Boolean),
    }));
    const content = { ...this.syllabus.content, course_outline };
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
      this.syllabus.content = content;
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },
```

Replace with:

```js
  _collectOutline() {
    const container = document.getElementById('outline-container');
    if (!container) return; // Tab 3 not mounted
    const rows = container.querySelectorAll('.outline-row');
    const course_outline = Array.from(rows).map((r, i) => ({
      lesson: i + 1,
      title: r.querySelector('[data-field="title"]').value,
      hours: parseFloat(r.querySelector('[data-field="hours"]').value) || 0,
      topics: r.querySelector('[data-field="topics"]').value.split('\n').map(s => s.trim()).filter(Boolean),
      teaching_methods: r.querySelector('[data-field="teaching_methods"]').value,
      clos: r.querySelector('[data-field="clos"]').value.split(',').map(s => s.trim()).filter(Boolean),
    }));
    this.syllabus.content = { ...this.syllabus.content, course_outline };
  },

  async saveOutline() {
    this._collectOutline();
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: this.syllabus.content }) });
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },
```

- [ ] **Step 2: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "refactor(syllabus-editor): extract _collectOutline collector"
```

---

## Task 4: Extract `_collectGrading()` and refactor `saveGrading()`

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (`saveGrading` method)

- [ ] **Step 1: Replace `saveGrading()` with collector + slim save**

Use the Edit tool with this `old_string`:

```js
  async saveGrading() {
    const rows = document.querySelectorAll('#grading-table tbody tr');
    const assessment_methods = Array.from(rows).map(r => ({
      component: r.querySelector('[data-field="component"]').value,
      weight: parseInt(r.querySelector('[data-field="weight"]').value) || 0,
      assessment_tool: r.querySelector('[data-field="assessment_tool"]').value,
      clos: r.querySelector('[data-field="clos"]').value.split(',').map(s => s.trim()).filter(Boolean),
    }));
    const content = { ...this.syllabus.content, assessment_methods };
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
      this.syllabus.content = content;
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },
```

Replace with:

```js
  _collectGrading() {
    const table = document.getElementById('grading-table');
    if (!table) return; // Tab 4 not mounted
    const rows = table.querySelectorAll('tbody tr');
    const assessment_methods = Array.from(rows).map(r => ({
      component: r.querySelector('[data-field="component"]').value,
      weight: parseInt(r.querySelector('[data-field="weight"]').value) || 0,
      assessment_tool: r.querySelector('[data-field="assessment_tool"]').value,
      clos: r.querySelector('[data-field="clos"]').value.split(',').map(s => s.trim()).filter(Boolean),
    }));
    this.syllabus.content = { ...this.syllabus.content, assessment_methods };
  },

  async saveGrading() {
    this._collectGrading();
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: this.syllabus.content }) });
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },
```

- [ ] **Step 2: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "refactor(syllabus-editor): extract _collectGrading collector"
```

---

## Task 5: Extract `_collectResources()` and refactor `saveResources()`

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (`saveResources` method)

- [ ] **Step 1: Replace `saveResources()` with collector + slim save**

Use the Edit tool with this `old_string`:

```js
  async saveResources() {
    const toArr = id => document.getElementById(id).value.split('\n').map(s => s.trim()).filter(Boolean);
    const content = { ...this.syllabus.content,
      textbooks: toArr('syl-textbooks'),
      references: toArr('syl-references'),
      course_requirements: {
        software: toArr('syl-software'),
        hardware: toArr('syl-hardware'),
        lab_equipment: toArr('syl-lab'),
        classroom_setup: document.getElementById('syl-classroom').value,
      },
    };
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
      this.syllabus.content = content;
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },
```

Replace with:

```js
  _collectResources() {
    const textbooks = document.getElementById('syl-textbooks');
    if (!textbooks) return; // Tab 5 not mounted
    const toArr = id => document.getElementById(id).value.split('\n').map(s => s.trim()).filter(Boolean);
    this.syllabus.content = {
      ...this.syllabus.content,
      textbooks: toArr('syl-textbooks'),
      references: toArr('syl-references'),
      course_requirements: {
        software: toArr('syl-software'),
        hardware: toArr('syl-hardware'),
        lab_equipment: toArr('syl-lab'),
        classroom_setup: document.getElementById('syl-classroom').value,
      },
    };
  },

  async saveResources() {
    this._collectResources();
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: this.syllabus.content }) });
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },
```

- [ ] **Step 2: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 3: Manual browser verification (regression for all 4 content tabs)**

Reload the page in the browser (the running dev server picks up file changes if on `--watch`; otherwise restart: `docker compose restart program-app`).

1. Open a draft syllabus.
2. **Tab 0:** edit "Mô tả tóm tắt" → click **Lưu nháp** → expect "Đã lưu".
3. **Tab 3:** click **+ Thêm bài**, set title to `"Task 5 test"`, click **Lưu** → expect "Đã lưu".
4. **Tab 4:** change a row's weight → click **Lưu** → expect "Đã lưu".
5. **Tab 5:** add a textbook line → click **Lưu nháp** → expect "Đã lưu".
6. Reload the page. All four edits should be present.
7. Revert test data.

Expected: all 4 per-tab saves still work. No regression.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "refactor(syllabus-editor): extract _collectResources collector"
```

---

## Task 6: Add `_collectCloPloMap()` and refactor the inline handler

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (`renderCLOPLOTab` inline save handler)

The CLO-PLO tab (Tab 2) has no top-level `saveXxx()` method — its save is wired inline inside `renderCLOPLOTab` (around the `save-clo-plo-btn` listener). We add a standalone `_collectCloPloMap()` and refactor the inline listener to use it.

- [ ] **Step 1: Add `_collectCloPloMap()` method**

Use the Edit tool to add the new method just BEFORE the existing `renderCLOPLOTab` method (so the method order stays roughly sequential).

`old_string`:

```js
  // ============ TAB 2: CLO ↔ PLO ============
  async renderCLOPLOTab(body, editable) {
```

Replace with:

```js
  _collectCloPloMap() {
    const table = document.getElementById('clo-plo-table');
    if (!table) return; // Tab 2 not mounted
    const selects = table.querySelectorAll('select');
    const mappings = [];
    selects.forEach(s => {
      const v = parseInt(s.value);
      if (v > 0) mappings.push({
        clo_id: parseInt(s.dataset.clo),
        plo_id: parseInt(s.dataset.plo),
        contribution_level: v,
      });
    });
    this.dirtyMapChanges = mappings;
  },

  // ============ TAB 2: CLO ↔ PLO ============
  async renderCLOPLOTab(body, editable) {
```

- [ ] **Step 2: Refactor the inline save-clo-plo-btn handler to use `_collectCloPloMap`**

Use the Edit tool with this `old_string`:

```js
    document.getElementById('save-clo-plo-btn')?.addEventListener('click', async () => {
      const selects = document.querySelectorAll('#clo-plo-table select');
      const mappings = [];
      selects.forEach(s => { const v = parseInt(s.value); if (v > 0) mappings.push({ clo_id: parseInt(s.dataset.clo), plo_id: parseInt(s.dataset.plo), contribution_level: v }); });
      try {
        const res = await fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings }) });
        if (!res.ok) throw new Error((await res.json()).error);
        window.toast.success(`Đã lưu ${mappings.length} liên kết`);
      } catch (e) { window.toast.error(e.message); }
    });
```

Replace with:

```js
    document.getElementById('save-clo-plo-btn')?.addEventListener('click', async () => {
      this._collectCloPloMap();
      const mappings = this.dirtyMapChanges || [];
      try {
        const res = await fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings }) });
        if (!res.ok) throw new Error((await res.json()).error);
        this.dirtyMapChanges = null;
        window.toast.success(`Đã lưu ${mappings.length} liên kết`);
      } catch (e) { window.toast.error(e.message); }
    });
```

- [ ] **Step 3: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 4: Manual browser verification (Tab 2 regression)**

1. Reload the page in the browser.
2. Open a draft syllabus that has at least 1 CLO and 1 PLO.
3. Open **Tab 2 (CLO ↔ PLO)**.
4. Flip a select from `—` to `2`.
5. Click the tab's own **Lưu** button.
6. Expect the toast `"Đã lưu 1 liên kết"` (number depends on total non-zero selects).
7. Reload the page and open Tab 2 again. The select should still show `2`.
8. Revert the select to `—` and save.

Expected: Tab 2 per-button save still works.

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "refactor(syllabus-editor): extract _collectCloPloMap collector"
```

---

## Task 7: Add `_collectCurrentTabIntoState()` dispatcher + wire into tab switch

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (add dispatcher method, modify tab click handler)

- [ ] **Step 1: Add the `_collectCurrentTabIntoState()` dispatcher**

Place it immediately after the `_collectGeneral()` method. Use the Edit tool with this `old_string`:

```js
  _collectGeneral() {
    const desc = document.getElementById('syl-course-desc');
    if (!desc) return; // Tab 0 not mounted
    this.syllabus.content = {
      ...this.syllabus.content,
      course_description: desc.value,
      course_objectives: document.getElementById('syl-course-obj').value,
      prerequisites: document.getElementById('syl-prereq').value,
      language_instruction: document.getElementById('syl-lang-inst').value,
      learning_methods: document.getElementById('syl-learning-methods').value,
    };
  },
```

Replace with:

```js
  _collectGeneral() {
    const desc = document.getElementById('syl-course-desc');
    if (!desc) return; // Tab 0 not mounted
    this.syllabus.content = {
      ...this.syllabus.content,
      course_description: desc.value,
      course_objectives: document.getElementById('syl-course-obj').value,
      prerequisites: document.getElementById('syl-prereq').value,
      language_instruction: document.getElementById('syl-lang-inst').value,
      learning_methods: document.getElementById('syl-learning-methods').value,
    };
  },

  _collectCurrentTabIntoState() {
    switch (this.activeTab) {
      case 0: this._collectGeneral(); break;
      case 2: this._collectCloPloMap(); break;
      case 3: this._collectOutline(); break;
      case 4: this._collectGrading(); break;
      case 5: this._collectResources(); break;
      // Tab 1 (CLO): inline CRUD, nothing to collect
    }
  },
```

- [ ] **Step 2: Wire the dispatcher into the tab click handler**

Use the Edit tool with this `old_string`:

```js
    document.querySelectorAll('#syl-tabs .tab-item').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('#syl-tabs .tab-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        this.activeTab = parseInt(el.dataset.tab);
        this.renderSylTab();
      });
    });
```

Replace with:

```js
    document.querySelectorAll('#syl-tabs .tab-item').forEach(el => {
      el.addEventListener('click', () => {
        this._collectCurrentTabIntoState();
        document.querySelectorAll('#syl-tabs .tab-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        this.activeTab = parseInt(el.dataset.tab);
        this.renderSylTab();
      });
    });
```

- [ ] **Step 3: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 4: Manual browser verification (no-data-loss on tab switch)**

1. Reload the page in the browser.
2. Open a draft syllabus.
3. On **Tab 0**, type a fresh test string into "Mô tả tóm tắt" — **do not click Lưu**.
4. Click **Tab 3**, then click back to **Tab 0**.
5. Expect the test string to still be visible in "Mô tả tóm tắt".
6. On Tab 3, click **+ Thêm bài**, type a title (e.g. `"sync test"`), do not save.
7. Click **Tab 4**, then back to **Tab 3**.
8. Expect the new lesson row with title `"sync test"` to still be present.
9. **Do not save** — reload the page to discard. Nothing from this task should have hit the server.

Expected: edits survive tab switching but are NOT persisted to the server.

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat(syllabus-editor): sync tab state into memory on tab switch"
```

---

## Task 8: Extract `_persistImportedClos()` helper and slim `saveImportedClos()`

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (`saveImportedClos` method)

- [ ] **Step 1: Split persistence body out of `saveImportedClos`**

Use the Edit tool with this `old_string`:

```js
  async saveImportedClos() {
    if (!this.importedClos) return;
    try {
      // Step 1: Delete existing CLOs
      const existingClos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json());
      for (const c of existingClos) {
        await fetch(`/api/clos/${c.id}`, { method: 'DELETE' });
      }
      // Step 2: Create new CLOs and collect IDs
      const cloIdMap = {}; // code → new DB id
      for (const c of this.importedClos) {
        const res = await fetch(`/api/syllabi/${this.syllabusId}/clos`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: c.code, description: c.description })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const created = await res.json();
        cloIdMap[c.code] = created.id;
      }
      // Step 3: Save CLO-PLO mappings
      if (this.importedMappings && this.importedMappings.length) {
        const mappings = this.importedMappings
          .filter(m => cloIdMap[m.clo_code] && m.plo_id)
          .map(m => ({ clo_id: cloIdMap[m.clo_code], plo_id: m.plo_id, contribution_level: m.contribution_level }));
        if (mappings.length) {
          await fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mappings })
          });
        }
      }
      this.importedClos = null;
      this.importedMappings = null;
      window.toast.success('Đã lưu CLO và CLO-PLO mapping');
      this.renderSylTab();
    } catch (e) { window.toast.error(e.message); }
  },
```

Replace with:

```js
  async _persistImportedClos() {
    if (!this.importedClos) return;
    // Step 1: Delete existing CLOs
    const existingClos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json());
    for (const c of existingClos) {
      await fetch(`/api/clos/${c.id}`, { method: 'DELETE' });
    }
    // Step 2: Create new CLOs and collect ID map
    const cloIdMap = {}; // code → new DB id
    for (const c of this.importedClos) {
      const res = await fetch(`/api/syllabi/${this.syllabusId}/clos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: c.code, description: c.description }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const created = await res.json();
      cloIdMap[c.code] = created.id;
    }
    // Step 3: Save CLO-PLO mappings
    if (this.importedMappings && this.importedMappings.length) {
      const mappings = this.importedMappings
        .filter(m => cloIdMap[m.clo_code] && m.plo_id)
        .map(m => ({ clo_id: cloIdMap[m.clo_code], plo_id: m.plo_id, contribution_level: m.contribution_level }));
      if (mappings.length) {
        await fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mappings }),
        });
      }
    }
    this.importedClos = null;
    this.importedMappings = null;
  },

  async saveImportedClos() {
    try {
      await this._persistImportedClos();
      window.toast.success('Đã lưu CLO và CLO-PLO mapping');
      this.renderSylTab();
    } catch (e) { window.toast.error(e.message); }
  },
```

- [ ] **Step 2: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 3: Manual browser verification (import-CLO regression)**

1. Reload the page in the browser.
2. Open a draft syllabus.
3. Click **Import từ PDF**, pick a test `.docx`/`.pdf` that contains CLOs.
4. After import, open **Tab 1 (CLO)**. Expect the warning badge "Đã import — cần Lưu".
5. Click **Lưu CLO đã import**. Expect the toast `"Đã lưu CLO và CLO-PLO mapping"`.
6. Reload the page and open Tab 1. The imported CLOs should be persistent.

Expected: the existing "Lưu CLO đã import" button still works.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "refactor(syllabus-editor): extract _persistImportedClos helper"
```

---

## Task 9: Add `saveAll()` method

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (add `saveAll` method near other top-level actions)

- [ ] **Step 1: Add `saveAll()` immediately before `submitForApproval`**

Use the Edit tool with this `old_string`:

```js
  // ============ APPROVAL ============
  async submitForApproval() {
```

Replace with:

```js
  // ============ SAVE ALL ============
  async saveAll() {
    try {
      // 1. Collect currently-active tab into in-memory state
      this._collectCurrentTabIntoState();

      // 2. PUT content (covers Tabs 0, 3, 4, 5 — all live in this.syllabus.content)
      const res = await fetch(`/api/syllabi/${this.syllabusId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: this.syllabus.content }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi lưu nội dung');

      // 3. Persist pending imported CLOs + mappings (if any)
      if (this.importedClos) {
        await this._persistImportedClos();
      }

      // 4. Persist Tab 2 manual map edits if any.
      //    At this point importedClos is null (either it was never set, or step 3
      //    cleared it). If the user also tweaked Tab 2 selects after an import,
      //    step 3 wrote the imported mapping and step 4 overwrites it with the
      //    user's edits — intentional last-write-wins.
      //    NOTE on empty arrays: `_collectCloPloMap` writes `[]` when all selects
      //    are 0. The truthy-array check below intentionally fires a PUT in that
      //    case — an empty array legitimately represents "user zero'd all mappings,
      //    save this as the new state". Do NOT change this to a `.length > 0` check
      //    or null-coalesce, because that would break the deliberate-erase use case.
      //    In single-user scenarios, if Tab 2 renders with all-zero selects, the
      //    server already has an empty mapping (selects are rendered from server
      //    state), so PUT [] is a safe no-op.
      if (this.dirtyMapChanges) {
        const res2 = await fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mappings: this.dirtyMapChanges }),
        });
        if (!res2.ok) throw new Error((await res2.json()).error || 'Lỗi lưu CLO-PLO');
        this.dirtyMapChanges = null;
      }

      window.toast.success('Đã lưu tất cả');
      this.renderSylTab();
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  // ============ APPROVAL ============
  async submitForApproval() {
```

- [ ] **Step 2: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 3: Browser console smoke check**

1. Reload the page in the browser, open any syllabus editor.
2. Open DevTools console. Run:

```js
typeof window.SyllabusEditorPage.saveAll
```

Expected output: `"function"`.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat(syllabus-editor): add saveAll handler"
```

---

## Task 10: Add "Lưu tất cả" button to page header

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (page header actions block inside `render`)

- [ ] **Step 1: Insert the button as the first action in the header**

Use the Edit tool with this `old_string`:

```js
          <div class="page-header-actions">
            ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.importPdf()">Import từ PDF</button>' : ''}
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.submitForApproval()">Nộp duyệt</button>' : ''}
          </div>
```

Replace with:

```js
          <div class="page-header-actions">
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveAll()">Lưu tất cả</button>' : ''}
            ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.importPdf()">Import từ PDF</button>' : ''}
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.submitForApproval()">Nộp duyệt</button>' : ''}
          </div>
```

- [ ] **Step 2: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 3: End-to-end verification (the full spec verification list)**

Reload the page in the browser. Work through each case below in order.

**3a. Happy path — cross-tab save in one click:**
1. Open a draft syllabus.
2. On Tab 0, change "Mô tả tóm tắt" to `"E2E test 1"`.
3. Click Tab 3 (do not save on Tab 0).
4. Click **+ Thêm bài**, set title to `"E2E test lesson"`.
5. Click Tab 5 (do not save on Tab 3).
6. Add a textbook line `"E2E test textbook"`.
7. Click **Lưu tất cả** in the page header.
8. Expect the toast `"Đã lưu tất cả"`.
9. Reload. All three edits must be present on their respective tabs.

**3b. Post-import save without visiting Tab 1:**
1. On a fresh draft syllabus, click **Import từ PDF** and pick a PDF with CLOs.
2. After import, click **Lưu tất cả** directly (do not visit Tab 1 manually).
3. Expect the toast `"Đã lưu tất cả"`.
4. Open Tab 1 — the imported CLOs should be rendered from the DB (no "Đã import — cần Lưu" badge).
5. Open Tab 2 — any imported mappings should be present.

**3c. Manual CLO-PLO edit (no pending import):**
1. On a draft syllabus that already has CLOs and PLOs, open Tab 2.
2. Flip one select from `—` to `2`.
3. Click Tab 0 (do NOT click Tab 2's own Lưu button).
4. Click **Lưu tất cả**.
5. Expect the toast `"Đã lưu tất cả"`.
6. Reload, open Tab 2. The select should still show `2`.

**3d. Fail-fast on content error:**
1. In the browser DevTools Network tab, set a request blocker for `PUT /api/syllabi/*`, or temporarily stop the server (`docker compose stop program-app`).
2. Click **Lưu tất cả**.
3. Expect an error toast (the server's error message, or a network error).
4. Restart the server / unblock the request before continuing.

**3e. Non-draft visibility:**
1. Open a syllabus with status `submitted` (or any non-draft). If none exists, set one manually in `psql`:

```bash
docker exec -i program-db psql -U program -d program_db -c "UPDATE version_syllabi SET status='submitted' WHERE id=<test_id>;"
```

2. Open the editor for that syllabus.
3. Expect **no** "Lưu tất cả" button, no "Import từ PDF" button, no "Nộp duyệt" button.
4. Revert the status back to `draft`:

```bash
docker exec -i program-db psql -U program -d program_db -c "UPDATE version_syllabi SET status='draft' WHERE id=<test_id>;"
```

**3f. Per-tab Lưu regression:**
1. Reload editor on a draft syllabus.
2. Click **Lưu nháp** on Tab 0 → expect `"Đã lưu"`.
3. On Tab 3, edit a lesson, click **Lưu** → expect `"Đã lưu"`.
4. On Tab 4, edit grading, click **Lưu** → expect `"Đã lưu"`.
5. On Tab 5, click **Lưu nháp** → expect `"Đã lưu"`.
6. On Tab 2, click **Lưu** → expect `"Đã lưu N liên kết"`.

Expected: every verification case passes. Any failure blocks this task.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat(syllabus-editor): add 'Lưu tất cả' button on page header"
```

---

## Final Notes

- After all 10 tasks, the only file changed in this plan is `public/js/pages/syllabus-editor.js`. No backend, no schema, no dependency changes.
- The existing per-tab **Lưu** buttons continue to work because they still call the same `saveGeneral/Outline/Grading/Resources/saveImportedClos` methods, now internally routed through their collectors.
- The "Lưu tất cả" button is hidden automatically on non-draft syllabi because it's gated by the same `editable` flag as the other edit buttons.
- Tab 1 (CLO inline CRUD) is intentionally not covered by Save All — inline add/edit/delete modals are explicit per-row actions and persist immediately through their own endpoints.

## Out of scope (spec-referenced, explicitly deferred)

- Visual "dirty" indicator on tab labels (dot or asterisk when a tab has unsaved edits in state).
- Auto-save on page unload or beforeunload prompt.
- Changes to `importPdf()` to auto-run `_persistImportedClos()` after a successful parse (the user chose the manual Save All path, not auto-save).
