# Knowledge Blocks Course Grouping — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable grouping courses (HP) within a CTDT version into a 3-level knowledge block tree, with auto-calculated credits, default seed blocks on version creation, and a full UI for managing assignments in the "Khối KT" tab.

**Architecture:** Extend the existing `knowledge_blocks` table with a `level` column, add `knowledge_block_id` FK on `version_courses`, expand the GET endpoint to return courses per block with auto-calculated credits, add CRUD + assign-courses endpoints, seed default blocks on version creation, and rewrite the "Khối KT" tab frontend as an interactive tree with course assignment modals.

**Tech Stack:** Node.js/Express (server.js), PostgreSQL (db.js), vanilla JS frontend (public/js/pages/version-editor.js)

**Spec:** `docs/superpowers/specs/2026-03-26-knowledge-blocks-course-grouping-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `db.js` | Modify (lines 273-282, 595-665) | Add `level` column to schema, add `knowledge_block_id` to `version_courses`, seed default blocks on sample data, update `initDB` |
| `server.js` | Modify (lines 595-665, 998-1008) | Add POST/PUT/DELETE knowledge-blocks routes, add PUT assign-courses route, expand GET to return courses + auto credits, seed blocks on version creation |
| `public/js/pages/version-editor.js` | Modify (lines 689-728) | Rewrite `renderKnowledgeBlocksTab` with 3-level tree, course assignment modal, add/edit/delete block UI |

---

### Task 1: Database Schema Changes

**Files:**
- Modify: `db.js:273-282` (knowledge_blocks table)
- Modify: `db.js:157-166` (version_courses table)

- [ ] **Step 1: Add `level` column to `knowledge_blocks` table**

In `db.js`, after the existing `knowledge_blocks` CREATE TABLE (line 282), add an ALTER TABLE statement. Find the closing of the CREATE TABLE block and add after it:

```js
// In the initDB function, after the knowledge_blocks CREATE TABLE, add:
      ALTER TABLE knowledge_blocks ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;
```

This goes inside the same template literal query string, right after line 282's closing `);` for the knowledge_blocks CREATE TABLE.

- [ ] **Step 2: Add `knowledge_block_id` FK to `version_courses`**

In `db.js`, after the `version_courses` CREATE TABLE (line 166), add:

```sql
      ALTER TABLE version_courses ADD COLUMN IF NOT EXISTS knowledge_block_id INT REFERENCES knowledge_blocks(id) ON DELETE SET NULL;
```

- [ ] **Step 3: Update seed data to include `level` for existing knowledge blocks**

In `db.js`, find the knowledge blocks seed section (lines 631-651). Update the `kbData` array to include level values and change the INSERT to include the `level` column:

```js
    // Knowledge blocks (with levels)
    const kbData = [
      ['Kiến thức giáo dục đại cương', null, 1, 12, 12, 0],
      ['Lý luận chính trị', 'Kiến thức giáo dục đại cương', 2, 3, 3, 0],
      ['Ngoại ngữ', 'Kiến thức giáo dục đại cương', 2, 3, 3, 0],
      ['Toán & Khoa học tự nhiên', 'Kiến thức giáo dục đại cương', 2, 6, 6, 0],
      ['Kiến thức giáo dục chuyên nghiệp', null, 1, 48, 42, 6],
      ['Cơ sở ngành', 'Kiến thức giáo dục chuyên nghiệp', 2, 15, 15, 0],
      ['Chuyên ngành', 'Kiến thức giáo dục chuyên nghiệp', 2, 18, 12, 6],
      ['Thực tập & Đồ án', 'Kiến thức giáo dục chuyên nghiệp', 2, 6, 6, 0],
    ];
    const kbIds = {};
    let kbOrder = 0;
    for (const [name, parent, level, total, req, elec] of kbData) {
      kbOrder++;
      const parentId = parent ? (kbIds[parent] || null) : null;
      const r = await client.query(
        'INSERT INTO knowledge_blocks (version_id, name, parent_id, level, total_credits, required_credits, elective_credits, sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',
        [verId, name, parentId, level, total, req, elec, kbOrder]
      );
      kbIds[name] = r.rows[0].id;
    }
