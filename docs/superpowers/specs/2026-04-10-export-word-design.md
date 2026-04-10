# Export Word CTDT — Design Spec

## Overview

Build DOCX export for a CTDT version using `mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx` as the template. The exported file must keep the sample form as closely as possible: page layout, fonts, header/footer, table styling, static text, signature area, and fixed regulatory wording stay from the template. The system replaces only the dynamic CTDT content with data from the selected version.

## Decisions

- **Export mode**: Export one CTDT version to a full `.docx` file.
- **Template strategy**: Use the existing sample DOCX as the canonical template.
- **Static content**: Preserve static text from the template when the app does not manage it as structured data.
- **Dynamic content**: Replace version-specific fields, paragraphs, and tables from the database.
- **Frontend**: Add `Xuất DOCX` beside the existing JSON export in the version editor. Keep JSON export for debug/backup.
- **Permissions**: Reuse `programs.export`.
- **Failure behavior**: If optional data is missing, export a valid DOCX with blank cells or empty rows where appropriate. Do not fail the whole export unless the version or template is unavailable.

## Scope

The DOCX export includes the full sample document:

- General program and version information.
- General objective and PO objectives.
- PLO table and PO-PLO mapping.
- Knowledge blocks and detailed curriculum.
- Course-PI matrix and derived Course-PLO information when needed by the template.
- Course descriptions.
- Appendix I: teaching plan by semester.
- Appendix II: PI descriptions grouped by PLO.
- Appendix III: PLO/PI assessment plan.

## Architecture

### Backend Route

Add:

```http
GET /api/export/version/:vId/docx
```

The route:

1. Authenticates the user.
2. Requires `programs.export`.
3. Uses the existing version visibility guard.
4. Loads the full CTDT export dataset.
5. Calls `word-exporter.js`.
6. Returns a DOCX attachment named `CTDT_<program_code>_<academic_year>.docx`.

### Export Module

Create `word-exporter.js` at the project root.

Responsibilities:

- Load the DOCX template with `jszip`.
- Parse `word/document.xml` with `fast-xml-parser`.
- Identify sections and tables using the same kind of content heuristics as `word-parser.js`.
- Replace dynamic paragraphs and table rows.
- Preserve XML structure, relationships, styles, header/footer, and other package files.
- Return a DOCX buffer.

The module API:

```js
async function exportVersionToDocx(data, options)
```

Where `data` is the full CTDT version export object and `options.templatePath` defaults to `mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx`.

### Data Loader

Keep route code thin by adding a helper in `server.js` or a local function near the export route that loads:

- `program_versions` joined with `programs` and `departments`.
- `version_objectives`.
- `version_plos` with `plo_pis`.
- `po_plo_map`.
- `knowledge_blocks`.
- `version_courses` joined with `courses`, departments, prerequisites, corequisites, and teaching plan.
- `course_plo_map`.
- `version_pi_courses`.
- `assessment_plans` joined with PLO, PI, and sample course.
- `version_syllabi` is out of scope for this DOCX export because the current sample form does not include detailed syllabus content.

The existing JSON export can keep its current response shape, but the DOCX route should use the richer loader.

## Replacement Rules

### General Info

Replace values in the general information table:

- Vietnamese and English program name.
- Program code.
- Degree level and degree name.
- Managing department.
- Total credits.
- Training mode.
- Training duration.
- Issuing institution.
- Grading scale.
- Graduation requirements.
- Job positions.
- Further education.
- Reference programs.
- Training process.
- Admission targets.
- Admission criteria.

### Objectives

Replace the general objective paragraph and PO list. PO rows use the version objective code and description.

### PLO And PO-PLO

Replace the PLO table with current PLO rows and their mapped PO codes. Replace the PO-PLO matrix using `X` marks from `po_plo_map`.

### Curriculum

Replace knowledge block and course rows using `knowledge_blocks` and `version_courses`. Keep the template table style by cloning representative rows from the template section.

Course rows include:

- STT.
- Course code.
- Course name.
- Total credits.
- Credit breakdown.
- Prerequisite and corequisite course codes.

### Course-PI Matrix

Replace course rows and PI columns based on `version_pi_courses`. Contribution values stay numeric (`1`, `2`, `3`) to match the sample.

### Course Descriptions

Replace the course description table from course descriptions stored in `courses.description`.

### Teaching Plan

Replace Appendix I rows grouped by semester. Semester summary rows should be recalculated from exported rows.

### PI Appendix

Replace Appendix II rows using `plo_pis`, grouped under each PLO.

### Assessment Plan

Replace Appendix III rows using `assessment_plans`. Include contributing course codes, sample course, direct evidence, assessment tool, threshold/expected result, semester, assessor, and department/unit fields when available.

## Error Handling

- Missing version: return `404`.
- Missing template file: return `500` with a clear message.
- Missing optional field: leave the target cell blank.
- Empty section data: keep the section heading and export one empty row in the existing table style.
- Invalid DOCX XML generation: return `500`; tests should catch this before release.

## Frontend

In `public/js/pages/version-editor.js`:

- Add a primary `Xuất DOCX` button in the page header actions.
- Keep `Xuất JSON` as a secondary action.
- Implement `exportVersionDocx()` that fetches `/api/export/version/${versionId}/docx`, reads the blob, and triggers browser download.
- Show an alert or inline error if the export fails.

## Testing

Use test-first implementation.

### Unit-Level Export Tests

Add a Node-based test or Playwright-compatible test helper that:

- Calls `exportVersionToDocx()` with a fixture dataset.
- Confirms the returned value is a non-empty buffer.
- Opens the buffer with `jszip`.
- Confirms `word/document.xml` exists.
- Confirms the XML contains replaced data such as program code, program name, PO/PLO codes, and a course code.

### Route Tests

Add a Playwright API test that:

- Logs in or reuses the existing authenticated test pattern.
- Calls `GET /api/export/version/:vId/docx`.
- Confirms status `200`.
- Confirms `Content-Type` is DOCX.
- Confirms `Content-Disposition` contains `.docx`.

### Manual Verification

Run the app, open a CTDT version imported from the sample, click `Xuất DOCX`, and open the downloaded file in Word/LibreOffice. Confirm that:

- The file opens without repair prompts.
- The form visually matches the sample.
- Dynamic CTDT data appears in all major sections and appendices.
