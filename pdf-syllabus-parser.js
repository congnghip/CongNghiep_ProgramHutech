/**
 * pdf-syllabus-parser.js — PDF Syllabus parser using pdf-parse + Groq LLM
 *
 * Parses a PDF syllabus buffer into structured data: content, CLOs, CLO-PLO mappings.
 * Analogous to word-parser.js but for PDF syllabus import.
 *
 * Dependencies: pdf-parse, groq-sdk
 */

const pdfParse = require('pdf-parse');
const Groq = require('groq-sdk');

const MAX_TEXT_LENGTH = 50000;
const LLM_TIMEOUT = 60000; // 60s

// ───────────────────────────────────────────────────────────────────────────
// 1. PDF Text Extraction
// ───────────────────────────────────────────────────────────────────────────

async function parsePdfToText(buffer) {
  const data = await pdfParse(buffer);
  return data.text || '';
}

// ───────────────────────────────────────────────────────────────────────────
// 2. Gemini Prompt Construction
// ───────────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Bạn là chuyên gia phân tích đề cương chi tiết học phần (syllabus) của đại học Việt Nam.
Nhiệm vụ: Trích xuất thông tin từ văn bản đề cương, trả về JSON theo đúng cấu trúc yêu cầu.
Chú ý:
- Giữ nguyên tiếng Việt, không dịch sang tiếng Anh
- Mã CLO giữ format CLO1, CLO2...
- Mã PLO giữ format PLO1, PLO2...
- Mã PI giữ format PI1.01, PI6.04...
- Nếu không tìm thấy thông tin cho field nào, trả về chuỗi rỗng hoặc mảng rỗng
- Chỉ trả về JSON, không thêm giải thích hay markdown`;

function buildUserPrompt(text) {
  return `Phân tích đề cương sau và trả về JSON:

<syllabus_text>
${text}
</syllabus_text>

