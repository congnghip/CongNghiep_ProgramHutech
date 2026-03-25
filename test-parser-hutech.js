const docxParser = require('./services/docx-parser');
const fs = require('fs');
const path = require('path');

async function test() {
  const testFile = path.join(__dirname, 'test-chuong-trinh-cntt-rut-gon.docx');
  const buffer = fs.readFileSync(testFile);
  try {
    const data = await docxParser.parseDocx(buffer);
    fs.writeFileSync('output-rut-gon.json', JSON.stringify(data, null, 2));
    console.log('Done writing to output-rut-gon.json');
    console.log('POs:', data.pos.length);
    console.log('PLOs:', data.plos.length);
    console.log('PIs:', data.pis ? data.pis.length : 0);
    console.log('Courses:', data.courses.length);
  } catch (e) {
    console.error('Parser Error:', e);
  }
}

test();
