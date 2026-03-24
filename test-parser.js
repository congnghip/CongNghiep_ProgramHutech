const docxParser = require('./services/docx-parser');
const fs = require('fs');
const path = require('path');

async function test() {
  const testFile = path.join(__dirname, 'test.docx');
  if (!fs.existsSync(testFile)) {
    console.log('No test.docx found, skipping parser test.');
    return;
  }

  const buffer = fs.readFileSync(testFile);
  try {
    const data = await docxParser.parseDocx(buffer);
    console.log('Parsed Data:');
    console.log('POs:', data.pos.length);
    console.log('PLOs:', data.plos.length);
    console.log('Courses:', data.courses.length);
    // console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Parser Error:', e);
  }
}

test();
