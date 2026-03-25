# Import Syllabus from PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PDF syllabus import to the syllabus editor using pdf-parse + Gemini LLM

**Architecture:** Upload PDF → extract text via pdf-parse → send to Gemini API for structured extraction → return preview JSON → user reviews in editor → save via existing endpoints. New `pdf-syllabus-parser.js` module (analogous to `word-parser.js`). Syllabus editor migrated to new JSONB content structure.

**Tech Stack:** Node.js, Express, pdf-parse, @google/generative-ai (Gemini SDK), PostgreSQL JSONB

**Spec:** `docs/superpowers/specs/2026-03-25-import-syllabus-pdf-design.md`

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install pdf-parse and Gemini SDK**

```bash
npm install pdf-parse @google/generative-ai
```

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add pdf-parse and @google/generative-ai dependencies"
```

---

### Task 2: Create pdf-syllabus-parser.js

**Files:**
- Create: `pdf-syllabus-parser.js`

This module encapsulates: PDF text extraction, Gemini prompt construction, API call, response validation, and CLO-PLO matching.

- [ ] **Step 1: Create pdf-syllabus-parser.js with all functions**

Functions:
- `parsePdfToText(buffer)` — wraps pdf-parse, returns text string
- `buildGeminiPrompt(text)` — constructs system + user prompt for structured extraction
- `callGeminiApi(prompt, systemPrompt)` — calls Gemini 2.0 Flash, temperature 0, JSON mode, 60s timeout
- `validateResponse(json)` — validates required fields exist, returns cleaned object
- `matchCloPlo(clos, versionId, pool)` — queries version_plos + plo_pis, matches PI codes, returns mappings + warnings
- `parseSyllabusPdf(buffer, versionId, courseId, pool)` — orchestrates all above, returns `{ content, clos, clo_plo_map, warnings, course_info }`

The Gemini prompt template should follow the spec exactly (Vietnamese system prompt, JSON schema with field descriptions).

- [ ] **Step 2: Verify module loads without error**

```bash
node -e "const p = require('./pdf-syllabus-parser'); console.log(Object.keys(p));"
```

Expected: `[ 'parseSyllabusPdf' ]`

- [ ] **Step 3: Commit**

```bash
git add pdf-syllabus-parser.js
git commit -m "feat: add pdf-syllabus-parser module with Gemini integration"
```

---

### Task 3: Add import-pdf endpoint to server.js

**Files:**
- Modify: `server.js:9` (add require)
- Modify: `server.js:~1567` (add endpoint after CLO-PLO MAP section)

- [ ] **Step 1: Add require at top of server.js**

After line 9 (`const { parseWordFile } = require('./word-parser');`), add:
```javascript
const { parseSyllabusPdf } = require('./pdf-syllabus-parser');
```

- [ ] **Step 2: Add POST /api/syllabi/:id/import-pdf endpoint**

Insert after the CLO-PLO MAP section (~line 1567), before APPROVAL WORKFLOW. The endpoint:
1. Validates file is PDF (mimetype check)
2. Checks permission (same as PUT /api/syllabi/:id — assigned GV or syllabus.edit)
3. Checks syllabus exists and is draft
4. Calls `parseSyllabusPdf(buffer, versionId, courseId, pool)`
5. Returns `{ success, data: { content, clos, clo_plo_map, warnings, course_info } }`

- [ ] **Step 3: Test endpoint manually**

```bash
curl -X POST http://localhost:3600/api/syllabi/1/import-pdf \
  -H "Cookie: token=<jwt>" \
  -F "file=@AIT129.pdf"
```

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: add POST /api/syllabi/:id/import-pdf endpoint"
```

---

### Task 4: Update syllabus-editor.js — migrate to new JSONB structure

**Files:**
- Modify: `public/js/pages/syllabus-editor.js`

This task updates all 6 tabs to use the new field names and structures. No import UI yet — just the editor migration.

- [ ] **Step 1: Add migrateOldToNew() function**

At the top of the file, add migration function that converts old content format to new format:
- `summary` → `course_description`
- `objectives` → `course_objectives`
- `methods` → `learning_methods`
- `schedule[]` → `course_outline[]`
- `grading[]` → `assessment_methods[]`
- `textbooks` string → array
- `references` string → array
- `tools` → `course_requirements`
- Sets `_schema_version: 2`

