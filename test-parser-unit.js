const { parseDocx } = require('./services/docx-parser');
const AdmZip = require('adm-zip');
const assert = require('node:assert');

function buildDocx(xmlContent, extraFiles = {}) {
  const zip = new AdmZip();
  zip.addFile('word/document.xml', Buffer.from(xmlContent));
  Object.entries(extraFiles).forEach(([name, content]) => {
    zip.addFile(name, Buffer.from(content));
  });
  return zip.toBuffer();
}

async function runCase(name, xmlContent, verify, extraFiles = {}) {
  const data = await parseDocx(buildDocx(xmlContent, extraFiles));
  verify(data);
  console.log(`  pass: ${name}`);
}

async function testParser() {
  console.log('🧪 Testing DOCX Parser Logic with realistic variants...');

  await runCase('extracts full program name and course credits/semester', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>CHƯƠNG TRÌNH ĐÀO TẠO NGÀNH CÔNG NGHỆ THÔNG TIN</w:t></w:r></w:p>
        <w:p><w:r><w:t>Mã ngành: 7480201</w:t></w:r></w:p>
        <w:p><w:r><w:t>Năm học: 2025 - 2026</w:t></w:r></w:p>
        <w:p><w:r><w:t>Tổng số tín chỉ: 132</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Mục tiêu</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Kiến thức nền tảng</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Chuẩn đầu ra</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PLO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Kỹ năng giải quyết vấn đề</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Mã học phần</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tên học phần</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Số tín chỉ</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Học kỳ</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>IT001</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tin học cơ sở</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>3</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
  `, data => {
    assert.strictEqual(data.program_name, 'CHƯƠNG TRÌNH ĐÀO TẠO NGÀNH CÔNG NGHỆ THÔNG TIN');
    assert.strictEqual(data.program_code, '7480201');
    assert.strictEqual(data.academic_year, '2025-2026');
    assert.strictEqual(data.total_credits, 132);
    assert.strictEqual(data.pos.length, 1);
    assert.strictEqual(data.pos[0].code, 'PO1');
    assert.strictEqual(data.plos.length, 1);
    assert.strictEqual(data.plos[0].code, 'PLO1');
    assert.strictEqual(data.courses.length, 1);
    assert.strictEqual(data.courses[0].course_code, 'IT001');
    assert.strictEqual(data.courses[0].credits, 3);
    assert.strictEqual(data.courses[0].semester, 1);
  });

  await runCase('supports label variants and skips PO/PLO header rows', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Tên ngành: Hệ thống thông tin</w:t></w:r></w:p>
        <w:p><w:r><w:t>Mã CTĐT: HTTT01</w:t></w:r></w:p>
        <w:p><w:r><w:t>Tổng tín chỉ: 120</w:t></w:r></w:p>
        <w:p><w:r><w:t>Năm học 2026-2027</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Mục tiêu (PO)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Nền tảng</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PO2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Chuyên sâu</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PLO</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Bloom</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PLO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>4</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Phân tích</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
  `, data => {
    assert.strictEqual(data.program_name, 'Hệ thống thông tin');
    assert.strictEqual(data.program_code, 'HTTT01');
    assert.strictEqual(data.total_credits, 120);
    assert.strictEqual(data.academic_year, '2026-2027');
    assert.deepStrictEqual(data.pos.map(item => item.code), ['PO1', 'PO2']);
    assert.deepStrictEqual(data.plos.map(item => item.code), ['PLO1']);
    assert.strictEqual(data.plos[0].bloom_level, 4);
  });

  await runCase('supports course header variants like Mã HP and HK', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Ngành Trí tuệ nhân tạo</w:t></w:r></w:p>
        <w:p><w:r><w:t>Mã ngành - AI2025</w:t></w:r></w:p>
        <w:p><w:r><w:t>Số tín chỉ: 9</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Mã HP</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tên môn học</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tín chỉ</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>HK</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>AI101</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Nhập môn AI</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>3 TC</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>HK 2</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
  `, data => {
    assert.strictEqual(data.program_code, 'AI2025');
    assert.strictEqual(data.total_credits, 9);
    assert.strictEqual(data.courses.length, 1);
    assert.strictEqual(data.courses[0].course_code, 'AI101');
    assert.strictEqual(data.courses[0].course_name, 'Nhập môn AI');
    assert.strictEqual(data.courses[0].credits, 3);
    assert.strictEqual(data.courses[0].semester, 2);
  });

  await runCase('reads metadata from header/footer parts when main body lacks it', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Mục tiêu</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Nền tảng</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
  `, data => {
    assert.strictEqual(data.program_name, 'Logistics');
    assert.strictEqual(data.program_code, 'LOG2026');
    assert.strictEqual(data.academic_year, '2026-2027');
  }, {
    'word/header1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:p><w:r><w:t>Tên ngành: Logistics</w:t></w:r></w:p>
        <w:p><w:r><w:t>Mã CTĐT: LOG2026</w:t></w:r></w:p>
      </w:hdr>`,
    'word/footer1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
      <w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
        <w:p><w:r><w:t>Năm học: 2026-2027</w:t></w:r></w:p>
      </w:ftr>`
  });

  await runCase('chooses the best matching table instead of a weak partial match', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:p><w:r><w:t>Tên ngành: Kỹ thuật phần mềm</w:t></w:r></w:p>
        <w:p><w:r><w:t>Mã ngành: SE2026</w:t></w:r></w:p>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Chuẩn đầu ra</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Ghi chú</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Thông tin</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Không phải PLO</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Chuẩn đầu ra</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PLO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Phân tích</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PLO2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Thiết kế</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
  `, data => {
    assert.deepStrictEqual(data.plos.map(item => item.code), ['PLO1', 'PLO2']);
  });

  await runCase('maps metadata, PO-PLO, PI, course matrix and semester plan from a realistic curriculum layout', `
    <?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tên ngành đào tạo</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tên tiếng Việt: Ngôn ngữ Trung Quốc</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mã ngành</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>7220204</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>3</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Trình độ đào tạo</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Đại học</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>4</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Số tín chỉ</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>125 tín chỉ</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Chuẩn đầu ra (PLO)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tương ứng với mục tiêu (PO)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Trình độ năng lực (*)</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PLO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả PLO 1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PO1, PO4</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>3</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PLO2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả PLO 2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PO2, PO3</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>5</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Mục tiêu (PO)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Chuẩn đầu ra (PLO)</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PLO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PLO2</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mục tiêu 1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>X</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PO2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mục tiêu 2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>X</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Mã học phần</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Học phần</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Chuẩn đầu ra (PLO)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Chuẩn đầu ra (PLO)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Chuẩn đầu ra (PLO)</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PLO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PLO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PLO2</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t></w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PI1.01</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>1.2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PI2.01</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>CHN107</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tiếng Trung 1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>STT</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mã HP</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tên học phần</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Số tín chỉ</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Học kỳ 1</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>CHN107</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tiếng Trung 1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>3</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>Chuẩn đầu ra chương trình đào tạo (PLO)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Chỉ số đo lường (PI)</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PLO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả PLO 1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PI1.01 Mô tả PI 1&#10;PI1.02 Mô tả PI 2</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PLO2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả PLO 2</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PI2.01 Mô tả PI 3</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
        <w:tbl>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PLO (1)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PI (2)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Miêu tả (3)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mã các học phần đóng góp (4)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mã học phần lấy mẫu (5)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Minh chứng trực tiếp (6)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Công cụ đánh giá (7)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tiêu chuẩn (8)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Kế hoạch đánh giá (9)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Giảng viên phụ trách (10)</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Đơn vị quản lý học phần (11)</w:t></w:r></w:p></w:tc>
          </w:tr>
          <w:tr>
            <w:tc><w:p><w:r><w:t>PLO1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>PI1.01</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Mô tả</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>CHN107</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>CHN107</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Câu hỏi</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Rubric</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>Tối thiểu 70%</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>HK1 / năm 1</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>GV A</w:t></w:r></w:p></w:tc>
            <w:tc><w:p><w:r><w:t>K.TQH</w:t></w:r></w:p></w:tc>
          </w:tr>
        </w:tbl>
      </w:body>
    </w:document>
  `, data => {
    assert.strictEqual(data.program_name, 'Ngôn ngữ Trung Quốc');
    assert.strictEqual(data.program_code, '7220204');
    assert.strictEqual(data.total_credits, 125);
    assert.deepStrictEqual(data.pos.map(item => item.code), ['PO1', 'PO2', 'PO4', 'PO3']);
    assert.deepStrictEqual(data.plos.map(item => item.code), ['PLO1', 'PLO2']);
    assert.strictEqual(data.po_plo_map.length, 4);
    assert.strictEqual(data.courses.length, 1);
    assert.strictEqual(data.courses[0].course_code, 'CHN107');
    assert.strictEqual(data.courses[0].semester, 1);
    assert.strictEqual(data.pis.length, 3);
    assert.strictEqual(data.course_plo_map.length, 2);
    assert.strictEqual(data.course_pi_map.length, 3);
    assert.strictEqual(data.assessments.length, 1);
    assert.strictEqual(data.assessments[0].course_code, 'CHN107');
  });

  console.log('✅ Parser logic tests passed!');
}

testParser().catch(err => {
  console.error('❌ Parser test runner failed:');
  console.error(err.stack || err.message);
  process.exit(1);
});
