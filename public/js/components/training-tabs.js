/**
 * TrainingTabs Components
 * Reusable components for curriculum tabs (PO, PLO, Courses, etc.)
 */
window.TrainingTabs = {
  // Default handlers that use the standard API
  apiHandlers: {
    // PO
    getPOs: (vId) => fetch(`/api/versions/${vId}/objectives`).then(r => r.json()),
    savePO: (vId, id, payload) => {
      const url = id ? `/api/objectives/${id}` : `/api/versions/${vId}/objectives`;
      return fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    },
    deletePO: (id) => fetch(`/api/objectives/${id}`, { method: 'DELETE' }),

    // PLO
    getPLOs: (vId) => fetch(`/api/versions/${vId}/plos`).then(r => r.json()),
    savePLO: (vId, id, payload) => {
      const url = id ? `/api/plos/${id}` : `/api/versions/${vId}/plos`;
      return fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    },
    deletePLO: (id) => fetch(`/api/plos/${id}`, { method: 'DELETE' }),
    
    // Courses
    getVCourses: (vId) => fetch(`/api/versions/${vId}/courses`).then(r => r.json()),
    getAllCourses: () => fetch('/api/courses').then(r => r.json()),
    addCourse: (vId, payload) => fetch(`/api/versions/${vId}/courses`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    removeCourse: (vcId) => fetch(`/api/version-courses/${vcId}`, { method: 'DELETE' }),
    
    // Matrix PO-PLO
    getPOPLOMappings: (vId) => fetch(`/api/versions/${vId}/po-plo-map`).then(r => r.json()),
    savePOPLOMappings: (vId, payload) => fetch(`/api/versions/${vId}/po-plo-map`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    
    // Matrix Course-PLO-PI
    getCoursePLOMappings: (vId) => fetch(`/api/versions/${vId}/course-plo-map`).then(r => r.json()),
    getCoursePIMappings: (vId) => fetch(`/api/versions/${vId}/course-pi-map`).then(r => r.json()),
    saveCoursePIMappings: (vId, payload) => fetch(`/api/versions/${vId}/course-pi-map`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    
    // PIs
    getPIs: (vId, ploId) => fetch(`/api/plos/${ploId}/pis`).then(r => r.json()),
    savePI: (ploId, id, payload) => {
      const url = id ? `/api/pis/${id}` : `/api/plos/${ploId}/pis`;
      return fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    },
    deletePI: (id) => fetch(`/api/pis/${id}`, { method: 'DELETE' }),

    // Assessment
    getAssessments: (vId) => fetch(`/api/versions/${vId}/assessments`).then(r => r.json()),
    saveAssessment: (vId, payload) => fetch(`/api/versions/${vId}/assessments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    deleteAssessment: (id) => fetch(`/api/assessments/${id}`, { method: 'DELETE' }),

    // Syllabi
    getSyllabi: (vId) => fetch(`/api/versions/${vId}/syllabi`).then(r => r.json()),
    createSyllabus: (vId, payload) => fetch(`/api/versions/${vId}/syllabi`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    saveAssignment: (payload) => fetch('/api/assignments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    getAssignableUsers: (sId) => fetch(`/api/users/assignable?syllabus_id=${sId}`).then(r => r.json()),
    getAssignments: (sId) => fetch(`/api/assignments/${sId}`).then(r => r.json()),
  },

  // State for the current component instance
  context: {
    versionId: null,
    editable: false,
    handlers: null,
    onRefresh: null // Callback to refresh the tab
  },

  init(versionId, editable, customHandlers = null, onRefresh = null) {
    this.context.versionId = versionId;
    this.context.editable = editable;
    this.context.handlers = customHandlers || this.apiHandlers;
    this.context.onRefresh = onRefresh;
  },

  // Helper to get formatted course map
  async getCourseMap(vId) {
    const courses = await this.context.handlers.getVCourses(vId);
    const map = {};
    courses.forEach(c => map[c.id] = c);
    return map;
  },

  // ===== TAB: PO =====
  async renderPOTab(body) {
    const { versionId, editable, handlers, onRefresh } = this.context;
    const pos = await handlers.getPOs(versionId);
    
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Mục tiêu chương trình (PO)</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" id="add-po-btn">+ Thêm</button>' : ''}
      </div>
      <div id="po-list">
        ${pos.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có mục tiêu nào.</p>' : pos.map(po => `
          <div class="tree-node" style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <strong style="color:var(--primary);">${po.code}</strong>
              <span style="color:var(--text-muted);margin-left:8px;font-size:13px;">${po.description || ''}</span>
            </div>
            ${editable ? `<div style="display:flex;gap:4px;">
              <button class="btn btn-secondary btn-sm" data-action="edit-po" data-id="${po.id}" data-code="${po.code}" data-desc="${(po.description || '').replace(/"/g, '&quot;')}">Sửa</button>
              <button class="btn btn-secondary btn-sm" style="color:var(--danger);" data-action="delete-po" data-id="${po.id}">Xóa</button>
            </div>` : ''}
          </div>
        `).join('')}
      </div>
      <div id="po-form-area" style="display:none;margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
        <input type="hidden" id="po-edit-id">
        <div style="display:flex;gap:10px;align-items:end;">
          <div class="input-group" style="width:100px;margin:0;"><label>Mã</label><input type="text" id="po-code" placeholder="PO1"></div>
          <div class="input-group" style="flex:1;margin:0;"><label>Mô tả</label><input type="text" id="po-desc" placeholder="Mô tả mục tiêu"></div>
          <button class="btn btn-primary btn-sm" id="save-po-btn">Lưu</button>
          <button class="btn btn-secondary btn-sm" id="cancel-po-btn">Hủy</button>
        </div>
      </div>
    `;

    if (editable) {
      document.getElementById('add-po-btn')?.addEventListener('click', () => {
        document.getElementById('po-edit-id').value = '';
        document.getElementById('po-code').value = `PO${pos.length + 1}`;
        document.getElementById('po-desc').value = '';
        document.getElementById('po-form-area').style.display = 'block';
        document.getElementById('po-desc').focus();
      });

      body.querySelectorAll('[data-action="edit-po"]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('po-edit-id').value = btn.dataset.id;
          document.getElementById('po-code').value = btn.dataset.code;
          document.getElementById('po-desc').value = btn.dataset.desc;
          document.getElementById('po-form-area').style.display = 'block';
        });
      });

      body.querySelectorAll('[data-action="delete-po"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Xóa mục tiêu này?')) return;
          try {
            await handlers.deletePO(btn.dataset.id);
            window.toast.success('Đã xóa');
            if (onRefresh) onRefresh();
          } catch (e) { window.toast.error(e.message); }
        });
      });

      document.getElementById('save-po-btn')?.addEventListener('click', async () => {
        const id = document.getElementById('po-edit-id').value;
        const code = document.getElementById('po-code').value.trim();
        const description = document.getElementById('po-desc').value.trim();
        if (!code) { window.toast.warning('Nhập mã PO'); return; }
        try {
          const res = await handlers.savePO(versionId, id, { code, description });
          if (!res.ok) throw new Error((await res.json()).error);
          window.toast.success(id ? 'Đã cập nhật' : 'Đã thêm');
          if (onRefresh) onRefresh();
        } catch (e) { window.toast.error(e.message); }
      });

      document.getElementById('cancel-po-btn')?.addEventListener('click', () => {
        document.getElementById('po-form-area').style.display = 'none';
      });
    }
  },

  // ===== TAB: PI =====
  async renderPITab(body) {
    const { versionId, editable, handlers, onRefresh } = this.context;
    const [plos, mappings, courses] = await Promise.all([
      handlers.getPLOs(versionId),
      handlers.getCoursePLOMappings(versionId),
      handlers.getVCourses(versionId)
    ]);
    
    const courseMap = {};
    courses.forEach(c => courseMap[c.id] = c);

    const getValidCoursesForPlo = (ploId) => {
      const ploMappings = mappings.filter(m => m.plo_id === ploId && m.contribution_level > 0);
      return ploMappings.map(m => courseMap[m.course_id]).filter(c => c);
    };

    body.innerHTML = `
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Chỉ số đo lường (PI)</h3>
      ${plos.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Hãy thêm PLO trước.</p>' : plos.map(plo => `
        <div style="margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="color:var(--primary);">${plo.code}: ${(plo.description || '').substring(0, 60)}...</strong>
            ${editable ? `<button class="btn btn-secondary btn-sm" data-action="add-pi" data-plo="${plo.id}" data-code="${plo.code}" data-count="${(plo.pis || []).length}">+ PI</button>` : ''}
          </div>
          ${(plo.pis || []).length === 0 ? '<p style="color:var(--text-muted);font-size:12px;margin-left:16px;">Chưa có PI</p>' : `
            <div style="margin-left:16px;">${plo.pis.map(pi => {
              const mappedCourses = (pi.course_ids || []).map(cid => courseMap[cid]?.course_code).filter(c=>c).join(', ');
              return `
              <div class="tree-node" data-pi-code="${pi.pi_code}" style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <strong>${pi.pi_code}</strong> <span style="color:var(--text-muted);margin-left:4px;font-size:13px;">${pi.description || ''}</span>
                  ${mappedCourses ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Áp dụng cho: ${mappedCourses}</div>` : ''}
                </div>
                ${editable ? `<div style="display:flex;gap:4px;">
                  <button class="btn btn-secondary btn-sm" data-action="edit-pi" data-id="${pi.id}" data-plo="${plo.id}" data-code="${pi.pi_code}" data-desc="${(pi.description || '').replace(/"/g, '&quot;')}" data-courses='${JSON.stringify(pi.course_ids || [])}'>Sửa</button>
                  <button class="btn btn-secondary btn-sm" style="color:var(--danger);" data-action="delete-pi" data-id="${pi.id}">Xóa</button>
                </div>` : ''}
              </div>
            `}).join('')}</div>
          `}
        </div>
      `).join('')}
      <div id="pi-form-area" style="display:none;margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
        <input type="hidden" id="pi-edit-id"><input type="hidden" id="pi-plo-id">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;gap:10px;align-items:end;">
            <div class="input-group" style="width:120px;margin:0;"><label>Mã PI</label><input type="text" id="pi-code" placeholder="PI.1.1"></div>
            <div class="input-group" style="flex:1;margin:0;"><label>Mô tả</label><input type="text" id="pi-desc" placeholder="Mô tả chỉ số"></div>
            <button class="btn btn-primary btn-sm" id="save-pi-btn">Lưu</button>
            <button class="btn btn-secondary btn-sm" id="cancel-pi-btn">Hủy</button>
          </div>
          <div id="pi-courses-area" style="margin-top:8px;"></div>
        </div>
      </div>
    `;

    if (editable) {
      const renderCoursesForm = (ploId, selectedIds) => {
        const validCourses = getValidCoursesForPlo(ploId);
        const container = document.getElementById('pi-courses-area');
        if (validCourses.length === 0) {
          container.innerHTML = '<p style="color:var(--danger);font-size:13px;margin:0;">Chưa có HP-PLO nào cho PLO này. Vui lòng map HP-PLO ở tab HP-PLO trước.</p>';
          return;
        }
        container.innerHTML = `
          <label style="font-size:13px;font-weight:600;margin-bottom:8px;display:block;">Áp dụng cho Học phần:</label>
          <div style="display:flex;flex-wrap:wrap;gap:12px;">
            ${validCourses.map(c => `
              <label style="display:flex;align-items:center;gap:4px;font-size:13px;cursor:pointer;">
                <input type="checkbox" class="pi-course-cb" value="${c.id}" ${selectedIds.includes(c.id) ? 'checked' : ''}>
                ${c.course_code}
              </label>
            `).join('')}
          </div>
        `;
      };

      body.querySelectorAll('[data-action="add-pi"]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('pi-edit-id').value = '';
          document.getElementById('pi-plo-id').value = btn.dataset.plo;
          document.getElementById('pi-code').value = `PI.${btn.dataset.code.replace('PLO', '')}.${parseInt(btn.dataset.count) + 1}`;
          document.getElementById('pi-desc').value = '';
          renderCoursesForm(parseInt(btn.dataset.plo), []);
          document.getElementById('pi-form-area').style.display = 'block';
        });
      });

      body.querySelectorAll('[data-action="edit-pi"]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('pi-edit-id').value = btn.dataset.id;
          document.getElementById('pi-plo-id').value = btn.dataset.plo;
          document.getElementById('pi-code').value = btn.dataset.code;
          document.getElementById('pi-desc').value = btn.dataset.desc;
          renderCoursesForm(parseInt(btn.dataset.plo), JSON.parse(btn.dataset.courses || '[]'));
          document.getElementById('pi-form-area').style.display = 'block';
        });
      });

      body.querySelectorAll('[data-action="delete-pi"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Xóa PI này?')) return;
          try {
            await handlers.deletePI(btn.dataset.id);
            window.toast.success('Đã xóa');
            if (onRefresh) onRefresh();
          } catch (e) { window.toast.error(e.message); }
        });
      });

      document.getElementById('save-pi-btn')?.addEventListener('click', async () => {
        const id = document.getElementById('pi-edit-id').value;
        const ploId = document.getElementById('pi-plo-id').value;
        const pi_code = document.getElementById('pi-code').value.trim();
        const description = document.getElementById('pi-desc').value.trim();
        const course_ids = Array.from(document.querySelectorAll('.pi-course-cb:checked')).map(cb => parseInt(cb.value));

        if (!pi_code) { window.toast.warning('Nhập mã PI'); return; }
        try {
          const res = await handlers.savePI(ploId, id, { pi_code, description, course_ids });
          if (!res.ok) throw new Error((await res.json()).error);
          window.toast.success(id ? 'Đã cập nhật' : 'Đã thêm');
          if (onRefresh) onRefresh();
        } catch (e) { window.toast.error(e.message); }
      });

      document.getElementById('cancel-pi-btn')?.addEventListener('click', () => {
        document.getElementById('pi-form-area').style.display = 'none';
      });
    }
  },

  // ===== TAB: Teaching Plan =====
  async renderPlanTab(body) {
    const { versionId, handlers } = this.context;
    const vCourses = await handlers.getVCourses(versionId);
    const semesters = {};
    vCourses.forEach(c => {
      if (!semesters[c.semester]) semesters[c.semester] = [];
      semesters[c.semester].push(c);
    });
    const semKeys = Object.keys(semesters).sort((a, b) => a - b);

    body.innerHTML = `
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Kế hoạch giảng dạy</h3>
      ${semKeys.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Hãy gán HP vào CTĐT trước.</p>' : `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;">
          ${semKeys.map(sem => `
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <strong style="font-size:14px;">Học kỳ ${sem}</strong>
                <span style="color:var(--text-muted);font-size:12px;">${semesters[sem].reduce((s, c) => s + c.credits, 0)} TC</span>
              </div>
              ${semesters[sem].map(c => `
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid var(--divider);">
                  <span><strong>${c.course_code}</strong> ${c.course_name}</span>
                  <span style="color:var(--text-muted);">${c.credits}</span>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
      `}
    `;
  },

  // ===== TAB: Course-PLO Matrix =====
  async renderCoursePLOMatrix(body) {
    const { versionId, editable, handlers, onRefresh } = this.context;
    const [vCourses, plos, ploMaps, piMaps] = await Promise.all([
      handlers.getVCourses(versionId),
      handlers.getPLOs(versionId),
      handlers.getCoursePLOMappings(versionId),
      handlers.getCoursePIMappings(versionId)
    ]);

    if (!vCourses.length || !plos.length) {
      body.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Hãy thêm PLO và Học phần trước.</p>';
      return;
    }

    const ploMapObj = {};
    ploMaps.forEach(m => { ploMapObj[`${m.course_id}-${m.plo_id}`] = m.contribution_level; });
    const piMapObj = {};
    piMaps.forEach(m => { piMapObj[`${m.course_id}-${m.pi_id}`] = m; });

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Ma trận HP ↔ PI</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" id="save-c-pi-btn">Lưu</button>' : ''}
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px;">— = Không áp dụng · 1 = Thấp · 2 = TB · 3 = Cao</p>
      <div style="width:100%;overflow:auto;padding-bottom:16px;">
        <table class="data-table" id="c-pi-table" style="border-collapse:collapse;white-space:nowrap;min-width:max-content;width:max-content;">
          <thead>
            <tr>
              <th rowspan="2" style="position:sticky;left:0;z-index:10;min-width:70px;background:#f8f9fa;box-shadow:inset -1px 0 0 var(--border);">Mã HP</th>
              ${plos.map(p => {
                if (!p.pis || p.pis.length === 0) return '';
                return `
                <th colspan="${p.pis.length}" style="text-align:center;font-size:12px;border-bottom:1px solid var(--border);border-left:2px solid var(--border);background:#f1f3f5;">
                  ${p.code}
                </th>
                `;
              }).join('')}
            </tr>
            <tr>
              ${plos.map(p => {
                if (!p.pis || p.pis.length === 0) return '';
                return p.pis.map(pi => `<th style="text-align:center;font-size:11px;min-width:28px;padding:4px;color:var(--primary);background:#f8f9fa;" title="${pi.pi_code}: ${pi.description || ''}">${pi.pi_code.replace('PI.', '').replace('PLO', '')}</th>`).join('');
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${vCourses.map(c => `<tr>
              <td style="position:sticky;left:0;z-index:5;font-size:12px;background:#ffffff;box-shadow:inset -1px 0 0 var(--border), inset 0 -1px 0 var(--border);" title="${c.course_name}"><strong>${c.course_code}</strong></td>
              ${plos.map(p => {
                const ploVal = ploMapObj[`${c.id}-${p.id}`] || 0;
                const isPloMapped = ploVal > 0;
                if (!p.pis || p.pis.length === 0) return '';
                return p.pis.map((pi, piIndex) => {
                  const piMapping = piMapObj[`${c.id}-${pi.id}`];
                  const val = piMapping ? (piMapping.contribution_level || 0) : 0;
                  const isDisabled = !(isPloMapped && editable);
                  return `<td style="text-align:center;${piIndex===0?'border-left:2px solid var(--border);':''}">
                    <select class="pi-select" data-vc="${c.id}" data-pi="${pi.id}" data-plo="${p.id}"
                            style="width:34px;padding:1px;font-size:11px;border:1px solid var(--border);border-radius:var(--radius);font-family:inherit;
                                   ${isDisabled ? 'background:var(--bg-secondary);opacity:0.5;cursor:not-allowed;' : 'cursor:pointer;'}"
                            ${isDisabled ? 'disabled' : ''}>
                      <option value="0" ${val === 0 ? 'selected' : ''}>—</option>
                      <option value="1" ${val === 1 ? 'selected' : ''}>1</option>
                      <option value="2" ${val === 2 ? 'selected' : ''}>2</option>
                      <option value="3" ${val === 3 ? 'selected' : ''}>3</option>
                    </select>
                  </td>`;
                }).join('');
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('save-c-pi-btn')?.addEventListener('click', async () => {
      const piSelects = document.querySelectorAll('#c-pi-table select.pi-select');
      const pi_mappings = Array.from(piSelects).filter(s => !s.disabled).map(s => ({ 
        course_id: parseInt(s.dataset.vc), 
        pi_id: parseInt(s.dataset.pi), 
        contribution_level: parseInt(s.value) 
      }));
      try {
        const res = await handlers.saveCoursePIMappings(versionId, { pi_mappings });
        if (!res.ok) throw new Error((await res.json()).error);
        window.toast.success(`Đã lưu ma trận PI`);
        if (onRefresh) onRefresh();
      } catch (e) { window.toast.error(e.message); }
    });
  },

  // ===== TAB: Assessment =====
  async renderAssessmentTab(body) {
    const { versionId, editable, handlers, onRefresh } = this.context;
    const [assessments, plos, vCourses] = await Promise.all([
      handlers.getAssessments(versionId),
      handlers.getPLOs(versionId),
      handlers.getVCourses(versionId),
    ]);
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Kế hoạch đánh giá CĐR</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" id="add-assess-btn">+ Thêm</button>' : ''}
      </div>
      <table class="data-table">
        <thead><tr><th>PLO</th><th>HP lấy mẫu</th><th>Công cụ</th><th>Tiêu chí</th><th>Ngưỡng</th><th>HK</th><th>GV</th>${editable ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${assessments.length === 0 ? `<tr><td colspan="${!editable ? 7 : 8}" style="color:var(--text-muted);text-align:center;">Chưa có</td></tr>` : assessments.map(a => `
            <tr style="font-size:13px;">
              <td>${plos.find(p => p.id === a.plo_id)?.code || '?'}</td>
              <td>${a.course_code || '—'}</td>
              <td>${a.assessment_tool || ''}</td>
              <td>${a.criteria || ''}</td>
              <td>${a.threshold || ''}</td>
              <td>${a.semester || ''}</td>
              <td>${a.assessor || ''}</td>
              ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" data-action="delete-assess" data-id="${a.id}">Xóa</button></td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${editable ? `
        <div id="assess-form" style="margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);display:none;">
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
            <div class="input-group" style="margin:0;"><label>PLO</label>
              <select id="a-plo">${plos.map(p => `<option value="${p.id}">${p.code}</option>`).join('')}</select>
            </div>
            <div class="input-group" style="margin:0;"><label>HP lấy mẫu</label>
              <select id="a-course"><option value="">—</option>${vCourses.map(c => `<option value="${c.course_id}">${c.course_code}</option>`).join('')}</select>
            </div>
            <div class="input-group" style="margin:0;"><label>Công cụ</label><input type="text" id="a-tool" placeholder="Câu hỏi bài KT"></div>
            <div class="input-group" style="margin:0;"><label>Tiêu chí</label><input type="text" id="a-criteria"></div>
            <div class="input-group" style="margin:0;"><label>Ngưỡng</label><input type="text" id="a-threshold" placeholder="70% đạt"></div>
            <div class="input-group" style="margin:0;"><label>HK</label><input type="text" id="a-sem" placeholder="HK1"></div>
            <div class="input-group" style="margin:0;"><label>GV</label><input type="text" id="a-assessor"></div>
          </div>
          <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end;">
            <button class="btn btn-secondary btn-sm" id="cancel-assess-btn">Hủy</button>
            <button class="btn btn-primary btn-sm" id="save-assess-btn">Lưu</button>
          </div>
        </div>
      ` : ''}
    `;

    if (editable) {
      document.getElementById('add-assess-btn')?.addEventListener('click', () => {
        document.getElementById('assess-form').style.display = 'block';
      });

      document.getElementById('save-assess-btn')?.addEventListener('click', async () => {
        const payload = {
          plo_id: parseInt(document.getElementById('a-plo').value),
          sample_course_id: document.getElementById('a-course').value || null,
          assessment_tool: document.getElementById('a-tool').value.trim(),
          criteria: document.getElementById('a-criteria').value.trim(),
          threshold: document.getElementById('a-threshold').value.trim(),
          semester: document.getElementById('a-sem').value.trim(),
          assessor: document.getElementById('a-assessor').value.trim(),
        };
        try {
          const res = await handlers.saveAssessment(versionId, payload);
          if (!res.ok) throw new Error((await res.json()).error);
          window.toast.success('Đã thêm');
          if (onRefresh) onRefresh();
        } catch (e) { window.toast.error(e.message); }
      });

      body.querySelectorAll('[data-action="delete-assess"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Xóa?')) return;
          try {
            await handlers.deleteAssessment(btn.dataset.id);
            window.toast.success('Đã xóa');
            if (onRefresh) onRefresh();
          } catch (e) { window.toast.error(e.message); }
        });
      });

      document.getElementById('cancel-assess-btn')?.addEventListener('click', () => {
        document.getElementById('assess-form').style.display = 'none';
      });
    }
  },

  // ===== TAB: Syllabi =====
  async renderSyllabiTab(body) {
    const { versionId, editable, handlers, onRefresh } = this.context;
    const [syllabi, vCourses] = await Promise.all([
      handlers.getSyllabi(versionId),
      handlers.getVCourses(versionId)
    ]);

    const syllabiMap = {};
    syllabi.forEach(s => { syllabiMap[s.course_id] = s; });
    const statusLabels = { draft: 'Nháp', submitted: 'Đã nộp', approved_tbm: 'TBM ✓', approved_khoa: 'Khoa ✓', approved_pdt: 'PĐT ✓', published: 'Công bố' };

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Đề cương chi tiết</h3>
        <span style="color:var(--text-muted);font-size:13px;">${syllabi.length}/${vCourses.length} đề cương</span>
      </div>
      ${vCourses.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Hãy gán HP vào CTĐT trước.</p>' : `
        <table class="data-table">
          <thead><tr><th>Mã</th><th>Tên HP</th><th>TC</th><th>Tác giả</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            ${vCourses.map(c => {
              const courseRef = c.course_id || c.id;
              const syl = syllabiMap[courseRef];
              const authors = (syl && syl.authors) ? syl.authors.map(a => a.display_name).join(', ') : '—';
              return `<tr>
                <td><strong>${c.course_code}</strong></td>
                <td>${c.course_name}</td>
                <td style="text-align:center;">${c.credits}</td>
                <td style="color:var(--text-muted);font-size:12px;">${authors}</td>
                <td>${syl ? `<span class="badge badge-info">${statusLabels[syl.status] || syl.status}</span>` : '<span class="badge badge-neutral">Chưa tạo</span>'}</td>
                <td style="white-space:nowrap;">
                  ${syl
                    ? '<span style="color:var(--text-muted);font-size:12px;">Lưu tạm trong phiên import</span>'
                    : (editable ? `<button class="btn btn-primary btn-sm" data-action="create-syllabus" data-course-id="${courseRef}">Tạo ĐC</button>` : '')}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      `}
    `;

    if (editable) {
      body.querySelectorAll('[data-action="create-syllabus"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          try {
            const res = await handlers.createSyllabus(versionId, { course_id: btn.dataset.courseId, content: {} });
            if (!res.ok) throw new Error((await res.json()).error);
            window.toast.success('Đã tạo đề cương tạm');
            if (onRefresh) onRefresh();
          } catch (e) { window.toast.error(e.message); }
        });
      });
    }
  },

  // ===== TAB: PLO =====
  async renderPLOTab(body) {
    const { versionId, editable, handlers, onRefresh } = this.context;
    const plos = await handlers.getPLOs(versionId);
    const bloomLabels = ['', '1-Nhớ', '2-Hiểu', '3-Áp dụng', '4-Phân tích', '5-Đánh giá', '6-Sáng tạo'];
    
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Chuẩn đầu ra (PLO)</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" id="add-plo-btn">+ Thêm</button>' : ''}
      </div>
      <table class="data-table">
        <thead><tr><th>Mã</th><th>Bloom</th><th>Mô tả</th>${editable ? '<th style="width:100px;"></th>' : ''}</tr></thead>
        <tbody>
          ${plos.length === 0 ? `<tr><td colspan="${!editable ? 3 : 4}" style="color:var(--text-muted);text-align:center;">Chưa có PLO</td></tr>` : plos.map(p => `
            <tr>
              <td><strong style="color:var(--primary);">${p.code}</strong></td>
              <td><span class="badge badge-info">${bloomLabels[p.bloom_level] || p.bloom_level}</span></td>
              <td style="font-size:13px;">${p.description || ''}</td>
              ${editable ? `<td style="white-space:nowrap;">
                <button class="btn btn-secondary btn-sm" data-action="edit-plo" data-id="${p.id}" data-code="${p.code}" data-bloom="${p.bloom_level}" data-desc="${(p.description || '').replace(/"/g, '&quot;')}">Sửa</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--danger);" data-action="delete-plo" data-id="${p.id}">Xóa</button>
              </td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div id="plo-form-area" style="display:none;margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
        <input type="hidden" id="plo-edit-id">
        <div style="display:grid;grid-template-columns:100px 140px 1fr auto auto;gap:10px;align-items:end;">
          <div class="input-group" style="margin:0;"><label>Mã</label><input type="text" id="plo-code" placeholder="PLO1"></div>
          <div class="input-group" style="margin:0;"><label>Bloom</label>
            <select id="plo-bloom">${bloomLabels.slice(1).map((l, i) => `<option value="${i + 1}">${l}</option>`).join('')}</select>
          </div>
          <div class="input-group" style="margin:0;"><label>Mô tả</label><input type="text" id="plo-pdesc" placeholder="Mô tả chuẩn đầu ra"></div>
          <button class="btn btn-primary btn-sm" id="save-plo-btn">Lưu</button>
          <button class="btn btn-secondary btn-sm" id="cancel-plo-btn">Hủy</button>
        </div>
      </div>
    `;

    if (editable) {
      document.getElementById('add-plo-btn')?.addEventListener('click', () => {
        document.getElementById('plo-edit-id').value = '';
        document.getElementById('plo-code').value = `PLO${plos.length + 1}`;
        document.getElementById('plo-bloom').value = '3';
        document.getElementById('plo-pdesc').value = '';
        document.getElementById('plo-form-area').style.display = 'block';
      });

      body.querySelectorAll('[data-action="edit-plo"]').forEach(btn => {
        btn.addEventListener('click', () => {
          document.getElementById('plo-edit-id').value = btn.dataset.id;
          document.getElementById('plo-code').value = btn.dataset.code;
          document.getElementById('plo-bloom').value = btn.dataset.bloom;
          document.getElementById('plo-pdesc').value = btn.dataset.desc;
          document.getElementById('plo-form-area').style.display = 'block';
        });
      });

      body.querySelectorAll('[data-action="delete-plo"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Xóa PLO này?')) return;
          try {
            await handlers.deletePLO(btn.dataset.id);
            window.toast.success('Đã xóa');
            if (onRefresh) onRefresh();
          } catch (e) { window.toast.error(e.message); }
        });
      });

      document.getElementById('save-plo-btn')?.addEventListener('click', async () => {
        const id = document.getElementById('plo-edit-id').value;
        const code = document.getElementById('plo-code').value.trim();
        const bloom_level = parseInt(document.getElementById('plo-bloom').value);
        const description = document.getElementById('plo-pdesc').value.trim();
        if (!code) { window.toast.warning('Nhập mã PLO'); return; }
        try {
          const res = await handlers.savePLO(versionId, id, { code, bloom_level, description });
          if (!res.ok) throw new Error((await res.json()).error);
          window.toast.success(id ? 'Đã cập nhật' : 'Đã thêm');
          if (onRefresh) onRefresh();
        } catch (e) { window.toast.error(e.message); }
      });

      document.getElementById('cancel-plo-btn')?.addEventListener('click', () => {
        document.getElementById('plo-form-area').style.display = 'none';
      });
    }
  },

  // ===== TAB: Courses =====
  async renderCoursesTab(body) {
    const { versionId, editable, handlers, onRefresh } = this.context;
    const [vCourses, allCourses] = await Promise.all([
      handlers.getVCourses(versionId),
      handlers.getAllCourses()
    ]);
    const usedIds = new Set(vCourses.map(c => c.course_id));
    const available = allCourses.filter(c => !usedIds.has(c.id));

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Cấu trúc học phần</h3>
        <span style="color:var(--text-muted);font-size:13px;">${vCourses.reduce((s, c) => s + (c.credits || 0), 0)} TC / ${vCourses.length} HP</span>
      </div>
      ${editable && available.length ? `
        <div style="display:flex;gap:10px;align-items:end;margin-bottom:16px;padding:14px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
          <div class="input-group" style="flex:1;margin:0;"><label>Thêm HP</label>
            <select id="add-vc-course">${available.map(c => `<option value="${c.id}">${c.code} — ${c.name} (${c.credits} TC)</option>`).join('')}</select>
          </div>
          <div class="input-group" style="width:90px;margin:0;"><label>HK</label>
            <select id="add-vc-sem">${[1, 2, 3, 4, 5, 6, 7, 8].map(s => `<option value="${s}">HK ${s}</option>`).join('')}</select>
          </div>
          <div class="input-group" style="width:120px;margin:0;"><label>Loại</label>
            <select id="add-vc-type"><option value="required">Bắt buộc</option><option value="elective">Tự chọn</option></select>
          </div>
          <button class="btn btn-primary btn-sm" id="add-vc-btn">Thêm</button>
        </div>
      ` : ''}
      <table class="data-table">
        <thead><tr><th>Mã</th><th>Tên HP</th><th>TC</th><th>HK</th><th>Loại</th><th>Đơn vị</th>${editable ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${vCourses.length === 0 ? `<tr><td colspan="${!editable ? 6 : 7}" style="color:var(--text-muted);text-align:center;">Chưa gán HP</td></tr>` : vCourses.map(c => `
            <tr data-course-code="${c.course_code}">
              <td><strong>${c.course_code}</strong></td>
              <td>${c.course_name}</td>
              <td style="text-align:center;">${c.credits}</td>
              <td><span class="badge badge-info">HK ${c.semester}</span></td>
              <td><span class="badge ${c.course_type === 'required' ? 'badge-success' : 'badge-warning'}">${c.course_type === 'required' ? 'Bắt buộc' : 'Tự chọn'}</span></td>
              <td style="color:var(--text-muted);">${c.dept_name || ''}</td>
              ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" data-action="remove-course" data-id="${c.id}">Xóa</button></td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    if (editable) {
      document.getElementById('add-vc-btn')?.addEventListener('click', async () => {
        const course_id = document.getElementById('add-vc-course').value;
        const semester = parseInt(document.getElementById('add-vc-sem').value);
        const course_type = document.getElementById('add-vc-type').value;
        try {
          const res = await handlers.addCourse(versionId, { course_id, semester, course_type });
          if (!res.ok) throw new Error((await res.json()).error);
          window.toast.success('Đã thêm');
          if (onRefresh) onRefresh();
        } catch (e) { window.toast.error(e.message); }
      });

      body.querySelectorAll('[data-action="remove-course"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('Gỡ HP khỏi CTĐT?')) return;
          try {
            await handlers.removeCourse(btn.dataset.id);
            window.toast.success('Đã gỡ');
            if (onRefresh) onRefresh();
          } catch (e) { window.toast.error(e.message); }
        });
      });
    }
  },

  // ===== TAB: PO-PLO Matrix =====
  async renderPOPLOMatrix(body) {
    const { versionId, editable, handlers, onRefresh } = this.context;
    const [pos, plos, maps] = await Promise.all([
      handlers.getPOs(versionId),
      handlers.getPLOs(versionId),
      handlers.getPOPLOMappings(versionId)
    ]);

    if (!pos.length || !plos.length) {
      body.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Hãy thêm PO và PLO trước.</p>';
      return;
    }

    const mapSet = new Set(maps.map(m => `${m.po_id}-${m.plo_id}`));
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Ma trận PO ↔ PLO</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" id="save-po-plo-btn">Lưu</button>' : ''}
      </div>
      <div style="width:100%;overflow:auto;">
        <table class="data-table" id="po-plo-table" style="min-width:max-content;width:100%;">
          <thead><tr><th></th>${plos.map(p => `<th style="text-align:center;min-width:55px;">${p.code}</th>`).join('')}</tr></thead>
          <tbody>
            ${pos.map(po => `<tr>
              <td><strong>${po.code}</strong></td>
              ${plos.map(plo => {
                const checked = mapSet.has(`${po.id}-${plo.id}`);
                return `<td style="text-align:center;">
                    <input type="checkbox" data-po="${po.id}" data-plo="${plo.id}" ${checked ? 'checked' : ''} ${!editable ? 'disabled' : ''}
                      style="width:16px;height:16px;cursor:${!editable ? 'default' : 'pointer'};">
                  </td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('save-po-plo-btn')?.addEventListener('click', async () => {
      const checkboxes = document.querySelectorAll('#po-plo-table input[type="checkbox"]:checked');
      const mappings = Array.from(checkboxes).map(cb => ({ po_id: parseInt(cb.dataset.po), plo_id: parseInt(cb.dataset.plo) }));
      try {
        const res = await handlers.savePOPLOMappings(versionId, { mappings });
        if (!res.ok) throw new Error((await res.json()).error);
        window.toast.success(`Đã lưu ${mappings.length} liên kết`);
      } catch (e) { window.toast.error(e.message); }
    });
  }
};
