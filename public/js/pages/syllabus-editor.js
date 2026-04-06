// Syllabus Editor — Notion-style (v2: new JSONB structure + PDF import)

function migrateOldToNew(c) {
  if (c._schema_version >= 2) return c;
  const n = { _schema_version: 2 };
  n.course_description = c.summary || c.course_description || '';
  n.course_objectives = c.objectives || c.course_objectives || '';
  n.prerequisites = c.prerequisites || '';
  n.language_instruction = c.language_instruction || '';
  n.learning_methods = c.methods || c.learning_methods || '';
  // schedule → course_outline
  if (Array.isArray(c.schedule)) {
    n.course_outline = c.schedule.map(w => ({
      lesson: w.week || 0, title: w.topic || '', hours: 0,
      topics: [], teaching_methods: w.activities || '',
      clos: typeof w.clos === 'string' ? w.clos.split(',').map(s => s.trim()).filter(Boolean).map(s => /^\d+$/.test(s) ? `CLO${s}` : s) : (Array.isArray(w.clos) ? w.clos : []),
    }));
  } else { n.course_outline = c.course_outline || []; }
  // grading → assessment_methods
  if (Array.isArray(c.grading)) {
    n.assessment_methods = c.grading.map(g => ({
      component: g.component || '', weight: g.weight || 0,
      assessment_tool: g.method || g.assessment_tool || '',
      clos: typeof g.clos === 'string' ? g.clos.split(',').map(s => s.trim()).filter(Boolean).map(s => /^\d+$/.test(s) ? `CLO${s}` : s) : (Array.isArray(g.clos) ? g.clos : []),
    }));
  } else { n.assessment_methods = c.assessment_methods || []; }
  // textbooks/references: string → array
  if (typeof c.textbooks === 'string') { n.textbooks = c.textbooks.split('\n').map(s => s.trim()).filter(Boolean); }
  else { n.textbooks = Array.isArray(c.textbooks) ? c.textbooks : []; }
  if (typeof c.references === 'string') { n.references = c.references.split('\n').map(s => s.trim()).filter(Boolean); }
  else { n.references = Array.isArray(c.references) ? c.references : []; }
  // tools → course_requirements
  if (typeof c.tools === 'string') {
    n.course_requirements = { software: c.tools.split(',').map(s => s.trim()).filter(Boolean), hardware: [], lab_equipment: [], classroom_setup: '' };
  } else { n.course_requirements = c.course_requirements || { software: [], hardware: [], lab_equipment: [], classroom_setup: '' }; }
  return n;
}

const INP = 'width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;';

