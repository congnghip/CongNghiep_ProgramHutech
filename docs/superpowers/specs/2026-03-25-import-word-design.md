# Import Word CTDT — Design Spec

## Overview

Build a feature to import a standard HUTECH Word (.docx) file to create a complete CTDT (training program) with all associated data: program info, PO, PLO, PI, courses, matrices, teaching plan, and assessment plan.

The Word file format is standardized across all departments at HUTECH.

## Decisions

- **Import mode**: Create new CTDT only (not update existing)
- **Parsing**: Server-side (Node.js) using `docx` npm package for direct XML/table structure access
- **Parse strategy**: Fixed-position section detection by heading text — reliable because format is standardized
- **UX flow**: Upload → Preview with edit capability → Confirm & Save
- **Error handling**: Warnings displayed inline in preview (yellow/red badges); errors disable save button
- **UI placement**: "Import Word" button on dashboard page, next to "Tao moi CTDT" button

## DB Schema Changes

### 1. `courses` — add credit breakdown columns

```sql
ALTER TABLE courses ADD COLUMN IF NOT EXISTS credits_theory INT DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS credits_practice INT DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS credits_project INT DEFAULT 0;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS credits_internship INT DEFAULT 0;
```

### 2. `version_courses` — add prerequisites, corequisites, elective group

```sql
ALTER TABLE version_courses ADD COLUMN IF NOT EXISTS prerequisite_course_ids INT[];
ALTER TABLE version_courses ADD COLUMN IF NOT EXISTS corequisite_course_ids INT[];
ALTER TABLE version_courses ADD COLUMN IF NOT EXISTS elective_group VARCHAR(100);
```

### 3. New table `knowledge_blocks`

```sql
CREATE TABLE IF NOT EXISTS knowledge_blocks (
  id SERIAL PRIMARY KEY,
  version_id INT REFERENCES program_versions(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  parent_id INT REFERENCES knowledge_blocks(id) ON DELETE CASCADE,
  total_credits INT DEFAULT 0,
  required_credits INT DEFAULT 0,
  elective_credits INT DEFAULT 0,
  sort_order INT DEFAULT 0
);
```

### 4. `program_versions` — add general objective

```sql
ALTER TABLE program_versions ADD COLUMN IF NOT EXISTS general_objective TEXT;
```

### 5. New table `teaching_plan`

```sql
CREATE TABLE IF NOT EXISTS teaching_plan (
  id SERIAL PRIMARY KEY,
  version_course_id INT REFERENCES version_courses(id) ON DELETE CASCADE,
  total_hours INT DEFAULT 0,
  hours_theory INT DEFAULT 0,
  hours_practice INT DEFAULT 0,
  hours_project INT DEFAULT 0,
  hours_internship INT DEFAULT 0,
  software VARCHAR(500),
  managing_dept VARCHAR(200),
  batch VARCHAR(10),
  notes TEXT
);
```

### 6. `assessment_plans` — add columns

```sql
ALTER TABLE assessment_plans ADD COLUMN IF NOT EXISTS direct_evidence VARCHAR(200);
ALTER TABLE assessment_plans ADD COLUMN IF NOT EXISTS expected_result VARCHAR(200);
ALTER TABLE assessment_plans ADD COLUMN IF NOT EXISTS contributing_course_codes TEXT;
```

## Word Parser

### File structure

New file: `word-parser.js` at project root, alongside `server.js`.

### Dependencies

- `docx` (npm) — read .docx XML structure, access tables with merged cell support
- `multer` (npm, already used or trivial to add) — handle multipart file upload

### Section detection order

The parser processes sections in fixed order, identified by heading text:

