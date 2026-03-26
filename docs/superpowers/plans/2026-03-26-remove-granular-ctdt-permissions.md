# Remove Granular CTDT Permissions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove 5 granular CTDT editing permissions (`programs.po.edit`, `programs.plo.edit`, `programs.courses.edit`, `programs.matrix.edit`, `programs.assessment.edit`) so that `programs.edit` alone controls all CTDT content editing. Syllabus permissions remain unchanged.

**Architecture:** Pure permission removal — delete permission codes from DB seed, remove granular permission params from all backend route checks (falling back to the existing `programs.edit` default), strip `editPerm` from frontend CTDT tabs, and simplify the `hasPerm()` hierarchy function.

**Tech Stack:** Node.js/Express backend, vanilla JS frontend, PostgreSQL

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `db.js` | Modify (lines 374-432) | Remove granular perms from seed data, cleanup query, role mappings |
| `server.js` | Modify (17 locations) | Remove granular perm params from route middleware/checks |
| `public/js/pages/version-editor.js` | Modify (lines 7-20) | Remove `editPerm` from CTDT tabs |
| `public/js/app.js` | Modify (lines 27-37) | Simplify `hasPerm()` hierarchy |
| `public/js/pages/rbac-admin.js` | Modify (line 383) | Remove `programs_granular` module label |

---

### Task 1: Clean up `db.js` seed data

**Files:**
- Modify: `db.js:374-432`

- [ ] **Step 1: Add cleanup query for `programs_granular` module**

At line 377, after the existing `DELETE` for `rbac`, add:

```js
  await client.query("DELETE FROM permissions WHERE module = 'programs_granular'");
```

- [ ] **Step 2: Remove 5 granular permission entries from `perms` array**

Delete lines 394-399 (the `// Granular Program Permissions (New)` comment and 5 entries):

```js
    // Granular Program Permissions (New)
    ['programs.po.edit', 'programs_granular', 'Chỉnh sửa Mục tiêu PO'],
    ['programs.plo.edit', 'programs_granular', 'Chỉnh sửa Chuẩn đầu ra PLO & PI'],
    ['programs.courses.edit', 'programs_granular', 'Chỉnh sửa Học phần & Kế hoạch GD'],
    ['programs.matrix.edit', 'programs_granular', 'Chỉnh sửa Ma trận liên kết (PO-PLO, HP-PLO)'],
    ['programs.assessment.edit', 'programs_granular', 'Chỉnh sửa Đánh giá CĐR'],
```

- [ ] **Step 3: Update permissions count comment**

Change line 374 from:

```js
  // Seed permissions (36)
```

to:

```js
  // Seed permissions (31)
```

- [ ] **Step 4: Remove `ctDtGranular` variable and spread references**

Delete line 425:

```js
  const ctDtGranular = ['programs.po.edit', 'programs.plo.edit', 'programs.courses.edit', 'programs.matrix.edit', 'programs.assessment.edit'];
```

Then remove `...ctDtGranular, ` from three role mappings:

**LANH_DAO_KHOA** (line 429) — change:
```js
    LANH_DAO_KHOA: ['programs.view_published', 'programs.view_draft', 'programs.create', 'programs.edit', 'programs.delete_draft', 'programs.submit', 'programs.approve_khoa', 'programs.export', 'programs.import_word', ...ctDtGranular, 'syllabus.view', 'syllabus.create', 'syllabus.edit', 'syllabus.submit', 'syllabus.approve_khoa', 'syllabus.assign', 'courses.view'],
```
to:
```js
    LANH_DAO_KHOA: ['programs.view_published', 'programs.view_draft', 'programs.create', 'programs.edit', 'programs.delete_draft', 'programs.submit', 'programs.approve_khoa', 'programs.export', 'programs.import_word', 'syllabus.view', 'syllabus.create', 'syllabus.edit', 'syllabus.submit', 'syllabus.approve_khoa', 'syllabus.assign', 'courses.view'],
```

