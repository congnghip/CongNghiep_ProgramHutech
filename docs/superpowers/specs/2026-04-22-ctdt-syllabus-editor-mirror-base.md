# CTDT Syllabus Editor — Mirror Base UI Design Spec

**Date:** 2026-04-22  
**Status:** Approved

## Goal

Make the CTDT syllabus editor (`SyllabusEditorPage`) render tabs 0, 3, 4, 5 with identical layout and fields as `BaseSyllabusEditorPage`, with all non-editable fields rendered `disabled`. Tabs 1 (CLO) and 2 (Ma trận PLO/PI) remain unchanged.

## Scope

**Only file changed:** `public/js/pages/syllabus-editor.js`

**Methods updated:**
1. `renderSections1To8(body, editable)` — add teaching methods table
2. `renderOutlineTab(body, editable, c)` — full rewrite to mirror base
3. `renderGradingTab(body, editable, c)` — full rewrite to mirror base
4. `renderResourcesTab(body, editable, c)` — full rewrite to mirror base

**Methods NOT changed:** `renderSection9`, `renderSection10`, `collectSection3`, `collectSection9`, `_collectCloPiMap`, `saveSection3`, `saveSection9`, `saveAll`, `normalizeCtdtSyllabusContent`, all API endpoints.

---

## Tab 0 — Thông tin chung (`renderSections1To8`)

### Current
Bảng mục 1–8 (read-only) + mục 3 (2 dropdown editable).

### Change
After the mục 1–8 table, append a **teaching methods section** (mục 12):

```
<h4>Phương pháp, hình thức tổ chức dạy học (mục 12)</h4>
<table id="ctdt-teaching-methods-table">
  thead: Phương pháp | Mục tiêu
  tbody: one row per c.teaching_methods[i]
    - two text inputs (data-field="method", data-field="objective"), always disabled
</table>
```

- Source: `this.syllabus.content.teaching_methods` (array of `{method, objective}`)
- No "add row" button (always read-only in CTDT)
- If empty array: no table rows shown

---

## Tab 3 — Nội dung giảng dạy (`renderOutlineTab`)

### Change: full rewrite to async, mirroring `BaseSyllabusEditorPage.renderOutlineTab`

**Data fetch (async):**
```
const clos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json())
cloCodes = clos.map(x => x.code).filter(Boolean)
```

**Layout:**
```
Header: "Nội dung chi tiết học phần (mục 13 + 16)"  [no "+ Thêm bài" button — editable=false]
#outline-container:
  one _outlineRowHtml(l, i, false, cloCodes) per lesson
Footer totals bar: LT {n} tiết | TH {n} tiết | Tự học {n} tiết
```

**`_outlineRowHtml(l, i, editable, cloCodes)` — mirrors base:**
- Header row: `Bài {lesson}` label + title input (disabled) + LT input (disabled) + TH input (disabled)
- Body: topics textarea (disabled) + teaching_methods textarea (disabled)
- CLO multi-select (disabled), pre-selected from `l.clo_codes`
- `<details>` self-study section: self_study_hours input + self_study_tasks textarea (both disabled)

**Important:** The existing `_outlineRowHtml` in syllabus-editor.js uses single `hours` field and comma-separated CLO text. This must be replaced to use `lt_hours`, `th_hours`, `self_study_hours`, `self_study_tasks`, and multi-select CLO — matching base editor field names.

**`_collectOutline()`** must also be updated to read from the new DOM structure (lt_hours, th_hours, clo_codes from multi-select). This method is called by `saveOutline()` (Tab 3 save) — which is only reachable when `editable=true`. Since in the CTDT redesign Tab 3 is always read-only (`renderOutlineTab(body, false, c)`), `_collectOutline()` will never be triggered — but update it anyway for correctness.

---

## Tab 4 — Đánh giá (`renderGradingTab`)

### Change: full rewrite to mirror `BaseSyllabusEditorPage.renderGradingTab`

