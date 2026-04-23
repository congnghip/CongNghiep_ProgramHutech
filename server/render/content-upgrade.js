// Upgrade base syllabus content from v2 → v3 → v4.
// v2 shape (partial): { hours, learning_methods, course_requirements: {software, hardware, lab_equipment, classroom_setup}, assessment_methods[].assessment_tool }
// v3 shape: see spec section 5.3.
// v4 shape: adds prerequisites_concurrent, instructor, assistant_instructor, contact_info, signature_date

const INSTRUCTOR_EMPTY = { name: '', title: '', address: '', phone: '', email: '', website: '' };

function normalizeInstructor(v) {
  if (!v || typeof v !== 'object') return { ...INSTRUCTOR_EMPTY };
  return {
    name: v.name || '',
    title: v.title || '',
    address: v.address || '',
    phone: v.phone || '',
    email: v.email || '',
    website: v.website || '',
  };
}

function upgradeContent(content) {
  const c = content && typeof content === 'object' ? { ...content } : {};
  if (c._schema_version >= 4) return c;

  // v2 → v3 migrations (skip for data already at v3+)
  if ((c._schema_version || 0) < 3) {
    // Outline: hours → lt_hours, th_hours=0; add self_study_*, clo_codes
    if (Array.isArray(c.course_outline)) {
      c.course_outline = c.course_outline.map(l => ({
        lesson: l.lesson,
        title: l.title || '',
        lt_hours: typeof l.lt_hours === 'number' ? l.lt_hours : (l.hours || 0),
        th_hours: typeof l.th_hours === 'number' ? l.th_hours : 0,
        topics: Array.isArray(l.topics) ? l.topics : [],
        teaching_methods: l.teaching_methods || '',
        clo_codes: Array.isArray(l.clo_codes) ? l.clo_codes : (Array.isArray(l.clos) ? l.clos : []),
        self_study_hours: typeof l.self_study_hours === 'number' ? l.self_study_hours : 0,
        self_study_tasks: Array.isArray(l.self_study_tasks) ? l.self_study_tasks : [],
      }));
    }

    // learning_methods: string → teaching_methods[]
    if (!Array.isArray(c.teaching_methods)) {
      const raw = typeof c.learning_methods === 'string'
        ? c.learning_methods
        : (Array.isArray(c.learning_methods) ? c.learning_methods.join('\n') : '');
      c.teaching_methods = raw
        .split('\n').map(s => s.trim()).filter(Boolean)
        .map(line => ({ method: line, objective: '' }));
    }
    delete c.learning_methods;

    // course_requirements.* → tools[], other_requirements
    if (!Array.isArray(c.tools)) {
      const req = c.course_requirements || {};
      const tools = [];
      if (Array.isArray(req.software) && req.software.length) tools.push({ category: 'Phần mềm', items: req.software });
      if (Array.isArray(req.hardware) && req.hardware.length) tools.push({ category: 'Phần cứng', items: req.hardware });
      if (Array.isArray(req.lab_equipment) && req.lab_equipment.length) tools.push({ category: 'Thiết bị phòng thí nghiệm', items: req.lab_equipment });
      c.tools = tools;
      if (req.classroom_setup && !c.other_requirements) {
        c.other_requirements = 'Yêu cầu phòng học: ' + req.classroom_setup;
      }
    }
    delete c.course_requirements;

    // assessment_methods: assessment_tool → description; add task_ref, clo_codes
    if (Array.isArray(c.assessment_methods)) {
      c.assessment_methods = c.assessment_methods.map(a => ({
        component: a.component || '',
        description: a.description || a.assessment_tool || '',
        task_ref: a.task_ref || '',
        weight: typeof a.weight === 'number' ? a.weight : parseInt(a.weight) || 0,
        clo_codes: Array.isArray(a.clo_codes) ? a.clo_codes : (Array.isArray(a.clos) ? a.clos : []),
      }));
    }

    if (typeof c.other_requirements !== 'string') c.other_requirements = c.other_requirements || '';
    if (!Array.isArray(c.tools)) c.tools = [];
  }

  // v3 → v4: prerequisites_concurrent, instructor, assistant_instructor, contact_info, signature_date
  if (!c.prerequisites_concurrent) c.prerequisites_concurrent = '';
  c.instructor = normalizeInstructor(c.instructor);
  c.assistant_instructor = normalizeInstructor(c.assistant_instructor);
  if (!c.contact_info) c.contact_info = '';
  if (!c.signature_date) c.signature_date = '';

  c._schema_version = 4;
  return c;
}

module.exports = { upgradeContent };
