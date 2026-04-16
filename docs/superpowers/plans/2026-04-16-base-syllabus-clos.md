# Base Syllabus CLOs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thêm CLO vào đề cương cơ bản (base syllabus) — bảng SQL mới, API CRUD, tab mới trong base-syllabus-editor, auto-copy CLOs khi tạo version syllabus, thêm bloom_level cho CLOs.

**Architecture:** Bảng `base_syllabus_clos` mới trong `db.js`, 4 API routes mới + sửa 2 route populate trong `server.js`, tab CLO mới trong `base-syllabus-editor.js`, thêm bloom_level vào `course_clos` + update CLO CRUD + `syllabus-editor.js`.

**Tech Stack:** Node.js + Express + PostgreSQL 15, vanilla JS frontend. Không test framework.

**Spec:** [docs/superpowers/specs/2026-04-16-base-syllabus-clos-design.md](../specs/2026-04-16-base-syllabus-clos-design.md)

---

## File Structure

**Modify (4 files):**
- `db.js` — CREATE TABLE `base_syllabus_clos` + ALTER TABLE `course_clos` ADD bloom_level.
- `server.js` — 4 new CRUD routes for base CLOs + modify 2 version syllabus creation routes to auto-copy.  + modify existing CLO CRUD routes to include bloom_level.
- `public/js/pages/base-syllabus-editor.js` — add CLO tab (new tab index 1, shift existing tabs).
- `public/js/pages/syllabus-editor.js` — add bloom_level column/input to CLO tab.

4 tasks:
- **Task 1**: Schema changes (`db.js`).
- **Task 2**: Backend API (`server.js`) — new routes + modify existing.
- **Task 3**: Base syllabus editor UI (CLO tab).
- **Task 4**: Version syllabus editor UI (bloom_level).

---

## Task 1: Schema changes in `db.js`

**Files:**
- Modify: `db.js` — add CREATE TABLE after `course_base_syllabi` block, add ALTER TABLE for `course_clos`.

- [ ] **Step 1: Add `base_syllabus_clos` table**

In `db.js`, find the `course_base_syllabi` CREATE block (around line 226-233). After it, add:

```sql
      -- Base Syllabus CLOs
      CREATE TABLE IF NOT EXISTS base_syllabus_clos (
        id SERIAL PRIMARY KEY,
        course_id INT REFERENCES courses(id) ON DELETE CASCADE,
        code VARCHAR(20),
        description TEXT,
        bloom_level INT DEFAULT 1
      );
```

Insert AFTER the closing `);` of `course_base_syllabi` and BEFORE the next CREATE TABLE.

- [ ] **Step 2: Add `bloom_level` to `course_clos`**

Find the ALTER TABLE section in `db.js` (around line 270+, where other ALTER TABLE ADD COLUMN IF NOT EXISTS statements live). Add:

```sql
      ALTER TABLE course_clos ADD COLUMN IF NOT EXISTS bloom_level INT DEFAULT 1;
```

If no ALTER section exists near `course_clos`, add it after the last CREATE TABLE block but before the migrations.

- [ ] **Step 3: Verify parse + restart**

```bash
node --check db.js
```

Expected: exit 0.

Restart dev server to trigger `initDB()`. Verify table created:

```bash
docker exec -i program-db psql -U program -d program_db -c "\d base_syllabus_clos"
docker exec -i program-db psql -U program -d program_db -c "\d course_clos"
```

Expected: `base_syllabus_clos` exists with 5 columns. `course_clos` has `bloom_level` column.

- [ ] **Step 4: Commit**

```bash
git add db.js
git commit -m "$(cat <<'EOF'
feat(db): add base_syllabus_clos table and bloom_level to course_clos

New table for storing CLOs at the course-level (base syllabus), separate
from the version-specific course_clos. When a version syllabus is created
from a base, CLOs will be one-time-copied to course_clos.

Also add bloom_level column to course_clos to preserve Bloom taxonomy
level (1-6) when CLOs are copied from base to version.
EOF
)"
```

---

## Task 2: Backend API in `server.js`

