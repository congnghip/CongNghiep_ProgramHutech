# CTDT Syllabus Editor — Mirror Base UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make CTDT syllabus editor tabs 0, 3, 4, 5 render identically to the base syllabus editor, with all non-mục-3/9/10 fields disabled.

**Architecture:** Single file change — `public/js/pages/syllabus-editor.js`. Rewrite 4 render methods + 2 helper methods + 3 collect methods to mirror `BaseSyllabusEditorPage`. All changed tabs are read-only (editable=false always passed from `renderSylTab`), so save logic for tabs 3/4/5 becomes dead code but is updated for correctness.

**Tech Stack:** Vanilla JS, browser DOM, no build step. CLO data fetched from `/api/syllabi/:id/clos`.

---

### Task 1: Add teaching methods table to Tab 0

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` — `renderSections1To8()` method

**Context:** `renderSections1To8` currently ends with a `</div>` closing tag after the mục 1–8 table. We need to insert a teaching methods section between the table and that closing `</div>`. The content comes from `c.teaching_methods` which is already normalized to `[{method, objective}]` by `normalizeCtdtSyllabusContent()`. The `INP` constant is already defined at the top of the file.

- [ ] **Step 1: Read the current method end**

Read lines 263–304 of `public/js/pages/syllabus-editor.js` to confirm the exact closing structure of `renderSections1To8`.

- [ ] **Step 2: Insert teaching methods section**

Find this exact string (near line 296–303):
```js
          </tbody>
        </table>
        ${editable ? `
          <div style="display:flex;justify-content:flex-end;margin-top:12px;">
            <button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveSection3()">Lưu mục 3</button>
          </div>
        ` : ''}
      </div>
    `;
```

Replace with:
```js
          </tbody>
        </table>
        ${editable ? `
          <div style="display:flex;justify-content:flex-end;margin-top:12px;">
            <button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveSection3()">Lưu mục 3</button>
          </div>
        ` : ''}

        <h4 style="font-size:14px;font-weight:600;margin:20px 0 8px;">Phương pháp, hình thức tổ chức dạy học (mục 12)</h4>
        <table class="data-table" id="ctdt-teaching-methods-table">
          <thead><tr><th style="width:35%;">Phương pháp</th><th>Mục tiêu</th></tr></thead>
          <tbody>
            ${(Array.isArray(c.teaching_methods) ? c.teaching_methods : []).map(t => `<tr>
              <td><input type="text" data-field="method" value="${String(t.method || '').replace(/"/g,'&quot;')}" disabled style="${INP}"></td>
              <td><input type="text" data-field="objective" value="${String(t.objective || '').replace(/"/g,'&quot;')}" disabled style="${INP}"></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
```

- [ ] **Step 3: Verify syntax**

```bash
node --check public/js/pages/syllabus-editor.js && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat: add teaching methods table (disabled) to CTDT tab 0"
```

---

### Task 2: Rewrite `_outlineRowHtml` helper

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` — `_outlineRowHtml()` method (lines ~661–678)

**Context:** Current `_outlineRowHtml(l, i, editable)` uses a single `hours` field and comma-separated CLO text input. Must be replaced with `_outlineRowHtml(l, i, editable, cloCodes)` that uses `lt_hours`/`th_hours`, CLO multi-select, and a `<details>` self-study section — identical structure to `BaseSyllabusEditorPage._outlineRowHtml`. The `INP` constant replaces `BS_INP` from base.

- [ ] **Step 1: Replace `_outlineRowHtml`**

