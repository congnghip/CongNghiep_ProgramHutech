// Version Editor — 10-Tab CTĐT Editor (Notion-style)
window.VersionEditorPage = {
  versionId: null,
  version: null,
  routeContext: {},
  activeTab: 0,

  tabs: [
    { key: 'info', label: 'Thông tin', viewPerm: 'programs.view_published' },
    { key: 'po', label: 'Mục tiêu PO', viewPerm: 'programs.view_published', editPerm: 'programs.po.edit' },
    { key: 'plo', label: 'Chuẩn đầu ra PLO', viewPerm: 'programs.view_published', editPerm: 'programs.plo.edit' },
    { key: 'pi', label: 'Chỉ số PI', viewPerm: 'programs.view_published', editPerm: 'programs.plo.edit' },
    { key: 'po_plo', label: 'PO ↔ PLO', viewPerm: 'programs.view_published', editPerm: 'programs.matrix.edit' },
    { key: 'courses', label: 'Học phần', viewPerm: 'programs.view_published', editPerm: 'programs.courses.edit' },
    { key: 'plan', label: 'Kế hoạch GD', viewPerm: 'programs.view_published', editPerm: 'programs.courses.edit' },
    { key: 'course_plo', label: 'HP ↔ PLO', viewPerm: 'programs.view_published', editPerm: 'programs.matrix.edit' },
    { key: 'assessment', label: 'Đánh giá CĐR', viewPerm: 'programs.view_published', editPerm: 'programs.assessment.edit' },
    { key: 'syllabi', label: 'Đề cương', viewPerm: 'programs.view_published', editPerm: 'syllabus.edit' },
  ],

  getStatusEditPerm(status) {
    const map = {
      draft: 'programs.edit',
      submitted: 'programs.approve_khoa',
      approved_khoa: 'programs.approve_pdt',
      approved_pdt: 'programs.approve_bgh'
    };
    return map[status] || null;
  },

  async render(container, versionId, params = {}) {
    this.versionId = versionId;
    this.routeContext = params || {};
    container.innerHTML = '<div class="spinner"></div>';
    try {
      this.version = await fetch(`/api/versions/${versionId}`).then(r => r.json());
      if (this.version.error) throw new Error(this.version.error);
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="icon">❌</div><h3>Lỗi</h3><p>${e.message}</p></div>`;
      return;
    }
    const locked = this.version.is_locked;
    const isPublished = this.version.status === 'published';
    const isDraft = this.version.status === 'draft';
    const isRejected = this.version.is_rejected;
    const rejectionReason = this.version.rejection_reason;
    const statusPerm = isPublished ? 'programs.view_published' : 'programs.view_draft';
    
    // Filter visible tabs: must have both version-status-view-perm AND the tab's specific viewPerm (if any)
    this.visibleTabs = this.tabs.filter(t => window.App.hasPerm(statusPerm));
    const requestedTabIndex = this.visibleTabs.findIndex(t => t.key === this.routeContext.tabKey);
    const initialTabIndex = requestedTabIndex >= 0 ? requestedTabIndex : 0;

    container.innerHTML = `
      <div style="margin-bottom:24px;">
        <div id="version-breadcrumb" style="margin-bottom:8px;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.3px;">${this.version.academic_year}</h1>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
              ${locked ? '<span class="badge badge-danger">Đã khóa</span>' : `<span class="badge badge-warning">${this.version.status}</span>`}
              ${isRejected ? '<span class="badge badge-danger">Bị từ chối</span>' : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            ${window.App.hasPerm('programs.export') ? '<button class="btn btn-secondary btn-sm" onclick="window.VersionEditorPage.exportVersion()">Xuất JSON</button>' : ''}
            ${(isDraft && !locked && window.App.hasPerm('programs.submit')) ? '<button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.submitVersion()">Nộp duyệt</button>' : ''}
          </div>
        </div>
      </div>
      ${isRejected ? `
        <div style="background:rgba(215, 58, 73, 0.1);border:1px solid var(--danger);border-radius:var(--radius-lg);padding:16px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="badge badge-danger" style="padding:4px 8px;font-weight:600;">Bị từ chối</span>
            <div style="font-size:13px;color:var(--danger);font-weight:500;">Yêu cầu chỉnh sửa từ người phê duyệt</div>
          </div>
          <button class="btn btn-danger btn-sm" onclick="window.VersionEditorPage.showRejectionReason()">Lý do từ chối</button>
        </div>
        <div id="rejection-panel" style="display:none;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:24px;">
          <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;">Lý do chi tiết:</h4>
          <div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">${rejectionReason || 'Chưa có lý do cụ thể.'}</div>
        </div>
      ` : ''}
      <div class="tab-bar" id="editor-tabs">
        ${this.visibleTabs.map((t, i) => `<div class="tab-item ${i === initialTabIndex ? 'active' : ''}" data-index="${i}">${t.label}</div>`).join('')}
      </div>
      <div id="tab-content"><div class="spinner"></div></div>

      <!-- Assignment Modal -->
      <div id="assign-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2>Phân công soạn đề cương</h2></div>
          <div class="modal-body">
            <input type="hidden" id="as-syllabus-id">
            <div class="input-group">
              <label>Giảng viên soạn thảo (có thể chọn nhiều)</label>
              <div id="as-user-list" style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:4px;padding:8px;background:var(--bg-secondary);">
                <div class="spinner"></div>
              </div>
            </div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('assign-modal').classList.remove('active')">Đóng</button>
              <button class="btn btn-primary" onclick="window.VersionEditorPage.saveAssignment()">Lưu phân công</button>
            </div>
          </div>
        </div>
      </div>
      `;

    document.querySelectorAll('#editor-tabs .tab-item').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('#editor-tabs .tab-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        this.activeTab = parseInt(el.dataset.index);
        this.renderTab();
      });
    });
    this.activeTab = initialTabIndex;
    document.querySelector(`#editor-tabs .tab-item[data-index="${this.activeTab}"]`)?.classList.add('active');
    this.updateBreadcrumb();
    this.renderTab();
  },

  getActiveTabLabel() {
    return this.visibleTabs?.[this.activeTab]?.label || 'Thông tin';
  },

  getBreadcrumbItems() {
    const items = [];
    if (this.routeContext.programId && this.routeContext.programName) {
      items.push({ label: 'Chương trình đào tạo', page: 'programs' });
      items.push({
        label: 'Phiên bản',
        page: 'programs',
        params: {
          programId: this.routeContext.programId,
          programName: this.routeContext.programName
        }
      });
    }
    items.push({ label: this.getActiveTabLabel() });
    return items;
  },

  updateBreadcrumb() {
    const breadcrumb = document.getElementById('version-breadcrumb');
    if (breadcrumb) breadcrumb.innerHTML = window.App.renderBreadcrumb(this.getBreadcrumbItems());
  },

  async renderTab() {
    const body = document.getElementById('tab-content');
    body.innerHTML = '<div class="spinner"></div>';
    this.updateBreadcrumb();
    const tab = this.visibleTabs[this.activeTab];
    const tabKey = tab.key;
    const locked = this.version.is_locked;
    const statusEditPerm = this.getStatusEditPerm(this.version.status);
    let canEditStatus = statusEditPerm ? window.App.hasPerm(statusEditPerm) : false;
    
    // Explicit admin check: Admin can always edit as long as status matches ONE of the editable states
    const isEditableState = ['draft', 'submitted', 'approved_khoa', 'approved_pdt'].includes(this.version.status);
    if (window.App.isAdmin && isEditableState) {
      canEditStatus = true;
    }
    
    const tabEditable = !locked && canEditStatus && (!tab.editPerm || window.App.hasPerm(tab.editPerm));

    try {
      switch (tabKey) {
        case 'info':
          await this.renderInfoTab(body, false);
          break;
        case 'po':
          window.TrainingTabs.init(this.versionId, tabEditable, null, () => this.renderTab());
          await window.TrainingTabs.renderPOTab(body);
          break;
        case 'plo':
          window.TrainingTabs.init(this.versionId, tabEditable, null, () => this.renderTab());
          await window.TrainingTabs.renderPLOTab(body);
          break;
        case 'pi':
          await this.renderPITab(body, tabEditable);
          break;
        case 'po_plo':
          window.TrainingTabs.init(this.versionId, tabEditable, null, () => this.renderTab());
          await window.TrainingTabs.renderPOPLOMatrix(body);
          break;
        case 'courses':
          window.TrainingTabs.init(this.versionId, tabEditable, null, () => this.renderTab());
          await window.TrainingTabs.renderCoursesTab(body);
          break;
        case 'plan':
          await this.renderPlanTab(body, tabEditable);
          break;
        case 'course_plo':
          await this.renderCoursePLOMatrix(body, tabEditable);
          break;
        case 'assessment':
          await this.renderAssessmentTab(body, tabEditable);
          break;
        case 'syllabi': {
          const canAssign = !locked && window.App.hasPerm('syllabus.assign');
          const canCreate = !locked && canEditStatus && window.App.hasPerm('syllabus.create');
          window.TrainingTabs.init(this.versionId, tabEditable, null, () => this.renderTab(), {
            canCreateSyllabus: canCreate
          });
          await this.renderSyllabiTab(body, tabEditable, canAssign, canCreate);
          break;
        }
      }
    } catch (e) {
      body.innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`;
    }
  },

  // ===== TAB 1: Info =====
  async renderInfoTab(body, editable) {
    body.innerHTML = `
      <div style="max-width:480px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Thông tin chung</h3>
        <div class="input-group"><label>Tên ngành</label><input type="text" value="${this.version.program_name}" disabled></div>
        <div class="input-group"><label>Mã ngành</label><input type="text" value="${this.version.program_code || ''}" disabled></div>
        <div class="input-group"><label>Bậc đào tạo</label><input type="text" value="${this.version.degree || ''}" disabled></div>
        <div class="input-group"><label>Tổng tín chỉ</label><input type="text" value="${this.version.total_credits || ''}" disabled></div>
        <div class="input-group"><label>Khoa/Viện</label><input type="text" value="${this.version.dept_name}" disabled></div>
        <div class="input-group"><label>Năm học</label><input type="text" value="${this.version.academic_year}" disabled></div>
        <div class="input-group"><label>Trạng thái</label><input type="text" value="${this.version.status}" disabled></div>
        <p style="color:var(--text-muted);font-size:12px;margin-top:8px;">Thông tin chung được kế thừa từ CTĐT gốc.</p>
      </div>
    `;
  },

  // ===== TAB 2: PO =====
  async renderPOTab(body, editable) {
    const pos = await fetch(`/api/versions/${this.versionId}/objectives`).then(r => r.json());
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
              <button class="btn btn-secondary btn-sm" onclick="window.VersionEditorPage.editPO(${po.id},'${po.code}',\`${(po.description || '').replace(/`/g, "'")}\`)">Sửa</button>
              <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.VersionEditorPage.deletePO(${po.id})">Xóa</button>
            </div>` : ''}
          </div>
        `).join('')}
      </div>
      <div id="po-form-area" style="display:none;margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
        <input type="hidden" id="po-edit-id">
        <div style="display:flex;gap:10px;align-items:end;">
          <div class="input-group" style="width:100px;margin:0;"><label>Mã</label><input type="text" id="po-code" placeholder="PO1"></div>
          <div class="input-group" style="flex:1;margin:0;"><label>Mô tả</label><input type="text" id="po-desc" placeholder="Mô tả mục tiêu"></div>
          <button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.savePO()">Lưu</button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('po-form-area').style.display='none'">Hủy</button>
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
    }
  },

  editPO(id, code, desc) {
    document.getElementById('po-edit-id').value = id;
    document.getElementById('po-code').value = code;
    document.getElementById('po-desc').value = desc;
    document.getElementById('po-form-area').style.display = 'block';
  },

  async savePO() {
    const id = document.getElementById('po-edit-id').value;
    const code = document.getElementById('po-code').value.trim();
    const description = document.getElementById('po-desc').value.trim();
    if (!code) { window.toast.warning('Nhập mã PO'); return; }
    try {
      const url = id ? `/api/objectives/${id}` : `/api/versions/${this.versionId}/objectives`;
      const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, description }) });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success(id ? 'Đã cập nhật' : 'Đã thêm');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },

  async deletePO(id) {
    if (!confirm('Xóa mục tiêu này?')) return;
    await fetch(`/api/objectives/${id}`, { method: 'DELETE' });
    window.toast.success('Đã xóa');
    this.renderTab();
  },

  // ===== TAB 3: PLO =====
  async renderPLOTab(body, editable) {
    const plos = await fetch(`/api/versions/${this.versionId}/plos`).then(r => r.json());
    const bloomLabels = ['', '1-Nhớ', '2-Hiểu', '3-Áp dụng', '4-Phân tích', '5-Đánh giá', '6-Sáng tạo'];
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Chuẩn đầu ra (PLO)</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" id="add-plo-btn">+ Thêm</button>' : ''}
      </div>
      <table class="data-table">
        <thead><tr><th>Mã</th><th>Bloom</th><th>Mô tả</th>${editable ? '<th style="width:100px;"></th>' : ''}</tr></thead>
        <tbody id="plo-tbody">
          ${plos.length === 0 ? `<tr><td colspan="${!editable ? 3 : 4}" style="color:var(--text-muted);text-align:center;">Chưa có PLO</td></tr>` : plos.map(p => `
            <tr>
              <td><strong style="color:var(--primary);">${p.code}</strong></td>
              <td><span class="badge badge-info">${bloomLabels[p.bloom_level] || p.bloom_level}</span></td>
              <td style="font-size:13px;">${p.description || ''}</td>
              ${editable ? `<td style="white-space:nowrap;">
                <button class="btn btn-secondary btn-sm" onclick="window.VersionEditorPage.editPLO(${p.id},'${p.code}',${p.bloom_level},\`${(p.description || '').replace(/`/g, "'")}\`)">Sửa</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.VersionEditorPage.deletePLO(${p.id})">Xóa</button>
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
          <button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.savePLO()">Lưu</button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('plo-form-area').style.display='none'">Hủy</button>
        </div>
      </div>
    `;
    document.getElementById('add-plo-btn')?.addEventListener('click', () => {
      document.getElementById('plo-edit-id').value = '';
      document.getElementById('plo-code').value = `PLO${plos.length + 1}`;
      document.getElementById('plo-bloom').value = '3';
      document.getElementById('plo-pdesc').value = '';
      document.getElementById('plo-form-area').style.display = 'block';
    });
  },

  editPLO(id, code, bloom, desc) {
    document.getElementById('plo-edit-id').value = id;
    document.getElementById('plo-code').value = code;
    document.getElementById('plo-bloom').value = bloom;
    document.getElementById('plo-pdesc').value = desc;
    document.getElementById('plo-form-area').style.display = 'block';
  },

  async savePLO() {
    const id = document.getElementById('plo-edit-id').value;
    const code = document.getElementById('plo-code').value.trim();
    const bloom_level = parseInt(document.getElementById('plo-bloom').value);
    const description = document.getElementById('plo-pdesc').value.trim();
    if (!code) { window.toast.warning('Nhập mã PLO'); return; }
    try {
      const url = id ? `/api/plos/${id}` : `/api/versions/${this.versionId}/plos`;
      const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, bloom_level, description }) });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success(id ? 'Đã cập nhật' : 'Đã thêm');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },

  async deletePLO(id) {
    if (!confirm('Xóa PLO này?')) return;
    await fetch(`/api/plos/${id}`, { method: 'DELETE' });
    window.toast.success('Đã xóa');
    this.renderTab();
  },

  // ===== TAB 4: PI =====
  async renderPITab(body, editable) {
    const [plos, mappings, courses] = await Promise.all([
      fetch(`/api/versions/${this.versionId}/plos`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/course-plo-map`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json())
    ]);
    
    const courseMap = {};
    courses.forEach(c => courseMap[c.id] = c); // c.id is version_course id

    const validCoursesForPlo = (ploId) => {
      const ploMappings = mappings.filter(m => m.plo_id === ploId && m.contribution_level > 0);
      return ploMappings.map(m => courseMap[m.course_id]).filter(c => c);
    };

    if (!window.VersionEditorPage.piData) window.VersionEditorPage.piData = {};
    window.VersionEditorPage.piData.validCoursesForPlo = validCoursesForPlo;

    body.innerHTML = `
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Chỉ số đo lường (PI)</h3>
      ${plos.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Hãy thêm PLO trước.</p>' : plos.map(plo => `
        <div style="margin-bottom:20px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="color:var(--primary);">${plo.code}: ${(plo.description || '').substring(0, 60)}...</strong>
            ${editable ? `<button class="btn btn-secondary btn-sm" onclick="window.VersionEditorPage.addPI(event, ${plo.id},'${plo.code}',${(plo.pis || []).length})">+ PI</button>` : ''}
          </div>
          ${(plo.pis || []).length === 0 ? '<p style="color:var(--text-muted);font-size:12px;margin-left:16px;">Chưa có PI</p>' : `
            <div style="margin-left:16px;">${plo.pis.map(pi => {
              const mappedCourses = (pi.course_ids || []).map(cid => courseMap[cid]?.course_code).filter(c=>c).join(', ');
              return `
              <div class="tree-node" style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                  <strong>${pi.pi_code}</strong> <span style="color:var(--text-muted);margin-left:4px;font-size:13px;">${pi.description || ''}</span>
                  ${mappedCourses ? `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;">Áp dụng cho: ${mappedCourses}</div>` : ''}
                </div>
                ${editable ? `<div style="display:flex;gap:4px;">
                  <button class="btn btn-secondary btn-sm" onclick='window.VersionEditorPage.editPI(event, ${pi.id},${plo.id},"${pi.pi_code}",\`${(pi.description || '').replace(/`/g, "'")}\`, ${JSON.stringify(pi.course_ids || [])})'>Sửa</button>
                  <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.VersionEditorPage.deletePI(${pi.id})">Xóa</button>
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
            <button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.savePI()">Lưu</button>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('pi-form-area').style.display='none'">Hủy</button>
          </div>
          <div id="pi-courses-area" style="margin-top:8px;"></div>
        </div>
      </div>
    `;
  },

  renderPICoursesForm(ploId, selectedIds) {
    const validCourses = window.VersionEditorPage.piData.validCoursesForPlo(ploId);
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
  },

  addPI(event, ploId, ploCode, count) {
    const formArea = document.getElementById('pi-form-area');
    event.target.closest('div[style*="margin-bottom:20px;"]').append(formArea);
    document.getElementById('pi-edit-id').value = '';
    document.getElementById('pi-plo-id').value = ploId;
    document.getElementById('pi-code').value = `PI.${ploCode.replace('PLO', '')}.${count + 1}`;
    document.getElementById('pi-desc').value = '';
    this.renderPICoursesForm(ploId, []);
    formArea.style.display = 'block';
  },

  editPI(event, id, ploId, code, desc, courseIdsArr) {
    const formArea = document.getElementById('pi-form-area');
    event.target.closest('.tree-node').after(formArea);
    document.getElementById('pi-edit-id').value = id;
    document.getElementById('pi-plo-id').value = ploId;
    document.getElementById('pi-code').value = code;
    document.getElementById('pi-desc').value = desc;
    this.renderPICoursesForm(ploId, courseIdsArr);
    formArea.style.display = 'block';
  },

  async savePI() {
    const id = document.getElementById('pi-edit-id').value;
    const ploId = document.getElementById('pi-plo-id').value;
    const pi_code = document.getElementById('pi-code').value.trim();
    const description = document.getElementById('pi-desc').value.trim();
    
    const course_ids = Array.from(document.querySelectorAll('.pi-course-cb:checked')).map(cb => parseInt(cb.value));

    if (!pi_code) { window.toast.warning('Nhập mã PI'); return; }
    try {
      const url = id ? `/api/pis/${id}` : `/api/plos/${ploId}/pis`;
      const res = await fetch(url, { 
        method: id ? 'PUT' : 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ pi_code, description, course_ids }) 
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success(id ? 'Đã cập nhật' : 'Đã thêm');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },

  async deletePI(id) {
    if (!confirm('Xóa PI này?')) return;
    await fetch(`/api/pis/${id}`, { method: 'DELETE' });
    window.toast.success('Đã xóa');
    this.renderTab();
  },

  // ===== TAB 5: PO-PLO Matrix =====
  async renderPOPLOMatrix(body, editable) {
    const [pos, plos, maps] = await Promise.all([
      fetch(`/api/versions/${this.versionId}/objectives`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/plos`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/po-plo-map`).then(r => r.json()),
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
      <div style="overflow-x:auto;">
        <table class="data-table" id="po-plo-table">
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
        const res = await fetch(`/api/versions/${this.versionId}/po-plo-map`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        window.toast.success(`Đã lưu ${mappings.length} liên kết`);
      } catch (e) { window.toast.error(e.message); }
    });
  },

  // ===== TAB 6: Courses =====
  async renderCoursesTab(body, editable) {
    const [vCourses, allCourses] = await Promise.all([
      fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json()),
      fetch('/api/courses').then(r => r.json()),
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
          <button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.addCourse()">Thêm</button>
        </div>
      ` : ''}
      <table class="data-table">
        <thead><tr><th>Mã</th><th>Tên HP</th><th>TC</th><th>HK</th><th>Loại</th><th>Đơn vị</th>${editable ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${vCourses.length === 0 ? `<tr><td colspan="${!editable ? 6 : 7}" style="color:var(--text-muted);text-align:center;">Chưa gán HP</td></tr>` : vCourses.map(c => `
            <tr>
              <td><strong>${c.course_code}</strong></td>
              <td>${c.course_name}</td>
              <td style="text-align:center;">${c.credits}</td>
              <td><span class="badge badge-info">HK ${c.semester}</span></td>
              <td><span class="badge ${c.course_type === 'required' ? 'badge-success' : 'badge-warning'}">${c.course_type === 'required' ? 'Bắt buộc' : 'Tự chọn'}</span></td>
              <td style="color:var(--text-muted);">${c.dept_name || ''}</td>
              ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.VersionEditorPage.removeCourse(${c.id})">Xóa</button></td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  async addCourse() {
    const course_id = document.getElementById('add-vc-course').value;
    const semester = parseInt(document.getElementById('add-vc-sem').value);
    const course_type = document.getElementById('add-vc-type').value;
    try {
      const res = await fetch(`/api/versions/${this.versionId}/courses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ course_id, semester, course_type })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã thêm');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },

  async removeCourse(vcId) {
    if (!confirm('Gỡ HP khỏi CTĐT?')) return;
    await fetch(`/api/version-courses/${vcId}`, { method: 'DELETE' });
    window.toast.success('Đã gỡ');
    this.renderTab();
  },

  // ===== TAB 7: Teaching Plan =====
  async renderPlanTab(body, editable) {
    const vCourses = await fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json());
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

  // ===== TAB 8: Course-PLO Matrix =====
  async renderCoursePLOMatrix(body, editable) {
    const [vCourses, plos, ploMaps, piMaps] = await Promise.all([
      fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/plos`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/course-plo-map`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/course-pi-map`).then(r => r.json())
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
        ${editable ? '<button class="btn btn-primary btn-sm" id="save-c-plo-btn">Lưu</button>' : ''}
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px;">— = Không áp dụng · 1 = Thấp · 2 = TB · 3 = Cao</p>
      <div style="overflow-x:auto;padding-bottom:16px;">
        <table class="data-table" id="c-plo-table" style="border-collapse:collapse;white-space:nowrap;">
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
                  const canEdit = isPloMapped;
                  const val = piMapping ? (piMapping.contribution_level || 0) : 0;
                  
                  const isDisabled = !(canEdit && editable);
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
    document.getElementById('save-c-plo-btn')?.addEventListener('click', async () => {
      const piSelects = document.querySelectorAll('#c-plo-table select.pi-select');
      const pi_mappings = [];
      piSelects.forEach(s => {
        if (!s.disabled) {
          pi_mappings.push({ course_id: parseInt(s.dataset.vc), pi_id: parseInt(s.dataset.pi), contribution_level: parseInt(s.value) });
        }
      });
      try {
        const piRes = await fetch(`/api/versions/${this.versionId}/course-pi-map`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pi_mappings })
        });
        if (!piRes.ok) throw new Error((await piRes.json()).error);
        
        window.toast.success(`Đã lưu thay đổi ma trận PI`);
        this.renderTab(); 
      } catch (e) { window.toast.error(e.message); }
    });
  },

  // ===== TAB 9: Assessment =====
  async renderAssessmentTab(body, editable) {
    const [assessments, plos, vCourses] = await Promise.all([
      fetch(`/api/versions/${this.versionId}/assessments`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/plos`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json()),
    ]);
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Kế hoạch đánh giá CĐR</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" id="add-assess-btn">+ Thêm</button>' : ''}
      </div>
      <table class="data-table">
        <thead><tr><th>PLO</th><th>HP lấy mẫu</th><th>Công cụ</th><th>Tiêu chí</th><th>Ngưỡng</th><th>HK</th><th>GV</th>${editable ? '<th></th>' : ''}</tr></thead>
        <tbody id="assess-tbody">
          ${assessments.length === 0 ? `<tr><td colspan="${!editable ? 7 : 8}" style="color:var(--text-muted);text-align:center;">Chưa có</td></tr>` : assessments.map(a => `
            <tr style="font-size:13px;">
              <td>${plos.find(p => p.id === a.plo_id)?.code || '?'}</td>
              <td>${a.course_code || '—'}</td>
              <td>${a.assessment_tool || ''}</td>
              <td>${a.criteria || ''}</td>
              <td>${a.threshold || ''}</td>
              <td>${a.semester || ''}</td>
              <td>${a.assessor || ''}</td>
              ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.VersionEditorPage.deleteAssessment(${a.id})">Xóa</button></td>` : ''}
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
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('assess-form').style.display='none'">Hủy</button>
            <button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.saveAssessment()">Lưu</button>
          </div>
        </div>
      ` : ''}
    `;
    document.getElementById('add-assess-btn')?.addEventListener('click', () => {
      document.getElementById('assess-form').style.display = 'block';
    });
  },

  async saveAssessment() {
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
      const res = await fetch(`/api/versions/${this.versionId}/assessments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã thêm');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },

  async deleteAssessment(id) {
    if (!confirm('Xóa?')) return;
    await fetch(`/api/assessments/${id}`, { method: 'DELETE' });
    window.toast.success('Đã xóa');
    this.renderTab();
  },

  // ===== TAB 10: Syllabi =====
  async renderSyllabiTab(body, editable, canAssign = false, canCreate = false) {
    const [syllabi, vCourses] = await Promise.all([
      fetch(`/api/versions/${this.versionId}/syllabi`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json()),
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
          <thead><tr><th>Mã</th><th>Tên HP</th><th>TC</th><th>Tác giả / Phân công</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            ${vCourses.map(c => {
      const syl = syllabiMap[c.course_id];
      const authors = (syl && syl.authors) ? syl.authors.map(a => a.display_name).join(', ') : '—';
      return `<tr>
                <td><strong>${c.course_code}</strong></td>
                <td>${c.course_name}</td>
                <td style="text-align:center;">${c.credits}</td>
                <td style="color:var(--text-muted);font-size:12px;">
                  ${authors}
                  ${syl && canAssign ? `<button class="btn btn-secondary btn-sm" style="padding:2px 4px;margin-left:8px;" onclick="window.VersionEditorPage.openAssignModal(${syl.id})">Phân công</button>` : ''}
                </td>
                <td>${syl ? `<span class="badge badge-info">${statusLabels[syl.status]}</span>` : '<span class="badge badge-neutral">Chưa tạo</span>'}</td>
                <td style="white-space:nowrap;">
                  ${syl
          ? `<button class="btn btn-secondary btn-sm" onclick="window.App.navigate('syllabus-editor',{syllabusId:${syl.id}, versionId:${this.versionId}, programId:${this.version.program_id}, programName:'${(this.version.program_name || '').replace(/'/g, "\\'")}', tabKey:'syllabi'})">${(editable && syl.status === 'draft') ? 'Soạn' : 'Xem'}</button>`
          : (canCreate ? `<button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.createSyllabus(${c.course_id})">Tạo ĐC</button>` : '')}
                </td>
              </tr>`;
    }).join('')}
          </tbody>
        </table>
      `}
    `;
  },

  async openAssignModal(sId) {
    document.getElementById('as-syllabus-id').value = sId;
    document.getElementById('as-user-list').innerHTML = '<div class="spinner"></div>';
    document.getElementById('assign-modal').classList.add('active');
    
    try {
      const [usersRes, assignmentsRes] = await Promise.all([
        fetch(`/api/users/assignable?syllabus_id=${sId}`),
        fetch(`/api/assignments/${sId}`)
      ]);
      const parseJsonSafely = async (res, fallbackMessage) => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (err) {
          if (text.trim().startsWith('<')) {
            throw new Error(`${fallbackMessage}. API có thể chưa được nạp, route chưa tồn tại, hoặc server chưa restart.`);
          }
          throw new Error(fallbackMessage);
        }
      };

      const users = await parseJsonSafely(usersRes, 'Không tải được danh sách giảng viên');
      const assignments = await parseJsonSafely(assignmentsRes, 'Không tải được phân công hiện tại');

      if (!usersRes.ok) throw new Error(users.error || 'Không tải được danh sách giảng viên');
      if (!assignmentsRes.ok) throw new Error(assignments.error || 'Không tải được phân công hiện tại');

      const safeUsers = Array.isArray(users) ? users : [];
      const safeAssignments = Array.isArray(assignments) ? assignments : [];
      const assignedIds = new Set(safeAssignments.map(a => a.user_id));

      if (safeUsers.length === 0) {
        document.getElementById('as-user-list').innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Không có giảng viên phù hợp trong phạm vi được phân công.</p>';
        return;
      }

      document.getElementById('as-user-list').innerHTML = safeUsers.map(u => `
        <label style="display:flex;align-items:center;gap:8px;padding:4px;cursor:pointer;">
          <input type="checkbox" value="${u.id}" ${assignedIds.has(u.id) ? 'checked' : ''}>
          <span style="font-size:13px;">${u.display_name} (${u.username}) - ${u.dept_name || 'Không đơn vị'}</span>
        </label>
      `).join('');
    } catch (e) {
      document.getElementById('as-user-list').innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`;
    }
  },

  async saveAssignment() {
    const sId = document.getElementById('as-syllabus-id').value;
    const userIds = Array.from(document.querySelectorAll('#as-user-list input:checked')).map(el => parseInt(el.value));
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ syllabus_id: parseInt(sId), user_ids: userIds })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã cập nhật phân công');
      document.getElementById('assign-modal').classList.remove('active');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },

  async createSyllabus(courseId) {
    try {
      const res = await fetch(`/api/versions/${this.versionId}/syllabi`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, content: {} })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const syl = await res.json();
      window.toast.success('Đã tạo đề cương');
      window.App.navigate('syllabus-editor', {
        syllabusId: syl.id,
        versionId: this.versionId,
        programId: this.version.program_id,
        programName: this.version.program_name,
        tabKey: 'syllabi'
      });
    } catch (e) { window.toast.error(e.message); }
  },

  async exportVersion() {
    try {
      const response = await fetch(`/api/export/version/${this.versionId}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Không thể xuất dữ liệu');
      if (data.error) throw new Error(data.error);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `CTDT_${data.version.program_code || 'export'}_${data.version.academic_year}.json`;
      a.click();
      URL.revokeObjectURL(url);
      window.toast.success('Đã xuất file JSON');
    } catch (e) { window.toast.error(e.message); }
  },

  submitVersion() {
    if (!confirm('Nộp CTĐT để phê duyệt?')) return;
    this.saveSubmit();
  },

  async saveSubmit() {
    try {
      const res = await fetch('/api/approval/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'program_version', entity_id: this.versionId })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã nộp');
      this.version.status = 'submitted';
      this.version.is_rejected = false;
      this.render(document.getElementById('page-content'), this.versionId);
    } catch (e) { window.toast.error(e.message); }
  },

  showRejectionReason() {
    const panel = document.getElementById('rejection-panel');
    if (panel) {
      const isVisible = panel.style.display === 'block';
      panel.style.display = isVisible ? 'none' : 'block';
      const btn = document.querySelector('button[onclick*="showRejectionReason"]');
      if (btn) btn.textContent = isVisible ? 'Lý do từ chối' : 'Ẩn lý do';
    }
  },

  destroy() { }
};