**Files:**
- Modify: `server.js` — add 4 new routes, modify 2 existing routes, modify existing CLO CRUD.

- [ ] **Step 1: Add 4 base CLO CRUD routes**

Add these routes BEFORE the existing CLO routes (before `app.get('/api/syllabi/:sId/clos', ...)` at around line 2368). Group them together:

```js
// ============ BASE SYLLABUS CLOs ============
app.get('/api/courses/:courseId/base-syllabus/clos', authMiddleware, requirePerm('courses.view'), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM base_syllabus_clos WHERE course_id = $1 ORDER BY code',
      [req.params.courseId]
    );
    res.json(result.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/courses/:courseId/base-syllabus/clos', authMiddleware, requirePerm('courses.edit'), async (req, res) => {
  const { code, description, bloom_level } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO base_syllabus_clos (course_id, code, description, bloom_level) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.courseId, code, description || '', bloom_level || 1]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.put('/api/base-clos/:id', authMiddleware, requirePerm('courses.edit'), async (req, res) => {
  const { code, description, bloom_level } = req.body;
  try {
    const result = await pool.query(
      'UPDATE base_syllabus_clos SET code=COALESCE($1,code), description=COALESCE($2,description), bloom_level=COALESCE($3,bloom_level) WHERE id=$4 RETURNING *',
      [code, description, bloom_level, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});

app.delete('/api/base-clos/:id', authMiddleware, requirePerm('courses.edit'), async (req, res) => {
  try {
    await pool.query('DELETE FROM base_syllabus_clos WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 2: Modify version syllabus creation to auto-copy base CLOs**

Find `POST /api/versions/:vId/syllabi` (around line 1738-1775). After the `INSERT INTO version_syllabi` and BEFORE `res.json(...)`, add CLO copy step:

Find:

```js
    const result = await pool.query(
      'INSERT INTO version_syllabi (version_id, course_id, author_id, content) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.vId, course_id, req.user.id, JSON.stringify(initialContent)]
    );
    res.json({ ...result.rows[0], no_base_syllabus: noBaseSyllabus });
```

Replace with:

```js
    const result = await pool.query(
      'INSERT INTO version_syllabi (version_id, course_id, author_id, content) VALUES ($1,$2,$3,$4) RETURNING *',
      [req.params.vId, course_id, req.user.id, JSON.stringify(initialContent)]
    );

    // Auto-copy base syllabus CLOs into version course_clos
    const vc = await pool.query(
      'SELECT id FROM version_courses WHERE version_id=$1 AND course_id=$2',
      [req.params.vId, course_id]
    );
    if (vc.rows.length) {
      await pool.query(`
        INSERT INTO course_clos (version_course_id, code, description, bloom_level)
        SELECT $1, code, description, bloom_level
        FROM base_syllabus_clos WHERE course_id = $2
      `, [vc.rows[0].id, course_id]);
    }

    res.json({ ...result.rows[0], no_base_syllabus: noBaseSyllabus });
```

- [ ] **Step 3: Modify syllabus-from-assignment creation similarly**

Find `POST /api/syllabus-assignments/:id/syllabi` (around line 2352-2366). After the INSERT version_syllabi and BEFORE `res.json`, add the same CLO copy block:

Find the INSERT and res.json in that route. After INSERT result, before `res.json(result.rows[0])`:

```js
    // Auto-copy base syllabus CLOs
    const assignVc = await pool.query(
      'SELECT id FROM version_courses WHERE version_id=$1 AND course_id=$2',
      [assignment.version_id, assignment.course_id]
    );
    if (assignVc.rows.length) {
      await pool.query(`
        INSERT INTO course_clos (version_course_id, code, description, bloom_level)
        SELECT $1, code, description, bloom_level
        FROM base_syllabus_clos WHERE course_id = $2
      `, [assignVc.rows[0].id, assignment.course_id]);
    }
```

- [ ] **Step 4: Update existing CLO CRUD to include bloom_level**

**POST route** (`/api/syllabi/:sId/clos`, around line 2381):

Find:

```js
    const result = await pool.query(
      'INSERT INTO course_clos (version_course_id, code, description) VALUES ($1,$2,$3) RETURNING *',
      [vc.rows[0].id, code, description]
    );
