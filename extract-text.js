const AdmZip = require('adm-zip');
const { XMLParser } = require('fast-xml-parser');
const fs = require('fs');

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: true
});

function extractText(obj) {
  if (typeof obj === 'string') return obj;
  if (typeof obj === 'number') return String(obj);
  if (Array.isArray(obj)) return obj.map(extractText).join(' ');
  if (obj && typeof obj === 'object') {
    if (obj['#text']) return obj['#text'];
    return Object.values(obj).map(extractText).join(' ');
  }
  return '';
}

function run() {
  const filePath = '/home/chinhan/VS_/CongNghiep_ProgramHutech/mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx';
  const zip = new AdmZip(fs.readFileSync(filePath));
  const contentXml = zip.readAsText('word/document.xml');
  const jsonData = xmlParser.parse(contentXml);
  const text = extractText(jsonData);
  fs.writeFileSync('doc.txt', text.replace(/\s+/g, ' '));
  console.log('done');
}
run();
