# Design: Import Syllabus from PDF via Gemini LLM

**Date:** 2026-03-25
**Status:** Approved

## Summary

Add the ability to import syllabus (de cuong chi tiet hoc phan) from PDF files into the system using Gemini LLM for text extraction and structured parsing. The feature integrates into the existing syllabus editor as an "Import from PDF" button, extracts structured data via `pdf-parse` + Gemini API, and populates the editor form for user review before saving.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Extraction scope | Full: content + CLO + CLO-PLO mapping | User needs complete syllabus import |
| UI location | Button inside syllabus editor | Contextual — user is already editing a specific syllabus |
| JSONB structure | Migrate to new structure | New fields needed (language_instruction, course_description, course_requirements) and structural changes (textbooks/references as arrays, course_outline by lesson) |
| PDF processing | pdf-parse text extraction → Gemini text | User preference; lighter dependency |
| Save behavior | Preview + edit before save | LLM output needs human review |
| CLO-PLO matching | Auto-match with warnings | Best UX — auto where possible, transparent about gaps |

## Environment Configuration

Requires `GEMINI_API_KEY` in `.env`. The key is read via `process.env.GEMINI_API_KEY` at runtime.

**Pre-requisite:** This repository currently has no `.gitignore` and `.env` is tracked in git. Before implementation:
1. Create `.gitignore` with `.env` entry
2. Run `git rm --cached .env` to stop tracking
3. Commit the `.gitignore` addition

## 1. End-to-End Flow

```
[Syllabus Editor]
    │
    ├─ Button "Import từ PDF" (only visible when status = draft)
    │
    ▼
[Upload PDF file]
    │
    ▼
[POST /api/syllabi/:id/import-pdf]  ← multipart/form-data
    │
    ▼
[Backend: pdf-parse extract text from PDF]
    │
    ▼
[Backend: Send text → Gemini API with structured prompt]
    │
    ▼
[Gemini returns JSON per new schema]
    │
    ▼
[Backend: Validate JSON + Auto-match CLO-PLO]
    │  ├─ Match PLO/PI codes from PDF with PLO/PI in current version
    │  └─ Generate warnings list for unmatched codes
    │
    ▼
[Backend returns: { content, clos, clo_plo_map, warnings }]
    │
    ▼
[Frontend: Populate syllabus editor form with extracted data]
    │  └─ Display warnings (if any)
    │
    ▼
[User reviews + edits in editor]
    │
    ▼
[User clicks Save]
    │
    ▼
[Frontend orchestrates save in sequence:]
    ├─ 1. PUT /api/syllabi/:id           → save content JSONB
    ├─ 2. DELETE + POST /api/syllabi/:id/clos  → replace CLOs
    └─ 3. PUT /api/syllabi/:id/clo-plo-map     → save mappings
```

Key points:
- Import only **populates the form**, does not auto-save. User must click Save manually.
- New API endpoint: `POST /api/syllabi/:id/import-pdf` — handles extract + match, returns preview data only.
- **Prerequisite:** The syllabus record must already exist in `version_syllabi` before import (always true since user navigates from the editor).
- Save orchestrated by frontend using existing endpoints (updated for new JSONB structure).

### CLO Save Flow

The import endpoint returns preview data only — no database writes for CLOs or mappings. When user clicks Save:

1. **Save content** — `PUT /api/syllabi/:id` with new JSONB content
2. **Replace CLOs** — Frontend deletes existing CLOs, then calls `POST /api/syllabi/:sId/clos` for each imported CLO. Each call returns the new `clo_id`.
3. **Save CLO-PLO mappings** — Using the new `clo_id` values from step 2, frontend calls `PUT /api/syllabi/:sId/clo-plo-map` with `[{ clo_id, plo_id, contribution_level }]`.

This reuses all existing endpoints. The frontend holds imported CLOs and mappings in memory until Save.

## 2. New JSONB `content` Structure

### New schema for `version_syllabi.content`

