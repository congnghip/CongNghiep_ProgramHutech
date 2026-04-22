// Syllabus Editor — CTDT shell
const _esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

function normalizeCtdtPerson(raw, nestedKey) {
  const source = raw && typeof raw === 'object' ? { ...raw } : {};
  const nested = source[nestedKey] && typeof source[nestedKey] === 'object' ? source[nestedKey] : {};
  return {
    ...source,
    name: source.name ?? nested.name ?? '',
    title: source.title ?? source.title_degree ?? nested.title ?? nested.title_degree ?? '',
    address: source.address ?? source.office_address ?? nested.address ?? nested.office_address ?? '',
    phone: source.phone ?? nested.phone ?? '',
    email: source.email ?? nested.email ?? '',
    website: source.website ?? nested.website ?? '',
  };
}

function normalizeCtdtSyllabusContent(raw) {
  const c = raw && typeof raw === 'object' ? { ...raw } : {};
  const teachingMethods = Array.isArray(c.teaching_methods)
    ? c.teaching_methods.map(item => (
        item && typeof item === 'object'
          ? {
              method: item.method || item.name || item.title || '',
              objective: item.objective || '',
            }
          : { method: String(item || ''), objective: '' }
      ))
    : String(c.learning_methods || c.methods || '')
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean)
        .map(line => ({ method: line, objective: '' }));

  const courseOutline = Array.isArray(c.course_outline)
    ? c.course_outline.map((l, idx) => ({
        lesson: l && typeof l.lesson === 'number' ? l.lesson : idx + 1,
        title: l?.title || '',
        lt_hours: typeof l?.lt_hours === 'number' ? l.lt_hours : (typeof l?.hours === 'number' ? l.hours : 0),
        th_hours: typeof l?.th_hours === 'number' ? l.th_hours : 0,
        topics: Array.isArray(l?.topics) ? l.topics : [],
        teaching_methods: l?.teaching_methods || '',
        clo_codes: Array.isArray(l?.clo_codes) ? l.clo_codes : (Array.isArray(l?.clos) ? l.clos : []),
        self_study_hours: typeof l?.self_study_hours === 'number' ? l.self_study_hours : 0,
        self_study_tasks: Array.isArray(l?.self_study_tasks) ? l.self_study_tasks : [],
      }))
    : [];

  const assessmentMethods = Array.isArray(c.assessment_methods)
    ? c.assessment_methods.map(a => ({
        component: a?.component || '',
        description: a?.description || a?.assessment_tool || '',
        task_ref: a?.task_ref || '',
        weight: typeof a?.weight === 'number' ? a.weight : (parseInt(a?.weight, 10) || 0),
        clo_codes: Array.isArray(a?.clo_codes) ? a.clo_codes : (Array.isArray(a?.clos) ? a.clos : []),
      }))
    : [];

  const ctdtOverrides = c.ctdt_overrides && typeof c.ctdt_overrides === 'object'
    ? { ...c.ctdt_overrides }
    : {};
  const section3 = ctdtOverrides.section3 && typeof ctdtOverrides.section3 === 'object'
    ? { ...ctdtOverrides.section3 }
    : {};
  ctdtOverrides.section3 = {
    ...section3,
    knowledge_area: section3.knowledge_area ?? null,
    course_requirement: section3.course_requirement ?? null,
  };

  return {
    ...c,
    _schema_version: 4,
    course_description: c.course_description || c.summary || '',
    course_objectives: c.course_objectives || c.objectives || '',
    prerequisites: c.prerequisites || '',
    prerequisites_concurrent: c.prerequisites_concurrent || '',
    language_instruction: c.language_instruction || '',
    teaching_methods: teachingMethods,
    course_outline: courseOutline,
    assessment_methods: assessmentMethods,
    textbooks: Array.isArray(c.textbooks) ? c.textbooks : (typeof c.textbooks === 'string' ? c.textbooks.split('\n').map(s => s.trim()).filter(Boolean) : []),
    references: Array.isArray(c.references) ? c.references : (typeof c.references === 'string' ? c.references.split('\n').map(s => s.trim()).filter(Boolean) : []),
    tools: Array.isArray(c.tools) ? c.tools : [],
    other_requirements: c.other_requirements || '',
    instructor: normalizeCtdtPerson(c.instructor, 'primary'),
    assistant_instructor: normalizeCtdtPerson(c.assistant_instructor, 'assistant'),
    contact_info: c.contact_info ?? c.signatures?.contact_info ?? '',
    signature_date: c.signature_date ?? c.signatures?.date_text ?? '',
    ctdt_overrides: ctdtOverrides,
  };
}

const INP = 'width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;';