window.SyllabusEditorPage = {
  syllabusId: null,
  syllabus: null,
  clos: [],
  plos: [],
  activeTab: 0,
  importedClos: null,
  importedMappings: null,
  dirtyMapChanges: null,

  async render(container, syllabusId) {
    this.syllabusId = syllabusId;
    this.importedClos = null;
    this.importedMappings = null;
    this.dirtyMapChanges = null;
    container.innerHTML = '<div class="spinner"></div>';
    try {
      this.syllabus = await fetch(`/api/syllabi/${syllabusId}`).then(r => r.json());
      if (this.syllabus.error) throw new Error(this.syllabus.error);
      let content = typeof this.syllabus.content === 'string' ? JSON.parse(this.syllabus.content) : (this.syllabus.content || {});
      content = migrateOldToNew(content);
      this.syllabus.content = content;
    } catch (e) { container.innerHTML = `<div class="empty-state"><div class="icon">!</div><p>${e.message}</p></div>`; return; }

    const statusLabels = { draft:'Nháp', submitted:'Đã nộp', approved_tbm:'TBM duyệt', approved_khoa:'Khoa duyệt', approved_pdt:'PĐT duyệt', published:'Công bố' };
    const s = this.syllabus;
    const editable = s.status === 'draft';

    container.innerHTML = `
      <div class="page-header">
        <nav class="breadcrumb-nav mb-3">
          ${s.author_id === window.App.currentUser?.id
            ? `<a href="#" onclick="event.preventDefault();window.App.navigate('my-assignments')" class="breadcrumb-link">Đề cương của tôi</a>`
            : `<a href="#" onclick="event.preventDefault();window.App.navigate('approval')" class="breadcrumb-link">Phê duyệt</a>`
          }
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">${s.course_code} — ${s.course_name}</span>
        </nav>
        <div class="flex-between">
          <div>
            <h1 class="page-title" style="font-size:22px;">${s.course_name}</h1>
            <div class="page-header-meta">
              <span class="badge badge-info">${statusLabels[s.status] || s.status}</span>
              <span class="text-muted-sm">${s.credits} TC · ${s.author_name || '?'}</span>
            </div>
          </div>
          <div class="page-header-actions">
            ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.importPdf()">Import từ PDF</button>' : ''}
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.submitForApproval()">Nộp duyệt</button>' : ''}
          </div>
        </div>
      </div>
      ${s.is_rejected ? `
        <div class="rejection-banner">
          <div class="rejection-banner-content">
            <span class="badge badge-warning" style="padding:4px 8px;font-weight:600;">Bị từ chối</span>
            <div class="rejection-banner-label">Yêu cầu chỉnh sửa từ người phê duyệt</div>
          </div>
          <button class="btn btn-sm btn-warning" onclick="window.SyllabusEditorPage.toggleRejectionReason()">Lý do từ chối</button>
        </div>
        <div id="syl-rejection-panel" class="rejection-panel">
          <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;">Lý do chi tiết:</h4>
          <div style="font-size:13px;line-height:1.5;white-space:pre-wrap;">${s.rejection_reason || 'Chưa có lý do cụ thể.'}</div>
        </div>
      ` : ''}
      <div id="syl-import-warnings" style="display:none;margin-bottom:16px;"></div>
      <div class="tab-bar" id="syl-tabs">
        <div class="tab-item active" data-tab="0">Thông tin chung</div>
        <div class="tab-item" data-tab="1">CLO</div>
        <div class="tab-item" data-tab="2">CLO ↔ PLO</div>
        <div class="tab-item" data-tab="3">Nội dung chi tiết</div>
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
    this.renderSylTab();
  },

  async renderSylTab() {
    const body = document.getElementById('syl-tab-content');
    body.innerHTML = '<div class="spinner"></div>';
    const editable = this.syllabus.status === 'draft';
    const c = this.syllabus.content || {};
    try {
      switch (this.activeTab) {
        case 0: this.renderGeneralTab(body, editable, c); break;
        case 1: await this.renderCLOTab(body, editable); break;
        case 2: await this.renderCLOPLOTab(body, editable); break;
        case 3: this.renderOutlineTab(body, editable, c); break;
        case 4: this.renderGradingTab(body, editable, c); break;
        case 5: this.renderResourcesTab(body, editable, c); break;
      }
    } catch (e) { body.innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`; }
  },

  // ============ TAB 0: Thông tin chung ============
  renderGeneralTab(body, editable, c) {
    body.innerHTML = `
      <div style="max-width:600px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Thông tin chung</h3>
        <div class="input-group"><label>Mô tả tóm tắt nội dung học phần</label><textarea id="syl-course-desc" ${editable ? '' : 'disabled'} rows="3" placeholder="Mô tả tóm tắt HP (mục 11)">${c.course_description || ''}</textarea></div>
        <div class="input-group"><label>Mục tiêu học phần</label><textarea id="syl-course-obj" ${editable ? '' : 'disabled'} rows="3" placeholder="Mục tiêu khi hoàn thành HP (mục 7)">${c.course_objectives || ''}</textarea></div>
        <div class="input-group"><label>Yêu cầu tiên quyết</label><input type="text" id="syl-prereq" ${editable ? '' : 'disabled'} value="${c.prerequisites || ''}" placeholder="HP tiên quyết"></div>
        <div class="input-group"><label>Ngôn ngữ giảng dạy</label><input type="text" id="syl-lang-inst" ${editable ? '' : 'disabled'} value="${c.language_instruction || ''}" placeholder="Tiếng Việt"></div>
        <div class="input-group"><label>Phương pháp giảng dạy</label><textarea id="syl-learning-methods" ${editable ? '' : 'disabled'} rows="3" placeholder="Phương pháp, hình thức tổ chức dạy học (mục 12)">${Array.isArray(c.learning_methods) ? c.learning_methods.map(m => typeof m === 'string' ? m : (m.method || m.name || m.title || JSON.stringify(m))).join('\n') : (c.learning_methods || '')}</textarea></div>
        ${editable ? '<button class="btn btn-primary" onclick="window.SyllabusEditorPage.saveGeneral()">Lưu nháp</button>' : ''}
      </div>
    `;
  },

  _collectGeneral() {
    const desc = document.getElementById('syl-course-desc');
    if (!desc) return; // Tab 0 not mounted
    this.syllabus.content = {
      ...this.syllabus.content,
      course_description: desc.value,
      course_objectives: document.getElementById('syl-course-obj').value,
      prerequisites: document.getElementById('syl-prereq').value,
      language_instruction: document.getElementById('syl-lang-inst').value,
      learning_methods: document.getElementById('syl-learning-methods').value,
    };
  },

  async saveGeneral() {
    this._collectGeneral();
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: this.syllabus.content }) });
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },

  // ============ TAB 1: CLO ============
  async renderCLOTab(body, editable) {
    // If we have imported CLOs pending, show them instead of fetching from DB
    if (this.importedClos) {
      this.clos = this.importedClos.map((c, i) => ({ id: null, code: c.code, description: c.description, _idx: i }));
    } else {
      this.clos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json());
    }
    const hasPending = !!this.importedClos;
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Chuẩn đầu ra môn học (CLO)</h3>
        <div style="display:flex;gap:8px;">
          ${hasPending ? '<span class="badge" style="background:var(--warning);color:#fff;">Đã import — cần Lưu</span>' : ''}
          ${editable ? '<button class="btn btn-primary btn-sm" id="add-clo-btn">+ Thêm</button>' : ''}
        </div>
      </div>
      <table class="data-table">
        <thead><tr><th>Mã</th><th>Mô tả</th>${editable ? '<th style="width:100px;"></th>' : ''}</tr></thead>
        <tbody>
          ${this.clos.length === 0 ? `<tr><td colspan="${editable ? 3 : 2}" style="color:var(--text-muted);text-align:center;">Chưa có CLO</td></tr>` : this.clos.map(c => `
            <tr>
              <td><strong style="color:var(--primary);">${c.code}</strong></td>
              <td style="font-size:13px;">${c.description || ''}</td>
              ${editable ? `<td style="white-space:nowrap;">
                ${c.id ? `<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.editCLO(${c.id},'${c.code}',\`${(c.description||'').replace(/`/g,"'")}\`)">Sửa</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.SyllabusEditorPage.deleteCLO(${c.id})">Xóa</button>` : ''}
              </td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
      ${hasPending ? `<div style="margin-top:16px;"><button class="btn btn-primary" onclick="window.SyllabusEditorPage.saveImportedClos()">Lưu CLO đã import</button></div>` : ''}
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
    const confirmed = await window.ui.confirm({
      title: 'Xóa CLO',
      eyebrow: 'Xác nhận thao tác',
      message: 'Bạn có chắc muốn xóa CLO này?',
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
    await fetch(`/api/clos/${id}`, { method: 'DELETE' });
    window.toast.success('Đã xóa');
    this.renderSylTab();
  },

  async saveImportedClos() {
    if (!this.importedClos) return;
    try {
      // Step 1: Delete existing CLOs
      const existingClos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json());
      for (const c of existingClos) {
        await fetch(`/api/clos/${c.id}`, { method: 'DELETE' });
      }
      // Step 2: Create new CLOs and collect IDs
      const cloIdMap = {}; // code → new DB id
      for (const c of this.importedClos) {
        const res = await fetch(`/api/syllabi/${this.syllabusId}/clos`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: c.code, description: c.description })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        const created = await res.json();
        cloIdMap[c.code] = created.id;
      }
      // Step 3: Save CLO-PLO mappings
      if (this.importedMappings && this.importedMappings.length) {
        const mappings = this.importedMappings
          .filter(m => cloIdMap[m.clo_code] && m.plo_id)
          .map(m => ({ clo_id: cloIdMap[m.clo_code], plo_id: m.plo_id, contribution_level: m.contribution_level }));
        if (mappings.length) {
          await fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ mappings })
          });
        }
      }
      this.importedClos = null;
      this.importedMappings = null;
      window.toast.success('Đã lưu CLO và CLO-PLO mapping');
      this.renderSylTab();
    } catch (e) { window.toast.error(e.message); }
  },

  // ============ TAB 2: CLO ↔ PLO ============
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

  // ============ TAB 3: Nội dung chi tiết (course_outline) ============
  renderOutlineTab(body, editable, c) {
    const lessons = c.course_outline || [];
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Nội dung chi tiết học phần</h3>
        <div style="display:flex;gap:8px;">
          ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.addOutlineRow()">+ Thêm bài</button>' : ''}
          ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveOutline()">Lưu</button>' : ''}
        </div>
      </div>
      <div id="outline-container">
        ${lessons.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có nội dung. Bấm "+ Thêm bài" để bắt đầu.</p>' :
          lessons.map((l, i) => this._outlineRowHtml(l, i, editable)).join('')}
      </div>
    `;
  },

  _outlineRowHtml(l, i, editable) {
    const dis = editable ? '' : 'disabled';
    const topicsStr = Array.isArray(l.topics) ? l.topics.join('\n') : '';
    const closStr = Array.isArray(l.clos) ? l.clos.join(', ') : '';
    return `<div class="outline-row" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        <strong style="color:var(--primary);white-space:nowrap;">Bài ${l.lesson || i + 1}</strong>
        <input type="text" data-field="title" value="${(l.title || '').replace(/"/g, '&quot;')}" ${dis} placeholder="Tên bài" style="flex:1;${INP}">
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;white-space:nowrap;">Số tiết:</label><input type="number" data-field="hours" value="${l.hours || 0}" ${dis} min="0" style="width:60px;${INP}text-align:center;"></div>
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;white-space:nowrap;">CLO:</label><input type="text" data-field="clos" value="${closStr}" ${dis} placeholder="CLO1, CLO2" style="width:120px;${INP}"></div>
        ${editable ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('.outline-row').remove()">✕</button>` : ''}
      </div>
      <div style="display:flex;gap:12px;">
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nội dung chi tiết (mỗi dòng = 1 mục)</label><textarea data-field="topics" ${dis} rows="3" style="${INP}">${topicsStr}</textarea></div>
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Phương pháp dạy học</label><textarea data-field="teaching_methods" ${dis} rows="3" style="${INP}">${l.teaching_methods || ''}</textarea></div>
      </div>
    </div>`;
  },

  addOutlineRow() {
    const container = document.getElementById('outline-container');
    const idx = container.querySelectorAll('.outline-row').length;
    const emptyRow = { lesson: idx + 1, title: '', hours: 0, topics: [], teaching_methods: '', clos: [] };
    // Remove "Chưa có nội dung" message if present
    const p = container.querySelector('p');
    if (p) p.remove();
    container.insertAdjacentHTML('beforeend', this._outlineRowHtml(emptyRow, idx, true));
  },

  _collectOutline() {
    const container = document.getElementById('outline-container');
    if (!container) return; // Tab 3 not mounted
    const rows = container.querySelectorAll('.outline-row');
    const course_outline = Array.from(rows).map((r, i) => ({
      lesson: i + 1,
      title: r.querySelector('[data-field="title"]').value,
      hours: parseFloat(r.querySelector('[data-field="hours"]').value) || 0,
      topics: r.querySelector('[data-field="topics"]').value.split('\n').map(s => s.trim()).filter(Boolean),
      teaching_methods: r.querySelector('[data-field="teaching_methods"]').value,
      clos: r.querySelector('[data-field="clos"]').value.split(',').map(s => s.trim()).filter(Boolean),
    }));
    this.syllabus.content = { ...this.syllabus.content, course_outline };
  },

  async saveOutline() {
    this._collectOutline();
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: this.syllabus.content }) });
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },

  // ============ TAB 4: Đánh giá (assessment_methods) ============
  renderGradingTab(body, editable, c) {
    const items = c.assessment_methods || [
      { component: 'Chuyên cần', weight: 10, assessment_tool: 'Điểm danh', clos: [] },
      { component: 'Bài tập', weight: 20, assessment_tool: 'Bài tập nhóm', clos: [] },
      { component: 'Giữa kỳ', weight: 20, assessment_tool: 'Trắc nghiệm', clos: [] },
      { component: 'Cuối kỳ', weight: 50, assessment_tool: 'Tự luận', clos: [] },
    ];
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Hình thức đánh giá</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveGrading()">Lưu</button>' : ''}
      </div>
      <table class="data-table" id="grading-table">
        <thead><tr><th>Thành phần</th><th style="width:70px;">%</th><th>Hình thức đánh giá</th><th style="width:120px;">CLO</th>${editable ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${items.map((g, i) => {
            const closStr = Array.isArray(g.clos) ? g.clos.join(', ') : (g.clos || '');
            return `<tr data-idx="${i}">
              <td><input type="text" value="${g.component || ''}" data-field="component" ${editable ? '' : 'disabled'} style="${INP}"></td>
              <td><input type="number" value="${g.weight || 0}" data-field="weight" ${editable ? '' : 'disabled'} min="0" max="100" style="${INP}text-align:center;"></td>
              <td><input type="text" value="${g.assessment_tool || ''}" data-field="assessment_tool" ${editable ? '' : 'disabled'} style="${INP}"></td>
              <td><input type="text" value="${closStr}" data-field="clos" ${editable ? '' : 'disabled'} style="${INP}" placeholder="CLO1, CLO2"></td>
              ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>` : ''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      ${editable ? '<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="window.SyllabusEditorPage.addGradingRow()">+ Thêm dòng</button>' : ''}
    `;
  },

  addGradingRow() {
    const tbody = document.querySelector('#grading-table tbody');
    tbody.insertAdjacentHTML('beforeend', `<tr>
      <td><input type="text" data-field="component" style="${INP}"></td>
      <td><input type="number" data-field="weight" value="0" style="${INP}text-align:center;"></td>
      <td><input type="text" data-field="assessment_tool" style="${INP}"></td>
      <td><input type="text" data-field="clos" style="${INP}" placeholder="CLO1, CLO2"></td>
      <td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`);
  },

  _collectGrading() {
    const table = document.getElementById('grading-table');
    if (!table) return; // Tab 4 not mounted
    const rows = table.querySelectorAll('tbody tr');
    const assessment_methods = Array.from(rows).map(r => ({
      component: r.querySelector('[data-field="component"]').value,
      weight: parseInt(r.querySelector('[data-field="weight"]').value) || 0,
      assessment_tool: r.querySelector('[data-field="assessment_tool"]').value,
      clos: r.querySelector('[data-field="clos"]').value.split(',').map(s => s.trim()).filter(Boolean),
    }));
    this.syllabus.content = { ...this.syllabus.content, assessment_methods };
  },

  async saveGrading() {
    this._collectGrading();
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: this.syllabus.content }) });
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },

  // ============ TAB 5: Tài liệu (textbooks, references, course_requirements) ============
  renderResourcesTab(body, editable, c) {
    const textbooks = Array.isArray(c.textbooks) ? c.textbooks : [];
    const references = Array.isArray(c.references) ? c.references : [];
    const req = c.course_requirements || { software: [], hardware: [], lab_equipment: [], classroom_setup: '' };

    body.innerHTML = `
      <div style="max-width:600px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Tài liệu & Yêu cầu</h3>

        <div class="input-group"><label>Giáo trình chính (mỗi dòng = 1 tài liệu)</label>
          <textarea id="syl-textbooks" ${editable ? '' : 'disabled'} rows="3" placeholder="Tên sách, Tác giả, NXB">${textbooks.join('\n')}</textarea>
        </div>

        <div class="input-group"><label>Tài liệu tham khảo (mỗi dòng = 1 tài liệu)</label>
          <textarea id="syl-references" ${editable ? '' : 'disabled'} rows="3" placeholder="Bài báo, website...">${references.join('\n')}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:20px 0 12px;">Yêu cầu học phần</h4>

        <div class="input-group"><label>Phần mềm / Công cụ (mỗi dòng = 1 item)</label>
          <textarea id="syl-software" ${editable ? '' : 'disabled'} rows="3">${(req.software || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Phần cứng (mỗi dòng = 1 item)</label>
          <textarea id="syl-hardware" ${editable ? '' : 'disabled'} rows="2">${(req.hardware || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Thiết bị phòng thí nghiệm (mỗi dòng = 1 item)</label>
          <textarea id="syl-lab" ${editable ? '' : 'disabled'} rows="2">${(req.lab_equipment || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Yêu cầu phòng học</label>
          <input type="text" id="syl-classroom" ${editable ? '' : 'disabled'} value="${req.classroom_setup || ''}" placeholder="VD: Phòng máy tính">
        </div>

        ${editable ? '<button class="btn btn-primary" onclick="window.SyllabusEditorPage.saveResources()">Lưu nháp</button>' : ''}
      </div>
    `;
  },

  _collectResources() {
    const textbooks = document.getElementById('syl-textbooks');
    if (!textbooks) return; // Tab 5 not mounted
    const toArr = id => document.getElementById(id).value.split('\n').map(s => s.trim()).filter(Boolean);
    this.syllabus.content = {
      ...this.syllabus.content,
      textbooks: toArr('syl-textbooks'),
      references: toArr('syl-references'),
      course_requirements: {
        software: toArr('syl-software'),
        hardware: toArr('syl-hardware'),
        lab_equipment: toArr('syl-lab'),
        classroom_setup: document.getElementById('syl-classroom').value,
      },
    };
  },

  async saveResources() {
    this._collectResources();
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: this.syllabus.content }) });
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },

  // ============ PDF IMPORT ============
  importPdf() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      // Check existing data
      const c = this.syllabus.content || {};
      const hasData = c.course_description || c.course_objectives || (c.course_outline && c.course_outline.length);
      if (hasData) {
        const confirmed = await window.ui.confirm({
          title: 'Ghi đè dữ liệu đề cương',
          eyebrow: 'Cẩn thận khi import',
          message: 'Đề cương đã có dữ liệu. Import sẽ ghi đè toàn bộ nội dung.\n\nBạn có muốn tiếp tục không?',
          confirmText: 'Tiếp tục import',
          cancelText: 'Hủy',
          tone: 'warning'
        });
        if (!confirmed) return;
      }

      // Show loading
      const tabContent = document.getElementById('syl-tab-content');
      tabContent.innerHTML = '<div style="text-align:center;padding:40px;"><div class="spinner"></div><p style="margin-top:12px;color:var(--text-muted);">Đang phân tích đề cương bằng AI...</p></div>';

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`/api/syllabi/${this.syllabusId}/import-pdf`, { method: 'POST', body: formData });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Import thất bại');

        const { content, clos, clo_plo_map, warnings, course_info } = json.data;

        // Apply content
        this.syllabus.content = { ...content, _schema_version: 2 };

        // Save content to DB immediately
        await fetch(`/api/syllabi/${this.syllabusId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: this.syllabus.content })
        });

        // Store CLOs and mappings for later save
        this.importedClos = clos;
        this.importedMappings = clo_plo_map;

        // Show warnings
        const warningsEl = document.getElementById('syl-import-warnings');
        if (warnings && warnings.length) {
          warningsEl.style.display = 'block';
          warningsEl.innerHTML = `
            <div style="background:var(--warning-bg, #fff3cd);border:1px solid var(--warning, #ffc107);border-radius:var(--radius-lg);padding:12px;">
              <strong style="font-size:13px;">Cảnh báo import:</strong>
              <ul style="margin:8px 0 0 16px;font-size:13px;">${warnings.map(w => `<li>${w}</li>`).join('')}</ul>
            </div>`;
        }

        // Show course info
        if (course_info) {
          const matchBadge = course_info.matched
            ? '<span class="badge" style="background:var(--success);color:#fff;">Khớp</span>'
            : '<span class="badge" style="background:var(--warning);color:#fff;">Không khớp</span>';
          window.toast.success(`Import thành công: ${course_info.pdf_course_code} — ${course_info.pdf_course_name} ${course_info.matched ? '' : '(mã HP không khớp)'}`);
        } else {
          window.toast.success('Import thành công!');
        }

        // Re-render current tab
        this.renderSylTab();

      } catch (e) {
        window.toast.error(e.message);
        this.renderSylTab();
      }
    };
    input.click();
  },

  // ============ APPROVAL ============
  async submitForApproval() {
    const confirmed = await window.ui.confirm({
      title: 'Nộp đề cương',
      eyebrow: 'Xác nhận gửi phê duyệt',
      message: 'Bạn có chắc muốn nộp đề cương này để phê duyệt?',
      confirmText: 'Nộp duyệt',
      cancelText: 'Xem lại'
    });
    if (!confirmed) return;
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

  toggleRejectionReason() {
    const panel = document.getElementById('syl-rejection-panel');
    if (panel) {
      const isVisible = panel.style.display === 'block';
      panel.style.display = isVisible ? 'none' : 'block';
      const btn = document.querySelector('button[onclick*="toggleRejectionReason"]');
      if (btn) {
        btn.textContent = isVisible ? 'Lý do từ chối' : 'Ẩn lý do';
        if (isVisible) { btn.style.background = ''; btn.style.color = ''; btn.className = 'btn btn-sm btn-warning'; }
        else { btn.style.background = ''; btn.style.color = ''; btn.className = 'btn btn-secondary btn-sm'; }
      }
    }
  },

  destroy() {}
};
