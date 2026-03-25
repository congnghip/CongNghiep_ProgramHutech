const fs = require('fs');

function assertIncludes(source, needle, message) {
  if (!source.includes(needle)) {
    throw new Error(message);
  }
}

const server = fs.readFileSync('server.js', 'utf8');
const app = fs.readFileSync('public/js/app.js', 'utf8');
const programsPage = fs.readFileSync('public/js/pages/programs.js', 'utf8');
const versionEditor = fs.readFileSync('public/js/pages/version-editor.js', 'utf8');
const dashboard = fs.readFileSync('public/js/pages/dashboard.js', 'utf8');
const matrixDoc = fs.readFileSync('docs/rbac-permission-matrix.md', 'utf8');
const reviewDoc = fs.readFileSync('docs/rbac-route-review-checklist.md', 'utf8');

// Former ui_only permissions
assertIncludes(server, "const canSubmit = deptId ? await hasPermission(req.user.id, 'programs.submit', deptId) : false;", 'programs.submit is not enforced in program submit flow');
assertIncludes(server, "app.get('/api/courses', authMiddleware, requirePerm('courses.view')", 'courses.view is not enforced on course catalog route');
assertIncludes(server, "app.get('/api/audit-logs', authMiddleware, requirePerm('rbac.view_audit_logs')", 'rbac.view_audit_logs is not enforced on audit log route');

// Former wrong_mapping permissions
assertIncludes(server, "app.get('/api/export/version/:vId', authMiddleware, requireViewVersion, requirePerm('programs.export')", 'programs.export is not enforced on export route');
assertIncludes(server, "app.post('/api/import/docx/session', authMiddleware, requirePerm('programs.import_word')", 'programs.import_word is not enforced on import session create');
assertIncludes(server, "app.post('/api/import/docx/session/:id/commit', authMiddleware, requirePerm('programs.import_word')", 'programs.import_word is not enforced on import commit');
assertIncludes(server, "const hasRoleBasedSyllabusView = await hasPermission(req.user.id, 'syllabus.view', syllabus.department_id);", 'syllabus.view is not enforced in requireViewSyllabus');
assertIncludes(server, "app.post('/api/versions/:vId/syllabi', authMiddleware, requireDraft('vId', 'syllabus.create')", 'syllabus.create is not enforced on syllabus creation');

// Program manage all semantics
assertIncludes(fs.readFileSync('db.js', 'utf8'), "OR ($2 LIKE 'programs.%' AND p.code = 'programs.manage_all')", 'programs.manage_all bypass semantics are missing');

// Frontend reflection
assertIncludes(app, "this.userPerms.includes('programs.manage_all')", 'frontend does not reflect programs.manage_all');
assertIncludes(programsPage, "window.App.hasPerm('programs.import_word')", 'program import UI is not gated by programs.import_word');
assertIncludes(versionEditor, "window.App.hasPerm('programs.export')", 'export button is not gated by programs.export');
assertIncludes(versionEditor, "window.App.hasPerm('syllabus.create')", 'syllabus create UI is not gated by syllabus.create');
assertIncludes(dashboard, "window.App.hasPerm('rbac.view_audit_logs')", 'dashboard activity is not gated by audit visibility');

// Documentation
for (const token of [
  'programs.submit',
  'courses.view',
  'rbac.view_audit_logs',
  'programs.export',
  'programs.import_word',
  'syllabus.view',
  'syllabus.create',
  'programs.manage_all',
  'portfolio.own',
  'portfolio.view_dept',
  'rbac.system_config'
]) {
  assertIncludes(matrixDoc, token, `permission matrix doc is missing ${token}`);
}
assertIncludes(reviewDoc, 'Route active phai dung dung ma quyen', 'route review checklist is incomplete');

console.log('RBAC_PERMISSION_ALIGNMENT_OK');