| # | Section | Detection | Output |
|---|---------|-----------|--------|
| 1 | Header | First lines: "CHUONG TRINH DAO TAO..." | degree level, program name |
| 2 | General info | First table (16-17 rows, key-value) | program + version metadata |
| 3 | General objective | Paragraph after "2.1. Muc tieu" heading, before "Muc tieu cu the" | general_objective |
| 4 | PO (objectives) | Lines starting with "PO1:", "PO2:"... | version_objectives |
| 5 | PLO table | Table with headers "PLO", "Tuong ung PO", "Trinh do nang luc" | version_plos + po mapping |
| 6 | PO-PLO matrix | Table with PO rows x PLO columns, "X" values | po_plo_map |
| 7 | Knowledge blocks | Table "Khoi kien thuc / So tin chi / Ty le" | knowledge_blocks |
| 8 | Detailed curriculum | Large table: STT, Ma HP, Ten HP, TC columns, prerequisites | courses + version_courses |
| 9 | Course-PI matrix | Table: course codes x PI columns, values 1/2/3 | version_pi_courses, course_plo_map |
| 10 | Course descriptions | Table: STT, Ma HP, Ten HP, Mo ta | courses.description |
| 11 | Appendix I: Teaching plan | Tables per semester | teaching_plan |
| 12 | Appendix II: PI | Table PLO -> PI descriptions | plo_pis |
| 13 | Appendix III: Assessment | Large multi-column table | assessment_plans |

### Parser module structure

```
word-parser.js
  parseWordFile(buffer) -> ParsedCTDT
    extractGeneralInfo(tables, paragraphs)
    extractObjectives(paragraphs)
    extractPLOs(tables)
    extractPOPLOMatrix(tables)
    extractKnowledgeBlocks(tables)
    extractCourses(tables)
    extractCoursePIMatrix(tables)
    extractCourseDescriptions(tables)
    extractTeachingPlan(tables)
    extractPIs(tables)
    extractAssessmentPlan(tables)
  validateParsedData(data) -> { warnings[], errors[] }
```

### ParsedCTDT object shape

```js
{
  program: {
    name: String,          // "Ngon ngu Trung Quoc"
    name_en: String,       // "Chinese Language"
    code: String,          // "7220204"
    degree: String,        // "Dai hoc"
    total_credits: Number, // 125
    institution: String,   // "Truong DH Cong Nghe TP.HCM"
    degree_name: String,   // "Cu nhan Ngon ngu Trung Quoc"
    training_mode: String  // "Chinh quy"
  },
  version: {
    academic_year: String,
    general_objective: String,
    training_duration: String,
    grading_scale: String,
    graduation_requirements: String,
    job_positions: String,
    further_education: String,
    reference_programs: String,
    training_process: String,
    admission_targets: String,
    admission_criteria: String
  },
  objectives: [{ code: String, description: String }],
  plos: [{ code: String, description: String, bloom_level: Number, po_codes: String[] }],
  poploMatrix: [{ po_code: String, plo_code: String }],
  knowledgeBlocks: [{ name: String, parent_name: String|null, total_credits: Number,
                      required_credits: Number, elective_credits: Number, sort_order: Number }],
  courses: [{
    code: String, name: String, credits: Number,
    credits_theory: Number, credits_practice: Number,
    credits_project: Number, credits_internship: Number,
    semester: Number, course_type: String,      // 'required' | 'elective'
    elective_group: String|null,                // "Tieng Trung thuong mai"
    prerequisite_codes: String[],
    corequisite_codes: String[]
  }],
  coursePIMatrix: [{ course_code: String, pi_code: String, contribution_level: Number }],
  courseDescriptions: [{ code: String, description: String }],
  teachingPlan: [{
    course_code: String, semester: Number, total_hours: Number,
    hours_theory: Number, hours_practice: Number,
    hours_project: Number, hours_internship: Number,
    software: String, managing_dept: String, batch: String
  }],
  pis: [{ plo_code: String, pi_code: String, description: String }],
  assessmentPlan: [{
    plo_code: String, pi_code: String, description: String,
    contributing_course_codes: String,
    sample_course_code: String,
    direct_evidence: String,
    assessment_tool: String,
    expected_result: String,
    semester: String,
    assessor: String,
    dept_code: String
  }],
  warnings: [{ field: String, message: String, severity: 'warning'|'error' }]
}
```

## API Endpoints

### POST /api/import/parse-word

- **Auth**: Required, permission `import_word`
- **Input**: `multipart/form-data` with field `file` (.docx)
- **Processing**: Parse file using `word-parser.js`, validate, return parsed data
- **Output**: `{ success: true, data: ParsedCTDT }` or `{ success: false, error: String }`
- **No DB writes** — parse only

### POST /api/import/save

