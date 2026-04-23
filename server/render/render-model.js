const { upgradeContent } = require('./content-upgrade');

async function buildRenderModel(pool, courseId) {
  const courseRes = await pool.query(
    `SELECT c.*, d.name as dept_name, d.code as dept_code
     FROM courses c LEFT JOIN departments d ON c.department_id = d.id
     WHERE c.id = $1`, [courseId]
  );
  if (!courseRes.rows.length) throw new Error('Course not found: ' + courseId);
  const co = courseRes.rows[0];

  const bsRes = await pool.query('SELECT content FROM course_base_syllabi WHERE course_id = $1', [courseId]);
  const rawContent = bsRes.rows.length
    ? (typeof bsRes.rows[0].content === 'string' ? JSON.parse(bsRes.rows[0].content) : bsRes.rows[0].content)
    : {};
  const content = upgradeContent(rawContent);

  const closRes = await pool.query('SELECT * FROM base_syllabus_clos WHERE course_id = $1 ORDER BY code', [courseId]);
  const [ploMapRes, piMapRes] = await Promise.all([
    pool.query(
      `SELECT m.base_clo_id, vp.code FROM base_clo_plo_map m
       JOIN version_plos vp ON vp.id = m.plo_id
       JOIN base_syllabus_clos c ON c.id = m.base_clo_id
       WHERE c.course_id = $1 ORDER BY vp.code`, [courseId]
    ),
    pool.query(
      `SELECT m.base_clo_id, pp.pi_code AS code FROM base_clo_pi_map m
       JOIN plo_pis pp ON pp.id = m.pi_id
       JOIN base_syllabus_clos c ON c.id = m.base_clo_id
       WHERE c.course_id = $1 ORDER BY pp.pi_code`, [courseId]
    ),
  ]);
  const ploByClo = new Map();
  for (const r of ploMapRes.rows) {
    if (!ploByClo.has(r.base_clo_id)) ploByClo.set(r.base_clo_id, []);
    ploByClo.get(r.base_clo_id).push(r.code);
  }
  const piByClo = new Map();
  for (const r of piMapRes.rows) {
    if (!piByClo.has(r.base_clo_id)) piByClo.set(r.base_clo_id, []);
    piByClo.get(r.base_clo_id).push(r.code);
  }
  const clos = closRes.rows.map(clo => ({
    code: clo.code,
    description: clo.description,
    bloom_level: clo.bloom_level,
    plo_codes: ploByClo.get(clo.id) || [],
    pi_codes: piByClo.get(clo.id) || [],
  }));

  // PLO matrix row for mục 9 (trích ngang từ canonical version)
  let plo_matrix = { plo_codes: [], pi_codes: [], cell_values: {} };
  if (co.canonical_version_id) {
    const plos = await pool.query('SELECT code FROM version_plos WHERE version_id = $1 ORDER BY code', [co.canonical_version_id]);
    const pis = await pool.query(
      `SELECT pp.pi_code AS code, pp.plo_id FROM plo_pis pp
       JOIN version_plos vp ON vp.id = pp.plo_id
       WHERE vp.version_id = $1 ORDER BY pp.pi_code`, [co.canonical_version_id]
    );
    plo_matrix.plo_codes = plos.rows.map(r => r.code);
    plo_matrix.pi_codes = pis.rows.map(r => r.code);
    // Build cell values: for each PI column, highest bloom level of CLO mapping to that PI, else '-'
    for (const piCode of plo_matrix.pi_codes) {
      const mapped = clos.filter(c => c.pi_codes.includes(piCode));
      plo_matrix.cell_values[piCode] = mapped.length
        ? Math.max(...mapped.map(c => c.bloom_level || 1)).toString()
        : '-';
    }
  }

  // Assessment groups (group by component)
  const assessments = Array.isArray(content.assessment_methods) ? content.assessment_methods : [];
  const groupsMap = new Map();
  for (const a of assessments) {
    const key = a.component || '';
    if (!groupsMap.has(key)) groupsMap.set(key, []);
    groupsMap.get(key).push(a);
  }
  const assessment_groups = Array.from(groupsMap.entries()).map(([component, items]) => ({ component, items }));

  // Self-study derived from outline
  const outline = Array.isArray(content.course_outline) ? content.course_outline : [];
  const self_study = outline.map(l => ({
    lesson: l.lesson, title: l.title,
    hours: l.self_study_hours || 0,
    tasks: Array.isArray(l.self_study_tasks) ? l.self_study_tasks : [],
    topics: Array.isArray(l.topics) ? l.topics : [],
  }));

  const outline_totals = outline.reduce((acc, l) => ({
    lt: acc.lt + (l.lt_hours || 0),
    th: acc.th + (l.th_hours || 0),
  }), { lt: 0, th: 0 });

  const creditsDisplay = `${co.credits || 0} (${co.credits_theory || 0}, ${co.credits_practice || 0}) TC`;
  const facultyName = co.dept_name || '';

  return {
    form_code: 'BM03/QT2b/DBCL',
    faculty: facultyName,
    course: {
      code: co.code,
      name_vi: co.name,
      name_en: co.name_en,
      knowledge_area: co.knowledge_area,
      course_requirement: co.course_requirement,
      training_level: co.training_level || 'Đại học',
      credits_display: creditsDisplay,
      prerequisites: content.prerequisites || '',
      prerequisites_concurrent: content.prerequisites_concurrent || '',
      managing_unit: facultyName,
      objectives: content.course_objectives || '',
      description: content.course_description || '',
      language_instruction: content.language_instruction || '',
    },
    teaching_methods: Array.isArray(content.teaching_methods) ? content.teaching_methods : [],
    plo_matrix,
    clos,
    outline: outline.map(l => ({
      lesson: l.lesson, title: l.title,
      lt_hours: l.lt_hours || 0, th_hours: l.th_hours || 0,
      topics: Array.isArray(l.topics) ? l.topics : [],
      teaching_methods: l.teaching_methods || '',
      clo_codes: Array.isArray(l.clo_codes) ? l.clo_codes : [],
    })),
    outline_totals,
    assessment_groups,
    resources: {
      textbooks: Array.isArray(content.textbooks) ? content.textbooks : [],
      references: Array.isArray(content.references) ? content.references : [],
      tools: Array.isArray(content.tools) ? content.tools : [],
    },
    self_study,
    other_requirements: content.other_requirements || '',
    instructor: content.instructor || { name: '', title: '', address: '', phone: '', email: '', website: '' },
    assistant_instructor: content.assistant_instructor || { name: '', title: '', address: '', phone: '', email: '', website: '' },
    contact_info: content.contact_info || '',
    signature_date: content.signature_date || '',
    signatures: { date: content.signature_date || '', khoa_vien: '', nganh: '', nguoi_bien_soan: '' },
  };
}

module.exports = { buildRenderModel };
