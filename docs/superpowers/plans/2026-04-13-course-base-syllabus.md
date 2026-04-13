# Course Base Syllabus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "base syllabus" (đề cương cơ bản) feature tied to courses in the master catalog, used as a template when creating detailed syllabi for CTDT versions.

**Architecture:** New `course_base_syllabi` table with 1:1 relation to `courses`. Three new API endpoints (GET/PUT/DELETE). New frontend page `base-syllabus-editor.js` with 4 tabs (reusing patterns from syllabus-editor). Modify two existing syllabus creation endpoints to auto-populate from base syllabus. Add navigation button and badge to courses page.

**Tech Stack:** PostgreSQL, Express.js, vanilla JS (SPA frontend)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `db.js` | Add `course_base_syllabi` table to `initDB()` |
| Modify | `server.js` | Add 3 base-syllabus API routes, modify 2 existing syllabus-creation routes |
| Create | `public/js/pages/base-syllabus-editor.js` | Full-page editor for base syllabus (4 tabs) |
| Modify | `public/js/pages/courses.js` | Add badge + "Đề cương cơ bản" button per row |
| Modify | `public/js/app.js` | Register `base-syllabus-editor` route |
| Modify | `public/index.html` | Load `base-syllabus-editor.js` script |
| Modify | `public/js/pages/my-assignments.js` | Show toast when base syllabus not found |

---

### Task 1: Database — Add `course_base_syllabi` table

**Files:**
- Modify: `db.js:223-224` (after `version_syllabi` table, before `syllabus_assignments`)

- [ ] **Step 1: Add CREATE TABLE statement in `initDB()`**

In `db.js`, after the `version_syllabi` table (line 223), add:

```javascript
      -- Course Base Syllabi (đề cương cơ bản)
      CREATE TABLE IF NOT EXISTS course_base_syllabi (
        id SERIAL PRIMARY KEY,
        course_id INT REFERENCES courses(id) ON DELETE CASCADE UNIQUE,
        content JSONB DEFAULT '{}',
        updated_by INT REFERENCES users(id),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
```

- [ ] **Step 2: Verify by restarting the app**

Run: `make dev`
Expected: App starts without errors, table is created. Verify with:
```bash
make db-shell
# then: \d course_base_syllabi
```

- [ ] **Step 3: Commit**

```bash
git add db.js
git commit -m "feat(db): add course_base_syllabi table"
```

---

### Task 2: API — Base syllabus CRUD endpoints

**Files:**
- Modify: `server.js:1076-1077` (after `DELETE /api/courses/:id`, before `// ===== Proposed Courses =====`)

- [ ] **Step 1: Add GET endpoint**

In `server.js`, after the `DELETE /api/courses/:id` route (line 1076), add:

