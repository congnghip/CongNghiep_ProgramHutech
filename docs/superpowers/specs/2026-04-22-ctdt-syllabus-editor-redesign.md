# CTĐT Syllabus Editor Redesign — Design Spec

**Date:** 2026-04-22  
**Status:** Approved

## Goal

Refactor `SyllabusEditorPage` (`public/js/pages/syllabus-editor.js`) so its tab layout mirrors the base syllabus editor (`BaseSyllabusEditorPage`), while keeping mục 3, 9, 10 editable and all other content read-only.

## Tab Structure (6 tabs, was 4)

| Index | Tab label | Content | Editable |
|-------|-----------|---------|----------|
| 0 | Thông tin chung | Mục 1–8 display + mục 3 selects (khối KT, tính chất) | Mục 3 only |
| 1 | CLO | Mục 10: CLO list (read-only) + CLO↔PI/PLO mapping | Mapping only |
| 2 | Ma trận PLO/PI | Mục 9: HP↔PLO table + HP↔PI table | Editable |
| 3 | Nội dung giảng dạy | Mục 13 + 16: outline bài học, self-study | Read-only |
| 4 | Đánh giá | Mục 14: bảng đánh giá, trọng số | Read-only |
| 5 | Tài liệu | Mục 15 + 17 + instructor block | Read-only |

## Data Flow

- **Tab 0**: `this.syllabus` + `this.syllabus.content`. Saves via existing `saveSection3()`.
- **Tab 1**: fetches `/api/syllabi/:id/clos` + `/api/syllabi/:id/clo-pi-map`. Saves via existing section-10 save logic.
- **Tab 2**: fetches `/api/syllabi/:id/ctdt-section9`. Saves via existing section-9 save logic.
- **Tab 3–5**: reads from `this.syllabus.content` already in memory. No extra fetches.

**No new API endpoints.**

## Implementation Scope

Only file changed: `public/js/pages/syllabus-editor.js`

### Changes

1. **Tab bar HTML** — 4 tabs → 6 tabs with new labels. `data-tab` indices 0–5.

2. **`renderSylTab()` switch** — add cases 3, 4, 5:
   - `case 3` → `this.renderOutlineTab(body, c)` (new)
   - `case 4` → `this.renderGradingTab(body, c)` (new)
   - `case 5` → `this.renderResourcesTab(body, c)` (new)

3. **Rename `renderSections1To8()`** → `renderGeneralTab()` for consistency. Content unchanged.

4. **Old tab indices** shift:
   - Old `case 1` (Mục 9) → `case 2`
   - Old `case 2` (Mục 10) → `case 1`
   - Old `case 3` (Mục 11–17) → removed, replaced by cases 3/4/5

5. **`renderSections11To17()`** — remove. Replace with three new read-only render methods:
   - `renderOutlineTab(body, c)` — renders course outline + self-study. All inputs `disabled`. Mirrors `BaseSyllabusEditorPage._outlineRowHtml` but simpler (no edit controls, no add-lesson button).
   - `renderGradingTab(body, c)` — renders assessment table. All inputs `disabled`.
   - `renderResourcesTab(body, c)` — renders textbooks, references, tools, other_requirements, instructor block. All `disabled`.

6. **Header save button label** — change "Lưu mục 3, 9, 10" → "Lưu" (content unchanged).

7. **`_collectCurrentTabIntoState()`** — update tab index mappings to match new indices (tab 2 → section9, tab 1 → section10, etc.).

### Not Changed

- `normalizeCtdtSyllabusContent()`
- `saveSection3()`, `saveAll()`, section-9 and section-10 save logic
- `renderSection9()` (now called from `case 2`)
- `renderSection10()` (now called from `case 1`)
- All API endpoints
- Route navigation in `app.js`
- `server.js`, `db.js`

## Read-only Render Logic

The three new read-only tabs render the same fields as base syllabus editor but:
- All `<input>`, `<select>`, `<textarea>` have `disabled` attribute
- No "add" / "delete" / "edit" buttons rendered
- Source data comes from `this.syllabus.content` (already normalized by `normalizeCtdtSyllabusContent`)

## Risk & Constraints

- Tab index shift (old 1→2, old 2→1, old 3→removed) must be applied consistently in `_collectCurrentTabIntoState()` and any other place that references `this.activeTab` by number.
- CLO tab (index 1) shows CLO list as read-only but mapping is editable — this is the same as the current `renderSection10()` behaviour; no logic change needed there.
