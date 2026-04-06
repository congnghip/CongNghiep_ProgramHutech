# Flowchart Grid Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace dagre auto-layout with a manual grid layout so course flowchart columns are aligned and the chart is compact.

**Architecture:** Rewrite `computeLayout()` in `course-flowchart.js` to return grid-based positions instead of dagre positions. Update all rendering methods to use the new position map. Remove dagre.js dependency from `index.html`.

**Tech Stack:** Vanilla JS (no external layout library)

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `public/js/pages/course-flowchart.js` | Modify | Replace dagre layout with grid layout, update rendering methods |
| `public/index.html` | Modify (line 10) | Remove dagre.js CDN script tag |

---

### Task 1: Replace `computeLayout()` with grid calculation

**Files:**
- Modify: `public/js/pages/course-flowchart.js:43-101`

- [ ] **Step 1: Replace the `computeLayout()` method**

Replace the entire `computeLayout()` method (lines 43-101) with this grid-based implementation:

```js
  computeLayout() {
    // Group courses by semester
    const bySemester = {};
    this.courses.forEach(c => {
      const sem = c.semester || 0;
      if (!bySemester[sem]) bySemester[sem] = [];
      bySemester[sem].push(c);
    });
    const semesters = Object.keys(bySemester).map(Number).sort((a, b) => a - b);

    // Build node position map: { [courseId]: { x, y, centerX, centerY } }
    const MARGIN_X = 20;
    const HEADER_H = 32;
    const nodePos = {};
    let maxRows = 0;

    semesters.forEach((sem, colIdx) => {
      const courses = bySemester[sem];
      if (courses.length > maxRows) maxRows = courses.length;
      courses.forEach((c, rowIdx) => {
        const x = MARGIN_X + colIdx * (this.NODE_W + this.NODE_GAP_X);
        const y = HEADER_H + rowIdx * (this.NODE_H + this.NODE_GAP_Y);
        nodePos[c.id] = { x, y };
      });
    });

    // Collect edges
    const edges = [];
    this.courses.forEach(c => {
      (c.prerequisite_course_ids || []).forEach(preId => {
        edges.push({ from: preId, to: c.id, type: 'prerequisite' });
      });
      (c.corequisite_course_ids || []).forEach(coId => {
        edges.push({ from: coId, to: c.id, type: 'corequisite' });
      });
    });

    // Canvas dimensions
    const totalW = MARGIN_X + semesters.length * (this.NODE_W + this.NODE_GAP_X);
    const totalH = HEADER_H + maxRows * (this.NODE_H + this.NODE_GAP_Y) + 20;

    return { nodePos, edges, semesters, bySemester, totalW, totalH };
  },
```

- [ ] **Step 2: Verify the file saves without syntax errors**

Open the file and confirm the new `computeLayout()` sits between `render()` (ending ~line 41) and `renderFlowchart()` (starting ~line 104). The method must end with `},` (comma for object literal continuation).

---

### Task 2: Update `renderFlowchart()` to use grid positions

**Files:**
- Modify: `public/js/pages/course-flowchart.js:104-152`

- [ ] **Step 1: Replace `renderFlowchart()` method**

Replace the entire `renderFlowchart(container)` method (lines 104-152) with:

```js
  renderFlowchart(container) {
    const { nodePos, edges, semesters, bySemester, totalW, totalH } = this.computeLayout();

    container.innerHTML = `
      ${this.editable ? this.renderToolbar() : ''}
      <div id="flowchart-viewport" style="overflow:auto;border:1px solid var(--border, #e2e8f0);border-radius:12px;background:var(--bg-secondary, #f8f9fa);position:relative;">
        <div id="flowchart-canvas" style="position:relative;min-width:${totalW}px;min-height:${totalH}px;transform-origin:0 0;">
          ${this.renderSemesterHeaders(nodePos, semesters, bySemester)}
          <svg id="flowchart-svg" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;">
            <defs>
              <marker id="arrow-prereq" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#2563eb"/>
              </marker>
              <marker id="arrow-coreq" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#ea580c"/>
              </marker>
            </defs>
            ${edges.map(e => this.renderArrow(nodePos, e)).join('')}
          </svg>
          ${this.courses.map(c => this.renderNode(nodePos, c)).join('')}
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

    // Restore zoom level after re-render
    if (this.scale !== 1) {
      const canvas = document.getElementById('flowchart-canvas');
      if (canvas) canvas.style.transform = `scale(${this.scale})`;
    }
  },
```

Key changes from original:
- Destructures from new `computeLayout()` return shape (uses `nodePos` instead of `graph`)
- Passes `nodePos` to `renderSemesterHeaders`, `renderArrow`, `renderNode` instead of dagre `graph`
- Uses `totalW`/`totalH` from grid calculation instead of dagre graph label

---

### Task 3: Update `renderSemesterHeaders()`

**Files:**
- Modify: `public/js/pages/course-flowchart.js:169-185`

- [ ] **Step 1: Replace `renderSemesterHeaders()` method**

Replace the entire `renderSemesterHeaders(graph, semesters, bySemester)` method (lines 169-185) with:

```js
  renderSemesterHeaders(nodePos, semesters, bySemester) {
    return semesters.map(sem => {
      const nodes = bySemester[sem];
      if (!nodes.length) return '';
      // Use the first node's X position to center the header over the column
      const firstPos = nodePos[nodes[0].id];
      if (!firstPos) return '';
      const centerX = firstPos.x + this.NODE_W / 2;
      const label = sem === 0 ? 'Chưa xếp' : `HK ${sem}`;
      return `<div style="position:absolute;top:8px;left:${centerX - 40}px;width:80px;text-align:center;font-weight:700;font-size:12px;color:#2563eb;z-index:3;white-space:nowrap;">${label}</div>`;
    }).join('');
  },
