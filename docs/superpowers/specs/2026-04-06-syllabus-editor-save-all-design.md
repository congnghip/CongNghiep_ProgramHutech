# Syllabus Editor — "Lưu tất cả" button

**Date:** 2026-04-06
**Type:** Feature (frontend only)
**Scope:** Single page module, zero backend changes

## Context

After a lecturer imports a syllabus from PDF (via the **Import từ PDF** button in the
syllabus editor), they currently have to visit each of the six tabs and click the tab's
own **Lưu** button to fully persist the imported data. Beyond the initial import, the
same pain applies to normal editing: any edits on a tab are lost silently if the user
switches tabs without first clicking that tab's Lưu. The editor currently holds per-tab
DOM in `#syl-tab-content`, which is replaced by `renderSylTab()` on every tab switch, so
unsaved edits disappear with the old DOM.

The user asked for a **"Lưu tất cả"** (Save All) button that commits edits from every
tab in one action. Source conversation confirmed the comprehensive option (header-level
Save All that merges all tabs), and the sync-on-switch state model.

## Current save endpoints (unchanged)

| Tab | Endpoint hit today | Payload |
| --- | --- | --- |
| 0 Thông tin chung | `PUT /api/syllabi/:id` | `{ content: { course_description, course_objectives, prerequisites, language_instruction, learning_methods } }` |
| 1 CLO (imported) | `DELETE /api/clos/:id` ×N, then `POST /api/syllabi/:id/clos` ×M, then `PUT /api/syllabi/:id/clo-plo-map` | `saveImportedClos()` flow |
| 1 CLO (inline) | `POST/PUT/DELETE /api/clos/...` | per-row modal |
| 2 CLO ↔ PLO | `PUT /api/syllabi/:id/clo-plo-map` | `{ mappings: [{clo_id, plo_id, contribution_level}] }` |
| 3 Nội dung chi tiết | `PUT /api/syllabi/:id` | `{ content: { course_outline } }` |
| 4 Đánh giá | `PUT /api/syllabi/:id` | `{ content: { assessment_methods } }` |
| 5 Tài liệu | `PUT /api/syllabi/:id` | `{ content: { textbooks, references, course_requirements } }` |

Key observation: tabs 0, 3, 4, 5 all target the same `PUT /api/syllabi/:id` endpoint with
the whole `content` JSONB. **One PUT is enough to save all four tabs** if we keep
`this.syllabus.content` authoritative.

## Decision

Add a **Lưu tất cả** button on the syllabus editor page header (draft only). Maintain an
in-memory dirty state via **sync-on-switch**: when the user leaves a tab, read its DOM
and merge the result into `this.syllabus.content` (or `this.dirtyMapChanges` for tab 2).
Save All runs one content PUT, optionally persists imported CLOs, and optionally saves
tab 2 manual edits. Existing per-tab **Lưu** buttons stay — Save All is additive.

### Why sync-on-switch (not "keep all tabs in DOM" or "auto-save on switch")

- Least invasive: `renderSylTab()`, per-tab render functions, and per-tab save buttons
  stay unchanged in shape. Only collectors get extracted.
- Fixes a second pain point for free: switching tab → back no longer loses edits.
- Auto-save on switch was rejected because silent writes can overwrite work the user
  intended to discard.
- Keeping all tabs in DOM was rejected because it changes the render model significantly
  (tab 2 needs `plos` from a separate endpoint; tab 1 needs `clos` from another) and
  increases first-render latency.

## Implementation plan (frontend only)

All changes land in
[public/js/pages/syllabus-editor.js](../../../public/js/pages/syllabus-editor.js). No
backend, no schema, no routing changes.

### 1. New state fields

Add to the `window.SyllabusEditorPage` object (near the existing
`importedClos` / `importedMappings`):

```js
dirtyMapChanges: null,   // null | Array<{clo_id, plo_id, contribution_level}>
```

Reset to `null` in `render()` alongside the existing resets at lines 52-53.

### 2. Extract collectors from existing save functions

Split each content-tab save into a pure DOM→state collector and an API call. The per-tab
**Lưu** button then becomes `collect + PUT`.

- `_collectGeneral()` — reads `#syl-course-desc`, `#syl-course-obj`, `#syl-prereq`,
  `#syl-lang-inst`, `#syl-learning-methods`; writes into `this.syllabus.content` fields
  `course_description`, `course_objectives`, `prerequisites`, `language_instruction`,
  `learning_methods`. Uses `#syl-course-desc` as the anchor element — if it doesn't
  exist, the collector is a no-op. The Tab 0 DOM is rendered atomically via one
  `innerHTML =` call, so if the anchor exists, all siblings exist too.
