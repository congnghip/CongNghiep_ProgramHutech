const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const { execFile } = require('child_process');
const { PDFParse } = require('pdf-parse');

const execFileAsync = promisify(execFile);

const DEFAULT_PROVIDER = 'groq';
const DEFAULT_ENGINE = DEFAULT_PROVIDER;
const DEFAULT_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const MAX_PDF_SIZE_BYTES = 15 * 1024 * 1024;
const PROMPT_VERSION = 'pdf-syllabus-import-v1';
const MOCK_PROMPT_VERSION = 'pdf-syllabus-import-mock-v1';
const HYBRID_PROMPT_VERSION = 'pdf-syllabus-import-hybrid-v2';

function safeString(value, fallback = '') {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value === null || value === undefined) return fallback;
  const trimmed = String(value).trim();
  return trimmed || fallback;
}

function safeNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeCodeList(value) {
  return safeArray(value)
    .map(item => safeString(item))
    .filter(Boolean);
}

function normalizeLines(value) {
  if (Array.isArray(value)) {
    return value.map(item => safeString(item)).filter(Boolean).join('\n');
  }
  return safeString(value);
}

function normalizePloMappings(value) {
  if (Array.isArray(value)) {
    return value.map(item => safeString(item)).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\n;]/)
      .map(item => safeString(item))
      .filter(Boolean);
  }
  return [];
}

function normalizeImportEngine(value, fallback = DEFAULT_ENGINE) {
  const normalized = safeString(value, fallback).toLowerCase();
  if (normalized === 'ai') return DEFAULT_ENGINE;
  if (normalized === 'mock') return 'mock';
  if (normalized === 'heuristic') return 'mock';
  return normalized || fallback;
}

function isMockEngine(engine) {
  return normalizeImportEngine(engine) === 'mock';
}

function buildImportMetadata(raw = {}) {
  const metadata = raw && typeof raw === 'object' ? raw : {};
  const diagnostics = metadata.diagnostics && typeof metadata.diagnostics === 'object'
    ? metadata.diagnostics
    : {};
  const legacyMode = safeString(metadata.mode).toLowerCase();
  const engine = normalizeImportEngine(
    metadata.engine || metadata.processing_engine || legacyMode || metadata.provider
  );
  const provider = safeString(
    metadata.provider,
    isMockEngine(engine) ? 'heuristic' : DEFAULT_PROVIDER
  ).toLowerCase();
  const model = safeString(
    metadata.model || metadata.ai_model,
    isMockEngine(engine) ? 'mock-local' : DEFAULT_MODEL
  );
  const extractionMethodDefault = isMockEngine(engine) ? 'pdftotext+mock-smart' : `pdftotext+${provider || DEFAULT_PROVIDER}`;

  return {
    source_file: safeString(metadata.source_file),
    extraction_method: safeString(metadata.extraction_method, extractionMethodDefault),
    engine,
    provider,
    model,
    ai_model: model,
    prompt_version: safeString(metadata.prompt_version, isMockEngine(engine) ? MOCK_PROMPT_VERSION : PROMPT_VERSION),
    inferred_fields: safeArray(metadata.inferred_fields).map(item => safeString(item)).filter(Boolean),
    fallback_used: Boolean(metadata.fallback_used || isMockEngine(engine)),
    diagnostics,
    mode: safeString(metadata.mode, isMockEngine(engine) ? 'mock' : 'ai')
  };
}

function normalizeCanonicalPayload(raw = {}) {
  const courseIdentity = raw.course_identity && typeof raw.course_identity === 'object'
    ? raw.course_identity
    : {};
  const general = raw.general && typeof raw.general === 'object'
    ? raw.general
    : {};
  const resources = raw.resources && typeof raw.resources === 'object'
    ? raw.resources
    : {};
  const requirements = general.requirements && typeof general.requirements === 'object'
    ? general.requirements
    : {};
  const target = raw.target && typeof raw.target === 'object'
    ? raw.target
    : {};
  const confidence = raw.confidence && typeof raw.confidence === 'object'
    ? raw.confidence
    : {};
  const importMetadata = buildImportMetadata(raw.import_metadata);

  const clos = safeArray(raw.clos).map((clo, index) => ({
    code: safeString(clo?.code, `CLO${index + 1}`),
    description: safeString(clo?.description),
    bloom_level: safeString(clo?.bloom_level, 'understand'),
    plo_mapping: normalizePloMappings(clo?.plo_mapping),
    confidence: safeString(clo?.confidence, 'medium')
  })).filter(item => item.code || item.description);

  const schedule = safeArray(raw.schedule).map((week, index) => ({
    week: Math.max(1, Math.round(safeNumber(week?.week, index + 1))),
    topic: safeString(week?.topic),
    content: safeString(week?.content || week?.activities),
    theory_hours: safeNumber(week?.theory_hours || week?.hours?.theory),
    practice_hours: safeNumber(week?.practice_hours || week?.hours?.practice),
    teaching_method: safeString(week?.teaching_method || week?.activities),
    materials: safeString(week?.materials || week?.assignments),
    clos: safeString(week?.clos || normalizeCodeList(week?.clo_mapping).join(', '))
  }));

  const assessments = safeArray(raw.assessments).map(item => ({
    component: safeString(item?.component || item?.type),
    weight: Math.max(0, safeNumber(item?.weight)),
    method: safeString(item?.method || item?.description),
    clos: safeString(item?.clos || normalizeCodeList(item?.clo_mapping).join(', '))
  }));

  const warnings = safeArray(raw.warnings).map(item => safeString(item)).filter(Boolean);
  const inferredFields = safeArray(importMetadata.inferred_fields).map(item => safeString(item)).filter(Boolean);

  return {
    course_identity: {
      course_code: safeString(courseIdentity.course_code),
      course_name_vi: safeString(courseIdentity.course_name_vi || courseIdentity.course_name),
      course_name_en: safeString(courseIdentity.course_name_en),
      credits: Math.max(0, safeNumber(courseIdentity.credits)),
      language_instruction: safeString(courseIdentity.language_instruction, 'vi')
    },
    general: {
      summary: safeString(general.summary || general.course_description),
      objectives: safeString(general.objectives || general.course_objectives),
      prerequisites: safeString(general.prerequisites),
      methods: safeString(general.methods || general.learning_methods),
      requirements: {
        software: normalizeCodeList(requirements.software),
        hardware: normalizeCodeList(requirements.hardware),
        lab_equipment: normalizeCodeList(requirements.lab_equipment),
        classroom_setup: safeString(requirements.classroom_setup)
      }
    },
    clos,
    schedule,
    assessments,
    resources: {
      textbooks: normalizeLines(resources.textbooks),
      references: normalizeLines(resources.references),
      tools: normalizeLines(resources.tools || requirements.software)
    },
    warnings,
    confidence: {
      overall: safeString(confidence.overall, 'medium'),
      fields: confidence.fields && typeof confidence.fields === 'object' ? confidence.fields : {}
    },
    import_metadata: {
      ...importMetadata,
      inferred_fields: inferredFields
    },
    target: {
      course_id: target.course_id ? parseInt(target.course_id, 10) : null,
      syllabus_id: target.syllabus_id ? parseInt(target.syllabus_id, 10) : null
    }
  };
}