```

- [ ] **Step 4: Verify by running the app**

Run: `make dev`

Expected: App starts without database errors. Check console for `✅ Database schema initialized`.

- [ ] **Step 5: Commit**

```bash
git add db.js
git commit -m "feat: add level column to knowledge_blocks and knowledge_block_id FK to version_courses"
```

---

### Task 2: Seed Default Knowledge Blocks on Version Creation

**Files:**
- Modify: `server.js:595-665` (POST /api/programs/:programId/versions)

- [ ] **Step 1: Add default knowledge blocks seed after version creation**

In `server.js`, inside the `POST /api/programs/:programId/versions` route handler, after line 613 (`const newVersionId = ver.rows[0].id;`) and before the `if (copy_from_version_id)` check (line 617), add the seed logic for default blocks:

```js
    // Seed default knowledge blocks for the new version
    const gddc = await client.query(
      `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, sort_order) VALUES ($1, 'Kiến thức giáo dục đại cương', NULL, 1, 1) RETURNING id`,
      [newVersionId]
    );
    const gdcn = await client.query(
      `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, sort_order) VALUES ($1, 'Kiến thức giáo dục chuyên nghiệp', NULL, 1, 2) RETURNING id`,
      [newVersionId]
    );
    await client.query(
      `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, sort_order) VALUES ($1, 'Kiến thức bắt buộc', $2, 2, 3)`,
      [newVersionId, gdcn.rows[0].id]
    );
    await client.query(
      `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, sort_order) VALUES ($1, 'Kiến thức tự chọn', $2, 2, 4)`,
      [newVersionId, gdcn.rows[0].id]
    );
    await client.query(
      `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, sort_order) VALUES ($1, 'Kiến thức không tích lũy', NULL, 1, 5) RETURNING id`,
      [newVersionId]
    );