- `_collectOutline()` — reads `#outline-container .outline-row` rows using the same
  `[data-field]` mapping as the current `saveOutline()` at line 398-414; writes
  `this.syllabus.content.course_outline`. No-op if `#outline-container` is missing.
- `_collectGrading()` — reads `#grading-table tbody tr` rows using the same mapping as
  the current `saveGrading()` at line 459-473; writes `this.syllabus.content.assessment_methods`.
  No-op if `#grading-table` is missing.
- `_collectResources()` — reads `#syl-textbooks`, `#syl-references`, `#syl-software`,
  `#syl-hardware`, `#syl-lab`, `#syl-classroom` using the same mapping as current
  `saveResources()` at line 513-529; writes `textbooks`, `references`, `course_requirements`
  into `this.syllabus.content`. Uses `#syl-textbooks` as the anchor element — no-op
  if it doesn't exist. Same atomic-render rationale as `_collectGeneral`.
- `_collectCloPloMap()` — reads `#clo-plo-table select`, builds an array of
  `{clo_id, plo_id, contribution_level}` for any select with value > 0 (same shape as
  the inline handler at line 340-342); stores the result in `this.dirtyMapChanges`.
  No-op if `#clo-plo-table` is missing.

Refactor `saveGeneral()`, `saveOutline()`, `saveGrading()`, `saveResources()` to call
their collector then PUT `/api/syllabi/:id` with the updated `this.syllabus.content`.
The visible behaviour of per-tab Lưu buttons must be unchanged (same success toast text,
same error toast path).

Tab 1 (CLO inline CRUD) has no collector — CLOs are already persisted immediately per
row via `saveCLO()` / `deleteCLO()`. The only non-persisted Tab 1 state is
`this.importedClos`, which already exists.

### 3. Dispatcher and tab-switch wiring

Add:

```js
_collectCurrentTabIntoState() {
  switch (this.activeTab) {
    case 0: this._collectGeneral(); break;
    case 2: this._collectCloPloMap(); break;
    case 3: this._collectOutline(); break;
    case 4: this._collectGrading(); break;
    case 5: this._collectResources(); break;
    // tab 1: nothing to collect
  }
}
```