Find the full current method:
```js
  _outlineRowHtml(l, i, editable) {
    const dis = editable ? '' : 'disabled';
    const topicsStr = Array.isArray(l.topics) ? l.topics.join('\n') : '';
    const closStr = Array.isArray(l.clos) ? l.clos.join(', ') : '';
    return `<div class="outline-row" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        <strong style="color:var(--primary);white-space:nowrap;">Bài ${l.lesson || i + 1}</strong>
        <input type="text" data-field="title" value="${(l.title || '').replace(/"/g, '&quot;')}" ${dis} placeholder="Tên bài" style="flex:1;${INP}">
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;white-space:nowrap;">Số tiết:</label><input type="number" data-field="hours" value="${l.hours || 0}" ${dis} min="0" style="width:60px;${INP}text-align:center;"></div>
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;white-space:nowrap;">CLO:</label><input type="text" data-field="clos" value="${closStr}" ${dis} placeholder="CLO1, CLO2" style="width:120px;${INP}"></div>
        ${editable ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('.outline-row').remove()">✕</button>` : ''}
      </div>
      <div style="display:flex;gap:12px;">
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nội dung chi tiết (mỗi dòng = 1 mục)</label><textarea data-field="topics" ${dis} rows="3" style="${INP}">${topicsStr}</textarea></div>
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Phương pháp dạy học</label><textarea data-field="teaching_methods" ${dis} rows="3" style="${INP}">${l.teaching_methods || ''}</textarea></div>
      </div>
    </div>`;
  },
```

Replace with:
```js
  _outlineRowHtml(l, i, editable, cloCodes) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const dis = editable ? '' : 'disabled';
    const topicsStr = Array.isArray(l.topics) ? l.topics.join('\n') : '';
    const tasksStr = Array.isArray(l.self_study_tasks) ? l.self_study_tasks.join('\n') : '';
    const codes = Array.isArray(cloCodes) ? cloCodes : [];
    const selected = Array.isArray(l.clo_codes) ? l.clo_codes : [];
    return `<div class="outline-row" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        <strong style="color:var(--primary);white-space:nowrap;">Bài ${l.lesson || i + 1}</strong>
        <input type="text" data-field="title" value="${esc(l.title)}" ${dis} placeholder="Tên bài" style="flex:1;${INP}">
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;">LT:</label><input type="number" data-field="lt_hours" value="${l.lt_hours || 0}" ${dis} min="0" style="width:56px;${INP}text-align:center;"></div>
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;">TH:</label><input type="number" data-field="th_hours" value="${l.th_hours || 0}" ${dis} min="0" style="width:56px;${INP}text-align:center;"></div>
        ${editable ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('.outline-row').remove()">✕</button>` : ''}
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nội dung chi tiết (mỗi dòng = 1 mục)</label><textarea data-field="topics" ${dis} rows="3" style="${INP}">${esc(topicsStr)}</textarea></div>
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Phương pháp dạy học</label><textarea data-field="teaching_methods" ${dis} rows="3" style="${INP}">${esc(l.teaching_methods)}</textarea></div>
      </div>
      <div class="input-group" style="margin-bottom:10px;"><label style="font-size:12px;">CLO đáp ứng</label>
        <select data-field="clo_codes" multiple size="3" ${dis} style="${INP}">
          ${codes.map(c => `<option value="${esc(c)}" ${selected.includes(c) ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
      </div>
      <details style="margin-top:6px;">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--primary);">▸ Hướng dẫn tự học (mục 16)</summary>
        <div style="display:flex;gap:12px;margin-top:8px;">
          <div class="input-group" style="width:150px;margin:0;"><label style="font-size:12px;">Số tiết tự học</label><input type="number" data-field="self_study_hours" value="${l.self_study_hours || 0}" ${dis} min="0" style="${INP}text-align:center;"></div>
          <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nhiệm vụ SV (mỗi dòng = 1)</label><textarea data-field="self_study_tasks" ${dis} rows="3" style="${INP}">${esc(tasksStr)}</textarea></div>
        </div>
      </details>
    </div>`;
  },
```

- [ ] **Step 2: Verify syntax**

```bash
node --check public/js/pages/syllabus-editor.js && echo OK
```
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "refactor: rewrite _outlineRowHtml with lt/th/self_study and CLO multi-select"
```

---

### Task 3: Rewrite `renderOutlineTab` and `_collectOutline`

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` — `renderOutlineTab()` and `_collectOutline()` methods

**Context:** `renderOutlineTab` must become async to fetch CLO codes. It must also show a totals bar (LT/TH/self-study). `_collectOutline` must read the new DOM field names (`lt_hours`, `th_hours`, `clo_codes` multi-select, `self_study_hours`, `self_study_tasks`). `submitAddOutline` also calls `_collectOutline` — it must keep working after the DOM structure change (the add modal still uses the old single-hours field, but after `_collectOutline` re-reads the already-rendered rows it won't touch the newly added row structure until next render).

- [ ] **Step 1: Replace `renderOutlineTab`**

Find:
```js
  renderOutlineTab(body, editable, c) {
    const lessons = c.course_outline || [];
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Nội dung chi tiết học phần</h3>
        <div style="display:flex;gap:8px;">
          ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.openAddOutlineModal()">+ Thêm bài</button>' : ''}
          ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveOutline()">Lưu</button>' : ''}
        </div>
      </div>
      <div id="outline-container">
        ${lessons.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có nội dung. Bấm "+ Thêm bài" để bắt đầu.</p>' :
          lessons.map((l, i) => this._outlineRowHtml(l, i, editable)).join('')}
      </div>
    `;
  },
```

Replace with:
```js
  async renderOutlineTab(body, editable, c) {
    const lessons = c.course_outline || [];
    let cloCodes = [];
    try {
      const clos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json());
      cloCodes = Array.isArray(clos) ? clos.map(x => x.code).filter(Boolean) : [];
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
        <div style="display:flex;gap:8px;">
          ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.openAddOutlineModal()">+ Thêm bài</button>' : ''}
          ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveOutline()">Lưu</button>' : ''}
        </div>
      </div>
      <div id="outline-container">
        ${lessons.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có nội dung.</p>' :
          lessons.map((l, i) => this._outlineRowHtml(l, i, editable, cloCodes)).join('')}
      </div>
      ${lessons.length ? `<div style="margin-top:12px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius);font-size:13px;">
        <strong>Tổng:</strong> LT ${totals.lt} tiết &nbsp;|&nbsp; TH ${totals.th} tiết &nbsp;|&nbsp; Tự học ${totals.ss} tiết
      </div>` : ''}
    `;
  },
```

- [ ] **Step 2: Replace `_collectOutline`**

Find:
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
      lt_hours: parseFloat(r.querySelector('[data-field="lt_hours"]').value) || 0,
      th_hours: parseFloat(r.querySelector('[data-field="th_hours"]').value) || 0,
      topics: r.querySelector('[data-field="topics"]').value.split('\n').map(s => s.trim()).filter(Boolean),
      teaching_methods: r.querySelector('[data-field="teaching_methods"]').value,
      clo_codes: Array.from(r.querySelector('[data-field="clo_codes"]').selectedOptions).map(o => o.value),
      self_study_hours: parseFloat(r.querySelector('[data-field="self_study_hours"]').value) || 0,
      self_study_tasks: r.querySelector('[data-field="self_study_tasks"]').value.split('\n').map(s => s.trim()).filter(Boolean),
    }));
    this.syllabus.content = { ...this.syllabus.content, course_outline };
  },
```

- [ ] **Step 3: Verify syntax**

```bash
node --check public/js/pages/syllabus-editor.js && echo OK
```
Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat: rewrite renderOutlineTab to mirror base (async, totals, self-study)"
```

---

### Task 4: Rewrite `renderGradingTab`, add `_gradingRowHtml`, update `_collectGrading`

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` — `renderGradingTab()`, add `_gradingRowHtml()`, update `_collectGrading()`

**Context:** The new grading tab is async (fetches CLO codes), shows 5 columns (Thành phần / Quy định / Bài đánh giá / % / CLO multi-select), displays total weight indicator, and uses `description`/`task_ref`/`clo_codes` field names matching the normalized schema. Remove the 4 default placeholder rows.

- [ ] **Step 1: Replace `renderGradingTab`**

Find the full current method:
```js
  renderGradingTab(body, editable, c) {
    const items = c.assessment_methods || [
      { component: 'Chuyên cần', weight: 10, assessment_tool: 'Điểm danh', clos: [] },
      { component: 'Bài tập', weight: 20, assessment_tool: 'Bài tập nhóm', clos: [] },
      { component: 'Giữa kỳ', weight: 20, assessment_tool: 'Trắc nghiệm', clos: [] },
      { component: 'Cuối kỳ', weight: 50, assessment_tool: 'Tự luận', clos: [] },
    ];
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Hình thức đánh giá</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveGrading()">Lưu</button>' : ''}
      </div>
      <table class="data-table" id="grading-table">
        <thead><tr><th>Thành phần</th><th style="width:70px;">%</th><th>Hình thức đánh giá</th><th style="width:120px;">CLO</th>${editable ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${items.map((g, i) => {
            const closStr = Array.isArray(g.clos) ? g.clos.join(', ') : (g.clos || '');
            return `<tr data-idx="${i}">
              <td><input type="text" value="${g.component || ''}" data-field="component" ${editable ? '' : 'disabled'} style="${INP}"></td>
              <td><input type="number" value="${g.weight || 0}" data-field="weight" ${editable ? '' : 'disabled'} min="0" max="100" style="${INP}text-align:center;"></td>
              <td><input type="text" value="${g.assessment_tool || ''}" data-field="assessment_tool" ${editable ? '' : 'disabled'} style="${INP}"></td>
              <td><input type="text" value="${closStr}" data-field="clos" ${editable ? '' : 'disabled'} style="${INP}" placeholder="CLO1, CLO2"></td>
              ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${editable ? '<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="window.SyllabusEditorPage.addGradingRow()">+ Thêm dòng</button>' : ''}
    `;
  },
```

Replace with:
```js
  async renderGradingTab(body, editable, c) {
    const items = c.assessment_methods || [];
    let cloCodes = [];
    try {
      const clos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json());
      cloCodes = Array.isArray(clos) ? clos.map(x => x.code).filter(Boolean) : [];
    } catch (_) {}
    this._gradingCloCodes = cloCodes;

    const dis = editable ? '' : 'disabled';
    const totalWeight = items.reduce((s, g) => s + (parseInt(g.weight) || 0), 0);
    const weightColor = totalWeight === 100 ? 'var(--success)' : 'var(--danger)';

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Phương pháp kiểm tra/đánh giá (mục 14)</h3>
        <div style="font-size:13px;">Tổng trọng số: <strong style="color:${weightColor};">${totalWeight}%</strong></div>
      </div>
      <table class="data-table" id="ctdt-grading-table">
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
      ${editable ? '<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="window.SyllabusEditorPage.addGradingRow()">+ Thêm dòng</button>' : ''}
    `;
  },

  _gradingRowHtml(g, i, editable, cloCodes, dis) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const selected = Array.isArray(g.clo_codes) ? g.clo_codes : [];
    return `<tr data-idx="${i}">
      <td><input type="text" value="${esc(g.component)}" data-field="component" ${dis} style="${INP}" placeholder="VD: Điểm đánh giá quá trình"></td>
      <td><input type="text" value="${esc(g.description)}" data-field="description" ${dis} style="${INP}" placeholder="VD: Bài tập nhóm"></td>
      <td><input type="text" value="${esc(g.task_ref)}" data-field="task_ref" ${dis} style="${INP}" placeholder="VD: Bài 1,2,3,5"></td>
      <td><input type="number" value="${g.weight || 0}" data-field="weight" ${dis} min="0" max="100" style="${INP}text-align:center;"></td>
      <td>
        <select data-field="clo_codes" multiple size="3" ${dis} style="${INP}font-size:12px;">
          ${cloCodes.map(c => `<option value="${esc(c)}" ${selected.includes(c) ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
      </td>
      ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>` : ''}
    </tr>`;
  },
```

- [ ] **Step 2: Update `addGradingRow`**

Find:
```js
  addGradingRow() {
    const tbody = document.querySelector('#grading-table tbody');
    tbody.insertAdjacentHTML('beforeend', `<tr>
      <td><input type="text" data-field="component" style="${INP}"></td>
      <td><input type="number" data-field="weight" value="0" style="${INP}text-align:center;"></td>
      <td><input type="text" data-field="assessment_tool" style="${INP}"></td>
      <td><input type="text" data-field="clos" style="${INP}" placeholder="CLO1, CLO2"></td>
      <td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`);
  },
```

Replace with:
```js
  addGradingRow() {
    const tbody = document.querySelector('#ctdt-grading-table tbody');
    if (!tbody) return;
    const codes = this._gradingCloCodes || [];
    tbody.insertAdjacentHTML('beforeend', this._gradingRowHtml({}, tbody.children.length, true, codes, ''));
  },
```

- [ ] **Step 3: Update `_collectGrading`**

Find:
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
```

Replace with:
```js
  _collectGrading() {
    const table = document.getElementById('ctdt-grading-table');
    if (!table) return; // Tab 4 not mounted
    const rows = table.querySelectorAll('tbody tr');
    const assessment_methods = Array.from(rows).map(r => ({
      component: r.querySelector('[data-field="component"]').value,
      description: r.querySelector('[data-field="description"]').value,
      task_ref: r.querySelector('[data-field="task_ref"]').value,
      weight: parseInt(r.querySelector('[data-field="weight"]').value) || 0,
      clo_codes: Array.from(r.querySelector('[data-field="clo_codes"]').selectedOptions).map(o => o.value),
    }));
    this.syllabus.content = { ...this.syllabus.content, assessment_methods };
  },
```

- [ ] **Step 4: Verify syntax**

```bash
node --check public/js/pages/syllabus-editor.js && echo OK
```
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat: rewrite renderGradingTab to mirror base (5 cols, weight total, CLO multi-select)"
```

---

### Task 5: Rewrite `renderResourcesTab`, add helpers, update `_collectResources`

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` — `renderResourcesTab()`, add `_toolCategoryHtml()`, add `_instructorFormHtml()`, update `_collectResources()`

**Context:** The new resources tab must show: textbooks, references, tools by category, other requirements, instructor form, assistant instructor form, contact info, and signature date. All disabled. Uses `c.tools` (array of `{category, items[]}`), `c.instructor`/`c.assistant_instructor` (6-field objects), `c.other_requirements`, `c.contact_info`, `c.signature_date`. Element IDs use `ctdt-` prefix to avoid conflicts with base editor.

- [ ] **Step 1: Replace `renderResourcesTab`**

Find the full current method (lines ~815–850):
```js
  renderResourcesTab(body, editable, c) {
    const textbooks = Array.isArray(c.textbooks) ? c.textbooks : [];
    const references = Array.isArray(c.references) ? c.references : [];
    const req = c.course_requirements || { software: [], hardware: [], lab_equipment: [], classroom_setup: '' };

    body.innerHTML = `
      <div style="max-width:600px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Tài liệu & Yêu cầu</h3>

        <div class="input-group"><label>Giáo trình chính (mỗi dòng = 1 tài liệu)</label>
          <textarea id="syl-textbooks" ${editable ? '' : 'disabled'} rows="3" placeholder="Tên sách, Tác giả, NXB">${textbooks.join('\n')}</textarea>
        </div>

        <div class="input-group"><label>Tài liệu tham khảo (mỗi dòng = 1 tài liệu)</label>
          <textarea id="syl-references" ${editable ? '' : 'disabled'} rows="3" placeholder="Bài báo, website...">${references.join('\n')}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:20px 0 12px;">Yêu cầu học phần</h4>

        <div class="input-group"><label>Phần mềm / Công cụ (mỗi dòng = 1 item)</label>
          <textarea id="syl-software" ${editable ? '' : 'disabled'} rows="3">${(req.software || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Phần cứng (mỗi dòng = 1 item)</label>
          <textarea id="syl-hardware" ${editable ? '' : 'disabled'} rows="2">${(req.hardware || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Thiết bị phòng thí nghiệm (mỗi dòng = 1 item)</label>
          <textarea id="syl-lab" ${editable ? '' : 'disabled'} rows="2">${(req.lab_equipment || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Yêu cầu phòng học</label>
          <input type="text" id="syl-classroom" ${editable ? '' : 'disabled'} value="${req.classroom_setup || ''}" placeholder="VD: Phòng máy tính">
        </div>

        ${editable ? '<button class="btn btn-primary" onclick="window.SyllabusEditorPage.saveResources()">Lưu nháp</button>' : ''}
      </div>
    `;
  },
```

Replace with:
```js
  renderResourcesTab(body, editable, c) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const textbooks = Array.isArray(c.textbooks) ? c.textbooks : [];
    const references = Array.isArray(c.references) ? c.references : [];
    const tools = Array.isArray(c.tools) ? c.tools : [];
    const dis = editable ? '' : 'disabled';

    body.innerHTML = `
      <div style="max-width:820px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Tài liệu phục vụ học phần (mục 15)</h3>
        <div class="input-group"><label>Tài liệu/giáo trình chính (mỗi dòng = 1 tài liệu)</label>
          <textarea id="ctdt-textbooks" ${dis} rows="3" placeholder="Tên sách, Tác giả, NXB">${esc(textbooks.join('\n'))}</textarea>
        </div>
        <div class="input-group"><label>Tài liệu tham khảo/bổ sung (mỗi dòng = 1 tài liệu)</label>
          <textarea id="ctdt-references" ${dis} rows="3">${esc(references.join('\n'))}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:20px 0 8px;">Các công cụ theo lĩnh vực</h4>
        <div id="ctdt-tools-container">
          ${tools.map((t, i) => this._toolCategoryHtml(t, i, editable, dis)).join('')}
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Các yêu cầu của HP (mục 17)</h4>
        <div class="input-group">
          <textarea id="ctdt-other-req" ${dis} rows="3" placeholder="Yêu cầu khác (nếu có)">${esc(c.other_requirements)}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Giảng viên phụ trách học phần</h4>
        ${this._instructorFormHtml('ctdt-instr', c.instructor || {}, dis)}

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Giảng viên hỗ trợ / Trợ giảng (nếu có)</h4>
        ${this._instructorFormHtml('ctdt-asst', c.assistant_instructor || {}, dis)}

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Cách liên lạc với giảng viên/trợ giảng</h4>
        <div class="input-group">
          <textarea id="ctdt-contact-info" ${dis} rows="2" placeholder="Ví dụ: Email, giờ tiếp sinh viên...">${esc(c.contact_info)}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Ngày ký</h4>
        <div class="input-group" style="max-width:300px;">
          <input type="text" id="ctdt-signature-date" ${dis} placeholder="VD: 01 tháng 09 năm 2025" value="${esc(c.signature_date)}">
        </div>
      </div>
    `;
  },

  _toolCategoryHtml(t, i, editable, dis) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const items = Array.isArray(t.items) ? t.items.join('\n') : '';
    return `<div class="tool-category" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:8px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;">
        <label style="font-size:12px;white-space:nowrap;">Lĩnh vực:</label>
        <input type="text" data-field="category" value="${esc(t.category)}" ${dis} placeholder="VD: Phần mềm" style="flex:1;${INP}">
      </div>
      <textarea data-field="items" ${dis} rows="3" placeholder="Mỗi dòng = 1 công cụ" style="${INP}">${esc(items)}</textarea>
    </div>`;
  },

  _instructorFormHtml(prefix, data, dis) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Họ và tên</label><input type="text" id="${prefix}-name" ${dis} value="${esc(data.name)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Học hàm, học vị</label><input type="text" id="${prefix}-title" ${dis} value="${esc(data.title)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Địa chỉ cơ quan</label><input type="text" id="${prefix}-address" ${dis} value="${esc(data.address)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Điện thoại liên hệ</label><input type="text" id="${prefix}-phone" ${dis} value="${esc(data.phone)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Email</label><input type="text" id="${prefix}-email" ${dis} value="${esc(data.email)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Website</label><input type="text" id="${prefix}-website" ${dis} value="${esc(data.website)}"></div>
    </div>`;
  },
```

- [ ] **Step 2: Update `_collectResources`**

Find:
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
```

Replace with:
```js
  _collectResources() {
    if (!document.getElementById('ctdt-textbooks')) return; // Tab 5 not mounted
    const toArr = id => (document.getElementById(id)?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
    const toolsContainer = document.getElementById('ctdt-tools-container');
    const tools = toolsContainer ? Array.from(toolsContainer.querySelectorAll('.tool-category')).map(div => ({
      category: div.querySelector('[data-field="category"]').value,
      items: div.querySelector('[data-field="items"]').value.split('\n').map(s => s.trim()).filter(Boolean),
    })).filter(t => t.category || t.items.length) : [];
    const collectInstructor = prefix => ({
      name: document.getElementById(`${prefix}-name`)?.value || '',
      title: document.getElementById(`${prefix}-title`)?.value || '',
      address: document.getElementById(`${prefix}-address`)?.value || '',
      phone: document.getElementById(`${prefix}-phone`)?.value || '',
      email: document.getElementById(`${prefix}-email`)?.value || '',
      website: document.getElementById(`${prefix}-website`)?.value || '',
    });
    this.syllabus.content = {
      ...this.syllabus.content,
      textbooks: toArr('ctdt-textbooks'),
      references: toArr('ctdt-references'),
      tools,
      other_requirements: document.getElementById('ctdt-other-req')?.value || '',
      instructor: collectInstructor('ctdt-instr'),
      assistant_instructor: collectInstructor('ctdt-asst'),
      contact_info: document.getElementById('ctdt-contact-info')?.value || '',
      signature_date: document.getElementById('ctdt-signature-date')?.value || '',
    };
  },
```

- [ ] **Step 3: Verify syntax**

```bash
node --check public/js/pages/syllabus-editor.js && echo OK
```
Expected: `OK`

- [ ] **Step 4: Verify no remaining references to old IDs**

```bash
grep -n "syl-textbooks\|syl-references\|syl-software\|syl-hardware\|syl-lab\|syl-classroom\|grading-table\b" public/js/pages/syllabus-editor.js
```
Expected: no output (all old IDs replaced).

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat: rewrite renderResourcesTab to mirror base (tools, instructor, contact, signature)"
```