```

Replace with:

```js
    const { code, description, bloom_level } = req.body;
    const result = await pool.query(
      'INSERT INTO course_clos (version_course_id, code, description, bloom_level) VALUES ($1,$2,$3,$4) RETURNING *',
      [vc.rows[0].id, code, description, bloom_level || 1]
    );
```

Also update the destructuring at the top of this handler — find `const { code, description } = req.body;` (line 2382) and replace with `const { code, description, bloom_level } = req.body;`. If the new destructuring is placed inside the try block as shown, remove the old one at the top.

**PUT route** (`/api/clos/:id`, around line 2400):

Find:

```js
  const { code, description } = req.body;
  try {
    const result = await pool.query(
      'UPDATE course_clos SET code=COALESCE($1,code), description=COALESCE($2,description) WHERE id=$3 RETURNING *',
      [code, description, req.params.id]
    );
```

Replace with:

```js
  const { code, description, bloom_level } = req.body;
  try {
    const result = await pool.query(
      'UPDATE course_clos SET code=COALESCE($1,code), description=COALESCE($2,description), bloom_level=COALESCE($3,bloom_level) WHERE id=$4 RETURNING *',
      [code, description, bloom_level, req.params.id]
    );
```

- [ ] **Step 5: Verify parse**

```bash
node --check server.js
```

Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "$(cat <<'EOF'
feat(api): base syllabus CLO CRUD + auto-copy to version + bloom_level

Add 4 routes for managing CLOs on base syllabi (GET/POST/PUT/DELETE).
When creating a version syllabus from base, auto-copy base_syllabus_clos
into course_clos for the corresponding version_course.

Also update existing CLO POST/PUT routes to accept and persist
bloom_level (1-6 Bloom taxonomy), matching the new base_syllabus_clos
schema.
EOF
)"
```

---

## Task 3: Base syllabus editor — CLO tab

**Files:**
- Modify: `public/js/pages/base-syllabus-editor.js`

- [ ] **Step 1: Add tab "CLO" at index 1, shift existing tabs**

Find the tab bar HTML (around line 68-73):

```html
      <div class="tab-bar" id="bs-tabs">
        <div class="tab-item active" data-tab="0">Thông tin chung</div>
        <div class="tab-item" data-tab="1">Nội dung giảng dạy</div>
        <div class="tab-item" data-tab="2">Đánh giá</div>
        <div class="tab-item" data-tab="3">Tài liệu</div>
      </div>
```

Replace with:

```html
      <div class="tab-bar" id="bs-tabs">
        <div class="tab-item active" data-tab="0">Thông tin chung</div>
        <div class="tab-item" data-tab="1">CLO</div>
        <div class="tab-item" data-tab="2">Nội dung giảng dạy</div>
        <div class="tab-item" data-tab="3">Đánh giá</div>
        <div class="tab-item" data-tab="4">Tài liệu</div>
      </div>
```

- [ ] **Step 2: Update `renderTab()` switch to handle new tab indices**

Find (around line 136-141):

```js
    switch (this.activeTab) {
      case 0: this.renderGeneralTab(body, editable, c); break;
      case 1: this.renderOutlineTab(body, editable, c); break;
      case 2: this.renderGradingTab(body, editable, c); break;
      case 3: this.renderResourcesTab(body, editable, c); break;
    }
```

Replace with:

```js
    switch (this.activeTab) {
      case 0: this.renderGeneralTab(body, editable, c); break;
      case 1: this.renderCLOTab(body, editable); break;
      case 2: this.renderOutlineTab(body, editable, c); break;
      case 3: this.renderGradingTab(body, editable, c); break;
      case 4: this.renderResourcesTab(body, editable, c); break;
    }
```

- [ ] **Step 3: Add `renderCLOTab` method**

Add this method to the `BaseSyllabusEditorPage` object (after `renderGeneralTab` or before `renderOutlineTab` — keep it near the other render methods):

```js
  // ============ TAB 1: CLOs ============
  async renderCLOTab(body, editable) {
    const bloomLabels = ['', '1 — Nhớ', '2 — Hiểu', '3 — Áp dụng', '4 — Phân tích', '5 — Đánh giá', '6 — Sáng tạo'];
    let clos = [];
    try {
      clos = await fetch(`/api/courses/${this.courseId}/base-syllabus/clos`).then(r => r.json());
    } catch (e) { /* empty */ }

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Chuẩn đầu ra môn học (CLO)</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.showBaseCLOForm()">+ Thêm CLO</button>' : ''}
      </div>
      <table class="data-table">
        <thead><tr><th>Mã</th><th>Mô tả</th><th style="width:140px;">Bloom Level</th>${editable ? '<th style="width:100px;"></th>' : ''}</tr></thead>
        <tbody>
          ${clos.length === 0 ? `<tr><td colspan="${editable ? 4 : 3}" style="color:var(--text-muted);text-align:center;">Chưa có CLO</td></tr>` : clos.map(c => `
            <tr>
              <td><strong style="color:var(--primary);">${c.code || ''}</strong></td>
              <td style="font-size:13px;">${c.description || ''}</td>
              <td><span class="badge badge-info">${bloomLabels[c.bloom_level] || c.bloom_level}</span></td>
              ${editable ? `<td style="white-space:nowrap;">
                <button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.editBaseCLO(${c.id})">Sửa</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.BaseSyllabusEditorPage.deleteBaseCLO(${c.id})">Xóa</button>
              </td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div id="bs-clo-form" style="display:none;margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
        <input type="hidden" id="bs-clo-edit-id">
        <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;">
          <div class="input-group" style="width:100px;margin:0;"><label>Mã</label><input type="text" id="bs-clo-code" placeholder="CLO1"></div>
          <div class="input-group" style="flex:1;margin:0;"><label>Mô tả</label><input type="text" id="bs-clo-desc" placeholder="Trình bày được..."></div>
          <div class="input-group" style="width:160px;margin:0;">
            <label>Bloom Level</label>
            <select id="bs-clo-bloom">
              <option value="1">1 — Nhớ</option>
              <option value="2">2 — Hiểu</option>
              <option value="3">3 — Áp dụng</option>
              <option value="4">4 — Phân tích</option>
              <option value="5">5 — Đánh giá</option>
              <option value="6">6 — Sáng tạo</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.saveBaseCLO()">Lưu</button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('bs-clo-form').style.display='none'">Hủy</button>
        </div>
      </div>
    `;
  },

  showBaseCLOForm(id, code, desc, bloom) {
    document.getElementById('bs-clo-edit-id').value = id || '';
    document.getElementById('bs-clo-code').value = code || '';
    document.getElementById('bs-clo-desc').value = desc || '';
    document.getElementById('bs-clo-bloom').value = bloom || 1;
    document.getElementById('bs-clo-form').style.display = 'block';
  },

  editBaseCLO(id) {
    fetch(`/api/courses/${this.courseId}/base-syllabus/clos`).then(r => r.json()).then(clos => {
      const c = clos.find(x => x.id === id);
      if (c) this.showBaseCLOForm(c.id, c.code, c.description, c.bloom_level);
    });
  },

  async saveBaseCLO() {
    const id = document.getElementById('bs-clo-edit-id').value;
    const code = document.getElementById('bs-clo-code').value.trim();
    const description = document.getElementById('bs-clo-desc').value.trim();
    const bloom_level = parseInt(document.getElementById('bs-clo-bloom').value) || 1;
    if (!code) { window.toast.warning('Nhập mã CLO'); return; }
    try {
      const url = id ? `/api/base-clos/${id}` : `/api/courses/${this.courseId}/base-syllabus/clos`;
      const res = await fetch(url, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, description, bloom_level })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success(id ? 'Đã cập nhật CLO' : 'Đã thêm CLO');
      document.getElementById('bs-clo-form').style.display = 'none';
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },

  async deleteBaseCLO(id) {
    const confirmed = await window.ui.confirm({
      title: 'Xóa CLO', message: 'Bạn có chắc muốn xóa CLO này?',
      confirmText: 'Xóa', cancelText: 'Hủy', tone: 'warning'
    });
    if (!confirmed) return;
    try {
      await fetch(`/api/base-clos/${id}`, { method: 'DELETE' });
      window.toast.success('Đã xóa CLO');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },
```

Note: the `renderCLOTab` method fetches CLOs from API (NOT from `this.baseSyllabus.content`), since CLOs live in their own table.

- [ ] **Step 4: Verify `_collectCurrentTabIntoState` does NOT need changes for tab 1**

The `_collectCurrentTabIntoState` method collects form inputs into `this.baseSyllabus.content` before tab switch. Since CLO tab uses API CRUD (not local state), it does NOT need collection. Verify the method only handles cases 0-3 (now 0, 2, 3, 4 after shift) and doesn't break. If it uses the old tab indices, update them.

Find `_collectCurrentTabIntoState` and check its switch cases. Update if needed to match new indices (tab 0 = general, tab 2 = outline, tab 3 = grading, tab 4 = resources).

- [ ] **Step 5: Verify parse**

```bash
node --check public/js/pages/base-syllabus-editor.js
```

- [ ] **Step 6: Commit**

```bash
git add public/js/pages/base-syllabus-editor.js
git commit -m "$(cat <<'EOF'
feat(frontend): add CLO tab to base syllabus editor

New tab at index 1 for managing base syllabus CLOs (code, description,
Bloom taxonomy level 1-6). Uses API CRUD routes, not local state.
Existing tabs (Nội dung giảng dạy, Đánh giá, Tài liệu) shifted to
indices 2, 3, 4.
EOF
)"
```

---

## Task 4: Version syllabus editor — bloom_level

**Files:**
- Modify: `public/js/pages/syllabus-editor.js` — CLO tab (tab 1) and CLO form.

- [ ] **Step 1: Add Bloom Level column to CLO table**

In `renderCLOTab` (around line 269-311), update the table header and rows:

Find:

```js
        <thead><tr><th>Mã</th><th>Mô tả</th>${editable ? '<th style="width:100px;"></th>' : ''}</tr></thead>
```

Replace with:

```js
        <thead><tr><th>Mã</th><th>Mô tả</th><th style="width:140px;">Bloom</th>${editable ? '<th style="width:100px;"></th>' : ''}</tr></thead>
```

In the row template, find:

```js
              <td style="font-size:13px;">${c.description || ''}</td>
```

After this line, add:

```js
              <td><span class="badge badge-info">${['','Nhớ','Hiểu','Áp dụng','Phân tích','Đánh giá','Sáng tạo'][c.bloom_level] || c.bloom_level || ''}</span></td>
```

Update the empty-state colspan from 3/2 to 4/3:

```js
          ${this.clos.length === 0 ? `<tr><td colspan="${editable ? 4 : 3}" ...
```

- [ ] **Step 2: Add bloom_level input to CLO form**

In the inline form area (around line 301-309), find:

```js
          <div class="input-group" style="flex:1;margin:0;"><label>Mô tả</label><input type="text" id="clo-desc" placeholder="Mô tả CLO"></div>
          <button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveCLO()">Lưu</button>
```

Replace with:

```js
          <div class="input-group" style="flex:1;margin:0;"><label>Mô tả</label><input type="text" id="clo-desc" placeholder="Mô tả CLO"></div>
          <div class="input-group" style="width:150px;margin:0;">
            <label>Bloom</label>
            <select id="clo-bloom">
              <option value="1">1 — Nhớ</option>
              <option value="2">2 — Hiểu</option>
              <option value="3">3 — Áp dụng</option>
              <option value="4">4 — Phân tích</option>
              <option value="5">5 — Đánh giá</option>
              <option value="6">6 — Sáng tạo</option>
            </select>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveCLO()">Lưu</button>
```

- [ ] **Step 3: Update `editCLO` to populate bloom**

Find `editCLO` method (around line 313-318):

```js
  editCLO(id, code, desc) {
    document.getElementById('clo-edit-id').value = id;
    document.getElementById('clo-code').value = code;
    document.getElementById('clo-desc').value = desc;
    document.getElementById('clo-form-area').style.display = 'block';
  },
```

Replace with:

```js
  editCLO(id, code, desc, bloom) {
    document.getElementById('clo-edit-id').value = id;
    document.getElementById('clo-code').value = code;
    document.getElementById('clo-desc').value = desc;
    document.getElementById('clo-bloom').value = bloom || 1;
    document.getElementById('clo-form-area').style.display = 'block';
  },
```

Also update the `onclick` for the "Sửa" button in the row template to pass `bloom_level`:

Find (in `renderCLOTab`):

```js
                ${c.id ? `<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.editCLO(${c.id},'${c.code}',\`${(c.description||'').replace(/`/g,"'")}\`)">Sửa</button>
```

Replace with:

```js
                ${c.id ? `<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.editCLO(${c.id},'${c.code}',\`${(c.description||'').replace(/`/g,"'")}\`,${c.bloom_level||1})">Sửa</button>
```

- [ ] **Step 4: Update `saveCLO` to send bloom_level**

Find `saveCLO` method (around line 320-330):

```js
    const code = document.getElementById('clo-code').value.trim();
    const description = document.getElementById('clo-desc').value.trim();
    if (!code) { window.toast.warning('Nhập mã CLO'); return; }
    try {
      const url = id ? `/api/clos/${id}` : `/api/syllabi/${this.syllabusId}/clos`;
      const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, description }) });
```

Replace with:

```js
    const code = document.getElementById('clo-code').value.trim();
    const description = document.getElementById('clo-desc').value.trim();
    const bloom_level = parseInt(document.getElementById('clo-bloom').value) || 1;
    if (!code) { window.toast.warning('Nhập mã CLO'); return; }
    try {
      const url = id ? `/api/clos/${id}` : `/api/syllabi/${this.syllabusId}/clos`;
      const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, description, bloom_level }) });
```

- [ ] **Step 5: Reset bloom_level in `openAddCLOModal`**

Find where `openAddCLOModal` resets the form fields. It likely calls something like:

```js
  openAddCLOModal() {
    document.getElementById('clo-edit-id').value = '';
    document.getElementById('clo-code').value = '';
    document.getElementById('clo-desc').value = '';
    document.getElementById('clo-form-area').style.display = 'block';
  },
```

Add `document.getElementById('clo-bloom').value = '1';` after the desc reset.

- [ ] **Step 6: Verify parse**

```bash
node --check public/js/pages/syllabus-editor.js
```

- [ ] **Step 7: Commit**

```bash
git add public/js/pages/syllabus-editor.js
git commit -m "$(cat <<'EOF'
feat(frontend): add bloom_level to CLO tab in syllabus editor

Show Bloom taxonomy level column in the CLO table, and add a dropdown
in the CLO add/edit form. Auto-populated CLOs from base syllabus now
display their bloom level. Existing manually-created CLOs default to
level 1 (Nhớ).
EOF
)"
```

---

## Self-Review Notes

**Spec coverage:**
- ✅ Schema `base_syllabus_clos` + ALTER `course_clos` → Task 1
- ✅ 4 CRUD routes base CLOs → Task 2 Step 1
- ✅ Auto-copy base → version CLOs → Task 2 Steps 2-3
- ✅ bloom_level in existing CLO CRUD → Task 2 Step 4
- ✅ Base syllabus editor CLO tab → Task 3
- ✅ Version syllabus editor bloom_level → Task 4
- ✅ CLO-PLO mapping untouched (out of scope)
- ✅ Copy version logic untouched (out of scope)

**Placeholder scan:** none. All code blocks complete.

**Type/ID consistency:**
- `bloom_level` INT consistently used in schema, API payload, and UI select values (1-6).
- Route paths: `GET/POST /api/courses/:courseId/base-syllabus/clos`, `PUT/DELETE /api/base-clos/:id` — consistent with spec.
- `course_id` used in base_syllabus_clos, matching base syllabus table pattern.
