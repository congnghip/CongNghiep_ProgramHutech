# Proposed Courses (Học phần đề xuất) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow CTDT authors to add proposed courses (without official codes) to program versions, draft full syllabi for them, and have Phòng Đào tạo assign official codes during approval.

**Architecture:** Extend the existing `courses` table to allow `code = NULL` with `is_proposed = true`. All existing relationships (version_courses, version_syllabi, course_clos, CLO-PLO mapping) work unchanged. New API endpoints handle the proposed course lifecycle. PDT gets a code-assignment UI and approval is blocked until all proposed courses have codes.

**Tech Stack:** Express.js, PostgreSQL 15, vanilla JS SPA frontend

**Spec:** `docs/superpowers/specs/2026-04-13-proposed-courses-design.md`

---

### Task 1: Schema Changes in db.js

**Files:**
- Modify: `db.js:145` (courses table — make code nullable)
- Modify: `db.js:308` (after existing ALTER TABLE statements — add new columns)
- Modify: `db.js:434-436` (permissions seed — add new permission codes)
- Modify: `db.js:449-455` (role-permission mapping — assign new permissions to roles)

- [ ] **Step 1: Make `code` column nullable in CREATE TABLE**

In `db.js:145`, change:
```javascript
        code VARCHAR(20) UNIQUE NOT NULL,
```
to:
```javascript
        code VARCHAR(20) UNIQUE,
```

- [ ] **Step 2: Add ALTER TABLE statements for new columns**

After `db.js:308` (`ALTER TABLE programs ADD COLUMN IF NOT EXISTS archived_at ...`), add:
```javascript
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS is_proposed BOOLEAN DEFAULT false;
      ALTER TABLE courses ADD COLUMN IF NOT EXISTS proposed_by_version_id INT REFERENCES program_versions(id);
```

- [ ] **Step 3: Drop the NOT NULL constraint for existing databases**

After the ALTER TABLE statements from step 2, add:
```javascript
      -- Remove NOT NULL from code for existing databases
      ALTER TABLE courses ALTER COLUMN code DROP NOT NULL;
```

- [ ] **Step 4: Add new permission codes to the permissions seed array**

In `db.js`, after line 436 (`['courses.edit', 'courses', 'Chỉnh sửa học phần'],`), add:
```javascript
    ['courses.propose', 'courses', 'Đề xuất học phần mới'],
    ['courses.assign_code', 'courses', 'Gán mã học phần đề xuất'],
```

- [ ] **Step 5: Assign new permissions to roles**

In `db.js`, update the `rolePerms` object:

- Add `'courses.propose'` to `GIANG_VIEN` array (after `'courses.view'`)
- Add `'courses.propose'` to `TRUONG_NGANH` array (after `'courses.view'`)
- Add `'courses.propose'` to `LANH_DAO_KHOA` array (after `'courses.view'`)
- Add `'courses.propose'`, `'courses.assign_code'` to `PHONG_DAO_TAO` array (after `'courses.edit'`)

Updated lines:
```javascript
    GIANG_VIEN: ['programs.view_published', 'syllabus.view', 'syllabus.create', 'syllabus.edit', 'syllabus.submit', 'courses.view', 'courses.propose'],
    TRUONG_NGANH: ['programs.view_published', 'programs.view_draft', 'syllabus.view', 'syllabus.approve_tbm', 'syllabus.assign', 'courses.view', 'courses.propose'],
    LANH_DAO_KHOA: ['programs.view_published', 'programs.view_draft', 'programs.create', 'programs.edit', 'programs.delete_draft', 'programs.submit', 'programs.approve_khoa', 'programs.export', 'programs.import_word', 'syllabus.view', 'syllabus.create', 'syllabus.edit', 'syllabus.submit', 'syllabus.approve_khoa', 'syllabus.assign', 'courses.view', 'courses.propose'],
    PHONG_DAO_TAO: ['programs.view_published', 'programs.view_draft', 'programs.create', 'programs.edit', 'programs.delete_draft', 'programs.approve_pdt', 'programs.export', 'programs.import_word', 'programs.manage_all', 'programs.create_version', 'syllabus.view', 'syllabus.create', 'syllabus.edit', 'syllabus.approve_pdt', 'syllabus.assign', 'courses.view', 'courses.create', 'courses.edit', 'courses.propose', 'courses.assign_code'],
```