```

Key change: Uses `nodePos` lookup instead of dagre `graph.node()` to find column X positions.

---

### Task 4: Update `renderNode()`

**Files:**
- Modify: `public/js/pages/course-flowchart.js:187-212`

- [ ] **Step 1: Replace `renderNode()` method**

Replace the entire `renderNode(graph, course)` method (lines 187-212) with:

```js
  renderNode(nodePos, course) {
    const pos = nodePos[course.id];
    if (!pos) return '';
    const x = pos.x;
    const y = pos.y;
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
        <div style="font-weight:600;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${this.esc(course.course_name)}</div>
        <div style="font-size:10px;color:#94a3b8;margin-top:1px;">${this.esc(course.course_code)} · ${course.credits} TC</div>
      </div>
    `;
  },
```

Key changes:
- Signature: `(nodePos, course)` instead of `(graph, course)`
- Uses `nodePos[course.id]` directly instead of `graph.node(String(course.id))`
- Removes the `+ 28` Y offset that was needed to compensate for dagre anchor positioning
- Uses `pos.x` / `pos.y` directly (grid positions already account for header offset)

---

### Task 5: Update `renderArrow()` with same-column edge support

**Files:**
- Modify: `public/js/pages/course-flowchart.js:214-240`

- [ ] **Step 1: Replace `renderArrow()` method**

Replace the entire `renderArrow(graph, edge)` method (lines 214-240) with:

```js
  renderArrow(nodePos, edge) {
    const fromPos = nodePos[edge.from];
    const toPos = nodePos[edge.to];
    if (!fromPos || !toPos) return '';

    const isPrereq = edge.type === 'prerequisite';
    const color = isPrereq ? '#2563eb' : '#ea580c';
    const dash = isPrereq ? '' : 'stroke-dasharray="6 4"';
    const marker = isPrereq ? 'url(#arrow-prereq)' : 'url(#arrow-coreq)';

    let pathD;
    const sameColumn = fromPos.x === toPos.x;

    if (sameColumn) {
      // Same-column edge: arc to the right of the column
      const x1 = fromPos.x + this.NODE_W;
      const y1 = fromPos.y + this.NODE_H / 2;
      const x2 = toPos.x + this.NODE_W;
      const y2 = toPos.y + this.NODE_H / 2;
      const bulge = 40;
      pathD = `M ${x1} ${y1} C ${x1 + bulge} ${y1}, ${x2 + bulge} ${y2}, ${x2} ${y2}`;
    } else {
      // Cross-column edge: right side of source → left side of target
      const x1 = fromPos.x + this.NODE_W;
      const y1 = fromPos.y + this.NODE_H / 2;
      const x2 = toPos.x;
      const y2 = toPos.y + this.NODE_H / 2;
      const midX = (x1 + x2) / 2;
      pathD = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    }

    return `
      <path class="flowchart-arrow" data-from="${edge.from}" data-to="${edge.to}" data-type="${edge.type}"
            d="${pathD}"
            stroke="transparent" stroke-width="12" fill="none"
            style="pointer-events:stroke;cursor:pointer;" />
      <path d="${pathD}"
            stroke="${color}" stroke-width="2" fill="none" ${dash} marker-end="${marker}"
            style="pointer-events:none;" />
    `;
  },
```

Key changes:
- Signature: `(nodePos, edge)` instead of `(graph, edge)`
- Uses `nodePos[edge.from]` / `nodePos[edge.to]` directly
- Removes the `+ 28` Y offset
- Adds same-column edge routing: arcs to the right with a 40px bulge
- Cross-column edges use the same bezier logic as before

---

### Task 6: Remove dagre.js dependency

**Files:**
- Modify: `public/index.html:10`

- [ ] **Step 1: Remove the dagre CDN script tag**

In `public/index.html`, delete line 10:

```html
  <script src="https://cdn.jsdelivr.net/npm/dagre@0.8.5/dist/dagre.min.js"></script>
```

---

### Task 7: Manual verification

- [ ] **Step 1: Start the dev server**

Run: `make dev`

- [ ] **Step 2: Import NNTQ2025 Word document and check flowchart tab**

1. Navigate to Import page, upload `mo-ta-chuong-trinh-cu-nhan-NNTQ2025.docx`
2. Complete import (select department, year, save)
3. In the version editor, click "Sơ đồ tiến trình" tab
4. **Verify:** courses are displayed in aligned semester columns, no excessive vertical scrolling

- [ ] **Step 3: Test edge interactions**

1. Click "+ Tiên quyết" button, select source course, select target course → arrow should appear
2. Click "+ Song hành" button, repeat → dashed arrow should appear
3. Click "✕ Xóa liên kết", click an arrow → arrow should be removed after confirmation
4. Press ESC → mode should deactivate

- [ ] **Step 4: Test zoom controls**

1. Click 🔍 + → chart should zoom in
2. Click 🔍 − → chart should zoom out
3. Click ↺ Reset → chart should return to 1x scale

- [ ] **Step 5: Commit**

```bash
git add public/js/pages/course-flowchart.js public/index.html
git commit -m "refactor(course-flowchart): replace dagre with grid layout for compact semester columns"
```
