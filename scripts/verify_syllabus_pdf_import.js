const fs = require('fs');
const path = require('path');
const syllabusPdfImport = require('../services/syllabus-pdf-import');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8'));
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function includesNormalized(haystack, needle) {
  return normalize(haystack).includes(normalize(needle));
}

function uniqueSortedNumbers(values) {
  return [...new Set((values || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b);
}

function scoreFixture(expected, actual) {
  let score = 0;
  const mismatches = [];

  if (actual.course_identity.course_code === expected.course_code) {
    score += 15;
  } else {
    mismatches.push(`course_code expected=${expected.course_code} actual=${actual.course_identity.course_code || 'null'}`);
  }

  if (includesNormalized(actual.course_identity.course_name_vi, expected.course_name_vi_contains)) {
    score += 10;
  } else {
    mismatches.push(`course_name expected contains "${expected.course_name_vi_contains}"`);
  }

  if (Number(actual.course_identity.credits) === Number(expected.credits)) {
    score += 10;
  } else {
    mismatches.push(`credits expected=${expected.credits} actual=${actual.course_identity.credits}`);
  }

  if (!expected.prerequisites_contains || includesNormalized(actual.general.prerequisites, expected.prerequisites_contains)) {
    score += 5;
  } else {
    mismatches.push(`prerequisites expected contains "${expected.prerequisites_contains}"`);
  }

  const cloPoints = 25 / expected.clos.length;
  expected.clos.forEach(clo => {
    const actualClo = (actual.clos || []).find(item => item.code === clo.code);
    if (actualClo && includesNormalized(actualClo.description, clo.description_contains)) {
      score += cloPoints;
    } else {
      mismatches.push(`CLO ${clo.code} missing snippet "${clo.description_contains}"`);
    }
  });

  if ((actual.schedule || []).length >= expected.min_schedule_count) {
    score += 15;
  } else {
    mismatches.push(`schedule count expected>=${expected.min_schedule_count} actual=${(actual.schedule || []).length}`);
  }

  const actualWeights = uniqueSortedNumbers((actual.assessments || []).map(item => item.weight));
  const expectedWeights = uniqueSortedNumbers(expected.assessment_weights);
  const sharedWeightCount = expectedWeights.filter(weight => actualWeights.includes(weight)).length;
  score += (sharedWeightCount / Math.max(expectedWeights.length, 1)) * 10;
  if (sharedWeightCount !== expectedWeights.length) {
    mismatches.push(`assessment weights expected=${expectedWeights.join(',')} actual=${actualWeights.join(',') || 'none'}`);
  }

  const textbookChecks = expected.textbooks_contains || [];
  if (textbookChecks.every(item => includesNormalized(actual.resources?.textbooks, item))) {
    score += 10;
  } else if (textbookChecks.length) {
    mismatches.push(`textbooks missing expected snippet(s): ${textbookChecks.join('; ')}`);
  } else {
    score += 10;
  }

  const toolChecks = expected.tools_contains || [];
  if (toolChecks.length === 0 || toolChecks.every(item => includesNormalized(actual.resources?.tools, item))) {
    score += 10;
  } else {
    mismatches.push(`tools missing expected snippet(s): ${toolChecks.join('; ')}`);
  }

  return {
    score: Number(score.toFixed(2)),
    mismatches
  };
}

async function runFixtureChecks() {
  const manifest = readJson('tests/fixtures/syllabus-pdf/manifest.json');
  const expectedReview = readJson('tests/fixtures/syllabus-pdf/expected-review.json');
  const fixtureMap = new Map(expectedReview.fixtures.map(item => [item.id, item.expected]));
  const results = [];

  for (const fixture of manifest.fixtures) {
    const pdfPath = path.join(__dirname, '..', fixture.pdfPath);
    const buffer = fs.readFileSync(pdfPath);
    const { canonical } = await syllabusPdfImport.processPdfImportWithMode({ buffer, mode: 'mock' });
    const expectation = fixtureMap.get(fixture.id);
    const scored = scoreFixture(expectation, canonical);
    results.push({
      id: fixture.id,
      pdfPath: fixture.pdfPath,
      score: scored.score,
      mismatches: scored.mismatches,
      notes: fixture.difficultyNotes
    });
  }

  return results;
}

async function runNegativeChecks() {
  const checks = [];

  try {
    await syllabusPdfImport.processPdfImportWithMode({ buffer: Buffer.alloc(0), mode: 'mock' });
    checks.push({ name: 'empty-buffer', ok: false, detail: 'Expected an error for empty input.' });
  } catch (error) {
    checks.push({ name: 'empty-buffer', ok: /Không tìm thấy nội dung file PDF/i.test(error.message), detail: error.message });
  }

  try {
    await syllabusPdfImport.processPdfImportWithMode({
      buffer: Buffer.alloc(syllabusPdfImport.MAX_PDF_SIZE_BYTES + 1),
      mode: 'mock'
    });
    checks.push({ name: 'oversize-buffer', ok: false, detail: 'Expected an error for oversized input.' });
  } catch (error) {
    checks.push({ name: 'oversize-buffer', ok: /15MB/i.test(error.message), detail: error.message });
  }

  const invalidPayload = syllabusPdfImport.normalizeCanonicalPayload({
    course_identity: { course_code: 'AIT129', course_name_vi: 'Demo', credits: 3 },
    clos: [
      { code: 'CLO1', description: 'A' },
      { code: 'CLO1', description: 'B' }
    ],
    assessments: [{ component: 'Quiz', weight: 80 }],
    target: {}
  });
  const validation = syllabusPdfImport.validateCanonicalPayload(invalidPayload, [], []);
  checks.push({
    name: 'validation-duplicate-clo',
    ok: validation.errors.some(item => /bị trùng/i.test(item.msg)),
    detail: validation.errors.map(item => item.msg).join(' | ')
  });
  checks.push({
    name: 'validation-missing-target',
    ok: validation.errors.some(item => /học phần đích/i.test(item.msg)),
    detail: validation.errors.map(item => item.msg).join(' | ')
  });

  const sampleText = 'Mã học phần AIT129\nTên tiếng Việt: Trí tuệ nhân tạo ứng dụng\n';
  const reparsed = await syllabusPdfImport.reprocessPdfTextWithMode({
    extractionText: sampleText,
    mode: 'mock'
  });
  checks.push({
    name: 'retry-path-mock',
    ok: reparsed.course_identity.course_code === 'AIT129',
    detail: reparsed.course_identity.course_code || 'null'
  });

  return checks;
}

async function main() {
  const fixtureResults = await runFixtureChecks();
  const negativeChecks = await runNegativeChecks();
  const averageScore = fixtureResults.reduce((sum, item) => sum + item.score, 0) / Math.max(fixtureResults.length, 1);

  const report = {
    generated_at: new Date().toISOString(),
    average_score: Number(averageScore.toFixed(2)),
    fixture_results: fixtureResults,
    negative_checks: negativeChecks,
    summary: {
      passed_negative_checks: negativeChecks.filter(item => item.ok).length,
      total_negative_checks: negativeChecks.length
    }
  };

  console.log(JSON.stringify(report, null, 2));

  const hasFailedNegative = negativeChecks.some(item => !item.ok);
  if (averageScore < 85 || hasFailedNegative) {
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
