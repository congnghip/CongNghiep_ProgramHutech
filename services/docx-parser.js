const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true
});

function createId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const result = [];
  for (const item of items || []) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function normalizeForMatch(value) {
  return safeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function normalizeCompact(value) {
  return normalizeForMatch(value).replace(/\s+/g, ' ');
}

function hasAllTokens(value, tokens) {
  const normalized = normalizeCompact(value);
  return tokens.every(token => normalized.includes(token));
}

function extractInteger(value) {
  const text = safeString(value);
  if (!text) return null;
  const match = text.match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

function parseAcademicYear(value) {
  const text = safeString(value);
  if (!text) return '';
  const match = text.match(/\b(20\d{2})\s*[-–]\s*(20\d{2})\b/);
  return match ? `${match[1]}-${match[2]}` : '';
}

function normalizePOCode(value) {
  const match = safeString(value).match(/po\s*\.?\s*(\d+)/i);
  return match ? `PO${parseInt(match[1], 10)}` : '';
}

function normalizePLOCode(value) {
  const match = safeString(value).match(/plo\s*\.?\s*(\d+)/i);
  return match ? `PLO${parseInt(match[1], 10)}` : '';
}

function normalizePICode(value) {
  const text = safeString(value);
  if (!text) return '';
  const match = text.match(/pi\s*\.?\s*(\d+)\s*[\.\-]?\s*(\d+)/i);
  if (match) return `PI${parseInt(match[1], 10)}.${String(parseInt(match[2], 10)).padStart(2, '0')}`;
  const shorthand = text.match(/^(\d+)\s*[\.\-]\s*(\d+)$/);
  if (shorthand) return `PI${parseInt(shorthand[1], 10)}.${String(parseInt(shorthand[2], 10)).padStart(2, '0')}`;
  return '';
}

function extractPOCodes(value) {
  const matches = safeString(value).match(/po\s*\.?\s*\d+/gi) || [];
  return uniqueBy(matches.map(normalizePOCode).filter(Boolean), item => item);
}

function splitLines(value) {
  return safeString(value)
    .replace(/&#10;|&#x0a;|&#x0A;/g, '\n')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
}

function isLikelyEmptyRow(row) {
  return !row || row.every(cell => !safeString(cell));
}

function looksLikePOCode(value) {
  return /^po\s*\.?\s*\d+/i.test(safeString(value));
}

function looksLikePLOCode(value) {
  return /^plo\s*\.?\s*\d+/i.test(safeString(value));
}

function inferBloomLevel(text) {
  const value = extractInteger(text);
  if (value && value >= 1 && value <= 6) return value;
  return 3;
}

function findLikelyNameParagraph(paragraphs) {
  const priorityPatterns = [
    /(tên\s*(ngành|ctdt|chuong trinh|chương trình))/i,
    /(chương trình đào tạo)/i,
    /(^ngành\s+)/i
  ];

  for (const pattern of priorityPatterns) {
    const match = paragraphs.find(line => pattern.test(line));
    if (match) return match;
  }

  return paragraphs.find(line => line && line.length > 8) || '';
}

function normalizeImportData(rawData = {}) {
  const data = rawData && typeof rawData === 'object' ? rawData : {};

  const pos = Array.isArray(data.pos || data.objectives)
    ? (data.pos || data.objectives).map((po, index) => ({
      id: po.id || createId(`po${index + 1}`),
      code: safeString(po.code),
      description: safeString(po.description)
    })).filter(po => po.code || po.description)
    : [];

  const plos = Array.isArray(data.plos)
    ? data.plos.map((plo, index) => ({
      id: plo.id || createId(`plo${index + 1}`),
      code: safeString(plo.code),
      bloom_level: Number.isInteger(parseInt(plo.bloom_level, 10)) ? parseInt(plo.bloom_level, 10) : 3,
      description: safeString(plo.description)
    })).filter(plo => plo.code || plo.description)
    : [];

  const courses = Array.isArray(data.courses)
    ? data.courses.map((course, index) => ({
      id: course.id || createId(`course${index + 1}`),
      course_id: course.course_id || null,
      course_code: safeString(course.course_code || course.code),
      course_name: safeString(course.course_name || course.name),
      credits: Number.isFinite(Number(course.credits)) ? Number(course.credits) : 0,
      semester: Number.isFinite(Number(course.semester)) ? Number(course.semester) : 1,
      course_type: safeString(course.course_type) || 'required',
      dept_name: safeString(course.dept_name),
      dept_code: safeString(course.dept_code)
    })).filter(course => course.course_code || course.course_name)
    : [];

  const pis = Array.isArray(data.pis)
    ? data.pis.map((pi, index) => ({
      id: pi.id || createId(`pi${index + 1}`),
      plo_id: pi.plo_id || null,
      pi_code: safeString(pi.pi_code),
      description: safeString(pi.description),
      course_ids: Array.isArray(pi.course_ids) ? pi.course_ids : []
    })).filter(pi => pi.pi_code || pi.description || pi.plo_id)
    : [];

  const po_plo_map = Array.isArray(data.po_plo_map)
    ? data.po_plo_map.map(map => ({
      po_id: map.po_id || null,
      plo_id: map.plo_id || null
    })).filter(map => map.po_id && map.plo_id)
    : [];

  const course_plo_map = Array.isArray(data.course_plo_map)
    ? data.course_plo_map.map(map => ({
      course_id: map.course_id || null,
      plo_id: map.plo_id || null,
      contribution_level: Number.isFinite(Number(map.contribution_level)) ? Number(map.contribution_level) : 0
    })).filter(map => map.course_id && map.plo_id)
    : [];

  const course_pi_map = Array.isArray(data.course_pi_map)
    ? data.course_pi_map.map(map => ({
      course_id: map.course_id || null,
      pi_id: map.pi_id || null,
      contribution_level: Number.isFinite(Number(map.contribution_level)) ? Number(map.contribution_level) : 0
    })).filter(map => map.course_id && map.pi_id)
    : [];

  const assessments = Array.isArray(data.assessments)
    ? data.assessments.map((assessment, index) => ({
      id: assessment.id || createId(`assessment${index + 1}`),
      plo_id: assessment.plo_id || null,
      pi_id: assessment.pi_id || null,
      sample_course_id: assessment.sample_course_id || null,
      course_code: safeString(assessment.course_code),
      course_name: safeString(assessment.course_name),
      assessment_tool: safeString(assessment.assessment_tool),
      criteria: safeString(assessment.criteria),
      threshold: safeString(assessment.threshold),
      semester: safeString(assessment.semester),
      assessor: safeString(assessment.assessor),
      dept_code: safeString(assessment.dept_code)
    }))
    : [];

  const syllabi = Array.isArray(data.syllabi)
    ? data.syllabi.map((syllabus, index) => ({
      id: syllabus.id || createId(`syllabus${index + 1}`),
      course_id: syllabus.course_id || null,
      course_code: safeString(syllabus.course_code),
      course_name: safeString(syllabus.course_name),
      credits: Number.isFinite(Number(syllabus.credits)) ? Number(syllabus.credits) : 0,
      status: safeString(syllabus.status) || 'draft',
      content: syllabus.content && typeof syllabus.content === 'object' ? syllabus.content : {},
      authors: Array.isArray(syllabus.authors) ? syllabus.authors : []
    }))
    : [];

  const totalCreditsRaw = data.total_credits;
  const totalCredits = totalCreditsRaw === '' || totalCreditsRaw === null || totalCreditsRaw === undefined
    ? ''
    : (Number.isFinite(Number(totalCreditsRaw)) && Number(totalCreditsRaw) > 0 ? Number(totalCreditsRaw) : '');

  return {
    program_name: safeString(data.program_name || data.program?.name),
    program_code: safeString(data.program_code || data.program?.code),
    degree: safeString(data.degree || data.program?.degree) || 'Đại học',
    total_credits: totalCredits,
    academic_year: safeString(data.academic_year),
    version_name: safeString(data.version_name) || 'Phiên bản Import',
    pos,
    plos,
    pis,
    courses,
    po_plo_map,
    course_plo_map,
    course_pi_map,
    assessments,
    syllabi,
    plan_rows: Array.isArray(data.plan_rows) ? data.plan_rows : [],
    import_metadata: data.import_metadata && typeof data.import_metadata === 'object' ? data.import_metadata : {}
  };
}

async function parseDocx(buffer) {
  const zip = new AdmZip(buffer);
  const contentXml = zip.readAsText('word/document.xml');
  const jsonData = xmlParser.parse(contentXml);
  const body = jsonData['w:document']?.['w:body'];
  if (!body) {
    throw new Error('Không tìm thấy nội dung văn bản (w:body) trong file .docx');
  }

  const paragraphs = [
    ...extractParagraphs(body),
    ...extractSupplementParagraphs(zip)
  ];
  const tables = extractTables(body);
  const data = processTables(tables, paragraphs);

  return normalizeImportData(data);
}

function extractSupplementParagraphs(zip) {
  const entries = zip.getEntries()
    .map(entry => entry.entryName)
    .filter(name => /^word\/(header\d+|footer\d+|footnotes|endnotes|comments)\.xml$/i.test(name))
    .sort();

  const paragraphs = [];
  for (const entryName of entries) {
    try {
      const xml = zip.readAsText(entryName);
      const parsed = xmlParser.parse(xml);
      const rootKey = Object.keys(parsed || {}).find(key => key.startsWith('w:'));
      const root = rootKey ? parsed[rootKey] : null;
      if (!root) continue;

      const bodies = [
        root['w:body'],
        root
      ].filter(Boolean);

      for (const part of bodies) {
        paragraphs.push(...extractParagraphs(part));
      }
    } catch (error) {
      continue;
    }
  }
  return paragraphs;
}

function extractParagraphs(body) {
  const paragraphs = body['w:p'] || [];
  const items = Array.isArray(paragraphs) ? paragraphs : [paragraphs];
  return items.map(extractTextFromParagraph).filter(Boolean);
}

function extractTables(body) {
  const tables = [];
  const content = body['w:tbl'] || [];
  const tbls = Array.isArray(content) ? content : [content];

  for (const tbl of tbls) {
    if (!tbl) continue;
    const rows = [];
    const trs = Array.isArray(tbl['w:tr']) ? tbl['w:tr'] : [tbl['w:tr']];

    for (const tr of trs) {
      if (!tr) continue;
      const cells = [];
      const tcs = Array.isArray(tr['w:tc']) ? tr['w:tc'] : [tr['w:tc']];

      for (const tc of tcs) {
        if (!tc) continue;
        const text = extractTextFromCell(tc);
        const gridSpan = tc['w:tcPr']?.['w:gridSpan']?.['@_w:val'] || 1;
        const hasVMerge = tc['w:tcPr']?.['w:vMerge'] !== undefined;
        const vMergeValue = tc['w:tcPr']?.['w:vMerge']?.['@_w:val'];

        cells.push({
          text,
          gridSpan: parseInt(gridSpan, 10),
          vMerge: hasVMerge ? (vMergeValue === undefined || vMergeValue === '' ? 'continue' : vMergeValue) : null
        });
      }
      rows.push(cells);
    }
    tables.push(rows);
  }
  return tables;
}

function extractTextFromParagraph(paragraph) {
  if (!paragraph) return '';
  const runs = Array.isArray(paragraph['w:r']) ? paragraph['w:r'] : [paragraph['w:r']];
  const texts = [];
  for (const run of runs) {
    if (!run) continue;
    const values = Array.isArray(run['w:t']) ? run['w:t'] : [run['w:t']];
    for (const value of values) {
      if (typeof value === 'string') texts.push(value);
      else if (typeof value === 'number') texts.push(String(value));
      else if (value && value['#text']) texts.push(value['#text']);
    }
  }
  return texts.join(' ').replace(/\s+/g, ' ').trim();
}

function extractTextFromCell(tc) {
  const texts = [];
  const ps = Array.isArray(tc['w:p']) ? tc['w:p'] : [tc['w:p']];

  for (const p of ps) {
    const paragraphText = extractTextFromParagraph(p);
    if (paragraphText) texts.push(paragraphText);
  }

  return texts.join('\n').trim();
}

function processTables(tables, paragraphs = []) {
  const flatTables = tables.map(flattenTable);
  let metadata = inferMetadata(paragraphs);
  metadata = mergeMetadata(metadata, extractMetadataFromTables(flatTables));
  const result = {
    ...metadata,
    pos: [],
    plos: [],
    courses: [],
    pis: [],
    po_plo_map: [],
    course_plo_map: [],
    course_pi_map: [],
    assessments: [],
    syllabi: [],
    plan_rows: [],
    import_metadata: {
      paragraph_count: paragraphs.length,
      table_count: tables.length
    }
  };

  let bestPO = { score: -1, items: [] };
  let bestPLO = { score: -1, items: [] };
  let bestCourses = { score: -1, items: [] };
  let detailedPLO = [];
  let matrixPO = [];
  let plannedCourses = [];
  let planRows = [];
  let pis = [];
  let assessments = [];
  const poPloRelations = [];
  let coursePloRefs = [];
  let coursePiRefs = [];

  for (const flatTable of flatTables) {
    const ploDetails = extractDetailedPLOTable(flatTable);
    if (ploDetails.plos.length) {
      detailedPLO = ploDetails.plos;
      poPloRelations.push(...ploDetails.poPloRelations);
    }

    const poMatrix = extractPOMatrix(flatTable);
    if (poMatrix.pos.length) {
      matrixPO = poMatrix.pos;
      poPloRelations.push(...poMatrix.poPloRelations);
    }

    const semesterPlan = extractSemesterPlan(flatTable);
    if (semesterPlan.courses.length) {
      plannedCourses = semesterPlan.courses;
      planRows = semesterPlan.plan_rows;
    }

    const piTable = extractPITable(flatTable);
    if (piTable.length) pis = piTable;

    const hpPloTable = extractCoursePLOTable(flatTable);
    if (hpPloTable.coursePloRefs.length || hpPloTable.coursePiRefs.length) {
      coursePloRefs = hpPloTable.coursePloRefs;
      coursePiRefs = hpPloTable.coursePiRefs;
    }

    const assessmentRows = extractAssessments(flatTable);
    if (assessmentRows.length) assessments = assessmentRows;

    if (isLikelyPOTable(flatTable)) {
      const items = extractPO(flatTable);
      const score = scoreObjectiveTable(flatTable, items, 'po');
      if (score > bestPO.score) bestPO = { score, items };
    } else if (isLikelyPLOTable(flatTable)) {
      const items = extractPLO(flatTable);
      const score = scoreObjectiveTable(flatTable, items, 'plo');
      if (score > bestPLO.score) bestPLO = { score, items };
    } else if (isLikelyCourseTable(flatTable)) {
      const items = extractCourses(flatTable);
      const score = scoreCourseTable(flatTable, items);
      if (score > bestCourses.score) bestCourses = { score, items };
    }
  }

  result.pos = uniqueBy([...(matrixPO.length ? matrixPO : []), ...bestPO.items], item => normalizePOCode(item.code));
  result.plos = uniqueBy([...(detailedPLO.length ? detailedPLO : []), ...bestPLO.items], item => normalizePLOCode(item.code));
  result.courses = plannedCourses.length ? plannedCourses : bestCourses.items;
  result.plan_rows = planRows;

  ensureReferencedObjectives(result, poPloRelations);
  result.pis = resolvePILinks(result.plos, pis);
  result.po_plo_map = resolvePoPloMappings(result.pos, result.plos, poPloRelations);
  result.course_plo_map = resolveCoursePloMappings(result.courses, result.plos, coursePloRefs);
  result.course_pi_map = resolveCoursePiMappings(result.courses, result.pis, coursePiRefs);
  result.assessments = resolveAssessmentLinks(result.plos, result.pis, result.courses, assessments);

  if (!result.total_credits && result.courses.length > 0) {
    result.total_credits = result.courses.reduce((sum, course) => sum + (Number(course.credits) || 0), 0);
  }

  return result;
}

function inferMetadata(paragraphs) {
  const metadata = {
    program_name: '',
    program_code: '',
    degree: 'Đại học',
    total_credits: '',
    academic_year: '',
    version_name: 'Phiên bản Import'
  };

  for (const rawLine of paragraphs) {
    const line = safeString(rawLine);
    if (!line) continue;
    const normalized = normalizeCompact(line);

    if (!metadata.academic_year) {
      metadata.academic_year = parseAcademicYear(line);
    }

    if (!metadata.program_code) {
      const codePatterns = [
        /(?:mã|ma)\s*(?:ngành|nganh|ctdt|ctđt|chương trình đào tạo|chuong trinh dao tao|chương trình|chuong trinh)?\s*[:\-]?\s*([A-Z0-9._/-]{2,})/i,
        /(?:code)\s*(?:ngành|program)?\s*[:\-]?\s*([A-Z0-9._/-]{2,})/i
      ];
      for (const pattern of codePatterns) {
        const codeMatch = line.match(pattern);
        if (codeMatch) {
          metadata.program_code = codeMatch[1].trim();
          break;
        }
      }
    }

    if (!metadata.program_name) {
      const explicitNameMatch = line.match(/(?:tên\s*(?:ngành|chương trình|ctdt|ctđt)|ngành đào tạo)\s*[:\-]?\s*(.+)$/i);
      if (explicitNameMatch) {
        metadata.program_name = explicitNameMatch[1].trim();
      } else if (
        hasAllTokens(line, ['chuong trinh', 'dao tao']) ||
        normalized.startsWith('nganh ')
      ) {
        metadata.program_name = line.trim();
      }
    }

    if (metadata.total_credits === '') {
      const creditsMatch = line.match(/(?:tổng\s*(?:số\s*)?tín\s*chỉ|tong\s*(?:so\s*)?tin\s*chi|số\s*tín\s*chỉ|so\s*tin\s*chi)\s*[:\-]?\s*(\d+)/i);
      if (creditsMatch) metadata.total_credits = parseInt(creditsMatch[1], 10);
    }

    if (normalized.includes('thac si')) metadata.degree = 'Thạc sĩ';
    if (normalized.includes('tien si')) metadata.degree = 'Tiến sĩ';
    if (normalized.includes('dai hoc') || normalized.includes('cu nhan')) metadata.degree = 'Đại học';
  }

  if (!metadata.program_name) {
    const fallback = findLikelyNameParagraph(paragraphs);
    if (fallback) metadata.program_name = fallback;
  }

  return metadata;
}

function mergeMetadata(base, patch) {
  return {
    ...base,
    program_name: safeString(patch.program_name) || base.program_name,
    program_code: safeString(patch.program_code) || base.program_code,
    degree: safeString(patch.degree) || base.degree,
    total_credits: patch.total_credits !== '' && patch.total_credits !== undefined && patch.total_credits !== null
      ? patch.total_credits
      : base.total_credits,
    academic_year: safeString(patch.academic_year) || base.academic_year,
    version_name: safeString(patch.version_name) || base.version_name
  };
}

function flattenTable(table) {
  const grid = [];
  for (let r = 0; r < table.length; r++) {
    const row = table[r];
    if (!grid[r]) grid[r] = [];

    let currentCol = 0;
    for (let c = 0; c < row.length; c++) {
      const cell = row[c];

      while (grid[r][currentCol] !== undefined) currentCol++;

      if (cell.vMerge === 'continue' && r > 0) {
        grid[r][currentCol] = grid[r - 1][currentCol];
      } else {
        grid[r][currentCol] = cell.text;
      }

      if (cell.gridSpan > 1) {
        for (let s = 1; s < cell.gridSpan; s++) {
          grid[r][currentCol + s] = grid[r][currentCol];
        }
      }

      currentCol++;
    }
  }
  return grid;
}

function extractMetadataFromTables(tables) {
  const metadata = {
    program_name: '',
    program_code: '',
    degree: '',
    total_credits: '',
    academic_year: ''
  };

  for (const table of tables) {
    for (const row of table) {
      const cells = row.map(safeString).filter(Boolean);
      if (cells.length < 2) continue;
      const label = normalizeCompact(cells[cells.length - 2]);
      const value = safeString(cells[cells.length - 1]);
      if (!value) continue;

      if (!metadata.program_name && (
        hasAllTokens(label, ['ten nganh']) ||
        hasAllTokens(label, ['ten nganh dao tao']) ||
        hasAllTokens(label, ['ten chuong trinh'])
      )) {
        const match = value.match(/tên tiếng việt\s*:\s*(.+)$/i);
        metadata.program_name = safeString(match ? match[1] : value);
      }

      if (!metadata.program_code && (
        hasAllTokens(label, ['ma nganh']) ||
        hasAllTokens(label, ['ma ctdt']) ||
        hasAllTokens(label, ['ma chuong trinh'])
      )) {
        metadata.program_code = value;
      }

      if (!metadata.degree && hasAllTokens(label, ['trinh do dao tao'])) {
        metadata.degree = value;
      }

      if (metadata.total_credits === '' && (
        hasAllTokens(label, ['so tin chi']) ||
        hasAllTokens(label, ['tong so tin chi'])
      )) {
        metadata.total_credits = extractInteger(value) ?? '';
      }

      if (!metadata.academic_year) {
        metadata.academic_year = parseAcademicYear(value);
      }
    }
  }

  return metadata;
}

function isLikelyPOTable(table) {
  const headerRow = table.find(row => !isLikelyEmptyRow(row)) || [];
  const headerText = headerRow.join(' ');
  return (
    (hasAllTokens(headerText, ['muc tieu']) || hasAllTokens(headerText, ['po'])) &&
    (hasAllTokens(headerText, ['mo ta']) || headerRow.length >= 2)
  );
}

function isLikelyPLOTable(table) {
  const headerRow = table.find(row => !isLikelyEmptyRow(row)) || [];
  const headerText = headerRow.join(' ');
  return (
    (hasAllTokens(headerText, ['chuan dau ra']) || hasAllTokens(headerText, ['plo'])) &&
    (hasAllTokens(headerText, ['mo ta']) || headerRow.length >= 2)
  );
}

function findCourseHeader(table) {
  for (let rowIndex = 0; rowIndex < Math.min(table.length, 4); rowIndex++) {
    const row = table[rowIndex] || [];
    const mapping = {};
    row.forEach((cell, idx) => {
      const normalized = normalizeCompact(cell);
      if (mapping.code === undefined && (
        normalized.includes('ma hoc phan') ||
        normalized.includes('ma hp') ||
        normalized.includes('hoc phan') && normalized.includes('ma') ||
        normalized.includes('course code')
      )) mapping.code = idx;

      if (mapping.name === undefined && (
        normalized.includes('ten hoc phan') ||
        normalized.includes('ten mon') ||
        normalized.includes('ten mon hoc') ||
        normalized.includes('course name')
      )) mapping.name = idx;

      if (mapping.credits === undefined && (
        normalized.includes('so tin chi') ||
        normalized === 'tin chi' ||
        normalized.includes('credits')
      )) mapping.credits = idx;

      if (mapping.semester === undefined && (
        normalized.includes('hoc ky') ||
        normalized === 'hk' ||
        normalized.includes('semester')
      )) mapping.semester = idx;
    });

    if (mapping.code !== undefined && mapping.name !== undefined) {
      return { rowIndex, mapping };
    }
  }
  return null;
}

function findSemesterHeader(table) {
  for (let rowIndex = 0; rowIndex < Math.min(table.length, 4); rowIndex++) {
    const row = table[rowIndex] || [];
    const normalizedCells = row.map(normalizeCompact);
    if (
      normalizedCells.some(cell => cell === 'ma hp' || cell === 'ma hoc phan') &&
      normalizedCells.some(cell => cell.includes('ten hoc phan')) &&
      normalizedCells.some(cell => cell.includes('so tin chi'))
    ) {
      return {
        rowIndex,
        mapping: {
          code: normalizedCells.findIndex(cell => cell === 'ma hp' || cell === 'ma hoc phan'),
          name: normalizedCells.findIndex(cell => cell.includes('ten hoc phan')),
          credits: normalizedCells.findIndex(cell => cell.includes('so tin chi'))
        }
      };
    }
  }
  return null;
}

function isLikelyCourseTable(table) {
  return Boolean(findCourseHeader(table) || findSemesterHeader(table));
}

function scoreObjectiveTable(table, items, type) {
  if (!items.length) return -1;
  const headerText = (table[0] || []).join(' ');
  const headerBonus = type === 'po'
    ? (hasAllTokens(headerText, ['muc tieu']) ? 3 : 0)
    : (hasAllTokens(headerText, ['chuan dau ra']) ? 3 : 0);
  const codeBonus = items.reduce((sum, item) => sum + ((type === 'po' ? looksLikePOCode(item.code) : looksLikePLOCode(item.code)) ? 2 : 0), 0);
  return items.length * 10 + headerBonus + codeBonus;
}

function scoreCourseTable(table, items) {
  if (!items.length) return -1;
  const header = findCourseHeader(table);
  if (!header) return -1;
  const headerText = (table[header.rowIndex] || []).join(' ');
  const headerBonus = ['ma hoc phan', 'ten hoc phan', 'tin chi', 'hoc ky']
    .reduce((sum, token) => sum + (normalizeCompact(headerText).includes(token) ? 1 : 0), 0);
  const filledRows = items.reduce((sum, item) => sum + (item.course_code && item.course_name ? 1 : 0), 0);
  return filledRows * 10 + headerBonus;
}

function shouldSkipObjectiveRow(row, type) {
  const first = safeString(row[0]);
  const second = safeString(row[1]);
  if (!first && !second) return true;

  const combined = `${first} ${second}`.trim();
  if (type === 'po') {
    if (hasAllTokens(combined, ['muc tieu']) && hasAllTokens(combined, ['mo ta'])) return true;
    if (!looksLikePOCode(first) && hasAllTokens(first, ['muc tieu'])) return true;
  }
  if (type === 'plo') {
    if (hasAllTokens(combined, ['chuan dau ra']) && hasAllTokens(combined, ['mo ta'])) return true;
    if (!looksLikePLOCode(first) && hasAllTokens(first, ['chuan dau ra'])) return true;
  }
  return false;
}

function extractPO(table) {
  const items = [];
  for (const row of table) {
    if (shouldSkipObjectiveRow(row, 'po')) continue;
    const code = safeString(row[0]);
    const description = safeString(row[1] ?? row.slice(1).join(' '));
    if (!looksLikePOCode(code)) continue;
    items.push({
      id: createId(`po${items.length + 1}`),
      code,
      description
    });
  }
  return items;
}

function extractPLO(table) {
  const items = [];
  for (const row of table) {
    if (shouldSkipObjectiveRow(row, 'plo')) continue;
    const code = safeString(row[0]);
    if (!looksLikePLOCode(code)) continue;
    const description = safeString(row[2] ?? row[1] ?? row.slice(1).join(' '));
    const bloomLevelText = row[1] && row[2] ? row[1] : '';
    items.push({
      id: createId(`plo${items.length + 1}`),
      code,
      bloom_level: inferBloomLevel(bloomLevelText),
      description
    });
  }
  return items;
}

function extractDetailedPLOTable(table) {
  const header = (table[0] || []).map(normalizeCompact);
  if (!header.some(cell => cell.includes('chuan dau ra')) || !header.some(cell => cell.includes('tuong ung'))) {
    return { plos: [], poPloRelations: [] };
  }

  const plos = [];
  const poPloRelations = [];
  for (const row of table.slice(1)) {
    const code = normalizePLOCode(row[0]);
    if (!code) continue;
    const description = safeString(row[1]);
    const bloom_level = inferBloomLevel(row[3]);
    plos.push({
      id: createId(`plo${plos.length + 1}`),
      code,
      description,
      bloom_level
    });
    extractPOCodes(row[2]).forEach(po_code => {
      poPloRelations.push({ po_code, plo_code: code });
    });
  }

  return { plos, poPloRelations };
}

function extractPOMatrix(table) {
  const headerText = (table[0] || []).map(normalizeCompact);
  if (!headerText.some(cell => cell.includes('muc tieu')) || !headerText.some(cell => cell.includes('chuan dau ra'))) {
    return { pos: [], poPloRelations: [] };
  }

  const ploRow = table[1] || [];
  const ploCodes = ploRow.map(normalizePLOCode);
  if (!ploCodes.some(Boolean)) return { pos: [], poPloRelations: [] };

  const pos = [];
  const poPloRelations = [];
  for (const row of table.slice(2)) {
    const code = normalizePOCode(row[0]);
    if (!code) continue;
    pos.push({
      id: createId(`po${pos.length + 1}`),
      code,
      description: safeString(row[1])
    });

    for (let col = 2; col < row.length; col++) {
      const marker = normalizeCompact(row[col]);
      if (!ploCodes[col]) continue;
      if (marker === 'x' || ['1', '2', '3', '4', '5'].includes(marker)) {
        poPloRelations.push({ po_code: code, plo_code: ploCodes[col] });
      }
    }
  }

  return { pos, poPloRelations };
}

function looksLikeSemesterLabel(value) {
  return /^hoc ky\s*\d+$/i.test(normalizeCompact(value));
}

function shouldSkipCoursePlanRow(code, name) {
  const normalizedCode = normalizeCompact(code);
  const normalizedName = normalizeCompact(name);
  if (!code && !name) return true;
  if (looksLikeSemesterLabel(code) || looksLikeSemesterLabel(name)) return true;
  if (normalizedName.includes('tong so tin chi')) return true;
  if (normalizedName.startsWith('nhom ') || normalizedName.includes('kien thuc tu chon')) return true;
  if (normalizedCode === 'stt') return true;
  if (!/[a-z]/i.test(code) || !/\d/.test(code)) return true;
  return false;
}

function extractSemesterPlan(table) {
  const detected = findSemesterHeader(table);
  if (!detected) return { courses: [], plan_rows: [] };

  const { rowIndex, mapping } = detected;
  const courses = [];
  const plan_rows = [];
  let currentSemester = 1;

  for (const row of table.slice(rowIndex + 1)) {
    const semesterLabel = looksLikeSemesterLabel(row[0]) ? safeString(row[0]) : (looksLikeSemesterLabel(row[1]) ? safeString(row[1]) : '');
    if (semesterLabel) {
      currentSemester = extractInteger(semesterLabel) ?? currentSemester;
      plan_rows.push({ type: 'semester', semester: currentSemester, label: semesterLabel });
      continue;
    }

    const course_code = safeString(row[mapping.code]);
    const course_name = safeString(row[mapping.name]);
    if (shouldSkipCoursePlanRow(course_code, course_name)) continue;

    const credits = extractInteger(row[mapping.credits]) ?? 0;
    const dept_name = safeString(row[10] || row[9]);
    const note = safeString(row[11] || row[10]);
    const course_type = normalizeCompact(note).includes('khong tich luy') ? 'non_credit' : 'required';

    courses.push({
      id: createId(`course${courses.length + 1}`),
      course_code,
      course_name,
      credits,
      semester: currentSemester,
      course_type,
      dept_name
    });
    plan_rows.push({
      type: 'course',
      semester: currentSemester,
      course_code,
      course_name,
      credits
    });
  }

  return { courses, plan_rows };
}

function extractPITable(table) {
  const header = (table[0] || []).map(normalizeCompact);
  if (!header.some(cell => cell.includes('chi so do luong')) || !header.some(cell => cell.includes('chuan dau ra'))) {
    return [];
  }

  const items = [];
  for (const row of table.slice(1)) {
    const plo_code = normalizePLOCode(row[0]);
    if (!plo_code) continue;
    const piText = row.slice(2).join('\n') || row[1] || '';
    
    // Split lines conventionally, and also split if PI markers are merged in the same paragraph
    const lines = splitLines(piText.replace(/PI\s*\.?\s*\d+\s*[\.\-]?\s*\d+/gi, match => `\n${match}`));

    lines.forEach(line => {
      const pi_code = normalizePICode(line);
      if (!pi_code) return;
      items.push({
        id: createId(`pi${items.length + 1}`),
        plo_code,
        pi_code,
        description: safeString(line.replace(/pi\s*\.?\s*\d+\s*[\.\-]?\s*\d+\s*/i, ''))
      });
    });
  }
  return items;
}

function extractCoursePLOTable(table) {
  const header = (table[0] || []).map(normalizeCompact);
  
  const hasCourseCode = header.some(cell => cell.includes('ma hoc phan') || cell === 'ma hp' || cell.includes('mhp'));
  const hasCourseName = header.some(cell => cell === 'hoc phan' || cell.includes('ten hoc phan') || cell.includes('ten mon'));
  const hasObjective = header.some(cell => cell.includes('chuan dau ra') || cell.includes('plo') || cell === 'cdr');

  if (!hasCourseCode || !hasCourseName || !hasObjective) {
    return { coursePloRefs: [], coursePiRefs: [] };
  }

  const ploRow = table[1] || [];
  const piRow = table[2] || [];
  const coursePloRefs = [];
  const coursePiRefs = [];

  for (const row of table.slice(3)) {
    const course_code = safeString(row[0]);
    const course_name = safeString(row[1]);
    if (!course_code || !course_name) continue;

    for (let col = 2; col < row.length; col++) {
      const raw = safeString(row[col]);
      if (!raw || raw === '-') continue;
      const contribution_level = extractInteger(raw) ?? 0;
      if (!contribution_level) continue;

      const plo_code = normalizePLOCode(ploRow[col]);
      const pi_code = normalizePICode(piRow[col]);
      if (plo_code) coursePloRefs.push({ course_code, plo_code, contribution_level });
      if (pi_code) coursePiRefs.push({ course_code, pi_code, contribution_level });
    }
  }

  return { coursePloRefs, coursePiRefs };
}

function extractAssessments(table) {
  const header = (table[0] || []).map(normalizeCompact);
  if (!header.some(cell => cell.startsWith('plo')) || !header.some(cell => cell.startsWith('pi'))) {
    return [];
  }

  const items = [];
  let currentPloCode = '';
  for (const row of table.slice(1)) {
    const plo_code = normalizePLOCode(row[0]);
    if (plo_code) currentPloCode = plo_code;
    const pi_code = normalizePICode(row[1]);
    if (!pi_code) continue;

    items.push({
      id: createId(`assessment${items.length + 1}`),
      plo_code: currentPloCode,
      pi_code,
      course_codes: splitLines(row[3]),
      course_code: safeString(row[4]),
      sample_course_code: safeString(row[4]),
      assessment_tool: safeString(row[6]),
      criteria: safeString(row[5]),
      threshold: safeString(row[7]),
      semester: safeString(row[8]),
      assessor: safeString(row[9]),
      dept_code: safeString(row[10])
    });
  }

  return items;
}

function ensureReferencedObjectives(result, relations) {
  const poByCode = new Map(result.pos.map(item => [normalizePOCode(item.code), item]));
  const ploByCode = new Map(result.plos.map(item => [normalizePLOCode(item.code), item]));

  relations.forEach(({ po_code, plo_code }) => {
    const normalizedPO = normalizePOCode(po_code);
    const normalizedPLO = normalizePLOCode(plo_code);

    if (normalizedPO && !poByCode.has(normalizedPO)) {
      const po = { id: createId(`po${result.pos.length + 1}`), code: normalizedPO, description: '' };
      result.pos.push(po);
      poByCode.set(normalizedPO, po);
    }
    if (normalizedPLO && !ploByCode.has(normalizedPLO)) {
      const plo = { id: createId(`plo${result.plos.length + 1}`), code: normalizedPLO, description: '', bloom_level: 3 };
      result.plos.push(plo);
      ploByCode.set(normalizedPLO, plo);
    }
  });
}

function resolvePoPloMappings(pos, plos, relations) {
  const poByCode = new Map(pos.map(item => [normalizePOCode(item.code), item.id]));
  const ploByCode = new Map(plos.map(item => [normalizePLOCode(item.code), item.id]));
  return uniqueBy(relations.map(({ po_code, plo_code }) => ({
    po_id: poByCode.get(normalizePOCode(po_code)) || null,
    plo_id: ploByCode.get(normalizePLOCode(plo_code)) || null
  })).filter(item => item.po_id && item.plo_id), item => `${item.po_id}:${item.plo_id}`);
}

function resolvePILinks(plos, pis) {
  const ploByCode = new Map(plos.map(item => [normalizePLOCode(item.code), item.id]));
  return pis.map(item => ({
    ...item,
    plo_id: ploByCode.get(normalizePLOCode(item.plo_code)) || item.plo_id || null
  }));
}

function resolveCoursePloMappings(courses, plos, refs) {
  const courseByCode = new Map(courses.map(item => [safeString(item.course_code), item.id]));
  const ploByCode = new Map(plos.map(item => [normalizePLOCode(item.code), item.id]));
  return uniqueBy(refs.map(ref => ({
    course_id: courseByCode.get(safeString(ref.course_code)) || null,
    plo_id: ploByCode.get(normalizePLOCode(ref.plo_code)) || null,
    contribution_level: ref.contribution_level || 0
  })).filter(item => item.course_id && item.plo_id), item => `${item.course_id}:${item.plo_id}`);
}

function resolveCoursePiMappings(courses, pis, refs) {
  const courseByCode = new Map(courses.map(item => [safeString(item.course_code), item.id]));
  const piByCode = new Map(pis.map(item => [normalizePICode(item.pi_code), item.id]));
  return uniqueBy(refs.map(ref => ({
    course_id: courseByCode.get(safeString(ref.course_code)) || null,
    pi_id: piByCode.get(normalizePICode(ref.pi_code)) || null,
    contribution_level: ref.contribution_level || 0
  })).filter(item => item.course_id && item.pi_id), item => `${item.course_id}:${item.pi_id}`);
}

function resolveAssessmentLinks(plos, pis, courses, assessments) {
  const ploByCode = new Map(plos.map(item => [normalizePLOCode(item.code), item.id]));
  const piByCode = new Map(pis.map(item => [normalizePICode(item.pi_code), item.id]));
  const courseByCode = new Map(courses.map(item => [safeString(item.course_code), item.id]));

  return assessments.map(item => ({
    ...item,
    plo_id: ploByCode.get(normalizePLOCode(item.plo_code)) || null,
    pi_id: piByCode.get(normalizePICode(item.pi_code)) || null,
    sample_course_id: courseByCode.get(safeString(item.sample_course_code || item.course_code)) || null
  }));
}

function extractCourses(table) {
  const detected = findCourseHeader(table) || findSemesterHeader(table);
  if (!detected) return [];

  const { rowIndex, mapping } = detected;
  const items = [];
  for (const row of table.slice(rowIndex + 1)) {
    if (isLikelyEmptyRow(row)) continue;
    const course_code = safeString(row[mapping.code]);
    const course_name = safeString(row[mapping.name]);
    const credits = mapping.credits !== undefined ? (extractInteger(row[mapping.credits]) ?? 0) : 0;
    const semester = mapping.semester !== undefined ? (extractInteger(row[mapping.semester]) ?? 1) : 1;
    if (!course_code || !course_name) continue;
    if (normalizeCompact(course_code).includes('ma hoc phan') || normalizeCompact(course_name).includes('ten hoc phan')) continue;
    if (shouldSkipCoursePlanRow(course_code, course_name)) continue;
    items.push({
      id: createId(`course${items.length + 1}`),
      course_code,
      course_name,
      credits,
      semester,
      course_type: 'required'
    });
  }
  return items;
}

module.exports = {
  normalizeImportData,
  parseDocx
};
