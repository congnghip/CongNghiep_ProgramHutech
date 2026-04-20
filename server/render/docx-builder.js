const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, BorderStyle } = require('docx');

function p(text, opts = {}) {
  return new Paragraph({
    alignment: opts.align || AlignmentType.LEFT,
    spacing: { before: opts.before || 0, after: opts.after || 0 },
    children: [new TextRun({ text: String(text || ''), bold: !!opts.bold, italics: !!opts.italic, size: opts.size || 22 })],
  });
}

function tc(children, opts = {}) {
  const kids = Array.isArray(children) ? children : [children];
  const paras = kids.map(k => typeof k === 'string' ? p(k, { size: 22 }) : k);
  return new TableCell({
    children: paras,
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shading ? { fill: opts.shading } : undefined,
    columnSpan: opts.colSpan,
    rowSpan: opts.rowSpan,
  });
}

function row(cells) { return new TableRow({ children: cells }); }

function fullWidthTable(rows, opts = {}) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: opts.borders,
  });
}

function headerRow(labels) {
  return row(labels.map(l => tc(p(l, { bold: true }))));
}

const NO_BORDERS = {
  top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
  insideHorizontal: { style: BorderStyle.NONE }, insideVertical: { style: BorderStyle.NONE },
};

function buildDocx(model) {
  const children = [];

  children.push(p(model.form_code, { align: AlignmentType.RIGHT, italic: true }));
  children.push(p('TRƯỜNG ĐẠI HỌC CÔNG NGHỆ TP. HCM', { align: AlignmentType.CENTER, bold: true }));
  children.push(p((model.faculty || '').toUpperCase(), { align: AlignmentType.CENTER, bold: true }));
  children.push(p('ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN', { align: AlignmentType.CENTER, bold: true, size: 32, before: 200, after: 200 }));

  const isGen = model.course.knowledge_area === 'general';
  const isProf = model.course.knowledge_area === 'professional';
  const isReq = model.course.course_requirement === 'required';
  const isElec = model.course.course_requirement === 'elective';
  const chk = b => b ? '☑' : '☐';
  children.push(fullWidthTable([
    row([tc('1. Tên học phần', { width: 20 }), tc([p(`Tên tiếng Việt: ${model.course.name_vi || ''}`, { bold: true }), p(`Tên tiếng Anh: ${model.course.name_en || ''}`, { bold: true })])]),
    row([tc('2. Mã học phần'), tc(model.course.code || '')]),
    row([tc('3. Thuộc khối kiến thức'), tc(`${chk(isGen && isReq)} GD đại cương - Bắt buộc   ${chk(isGen && isElec)} GD đại cương - Tự chọn   ${chk(isProf && isReq)} GD chuyên nghiệp - Bắt buộc   ${chk(isProf && isElec)} GD chuyên nghiệp - Tự chọn`)]),
    row([tc('4. Trình độ đào tạo'), tc(model.course.training_level || '')]),
    row([tc('5. Số tín chỉ'), tc(model.course.credits_display || '')]),
    row([tc('6. Học phần học trước'), tc(model.course.prerequisites || '')]),
    row([tc('7. Mục tiêu của học phần'), tc(model.course.objectives || '')]),
    row([tc('8. Đơn vị quản lý học phần'), tc(model.course.managing_unit || '')]),
  ]));

  children.push(p('9. Bảng trích ngang ma trận sự đóng góp của mỗi học phần cho CĐR của CTĐT', { bold: true, before: 200 }));
  if (model.plo_matrix.pi_codes.length) {
    children.push(fullWidthTable([
      row([tc('Mã HP'), tc('Học phần'), ...model.plo_matrix.pi_codes.map(pi => tc(pi))]),
      row([tc(model.course.code || ''), tc(model.course.name_vi || ''), ...model.plo_matrix.pi_codes.map(pi => tc(model.plo_matrix.cell_values[pi] || '-'))]),
    ]));
  } else {
    children.push(p('(Chưa có CTĐT chuẩn để trích ma trận)', { italic: true }));
  }

  children.push(p('10. Chuẩn đầu ra của học phần (CLO)', { bold: true, before: 200 }));
  children.push(fullWidthTable([
    headerRow(['Chuẩn đầu ra học phần', 'PI', 'PLO']),
    ...model.clos.map(c => row([
      tc(`- ${c.code}: ${c.description || ''}`),
      tc(c.pi_codes.join(', ')),
      tc(c.plo_codes.join(', ')),
    ])),
  ]));

  children.push(p('11. Mô tả tóm tắt nội dung học phần', { bold: true, before: 200 }));
  children.push(p(model.course.description || ''));

  children.push(p('12. Phương pháp, hình thức tổ chức dạy học của học phần', { bold: true, before: 200 }));
  children.push(fullWidthTable([
    headerRow(['Phương pháp', 'Mục tiêu']),
    ...model.teaching_methods.map(t => row([tc(t.method), tc(t.objective)])),
  ]));

  children.push(p('13. Nội dung chi tiết học phần', { bold: true, before: 200 }));
  children.push(fullWidthTable([
    headerRow(['Bài số', 'Tên bài', 'LT', 'TH', 'Phương pháp', 'CĐR của HP']),
    ...model.outline.map(l => row([
      tc(`BÀI ${l.lesson}`),
      tc([p(l.title, { bold: true }), ...l.topics.map(t => p('• ' + t))]),
      tc(String(l.lt_hours)),
      tc(String(l.th_hours)),
      tc(l.teaching_methods || ''),
      tc(l.clo_codes.join('\n')),
    ])),
    row([tc(p('TỔNG CỘNG:', { bold: true }), { colSpan: 2 }), tc(p(String(model.outline_totals.lt), { bold: true })), tc(p(String(model.outline_totals.th), { bold: true })), tc(''), tc('')]),
  ]));

  children.push(p('14. Phương pháp kiểm tra/đánh giá của học phần', { bold: true, before: 200 }));
  const assessmentRows = [headerRow(['Điểm thành phần', 'Quy định', 'Bài đánh giá', 'Trọng số', 'CĐR'])];
  model.assessment_groups.forEach(g => {
    g.items.forEach((it, idx) => {
      const cells = [];
      if (idx === 0) cells.push(tc(g.component, { rowSpan: g.items.length }));
      cells.push(tc(it.description || ''));
      cells.push(tc(it.task_ref || ''));
      cells.push(tc(it.weight + '%'));
      cells.push(tc((it.clo_codes || []).join(', ')));
      assessmentRows.push(row(cells));
    });
  });
  children.push(fullWidthTable(assessmentRows));

  children.push(p('15. Tài liệu phục vụ học phần', { bold: true, before: 200 }));
  children.push(fullWidthTable([
    row([tc('Tài liệu/giáo trình chính', { width: 25 }), tc(model.resources.textbooks.map((t, i) => `${i+1}. ${t}`).join('\n') || '')]),
    row([tc('Tài liệu tham khảo/bổ sung'), tc(model.resources.references.map((t, i) => `${i+1}. ${t}`).join('\n') || '')]),
    row([tc('Các công cụ'), tc(model.resources.tools.map(g => `- ${g.category}: ${g.items.join(', ')}`).join('\n') || '')]),
  ]));

  children.push(p('16. Hướng dẫn sinh viên tự học', { bold: true, before: 200 }));
  children.push(fullWidthTable([
    headerRow(['Nội dung', 'Số tiết', 'Nhiệm vụ của sinh viên']),
    ...model.self_study.map(s => row([tc(`BÀI ${s.lesson}: ${s.title}`), tc(String(s.hours)), tc(s.tasks.join('\n'))])),
  ]));

  children.push(p('17. Các yêu cầu của HP', { bold: true, before: 200 }));
  children.push(p(model.other_requirements || ''));

  children.push(p(`TP. Hồ Chí Minh, ngày… tháng… năm ${new Date().getFullYear()}`, { align: AlignmentType.RIGHT, italic: true, before: 400 }));
  children.push(fullWidthTable([row([
    tc(p('Trưởng khoa/viện', { bold: true, align: AlignmentType.CENTER })),
    tc(p('Trưởng ngành/bộ môn', { bold: true, align: AlignmentType.CENTER })),
    tc(p('Người biên soạn', { bold: true, align: AlignmentType.CENTER })),
  ])], { borders: NO_BORDERS }));

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

module.exports = { buildDocx };
