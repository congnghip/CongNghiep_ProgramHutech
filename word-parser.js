/**
 * word-parser.js — Complete Word (.docx) parser for HUTECH CTDT import
 *
 * Parses a .docx buffer into structured data: program info, POs, PLOs, PIs,
 * courses, matrices, knowledge blocks, teaching plan, assessment plan, etc.
 *
 * Dependencies: jszip, fast-xml-parser
 */

const JSZip = require('jszip');
const { XMLParser } = require('fast-xml-parser');

// ───────────────────────────────────────────────────────────────────────────
// 1. Core docx reader
// ───────────────────────────────────────────────────────────────────────────

/**
 * Extract text content from a parsed XML node, handling all nesting.
 */
function extractParagraphText(node) {
  if (!node) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(extractParagraphText).join('');
  if (typeof node === 'object') {
    let text = '';
    // Handle <w:t> elements
    if (node.t !== undefined) {
      if (Array.isArray(node.t)) {
        text += node.t.map(t => (typeof t === 'object') ? (t['#text'] || '') : String(t)).join('');
      } else if (typeof node.t === 'object') {
        text += node.t['#text'] || '';
      } else {
        text += String(node.t);
      }
    }
    // Recurse into child elements, skipping attributes and the 't' key we already handled
    for (const key of Object.keys(node)) {
      if (key === 't' || key.startsWith('@_')) continue;
      text += extractParagraphText(node[key]);
    }
    return text;
  }
  return '';
}

/**
 * Parse a <w:tbl> XML node into a 2D string array, handling gridSpan and vMerge.
 */
function parseTable(tbl) {
  if (!tbl) return [];

  const rawRows = tbl.tr ? (Array.isArray(tbl.tr) ? tbl.tr : [tbl.tr]) : [];
  if (rawRows.length === 0) return [];

  // First pass: determine max column count (accounting for gridSpan)
  let maxCols = 0;
  for (const row of rawRows) {
    const cells = row.tc ? (Array.isArray(row.tc) ? row.tc : [row.tc]) : [];
    let colCount = 0;
    for (const cell of cells) {
      const tcPr = cell.tcPr ? (Array.isArray(cell.tcPr) ? cell.tcPr[0] : cell.tcPr) : null;
      const span = tcPr && tcPr.gridSpan ? parseInt(tcPr.gridSpan['@_val'] || '1', 10) : 1;
      colCount += span;
    }
    if (colCount > maxCols) maxCols = colCount;
  }

  // Build the 2D grid
  const grid = [];
  for (let ri = 0; ri < rawRows.length; ri++) {
    grid.push(new Array(maxCols).fill(''));
  }

  // Track vMerge: for each column, the row index of the "restart" cell
  const vMergeStart = new Array(maxCols).fill(-1);

  for (let ri = 0; ri < rawRows.length; ri++) {
    const row = rawRows[ri];
    const cells = row.tc ? (Array.isArray(row.tc) ? row.tc : [row.tc]) : [];
    let colIdx = 0;

    for (const cell of cells) {
      // Skip columns already filled by a previous cell's gridSpan in this row
      // (shouldn't happen with correct data, but be safe)
      while (colIdx < maxCols && grid[ri][colIdx] === '\x00') colIdx++;
      if (colIdx >= maxCols) break;

      const tcPr = cell.tcPr ? (Array.isArray(cell.tcPr) ? cell.tcPr[0] : cell.tcPr) : null;
      const span = tcPr && tcPr.gridSpan ? parseInt(tcPr.gridSpan['@_val'] || '1', 10) : 1;

      // vMerge handling
      const vMerge = tcPr ? tcPr.vMerge : undefined;
      const cellText = extractParagraphText(cell).trim();

      if (vMerge !== undefined) {
        if (typeof vMerge === 'object' && vMerge['@_val'] === 'restart') {
          // Start of vertical merge
          vMergeStart[colIdx] = ri;
          grid[ri][colIdx] = cellText;
        } else {
          // Continuation of vertical merge (vMerge="" or vMerge without val)
          // Copy text from the restart cell
          if (vMergeStart[colIdx] >= 0) {
            grid[ri][colIdx] = grid[vMergeStart[colIdx]][colIdx];
          } else {
            grid[ri][colIdx] = cellText;
          }
        }
      } else {
        // No vMerge — reset tracking for this column
        vMergeStart[colIdx] = -1;
        grid[ri][colIdx] = cellText;
      }

      // Fill gridSpan columns with the same text
      for (let s = 1; s < span && colIdx + s < maxCols; s++) {
        grid[ri][colIdx + s] = cellText;
      }

      colIdx += span;
    }
  }

  return grid;
}

/**
 * Read a .docx buffer and return parsed tables and paragraphs.
 */
async function readDocx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const xmlFile = zip.file('word/document.xml');
  if (!xmlFile) throw new Error('No word/document.xml found in docx');

  const xml = await xmlFile.async('string');

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    preserveOrder: false,
    removeNSPrefix: true,
    trimValues: false,
    isArray: (name) => [
      'tr', 'tc', 'tbl', 'p', 'r', 't',
      'gridCol', 'tcPr', 'rPr', 'pPr',
      'bookmarkStart', 'bookmarkEnd', 'hyperlink'
    ].includes(name),
  });

  const doc = parser.parse(xml);
  const body = doc.document.body;

  // Collect all tables from the body (can be nested)
  function findTables(obj, result) {
    if (!obj) return;
    if (Array.isArray(obj)) {
      obj.forEach(item => findTables(item, result));
    } else if (typeof obj === 'object') {
      if (obj.tbl) {
        const tbls = Array.isArray(obj.tbl) ? obj.tbl : [obj.tbl];
        tbls.forEach(t => result.push(t));
      }
      for (const key of Object.keys(obj)) {
        if (key !== 'tbl') findTables(obj[key], result);
      }
    }
    return result;
  }

  const rawTables = findTables(body, []);
  const tables = rawTables.map(t => parseTable(t));

  // Collect top-level paragraphs (not inside tables)
  const rawParagraphs = body.p ? (Array.isArray(body.p) ? body.p : [body.p]) : [];
  const paragraphs = rawParagraphs.map(p => extractParagraphText(p).trim());

  return { tables, paragraphs };
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Table identification by content heuristics
// ───────────────────────────────────────────────────────────────────────────