```json
{
  "_schema_version": 2,
  "course_description": "string (section 11 - Mô tả tóm tắt)",
  "course_objectives": "string (section 7 - Mục tiêu HP)",
  "prerequisites": "string (section 6 - HP học trước)",
  "language_instruction": "string (ngôn ngữ giảng dạy)",
  "learning_methods": "string (section 12 - Phương pháp dạy học)",

  "course_outline": [
    {
      "lesson": 1,
      "title": "GIỚI THIỆU VỂ TRÍ TUỆ NHÂN TẠO",
      "hours": 5,
      "topics": ["1.1. Định nghĩa TTNT", "1.2. Sự phát triển..."],
      "teaching_methods": "Giảng dạy tích cực...",
      "clos": ["CLO1", "CLO4"]
    }
  ],

  "assessment_methods": [
    {
      "component": "Chuyên cần và hoạt động tích cực",
      "weight": 20,
      "assessment_tool": "",
      "clos": ["CLO4"]
    }
  ],

  "textbooks": [
    "Khoa CNTT. Tài liệu học tập HP \"TTNT Ứng dụng\". HUTECH"
  ],

  "references": [
    "Thông tư quy định Khung năng lực số (Số 02/2025/TT-BGDĐT)",
    "Tài liệu về Prompt Engineering, RAG, Multimodal AI."
  ],

  "course_requirements": {
    "software": ["Google AutoML", "Microsoft AI Builder", "IBM Watson"],
    "hardware": [],
    "lab_equipment": [],
    "classroom_setup": ""
  }
}
```

### Old → New field mapping

| Old field | New field | Change type |
|---|---|---|
| `summary` | `course_description` | Rename |
| `objectives` | `course_objectives` | Rename |
| `prerequisites` | `prerequisites` | No change |
| `methods` | `learning_methods` | Rename |
| `schedule[].week/topic/activities/clos` | `course_outline[].lesson/title/hours/topics/teaching_methods/clos` | Restructure: week → lesson |
| `grading[].component/weight/method/clos` | `assessment_methods[].component/weight/assessment_tool/clos` | Rename sub-fields; `clos` string → array (split by comma, trim, prepend "CLO" if numeric) |
| `textbooks` (string) | `textbooks` (array) | String → Array (split by newline) |
| `references` (string) | `references` (array) | String → Array (split by newline) |
| `tools` (string) | `course_requirements` (object) | String → `{ software: [tools], hardware: [], lab_equipment: [], classroom_setup: "" }` |
| *(none)* | `language_instruction` | New field (default: "") |
| *(none)* | `_schema_version` | New field (set to 2) |

### Migration strategy

- **Detection:** Use `_schema_version` field. If absent or < 2, content is old format.
- On-read migration: detect old structure (`!content._schema_version`) → auto-convert to new structure when loading.
- Save always writes new structure with `_schema_version: 2`.
- No batch migration needed — convert-on-read, save-as-new.
- Empty content `{}` is treated as new format (no migration needed).

## 3. Backend — API Endpoint & Gemini Integration

### Permission model

The endpoint reuses the same permission check as `PUT /api/syllabi/:id`:
- User must be the assigned author (`author_id`) for this syllabus, OR have role level >= 2 (TRUONG_NGANH and above).
- Syllabus must be in `draft` status.

### New endpoint: `POST /api/syllabi/:id/import-pdf`

```
Request: multipart/form-data
  - file: PDF file (max 10MB)

Response: {
  success: true,
  data: {
    content: { ... },        // New JSONB content extracted (preview only, not saved)
    clos: [                   // Extracted CLOs (preview only, not saved)
      { code: "CLO1", description: "...", pi_code: "PI6.04", plo_code: "PLO6" }
    ],
    clo_plo_map: [            // Auto-matched mappings (using plo_id from DB)
      { clo_code: "CLO1", plo_id: 123, plo_code: "PLO6", contribution_level: 3 }
    ],
    warnings: [               // Matching warnings
      "PLO không tìm thấy: PLO8 (trong PDF) không khớp với version hiện tại"
    ],
    course_info: {            // Verification info
      pdf_course_code: "AIT129",
      pdf_course_name: "Trí tuệ nhân tạo ứng dụng",
      matched: true           // courses.code exact match (case-insensitive) with syllabus's course
    }
  }
}
```

### Processing pipeline

