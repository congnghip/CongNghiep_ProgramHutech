# Syllabus Editor Add Modals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inline "+ Thêm" forms on Tab 1 (CLO) and Tab 3 (Nội dung chi tiết) of the syllabus editor with modal dialogs that match the app-wide modal pattern used by Users/Programs/Courses pages.

**Architecture:** Frontend-only. Add 2 new `.modal-overlay` blocks to the `render()` template (outside `#syl-tab-content` so they survive tab switches). Add 6 new methods (`openAddCLOModal`, `closeAddCLOModal`, `submitAddCLO`, `openAddOutlineModal`, `closeAddOutlineModal`, `submitAddOutline`). Rewire the "+ Thêm" / "+ Thêm bài" buttons to open the modals. Edit and delete flows are untouched.

**Tech Stack:** Vanilla JS (no framework), DOM APIs, existing `.modal-overlay / .modal / .input-group / .modal-error` CSS, existing `App.modalGuard()` helper, existing `POST /api/syllabi/:id/clos` endpoint, in-memory append to `this.syllabus.content.course_outline` for outline. No backend, schema, or dependency changes.

**Constraint:** No test framework. Verification via `node --check` for syntax and manual browser steps.

**Reference spec:** [docs/superpowers/specs/2026-04-06-syllabus-add-modals-design.md](../specs/2026-04-06-syllabus-add-modals-design.md)

---

## File structure

All changes land in a single file:

- **Modify:** `public/js/pages/syllabus-editor.js`

No new files. No backend touched.

## Commit convention

Use `feat(syllabus-editor): …` for each task (they all introduce new user-facing behavior). No `Co-Authored-By` footer (project convention). `git add` must target only `public/js/pages/syllabus-editor.js`.

---

## Task 1: Add CLO "Thêm" modal HTML and form submit listener

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (extend `render()` template and its post-render wiring)

- [ ] **Step 1: Append CLO modal HTML to the render() template**

Use the Edit tool with this `old_string`:

```js
      <div class="tab-bar" id="syl-tabs">
        <div class="tab-item active" data-tab="0">Thông tin chung</div>
        <div class="tab-item" data-tab="1">CLO</div>
        <div class="tab-item" data-tab="2">CLO ↔ PLO</div>
        <div class="tab-item" data-tab="3">Nội dung chi tiết</div>
        <div class="tab-item" data-tab="4">Đánh giá</div>
        <div class="tab-item" data-tab="5">Tài liệu</div>
      </div>
      <div id="syl-tab-content"><div class="spinner"></div></div>
    `;
```

Replace with:

```js
      <div class="tab-bar" id="syl-tabs">
        <div class="tab-item active" data-tab="0">Thông tin chung</div>
        <div class="tab-item" data-tab="1">CLO</div>
        <div class="tab-item" data-tab="2">CLO ↔ PLO</div>
        <div class="tab-item" data-tab="3">Nội dung chi tiết</div>
        <div class="tab-item" data-tab="4">Đánh giá</div>
        <div class="tab-item" data-tab="5">Tài liệu</div>
      </div>
      <div id="syl-tab-content"><div class="spinner"></div></div>

      <!-- Add CLO Modal -->
      <div id="clo-add-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>Thêm CLO</h2></div>
          <div class="modal-body">
            <form id="clo-add-form">
              <div class="input-group">
                <label>Mã CLO <span class="required-mark">*</span></label>
                <input type="text" id="clo-add-code" required placeholder="CLO1">
              </div>
              <div class="input-group">
                <label>Mô tả</label>
                <textarea id="clo-add-desc" rows="3" placeholder="Mô tả CLO..."></textarea>
              </div>
              <div class="modal-error" id="clo-add-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="window.SyllabusEditorPage.closeAddCLOModal()">Hủy</button>
                <button type="submit" class="btn btn-primary">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
```

- [ ] **Step 2: Wire the form submit listener after the existing tab-click listener setup**

Use the Edit tool with this `old_string`:

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
    this.renderSylTab();
  },
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

    document.getElementById('clo-add-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitAddCLO();
    });

    this.renderSylTab();
  },
```

- [ ] **Step 3: Syntax check**

Run:

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat(syllabus-editor): add 'Thêm CLO' modal markup"
```

---

## Task 2: Add CLO modal methods and rewire the "+ Thêm" button

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` (add 3 methods, change 1 button attribute, delete dead listener)

- [ ] **Step 1: Add the 3 new methods immediately after the existing `deleteCLO` method**

