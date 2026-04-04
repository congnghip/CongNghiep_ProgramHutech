# Course Prerequisite Flowchart Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Sơ đồ tiến trình" tab in the Version Editor that visualizes course prerequisite/corequisite relationships as a left-to-right flowchart by semester, with interactive click-to-connect editing.

**Architecture:** Dagre computes node positions grouped by semester columns. HTML divs render each course node (Notion style), SVG overlay draws arrows between them. A mode-based toolbar lets users create prerequisite (solid blue) or corequisite (dashed orange) links by clicking source → target nodes. A new API endpoint saves relation changes back to the existing `prerequisite_course_ids` / `corequisite_course_ids` INT array columns on `version_courses`.

**Tech Stack:** Dagre (CDN), SVG for arrows, vanilla JS frontend, Express.js + PostgreSQL backend

---

### Task 1: Add dagre CDN script to index.html

**Files:**
- Modify: `public/index.html:10` (add CDN script in `<head>`)

- [ ] **Step 1: Add dagre script tag**

In `public/index.html`, add this line after line 9 (the Google Fonts link) and before `</head>`:

```html
  <script src="https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js"></script>
```

- [ ] **Step 2: Verify dagre loads**

Open the app in browser, open DevTools console, type `dagre` — should return the dagre object, not undefined.

- [ ] **Step 3: Commit**

```bash
git add public/index.html
git commit -m "feat: add dagre library CDN for flowchart layout"
```

---

### Task 2: Add PUT /api/versions/:vId/course-relations endpoint

**Files:**
- Modify: `server.js` — insert after `DELETE /api/version-courses/:id` route (after line ~1410)

- [ ] **Step 1: Add the endpoint**

In `server.js`, after the `app.delete('/api/version-courses/:id', ...)` route (around line 1410), add:

```js
app.put('/api/versions/:vId/course-relations', authMiddleware, requireDraft('vId'), async (req, res) => {
  const { version_course_id, prerequisite_course_ids, corequisite_course_ids } = req.body;
  try {
    // Validate version_course belongs to this version
    const vc = await pool.query('SELECT id FROM version_courses WHERE id = $1 AND version_id = $2', [version_course_id, req.params.vId]);
    if (!vc.rows.length) return res.status(404).json({ error: 'Học phần không thuộc phiên bản này.' });

    // Validate all referenced IDs belong to the same version
    const prereqs = prerequisite_course_ids || [];
    const coreqs = corequisite_course_ids || [];
    const allRefIds = [...prereqs, ...coreqs].filter(id => id != null);
    if (allRefIds.length > 0) {
      const valid = await pool.query(
        'SELECT id FROM version_courses WHERE version_id = $1 AND id = ANY($2)',
        [req.params.vId, allRefIds]
      );
      if (valid.rows.length !== allRefIds.length) {
        return res.status(400).json({ error: 'Một số học phần tham chiếu không thuộc phiên bản này.' });
      }
    }

    await pool.query(
      'UPDATE version_courses SET prerequisite_course_ids = $1, corequisite_course_ids = $2 WHERE id = $3 AND version_id = $4',
      [prereqs.length ? prereqs : null, coreqs.length ? coreqs : null, version_course_id, req.params.vId]
    );
    res.json({ success: true });
  } catch (e) { res.status(400).json({ error: e.message }); }
});
```

- [ ] **Step 2: Verify endpoint works**

Start the server. Test with curl (adjust IDs):

```bash
curl -X PUT http://localhost:3600/api/versions/1/course-relations \
  -H "Content-Type: application/json" \
  -d '{"version_course_id": 1, "prerequisite_course_ids": [], "corequisite_course_ids": []}' \
  --cookie "token=<admin_token>"
```