1. **Upload + validate** — Check `req.file.mimetype === 'application/pdf'`, max 10MB
2. **pdf-parse** → extract raw text from PDF
3. **Truncate** text to max 50,000 characters (with warning if truncated)
4. **Build Gemini prompt** (see Prompt Template below)
5. **Call Gemini API** — model: `gemini-2.0-flash`, temperature: 0, JSON response mode, timeout: 60s
6. **Parse + validate** JSON response against expected schema
7. **CLO-PLO matching:**
   - Resolve `version_id` from `version_syllabi.version_id` for this syllabus
   - Query `version_plos` + `plo_pis` for current version
   - Match PI code from PDF (e.g. PI6.04) → `plo_pis.pi_code` → get `plo_id`
   - Course info matching: compare `pdf_course_code` against `courses.code` (case-insensitive) for the syllabus's `course_id`
   - Generate warnings for unmatched codes
8. **Return response** with content, CLOs, mappings, and warnings

### Gemini prompt template

```
System prompt:
"Bạn là chuyên gia phân tích đề cương chi tiết học phần (syllabus) của đại học Việt Nam.
Nhiệm vụ: Trích xuất thông tin từ văn bản đề cương, trả về JSON theo đúng cấu trúc yêu cầu.
Chú ý:
- Giữ nguyên tiếng Việt, không dịch sang tiếng Anh
- Mã CLO giữ format CLO1, CLO2...
- Mã PLO giữ format PLO1, PLO2...
- Mã PI giữ format PI1.01, PI6.04...
- Nếu không tìm thấy thông tin cho field nào, trả về chuỗi rỗng hoặc mảng rỗng"

User prompt:
"Phân tích đề cương sau và trả về JSON:

<syllabus_text>
{extracted_text}
</syllabus_text>

Trả về JSON với cấu trúc:
{
  "course_code": "mã học phần",
  "course_name": "tên học phần tiếng Việt",
  "credits": number,
  "language_instruction": "ngôn ngữ giảng dạy",
  "prerequisites": "học phần học trước",
  "course_objectives": "mục tiêu của học phần (mục 7)",
  "course_description": "mô tả tóm tắt nội dung (mục 11)",
  "learning_methods": "phương pháp dạy học (mục 12)",
  "clos": [
    { "code": "CLO1", "description": "...", "pi_code": "PI6.04", "plo_code": "PLO6" }
  ],
  "course_outline": [
    {
      "lesson": 1,
      "title": "tên bài",
      "hours": number,
      "topics": ["mục con"],
      "teaching_methods": "phương pháp dạy học cho bài này",
      "clos": ["CLO1", "CLO2"]
    }
  ],
  "assessment_methods": [
    { "component": "thành phần đánh giá", "weight": number, "assessment_tool": "bài đánh giá", "clos": ["CLO1"] }
  ],
  "textbooks": ["tài liệu chính"],
  "references": ["tài liệu tham khảo"],
  "course_requirements": {
    "software": ["phần mềm/công cụ"],
    "hardware": ["phần cứng"],
    "lab_equipment": ["thiết bị phòng thí nghiệm"],
    "classroom_setup": "yêu cầu phòng học"
  }
}"
```

### File structure

Create `pdf-syllabus-parser.js` (analogous to existing `word-parser.js`) containing:
- `parsePdfToText(buffer)` — pdf-parse wrapper
- `buildGeminiPrompt(text)` — prompt construction
- `callGeminiApi(prompt)` — Gemini SDK call with timeout
- `validateResponse(json)` — schema validation
- `matchCloPlo(clos, versionId, pool)` — CLO-PLO matching logic

Route handler in `server.js` stays thin (< 30 lines), delegating to `pdf-syllabus-parser.js`.

### New dependencies

- `pdf-parse` — extract text from PDF (lightweight, ~50KB)
- `@google/generative-ai` — official Gemini SDK

### Error handling

