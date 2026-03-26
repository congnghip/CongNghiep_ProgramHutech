// Version Editor — 10-Tab CTĐT Editor (Notion-style)
window.VersionEditorPage = {
  versionId: null,
  version: null,
  activeTab: 0,

  tabs: [
    { key: 'info', label: 'Thông tin', viewPerm: 'programs.view_published' },
    { key: 'po', label: 'Mục tiêu PO', viewPerm: 'programs.view_published' },
    { key: 'plo', label: 'Chuẩn đầu ra PLO', viewPerm: 'programs.view_published' },
    { key: 'pi', label: 'Chỉ số PI', viewPerm: 'programs.view_published' },
    { key: 'po_plo', label: 'PO ↔ PLO', viewPerm: 'programs.view_published' },
    { key: 'knowledge_blocks', label: 'Khối KT', viewPerm: 'programs.view_published' },
    { key: 'courses', label: 'Học phần', viewPerm: 'programs.view_published' },
    { key: 'descriptions', label: 'Mô tả HP', viewPerm: 'programs.view_published' },
    { key: 'plan', label: 'Kế hoạch GD', viewPerm: 'programs.view_published' },
    { key: 'course_plo', label: 'HP ↔ PLO', viewPerm: 'programs.view_published' },
    { key: 'course_pi', label: 'HP ↔ PI', viewPerm: 'programs.view_published' },
    { key: 'assessment', label: 'Đánh giá CĐR', viewPerm: 'programs.view_published' },
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

  async render(container, versionId) {
    this.versionId = versionId;
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

    container.innerHTML = `
      <div style="margin-bottom:24px;">
        <nav style="display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:12px;flex-wrap:wrap;">
          <a href="#" onclick="event.preventDefault();window.App.navigate('programs')" style="color:var(--text-muted);text-decoration:none;cursor:pointer;" onmouseenter="this.style.textDecoration='underline'" onmouseleave="this.style.textDecoration='none'">Chương trình Đào tạo</a>
          <span style="color:var(--text-muted);">›</span>
          <a href="#" onclick="event.preventDefault();window.App.navigate('programs',{deptName:'${(this.version.dept_name || '').replace(/'/g, "\\'")}'})  " style="color:var(--text-muted);text-decoration:none;cursor:pointer;" onmouseenter="this.style.textDecoration='underline'" onmouseleave="this.style.textDecoration='none'">${this.version.dept_name}</a>
          <span style="color:var(--text-muted);">›</span>
          <a href="#" onclick="event.preventDefault();window.App.navigate('programs',{programId:${this.version.program_id},programName:'${(this.version.program_name || '').replace(/'/g, "\\'")}'})  " style="color:var(--text-muted);text-decoration:none;cursor:pointer;" onmouseenter="this.style.textDecoration='underline'" onmouseleave="this.style.textDecoration='none'">${this.version.program_name}</a>
          <span style="color:var(--text-muted);">›</span>
          <span style="color:var(--text);font-weight:600;">${this.version.academic_year}</span>
        </nav>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.3px;">${this.version.academic_year}</h1>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
              ${locked ? '<span class="badge badge-danger">Đã khóa</span>' : `<span class="badge badge-warning">${this.version.status}</span>`}
              ${isRejected ? '<span class="badge badge-danger">Bị từ chối</span>' : ''}
              <span style="color:var(--text-muted);font-size:12px;">Hoàn thành ${this.version.completion_pct || 0}%</span>
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            <button class="btn btn-secondary btn-sm" onclick="window.VersionEditorPage.exportVersion()">Xuất JSON</button>
            ${(isDraft && !locked && window.App.hasPerm('programs.submit')) ? '<button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.submitVersion()">Nộp duyệt</button>' : ''}
          </div>
        </div>
      </div>
      ${isRejected ? `
        <div style="background:rgba(227, 179, 65, 0.12);border:1px solid #e3a008;border-radius:var(--radius-lg);padding:16px;margin-bottom:24px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span class="badge badge-warning" style="padding:4px 8px;font-weight:600;">Bị từ chối</span>
            <div style="font-size:13px;color:#92600a;font-weight:500;">Yêu cầu chỉnh sửa từ người phê duyệt</div>
          </div>
          <button class="btn btn-sm" style="background:#e3a008;color:#fff;border:none;" onclick="window.VersionEditorPage.showRejectionReason()">Lý do từ chối</button>
        </div>
        <div id="rejection-panel" style="display:none;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:24px;">
          <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;">Lý do chi tiết:</h4>
          <div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">${rejectionReason || 'Chưa có lý do cụ thể.'}</div>
        </div>
      ` : ''}
      <div class="tab-bar" id="editor-tabs">
        ${this.visibleTabs.map((t, i) => `<div class="tab-item ${i === 0 ? 'active' : ''}" data-index="${i}">${t.label}</div>`).join('')}
      </div>
      <div id="tab-content"><div class="spinner"></div></div>
    `;

    document.querySelectorAll('#editor-tabs .tab-item').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('#editor-tabs .tab-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        this.activeTab = parseInt(el.dataset.index);
        this.renderTab();
      });
    });
    this.activeTab = 0;
    this.renderTab();
  },

  async renderTab() {
    const body = document.getElementById('tab-content');
    body.innerHTML = '<div class="spinner"></div>';
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
        case 'info': await this.renderInfoTab(body, false); break;
        case 'po': await this.renderPOTab(body, tabEditable); break;
        case 'plo': await this.renderPLOTab(body, tabEditable); break;
        case 'pi': await this.renderPITab(body, tabEditable); break;
        case 'po_plo': await this.renderPOPLOMatrix(body, tabEditable); break;
        case 'knowledge_blocks': await this.renderKnowledgeBlocksTab(body, tabEditable); break;
        case 'courses': await this.renderCoursesTab(body, tabEditable); break;
        case 'descriptions': await this.renderDescriptionsTab(body, tabEditable); break;
        case 'plan': await this.renderPlanTab(body, tabEditable); break;
        case 'course_plo': await this.renderCoursePLOMatrix(body, tabEditable); break;
        case 'course_pi': await this.renderCoursePIMatrix(body, tabEditable); break;
        case 'assessment': await this.renderAssessmentTab(body, tabEditable); break;
        case 'syllabi': await this.renderSyllabiTab(body, tabEditable); break;
      }
    } catch (e) {
      body.innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`;
    }
  },

  // ===== TAB 1: Info =====
  async renderInfoTab(body, editable) {
    const v = this.version;
    const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const dis = editable ? '' : 'disabled';
    const textField = (label, key, val) => `
      <div class="input-group"><label>${label}</label>
        <textarea id="info-${key}" rows="3" style="resize:vertical;" ${dis}>${esc(val)}</textarea>
      </div>`;
    body.innerHTML = `
      <div style="max-width:640px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Thông tin ngành</h3>
        <div class="input-group"><label>Tên ngành</label><input type="text" value="${esc(v.program_name)}" disabled></div>
        <div class="input-group"><label>Mã ngành</label><input type="text" value="${esc(v.program_code)}" disabled></div>
        <div class="input-group"><label>Bậc đào tạo</label><input type="text" value="${esc(v.degree)}" disabled></div>
        <div class="input-group"><label>Tên văn bằng</label><input type="text" value="${esc(v.degree_name)}" disabled></div>
        <div class="input-group"><label>Tổng tín chỉ</label><input type="text" value="${esc(v.total_credits)}" disabled></div>
        <div class="input-group"><label>Hình thức đào tạo</label><input type="text" value="${esc(v.training_mode)}" disabled></div>
        <div class="input-group"><label>Trường cấp bằng</label><input type="text" value="${esc(v.institution)}" disabled></div>
        <div class="input-group"><label>Khoa/Viện</label><input type="text" value="${esc(v.dept_name)}" disabled></div>
        <div class="input-group"><label>Năm học</label><input type="text" value="${esc(v.academic_year)}" disabled></div>
        <div class="input-group"><label>Trạng thái</label><input type="text" value="${esc(v.status)}" disabled></div>

        <h3 style="font-size:15px;font-weight:600;margin:24px 0 16px;">Thông tin phiên bản</h3>
        <div class="input-group"><label>Thời gian đào tạo</label><input type="text" id="info-training_duration" value="${esc(v.training_duration)}" ${dis}></div>
        <div class="input-group"><label>Thang điểm</label><input type="text" id="info-grading_scale" value="${esc(v.grading_scale)}" ${dis}></div>
        ${textField('Điều kiện tốt nghiệp', 'graduation_requirements', v.graduation_requirements)}
        ${textField('Đối tượng tuyển sinh', 'admission_targets', v.admission_targets)}
        ${textField('Tiêu chí tuyển sinh', 'admission_criteria', v.admission_criteria)}
        ${textField('Vị trí việc làm', 'job_positions', v.job_positions)}
        ${textField('Học tập nâng cao', 'further_education', v.further_education)}
        ${textField('CT tham khảo', 'reference_programs', v.reference_programs)}
        ${textField('Quy trình đào tạo', 'training_process', v.training_process)}
        ${textField('Mục tiêu chung', 'general_objective', v.general_objective)}

        ${editable ? `<div style="display:flex;justify-content:flex-end;margin-top:16px;">
          <button class="btn btn-primary btn-sm" id="save-info-btn">Lưu thông tin</button>
        </div>` : ''}
      </div>
    `;
    if (editable) {
      document.getElementById('save-info-btn')?.addEventListener('click', () => this.saveInfo());
    }
  },

  async saveInfo() {
    const get = id => document.getElementById(id)?.value?.trim() || null;
    const data = {
      training_duration: get('info-training_duration'),
      grading_scale: get('info-grading_scale'),
      graduation_requirements: get('info-graduation_requirements'),
      admission_targets: get('info-admission_targets'),
      admission_criteria: get('info-admission_criteria'),
      job_positions: get('info-job_positions'),
      further_education: get('info-further_education'),
      reference_programs: get('info-reference_programs'),
      training_process: get('info-training_process'),
      general_objective: get('info-general_objective'),
    };
    try {
      const res = await fetch(`/api/versions/${this.versionId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi lưu');
      window.toast?.success('Đã lưu thông tin phiên bản');
      // refresh version data
      const vRes = await fetch(`/api/versions/${this.versionId}`);
      if (vRes.ok) this.version = await vRes.json();
    } catch (e) { window.toast?.error(e.message); }
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
    const confirmed = await window.ui.confirm({
      title: 'Xóa mục tiêu PO',
      message: 'Bạn có chắc muốn xóa mục tiêu này?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
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
    const confirmed = await window.ui.confirm({
      title: 'Xóa PLO',
      message: 'Bạn có chắc muốn xóa PLO này?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
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
        <div style="margin-bottom:20px;" id="pi-plo-section-${plo.id}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="color:var(--primary);">${plo.code}: ${(plo.description || '').substring(0, 60)}...</strong>
            ${editable ? `<button class="btn btn-secondary btn-sm" onclick="window.VersionEditorPage.addPI(${plo.id},'${plo.code}',${(plo.pis || []).length})">+ PI</button>` : ''}
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
                  <button class="btn btn-secondary btn-sm" onclick='window.VersionEditorPage.editPI(${pi.id},${plo.id},"${pi.pi_code}",\`${(pi.description || '').replace(/`/g, "'")}\`, ${JSON.stringify(pi.course_ids || [])})'>Sửa</button>
                  <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.VersionEditorPage.deletePI(${pi.id})">Xóa</button>
                </div>` : ''}
              </div>
            `}).join('')}</div>
          `}
          <div id="pi-form-slot-${plo.id}"></div>
        </div>
      `).join('')}
      <div id="pi-form-area" style="display:none;margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
        <input type="hidden" id="pi-edit-id"><input type="hidden" id="pi-plo-id">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;gap:10px;align-items:end;">
            <div class="input-group" style="width:120px;margin:0;"><label>Mã PI</label><input type="text" id="pi-code" placeholder="PI.1.1"></div>
            <div class="input-group" style="flex:1;margin:0;"><label>Mô tả</label><input type="text" id="pi-desc" placeholder="Mô tả chỉ số"></div>
            <button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.savePI()">Lưu</button>
            <button class="btn btn-secondary btn-sm" onclick="window.VersionEditorPage.hidePIForm()">Hủy</button>
          </div>
          <div id="pi-courses-area" style="margin-top:8px;"></div>
        </div>
      </div>
    `;
  },

  movePIFormToPLO(ploId) {
    const form = document.getElementById('pi-form-area');
    const slot = document.getElementById(`pi-form-slot-${ploId}`);
    if (!form || !slot) return;
    slot.appendChild(form);
  },

  hidePIForm() {
    const form = document.getElementById('pi-form-area');
    if (!form) return;
    form.style.display = 'none';
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

  addPI(ploId, ploCode, count) {
    this.movePIFormToPLO(ploId);
    document.getElementById('pi-edit-id').value = '';
    document.getElementById('pi-plo-id').value = ploId;
    document.getElementById('pi-code').value = `PI.${ploCode.replace('PLO', '')}.${count + 1}`;
    document.getElementById('pi-desc').value = '';
    this.renderPICoursesForm(ploId, []);
    document.getElementById('pi-form-area').style.display = 'block';
  },

  editPI(id, ploId, code, desc, courseIdsArr) {
    this.movePIFormToPLO(ploId);
    document.getElementById('pi-edit-id').value = id;
    document.getElementById('pi-plo-id').value = ploId;
    document.getElementById('pi-code').value = code;
    document.getElementById('pi-desc').value = desc;
    this.renderPICoursesForm(ploId, courseIdsArr || []);
    document.getElementById('pi-form-area').style.display = 'block';
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
    const confirmed = await window.ui.confirm({
      title: 'Xóa PI',
      message: 'Bạn có chắc muốn xóa PI này?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
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
      <div style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr><th>Mã</th><th>Tên HP</th><th style="text-align:center;">TC</th><th style="text-align:center;font-size:11px;" title="Lý thuyết">LT</th><th style="text-align:center;font-size:11px;" title="Thực hành">TH</th><th style="text-align:center;font-size:11px;" title="Đồ án">ĐA</th><th style="text-align:center;font-size:11px;" title="Thực tập">TT</th><th>HK</th><th>Loại</th>${editable ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${vCourses.length === 0 ? `<tr><td colspan="${!editable ? 9 : 10}" style="color:var(--text-muted);text-align:center;">Chưa gán HP</td></tr>` : vCourses.map(c => `
            <tr>
              <td><strong>${c.course_code}</strong></td>
              <td>${c.course_name}${c.elective_group ? ` <span style="color:var(--text-muted);font-size:11px;">(${c.elective_group})</span>` : ''}</td>
              <td style="text-align:center;">${c.credits}</td>
              <td style="text-align:center;color:var(--text-muted);">${c.credits_theory || '—'}</td>
              <td style="text-align:center;color:var(--text-muted);">${c.credits_practice || '—'}</td>
              <td style="text-align:center;color:var(--text-muted);">${c.credits_project || '—'}</td>
              <td style="text-align:center;color:var(--text-muted);">${c.credits_internship || '—'}</td>
              <td><span class="badge badge-info">HK ${c.semester}</span></td>
              <td><span class="badge ${c.course_type === 'required' ? 'badge-success' : 'badge-warning'}">${c.course_type === 'required' ? 'Bắt buộc' : 'Tự chọn'}</span></td>
              ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.VersionEditorPage.removeCourse(${c.id})">Xóa</button></td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
      </div>
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
    const confirmed = await window.ui.confirm({
      title: 'Gỡ học phần khỏi CTĐT',
      message: 'Bạn có chắc muốn gỡ học phần này khỏi chương trình đào tạo?',
      confirmText: 'Gỡ học phần',
      cancelText: 'Hủy',
      tone: 'warning'
    });
    if (!confirmed) return;
    await fetch(`/api/version-courses/${vcId}`, { method: 'DELETE' });
    window.toast.success('Đã gỡ');
    this.renderTab();
  },

  // ===== TAB 7: Teaching Plan =====
  async renderPlanTab(body, editable) {
    const [vCourses, teachingPlan] = await Promise.all([
      fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/teaching-plan`).then(r => r.json()).catch(() => [])
    ]);
    const hasTeachingPlan = teachingPlan.length > 0;

    // Build teaching plan lookup by version_course_id
    const tpMap = {};
    teachingPlan.forEach(tp => { tpMap[tp.version_course_id] = tp; });

    // Merge: use vCourses as base, enrich with teaching plan data
    const allItems = vCourses.map(vc => {
      const tp = tpMap[vc.id] || {};
      return {
        version_course_id: vc.id,
        course_code: vc.course_code,
        course_name: vc.course_name,
        credits: vc.credits,
        semester: vc.semester || 0,
        hours_theory: tp.hours_theory || 0,
        hours_practice: tp.hours_practice || 0,
        hours_project: tp.hours_project || 0,
        hours_internship: tp.hours_internship || 0,
        software: tp.software || '',
        managing_dept: tp.managing_dept || '',
        batch: tp.batch || '',
      };
    });

    const semesters = {};
    allItems.forEach(c => {
      const sem = c.semester || 0;
      if (!semesters[sem]) semesters[sem] = [];
      semesters[sem].push(c);
    });
    const semKeys = Object.keys(semesters).sort((a, b) => a - b);
    const maxSem = Math.max(8, ...semKeys.map(Number));

    const renderRow = (c, isEdit) => {
      const editStyle = 'outline:1px dashed var(--border);padding:2px 4px;border-radius:3px;min-width:30px;';
      const val = (v) => isEdit ? (v || '') : (v || '—');
      return `
        <tr data-vc-id="${c.version_course_id}">
          <td><strong>${c.course_code}</strong></td>
          <td>${c.course_name}</td>
          <td style="text-align:center;">${c.credits || ''}</td>
          <td style="text-align:center;color:var(--text-muted);" ${isEdit ? `contenteditable="true" style="text-align:center;${editStyle}"` : ''} data-field="hours_theory">${val(c.hours_theory)}</td>
          <td style="text-align:center;color:var(--text-muted);" ${isEdit ? `contenteditable="true" style="text-align:center;${editStyle}"` : ''} data-field="hours_practice">${val(c.hours_practice)}</td>
          <td style="text-align:center;color:var(--text-muted);" ${isEdit ? `contenteditable="true" style="text-align:center;${editStyle}"` : ''} data-field="hours_project">${val(c.hours_project)}</td>
          <td style="text-align:center;color:var(--text-muted);" ${isEdit ? `contenteditable="true" style="text-align:center;${editStyle}"` : ''} data-field="hours_internship">${val(c.hours_internship)}</td>
          <td style="font-size:12px;color:var(--text-muted);" ${isEdit ? `contenteditable="true" style="font-size:12px;${editStyle}"` : ''} data-field="software">${c.software || ''}</td>
          <td style="font-size:12px;color:var(--text-muted);">${c.managing_dept || ''}</td>
          <td style="text-align:center;">${isEdit ? `<select data-field="batch" style="font-size:12px;padding:2px;border:1px solid var(--border);border-radius:3px;">
            <option value="" ${!c.batch ? 'selected' : ''}>—</option>
            <option value="A" ${c.batch === 'A' ? 'selected' : ''}>A</option>
            <option value="B" ${c.batch === 'B' ? 'selected' : ''}>B</option>
          </select>` : (c.batch || '')}</td>
          ${isEdit ? `<td style="text-align:center;"><select data-field="semester" style="font-size:12px;padding:2px;border:1px solid var(--border);border-radius:3px;">
            ${Array.from({length: maxSem}, (_, i) => i + 1).map(s => `<option value="${s}" ${s === c.semester ? 'selected' : ''}>HK ${s}</option>`).join('')}
          </select></td>` : ''}
        </tr>
      `;
    };

    const renderTable = (items, isEdit) => `
      <div style="overflow-x:auto;">
      <table class="data-table">
        <thead><tr>
          <th>Mã HP</th><th>Tên HP</th><th style="text-align:center;">TC</th>
          <th style="text-align:center;font-size:11px;">Tiết LT</th><th style="text-align:center;font-size:11px;">Tiết TH</th>
          <th style="text-align:center;font-size:11px;">Tiết ĐA</th><th style="text-align:center;font-size:11px;">Tiết TT</th>
          <th>Phần mềm</th><th>Đơn vị QL</th><th>Đợt</th>
          ${isEdit ? '<th style="font-size:11px;">Học kỳ</th>' : ''}
        </tr></thead>
        <tbody>${items.map(c => renderRow(c, isEdit)).join('')}</tbody>
      </table>
      </div>
    `;

    const renderContent = (isEdit) => {
      if (semKeys.length === 0) return '<p style="color:var(--text-muted);font-size:13px;">Hãy gán HP vào CTĐT trước.</p>';
      // Both modes: grouped by semester
      return semKeys.map(sem => {
        const items = semesters[sem];
        const totalCredits = items.reduce((s, c) => s + (c.credits || 0), 0);
        return `
        <div style="margin-bottom:24px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <strong style="font-size:14px;">Học kỳ ${sem}</strong>
            <span style="color:var(--text-muted);font-size:12px;">${totalCredits} TC</span>
          </div>
          ${renderTable(items, isEdit)}
        </div>`;
      }).join('');
    };

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Kế hoạch giảng dạy</h3>
        ${editable ? `<div id="tp-edit-actions">
          <button id="tp-edit-btn" class="btn btn-secondary" style="font-size:12px;">Chỉnh sửa</button>
        </div>` : ''}
      </div>
      <div id="tp-content">${renderContent(false)}</div>
    `;

    if (!editable) return;

    // Wire edit button
    const editBtn = body.querySelector('#tp-edit-btn');
    const actionsDiv = body.querySelector('#tp-edit-actions');
    const contentDiv = body.querySelector('#tp-content');

    editBtn.addEventListener('click', () => {
      // Switch to edit mode
      actionsDiv.innerHTML = `
        <div style="display:flex;gap:8px;">
          <button id="tp-cancel-btn" class="btn btn-secondary" style="font-size:12px;">Hủy</button>
          <button id="tp-save-btn" class="btn btn-primary" style="font-size:12px;">Lưu</button>
        </div>
      `;
      contentDiv.innerHTML = renderContent(true);

      // Cancel
      actionsDiv.querySelector('#tp-cancel-btn').addEventListener('click', () => {
        this.renderTab();
      });

      // Save
      actionsDiv.querySelector('#tp-save-btn').addEventListener('click', async () => {
        const rows = contentDiv.querySelectorAll('tr[data-vc-id]');
        const items = [];
        rows.forEach(row => {
          const vcId = parseInt(row.dataset.vcId);
          const getVal = (field) => {
            const el = row.querySelector(`[data-field="${field}"]`);
            if (!el) return null;
            if (el.tagName === 'SELECT') return el.value;
            return el.innerText.trim();
          };
          items.push({
            version_course_id: vcId,
            semester: parseInt(getVal('semester')) || null,
            hours_theory: parseInt(getVal('hours_theory')) || 0,
            hours_practice: parseInt(getVal('hours_practice')) || 0,
            hours_project: parseInt(getVal('hours_project')) || 0,
            hours_internship: parseInt(getVal('hours_internship')) || 0,
            software: getVal('software') || '',
            batch: getVal('batch') || '',
          });
        });

        try {
          const res = await fetch(`/api/versions/${this.versionId}/teaching-plan/bulk`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ items })
          });
          if (res.ok) {
            this.renderTab();
          } else {
            const err = await res.json();
            window.ui.alert({
              title: 'Không thể lưu kế hoạch giảng dạy',
              message: err.error || 'Đã xảy ra lỗi khi lưu kế hoạch giảng dạy.',
              tone: 'danger'
            });
          }
        } catch (e) {
          window.ui.alert({
            title: 'Không thể lưu kế hoạch giảng dạy',
            message: 'Lỗi: ' + e.message,
            tone: 'danger'
          });
        }
      });
    });
  },

  // ===== Knowledge Blocks Tab =====
  async renderKnowledgeBlocksTab(body, editable) {
    const data = await fetch(`/api/versions/${this.versionId}/knowledge-blocks`).then(r => r.json()).catch(() => ({ blocks: [], unassigned: [] }));
    const blocks = data.blocks || [];
    const unassigned = data.unassigned || [];

    // If no blocks exist and version is editable, show button to create defaults
    if (blocks.length === 0) {
      body.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:40px 0;">
          <p style="color:var(--text-muted);font-size:13px;">Chưa có cấu trúc khối kiến thức.</p>
          ${editable ? `<button id="kb-seed-defaults" class="btn btn-primary">Tạo cấu trúc mặc định</button>` : ''}
        </div>
      `;
      if (editable) {
        body.querySelector('#kb-seed-defaults')?.addEventListener('click', async () => {
          try {
            const post = async (data) => {
              const res = await fetch(`/api/versions/${this.versionId}/knowledge-blocks`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
              });
              const json = await res.json();
              if (!res.ok) throw new Error(json.error || 'Lỗi tạo khối');
              return json;
            };
            await post({ name: 'Kiến thức giáo dục đại cương' });
            const gdcn = await post({ name: 'Kiến thức giáo dục chuyên nghiệp' });
            await post({ name: 'Kiến thức bắt buộc', parent_id: gdcn.id });
            await post({ name: 'Kiến thức tự chọn', parent_id: gdcn.id });
            await post({ name: 'Kiến thức không tích lũy' });
            this.renderTab();
          } catch (e) {
            window.ui.alert({
              title: 'Không thể tạo cấu trúc mặc định',
              message: 'Lỗi: ' + e.message,
              tone: 'danger'
            });
          }
        });
      }
      return;
    }

    // Build tree structure
    const roots = blocks.filter(b => !b.parent_id);
    const getChildren = (parentId) => blocks.filter(b => b.parent_id === parentId);

    const renderCourseList = (courses) => {
      if (!courses || courses.length === 0) return '<div class="kb-empty">Chưa có học phần</div>';
      return courses.map(c => `
        <div class="kb-course-item">
          <span class="kb-course-code">${c.course_code}</span>
          <span class="kb-course-name">${c.course_name}</span>
          <span class="kb-course-credits">${c.credits} TC</span>
        </div>
      `).join('');
    };

    const renderBlock = (block, depth) => {
      const children = getChildren(block.id);
      const isLeaf = children.length === 0;
      const canAddChild = block.level === 2 && editable;
      const canDelete = block.level === 3 && editable;
      const canAssign = isLeaf && editable;
      const hasContent = isLeaf ? (block.courses || []).length > 0 : children.length > 0;
      const shouldOpen = depth === 0;

      return `
        <details class="kb-accordion" data-block-id="${block.id}" data-level="${block.level}" data-depth="${depth}" ${shouldOpen ? 'open' : ''}>
          <summary class="kb-summary">
            <div class="kb-summary-main">
              <span class="kb-chevron">${hasContent ? '' : ''}</span>
              <div class="kb-title-group">
                <span class="kb-title">${block.name}</span>
                <span class="kb-meta">${block.auto_total_credits || 0} TC</span>
              </div>
            </div>
            <div class="kb-actions">
              ${editable ? `<button class="btn btn-secondary btn-sm kb-action-btn kb-edit-btn" data-block-id="${block.id}" data-block-name="${block.name}" type="button">Sửa</button>` : ''}
              ${canAddChild ? `<button class="btn btn-secondary btn-sm kb-action-btn kb-add-child-btn" data-parent-id="${block.id}" type="button">Thêm nhóm</button>` : ''}
              ${canAssign ? `<button class="btn btn-secondary btn-sm kb-action-btn kb-assign-btn" data-block-id="${block.id}" type="button">Gán học phần</button>` : ''}
              ${canDelete ? `<button class="btn btn-secondary btn-sm kb-action-btn kb-delete-btn" data-block-id="${block.id}" type="button">Xóa</button>` : ''}
            </div>
          </summary>
          <div class="kb-content">
            ${isLeaf ? `<div class="kb-course-list">${renderCourseList(block.courses)}</div>` : `<div class="kb-children">${children.map(child => renderBlock(child, depth + 1)).join('')}</div>`}
          </div>
        </details>
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

  _wireKnowledgeBlockEvents(body, blocks, data) {
    const allCourses = [...(data.unassigned || [])];
    for (const b of blocks) {
      if (b.courses) allCourses.push(...b.courses.map(c => ({ ...c, block_name: b.name })));
    }

    body.querySelectorAll('.kb-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    // Edit block name
    body.querySelectorAll('.kb-edit-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const blockId = btn.dataset.blockId;
        const oldName = btn.dataset.blockName;
        const newName = await window.ui.prompt({
          title: 'Đổi tên khối kiến thức',
          eyebrow: 'Cập nhật cấu trúc CTĐT',
          message: 'Nhập tên mới cho khối kiến thức.',
          inputValue: oldName,
          placeholder: 'Tên khối kiến thức',
          confirmText: 'Lưu',
          cancelText: 'Hủy',
          required: true,
          requiredMessage: 'Vui lòng nhập tên khối kiến thức.'
        });
        if (!newName || newName.trim() === oldName) return;
        const res = await fetch(`/api/knowledge-blocks/${blockId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim() })
        });
        if (res.ok) this.renderTab(this.activeTab);
        else window.ui.alert({
          title: 'Không thể cập nhật khối',
          message: (await res.json()).error || 'Lỗi cập nhật',
          tone: 'danger'
        });
      });
    });

    // Add child block
    body.querySelectorAll('.kb-add-child-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const parentId = btn.dataset.parentId;
        const name = await window.ui.prompt({
          title: 'Tạo nhóm con',
          eyebrow: 'Cấu trúc khối kiến thức',
          message: 'Nhập tên nhóm con mới.',
          placeholder: 'Tên nhóm con',
          confirmText: 'Tạo nhóm',
          cancelText: 'Hủy',
          required: true,
          requiredMessage: 'Vui lòng nhập tên nhóm con.'
        });
        if (!name || !name.trim()) return;
        const res = await fetch(`/api/versions/${this.versionId}/knowledge-blocks`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), parent_id: parseInt(parentId) })
        });
        if (res.ok) this.renderTab(this.activeTab);
        else window.ui.alert({
          title: 'Không thể tạo khối',
          message: (await res.json()).error || 'Lỗi tạo khối',
          tone: 'danger'
        });
      });
    });

    // Delete block
    body.querySelectorAll('.kb-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const blockId = btn.dataset.blockId;
        const confirmed = await window.ui.confirm({
          title: 'Xóa nhóm kiến thức',
          eyebrow: 'Xác nhận thao tác',
          message: 'Bạn có chắc muốn xóa nhóm này?\n\nCác học phần đang gán trong nhóm sẽ bị gỡ khỏi nhóm.',
          confirmText: 'Xóa nhóm',
          cancelText: 'Hủy',
          tone: 'danger',
          confirmVariant: 'danger'
        });
        if (!confirmed) return;
        const res = await fetch(`/api/knowledge-blocks/${blockId}`, { method: 'DELETE' });
        if (res.ok) this.renderTab(this.activeTab);
        else window.ui.alert({
          title: 'Không thể xóa khối',
          message: (await res.json()).error || 'Lỗi xóa',
          tone: 'danger'
        });
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
              const inOtherBlock = !isAssigned && c.block_name;
              return `
                <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;cursor:pointer;opacity:${inOtherBlock ? '0.8' : '1'};" class="kb-course-item">
                  <input type="checkbox" value="${c.id}" ${isAssigned ? 'checked' : ''}>
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
          const selected = [...modal.querySelectorAll('#kb-course-list input[type="checkbox"]:checked')]
            .map(cb => parseInt(cb.value));
          const res = await fetch(`/api/knowledge-blocks/${blockId}/assign-courses`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ courseIds: selected })
          });
          overlay.remove();
          if (res.ok) this.renderTab(this.activeTab);
          else window.ui.alert({
            title: 'Không thể gán học phần',
            message: (await res.json()).error || 'Lỗi gán HP',
            tone: 'danger'
          });
        });
      });
    });
  },

  // ===== Course Descriptions Tab =====
  async renderDescriptionsTab(body, editable) {
    const vCourses = await fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json());
    const coursesWithDesc = vCourses.filter(c => c.course_desc);
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Mô tả tóm tắt học phần</h3>
        <span style="color:var(--text-muted);font-size:13px;">${coursesWithDesc.length}/${vCourses.length} HP có mô tả</span>
      </div>
      ${vCourses.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Hãy gán HP vào CTĐT trước.</p>' : `
        <table class="data-table">
          <thead><tr><th style="width:80px;">Mã HP</th><th style="width:200px;">Tên HP</th><th>Mô tả</th></tr></thead>
          <tbody>
            ${vCourses.map(c => `
              <tr>
                <td><strong style="color:var(--primary);">${c.course_code}</strong></td>
                <td>${c.course_name}</td>
                <td style="font-size:13px;color:${c.course_desc ? 'var(--text)' : 'var(--text-muted)'};">${c.course_desc || '—'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    `;
  },

  // ===== Course-PLO Matrix Tab =====
  async renderCoursePLOMatrix(body, editable) {
    const [vCourses, plos, ploMaps] = await Promise.all([
      fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/plos`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/course-plo-map`).then(r => r.json())
    ]);
    if (!vCourses.length || !plos.length) {
      body.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Hãy thêm PLO và Học phần trước.</p>';
      return;
    }
    const ploMapObj = {};
    ploMaps.forEach(m => { ploMapObj[`${m.course_id}-${m.plo_id}`] = m.contribution_level; });

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Ma trận HP ↔ PLO</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" id="save-c-plo-btn">Lưu ma trận</button>' : ''}
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px;">— = Không áp dụng · 1 = Thấp · 2 = TB · 3 = Cao</p>
      <div style="overflow-x:auto;padding-bottom:16px;">
        <table class="data-table" id="c-plo-table" style="border-collapse:collapse;white-space:nowrap;">
          <thead>
            <tr>
              <th style="position:sticky;left:0;z-index:10;min-width:70px;background:#f8f9fa;box-shadow:inset -1px 0 0 var(--border);">Mã HP</th>
              <th style="min-width:160px;background:#f8f9fa;">Tên HP</th>
              ${plos.map(p => `<th style="text-align:center;min-width:55px;font-size:12px;">${p.code}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${vCourses.map(c => `<tr>
              <td style="position:sticky;left:0;z-index:5;font-size:12px;background:#ffffff;box-shadow:inset -1px 0 0 var(--border);" title="${c.course_name}"><strong>${c.course_code}</strong></td>
              <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;">${c.course_name}</td>
              ${plos.map(p => {
                const val = ploMapObj[`${c.id}-${p.id}`] || 0;
                return `<td style="text-align:center;">
                  <select class="plo-select" data-vc="${c.id}" data-plo="${p.id}"
                          style="width:38px;padding:1px;font-size:11px;border:1px solid var(--border);border-radius:var(--radius);font-family:inherit;
                                 ${!editable ? 'background:var(--bg-secondary);opacity:0.5;cursor:not-allowed;' : 'cursor:pointer;'}"
                          ${!editable ? 'disabled' : ''}>
                    <option value="0" ${val === 0 ? 'selected' : ''}>—</option>
                    <option value="1" ${val === 1 ? 'selected' : ''}>1</option>
                    <option value="2" ${val === 2 ? 'selected' : ''}>2</option>
                    <option value="3" ${val === 3 ? 'selected' : ''}>3</option>
                  </select>
                </td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('save-c-plo-btn')?.addEventListener('click', async () => {
      const btn = document.getElementById('save-c-plo-btn');
      btn.textContent = 'Đang lưu...'; btn.disabled = true;
      const ploSelects = document.querySelectorAll('#c-plo-table select.plo-select');
      const mappings = [];
      ploSelects.forEach(s => {
        const val = parseInt(s.value);
        if (val > 0) {
          mappings.push({ course_id: parseInt(s.dataset.vc), plo_id: parseInt(s.dataset.plo), contribution_level: val });
        }
      });
      try {
        const res = await fetch(`/api/versions/${this.versionId}/course-plo-map`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        window.toast.success(`Đã lưu ${mappings.length} liên kết HP ↔ PLO`);
      } catch (e) { window.toast.error(e.message); }
      btn.textContent = 'Lưu ma trận'; btn.disabled = false;
    });
  },

  // ===== Course-PI Matrix Tab =====
  async renderCoursePIMatrix(body, editable) {
    const [vCourses, plos, ploMaps, piMaps] = await Promise.all([
      fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/plos`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/course-plo-map`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/course-pi-map`).then(r => r.json())
    ]);
    const hasPIs = plos.some(p => p.pis && p.pis.length > 0);
    if (!vCourses.length || !plos.length || !hasPIs) {
      body.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Hãy thêm PLO, PI và Học phần trước.</p>';
      return;
    }
    const ploMapObj = {};
    ploMaps.forEach(m => { ploMapObj[`${m.course_id}-${m.plo_id}`] = m.contribution_level; });
    const piMapObj = {};
    piMaps.forEach(m => { piMapObj[`${m.course_id}-${m.pi_id}`] = m; });

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Ma trận HP ↔ PI</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" id="save-c-pi-btn">Lưu ma trận</button>' : ''}
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px;">Chỉ các ô có HP ↔ PLO đã map (≥1) mới được chỉnh sửa.</p>
      <div style="overflow-x:auto;padding-bottom:16px;">
        <table class="data-table" id="c-pi-table" style="border-collapse:collapse;white-space:nowrap;">
          <thead>
            <tr>
              <th rowspan="2" style="position:sticky;left:0;z-index:10;min-width:70px;background:#f8f9fa;box-shadow:inset -1px 0 0 var(--border);">Mã HP</th>
              ${plos.map(p => {
                if (!p.pis || p.pis.length === 0) return '';
                return `<th colspan="${p.pis.length}" style="text-align:center;font-size:12px;border-bottom:1px solid var(--border);border-left:2px solid var(--border);background:#f1f3f5;">${p.code}</th>`;
              }).join('')}
            </tr>
            <tr>
              ${plos.map(p => {
                if (!p.pis || p.pis.length === 0) return '';
                return p.pis.map(pi => `<th style="text-align:center;font-size:11px;min-width:28px;padding:4px;color:var(--primary);background:#f8f9fa;" title="${pi.pi_code}: ${pi.description || ''}">${pi.pi_code}</th>`).join('');
              }).join('')}
            </tr>
          </thead>
          <tbody>
            ${vCourses.map(c => `<tr>
              <td style="position:sticky;left:0;z-index:5;font-size:12px;background:#ffffff;box-shadow:inset -1px 0 0 var(--border), inset 0 -1px 0 var(--border);" title="${c.course_name}"><strong>${c.course_code}</strong></td>
              ${plos.map(p => {
                if (!p.pis || p.pis.length === 0) return '';
                const ploVal = ploMapObj[`${c.id}-${p.id}`] || 0;
                const isPloMapped = ploVal > 0;
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
      const btn = document.getElementById('save-c-pi-btn');
      btn.textContent = 'Đang lưu...'; btn.disabled = true;
      const piSelects = document.querySelectorAll('#c-pi-table select.pi-select');
      const pi_mappings = [];
      piSelects.forEach(s => {
        if (!s.disabled) {
          pi_mappings.push({ course_id: parseInt(s.dataset.vc), pi_id: parseInt(s.dataset.pi), contribution_level: parseInt(s.value) });
        }
      });
      try {
        const res = await fetch(`/api/versions/${this.versionId}/course-pi-map`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pi_mappings })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        window.toast.success(`Đã lưu ma trận PI`);
      } catch (e) { window.toast.error(e.message); }
      btn.textContent = 'Lưu ma trận'; btn.disabled = false;
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
    const confirmed = await window.ui.confirm({
      title: 'Xóa kế hoạch đánh giá',
      message: 'Bạn có chắc muốn xóa mục này?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
    await fetch(`/api/assessments/${id}`, { method: 'DELETE' });
    window.toast.success('Đã xóa');
    this.renderTab();
  },

  // ===== TAB 10: Syllabi =====
  _eligibleGV: [],
  _assignmentsMap: {},

  async renderSyllabiTab(body, editable) {
    const canAssign = window.App.hasPerm('syllabus.assign');
    const fetches = [
      fetch(`/api/versions/${this.versionId}/syllabi`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/courses`).then(r => r.json()),
      fetch(`/api/versions/${this.versionId}/assignments`).then(r => r.json()),
    ];
    if (canAssign) {
      fetches.push(fetch(`/api/assignments/eligible-gv?version_id=${this.versionId}`).then(r => r.json()));
    }
    const [syllabi, vCourses, assignments, eligibleGV] = await Promise.all(fetches);

    const syllabiMap = {};
    syllabi.forEach(s => { syllabiMap[s.course_id] = s; });
    this._assignmentsMap = {};
    assignments.forEach(a => { this._assignmentsMap[a.course_id] = a; });
    this._eligibleGV = eligibleGV || [];

    const statusLabels = { draft: 'Nháp', submitted: 'Đã nộp', approved_tbm: 'TBM ✓', approved_khoa: 'Khoa ✓', approved_pdt: 'PĐT ✓', published: 'Công bố' };

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Đề cương chi tiết</h3>
        <span style="color:var(--text-muted);font-size:13px;">${syllabi.length}/${vCourses.length} đề cương</span>
      </div>
      ${vCourses.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Hãy gán HP vào CTĐT trước.</p>' : `
        <table class="data-table">
          <thead><tr><th>Mã</th><th>Tên HP</th><th>TC</th><th>GV phân công</th>${canAssign ? '<th>Hạn nộp</th>' : ''}<th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            ${vCourses.map(c => {
      const syl = syllabiMap[c.course_id];
      const assign = this._assignmentsMap[c.course_id];
      const sylStatus = syl ? statusLabels[syl.status] : null;
      const isDraft = !syl || syl.status === 'draft';
      const deadlineStr = assign && assign.deadline ? new Date(assign.deadline).toLocaleDateString('vi-VN') : '';

      // GV column
      let gvCell = '';
      let deadlineCell = '';
      let actionCell = '';

      if (assign) {
        // Already assigned
        gvCell = `<span style="font-size:13px;">${assign.assignee_name}</span>`;
        deadlineCell = `<span style="font-size:12px;color:var(--text-muted);">${deadlineStr}</span>`;

        if (syl) {
          actionCell = `<button class="btn btn-secondary btn-sm" onclick="window.App.navigate('syllabus-editor',{syllabusId:${syl.id}})">${(editable && syl.status === 'draft') ? 'Soạn' : 'Xem'}</button>`;
        }
        // Allow reassign only when draft and has assign perm
        if (canAssign && isDraft) {
          actionCell += ` <button class="btn btn-secondary btn-sm" onclick="window.VersionEditorPage.showReassignModal(${c.course_id})" title="Đổi GV">Đổi GV</button>`;
        }
      } else if (canAssign) {
        // Not assigned — show dropdown
        gvCell = `<select id="assign-gv-${c.course_id}" class="assign-inline-control assign-inline-select">
          <option value="">-- Chọn GV --</option>
          ${this._eligibleGV.map(g => `<option value="${g.id}">${g.display_name} (${g.dept_name})</option>`).join('')}
        </select>`;
        deadlineCell = `<input type="date" id="assign-dl-${c.course_id}" class="assign-inline-control assign-inline-date">`;
        actionCell = `<button class="btn btn-primary btn-sm" onclick="window.VersionEditorPage.assignSyllabus(${c.course_id})">Phân công</button>`;
      } else {
        gvCell = '<span style="color:var(--text-muted);">—</span>';
      }

      return `<tr>
                <td><strong>${c.course_code}</strong></td>
                <td>${c.course_name}</td>
                <td style="text-align:center;">${c.credits}</td>
                <td>${gvCell}</td>
                ${canAssign ? `<td>${deadlineCell}</td>` : ''}
                <td>${syl ? `<span class="badge badge-info">${sylStatus}</span>` : '<span class="badge badge-neutral">Chưa tạo</span>'}</td>
                <td style="white-space:nowrap;">${actionCell}</td>
              </tr>`;
    }).join('')}
          </tbody>
        </table>
      `}

      <!-- Reassign Modal -->
      <div class="modal-overlay" id="reassign-modal">
        <div class="modal" style="max-width:420px;">
          <div class="modal-header"><h2>Đổi giảng viên phân công</h2></div>
          <div class="modal-body">
            <input type="hidden" id="reassign-course-id">
            <div class="input-group">
              <label>Giảng viên mới</label>
              <select id="reassign-gv" style="width:100%;">
                <option value="">-- Chọn GV --</option>
                ${(this._eligibleGV || []).map(g => `<option value="${g.id}">${g.display_name} (${g.dept_name})</option>`).join('')}
              </select>
            </div>
            <div class="input-group">
              <label>Hạn nộp mới</label>
              <input type="date" id="reassign-deadline" style="width:100%;">
            </div>
            <div class="modal-error" id="reassign-error"></div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('reassign-modal').classList.remove('active')">Hủy</button>
              <button class="btn btn-primary" onclick="window.VersionEditorPage.confirmReassign()">Đổi GV</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  async assignSyllabus(courseId) {
    const gvSelect = document.getElementById(`assign-gv-${courseId}`);
    const dlInput = document.getElementById(`assign-dl-${courseId}`);
    const assignedTo = parseInt(gvSelect?.value);
    if (!assignedTo) { window.toast.error('Vui lòng chọn giảng viên'); return; }
    try {
      const res = await fetch(`/api/versions/${this.versionId}/assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, assigned_to: assignedTo, deadline: dlInput?.value || null })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã phân công');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },

  showReassignModal(courseId) {
    const assign = this._assignmentsMap[courseId];
    document.getElementById('reassign-course-id').value = courseId;
    document.getElementById('reassign-gv').value = '';
    document.getElementById('reassign-deadline').value = assign?.deadline ? assign.deadline.split('T')[0] : '';
    document.getElementById('reassign-error').textContent = '';
    document.getElementById('reassign-modal').classList.add('active');
  },

  async confirmReassign() {
    const courseId = parseInt(document.getElementById('reassign-course-id').value);
    const assignedTo = parseInt(document.getElementById('reassign-gv').value);
    const deadline = document.getElementById('reassign-deadline').value;
    if (!assignedTo) { document.getElementById('reassign-error').textContent = 'Vui lòng chọn giảng viên'; return; }
    try {
      const res = await fetch(`/api/versions/${this.versionId}/assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId, assigned_to: assignedTo, deadline: deadline || null })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      document.getElementById('reassign-modal').classList.remove('active');
      window.toast.success('Đã đổi GV');
      this.renderTab();
    } catch (e) { document.getElementById('reassign-error').textContent = e.message; }
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
      window.App.navigate('syllabus-editor', { syllabusId: syl.id });
    } catch (e) { window.toast.error(e.message); }
  },

  async exportVersion() {
    try {
      const data = await fetch(`/api/export/version/${this.versionId}`).then(r => r.json());
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

  async submitVersion() {
    const confirmed = await window.ui.confirm({
      title: 'Nộp CTĐT',
      eyebrow: 'Xác nhận gửi phê duyệt',
      message: 'Bạn có chắc muốn nộp CTĐT này để phê duyệt?',
      confirmText: 'Nộp duyệt',
      cancelText: 'Xem lại'
    });
    if (!confirmed) return;
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
      if (btn) {
        btn.textContent = isVisible ? 'Lý do từ chối' : 'Ẩn lý do';
        if (isVisible) { btn.style.background = '#e3a008'; btn.style.color = '#fff'; }
        else { btn.style.background = ''; btn.style.color = ''; btn.className = 'btn btn-secondary btn-sm'; }
      }
    }
  },

  destroy() { }
};