function identifyTables(tables, paragraphs) {
  const roles = {};

  for (let i = 0; i < tables.length; i++) {
    const t = tables[i];
    if (!t || t.length === 0) continue;
    const firstRowText = t[0].join(' ').toLowerCase();
    const allText = t.map(r => r.join(' ')).join(' ').toLowerCase();

    // Header table (BỘ GIÁO DỤC / CỘNG HÒA)
    if (firstRowText.includes('bộ giáo dục') || firstRowText.includes('cộng hòa xã hội')) {
      roles.header = i;
      continue;
    }

    // General info (Tên ngành đào tạo)
    if (allText.includes('tên ngành đào tạo') && allText.includes('mã ngành')) {
      roles.generalInfo = i;
      continue;
    }

    // PLO table (Chuẩn đầu ra with Trình độ năng lực column)
    if (firstRowText.includes('chuẩn đầu ra') && firstRowText.includes('trình độ năng lực')) {
      roles.plo = i;
      continue;
    }

    // Competency level table (Trình độ năng lực / Mô tả)
    if (firstRowText.includes('trình độ năng lực') && firstRowText.includes('mô tả') && !firstRowText.includes('chuẩn đầu ra')) {
      roles.competencyLevels = i;
      continue;
    }

    // PO-PLO Matrix (Mục tiêu PO × PLO with X marks)
    if (firstRowText.includes('mục tiêu') && firstRowText.includes('chuẩn đầu ra') && allText.includes('x')) {
      roles.poploMatrix = i;
      continue;
    }

    // Knowledge blocks (Khối kiến thức)
    if (firstRowText.includes('khối kiến thức') && firstRowText.includes('số tín chỉ')) {
      roles.knowledgeBlocks = i;
      continue;
    }

    // Detailed curriculum (STT, Mã số HP, Tên học phần, credits breakdown)
    if ((firstRowText.includes('mã số hp') || firstRowText.includes('mã sốhp') || firstRowText.includes('mã số hp'))
        && firstRowText.includes('tên học phần')) {
      roles.curriculum = i;
      continue;
    }

    // Course-PI matrix (Mã học phần × PLO/PI)
    if ((firstRowText.includes('mã học phần') || firstRowText.includes('mã hp'))
        && firstRowText.includes('chuẩn đầu ra') && firstRowText.includes('pi')) {
      roles.coursePIMatrix = i;
      continue;
    }

    // Course descriptions (STT, Mã học phần, Tên học phần, Mô tả tóm tắt)
    if (firstRowText.includes('mô tả tóm tắt') || firstRowText.includes('mô tả')) {
      if (firstRowText.includes('mã học phần') || firstRowText.includes('tên học phần')) {
        roles.courseDescriptions = i;
        continue;
      }
    }

    // Teaching plan (contains "Học kỳ" rows and "Phân bổ số tiết")
    if ((firstRowText.includes('phân bổ số tiết') || firstRowText.includes('tổng số tiết'))
        && allText.includes('học kỳ')) {
      roles.teachingPlan = i;
      continue;
    }

    // PI descriptions (PLO → PI list, Phụ lục II)
    if (firstRowText.includes('chuẩn đầu ra chương trình') && firstRowText.includes('chỉ số đo lường')) {
      roles.piDescriptions = i;
      continue;
    }

    // Assessment plan (PLO, PI, Miêu tả, Mã các học phần đóng góp...)
    if (firstRowText.includes('plo') && firstRowText.includes('pi') && firstRowText.includes('miêu tả')) {
      roles.assessmentPlan = i;
      continue;
    }

    // Signature table (HIỆU TRƯỞNG)
    if (allText.includes('hiệu trưởng') || allText.includes('phó hiệu trưởng')) {
      roles.signature = i;
      continue;
    }

    // Assessment plan header table (Tên CTĐT:)
    if (firstRowText.includes('tên ctđt') || firstRowText.includes('trình độ đào tạo')) {
      roles.assessmentPlanHeader = i;
      continue;
    }
  }

  return roles;
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Section extractors
// ───────────────────────────────────────────────────────────────────────────

/**
 * Extract general info from the key-value table (table index 1 typically).
 * Returns { program: {...}, version: {...} }.
 */
function extractGeneralInfo(table) {
  const program = {};
  const version = {};

  if (!table || table.length === 0) return { program, version };

  // Build a map: label → value
  const infoMap = {};
  for (const row of table) {
    if (row.length < 2) continue;
    // The label is typically in cell[1] (cell[0] is the number), value in cell[2]
    // But sometimes it's cell[0]=label, cell[1]=value (for sub-rows)
    let label = '';
    let value = '';

    if (row.length >= 3) {
      const num = row[0].trim();
      label = row[1].trim();
      value = row[2].trim();
      // If label is empty, use the first cell
      if (!label && num) {
        label = num;
        value = row.length > 2 ? row[2].trim() : row[1].trim();
      }
    } else {
      label = row[0].trim();
      value = row[1].trim();
    }

    if (label) infoMap[label.toLowerCase()] = value;
  }

  // Extract Vietnamese name and English name directly from rows
  for (const row of table) {
    const rowText = row.join(' ');
    if (rowText.includes('Tên tiếng Việt:')) {
      const match = rowText.match(/Tên tiếng Việt:\s*(.+)/i);
      if (match) program.name = match[1].trim();
    }
    if (rowText.includes('Tên tiếng Anh:')) {
      const match = rowText.match(/Tên tiếng Anh:\s*(.+)/i);
      if (match) program.name_en = match[1].trim();
    }
  }

  // Extract program code (Mã ngành)
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('mã ngành')) {
      program.code = val.trim();
    }
  }

  // Extract degree name
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('tên gọi văn bằng')) {
      program.degree = val.trim();
    }
  }

  // Level
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('trình độ đào tạo')) {
      program.level = val.trim();
    }
  }

  // Managing unit
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('đơn vị quản lý')) {
      program.department = val.trim();
    }
  }

  // Total credits
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('số tín chỉ')) {
      const m = val.match(/(\d+)/);
      if (m) program.total_credits = parseInt(m[1], 10);
    }
  }

  // Training mode
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('hình thức đào tạo')) {
      program.training_mode = val.trim();
    }
  }

  // Duration
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('thời gian đào tạo')) {
      program.duration = val.trim();
    }
  }

  // Issuing institution
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('trường cấp bằng')) {
      program.institution = val.trim();
    }
  }

  // Training duration → version
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('thời gian đào tạo')) {
      version.training_duration = val.trim();
    }
  }

  // Grading scale (thang điểm)
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('thang điểm')) {
      version.grading_scale = val.trim();
    }
  }

  // Graduation requirements (điều kiện tốt nghiệp)
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('điều kiện tốt nghiệp') || key.includes('đk tốt nghiệp')) {
      version.graduation_requirements = val.trim();
    }
  }

  // Job positions (vị trí việc làm / vị trí công tác)
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('vị trí việc làm') || key.includes('vị trí công tác')) {
      version.job_positions = val.trim();
    }
  }

  // Further education (khả năng học tập nâng cao)
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('học tập nâng cao') || key.includes('khả năng học tập')) {
      version.further_education = val.trim();
    }
  }

  // Reference programs (chương trình tham khảo)
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('tham khảo') || key.includes('chương trình đào tạo tham khảo')) {
      version.reference_programs = val.trim();
    }
  }

  // Training process (quy trình đào tạo)
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('quy trình đào tạo') || key.includes('quá trình đào tạo')) {
      version.training_process = val.trim();
    }
  }

  // Admission targets (đối tượng tuyển sinh)
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('đối tượng tuyển sinh')) {
      version.admission_targets = val.trim();
    }
  }

  // Admission criteria (tiêu chí tuyển sinh / điều kiện tuyển sinh)
  for (const [key, val] of Object.entries(infoMap)) {
    if (key.includes('tiêu chí tuyển sinh') || key.includes('điều kiện tuyển sinh')) {
      version.admission_criteria = val.trim();
    }
  }

  // Version info: academic year extracted from program name or default
  version.academic_year = new Date().getFullYear().toString();
  version.status = 'draft';

  return { program, version };
}