| Error | Response |
|---|---|
| File is not PDF (mimetype check) | 400 — "Chỉ hỗ trợ file PDF" |
| File too large (>10MB) | 400 — "File vượt quá 10MB" |
| pdf-parse fails | 500 — "Không thể đọc file PDF" |
| Gemini API error / timeout (60s) | 500 — "Lỗi kết nối AI, vui lòng thử lại" |
| Gemini returns invalid JSON | 500 — "Không thể phân tích đề cương, vui lòng thử lại" |
| Text too long (>50K chars) | Truncate + add warning |
| Course code in PDF doesn't match | Warning in response (non-blocking) |

## 4. Frontend — Syllabus Editor Updates

### 4.1 Import PDF button

Add "Import từ PDF" button to syllabus editor toolbar (next to existing Save button). Only visible when syllabus status is `draft`.

```
[Import từ PDF]  [Lưu đề cương]
```

Click → file picker (accept=".pdf") → upload → loading spinner "Đang phân tích đề cương..." → receive response → populate form.

### 4.2 Tab updates

| Current tab | Changes |
|---|---|
| **Tổng quan** (summary, objectives, prerequisites, methods) | Rename fields + add `language_instruction`, `course_description` |
| **CLO** (list, add, edit, delete) | Keep logic, import pre-fills list |
| **CLO-PLO** (matrix editor) | Keep logic, import pre-fills mapping + show warnings |
| **Nội dung** (schedule, 15 weeks) | **Redesign** → `course_outline` by lesson: title, hours, topics[], teaching_methods, clos[] |
| **Đánh giá** (grading) | Update field names: `method` → `assessment_tool`, add `clos` array |
| **Tài liệu** (textbooks, references, tools) | `textbooks`/`references` → editable list (add/remove items). `tools` → `course_requirements` structured form (software, hardware, lab, classroom) |

### 4.3 Import flow in frontend

```javascript
// Pseudo-code
1. User clicks "Import từ PDF"
2. File picker → select PDF
3. POST /api/syllabi/:id/import-pdf (FormData)
4. Receive response:
   a. Populate content fields in form
   b. Populate CLOs in CLO tab (replace) — hold in memory
   c. Store CLO-PLO map data in memory (with plo_ids from response)
   d. Display warnings as alert/toast
   e. Display course_info for user verification
5. User reviews, edits
6. User clicks Save:
   a. PUT /api/syllabi/:id → save content JSONB
   b. Delete existing CLOs, POST new CLOs → get clo_ids
   c. PUT clo-plo-map with real clo_ids + plo_ids
```

### 4.4 Handling existing data

When importing into a syllabus that already has data:
- Show confirm dialog: "Đề cương đã có dữ liệu. Import sẽ **ghi đè** toàn bộ nội dung. Tiếp tục?"
- OK → replace all content, CLOs, mappings
- Cancel → abort

### 4.5 Migration on-read for editor

When editor loads a syllabus with old structure:
```javascript
if (!content._schema_version || content._schema_version < 2) {
  content = migrateOldToNew(content);
}
```

`migrateOldToNew()` converts:
- `summary` → `course_description`
- `objectives` → `course_objectives`
- `methods` → `learning_methods`
- `schedule[]` → `course_outline[]` (map `week` → `lesson`, `topic` → `title`, `activities` → `teaching_methods`)
- `grading[]` → `assessment_methods[]` (map `method` → `assessment_tool`; split `clos` string by comma, trim, prepend "CLO" if values are numeric)
- `textbooks` string → array (split by newline, filter empty)
- `references` string → array (split by newline, filter empty)
- `tools` string → `course_requirements: { software: [tools], hardware: [], lab_equipment: [], classroom_setup: "" }`
- Sets `_schema_version: 2`

## 5. Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `.gitignore` | **Create** | Add `.env`, `node_modules/` — then `git rm --cached .env` to untrack |
| `pdf-syllabus-parser.js` | **Create** | Gemini integration: PDF text extraction, prompt, API call, validation, CLO-PLO matching (analogous to `word-parser.js`) |
| `server.js` | Modify | Add thin `POST /api/syllabi/:id/import-pdf` route handler, update `PUT /api/syllabi/:id` for new JSONB structure |
| `public/js/pages/syllabus-editor.js` | Modify | Add import button, update all tabs for new field names/structures, add migration function, add multi-step save logic |
| `package.json` | Modify | Add `pdf-parse` and `@google/generative-ai` dependencies |
