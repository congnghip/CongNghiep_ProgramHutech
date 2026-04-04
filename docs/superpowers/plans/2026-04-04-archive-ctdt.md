# Archive CTDT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow admins to archive/unarchive CTDT (programs) that have published versions, hiding them from all users and blocking API access, instead of failing with an unhelpful "contact admin" error.

**Architecture:** Add `archived_at` timestamp column to `programs` table. Filter archived programs from listings, block version access via `requireViewVersion` middleware, and provide archive/unarchive endpoints restricted to ADMIN role. Frontend adds "Lưu trữ" tab for admin and contextual archive/restore buttons.

**Tech Stack:** Express.js backend, PostgreSQL, vanilla JS frontend (SPA)

---

### Task 1: Add `archived_at` column to programs table

**Files:**
- Modify: `db.js:284-286` (after existing ALTER TABLE statements)

- [ ] **Step 1: Add ALTER TABLE statement in initDB**

In `db.js`, after line 286 (`ALTER TABLE version_courses ADD COLUMN ...`), add:

```sql
ALTER TABLE programs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
```

The full change — insert this line after the existing `ALTER TABLE version_courses` line:

```js
      ALTER TABLE programs ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ DEFAULT NULL;
```

- [ ] **Step 2: Verify the app starts without error**

Run: `make dev` (or `npm run dev`)
Expected: Server starts, `initDB` runs without error. Check console for no SQL errors.

- [ ] **Step 3: Commit**

```bash
git add db.js
git commit -m "feat: add archived_at column to programs table"
```

---

### Task 2: Add archive/unarchive API endpoints

**Files:**
- Modify: `server.js:547-571` (insert new endpoints after the DELETE /api/programs/:id route)

- [ ] **Step 1: Add POST /api/programs/:id/archive endpoint**

In `server.js`, after the `DELETE /api/programs/:id` route (after line 571), add:

