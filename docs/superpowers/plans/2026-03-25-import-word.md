# Import Word CTDT — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import a standardized HUTECH .docx file to create a complete CTDT (program + version + PO/PLO/PI/courses/matrices/teaching plan/assessment plan) with preview editing before save.

**Architecture:** Server-side parsing using `jszip` + `fast-xml-parser` to read .docx XML tables directly. Two API endpoints: one for parse-only (returns JSON), one for transactional save. Frontend SPA page with tabbed preview and inline editing.

**Tech Stack:** Node.js/Express, PostgreSQL, jszip, fast-xml-parser, multer, vanilla JS frontend (no framework)

**Spec:** `docs/superpowers/specs/2026-03-25-import-word-design.md`

**Note:** No test framework is configured in this project. Each task includes manual verification steps using `node -e` scripts or curl commands against the running dev server.

**Sample file:** `mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx` (in project root) — use for all manual testing.

---

## File Structure

| File | Responsibility | Action |
|------|---------------|--------|
| `package.json` | Dependencies | Modify: add jszip, fast-xml-parser, multer |
| `db.js` | DB schema | Modify: add ALTER TABLE + CREATE TABLE in initDB() |
| `word-parser.js` | .docx XML parsing → ParsedCTDT object | Create |
| `server.js` | API endpoints: parse-word, save | Modify: add routes + multer config |
| `public/js/pages/import-word.js` | Import page: upload, preview tabs, save | Create |
| `public/js/app.js` | Page routing | Modify: add import-word to pages map |
| `public/index.html` | HTML shell | Modify: add script tag |
| `public/js/pages/programs.js` | Programs list page | Modify: add "Import Word" button |

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install npm packages**

```bash
npm install jszip fast-xml-parser multer
```

- [ ] **Step 2: Verify installation**

```bash
node -e "require('jszip'); require('fast-xml-parser'); require('multer'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add jszip, fast-xml-parser, multer for Word import"
```

---

## Task 2: DB schema changes

**Files:**
- Modify: `db.js:14-307` (inside `initDB()` function)

- [ ] **Step 1: Add migration SQL inside the existing template literal**

In `db.js`, the entire schema is inside a single `client.query(\`...\`)` call (lines 17-300). Add the following raw SQL **after the existing ALTER TABLE block at line 288** (after `ALTER TABLE version_pi_courses ADD COLUMN IF NOT EXISTS contribution_level INT DEFAULT 0;`), still inside the same template literal:

```sql
      -- Migration: Import Word feature
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS credits_theory INT DEFAULT 0;
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS credits_practice INT DEFAULT 0;
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS credits_project INT DEFAULT 0;
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS credits_internship INT DEFAULT 0;

      ALTER TABLE version_courses ADD COLUMN IF NOT EXISTS prerequisite_course_ids INT[];
      ALTER TABLE version_courses ADD COLUMN IF NOT EXISTS corequisite_course_ids INT[];
      ALTER TABLE version_courses ADD COLUMN IF NOT EXISTS elective_group VARCHAR(100);

      ALTER TABLE program_versions ADD COLUMN IF NOT EXISTS general_objective TEXT;

      ALTER TABLE assessment_plans ADD COLUMN IF NOT EXISTS direct_evidence VARCHAR(200);
      ALTER TABLE assessment_plans ADD COLUMN IF NOT EXISTS expected_result VARCHAR(200);
      ALTER TABLE assessment_plans ADD COLUMN IF NOT EXISTS contributing_course_codes TEXT;
```

- [ ] **Step 2: Add CREATE TABLE statements inside the same template literal**

Still inside the same `client.query()` template literal, add before the `-- Audit Logs` comment (before line 290):

```sql
      -- Knowledge blocks (curriculum structure)
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

Also add teaching_plan table right after knowledge_blocks, still inside the same template literal:

```sql
      -- Teaching plan (detailed per-semester schedule)
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

Note: All ALTER TABLE statements for assessment_plans are already included in Step 1 above.

- [ ] **Step 3: Verify schema changes**

Start the app and check DB:

```bash
make dev
# In another terminal:
docker exec -it hutech-ctdt-db psql -U ctdt_user -d ctdt_db -c "\d courses" | grep credits_
docker exec -it hutech-ctdt-db psql -U ctdt_user -d ctdt_db -c "\d version_courses" | grep -E "prerequisite|corequisite|elective"
docker exec -it hutech-ctdt-db psql -U ctdt_user -d ctdt_db -c "\d knowledge_blocks"
docker exec -it hutech-ctdt-db psql -U ctdt_user -d ctdt_db -c "\d teaching_plan"
docker exec -it hutech-ctdt-db psql -U ctdt_user -d ctdt_db -c "\d assessment_plans" | grep -E "direct_evidence|expected_result|contributing"
docker exec -it hutech-ctdt-db psql -U ctdt_user -d ctdt_db -c "\d program_versions" | grep general_objective
```

Expected: all new columns/tables visible.

- [ ] **Step 4: Commit**

```bash
git add db.js
git commit -m "feat: extend DB schema for Word import (credit breakdown, prereqs, knowledge blocks, teaching plan)"
```

---

## Task 3: Word parser — docx XML reader utility

**Files:**
- Create: `word-parser.js`

This task creates the foundation: reading a .docx file and extracting tables + paragraphs from the XML.

- [ ] **Step 1: Create `word-parser.js` with docx reader**

```js
const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['w:tr', 'w:tc', 'w:p', 'w:r', 'w:tbl'].includes(name),
});

/**
 * Read a .docx buffer, return parsed XML body.
 * @param {Buffer} buffer - .docx file buffer
 * @returns {Promise<{body: Object, tables: Object[], paragraphs: Object[]}>}
 */
async function readDocx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlStr = await zip.file('word/document.xml').async('string');
  const parsed = xmlParser.parse(xmlStr);
  const body = parsed['w:document']['w:body'];

  const elements = [];
  const bodyContent = body['w:p'] || [];
  const bodyTables = body['w:tbl'] || [];

  // Collect all elements in document order from raw XML
  // We need to re-parse to get order, so use a simpler approach:
  // split XML by top-level elements
  const topElements = xmlStr.match(/<w:(tbl|p|sectPr)[\s>][\s\S]*?<\/w:\1>/g) || [];

  const tables = [];
  const paragraphs = [];

  for (const el of topElements) {
    if (el.startsWith('<w:tbl')) {
      const tbl = xmlParser.parse(el)['w:tbl'];
      const tableData = parseTable(tbl);
      tables.push(tableData);
    } else if (el.startsWith('<w:p')) {
      const p = xmlParser.parse(el)['w:p'];
      const text = extractParagraphText(Array.isArray(p) ? p[0] : p);
      if (text.trim()) {
        paragraphs.push(text.trim());
      }
    }
  }

  return { tables, paragraphs };
}

/**
 * Extract text from a paragraph element.
 */
function extractParagraphText(p) {
  if (!p) return '';
  const runs = p['w:r'];
  if (!runs) return '';
  const arr = Array.isArray(runs) ? runs : [runs];
  return arr.map(r => {
    const t = r['w:t'];
    if (!t) return '';
    if (typeof t === 'string') return t;
    if (typeof t === 'object' && t['#text'] !== undefined) return String(t['#text']);
    return '';
  }).join('');
}

/**
 * Parse a w:tbl element into a 2D array of strings.
 * Handles gridSpan (horizontal merge) and vMerge (vertical merge).
 * @returns {string[][]} rows of cell texts
 */
function parseTable(tbl) {
  const rows = tbl['w:tr'];
  if (!rows) return [];
  const rowsArr = Array.isArray(rows) ? rows : [rows];

  // First pass: determine grid width
  let gridWidth = 0;
  const tblGrid = tbl['w:tblGrid'];
  if (tblGrid && tblGrid['w:gridCol']) {
    const cols = tblGrid['w:gridCol'];
    gridWidth = Array.isArray(cols) ? cols.length : 1;
  }

  const result = [];
  const vMergeTracker = {}; // col -> last value for vertical merge

  for (const row of rowsArr) {
    const cells = row['w:tc'];
    if (!cells) { result.push([]); continue; }
    const cellsArr = Array.isArray(cells) ? cells : [cells];

    const rowData = [];
    let colIdx = 0;

    for (const cell of cellsArr) {
      const tcPr = cell['w:tcPr'] || {};

      // Handle vertical merge — if vMerge exists without val="restart", copy from above
      const vMerge = tcPr['w:vMerge'];
      const gridSpan = tcPr['w:gridSpan'];
      const span = gridSpan ? parseInt(gridSpan['@_w:val'] || '1') : 1;

      let cellText = '';
      if (vMerge !== undefined && vMerge['@_w:val'] !== 'restart') {
        // Continuation of vertical merge — copy value from tracker
        cellText = vMergeTracker[colIdx] || '';
      } else {
        // Extract text from all paragraphs in cell
        const ps = cell['w:p'];
        if (ps) {
          const psArr = Array.isArray(ps) ? ps : [ps];
          cellText = psArr.map(p => extractParagraphText(p)).join('\n').trim();
        }
      }

      // Update vMerge tracker
      if (vMerge !== undefined && vMerge['@_w:val'] === 'restart') {
        vMergeTracker[colIdx] = cellText;
      } else if (vMerge === undefined) {
        delete vMergeTracker[colIdx];
      }

      // Fill gridSpan cells
      for (let s = 0; s < span; s++) {
        rowData.push(s === 0 ? cellText : '');
        colIdx++;
      }
    }

    result.push(rowData);
  }

  return result;
}

module.exports = { readDocx, parseTable, extractParagraphText };
```

- [ ] **Step 2: Verify with sample file**

```bash
node -e "
const { readDocx } = require('./word-parser');
const fs = require('fs');
const buf = fs.readFileSync('mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx');
readDocx(buf).then(({ tables, paragraphs }) => {
  console.log('Tables found:', tables.length);
  console.log('Paragraphs found:', paragraphs.length);
  console.log('First table rows:', tables[0].length);
  console.log('First table row 0:', tables[0][0]);
  console.log('Table 2 row 0:', tables[1] && tables[1][0]);
});
"
```

Expected: Tables found: 14, paragraphs > 50, table data visible.

