const syllabusPdfImport = require('../services/syllabus-pdf-import');
const assert = require('assert');

async function testDataModelSync() {
  console.log('--- Starting Data Model Sync Test ---');

  // 1. Test normalizeCanonicalPayload
  console.log('1. Testing normalizeCanonicalPayload...');
  const rawPayload = {
    schedule: [
      {
        week: 1,
        topic: 'Topic 1',
        content: 'Content 1',
        theory_hours: 2,
        practice_hours: 1,
        teaching_method: 'Method 1',
        materials: 'Materials 1',
        clos: 'CLO1'
      }
    ]
  };

  const normalized = syllabusPdfImport.normalizeCanonicalPayload(rawPayload);
  const item = normalized.schedule[0];

  assert.strictEqual(item.week, 1, 'week mismatch');
  assert.strictEqual(item.topic, 'Topic 1', 'topic mismatch');
  assert.strictEqual(item.content, 'Content 1', 'content mismatch');
  assert.strictEqual(item.theory_hours, 2, 'theory_hours mismatch');
  assert.strictEqual(item.practice_hours, 1, 'practice_hours mismatch');
  assert.strictEqual(item.teaching_method, 'Method 1', 'teaching_method mismatch');
  assert.strictEqual(item.materials, 'Materials 1', 'materials mismatch');
  assert.strictEqual(item.clos, 'CLO1', 'clos mismatch');
  console.log('✓ normalizeCanonicalPayload preserved all 8 fields');

  // 2. Test buildCanonicalPayloadFromAi
  console.log('2. Testing buildCanonicalPayloadFromAi transformation logic...');
  const aiPayload = {
    course_outline: [
      {
        week: 2,
        topic: 'Topic 2',
        content: 'Content 2',
        hours: { theory: 3, practice: 0 },
        teaching_method: 'Method 2',
        materials: 'Materials 2',
        clo_mapping: ['CLO2']
      }
    ]
  };

  const aiResult = syllabusPdfImport.buildCanonicalPayloadFromAi(aiPayload);
  const aiItem = aiResult.schedule[0];

  assert.strictEqual(aiItem.week, 2, 'AI week mismatch');
  assert.strictEqual(aiItem.topic, 'Topic 2', 'AI topic mismatch');
  assert.strictEqual(aiItem.content, 'Content 2', 'AI content mismatch');
  assert.strictEqual(aiItem.theory_hours, 3, 'AI theory_hours mismatch');
  assert.strictEqual(aiItem.practice_hours, 0, 'AI practice_hours mismatch');
  assert.strictEqual(aiItem.teaching_method, 'Method 2', 'AI teaching_method mismatch');
  assert.strictEqual(aiItem.materials, 'Materials 2', 'AI materials mismatch');
  assert.strictEqual(aiItem.clos, 'CLO2', 'AI clos mismatch');
  console.log('✓ buildCanonicalPayloadFromAi correctly maps all 8 fields');

  // 3. Test mapPayloadToSyllabusContent
  console.log('3. Testing mapPayloadToSyllabusContent...');
  const finalContent = syllabusPdfImport.mapPayloadToSyllabusContent(normalized);
  const finalItem = finalContent.schedule[0];

  assert.strictEqual(finalItem.week, 1, 'final week mismatch');
  assert.strictEqual(finalItem.topic, 'Topic 1', 'final topic mismatch');
  assert.strictEqual(finalItem.content, 'Content 1', 'final content mismatch');
  assert.strictEqual(finalItem.theory_hours, 2, 'final theory_hours mismatch');
  assert.strictEqual(finalItem.practice_hours, 1, 'final practice_hours mismatch');
  assert.strictEqual(finalItem.teaching_method, 'Method 1', 'final teaching_method mismatch');
  assert.strictEqual(finalItem.materials, 'Materials 1', 'final materials mismatch');
  assert.strictEqual(finalItem.clos, 'CLO1', 'final clos mismatch');
  console.log('✓ mapPayloadToSyllabusContent preserved all 8 fields for DB');

  console.log('\nALL BACKEND DATA SYNC TESTS PASSED ✓');
}

testDataModelSync().catch(err => {
  console.error('\nTest Failed:', err.message);
  if (err.actual !== undefined) {
    console.error(`  Expected: ${JSON.stringify(err.expected)}`);
    console.error(`  Actual:   ${JSON.stringify(err.actual)}`);
  }
  process.exit(1);
});
