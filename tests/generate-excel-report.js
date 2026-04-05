const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function generateReport() {
  // Read CSV results
  const csvContent = fs.readFileSync(path.join(__dirname, 'test-cases.csv'), 'utf-8');
  const csvLines = csvContent.split('\n').filter(l => l.trim());
  const testCases = csvLines.slice(1).map(line => {
    const fields = parseCSVLine(line);
    return {
      id: fields[0],
      module: fields[1],
      name: fields[2],
      input: fields[3],
      expected: fields[4],
      result: fields[5] || '',
      date: fields[6] || '',
    };
  });

  // Define test steps for each case (simplified for automation)
  const stepsMap = buildStepsMap();

  const wb = new ExcelJS.Workbook();

  // Group test cases by module
  const modules = [...new Set(testCases.map(tc => tc.module))];

  for (const mod of modules) {
    const cases = testCases.filter(tc => tc.module === mod);
    const sheetName = mod.substring(0, 31); // Excel sheet name limit
    const ws = wb.addWorksheet(sheetName);

    // --- HEADER SECTION (rows 1-5) ---
    const headerFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    const headerFont = { size: 13, color: { argb: 'FFFFFFFF' }, name: 'Times New Roman', bold: true };
    const dataFont = { size: 12, name: 'Times New Roman' };
    const thinBorder = {
      top: { style: 'thin' }, bottom: { style: 'thin' },
      left: { style: 'thin' }, right: { style: 'thin' },
    };

    // Row 1: Project name
    ws.getCell('C1').value = 'Project name';
    ws.getCell('D1').value = 'HUTECH Program Management System';
    ws.getCell('D1').font = { ...dataFont, bold: true, size: 14 };

    // Row 2: TestCase
    ws.getCell('C2').value = 'TestCase';
    ws.getCell('D2').value = mod;
    ws.getCell('D2').font = { ...dataFont, bold: true };

    // Row 3: Creator
    ws.getCell('C3').value = 'Creator';
    ws.getCell('D3').value = 'Automation (Playwright)';

    // Row 4-5: Pass/Fail counts
    const passCount = cases.filter(c => c.result === 'Pass').length;
    const failCount = cases.filter(c => c.result === 'Fail').length;
    const skipCount = cases.filter(c => c.result === 'Skip').length;
    ws.getCell('C4').value = 'Passed';
    ws.getCell('D4').value = passCount;
    ws.getCell('D4').font = { ...dataFont, color: { argb: 'FF00B050' }, bold: true };
    ws.getCell('C5').value = 'Failed';
    ws.getCell('D5').value = failCount;
    ws.getCell('D5').font = { ...dataFont, color: { argb: 'FFFF0000' }, bold: true };
    ws.getCell('E4').value = 'Skipped';
    ws.getCell('F4').value = skipCount;
    ws.getCell('F4').font = { ...dataFont, color: { argb: 'FFFF8C00' }, bold: true };

    // Row 6: Platform group headers
    ws.mergeCells('I6:K6');
    ws.getCell('I6').value = 'Chromium (Playwright)';
    ws.getCell('I6').font = headerFont;
    ws.getCell('I6').fill = headerFill;
    ws.getCell('I6').alignment = { horizontal: 'center' };
    ws.getCell('L6').value = 'Date';
    ws.getCell('L6').font = headerFont;
    ws.getCell('L6').fill = headerFill;
    ws.getCell('M6').value = 'Note';
    ws.getCell('M6').font = headerFont;
    ws.getCell('M6').fill = headerFill;

    // Row 7: Column headers
    const headers = ['ID', 'Module', 'Loại', 'Mô tả', 'Điều kiện tiên quyết', 'Các bước thực hiện', 'Kết quả mong đợi', 'Dữ liệu test', 'Result', 'Status', 'Details', 'Date', 'Note'];
    const headerRow = ws.getRow(7);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = headerFont;
      cell.fill = headerFill;
      cell.border = thinBorder;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    });
    headerRow.height = 30;

    // Column widths
    ws.getColumn(1).width = 14;  // ID
    ws.getColumn(2).width = 18;  // Module
    ws.getColumn(3).width = 10;  // Type
    ws.getColumn(4).width = 40;  // Description
    ws.getColumn(5).width = 25;  // PreCondition
    ws.getColumn(6).width = 50;  // Steps
    ws.getColumn(7).width = 35;  // Expected
    ws.getColumn(8).width = 30;  // Test Data
    ws.getColumn(9).width = 10;  // Result
    ws.getColumn(10).width = 12; // Status (Pass/Fail/Skip)
    ws.getColumn(11).width = 20; // Details
    ws.getColumn(12).width = 14; // Date
    ws.getColumn(13).width = 20; // Note

    // --- DATA ROWS ---
    let currentRow = 8;
    for (const tc of cases) {
      const steps = stepsMap[tc.id] || { type: 'Positive', precondition: 'Đã đăng nhập', steps: tc.input, expected: tc.expected };
      const row = ws.getRow(currentRow);

      row.getCell(1).value = tc.id;
      row.getCell(1).font = { ...dataFont, bold: true };
      row.getCell(2).value = tc.module;
      row.getCell(3).value = steps.type;
      row.getCell(4).value = tc.name;
      row.getCell(4).alignment = { wrapText: true };
      row.getCell(5).value = steps.precondition;
      row.getCell(5).alignment = { wrapText: true };
      row.getCell(6).value = steps.steps;
      row.getCell(6).alignment = { wrapText: true, vertical: 'top' };
      row.getCell(7).value = tc.expected;
      row.getCell(7).alignment = { wrapText: true };
      row.getCell(8).value = tc.input;
      row.getCell(8).alignment = { wrapText: true };

      // Result column with color
      const resultCell = row.getCell(9);
      resultCell.value = tc.result || '';
      resultCell.alignment = { horizontal: 'center' };
      if (tc.result === 'Pass') {
        resultCell.font = { ...dataFont, color: { argb: 'FF00B050' }, bold: true };
        resultCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
      } else if (tc.result === 'Fail') {
        resultCell.font = { ...dataFont, color: { argb: 'FFFF0000' }, bold: true };
        resultCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE4EC' } };
      } else if (tc.result === 'Skip') {
        resultCell.font = { ...dataFont, color: { argb: 'FFFF8C00' }, bold: true };
        resultCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3E0' } };
      }

      // Status icon
      const statusCell = row.getCell(10);
      if (tc.result === 'Pass') statusCell.value = '✓ Passed';
      else if (tc.result === 'Fail') statusCell.value = '✗ Failed';
      else if (tc.result === 'Skip') statusCell.value = '⊘ Skipped';
      statusCell.alignment = { horizontal: 'center' };
      statusCell.font = resultCell.font;

      row.getCell(11).value = '';
      row.getCell(12).value = tc.date || '';
      row.getCell(12).alignment = { horizontal: 'center' };
      row.getCell(13).value = tc.result === 'Skip' ? 'Cần fixture files' : '';

      // Borders for all cells
      for (let c = 1; c <= 13; c++) {
        row.getCell(c).border = thinBorder;
        if (!row.getCell(c).font) row.getCell(c).font = dataFont;
      }

      row.height = 35;
      currentRow++;
    }

    // Freeze panes
    ws.views = [{ state: 'frozen', ySplit: 7 }];

    // Auto-filter
    ws.autoFilter = { from: 'A7', to: `M${currentRow - 1}` };
  }

  // === SUMMARY SHEET ===
  const summary = wb.addWorksheet('Tổng hợp');
  summary.getCell('A1').value = 'BÁO CÁO KẾT QUẢ KIỂM THỬ TỰ ĐỘNG';
  summary.getCell('A1').font = { size: 16, bold: true, name: 'Times New Roman' };
  summary.mergeCells('A1:F1');

  summary.getCell('A2').value = 'HUTECH Program Management System';
  summary.getCell('A2').font = { size: 13, name: 'Times New Roman', italic: true };

  summary.getCell('A3').value = `Ngày chạy: ${new Date().toLocaleDateString('vi-VN')}`;
  summary.getCell('A4').value = `Công cụ: Playwright ${require('@playwright/test/package.json').version}`;
  summary.getCell('A5').value = 'Trình duyệt: Chromium (headless)';

  // Summary table
  const summaryHeaders = ['Module', 'Tổng', 'Pass', 'Fail', 'Skip', 'Tỷ lệ Pass'];
  const summaryHeaderRow = summary.getRow(7);
  const headerFill2 = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
  const headerFont2 = { size: 12, color: { argb: 'FFFFFFFF' }, name: 'Times New Roman', bold: true };
  const thinBorder2 = { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } };

  summaryHeaders.forEach((h, i) => {
    const cell = summaryHeaderRow.getCell(i + 1);
    cell.value = h;
    cell.font = headerFont2;
    cell.fill = headerFill2;
    cell.border = thinBorder2;
    cell.alignment = { horizontal: 'center' };
  });

  summary.getColumn(1).width = 25;
  summary.getColumn(2).width = 10;
  summary.getColumn(3).width = 10;
  summary.getColumn(4).width = 10;
  summary.getColumn(5).width = 10;
  summary.getColumn(6).width = 15;

  let sRow = 8;
  let totalAll = 0, passAll = 0, failAll = 0, skipAll = 0;
  for (const mod of modules) {
    const cases = testCases.filter(tc => tc.module === mod);
    const pass = cases.filter(c => c.result === 'Pass').length;
    const fail = cases.filter(c => c.result === 'Fail').length;
    const skip = cases.filter(c => c.result === 'Skip').length;
    const total = cases.length;
    const rate = total > 0 ? ((pass / total) * 100).toFixed(1) + '%' : '0%';

    totalAll += total; passAll += pass; failAll += fail; skipAll += skip;

    const row = summary.getRow(sRow);
    row.getCell(1).value = mod;
    row.getCell(2).value = total;
    row.getCell(3).value = pass;
    row.getCell(3).font = { name: 'Times New Roman', color: { argb: 'FF00B050' }, bold: true };
    row.getCell(4).value = fail;
    row.getCell(4).font = { name: 'Times New Roman', color: { argb: 'FFFF0000' }, bold: fail > 0 };
    row.getCell(5).value = skip;
    row.getCell(5).font = { name: 'Times New Roman', color: { argb: 'FFFF8C00' } };
    row.getCell(6).value = rate;
    for (let c = 1; c <= 6; c++) {
      row.getCell(c).border = thinBorder2;
      row.getCell(c).alignment = { horizontal: c === 1 ? 'left' : 'center' };
    }
    sRow++;
  }

  // Total row
  const totalRow = summary.getRow(sRow);
  totalRow.getCell(1).value = 'TỔNG CỘNG';
  totalRow.getCell(1).font = { name: 'Times New Roman', bold: true, size: 13 };
  totalRow.getCell(2).value = totalAll;
  totalRow.getCell(2).font = { name: 'Times New Roman', bold: true, size: 13 };
  totalRow.getCell(3).value = passAll;
  totalRow.getCell(3).font = { name: 'Times New Roman', bold: true, size: 13, color: { argb: 'FF00B050' } };
  totalRow.getCell(4).value = failAll;
  totalRow.getCell(4).font = { name: 'Times New Roman', bold: true, size: 13, color: { argb: 'FFFF0000' } };
  totalRow.getCell(5).value = skipAll;
  totalRow.getCell(5).font = { name: 'Times New Roman', bold: true, size: 13, color: { argb: 'FFFF8C00' } };
  totalRow.getCell(6).value = totalAll > 0 ? ((passAll / totalAll) * 100).toFixed(1) + '%' : '0%';
  totalRow.getCell(6).font = { name: 'Times New Roman', bold: true, size: 13 };
  for (let c = 1; c <= 6; c++) {
    totalRow.getCell(c).border = thinBorder2;
    totalRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E2F3' } };
    totalRow.getCell(c).alignment = { horizontal: c === 1 ? 'left' : 'center' };
  }

  const outPath = path.join(__dirname, '..', 'TestReport.xlsx');
  await wb.xlsx.writeFile(outPath);
  console.log(`Report saved to: ${outPath}`);
  console.log(`Total: ${totalAll} | Pass: ${passAll} | Fail: ${failAll} | Skip: ${skipAll}`);
}