- [ ] **Step 3: Commit**

```bash
git add word-parser.js
git commit -m "feat: add docx XML reader with table parsing and merge cell support"
```

---

## Task 4: Word parser — extract general info + PO + PLO

**Files:**
- Modify: `word-parser.js`

- [ ] **Step 1: Add `extractGeneralInfo` function**

This extracts data from the second table (table index 1) which is the key-value "Thong tin chung" table with ~20 rows.

```js
/**
 * Extract general program info from the key-value table.
 * Table structure: row 0 = "1 | Ten nganh dao tao | Ten tieng Viet: ..."
 * @param {string[][]} table - 2D array from parseTable
 * @returns {{ program: Object, version: Object }}
 */
function extractGeneralInfo(table) {
  const program = {};
  const version = {};

  // Helper: find row by first-cell number
  const findRow = (num) => table.find(r => r[0] && r[0].trim() === String(num));
  // Helper: get value cell (typically col 2, or joined col 2+)
  const getVal = (row) => row ? (row[2] || row[1] || '').trim() : '';

  // Row 1: Ten nganh (has sub-rows for Vietnamese/English name)
  const row1 = findRow('1');
  if (row1) {
    const nameText = getVal(row1);
    const vnMatch = nameText.match(/[Tt]iếng Việt:\s*(.*)/);
    program.name = vnMatch ? vnMatch[1].trim() : nameText;
  }
  // English name may be in next row
  const row1b = table.find(r => r.join('').includes('tiếng Anh:') || r.join('').includes('English:'));
  if (row1b) {
    const enMatch = row1b.join(' ').match(/[Ee]nglish:\s*(.*)/);
    program.name_en = enMatch ? enMatch[1].trim() : '';
  }

  const row2 = findRow('2');
  program.code = getVal(row2);

  const row3 = findRow('3');
  program.institution = getVal(row3);

  const row4 = findRow('4');
  program.degree_name = getVal(row4);

  const row5 = findRow('5');
  program.degree = getVal(row5);

  // Row 6: Don vi quan ly (department name — informational, not mapped to department_id)
  const row7 = findRow('7');
  const creditsText = getVal(row7);
  program.total_credits = parseInt(creditsText) || 0;

  const row8 = findRow('8');
  program.training_mode = getVal(row8);

  const row9 = findRow('9');
  version.training_duration = getVal(row9);

  const row10 = findRow('10');
  version.grading_scale = getVal(row10);

  // Row 11: Chuan dau vao (sub-rows 11.1, 11.2)
  const row111 = table.find(r => r[0] && r[0].trim() === '11.1');
  version.admission_targets = getVal(row111);
  const row112 = table.find(r => r[0] && r[0].trim() === '11.2');
  version.admission_criteria = getVal(row112);

  const row12 = findRow('12');
  version.graduation_requirements = getVal(row12);

  const row13 = findRow('13');
  version.job_positions = getVal(row13);

  const row14 = findRow('14');
  version.further_education = getVal(row14);

  const row15 = findRow('15');
  version.reference_programs = getVal(row15);

  const row17 = findRow('17');
  version.training_process = getVal(row17);

  return { program, version };
}
```

- [ ] **Step 2: Add `extractObjectives` function**

```js
/**
 * Extract PO objectives from paragraphs.
 * Looks for lines matching "PO1:", "PO2:", etc.
 * Also captures the general objective (paragraph before PO list).
 * @param {string[]} paragraphs
 * @returns {{ general_objective: string, objectives: Array<{code: string, description: string}> }}
 */
function extractObjectives(paragraphs) {
  const objectives = [];
  let general_objective = '';
  let foundMucTieu = false;
  let foundCuThe = false;

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];

    // Detect "Muc tieu chung" section
    if (p.includes('Mục tiêu chung') || p.includes('mục tiêu chung')) {
      foundMucTieu = true;
      continue;
    }
    // Detect "Muc tieu cu the" section
    if (p.includes('Mục tiêu cụ thể') || p.includes('mục tiêu cụ thể')) {
      foundCuThe = true;
      continue;
    }

    // Capture general objective text (between "Muc tieu chung" and "Muc tieu cu the")
    if (foundMucTieu && !foundCuThe && !p.match(/^PO\d+/)) {
      general_objective += (general_objective ? '\n' : '') + p;
    }

    // Capture PO items
    const poMatch = p.match(/^(PO\d+)\s*[:\uff1a]\s*(.*)/);
    if (poMatch) {
      objectives.push({ code: poMatch[1], description: poMatch[2].trim() });
    }
  }

  return { general_objective, objectives };
}
```

- [ ] **Step 3: Add `extractPLOs` function**

```js
/**
 * Extract PLO table.
 * Table has headers: PLO code | description | PO mapping | Bloom level
 * @param {string[][]} table - the PLO table (table index 2 or 3 depending on document)
 * @returns {Array<{code: string, description: string, bloom_level: number, po_codes: string[]}>}
 */
function extractPLOs(table) {
  const plos = [];
  for (const row of table) {
    const firstCell = (row[0] || '').trim();
    if (!firstCell.match(/^PLO\d+$/)) continue;

    const code = firstCell;
    const description = (row[1] || '').trim();
    const poText = (row[2] || '').trim();
    const bloomText = (row[3] || '').trim();

    const po_codes = poText.split(/[,\s]+/).filter(s => s.match(/^PO\d+$/));
    const bloom_level = parseFloat(bloomText) || 1;

    plos.push({ code, description, bloom_level, po_codes });
  }
  return plos;
}
```

- [ ] **Step 4: Verify extraction with sample file**

```bash
node -e "
const { readDocx, extractGeneralInfo, extractObjectives, extractPLOs } = require('./word-parser');
const fs = require('fs');
readDocx(fs.readFileSync('mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx')).then(({ tables, paragraphs }) => {
  const { program, version } = extractGeneralInfo(tables[1]);
  console.log('Program:', JSON.stringify(program, null, 2));
  console.log('Version duration:', version.training_duration);
  const { general_objective, objectives } = extractObjectives(paragraphs);
  console.log('General obj (first 100):', general_objective.substring(0, 100));
  console.log('POs:', objectives.map(o => o.code));
  const plos = extractPLOs(tables[2]);
  console.log('PLOs:', plos.map(p => p.code + ' bloom=' + p.bloom_level));
});
"
```

Expected: program.name = "Ngôn ngữ Trung Quốc", 4 POs (PO1-PO4), 7 PLOs (PLO1-PLO7).

- [ ] **Step 5: Commit**

```bash
git add word-parser.js
git commit -m "feat: add extractors for general info, PO objectives, and PLO learning outcomes"
```

---

## Task 5: Word parser — extract PO-PLO matrix + knowledge blocks + courses

**Files:**
- Modify: `word-parser.js`

- [ ] **Step 1: Add `extractPOPLOMatrix` function**

```js
/**
 * Extract PO-PLO matrix. Table has PO rows with "X" marks in PLO columns.
 * First row = header with PLO codes. First column = PO code + description.
 * @param {string[][]} table
 * @returns {Array<{po_code: string, plo_code: string}>}
 */
function extractPOPLOMatrix(table) {
  if (!table || table.length < 2) return [];

  // Find header row with PLO codes
  const headerRow = table.find(r => r.some(c => (c || '').trim().match(/^PLO\d+$/)));
  if (!headerRow) return [];

  // Map column index to PLO code
  const colToPLO = {};
  headerRow.forEach((cell, idx) => {
    const code = (cell || '').trim();
    if (code.match(/^PLO\d+$/)) colToPLO[idx] = code;
  });

  const matrix = [];
  for (const row of table) {
    const firstCell = (row[0] || '').trim();
    const poMatch = firstCell.match(/^(PO\d+)/);
    if (!poMatch) continue;
    const po_code = poMatch[1];

    for (const [colIdx, plo_code] of Object.entries(colToPLO)) {
      const val = (row[parseInt(colIdx)] || '').trim().toUpperCase();
      if (val === 'X' || val === '✓' || val === '✗') {
        matrix.push({ po_code, plo_code });
      }
    }
  }
  return matrix;
}
```

- [ ] **Step 2: Add `extractKnowledgeBlocks` function**

```js
/**
 * Extract knowledge block structure.
 * Table: "Khoi kien thuc | So tin chi (Tong, BB, TC) | Ty le"
 * @param {string[][]} table
 * @returns {Array<{name: string, parent_name: string|null, total_credits: number, required_credits: number, elective_credits: number, sort_order: number}>}
 */
function extractKnowledgeBlocks(table) {
  const blocks = [];
  let currentParent = null;
  let order = 0;

  for (const row of table) {
    const name = (row[0] || '').trim();
    if (!name || name === 'Khối kiến thức' || name.includes('Tổng số tín chỉ')) continue;

    const totalStr = (row[1] || '').trim();
    const reqStr = (row[2] || '').trim();
    const elecStr = (row[3] || '').trim();

    const total = parseInt(totalStr) || 0;
    const required = parseInt(reqStr) || 0;
    const elective = parseInt(elecStr) || 0;

    // Determine if this is a parent block (has credits in first number column)
    // or a child (indented / no percentage)
    const pctStr = (row[4] || '').trim();
    const isParent = pctStr.includes('%') || total >= 10;

    if (isParent) {
      currentParent = name;
      blocks.push({ name, parent_name: null, total_credits: total, required_credits: required, elective_credits: elective, sort_order: order++ });
    } else if (total > 0 || required > 0) {
      blocks.push({ name, parent_name: currentParent, total_credits: total, required_credits: required, elective_credits: elective, sort_order: order++ });
    }
  }
  return blocks;
}
```

- [ ] **Step 3: Add `extractCourses` function**

