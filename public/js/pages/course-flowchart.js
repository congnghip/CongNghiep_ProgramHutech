// Course Flowchart — Prerequisite/Corequisite visualization
window.CourseFlowchart = {
  versionId: null,
  courses: [],
  editable: false,
  mode: null, // null | 'prerequisite' | 'corequisite' | 'delete'
  sourceNode: null,
  scale: 1,

  esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); },

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
    // Group courses by semester
    const bySemester = {};
    this.courses.forEach(c => {
      const sem = c.semester || 0;
      if (!bySemester[sem]) bySemester[sem] = [];
      bySemester[sem].push(c);
    });
    const semesters = Object.keys(bySemester).map(Number).sort((a, b) => a - b);

    // Build node position map: { [courseId]: { x, y } }
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

  renderToolbar() {
    return `
      <div id="flowchart-toolbar" class="flex-row" style="padding:12px 0;margin-bottom:8px;flex-wrap:wrap;">
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

  renderSemesterHeaders(nodePos, semesters, bySemester) {
    return semesters.map(sem => {
      const nodes = bySemester[sem];
      if (!nodes.length) return '';
      const firstPos = nodePos[nodes[0].id];
      if (!firstPos) return '';
      const centerX = firstPos.x + this.NODE_W / 2;
      const label = sem === 0 ? 'Chưa xếp' : `HK ${sem}`;
      return `<div style="position:absolute;top:8px;left:${centerX - 40}px;width:80px;text-align:center;font-weight:700;font-size:12px;color:#2563eb;z-index:3;white-space:nowrap;">${label}</div>`;
    }).join('');
  },

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
      const x1 = fromPos.x + this.NODE_W;
      const y1 = fromPos.y + this.NODE_H / 2;
      const x2 = toPos.x + this.NODE_W;
      const y2 = toPos.y + this.NODE_H / 2;
      const bulge = 40;
      pathD = `M ${x1} ${y1} C ${x1 + bulge} ${y1}, ${x2 + bulge} ${y2}, ${x2} ${y2}`;
    } else {
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

  renderLegend() {
    return `
      <div class="flex-row" style="gap:24px;padding:12px 0;margin-top:8px;">
        <div class="flex-row">
          <svg width="36" height="12"><line x1="0" y1="6" x2="26" y2="6" stroke="#2563eb" stroke-width="2"/><polygon points="26,2 34,6 26,10" fill="#2563eb"/></svg>
          <span style="font-size:12px;font-weight:500;">Tiên quyết</span>
        </div>
        <div class="flex-row">
          <svg width="36" height="12"><line x1="0" y1="6" x2="26" y2="6" stroke="#ea580c" stroke-width="2" stroke-dasharray="6 4"/><polygon points="26,2 34,6 26,10" fill="#ea580c"/></svg>
          <span style="font-size:12px;font-weight:500;">Song hành</span>
        </div>
      </div>
    `;
  },

  // ============ INTERACTION ============

  setMode(mode) {
    if (this.mode === mode) {
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
      this.sourceNode = vcId;
      this.updateToolbarState();
      const container = document.getElementById('flowchart-canvas')?.parentElement?.parentElement;
      if (container) this.renderFlowchart(container);
    } else if (this.sourceNode === vcId) {
      this.sourceNode = null;
      this.updateToolbarState();
      const container = document.getElementById('flowchart-canvas')?.parentElement?.parentElement;
      if (container) this.renderFlowchart(container);
    } else {
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