```

- [ ] **Step 2: Also copy knowledge blocks when copying from existing version**

Inside the `if (copy_from_version_id)` block (after the syllabi copy around line 656), add knowledge block copy logic:

```js
      // Copy knowledge blocks (preserving hierarchy)
      const oldBlocks = await client.query(
        'SELECT * FROM knowledge_blocks WHERE version_id=$1 ORDER BY sort_order, id',
        [copy_from_version_id]
      );
      const blockMap = {};
      for (const ob of oldBlocks.rows) {
        const newParentId = ob.parent_id ? (blockMap[ob.parent_id] || null) : null;
        const nb = await client.query(
          `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, total_credits, required_credits, elective_credits, sort_order)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
          [newVersionId, ob.name, newParentId, ob.level || 1, ob.total_credits, ob.required_credits, ob.elective_credits, ob.sort_order]
        );
        blockMap[ob.id] = nb.rows[0].id;
      }

      // Update knowledge_block_id for copied version_courses
      const newVCs = await client.query('SELECT id, course_id FROM version_courses WHERE version_id=$1', [newVersionId]);
      for (const nvc of newVCs.rows) {
        const oldVC = oldCourses.rows.find(oc => oc.course_id === nvc.course_id);
        if (oldVC && oldVC.knowledge_block_id && blockMap[oldVC.knowledge_block_id]) {
          await client.query('UPDATE version_courses SET knowledge_block_id=$1 WHERE id=$2', [blockMap[oldVC.knowledge_block_id], nvc.id]);
        }
      }
```

Note: The copy of `version_courses` at line 644-650 currently doesn't copy `knowledge_block_id`. Update that INSERT to include it:

```js
      const oldCourses = await client.query('SELECT * FROM version_courses WHERE version_id=$1', [copy_from_version_id]);
      for (const oc of oldCourses.rows) {
        await client.query(
          'INSERT INTO version_courses (version_id, course_id, semester, course_type, elective_group, knowledge_block_id) VALUES ($1,$2,$3,$4,$5,$6)',
          [newVersionId, oc.course_id, oc.semester, oc.course_type, oc.elective_group, null]
        );
      }
```

We set `knowledge_block_id` to `null` initially because block IDs from old version don't exist yet. The block mapping is done after both blocks and courses are copied (see the "Update knowledge_block_id for copied version_courses" step above). Move that step after the block copy.

- [ ] **Step 3: Verify by testing version creation**

Run: `make dev`

Test: Create a new version via the UI. Check that 5 default knowledge blocks appear in the "Khối KT" tab.

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: seed default knowledge blocks on version creation and copy on version copy"
```

---

### Task 3: API — Expanded GET Knowledge Blocks with Courses and Auto Credits

**Files:**
- Modify: `server.js:998-1008` (GET /api/versions/:vId/knowledge-blocks)

- [ ] **Step 1: Rewrite GET endpoint to return tree with courses and auto-calculated credits**

Replace the existing GET handler at `server.js:998-1008` with:

```js
app.get('/api/versions/:vId/knowledge-blocks', authMiddleware, async (req, res) => {
  try {
    // Get all blocks for this version
    const { rows: blocks } = await pool.query(
      `SELECT * FROM knowledge_blocks WHERE version_id = $1 ORDER BY sort_order, id`,
      [req.params.vId]
    );

    // Get all version_courses with their knowledge_block_id and course info
    const { rows: courses } = await pool.query(
      `SELECT vc.id, vc.knowledge_block_id, vc.semester, vc.course_type,
              c.code as course_code, c.name as course_name, c.credits
       FROM version_courses vc
       JOIN courses c ON vc.course_id = c.id
       WHERE vc.version_id = $1
       ORDER BY c.code`,
      [req.params.vId]
    );

    // Attach courses to their blocks and compute credits
    const blockCourses = {};
    for (const c of courses) {
      if (c.knowledge_block_id) {
        if (!blockCourses[c.knowledge_block_id]) blockCourses[c.knowledge_block_id] = [];
        blockCourses[c.knowledge_block_id].push(c);
      }
    }

    // Build block map for parent lookups
    const blockMap = {};
    for (const b of blocks) blockMap[b.id] = b;

    // Calculate credits bottom-up: leaf blocks sum from courses, parents sum from children
    const calcCredits = (blockId) => {
      const children = blocks.filter(b => b.parent_id === blockId);
      if (children.length > 0) {
        return children.reduce((sum, child) => sum + calcCredits(child.id), 0);
      }
      const bc = blockCourses[blockId] || [];
      return bc.reduce((sum, c) => sum + (c.credits || 0), 0);
    };

    // Enrich blocks with courses and auto credits
    const enriched = blocks.map(b => ({
      ...b,
      courses: blockCourses[b.id] || [],
      auto_total_credits: calcCredits(b.id),
    }));

    // Also return unassigned courses (not in any block)
    const unassigned = courses.filter(c => !c.knowledge_block_id);

    res.json({ blocks: enriched, unassigned });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
```

- [ ] **Step 2: Verify the API response**

Run: `make dev`

Test with curl or browser:
```bash
curl -b cookies.txt http://localhost:3600/api/versions/1/knowledge-blocks
```

Expected: JSON with `{ blocks: [...], unassigned: [...] }`. Each block has `courses` array and `auto_total_credits`.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: expand GET knowledge-blocks to return courses and auto-calculated credits"
```

---

### Task 4: API — POST/PUT/DELETE Knowledge Blocks

**Files:**
- Modify: `server.js` (add after the GET knowledge-blocks route, around line 1008)

- [ ] **Step 1: Add POST route to create a knowledge block**

Insert after the GET `/api/versions/:vId/knowledge-blocks` route:

```js
app.post('/api/versions/:vId/knowledge-blocks', authMiddleware, requireDraft('vId'), async (req, res) => {
  const { name, parent_id } = req.body;
  try {
    if (!name || !name.trim()) return res.status(400).json({ error: 'Tên khối kiến thức không được để trống' });

    let level = 1;
    if (parent_id) {
      const parent = await pool.query('SELECT level FROM knowledge_blocks WHERE id=$1 AND version_id=$2', [parent_id, req.params.vId]);
      if (!parent.rows.length) return res.status(404).json({ error: 'Khối cha không tồn tại' });
      level = parent.rows[0].level + 1;
      if (level > 3) return res.status(400).json({ error: 'Không thể tạo quá 3 cấp' });
    }

    // Get next sort_order
    const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order),0)+1 as next FROM knowledge_blocks WHERE version_id=$1', [req.params.vId]);

    const result = await pool.query(
      `INSERT INTO knowledge_blocks (version_id, name, parent_id, level, sort_order) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [req.params.vId, name.trim(), parent_id || null, level, maxOrder.rows[0].next]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 2: Add PUT route to update a knowledge block**

```js
app.put('/api/knowledge-blocks/:id', authMiddleware, async (req, res) => {
  const { name, sort_order } = req.body;
  try {
    const block = await pool.query('SELECT version_id FROM knowledge_blocks WHERE id=$1', [req.params.id]);
    if (!block.rows.length) return res.status(404).json({ error: 'Không tìm thấy khối kiến thức' });
    await checkVersionEditAccess(req.user.id, block.rows[0].version_id);

    const result = await pool.query(
      `UPDATE knowledge_blocks SET name=COALESCE($1,name), sort_order=COALESCE($2,sort_order) WHERE id=$3 RETURNING *`,
      [name?.trim() || null, sort_order, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 3: Add DELETE route**

```js
app.delete('/api/knowledge-blocks/:id', authMiddleware, async (req, res) => {
  try {
    const block = await pool.query('SELECT version_id, level FROM knowledge_blocks WHERE id=$1', [req.params.id]);
    if (!block.rows.length) return res.status(404).json({ error: 'Không tìm thấy khối kiến thức' });
    await checkVersionEditAccess(req.user.id, block.rows[0].version_id);

    if (block.rows[0].level < 3) {
      return res.status(400).json({ error: 'Chỉ được xóa khối level 3 (do người dùng tạo)' });
    }

    // SET NULL for any courses assigned to this block (handled by ON DELETE SET NULL FK)
    await pool.query('DELETE FROM knowledge_blocks WHERE id=$1', [req.params.id]);
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 4: Verify routes**

Run: `make dev`

Test POST:
```bash
curl -X POST -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"name":"Nhóm tự chọn 1","parent_id":4}' \
  http://localhost:3600/api/versions/1/knowledge-blocks
```

Expected: 200 with the new block (level=3).

- [ ] **Step 5: Commit**

```bash
git add server.js
git commit -m "feat: add POST/PUT/DELETE routes for knowledge blocks"
```

---

### Task 5: API — Assign Courses to Knowledge Block

**Files:**
- Modify: `server.js` (add after the DELETE knowledge-blocks route)

- [ ] **Step 1: Add PUT assign-courses route**

```js
app.put('/api/knowledge-blocks/:id/assign-courses', authMiddleware, async (req, res) => {
  const { courseIds } = req.body; // array of version_course ids
  try {
    const block = await pool.query('SELECT id, version_id, level FROM knowledge_blocks WHERE id=$1', [req.params.id]);
    if (!block.rows.length) return res.status(404).json({ error: 'Không tìm thấy khối kiến thức' });
    const versionId = block.rows[0].version_id;
    await checkVersionEditAccess(req.user.id, versionId);

    // Validate: block must be a leaf (no children)
    const children = await pool.query('SELECT id FROM knowledge_blocks WHERE parent_id=$1', [req.params.id]);
    if (children.rows.length > 0) {
      return res.status(400).json({ error: 'Chỉ được gán HP vào khối lá (không có khối con)' });
    }

    if (!Array.isArray(courseIds)) return res.status(400).json({ error: 'courseIds phải là mảng' });

    // Clear old assignments for this block
    await pool.query(
      `UPDATE version_courses SET knowledge_block_id = NULL WHERE knowledge_block_id = $1`,
      [req.params.id]
    );

    // Assign new courses (auto-remove from other blocks)
    if (courseIds.length > 0) {
      // First clear these courses from any other block
      await pool.query(
        `UPDATE version_courses SET knowledge_block_id = NULL WHERE id = ANY($1) AND version_id = $2`,
        [courseIds, versionId]
      );
      // Then assign to this block
      await pool.query(
        `UPDATE version_courses SET knowledge_block_id = $1 WHERE id = ANY($2) AND version_id = $3`,
        [req.params.id, courseIds, versionId]
      );
    }

    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 2: Verify**

Run: `make dev`

Test:
```bash
curl -X PUT -b cookies.txt -H 'Content-Type: application/json' \
  -d '{"courseIds":[1,2,3]}' \
  http://localhost:3600/api/knowledge-blocks/1/assign-courses
```

Expected: 200 `{ success: true }`. Then GET knowledge-blocks should show those courses under block 1.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add PUT assign-courses route for knowledge blocks"
```

---

### Task 6: Frontend — Rewrite Knowledge Blocks Tab with 3-Level Tree

**Files:**
- Modify: `public/js/pages/version-editor.js:689-728` (renderKnowledgeBlocksTab method)

- [ ] **Step 1: Rewrite `renderKnowledgeBlocksTab` to display 3-level tree with courses**

Replace the entire `renderKnowledgeBlocksTab` method (lines 689-728) with the new implementation:

```js
  async renderKnowledgeBlocksTab(body, editable) {
    const data = await fetch(`/api/versions/${this.versionId}/knowledge-blocks`).then(r => r.json()).catch(() => ({ blocks: [], unassigned: [] }));
    const blocks = data.blocks || [];
    const unassigned = data.unassigned || [];

    // Build tree structure
    const roots = blocks.filter(b => !b.parent_id);
    const getChildren = (parentId) => blocks.filter(b => b.parent_id === parentId);

    const renderCourseList = (courses) => {
      if (!courses || courses.length === 0) return '<div style="color:var(--text-muted);font-size:12px;padding:4px 0 4px 16px;">Chưa có HP</div>';
      return courses.map(c => `
        <div style="display:flex;align-items:center;gap:8px;padding:3px 0 3px 16px;font-size:13px;">
          <span style="color:var(--primary);font-weight:500;min-width:60px;">${c.course_code}</span>
          <span style="flex:1;">${c.course_name}</span>
          <span style="color:var(--text-muted);min-width:40px;text-align:right;">${c.credits} TC</span>
        </div>
      `).join('');
    };

    const renderBlock = (block, depth) => {
      const children = getChildren(block.id);
      const isLeaf = children.length === 0;
      const headerStyles = [
        'font-size:15px;font-weight:700;background:var(--bg-secondary);padding:10px 12px;border-radius:6px;margin-bottom:4px;',
        'font-size:14px;font-weight:600;padding:8px 12px 8px 24px;',
        'font-size:13px;font-weight:500;padding:6px 12px 6px 48px;'
      ];
      const canAddChild = block.level === 2 && editable;
      const canDelete = block.level === 3 && editable;
      const canAssign = isLeaf && editable;

      return `
        <div class="kb-block" data-block-id="${block.id}" data-level="${block.level}">
          <div style="display:flex;align-items:center;justify-content:space-between;${headerStyles[depth] || headerStyles[0]}">
            <div style="display:flex;align-items:center;gap:8px;">
              <span>${block.name}</span>
              <span style="color:var(--text-muted);font-size:12px;">(${block.auto_total_credits || 0} TC)</span>
            </div>
            <div style="display:flex;gap:4px;">
              ${editable ? `<button class="btn-icon kb-edit-btn" data-block-id="${block.id}" data-block-name="${block.name}" title="Sửa tên">✏️</button>` : ''}
              ${canAddChild ? `<button class="btn-icon kb-add-child-btn" data-parent-id="${block.id}" title="Thêm nhóm con">➕</button>` : ''}
              ${canAssign ? `<button class="btn-icon kb-assign-btn" data-block-id="${block.id}" title="Gán HP">📋</button>` : ''}
              ${canDelete ? `<button class="btn-icon kb-delete-btn" data-block-id="${block.id}" title="Xóa">🗑️</button>` : ''}
            </div>
          </div>
          ${isLeaf ? renderCourseList(block.courses) : ''}
          ${children.map(child => renderBlock(child, depth + 1)).join('')}
        </div>
      `;
    };

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Cấu trúc khối kiến thức</h3>
        ${unassigned.length > 0 ? `<span style="color:var(--warning);font-size:13px;">⚠️ ${unassigned.length} HP chưa gán khối</span>` : ''}
      </div>
      <div class="kb-tree">
        ${roots.map(r => renderBlock(r, 0)).join('')}
      </div>
    `;

    // Wire up event handlers
    if (editable) {
      this._wireKnowledgeBlockEvents(body, blocks, data);
    }
  },
```

- [ ] **Step 2: Add event handler method `_wireKnowledgeBlockEvents`**

Add this new method right after `renderKnowledgeBlocksTab`:

```js
  _wireKnowledgeBlockEvents(body, blocks, data) {
    const allCourses = [...(data.unassigned || [])];
    for (const b of blocks) {
      if (b.courses) allCourses.push(...b.courses.map(c => ({ ...c, block_name: b.name })));
    }

    // Edit block name
    body.querySelectorAll('.kb-edit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const blockId = btn.dataset.blockId;
        const oldName = btn.dataset.blockName;
        const newName = prompt('Nhập tên mới cho khối kiến thức:', oldName);
        if (!newName || newName.trim() === oldName) return;
        const res = await fetch(`/api/knowledge-blocks/${blockId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim() })
        });
        if (res.ok) this.renderTab(this.activeTab);
        else alert((await res.json()).error || 'Lỗi cập nhật');
      });
    });

    // Add child block
    body.querySelectorAll('.kb-add-child-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const parentId = btn.dataset.parentId;
        const name = prompt('Nhập tên nhóm con mới:');
        if (!name || !name.trim()) return;
        const res = await fetch(`/api/versions/${this.versionId}/knowledge-blocks`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), parent_id: parseInt(parentId) })
        });
        if (res.ok) this.renderTab(this.activeTab);
        else alert((await res.json()).error || 'Lỗi tạo khối');
      });
    });

    // Delete block
    body.querySelectorAll('.kb-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const blockId = btn.dataset.blockId;
        if (!confirm('Bạn có chắc muốn xóa nhóm này? Các HP sẽ bị gỡ khỏi nhóm.')) return;
        const res = await fetch(`/api/knowledge-blocks/${blockId}`, { method: 'DELETE' });
        if (res.ok) this.renderTab(this.activeTab);
        else alert((await res.json()).error || 'Lỗi xóa');
      });
    });

    // Assign courses modal
    body.querySelectorAll('.kb-assign-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const blockId = parseInt(btn.dataset.blockId);
        const block = blocks.find(b => b.id === blockId);
        const assignedIds = new Set((block?.courses || []).map(c => c.id));

        // Create modal
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:1000;display:flex;align-items:center;justify-content:center;';
        const modal = document.createElement('div');
        modal.style.cssText = 'background:var(--bg);border-radius:12px;padding:24px;max-width:600px;width:90%;max-height:80vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.3);';

        modal.innerHTML = `
          <h3 style="margin-bottom:16px;font-size:16px;">Gán HP vào: ${block?.name || ''}</h3>
          <div style="margin-bottom:12px;">
            <input type="text" id="kb-search" placeholder="Tìm HP..." style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:6px;font-size:13px;">
          </div>
          <div id="kb-course-list" style="max-height:400px;overflow-y:auto;">
            ${allCourses.map(c => {
              const isAssigned = assignedIds.has(c.id);
              const inOtherBlock = !isAssigned && c.knowledge_block_id && c.block_name;
              return `
                <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:${inOtherBlock ? 'not-allowed' : 'pointer'};opacity:${inOtherBlock ? '0.5' : '1'};" class="kb-course-item">
                  <input type="checkbox" value="${c.id}" ${isAssigned ? 'checked' : ''} ${inOtherBlock ? 'disabled' : ''}>
                  <span style="color:var(--primary);font-weight:500;min-width:60px;">${c.course_code}</span>
                  <span style="flex:1;">${c.course_name}</span>
                  <span style="color:var(--text-muted);font-size:12px;">${c.credits} TC</span>
                  ${inOtherBlock ? `<span style="color:var(--text-muted);font-size:11px;">(${c.block_name})</span>` : ''}
                </label>
              `;
            }).join('')}
          </div>
          <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;">
            <button id="kb-cancel-btn" class="btn btn-secondary">Hủy</button>
            <button id="kb-save-btn" class="btn btn-primary">Lưu</button>
          </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Search filter
        modal.querySelector('#kb-search').addEventListener('input', (e) => {
          const q = e.target.value.toLowerCase();
          modal.querySelectorAll('.kb-course-item').forEach(item => {
            item.style.display = item.textContent.toLowerCase().includes(q) ? '' : 'none';
          });
        });

        // Cancel
        modal.querySelector('#kb-cancel-btn').addEventListener('click', () => overlay.remove());
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        // Save
        modal.querySelector('#kb-save-btn').addEventListener('click', async () => {
          const selected = [...modal.querySelectorAll('#kb-course-list input[type="checkbox"]:checked:not(:disabled)')]
            .map(cb => parseInt(cb.value));
          const res = await fetch(`/api/knowledge-blocks/${blockId}/assign-courses`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseIds: selected })
          });
          overlay.remove();
          if (res.ok) this.renderTab(this.activeTab);
          else alert((await res.json()).error || 'Lỗi gán HP');
        });
      });
    });
  },
```

- [ ] **Step 3: Verify in browser**

Run: `make dev`

Navigate to a version editor → "Khối KT" tab. Expected:
- 3-level tree with block names and auto-calculated credits
- Click "📋" on a leaf block → modal appears with course list
- Check/uncheck courses → Save → tree updates with new assignments

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/version-editor.js
git commit -m "feat: rewrite Knowledge Blocks tab with 3-level tree and course assignment UI"
```

---

### Task 7: Fix Frontend Course Assignment Modal — Handle All Courses Correctly

**Files:**
- Modify: `public/js/pages/version-editor.js` (the `_wireKnowledgeBlockEvents` method)

- [ ] **Step 1: Update the assign modal to correctly list all version courses**

The current implementation in Task 6 builds `allCourses` from the API response. We need to ensure courses already assigned to the current block can be unchecked, and courses in other blocks show which block they belong to but can still be reassigned (per spec: "tự động gỡ khối cũ trước khi gán vào khối mới").

Update the modal course rendering to allow reassignment. In the `_wireKnowledgeBlockEvents` method, change the `inOtherBlock` logic:

Replace:
```js
const inOtherBlock = !isAssigned && c.knowledge_block_id && c.block_name;
```

With:
```js
const inOtherBlock = !isAssigned && c.block_name;
```

And remove the `disabled` attribute on the checkbox for `inOtherBlock` courses (since spec says auto-remove from old block):

```html
<input type="checkbox" value="${c.id}" ${isAssigned ? 'checked' : ''}>
```

Keep the visual indicator (block name) but make it selectable. Update opacity to `0.8` instead of `0.5`.

- [ ] **Step 2: Update Save handler to include reassigned courses**

Update the save button selector to include all checked checkboxes (remove `:not(:disabled)` filter):

```js
const selected = [...modal.querySelectorAll('#kb-course-list input[type="checkbox"]:checked')]
  .map(cb => parseInt(cb.value));
```

- [ ] **Step 3: Verify**

Test: Assign a course to block A, then try to assign same course to block B. It should move automatically.

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/version-editor.js
git commit -m "fix: allow reassigning courses between knowledge blocks"
```

---

### Task 8: Final Integration Verification

- [ ] **Step 1: Start the app fresh**

```bash
make down && make up
```

Wait for Docker to start, then check logs:
```bash
make logs
```

Expected: `✅ Database schema initialized` with no errors.

- [ ] **Step 2: Test full flow end-to-end**

1. Login as admin
2. Go to CTDT CNTT version → "Khối KT" tab
3. Verify 3-level tree displays with auto credits
4. Click "📋" on "Kiến thức giáo dục đại cương" → assign GE001-GE004
5. Click "➕" on "Kiến thức tự chọn" → create "Nhóm tự chọn 1"
6. Assign elective courses to "Nhóm tự chọn 1"
7. Verify credits auto-update at all levels
8. Edit a block name via ✏️
9. Delete a level 3 block via 🗑️
10. Create a new version (copy) → verify blocks + assignments are copied

- [ ] **Step 3: Commit all remaining changes if any**

```bash
git add -A
git commit -m "feat: complete knowledge blocks course grouping feature"
```