**PHONG_DAO_TAO** (line 430) — change:
```js
    PHONG_DAO_TAO: ['programs.view_published', 'programs.view_draft', 'programs.create', 'programs.edit', 'programs.delete_draft', 'programs.approve_pdt', 'programs.export', 'programs.import_word', 'programs.manage_all', 'programs.create_version', ...ctDtGranular, 'syllabus.view', 'syllabus.create', 'syllabus.edit', 'syllabus.approve_pdt', 'syllabus.assign', 'courses.view', 'courses.create', 'courses.edit'],
```
to:
```js
    PHONG_DAO_TAO: ['programs.view_published', 'programs.view_draft', 'programs.create', 'programs.edit', 'programs.delete_draft', 'programs.approve_pdt', 'programs.export', 'programs.import_word', 'programs.manage_all', 'programs.create_version', 'syllabus.view', 'syllabus.create', 'syllabus.edit', 'syllabus.approve_pdt', 'syllabus.assign', 'courses.view', 'courses.create', 'courses.edit'],
```

**ADMIN** (line 432) — change:
```js
    ADMIN: ['programs.view_published', 'programs.view_draft', 'programs.delete_draft', 'programs.manage_all', 'programs.create_version', ...ctDtGranular, 'syllabus.view', 'courses.view'],
```
to:
```js
    ADMIN: ['programs.view_published', 'programs.view_draft', 'programs.delete_draft', 'programs.manage_all', 'programs.create_version', 'syllabus.view', 'courses.view'],
```

- [ ] **Step 5: Commit**

```bash
git add db.js
git commit -m "refactor: remove granular CTDT permissions from seed data"
```

---

### Task 2: Remove granular permission params from `server.js` routes

**Files:**
- Modify: `server.js` (17 locations)

- [ ] **Step 1: PO routes — remove `'programs.po.edit'` param (3 locations)**

**Line 745** — change:
```js
app.post('/api/versions/:vId/objectives', authMiddleware, requireDraft('vId', 'programs.po.edit'), async (req, res) => {
```
to:
```js
app.post('/api/versions/:vId/objectives', authMiddleware, requireDraft('vId'), async (req, res) => {
```

**Line 761** — change:
```js
    await checkVersionEditAccess(req.user.id, objRes.rows[0].version_id, 'programs.po.edit');
```
to:
```js
    await checkVersionEditAccess(req.user.id, objRes.rows[0].version_id);
```

**Line 775** — change:
```js
    await checkVersionEditAccess(req.user.id, objRes.rows[0].version_id, 'programs.po.edit');
```
to:
```js
    await checkVersionEditAccess(req.user.id, objRes.rows[0].version_id);
```

- [ ] **Step 2: PLO routes — remove `'programs.plo.edit'` param (3 locations)**

**Line 805** — change:
```js
    await checkVersionEditAccess(req.user.id, req.params.vId, 'programs.plo.edit');
```
to:
```js
    await checkVersionEditAccess(req.user.id, req.params.vId);
```

**Line 819** — change:
```js
    await checkVersionEditAccess(req.user.id, ploRes.rows[0].version_id, 'programs.plo.edit');
```
to:
```js
    await checkVersionEditAccess(req.user.id, ploRes.rows[0].version_id);
```

**Line 833** — change:
```js
    await checkVersionEditAccess(req.user.id, ploRes.rows[0].version_id, 'programs.plo.edit');
```
to:
```js
    await checkVersionEditAccess(req.user.id, ploRes.rows[0].version_id);
```

- [ ] **Step 3: PI routes — remove `'programs.plo.edit'` param (3 locations)**

**Line 848** — change:
```js
    await checkVersionEditAccess(req.user.id, versionId, 'programs.plo.edit');
```
to:
```js
    await checkVersionEditAccess(req.user.id, versionId);
```

**Line 889** — change:
```js
    await checkVersionEditAccess(req.user.id, versionId, 'programs.plo.edit');
```
to:
```js
    await checkVersionEditAccess(req.user.id, versionId);
```