/**
 * Extract PO objectives from paragraphs.
 * Looks for "PO1:", "PO2:" etc. patterns.
 */
function extractObjectives(paragraphs) {
  let general_objective = '';
  const objectives = [];

  if (!paragraphs || paragraphs.length === 0) return { general_objective, objectives };

  // Find general objective: paragraph after "Mục tiêu chung"
  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i].trim();
    if (p.match(/^Mục tiêu chung$/i)) {
      // Next non-empty paragraph is the general objective
      for (let j = i + 1; j < paragraphs.length; j++) {
        const next = paragraphs[j].trim();
        if (next && !next.match(/^Mục tiêu cụ thể$/i) && !next.match(/^PO\d/)) {
          general_objective = next;
          break;
        }
      }
    }
  }

  // Extract PO items
  for (const p of paragraphs) {
    const trimmed = p.trim();
    const match = trimmed.match(/^(PO\d+)\s*:\s*(.+)$/s);
    if (match) {
      objectives.push({
        code: match[1],
        description: match[2].trim(),
      });
    }
  }

  return { general_objective, objectives };
}

/**
 * Extract PLOs from the PLO table.
 * Table has columns: PLO code | description | PO codes | Bloom level
 */
function extractPLOs(table) {
  if (!table || table.length < 2) return [];

  const plos = [];
  // First row is header, data starts from row 1
  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    if (row.length < 3) continue;

    // Find the PLO code cell
    let ploCode = '';
    let description = '';
    let poCodes = '';
    let bloomLevel = null;

    // The PLO table structure: PLO code | description | PO codes | bloom level
    // But due to gridSpan, the first cell might contain "PLO1" and span description
    for (let c = 0; c < row.length; c++) {
      const cell = row[c].trim();
      if (!ploCode && cell.match(/^PLO\d+$/i)) {
        ploCode = cell;
      } else if (ploCode && !description && cell.length > 20) {
        description = cell;
      } else if (ploCode && description && cell.match(/^PO\d/i)) {
        poCodes = cell;
      } else if (ploCode && description && cell.match(/^\d+$/)) {
        bloomLevel = parseInt(cell, 10);
      }
    }

    if (!ploCode) {
      // Try: first cell contains PLO code as part of text
      const firstCell = row[0].trim();
      const m = firstCell.match(/^(PLO\d+)/i);
      if (m) {
        ploCode = m[1];
        // Rest of row[0] after PLO code might be description
        description = firstCell.substring(m[0].length).trim();
        if (!description && row.length > 1) description = row[1].trim();
      }
    }

    if (ploCode) {
      // Parse PO codes (e.g., "PO1, PO4")
      const poCodeList = poCodes
        ? poCodes.match(/PO\d+/gi) || []
        : [];

      plos.push({
        code: ploCode.toUpperCase(),
        description: description,
        bloom_level: bloomLevel,
        po_codes: poCodeList.map(c => c.toUpperCase()),
      });
    }
  }

  return plos;
}

/**
 * Extract PO-PLO matrix from the matrix table.
 * Returns array of { po_code, plo_code } for each "X" mark.
 */
function extractPOPLOMatrix(table) {
  if (!table || table.length < 3) return [];

  const mappings = [];

  // Find the row with PLO codes (PLO1, PLO2, ...)
  let ploHeaderRowIdx = -1;
  let ploCodes = [];
  for (let ri = 0; ri < Math.min(table.length, 5); ri++) {
    const row = table[ri];
    const found = [];
    for (let ci = 0; ci < row.length; ci++) {
      if (row[ci].trim().match(/^PLO\d+$/i)) {
        found.push({ col: ci, code: row[ci].trim().toUpperCase() });
      }
    }
    if (found.length >= 2) {
      ploHeaderRowIdx = ri;
      ploCodes = found;
      break;
    }
  }

  if (ploHeaderRowIdx < 0) return [];

  // Data rows follow
  for (let ri = ploHeaderRowIdx + 1; ri < table.length; ri++) {
    const row = table[ri];
    // Find PO code in this row
    let poCode = '';
    for (let ci = 0; ci < row.length; ci++) {
      const m = row[ci].trim().match(/^(PO\d+)/i);
      if (m) {
        poCode = m[1].toUpperCase();
        break;
      }
    }
    if (!poCode) continue;

    // Check each PLO column for "X"
    for (const { col, code } of ploCodes) {
      if (col < row.length) {
        const val = row[col].trim().toUpperCase();
        if (val === 'X') {
          mappings.push({ po_code: poCode, plo_code: code });
        }
      }
    }
  }

  return mappings;
}

/**
 * Extract knowledge blocks from the structure table.
 */