Trả về JSON với cấu trúc chính xác sau:
{
  "course_code": "mã học phần (vd: AIT129)",
  "course_name": "tên học phần tiếng Việt",
  "credits": 3,
  "language_instruction": "ngôn ngữ giảng dạy (vd: Tiếng Việt)",
  "prerequisites": "học phần học trước, để rỗng nếu không có",
  "course_objectives": "mục tiêu của học phần (mục 7 trong đề cương)",
  "course_description": "mô tả tóm tắt nội dung học phần (mục 11)",
  "learning_methods": "phương pháp, hình thức tổ chức dạy học (mục 12), liệt kê tất cả phương pháp và mục tiêu",
  "clos": [
    {
      "code": "CLO1",
      "description": "mô tả chuẩn đầu ra",
      "pi_code": "PI6.04",
      "plo_code": "PLO6"
    }
  ],
  "course_outline": [
    {
      "lesson": 1,
      "title": "tên bài học",
      "hours": 5,
      "topics": ["1.1. Mục con 1", "1.2. Mục con 2"],
      "teaching_methods": "phương pháp dạy học cụ thể cho bài này",
      "clos": ["CLO1", "CLO4"]
    }
  ],
  "assessment_methods": [
    {
      "component": "tên thành phần đánh giá",
      "weight": 20,
      "assessment_tool": "bài đánh giá / hình thức",
      "clos": ["CLO1", "CLO2"]
    }
  ],
  "textbooks": ["tài liệu/giáo trình chính 1", "tài liệu chính 2"],
  "references": ["tài liệu tham khảo 1", "tài liệu tham khảo 2"],
  "course_requirements": {
    "software": ["phần mềm/công cụ 1", "công cụ 2"],
    "hardware": [],
    "lab_equipment": [],
    "classroom_setup": ""
  }
}`;
}

// ───────────────────────────────────────────────────────────────────────────
// 3. Groq API Call
// ───────────────────────────────────────────────────────────────────────────

async function callLlmApi(userPrompt) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY chưa được cấu hình trong .env');

  const groq = new Groq({ apiKey });

  const result = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0,
    response_format: { type: 'json_object' },
    timeout: LLM_TIMEOUT,
  });

  const text = result.choices[0]?.message?.content;
  if (!text) throw new Error('LLM trả về kết quả rỗng');
  return JSON.parse(text);
}

// ───────────────────────────────────────────────────────────────────────────
// 4. Response Validation
// ───────────────────────────────────────────────────────────────────────────

function validateResponse(json) {
  const result = {
    course_code: json.course_code || '',
    course_name: json.course_name || '',
    credits: typeof json.credits === 'number' ? json.credits : 3,
    language_instruction: json.language_instruction || '',
    prerequisites: json.prerequisites || '',
    course_objectives: json.course_objectives || '',
    course_description: json.course_description || '',
    learning_methods: json.learning_methods || '',
    clos: Array.isArray(json.clos) ? json.clos.map(c => ({
      code: c.code || '',
      description: c.description || '',
      pi_code: c.pi_code || '',
      plo_code: c.plo_code || '',
    })) : [],
    course_outline: Array.isArray(json.course_outline) ? json.course_outline.map(o => ({
      lesson: o.lesson || 0,
      title: o.title || '',
      hours: typeof o.hours === 'number' ? o.hours : 0,
      topics: Array.isArray(o.topics) ? o.topics : [],
      teaching_methods: o.teaching_methods || '',
      clos: Array.isArray(o.clos) ? o.clos : [],
    })) : [],
    assessment_methods: Array.isArray(json.assessment_methods) ? json.assessment_methods.map(a => ({
      component: a.component || '',
      weight: typeof a.weight === 'number' ? a.weight : 0,
      assessment_tool: a.assessment_tool || '',
      clos: Array.isArray(a.clos) ? a.clos : [],
    })) : [],
    textbooks: Array.isArray(json.textbooks) ? json.textbooks : [],
    references: Array.isArray(json.references) ? json.references : [],
    course_requirements: {
      software: Array.isArray(json.course_requirements?.software) ? json.course_requirements.software : [],
      hardware: Array.isArray(json.course_requirements?.hardware) ? json.course_requirements.hardware : [],
      lab_equipment: Array.isArray(json.course_requirements?.lab_equipment) ? json.course_requirements.lab_equipment : [],
      classroom_setup: json.course_requirements?.classroom_setup || '',
    },
  };
  return result;
}

// ───────────────────────────────────────────────────────────────────────────
// 5. CLO-PLO Matching
// ───────────────────────────────────────────────────────────────────────────

async function matchCloPlo(clos, versionId, pool) {
  const warnings = [];

  // Get all PLOs for this version
  const ploRes = await pool.query(
    'SELECT id, code FROM version_plos WHERE version_id = $1', [versionId]
  );
  const ploMap = {}; // code → id, e.g. "PLO6" → 123
  ploRes.rows.forEach(r => { ploMap[r.code.toUpperCase()] = r.id; });

  // Get all PIs for this version's PLOs
  const piRes = await pool.query(`
    SELECT pp.id, pp.pi_code, pp.plo_id, vp.code as plo_code
    FROM plo_pis pp
    JOIN version_plos vp ON pp.plo_id = vp.id
    WHERE vp.version_id = $1
  `, [versionId]);
  const piMap = {}; // pi_code → { plo_id, plo_code }
  piRes.rows.forEach(r => {
    piMap[r.pi_code.toUpperCase()] = { plo_id: r.plo_id, plo_code: r.plo_code };
  });

  const mappings = [];

  for (const clo of clos) {
    // Try to match by PI code first (more specific)
    if (clo.pi_code) {
      const piKey = clo.pi_code.toUpperCase();
      if (piMap[piKey]) {
        mappings.push({
          clo_code: clo.code,
          plo_id: piMap[piKey].plo_id,
          plo_code: piMap[piKey].plo_code,
          contribution_level: 3,
        });
        continue;
      }
    }

    // Fallback: match by PLO code
    if (clo.plo_code) {
      const ploKey = clo.plo_code.toUpperCase();
      if (ploMap[ploKey]) {
        mappings.push({
          clo_code: clo.code,
          plo_id: ploMap[ploKey],
          plo_code: clo.plo_code,
          contribution_level: 3,
        });
        continue;
      }
    }

    // No match found
    const ref = clo.pi_code || clo.plo_code || '(không có mã)';
    warnings.push(`CLO "${clo.code}" tham chiếu ${ref} — không tìm thấy trong version hiện tại`);
  }

  return { mappings, warnings };
}

// ───────────────────────────────────────────────────────────────────────────
// 6. Main Orchestrator
// ───────────────────────────────────────────────────────────────────────────

async function parseSyllabusPdf(buffer, versionId, courseId, pool) {
  const warnings = [];

  // Step 1: Extract text
  let text = await parsePdfToText(buffer);
  if (!text || text.trim().length < 50) {
    throw new Error('Không thể đọc nội dung từ file PDF');
  }

  // Step 2: Truncate if too long
  if (text.length > MAX_TEXT_LENGTH) {
    text = text.substring(0, MAX_TEXT_LENGTH);
    warnings.push(`Văn bản PDF quá dài (>${MAX_TEXT_LENGTH} ký tự), đã cắt bớt`);
  }

  // Step 3: Call Gemini
  const userPrompt = buildUserPrompt(text);
  let rawJson;
  try {
    rawJson = await callLlmApi(userPrompt);
  } catch (err) {
    throw new Error(`Lỗi kết nối AI: ${err.message}`);
  }

  // Step 4: Validate
  const validated = validateResponse(rawJson);

  // Step 5: Build content JSONB (excluding course-level fields and CLOs)
  const content = {
    _schema_version: 2,
    course_description: validated.course_description,
    course_objectives: validated.course_objectives,
    prerequisites: validated.prerequisites,
    language_instruction: validated.language_instruction,
    learning_methods: validated.learning_methods,
    course_outline: validated.course_outline,
    assessment_methods: validated.assessment_methods,
    textbooks: validated.textbooks,
    references: validated.references,
    course_requirements: validated.course_requirements,
  };

  // Step 6: Match CLO-PLO
  const { mappings, warnings: matchWarnings } = await matchCloPlo(validated.clos, versionId, pool);
  warnings.push(...matchWarnings);

  // Step 7: Course info verification
  let courseMatched = false;
  if (validated.course_code && courseId) {
    const courseRes = await pool.query('SELECT code FROM courses WHERE id = $1', [courseId]);
    if (courseRes.rows.length) {
      courseMatched = courseRes.rows[0].code.toUpperCase() === validated.course_code.toUpperCase();
      if (!courseMatched) {
        warnings.push(`Mã HP trong PDF (${validated.course_code}) khác với mã HP hiện tại (${courseRes.rows[0].code})`);
      }
    }
  }

  return {
    content,
    clos: validated.clos,
    clo_plo_map: mappings,
    warnings,
    course_info: {
      pdf_course_code: validated.course_code,
      pdf_course_name: validated.course_name,
      pdf_credits: validated.credits,
      matched: courseMatched,
    },
  };
}

module.exports = { parseSyllabusPdf };