- [ ] **Step 6: Commit**

```bash
git add db.js
git commit -m "feat: schema changes for proposed courses — nullable code, new permissions"
```

---

### Task 2: New Backend API Routes — CRUD for Proposed Courses

**Files:**
- Modify: `server.js` (after course routes ~line 1074, add new endpoints)

- [ ] **Step 1: Add POST /api/versions/:vId/proposed-courses**

Add after the `DELETE /api/courses/:id` route (after `server.js:1074`):

```javascript
// ===== Proposed Courses =====
app.post('/api/versions/:vId/proposed-courses', authMiddleware, requireDraft(), requirePerm('courses.propose'), async (req, res) => {
  const { name, credits, credits_theory, credits_practice, credits_project, credits_internship, department_id, description, semester, course_type } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên học phần là bắt buộc' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const courseRes = await client.query(
      `INSERT INTO courses (name, credits, credits_theory, credits_practice, credits_project, credits_internship, department_id, description, is_proposed, proposed_by_version_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true,$9) RETURNING *`,
      [name, credits || 3, credits_theory || 0, credits_practice || 0, credits_project || 0, credits_internship || 0, department_id, description, req.params.vId]
    );
    const course = courseRes.rows[0];
    const vcRes = await client.query(
      `INSERT INTO version_courses (version_id, course_id, semester, course_type) VALUES ($1,$2,$3,$4) RETURNING *`,
      [req.params.vId, course.id, semester || 1, course_type || 'required']
    );
    await client.query('COMMIT');
    res.json({ course, version_course: vcRes.rows[0] });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});
```

- [ ] **Step 2: Add GET /api/versions/:vId/proposed-courses**

```javascript
app.get('/api/versions/:vId/proposed-courses', authMiddleware, requireViewVersion, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, vc.id as version_course_id, vc.semester, vc.course_type, d.name as dept_name
      FROM version_courses vc
      JOIN courses c ON vc.course_id = c.id
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE vc.version_id = $1 AND c.is_proposed = true
      ORDER BY c.name
    `, [req.params.vId]);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Add PUT /api/proposed-courses/:courseId**

