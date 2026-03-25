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
[User clicks Save → PUT /api/syllabi/:id (existing endpoint, updated)]
```

Key points:
- Import only **populates the form**, does not auto-save. User must click Save manually.
- New API endpoint: `POST /api/syllabi/:id/import-pdf` — handles extract + match, returns preview data.
- Save uses existing endpoint `PUT /api/syllabi/:id` (updated for new JSONB structure).

## 2. New JSONB `content` Structure

### New schema for `version_syllabi.content`

```json
{
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
| `grading[].component/weight/method/clos` | `assessment_methods[].component/weight/assessment_tool/clos` | Rename sub-fields |
| `textbooks` (string) | `textbooks` (array) | String → Array |
| `references` (string) | `references` (array) | String → Array |
| `tools` (string) | `course_requirements` (object) | String → Structured object |
| *(none)* | `language_instruction` | New field |
| *(none)* | `course_description` | New field (separate from summary) |

### Migration strategy

- On-read migration: detect old structure (`content.summary` exists, `content.course_description` does not) → auto-convert to new structure when loading.
- Save always writes new structure.
- No batch migration needed — convert-on-read, save-as-new.

## 3. Backend — API Endpoint & Gemini Integration

### New endpoint: `POST /api/syllabi/:id/import-pdf`

```
Request: multipart/form-data
  - file: PDF file (max 10MB)

Response: {
  success: true,
  data: {
    content: { ... },        // New JSONB content extracted
    clos: [                   // Extracted CLOs
      { code: "CLO1", description: "...", pi_code: "PI6.04", plo_code: "PLO6" }
    ],
    clo_plo_map: [            // Auto-matched mappings
      { clo_code: "CLO1", plo_id: 123, contribution_level: 3 }
    ],
    warnings: [               // Matching warnings
      "PLO không tìm thấy: PLO8 (trong PDF) không khớp với version hiện tại"
    ],
    course_info: {            // Verification info
      pdf_course_code: "AIT129",
      pdf_course_name: "Trí tuệ nhân tạo ứng dụng",
      matched: true
    }
  }
}
```

### Processing pipeline (in server.js)

1. **Upload + validate** — PDF only, max 10MB
2. **pdf-parse** → extract raw text from PDF
3. **Build Gemini prompt:**
   - System: "Bạn là chuyên gia phân tích đề cương chi tiết học phần đại học Việt Nam..."
   - User: raw text + desired JSON schema with field descriptions
4. **Call Gemini API** — model: `gemini-2.0-flash`, temperature: 0, JSON response mode
5. **Parse + validate** JSON response against expected schema
6. **CLO-PLO matching:**
   - Query `version_plos` + `plo_pis` for current version
   - Match PI code from PDF (e.g. PI6.04) → `plo_pis.pi_code` → get `plo_id`
   - Generate warnings for unmatched codes
7. **Return response** with content, CLOs, mappings, and warnings

### Gemini prompt structure

```
Prompt consists of 3 parts:
1. Role: Expert in analyzing Vietnamese university course syllabi (de cuong chi tiet hoc phan)
2. Task: Extract information from syllabus text, return structured JSON
3. JSON schema: Exact structure with field descriptions + 1-2 example outputs
```

### New dependencies

- `pdf-parse` — extract text from PDF (lightweight, ~50KB)
- `@google/generative-ai` — official Gemini SDK

### Error handling

| Error | Response |
|---|---|
| File is not PDF | 400 — "Chỉ hỗ trợ file PDF" |
| File too large (>10MB) | 400 — "File vượt quá 10MB" |
| pdf-parse fails | 500 — "Không thể đọc file PDF" |
| Gemini API error / timeout | 500 — "Lỗi kết nối AI, vui lòng thử lại" |
| Gemini returns invalid JSON | 500 — "Không thể phân tích đề cương, vui lòng thử lại" |
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
   b. Populate CLOs in CLO tab (replace)
   c. Populate CLO-PLO map in matrix tab
   d. Display warnings as alert/toast
   e. Display course_info for user verification
5. User reviews, edits
6. User clicks Save → PUT /api/syllabi/:id
```

### 4.4 Handling existing data

When importing into a syllabus that already has data:
- Show confirm dialog: "Đề cương đã có dữ liệu. Import sẽ **ghi đè** toàn bộ nội dung. Tiếp tục?"
- OK → replace all content, CLOs, mappings
- Cancel → abort

### 4.5 Migration on-read for editor

When editor loads a syllabus with old structure:
```javascript
if (content.summary && !content.course_description) {
  content = migrateOldToNew(content);
}
```

`migrateOldToNew()` converts: `summary` → `course_description`, `objectives` → `course_objectives`, `schedule[]` → `course_outline[]`, `grading[]` → `assessment_methods[]`, `textbooks` string → array, `references` string → array, `tools` → `course_requirements.software`.

## 5. Files to Create/Modify

| File | Action | Description |
|---|---|---|
| `server.js` | Modify | Add `POST /api/syllabi/:id/import-pdf` endpoint, update `PUT /api/syllabi/:id` for new JSONB structure |
| `public/js/pages/syllabus-editor.js` | Modify | Add import button, update all tabs for new field names/structures, add migration function |
| `package.json` | Modify | Add `pdf-parse` and `@google/generative-ai` dependencies |

No new files needed — all changes go into existing files following the project's two-file backend pattern.