Use the Edit tool with this `old_string`:

```js
  async deleteCLO(id) {
    const confirmed = await window.ui.confirm({
      title: 'Xóa CLO',
      eyebrow: 'Xác nhận thao tác',
      message: 'Bạn có chắc muốn xóa CLO này?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
    await fetch(`/api/clos/${id}`, { method: 'DELETE' });
    window.toast.success('Đã xóa');
    this.renderSylTab();
  },
```

Replace with:

```js
  async deleteCLO(id) {
    const confirmed = await window.ui.confirm({
      title: 'Xóa CLO',
      eyebrow: 'Xác nhận thao tác',
      message: 'Bạn có chắc muốn xóa CLO này?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
    await fetch(`/api/clos/${id}`, { method: 'DELETE' });
    window.toast.success('Đã xóa');
    this.renderSylTab();
  },

  openAddCLOModal() {
    const form = document.getElementById('clo-add-form');
    form.reset();
    document.getElementById('clo-add-code').value = `CLO${this.clos.length + 1}`;
    const errorEl = document.getElementById('clo-add-error');
    errorEl.classList.remove('show');
    errorEl.textContent = '';
    document.getElementById('clo-add-modal').classList.add('active');
    App.modalGuard('clo-add-modal', () => this.submitAddCLO());
  },

  closeAddCLOModal() {
    document.getElementById('clo-add-modal').classList.remove('active');
  },

  async submitAddCLO() {
    const code = document.getElementById('clo-add-code').value.trim();
    const description = document.getElementById('clo-add-desc').value.trim();
    const errorEl = document.getElementById('clo-add-error');
    if (!code) {
      errorEl.textContent = 'Nhập mã CLO';
      errorEl.classList.add('show');
      return;
    }
    try {
      const res = await fetch(`/api/syllabi/${this.syllabusId}/clos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, description }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      this.closeAddCLOModal();
      window.toast.success('Đã thêm CLO');
      this.renderSylTab();
    } catch (e) {
      errorEl.textContent = e.message;
      errorEl.classList.add('show');
    }
  },
```

- [ ] **Step 2: Rewire the "+ Thêm" button in `renderCLOTab`**

Use the Edit tool with this `old_string`:

```js
          ${hasPending ? '<span class="badge" style="background:var(--warning);color:#fff;">Đã import — cần Lưu</span>' : ''}
          ${editable ? '<button class="btn btn-primary btn-sm" id="add-clo-btn">+ Thêm</button>' : ''}
```

Replace with:

```js
          ${hasPending ? '<span class="badge" style="background:var(--warning);color:#fff;">Đã import — cần Lưu</span>' : ''}
          ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.openAddCLOModal()">+ Thêm</button>' : ''}
```

- [ ] **Step 3: Delete the now-unused `add-clo-btn` listener block**

Use the Edit tool with this `old_string`:

```js
    document.getElementById('add-clo-btn')?.addEventListener('click', () => {
      document.getElementById('clo-edit-id').value = '';
      document.getElementById('clo-code').value = `CLO${this.clos.length + 1}`;
      document.getElementById('clo-desc').value = '';
      document.getElementById('clo-form-area').style.display = 'block';
    });
  },
```

Replace with:

```js
  },
```

**Important:** do not touch the `#clo-form-area` HTML block itself (it stays — `editCLO()` still uses it for edit).

- [ ] **Step 4: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 5: Manual browser verification**

1. Restart / hard-reload the editor page.
2. Open a draft syllabus with at least 1 existing CLO.
3. **Add happy path:** Tab 1 → click **+ Thêm** → modal appears with Mã pre-filled `CLO<n+1>` → enter description "Test CLO" → click **Thêm** → modal closes, toast "Đã thêm CLO", new row appears in table. Reload → row persists.
4. **Duplicate error:** click **+ Thêm** again, manually type the same code you just added → click **Thêm** → modal stays open, error text visible in `.modal-error`. Change code → click **Thêm** → success.
5. **Edit regression:** click **Sửa** on any row → the inline form at `#clo-form-area` appears below the table → change description → click **Lưu** → toast "Đã cập nhật", row updates. Confirm the modal was NOT involved.
6. **Dirty guard:** click **+ Thêm** → type in Mã → click outside the modal → confirm dialog "Thay đổi chưa lưu" appears → click "Không lưu" → modal closes.