window.SyllabusEditorPage = {
  syllabusId: null,
  syllabus: null,
  clos: [],
  plos: [],
  section9Data: null,
  section10Clos: [],
  section10Mappings: [],
  section3Draft: null,
  activeTab: 0,
  dirtyMapChanges: null,

  async render(container, syllabusId) {
    this.syllabusId = syllabusId;
    this.section9Data = null;
    this.section10Clos = [];
    this.section10Mappings = [];
    this.section3Draft = null;
    this.dirtyMapChanges = null;
    container.innerHTML = '<div class="spinner"></div>';
    try {
      this.syllabus = await fetch(`/api/syllabi/${syllabusId}`).then(r => r.json());
      if (this.syllabus.error) throw new Error(this.syllabus.error);
      let content = typeof this.syllabus.content === 'string' ? JSON.parse(this.syllabus.content) : (this.syllabus.content || {});
      content = normalizeCtdtSyllabusContent(content);
      this.syllabus.content = content;
      this.section3Draft = {
        knowledge_area: content.ctdt_overrides?.section3?.knowledge_area ?? null,
        course_requirement: content.ctdt_overrides?.section3?.course_requirement ?? null,
      };
    } catch (e) { container.innerHTML = `<div class="empty-state"><div class="icon">!</div><p>${e.message}</p></div>`; return; }

    const statusLabels = { draft:'Nháp', submitted:'Đã nộp', approved:'Đã duyệt', published:'Công bố' };
    const s = this.syllabus;
    const editable = ['draft', 'approved'].includes(s.status);

    container.innerHTML = `
      <div class="page-header">
        <nav class="breadcrumb-nav mb-3">
          <a href="#" onclick="event.preventDefault();window.App.navigate('version-editor',{versionId:${s.version_id}})" class="breadcrumb-link">${s.program_name || 'CTĐT'} — ${s.academic_year || ''}</a>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">${s.is_proposed ? s.course_name : (s.course_code + ' — ' + s.course_name)}</span>
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
            ${editable && s.has_base_syllabus ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.loadFromBase()">Lấy từ ĐC cơ bản</button>' : ''}
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveAll()">Lưu</button>' : ''}
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.submitForApproval()">Nộp duyệt</button>' : ''}
          </div>
        </div>
      </div>
      ${s.has_base_syllabus === false && editable ? `
        <div style="background:var(--warning-bg, #fff3cd);border:1px solid var(--warning, #ffc107);border-radius:var(--radius-lg);padding:12px;margin-bottom:16px;font-size:13px;">
          <strong>Lưu ý:</strong> Học phần này chưa có đề cương cơ bản. Nội dung đề cương cần được soạn thủ công.
        </div>
      ` : ''}
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
      <div class="tab-bar" id="syl-tabs">
        <div class="tab-item active" data-tab="0">Thông tin chung</div>
        <div class="tab-item" data-tab="1">CLO</div>
        <div class="tab-item" data-tab="2">Ma trận PLO/PI</div>
        <div class="tab-item" data-tab="3">Nội dung giảng dạy</div>
        <div class="tab-item" data-tab="4">Đánh giá</div>
        <div class="tab-item" data-tab="5">Tài liệu</div>
      </div>
      <div id="syl-tab-content"><div class="spinner"></div></div>

      <!-- Add Outline Lesson Modal -->
      <div id="outline-add-modal" class="modal-overlay">
        <div class="modal" style="max-width:640px;">
          <div class="modal-header"><h2>Thêm bài học</h2></div>
          <div class="modal-body">
            <form id="outline-add-form">
              <div class="input-group">
                <label>Tên bài <span class="required-mark">*</span></label>
                <input type="text" id="outline-add-title" required placeholder="VD: Chương 1 — Giới thiệu">
              </div>
              <div style="display:flex;gap:12px;">
                <div class="input-group" style="flex:1;">
                  <label>Số tiết</label>
                  <input type="number" id="outline-add-hours" min="0" value="0">
                </div>
                <div class="input-group" style="flex:1;">
                  <label>CLO liên quan</label>
                  <input type="text" id="outline-add-clos" placeholder="CLO1, CLO2">
                </div>
              </div>
              <div class="input-group">
                <label>Nội dung chi tiết (mỗi dòng = 1 mục)</label>
                <textarea id="outline-add-topics" rows="4"></textarea>
              </div>
              <div class="input-group">
                <label>Phương pháp dạy học</label>
                <textarea id="outline-add-methods" rows="3"></textarea>
              </div>
              <div class="modal-error" id="outline-add-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="window.SyllabusEditorPage.closeAddOutlineModal()">Hủy</button>
                <button type="submit" class="btn btn-primary">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    document.querySelectorAll('#syl-tabs .tab-item').forEach(el => {
      el.addEventListener('click', () => {
        this._collectCurrentTabIntoState();
        document.querySelectorAll('#syl-tabs .tab-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        this.activeTab = parseInt(el.dataset.tab);
        this.renderSylTab();
      });
    });

    document.getElementById('outline-add-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitAddOutline();
    });

    this.renderSylTab();
  },

  async renderSylTab() {
    const body = document.getElementById('syl-tab-content');
    body.innerHTML = '<div class="spinner"></div>';
    const editable = ['draft', 'approved'].includes(this.syllabus.status);
    const c = this.syllabus.content || {};
    try {
      switch (this.activeTab) {
        case 0: await this.renderSections1To8(body, editable); break;
        case 1: await this.renderSection10(body, editable); break;
        case 2: await this.renderSection9(body, editable); break;
        case 3: await this.renderOutlineTab(body, false, c); break;
        case 4: await this.renderGradingTab(body, false, c); break;
        case 5: this.renderResourcesTab(body, false, c); break;
      }
    } catch (e) { body.innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`; }
  },

  // ============ CTDT SHELL TABS ============
  async renderSections1To8(body, editable) {
    const s = this.syllabus || {};
    const c = this.syllabus.content || {};
    const section3 = this.section3Draft || { knowledge_area: null, course_requirement: null };
    const knowledgeArea = section3.knowledge_area ?? s.knowledge_area ?? '';
    const courseRequirement = section3.course_requirement ?? s.course_requirement ?? '';
    const creditsDisplay = `${s.credits || 0} (${s.credits_theory || 0}, ${s.credits_practice || 0}) TC`;
    body.innerHTML = `
      <div style="max-width:900px;">
        <div style="margin-bottom:12px;padding:12px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-secondary);font-size:13px;color:var(--text-muted);">
          Các mục ngoài 3, 9, 10 được kế thừa từ đề cương gốc và không chỉnh sửa trong đề cương CTDT.
        </div>
        <table class="data-table">
          <tbody>
            <tr><th style="width:180px;">1. Tên học phần</th><td>Tên tiếng Việt: <strong>${s.course_name || ''}</strong><br>Tên tiếng Anh: <strong>${s.course_name_en || ''}</strong></td></tr>
            <tr><th>2. Mã học phần</th><td>${s.course_code || ''}</td></tr>
            <tr>
              <th>3. Thuộc khối kiến thức</th>
              <td>
                <div style="display:flex;gap:12px;flex-wrap:wrap;">
                  <select id="ctdt-sec3-knowledge" ${editable ? '' : 'disabled'} style="${INP}max-width:240px;">
                    <option value="">-- Chọn khối kiến thức --</option>
                    <option value="general" ${knowledgeArea === 'general' ? 'selected' : ''}>GD đại cương</option>
                    <option value="professional" ${knowledgeArea === 'professional' ? 'selected' : ''}>GD chuyên nghiệp</option>
                    <option value="non_credit" ${knowledgeArea === 'non_credit' ? 'selected' : ''}>Không tích lũy</option>
                  </select>
                  <select id="ctdt-sec3-requirement" ${editable ? '' : 'disabled'} style="${INP}max-width:240px;">
                    <option value="">-- Chọn tính chất --</option>
                    <option value="required" ${courseRequirement === 'required' ? 'selected' : ''}>Bắt buộc</option>
                    <option value="elective" ${courseRequirement === 'elective' ? 'selected' : ''}>Tự chọn</option>
                  </select>
                </div>
              </td>
            </tr>
            <tr><th>4. Trình độ đào tạo</th><td>${s.training_level || ''}</td></tr>
            <tr><th>5. Số tín chỉ</th><td>${creditsDisplay}</td></tr>
            <tr><th>6. Học phần học trước/ song hành</th><td>${c.prerequisites || ''}${c.prerequisites_concurrent ? `<br>Song hành: ${c.prerequisites_concurrent}` : ''}</td></tr>
            <tr><th>7. Mục tiêu học phần</th><td style="white-space:pre-wrap;">${c.course_objectives || ''}</td></tr>
            <tr><th>8. Đơn vị quản lý học phần</th><td>${s.dept_name || ''}</td></tr>
          </tbody>
        </table>
        ${editable ? `
          <div style="display:flex;justify-content:flex-end;margin-top:12px;">
            <button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveSection3()">Lưu mục 3</button>
          </div>
        ` : ''}

        <h4 style="font-size:14px;font-weight:600;margin:20px 0 8px;">Phương pháp, hình thức tổ chức dạy học (mục 12)</h4>
        <table class="data-table" id="ctdt-teaching-methods-table">
          <thead><tr><th style="width:35%;">Phương pháp</th><th>Mục tiêu</th></tr></thead>
          <tbody>
            ${(Array.isArray(c.teaching_methods) ? c.teaching_methods : []).map(t => `<tr>
              <td><input type="text" data-field="method" value="${String(t.method || '').replace(/"/g,'&quot;')}" disabled style="${INP}"></td>
              <td><input type="text" data-field="objective" value="${String(t.objective || '').replace(/"/g,'&quot;')}" disabled style="${INP}"></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  async renderSection9(body, editable) {
    const data = await fetch(`/api/syllabi/${this.syllabusId}/ctdt-section9`).then(r => r.json());
    if (data.error) throw new Error(data.error);
    this.section9Data = data;

    const ploMap = new Map((data.course_plo_map || []).map(m => [String(m.plo_id), m.contribution_level]));
    const piMap = new Map((data.course_pi_map || []).map(m => [String(m.pi_id), m.contribution_level]));
    const plos = Array.isArray(data.plos) ? data.plos : [];
    const pis = Array.isArray(data.pis) ? data.pis : [];

    // Group PIs by PLO for the matrix layout
    const pisByPlo = {};
    pis.forEach(pi => {
      if (!pisByPlo[pi.plo_id]) pisByPlo[pi.plo_id] = [];
      pisByPlo[pi.plo_id].push(pi);
    });
    const courseCode = this.syllabus?.course_code || '';
    const hasPIs = plos.some(p => (pisByPlo[p.id] || []).length > 0);

    body.innerHTML = `
      <div style="display:grid;gap:20px;max-width:960px;">
        <div style="margin-bottom:4px;padding:12px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-secondary);font-size:13px;color:var(--text-muted);">
          Mục 9 chỉ chỉnh sửa các mapping của học phần hiện tại trong CTDT.
        </div>
        <div>
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">9. Ma trận học phần ↔ PLO</h3>
          <table class="data-table" id="ctdt-section9-plo-table">
            <thead><tr><th>PLO</th><th>Mô tả</th><th style="width:80px;text-align:center;">Đạt</th></tr></thead>
            <tbody>
              ${plos.length ? plos.map(plo => `
                <tr>
                  <td><strong>${plo.code || ''}</strong></td>
                  <td>${plo.description || ''}</td>
                  <td style="text-align:center;">
                    <input type="checkbox" data-plo-id="${plo.id}" ${(ploMap.get(String(plo.id)) || 0) > 0 ? 'checked' : ''} ${editable ? '' : 'disabled'} style="width:16px;height:16px;cursor:${editable ? 'pointer' : 'default'};">
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Chưa có PLO</td></tr>'}
            </tbody>
          </table>
        </div>

        <div>
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">9. Ma trận học phần ↔ PI</h3>
          ${!hasPIs ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có PI trong CTDT.</p>' : `
          <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px;">Chỉ các ô có HP ↔ PLO đã map (≥1) mới được chỉnh sửa.</p>
          <div style="overflow-x:auto;padding-bottom:16px;">
            <table class="data-table" id="ctdt-section9-pi-table" style="border-collapse:collapse;white-space:nowrap;">
              <thead>
                <tr>
                  <th rowspan="2" style="position:sticky;left:0;z-index:10;min-width:70px;background:#f8f9fa;box-shadow:inset -1px 0 0 var(--border);">Mã HP</th>
                  ${plos.map(plo => {
                    const pisForPlo = pisByPlo[plo.id] || [];
                    if (!pisForPlo.length) return '';
                    return `<th colspan="${pisForPlo.length}" style="text-align:center;font-size:12px;border-bottom:1px solid var(--border);border-left:2px solid var(--border);background:#f1f3f5;">${plo.code}</th>`;
                  }).join('')}
                </tr>
                <tr>
                  ${plos.map(plo => (pisByPlo[plo.id] || []).map(pi =>
                    `<th style="text-align:center;font-size:11px;min-width:28px;padding:4px;color:var(--primary);background:#f8f9fa;" title="${pi.pi_code}: ${pi.description || ''}">${pi.pi_code}</th>`
                  ).join('')).join('')}
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="position:sticky;left:0;z-index:5;font-size:12px;background:#ffffff;box-shadow:inset -1px 0 0 var(--border),inset 0 -1px 0 var(--border);"><strong>${courseCode}</strong></td>
                  ${plos.map(plo => {
                    const pisForPlo = pisByPlo[plo.id] || [];
                    const isPloMapped = (ploMap.get(String(plo.id)) || 0) > 0;
                    return pisForPlo.map((pi, piIndex) => {
                      const val = piMap.get(String(pi.id)) || 0;
                      const isDisabled = !(isPloMapped && editable);
                      return `<td style="text-align:center;${piIndex === 0 ? 'border-left:2px solid var(--border);' : ''}">
                        <select data-pi-id="${pi.id}"
                                style="width:34px;padding:1px;font-size:11px;border:1px solid var(--border);border-radius:var(--radius);font-family:inherit;${isDisabled ? 'background:var(--bg-secondary);opacity:0.5;cursor:not-allowed;' : 'cursor:pointer;'}"
                                ${isDisabled ? 'disabled' : ''}>
                          <option value="0" ${val === 0 ? 'selected' : ''}>—</option>
                          <option value="1" ${val === 1 ? 'selected' : ''}>1</option>
                          <option value="2" ${val === 2 ? 'selected' : ''}>2</option>
                          <option value="3" ${val === 3 ? 'selected' : ''}>3</option>
                        </select>
                      </td>`;
                    }).join('');
                  }).join('')}
                </tr>
              </tbody>
            </table>
          </div>
          `}
        </div>
      </div>
    `;
  },

  async renderSection10(body, editable) {
    const [clos, maps, section9] = await Promise.all([
      fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json()),
      fetch(`/api/syllabi/${this.syllabusId}/clo-pi-map`).then(r => r.json()),
      fetch(`/api/syllabi/${this.syllabusId}/ctdt-section9`).then(r => r.json()),
    ]);
    if (clos.error) throw new Error(clos.error);
    if (maps.error) throw new Error(maps.error);
    if (section9.error) throw new Error(section9.error);

    this.section10Clos = clos;
    this.section10Mappings = maps;

    const allPIs = Array.isArray(section9.pis) ? section9.pis : [];
    const allPLOs = Array.isArray(section9.plos) ? section9.plos : [];
    const mapObj = {};
    (maps || []).forEach(m => { mapObj[`${m.clo_id}-${m.pi_id}`] = m.contribution_level; });

    // Group PIs by PLO for header grouping
    const pisByPlo = {};
    allPIs.forEach(pi => {
      if (!pisByPlo[pi.plo_id]) pisByPlo[pi.plo_id] = [];
      pisByPlo[pi.plo_id].push(pi);
    });
    const plosWithPIs = allPLOs.filter(p => (pisByPlo[p.id] || []).length > 0);

    body.innerHTML = `
      <div style="display:grid;gap:20px;max-width:960px;">
        <div style="margin-bottom:4px;padding:12px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-secondary);font-size:13px;color:var(--text-muted);">
          Mục 10 giữ CLO đọc-only và chỉ cho phép chỉnh sửa ma trận CLO ↔ PI của CTDT.
        </div>
        <div>
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">10. CLO kế thừa từ đề cương gốc</h3>
          <table class="data-table">
            <thead><tr><th style="width:120px;">Mã</th><th>Mô tả</th><th style="width:120px;">Bloom</th></tr></thead>
            <tbody>
              ${clos.length ? clos.map(c => `
                <tr>
                  <td><strong>${c.code || ''}</strong></td>
                  <td>${c.description || ''}</td>
                  <td><span class="badge badge-info">${['','Nhớ','Hiểu','Áp dụng','Phân tích','Đánh giá','Sáng tạo'][c.bloom_level] || c.bloom_level || ''}</span></td>
                </tr>
              `).join('') : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Chưa có CLO</td></tr>'}
            </tbody>
          </table>
        </div>

        <div>
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">10. CLO ↔ PI trong CTDT</h3>
          <div style="overflow-x:auto;">
            <table class="data-table" id="clo-pi-table">
              <thead>
                <tr>
                  <th rowspan="2" style="vertical-align:middle;">CLO</th>
                  ${plosWithPIs.map(plo => `<th colspan="${(pisByPlo[plo.id] || []).length}" style="text-align:center;font-size:12px;border-bottom:1px solid var(--border);border-left:2px solid var(--border);background:#f1f3f5;">${plo.code}</th>`).join('')}
                </tr>
                <tr>
                  ${plosWithPIs.map(plo => (pisByPlo[plo.id] || []).map((pi, i) => `<th style="text-align:center;min-width:34px;font-size:10px;color:var(--primary);${i===0?'border-left:2px solid var(--border);':''}" title="${pi.pi_code}: ${pi.description || ''}">${pi.pi_code || ''}</th>`).join('')).join('')}
                </tr>
              </thead>
              <tbody>
                ${clos.length ? clos.map(c => `
                  <tr>
                    <td><strong>${c.code || ''}</strong></td>
                    ${plosWithPIs.map(plo => (pisByPlo[plo.id] || []).map((pi, i) => {
                      const checked = (mapObj[`${c.id}-${pi.id}`] || 0) > 0;
                      return `<td style="text-align:center;${i===0?'border-left:2px solid var(--border);':''}">
                        <input type="checkbox" data-clo="${c.id}" data-pi="${pi.id}" ${checked ? 'checked' : ''} ${editable ? '' : 'disabled'} style="width:15px;height:15px;cursor:${editable ? 'pointer' : 'default'};">
                      </td>`;
                    }).join('')).join('')}
                  </tr>
                `).join('') : `<tr><td colspan="${Math.max(allPIs.length + 1, 2)}" style="text-align:center;color:var(--text-muted);">Chưa có CLO</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
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

  _collectCurrentTabIntoState() {
    switch (this.activeTab) {
      case 0: this.collectSection3(); break;
      case 1: this._collectCloPiMap(); break;
      case 2: this.collectSection9?.(); break;
      // cases 3–5 are read-only; nothing to collect
    }
  },

  collectSection3() {
    const knowledgeEl = document.getElementById('ctdt-sec3-knowledge');
    const requirementEl = document.getElementById('ctdt-sec3-requirement');
    if (!knowledgeEl || !requirementEl) return;
    this.section3Draft = {
      knowledge_area: knowledgeEl.value || null,
      course_requirement: requirementEl.value || null,
    };
  },

  async saveSection3(options = {}) {
    this.collectSection3();
    try {
      const res = await fetch(`/api/syllabi/${this.syllabusId}/ctdt-section3`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.section3Draft || {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi lưu mục 3');
      this.section3Draft = data.section3 || this.section3Draft;
      this.syllabus.content = {
        ...this.syllabus.content,
        ctdt_overrides: {
          ...(this.syllabus.content.ctdt_overrides || {}),
          section3: data.section3,
        },
      };
      if (!options.silent) window.toast.success('Đã lưu mục 3');
      return data;
    } catch (e) {
      if (!options.silent) window.toast.error(e.message);
      throw e;
    }
  },

  collectSection9() {
    const ploTable = document.getElementById('ctdt-section9-plo-table');
    const piTable = document.getElementById('ctdt-section9-pi-table');
    if (!ploTable || !piTable) return;

    const plo_mappings = Array.from(ploTable.querySelectorAll('input[type="checkbox"]'))
      .map(cb => ({
        plo_id: parseInt(cb.dataset.ploId, 10),
        contribution_level: cb.checked ? 1 : 0,
      }))
      .filter(m => m.contribution_level > 0);

    const pi_mappings = Array.from(piTable.querySelectorAll('select'))
      .map(sel => ({
        pi_id: parseInt(sel.dataset.piId, 10),
        contribution_level: parseInt(sel.value, 10) || 0,
      }))
      .filter(m => m.contribution_level > 0);

    this.section9Data = { ...(this.section9Data || {}), plo_mappings, pi_mappings };
  },

  _normalizeSection9Data(raw) {
    const data = raw && typeof raw === 'object' ? raw : {};
    if (Array.isArray(data.plo_mappings) || Array.isArray(data.pi_mappings)) {
      return {
        ...data,
        plo_mappings: Array.isArray(data.plo_mappings) ? data.plo_mappings : [],
        pi_mappings: Array.isArray(data.pi_mappings) ? data.pi_mappings : [],
      };
    }
    return {
      ...data,
      plo_mappings: (data.course_plo_map || [])
        .map(m => ({
          plo_id: m.plo_id,
          contribution_level: m.contribution_level,
        }))
        .filter(m => m.contribution_level > 0),
      pi_mappings: (data.course_pi_map || [])
        .map(m => ({
          pi_id: m.pi_id,
          contribution_level: m.contribution_level,
        }))
        .filter(m => m.contribution_level > 0),
    };
  },

  async saveSection9(options = {}) {
    try {
      this.collectSection9();
      if (!this.section9Data || (!Array.isArray(this.section9Data.plo_mappings) && !Array.isArray(this.section9Data.pi_mappings))) {
        const fresh = await fetch(`/api/syllabi/${this.syllabusId}/ctdt-section9`).then(r => r.json());
        if (fresh.error) throw new Error(fresh.error);
        this.section9Data = fresh;
      }
      this.section9Data = this._normalizeSection9Data(this.section9Data);
      const res = await fetch(`/api/syllabi/${this.syllabusId}/ctdt-section9`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plo_mappings: this.section9Data?.plo_mappings || [],
          pi_mappings: this.section9Data?.pi_mappings || [],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Lỗi lưu mục 9');
      if (data.section9) this.section9Data = this._normalizeSection9Data(data.section9);
      return data;
    } catch (e) {
      if (!options.silent) window.toast.error(e.message);
      throw e;
    }
  },

  _collectCloPiMap() {
    const table = document.getElementById('clo-pi-table');
    if (!table) return;
    const mappings = [];
    table.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      if (cb.checked) mappings.push({
        clo_id: parseInt(cb.dataset.clo),
        pi_id: parseInt(cb.dataset.pi),
        contribution_level: 1,
      });
    });
    this.dirtyMapChanges = mappings;
  },

  async _fetchCloCodes() {
    try {
      const clos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json());
      return Array.isArray(clos) ? clos.map(x => x.code).filter(Boolean) : [];
    } catch (_) { return []; }
  },

  // ============ TAB 3: Nội dung chi tiết (course_outline) ============
  async renderOutlineTab(body, editable, c) {
    const lessons = c.course_outline || [];
    const cloCodes = await this._fetchCloCodes();

    const totals = lessons.reduce((acc, l) => ({
      lt: acc.lt + (l.lt_hours || 0),
      th: acc.th + (l.th_hours || 0),
      ss: acc.ss + (l.self_study_hours || 0),
    }), { lt: 0, th: 0, ss: 0 });

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Nội dung chi tiết học phần (mục 13 + 16)</h3>
        <div style="display:flex;gap:8px;">
          ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.openAddOutlineModal()">+ Thêm bài</button>' : ''}
          ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveOutline()">Lưu</button>' : ''}
        </div>
      </div>
      <div id="outline-container">
        ${lessons.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có nội dung.</p>' :
          lessons.map((l, i) => this._outlineRowHtml(l, i, editable, cloCodes)).join('')}
      </div>
      ${lessons.length ? `<div style="margin-top:12px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius);font-size:13px;">
        <strong>Tổng:</strong> LT ${totals.lt} tiết &nbsp;|&nbsp; TH ${totals.th} tiết &nbsp;|&nbsp; Tự học ${totals.ss} tiết
      </div>` : ''}
    `;
  },

  _outlineRowHtml(l, i, editable, cloCodes) {
    const dis = editable ? '' : 'disabled';
    const topicsStr = Array.isArray(l.topics) ? l.topics.join('\n') : '';
    const tasksStr = Array.isArray(l.self_study_tasks) ? l.self_study_tasks.join('\n') : '';
    const codes = Array.isArray(cloCodes) ? cloCodes : [];
    const selected = Array.isArray(l.clo_codes) ? l.clo_codes : [];
    return `<div class="outline-row" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        <strong style="color:var(--primary);white-space:nowrap;">Bài ${l.lesson || i + 1}</strong>
        <input type="text" data-field="title" value="${_esc(l.title)}" ${dis} placeholder="Tên bài" style="flex:1;${INP}">
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;">LT:</label><input type="number" data-field="lt_hours" value="${l.lt_hours || 0}" ${dis} min="0" style="width:56px;${INP}text-align:center;"></div>
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;">TH:</label><input type="number" data-field="th_hours" value="${l.th_hours || 0}" ${dis} min="0" style="width:56px;${INP}text-align:center;"></div>
        ${editable ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('.outline-row').remove()">✕</button>` : ''}
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nội dung chi tiết (mỗi dòng = 1 mục)</label><textarea data-field="topics" ${dis} rows="3" style="${INP}">${_esc(topicsStr)}</textarea></div>
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Phương pháp dạy học</label><textarea data-field="teaching_methods" ${dis} rows="3" style="${INP}">${_esc(l.teaching_methods)}</textarea></div>
      </div>
      <div class="input-group" style="margin-bottom:10px;"><label style="font-size:12px;">CLO đáp ứng</label>
        <select data-field="clo_codes" multiple size="3" ${dis} style="${INP}">
          ${codes.map(c => `<option value="${_esc(c)}" ${selected.includes(c) ? 'selected' : ''}>${_esc(c)}</option>`).join('')}
        </select>
      </div>
      <details style="margin-top:6px;">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--primary);">▸ Hướng dẫn tự học (mục 16)</summary>
        <div style="display:flex;gap:12px;margin-top:8px;">
          <div class="input-group" style="width:150px;margin:0;"><label style="font-size:12px;">Số tiết tự học</label><input type="number" data-field="self_study_hours" value="${l.self_study_hours || 0}" ${dis} min="0" style="${INP}text-align:center;"></div>
          <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nhiệm vụ SV (mỗi dòng = 1)</label><textarea data-field="self_study_tasks" ${dis} rows="3" style="${INP}">${_esc(tasksStr)}</textarea></div>
        </div>
      </details>
    </div>`;
  },

  openAddOutlineModal() {
    const form = document.getElementById('outline-add-form');
    form.reset();
    document.getElementById('outline-add-hours').value = '0';
    const errorEl = document.getElementById('outline-add-error');
    errorEl.classList.remove('show');
    errorEl.textContent = '';
    document.getElementById('outline-add-modal').classList.add('active');
    App.modalGuard('outline-add-modal', () => this.submitAddOutline());
  },

  closeAddOutlineModal() {
    document.getElementById('outline-add-modal').classList.remove('active');
  },

  submitAddOutline() {
    const title = document.getElementById('outline-add-title').value.trim();
    const errorEl = document.getElementById('outline-add-error');
    if (!title) {
      errorEl.textContent = 'Nhập tên bài';
      errorEl.classList.add('show');
      return;
    }
    const hours = parseFloat(document.getElementById('outline-add-hours').value) || 0;
    const topics = document.getElementById('outline-add-topics').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    const teaching_methods = document.getElementById('outline-add-methods').value;
    const clos = document.getElementById('outline-add-clos').value
      .split(',').map(s => s.trim()).filter(Boolean);

    // CRITICAL: capture inline edits on existing rows BEFORE re-rendering Tab 3
    this._collectOutline();

    const existing = this.syllabus.content.course_outline || [];
    this.syllabus.content = {
      ...this.syllabus.content,
      course_outline: [
        ...existing,
        { lesson: existing.length + 1, title, hours, topics, teaching_methods, clos },
      ],
    };

    this.closeAddOutlineModal();
    window.toast.success('Đã thêm bài (chưa lưu)');
    this.renderSylTab();
  },

  _collectOutline() {
    const container = document.getElementById('outline-container');
    if (!container) return; // Tab 3 not mounted
    const rows = container.querySelectorAll('.outline-row');
    const course_outline = Array.from(rows).map((r, i) => ({
      lesson: i + 1,
      title: r.querySelector('[data-field="title"]').value,
      lt_hours: parseFloat(r.querySelector('[data-field="lt_hours"]').value) || 0,
      th_hours: parseFloat(r.querySelector('[data-field="th_hours"]').value) || 0,
      topics: r.querySelector('[data-field="topics"]').value.split('\n').map(s => s.trim()).filter(Boolean),
      teaching_methods: r.querySelector('[data-field="teaching_methods"]').value,
      clo_codes: Array.from(r.querySelector('[data-field="clo_codes"]').selectedOptions).map(o => o.value),
      self_study_hours: parseFloat(r.querySelector('[data-field="self_study_hours"]').value) || 0,
      self_study_tasks: r.querySelector('[data-field="self_study_tasks"]').value.split('\n').map(s => s.trim()).filter(Boolean),
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
  async renderGradingTab(body, editable, c) {
    const items = c.assessment_methods || [];
    const cloCodes = await this._fetchCloCodes();
    this._gradingCloCodes = cloCodes;

    const totalWeight = items.reduce((s, g) => s + (parseInt(g.weight) || 0), 0);
    const weightColor = totalWeight === 100 ? 'var(--success)' : 'var(--danger)';

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Phương pháp kiểm tra/đánh giá (mục 14)</h3>
        <div style="font-size:13px;">Tổng trọng số: <strong style="color:${weightColor};">${totalWeight}%</strong></div>
      </div>
      <table class="data-table" id="ctdt-grading-table">
        <thead><tr>
          <th style="width:180px;">Thành phần</th>
          <th>Quy định</th>
          <th style="width:140px;">Bài đánh giá</th>
          <th style="width:80px;">%</th>
          <th style="width:160px;">CLO đáp ứng</th>
          ${editable ? '<th style="width:50px;"></th>' : ''}
        </tr></thead>
        <tbody>
          ${items.map((g, i) => this._gradingRowHtml(g, i, editable, cloCodes)).join('')}
        </tbody>
      </table>
      ${editable ? '<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="window.SyllabusEditorPage.addGradingRow()">+ Thêm dòng</button>' : ''}
    `;
  },

  _gradingRowHtml(g, i, editable, cloCodes) {
    const dis = editable ? '' : 'disabled';
    const selected = Array.isArray(g.clo_codes) ? g.clo_codes : [];
    return `<tr data-idx="${i}">
      <td><input type="text" value="${_esc(g.component)}" data-field="component" ${dis} style="${INP}" placeholder="VD: Điểm đánh giá quá trình"></td>
      <td><input type="text" value="${_esc(g.description)}" data-field="description" ${dis} style="${INP}" placeholder="VD: Bài tập nhóm"></td>
      <td><input type="text" value="${_esc(g.task_ref)}" data-field="task_ref" ${dis} style="${INP}" placeholder="VD: Bài 1,2,3,5"></td>
      <td><input type="number" value="${g.weight || 0}" data-field="weight" ${dis} min="0" max="100" style="${INP}text-align:center;"></td>
      <td>
        <select data-field="clo_codes" multiple size="3" ${dis} style="${INP}font-size:12px;">
          ${cloCodes.map(c => `<option value="${_esc(c)}" ${selected.includes(c) ? 'selected' : ''}>${_esc(c)}</option>`).join('')}
        </select>
      </td>
      ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>` : ''}
    </tr>`;
  },

  addGradingRow() {
    const tbody = document.querySelector('#ctdt-grading-table tbody');
    if (!tbody) return;
    const codes = this._gradingCloCodes || [];
    tbody.insertAdjacentHTML('beforeend', this._gradingRowHtml({}, tbody.children.length, true, codes));
  },

  _collectGrading() {
    const table = document.getElementById('ctdt-grading-table');
    if (!table) return; // Tab 4 not mounted
    const rows = table.querySelectorAll('tbody tr');
    const assessment_methods = Array.from(rows).map(r => ({
      component: r.querySelector('[data-field="component"]').value,
      description: r.querySelector('[data-field="description"]').value,
      task_ref: r.querySelector('[data-field="task_ref"]').value,
      weight: parseInt(r.querySelector('[data-field="weight"]').value) || 0,
      clo_codes: Array.from(r.querySelector('[data-field="clo_codes"]').selectedOptions).map(o => o.value),
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
    const tools = Array.isArray(c.tools) ? c.tools : [];
    const dis = editable ? '' : 'disabled';

    body.innerHTML = `
      <div style="max-width:820px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Tài liệu phục vụ học phần (mục 15)</h3>
        <div class="input-group"><label>Tài liệu/giáo trình chính (mỗi dòng = 1 tài liệu)</label>
          <textarea id="ctdt-textbooks" ${dis} rows="3" placeholder="Tên sách, Tác giả, NXB">${_esc(textbooks.join('\n'))}</textarea>
        </div>
        <div class="input-group"><label>Tài liệu tham khảo/bổ sung (mỗi dòng = 1 tài liệu)</label>
          <textarea id="ctdt-references" ${dis} rows="3">${_esc(references.join('\n'))}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:20px 0 8px;">Các công cụ theo lĩnh vực</h4>
        <div id="ctdt-tools-container">
          ${tools.map((t, i) => this._toolCategoryHtml(t, i, editable, dis)).join('')}
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Các yêu cầu của HP (mục 17)</h4>
        <div class="input-group">
          <textarea id="ctdt-other-req" ${dis} rows="3" placeholder="Yêu cầu khác (nếu có)">${_esc(c.other_requirements)}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Giảng viên phụ trách học phần</h4>
        ${this._instructorFormHtml('ctdt-instr', c.instructor || {}, dis)}

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Giảng viên hỗ trợ / Trợ giảng (nếu có)</h4>
        ${this._instructorFormHtml('ctdt-asst', c.assistant_instructor || {}, dis)}

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Cách liên lạc với giảng viên/trợ giảng</h4>
        <div class="input-group">
          <textarea id="ctdt-contact-info" ${dis} rows="2" placeholder="Ví dụ: Email, giờ tiếp sinh viên...">${_esc(c.contact_info)}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Ngày ký</h4>
        <div class="input-group" style="max-width:300px;">
          <input type="text" id="ctdt-signature-date" ${dis} placeholder="VD: 01 tháng 09 năm 2025" value="${_esc(c.signature_date)}">
        </div>
      </div>
    `;
  },

  _toolCategoryHtml(t, i, editable, dis) {
    const items = Array.isArray(t.items) ? t.items.join('\n') : '';
    return `<div class="tool-category" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:8px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;">
        <label style="font-size:12px;white-space:nowrap;">Lĩnh vực:</label>
        <input type="text" data-field="category" value="${_esc(t.category)}" ${dis} placeholder="VD: Phần mềm" style="flex:1;${INP}">
      </div>
      <textarea data-field="items" ${dis} rows="3" placeholder="Mỗi dòng = 1 công cụ" style="${INP}">${_esc(items)}</textarea>
    </div>`;
  },

  _instructorFormHtml(prefix, data, dis) {
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Họ và tên</label><input type="text" id="${prefix}-name" ${dis} value="${_esc(data.name)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Học hàm, học vị</label><input type="text" id="${prefix}-title" ${dis} value="${_esc(data.title)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Địa chỉ cơ quan</label><input type="text" id="${prefix}-address" ${dis} value="${_esc(data.address)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Điện thoại liên hệ</label><input type="text" id="${prefix}-phone" ${dis} value="${_esc(data.phone)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Email</label><input type="text" id="${prefix}-email" ${dis} value="${_esc(data.email)}"></div>
      <div class="input-group" style="margin:0;"><label style="font-size:12px;">Website</label><input type="text" id="${prefix}-website" ${dis} value="${_esc(data.website)}"></div>
    </div>`;
  },

  _collectResources() {
    if (!document.getElementById('ctdt-textbooks')) return; // Tab 5 not mounted
    const toArr = id => (document.getElementById(id)?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
    const toolsContainer = document.getElementById('ctdt-tools-container');
    const tools = toolsContainer ? Array.from(toolsContainer.querySelectorAll('.tool-category')).map(div => ({
      category: div.querySelector('[data-field="category"]').value,
      items: div.querySelector('[data-field="items"]').value.split('\n').map(s => s.trim()).filter(Boolean),
    })).filter(t => t.category || t.items.length) : [];
    const collectInstructor = prefix => ({
      name: document.getElementById(`${prefix}-name`)?.value || '',
      title: document.getElementById(`${prefix}-title`)?.value || '',
      address: document.getElementById(`${prefix}-address`)?.value || '',
      phone: document.getElementById(`${prefix}-phone`)?.value || '',
      email: document.getElementById(`${prefix}-email`)?.value || '',
      website: document.getElementById(`${prefix}-website`)?.value || '',
    });
    this.syllabus.content = {
      ...this.syllabus.content,
      textbooks: toArr('ctdt-textbooks'),
      references: toArr('ctdt-references'),
      tools,
      other_requirements: document.getElementById('ctdt-other-req')?.value || '',
      instructor: collectInstructor('ctdt-instr'),
      assistant_instructor: collectInstructor('ctdt-asst'),
      contact_info: document.getElementById('ctdt-contact-info')?.value || '',
      signature_date: document.getElementById('ctdt-signature-date')?.value || '',
    };
  },

  async saveResources() {
    this._collectResources();
    try {
      await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: this.syllabus.content }) });
      window.toast.success('Đã lưu');
    } catch (e) { window.toast.error(e.message); }
  },

  // ============ LOAD FROM BASE SYLLABUS ============
  async loadFromBase() {
    const confirmed = await window.ui.confirm({
      title: 'Lấy từ đề cương cơ bản',
      eyebrow: 'Xác nhận thao tác',
      message: 'Tải đề cương cơ bản sẽ ghi đè nội dung đề cương CTDT hiện tại. Sau khi tải, chỉ các mục 3, 9, 10 được phép chỉnh sửa. Tiếp tục?',
      confirmText: 'Tải đề cương',
      cancelText: 'Hủy',
      tone: 'warning'
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/syllabi/${this.syllabusId}/load-from-base`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Có lỗi xảy ra');
      }
      window.toast.success('Đã tải đề cương cơ bản + CLO');
      this.render(document.getElementById('page-content'), this.syllabusId);
    } catch (e) { window.toast.error(e.message); }
  },

  // ============ SAVE ALL ============
  async saveAll() {
    try {
      this._collectCurrentTabIntoState();
      await this.saveSection3({ silent: true });
      await this.saveSection9({ silent: true });

      if (this.dirtyMapChanges) {
        const res = await fetch(`/api/syllabi/${this.syllabusId}/clo-pi-map`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mappings: this.dirtyMapChanges }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi lưu mục 10');
        this.dirtyMapChanges = null;
      }

      window.toast.success('Đã lưu mục 3, 9, 10');
      await this.render(document.getElementById('page-content'), this.syllabusId);
    } catch (e) {
      window.toast.error(e.message);
    }
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
      if (window.App.refreshNotificationCount) window.App.refreshNotificationCount();
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