- [ ] **Step 2: Apply migration on load**

In `render()`, after parsing content, call `migrateOldToNew()` if `_schema_version` is absent.

- [ ] **Step 3: Update renderGeneralTab**

Change field IDs and labels:
- `syl-summary` → `syl-course-desc` (Mô tả tóm tắt → course_description)
- `syl-objectives` → `syl-course-obj` (Mục tiêu → course_objectives)
- `syl-methods` → `syl-learning-methods` (Phương pháp → learning_methods)
- Add `syl-lang-inst` (Ngôn ngữ giảng dạy → language_instruction)
- Update `saveGeneral()` to use new field names

- [ ] **Step 4: Update renderScheduleTab → renderOutlineTab**

Replace week-based schedule with lesson-based course_outline:
- Each row: lesson number, title, hours, topics (textarea), teaching_methods (textarea), CLOs
- Add/remove lesson rows
- Update `saveSchedule()` → `saveOutline()`

- [ ] **Step 5: Update renderGradingTab**

- `method` → `assessment_tool`
- `clos` string → array (comma-separated in input, stored as array)
- Update `saveGrading()` accordingly

- [ ] **Step 6: Update renderResourcesTab**

- `textbooks` → editable list (add/remove items)
- `references` → editable list (add/remove items)
- `tools` → `course_requirements` structured form with 4 sub-fields
- Update `saveResources()` accordingly

- [ ] **Step 7: Update tab names in render()**

Change tab 3 label from "Lịch giảng dạy" to "Nội dung chi tiết"

- [ ] **Step 8: Test all tabs with existing data**

Manually verify: load an existing syllabus → check migration works → edit and save → reload and verify.

- [ ] **Step 9: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat: migrate syllabus editor to new JSONB content structure"
```

---

### Task 5: Add import PDF button and flow to syllabus-editor.js

**Files:**
- Modify: `public/js/pages/syllabus-editor.js`

- [ ] **Step 1: Add "Import từ PDF" button**

In `render()`, add button next to "Nộp duyệt" button (only when editable/draft):
```html
<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.importPdf()">Import từ PDF</button>
```

- [ ] **Step 2: Add importPdf() method**

Flow:
1. Create hidden file input (accept=".pdf")
2. On file selected, check existing data → show confirm dialog if not empty
3. Show loading spinner "Đang phân tích đề cương..."
4. POST to `/api/syllabi/:id/import-pdf` with FormData
5. On success: populate content, CLOs, CLO-PLO map into memory
6. Show warnings as toast notifications
7. Show course_info verification
8. Re-render current tab

- [ ] **Step 3: Add importedClos and importedMappings state**

Add properties to hold imported CLOs and mappings in memory until Save:
```javascript
importedClos: null,    // Array of { code, description, pi_code, plo_code }
importedMappings: null // Array of { clo_code, plo_id, contribution_level }
```

- [ ] **Step 4: Update save flow for imported CLOs**

When `importedClos` is not null and user saves:
1. Save content (PUT /api/syllabi/:id)
2. Delete existing CLOs one by one
3. POST new CLOs → collect new clo_ids
4. PUT CLO-PLO map with real clo_ids

- [ ] **Step 5: Test full import flow**

Upload AIT129.pdf → verify preview → check all tabs populated → save → reload → verify data persisted.

- [ ] **Step 6: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "feat: add PDF import button and flow to syllabus editor"
```

---

### Task 6: Final integration test

- [ ] **Step 1: End-to-end test**

1. Navigate to a draft syllabus in the editor
2. Click "Import từ PDF" → select AIT129.pdf
3. Verify all fields populated correctly across all tabs
4. Verify CLOs appear in CLO tab
5. Verify CLO-PLO mappings (if PLOs exist in version)
6. Check warnings displayed for unmatched PLOs
7. Click Save
8. Reload page → verify all data persisted

- [ ] **Step 2: Test with empty syllabus**
- [ ] **Step 3: Test with existing data (overwrite confirmation)**
- [ ] **Step 4: Final commit if any fixes needed**