- [ ] **Step 6: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat(syllabus-editor): use modal for adding CLO"
```

---

## Task 3: Add Outline "Thêm bài" modal HTML and form submit listener

**Files:**
- Modify: `public/js/pages/syllabus-editor.js`

- [ ] **Step 1: Append Outline modal HTML to the render() template**

Use the Edit tool with this `old_string`:

```js
      <!-- Add CLO Modal -->
      <div id="clo-add-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>Thêm CLO</h2></div>
          <div class="modal-body">
            <form id="clo-add-form">
              <div class="input-group">
                <label>Mã CLO <span class="required-mark">*</span></label>
                <input type="text" id="clo-add-code" required placeholder="CLO1">
              </div>
              <div class="input-group">
                <label>Mô tả</label>
                <textarea id="clo-add-desc" rows="3" placeholder="Mô tả CLO..."></textarea>
              </div>
              <div class="modal-error" id="clo-add-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="window.SyllabusEditorPage.closeAddCLOModal()">Hủy</button>
                <button type="submit" class="btn btn-primary">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
```

Replace with:

```js
      <!-- Add CLO Modal -->
      <div id="clo-add-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>Thêm CLO</h2></div>
          <div class="modal-body">
            <form id="clo-add-form">
              <div class="input-group">
                <label>Mã CLO <span class="required-mark">*</span></label>
                <input type="text" id="clo-add-code" required placeholder="CLO1">
              </div>
              <div class="input-group">
                <label>Mô tả</label>
                <textarea id="clo-add-desc" rows="3" placeholder="Mô tả CLO..."></textarea>
              </div>
              <div class="modal-error" id="clo-add-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="window.SyllabusEditorPage.closeAddCLOModal()">Hủy</button>
                <button type="submit" class="btn btn-primary">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Add Outline Lesson Modal -->
      <div id="outline-add-modal" class="modal-overlay">
        <div class="modal" style="max-width:640px;">
          <div class="modal-header"><h2>Thêm bài học</h2></div>
          <div class="modal-body">
            <form id="outline-add-form">
              <div class="input-group">
                <label>Tên bài <span class="required-mark">*</span></label>
                <input type="text" id="outline-add-title" required placeholder="VD: Chương 1 — Giới thiệu">
              </div>
              <div style="display:flex;gap:12px;">
                <div class="input-group" style="flex:1;">
                  <label>Số tiết</label>
                  <input type="number" id="outline-add-hours" min="0" value="0">
                </div>
                <div class="input-group" style="flex:1;">
                  <label>CLO liên quan</label>
                  <input type="text" id="outline-add-clos" placeholder="CLO1, CLO2">
                </div>
              </div>
              <div class="input-group">
                <label>Nội dung chi tiết (mỗi dòng = 1 mục)</label>
                <textarea id="outline-add-topics" rows="4"></textarea>
              </div>
              <div class="input-group">
                <label>Phương pháp dạy học</label>
                <textarea id="outline-add-methods" rows="3"></textarea>
              </div>
              <div class="modal-error" id="outline-add-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="window.SyllabusEditorPage.closeAddOutlineModal()">Hủy</button>
                <button type="submit" class="btn btn-primary">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
```

- [ ] **Step 2: Wire the outline form submit listener after the existing CLO form listener**

Use the Edit tool with this `old_string`:

```js
    document.getElementById('clo-add-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitAddCLO();
    });

    this.renderSylTab();
  },
```

Replace with:

```js
    document.getElementById('clo-add-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.submitAddCLO();
    });

    document.getElementById('outline-add-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitAddOutline();
    });

    this.renderSylTab();
  },
```

- [ ] **Step 3: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat(syllabus-editor): add 'Thêm bài học' modal markup"
```

---

## Task 4: Add Outline modal methods, rewire the "+ Thêm bài" button, remove `addOutlineRow`

**Files:**
- Modify: `public/js/pages/syllabus-editor.js`

- [ ] **Step 1: Replace `addOutlineRow` with the 3 new outline modal methods**

Use the Edit tool with this `old_string`:

```js
  addOutlineRow() {
    const container = document.getElementById('outline-container');
    const idx = container.querySelectorAll('.outline-row').length;
    const emptyRow = { lesson: idx + 1, title: '', hours: 0, topics: [], teaching_methods: '', clos: [] };
    // Remove "Chưa có nội dung" message if present
    const p = container.querySelector('p');
    if (p) p.remove();
    container.insertAdjacentHTML('beforeend', this._outlineRowHtml(emptyRow, idx, true));
  },
```

Replace with:

```js
  openAddOutlineModal() {
    const form = document.getElementById('outline-add-form');
    form.reset();
    document.getElementById('outline-add-hours').value = '0';
    const errorEl = document.getElementById('outline-add-error');
    errorEl.classList.remove('show');
    errorEl.textContent = '';
    document.getElementById('outline-add-modal').classList.add('active');
    App.modalGuard('outline-add-modal', () => this.submitAddOutline());
  },

  closeAddOutlineModal() {
    document.getElementById('outline-add-modal').classList.remove('active');
  },

  submitAddOutline() {
    const title = document.getElementById('outline-add-title').value.trim();
    const errorEl = document.getElementById('outline-add-error');
    if (!title) {
      errorEl.textContent = 'Nhập tên bài';
      errorEl.classList.add('show');
      return;
    }
    const hours = parseFloat(document.getElementById('outline-add-hours').value) || 0;
    const topics = document.getElementById('outline-add-topics').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    const teaching_methods = document.getElementById('outline-add-methods').value;
    const clos = document.getElementById('outline-add-clos').value
      .split(',').map(s => s.trim()).filter(Boolean);

    // CRITICAL: capture inline edits on existing rows BEFORE re-rendering Tab 3
    this._collectOutline();

    const existing = this.syllabus.content.course_outline || [];
    this.syllabus.content = {
      ...this.syllabus.content,
      course_outline: [
        ...existing,
        { lesson: existing.length + 1, title, hours, topics, teaching_methods, clos },
      ],
    };

    this.closeAddOutlineModal();
    window.toast.success('Đã thêm bài (chưa lưu)');
    this.renderSylTab();
  },
```

- [ ] **Step 2: Rewire the "+ Thêm bài" button in `renderOutlineTab`**

Use the Edit tool with this `old_string`:

```js
          ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.addOutlineRow()">+ Thêm bài</button>' : ''}
```

Replace with:

```js
          ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.openAddOutlineModal()">+ Thêm bài</button>' : ''}
```

- [ ] **Step 3: Syntax check**

```bash
node --check public/js/pages/syllabus-editor.js
```

Expected: no output.

- [ ] **Step 4: Manual browser verification**

Reload the editor page.

1. **Add happy path:** open a draft syllabus → Tab 3 → click **+ Thêm bài** → modal appears → fill title "E2E test", hours 3, topics "Mục 1\nMục 2" → click **Thêm** → modal closes, toast "Đã thêm bài (chưa lưu)", new row appears at the bottom of the list. Click tab **Lưu** (or page-header **Lưu tất cả**) → reload → row persists.

2. **Edits survive add:** on a draft syllabus with at least 2 outline rows, edit the title of row 1 inline to "EDIT SURVIVES" (do NOT click Lưu). Click **+ Thêm bài** → fill title "New lesson" → click **Thêm**. Expect: row 1 still shows "EDIT SURVIVES", and a new row "New lesson" is at the bottom. Click **Lưu tất cả** → reload → both values persist.

3. **Empty title validation:** click **+ Thêm bài** → leave title empty → click **Thêm** → modal stays open, error "Nhập tên bài" shown.

4. **Dirty guard:** open modal, type a title → click outside the modal → confirm dialog appears → click "Không lưu" → modal closes without adding.

5. **Non-draft regression:** set a syllabus to `submitted` via psql, open its editor, verify Tab 1 and Tab 3 do NOT show the "+ Thêm" / "+ Thêm bài" buttons. Revert status to `draft` after.

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat(syllabus-editor): use modal for adding outline lesson"
```

---

## Final Notes

- After all 4 tasks, the only file changed is `public/js/pages/syllabus-editor.js`.
- The existing inline edit flows (CLO via `#clo-form-area` and `editCLO()`, Outline via in-table inputs) are untouched and must continue to work.
- The add modals are hidden on non-draft syllabi because the triggering buttons are gated on `editable`.
- The CLO modal saves immediately via `POST /api/syllabi/:id/clos` (matches existing per-row CLO save model). The Outline modal appends in-memory and relies on tab "Lưu" or "Lưu tất cả" for persistence (matches batch-save model of content JSONB).
- Calling `_collectOutline()` inside `submitAddOutline()` before appending is load-bearing: it preserves unsaved inline edits on existing rows that would otherwise be wiped by `renderSylTab()`.

## Out of scope (spec-referenced)

- Edit modals for CLO / Outline
- Delete-confirmation modals
- Drag-and-drop reorder for outline lessons
- Stricter validation (e.g. CLO code regex)
- Multi-row add in a single modal submission
