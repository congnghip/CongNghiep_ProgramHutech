const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

const DEFAULT_TEMPLATE = path.resolve(__dirname, 'mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx');

function xmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function stripXml(xml) {
  return String(xml || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function cell(value) {
  const text = xmlEscape(value);
  return `<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`;
}

function row(values) {
  return `<w:tr>${values.map(cell).join('')}</w:tr>`;
}

function table(rows) {
  const body = rows.length ? rows : [['']];
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="0" w:type="auto"/>
      <w:tblBorders>
        <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        <w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/>
      </w:tblBorders>
    </w:tblPr>
    ${body.map(row).join('')}
  </w:tbl>`;
}

function replaceLiteralXmlText(xml, replacements) {
  let result = xml;
  for (const [from, to] of replacements) {
    if (!from || to === null || to === undefined) continue;
    result = result.split(xmlEscape(from)).join(xmlEscape(to));
  }
  return result;
}

function replaceTables(documentXml, replacements) {
  let replacementIndex = 0;
  return documentXml.replace(/<w:tbl[\s\S]*?<\/w:tbl>/g, original => {
    const text = stripXml(original);
    const matched = replacements.find((item, index) => index >= replacementIndex && item.match(text));
    if (!matched) return original;
    replacementIndex = replacements.indexOf(matched) + 1;
    return matched.build();
  });
}

function getPis(data) {
  return (data.plos || []).flatMap(plo => (
    (plo.pis || []).map(pi => ({
      ...pi,
      code: pi.pi_code || pi.code,
      plo_code: plo.code,
      plo_description: plo.description,
    }))
  ));
}

function poCodesForPlo(data, plo) {
  if (Array.isArray(plo.po_codes) && plo.po_codes.length) return plo.po_codes;
  return (data.poploMap || [])
    .filter(item => item.plo_code === plo.code)
    .map(item => item.po_code);
}

function courseCodes(value) {
  if (Array.isArray(value)) return value.join(', ');
  return value || '';
}

function buildGeneralInfoTable(data) {
  const version = data.version || {};
  const totalCredits = version.total_credits || version.program_total_credits || '';
  return table([
    ['1', 'Tên ngành đào tạo', `Tên tiếng Việt: ${version.program_name || ''}\nTên tiếng Anh: ${version.program_name_en || ''}`],
    ['2', 'Mã ngành', version.program_code || ''],
    ['3', 'Trường cấp bằng', version.institution || ''],
    ['4', 'Tên gọi văn bằng', version.degree_name || version.degree || ''],
    ['5', 'Trình độ đào tạo', version.degree || ''],
    ['6', 'Đơn vị quản lý', version.dept_name || ''],
    ['7', 'Số tín chỉ', totalCredits ? `${totalCredits} tín chỉ` : ''],
    ['8', 'Hình thức đào tạo', version.training_mode || ''],
    ['9', 'Thời gian đào tạo', version.training_duration || ''],
    ['10', 'Thang điểm', version.grading_scale || ''],
    ['11', 'Điều kiện tốt nghiệp', version.graduation_requirements || ''],
    ['12', 'Đối tượng tuyển sinh', version.admission_targets || ''],
    ['13', 'Tiêu chí tuyển sinh', version.admission_criteria || ''],
    ['14', 'Vị trí việc làm', version.job_positions || ''],
    ['15', 'Khả năng học tập nâng cao', version.further_education || ''],
    ['16', 'Chương trình tham khảo', version.reference_programs || ''],
    ['17', 'Quy trình đào tạo', version.training_process || ''],
  ]);
}

function buildPloTable(data) {
  return table([
    ['Chuẩn đầu ra (PLO)', 'Mô tả', 'Tương ứng với mục tiêu (PO)', 'Trình độ năng lực (*)'],
    ...(data.plos || []).map(plo => [
      plo.code,
      plo.description || '',
      poCodesForPlo(data, plo).join(', '),
      plo.bloom_level || '',
    ]),
  ]);
}

function buildPoPloTable(data) {
  const plos = data.plos || [];
  const map = new Set((data.poploMap || []).map(item => `${item.po_code}|${item.plo_code}`));
  return table([
    ['Mục tiêu (PO)', 'Mô tả', ...plos.map(plo => plo.code)],
    ...(data.objectives || []).map(po => [
      po.code,
      po.description || '',
      ...plos.map(plo => (map.has(`${po.code}|${plo.code}`) ? 'X' : '')),
    ]),
  ]);
}

function buildKnowledgeBlocksTable(data) {
  return table([
    ['Khối kiến thức', 'Số tín chỉ', 'Bắt buộc', 'Tự chọn'],
    ...(data.knowledgeBlocks || []).map(block => [
      block.name || '',
      block.total_credits || '',
      block.required_credits || '',
      block.elective_credits || '',
    ]),
  ]);
}

function buildCurriculumTable(data) {
  const rows = [['STT', 'Mã số HP', 'Tên học phần', 'Tổng', 'LT', 'TH/TN', 'ĐA', 'TT', 'Mã HP học trước', 'Mã HP song hành']];
  let index = 1;
  for (const course of data.courses || []) {
    rows.push([
      index++,
      course.course_code || '',
      course.course_name || '',
      course.credits || '',
      course.credits_theory || '',
      course.credits_practice || '',
      course.credits_project || '',
      course.credits_internship || '',
      courseCodes(course.prerequisite_codes),
      courseCodes(course.corequisite_codes),
    ]);
  }
  return table(rows);
}

function buildCoursePiTable(data) {
  const pis = getPis(data);
  const map = new Map((data.coursePiMap || []).map(item => [`${item.course_code}|${item.pi_code || item.code}`, item.contribution_level]));
  return table([
    ['Mã học phần', 'Học phần', ...pis.map(pi => pi.code)],
    ...(data.courses || []).map(course => [
      course.course_code || '',
      course.course_name || '',
      ...pis.map(pi => map.get(`${course.course_code}|${pi.code}`) || ''),
    ]),
  ]);
}

function buildCourseDescriptionsTable(data) {
  return table([
    ['STT', 'Mã học phần', 'Tên học phần', 'Mô tả tóm tắt'],
    ...(data.courses || []).map((course, index) => [
      index + 1,
      course.course_code || '',
      course.course_name || '',
      course.course_desc || '',
    ]),
  ]);
}

function buildTeachingPlanTable(data) {
  const rows = [['STT', 'Mã HP', 'Tên học phần', 'Số tín chỉ', 'Tổng số tiết', 'LT', 'TH/TN', 'ĐA', 'TT', 'Phần mềm cần cài đặt', 'Đơn vị quản lý giảng dạy', 'Ghi chú', 'Phân đợt']];
  let currentSemester = null;
  let index = 1;
  for (const course of [...(data.courses || [])].sort((a, b) => (a.semester || 99) - (b.semester || 99) || String(a.course_code).localeCompare(String(b.course_code)))) {
    if (course.semester !== currentSemester) {
      currentSemester = course.semester;
      rows.push([`Học kỳ ${currentSemester || ''}`, '', '', '', '', '', '', '', '', '', '', '', '']);
      index = 1;
    }
    rows.push([
      String(index++).padStart(2, '0'),
      course.course_code || '',
      course.course_name || '',
      course.credits || '',
      course.total_hours || '',
      course.hours_theory || '',
      course.hours_practice || '',
      course.hours_project || '',
      course.hours_internship || '',
      course.software || '',
      course.managing_dept || course.dept_code || course.dept_name || '',
      course.notes || '',
      course.batch || '',
    ]);
  }
  return table(rows);
}

function buildPiAppendixTable(data) {
  return table([
    ['Chuẩn đầu ra chương trình đào tạo (PLO)', 'Chỉ số đo lường (PI) (*)', 'Mô tả'],
    ...getPis(data).map(pi => [pi.plo_code || '', pi.code || '', pi.description || '']),
  ]);
}

function buildAssessmentTable(data) {
  return table([
    ['PLO (1)', 'PI (2)', 'Miêu tả (3)', 'Mã các học phần đóng góp (4)', 'Mã học phần lấy mẫu (5)', 'Minh chứng trực tiếp (6)', 'Công cụ đánh giá (7)', 'Tiêu chuẩn (Kết quả mong đợi) (8)', 'Kế hoạch đánh giá (9)', 'Giảng viên phụ trách (10)', 'Đơn vị quản lý học phần (11)'],
    ...(data.assessments || []).map(item => [
      item.plo_code || '',
      item.pi_code || '',
      item.criteria || '',
      item.contributing_course_codes || '',
      item.course_code || '',
      item.direct_evidence || '',
      item.assessment_tool || '',
      item.expected_result || item.threshold || '',
      item.semester || '',
      item.assessor || '',
      item.dept_code || '',
    ]),
  ]);
}

function buildStaticReplacements(data) {
  const version = data.version || {};
  return [
    ['Cử nhân Ngôn ngữ Trung Quốc', version.degree_name],
    ['Ngôn ngữ Trung Quốc', version.program_name],
    ['Chinese Language', version.program_name_en],
    ['7220204', version.program_code],
    ['Khoa Trung Quốc học', version.dept_name],
    ['3.5 năm', version.training_duration],
    ['Đào tạo cử nhân ngành Ngôn ngữ Trung Quốc có phẩm chất chính trị, đạo đức, có kiến thức toàn diện về văn hóa, khoa học xã hội và tự nhiên; có năng lực sử dụng tiếng Trung ở trình độ cao để giao tiếp hiệu quả trong các bối cảnh khác nhau; có kiến thức chuyên ngành và kỹ năng mềm đáp ứng nhu cầu phát triển kinh tế - xã hội và hội nhập quốc tế.', version.general_objective],
  ];
}

function buildTableReplacements(data) {
  return [
    { match: text => text.includes('tên ngành đào tạo') && text.includes('mã ngành'), build: () => buildGeneralInfoTable(data) },
    { match: text => text.includes('chuẩn đầu ra (plo)') && text.includes('trình độ năng lực'), build: () => buildPloTable(data) },
    { match: text => text.includes('mục tiêu (po)') && text.includes('chuẩn đầu ra (plo)'), build: () => buildPoPloTable(data) },
    { match: text => text.includes('khối kiến thức') && text.includes('số tín chỉ'), build: () => buildKnowledgeBlocksTable(data) },
    { match: text => text.includes('mã số hp') && text.includes('tên học phần') && text.includes('mã hp học trước'), build: () => buildCurriculumTable(data) },
    { match: text => text.includes('mã học phần') && text.includes('pi/cấp độ đóng góp'), build: () => buildCoursePiTable(data) },
    { match: text => text.includes('mô tả tóm tắt') && text.includes('tên học phần'), build: () => buildCourseDescriptionsTable(data) },
    { match: text => text.includes('tổng số tiết') && text.includes('phân bổ số tiết'), build: () => buildTeachingPlanTable(data) },
    { match: text => text.includes('chuẩn đầu ra chương trình đào tạo') && text.includes('chỉ số đo lường'), build: () => buildPiAppendixTable(data) },
    { match: text => text.includes('plo (1)') && text.includes('miêu tả (3)'), build: () => buildAssessmentTable(data) },
  ];
}

async function exportVersionToDocx(data, options = {}) {
  const templatePath = options.templatePath || DEFAULT_TEMPLATE;
  if (!fs.existsSync(templatePath)) {
    throw new Error(`DOCX template not found: ${templatePath}`);
  }

  const zip = await JSZip.loadAsync(await fs.promises.readFile(templatePath));
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) throw new Error('DOCX template is missing word/document.xml');

  let documentXml = await documentFile.async('string');
  documentXml = replaceLiteralXmlText(documentXml, buildStaticReplacements(data || {}));
  documentXml = replaceTables(documentXml, buildTableReplacements(data || {}));

  zip.file('word/document.xml', documentXml);
  return zip.generateAsync({ type: 'nodebuffer' });
}

module.exports = {
  exportVersionToDocx,
  xmlEscape,
  replaceLiteralXmlText,
};