Modify the tab click handler at
[syllabus-editor.js:116-123](../../../public/js/pages/syllabus-editor.js#L116-L123) to
call `_collectCurrentTabIntoState()` **before** switching `this.activeTab`:

```js
document.querySelectorAll('#syl-tabs .tab-item').forEach(el => {
  el.addEventListener('click', () => {
    this._collectCurrentTabIntoState();          // ← new
    document.querySelectorAll('#syl-tabs .tab-item').forEach(e => e.classList.remove('active'));
    el.classList.add('active');
    this.activeTab = parseInt(el.dataset.tab);
    this.renderSylTab();
  });
});
```

This delivers the secondary benefit: switching tabs no longer loses in-progress edits,
independent of Save All.

### 4. Split `saveImportedClos()` into `_persistImportedClos()` + thin wrapper

Current `saveImportedClos()` at lines 262-298 both persists and emits a success toast.
Extract the persistence body into a toast-free helper:

```js
async _persistImportedClos() {
  if (!this.importedClos) return;
  // Step 1: Delete existing CLOs
  const existingClos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json());
  for (const c of existingClos) {
    await fetch(`/api/clos/${c.id}`, { method: 'DELETE' });
  }
  // Step 2: Create new CLOs and collect ID map
  const cloIdMap = {};
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
}
```

Then the existing `saveImportedClos()` becomes:

```js
async saveImportedClos() {
  try {
    await this._persistImportedClos();
    window.toast.success('Đã lưu CLO và CLO-PLO mapping');
    this.renderSylTab();
  } catch (e) { window.toast.error(e.message); }
}
```

### 5. New `saveAll()` method and header button

Add the button to the page header actions at
[syllabus-editor.js:85-89](../../../public/js/pages/syllabus-editor.js#L85-L89), only
when `editable`:

```html
<div class="page-header-actions">
  ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveAll()">Lưu tất cả</button>' : ''}
  ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.importPdf()">Import từ PDF</button>' : ''}
  ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.submitForApproval()">Nộp duyệt</button>' : ''}
</div>
```

Handler:

```js
async saveAll() {
  try {
    // 1. Collect currently-active tab into in-memory state
    this._collectCurrentTabIntoState();

    // 2. PUT content (tabs 0/3/4/5)
    const res = await fetch(`/api/syllabi/${this.syllabusId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: this.syllabus.content }),
    });
    if (!res.ok) throw new Error((await res.json()).error || 'Lỗi lưu nội dung');

    // 3. Persist pending imported CLOs + mappings if any
    if (this.importedClos) {
      await this._persistImportedClos();
    }

    // 4. Persist tab 2 manual map edits if any.
    //    At this point `importedClos` is null (either it was never set, or step 3
    //    cleared it after persisting). If the user also tweaked Tab 2 selects after
    //    an import, step 3 wrote the imported mapping and step 4 overwrites it with
    //    the user's edits — intentional last-write-wins.
    if (this.dirtyMapChanges) {
      const res2 = await fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: this.dirtyMapChanges }),
      });
      if (!res2.ok) throw new Error((await res2.json()).error || 'Lỗi lưu CLO-PLO');
    }
    this.dirtyMapChanges = null;

    window.toast.success('Đã lưu tất cả');
    this.renderSylTab();
  } catch (e) {
    window.toast.error(e.message);
  }
}
```

Error model: fail-fast. If step 2 fails, nothing further runs. If step 3 fails after
step 2, the content PUT stays committed; the user sees the error toast and can retry
(retrying step 3 via Save All re-runs steps 2–4, which is idempotent against already
persisted content).

## Edge cases & out of scope

- **CLO add/edit modal open but not submitted:** the inline form at
  [syllabus-editor.js:207-215](../../../public/js/pages/syllabus-editor.js#L207-L215)
  is explicit per-row CRUD and is not covered by Save All. The form stays open; user
  can still click its own **Lưu** to submit the row.
- **Non-draft syllabus:** Save All button is hidden (same `editable` guard as the
  other edit buttons).
- **Tab 2 with pending imported mappings:** goes through `_persistImportedClos()`
  (`this.importedClos` truthy branch), not `dirtyMapChanges`.
- **Visual dirty indicator on tab labels:** out of scope. Can be added later if users
  report confusion about whether a tab has unsaved edits.
- **Auto-save on tab switch or page unload:** out of scope. The user explicitly asked
  for a button, not implicit persistence.
- **Prompt-before-leaving-page:** out of scope. May be revisited if we see data loss in
  practice.
- **Backend changes:** none. All endpoints already exist and are idempotent.

## Verification

1. **Happy path — save across tabs without per-tab clicks:**
   On a **draft** syllabus, open the editor → edit "Mô tả tóm tắt" on Tab 0 → click
   Tab 3 → edit a lesson title → click Tab 5 → add a textbook → click **Lưu tất cả** on
   header → reload the page → all three edits persisted.
2. **Post-import save:**
   Click **Import từ PDF** on a draft syllabus, choose a valid PDF → without visiting
   Tab 1 manually, click **Lưu tất cả** → verify CLOs in `clos` table and the
   mapping rows in `clo_plo_map` exist for this syllabus.
3. **Manual CLO-PLO edit (no pending import):**
   On a draft syllabus that already has CLOs and PLOs, open Tab 2 → flip a couple of
   selects (0 → 2) → **without** clicking the tab's own Lưu, click **Lưu tất cả** →
   reload → selects keep the new values.
4. **Fail-fast on content error:**
   Temporarily knock out the `PUT /api/syllabi/:id` endpoint (e.g. shut down the server
   mid-test or return 500 from a proxy) → click **Lưu tất cả** → expect the error toast
   and no call to `_persistImportedClos()`.
5. **Per-tab Lưu regression:**
   Repeat the existing per-tab save flow for each of Tab 0, 3, 4, 5 — confirm the
   success toast text is unchanged ("Đã lưu" or "Đã lưu nháp" per tab) and the PUT
   payload shape is unchanged.
6. **Non-draft visibility:**
   On a syllabus with status `submitted` (or any non-draft), open the editor → **Lưu
   tất cả** button must not be rendered.
7. **Tab-switch no-data-loss (bonus):**
   Start editing Tab 3, switch to Tab 4 without saving, switch back to Tab 3 → edits
   must still be present (this is the sync-on-switch benefit).