```javascript
// ============ COURSE BASE SYLLABUS ============
app.get('/api/courses/:courseId/base-syllabus', authMiddleware, requirePerm('courses.view'), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT bs.*, u.display_name as updated_by_name
       FROM course_base_syllabi bs
       LEFT JOIN users u ON bs.updated_by = u.id
       WHERE bs.course_id = $1`,
      [req.params.courseId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Chưa có đề cương cơ bản' });
    res.json(result.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: Add PUT (upsert) endpoint**

Immediately after the GET route, add:

```javascript
app.put('/api/courses/:courseId/base-syllabus', authMiddleware, requirePerm('courses.edit'), async (req, res) => {
  const { content } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO course_base_syllabi (course_id, content, updated_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (course_id) DO UPDATE
       SET content = $2, updated_by = $3, updated_at = NOW()
       RETURNING *`,
      [req.params.courseId, JSON.stringify(content || {}), req.user.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 3: Add DELETE endpoint**

Immediately after the PUT route, add:

```javascript
app.delete('/api/courses/:courseId/base-syllabus', authMiddleware, requirePerm('courses.edit'), async (req, res) => {
  try {
    await pool.query('DELETE FROM course_base_syllabi WHERE course_id = $1', [req.params.courseId]);
    res.status(204).end();
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 4: Test the endpoints manually**

Start the app and test with curl or browser:
```bash
# GET (should 404)
curl -b cookies.txt http://localhost:3600/api/courses/1/base-syllabus

# PUT (upsert)
curl -X PUT -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"content":{"_schema_version":2,"course_description":"Test"}}' \
  http://localhost:3600/api/courses/1/base-syllabus

# GET (should return data)
curl -b cookies.txt http://localhost:3600/api/courses/1/base-syllabus

# DELETE
curl -X DELETE -b cookies.txt http://localhost:3600/api/courses/1/base-syllabus
```

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat(api): add base syllabus CRUD endpoints (GET/PUT/DELETE)"
```

---

### Task 3: API — Modify syllabus creation to auto-populate from base syllabus

**Files:**
- Modify: `server.js:1663-1681` (`POST /api/versions/:vId/syllabi`)
- Modify: `server.js:2231-2262` (`POST /api/my-assignments/:assignmentId/create-syllabus`)

- [ ] **Step 1: Modify `POST /api/versions/:vId/syllabi`**

Replace the current route at lines 1663-1681 with:

```javascript
app.post('/api/versions/:vId/syllabi', authMiddleware, async (req, res) => {
  const { course_id, content } = req.body;
  try {
    // Bypass permission if user is assigned to this course in this version
    const assignRes = await pool.query(
      'SELECT 1 FROM syllabus_assignments WHERE version_id=$1 AND course_id=$2 AND assigned_to=$3',
      [req.params.vId, course_id, req.user.id]
    );
    if (!assignRes.rows.length) {
      await checkVersionEditAccess(req.user.id, req.params.vId, 'syllabus.edit');
    }

    // Check for base syllabus to auto-populate
    let initialContent = content || {};
    let noBaseSyllabus = false;
    if (!content || Object.keys(content).length === 0) {
      const baseRes = await pool.query(
        'SELECT content FROM course_base_syllabi WHERE course_id = $1',
        [course_id]
      );
      if (baseRes.rows.length) {
        initialContent = baseRes.rows[0].content;
      } else {
        noBaseSyllabus = true;
      }
    }

    const result = await pool.query(
      'INSERT INTO version_syllabi (version_id, course_id, author_id, content) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.vId, course_id, req.user.id, JSON.stringify(initialContent)]
    );
    res.json({ ...result.rows[0], no_base_syllabus: noBaseSyllabus });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 2: Modify `POST /api/my-assignments/:assignmentId/create-syllabus`**

Replace the INSERT query at lines 2256-2258 with base syllabus lookup:

```javascript
app.post('/api/my-assignments/:assignmentId/create-syllabus', authMiddleware, async (req, res) => {
  try {
    const aRes = await pool.query('SELECT * FROM syllabus_assignments WHERE id=$1', [req.params.assignmentId]);
    if (!aRes.rows.length) return res.status(404).json({ error: 'Không tìm thấy phân công' });
    const assignment = aRes.rows[0];

    if (assignment.assigned_to !== req.user.id) {
      return res.status(403).json({ error: 'Bạn không được phân công cho đề cương này' });
    }

    // Check no syllabus exists yet
    const existRes = await pool.query(
      'SELECT id FROM version_syllabi WHERE version_id=$1 AND course_id=$2',
      [assignment.version_id, assignment.course_id]
    );
    if (existRes.rows.length) {
      return res.status(400).json({ error: 'Đề cương đã tồn tại', syllabus_id: existRes.rows[0].id });
    }

    // Check version not locked
    const verRes = await pool.query('SELECT is_locked FROM program_versions WHERE id=$1', [assignment.version_id]);
    if (verRes.rows.length && verRes.rows[0].is_locked) {
      return res.status(400).json({ error: 'Phiên bản đã bị khóa' });
    }

    // Check for base syllabus to auto-populate
    let initialContent = {};
    let noBaseSyllabus = false;
    const baseRes = await pool.query(
      'SELECT content FROM course_base_syllabi WHERE course_id = $1',
      [assignment.course_id]
    );
    if (baseRes.rows.length) {
      initialContent = baseRes.rows[0].content;
    } else {
      noBaseSyllabus = true;
    }

    const result = await pool.query(
      'INSERT INTO version_syllabi (version_id, course_id, author_id, content) VALUES ($1,$2,$3,$4) RETURNING *',
      [assignment.version_id, assignment.course_id, req.user.id, JSON.stringify(initialContent)]
    );
    res.json({ ...result.rows[0], no_base_syllabus: noBaseSyllabus });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(api): auto-populate new syllabi from base syllabus"
```

---

### Task 4: API — Add `has_base_syllabus` flag to courses list

**Files:**
- Modify: `server.js:1004-1025` (`GET /api/courses`)
- Modify: `server.js:1027-1037` (`GET /api/courses/all`)

- [ ] **Step 1: Modify `GET /api/courses` query**

Update the SQL queries at lines 1010-1022 to LEFT JOIN `course_base_syllabi` and include `has_base_syllabus`:

```javascript
app.get('/api/courses', authMiddleware, requirePerm('courses.view'), async (req, res) => {
  try {
    const roles = await getUserRoles(req.user.id);
    const highest = roles.length ? roles[0] : null;
    const deptIds = highest ? await getDepartmentScope(highest.department_id, highest.level) : [0];

    const result = deptIds
      ? await pool.query(`
          SELECT c.*, d.name as dept_name, d.code as dept_code,
                 (cbs.id IS NOT NULL) as has_base_syllabus
          FROM courses c
          LEFT JOIN departments d ON c.department_id = d.id
          LEFT JOIN course_base_syllabi cbs ON cbs.course_id = c.id
          WHERE c.department_id = ANY($1) AND c.is_proposed = false
          ORDER BY c.code
        `, [deptIds])
      : await pool.query(`
          SELECT c.*, d.name as dept_name, d.code as dept_code,
                 (cbs.id IS NOT NULL) as has_base_syllabus
          FROM courses c
          LEFT JOIN departments d ON c.department_id = d.id
          LEFT JOIN course_base_syllabi cbs ON cbs.course_id = c.id
          WHERE c.is_proposed = false
          ORDER BY c.code
        `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: Modify `GET /api/courses/all` query similarly**

Update lines 1029-1034:

```javascript
app.get('/api/courses/all', authMiddleware, requirePerm('courses.view'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, d.name as dept_name, d.code as dept_code,
             (cbs.id IS NOT NULL) as has_base_syllabus
      FROM courses c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN course_base_syllabi cbs ON cbs.course_id = c.id
      WHERE c.is_proposed = false
      ORDER BY c.code
    `);
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(api): include has_base_syllabus flag in courses list"
```

---

### Task 5: Frontend — Create base syllabus editor page

**Files:**
- Create: `public/js/pages/base-syllabus-editor.js`

- [ ] **Step 1: Create the editor page module**

Create `public/js/pages/base-syllabus-editor.js`:

```javascript
// Base Syllabus Editor — đề cương cơ bản (per course, not per version)

const BS_INP = 'width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;';

window.BaseSyllabusEditorPage = {
  courseId: null,
  course: null,
  baseSyllabus: null,
  activeTab: 0,
  isNew: false,

  async render(container, courseId) {
    this.courseId = courseId;
    this.activeTab = 0;
    this.isNew = false;
    container.innerHTML = '<div class="spinner"></div>';

    try {
      // Fetch course info
      const courseRes = await fetch(`/api/courses`).then(r => r.json());
      this.course = courseRes.find(c => c.id === parseInt(courseId));
      if (!this.course) throw new Error('Không tìm thấy học phần');

      // Fetch base syllabus
      const bsRes = await fetch(`/api/courses/${courseId}/base-syllabus`);
      if (bsRes.ok) {
        this.baseSyllabus = await bsRes.json();
        this.baseSyllabus.content = typeof this.baseSyllabus.content === 'string'
          ? JSON.parse(this.baseSyllabus.content)
          : (this.baseSyllabus.content || {});
      } else {
        this.isNew = true;
        this.baseSyllabus = { content: { _schema_version: 2 } };
      }
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="icon">!</div><p>${e.message}</p></div>`;
      return;
    }

    const c = this.course;
    const editable = window.App.hasPerm('courses.edit');
    const bs = this.baseSyllabus;
    const updatedInfo = bs.updated_by_name
      ? `Cập nhật lần cuối bởi <strong>${bs.updated_by_name}</strong> vào ${new Date(bs.updated_at).toLocaleString('vi-VN')}`
      : '';

    container.innerHTML = `
      <div class="page-header">
        <nav class="breadcrumb-nav mb-3">
          <a href="#" onclick="event.preventDefault();window.App.navigate('courses')" class="breadcrumb-link">Danh mục Học phần</a>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">Đề cương cơ bản</span>
        </nav>
        <div class="flex-between">
          <div>
            <h1 class="page-title" style="font-size:22px;">Đề cương cơ bản — ${c.code ? c.code + ' ' : ''}${c.name}</h1>
            <div class="page-header-meta">
              <span class="badge badge-info">${c.credits} TC</span>
              ${this.isNew ? '<span class="badge badge-warning">Chưa có nội dung</span>' : '<span class="badge badge-success">Đã có nội dung</span>'}
              ${updatedInfo ? `<span class="text-muted-sm">${updatedInfo}</span>` : ''}
            </div>
          </div>
          <div class="page-header-actions">
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.saveAll()">Lưu tất cả</button>' : ''}
          </div>
        </div>
      </div>
      <div class="tab-bar" id="bs-tabs">
        <div class="tab-item active" data-tab="0">Thông tin chung</div>
        <div class="tab-item" data-tab="1">Nội dung giảng dạy</div>
        <div class="tab-item" data-tab="2">Đánh giá</div>
        <div class="tab-item" data-tab="3">Tài liệu</div>
      </div>
      <div id="bs-tab-content"><div class="spinner"></div></div>

      <!-- Add Outline Lesson Modal -->
      <div id="bs-outline-add-modal" class="modal-overlay">
        <div class="modal" style="max-width:640px;">
          <div class="modal-header"><h2>Thêm bài học</h2></div>
          <div class="modal-body">
            <form id="bs-outline-add-form">
              <div class="input-group">
                <label>Tên bài <span class="required-mark">*</span></label>
                <input type="text" id="bs-outline-add-title" required placeholder="VD: Chương 1 — Giới thiệu">
              </div>
              <div style="display:flex;gap:12px;">
                <div class="input-group" style="flex:1;">
                  <label>Số tiết</label>
                  <input type="number" id="bs-outline-add-hours" min="0" value="0">
                </div>
              </div>
              <div class="input-group">
                <label>Nội dung chi tiết (mỗi dòng = 1 mục)</label>
                <textarea id="bs-outline-add-topics" rows="4"></textarea>
              </div>
              <div class="input-group">
                <label>Phương pháp dạy học</label>
                <textarea id="bs-outline-add-methods" rows="3"></textarea>
              </div>
              <div class="modal-error" id="bs-outline-add-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('bs-outline-add-modal').classList.remove('active')">Hủy</button>
                <button type="submit" class="btn btn-primary">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Tab switching
    document.querySelectorAll('#bs-tabs .tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        this._collectCurrentTabIntoState();
        document.querySelectorAll('#bs-tabs .tab-item').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeTab = parseInt(tab.dataset.tab);
        this.renderTab();
      });
    });

    // Outline add form
    document.getElementById('bs-outline-add-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitAddOutline();
    });

    this.renderTab();
  },

  renderTab() {
    const body = document.getElementById('bs-tab-content');
    body.innerHTML = '<div class="spinner"></div>';
    const editable = window.App.hasPerm('courses.edit');
    const c = this.baseSyllabus.content || {};
    switch (this.activeTab) {
      case 0: this.renderGeneralTab(body, editable, c); break;
      case 1: this.renderOutlineTab(body, editable, c); break;
      case 2: this.renderGradingTab(body, editable, c); break;
      case 3: this.renderResourcesTab(body, editable, c); break;
    }
  },

  // ============ TAB 0: Thông tin chung ============
  renderGeneralTab(body, editable, c) {
    const dis = editable ? '' : 'disabled';
    body.innerHTML = `
      <div style="max-width:600px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Thông tin chung</h3>
        <div class="input-group"><label>Mô tả tóm tắt nội dung học phần</label><textarea id="bs-course-desc" ${dis} rows="3" placeholder="Mô tả tóm tắt HP (mục 11)">${c.course_description || ''}</textarea></div>
        <div class="input-group"><label>Mục tiêu học phần</label><textarea id="bs-course-obj" ${dis} rows="3" placeholder="Mục tiêu khi hoàn thành HP (mục 7)">${c.course_objectives || ''}</textarea></div>
        <div class="input-group"><label>Yêu cầu tiên quyết</label><input type="text" id="bs-prereq" ${dis} value="${c.prerequisites || ''}" placeholder="HP tiên quyết"></div>
        <div class="input-group"><label>Ngôn ngữ giảng dạy</label><input type="text" id="bs-lang-inst" ${dis} value="${c.language_instruction || ''}" placeholder="Tiếng Việt"></div>
        <div class="input-group"><label>Phương pháp giảng dạy</label><textarea id="bs-learning-methods" ${dis} rows="3" placeholder="Phương pháp, hình thức tổ chức dạy học (mục 12)">${Array.isArray(c.learning_methods) ? c.learning_methods.map(m => typeof m === 'string' ? m : (m.method || m.name || m.title || JSON.stringify(m))).join('\n') : (c.learning_methods || '')}</textarea></div>
      </div>
    `;
  },

  _collectGeneral() {
    const desc = document.getElementById('bs-course-desc');
    if (!desc) return;
    this.baseSyllabus.content = {
      ...this.baseSyllabus.content,
      course_description: desc.value,
      course_objectives: document.getElementById('bs-course-obj').value,
      prerequisites: document.getElementById('bs-prereq').value,
      language_instruction: document.getElementById('bs-lang-inst').value,
      learning_methods: document.getElementById('bs-learning-methods').value,
    };
  },

  // ============ TAB 1: Nội dung giảng dạy ============
  renderOutlineTab(body, editable, c) {
    const lessons = c.course_outline || [];
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Nội dung chi tiết học phần</h3>
        <div style="display:flex;gap:8px;">
          ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.openAddOutlineModal()">+ Thêm bài</button>' : ''}
        </div>
      </div>
      <div id="bs-outline-container">
        ${lessons.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có nội dung. Bấm "+ Thêm bài" để bắt đầu.</p>' :
          lessons.map((l, i) => this._outlineRowHtml(l, i, editable)).join('')}
      </div>
    `;
  },

  _outlineRowHtml(l, i, editable) {
    const dis = editable ? '' : 'disabled';
    const topicsStr = Array.isArray(l.topics) ? l.topics.join('\n') : '';
    return `<div class="outline-row" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        <strong style="color:var(--primary);white-space:nowrap;">Bài ${l.lesson || i + 1}</strong>
        <input type="text" data-field="title" value="${(l.title || '').replace(/"/g, '&quot;')}" ${dis} placeholder="Tên bài" style="flex:1;${BS_INP}">
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;white-space:nowrap;">Số tiết:</label><input type="number" data-field="hours" value="${l.hours || 0}" ${dis} min="0" style="width:60px;${BS_INP}text-align:center;"></div>
        ${editable ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('.outline-row').remove()">✕</button>` : ''}
      </div>
      <div style="display:flex;gap:12px;">
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nội dung chi tiết (mỗi dòng = 1 mục)</label><textarea data-field="topics" ${dis} rows="3" style="${BS_INP}">${topicsStr}</textarea></div>
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Phương pháp dạy học</label><textarea data-field="teaching_methods" ${dis} rows="3" style="${BS_INP}">${l.teaching_methods || ''}</textarea></div>
      </div>
    </div>`;
  },

  openAddOutlineModal() {
    document.getElementById('bs-outline-add-form').reset();
    document.getElementById('bs-outline-add-hours').value = '0';
    const errorEl = document.getElementById('bs-outline-add-error');
    errorEl.classList.remove('show');
    errorEl.textContent = '';
    document.getElementById('bs-outline-add-modal').classList.add('active');
    App.modalGuard('bs-outline-add-modal', () => this.submitAddOutline());
  },

  submitAddOutline() {
    const title = document.getElementById('bs-outline-add-title').value.trim();
    const errorEl = document.getElementById('bs-outline-add-error');
    if (!title) {
      errorEl.textContent = 'Nhập tên bài';
      errorEl.classList.add('show');
      return;
    }
    const hours = parseFloat(document.getElementById('bs-outline-add-hours').value) || 0;
    const topics = document.getElementById('bs-outline-add-topics').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    const teaching_methods = document.getElementById('bs-outline-add-methods').value;

    this._collectOutline();

    const existing = this.baseSyllabus.content.course_outline || [];
    this.baseSyllabus.content = {
      ...this.baseSyllabus.content,
      course_outline: [
        ...existing,
        { lesson: existing.length + 1, title, hours, topics, teaching_methods, clos: [] },
      ],
    };

    document.getElementById('bs-outline-add-modal').classList.remove('active');
    window.toast.success('Đã thêm bài (chưa lưu)');
    this.renderTab();
  },

  _collectOutline() {
    const container = document.getElementById('bs-outline-container');
    if (!container) return;
    const rows = container.querySelectorAll('.outline-row');
    const course_outline = Array.from(rows).map((r, i) => ({
      lesson: i + 1,
      title: r.querySelector('[data-field="title"]').value,
      hours: parseFloat(r.querySelector('[data-field="hours"]').value) || 0,
      topics: r.querySelector('[data-field="topics"]').value.split('\n').map(s => s.trim()).filter(Boolean),
      teaching_methods: r.querySelector('[data-field="teaching_methods"]').value,
      clos: [],
    }));
    this.baseSyllabus.content = { ...this.baseSyllabus.content, course_outline };
  },

  // ============ TAB 2: Đánh giá ============
  renderGradingTab(body, editable, c) {
    const items = c.assessment_methods || [];
    const dis = editable ? '' : 'disabled';
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Hình thức đánh giá</h3>
      </div>
      <table class="data-table" id="bs-grading-table">
        <thead><tr><th>Thành phần</th><th style="width:70px;">%</th><th>Hình thức đánh giá</th>${editable ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${items.map((g, i) => `<tr data-idx="${i}">
            <td><input type="text" value="${g.component || ''}" data-field="component" ${dis} style="${BS_INP}"></td>
            <td><input type="number" value="${g.weight || 0}" data-field="weight" ${dis} min="0" max="100" style="${BS_INP}text-align:center;"></td>
            <td><input type="text" value="${g.assessment_tool || ''}" data-field="assessment_tool" ${dis} style="${BS_INP}"></td>
            ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
      ${editable ? '<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="window.BaseSyllabusEditorPage.addGradingRow()">+ Thêm dòng</button>' : ''}
    `;
  },

  addGradingRow() {
    const tbody = document.querySelector('#bs-grading-table tbody');
    tbody.insertAdjacentHTML('beforeend', `<tr>
      <td><input type="text" data-field="component" style="${BS_INP}"></td>
      <td><input type="number" data-field="weight" value="0" style="${BS_INP}text-align:center;"></td>
      <td><input type="text" data-field="assessment_tool" style="${BS_INP}"></td>
      <td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`);
  },

  _collectGrading() {
    const table = document.getElementById('bs-grading-table');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    const assessment_methods = Array.from(rows).map(r => ({
      component: r.querySelector('[data-field="component"]').value,
      weight: parseInt(r.querySelector('[data-field="weight"]').value) || 0,
      assessment_tool: r.querySelector('[data-field="assessment_tool"]').value,
      clos: [],
    }));
    this.baseSyllabus.content = { ...this.baseSyllabus.content, assessment_methods };
  },

  // ============ TAB 3: Tài liệu ============
  renderResourcesTab(body, editable, c) {
    const textbooks = Array.isArray(c.textbooks) ? c.textbooks : [];
    const references = Array.isArray(c.references) ? c.references : [];
    const req = c.course_requirements || { software: [], hardware: [], lab_equipment: [], classroom_setup: '' };
    const dis = editable ? '' : 'disabled';

    body.innerHTML = `
      <div style="max-width:600px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Tài liệu & Yêu cầu</h3>
        <div class="input-group"><label>Giáo trình chính (mỗi dòng = 1 tài liệu)</label>
          <textarea id="bs-textbooks" ${dis} rows="3" placeholder="Tên sách, Tác giả, NXB">${textbooks.join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Tài liệu tham khảo (mỗi dòng = 1 tài liệu)</label>
          <textarea id="bs-references" ${dis} rows="3" placeholder="Bài báo, website...">${references.join('\n')}</textarea>
        </div>
        <h4 style="font-size:14px;font-weight:600;margin:20px 0 12px;">Yêu cầu học phần</h4>
        <div class="input-group"><label>Phần mềm / Công cụ (mỗi dòng = 1 item)</label>
          <textarea id="bs-software" ${dis} rows="3">${(req.software || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Phần cứng (mỗi dòng = 1 item)</label>
          <textarea id="bs-hardware" ${dis} rows="2">${(req.hardware || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Thiết bị phòng thí nghiệm (mỗi dòng = 1 item)</label>
          <textarea id="bs-lab" ${dis} rows="2">${(req.lab_equipment || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Yêu cầu phòng học</label>
          <input type="text" id="bs-classroom" ${dis} value="${req.classroom_setup || ''}" placeholder="VD: Phòng máy tính">
        </div>
      </div>
    `;
  },

  _collectResources() {
    const textbooks = document.getElementById('bs-textbooks');
    if (!textbooks) return;
    const toArr = id => document.getElementById(id).value.split('\n').map(s => s.trim()).filter(Boolean);
    this.baseSyllabus.content = {
      ...this.baseSyllabus.content,
      textbooks: toArr('bs-textbooks'),
      references: toArr('bs-references'),
      course_requirements: {
        software: toArr('bs-software'),
        hardware: toArr('bs-hardware'),
        lab_equipment: toArr('bs-lab'),
        classroom_setup: document.getElementById('bs-classroom').value,
      },
    };
  },

  // ============ COLLECT + SAVE ============
  _collectCurrentTabIntoState() {
    switch (this.activeTab) {
      case 0: this._collectGeneral(); break;
      case 1: this._collectOutline(); break;
      case 2: this._collectGrading(); break;
      case 3: this._collectResources(); break;
    }
  },

  async saveAll() {
    try {
      this._collectCurrentTabIntoState();
      const res = await fetch(`/api/courses/${this.courseId}/base-syllabus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: this.baseSyllabus.content }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi lưu');
      const saved = await res.json();
      this.baseSyllabus = { ...this.baseSyllabus, ...saved };
      this.baseSyllabus.content = typeof saved.content === 'string' ? JSON.parse(saved.content) : saved.content;
      this.isNew = false;
      window.toast.success('Đã lưu đề cương cơ bản');
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  destroy() {}
};
```

- [ ] **Step 2: Commit**

```bash
git add public/js/pages/base-syllabus-editor.js
git commit -m "feat(frontend): add base syllabus editor page with 4 tabs"
```

---

### Task 6: Frontend — Register route and load script

**Files:**
- Modify: `public/index.html:20-21` (after syllabus-editor script tag)
- Modify: `public/js/app.js:293-298` (in the navigate function, special param handling)

- [ ] **Step 1: Add script tag in `index.html`**

In `public/index.html`, after line 20 (`syllabus-editor.js`), add:

```html
  <script src="/js/pages/base-syllabus-editor.js"></script>
```

- [ ] **Step 2: Add route in `app.js` navigate function**

In `public/js/app.js`, after the `syllabus-editor` block (line 297), add:

```javascript
      if (page === 'base-syllabus-editor' && params?.courseId) {
        this.currentPage = window.BaseSyllabusEditorPage;
        await window.BaseSyllabusEditorPage.render(container, params.courseId);
        this.checkPermissions(container);
        return;
      }
```

- [ ] **Step 3: Commit**

```bash
git add public/index.html public/js/app.js
git commit -m "feat(frontend): register base-syllabus-editor route"
```

---

### Task 7: Frontend — Add badge and button to courses page

**Files:**
- Modify: `public/js/pages/courses.js:18` (table header)
- Modify: `public/js/pages/courses.js:92-101` (table rows)

- [ ] **Step 1: Add "ĐC cơ bản" column header**

In `public/js/pages/courses.js`, update line 18 — the thead row:

Replace:
```javascript
            <thead><tr><th>Mã HP</th><th>Tên học phần</th><th>TC</th><th>Đơn vị quản lý</th><th>Thao tác</th></tr></thead>
```

With:
```javascript
            <thead><tr><th>Mã HP</th><th>Tên học phần</th><th>TC</th><th>Đơn vị quản lý</th><th>ĐC cơ bản</th><th>Thao tác</th></tr></thead>
```

- [ ] **Step 2: Update table rows with badge and button**

In `public/js/pages/courses.js`, update the `renderTable()` row template (lines 92-101):

Replace:
```javascript
      : filtered.map(c => `<tr>
          <td><strong>${c.code}</strong></td>
          <td>${c.name}</td>
          <td class="text-center">${c.credits}</td>
          <td><span class="badge badge-info">${c.dept_name || '—'}</span></td>
          <td>
            ${window.App.hasPerm('courses.edit') ? `<button class="btn btn-secondary btn-sm" onclick="window.CoursesPage.openModal(${c.id})">Sửa</button>
            <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.CoursesPage.del(${c.id})">Xóa</button>` : ''}
          </td>
        </tr>`).join('');
```

With:
```javascript
      : filtered.map(c => `<tr>
          <td><strong>${c.code}</strong></td>
          <td>${c.name}</td>
          <td class="text-center">${c.credits}</td>
          <td><span class="badge badge-info">${c.dept_name || '—'}</span></td>
          <td class="text-center">
            ${c.has_base_syllabus ? '<span class="badge badge-success">Có</span>' : '<span class="badge" style="background:var(--bg-secondary);color:var(--text-muted);">Chưa có</span>'}
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.App.navigate('base-syllabus-editor',{courseId:${c.id}})">ĐC cơ bản</button>
            ${window.App.hasPerm('courses.edit') ? `<button class="btn btn-secondary btn-sm" onclick="window.CoursesPage.openModal(${c.id})">Sửa</button>
            <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.CoursesPage.del(${c.id})">Xóa</button>` : ''}
          </td>
        </tr>`).join('');
```

- [ ] **Step 3: Update empty-state colspan**

In `public/js/pages/courses.js` line 91, update colspan from 5 to 6:

Replace:
```javascript
      ? '<tr><td colspan="5" class="text-center text-muted">Không tìm thấy</td></tr>'
```

With:
```javascript
      ? '<tr><td colspan="6" class="text-center text-muted">Không tìm thấy</td></tr>'
```

Also update the initial spinner colspan on line 19:

Replace:
```javascript
            <tbody id="courses-tbody"><tr><td colspan="5"><div class="spinner"></div></td></tr></tbody>
```

With:
```javascript
            <tbody id="courses-tbody"><tr><td colspan="6"><div class="spinner"></div></td></tr></tbody>
```

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/courses.js
git commit -m "feat(frontend): add base syllabus badge and button to courses list"
```

---

### Task 8: Frontend — Toast notification when base syllabus missing

**Files:**
- Modify: `public/js/pages/my-assignments.js:109-120` (createAndOpen function)

- [ ] **Step 1: Update `createAndOpen` in my-assignments.js to show toast**

Find the `createAndOpen` function and update it to check for `no_base_syllabus`:

Replace the section after `const data = await res.json();` success path. After the existing logic that navigates to the syllabus editor, add a check for the toast. The current code after a successful creation navigates to the editor. We need to check the `no_base_syllabus` flag.

Read the full `createAndOpen` function first, then replace it. The key change is: after `const data = await res.json();` on the success path, before navigating, check `data.no_base_syllabus`:

```javascript
  async createAndOpen(assignmentId) {
    try {
      const res = await fetch(`/api/my-assignments/${assignmentId}/create-syllabus`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        // If syllabus already exists, navigate to it
        if (data.syllabus_id) {
          window.App.navigate('syllabus-editor', { syllabusId: data.syllabus_id });
          return;
        }
        throw new Error(data.error);
      }
      if (data.no_base_syllabus) {
        window.toast.info('Học phần này chưa có đề cương cơ bản. Nội dung đề cương sẽ được tạo trống.');
      }
      window.App.navigate('syllabus-editor', { syllabusId: data.id });
    } catch (e) { window.toast.error(e.message); }
  },
```

Note: Read the current `createAndOpen` function first to verify the exact structure before editing.

- [ ] **Step 2: Commit**

```bash
git add public/js/pages/my-assignments.js
git commit -m "feat(frontend): show toast when creating syllabus without base syllabus"
```

---

### Task 9: Manual testing — Verify full flow

- [ ] **Step 1: Start the app**

```bash
make dev
```

- [ ] **Step 2: Test courses page**

1. Navigate to Courses page
2. Verify "ĐC cơ bản" column shows "Chưa có" badges
3. Click "ĐC cơ bản" button on any course
4. Verify editor opens with "Chưa có nội dung" badge

- [ ] **Step 3: Test base syllabus editor**

1. Fill in Tab 0 (Thông tin chung) with some content
2. Switch to Tab 1, add a lesson via "+ Thêm bài"
3. Switch to Tab 2, add assessment rows
4. Switch to Tab 3, add textbook entries
5. Click "Lưu tất cả"
6. Verify success toast
7. Navigate away and back — data persists

- [ ] **Step 4: Test auto-populate**

1. Create a new syllabus for a course that has a base syllabus (via my-assignments or version editor)
2. Verify the new syllabus is pre-populated with base syllabus content
3. Create a new syllabus for a course WITHOUT a base syllabus
4. Verify the toast "Học phần này chưa có đề cương cơ bản" appears

- [ ] **Step 5: Verify courses list badge updates**

1. Go back to Courses page
2. Verify the course now shows "Có" badge in the ĐC cơ bản column

- [ ] **Step 6: Commit any fixes if needed**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