```js
app.post('/api/programs/:id/archive', authMiddleware, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    if (!admin) return res.status(403).json({ error: 'Chỉ Admin mới có quyền lưu trữ CTĐT.' });
    const result = await pool.query('UPDATE programs SET archived_at = NOW() WHERE id = $1 AND archived_at IS NULL RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'CTĐT không tồn tại hoặc đã được lưu trữ.' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 2: Add POST /api/programs/:id/unarchive endpoint**

Immediately after the archive endpoint, add:

```js
app.post('/api/programs/:id/unarchive', authMiddleware, async (req, res) => {
  try {
    const admin = await isAdmin(req.user.id);
    if (!admin) return res.status(403).json({ error: 'Chỉ Admin mới có quyền khôi phục CTĐT.' });
    const result = await pool.query('UPDATE programs SET archived_at = NULL WHERE id = $1 AND archived_at IS NOT NULL RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'CTĐT không tồn tại hoặc chưa được lưu trữ.' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
```

- [ ] **Step 3: Verify endpoints respond correctly**

Start the server, then test with curl:

```bash
# Should get 403 (not admin) or 200 (admin) — depends on auth cookie
curl -X POST http://localhost:3600/api/programs/1/archive -v
```

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: add archive/unarchive API endpoints for programs"
```

---

### Task 3: Filter archived programs from GET /api/programs

**Files:**
- Modify: `server.js:507-528` (the GET /api/programs query)

- [ ] **Step 1: Add archived_at filter to programs listing**

In `server.js`, the `GET /api/programs` handler builds conditions starting around line 512. After `const conditions = [];` (line 512), add the archive filter logic:

```js
    // Archive filter: by default hide archived, admin can request ?archived=true
    if (admin && req.query.archived === 'true') {
      conditions.push('p.archived_at IS NOT NULL');
    } else {
      conditions.push('p.archived_at IS NULL');
    }
```

This goes right after line 512 (`const conditions = [];`) and before the `if (!admin)` block on line 514.

- [ ] **Step 2: Verify the filter works**

Start the server, log in as admin. The programs list should show only non-archived programs. If no programs are archived yet, the list should look the same as before.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: filter archived programs from listing, admin can view archived via query param"
```

---

### Task 4: Block version access for archived programs

**Files:**
- Modify: `server.js:149-210` (requireViewVersion middleware)
- Modify: `server.js:574-603` (GET /api/programs/:programId/versions)

- [ ] **Step 1: Add archived check to requireViewVersion middleware**

In `server.js`, the `requireViewVersion` middleware starts at line 149. Currently line 151-152 is:

```js
    const admin = await isAdmin(req.user.id);
    if (admin) return next();
```

Replace lines 151-152 with an archived check that applies to ALL users (including admin):

```js
    const admin = await isAdmin(req.user.id);

    // Block access to versions of archived programs (for ALL users including admin)
    let checkVId = req.params.vId || (req.path.includes('/api/versions/') ? req.params.id : null);
    let checkSId = req.params.sId || (req.path.includes('/api/syllabi/') ? req.params.id : null);
    if (req.path.includes('/api/export/version/')) checkVId = req.params.vId;
    if (req.params.entityType === 'program_version') checkVId = req.params.entityId;
    if (req.params.entityType === 'syllabus') checkSId = req.params.entityId;

    let archivedQuery, archivedParams;
    if (checkVId) {
      archivedQuery = 'SELECT p.archived_at FROM program_versions pv JOIN programs p ON pv.program_id = p.id WHERE pv.id = $1';
      archivedParams = [checkVId];
    } else if (checkSId) {
      archivedQuery = 'SELECT p.archived_at FROM version_syllabi vs JOIN program_versions pv ON vs.version_id = pv.id JOIN programs p ON pv.program_id = p.id WHERE vs.id = $1';
      archivedParams = [checkSId];
    }
    if (archivedQuery) {
      const archivedRes = await pool.query(archivedQuery, archivedParams);
      if (archivedRes.rows.length && archivedRes.rows[0].archived_at) {
        return res.status(404).json({ error: 'CTĐT đã được lưu trữ.' });
      }
    }

    if (admin) return next();
```

- [ ] **Step 2: Add archived check to GET /api/programs/:programId/versions**

In `server.js`, the `GET /api/programs/:programId/versions` handler at line 577 queries:

```js
    const progRes = await pool.query('SELECT department_id FROM programs WHERE id = $1', [req.params.programId]);
```

Change this to also check archived_at:

```js
    const progRes = await pool.query('SELECT department_id, archived_at FROM programs WHERE id = $1', [req.params.programId]);
    if (!progRes.rows.length) return res.status(404).json({ error: 'CTĐT không tồn tại' });
    if (progRes.rows[0].archived_at) return res.status(404).json({ error: 'CTĐT đã được lưu trữ.' });
```

Note: remove the duplicate `if (!progRes.rows.length)` check on the next line (line 578) since it's now included above.

- [ ] **Step 3: Verify archived check blocks access**

Manually archive a program via psql or API, then try accessing its versions:

```bash
# Archive program with id 1 (adjust as needed)
curl -X POST http://localhost:3600/api/programs/1/archive --cookie "token=<admin_token>"
# Try to access versions — should get 404
curl http://localhost:3600/api/programs/1/versions --cookie "token=<admin_token>"
# Unarchive to restore
curl -X POST http://localhost:3600/api/programs/1/unarchive --cookie "token=<admin_token>"
```

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: block version access for archived programs via middleware"
```

---

### Task 5: Update delete program error message

**Files:**
- Modify: `server.js:552` (error message in DELETE /api/programs/:id)

- [ ] **Step 1: Change the error message**

In `server.js` line 552, change:

```js
      return res.status(400).json({ error: 'Không thể xóa CTĐT đã công bố. Hãy liên hệ Admin nếu cần xóa triệt để.' });
```

to:

```js
      return res.status(400).json({ error: 'Không thể xóa CTĐT đã công bố. Hãy sử dụng chức năng Lưu trữ thay vì xóa.' });
```

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "fix: update delete program error message to reference archive feature"
```

---

### Task 6: Add dashboard archived filter

**Files:**
- Modify: `server.js:2240` (dashboard stats query)

- [ ] **Step 1: Exclude archived programs from dashboard count**

In `server.js` line 2240, the dashboard stats query is:

```js
        `SELECT COUNT(*) as c FROM programs p WHERE 1=1 ${deptFilter}`,
```

Change to:

```js
        `SELECT COUNT(*) as c FROM programs p WHERE p.archived_at IS NULL ${deptFilter}`,
```

Also on line 2246, the versions query:

```js
         FROM program_versions pv
         JOIN programs p ON pv.program_id = p.id
         WHERE 1=1 ${deptFilter}
```

Change to:

```js
         FROM program_versions pv
         JOIN programs p ON pv.program_id = p.id
         WHERE p.archived_at IS NULL ${deptFilter}
```

- [ ] **Step 2: Commit**

```bash
git add server.js
git commit -m "fix: exclude archived programs from dashboard stats"
```

---

### Task 7: Frontend — Add archive tab and buttons to programs list

**Files:**
- Modify: `public/js/pages/programs.js:6-17` (render method — add tab)
- Modify: `public/js/pages/programs.js:247-262` (loadData — support archived param)
- Modify: `public/js/pages/programs.js:298-315` (renderProg — archive button)
- Modify: `public/js/pages/programs.js:333-352` (deleteProgram — keep as-is, add archiveProgram)

- [ ] **Step 1: Add tab UI and state tracking**

In `public/js/pages/programs.js`, add `showArchived` state at the top (after line 3):

```js
  showArchived: false,
```

In the `render` method (line 8), modify the card-header div to include the archive tab for admin. Change the header section to:

```js
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Chương trình Đào tạo</div>
          <div style="display:flex;gap:8px;align-items:center;">
            ${window.App.isAdmin ? `<button id="archive-tab-btn" class="btn ${this.showArchived ? 'btn-warning' : 'btn-outline-secondary'} btn-sm" onclick="window.ProgramsPage.toggleArchived()">${this.showArchived ? '📦 Đang xem: Đã lưu trữ' : '📦 Đã lưu trữ'}</button>` : ''}
            ${window.App.hasPerm('programs.import_word') ? `<button class="btn btn-outline-primary" onclick="window.App.navigate('import-word')">Import Word</button>` : ''}
            ${!this.showArchived && window.App.hasPerm('programs.create') ? `<button class="btn btn-primary" onclick="window.ProgramsPage.openAddModal()">+ Tạo CTĐT</button>` : ''}
          </div>
        </div>
        <div id="programs-content" class="card-body"><div class="spinner"></div></div>
      </div>
```

- [ ] **Step 2: Add toggleArchived method and update loadData**

Add the `toggleArchived` method after `loadData` (after line 272):

```js
  toggleArchived() {
    this.showArchived = !this.showArchived;
    const container = document.getElementById('programs-content').closest('.card').parentElement;
    this.render(container);
  },
```

Update `loadData` (line 250) to pass the archived query param:

Change:
```js
        fetch('/api/programs').then(r => r.json()),
```
To:
```js
        fetch(`/api/programs${this.showArchived ? '?archived=true' : ''}`).then(r => r.json()),
```

- [ ] **Step 3: Update renderProg to show archive/restore buttons**

In `renderProg` (around line 310-313), replace the action buttons section:

Change this block:
```js
        <div style="display:flex;gap:6px;flex-shrink:0;" onclick="event.stopPropagation()">
          ${window.App.hasPerm('programs.edit') ? `<button class="btn btn-sm" style="background:none;border:1px solid var(--border);color:var(--text);font-size:12px;" onclick="window.ProgramsPage.openEditModal(${p.id})">Chỉnh sửa</button>` : ''}
          ${window.App.hasPerm('programs.delete_draft') ? `<button class="btn btn-sm" style="background:none;border:none;color:var(--danger);font-size:12px;font-weight:500;" onclick="window.ProgramsPage.deleteProgram(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Xóa</button>` : ''}
        </div>
```

To:
```js
        <div style="display:flex;gap:6px;flex-shrink:0;" onclick="event.stopPropagation()">
          ${p.archived_at ? `
            ${window.App.isAdmin ? `<button class="btn btn-sm btn-outline-primary" style="font-size:12px;" onclick="window.ProgramsPage.unarchiveProgram(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Khôi phục</button>` : ''}
          ` : `
            ${window.App.hasPerm('programs.edit') ? `<button class="btn btn-sm" style="background:none;border:1px solid var(--border);color:var(--text);font-size:12px;" onclick="window.ProgramsPage.openEditModal(${p.id})">Chỉnh sửa</button>` : ''}
            ${window.App.hasPerm('programs.delete_draft') ? `<button class="btn btn-sm" style="background:none;border:none;color:var(--danger);font-size:12px;font-weight:500;" onclick="window.ProgramsPage.deleteProgram(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Xóa</button>` : ''}
            ${window.App.isAdmin && parseInt(p.version_count) > 0 ? `<button class="btn btn-sm" style="background:none;border:none;color:var(--warning, #e67e22);font-size:12px;font-weight:500;" onclick="window.ProgramsPage.archiveProgram(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Lưu trữ</button>` : ''}
          `}
        </div>
```

Note: The "Lưu trữ" button shows for admin on any program that has at least one version. The "Xóa" button is still available for programs without published versions (the API handles the actual check).

- [ ] **Step 4: Add archiveProgram and unarchiveProgram methods**

Add these methods after `deleteProgram` (after line 352):

```js
  async archiveProgram(id, name) {
    const confirmed = await window.ui.confirm({
      title: 'Lưu trữ chương trình đào tạo',
      eyebrow: 'Lưu trữ',
      message: `Bạn có chắc chắn muốn lưu trữ CTĐT "${name}"?\n\nCTĐT sẽ bị ẩn khỏi tất cả người dùng. Bạn có thể khôi phục sau.`,
      confirmText: 'Lưu trữ',
      cancelText: 'Hủy',
      tone: 'warning',
      confirmVariant: 'warning'
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/programs/${id}/archive`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      window.toast.success('Đã lưu trữ chương trình đào tạo');
      await this.loadData();
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  async unarchiveProgram(id, name) {
    const confirmed = await window.ui.confirm({
      title: 'Khôi phục chương trình đào tạo',
      eyebrow: 'Khôi phục',
      message: `Bạn có chắc chắn muốn khôi phục CTĐT "${name}"?\n\nCTĐT sẽ hiển thị lại cho tất cả người dùng.`,
      confirmText: 'Khôi phục',
      cancelText: 'Hủy',
      tone: 'info',
      confirmVariant: 'primary'
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/programs/${id}/unarchive`, { method: 'POST' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      window.toast.success('Đã khôi phục chương trình đào tạo');
      await this.loadData();
    } catch (e) {
      window.toast.error(e.message);
    }
  },
```

- [ ] **Step 5: Update the archived list empty state**

In `renderList` (line 276-278), update the empty state to be contextual:

Change:
```js
      content.innerHTML = '<div class="empty-state"><div class="icon">📭</div><h3>Chưa có CTĐT nào</h3><p>Nhấn "+ Tạo CTĐT" để bắt đầu</p></div>';
```

To:
```js
      content.innerHTML = this.showArchived
        ? '<div class="empty-state"><div class="icon">📦</div><h3>Không có CTĐT nào được lưu trữ</h3></div>'
        : '<div class="empty-state"><div class="icon">📭</div><h3>Chưa có CTĐT nào</h3><p>Nhấn "+ Tạo CTĐT" để bắt đầu</p></div>';
```

- [ ] **Step 6: Add archived_at to the API response**

In `server.js`, the `GET /api/programs` query at line 498 uses `SELECT p.*` which already includes `archived_at` (since it selects all columns). No change needed here — `p.*` will automatically include the new column.

Verify: the `archived_at` field will be available in the frontend data (`p.archived_at` in `renderProg`).

- [ ] **Step 7: Verify the full flow in browser**

1. Log in as admin (admin/admin123)
2. Verify programs list shows normally (no archived programs)
3. Click "Lưu trữ" on a program → confirm → program disappears from list
4. Click "📦 Đã lưu trữ" tab → see archived programs
5. Click "Khôi phục" → program returns to main list
6. Log in as non-admin user → "Đã lưu trữ" tab should not be visible

- [ ] **Step 8: Commit**

```bash
git add public/js/pages/programs.js
git commit -m "feat: add archive/unarchive UI with admin-only tab and buttons"
```

---

### Task 8: Final integration test

- [ ] **Step 1: Test complete archive flow**

1. Log in as admin
2. Create or find a CTDT with a published version
3. Try to delete it → should show updated error message mentioning "Lưu trữ"
4. Click "Lưu trữ" → program disappears
5. Switch to "Đã lưu trữ" tab → program is there
6. Try navigating directly to a version of the archived program (via URL) → should get 404 error
7. Click "Khôi phục" → program is back in main list
8. Version access works again

- [ ] **Step 2: Test non-admin user**

1. Log in as a non-admin user
2. Verify "Đã lưu trữ" tab is not visible
3. Verify "Lưu trữ" button is not visible
4. If a program was archived by admin, verify it's completely hidden

- [ ] **Step 3: Test dashboard stats**

1. Archive a program
2. Check dashboard → program count should decrease
3. Unarchive → count should increase back

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: integration fixes for archive CTDT feature"
```