function extractKnowledgeBlocks(table) {
  if (!table || table.length < 2) return [];

  const blocks = [];
  let currentParent = null;
  let sortOrder = 0;

  // Skip header rows (first 1-2 rows)
  const startRow = table.length > 1 && table[1].join(' ').match(/tổng|bắt buộc|tự chọn/i) ? 2 : 1;

  for (let i = startRow; i < table.length; i++) {
    const row = table[i];
    if (row.length < 2) continue;

    const name = row[0].trim();
    if (!name || name.match(/^tổng\s*số/i)) continue;

    // Determine if this is a parent or child block
    // Parent blocks typically have percentage in last column
    const lastCell = row[row.length - 1].trim();
    const hasPercentage = lastCell.match(/\d+(\.\d+)?%/);

    // Find credit values
    let totalCredits = 0;
    let requiredCredits = 0;
    let electiveCredits = 0;

    // Columns after name: total, required, elective, percentage
    if (row.length >= 4) {
      const rawTotal = row[1].trim().replace(/[^\d]/g, '');
      const rawRequired = row[2].trim().replace(/[^\d-]/g, '');
      const rawElective = row[3].trim().replace(/[^\d-]/g, '');

      totalCredits = parseInt(rawTotal, 10) || 0;
      requiredCredits = rawRequired === '-' ? 0 : (parseInt(rawRequired, 10) || 0);
      electiveCredits = rawElective === '-' ? 0 : (parseInt(rawElective, 10) || 0);
    }

    sortOrder++;

    if (hasPercentage) {
      // This is a parent block
      currentParent = name;
      blocks.push({
        name,
        parent_name: null,
        total_credits: totalCredits,
        required_credits: requiredCredits,
        elective_credits: electiveCredits,
        sort_order: sortOrder,
      });
    } else {
      // This is a child block
      blocks.push({
        name,
        parent_name: currentParent,
        total_credits: totalCredits,
        required_credits: requiredCredits,
        elective_credits: electiveCredits,
        sort_order: sortOrder,
      });
    }
  }

  return blocks;
}

/**
 * Extract courses from the detailed curriculum table.
 */
function extractCourses(table) {
  if (!table || table.length < 3) return { courses: [], knowledgeBlocks: [] };

  const courses = [];
  const knowledgeBlocks = [];
  let blockSortOrder = 0;

  // Track current position in knowledge block hierarchy
  let currentLevel1 = null; // e.g. "Kiến thức giáo dục đại cương"
  let currentLevel2 = null; // e.g. "Kiến thức bắt buộc"
  let currentLevel3 = null; // e.g. "Nhóm 1: Tiếng Trung thương mại"

  let currentCourseType = 'required';
  let currentElectiveGroup = '';

  for (let i = 0; i < table.length; i++) {
    const row = table[i];
    if (row.length < 3) continue;

    const cell0 = row[0].trim();
    const cell1 = row.length > 1 ? row[1].trim() : '';
    const cell2 = row.length > 2 ? row[2].trim() : '';

    // Skip header rows
    if (cell0.toLowerCase().includes('stt') && cell2.toLowerCase().includes('tên học phần')) continue;
    if (cell0 === '' && cell2 === '' && cell1 === '') continue;
    // Sub-header row (Tổng, LT, TH/TN, ĐA, TT)
    if (cell0 === '' && row.join('').match(/^(Tổng|LT|TH)/)) continue;

    // Section header detection (merged cells)
    const rowText = row.join(' ').trim();
    const isMerged = cell0 === cell1 || cell0 === cell2;

    // ── Level 1: ALL CAPS, merged cells, no course code ──
    if (cell0.match(/^KIẾN THỨC GIÁO DỤC ĐẠI CƯƠNG/i) || rowText.match(/^KIẾN THỨC GIÁO DỤC ĐẠI CƯƠNG/i)) {
      const credits = parseInt(row[3], 10) || 0;
      currentLevel1 = 'Kiến thức giáo dục đại cương';
      currentLevel2 = null;
      currentLevel3 = null;
      currentCourseType = 'required';
      currentElectiveGroup = '';
      knowledgeBlocks.push({ name: currentLevel1, parent_name: null, level: 1, total_credits: credits, sort_order: ++blockSortOrder });
      continue;
    }
    if (cell0.match(/^KIẾN THỨC GIÁO DỤC CHUYÊN NGHIỆP/i) || rowText.match(/^KIẾN THỨC GIÁO DỤC CHUYÊN NGHIỆP/i)) {
      const credits = parseInt(row[3], 10) || 0;
      currentLevel1 = 'Kiến thức giáo dục chuyên nghiệp';
      currentLevel2 = null;
      currentLevel3 = null;
      currentCourseType = 'required';
      currentElectiveGroup = '';
      knowledgeBlocks.push({ name: currentLevel1, parent_name: null, level: 1, total_credits: credits, sort_order: ++blockSortOrder });
      continue;
    }
    if (cell0.match(/^KIẾN THỨC KHÔNG TÍCH LŨY/i) || rowText.match(/^KIẾN THỨC KHÔNG TÍCH LŨY/i)) {
      const credits = parseInt(row[3], 10) || 0;
      currentLevel1 = 'Kiến thức không tích lũy';
      currentLevel2 = null;
      currentLevel3 = null;
      currentCourseType = 'non_accumulative';
      currentElectiveGroup = '';
      knowledgeBlocks.push({ name: currentLevel1, parent_name: null, level: 1, total_credits: credits, sort_order: ++blockSortOrder });
      continue;
    }

    // Course row: must have a course code pattern in cell[1]
    // Check this BEFORE sub-section headers, because STT codes like "II.1.01"
    // would falsely match sub-section patterns like /^II\.1\./
    if (cell1.match(/^[A-Z]{2,}[\d]+$/i)) {
      const code = cell1.trim();
      const name = cell2.trim();

      // Credit breakdown
      let credits = 0, credits_theory = 0, credits_practice = 0, credits_project = 0, credits_internship = 0;

      if (row.length >= 8) {
        credits = parseInt(row[3].trim(), 10) || 0;
        credits_theory = parseInt(row[4].trim(), 10) || 0;
        credits_practice = parseInt(row[5].trim(), 10) || 0;
        credits_project = parseInt(row[6].trim(), 10) || 0;
        credits_internship = parseInt(row[7].trim(), 10) || 0;
      }

      // Prerequisites and corequisites
      let prerequisite_codes = [];
      let corequisite_codes = [];

      if (row.length >= 9) {
        const prereqStr = row[8].trim();
        if (prereqStr) {
          prerequisite_codes = prereqStr.split(/[,;\s]+/).filter(c => c.match(/^[A-Z]{2,}/i));
        }
      }
      if (row.length >= 10) {
        const coreqStr = row[9].trim();
        if (coreqStr) {
          corequisite_codes = coreqStr.split(/[,;\s]+/).filter(c => c.match(/^[A-Z]{2,}/i));
        }
      }

      // Determine knowledge_block_name: deepest level in current stack
      const knowledge_block_name = currentLevel3 || currentLevel2 || currentLevel1 || null;

      courses.push({
        code,
        name,
        credits,
        credits_theory,
        credits_practice,
        credits_project,
        credits_internship,
        semester: null,
        course_type: currentCourseType,
        elective_group: currentElectiveGroup || null,
        prerequisite_codes,
        corequisite_codes,
        knowledge_block_name,
      });
      continue;
    }

    // ── Level 2: Sub-section headers (checked AFTER course code detection) ──
    if (cell0.match(/^II\.1\.\s*[^\d]|^Kiến thức bắt buộc/i) || (cell0.match(/^II\.1\.$/) && !cell1.match(/^[A-Z]/))) {
      const credits = parseInt(row[3], 10) || 0;
      // Clean the name: remove prefix like "II.1. "
      const blockName = cell0.replace(/^[IVX]+\.\d+\.\s*/, '').trim() || 'Kiến thức bắt buộc';
      currentLevel2 = blockName;
      currentLevel3 = null;
      currentCourseType = 'required';
      currentElectiveGroup = '';
      knowledgeBlocks.push({ name: currentLevel2, parent_name: currentLevel1, level: 2, total_credits: credits, sort_order: ++blockSortOrder });
      continue;
    }
    if (cell0.match(/^II\.2\.\s*[^\d]|^Kiến thức tự chọn/i) || (cell0.match(/^II\.2\.$/) && !cell1.match(/^[A-Z]/))) {
      const credits = parseInt(row[3], 10) || 0;
      const blockName = cell0.replace(/^[IVX]+\.\d+\.\s*/, '').trim() || 'Kiến thức tự chọn';
      currentLevel2 = blockName;
      currentLevel3 = null;
      currentCourseType = 'elective';
      currentElectiveGroup = '';
      knowledgeBlocks.push({ name: currentLevel2, parent_name: currentLevel1, level: 2, total_credits: credits, sort_order: ++blockSortOrder });
      continue;
    }
    if (cell0.match(/^III\.\d\.\s*[^\d]|^Giáo dục thể chất|^Bắt buộc/i)) {
      const credits = parseInt(row[3], 10) || 0;
      const blockName = cell0.replace(/^[IVX]+\.\d+\.\s*/, '').trim() || cell0.trim();
      currentLevel2 = blockName;
      currentLevel3 = null;
      currentCourseType = 'non_accumulative';
      currentElectiveGroup = '';
      knowledgeBlocks.push({ name: currentLevel2, parent_name: currentLevel1, level: 2, total_credits: credits, sort_order: ++blockSortOrder });
      continue;
    }
    if (cell0.match(/^III\.2\.\s*[^\d]|^Chương trình Giáo dục quốc phòng/i)) {
      const credits = parseInt(row[3], 10) || 0;
      const blockName = cell0.replace(/^[IVX]+\.\d+\.\s*/, '').trim() || cell0.trim();
      currentLevel2 = blockName;
      currentLevel3 = null;
      currentCourseType = 'non_accumulative';
      currentElectiveGroup = '';
      knowledgeBlocks.push({ name: currentLevel2, parent_name: currentLevel1, level: 2, total_credits: credits, sort_order: ++blockSortOrder });
      continue;
    }

    // ── Level 3: Elective group headers ──
    const groupMatch = cell0.match(/^Nhóm\s*(\d+)\s*(?::?\s*(.*))?$/i);
    if (groupMatch) {
      currentLevel3 = cell0.trim();
      currentElectiveGroup = cell0.trim();
      if (currentCourseType !== 'non_accumulative') currentCourseType = 'elective';
      knowledgeBlocks.push({ name: currentLevel3, parent_name: currentLevel2, level: 3, total_credits: 0, sort_order: ++blockSortOrder });
      continue;
    }
  }

  return { courses, knowledgeBlocks };
}

