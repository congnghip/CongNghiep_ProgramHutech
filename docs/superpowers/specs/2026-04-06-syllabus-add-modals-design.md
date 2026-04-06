# Syllabus Editor — Add modals for CLO and Outline

**Date:** 2026-04-06
**Type:** Feature (frontend only)
**Scope:** Single page module, zero backend changes

## Context

On the syllabus editor, both Tab 1 (CLO) and Tab 3 (Nội dung chi tiết) currently use
**inline forms** to add new rows, instead of the modal pattern used throughout the rest
of the app (Users, Programs, Courses, RBAC Admin, etc.). This is inconsistent UX and
makes adding content feel out of place. The user asked to replace the inline "add" flows
with modal popups.

Current add flows:

- **Tab 1 (CLO)** — clicking "+ Thêm" at
  [public/js/pages/syllabus-editor.js:209](../../../public/js/pages/syllabus-editor.js#L209)
  reveals an inline form below the table (`#clo-form-area`) with Mã and Mô tả inputs.
  Submit calls `saveCLO()` which POSTs `/api/syllabi/:id/clos` immediately.
- **Tab 3 (Outline)** — clicking "+ Thêm bài" at
  [public/js/pages/syllabus-editor.js:358](../../../public/js/pages/syllabus-editor.js#L358)
  calls `addOutlineRow()` which injects a blank row directly into the list. The row is
  in-memory only until the user clicks tab "Lưu" or the page-header "Lưu tất cả" button.

Edit flows differ fundamentally:

- **CLO edit** — clicking "Sửa" on a row triggers `editCLO(id, code, desc)` which reuses
  the same `#clo-form-area` inline form. Submit PUTs `/api/clos/:id`.
- **Outline edit** — all rows in the table are directly editable inline via `<input>`
  and `<textarea>` elements. There is no separate edit form.

## Decision

Replace the "+ Thêm" / "+ Thêm bài" buttons with **modal dialogs** that use the app-wide
modal CSS system (`.modal-overlay / .modal / .modal-header / .modal-body / .modal-footer`
from [public/css/styles.css:316-370](../../../public/css/styles.css#L316-L370)). Each
modal is **add-only**. Existing edit and delete flows are untouched:

- **CLO:** keep the inline `#clo-form-area` for edit. Add modal is separate.
- **Outline:** keep inline row editing. Add modal is separate.

### Why add-only, not add+edit

The user explicitly chose "Thêm-Only modal, lại edit inline như cũ" when asked. Reasons:

- Outline already has 6 editable fields directly in the row; a dedicated edit modal would
  duplicate that UI without benefit.
- CLO edit works today; replacing it would expand scope and risk regression in a
  well-trodden code path (inline form has had fine-tuning like `clo-edit-id`, title
  swap logic, etc.).
- Add-only modal solves the user's stated pain ("when adding, show a popup") without
  touching anything else.

### Save models differ per tab

- **CLO modal** — save immediately via `POST /api/syllabi/:id/clos`, then close modal,
  toast "Đã thêm CLO", re-render Tab 1. This matches the existing per-row immediate-save
  behavior of CLOs.
- **Outline modal** — append to `this.syllabus.content.course_outline` in memory, close
  modal, toast "Đã thêm bài (chưa lưu)", re-render Tab 3. Persistence happens only when
  the user clicks tab "Lưu" or page-header "Lưu tất cả". This matches the batch-save
  model of the outline tab and is consistent with the sync-on-switch feature added
  earlier.

The inconsistency is intentional: it mirrors the two tabs' pre-existing save models
rather than forcing either to change.

## Implementation

### New state

No new state. Modal HTML elements are created once in `render()` and reused.

### Modal HTML placement

Both modals are appended to the top-level `container.innerHTML` inside `render()`,
**outside** `#syl-tab-content`. The reason: `renderSylTab()` replaces `#syl-tab-content`
on every tab switch, so anything inside it gets destroyed. The modal shell must live
above the tab content so it survives tab switches.

Placement target: just before the closing of the `render()` template string, after the
existing `<div id="syl-tab-content">...</div>` at
[line 113](../../../public/js/pages/syllabus-editor.js#L113).

### CLO Add Modal

```html
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
          <button type="button" class="btn btn-secondary"
            onclick="window.SyllabusEditorPage.closeAddCLOModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Thêm</button>
        </div>
      </form>
    </div>
  </div>
</div>
```

### Outline Add Modal

```html
<div id="outline-add-modal" class="modal-overlay">
  <div class="modal" style="max-width:640px;">
    <div class="modal-header"><h2>Thêm bài học</h2></div>
    <div class="modal-body">
      <form id="outline-add-form">
        <div class="input-group">
          <label>Tên bài <span class="required-mark">*</span></label>
          <input type="text" id="outline-add-title" required
            placeholder="VD: Chương 1 — Giới thiệu">
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
          <button type="button" class="btn btn-secondary"
            onclick="window.SyllabusEditorPage.closeAddOutlineModal()">Hủy</button>
          <button type="submit" class="btn btn-primary">Thêm</button>
        </div>
      </form>
    </div>
  </div>
</div>
```

### Form submit listeners

Add inside `render()`, after the existing
`document.querySelectorAll('#syl-tabs .tab-item').forEach(...)` block at
[lines 116-123](../../../public/js/pages/syllabus-editor.js#L116-L123):

```js
document.getElementById('clo-add-form')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await this.submitAddCLO();
});
document.getElementById('outline-add-form')?.addEventListener('submit', (e) => {
  e.preventDefault();
  this.submitAddOutline();
});
```

### New methods (6 total)

Place them after the existing `deleteCLO()` method (line 259), which keeps the
CLO-related code grouped.

```js
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

And place these after the existing outline collector region, near where
`addOutlineRow()` used to live (line 388):

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

**Why `_collectOutline()` runs before appending the new lesson:** if the user has been
editing inline row inputs for existing lessons and hasn't saved, `renderSylTab()` would
destroy their in-DOM edits. Calling the collector first captures those into
`this.syllabus.content.course_outline`. Then the new row is appended and re-render
shows both the preserved edits and the new row. This reuses the collector built in the
earlier "Lưu tất cả" feature.

### Button wiring changes in renderCLOTab

```diff
- ${editable ? '<button class="btn btn-primary btn-sm" id="add-clo-btn">+ Thêm</button>' : ''}
+ ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.openAddCLOModal()">+ Thêm</button>' : ''}
```

Then delete the now-unused `add-clo-btn` listener block at
[lines 238-243](../../../public/js/pages/syllabus-editor.js#L238-L243):

```diff
- document.getElementById('add-clo-btn')?.addEventListener('click', () => {
-   document.getElementById('clo-edit-id').value = '';
-   document.getElementById('clo-code').value = `CLO${this.clos.length + 1}`;
-   document.getElementById('clo-desc').value = '';
-   document.getElementById('clo-form-area').style.display = 'block';
- });
```

Do **not** delete the `#clo-form-area` inline form HTML itself (it is still used by the
"Sửa" button via `editCLO()`).

### Button wiring changes in renderOutlineTab

```diff
- ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.addOutlineRow()">+ Thêm bài</button>' : ''}
+ ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.openAddOutlineModal()">+ Thêm bài</button>' : ''}
```

And delete the now-unused `addOutlineRow()` method at
[lines 388-395](../../../public/js/pages/syllabus-editor.js#L388-L395). It is the only
caller of itself after this change.

## Edge cases

- **Duplicate CLO code:** the server rejects with a 4xx response; the modal catches it,
  shows the error in `.modal-error`, keeps the modal open for the user to fix.
- **Modal dirty-guard (click outside):** `App.modalGuard()` from
  [public/js/app.js:544](../../../public/js/app.js#L544) handles this uniformly — if the
  user clicks the overlay with dirty form, a "Lưu / Hủy / Không lưu" confirm appears.
  This is the same behavior as Users / Programs / Courses modals.
- **Non-draft syllabus:** the "+ Thêm" and "+ Thêm bài" buttons are already gated on
  `editable`, so they don't render on submitted/approved syllabi. Modals can never open
  in that case.
- **CLO edit regression:** the inline `#clo-form-area` is still used by `editCLO()`.
  Editing existing rows must continue to work identically.
- **Outline `lesson` numbering:** `existing.length + 1`. If the user later reorders or
  deletes, the existing `saveOutline()` re-numbers to `i + 1` on save. No change needed.
- **Tab switch while modal is open:** modal lives above tab content, so tab switches
  don't affect it. The user can close it or leave it open while looking at another tab.
  This is acceptable; the modal is modal overlay anyway (it blocks clicks outside).

## Out of scope

- Edit modals for CLO or Outline (user explicitly chose add-only).
- Delete confirmation modals (existing `window.ui.confirm` flow stays).
- Outline drag-and-drop reorder.
- Stricter CLO code validation (e.g. regex `^CLO\d+$`).
- Multi-row batch add (one CLO / one lesson per modal submission).

## Verification

1. **CLO add — happy path:**
   On a draft syllabus, open Tab 1, click **+ Thêm** → modal appears with Mã pre-filled
   `CLOn` (n = current CLO count + 1) → fill Mô tả → click **Thêm** → modal closes, toast
   "Đã thêm CLO", new row appears in the table. Reload the page → the row persists.

2. **CLO add — duplicate error:**
   Click **+ Thêm** again, enter an existing code → click **Thêm** → modal stays open,
   error text shows in the `.modal-error` element. Change code → click **Thêm** →
   succeeds.

3. **CLO edit regression:**
   Click **Sửa** on an existing CLO row → the inline `#clo-form-area` appears below the
   table as before → change description → click **Lưu** → toast "Đã cập nhật", row
   updates. Confirm the modal was not involved.

4. **Outline add — happy path:**
   Tab 3, click **+ Thêm bài** → modal appears → fill title "E2E test", hours 3,
   topics "Mục 1\nMục 2" → click **Thêm** → modal closes, toast "Đã thêm bài (chưa lưu)",
   new row at the bottom of the table. Click tab "Lưu" → reload → row persists.

5. **Outline add — edits survive:**
   On Tab 3 with existing rows, edit the title of row 1 inline to "Edited title" (do NOT
   click Lưu). Click **+ Thêm bài**, fill title "New", submit. The new row appears at
   the bottom AND row 1 still reads "Edited title". Click "Lưu tất cả" → reload →
   both edits persist.

6. **Modal dirty-guard:**
   Open the CLO modal, type something in Mã → click the overlay outside the modal →
   a confirm dialog "Thay đổi chưa lưu — Lưu / Hủy / Không lưu" appears. Click "Không
   lưu" → modal closes without persisting.

7. **Non-draft:**
   Set a syllabus to `submitted` via psql:
   `docker exec -i program-db psql -U program -d program_db -c "UPDATE version_syllabi SET status='submitted' WHERE id=<id>;"`
   Open the editor → Tab 1 and Tab 3 should not show **+ Thêm** / **+ Thêm bài**
   buttons. Revert to draft after the test.

8. **Syntax check after each task:**
   Run `node --check public/js/pages/syllabus-editor.js` and confirm no output.
