// Syllabus Editor — Notion-style
window.SyllabusEditorPage = {
  syllabusId: null,
  syllabus: null,
  routeContext: {},
  clos: [],
  plos: [],
  activeTab: 0,

  async render(container, syllabusId, params = {}) {
    this.syllabusId = syllabusId;
    this.routeContext = params || {};
    container.innerHTML = '<div class="spinner"></div>';
    try {
      this.syllabus = await fetch(`/api/syllabi/${syllabusId}`).then(r => r.json());
      if (this.syllabus.error) throw new Error(this.syllabus.error);
      const content = typeof this.syllabus.content === 'string' ? JSON.parse(this.syllabus.content) : (this.syllabus.content || {});
      this.syllabus.content = content;
    } catch (e) { container.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>${e.message}</p></div>`; return; }

    const statusLabels = { draft:'Nháp', submitted:'Đã nộp', approved_tbm:'TBM ✓', approved_khoa:'Khoa ✓', approved_pdt:'PĐT ✓', published:'Công bố' };
    const s = this.syllabus;
    const editable = s.status === 'draft';

    container.innerHTML = `
      <div style="margin-bottom:24px;">
        <div id="syllabus-breadcrumb" style="margin-bottom:8px;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div>
            <h1 style="font-size:22px;font-weight:700;letter-spacing:-0.3px;">${s.course_name}</h1>
            <div style="display:flex;gap:8px;align-items:center;margin-top:4px;">
              <span class="badge badge-info">${statusLabels[s.status] || s.status}</span>
              <span style="color:var(--text-muted);font-size:12px;">${s.credits} TC · ${s.author_name || '?'}</span>
            </div>
          </div>
          ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.submitForApproval()">Nộp duyệt</button>' : ''}
        </div>
      </div>
      <div class="tab-bar" id="syl-tabs">
        <div class="tab-item active" data-tab="0">Thông tin chung</div>
        <div class="tab-item" data-tab="1">CLO</div>
        <div class="tab-item" data-tab="2">CLO-PLO</div>
        <div class="tab-item" data-tab="3">Lịch giảng dạy</div>
        <div class="tab-item" data-tab="4">Đánh giá</div>
        <div class="tab-item" data-tab="5">Tài liệu</div>
      </div>
      <div id="syl-tab-content"><div class="spinner"></div></div>
    `;

    document.querySelectorAll('#syl-tabs .tab-item').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('#syl-tabs .tab-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        this.activeTab = parseInt(el.dataset.tab);
        this.renderSylTab();
      });
    });
    this.updateBreadcrumb();
    this.renderSylTab();
  },

  getBreadcrumbItems() {
    if (this.routeContext.programId && this.routeContext.programName) {
      return [
        { label: 'Chương trình đào tạo', page: 'programs' },
        {
          label: 'Phiên bản',
          page: 'programs',
          params: {
            programId: this.routeContext.programId,
            programName: this.routeContext.programName
          }
        },
        { label: 'Đề cương' }
      ];
    }

    if (this.routeContext.sourcePage === 'my-syllabi') {
      return [
        { label: 'Đề cương của tôi', page: 'my-syllabi' },
        { label: 'Đề cương' }
      ];
    }

    return [{ label: 'Đề cương' }];
  },

  updateBreadcrumb() {
    const breadcrumb = document.getElementById('syllabus-breadcrumb');
    if (breadcrumb) breadcrumb.innerHTML = window.App.renderBreadcrumb(this.getBreadcrumbItems());
  },

  async renderSylTab() {
    const body = document.getElementById('syl-tab-content');
    body.innerHTML = '<div class="spinner"></div>';
    this.updateBreadcrumb();
    const editable = this.syllabus.status === 'draft';
    const c = this.syllabus.content || {};
    try {
      switch (this.activeTab) {
        case 0: this.renderGeneralTab(body, editable, c); break;
        case 1: await this.renderCLOTab(body, editable); break;
        case 2: await this.renderCLOPLOTab(body, editable); break;
        case 3: this.renderScheduleTab(body, editable, c); break;
        case 4: this.renderGradingTab(body, editable, c); break;
        case 5: this.renderResourcesTab(body, editable, c); break;
      }
    } catch (e) { body.innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`; }
  },

  renderGeneralTab(body, editable, c) {
    body.innerHTML = `
      <div style="max-width:560px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Thông tin chung</h3>
        <div class="input-group"><label>Mô tả tóm tắt</label><textarea id="syl-summary" ${editable ? '' : 'disabled'} rows="3" placeholder="Mô tả tóm tắt HP">${c.summary || ''}</textarea></div>
        <div class="input-group"><label>Mục tiêu học phần</label><textarea id="syl-objectives" ${editable ? '' : 'disabled'} rows="3" placeholder="Mục tiêu khi hoàn thành HP">${c.objectives || ''}</textarea></div>
        <div class="input-group"><label>Yêu cầu tiên quyết</label><input type="text" id="syl-prereq" ${editable ? '' : 'disabled'} value="${c.prerequisites || ''}" placeholder="HP tiên quyết"></div>
        <div class="input-group"><label>Phương pháp giảng dạy</label><textarea id="syl-methods" ${editable ? '' : 'disabled'} rows="2" placeholder="Thuyết trình, thảo luận...">${c.methods || ''}</textarea></div>
        ${editable ? '<button class="btn btn-primary" onclick="window.SyllabusEditorPage.saveGeneral()">Lưu nháp</button>' : ''}
      </div>
    `;
  },

  async saveGeneral() {
    const content = { ...this.syllabus.content,
      summary: document.getElementById('syl-summary').value,
      objectives: document.getElementById('syl-objectives').value,
      prerequisites: document.getElementById('syl-prereq').value,
      methods: document.getElementById('syl-methods').value,
    };
    try {
      const res = await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Không thể lưu đề cương');
      this.syllabus.content = content;
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },

  async renderCLOTab(body, editable) {
    this.clos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json());
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Chuẩn đầu ra môn học (CLO)</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" id="add-clo-btn">+ Thêm</button>' : ''}
      </div>
      <table class="data-table">
        <thead><tr><th>Mã</th><th>Mô tả</th>${editable ? '<th style="width:100px;"></th>' : ''}</tr></thead>
        <tbody>
          ${this.clos.length === 0 ? `<tr><td colspan="${editable ? 3 : 2}" style="color:var(--text-muted);text-align:center;">Chưa có CLO</td></tr>` : this.clos.map(c => `
            <tr>
              <td><strong style="color:var(--primary);">${c.code}</strong></td>
              <td style="font-size:13px;">${c.description || ''}</td>
              ${editable ? `<td style="white-space:nowrap;">
                <button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.editCLO(${c.id},'${c.code}',\`${(c.description||'').replace(/`/g,"'")}\`)">Sửa</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.SyllabusEditorPage.deleteCLO(${c.id})">Xóa</button>
              </td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div id="clo-form-area" style="display:none;margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
        <input type="hidden" id="clo-edit-id">
        <div style="display:flex;gap:10px;align-items:end;">
          <div class="input-group" style="width:100px;margin:0;"><label>Mã</label><input type="text" id="clo-code" placeholder="CLO1"></div>
          <div class="input-group" style="flex:1;margin:0;"><label>Mô tả</label><input type="text" id="clo-desc" placeholder="Mô tả CLO"></div>
          <button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveCLO()">Lưu</button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('clo-form-area').style.display='none'">Hủy</button>
        </div>
      </div>
    `;
    document.getElementById('add-clo-btn')?.addEventListener('click', () => {
      document.getElementById('clo-edit-id').value = '';
      document.getElementById('clo-code').value = `CLO${this.clos.length + 1}`;
      document.getElementById('clo-desc').value = '';
      document.getElementById('clo-form-area').style.display = 'block';
    });
  },

  editCLO(id, code, desc) {
    document.getElementById('clo-edit-id').value = id;
    document.getElementById('clo-code').value = code;
    document.getElementById('clo-desc').value = desc;
    document.getElementById('clo-form-area').style.display = 'block';
  },

  async saveCLO() {
    const id = document.getElementById('clo-edit-id').value;
    const code = document.getElementById('clo-code').value.trim();
    const description = document.getElementById('clo-desc').value.trim();
    if (!code) { window.toast.warning('Nhập mã CLO'); return; }
    try {
      const url = id ? `/api/clos/${id}` : `/api/syllabi/${this.syllabusId}/clos`;
      const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, description }) });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success(id ? 'Đã cập nhật' : 'Đã thêm');
      this.renderSylTab();
    } catch (e) { window.toast.error(e.message); }
  },

  async deleteCLO(id) {
    if (!confirm('Xóa CLO này?')) return;
    await fetch(`/api/clos/${id}`, { method: 'DELETE' });
    window.toast.success('Đã xóa');
    this.renderSylTab();
  },

  async renderCLOPLOTab(body, editable) {
    const [clos, maps] = await Promise.all([
      fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json()),
      fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`).then(r => r.json()),
    ]);
    const plos = await fetch(`/api/versions/${this.syllabus.version_id}/plos`).then(r => r.json());
    if (!clos.length || !plos.length) {
      body.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Cần có CLO và PLO trước.</p>';
      return;
    }
    const mapObj = {};
    maps.forEach(m => { mapObj[`${m.clo_id}-${m.plo_id}`] = m.contribution_level; });
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Ma trận CLO ↔ PLO</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" id="save-clo-plo-btn">Lưu</button>' : ''}
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px;">— = Không · 1 = Thấp · 2 = TB · 3 = Cao</p>
      <div style="overflow-x:auto;">
        <table class="data-table" id="clo-plo-table">
          <thead><tr><th></th>${plos.map(p => `<th style="text-align:center;min-width:50px;font-size:11px;">${p.code}</th>`).join('')}</tr></thead>
          <tbody>
            ${clos.map(c => `<tr>
              <td><strong>${c.code}</strong></td>
              ${plos.map(p => {
                const val = mapObj[`${c.id}-${p.id}`] || 0;
                return `<td style="text-align:center;">
                  <select data-clo="${c.id}" data-plo="${p.id}" style="width:40px;padding:2px;font-size:12px;border:1px solid var(--border);border-radius:var(--radius);font-family:inherit;" ${editable ? '' : 'disabled'}>
                    <option value="0" ${val===0?'selected':''}>—</option><option value="1" ${val===1?'selected':''}>1</option>
                    <option value="2" ${val===2?'selected':''}>2</option><option value="3" ${val===3?'selected':''}>3</option>
                  </select>
                </td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
    document.getElementById('save-clo-plo-btn')?.addEventListener('click', async () => {
      const selects = document.querySelectorAll('#clo-plo-table select');
      const mappings = [];
      selects.forEach(s => { const v = parseInt(s.value); if (v > 0) mappings.push({ clo_id: parseInt(s.dataset.clo), plo_id: parseInt(s.dataset.plo), contribution_level: v }); });
      try {
        const res = await fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings }) });
        if (!res.ok) throw new Error((await res.json()).error);
        window.toast.success(`Đã lưu ${mappings.length} liên kết`);
      } catch (e) { window.toast.error(e.message); }
    });
  },

  renderScheduleTab(body, editable, c) {
    const weeks = c.schedule || Array.from({length: 15}, (_, i) => ({ week: i + 1, topic: '', activities: '', clos: '' }));
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Lịch giảng dạy</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveSchedule()">Lưu</button>' : ''}
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table" id="schedule-table">
          <thead><tr><th style="width:50px;">Tuần</th><th>Nội dung</th><th>Hoạt động</th><th style="width:80px;">CLO</th></tr></thead>
          <tbody>
            ${weeks.map(w => `<tr>
              <td style="text-align:center;font-weight:500;">${w.week}</td>
              <td><input type="text" value="${w.topic || ''}" data-week="${w.week}" data-field="topic" ${editable ? '' : 'disabled'} style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
              <td><input type="text" value="${w.activities || ''}" data-week="${w.week}" data-field="activities" ${editable ? '' : 'disabled'} style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
              <td><input type="text" value="${w.clos || ''}" data-week="${w.week}" data-field="clos" ${editable ? '' : 'disabled'} style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;" placeholder="1,2"></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async saveSchedule() {
    const inputs = document.querySelectorAll('#schedule-table input');
    const weeks = {};
    inputs.forEach(inp => { const w = inp.dataset.week; if (!weeks[w]) weeks[w] = { week: parseInt(w) }; weeks[w][inp.dataset.field] = inp.value; });
    const content = { ...this.syllabus.content, schedule: Object.values(weeks) };
    try {
      const res = await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Không thể lưu lịch giảng dạy');
      this.syllabus.content = content;
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },

  renderGradingTab(body, editable, c) {
    const items = c.grading || [
      { component: 'Chuyên cần', weight: 10, method: 'Điểm danh', clos: '' },
      { component: 'Bài tập', weight: 20, method: 'Bài tập nhóm', clos: '' },
      { component: 'Giữa kỳ', weight: 20, method: 'Trắc nghiệm', clos: '' },
      { component: 'Cuối kỳ', weight: 50, method: 'Tự luận', clos: '' },
    ];
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Hình thức đánh giá</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveGrading()">Lưu</button>' : ''}
      </div>
      <table class="data-table" id="grading-table">
        <thead><tr><th>Thành phần</th><th style="width:70px;">%</th><th>Hình thức</th><th style="width:80px;">CLO</th>${editable ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${items.map((g, i) => `<tr data-idx="${i}">
            <td><input type="text" value="${g.component}" data-field="component" ${editable ? '' : 'disabled'} style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
            <td><input type="number" value="${g.weight}" data-field="weight" ${editable ? '' : 'disabled'} min="0" max="100" style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;text-align:center;"></td>
            <td><input type="text" value="${g.method}" data-field="method" ${editable ? '' : 'disabled'} style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
            <td><input type="text" value="${g.clos || ''}" data-field="clos" ${editable ? '' : 'disabled'} style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
            ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
      ${editable ? '<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="window.SyllabusEditorPage.addGradingRow()">+ Thêm dòng</button>' : ''}
    `;
  },

  addGradingRow() {
    const tbody = document.querySelector('#grading-table tbody');
    tbody.insertAdjacentHTML('beforeend', `<tr>
      <td><input type="text" data-field="component" style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
      <td><input type="number" data-field="weight" value="0" style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;text-align:center;"></td>
      <td><input type="text" data-field="method" style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
      <td><input type="text" data-field="clos" style="width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
      <td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`);
  },

  async saveGrading() {
    const rows = document.querySelectorAll('#grading-table tbody tr');
    const grading = Array.from(rows).map(r => ({
      component: r.querySelector('[data-field="component"]').value,
      weight: parseInt(r.querySelector('[data-field="weight"]').value) || 0,
      method: r.querySelector('[data-field="method"]').value,
      clos: r.querySelector('[data-field="clos"]').value,
    }));
    const content = { ...this.syllabus.content, grading };
    try {
      const res = await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Không thể lưu hình thức đánh giá');
      this.syllabus.content = content;
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },

  renderResourcesTab(body, editable, c) {
    body.innerHTML = `
      <div style="max-width:560px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Tài liệu tham khảo</h3>
        <div class="input-group"><label>Giáo trình chính</label><textarea id="syl-textbooks" ${editable ? '' : 'disabled'} rows="3" placeholder="Tên sách, Tác giả, NXB">${c.textbooks || ''}</textarea></div>
        <div class="input-group"><label>Tài liệu tham khảo</label><textarea id="syl-references" ${editable ? '' : 'disabled'} rows="3" placeholder="Bài báo, website">${c.references || ''}</textarea></div>
        <div class="input-group"><label>Phần mềm / Công cụ</label><textarea id="syl-tools" ${editable ? '' : 'disabled'} rows="2">${c.tools || ''}</textarea></div>
        ${editable ? '<button class="btn btn-primary" onclick="window.SyllabusEditorPage.saveResources()">Lưu nháp</button>' : ''}
      </div>
    `;
  },

  async saveResources() {
    const content = { ...this.syllabus.content,
      textbooks: document.getElementById('syl-textbooks').value,
      references: document.getElementById('syl-references').value,
      tools: document.getElementById('syl-tools').value,
    };
    try {
      const res = await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
      if (!res.ok) throw new Error((await res.json()).error || 'Không thể lưu tài liệu tham khảo');
      this.syllabus.content = content;
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },

  async submitForApproval() {
    if (!confirm('Nộp đề cương để phê duyệt?')) return;
    try {
      const res = await fetch('/api/approval/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'syllabus', entity_id: this.syllabusId })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã nộp');
      this.syllabus.status = 'submitted';
      this.render(document.getElementById('page-content'), this.syllabusId);
    } catch (e) { window.toast.error(e.message); }
  },

  destroy() {}
};