**Line 923** — change:
```js
    await checkVersionEditAccess(req.user.id, ploRes.rows[0].version_id, 'programs.plo.edit');
```
to:
```js
    await checkVersionEditAccess(req.user.id, ploRes.rows[0].version_id);
```

- [ ] **Step 4: Course routes — remove `'programs.courses.edit'` param (3 locations)**

**Line 1024** — change:
```js
app.post('/api/versions/:vId/courses', authMiddleware, requireDraft('vId', 'programs.courses.edit'), async (req, res) => {
```
to:
```js
app.post('/api/versions/:vId/courses', authMiddleware, requireDraft('vId'), async (req, res) => {
```

**Line 1040** — change:
```js
    await checkVersionEditAccess(req.user.id, vcRes.rows[0].version_id, 'programs.courses.edit');
```
to:
```js
    await checkVersionEditAccess(req.user.id, vcRes.rows[0].version_id);
```

**Line 1054** — change:
```js
    await checkVersionEditAccess(req.user.id, vcRes.rows[0].version_id, 'programs.courses.edit');
```
to:
```js
    await checkVersionEditAccess(req.user.id, vcRes.rows[0].version_id);
```

- [ ] **Step 5: Matrix routes — remove `'programs.matrix.edit'` param (3 locations)**

**Line 1069** — change:
```js
app.put('/api/versions/:vId/po-plo-map', authMiddleware, requireDraft('vId', 'programs.matrix.edit'), async (req, res) => {
```
to:
```js
app.put('/api/versions/:vId/po-plo-map', authMiddleware, requireDraft('vId'), async (req, res) => {
```

**Line 1088** — change:
```js
app.put('/api/versions/:vId/course-plo-map', authMiddleware, requireDraft('vId', 'programs.matrix.edit'), async (req, res) => {
```
to:
```js
app.put('/api/versions/:vId/course-plo-map', authMiddleware, requireDraft('vId'), async (req, res) => {
```

**Line 1122** — change:
```js
app.put('/api/versions/:vId/course-pi-map', authMiddleware, requireDraft('vId', 'programs.matrix.edit'), async (req, res) => {
```
to:
```js
app.put('/api/versions/:vId/course-pi-map', authMiddleware, requireDraft('vId'), async (req, res) => {
```

- [ ] **Step 6: Assessment routes — remove `'programs.assessment.edit'` param (2 locations)**

**Line 1156** — change:
```js
app.post('/api/versions/:vId/assessments', authMiddleware, requireDraft('vId', 'programs.assessment.edit'), async (req, res) => {
```
to:
```js
app.post('/api/versions/:vId/assessments', authMiddleware, requireDraft('vId'), async (req, res) => {
```

**Line 1172** — change:
```js
    await checkVersionEditAccess(req.user.id, aRes.rows[0].version_id, 'programs.assessment.edit');
```
to:
```js
    await checkVersionEditAccess(req.user.id, aRes.rows[0].version_id);
```

- [ ] **Step 7: Commit**

```bash
git add server.js
git commit -m "refactor: use default programs.edit for all CTDT route checks"
```

---

### Task 3: Update frontend — version-editor tabs, hasPerm(), RBAC admin

**Files:**
- Modify: `public/js/pages/version-editor.js:7-20`
- Modify: `public/js/app.js:27-37`
- Modify: `public/js/pages/rbac-admin.js:383`

- [ ] **Step 1: Remove `editPerm` from all CTDT tabs in version-editor.js**

Replace lines 7-21 with:

```js
  tabs: [
    { key: 'info', label: 'Thông tin', viewPerm: 'programs.view_published' },
    { key: 'po', label: 'Mục tiêu PO', viewPerm: 'programs.view_published' },
    { key: 'plo', label: 'Chuẩn đầu ra PLO', viewPerm: 'programs.view_published' },
    { key: 'pi', label: 'Chỉ số PI', viewPerm: 'programs.view_published' },
    { key: 'po_plo', label: 'PO ↔ PLO', viewPerm: 'programs.view_published' },
    { key: 'knowledge_blocks', label: 'Khối KT', viewPerm: 'programs.view_published' },
    { key: 'courses', label: 'Học phần', viewPerm: 'programs.view_published' },
    { key: 'descriptions', label: 'Mô tả HP', viewPerm: 'programs.view_published' },
    { key: 'plan', label: 'Kế hoạch GD', viewPerm: 'programs.view_published' },
    { key: 'course_plo', label: 'HP ↔ PLO', viewPerm: 'programs.view_published' },
    { key: 'course_pi', label: 'HP ↔ PI', viewPerm: 'programs.view_published' },
    { key: 'assessment', label: 'Đánh giá CĐR', viewPerm: 'programs.view_published' },
    { key: 'syllabi', label: 'Đề cương', viewPerm: 'programs.view_published', editPerm: 'syllabus.edit' },
  ],
```

Note: Only the `syllabi` tab keeps `editPerm: 'syllabus.edit'`. The existing `tabEditable` logic at line 125 (`!tab.editPerm || window.App.hasPerm(tab.editPerm)`) will treat missing `editPerm` as `true`, so CTDT tabs become editable whenever `canEditStatus` is true (i.e., user has `programs.edit` for draft, or appropriate approval perm for other statuses).

- [ ] **Step 2: Simplify `hasPerm()` in app.js**

Replace lines 27-37 in `public/js/app.js`:

```js
    hasPerm(code) {
      if (this.isAdmin) return true;
      if (this.userPerms.includes(code)) return true;
      // HIERARCHY: programs.edit grants all programs.*.edit, syllabus.edit, and programs.view_*
      const isEditPerm = (code.startsWith('programs.') && code.endsWith('.edit')) || code === 'syllabus.edit';
      const isViewPerm = code === 'programs.view_published' || code === 'programs.view_draft';
      if (isEditPerm || isViewPerm) {
        return this.userPerms.includes('programs.edit');
      }
      return false;
    },
```

with:

```js
    hasPerm(code) {
      if (this.isAdmin) return true;
      if (this.userPerms.includes(code)) return true;
      // HIERARCHY: programs.edit grants view permissions
      const isViewPerm = code === 'programs.view_published' || code === 'programs.view_draft';
      if (isViewPerm) {
        return this.userPerms.includes('programs.edit');
      }
      return false;
    },
```

- [ ] **Step 3: Remove `programs_granular` module label in rbac-admin.js**

Delete line 383:
```js
      programs_granular: 'CTĐT (Soạn thảo chi tiết)',
```

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/version-editor.js public/js/app.js public/js/pages/rbac-admin.js
git commit -m "refactor: remove granular CTDT permissions from frontend"
```

---

### Task 4: Manual verification

- [ ] **Step 1: Start the app and verify DB cleanup**

```bash
make dev
```

Then check that granular permissions are removed from the database:

```bash
make db-shell
# Then run:
SELECT * FROM permissions WHERE module = 'programs_granular';
# Expected: 0 rows
SELECT * FROM permissions WHERE code = 'programs.edit';
# Expected: 1 row
```

- [ ] **Step 2: Verify RBAC admin page**

Open `http://localhost:3600` → login as admin → RBAC Admin page.
Verify that the "CTĐT (Soạn thảo chi tiết)" permission group no longer appears in the matrix.

- [ ] **Step 3: Verify version editor editing**

Navigate to a draft CTDT version. As a user with `programs.edit`:
- Verify PO, PLO, PI, Courses, Matrices, Assessment tabs are all editable
- Verify the Đề cương tab still requires `syllabus.edit` separately

- [ ] **Step 4: Verify user without `programs.edit` cannot edit**

Log in as a user without `programs.edit` (e.g., GIANG_VIEN role). Verify CTDT content tabs are read-only.