- **Auth**: Required, permission `import_word`
- **Input**: JSON body = ParsedCTDT object (possibly edited by user in preview)
- **Input extra**: `department_id` (user selects from dropdown, not in Word file)
- **Processing**: Save all data in single PostgreSQL transaction
- **Output**: `{ success: true, program_id: Number, version_id: Number, summary: Object }`

#### Save order (within transaction):

1. INSERT `programs` -> get program_id
2. INSERT `program_versions` (status = 'draft') -> get version_id
3. INSERT `version_objectives` (PO)
4. INSERT `version_plos` (PLO) -> get plo IDs
5. INSERT `plo_pis` (PI) -> get pi IDs
6. UPSERT `courses` (ON CONFLICT ON code) -> get course IDs
7. INSERT `version_courses` (resolve prerequisite codes to IDs) -> get version_course IDs
8. INSERT `knowledge_blocks`
9. INSERT `po_plo_map`
10. INSERT `course_plo_map` (derived from Course-PI matrix)
11. INSERT `version_pi_courses`
12. INSERT `teaching_plan`
13. INSERT `assessment_plans`
14. UPDATE `courses.description` from course descriptions

If any step fails -> ROLLBACK entire transaction.

## Validation Rules

| Rule | Severity | Description |
|------|----------|-------------|
| Program code empty | Error | Required field |
| Program name empty | Error | Required field |
| No POs found | Error | At least 1 PO required |
| No PLOs found | Error | At least 1 PLO required |
| No courses found | Error | At least 1 course required |
| Prerequisite code not in course list | Warning | Yellow badge on field |
| Total credits mismatch | Warning | Sum of courses vs general info |
| Bloom level outside 1-6 | Warning | Default to 1 |
| Course-PI matrix references unknown course | Warning | Skip that mapping |
| Course code already exists in DB | Warning | Will use existing course, update info |

## Frontend

### UI placement

- "Import Word" button on dashboard page, next to existing "Tao moi CTDT" button
- No separate sidebar menu item

### Page module

New file: `public/js/pages/import-word.js`

### Upload step

- Drag & drop area or file picker button
- Accept only `.docx`
- Show spinner during parse
- File size limit: 10MB

### Preview step

Tabbed interface showing parsed data. All tabs are editable.

| Tab | Content | Edit type |
|-----|---------|-----------|
| Thong tin chung | Key-value table | Inline edit |
| Muc tieu (PO) | List: code + description | Inline edit |
| Chuan dau ra (PLO) | Table: code, description, bloom, PO mapping | Inline edit |
| Chi so PI | Table: PLO -> PI list | Inline edit |
| Danh sach HP | Table: code, name, credits breakdown, semester, type, group, prereqs | Inline edit |
| Cau truc khoi KT | Table: block name, credits, required, elective, ratio | Inline edit |
| Ma tran PO-PLO | Check matrix | Toggle cells |
| Ma tran Course-PI | Contribution matrix (0/1/2/3) | Edit cells |
| Ke hoach giang day | Table per semester | Inline edit |
| Ke hoach danh gia | Multi-column table | Inline edit |
| Mo ta HP | Table: code, name, description | Inline edit |

- Warnings: yellow/red badges inline at problematic fields
- Summary bar at top: "X warnings, Y errors"
- Save button disabled if any errors exist

### Confirm & Save step

- Button "Tao CTDT" (disabled if errors)
- Department dropdown (required, not in Word file)
- Academic year input (required, e.g. "2025-2026")
- Confirmation dialog: "Se tao CTDT [name] voi [X] PO, [Y] PLO, [Z] hoc phan. Tiep tuc?"
- On success: redirect to version detail page

## File changes summary

| File | Change |
|------|--------|
| `db.js` | Add schema migrations (ALTER TABLE + CREATE TABLE) in `initDB()` |
| `server.js` | Add 2 new API endpoints, add multer middleware for file upload |
| `word-parser.js` | New file — Word parsing logic |
| `public/js/pages/import-word.js` | New file — import page UI |
| `public/js/app.js` | Add route for import-word page |
| `public/js/pages/dashboard.js` (or programs page) | Add "Import Word" button next to "Tao moi" |
| `package.json` | Add `docx` and `multer` dependencies |