function normalizeForMatch(value = '') {
  return safeString(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function buildCanonicalPayloadFromAi(aiPayload = {}) {
  const payload = {
    course_identity: {
      course_code: aiPayload.course_code,
      course_name_vi: aiPayload.course_name || aiPayload.course_name_vi,
      course_name_en: aiPayload.course_name_en,
      credits: aiPayload.credits,
      language_instruction: aiPayload.language_instruction
    },
    general: {
      summary: aiPayload.course_description,
      objectives: aiPayload.course_objectives,
      prerequisites: aiPayload.prerequisites,
      methods: aiPayload.learning_methods,
      requirements: aiPayload.course_requirements || {}
    },
    clos: safeArray(aiPayload.clos).map(item => ({
      code: item?.code,
      description: item?.description,
      bloom_level: item?.bloom_level,
      plo_mapping: item?.plo_mapping,
      confidence: item?.confidence || 'medium'
    })),
    schedule: safeArray(aiPayload.course_outline).map(item => ({
      week: item?.week,
      topic: item?.topic,
      content: item?.content,
      theory_hours: item?.hours?.theory,
      practice_hours: item?.hours?.practice,
      teaching_method: item?.teaching_method,
      materials: item?.materials || item?.assignments,
      clos: normalizeCodeList(item?.clo_mapping).join(', ')
    })),
    assessments: safeArray(aiPayload.assessment_methods).map(item => ({
      component: item?.type,
      weight: item?.weight,
      method: item?.description,
      clos: normalizeCodeList(item?.clo_mapping).join(', ')
    })),
    resources: {
      textbooks: safeArray(aiPayload.textbooks).map(item => {
        const title = safeString(item?.title);
        const authors = normalizeCodeList(item?.authors).join(', ');
        const publisher = safeString(item?.publisher);
        return [title, authors, publisher].filter(Boolean).join(' - ');
      }),
      references: safeArray(aiPayload.references).map(item => {
        const title = safeString(item?.title);
        const authors = normalizeCodeList(item?.authors).join(', ');
        const publisher = safeString(item?.publisher);
        return [title, authors, publisher].filter(Boolean).join(' - ');
      }),
      tools: safeArray(aiPayload.course_requirements?.software)
    },
    warnings: safeArray(aiPayload.warnings),
    confidence: aiPayload.confidence || {},
    import_metadata: {
      source_file: aiPayload.metadata?.source_file || aiPayload.source_file,
      extraction_method: aiPayload.metadata?.extraction_method || `pdftotext+${DEFAULT_PROVIDER}`,
      engine: aiPayload.metadata?.engine || DEFAULT_ENGINE,
      provider: aiPayload.metadata?.provider || DEFAULT_PROVIDER,
      model: aiPayload.metadata?.model || DEFAULT_MODEL,
      ai_model: aiPayload.metadata?.model || DEFAULT_MODEL,
      prompt_version: aiPayload.metadata?.prompt_version || PROMPT_VERSION,
      inferred_fields: aiPayload.metadata?.inferred_fields || [],
      fallback_used: Boolean(aiPayload.metadata?.fallback_used),
      diagnostics: aiPayload.metadata?.diagnostics || {}
    },
    target: aiPayload.target || {}
  };

  return normalizeCanonicalPayload(payload);
}

function autoMatchCourse(payload, versionCourses = [], existingSyllabi = []) {
  const code = safeString(payload.course_identity?.course_code);
  const nameVi = safeString(payload.course_identity?.course_name_vi);
  const normalizedName = normalizeForMatch(nameVi);
  let matched = null;

  if (code) {
    matched = versionCourses.find(course => safeString(course.course_code).toLowerCase() === code.toLowerCase());
  }

  if (!matched && normalizedName) {
    matched = versionCourses.find(course => normalizeForMatch(course.course_name) === normalizedName);
  }

  if (!matched) return payload;

  const existing = existingSyllabi.find(item => Number(item.course_id) === Number(matched.course_id || matched.id));

  return normalizeCanonicalPayload({
    ...payload,
    target: {
      course_id: matched.course_id || matched.id,
      syllabus_id: existing?.id || null
    }
  });
}

function extractFirstMatch(pattern, text) {
  const match = text.match(pattern);
  return match ? safeString(match[1]) : '';
}

function normalizeTextForParsing(text) {
  return safeString(text)
    .replace(/\f/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .split('\n')
    .filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      return !(
        /^-+\s*\d+\s+of\s+\d+\s*-+$/i.test(trimmed) ||
        /^BM\d+\/[A-Z0-9/]+$/i.test(trimmed) ||
        /^TRƯỜNG ĐẠI HỌC/i.test(trimmed) ||
        /^KHOA\s+/i.test(trimmed) ||
        /^TRUNG TÂM\s+/i.test(trimmed) ||
        /^Bản chính thức$/i.test(trimmed)
      );
    })
    .join('\n');
}

function normalizeInlineSpaces(text) {
  return safeString(text).replace(/[ \t]+/g, ' ').trim();
}

function mergeUniqueLines(...values) {
  const seen = new Set();
  const lines = [];
  values.forEach(value => {
    normalizeLines(value)
      .split('\n')
      .map(item => normalizeInlineSpaces(item))
      .filter(Boolean)
      .forEach(item => {
        const key = normalizeForMatch(item);
        if (!key || seen.has(key)) return;
        seen.add(key);
        lines.push(item);
      });
  });
  return lines.join('\n');
}

function splitCleanLines(text) {
  return normalizeTextForParsing(text)
    .split('\n')
    .map(line => line.replace(/\s+$/g, ''))
    .filter(line => safeString(line));
}

function cleanMergedText(text) {
  return normalizeInlineSpaces(
    safeString(text)
      .replace(/\bBM\d+\/[A-Z0-9/]+\b/gi, ' ')
      .replace(/\s*PI\d+(?:\.\d+)*\s*/gi, ' ')
      .replace(/\s*PLO\d+\s*/gi, match => ` ${match.trim()} `)
      .replace(/\s+/g, ' ')
  );
}

function findSectionPositions(text, headings) {
  return headings
    .map(heading => {
      const match = text.match(heading.pattern);
      if (!match || typeof match.index !== 'number') return null;
      return {
        key: heading.key,
        index: match.index,
        match: match[0]
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
}

function extractSections(text) {
  const headings = [
    { key: 'clo', pattern: /(?:^|\n)\s*(?:10\.\s*)?Chuẩn đầu ra của học phần[\s\S]{0,40}?(?:\(CLO\)|CLO)/i },
    { key: 'summary', pattern: /(?:^|\n)\s*(?:11\.\s*)?Mô tả tóm tắt nội dung học phần/i },
    { key: 'methods', pattern: /(?:^|\n)\s*(?:12\.\s*)?Phương pháp[\s,\n]*hình thức tổ[\s,\n]*chức dạy học/i },
    { key: 'outline', pattern: /(?:^|\n)\s*(?:13\.\s*)?Nội dung chi tiết học phần/i },
    { key: 'assessment', pattern: /(?:^|\n)\s*(?:14\.\s*)?Phương pháp[\s,\n]*kiểm[\s,\n]*tra\/đánh giá/i },
    { key: 'resources', pattern: /(?:^|\n)\s*(?:15\.\s*)?Tài liệu phục[\s,\n]*vụ học phần/i },
    { key: 'self_study', pattern: /(?:^|\n)\s*(?:16\.\s*)?Hướng dẫn[\s,\n]*sinh viên tự học/i },
    { key: 'requirements', pattern: /(?:^|\n)\s*(?:17\.\s*)?Các yêu cầu của HP/i }
  ];

  const normalized = normalizeTextForParsing(text);
  const positions = findSectionPositions(normalized, headings);
  const sections = {
    intro: positions.length ? normalized.slice(0, positions[0].index) : normalized
  };

  positions.forEach((position, index) => {
    const nextIndex = positions[index + 1]?.index ?? normalized.length;
    sections[position.key] = normalized.slice(position.index, nextIndex).trim();
  });

  return sections;
}

function extractLabeledValue(text, labelPattern, fallback = '') {
  const normalized = normalizeTextForParsing(text);
  const lineValue = normalized.match(new RegExp(`${labelPattern.source}\\s*:?\\s*([^\\n]+)`, labelPattern.flags));
  if (lineValue) {
    return normalizeInlineSpaces(lineValue[1]);
  }

  const blockValue = normalized.match(new RegExp(`${labelPattern.source}\\s*[\\n:]+\\s*([^\\n]+)`, labelPattern.flags));
  if (blockValue) {
    return normalizeInlineSpaces(blockValue[1]);
  }

  return fallback;
}

function inferBloomLevel(description = '') {
  const normalized = normalizeForMatch(description);
  const rules = [
    { level: 'create', patterns: ['thiet ke', 'phat trien', 'xay dung', 'sang tao'] },
    { level: 'evaluate', patterns: ['danh gia', 'phan bien', 'nhan xet'] },
    { level: 'analyze', patterns: ['phan tich', 'giai thich co so', 'so sanh'] },
    { level: 'apply', patterns: ['ap dung', 'su dung', 'thuc hanh', 'van dung'] },
    { level: 'understand', patterns: ['giai thich', 'trinh bay', 'mo ta', 'hieu'] },
    { level: 'remember', patterns: ['nhan biet', 'liet ke', 'neu'] }
  ];

  for (const rule of rules) {
    if (rule.patterns.some(pattern => normalized.includes(pattern))) {
      return rule.level;
    }
  }
  return 'understand';
}

function extractCourseIdentity(intro) {
  const normalized = normalizeTextForParsing(intro);
  const codeBlock = extractBlockBetween(normalized, /(?:^|\n)\s*2\.\s*Mã học/i, /(?:^|\n)\s*3\.\s*Thuộc/i);
  const creditsBlock = extractBlockBetween(normalized, /(?:^|\n)\s*5\.\s*Số tín chỉ/i, /(?:^|\n)\s*6\.\s*Học phần/i);
  const prerequisitesBlock = extractBlockBetween(
    normalized,
    /(?:^|\n)\s*(?:6\.\s*Học phần học trước|Học phần học trước(?:\/\s*song hành)?)/i,
    /(?:^|\n)\s*(?:7\.\s*Mục tiêu|Mục tiêu của học phần|Đơn vị quản)/i
  );
  const courseCode =
    extractFirstMatch(/\b([A-Z]{2,}\d{2,})\b/, codeBlock) ||
    extractFirstMatch(/(?:Mã học\s*phần|2\.\s*Mã học[\s\S]{0,20}?phần)\s*:?\s*([A-Z]{2,}\d{2,})\b/i, normalized) ||
    extractFirstMatch(/\b([A-Z]{2,}\d{2,})\b/, normalized);
  const courseNameVi = extractLabeledValue(normalized, /Tên tiếng Việt/i);
  const courseNameEn = extractLabeledValue(normalized, /Tên tiếng Anh/i);
  const creditsText =
    extractFirstMatch(/(\d+)\s*\(\s*\d+\s*,\s*\d+\s*\)\s*TC/i, creditsBlock) ||
    extractFirstMatch(/Số tín chỉ\s*:?\s*(\d+)(?:\s*\(|\s*TC|\b)/i, normalized) ||
    extractFirstMatch(/(\d+)\s*\(\s*\d+\s*,\s*\d+\s*\)\s*TC/i, normalized);
  const prerequisites =
    cleanMergedText(prerequisitesBlock.replace(/^(?:6\.\s*)?Học phần học trước(?:\/\s*song hành)?/i, '')) ||
    extractFirstMatch(/Học phần học\s*trước(?:\/\s*song\s*hành)?\s*:?\s*([\s\S]{0,200}?)(?=\n\s*(?:Mục tiêu|Đơn vị quản|Bảng trích ngang|Chuẩn đầu ra))/i, normalized) ||
    extractLabeledValue(normalized, /Học phần học trước(?:\/\s*song hành)?/i) ||
    extractLabeledValue(normalized, /Học phần học trước\/ song hành/i);
  const languageInstruction =
    /tên tiếng anh/i.test(normalized) ? 'vi' : 'vi';

  return {
    course_identity: {
      course_code: courseCode,
      course_name_vi: courseNameVi,
      course_name_en: courseNameEn,
      credits: safeNumber(creditsText, 0),
      language_instruction: languageInstruction
    },
    prerequisites
  };
}

function parseClos(sectionText = '') {
  const lines = splitCleanLines(sectionText);
  const clos = [];
  let current = null;

  const flushCurrent = () => {
    if (!current) return;
    const merged = cleanMergedText(current.parts.join(' '));
    const ploMapping = [...new Set((merged.match(/PLO\d+/gi) || []).map(item => item.toUpperCase()))];
    const description = normalizeInlineSpaces(
      merged
        .replace(/\bPLO\d+\b/gi, ' ')
        .replace(/\bPI\d+(?:\.\d+)*\b/gi, ' ')
    );

    clos.push({
      code: current.code,
      description,
      bloom_level: inferBloomLevel(description),
      plo_mapping: ploMapping,
      confidence: description.length >= 40 ? 'high' : 'medium'
    });
    current = null;
  };

  lines.forEach(line => {
    const normalizedLine = line.trim();
    const startMatch = normalizedLine.match(/^-?\s*CLO\s*([0-9]+)\s*[:\-]?\s*(.*)$/i);
    if (startMatch) {
      flushCurrent();
      current = {
        code: `CLO${startMatch[1]}`,
        parts: [startMatch[2]]
      };
      return;
    }

    if (!current) return;
    if (/^(?:11\.|Mô tả tóm tắt nội dung học phần)/i.test(normalizedLine)) {
      flushCurrent();
      return;
    }

    current.parts.push(normalizedLine);
  });

  flushCurrent();

  const seenCodes = new Set();
  return clos
    .map(item => ({
      ...item,
      description: item.description.replace(/\s+/g, ' ').trim()
    }))
    .filter(item => {
      if (!item.code || !item.description || seenCodes.has(item.code)) return false;
      seenCodes.add(item.code);
      return true;
    });
}

function parseClosFromInlineText(text = '') {
  const normalized = normalizeTextForParsing(text);
  const matches = [...normalized.matchAll(/\b(CLO\s*[0-9]+)\b\s*[:\-]?\s*([\s\S]{10,220}?)(?=(?:\bCLO\s*[0-9]+\b|$))/gi)];
  const seen = new Set();
  return matches.map(match => {
    const code = safeString(match[1]).replace(/\s+/g, '').toUpperCase();
    const merged = cleanMergedText(match[2]);
    const ploMapping = [...new Set((merged.match(/PLO\d+/gi) || []).map(item => item.toUpperCase()))];
    return {
      code,
      description: normalizeInlineSpaces(merged.replace(/\bPLO\d+\b/gi, ' ')),
      bloom_level: inferBloomLevel(merged),
      plo_mapping: ploMapping,
      confidence: merged.length >= 40 ? 'medium' : 'low'
    };
  }).filter(item => {
    if (!item.code || !item.description || seen.has(item.code)) return false;
    seen.add(item.code);
    return true;
  });
}

function parseHoursFromHeader(line = '') {
  const compact = line.replace(/\s+/g, ' ').trim();
  const matches = [...compact.matchAll(/\b(\d{1,2})\b/g)].map(item => Number(item[1]));
  if (!matches.length) {
    return { theory: 0, practice: 0 };
  }
  if (matches.length >= 2) {
    const tail = matches.slice(-2);
    return { theory: tail[0], practice: tail[1] };
  }
  return { theory: matches[0], practice: 0 };
}

function parseSchedule(sectionText = '') {
  const normalized = normalizeTextForParsing(sectionText);
  const matches = [...normalized.matchAll(/(?:^|\n)\s*B[ÀA]I\s*([0-9]+)\b([\s\S]*?)(?=(?:\n\s*B[ÀA]I\s*[0-9]+\b|\n\s*TỔNG CỘNG|\n\s*14\.|\n\s*Phương pháp kiểm|\s*$))/gi)];

  return matches.map(match => {
    const week = safeNumber(match[1], 0);
    const block = match[2].trim();
    const lines = splitCleanLines(block);
    const headerLine = lines[0] || '';
    const contentLines = [];
    const methodLines = [];
    const clos = new Set();

    lines.forEach(line => {
      const cleanLine = normalizeInlineSpaces(line);
      (cleanLine.match(/CLO\d+/gi) || []).forEach(code => clos.add(code.toUpperCase()));
      if (/^(?:\d+\.\d+\.?|[-•])/.test(cleanLine)) {
        contentLines.push(cleanLine.replace(/^\d+\.\d+\.?\s*/, '').replace(/^[-•]\s*/, ''));
      } else if (/^(?:GV|SV)\s*:|giảng dạy|thảo luận|thị phạm|quan sát|bài tập|thi đấu|tự nghiên cứu/i.test(cleanLine)) {
        methodLines.push(cleanLine);
      }
    });

    const topicFragments = lines
      .slice(0, 3)
      .map(line => normalizeInlineSpaces(line))
      .filter(line => line && !/^(?:\d+\.\d+\.?|[-•]|GV:|SV:)/.test(line));
    const topic = normalizeInlineSpaces(
      topicFragments
        .join(' ')
        .replace(/\b\d+\b(?:\s+\d+\b)?$/, '')
    );

    const activities = normalizeInlineSpaces(contentLines.join('; ') || methodLines.join(' '));
    return {
      week,
      topic,
      activities,
      clos: [...clos].join(', '),
      hours: parseHoursFromHeader(headerLine),
      teaching_method: normalizeInlineSpaces(methodLines.join(' '))
    };
  }).filter(item => item.week > 0 && item.topic);
}

function parseScheduleFallback(sectionText = '') {
  const normalized = normalizeTextForParsing(sectionText);
  const blocks = [...normalized.matchAll(/(?:^|\n)\s*(?:TU[ẦA]N|B[ÀA]I)\s*([0-9]+)\s*[:.\-]?\s*([\s\S]*?)(?=(?:\n\s*(?:TU[ẦA]N|B[ÀA]I)\s*[0-9]+|\n\s*T[ỔO]NG C[ỘO]NG|\s*$))/gi)];
  return blocks.map(match => {
    const week = safeNumber(match[1], 0);
    const block = cleanMergedText(match[2]);
    const clos = [...new Set((block.match(/CLO\d+/gi) || []).map(code => code.toUpperCase()))];
    const topic = normalizeInlineSpaces(block.split(/(?:GV:|SV:|CLO\d+)/i)[0]);
    return {
      week,
      topic: topic.slice(0, 180),
      activities: block,
      clos: clos.join(', ')
    };
  }).filter(item => item.week > 0 && item.topic);
}

function detectAssessmentComponent(text = '') {
  const normalized = normalizeForMatch(text);
  const rules = [
    ['chuyen can', 'Chuyên cần'],
    ['bai tap nhom', 'Bài tập nhóm'],
    ['bai tap ca nhan', 'Bài tập cá nhân'],
    ['kiem tra giua ky', 'Kiểm tra giữa kỳ'],
    ['giua ky', 'Kiểm tra giữa kỳ'],
    ['do an hoc phan', 'Đồ án học phần'],
    ['thi thuc hanh', 'Thi thực hành'],
    ['thi ket thuc', 'Thi kết thúc học phần'],
    ['cuoi ky', 'Thi cuối kỳ']
  ];

  for (const [pattern, label] of rules) {
    if (normalized.includes(pattern)) return label;
  }
  return normalizeInlineSpaces(text);
}

function parseAssessments(sectionText = '') {
  const compact = cleanMergedText(sectionText);
  const knownPatterns = [
    { component: 'Chuyên cần', pattern: /Chuyên cần[\s\S]{0,120}?(\d{1,3})%/i },
    { component: 'Bài tập nhóm', pattern: /Bài tập nhóm[\s\S]{0,120}?(\d{1,3})%/i },
    { component: 'Bài tập cá nhân', pattern: /Bài tập cá nhân[\s\S]{0,120}?(\d{1,3})%/i },
    { component: 'Kiểm tra giữa kỳ', pattern: /Kiểm tra giữa kỳ[\s\S]{0,120}?(\d{1,3})%/i },
    { component: 'Đồ án học phần', pattern: /Đồ án học phần[\s\S]{0,120}?(\d{1,3})%/i },
    { component: 'Thi thực hành', pattern: /Thi thực hành[\s\S]{0,120}?(\d{1,3})%/i },
    { component: 'Thi kết thúc học phần', pattern: /Điểm thi kết[\s\S]{0,80}?thúc HP[\s\S]{0,120}?(\d{1,3})%/i }
  ];

  const directMatches = knownPatterns
    .map(item => {
      const match = compact.match(item.pattern);
      if (!match) return null;
      const context = cleanMergedText(match[0]);
      const clos = [...new Set((context.match(/CLO\d+/gi) || []).map(code => code.toUpperCase()))].join(', ');
      return {
        component: item.component,
        weight: safeNumber(match[1], 0),
        method: normalizeInlineSpaces(
          context
            .replace(item.component, ' ')
            .replace(/\d{1,3}%/g, ' ')
            .replace(/CLO\d+/gi, ' ')
            .replace(/Điểm thi kết thúc HP/gi, ' ')
        ),
        clos
      };
    })
    .filter(Boolean)
    .filter(item => item.weight > 0);

  if (directMatches.length) {
    const seen = new Set();
    return directMatches.filter(item => {
      const key = `${item.component}-${item.weight}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const lines = splitCleanLines(sectionText);
  const assessments = [];

  lines.forEach((line, index) => {
    if (!/%/.test(line)) return;
    const weightMatch = line.match(/(\d{1,3})\s*%/);
    if (!weightMatch) return;

    const context = [lines[index - 2], lines[index - 1], line, lines[index + 1]]
      .filter(Boolean)
      .map(item => normalizeInlineSpaces(item))
      .join(' ');
    const component = detectAssessmentComponent(context);
    const clos = [...new Set((context.match(/CLO\d+/gi) || []).map(item => item.toUpperCase()))].join(', ');
    const method = normalizeInlineSpaces(
      context
        .replace(component, ' ')
        .replace(/\d{1,3}\s*%/g, ' ')
        .replace(/CLO\d+/gi, ' ')
    );

    assessments.push({
      component,
      weight: safeNumber(weightMatch[1], 0),
      method,
      clos
    });
  });

  const seen = new Set();
  return assessments.filter(item => {
    const key = `${item.component}-${item.weight}`;
    if (!item.component || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseAssessmentsFallback(sectionText = '') {
  const normalized = normalizeTextForParsing(sectionText);
  const matches = [...normalized.matchAll(/([^\n%]{4,160}?)\s*(\d{1,3})\s*%/g)];
  const seen = new Set();
  return matches.map(match => {
    const raw = cleanMergedText(match[1]);
    const weight = safeNumber(match[2], 0);
    const component = detectAssessmentComponent(raw);
    const clos = [...new Set((raw.match(/CLO\d+/gi) || []).map(code => code.toUpperCase()))].join(', ');
    return {
      component: component || raw,
      weight,
      method: normalizeInlineSpaces(raw.replace(/\bCLO\d+\b/gi, ' ')),
      clos
    };
  }).filter(item => {
    const key = `${normalizeForMatch(item.component)}-${item.weight}`;
    if (!item.component || item.weight <= 0 || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractBlockBetween(text, startLabel, endLabel) {
  const normalized = normalizeTextForParsing(text);
  const startIndex = normalized.search(startLabel);
  if (startIndex < 0) return '';
  const sliced = normalized.slice(startIndex);
  const endIndex = sliced.search(endLabel);
  return endIndex >= 0 ? sliced.slice(0, endIndex).trim() : sliced.trim();
}

function parseResourceLines(block = '') {
  return splitCleanLines(block)
    .map(line => normalizeInlineSpaces(line.replace(/^\d+\.\s*/, '').replace(/^[-•]\s*/, '')))
    .filter(Boolean);
}

function parseResources(sectionText = '') {
  const textbooksBlock = extractBlockBetween(sectionText, /Tài liệu\/giáo\s*trình chính/i, /Tài liệu tham khảo|Các công cụ|Hướng dẫn sinh viên tự học/i);
  const referencesBlock = extractBlockBetween(sectionText, /Tài liệu tham khảo(?:\/bổ sung)?/i, /Các công cụ|Hướng dẫn sinh viên tự học/i);
  const toolsBlock = extractBlockBetween(sectionText, /Các công cụ/i, /Hướng dẫn sinh viên tự học/i);

  return {
    textbooks: parseResourceLines(textbooksBlock).join('\n'),
    references: parseResourceLines(referencesBlock).join('\n'),
    tools: parseResourceLines(toolsBlock).join('\n')
  };
}

function parseRequirements(sectionText = '') {
  const lines = parseResourceLines(sectionText);
  const software = [];
  const hardware = [];
  const labEquipment = [];
  let classroomSetup = '';

  lines.forEach(line => {
    const normalized = normalizeForMatch(line);
    if (/phong may|phong hoc|lop hoc|classroom|phong thuc hanh/.test(normalized) && !classroomSetup) {
      classroomSetup = line;
      return;
    }
    if (/laptop|pc|may tinh|hardware|thiet bi/.test(normalized)) {
      hardware.push(line);
      return;
    }
    if (/phong thi nghiem|lab|thiet bi thi nghiem/.test(normalized)) {
      labEquipment.push(line);
      return;
    }
    software.push(line);
  });

  return {
    software,
    hardware,
    lab_equipment: labEquipment,
    classroom_setup: classroomSetup
  };
}

function buildMockWarnings(payload, sections) {
  const warnings = [
    'Đang dùng mock mode nâng cao: dữ liệu được suy luận từ heuristic theo section, vẫn cần người dùng review trước khi commit.'
  ];

  if (!payload.clos.length) warnings.push('Không nhận diện được danh sách CLO rõ ràng từ PDF.');
  if (!payload.schedule.length) warnings.push('Không nhận diện được đề cương chi tiết theo tuần/bài.');
  if (!payload.assessments.length) warnings.push('Không nhận diện được bảng đánh giá nên cần bổ sung thủ công.');
  if (!payload.resources.textbooks && !payload.resources.references) warnings.push('Chưa bóc tách được tài liệu học phần đầy đủ.');
  if (!sections.assessment) warnings.push('PDF không có hoặc không nhận diện được section đánh giá chuẩn.');
  if (!sections.resources) warnings.push('PDF không có hoặc không nhận diện được section tài liệu chuẩn.');

  return warnings;
}

function chooseLongerString(primary, fallback) {
  const a = safeString(primary);
  const b = safeString(fallback);
  return b.length > a.length ? b : a;
}

function mergeByCode(primaryItems = [], fallbackItems = [], keyField = 'code') {
  const merged = [];
  const seen = new Set();

  [...safeArray(primaryItems), ...safeArray(fallbackItems)].forEach(item => {
    const key = normalizeForMatch(item?.[keyField] || item?.component || item?.topic || '');
    if (!key) return;
    if (!seen.has(key)) {
      seen.add(key);
      merged.push({ ...item });
      return;
    }
    const existing = merged.find(entry => normalizeForMatch(entry?.[keyField] || entry?.component || entry?.topic || '') === key);
    if (!existing) return;
    Object.keys(item || {}).forEach(field => {
      if (Array.isArray(existing[field]) || Array.isArray(item[field])) {
        const joined = [...safeArray(existing[field]), ...safeArray(item[field])].map(v => safeString(v)).filter(Boolean);
        existing[field] = [...new Set(joined)];
      } else if (typeof existing[field] === 'number' || typeof item[field] === 'number') {
        if (!safeNumber(existing[field], 0) && safeNumber(item[field], 0)) existing[field] = item[field];
      } else {
        existing[field] = chooseLongerString(existing[field], item[field]);
      }
    });
  });

  return merged;
}

function mergeCanonicalPayloads(primaryPayload, fallbackPayload, options = {}) {
  const preferredEngine = normalizeImportEngine(options.preferredEngine || primaryPayload?.import_metadata?.engine || DEFAULT_ENGINE);
  const primary = normalizeCanonicalPayload(primaryPayload);
  const fallback = normalizeCanonicalPayload(fallbackPayload);

  const merged = normalizeCanonicalPayload({
    ...primary,
    course_identity: {
      course_code: chooseLongerString(primary.course_identity?.course_code, fallback.course_identity?.course_code),
      course_name_vi: chooseLongerString(primary.course_identity?.course_name_vi, fallback.course_identity?.course_name_vi),
      course_name_en: chooseLongerString(primary.course_identity?.course_name_en, fallback.course_identity?.course_name_en),
      credits: safeNumber(primary.course_identity?.credits, 0) || safeNumber(fallback.course_identity?.credits, 0),
      language_instruction: chooseLongerString(primary.course_identity?.language_instruction, fallback.course_identity?.language_instruction) || 'vi'
    },
    general: {
      summary: chooseLongerString(primary.general?.summary, fallback.general?.summary),
      objectives: chooseLongerString(primary.general?.objectives, fallback.general?.objectives),
      prerequisites: chooseLongerString(primary.general?.prerequisites, fallback.general?.prerequisites),
      methods: chooseLongerString(primary.general?.methods, fallback.general?.methods),
      requirements: {
        software: safeArray(primary.general?.requirements?.software).length ? primary.general.requirements.software : fallback.general?.requirements?.software,
        hardware: safeArray(primary.general?.requirements?.hardware).length ? primary.general.requirements.hardware : fallback.general?.requirements?.hardware,
        lab_equipment: safeArray(primary.general?.requirements?.lab_equipment).length ? primary.general.requirements.lab_equipment : fallback.general?.requirements?.lab_equipment,
        classroom_setup: chooseLongerString(primary.general?.requirements?.classroom_setup, fallback.general?.requirements?.classroom_setup)
      }
    },
    clos: mergeByCode(primary.clos, fallback.clos, 'code'),
    schedule: mergeByCode(primary.schedule, fallback.schedule, 'week').sort((a, b) => safeNumber(a.week) - safeNumber(b.week)),
    assessments: mergeByCode(primary.assessments, fallback.assessments, 'component'),
    resources: {
      textbooks: mergeUniqueLines(primary.resources?.textbooks, fallback.resources?.textbooks),
      references: mergeUniqueLines(primary.resources?.references, fallback.resources?.references),
      tools: mergeUniqueLines(primary.resources?.tools, fallback.resources?.tools)
    },
    warnings: [...new Set([...safeArray(primary.warnings), ...safeArray(fallback.warnings)].map(item => safeString(item)).filter(Boolean))],
    import_metadata: {
      ...buildImportMetadata({
        ...fallback.import_metadata,
        ...primary.import_metadata,
        engine: preferredEngine,
        provider: isMockEngine(preferredEngine) ? 'heuristic' : DEFAULT_PROVIDER,
        model: isMockEngine(preferredEngine) ? 'mock-local' : DEFAULT_MODEL,
        prompt_version: isMockEngine(preferredEngine) ? MOCK_PROMPT_VERSION : HYBRID_PROMPT_VERSION,
        fallback_used: Boolean(options.fallbackUsed || isMockEngine(preferredEngine)),
        diagnostics: {
          ...(fallback.import_metadata?.diagnostics || {}),
          ...(primary.import_metadata?.diagnostics || {}),
          merge_strategy: 'template-aware-hybrid'
        }
      })
    },
    target: primary.target?.course_id ? primary.target : fallback.target
  });

  merged.confidence = buildMockConfidence(merged);
  return merged;
}

function buildMockConfidence(payload) {
  const fields = {
    course_identity: payload.course_identity.course_code && payload.course_identity.course_name_vi ? 'high' : 'medium',
    clos: payload.clos.length >= 3 ? 'high' : payload.clos.length ? 'medium' : 'low',
    schedule: payload.schedule.length >= 5 ? 'medium' : payload.schedule.length ? 'low' : 'low',
    assessments: payload.assessments.length >= 3 ? 'medium' : payload.assessments.length ? 'low' : 'low',
    resources: payload.resources.textbooks || payload.resources.references ? 'medium' : 'low'
  };

  const ordered = Object.values(fields);
  const overall = ordered.includes('low')
    ? (ordered.filter(item => item === 'low').length >= 3 ? 'low' : 'medium')
    : 'high';

  return { overall, fields };
}

function buildMockPayloadFromText(pdfText) {
  const text = normalizeTextForParsing(pdfText);
  const sections = extractSections(text);
  const cloBlock = extractBlockBetween(
    text,
    /(?:^|\n)\s*(?:10\.\s*)?Chuẩn đầu ra của học phần[\s\S]{0,40}?(?:\(CLO\)|CLO)/i,
    /(?:^|\n)\s*(?:11\.\s*)?Mô tả tóm tắt nội dung học phần/i
  );
  const summaryBlock = extractBlockBetween(
    text,
    /(?:^|\n)\s*(?:11\.\s*)?Mô tả tóm tắt nội dung học phần/i,
    /(?:^|\n)\s*(?:12\.\s*Phương|Phương pháp,\s*hình thức tổ)/i
  );
  const methodsBlock = extractBlockBetween(
    text,
    /(?:^|\n)\s*(?:12\.\s*Phương|Phương pháp,\s*hình thức tổ)/i,
    /(?:^|\n)\s*(?:13\.\s*)?Nội dung chi tiết học phần/i
  );
  const outlineBlock = extractBlockBetween(
    text,
    /(?:^|\n)\s*(?:13\.\s*)?Nội dung chi tiết học phần/i,
    /(?:^|\n)\s*(?:14\.\s*Phương|Phương pháp[\s,\n]*kiểm[\s,\n]*tra\/đánh giá)/i
  );
  const assessmentBlock = extractBlockBetween(
    text,
    /(?:^|\n)\s*(?:14\.\s*Phương|Phương pháp[\s,\n]*kiểm[\s,\n]*tra\/đánh giá)/i,
    /(?:^|\n)\s*(?:15\.|Tài liệu phục|Tài liệu\/giáo)/i
  );
  const resourcesBlock = extractBlockBetween(
    text,
    /(?:^|\n)\s*(?:15\.\s*Tài liệu|Tài liệu phục[\s,\n]*vụ học phần)/i,
    /(?:^|\n)\s*(?:16\.|Hướng|17\.|Các yêu)/i
  );
  const courseInfo = extractCourseIdentity(sections.intro);
  const clos = parseClos(cloBlock || sections.clo);
  const schedule = parseSchedule(outlineBlock || sections.outline);
  const assessments = parseAssessments(assessmentBlock || sections.assessment);
  const resources = parseResources(resourcesBlock || sections.resources);
  const fallbackClos = parseClosFromInlineText(text);
  const fallbackSchedule = parseScheduleFallback(outlineBlock || sections.outline || text);
  const fallbackAssessments = parseAssessmentsFallback(assessmentBlock || sections.assessment || text);
  const requirements = parseRequirements(sections.requirements || '');
  const summary = cleanMergedText(
    (summaryBlock || sections.summary || '')
      .replace(/^(?:11\.\s*)?Mô tả tóm tắt nội dung học phần/i, '')
  );
  const methods = cleanMergedText(
    (methodsBlock || sections.methods || '')
      .replace(/^(?:12\.\s*Phương[\s,\n]*pháp,?|Phương pháp,\s*hình thức tổ[\s,\n]*chức dạy học(?:\s*của học phần)?)/i, '')
  );
  const objectives =
    cleanMergedText(extractBlockBetween(text, /(?:^|\n)\s*(?:7\.\s*Mục tiêu(?: của học phần)?|Mục tiêu của học phần)/i, /(?:^|\n)\s*(?:8\.\s*Đơn vị|Đơn vị quản|9\.\s*Bảng trích ngang)/i)) ||
    cleanMergedText(extractLabeledValue(sections.intro, /Mục tiêu của học phần/i));

  const payload = {
    course_identity: courseInfo.course_identity,
    general: {
      summary,
      objectives,
      prerequisites: courseInfo.prerequisites,
      methods,
      requirements: {
        software: requirements.software,
        hardware: requirements.hardware,
        lab_equipment: requirements.lab_equipment,
        classroom_setup: requirements.classroom_setup
      }
    },
    clos: clos.length ? clos : fallbackClos,
    schedule: (schedule.length ? schedule : fallbackSchedule).map(item => ({
      week: item.week,
      topic: item.topic,
      activities: item.activities,
      clos: item.clos
    })),
    assessments: assessments.length ? assessments : fallbackAssessments,
    resources,
    warnings: [],
    confidence: { overall: 'medium', fields: {} },
    import_metadata: {
      source_file: 'upload.pdf',
      extraction_method: 'pdftotext+mock-smart',
      engine: 'mock',
      provider: 'heuristic',
      model: 'mock-local',
      ai_model: 'mock-local',
      prompt_version: MOCK_PROMPT_VERSION,
      inferred_fields: [],
      fallback_used: true,
      diagnostics: {
        recognized_sections: Object.keys(sections).filter(key => key !== 'intro' && safeString(sections[key]))
      }
    },
    target: {}
  };

  payload.warnings = buildMockWarnings(payload, sections);
  payload.confidence = buildMockConfidence(payload);
  payload.import_metadata.inferred_fields = [
    !payload.general.summary ? 'general.summary' : '',
    !payload.general.objectives ? 'general.objectives' : '',
    !payload.general.prerequisites ? 'general.prerequisites' : '',
    payload.assessments.length === 0 ? 'assessments' : '',
    payload.resources.textbooks || payload.resources.references ? '' : 'resources'
  ].filter(Boolean);

  return normalizeCanonicalPayload(payload);
}

function buildPrompt(pdfText) {
  const truncatedText = safeString(pdfText).slice(0, 8000);
  const sections = extractSections(truncatedText);
  return `
Bạn là chuyên gia phân tích đề cương môn học. Hãy trích xuất thông tin từ đề cương sau và trả về dưới dạng JSON chính xác.

Văn bản đề cương:
${truncatedText}

Các section đã nhận diện sơ bộ từ mẫu:
- intro: ${safeString(sections.intro).slice(0, 400)}
- clo: ${safeString(sections.clo).slice(0, 500)}
- summary: ${safeString(sections.summary).slice(0, 400)}
- methods: ${safeString(sections.methods).slice(0, 400)}
- outline: ${safeString(sections.outline).slice(0, 600)}
- assessment: ${safeString(sections.assessment).slice(0, 500)}
- resources: ${safeString(sections.resources).slice(0, 500)}
- requirements: ${safeString(sections.requirements).slice(0, 300)}

Yêu cầu trích xuất:

1. THÔNG TIN CƠ BẢN:
- course_code: Mã môn học (VD: CMP167, CS101)
- course_name: Tên môn học
- course_name_en: Tên môn học tiếng Anh (nếu có)
- credits: Số tín chỉ
- language_instruction: Ngôn ngữ giảng dạy (vi/en)

2. CHUẨN ĐẦU RA (CLOs):
Trích xuất tất cả chuẩn đầu ra với format:
- code: Mã CLO (VD: CLO1, CLO2)
- description: Mô tả chi tiết
- bloom_level: Mức độ Bloom (remember/understand/apply/analyze/evaluate/create)
- plo_mapping: Danh sách PLO liên quan (nếu có)
- confidence: high|medium|low dựa trên mức độ chắc chắn của việc trích xuất

3. ĐỀ CƯƠNG CHI TIẾT (course_outline):
Trích xuất theo tuần với format:
- week: Số tuần
- topic: Chủ đề
- content: Nội dung chi tiết
- hours: {"theory": X, "practice": Y}
- teaching_method: Phương pháp giảng dạy
- materials: Tài liệu sử dụng
- clo_mapping: CLO liên quan
- assignments: Bài tập

4. PHƯƠNG PHÁP ĐÁNH GIÁ (assessment_methods):
- type: Loại đánh giá (VD: "Chuyên cần", "Bài tập", "Kiểm tra giữa kỳ", "Thi cuối kỳ")
- weight: Trọng số (phần trăm)
- description: Mô tả chi tiết
- criteria: Tiêu chí đánh giá
- clo_mapping: CLO được đánh giá

5. TÀI LIỆU (textbooks & references):
- title: Tên sách/tài liệu
- authors: Danh sách tác giả
- year: Năm xuất bản
- publisher: Nhà xuất bản
- isbn: Mã ISBN (nếu có)
- edition: Lần xuất bản

6. YÊU CẦU KHÁC:
- prerequisites: Học phần học trước
- course_objectives: Mục tiêu môn học
- course_description: Mô tả tóm tắt
- learning_methods: Phương pháp học tập
- course_requirements: Yêu cầu về phần mềm, phần cứng

LƯU Ý QUAN TRỌNG:
- Tổng trọng số đánh giá phải = 100 nếu tài liệu có đủ dữ liệu
- CLO codes phải duy nhất
- Week numbers phải tuần tự nếu tài liệu có đủ dữ liệu
- Trả về JSON hợp lệ, không có markdown formatting
- Nếu không tìm thấy thông tin, để null, chuỗi rỗng hoặc array rỗng
- Nếu có field suy luận chưa chắc chắn, ghi chú vào warnings
- Nếu PDF có cấu trúc không đồng nhất, hãy cố chuẩn hóa về schema dưới đây
- Ưu tiên dựa vào số mục mẫu 1-17 của đề cương HUTECH để phân loại dữ liệu đúng section
- Nếu một field AI không chắc chắn nhưng section template cho thấy rõ hơn, hãy dùng giá trị bám theo section đó
- Không bỏ sót dữ liệu chỉ vì format bảng bị vỡ dòng

Trả về JSON với cấu trúc:
{
  "course_code": "string",
  "course_name": "string",
  "course_name_en": "string",
  "credits": number,
  "language_instruction": "string",
  "clos": [...],
  "course_outline": [...],
  "assessment_methods": [...],
  "textbooks": [...],
  "references": [...],
  "prerequisites": "string",
  "course_objectives": "string",
  "course_description": "string",
  "learning_methods": "string",
  "course_requirements": {
    "software": [...],
    "hardware": [...],
    "lab_equipment": [...],
    "classroom_setup": "string"
  },
  "warnings": ["string"],
  "confidence": {
    "overall": "high|medium|low",
    "fields": {}
  },
  "metadata": {
    "source_file": "",
    "extraction_method": "pdftotext+groq",
    "diagnostics": {}
  }
}
`.trim();
}

async function extractPdfTextFromBuffer(buffer) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'syllabus-import-'));
  const pdfPath = path.join(tempDir, 'upload.pdf');
  try {
    await fs.writeFile(pdfPath, buffer);
    let layoutText = '';
    let plainText = '';
    let pageCount = 0;
    let primaryExtractor = '';

    try {
      const { stdout } = await execFileAsync('pdftotext', ['-layout', pdfPath, '-'], {
        maxBuffer: 20 * 1024 * 1024
      });
      layoutText = safeString(stdout);
      pageCount = stdout ? stdout.split('\f').filter(Boolean).length || 1 : 0;
      primaryExtractor = 'pdftotext';
    } catch (pdftotextError) {
      primaryExtractor = 'pdf-parse-fallback';
      pageCount = 0;
      layoutText = '';
      if (pdftotextError) {
        // Continue with pdf-parse below.
      }
    }

    let parser;
    try {
      parser = new PDFParse({ data: buffer });
      const parsed = await parser.getText();
      plainText = safeString(parsed?.text);
      pageCount = pageCount || safeNumber(parsed?.total, 0);
    } finally {
      if (parser) {
        await parser.destroy().catch(() => {});
      }
    }

    const text = layoutText || plainText;
    if (!text) {
      throw new Error('Không thể trích xuất text từ PDF. Hãy kiểm tra pdftotext hoặc chất lượng file PDF.');
    }

    return {
      text,
      layoutText,
      plainText,
      diagnostics: {
        page_count: pageCount,
        extracted_chars: text.length,
        extractor: primaryExtractor || 'pdf-parse',
        layout_chars: layoutText.length,
        plain_chars: plainText.length
      }
    };
  } catch (error) {
    const wrapped = new Error('Không thể trích xuất text từ PDF. Hãy kiểm tra pdftotext hoặc chất lượng file PDF.');
    wrapped.cause = error;
    throw wrapped;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function callGroq(prompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('Thiếu GROQ_API_KEY cho chức năng import đề cương PDF.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  let response;
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      }),
      signal: controller.signal
    });
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Groq xử lý quá thời gian chờ 45 giây.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = safeString(data?.error?.message || data?.message);
    if (/quota exceeded|rate limit|billing|insufficient/i.test(message)) {
      throw new Error('Groq API hiện không khả dụng do đã vượt quota, rate limit, hoặc cấu hình billing chưa sẵn sàng. Vui lòng kiểm tra hạn mức của GROQ_API_KEY.');
    }
    if (/invalid api key|unauthorized|authentication/i.test(message)) {
      throw new Error('GROQ_API_KEY không hợp lệ hoặc không có quyền truy cập model đã cấu hình.');
    }
    throw new Error(message || 'Groq không phản hồi hợp lệ.');
  }

  const text = safeString(data?.choices?.[0]?.message?.content);
  if (!text) {
    throw new Error('Groq không trả về nội dung JSON.');
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error('Groq trả về JSON không hợp lệ.');
  }
}

function validateCanonicalPayload(payload, versionCourses = [], versionPlos = []) {
  const errors = [];
  const warnings = safeArray(payload.warnings).map(item => ({ type: 'warning', msg: safeString(item) })).filter(item => item.msg);
  const courseOptions = new Set(versionCourses.map(course => Number(course.course_id || course.id)));
  const ploOptions = new Set(versionPlos.map(plo => safeString(plo.code).toUpperCase()));

  if (!payload.target?.course_id || !courseOptions.has(Number(payload.target.course_id))) {
    errors.push({ type: 'error', msg: 'Chưa chọn học phần đích hợp lệ trong CTĐT.' });
  }

  if (!payload.course_identity?.course_code) {
    errors.push({ type: 'error', msg: 'Thiếu mã học phần trong bản đề cương chuẩn hóa.' });
  }

  if (!payload.course_identity?.course_name_vi) {
    errors.push({ type: 'warning', msg: 'Thiếu tên học phần tiếng Việt.' });
  }

  if (!payload.general?.summary) {
    warnings.push({ type: 'warning', msg: 'Chưa có mô tả tóm tắt học phần.' });
  }

  const totalWeight = safeArray(payload.assessments).reduce((sum, item) => sum + safeNumber(item.weight), 0);
  if (payload.assessments.length > 0 && totalWeight !== 100) {
    warnings.push({ type: 'warning', msg: `Tổng trọng số đánh giá hiện là ${totalWeight}%, không bằng 100%.` });
  }

  const cloCodes = new Set();
  safeArray(payload.clos).forEach((clo, index) => {
    const code = safeString(clo.code);
    if (!code) {
      errors.push({ type: 'error', msg: `CLO ở dòng ${index + 1} chưa có mã.` });
      return;
    }
    if (cloCodes.has(code)) {
      errors.push({ type: 'error', msg: `CLO "${code}" bị trùng.` });
    }
    cloCodes.add(code);
    normalizePloMappings(clo.plo_mapping).forEach(ploCode => {
      if (!ploOptions.has(safeString(ploCode).toUpperCase())) {
        warnings.push({ type: 'warning', msg: `CLO "${code}" đang tham chiếu PLO "${ploCode}" không tồn tại trong phiên bản.` });
      }
    });
  });

  let previousWeek = 0;
  safeArray(payload.schedule).forEach(item => {
    const week = safeNumber(item.week);
    if (week < previousWeek) {
      warnings.push({ type: 'warning', msg: 'Thứ tự tuần học chưa tuần tự hoàn toàn.' });
    }
    previousWeek = Math.max(previousWeek, week);
  });

  return {
    errors,
    warnings,
    valid: errors.length === 0
  };
}

async function processPdfImport({ buffer, versionCourses = [], existingSyllabi = [] }) {
  return processPdfImportWithMode({ buffer, versionCourses, existingSyllabi, mode: DEFAULT_ENGINE });
}

async function processPdfImportWithMode({ buffer, versionCourses = [], existingSyllabi = [], mode = 'ai' }) {
  const engine = normalizeImportEngine(mode);
  if (!buffer || !buffer.length) {
    throw new Error('Không tìm thấy nội dung file PDF.');
  }
  if (buffer.length > MAX_PDF_SIZE_BYTES) {
    throw new Error('File PDF vượt quá giới hạn 15MB cho phase hiện tại.');
  }

  const startedAt = Date.now();
  const extraction = await extractPdfTextFromBuffer(buffer);
  if (!extraction.text) {
    throw new Error('Không trích xuất được nội dung text từ file PDF.');
  }

  let canonical;
  const sourceText = isMockEngine(engine) ? (extraction.plainText || extraction.text) : extraction.text;
  const heuristicCanonical = buildMockPayloadFromText(sourceText);
  extraction.text = sourceText;
  if (isMockEngine(engine)) {
    canonical = heuristicCanonical;
  } else {
    try {
      const aiPayload = await callGroq(buildPrompt(sourceText));
      canonical = mergeCanonicalPayloads(
        buildCanonicalPayloadFromAi(aiPayload),
        heuristicCanonical,
        { preferredEngine: engine }
      );
    } catch (error) {
      canonical = mergeCanonicalPayloads(
        heuristicCanonical,
        heuristicCanonical,
        { preferredEngine: 'mock', fallbackUsed: true }
      );
      canonical.warnings = [
        `Groq không khả dụng, hệ thống đã tự chuyển sang heuristic fallback: ${error.message}`,
        ...safeArray(canonical.warnings)
      ];
      canonical.import_metadata.diagnostics = {
        ...(canonical.import_metadata.diagnostics || {}),
        groq_fallback_reason: error.message
      };
    }
  }
  canonical = autoMatchCourse(canonical, versionCourses, existingSyllabi);

  const metadata = buildImportMetadata({
    ...canonical.import_metadata,
    source_file: canonical.import_metadata?.source_file || 'upload.pdf',
    extraction_method: canonical.import_metadata?.extraction_method || (isMockEngine(engine) ? 'pdftotext+mock-smart' : `pdftotext+${DEFAULT_PROVIDER}`),
    engine: canonical.import_metadata?.engine || engine,
    provider: canonical.import_metadata?.provider || (isMockEngine(engine) ? 'heuristic' : DEFAULT_PROVIDER),
    model: canonical.import_metadata?.model || (isMockEngine(engine) ? 'mock-local' : DEFAULT_MODEL),
    prompt_version: canonical.import_metadata?.prompt_version || (isMockEngine(engine) ? MOCK_PROMPT_VERSION : HYBRID_PROMPT_VERSION),
    fallback_used: Boolean(canonical.import_metadata?.fallback_used || isMockEngine(canonical.import_metadata?.engine || engine)),
    diagnostics: {
      ...canonical.import_metadata?.diagnostics,
      ...extraction.diagnostics,
      processing_ms: Date.now() - startedAt,
      engine
    }
  });
  canonical.import_metadata = {
    ...metadata,
    ...extraction.diagnostics,
    diagnostics: metadata.diagnostics
  };

  return {
    extraction,
    canonical
  };
}

async function reprocessPdfText({ extractionText, versionCourses = [], existingSyllabi = [] }) {
  return reprocessPdfTextWithMode({ extractionText, versionCourses, existingSyllabi, mode: DEFAULT_ENGINE });
}

async function reprocessPdfTextWithMode({ extractionText, versionCourses = [], existingSyllabi = [], mode = 'ai' }) {
  const engine = normalizeImportEngine(mode);
  const startedAt = Date.now();
  let canonical;
  const heuristicCanonical = buildMockPayloadFromText(extractionText);
  if (isMockEngine(engine)) {
    canonical = heuristicCanonical;
  } else {
    try {
      const aiPayload = await callGroq(buildPrompt(extractionText));
      canonical = mergeCanonicalPayloads(
        buildCanonicalPayloadFromAi(aiPayload),
        heuristicCanonical,
        { preferredEngine: engine }
      );
    } catch (error) {
      canonical = mergeCanonicalPayloads(
        heuristicCanonical,
        heuristicCanonical,
        { preferredEngine: 'mock', fallbackUsed: true }
      );
      canonical.warnings = [
        `Groq không khả dụng, hệ thống đã tự chuyển sang heuristic fallback: ${error.message}`,
        ...safeArray(canonical.warnings)
      ];
      canonical.import_metadata.diagnostics = {
        ...(canonical.import_metadata.diagnostics || {}),
        groq_fallback_reason: error.message
      };
    }
  }
  canonical = autoMatchCourse(canonical, versionCourses, existingSyllabi);
  canonical.import_metadata = buildImportMetadata({
    ...canonical.import_metadata,
    engine: canonical.import_metadata?.engine || engine,
    provider: canonical.import_metadata?.provider || (isMockEngine(engine) ? 'heuristic' : DEFAULT_PROVIDER),
    model: canonical.import_metadata?.model || (isMockEngine(engine) ? 'mock-local' : DEFAULT_MODEL),
    prompt_version: canonical.import_metadata?.prompt_version || (isMockEngine(engine) ? MOCK_PROMPT_VERSION : HYBRID_PROMPT_VERSION),
    fallback_used: Boolean(canonical.import_metadata?.fallback_used || isMockEngine(canonical.import_metadata?.engine || engine)),
    diagnostics: {
      ...canonical.import_metadata?.diagnostics,
      extracted_chars: safeString(extractionText).length,
      processing_ms: Date.now() - startedAt,
      retried_from_extracted_text: true,
      engine: canonical.import_metadata?.engine || engine
    }
  });
  canonical.import_metadata.mode = isMockEngine(canonical.import_metadata.engine) ? 'mock' : 'ai';
  canonical.import_metadata.ai_model = canonical.import_metadata.model;
  canonical.import_metadata.diagnostics = {
    ...canonical.import_metadata.diagnostics
  };
  return canonical;
}

function mapPayloadToSyllabusContent(payload) {
  const importMetadata = buildImportMetadata(payload.import_metadata);
  const requirements = payload.general?.requirements || {};
  return {
    course_name_vi: safeString(payload.course_identity?.course_name_vi),
    course_name_en: safeString(payload.course_identity?.course_name_en),
    course_code: safeString(payload.course_identity?.course_code),
    credits: Math.max(0, safeNumber(payload.course_identity?.credits)),
    language_instruction: safeString(payload.course_identity?.language_instruction, 'vi'),
    knowledge_block: safeString(payload.general?.knowledge_block),
    course_category: safeString(payload.general?.course_category),
    course_level: safeString(payload.general?.course_level, 'Đại học'),
    managing_unit: safeString(payload.general?.managing_unit),
    summary: safeString(payload.general?.summary),
    objectives: safeString(payload.general?.objectives),
    prerequisites: safeString(payload.general?.prerequisites),
    methods: safeString(payload.general?.methods),
    schedule: safeArray(payload.schedule).map(item => ({
      week: Math.max(1, Math.round(safeNumber(item.week, 1))),
      topic: safeString(item.topic),
      content: safeString(item.content),
      theory_hours: safeNumber(item.theory_hours),
      practice_hours: safeNumber(item.practice_hours),
      teaching_method: safeString(item.teaching_method),
      materials: safeString(item.materials),
      clos: safeString(item.clos)
    })),
    grading: safeArray(payload.assessments).map(item => ({
      group: safeString(item.group),
      component: safeString(item.component),
      rule: safeString(item.rule || item.method),
      assessment: safeString(item.assessment),
      weight: Math.max(0, safeNumber(item.weight)),
      method: safeString(item.method),
      clos: safeString(item.clos)
    })),
    textbooks: safeString(payload.resources?.textbooks),
    references: safeString(payload.resources?.references),
    tools: safeString(payload.resources?.tools),
    course_requirements: [
      normalizeCodeList(requirements.software).join(', '),
      normalizeCodeList(requirements.hardware).join(', '),
      normalizeCodeList(requirements.lab_equipment).join(', '),
      safeString(requirements.classroom_setup)
    ].filter(Boolean).join(' | '),
    self_study_guidance: safeString(payload.resources?.self_study_guidance),
    notes: safeArray(payload.warnings).map(item => safeString(item)).filter(Boolean).join('\n'),
    import_metadata: {
      ...importMetadata,
      source: importMetadata.engine === 'mock' ? 'pdf-heuristic-import' : `pdf-${importMetadata.provider || DEFAULT_PROVIDER}-import`,
      confidence: payload.confidence,
      warnings: payload.warnings
    }
  };
}

module.exports = {
  DEFAULT_PROVIDER,
  DEFAULT_ENGINE,
  DEFAULT_MODEL,
  MAX_PDF_SIZE_BYTES,
  PROMPT_VERSION,
  MOCK_PROMPT_VERSION,
  HYBRID_PROMPT_VERSION,
  buildImportMetadata,
  normalizeImportEngine,
  normalizeCanonicalPayload,
  processPdfImport,
  processPdfImportWithMode,
  reprocessPdfText,
  reprocessPdfTextWithMode,
  validateCanonicalPayload,
  mapPayloadToSyllabusContent,
  buildCanonicalPayloadFromAi
};