```javascript
app.put('/api/proposed-courses/:courseId', authMiddleware, requirePerm('courses.propose'), async (req, res) => {
  const { name, credits, credits_theory, credits_practice, credits_project, credits_internship, department_id, description } = req.body;
  try {
    // Validate: must be a proposed course
    const check = await pool.query('SELECT id, proposed_by_version_id FROM courses WHERE id=$1 AND is_proposed=true', [req.params.courseId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Học phần đề xuất không tồn tại' });
    // Validate: version must be in draft
    const vId = check.rows[0].proposed_by_version_id;
    await checkVersionEditAccess(req.user.id, vId, 'courses.propose');
    const result = await pool.query(
      `UPDATE courses SET name=$1, credits=$2, credits_theory=$3, credits_practice=$4, credits_project=$5, credits_internship=$6, department_id=$7, description=$8 WHERE id=$9 RETURNING *`,
      [name, credits || 3, credits_theory || 0, credits_practice || 0, credits_project || 0, credits_internship || 0, department_id, description, req.params.courseId]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 4: Add DELETE /api/proposed-courses/:courseId**

```javascript
app.delete('/api/proposed-courses/:courseId', authMiddleware, requirePerm('courses.propose'), async (req, res) => {
  const client = await pool.connect();
  try {
    const check = await client.query('SELECT id, proposed_by_version_id FROM courses WHERE id=$1 AND is_proposed=true', [req.params.courseId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Học phần đề xuất không tồn tại' });
    const vId = check.rows[0].proposed_by_version_id;
    await checkVersionEditAccess(req.user.id, vId, 'courses.propose');
    await client.query('BEGIN');
    // Delete in correct order: syllabi first (references courses.id), then version_courses (cascades to course_clos), then courses
    await client.query('DELETE FROM version_syllabi WHERE course_id=$1 AND version_id=$2', [req.params.courseId, vId]);
    await client.query('DELETE FROM version_courses WHERE course_id=$1 AND version_id=$2', [req.params.courseId, vId]);
    await client.query('DELETE FROM courses WHERE id=$1', [req.params.courseId]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});
```

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: CRUD API endpoints for proposed courses"
```

---

### Task 3: Backend API — Assign Code & Merge

**Files:**
- Modify: `server.js` (add after proposed course CRUD routes)

- [ ] **Step 1: Add POST /api/proposed-courses/:courseId/assign-code**

```javascript
app.post('/api/proposed-courses/:courseId/assign-code', authMiddleware, requirePerm('courses.assign_code'), async (req, res) => {
  const { code } = req.body;
  if (!code || !code.trim()) return res.status(400).json({ error: 'Mã học phần là bắt buộc' });
  try {
    // Validate: must be proposed
    const check = await pool.query('SELECT id FROM courses WHERE id=$1 AND is_proposed=true', [req.params.courseId]);
    if (!check.rows.length) return res.status(404).json({ error: 'Học phần đề xuất không tồn tại' });
    // Validate: code must be unique among official courses
    const dup = await pool.query('SELECT id FROM courses WHERE code=$1', [code.trim()]);
    if (dup.rows.length) return res.status(400).json({ error: `Mã "${code.trim()}" đã tồn tại trong danh mục` });
    const result = await pool.query(
      'UPDATE courses SET code=$1, is_proposed=false, proposed_by_version_id=NULL WHERE id=$2 RETURNING *',
      [code.trim(), req.params.courseId]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 2: Add POST /api/proposed-courses/:courseId/merge**

```javascript
app.post('/api/proposed-courses/:courseId/merge', authMiddleware, requirePerm('courses.assign_code'), async (req, res) => {
  const { target_course_id } = req.body;
  if (!target_course_id) return res.status(400).json({ error: 'Cần chọn học phần đích' });
  const client = await pool.connect();
  try {
    // Validate: source must be proposed
    const srcCheck = await client.query('SELECT id, proposed_by_version_id FROM courses WHERE id=$1 AND is_proposed=true', [req.params.courseId]);
    if (!srcCheck.rows.length) return res.status(404).json({ error: 'Học phần đề xuất không tồn tại' });
    const vId = srcCheck.rows[0].proposed_by_version_id;
    // Validate: target must be official
    const tgtCheck = await client.query('SELECT id FROM courses WHERE id=$1 AND is_proposed=false', [target_course_id]);
    if (!tgtCheck.rows.length) return res.status(400).json({ error: 'Học phần đích không tồn tại hoặc chưa chính thức' });
    // Validate: no syllabus conflict — target course must not have a syllabus in this version
    const conflict = await client.query(
      'SELECT id FROM version_syllabi WHERE version_id=$1 AND course_id=$2', [vId, target_course_id]
    );
    if (conflict.rows.length) return res.status(400).json({ error: 'Học phần đích đã có đề cương trong phiên bản này. Vui lòng xử lý xung đột trước.' });
    // Validate: target course must not already be in this version
    const vcConflict = await client.query(
      'SELECT id FROM version_courses WHERE version_id=$1 AND course_id=$2', [vId, target_course_id]
    );
    if (vcConflict.rows.length) return res.status(400).json({ error: 'Học phần đích đã có trong phiên bản CTĐT này.' });

    await client.query('BEGIN');
    // Update version_courses: change course_id from proposed to target (keeps same vc.id so course_clos stay intact)
    await client.query(
      'UPDATE version_courses SET course_id=$1 WHERE course_id=$2 AND version_id=$3',
      [target_course_id, req.params.courseId, vId]
    );
    // Update version_syllabi: change course_id from proposed to target
    await client.query(
      'UPDATE version_syllabi SET course_id=$1 WHERE course_id=$2 AND version_id=$3',
      [target_course_id, req.params.courseId, vId]
    );
    // Delete the proposed course record
    await client.query('DELETE FROM courses WHERE id=$1', [req.params.courseId]);
    await client.query('COMMIT');
    res.json({ success: true, target_course_id });
  } catch (e) {
    await client.query('ROLLBACK');
    res.status(400).json({ error: e.message });
  } finally { client.release(); }
});
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: assign-code and merge API for proposed courses"
```

---

### Task 4: Modify Existing Backend Routes

**Files:**
- Modify: `server.js:1004-1024` (GET /api/courses — add is_proposed filter)
- Modify: `server.js:1026-1035` (GET /api/courses/all — add is_proposed filter)
- Modify: `server.js:1077-1091` (GET /api/versions/:vId/courses — add is_proposed to response)
- Modify: `server.js:2404-2423` (POST /api/approval/review — block approve if proposed courses remain)

- [ ] **Step 1: Filter proposed courses from GET /api/courses**

In `server.js:1004-1024`, add `AND (c.is_proposed = false OR c.is_proposed IS NULL)` to both query branches.

The scoped query (with deptIds) becomes:
```sql
SELECT c.*, d.name as dept_name, d.code as dept_code
FROM courses c LEFT JOIN departments d ON c.department_id = d.id
WHERE c.department_id = ANY($1) AND c.is_proposed = false
ORDER BY c.code
```

The unscoped query becomes:
```sql
SELECT c.*, d.name as dept_name, d.code as dept_code
FROM courses c LEFT JOIN departments d ON c.department_id = d.id
WHERE c.is_proposed = false
ORDER BY c.code
```

- [ ] **Step 2: Filter proposed courses from GET /api/courses/all**

In `server.js:1026-1035`, change the query to:
```sql
SELECT c.*, d.name as dept_name, d.code as dept_code
FROM courses c LEFT JOIN departments d ON c.department_id = d.id
WHERE c.is_proposed = false
ORDER BY c.code
```

- [ ] **Step 3: Add is_proposed field to GET /api/versions/:vId/courses**

In `server.js:1077-1091`, add `c.is_proposed` to the SELECT clause:
```sql
SELECT vc.*, c.code as course_code, c.name as course_name, c.credits,
       c.credits_theory, c.credits_practice, c.credits_project, c.credits_internship,
       c.description as course_desc, c.is_proposed, d.name as dept_name
FROM version_courses vc
JOIN courses c ON vc.course_id = c.id
LEFT JOIN departments d ON c.department_id = d.id
WHERE vc.version_id = $1
ORDER BY vc.semester, c.code
```

- [ ] **Step 4: Block PDT approval if proposed courses exist**

In `server.js`, inside the `POST /api/approval/review` handler, after `nextStatus` is determined (~line 2423 `if (!nextStatus) return ...`), add a check before the UPDATE:

```javascript
    // Block approval if proposed courses still exist (for program_version approval at PDT level)
    if (entity_type === 'program_version' && (status === 'approved_khoa' || status === 'approved_pdt')) {
      const proposedCheck = await pool.query(`
        SELECT COUNT(*) as cnt FROM version_courses vc
        JOIN courses c ON c.id = vc.course_id
        WHERE vc.version_id = $1 AND c.is_proposed = true
      `, [entity_id]);
      if (parseInt(proposedCheck.rows[0].cnt) > 0) {
        return res.status(400).json({
          error: `Còn ${proposedCheck.rows[0].cnt} học phần đề xuất chưa được gán mã. Vui lòng gán mã trước khi duyệt.`
        });
      }
    }
```

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: filter proposed courses from catalog, add is_proposed to version courses, block approval"
```

---

### Task 5: Frontend — Propose Course UI in Version Editor

**Files:**
- Modify: `public/js/pages/version-editor.js:701-764` (courses tab — add propose button + modal)

- [ ] **Step 1: Add "Đề xuất HP mới" button to the courses tab**

In `version-editor.js`, inside `renderCoursesTab()`, after the existing "Thêm HP" section (line 725 `<button ... onclick="...addCourse()">Thêm</button>`), and before the closing `</div>` of the add bar (line 726), add a second button:

Change line 725 from:
```javascript
          <button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.addCourse()">Thêm</button>
```
to:
```javascript
          <button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.addCourse()">Thêm</button>
          <button class="btn btn-secondary btn-sm" style="margin-left:8px;" onclick="window.VersionEditorPage.showProposeCourseModal()">Đề xuất HP mới</button>
```

- [ ] **Step 2: Add the propose course modal method**

After the `removeCourse()` method (~line 774 area), add:

```javascript
  showProposeCourseModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'propose-course-modal';
    modal.innerHTML = `
      <div class="modal" style="max-width:520px;">
        <div class="modal-header"><h2>Đề xuất học phần mới</h2></div>
        <div class="modal-body">
          <div class="input-group"><label>Tên học phần *</label><input type="text" id="pc-name" placeholder="Nhập tên học phần"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 1fr;gap:8px;">
            <div class="input-group"><label>Tín chỉ</label><input type="number" id="pc-credits" value="3" min="1"></div>
            <div class="input-group"><label>LT</label><input type="number" id="pc-lt" value="0" min="0"></div>
            <div class="input-group"><label>TH</label><input type="number" id="pc-th" value="0" min="0"></div>
            <div class="input-group"><label>ĐA</label><input type="number" id="pc-da" value="0" min="0"></div>
            <div class="input-group"><label>TT</label><input type="number" id="pc-tt" value="0" min="0"></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
            <div class="input-group"><label>HK</label>
              <select id="pc-sem">${[1,2,3,4,5,6,7,8].map(s => `<option value="${s}">HK ${s}</option>`).join('')}</select>
            </div>
            <div class="input-group"><label>Loại</label>
              <select id="pc-type"><option value="required">Bắt buộc</option><option value="elective">Tự chọn</option></select>
            </div>
            <div class="input-group"><label>Khoa/Viện</label>
              <select id="pc-dept"><option value="">— Chọn —</option></select>
            </div>
          </div>
          <div class="input-group"><label>Mô tả</label><textarea id="pc-desc" rows="2" placeholder="Mô tả ngắn (tùy chọn)"></textarea></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('propose-course-modal').remove()">Hủy</button>
          <button class="btn btn-primary" onclick="window.VersionEditorPage.saveProposedCourse()">Tạo đề xuất</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    // Load departments into dropdown
    fetch('/api/departments').then(r => r.json()).then(depts => {
      const sel = document.getElementById('pc-dept');
      (Array.isArray(depts) ? depts : []).forEach(d => {
        sel.innerHTML += `<option value="${d.id}">${d.name}</option>`;
      });
    });
  },

  async saveProposedCourse() {
    const name = document.getElementById('pc-name').value.trim();
    if (!name) return window.toast.error('Tên học phần là bắt buộc');
    const payload = {
      name,
      credits: parseInt(document.getElementById('pc-credits').value) || 3,
      credits_theory: parseInt(document.getElementById('pc-lt').value) || 0,
      credits_practice: parseInt(document.getElementById('pc-th').value) || 0,
      credits_project: parseInt(document.getElementById('pc-da').value) || 0,
      credits_internship: parseInt(document.getElementById('pc-tt').value) || 0,
      semester: parseInt(document.getElementById('pc-sem').value) || 1,
      course_type: document.getElementById('pc-type').value || 'required',
      department_id: document.getElementById('pc-dept').value || null,
      description: document.getElementById('pc-desc').value.trim(),
    };
    try {
      const res = await fetch(`/api/versions/${this.versionId}/proposed-courses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      document.getElementById('propose-course-modal')?.remove();
      window.toast.success('Đã tạo học phần đề xuất');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },
```

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/version-editor.js
git commit -m "feat: propose course modal UI in version editor"
```

---

### Task 6: Frontend — Display Proposed Badge in Course List

**Files:**
- Modify: `public/js/pages/version-editor.js:728-749` (courses table rendering)

- [ ] **Step 1: Show badge for proposed courses in the version courses table**

In `renderCoursesTab()`, update the table row rendering. Change lines 733-734:

From:
```javascript
              <td><strong>${c.course_code}</strong></td>
              <td>${c.course_name}${c.elective_group ? ` <span style="color:var(--text-muted);font-size:11px;">(${c.elective_group})</span>` : ''}</td>
```

To:
```javascript
              <td><strong>${c.is_proposed ? '<span style="color:var(--warning);font-size:11px;">Chờ cấp mã</span>' : c.course_code}</strong></td>
              <td>${c.course_name}${c.is_proposed ? ' <span class="badge badge-warning" style="font-size:10px;">Đề xuất</span>' : ''}${c.elective_group ? ` <span style="color:var(--text-muted);font-size:11px;">(${c.elective_group})</span>` : ''}</td>
```

- [ ] **Step 2: Handle NULL code in ORDER BY**

The `ORDER BY vc.semester, c.code` on the server will place proposed courses (code=NULL) at the end of each semester group — this is the correct behavior in PostgreSQL (NULLs sort last by default). No change needed.

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/version-editor.js
git commit -m "feat: display proposed badge for courses without code in version editor"
```

---

### Task 7: Frontend — PDT Code Assignment UI in Approval Page

**Files:**
- Modify: `public/js/pages/approval.js` (add proposed courses section before approve button)

- [ ] **Step 1: Add a proposed courses check before approving a program_version**

In `approval.js`, modify the `approve()` method (lines 128-147). Replace the existing method with:

```javascript
  async approve(entityId, entityType) {
    // For program_version: check for proposed courses first
    if (entityType === 'program_version') {
      try {
        const proposedRes = await fetch(`/api/versions/${entityId}/proposed-courses`);
        const proposed = await proposedRes.json();
        if (proposed.length > 0) {
          this.showAssignCodeModal(entityId, proposed);
          return;
        }
      } catch (e) { /* proceed to normal approval */ }
    }
    this._doApprove(entityId, entityType);
  },

  async _doApprove(entityId, entityType) {
    const confirmed = await window.ui.confirm({
      title: 'Xác nhận duyệt',
      message: entityType === 'program_version'
        ? 'Bạn có chắc muốn duyệt chương trình đào tạo này?'
        : 'Bạn có chắc muốn duyệt đề cương này?',
      confirmText: 'Duyệt',
      cancelText: 'Hủy'
    });
    if (!confirmed) return;
    try {
      const res = await fetch('/api/approval/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, action: 'approve' })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã duyệt thành công');
      this.render();
    } catch (e) { window.toast.error(e.message); }
  },
```

- [ ] **Step 2: Add the code assignment modal**

Add this method to the ApprovalPage object:

```javascript
  showAssignCodeModal(versionId, proposedCourses) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'assign-code-modal';
    modal.innerHTML = `
      <div class="modal" style="max-width:700px;">
        <div class="modal-header"><h2>Gán mã học phần đề xuất</h2></div>
        <div class="modal-body">
          <p style="color:var(--warning);margin-bottom:16px;font-size:13px;">
            CTĐT này có ${proposedCourses.length} học phần đề xuất cần gán mã trước khi duyệt.
          </p>
          <div id="proposed-list">
            ${proposedCourses.map(c => `
              <div class="proposed-item" data-course-id="${c.id}" style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:10px;">
                <div style="font-weight:600;margin-bottom:6px;">${c.name} <span style="color:var(--text-muted);font-size:12px;">(${c.credits} TC)</span></div>
                <div style="display:flex;gap:8px;align-items:end;">
                  <div class="input-group" style="flex:1;margin:0;">
                    <label>Gán mã mới</label>
                    <input type="text" class="assign-code-input" data-cid="${c.id}" placeholder="Nhập mã HP" maxlength="20">
                  </div>
                  <span style="color:var(--text-muted);font-size:12px;padding-bottom:8px;">hoặc</span>
                  <div class="input-group" style="flex:1;margin:0;">
                    <label>Gộp vào HP đã có</label>
                    <select class="merge-target-select" data-cid="${c.id}">
                      <option value="">— Chọn HP —</option>
                    </select>
                  </div>
                  <button class="btn btn-primary btn-sm assign-code-btn" data-cid="${c.id}" style="white-space:nowrap;" disabled>Xác nhận</button>
                </div>
                <div class="assign-status" data-cid="${c.id}" style="margin-top:4px;font-size:12px;"></div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('assign-code-modal').remove()">Đóng</button>
          <button class="btn btn-primary" id="approve-after-assign" disabled onclick="window.ApprovalPage.approveAfterAssign(${versionId})">Duyệt CTĐT</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Load catalog courses into merge dropdowns
    fetch('/api/courses/all').then(r => r.json()).then(courses => {
      modal.querySelectorAll('.merge-target-select').forEach(sel => {
        courses.forEach(c => {
          sel.innerHTML += `<option value="${c.id}">${c.code} — ${c.name}</option>`;
        });
      });
    });

    // Enable confirm buttons when input is provided
    modal.querySelectorAll('.assign-code-input').forEach(input => {
      input.addEventListener('input', () => {
        const cid = input.dataset.cid;
        const btn = modal.querySelector(`.assign-code-btn[data-cid="${cid}"]`);
        const sel = modal.querySelector(`.merge-target-select[data-cid="${cid}"]`);
        btn.disabled = !(input.value.trim() || sel.value);
        if (input.value.trim()) sel.value = '';
      });
    });
    modal.querySelectorAll('.merge-target-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const cid = sel.dataset.cid;
        const btn = modal.querySelector(`.assign-code-btn[data-cid="${cid}"]`);
        const input = modal.querySelector(`.assign-code-input[data-cid="${cid}"]`);
        btn.disabled = !(sel.value || input.value.trim());
        if (sel.value) input.value = '';
      });
    });

    // Handle confirm for individual course
    modal.querySelectorAll('.assign-code-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cid = btn.dataset.cid;
        const input = modal.querySelector(`.assign-code-input[data-cid="${cid}"]`);
        const sel = modal.querySelector(`.merge-target-select[data-cid="${cid}"]`);
        const statusDiv = modal.querySelector(`.assign-status[data-cid="${cid}"]`);
        const item = modal.querySelector(`.proposed-item[data-course-id="${cid}"]`);

        try {
          if (input.value.trim()) {
            const res = await fetch(`/api/proposed-courses/${cid}/assign-code`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: input.value.trim() })
            });
            if (!res.ok) throw new Error((await res.json()).error);
            statusDiv.innerHTML = `<span style="color:var(--success);">✓ Đã gán mã: ${input.value.trim()}</span>`;
          } else if (sel.value) {
            const res = await fetch(`/api/proposed-courses/${cid}/merge`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ target_course_id: parseInt(sel.value) })
            });
            if (!res.ok) throw new Error((await res.json()).error);
            statusDiv.innerHTML = `<span style="color:var(--success);">✓ Đã gộp</span>`;
          }
          item.style.opacity = '0.5';
          btn.disabled = true;
          input.disabled = true;
          sel.disabled = true;

          // Check if all done
          const remaining = modal.querySelectorAll('.proposed-item:not([style*="opacity"])');
          if (remaining.length === 0) {
            document.getElementById('approve-after-assign').disabled = false;
          }
        } catch (e) {
          statusDiv.innerHTML = `<span style="color:var(--danger);">${e.message}</span>`;
        }
      });
    });
  },

  async approveAfterAssign(versionId) {
    document.getElementById('assign-code-modal')?.remove();
    this._doApprove(versionId, 'program_version');
  },
```

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/approval.js
git commit -m "feat: PDT code assignment modal in approval page"
```

---

### Task 8: Frontend — Hide Course Code in Syllabus Editor for Proposed Courses

**Files:**
- Modify: `public/js/pages/syllabus-editor.js:77` (breadcrumb course code display)
- Modify: `server.js` (~line 1555 area, GET /api/syllabi/:id — include is_proposed in response)

- [ ] **Step 1: Add is_proposed to syllabus detail API response**

Find the `GET /api/syllabi/:id` route in `server.js` (~line 1555). The query joins courses. Add `c.is_proposed` to the SELECT clause. The existing query selects `c.code as course_code, c.name as course_name` — add `c.is_proposed` to that list.

- [ ] **Step 2: Conditionally show course code in breadcrumb**

In `syllabus-editor.js:77`, change:
```javascript
<span class="breadcrumb-current">${s.course_code} — ${s.course_name}</span>
```
to:
```javascript
<span class="breadcrumb-current">${s.is_proposed ? s.course_name : (s.course_code + ' — ' + s.course_name)}</span>
```

- [ ] **Step 3: Commit**

```bash
git add public/js/pages/syllabus-editor.js server.js
git commit -m "feat: hide course code in syllabus editor for proposed courses"
```

---

### Task 9: Manual Testing & Verification

- [ ] **Step 1: Start the dev server**

```bash
make dev
```

- [ ] **Step 2: Test proposed course creation**

1. Log in as a user with LANH_DAO_KHOA or GIANG_VIEN role
2. Open a CTDT version in `draft` status
3. Go to Courses tab
4. Click "Đề xuất HP mới"
5. Fill in: Tên = "Trí tuệ nhân tạo ứng dụng", TC = 3, HK = 5
6. Click "Tạo đề xuất"
7. Verify: course appears in list with "Chờ cấp mã" and "Đề xuất" badge

- [ ] **Step 3: Test syllabus creation for proposed course**

1. From the courses tab, verify the proposed course can have a syllabus assigned
2. Open the syllabus editor for the proposed course
3. Verify: breadcrumb shows only course name, no code
4. Verify: CLO tab, CLO-PLO mapping, content, assessment all work normally

- [ ] **Step 4: Test code assignment by PDT**

1. Submit the CTDT and approve through to `approved_khoa`
2. Log in as PHONG_DAO_TAO user
3. Go to Approval page
4. Click "Duyệt" on the CTDT
5. Verify: code assignment modal appears with the proposed course
6. Enter a code (e.g., "CS501") and click "Xác nhận"
7. Verify: status shows "✓ Đã gán mã: CS501"
8. Click "Duyệt CTDT"
9. Verify: approval succeeds

- [ ] **Step 5: Test approval blocking**

1. Create another CTDT version with a proposed course
2. Submit and approve through to `approved_khoa`
3. As PDT, try to directly POST to `/api/approval/review` with action approve (skip the modal)
4. Verify: API returns 400 "Còn 1 học phần đề xuất chưa được gán mã"

- [ ] **Step 6: Test catalog isolation**

1. Go to the Courses catalog page (manage courses)
2. Verify: proposed courses do NOT appear in the catalog
3. After a proposed course has been assigned a code, verify it NOW appears in the catalog

- [ ] **Step 7: Test merge flow**

1. Create a proposed course in a version
2. As PDT, in the code assignment modal, select "Gộp vào HP đã có"
3. Choose an existing catalog course
4. Verify: merge succeeds, the version now references the existing course
5. Verify: syllabus and CLOs still intact

- [ ] **Step 8: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