Expected: `{"success":true}` or auth error if no token.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat: add PUT /api/versions/:vId/course-relations endpoint"
```

---

### Task 3: Create course-flowchart.js — data loading and dagre layout computation

**Files:**
- Create: `public/js/pages/course-flowchart.js`

- [ ] **Step 1: Create the file with module skeleton and layout logic**

Create `public/js/pages/course-flowchart.js`:

```js
// Course Flowchart — Prerequisite/Corequisite visualization
window.CourseFlowchart = {
  versionId: null,
  courses: [],
  editable: false,
  mode: null, // null | 'prerequisite' | 'corequisite' | 'delete'
  sourceNode: null,
  scale: 1,

  // Node dimensions
  NODE_W: 160,
  NODE_H: 52,
  NODE_GAP_X: 80,
  NODE_GAP_Y: 16,

  async render(container, versionId, editable) {
    this.versionId = versionId;
    this.editable = editable;
    this.mode = null;
    this.sourceNode = null;
    this.scale = 1;

    container.innerHTML = '<div class="spinner"></div>';

    try {
      this.courses = await fetch(`/api/versions/${versionId}/courses`).then(r => r.json());
      if (this.courses.error) throw new Error(this.courses.error);
    } catch (e) {
      container.innerHTML = `<p style="color:var(--danger);">Lỗi tải học phần: ${e.message}</p>`;
      return;
    }

    if (!this.courses.length) {
      container.innerHTML = '<div class="empty-state"><div class="icon">📊</div><h3>Chưa có học phần</h3><p>Thêm học phần trong tab "Học phần" trước</p></div>';
      return;
    }

    this.renderFlowchart(container);
  },

  computeLayout() {
    const g = new dagre.graphlib.Graph();
    g.setGraph({
      rankdir: 'LR',
      ranksep: this.NODE_GAP_X,
      nodesep: this.NODE_GAP_Y,
      marginx: 20,
      marginy: 20,
    });
    g.setDefaultEdgeLabel(() => ({}));

    // Add nodes — group by semester using rank
    this.courses.forEach(c => {
      g.setNode(String(c.id), {
        width: this.NODE_W,
        height: this.NODE_H,
        label: c.course_name,
        semester: c.semester || 1,
      });
    });

    // Collect edges
    const edges = [];
    this.courses.forEach(c => {
      (c.prerequisite_course_ids || []).forEach(preId => {
        edges.push({ from: String(preId), to: String(c.id), type: 'prerequisite' });
        g.setEdge(String(preId), String(c.id));
      });
      (c.corequisite_course_ids || []).forEach(coId => {
        edges.push({ from: String(coId), to: String(c.id), type: 'corequisite' });
        g.setEdge(String(coId), String(c.id));
      });
    });

    // Force semester-based ranking: create invisible edges between semester groups
    const bySemester = {};
    this.courses.forEach(c => {
      const sem = c.semester || 1;
      if (!bySemester[sem]) bySemester[sem] = [];
      bySemester[sem].push(c);
    });
    const semesters = Object.keys(bySemester).map(Number).sort((a, b) => a - b);

    // Add invisible anchor nodes per semester to enforce column ordering
    semesters.forEach((sem, i) => {
      const anchorId = `_anchor_${sem}`;
      g.setNode(anchorId, { width: 0, height: 0 });
      if (i > 0) {
        g.setEdge(`_anchor_${semesters[i - 1]}`, anchorId, { minlen: 1 });
      }
      // Link first course in semester to anchor to keep them in same rank
      bySemester[sem].forEach(c => {
        g.setEdge(anchorId, String(c.id), { minlen: 0, weight: 0 });
      });
    });

    dagre.layout(g);

    return { graph: g, edges, semesters, bySemester };
  },

  renderFlowchart(container) {
    const { graph, edges, semesters, bySemester } = this.computeLayout();

    // Calculate total dimensions from graph
    const graphLabel = graph.graph();
    const totalW = graphLabel.width || 800;
    const totalH = graphLabel.height || 400;

    container.innerHTML = `
      ${this.editable ? this.renderToolbar() : ''}
      <div id="flowchart-viewport" style="overflow:auto;border:1px solid var(--border, #e2e8f0);border-radius:12px;background:var(--bg-secondary, #f8f9fa);position:relative;">
        <div id="flowchart-canvas" style="position:relative;min-width:${totalW + 40}px;min-height:${totalH + 80}px;transform-origin:0 0;">
          ${this.renderSemesterHeaders(graph, semesters, bySemester)}
          <svg id="flowchart-svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;">
            <defs>
              <marker id="arrow-prereq" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#2563eb"/>
              </marker>
              <marker id="arrow-coreq" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#ea580c"/>
              </marker>
            </defs>
            ${edges.map(e => this.renderArrow(graph, e)).join('')}
          </svg>
          ${this.courses.filter(c => !String(c.id).startsWith('_')).map(c => this.renderNode(graph, c)).join('')}
        </div>
      </div>
      ${this.renderLegend()}
    `;

    // Bind node click events
    container.querySelectorAll('.flowchart-node').forEach(el => {
      el.addEventListener('click', () => this.onNodeClick(parseInt(el.dataset.vcId)));
    });

    // Bind arrow click events for delete mode
    container.querySelectorAll('.flowchart-arrow').forEach(el => {
      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.onArrowClick(parseInt(el.dataset.from), parseInt(el.dataset.to), el.dataset.type);
      });
    });
  },

  renderToolbar() {
    return `
      <div id="flowchart-toolbar" style="display:flex;gap:8px;align-items:center;padding:12px 0;margin-bottom:8px;flex-wrap:wrap;">
        <button class="btn btn-sm" style="font-size:12px;" onclick="window.CourseFlowchart.zoom(0.1)">🔍 +</button>
        <button class="btn btn-sm" style="font-size:12px;" onclick="window.CourseFlowchart.zoom(-0.1)">🔍 −</button>
        <button class="btn btn-sm" style="font-size:12px;" onclick="window.CourseFlowchart.resetZoom()">↺ Reset</button>
        <div style="width:1px;height:24px;background:var(--border, #e2e8f0);"></div>
        <button id="mode-prerequisite" class="btn btn-sm" style="font-size:12px;border:2px solid #2563eb;color:#2563eb;background:white;" onclick="window.CourseFlowchart.setMode('prerequisite')">+ Tiên quyết</button>
        <button id="mode-corequisite" class="btn btn-sm" style="font-size:12px;border:2px solid #ea580c;color:#ea580c;background:white;" onclick="window.CourseFlowchart.setMode('corequisite')">+ Song hành</button>
        <button id="mode-delete" class="btn btn-sm" style="font-size:12px;border:1px solid #dc2626;color:#dc2626;background:white;" onclick="window.CourseFlowchart.setMode('delete')">✕ Xóa liên kết</button>
        <span id="flowchart-hint" style="font-size:12px;color:var(--text-muted, #94a3b8);font-style:italic;margin-left:8px;"></span>
      </div>
    `;
  },

  renderSemesterHeaders(graph, semesters, bySemester) {
    // Calculate x range for each semester based on node positions
    return semesters.map(sem => {
      const nodes = bySemester[sem];
      let minX = Infinity, maxX = -Infinity;
      nodes.forEach(c => {
        const node = graph.node(String(c.id));
        if (node) {
          minX = Math.min(minX, node.x - node.width / 2);
          maxX = Math.max(maxX, node.x + node.width / 2);
        }
      });
      if (minX === Infinity) return '';
      const centerX = (minX + maxX) / 2;
      return `<div style="position:absolute;top:8px;left:${centerX - 40}px;width:80px;text-align:center;font-weight:700;font-size:12px;color:#2563eb;z-index:3;white-space:nowrap;">HK ${sem}</div>`;
    }).join('');
  },

  renderNode(graph, course) {
    const node = graph.node(String(course.id));
    if (!node) return '';
    const x = node.x - this.NODE_W / 2;
    const y = node.y - this.NODE_H / 2 + 28; // offset for semester headers
    const isSource = this.sourceNode === course.id;
    const borderColor = isSource
      ? (this.mode === 'prerequisite' ? '#2563eb' : '#ea580c')
      : '#e2e8f0';
    const bgColor = isSource
      ? (this.mode === 'prerequisite' ? '#eff6ff' : '#fff7ed')
      : 'white';

    return `
      <div class="flowchart-node" data-vc-id="${course.id}"
           style="position:absolute;left:${x}px;top:${y}px;width:${this.NODE_W}px;
                  background:${bgColor};border:1.5px solid ${borderColor};border-radius:8px;
                  padding:8px 12px;cursor:pointer;z-index:2;
                  box-shadow:0 1px 2px rgba(0,0,0,0.04);transition:all .15s;"
           onmouseenter="this.style.borderColor='#2563eb';this.style.boxShadow='0 2px 8px rgba(37,99,235,.15)'"
           onmouseleave="this.style.borderColor='${borderColor}';this.style.boxShadow='0 1px 2px rgba(0,0,0,.04)'">
        <div style="font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${course.course_name}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:1px;">${course.course_code} · ${course.credits} TC</div>
      </div>
    `;
  },

  renderArrow(graph, edge) {
    const fromNode = graph.node(edge.from);
    const toNode = graph.node(edge.to);
    if (!fromNode || !toNode) return '';

    const yOffset = 28; // match node offset for semester headers
    const x1 = fromNode.x + this.NODE_W / 2;
    const y1 = fromNode.y + yOffset;
    const x2 = toNode.x - this.NODE_W / 2;
    const y2 = toNode.y + yOffset;

    const midX = (x1 + x2) / 2;
    const isPrereq = edge.type === 'prerequisite';
    const color = isPrereq ? '#2563eb' : '#ea580c';
    const dash = isPrereq ? '' : 'stroke-dasharray="6 4"';
    const marker = isPrereq ? 'url(#arrow-prereq)' : 'url(#arrow-coreq)';

    // Clickable hit area (wider invisible path) + visible path
    return `
      <path class="flowchart-arrow" data-from="${edge.from}" data-to="${edge.to}" data-type="${edge.type}"
            d="M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}"
            stroke="${color}" stroke-width="2" fill="none" ${dash} marker-end="${marker}"
            style="pointer-events:stroke;cursor:pointer;" />
    `;
  },

  renderLegend() {
    return `
      <div style="display:flex;gap:24px;padding:12px 0;margin-top:8px;">
        <div style="display:flex;align-items:center;gap:8px;">
          <svg width="36" height="12"><line x1="0" y1="6" x2="26" y2="6" stroke="#2563eb" stroke-width="2"/><polygon points="26,2 34,6 26,10" fill="#2563eb"/></svg>
          <span style="font-size:12px;font-weight:500;">Tiên quyết</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <svg width="36" height="12"><line x1="0" y1="6" x2="26" y2="6" stroke="#ea580c" stroke-width="2" stroke-dasharray="6 4"/><polygon points="26,2 34,6 26,10" fill="#ea580c"/></svg>
          <span style="font-size:12px;font-weight:500;">Song hành</span>
        </div>
      </div>
    `;
  },

  // ============ INTERACTION ============

  setMode(mode) {
    if (this.mode === mode) {
      // Toggle off
      this.mode = null;
      this.sourceNode = null;
    } else {
      this.mode = mode;
      this.sourceNode = null;
    }
    this.updateToolbarState();
  },

  updateToolbarState() {
    const prereqBtn = document.getElementById('mode-prerequisite');
    const coreqBtn = document.getElementById('mode-corequisite');
    const deleteBtn = document.getElementById('mode-delete');
    const hint = document.getElementById('flowchart-hint');
    if (!prereqBtn) return;

    // Reset all
    prereqBtn.style.background = 'white';
    coreqBtn.style.background = 'white';
    deleteBtn.style.background = 'white';

    if (this.mode === 'prerequisite') {
      prereqBtn.style.background = '#eff6ff';
      hint.textContent = this.sourceNode ? 'Click học phần đích...' : 'Click học phần nguồn (tiên quyết)...';
    } else if (this.mode === 'corequisite') {
      coreqBtn.style.background = '#fff7ed';
      hint.textContent = this.sourceNode ? 'Click học phần đích...' : 'Click học phần nguồn (song hành)...';
    } else if (this.mode === 'delete') {
      deleteBtn.style.background = '#fef2f2';
      hint.textContent = 'Click vào mũi tên để xóa liên kết...';
    } else {
      hint.textContent = '';
    }
  },

  onNodeClick(vcId) {
    if (!this.mode || this.mode === 'delete') return;

    if (!this.sourceNode) {
      // First click: select source
      this.sourceNode = vcId;
      this.updateToolbarState();
      // Re-render to show selected state
      const container = document.getElementById('flowchart-canvas')?.parentElement?.parentElement;
      if (container) this.renderFlowchart(container);
    } else if (this.sourceNode === vcId) {
      // Clicked same node: deselect
      this.sourceNode = null;
      this.updateToolbarState();
      const container = document.getElementById('flowchart-canvas')?.parentElement?.parentElement;
      if (container) this.renderFlowchart(container);
    } else {
      // Second click: create relation (source → target)
      this.createRelation(this.sourceNode, vcId, this.mode);
    }
  },

  async onArrowClick(fromId, toId, type) {
    if (this.mode !== 'delete') return;

    const confirmed = await window.ui.confirm({
      title: 'Xóa liên kết',
      message: `Xóa liên kết ${type === 'prerequisite' ? 'tiên quyết' : 'song hành'} này?`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;

    // Find the target course and remove the source from its array
    const targetCourse = this.courses.find(c => c.id === toId);
    if (!targetCourse) return;

    const field = type === 'prerequisite' ? 'prerequisite_course_ids' : 'corequisite_course_ids';
    const currentIds = (targetCourse[field] || []).filter(id => id !== fromId);

    try {
      const res = await fetch(`/api/versions/${this.versionId}/course-relations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_course_id: toId,
          prerequisite_course_ids: field === 'prerequisite_course_ids' ? currentIds : (targetCourse.prerequisite_course_ids || []),
          corequisite_course_ids: field === 'corequisite_course_ids' ? currentIds : (targetCourse.corequisite_course_ids || []),
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      targetCourse[field] = currentIds;
      window.toast.success('Đã xóa liên kết');
      const container = document.getElementById('flowchart-canvas')?.parentElement?.parentElement;
      if (container) this.renderFlowchart(container);
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  async createRelation(sourceVcId, targetVcId, type) {
    const targetCourse = this.courses.find(c => c.id === targetVcId);
    if (!targetCourse) return;

    const field = type === 'prerequisite' ? 'prerequisite_course_ids' : 'corequisite_course_ids';
    const currentIds = targetCourse[field] || [];

    // Don't add duplicate
    if (currentIds.includes(sourceVcId)) {
      window.toast.error('Liên kết đã tồn tại');
      this.sourceNode = null;
      this.updateToolbarState();
      return;
    }

    const newIds = [...currentIds, sourceVcId];

    try {
      const res = await fetch(`/api/versions/${this.versionId}/course-relations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version_course_id: targetVcId,
          prerequisite_course_ids: field === 'prerequisite_course_ids' ? newIds : (targetCourse.prerequisite_course_ids || []),
          corequisite_course_ids: field === 'corequisite_course_ids' ? newIds : (targetCourse.corequisite_course_ids || []),
        })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      targetCourse[field] = newIds;
      this.sourceNode = null;
      window.toast.success(`Đã thêm liên kết ${type === 'prerequisite' ? 'tiên quyết' : 'song hành'}`);
      const container = document.getElementById('flowchart-canvas')?.parentElement?.parentElement;
      if (container) this.renderFlowchart(container);
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  // ============ ZOOM ============

  zoom(delta) {
    this.scale = Math.max(0.3, Math.min(2, this.scale + delta));
    const canvas = document.getElementById('flowchart-canvas');
    if (canvas) canvas.style.transform = `scale(${this.scale})`;
  },

  resetZoom() {
    this.scale = 1;
    const canvas = document.getElementById('flowchart-canvas');
    if (canvas) canvas.style.transform = 'scale(1)';
  },
};

// ESC to exit mode
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && window.CourseFlowchart.mode) {
    window.CourseFlowchart.mode = null;
    window.CourseFlowchart.sourceNode = null;
    window.CourseFlowchart.updateToolbarState();
    const container = document.getElementById('flowchart-canvas')?.parentElement?.parentElement;
    if (container) window.CourseFlowchart.renderFlowchart(container);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add public/js/pages/course-flowchart.js
git commit -m "feat: create course-flowchart.js with dagre layout, SVG arrows, and interaction"
```

---

### Task 4: Add script tag and integrate flowchart tab into Version Editor

**Files:**
- Modify: `public/index.html:25` (add script tag)
- Modify: `public/js/pages/version-editor.js:7-21` (add tab to list)
- Modify: `public/js/pages/version-editor.js:126-140` (add case to switch)

- [ ] **Step 1: Add script tag to index.html**

In `public/index.html`, after line 25 (`<script src="/js/pages/import-word.js"></script>`), add:

```html
  <script src="/js/pages/course-flowchart.js"></script>
```

- [ ] **Step 2: Add flowchart tab to the tabs array**

In `public/js/pages/version-editor.js`, in the `tabs` array (lines 7-21), add this entry after the `plan` tab (after line 16 `{ key: 'plan', label: 'Kế hoạch GD', ... },`):

```js
    { key: 'flowchart', label: 'Sơ đồ tiến trình', viewPerm: 'programs.view_published' },
```

- [ ] **Step 3: Add case to the tab rendering switch**

In `public/js/pages/version-editor.js`, in the `switch (tabKey)` block (around line 126-140), add this case after `case 'plan'`:

```js
        case 'flowchart': await window.CourseFlowchart.render(body, this.versionId, tabEditable); break;
```

- [ ] **Step 4: Verify the tab appears**

Start the server, navigate to a version editor. The "Sơ đồ tiến trình" tab should appear between "Kế hoạch GD" and "HP ↔ PLO". Clicking it should render the flowchart (or empty state if no courses).

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/js/pages/version-editor.js
git commit -m "feat: integrate flowchart tab into version editor"
```

---

### Task 5: Visual polish and edge case handling

**Files:**
- Modify: `public/js/pages/course-flowchart.js`

- [ ] **Step 1: Handle courses with no semester assigned**

In `course-flowchart.js`, in the `computeLayout` method, courses with `semester = null` or `0` should default to semester 0 (displayed as "Chưa xếp HK"). Find this line in `computeLayout`:

```js
      const sem = c.semester || 1;
```

Change to:

```js
      const sem = c.semester || 0;
```

And in `renderSemesterHeaders`, update the label to handle semester 0:

Find this line:
```js
      return `<div style="position:absolute;top:8px;left:${centerX - 40}px;width:80px;text-align:center;font-weight:700;font-size:12px;color:#2563eb;z-index:3;white-space:nowrap;">HK ${sem}</div>`;
```

Change to:
```js
      const label = sem === 0 ? 'Chưa xếp' : `HK ${sem}`;
      return `<div style="position:absolute;top:8px;left:${centerX - 40}px;width:80px;text-align:center;font-weight:700;font-size:12px;color:#2563eb;z-index:3;white-space:nowrap;">${label}</div>`;
```

- [ ] **Step 2: Disable editing UI for non-editable versions**

Verify: In `render()`, the `editable` parameter is passed and `renderToolbar()` is only called when `this.editable` is true. The toolbar buttons won't appear for published/locked versions. Already handled by:

```js
${this.editable ? this.renderToolbar() : ''}
```

No change needed — just verify this works by viewing a published version.

- [ ] **Step 3: Verify the full flow in browser**

1. Navigate to a version with courses
2. Click "Sơ đồ tiến trình" tab
3. Verify nodes are laid out by semester left→right
4. Verify existing prerequisite/corequisite arrows render correctly
5. If version is draft: verify toolbar appears, test click-to-connect
6. If version is published: verify toolbar does NOT appear

- [ ] **Step 4: Commit**

```bash
git add public/js/pages/course-flowchart.js
git commit -m "fix: handle unassigned semester and polish flowchart edge cases"
```

---

### Task 6: Final integration verification

- [ ] **Step 1: Test creating a prerequisite link**

1. Open a draft version with courses in at least 2 semesters
2. Click "Sơ đồ tiến trình" tab
3. Click "+ Tiên quyết" in toolbar
4. Click a course in HK1 (source) → click a course in HK2 (target)
5. Blue solid arrow should appear
6. Reload page — arrow should persist

- [ ] **Step 2: Test creating a corequisite link**

1. Click "+ Song hành"
2. Click a course → click another course
3. Orange dashed arrow should appear
4. Reload — persists

- [ ] **Step 3: Test deleting a link**

1. Click "✕ Xóa liên kết"
2. Click on an arrow
3. Confirm dialog → arrow removed
4. Reload — gone

- [ ] **Step 4: Test ESC to exit mode**

1. Enter "Tiên quyết" mode
2. Click a source node
3. Press ESC
4. Mode should clear, source deselected

- [ ] **Step 5: Test zoom**

1. Click "🔍 +" several times — chart scales up
2. Click "🔍 −" — scales down
3. Click "↺ Reset" — back to 1x

- [ ] **Step 6: Test with published version**

1. Open a published version
2. Flowchart tab should show nodes and arrows but NO toolbar

- [ ] **Step 7: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: integration fixes for course flowchart feature"
```