/**
 * Extract Course-PI matrix.
 * Header rows contain PLO grouping and PI codes.
 * Data rows: course_code | course_name | level_1 | level_2 | ...
 */
function extractCoursePIMatrix(table) {
  if (!table || table.length < 4) return [];

  const mappings = [];

  // Row with individual PI codes (usually row 2)
  // Look for a row containing "PI" in a cell
  let piHeaderRowIdx = -1;
  let piCodes = []; // array of { col, code }

  for (let ri = 0; ri < Math.min(table.length, 5); ri++) {
    const row = table[ri];
    let foundPI = false;
    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci].trim();
      if (cell.match(/^PI[\.\d]/i)) {
        foundPI = true;
        break;
      }
    }
    if (foundPI) {
      piHeaderRowIdx = ri;
      break;
    }
  }

  if (piHeaderRowIdx < 0) return [];

  // Parse PI codes from the header row
  const piRow = table[piHeaderRowIdx];
  // The first PI cell should have format "PI.X.Y"
  // Subsequent cells might have abbreviated form like "X.Y" or just digits
  let currentPLO = 0;
  let dataStartCol = -1;

  for (let ci = 0; ci < piRow.length; ci++) {
    const cell = piRow[ci].trim();
    if (!cell) continue;

    // Full PI code: "PI.X.Y" or "PI.X.Y"
    const fullMatch = cell.match(/^PI[\.\s]*(\d+)[\.\s]*(\d+)$/i);
    if (fullMatch) {
      currentPLO = parseInt(fullMatch[1], 10);
      const piNum = parseInt(fullMatch[2], 10);
      if (dataStartCol < 0) dataStartCol = ci;
      piCodes.push({ col: ci, code: `PI.${currentPLO}.${piNum}` });
      continue;
    }

    // Abbreviated: "X.Y" — means PLO X, PI Y
    const abbrMatch = cell.match(/^(\d+)\.(\d+)$/);
    if (abbrMatch && dataStartCol >= 0) {
      currentPLO = parseInt(abbrMatch[1], 10);
      const piNum = parseInt(abbrMatch[2], 10);
      piCodes.push({ col: ci, code: `PI.${currentPLO}.${piNum}` });
      continue;
    }

    // Just a number like "31" which is likely "3.1" (typo in source)
    const numMatch = cell.match(/^(\d)(\d)$/);
    if (numMatch && dataStartCol >= 0) {
      currentPLO = parseInt(numMatch[1], 10);
      const piNum = parseInt(numMatch[2], 10);
      piCodes.push({ col: ci, code: `PI.${currentPLO}.${piNum}` });
      continue;
    }
  }

  if (piCodes.length === 0) return [];

  // Data rows start after the PI header row
  for (let ri = piHeaderRowIdx + 1; ri < table.length; ri++) {
    const row = table[ri];
    if (row.length < 3) continue;

    // First cell should be a course code
    const courseCode = row[0].trim();
    if (!courseCode.match(/^[A-Z]{2,}[\d]+$/i)) continue;

    // Check each PI column
    for (const { col, code } of piCodes) {
      if (col >= row.length) continue;
      const val = row[col].trim();
      // Value should be 1, 2, or 3 (contribution level), dash means no contribution
      if (val.match(/^[123]$/)) {
        mappings.push({
          course_code: courseCode,
          pi_code: code,
          contribution_level: parseInt(val, 10),
        });
      }
    }
  }

  return mappings;
}

/**
 * Extract course descriptions from the descriptions table.
 */