**Data fetch (async):**
```
const clos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json())
cloCodes = clos.map(x => x.code).filter(Boolean)
```

**Layout:**
```
Header: "Phương pháp kiểm tra/đánh giá (mục 14)"  |  Tổng trọng số: {N}% (red if ≠100, green if =100)
<table id="ctdt-grading-table">
  thead: Thành phần | Quy định | Bài đánh giá | % | CLO đáp ứng
  tbody: one row per c.assessment_methods[i]
    - component input (disabled)
    - description input (disabled)  [was "assessment_tool" in old schema — use description field]
    - task_ref input (disabled)
    - weight input (disabled)
    - clo_codes multi-select (disabled), pre-selected from item.clo_codes
```

- No "add row" / delete buttons (editable=false)
- Remove default placeholder rows (current code inserts 4 default items if empty — remove this)

**`_collectGrading()`** update: read `description` and `task_ref` from new field names, read `clo_codes` from multi-select.

---

## Tab 5 — Tài liệu (`renderResourcesTab`)

### Change: full rewrite to mirror `BaseSyllabusEditorPage.renderResourcesTab`

**Layout (all inputs disabled):**

```
h3: Tài liệu phục vụ học phần (mục 15)
  textarea#ctdt-textbooks     — c.textbooks.join('\n')
  textarea#ctdt-references    — c.references.join('\n')

h4: Các công cụ theo lĩnh vực
  #ctdt-tools-container:
    one block per c.tools[i]:  {category: string, items: string[]}
      - category input (disabled)
      - items textarea (disabled, items.join('\n'))

h4: Các yêu cầu của HP (mục 17)
  textarea#ctdt-other-req     — c.other_requirements

h4: Giảng viên phụ trách học phần
  _instructorFormHtml('ctdt-instr', c.instructor, 'disabled')

h4: Giảng viên hỗ trợ / Trợ giảng (nếu có)
  _instructorFormHtml('ctdt-asst', c.assistant_instructor, 'disabled')

h4: Cách liên lạc với giảng viên/trợ giảng
  textarea#ctdt-contact-info  — c.contact_info

h4: Ngày ký
  input#ctdt-signature-date   — c.signature_date
```

**`_instructorFormHtml(prefix, data, dis)`** — already exists in base editor. Copy verbatim into syllabus-editor.js as a new method (prefix `ctdt-` instead of `bs-` to avoid ID conflicts).

**`_collectResources()`** update: read from new IDs (`ctdt-textbooks`, etc.), collect tools from `#ctdt-tools-container`, collect instructor fields from `ctdt-instr-*` and `ctdt-asst-*` IDs. Since Tab 5 is always read-only in CTDT, `_collectResources()` is never triggered — update for correctness.

---

## Data Compatibility

`normalizeCtdtSyllabusContent()` already normalizes all required fields:
- `teaching_methods: [{method, objective}]`
- `course_outline[i].lt_hours`, `th_hours`, `topics`, `clo_codes`, `self_study_hours`, `self_study_tasks`
- `assessment_methods[i].description`, `task_ref`, `weight`, `clo_codes`
- `textbooks`, `references`, `tools[i].{category, items}`
- `other_requirements`, `instructor`, `assistant_instructor`, `contact_info`, `signature_date`

No changes needed to normalization logic or API.

---

## Risk & Constraints

- `_outlineRowHtml` is used by `submitAddOutline()` (the modal submit handler). Since Tab 3 is always `editable=false` in CTDT, the "+ Thêm bài" button is never rendered and modal is never opened — no risk. But update `_outlineRowHtml` signature to match `(l, i, editable, cloCodes)` for consistency.
- IDs in resource/instructor forms use `ctdt-` prefix to avoid conflicts if both editors are ever on screen.
- `_collectGrading` and `_collectResources` are only called when `editable=true` (Tab 4/5 save buttons). Since these tabs are always `editable=false`, they're dead code for now — update for correctness anyway.