function buildStepsMap() {
  const map = {};
  // Authentication
  map['TC_AUTH_01'] = { type: 'Positive', precondition: 'Có tài khoản admin', steps: '1. Truy cập localhost:3600\n2. Nhập username: admin\n3. Nhập password: admin123\n4. Click Đăng nhập', expected: 'Sidebar hiển thị, dashboard load' };
  map['TC_AUTH_02'] = { type: 'Negative', precondition: 'Trang đăng nhập', steps: '1. Truy cập localhost:3600\n2. Để trống username\n3. Nhập password\n4. Click Đăng nhập', expected: 'Form không submit (HTML5 validation)' };
  map['TC_AUTH_03'] = { type: 'Negative', precondition: 'Trang đăng nhập', steps: '1. Truy cập localhost:3600\n2. Nhập username\n3. Để trống password\n4. Click Đăng nhập', expected: 'Form không submit (HTML5 validation)' };
  map['TC_AUTH_04'] = { type: 'Negative', precondition: 'Trang đăng nhập', steps: '1. Nhập username: admin\n2. Nhập password sai\n3. Click Đăng nhập', expected: 'Hiển thị lỗi đăng nhập' };
  map['TC_AUTH_05'] = { type: 'Negative', precondition: 'Trang đăng nhập', steps: '1. Nhập username không tồn tại\n2. Nhập password bất kỳ\n3. Click Đăng nhập', expected: 'Hiển thị lỗi đăng nhập' };
  map['TC_AUTH_06'] = { type: 'Positive', precondition: 'Đã đăng nhập', steps: '1. Click nút Đăng xuất', expected: 'Hiển thị form đăng nhập' };
  map['TC_AUTH_07'] = { type: 'Positive', precondition: 'Đã đăng nhập', steps: '1. Mở modal Đổi mật khẩu\n2. Nhập mật khẩu cũ\n3. Nhập mật khẩu mới\n4. Xác nhận mật khẩu\n5. Click Đổi', expected: 'Toast thành công' };
  map['TC_AUTH_08'] = { type: 'Negative', precondition: 'Đã đăng nhập', steps: '1. Mở modal Đổi MK\n2. Nhập sai mật khẩu cũ\n3. Click Đổi', expected: 'Hiển thị lỗi trong modal' };
  map['TC_AUTH_09'] = { type: 'Negative', precondition: 'Đã đăng nhập', steps: '1. Mở modal Đổi MK\n2. Nhập MK mới khác xác nhận\n3. Click Đổi', expected: 'Hiển thị lỗi trong modal' };
  map['TC_AUTH_10'] = { type: 'Edge', precondition: 'Trang đăng nhập', steps: '1. Nhập <script>alert(1)</script> vào username\n2. Click Đăng nhập', expected: 'Hiển thị lỗi, không XSS' };
  map['TC_AUTH_11'] = { type: 'Edge', precondition: 'Trang đăng nhập', steps: '1. Nhập chuỗi 1000 ký tự vào username\n2. Click Đăng nhập', expected: 'Hiển thị lỗi, không crash' };
  return map;
}

function parseCSVLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(current); current = ''; }
      else { current += ch; }
    }
  }
  fields.push(current);
  return fields;
}

generateReport().catch(console.error);