```js
/**
 * Extract courses from the detailed curriculum table.
 * Columns: STT | Ma HP | Ten HP | TC Tong | LT | TH/TN | DA | TT | Ma HP hoc truoc | Ma HP song hanh
 * Handles knowledge block headers (e.g., "KIEN THUC GIAO DUC DAI CUONG") and
 * elective group headers (e.g., "Nhom 1: Tieng Trung thuong mai").
 * @param {string[][]} table
 * @returns {Array<Object>}
 */
function extractCourses(table) {
  const courses = [];
  let currentType = 'required';
  let currentGroup = null;
  let currentSemester = 0;

  for (const row of table) {
    const col0 = (row[0] || '').trim();
    const col1 = (row[1] || '').trim();
    const col2 = (row[2] || '').trim();

    // Skip header rows
    if (col0 === 'STT' || col1 === 'Mã số HP' || col2 === 'Tên học phần') continue;

    // Detect knowledge block / section headers (all caps or specific patterns)
    if (!col1 && col0.match(/^(KIẾN THỨC|Kiến thức|II\.|I\.|III\.)/i)) {
      if (col0.includes('tự chọn') || col0.includes('Tự chọn')) {
        currentType = 'elective';
      } else {
        currentType = 'required';
      }
      currentGroup = null;
      continue;
    }

    // Detect elective group headers: "Nhom 1: ..."
    if (col0.match(/Nhóm \d+/i) || (col0 === '' && col2 === '' && col1 === '' && row.join('').match(/Nhóm \d+/i))) {
      const groupMatch = row.join(' ').match(/Nhóm \d+[:\s]*(.*)/i);
      currentGroup = groupMatch ? groupMatch[0].trim() : null;
      currentType = 'elective';
      continue;
    }

    // Detect section markers like "II.1. Kiến thức bắt buộc"
    if (col0.match(/^II\.\d+\.?\s/)) {
      if (col0.includes('bắt buộc')) { currentType = 'required'; currentGroup = null; }
      if (col0.includes('tự chọn')) { currentType = 'elective'; }
      continue;
    }

    // Valid course row: col1 should be a course code (letters + numbers)
    if (!col1.match(/^[A-Z]{2,}/)) continue;

    const credits = parseInt((row[3] || '').trim()) || 0;
    const lt = parseInt((row[4] || '').trim()) || 0;
    const th = parseInt((row[5] || '').trim()) || 0;
    const da = parseInt((row[6] || '').trim()) || 0;
    const tt = parseInt((row[7] || '').trim()) || 0;

    const prereqText = (row[8] || '').trim();
    const coreqText = (row[9] || '').trim();
    const prerequisite_codes = prereqText ? prereqText.split(/[,;\s]+/).filter(Boolean) : [];
    const corequisite_codes = coreqText ? coreqText.split(/[,;\s]+/).filter(Boolean) : [];

    courses.push({
      code: col1,
      name: col2,
      credits,
      credits_theory: lt,
      credits_practice: th,
      credits_project: da,
      credits_internship: tt,
      semester: 0, // Will be filled from teaching plan
      course_type: currentType,
      elective_group: currentType === 'elective' ? currentGroup : null,
      prerequisite_codes,
      corequisite_codes,
    });
  }
  return courses;
}
```

- [ ] **Step 4: Verify with sample file**

```bash
node -e "
const wp = require('./word-parser');
const fs = require('fs');
wp.readDocx(fs.readFileSync('mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx')).then(({ tables }) => {
  const matrix = wp.extractPOPLOMatrix(tables[3]);
  console.log('PO-PLO mappings:', matrix.length);
  console.log('Sample:', matrix.slice(0, 3));

  const blocks = wp.extractKnowledgeBlocks(tables[4]);
  console.log('Knowledge blocks:', blocks.length);
  blocks.forEach(b => console.log(' ', b.parent_name ? '  ' : '', b.name, b.total_credits + 'TC'));

  const courses = wp.extractCourses(tables[5]);
  console.log('Courses found:', courses.length);
  console.log('Required:', courses.filter(c => c.course_type === 'required').length);
  console.log('Elective:', courses.filter(c => c.course_type === 'elective').length);
  console.log('Sample:', courses[0]);
});
"
```

Expected: ~12 PO-PLO mappings, ~5-8 knowledge blocks, ~40+ courses.

- [ ] **Step 5: Commit**

```bash
git add word-parser.js
git commit -m "feat: add extractors for PO-PLO matrix, knowledge blocks, and courses"
```

---

## Task 6: Word parser — extract Course-PI matrix + course descriptions

**Files:**
- Modify: `word-parser.js`

- [ ] **Step 1: Add `extractCoursePIMatrix` function**

```js
/**
 * Extract Course-PI contribution matrix.
 * Header row has PI codes (PI.1.1, 1.2, 1.3, 2.1, ...).
 * The first header cell group shows PLO codes above PI codes.
 * Data rows: course_code | course_name | contribution levels (1/2/3 or -)
 * @param {string[][]} table
 * @returns {Array<{course_code: string, pi_code: string, contribution_level: number}>}
 */
function extractCoursePIMatrix(table) {
  if (!table || table.length < 3) return [];

  // Find the row with PI codes (PI.1.1, 1.2, etc.)
  let piHeaderIdx = -1;
  for (let i = 0; i < Math.min(5, table.length); i++) {
    if (table[i].some(c => (c || '').trim().match(/^PI[\.\d]/i) || (c || '').trim().match(/^\d+\.\d+$/))) {
      piHeaderIdx = i;
      break;
    }
  }
  if (piHeaderIdx < 0) return [];

  // Build column -> PI code mapping
  const piRow = table[piHeaderIdx];
  const colToPI = {};
  let lastPLONum = '';

  for (let col = 2; col < piRow.length; col++) {
    let piText = (piRow[col] || '').trim();
    if (!piText) continue;

    // Handle "PI.1.1" format
    if (piText.match(/^PI[\.\d]/i)) {
      piText = piText.replace(/^PI\.?/i, '');
    }

    // Handle short format "1.2" — need to reconstruct full PI code
    const parts = piText.split('.');
    if (parts.length === 2) {
      lastPLONum = parts[0];
      colToPI[col] = `PI${parts[0]}.${parts[1].padStart(2, '0')}`;
    } else if (parts.length === 1 && lastPLONum) {
      // Just a sub-number like "2" meaning "PLO{lastPLONum}.02"
      colToPI[col] = `PI${lastPLONum}.${parts[0].padStart(2, '0')}`;
    }
  }

  const matrix = [];
  for (let i = piHeaderIdx + 1; i < table.length; i++) {
    const row = table[i];
    const courseCode = (row[0] || '').trim();
    if (!courseCode.match(/^[A-Z]{2,}/)) continue;

    for (const [colStr, piCode] of Object.entries(colToPI)) {
      const col = parseInt(colStr);
      const val = (row[col] || '').trim();
      const level = parseInt(val);
      if (level > 0 && level <= 3) {
        matrix.push({ course_code: courseCode, pi_code: piCode, contribution_level: level });
      }
    }
  }
  return matrix;
}
```

- [ ] **Step 2: Add `extractCourseDescriptions` function**

```js
/**
 * Extract course descriptions table.
 * Columns: STT | Ma HP | Ten HP | Mo ta
 * @param {string[][]} table
 * @returns {Array<{code: string, description: string}>}
 */
function extractCourseDescriptions(table) {
  const descriptions = [];
  for (const row of table) {
    const code = (row[1] || '').trim();
    if (!code.match(/^[A-Z]{2,}/)) continue;

    const description = (row[3] || '').trim();
    if (description) {
      descriptions.push({ code, description });
    }
  }
  return descriptions;
}
```

- [ ] **Step 3: Verify with sample file**

```bash
node -e "
const wp = require('./word-parser');
const fs = require('fs');
wp.readDocx(fs.readFileSync('mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx')).then(({ tables }) => {
  // Course-PI matrix is around table index 6-7
  for (let i = 5; i < tables.length; i++) {
    const m = wp.extractCoursePIMatrix(tables[i]);
    if (m.length > 0) {
      console.log('Course-PI matrix found at table', i, '- entries:', m.length);
      console.log('Sample:', m.slice(0, 3));
      break;
    }
  }
  // Course descriptions table
  for (let i = 5; i < tables.length; i++) {
    const d = wp.extractCourseDescriptions(tables[i]);
    if (d.length > 5) {
      console.log('Course descriptions found at table', i, '- count:', d.length);
      console.log('Sample:', d[0].code, d[0].description.substring(0, 80));
      break;
    }
  }
});
"
```

- [ ] **Step 4: Commit**

```bash
git add word-parser.js
git commit -m "feat: add extractors for Course-PI matrix and course descriptions"
```

---

## Task 7: Word parser — extract teaching plan, PI, assessment plan

**Files:**
- Modify: `word-parser.js`

- [ ] **Step 1: Add `extractTeachingPlan` function**

```js
/**
 * Extract teaching plan from Appendix I tables (one table per semester).
 * Columns: STT | Ma HP | Ten HP | So TC | Tong tiet | LT | TH/TN | DA | TT | Phan mem | Don vi | Ghi chu | Phan dot
 * @param {string[][]} table
 * @param {number} semester - semester number
 * @returns {Array<Object>}
 */
function extractTeachingPlanFromTable(table, semester) {
  const plans = [];
  for (const row of table) {
    const code = (row[1] || '').trim();
    if (!code.match(/^[A-Z]{2,}/)) continue;

    plans.push({
      course_code: code,
      semester,
      total_hours: parseInt((row[4] || '').trim()) || 0,
      hours_theory: parseInt((row[5] || '').trim()) || 0,
      hours_practice: parseInt((row[6] || '').trim()) || 0,
      hours_project: parseInt((row[7] || '').trim()) || 0,
      hours_internship: parseInt((row[8] || '').trim()) || 0,
      software: (row[9] || '').trim(),
      managing_dept: (row[10] || '').trim(),
      batch: (row[12] || row[11] || '').trim(),
    });
  }
  return plans;
}

/**
 * Extract all teaching plans by finding semester-labeled tables.
 * @param {string[][]} tables - all tables in document
 * @param {string[]} paragraphs - all paragraphs
 * @returns {Array<Object>}
 */
function extractTeachingPlan(tables, paragraphs) {
  const allPlans = [];
  // Find tables that follow "Hoc ky N" paragraphs or contain semester data
  let semesterNum = 0;

  for (const table of tables) {
    // Check if table header mentions semester or has STT/Ma HP pattern for teaching plan
    const firstRow = table[0] || [];
    const hasSTT = firstRow.some(c => (c || '').trim() === 'STT');
    const hasTotalHours = firstRow.some(c => (c || '').includes('tiết') || (c || '').includes('Tổng số tiết'));

    if (hasSTT && hasTotalHours) {
      semesterNum++;
      const plans = extractTeachingPlanFromTable(table, semesterNum);
      allPlans.push(...plans);
    }
  }
  return allPlans;
}
```

