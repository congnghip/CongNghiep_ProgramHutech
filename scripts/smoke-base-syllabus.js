// Smoke test for base syllabus full template endpoints.
// Usage: TOKEN=<jwt> COURSE_ID=3 VERSION_ID=5 PLO_ID=10 PI_ID=20 node scripts/smoke-base-syllabus.js

const http = require('http');

const BASE = process.env.BASE_URL || 'http://localhost:3600';
const TOKEN = process.env.TOKEN;
const COURSE_ID = parseInt(process.env.COURSE_ID || '3');
const VERSION_ID = parseInt(process.env.VERSION_ID || '0');
const PLO_ID = parseInt(process.env.PLO_ID || '0');
const PI_ID = parseInt(process.env.PI_ID || '0');

if (!TOKEN) { console.error('Set TOKEN env var'); process.exit(1); }

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: { 'Cookie': `token=${TOKEN}`, 'Content-Type': 'application/json' },
    };
    const r = http.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        resolve({ status: res.statusCode, body: buf, json: () => { try { return JSON.parse(buf.toString()); } catch (_) { return null; } } });
      });
    });
    r.on('error', reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function expect(label, promise, check) {
  const r = await promise;
  const ok = check(r);
  console.log(`${ok ? '✓' : '✗'} ${label} (status ${r.status})`);
  if (!ok) { console.log('  body:', r.body.toString().substring(0, 200)); process.exitCode = 1; }
  return r;
}

(async () => {
  // 1. GET base syllabus returns v3 content
  await expect('GET base-syllabus upgrades to v3', req('GET', `/api/courses/${COURSE_ID}/base-syllabus`),
    r => r.status === 200 && (r.json()?.content?._schema_version === 3 || r.status === 404));

  // 2. PUT course with master fields
  if (VERSION_ID) {
    await expect('PUT course master fields', req('PUT', `/api/courses/${COURSE_ID}`, {
      name_en: 'Smoke Test Course', knowledge_area: 'professional', course_requirement: 'required',
      training_level: 'Đại học', canonical_version_id: VERSION_ID,
    }), r => r.status === 200 && r.json()?.name_en === 'Smoke Test Course');
  }

  // 3. CLO + mappings
  const cloRes = await expect('POST base CLO', req('POST', `/api/courses/${COURSE_ID}/base-syllabus/clos`, {
    code: 'CLO_SMOKE', description: 'Smoke test CLO', bloom_level: 2,
  }), r => r.status === 200 && r.json()?.id);
  const cloId = cloRes.json().id;

  if (PLO_ID && PI_ID) {
    await expect('PUT CLO mappings', req('PUT', `/api/base-clos/${cloId}/mappings`, {
      plo_ids: [PLO_ID], pi_ids: [PI_ID],
    }), r => r.status === 200);
    await expect('GET CLO mappings', req('GET', `/api/base-clos/${cloId}/mappings`),
      r => r.status === 200 && r.json()?.plo_ids?.includes(PLO_ID));
  }

  // 4. Validate
  await expect('POST validate', req('POST', `/api/courses/${COURSE_ID}/base-syllabus/validate`),
    r => r.status === 200 && typeof r.json()?.ok === 'boolean');

  // 5. Render model
  await expect('GET render-model', req('GET', `/api/courses/${COURSE_ID}/base-syllabus/render-model`),
    r => r.status === 200 && r.json()?.course?.code);

  // 6. PDF export
  await expect('GET export.pdf', req('GET', `/api/courses/${COURSE_ID}/base-syllabus/export.pdf`),
    r => r.status === 200 && r.body.slice(0, 4).toString() === '%PDF');

  // 7. DOCX export
  await expect('GET export.docx', req('GET', `/api/courses/${COURSE_ID}/base-syllabus/export.docx`),
    r => r.status === 200 && r.body.slice(0, 2).toString('hex') === '504b');  // ZIP magic (DOCX is ZIP)

  // Cleanup
  await req('DELETE', `/api/base-clos/${cloId}`);
  console.log('\nSmoke test complete.');
})();