function extractCourseDescriptions(table) {
  if (!table || table.length < 2) return [];

  const descriptions = [];

  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    if (row.length < 4) continue;

    // STT | Mã học phần | Tên học phần | Mô tả tóm tắt
    const code = row[1].trim();
    const description = row[3].trim();

    if (code.match(/^[A-Z]{2,}/i) && description) {
      descriptions.push({ code, description });
    }
  }

  return descriptions;
}

/**
 * Extract teaching plan from the teaching plan table.
 * Returns array of { semester, code, name, credits, total_hours, ... }
 */
function extractTeachingPlan(tables, paragraphs) {
  // The teaching plan is a single table with "Học kỳ X" rows as separators
  const entries = [];

  // Find teaching plan table: use identifyTables if available
  // For standalone use, search all tables
  let planTable = null;
  for (const t of tables) {
    if (!t || t.length < 10) continue;
    const allText = t.map(r => r.join(' ')).join(' ').toLowerCase();
    if ((allText.includes('phân bổ số tiết') || allText.includes('tổng số tiết'))
        && allText.includes('học kỳ 1') && allText.includes('học kỳ 2')) {
      planTable = t;
      break;
    }
  }

  if (!planTable) return [];

  let currentSemester = 0;

  // Skip header rows (typically 2)
  let dataStart = 0;
  for (let i = 0; i < Math.min(planTable.length, 5); i++) {
    const rowText = planTable[i].join(' ').toLowerCase();
    if (rowText.includes('stt') || rowText.includes('phân bổ') || rowText.match(/^\s*(lt|th)/)) {
      dataStart = i + 1;
    }
  }

  for (let i = dataStart; i < planTable.length; i++) {
    const row = planTable[i];
    const rowText = row.join(' ').trim();

    // Check for semester header
    const semesterMatch = rowText.match(/Học kỳ\s*(\d+)/i);
    if (semesterMatch) {
      currentSemester = parseInt(semesterMatch[1], 10);
      continue;
    }

    // Skip total/summary rows
    if (rowText.match(/Tổng số tín chỉ/i)) continue;
    if (!rowText.trim()) continue;

    // Course row: find the code
    // The teaching plan rows: STT | code | name | credits | total_hours | LT | TH/TN | ĐA | TT | software | dept | notes | batch
    let code = '';
    let name = '';
    let credits = 0;
    let total_hours = 0;
    let hours_theory = 0;
    let hours_practice = 0;
    let hours_project = 0;
    let hours_internship = 0;
    let department = '';
    let notes = '';
    let batch = '';

    // Find course code in the row
    for (let ci = 0; ci < Math.min(row.length, 3); ci++) {
      const cell = row[ci].trim();
      if (cell.match(/^[A-Z]{2,}[\d]+$/i)) {
        code = cell;
        break;
      }
    }

    if (!code || !currentSemester) continue;

    // Parse remaining fields based on position relative to code
    const codeIdx = row.findIndex(c => c.trim() === code);
    if (codeIdx < 0) continue;

    name = (row[codeIdx + 1] || '').trim();
    credits = parseInt((row[codeIdx + 2] || '').trim(), 10) || 0;
    total_hours = parseInt((row[codeIdx + 3] || '').trim(), 10) || 0;
    hours_theory = parseInt((row[codeIdx + 4] || '').trim(), 10) || 0;
    hours_practice = parseInt((row[codeIdx + 5] || '').trim(), 10) || 0;
    hours_project = parseInt((row[codeIdx + 6] || '').trim(), 10) || 0;
    hours_internship = parseInt((row[codeIdx + 7] || '').trim(), 10) || 0;

    // Department and notes are further along
    if (codeIdx + 9 < row.length) department = (row[codeIdx + 9] || '').trim();
    if (codeIdx + 10 < row.length) notes = (row[codeIdx + 10] || '').trim();
    if (codeIdx + 11 < row.length) batch = (row[codeIdx + 11] || '').trim();

    entries.push({
      semester: currentSemester,
      code,
      name,
      credits,
      total_hours,
      hours_theory,
      hours_practice,
      hours_project,
      hours_internship,
      department,
      notes,
      batch,
    });
  }

  return entries;
}

/**
 * Extract PI descriptions from the PI descriptions table (Phụ lục II).
 * Table has: PLO code | PLO description | PI list (as text block)
 */
function extractPIs(table) {
  if (!table || table.length < 2) return [];

  const pis = [];

  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    if (row.length < 2) continue;

    // Find PLO code
    let ploCode = '';
    let piText = '';

    for (let ci = 0; ci < row.length; ci++) {
      const cell = row[ci].trim();
      const m = cell.match(/^(PLO\d+)/i);
      if (m && !ploCode) {
        ploCode = m[1].toUpperCase();
        continue;
      }
    }

    if (!ploCode) continue;

    // The PI descriptions are in the last column as a text block
    // Pattern: "PI.X.Y description PI.X.Z description ..."
    piText = row[row.length - 1].trim();

    // Also check second-to-last column if last is empty
    if (!piText && row.length >= 3) {
      piText = row[row.length - 2].trim();
    }

    // Parse individual PIs from the text block
    // PI codes can appear in various formats:
    //   "PI.X.Y", "PIX.Y", "PIX.0Y", "PIX0.0Y" (e.g., "PI10.01" = PLO1 PI1)
    // Strategy: split text on PI code patterns, then normalize using PLO context
    const expectedPloNum = parseInt(ploCode.replace(/PLO/i, ''), 10);

    // Match any PI code pattern: PI followed by digits/dots
    const piPattern = /PI[\.\s]*(\d+)[\.\s]*(\d+)\s*(.*?)(?=PI[\.\s]*\d+[\.\s]*\d+|$)/gis;
    let match;
    while ((match = piPattern.exec(piText)) !== null) {
      let rawPloNum = parseInt(match[1], 10);
      let rawPiNum = parseInt(match[2], 10);
      const desc = match[3].trim();

      // Normalize: "PI10.01" → PLO=1, PI=1; "PI20.03" → PLO=2, PI=3
      // The pattern is PI{PLO_NUM}0.0{PI_NUM} when no separator exists
      // If rawPloNum is a multiple of 10 and rawPloNum/10 equals expectedPloNum,
      // then it's the concatenated format
      if (rawPloNum === expectedPloNum * 10) {
        rawPloNum = expectedPloNum;
      }
      // Also handle cases where rawPloNum doesn't match expected but is close
      // (e.g., the "0" was interpreted as part of the PLO number)
      if (rawPloNum !== expectedPloNum && rawPloNum > 9) {
        // Try stripping trailing zero: "10" → "1", "20" → "2", "40" → "4"
        const stripped = Math.floor(rawPloNum / 10);
        if (stripped === expectedPloNum) {
          rawPloNum = expectedPloNum;
        }
      }

      pis.push({
        plo_code: ploCode,
        pi_code: `PI.${rawPloNum}.${rawPiNum}`,
        description: desc,
      });
    }
  }

  return pis;
}