- [ ] **Step 2: Add `extractPIs` function**

```js
/**
 * Extract PI (Performance Indicators) from Appendix II.
 * Table structure: PLO description row, then PI rows under each PLO.
 * @param {string[][]} table
 * @returns {Array<{plo_code: string, pi_code: string, description: string}>}
 */
function extractPIs(table) {
  const pis = [];
  let currentPLO = '';

  for (const row of table) {
    const cell0 = (row[0] || '').trim();
    const cell1 = (row[1] || '').trim();

    // Detect PLO header row
    const ploMatch = cell0.match(/^(PLO\d+)/);
    if (ploMatch) {
      currentPLO = ploMatch[1];
      continue;
    }

    // Detect PI row — starts with "PI" or contains "PI1.01" pattern
    const fullText = cell0 + ' ' + cell1;
    const piMatch = fullText.match(/(PI[\d]+\.[\d]+)\s+(.*)/);
    if (piMatch && currentPLO) {
      pis.push({
        plo_code: currentPLO,
        pi_code: piMatch[1],
        description: piMatch[2].trim(),
      });
    }
  }
  return pis;
}
```

- [ ] **Step 3: Add `extractAssessmentPlan` function**

```js
/**
 * Extract assessment plan from Appendix III.
 * Columns: PLO | PI | Mieu ta | Ma HP dong gop | Ma HP mau | Minh chung | Cong cu | Tieu chuan | Ke hoach | GV | Don vi
 * PLO rows span multiple PI rows (vMerge).
 * @param {string[][]} table
 * @returns {Array<Object>}
 */
function extractAssessmentPlan(table) {
  const plans = [];
  let currentPLO = '';
  let currentPLODesc = '';

  for (const row of table) {
    // Skip header rows
    if (row.some(c => (c || '').includes('PLO (1)') || (c || '').includes('Miêu tả'))) continue;

    const cell0 = (row[0] || '').trim();

    // Detect PLO header (merged cell with PLO description)
    const ploMatch = cell0.match(/^(PLO\d+)/);
    if (ploMatch) {
      currentPLO = ploMatch[1];
      continue;
    }

    // Detect PI row
    const piCell = (row[1] || row[0] || '').trim();
    const piMatch = piCell.match(/^PI[\.\d]+/);
    if (!piMatch || !currentPLO) continue;

    const piCode = piMatch[0].replace(/^PI\./, 'PI');

    plans.push({
      plo_code: currentPLO,
      pi_code: piCode,
      description: (row[2] || '').trim(),
      contributing_course_codes: (row[3] || '').trim(),
      sample_course_code: (row[4] || '').trim(),
      direct_evidence: (row[5] || '').trim(),
      assessment_tool: (row[6] || '').trim(),
      expected_result: (row[7] || '').trim(),
      semester: (row[8] || '').trim(),
      assessor: (row[9] || '').trim(),
      dept_code: (row[10] || '').trim(),
    });
  }
  return plans;
}
```

- [ ] **Step 4: Verify with sample file**

```bash
node -e "
const wp = require('./word-parser');
const fs = require('fs');
wp.readDocx(fs.readFileSync('mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx')).then(({ tables, paragraphs }) => {
  const tp = wp.extractTeachingPlan(tables, paragraphs);
  console.log('Teaching plan entries:', tp.length);
  console.log('Semesters:', [...new Set(tp.map(t => t.semester))]);

  // PI table — find by content
  for (let i = tables.length - 3; i < tables.length; i++) {
    const pis = wp.extractPIs(tables[i]);
    if (pis.length > 0) {
      console.log('PIs found at table', i, ':', pis.length);
      console.log('Sample:', pis[0]);
      break;
    }
  }

  // Assessment — last table
  const assess = wp.extractAssessmentPlan(tables[tables.length - 1]);
  console.log('Assessment entries:', assess.length);
  if (assess[0]) console.log('Sample:', assess[0]);
});
"
```

- [ ] **Step 5: Commit**

```bash
git add word-parser.js
git commit -m "feat: add extractors for teaching plan, PI descriptions, and assessment plan"
```

---

## Task 8: Word parser — main parseWordFile + validation

**Files:**
- Modify: `word-parser.js`

- [ ] **Step 1: Add `parseWordFile` orchestrator function**

This is the main entry point that calls all extractors in order and assembles the ParsedCTDT object. It needs to identify which table index corresponds to which section.

```js
/**
 * Parse a .docx buffer into a ParsedCTDT object.
 * @param {Buffer} buffer
 * @returns {Promise<Object>} ParsedCTDT
 */
async function parseWordFile(buffer) {
  const { tables, paragraphs } = await readDocx(buffer);

  // Table identification by content heuristics
  const tableRoles = identifyTables(tables, paragraphs);

  const { program, version } = extractGeneralInfo(tables[tableRoles.generalInfo] || []);
  const { general_objective, objectives } = extractObjectives(paragraphs);
  version.general_objective = general_objective;

  const plos = tableRoles.plo >= 0 ? extractPLOs(tables[tableRoles.plo]) : [];
  const poploMatrix = tableRoles.poploMatrix >= 0 ? extractPOPLOMatrix(tables[tableRoles.poploMatrix]) : [];
  const knowledgeBlocks = tableRoles.knowledgeBlocks >= 0 ? extractKnowledgeBlocks(tables[tableRoles.knowledgeBlocks]) : [];
  const courses = tableRoles.courses >= 0 ? extractCourses(tables[tableRoles.courses]) : [];
  const coursePIMatrix = tableRoles.coursePIMatrix >= 0 ? extractCoursePIMatrix(tables[tableRoles.coursePIMatrix]) : [];
  const courseDescriptions = tableRoles.courseDescriptions >= 0 ? extractCourseDescriptions(tables[tableRoles.courseDescriptions]) : [];
  const teachingPlan = extractTeachingPlan(tables, paragraphs);
  const pis = tableRoles.pis >= 0 ? extractPIs(tables[tableRoles.pis]) : [];
  const assessmentPlan = tableRoles.assessment >= 0 ? extractAssessmentPlan(tables[tableRoles.assessment]) : [];

  // Assign semesters to courses from teaching plan
  for (const tp of teachingPlan) {
    const course = courses.find(c => c.code === tp.course_code);
    if (course && tp.semester > 0) {
      course.semester = tp.semester;
    }
  }

  const data = {
    program, version, objectives, plos, poploMatrix,
    knowledgeBlocks, courses, coursePIMatrix, courseDescriptions,
    teachingPlan, pis, assessmentPlan, warnings: [],
  };

  data.warnings = validateParsedData(data);
  return data;
}

/**
 * Identify which table index corresponds to which section.
 * Uses content heuristics (header text, column patterns).
 */
function identifyTables(tables, paragraphs) {
  const roles = {
    generalInfo: -1, plo: -1, poploMatrix: -1, knowledgeBlocks: -1,
    courses: -1, coursePIMatrix: -1, courseDescriptions: -1, pis: -1, assessment: -1,
  };

  for (let i = 0; i < tables.length; i++) {
    const t = tables[i];
    if (!t || t.length === 0) continue;
    const flat = t.slice(0, 3).flat().join(' ');

    // General info: first substantial key-value table with "Tên ngành"
    if (roles.generalInfo < 0 && flat.includes('Tên ngành')) {
      roles.generalInfo = i; continue;
    }
    // PLO table: has PLO codes and "Trình độ năng lực"
    if (roles.plo < 0 && flat.includes('Trình độ năng lực')) {
      roles.plo = i; continue;
    }
    // PO-PLO matrix: has both PO and PLO in header
    if (roles.poploMatrix < 0 && flat.includes('Mục tiêu') && flat.match(/PLO\d/)) {
      roles.poploMatrix = i; continue;
    }
    // Knowledge blocks: "Khối kiến thức"
    if (roles.knowledgeBlocks < 0 && flat.includes('Khối kiến thức')) {
      roles.knowledgeBlocks = i; continue;
    }
    // Course list: "Mã số HP" or "Mã HP" with "Tên học phần"
    if (roles.courses < 0 && (flat.includes('Mã số HP') || flat.includes('Mã HP')) && flat.includes('Tên học phần') && !flat.includes('Mô tả')) {
      roles.courses = i; continue;
    }
    // Course-PI matrix: PI codes in header
    if (roles.coursePIMatrix < 0 && flat.match(/PI[\.\d]/) && flat.match(/PLO\d/)) {
      roles.coursePIMatrix = i; continue;
    }
    // Course descriptions: "Mô tả tóm tắt"
    if (roles.courseDescriptions < 0 && flat.includes('Mô tả')) {
      roles.courseDescriptions = i; continue;
    }
    // PI table (appendix II): "Chỉ số đo lường"
    if (roles.pis < 0 && flat.includes('Chỉ số đo lường')) {
      roles.pis = i; continue;
    }
    // Assessment plan (appendix III): "Công cụ đánh giá" or column headers
    if (roles.assessment < 0 && (flat.includes('Công cụ đánh giá') || flat.includes('Mã học phần lấy mẫu'))) {
      roles.assessment = i; continue;
    }
  }

  return roles;
}
```

- [ ] **Step 2: Add `validateParsedData` function**

```js
/**
 * Validate parsed data and return warnings/errors.
 * @param {Object} data - ParsedCTDT (without warnings)
 * @returns {Array<{field: string, message: string, severity: 'warning'|'error'}>}
 */
function validateParsedData(data) {
  const warnings = [];

  // Errors
  if (!data.program.code) {
    warnings.push({ field: 'program.code', message: 'Mã ngành không được để trống', severity: 'error' });
  }
  if (!data.program.name) {
    warnings.push({ field: 'program.name', message: 'Tên ngành không được để trống', severity: 'error' });
  }
  if (data.objectives.length === 0) {
    warnings.push({ field: 'objectives', message: 'Không tìm thấy mục tiêu (PO) nào', severity: 'error' });
  }
  if (data.plos.length === 0) {
    warnings.push({ field: 'plos', message: 'Không tìm thấy chuẩn đầu ra (PLO) nào', severity: 'error' });
  }
  if (data.courses.length === 0) {
    warnings.push({ field: 'courses', message: 'Không tìm thấy học phần nào', severity: 'error' });
  }

  // Warnings
  const courseCodes = new Set(data.courses.map(c => c.code));
  for (const course of data.courses) {
    for (const prereq of course.prerequisite_codes) {
      if (!courseCodes.has(prereq)) {
        warnings.push({
          field: `courses.${course.code}.prerequisites`,
          message: `HP tiên quyết "${prereq}" không có trong danh sách HP`,
          severity: 'warning',
        });
      }
    }
  }

  // Total credits check
  const sumCredits = data.courses.reduce((s, c) => s + (c.credits || 0), 0);
  if (data.program.total_credits && Math.abs(sumCredits - data.program.total_credits) > 5) {
    warnings.push({
      field: 'program.total_credits',
      message: `Tổng tín chỉ HP (${sumCredits}) khác với thông tin chung (${data.program.total_credits})`,
      severity: 'warning',
    });
  }

  // Bloom level check
  for (const plo of data.plos) {
    if (plo.bloom_level < 1 || plo.bloom_level > 6) {
      warnings.push({
        field: `plos.${plo.code}.bloom_level`,
        message: `Bloom level ${plo.bloom_level} ngoài phạm vi 1-6, sẽ mặc định = 1`,
        severity: 'warning',
      });
      plo.bloom_level = 1;
    }
  }

  // Course-PI matrix unknown course check
  for (const entry of data.coursePIMatrix) {
    if (!courseCodes.has(entry.course_code)) {
      warnings.push({
        field: `coursePIMatrix.${entry.course_code}`,
        message: `Mã HP "${entry.course_code}" trong ma trận Course-PI không có trong danh sách HP`,
        severity: 'warning',
      });
    }
  }

  return warnings;
}
```

- [ ] **Step 3: Update module.exports**

```js
module.exports = {
  parseWordFile,
  // Export sub-functions for testing
  readDocx, parseTable, extractParagraphText,
  extractGeneralInfo, extractObjectives, extractPLOs,
  extractPOPLOMatrix, extractKnowledgeBlocks, extractCourses,
  extractCoursePIMatrix, extractCourseDescriptions,
  extractTeachingPlan, extractPIs, extractAssessmentPlan,
  identifyTables, validateParsedData,
};
```

- [ ] **Step 4: Full integration test with sample file**

```bash
node -e "
const { parseWordFile } = require('./word-parser');
const fs = require('fs');
parseWordFile(fs.readFileSync('mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx')).then(data => {
  console.log('=== PARSE RESULT ===');
  console.log('Program:', data.program.name, '(' + data.program.code + ')');
  console.log('POs:', data.objectives.length);
  console.log('PLOs:', data.plos.length);
  console.log('PIs:', data.pis.length);
  console.log('PO-PLO mappings:', data.poploMatrix.length);
  console.log('Courses:', data.courses.length);
  console.log('Course-PI mappings:', data.coursePIMatrix.length);
  console.log('Course descriptions:', data.courseDescriptions.length);
  console.log('Teaching plan entries:', data.teachingPlan.length);
  console.log('Knowledge blocks:', data.knowledgeBlocks.length);
  console.log('Assessment plan entries:', data.assessmentPlan.length);
  console.log('Warnings:', data.warnings.length);
  data.warnings.forEach(w => console.log('  [' + w.severity + ']', w.field, '-', w.message));
});
"
```

Expected output should show: program name "Ngôn ngữ Trung Quốc", 4 POs, 7 PLOs, 21 PIs, ~40+ courses, matrices populated, reasonable warning count.

- [ ] **Step 5: Commit**

```bash
git add word-parser.js
git commit -m "feat: add main parseWordFile orchestrator with table identification and validation"
```

---

## Task 9: API endpoints — parse-word and save

**Files:**
- Modify: `server.js:1-1885`

- [ ] **Step 1: Add multer config and require word-parser at top of server.js**

Near the top of `server.js` (after existing requires, around line 5-10), add:

```js
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const { parseWordFile } = require('./word-parser');
```

- [ ] **Step 2: Add POST /api/import/parse-word endpoint**

Add before the SPA fallback route (before line ~1885):

```js
// === Import Word ===
app.post('/api/import/parse-word', authMiddleware, requirePerm('programs.import_word'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Không có file được upload' });
    if (!req.file.originalname.endsWith('.docx')) {
      return res.status(400).json({ success: false, error: 'Chỉ chấp nhận file .docx' });
    }
    const data = await parseWordFile(req.file.buffer);
    res.json({ success: true, data });
  } catch (err) {
    console.error('Import parse error:', err);
    res.status(500).json({ success: false, error: 'Lỗi khi đọc file: ' + err.message });
  }
});
```

- [ ] **Step 3: Add POST /api/import/save endpoint**