/**
 * Extract assessment plan entries from the assessment plan table.
 */
function extractAssessmentPlan(table) {
  if (!table || table.length < 2) return [];

  const entries = [];
  let currentPLO = '';

  for (let i = 1; i < table.length; i++) {
    const row = table[i];
    if (row.length < 5) continue;

    // PLO (1) | PI (2) | Description (3) | Contributing courses (4) | Sample course (5) |
    // Direct evidence (6) | Assessment tool (7) | Standard (8) | Schedule (9) | Instructor (10) | Unit (11)

    const ploCell = row[0].trim();
    const piCell = row[1].trim();
    const descCell = row[2].trim();
    const contributingCourses = row[3].trim();
    const sampleCourse = row.length > 4 ? row[4].trim() : '';
    const directEvidence = row.length > 5 ? row[5].trim() : '';
    const assessmentTool = row.length > 6 ? row[6].trim() : '';
    const standard = row.length > 7 ? row[7].trim() : '';
    const schedule = row.length > 8 ? row[8].trim() : '';
    const instructor = row.length > 9 ? row[9].trim() : '';
    const unit = row.length > 10 ? row[10].trim() : '';

    // Update current PLO
    if (ploCell && ploCell.match(/PLO\d/i)) {
      const m = ploCell.match(/(PLO\d+)/i);
      if (m) currentPLO = m[1].toUpperCase();
    }

    // Skip empty rows or rows without PI code
    if (!piCell && !sampleCourse && !descCell) continue;

    // Parse PI code: "PI.X.Y", "PIX.Y", etc.
    let piCode = '';
    const piMatch = piCell.match(/PI[\.\s]*(\d+)[\.\s]*(\d+)/i);
    if (piMatch) {
      piCode = `PI.${piMatch[1]}.${piMatch[2]}`;
    }

    // Parse contributing course codes from the concatenated string
    const courseCodesMatch = contributingCourses.match(/[A-Z]{2,}\d+/gi) || [];

    entries.push({
      plo_code: currentPLO,
      pi_code: piCode,
      description: descCell,
      contributing_courses: courseCodesMatch,
      sample_course: sampleCourse,
      direct_evidence: directEvidence,
      assessment_tool: assessmentTool,
      standard: standard,
      schedule: schedule,
      instructor: instructor,
      unit: unit,
    });
  }

  return entries;
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Validation
// ───────────────────────────────────────────────────────────────────────────

function validateParsedData(data) {
  const warnings = [];

  // Errors: critical issues
  if (!data.program || !data.program.code) {
    warnings.push({ severity: 'error', field: 'program.code', message: 'Program code is empty' });
  }
  if (!data.program || !data.program.name) {
    warnings.push({ severity: 'error', field: 'program.name', message: 'Program name is empty' });
  }
  if (!data.objectives || data.objectives.length === 0) {
    warnings.push({ severity: 'error', field: 'objectives', message: 'No POs (program objectives) found' });
  }
  if (!data.plos || data.plos.length === 0) {
    warnings.push({ severity: 'error', field: 'plos', message: 'No PLOs found' });
  }
  if (!data.courses || data.courses.length === 0) {
    warnings.push({ severity: 'error', field: 'courses', message: 'No courses found' });
  }

  // Warnings
  if (data.courses && data.courses.length > 0) {
    const courseCodes = new Set(data.courses.map(c => c.code));

    // Check prerequisites reference valid courses
    for (const course of data.courses) {
      for (const prereq of (course.prerequisite_codes || [])) {
        if (!courseCodes.has(prereq)) {
          warnings.push({
            severity: 'warning',
            field: 'courses.prerequisite',
            message: `Course ${course.code}: prerequisite "${prereq}" not found in course list`,
          });
        }
      }
    }

    // Check Course-PI matrix references valid courses
    if (data.coursePIMatrix) {
      const matrixCodes = new Set(data.coursePIMatrix.map(m => m.course_code));
      for (const code of matrixCodes) {
        if (!courseCodes.has(code)) {
          warnings.push({
            severity: 'warning',
            field: 'coursePIMatrix',
            message: `Course-PI matrix references unknown course: ${code}`,
          });
        }
      }
    }
  }

  // Check total credits
  if (data.program && data.program.total_credits && data.courses) {
    const accumulativeCourses = data.courses.filter(c => c.course_type !== 'non_accumulative');
    const sumCredits = accumulativeCourses.reduce((sum, c) => sum + (c.credits || 0), 0);
    // For elective groups, only count the required number of credits
    // This is a rough check
    if (sumCredits > 0 && Math.abs(sumCredits - data.program.total_credits) > data.program.total_credits * 0.5) {
      warnings.push({
        severity: 'warning',
        field: 'program.total_credits',
        message: `Sum of course credits (${sumCredits}) differs significantly from stated total (${data.program.total_credits})`,
      });
    }
  }

  // Check bloom levels
  if (data.plos) {
    for (const plo of data.plos) {
      if (plo.bloom_level !== null && plo.bloom_level !== undefined) {
        if (plo.bloom_level < 1 || plo.bloom_level > 6) {
          // bloom_level from the document uses scale 0-60, normalize later
          // For values like 30, 50, 40 — these are the "Trình độ năng lực" scores × 10
          if (plo.bloom_level > 6) {
            // These are TĐNL scores (e.g., 30, 50, 40), not Bloom levels
            // Convert: 0-10 → 1, 10-20 → 2, 20-30 → 3, 30-40 → 4, 40-50 → 5, 50-60 → 6
            const score = plo.bloom_level / 10;
            if (score >= 0 && score <= 6) {
              plo.bloom_level = Math.ceil(score);
            } else {
              warnings.push({
                severity: 'warning',
                field: `plos.${plo.code}.bloom_level`,
                message: `Bloom level ${plo.bloom_level} for ${plo.code} is outside expected range 1-6`,
              });
            }
          }
        }
      }
    }
  }

  // Check for empty sections (non-critical)
  if (!data.pis || data.pis.length === 0) {
    warnings.push({ severity: 'warning', field: 'pis', message: 'No PIs extracted' });
  }
  if (!data.knowledgeBlocks || data.knowledgeBlocks.length === 0) {
    warnings.push({ severity: 'warning', field: 'knowledgeBlocks', message: 'No knowledge blocks extracted' });
  }
  if (!data.teachingPlan || data.teachingPlan.length === 0) {
    warnings.push({ severity: 'warning', field: 'teachingPlan', message: 'No teaching plan entries extracted' });
  }
  if (!data.assessmentPlan || data.assessmentPlan.length === 0) {
    warnings.push({ severity: 'warning', field: 'assessmentPlan', message: 'No assessment plan entries extracted' });
  }

  return warnings;
}

// ───────────────────────────────────────────────────────────────────────────
// 5. Main orchestrator
// ───────────────────────────────────────────────────────────────────────────

/**
 * Parse a Word (.docx) file buffer into a complete CTDT structure.
 */
async function parseWordFile(buffer) {
  const { tables, paragraphs } = await readDocx(buffer);
  const roles = identifyTables(tables, paragraphs);

  // Initialize result
  const result = {
    program: {},
    version: {},
    general_objective: '',
    objectives: [],
    plos: [],
    pis: [],
    poploMatrix: [],
    knowledgeBlocks: [],
    courses: [],
    coursePIMatrix: [],
    courseDescriptions: [],
    teachingPlan: [],
    assessmentPlan: [],
    warnings: [],
  };

  // Extract general info
  try {
    if (roles.generalInfo !== undefined) {
      const { program, version } = extractGeneralInfo(tables[roles.generalInfo]);
      result.program = program;
      result.version = version;
    } else {
      result.warnings.push({ severity: 'warning', field: 'generalInfo', message: 'General info table not identified' });
    }
  } catch (e) {
    result.warnings.push({ severity: 'warning', field: 'generalInfo', message: `Failed to parse general info: ${e.message}` });
  }

  // Extract objectives (POs) from paragraphs
  try {
    const { general_objective, objectives } = extractObjectives(paragraphs);
    result.general_objective = general_objective;
    result.objectives = objectives;
  } catch (e) {
    result.warnings.push({ severity: 'warning', field: 'objectives', message: `Failed to parse objectives: ${e.message}` });
  }

  // Extract PLOs
  try {
    if (roles.plo !== undefined) {
      result.plos = extractPLOs(tables[roles.plo]);
    } else {
      result.warnings.push({ severity: 'warning', field: 'plos', message: 'PLO table not identified' });
    }
  } catch (e) {
    result.warnings.push({ severity: 'warning', field: 'plos', message: `Failed to parse PLOs: ${e.message}` });
  }

  // Extract PO-PLO matrix
  try {
    if (roles.poploMatrix !== undefined) {
      result.poploMatrix = extractPOPLOMatrix(tables[roles.poploMatrix]);
    } else {
      result.warnings.push({ severity: 'warning', field: 'poploMatrix', message: 'PO-PLO matrix table not identified' });
    }
  } catch (e) {
    result.warnings.push({ severity: 'warning', field: 'poploMatrix', message: `Failed to parse PO-PLO matrix: ${e.message}` });
  }

  // Extract courses + knowledge blocks from the detailed curriculum table
  // (replaces the old extractKnowledgeBlocks from the summary table)
  try {
    if (roles.curriculum !== undefined) {
      const { courses, knowledgeBlocks } = extractCourses(tables[roles.curriculum]);
      result.courses = courses;
      result.knowledgeBlocks = knowledgeBlocks;
    } else {
      result.warnings.push({ severity: 'warning', field: 'courses', message: 'Curriculum table not identified' });
    }
  } catch (e) {
    result.warnings.push({ severity: 'warning', field: 'courses', message: `Failed to parse courses: ${e.message}` });
  }

  // Extract Course-PI matrix
  try {
    if (roles.coursePIMatrix !== undefined) {
      result.coursePIMatrix = extractCoursePIMatrix(tables[roles.coursePIMatrix]);
    } else {
      result.warnings.push({ severity: 'warning', field: 'coursePIMatrix', message: 'Course-PI matrix table not identified' });
    }
  } catch (e) {
    result.warnings.push({ severity: 'warning', field: 'coursePIMatrix', message: `Failed to parse Course-PI matrix: ${e.message}` });
  }

  // Extract course descriptions
  try {
    if (roles.courseDescriptions !== undefined) {
      result.courseDescriptions = extractCourseDescriptions(tables[roles.courseDescriptions]);
    } else {
      result.warnings.push({ severity: 'warning', field: 'courseDescriptions', message: 'Course descriptions table not identified' });
    }
  } catch (e) {
    result.warnings.push({ severity: 'warning', field: 'courseDescriptions', message: `Failed to parse course descriptions: ${e.message}` });
  }

  // Extract teaching plan
  try {
    result.teachingPlan = extractTeachingPlan(tables, paragraphs);

    // Assign semester numbers to courses from teaching plan
    if (result.teachingPlan.length > 0 && result.courses.length > 0) {
      const semesterMap = {};
      for (const entry of result.teachingPlan) {
        if (!semesterMap[entry.code]) {
          semesterMap[entry.code] = entry.semester;
        }
      }
      for (const course of result.courses) {
        if (semesterMap[course.code]) {
          course.semester = semesterMap[course.code];
        }
      }
    }
  } catch (e) {
    result.warnings.push({ severity: 'warning', field: 'teachingPlan', message: `Failed to parse teaching plan: ${e.message}` });
  }

  // Extract PIs
  try {
    if (roles.piDescriptions !== undefined) {
      result.pis = extractPIs(tables[roles.piDescriptions]);
    } else {
      result.warnings.push({ severity: 'warning', field: 'pis', message: 'PI descriptions table not identified' });
    }
  } catch (e) {
    result.warnings.push({ severity: 'warning', field: 'pis', message: `Failed to parse PIs: ${e.message}` });
  }

  // Extract assessment plan
  try {
    if (roles.assessmentPlan !== undefined) {
      result.assessmentPlan = extractAssessmentPlan(tables[roles.assessmentPlan]);
    } else {
      result.warnings.push({ severity: 'warning', field: 'assessmentPlan', message: 'Assessment plan table not identified' });
    }
  } catch (e) {
    result.warnings.push({ severity: 'warning', field: 'assessmentPlan', message: `Failed to parse assessment plan: ${e.message}` });
  }

  // Run validation
  const validationWarnings = validateParsedData(result);
  result.warnings.push(...validationWarnings);

  return result;
}

// ───────────────────────────────────────────────────────────────────────────
// Exports
// ───────────────────────────────────────────────────────────────────────────

module.exports = {
  parseWordFile,
  readDocx,
  parseTable,
  extractParagraphText,
  extractGeneralInfo,
  extractObjectives,
  extractPLOs,
  extractPOPLOMatrix,
  extractKnowledgeBlocks,
  extractCourses,
  extractCoursePIMatrix,
  extractCourseDescriptions,
  extractTeachingPlan,
  extractPIs,
  extractAssessmentPlan,
  identifyTables,
  validateParsedData,
};