```js
app.post('/api/import/save', authMiddleware, requirePerm('programs.import_word'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { program, version, objectives, plos, pis, courses,
            poploMatrix, coursePIMatrix, knowledgeBlocks, courseDescriptions,
            teachingPlan, assessmentPlan, department_id } = req.body;

    if (!department_id) return res.status(400).json({ success: false, error: 'Vui lòng chọn đơn vị quản lý' });

    await client.query('BEGIN');

    // Step 1: Check duplicate program code
    const existing = await client.query('SELECT id, name FROM programs WHERE code = $1', [program.code]);
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        success: false,
        error: `Mã ngành "${program.code}" đã tồn tại: ${existing.rows[0].name} (ID: ${existing.rows[0].id})`
      });
    }

    // Step 2: Insert program
    const progResult = await client.query(
      `INSERT INTO programs (department_id, name, name_en, code, degree, total_credits, institution, degree_name, training_mode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [department_id, program.name, program.name_en, program.code, program.degree,
       program.total_credits, program.institution, program.degree_name, program.training_mode]
    );
    const programId = progResult.rows[0].id;

    // Step 3: Insert version
    const verResult = await client.query(
      `INSERT INTO program_versions (program_id, academic_year, version_name, status, total_credits,
         training_duration, grading_scale, graduation_requirements, job_positions, further_education,
         reference_programs, training_process, admission_targets, admission_criteria, general_objective)
       VALUES ($1,$2,$3,'draft',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
      [programId, version.academic_year, program.name + ' - ' + version.academic_year,
       program.total_credits, version.training_duration, version.grading_scale,
       version.graduation_requirements, version.job_positions, version.further_education,
       version.reference_programs, version.training_process, version.admission_targets,
       version.admission_criteria, version.general_objective]
    );
    const versionId = verResult.rows[0].id;

    // Step 4: Insert POs
    for (const po of objectives) {
      await client.query(
        'INSERT INTO version_objectives (version_id, code, description) VALUES ($1,$2,$3)',
        [versionId, po.code, po.description]
      );
    }

    // Step 5: Insert PLOs — build code->id map
    const ploMap = {};
    for (const plo of plos) {
      const r = await client.query(
        'INSERT INTO version_plos (version_id, code, bloom_level, description) VALUES ($1,$2,$3,$4) RETURNING id',
        [versionId, plo.code, plo.bloom_level || 1, plo.description]
      );
      ploMap[plo.code] = r.rows[0].id;
    }

    // Step 6: Insert PIs — build code->id map
    const piMap = {};
    for (const pi of pis) {
      const ploId = ploMap[pi.plo_code];
      if (!ploId) continue;
      const r = await client.query(
        'INSERT INTO plo_pis (plo_id, pi_code, description) VALUES ($1,$2,$3) RETURNING id',
        [ploId, pi.pi_code, pi.description]
      );
      piMap[pi.pi_code] = r.rows[0].id;
    }

    // Step 7: Upsert courses — build code->id map
    const courseMap = {};
    for (const c of courses) {
      const r = await client.query(
        `INSERT INTO courses (code, name, credits, credits_theory, credits_practice, credits_project, credits_internship, department_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, credits=EXCLUDED.credits,
           credits_theory=EXCLUDED.credits_theory, credits_practice=EXCLUDED.credits_practice,
           credits_project=EXCLUDED.credits_project, credits_internship=EXCLUDED.credits_internship
         RETURNING id`,
        [c.code, c.name, c.credits, c.credits_theory, c.credits_practice,
         c.credits_project, c.credits_internship, department_id]
      );
      courseMap[c.code] = r.rows[0].id;
    }

    // Step 8: Insert version_courses — build code->version_course_id map
    const vcMap = {};
    for (const c of courses) {
      const courseId = courseMap[c.code];
      if (!courseId) continue;
      const prereqIds = (c.prerequisite_codes || []).map(pc => courseMap[pc]).filter(Boolean);
      const coreqIds = (c.corequisite_codes || []).map(cc => courseMap[cc]).filter(Boolean);
      const r = await client.query(
        `INSERT INTO version_courses (version_id, course_id, semester, course_type, elective_group, prerequisite_course_ids, corequisite_course_ids)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [versionId, courseId, c.semester || 0, c.course_type, c.elective_group,
         prereqIds.length ? prereqIds : null, coreqIds.length ? coreqIds : null]
      );
      vcMap[c.code] = r.rows[0].id;
    }

    // Step 9: Insert knowledge blocks
    const blockIdMap = {};
    for (const block of knowledgeBlocks) {
      const parentId = block.parent_name ? blockIdMap[block.parent_name] : null;
      const r = await client.query(
        `INSERT INTO knowledge_blocks (version_id, name, parent_id, total_credits, required_credits, elective_credits, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [versionId, block.name, parentId || null, block.total_credits, block.required_credits, block.elective_credits, block.sort_order]
      );
      blockIdMap[block.name] = r.rows[0].id;
    }

    // Step 10: Insert PO-PLO map
    for (const m of poploMatrix) {
      const poResult = await client.query(
        'SELECT id FROM version_objectives WHERE version_id=$1 AND code=$2', [versionId, m.po_code]
      );
      const ploId = ploMap[m.plo_code];
      if (poResult.rows[0] && ploId) {
        await client.query(
          'INSERT INTO po_plo_map (version_id, po_id, plo_id) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING',
          [versionId, poResult.rows[0].id, ploId]
        );
      }
    }

    // Step 11: Insert course_plo_map (aggregate from Course-PI matrix)
    const coursePloAgg = {};
    for (const entry of coursePIMatrix) {
      const vcId = vcMap[entry.course_code];
      if (!vcId) continue;
      // Determine PLO from PI code (e.g., PI1.01 -> PLO1)
      const ploNumMatch = entry.pi_code.match(/PI(\d+)/);
      if (!ploNumMatch) continue;
      const ploCode = 'PLO' + ploNumMatch[1];
      const ploId = ploMap[ploCode];
      if (!ploId) continue;
      const key = `${vcId}-${ploId}`;
      if (!coursePloAgg[key]) {
        coursePloAgg[key] = { vcId, ploId, maxLevel: 0 };
      }
      coursePloAgg[key].maxLevel = Math.max(coursePloAgg[key].maxLevel, entry.contribution_level);
    }
    for (const { vcId, ploId, maxLevel } of Object.values(coursePloAgg)) {
      await client.query(
        'INSERT INTO course_plo_map (version_id, course_id, plo_id, contribution_level) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [versionId, vcId, ploId, maxLevel]
      );
    }

    // Step 12: Insert version_pi_courses (FK course_id -> version_courses.id)
    for (const entry of coursePIMatrix) {
      const vcId = vcMap[entry.course_code];
      const piId = piMap[entry.pi_code];
      if (!vcId || !piId) continue;
      await client.query(
        'INSERT INTO version_pi_courses (version_id, pi_id, course_id, contribution_level) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [versionId, piId, vcId, entry.contribution_level]
      );
    }

    // Step 13: Insert teaching plan
    for (const tp of teachingPlan) {
      const vcId = vcMap[tp.course_code];
      if (!vcId) continue;
      await client.query(
        `INSERT INTO teaching_plan (version_course_id, total_hours, hours_theory, hours_practice, hours_project, hours_internship, software, managing_dept, batch)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [vcId, tp.total_hours, tp.hours_theory, tp.hours_practice, tp.hours_project,
         tp.hours_internship, tp.software, tp.managing_dept, tp.batch]
      );
    }

    // Step 14: Insert assessment plans
    for (const ap of assessmentPlan) {
      const ploId = ploMap[ap.plo_code];
      const piId = piMap[ap.pi_code];
      const sampleCourseId = ap.sample_course_code ? courseMap[ap.sample_course_code] : null;
      if (!ploId) continue;
      await client.query(
        `INSERT INTO assessment_plans (version_id, plo_id, pi_id, sample_course_id, assessment_tool, criteria, threshold, semester, assessor, dept_code, direct_evidence, expected_result, contributing_course_codes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [versionId, ploId, piId || null, sampleCourseId, ap.assessment_tool,
         ap.description, ap.expected_result, ap.semester, ap.assessor, ap.dept_code,
         ap.direct_evidence, ap.expected_result || '', ap.contributing_course_codes]
        // Note: criteria=$6 gets ap.description (PI description), threshold=$7 gets ap.expected_result,
        // expected_result=$12 is the new column (same value as threshold for now)
      );
    }

    // Step 15: Update course descriptions
    for (const cd of courseDescriptions) {
      await client.query('UPDATE courses SET description=$1 WHERE code=$2', [cd.description, cd.code]);
    }

    await client.query('COMMIT');

    res.json({
      success: true, program_id: programId, version_id: versionId,
      summary: {
        objectives: objectives.length, plos: plos.length, pis: pis.length,
        courses: courses.length, knowledgeBlocks: knowledgeBlocks.length,
        teachingPlanEntries: teachingPlan.length, assessmentEntries: assessmentPlan.length,
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Import save error:', err);
    res.status(500).json({ success: false, error: 'Lỗi khi lưu: ' + err.message });
  } finally {
    client.release();
  }
});
```

- [ ] **Step 4: Verify parse endpoint**

Start dev server and test:

```bash
curl -X POST http://localhost:3600/api/import/parse-word \
  -H "Cookie: token=<your_jwt_token>" \
  -F "file=@mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx" | jq '.data.program'
```

Expected: JSON with program name, code, credits, etc.

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: add /api/import/parse-word and /api/import/save endpoints"
```

---

## Task 10: Frontend — import-word page (upload + preview structure)

**Files:**
- Create: `public/js/pages/import-word.js`
- Modify: `public/index.html:24` (add script tag)
- Modify: `public/js/app.js:194-204` (add to pages map)

- [ ] **Step 1: Create `public/js/pages/import-word.js`**

```js
window.ImportWordPage = {
  parsedData: null,

  render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
          <h5>Import CTDT từ file Word</h5>
          <button class="btn btn-secondary btn-sm" onclick="App.navigate('programs')">← Quay lại</button>
        </div>
        <div class="card-body">
          <div id="import-upload-section">
            <div id="import-dropzone" style="border:2px dashed #ccc; border-radius:8px; padding:40px; text-align:center; cursor:pointer; margin-bottom:16px;">
              <p style="font-size:18px; color:#666;">Kéo thả file .docx vào đây hoặc nhấn để chọn file</p>
              <input type="file" id="import-file-input" accept=".docx" style="display:none">
              <button class="btn btn-primary" onclick="document.getElementById('import-file-input').click()">Chọn file</button>
            </div>
            <div id="import-spinner" style="display:none; text-align:center;">
              <div class="spinner-border text-primary"></div>
              <p>Đang đọc file...</p>
            </div>
          </div>
          <div id="import-preview-section" style="display:none;">
            <div id="import-warnings-bar" class="alert" style="display:none;"></div>
            <div id="import-meta-bar" class="mb-3">
              <div class="row g-2">
                <div class="col-md-4">
                  <label class="form-label">Đơn vị quản lý *</label>
                  <select id="import-dept" class="form-select" required></select>
                </div>
                <div class="col-md-4">
                  <label class="form-label">Năm học *</label>
                  <input id="import-academic-year" class="form-control" placeholder="2025-2026">
                </div>
                <div class="col-md-4 d-flex align-items-end">
                  <button id="import-save-btn" class="btn btn-success" onclick="ImportWordPage.save()">Tạo CTDT</button>
                </div>
              </div>
            </div>
            <ul class="nav nav-tabs" id="import-tabs"></ul>
            <div class="tab-content p-3 border border-top-0" id="import-tab-content"></div>
          </div>
        </div>
      </div>
    `;
    this.bindUpload();
    this.loadDepartments();
  },

  bindUpload() {
    const dropzone = document.getElementById('import-dropzone');
    const fileInput = document.getElementById('import-file-input');

    dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.style.borderColor = '#007bff'; });
    dropzone.addEventListener('dragleave', () => { dropzone.style.borderColor = '#ccc'; });
    dropzone.addEventListener('drop', e => {
      e.preventDefault();
      dropzone.style.borderColor = '#ccc';
      if (e.dataTransfer.files.length) this.uploadFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) this.uploadFile(fileInput.files[0]);
    });
  },

  async loadDepartments() {
    try {
      const res = await fetch('/api/departments', { credentials: 'include' });
      const depts = await res.json();
      const sel = document.getElementById('import-dept');
      sel.innerHTML = '<option value="">-- Chọn đơn vị --</option>' +
        depts.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    } catch (e) { console.error(e); }
  },

  async uploadFile(file) {
    if (!file.name.endsWith('.docx')) {
      alert('Chỉ chấp nhận file .docx');
      return;
    }
    document.getElementById('import-spinner').style.display = 'block';
    document.getElementById('import-dropzone').style.display = 'none';

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/import/parse-word', { method: 'POST', body: formData, credentials: 'include' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      this.parsedData = json.data;
      this.showPreview();
    } catch (err) {
      alert('Lỗi: ' + err.message);
      document.getElementById('import-spinner').style.display = 'none';
      document.getElementById('import-dropzone').style.display = 'block';
    }
  },

  showPreview() {
    document.getElementById('import-upload-section').style.display = 'none';
    document.getElementById('import-preview-section').style.display = 'block';

    // Pre-fill academic year
    if (this.parsedData.version.academic_year) {
      document.getElementById('import-academic-year').value = this.parsedData.version.academic_year;
    }

    this.renderWarnings();
    this.renderTabs();
  },

  renderWarnings() {
    const bar = document.getElementById('import-warnings-bar');
    const w = this.parsedData.warnings || [];
    const errors = w.filter(x => x.severity === 'error');
    const warns = w.filter(x => x.severity === 'warning');

    if (w.length === 0) { bar.style.display = 'none'; return; }

    bar.style.display = 'block';
    bar.className = errors.length > 0 ? 'alert alert-danger' : 'alert alert-warning';
    bar.innerHTML = `<strong>${errors.length} lỗi, ${warns.length} cảnh báo</strong>` +
      w.map(x => `<div><span class="badge bg-${x.severity === 'error' ? 'danger' : 'warning'}">${x.severity}</span> ${x.field}: ${x.message}</div>`).join('');

    // Disable save if errors
    document.getElementById('import-save-btn').disabled = errors.length > 0;
  },

  renderTabs() {
    const tabs = [
      { id: 'general', label: 'Thông tin chung' },
      { id: 'po', label: 'Mục tiêu (PO)' },
      { id: 'plo', label: 'Chuẩn đầu ra (PLO)' },
      { id: 'pi', label: 'Chỉ số PI' },
      { id: 'courses', label: 'Danh sách HP' },
      { id: 'blocks', label: 'Cấu trúc khối KT' },
      { id: 'po-plo', label: 'Ma trận PO-PLO' },
      { id: 'course-pi', label: 'Ma trận Course-PI' },
      { id: 'teaching', label: 'KH giảng dạy' },
      { id: 'assessment', label: 'KH đánh giá' },
      { id: 'descriptions', label: 'Mô tả HP' },
    ];

    document.getElementById('import-tabs').innerHTML = tabs.map((t, i) =>
      `<li class="nav-item"><a class="nav-link ${i === 0 ? 'active' : ''}" href="#" data-tab="${t.id}" onclick="ImportWordPage.switchTab('${t.id}', this)">${t.label}</a></li>`
    ).join('');

    document.getElementById('import-tab-content').innerHTML = tabs.map((t, i) =>
      `<div id="import-tab-${t.id}" style="display:${i === 0 ? 'block' : 'none'};"></div>`
    ).join('');

    // Render first tab
    this.renderTabContent('general');
  },

  switchTab(tabId, el) {
    document.querySelectorAll('#import-tabs .nav-link').forEach(a => a.classList.remove('active'));
    el.classList.add('active');
    document.querySelectorAll('#import-tab-content > div').forEach(d => d.style.display = 'none');
    document.getElementById('import-tab-' + tabId).style.display = 'block';
    this.renderTabContent(tabId);
  },

  renderTabContent(tabId) {
    const el = document.getElementById('import-tab-' + tabId);
    if (el.dataset.rendered) return; // Only render once
    el.dataset.rendered = '1';

    const d = this.parsedData;
    switch (tabId) {
      case 'general': el.innerHTML = this.renderGeneralTab(d); break;
      case 'po': el.innerHTML = this.renderPOTab(d); break;
      case 'plo': el.innerHTML = this.renderPLOTab(d); break;
      case 'pi': el.innerHTML = this.renderPITab(d); break;
      case 'courses': el.innerHTML = this.renderCoursesTab(d); break;
      case 'blocks': el.innerHTML = this.renderBlocksTab(d); break;
      case 'po-plo': el.innerHTML = this.renderPOPLOTab(d); break;
      case 'course-pi': el.innerHTML = this.renderCoursePITab(d); break;
      case 'teaching': el.innerHTML = this.renderTeachingTab(d); break;
      case 'assessment': el.innerHTML = this.renderAssessmentTab(d); break;
      case 'descriptions': el.innerHTML = this.renderDescriptionsTab(d); break;
    }
  },

  // Tab render methods will be added in Task 11

  async save() {
    const deptId = document.getElementById('import-dept').value;
    const academicYear = document.getElementById('import-academic-year').value;

    if (!deptId) { alert('Vui lòng chọn đơn vị quản lý'); return; }
    if (!academicYear) { alert('Vui lòng nhập năm học'); return; }

    // Sync any edits back to parsedData
    this.syncEdits();

    this.parsedData.version.academic_year = academicYear;

    const count = this.parsedData.courses.length;
    if (!confirm(`Sẽ tạo CTDT "${this.parsedData.program.name}" với ${this.parsedData.objectives.length} PO, ${this.parsedData.plos.length} PLO, ${count} học phần. Tiếp tục?`)) return;

    document.getElementById('import-save-btn').disabled = true;
    document.getElementById('import-save-btn').textContent = 'Đang lưu...';

    try {
      const res = await fetch('/api/import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...this.parsedData, department_id: parseInt(deptId) }),
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);

      alert('Tạo CTDT thành công!');
      App.navigate('version-editor', { id: json.version_id });
    } catch (err) {
      alert('Lỗi: ' + err.message);
      document.getElementById('import-save-btn').disabled = false;
      document.getElementById('import-save-btn').textContent = 'Tạo CTDT';
    }
  },

  syncEdits() {
    // Sync inline edits from contenteditable cells back to parsedData
    // Each editable cell has data-path attribute (e.g., "program.name")
    document.querySelectorAll('[data-path]').forEach(el => {
      const path = el.dataset.path;
      const parts = path.split('.');
      let obj = this.parsedData;
      for (let i = 0; i < parts.length - 1; i++) {
        const key = isNaN(parts[i]) ? parts[i] : parseInt(parts[i]);
        obj = obj[key];
      }
      const lastKey = parts[parts.length - 1];
      const val = el.textContent.trim();
      // Try to keep number type
      if (typeof obj[lastKey] === 'number') {
        obj[lastKey] = parseFloat(val) || 0;
      } else {
        obj[lastKey] = val;
      }
    });

    // Sync Course-PI matrix edits (data-cpi="courseCode|piCode")
    document.querySelectorAll('[data-cpi]').forEach(el => {
      const [courseCode, piCode] = el.dataset.cpi.split('|');
      const val = parseInt(el.textContent.trim()) || 0;
      const idx = this.parsedData.coursePIMatrix.findIndex(m => m.course_code === courseCode && m.pi_code === piCode);
      if (val > 0 && val <= 3) {
        if (idx >= 0) {
          this.parsedData.coursePIMatrix[idx].contribution_level = val;
        } else {
          this.parsedData.coursePIMatrix.push({ course_code: courseCode, pi_code: piCode, contribution_level: val });
        }
      } else if (idx >= 0) {
        this.parsedData.coursePIMatrix.splice(idx, 1);
      }
    });
  },
};
```

- [ ] **Step 2: Add script tag in `public/index.html`**

After the last script tag (line 24), add:

```html
<script src="/js/pages/import-word.js"></script>
```

- [ ] **Step 3: Register page in `public/js/app.js`**

In the `pages` object (around line 194-204), add:

```js
'import-word': window.ImportWordPage,
```

- [ ] **Step 4: Verify page loads**

Open browser: `http://localhost:3600/#import-word`

Expected: Upload area with drag & drop zone visible.

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/import-word.js public/index.html public/js/app.js
git commit -m "feat: add import-word page with upload, preview structure, and save flow"
```

---

## Task 11: Frontend — preview tab renderers

**Files:**
- Modify: `public/js/pages/import-word.js`

- [ ] **Step 1: Add all tab render methods**

Add these methods inside the `ImportWordPage` object, replacing the comment `// Tab render methods will be added in Task 11`:

```js
  renderGeneralTab(d) {
    const fields = [
      ['Tên ngành (Việt)', 'program.name', d.program.name],
      ['Tên ngành (Anh)', 'program.name_en', d.program.name_en],
      ['Mã ngành', 'program.code', d.program.code],
      ['Trình độ', 'program.degree', d.program.degree],
      ['Tên văn bằng', 'program.degree_name', d.program.degree_name],
      ['Tổng tín chỉ', 'program.total_credits', d.program.total_credits],
      ['Hình thức đào tạo', 'program.training_mode', d.program.training_mode],
      ['Trường cấp bằng', 'program.institution', d.program.institution],
      ['Thời gian đào tạo', 'version.training_duration', d.version.training_duration],
      ['Thang điểm', 'version.grading_scale', d.version.grading_scale],
      ['Điều kiện tốt nghiệp', 'version.graduation_requirements', d.version.graduation_requirements],
      ['Đối tượng tuyển sinh', 'version.admission_targets', d.version.admission_targets],
      ['Tiêu chí tuyển sinh', 'version.admission_criteria', d.version.admission_criteria],
      ['Vị trí việc làm', 'version.job_positions', d.version.job_positions],
      ['Học tập nâng cao', 'version.further_education', d.version.further_education],
      ['CT tham khảo', 'version.reference_programs', d.version.reference_programs],
      ['Quy trình đào tạo', 'version.training_process', d.version.training_process],
      ['Mục tiêu chung', 'version.general_objective', d.version.general_objective],
    ];
    return `<table class="table table-bordered table-sm"><tbody>` +
      fields.map(([label, path, val]) =>
        `<tr><td style="width:200px;font-weight:bold">${label}</td><td contenteditable="true" data-path="${path}">${val || ''}</td></tr>`
      ).join('') + `</tbody></table>`;
  },

  renderPOTab(d) {
    return `<table class="table table-bordered table-sm">
      <thead><tr><th style="width:80px">Mã</th><th>Mô tả</th></tr></thead>
      <tbody>` + d.objectives.map((o, i) =>
        `<tr><td contenteditable="true" data-path="objectives.${i}.code">${o.code}</td>
             <td contenteditable="true" data-path="objectives.${i}.description">${o.description}</td></tr>`
      ).join('') + `</tbody></table>`;
  },

  renderPLOTab(d) {
    return `<table class="table table-bordered table-sm">
      <thead><tr><th style="width:60px">Mã</th><th>Mô tả</th><th style="width:80px">Bloom</th><th style="width:120px">PO tương ứng</th></tr></thead>
      <tbody>` + d.plos.map((p, i) =>
        `<tr><td contenteditable="true" data-path="plos.${i}.code">${p.code}</td>
             <td contenteditable="true" data-path="plos.${i}.description">${p.description}</td>
             <td contenteditable="true" data-path="plos.${i}.bloom_level">${p.bloom_level}</td>
             <td contenteditable="true" data-path="plos.${i}.po_codes">${(p.po_codes || []).join(', ')}</td></tr>`
      ).join('') + `</tbody></table>`;
  },

  renderPITab(d) {
    let html = '';
    const pisByPLO = {};
    d.pis.forEach(pi => {
      if (!pisByPLO[pi.plo_code]) pisByPLO[pi.plo_code] = [];
      pisByPLO[pi.plo_code].push(pi);
    });
    for (const plo of d.plos) {
      const piList = pisByPLO[plo.code] || [];
      html += `<h6 class="mt-2">${plo.code}: ${plo.description.substring(0, 80)}...</h6>`;
      html += `<table class="table table-bordered table-sm"><thead><tr><th style="width:80px">Mã PI</th><th>Mô tả</th></tr></thead><tbody>`;
      piList.forEach((pi, i) => {
        const idx = d.pis.indexOf(pi);
        html += `<tr><td contenteditable="true" data-path="pis.${idx}.pi_code">${pi.pi_code}</td>
                     <td contenteditable="true" data-path="pis.${idx}.description">${pi.description}</td></tr>`;
      });
      html += `</tbody></table>`;
    }
    return html || '<p class="text-muted">Không có dữ liệu PI</p>';
  },

  renderCoursesTab(d) {
    return `<div style="overflow-x:auto"><table class="table table-bordered table-sm" style="font-size:12px">
      <thead><tr><th>Mã HP</th><th>Tên HP</th><th>TC</th><th>LT</th><th>TH</th><th>ĐA</th><th>TT</th><th>HK</th><th>Loại</th><th>Nhóm TC</th><th>HP trước</th></tr></thead>
      <tbody>` + d.courses.map((c, i) =>
        `<tr><td contenteditable="true" data-path="courses.${i}.code">${c.code}</td>
             <td contenteditable="true" data-path="courses.${i}.name">${c.name}</td>
             <td contenteditable="true" data-path="courses.${i}.credits">${c.credits}</td>
             <td contenteditable="true" data-path="courses.${i}.credits_theory">${c.credits_theory}</td>
             <td contenteditable="true" data-path="courses.${i}.credits_practice">${c.credits_practice}</td>
             <td contenteditable="true" data-path="courses.${i}.credits_project">${c.credits_project}</td>
             <td contenteditable="true" data-path="courses.${i}.credits_internship">${c.credits_internship}</td>
             <td contenteditable="true" data-path="courses.${i}.semester">${c.semester}</td>
             <td>${c.course_type}</td>
             <td>${c.elective_group || ''}</td>
             <td>${(c.prerequisite_codes || []).join(', ')}</td></tr>`
      ).join('') + `</tbody></table></div>`;
  },

  renderBlocksTab(d) {
    return `<table class="table table-bordered table-sm">
      <thead><tr><th>Khối kiến thức</th><th>Tổng TC</th><th>Bắt buộc</th><th>Tự chọn</th></tr></thead>
      <tbody>` + d.knowledgeBlocks.map((b, i) =>
        `<tr><td style="${b.parent_name ? 'padding-left:30px' : 'font-weight:bold'}" contenteditable="true" data-path="knowledgeBlocks.${i}.name">${b.name}</td>
             <td contenteditable="true" data-path="knowledgeBlocks.${i}.total_credits">${b.total_credits}</td>
             <td contenteditable="true" data-path="knowledgeBlocks.${i}.required_credits">${b.required_credits}</td>
             <td contenteditable="true" data-path="knowledgeBlocks.${i}.elective_credits">${b.elective_credits}</td></tr>`
      ).join('') + `</tbody></table>`;
  },

  renderPOPLOTab(d) {
    const poCodes = d.objectives.map(o => o.code);
    const ploCodes = d.plos.map(p => p.code);
    const set = new Set(d.poploMatrix.map(m => m.po_code + '-' + m.plo_code));
    let html = `<div style="overflow-x:auto"><table class="table table-bordered table-sm text-center">
      <thead><tr><th></th>${ploCodes.map(p => `<th>${p}</th>`).join('')}</tr></thead><tbody>`;
    poCodes.forEach(po => {
      html += `<tr><td class="fw-bold">${po}</td>`;
      ploCodes.forEach(plo => {
        const checked = set.has(po + '-' + plo);
        html += `<td style="cursor:pointer" onclick="ImportWordPage.togglePOPLO(this,'${po}','${plo}')">${checked ? 'X' : ''}</td>`;
      });
      html += `</tr>`;
    });
    return html + `</tbody></table></div>`;
  },

  togglePOPLO(td, po, plo) {
    const key = po + '-' + plo;
    const idx = this.parsedData.poploMatrix.findIndex(m => m.po_code === po && m.plo_code === plo);
    if (idx >= 0) {
      this.parsedData.poploMatrix.splice(idx, 1);
      td.textContent = '';
    } else {
      this.parsedData.poploMatrix.push({ po_code: po, plo_code: plo });
      td.textContent = 'X';
    }
  },

  renderCoursePITab(d) {
    if (d.coursePIMatrix.length === 0) return '<p class="text-muted">Không có dữ liệu ma trận Course-PI</p>';
    const piCodes = [...new Set(d.coursePIMatrix.map(m => m.pi_code))].sort();
    const courseCodes = [...new Set(d.coursePIMatrix.map(m => m.course_code))];
    const map = {};
    d.coursePIMatrix.forEach(m => { map[m.course_code + '|' + m.pi_code] = m.contribution_level; });

    let html = `<div style="overflow-x:auto;font-size:11px"><table class="table table-bordered table-sm text-center">
      <thead><tr><th>HP</th>${piCodes.map(p => `<th>${p}</th>`).join('')}</tr></thead><tbody>`;
    courseCodes.forEach(cc => {
      html += `<tr><td class="fw-bold text-start">${cc}</td>`;
      piCodes.forEach(pi => {
        const val = map[cc + '|' + pi] || '';
        html += `<td contenteditable="true" data-cpi="${cc}|${pi}">${val}</td>`;
      });
      html += `</tr>`;
    });
    return html + `</tbody></table></div>`;
  },

  renderTeachingTab(d) {
    const semesters = [...new Set(d.teachingPlan.map(t => t.semester))].sort((a, b) => a - b);
    let html = '';
    semesters.forEach(sem => {
      const items = d.teachingPlan.filter(t => t.semester === sem);
      html += `<h6 class="mt-3">Học kỳ ${sem}</h6>`;
      html += `<table class="table table-bordered table-sm" style="font-size:12px">
        <thead><tr><th>Mã HP</th><th>Tổng tiết</th><th>LT</th><th>TH</th><th>ĐA</th><th>TT</th><th>Phần mềm</th><th>Đơn vị</th><th>Đợt</th></tr></thead><tbody>`;
      items.forEach((t, i) => {
        const idx = d.teachingPlan.indexOf(t);
        html += `<tr><td>${t.course_code}</td>
          <td contenteditable="true" data-path="teachingPlan.${idx}.total_hours">${t.total_hours}</td>
          <td contenteditable="true" data-path="teachingPlan.${idx}.hours_theory">${t.hours_theory}</td>
          <td contenteditable="true" data-path="teachingPlan.${idx}.hours_practice">${t.hours_practice}</td>
          <td contenteditable="true" data-path="teachingPlan.${idx}.hours_project">${t.hours_project}</td>
          <td contenteditable="true" data-path="teachingPlan.${idx}.hours_internship">${t.hours_internship}</td>
          <td contenteditable="true" data-path="teachingPlan.${idx}.software">${t.software}</td>
          <td contenteditable="true" data-path="teachingPlan.${idx}.managing_dept">${t.managing_dept}</td>
          <td contenteditable="true" data-path="teachingPlan.${idx}.batch">${t.batch}</td></tr>`;
      });
      html += `</tbody></table>`;
    });
    return html || '<p class="text-muted">Không có dữ liệu kế hoạch giảng dạy</p>';
  },

  renderAssessmentTab(d) {
    return `<div style="overflow-x:auto"><table class="table table-bordered table-sm" style="font-size:11px">
      <thead><tr><th>PLO</th><th>PI</th><th>Mô tả</th><th>HP mẫu</th><th>Minh chứng</th><th>Công cụ</th><th>KQ mong đợi</th><th>HK</th><th>GV</th><th>Đơn vị</th></tr></thead>
      <tbody>` + d.assessmentPlan.map((a, i) =>
        `<tr><td>${a.plo_code}</td><td>${a.pi_code}</td>
             <td contenteditable="true" data-path="assessmentPlan.${i}.description">${a.description}</td>
             <td contenteditable="true" data-path="assessmentPlan.${i}.sample_course_code">${a.sample_course_code}</td>
             <td contenteditable="true" data-path="assessmentPlan.${i}.direct_evidence">${a.direct_evidence}</td>
             <td contenteditable="true" data-path="assessmentPlan.${i}.assessment_tool">${a.assessment_tool}</td>
             <td contenteditable="true" data-path="assessmentPlan.${i}.expected_result">${a.expected_result}</td>
             <td contenteditable="true" data-path="assessmentPlan.${i}.semester">${a.semester}</td>
             <td contenteditable="true" data-path="assessmentPlan.${i}.assessor">${a.assessor}</td>
             <td contenteditable="true" data-path="assessmentPlan.${i}.dept_code">${a.dept_code}</td></tr>`
      ).join('') + `</tbody></table></div>`;
  },

  renderDescriptionsTab(d) {
    return `<table class="table table-bordered table-sm">
      <thead><tr><th style="width:80px">Mã HP</th><th style="width:200px">Tên HP</th><th>Mô tả</th></tr></thead>
      <tbody>` + d.courseDescriptions.map((c, i) =>
        `<tr><td>${c.code}</td><td>${(d.courses.find(x => x.code === c.code) || {}).name || ''}</td>
             <td contenteditable="true" data-path="courseDescriptions.${i}.description">${c.description}</td></tr>`
      ).join('') + `</tbody></table>`;
  },
```

- [ ] **Step 2: Verify preview renders correctly**

Upload the sample file in browser and check all 11 tabs display data correctly.

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/import-word.js
git commit -m "feat: add all preview tab renderers with inline editing"
```

---

## Task 12: Frontend — add Import Word button to programs page

**Files:**
- Modify: `public/js/pages/programs.js:12`

- [ ] **Step 1: Add Import Word button**

In `programs.js`, find the line with the "Tạo CTDT" button (line ~12) and add the Import Word button next to it:

```js
// Find this pattern:
<button class="btn btn-primary" onclick="window.ProgramsPage.openAddModal()">+ Tạo CTDT</button>

// Add after it:
${window.App.hasPerm('programs.import_word') ? '<button class="btn btn-outline-primary ms-2" onclick="App.navigate(\'import-word\')"><i class="bi bi-file-earmark-word"></i> Import Word</button>' : ''}
```

- [ ] **Step 2: Verify button appears**

Navigate to programs page. Import Word button should appear next to Tạo CTDT.

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/programs.js
git commit -m "feat: add Import Word button to programs page"
```

---

## Task 13: End-to-end test

- [ ] **Step 1: Full flow test**

1. Start dev server: `make dev`
2. Login as admin
3. Go to programs page
4. Click "Import Word"
5. Upload `mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx`
6. Verify all 11 preview tabs show data
7. Select department, enter academic year
8. Click "Tạo CTDT"
9. Verify redirect to version editor
10. Verify data in version editor matches Word file content

- [ ] **Step 2: Verify DB data**

```bash
docker exec -it hutech-ctdt-db psql -U ctdt_user -d ctdt_db -c "
SELECT p.name, p.code, v.status, v.total_credits
FROM programs p JOIN program_versions v ON v.program_id = p.id
WHERE p.code = '7220204';
"
```

Expected: program "Ngôn ngữ Trung Quốc", code "7220204", status "draft", 125 credits.

- [ ] **Step 3: Commit all remaining changes**

```bash
git add -A
git commit -m "feat: complete Word import CTDT feature — end-to-end verified"
```
