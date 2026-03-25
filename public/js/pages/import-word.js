// Import Word Page — parse .docx and preview/save as a new program version
window.ImportWordPage = {
  parsedData: null,
  departments: [],
  renderedTabs: {},

  async render(container) {
    this.container = container;
    this.parsedData = null;
    this.renderedTabs = {};

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Import Chương trình từ Word</div>
        </div>
        <div class="card-body" id="iw-body">
          ${this._uploadStepHTML()}
        </div>
      </div>
    `;
    this._bindUpload();
  },

  _uploadStepHTML() {
    return `
      <div id="iw-upload-step">
        <p style="color:var(--text-muted);margin-bottom:16px;">
          Tải lên file <strong>.docx</strong> chứa nội dung chương trình đào tạo để hệ thống phân tích và tạo phiên bản mới.
        </p>
        <div id="iw-drop-zone" style="
          border: 2px dashed var(--border);
          border-radius: 10px;
          padding: 48px 32px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          background: var(--bg-secondary, #f8f9fa);
        ">
          <div style="font-size:48px;margin-bottom:12px;">📄</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px;">Kéo thả file .docx vào đây</div>
          <div style="color:var(--text-muted);margin-bottom:16px;">hoặc</div>
          <button class="btn btn-primary" id="iw-pick-btn">Chọn file</button>
          <input type="file" id="iw-file-input" accept=".docx" style="display:none;">
        </div>
        <div id="iw-upload-error" style="color:var(--danger,#dc3545);margin-top:12px;display:none;"></div>
        <div id="iw-spinner" style="text-align:center;margin-top:24px;display:none;">
          <div class="spinner"></div>
          <div style="margin-top:8px;color:var(--text-muted);">Đang phân tích file...</div>
        </div>
      </div>
    `;
  },

  _bindUpload() {
    const dropZone = document.getElementById('iw-drop-zone');
    const fileInput = document.getElementById('iw-file-input');
    const pickBtn = document.getElementById('iw-pick-btn');

    pickBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
      if (fileInput.files[0]) this._parseFile(fileInput.files[0]);
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--primary, #0d6efd)';
      dropZone.style.background = 'rgba(13,110,253,0.05)';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.background = 'var(--bg-secondary, #f8f9fa)';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.background = 'var(--bg-secondary, #f8f9fa)';
      const file = e.dataTransfer.files[0];
      if (file) this._parseFile(file);
    });
  },

  async _parseFile(file) {
    const errEl = document.getElementById('iw-upload-error');
    errEl.style.display = 'none';

    if (!file.name.endsWith('.docx')) {
      errEl.textContent = 'Chỉ chấp nhận file .docx';
      errEl.style.display = 'block';
      return;
    }

    document.getElementById('iw-spinner').style.display = 'block';
    document.getElementById('iw-pick-btn').disabled = true;

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/import/parse-word', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lỗi phân tích file');
      this.parsedData = json.data || json;
      await this._loadDepartments();
      this._renderPreview();
    } catch (e) {
      document.getElementById('iw-spinner').style.display = 'none';
      document.getElementById('iw-pick-btn').disabled = false;
      errEl.textContent = e.message;
      errEl.style.display = 'block';
    }
  },

  async _loadDepartments() {
    try {
      const res = await fetch('/api/departments');
      if (res.ok) this.departments = await res.json();
    } catch (e) { this.departments = []; }
  },

  _renderPreview() {
    const d = this.parsedData;
    const warnings = d.warnings || [];
    const errors = d.errors || [];
    const errCount = errors.length;
    const warnCount = warnings.length;

    const deptOptions = this.departments.map(dep =>
      `<option value="${dep.id}">${dep.name}</option>`
    ).join('');

    document.getElementById('iw-body').innerHTML = `
      <!-- Warnings bar -->
      <div id="iw-alerts" style="margin-bottom:16px;${(errCount + warnCount) === 0 ? 'display:none;' : ''}">
        ${errCount > 0 ? `<div class="alert alert-danger d-flex align-items-center gap-2 mb-2" style="padding:10px 14px;border-radius:6px;background:#fff5f5;border:1px solid #fca5a5;color:#dc2626;">
          <strong>Lỗi:</strong>
          <span class="badge bg-danger">${errCount}</span>
          <span>${errors.slice(0, 3).join(' | ')}${errCount > 3 ? ` và ${errCount - 3} lỗi khác...` : ''}</span>
        </div>` : ''}
        ${warnCount > 0 ? `<div class="alert alert-warning d-flex align-items-center gap-2 mb-2" style="padding:10px 14px;border-radius:6px;background:#fffbeb;border:1px solid #fcd34d;color:#92400e;">
          <strong>Cảnh báo:</strong>
          <span class="badge bg-warning text-dark">${warnCount}</span>
          <span>${warnings.slice(0, 3).join(' | ')}${warnCount > 3 ? ` và ${warnCount - 3} cảnh báo khác...` : ''}</span>
        </div>` : ''}
      </div>

      <!-- Tab navigation -->
      <ul class="nav nav-tabs" id="iw-tabs" style="flex-wrap:wrap;">
        <li class="nav-item"><button class="nav-link active" data-tab="general">Thông tin chung</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="po">Mục tiêu PO</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="plo">Chuẩn đầu ra PLO</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="pi">Chỉ số PI</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="courses">Danh sách HP</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="blocks">Cấu trúc khối KT</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="po-plo">Ma trận PO-PLO</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="course-pi">Ma trận Course-PI</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="schedule">KH giảng dạy</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="assessment">KH đánh giá</button></li>
        <li class="nav-item"><button class="nav-link" data-tab="descriptions">Mô tả HP</button></li>
      </ul>
      <div id="iw-tab-content" style="border:1px solid #dee2e6;border-top:none;padding:16px;min-height:300px;"></div>

      <!-- Save area -->
      <div style="margin-top:20px;padding:16px;border:1px solid var(--border);border-radius:8px;background:var(--bg-secondary,#f8f9fa);">
        <div style="display:flex;align-items:flex-end;gap:12px;flex-wrap:wrap;">
          <div class="input-group" style="flex:1;min-width:180px;margin:0;">
            <label style="margin-bottom:4px;font-weight:500;">Khoa quản lý <span style="color:var(--danger);">*</span></label>
            <select id="iw-dept-select" class="form-control">${deptOptions}</select>
          </div>
          <div class="input-group" style="flex:1;min-width:150px;margin:0;">
            <label style="margin-bottom:4px;font-weight:500;">Năm học <span style="color:var(--danger);">*</span></label>
            <input type="text" id="iw-year-input" class="form-control" placeholder="VD: 2024-2025" value="${d.academic_year || ''}">
          </div>
          <button class="btn btn-secondary" onclick="window.ImportWordPage._backToUpload()">Quay lại</button>
          <button class="btn btn-primary" id="iw-save-btn" ${errCount > 0 ? 'disabled' : ''} onclick="window.ImportWordPage._confirmSave()">
            Lưu chương trình
          </button>
        </div>
        ${errCount > 0 ? `<div style="color:var(--danger,#dc3545);font-size:13px;margin-top:8px;">Có ${errCount} lỗi cần sửa trước khi lưu.</div>` : ''}
      </div>
    `;

    this._bindTabs();
    this._renderTab('general');
  },

  _bindTabs() {
    document.querySelectorAll('#iw-tabs .nav-link').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('#iw-tabs .nav-link').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.syncEdits();
        this._renderTab(btn.dataset.tab);
      });
    });
  },

  _renderTab(tab) {
    const content = document.getElementById('iw-tab-content');
    if (this.renderedTabs[tab]) {
      content.innerHTML = this.renderedTabs[tab];
      this._bindTabEvents(tab);
      return;
    }
    const html = this._buildTabHTML(tab);
    this.renderedTabs[tab] = html;
    content.innerHTML = html;
    this._bindTabEvents(tab);
  },

  _buildTabHTML(tab) {
    const d = this.parsedData || {};
    switch (tab) {
      case 'general': return this._tabGeneral(d);
      case 'po': return this._tabPO(d);
      case 'plo': return this._tabPLO(d);
      case 'pi': return this._tabPI(d);
      case 'courses': return this._tabCourses(d);
      case 'blocks': return this._tabBlocks(d);
      case 'po-plo': return this._tabPOPLO(d);
      case 'course-pi': return this._tabCoursePI(d);
      case 'schedule': return this._tabSchedule(d);
      case 'assessment': return this._tabAssessment(d);
      case 'descriptions': return this._tabDescriptions(d);
      default: return '<p>Tab không tồn tại.</p>';
    }
  },

  _bindTabEvents(tab) {
    if (tab === 'po-plo') {
      document.querySelectorAll('#iw-tab-content .plo-cell').forEach(cell => {
        cell.addEventListener('click', () => this.togglePOPLO(cell));
      });
    }
  },

  // ======= TAB RENDERERS =======

  _tabGeneral(d) {
    const prog = d.program || {};
    const ver = d.version || {};
    const fields = [
      ['Tên ngành (Việt)', 'program.name', prog.name],
      ['Tên ngành (Anh)', 'program.name_en', prog.name_en],
      ['Mã ngành', 'program.code', prog.code],
      ['Trình độ', 'program.degree', prog.degree],
      ['Tên văn bằng', 'program.degree_name', prog.degree_name],
      ['Tổng tín chỉ', 'program.total_credits', prog.total_credits],
      ['Hình thức đào tạo', 'program.training_mode', prog.training_mode],
      ['Trường cấp bằng', 'program.institution', prog.institution],
      ['Thời gian đào tạo', 'version.training_duration', ver.training_duration],
      ['Thang điểm', 'version.grading_scale', ver.grading_scale],
      ['Điều kiện tốt nghiệp', 'version.graduation_requirements', ver.graduation_requirements],
      ['Đối tượng tuyển sinh', 'version.admission_targets', ver.admission_targets],
      ['Tiêu chí tuyển sinh', 'version.admission_criteria', ver.admission_criteria],
      ['Vị trí việc làm', 'version.job_positions', ver.job_positions],
      ['Học tập nâng cao', 'version.further_education', ver.further_education],
      ['CT tham khảo', 'version.reference_programs', ver.reference_programs],
      ['Quy trình đào tạo', 'version.training_process', ver.training_process],
      ['Mục tiêu chung', 'general_objective', d.general_objective],
    ];
    const rows = fields.map(([label, path, val]) =>
      `<tr>
        <td style="font-weight:500;padding:8px 12px;background:#f8f9fa;white-space:nowrap;width:220px;">${this._escHtml(label)}</td>
        <td contenteditable="true" data-path="${this._escAttr(path)}" style="padding:8px 12px;">${this._escHtml(val ?? '')}</td>
      </tr>`
    ).join('');
    return `
      <h6 style="font-weight:600;margin-bottom:12px;">Thông tin chung</h6>
      <div style="overflow-x:auto;">
        <table class="table table-bordered" style="margin:0;">
          <tbody>${rows || '<tr><td colspan="2" style="color:var(--text-muted);text-align:center;padding:24px;">Không có dữ liệu</td></tr>'}</tbody>
        </table>
      </div>
    `;
  },

  _tabPO(d) {
    const pos = d.objectives || [];
    if (!pos.length) return '<p style="color:var(--text-muted);">Không có dữ liệu mục tiêu PO.</p>';
    const rows = pos.map((po, i) =>
      `<tr>
        <td style="padding:8px 12px;width:100px;" contenteditable="true" data-path="objectives.${i}.code">${this._escHtml(po.code || '')}</td>
        <td style="padding:8px 12px;" contenteditable="true" data-path="objectives.${i}.description">${this._escHtml(po.description || '')}</td>
      </tr>`
    ).join('');
    return `
      <h6 style="font-weight:600;margin-bottom:12px;">Mục tiêu chương trình (PO)</h6>
      <div style="overflow-x:auto;">
        <table class="table table-bordered">
          <thead><tr><th style="width:100px;">Mã PO</th><th>Mô tả</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  _tabPLO(d) {
    const plos = d.plos || [];
    if (!plos.length) return '<p style="color:var(--text-muted);">Không có dữ liệu chuẩn đầu ra PLO.</p>';
    const rows = plos.map((plo, i) =>
      `<tr>
        <td style="padding:8px;" contenteditable="true" data-path="plos.${i}.code">${this._escHtml(plo.code || '')}</td>
        <td style="padding:8px;" contenteditable="true" data-path="plos.${i}.description">${this._escHtml(plo.description || '')}</td>
        <td style="padding:8px;" contenteditable="true" data-path="plos.${i}.bloom_level">${this._escHtml(plo.bloom_level || '')}</td>
        <td style="padding:8px;" contenteditable="true" data-path="plos.${i}.po_codes">${this._escHtml(Array.isArray(plo.po_codes) ? plo.po_codes.join(', ') : (plo.po_codes || ''))}</td>
      </tr>`
    ).join('');
    return `
      <h6 style="font-weight:600;margin-bottom:12px;">Chuẩn đầu ra (PLO)</h6>
      <div style="overflow-x:auto;">
        <table class="table table-bordered">
          <thead><tr><th style="width:90px;">Mã PLO</th><th>Mô tả</th><th style="width:120px;">Bloom</th><th style="width:120px;">PO liên quan</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  _tabPI(d) {
    const pis = d.pis || [];
    if (!pis.length) return '<p style="color:var(--text-muted);">Không có dữ liệu chỉ số PI.</p>';

    // Group by PLO
    const groups = {};
    pis.forEach((pi, i) => {
      const plo = pi.plo_code || 'Khác';
      if (!groups[plo]) groups[plo] = [];
      groups[plo].push({ ...pi, _idx: i });
    });

    const html = Object.entries(groups).map(([plo, items]) => {
      const rows = items.map(pi =>
        `<tr>
          <td style="padding:8px;" contenteditable="true" data-path="pis.${pi._idx}.code">${this._escHtml(pi.code || '')}</td>
          <td style="padding:8px;" contenteditable="true" data-path="pis.${pi._idx}.description">${this._escHtml(pi.description || '')}</td>
        </tr>`
      ).join('');
      return `
        <h6 style="margin:12px 0 6px;font-weight:600;color:var(--primary,#0d6efd);">${this._escHtml(plo)}</h6>
        <table class="table table-bordered table-sm">
          <thead><tr><th style="width:100px;">Mã PI</th><th>Mô tả</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }).join('');
    return `<h6 style="font-weight:600;margin-bottom:12px;">Chỉ số PI (nhóm theo PLO)</h6>${html}`;
  },

  _tabCourses(d) {
    const courses = d.courses || [];
    if (!courses.length) return '<p style="color:var(--text-muted);">Không có dữ liệu học phần.</p>';
    const rows = courses.map((c, i) =>
      `<tr>
        <td style="padding:6px;" contenteditable="true" data-path="courses.${i}.code">${this._escHtml(c.code || '')}</td>
        <td style="padding:6px;" contenteditable="true" data-path="courses.${i}.name">${this._escHtml(c.name || '')}</td>
        <td style="padding:6px;text-align:center;" contenteditable="true" data-path="courses.${i}.credits_total">${this._escHtml(String(c.credits_total ?? ''))}</td>
        <td style="padding:6px;text-align:center;" contenteditable="true" data-path="courses.${i}.credits_theory">${this._escHtml(String(c.credits_theory ?? ''))}</td>
        <td style="padding:6px;text-align:center;" contenteditable="true" data-path="courses.${i}.credits_practice">${this._escHtml(String(c.credits_practice ?? ''))}</td>
        <td style="padding:6px;text-align:center;" contenteditable="true" data-path="courses.${i}.credits_self">${this._escHtml(String(c.credits_self ?? ''))}</td>
        <td style="padding:6px;" contenteditable="true" data-path="courses.${i}.course_type">${this._escHtml(c.course_type || '')}</td>
        <td style="padding:6px;" contenteditable="true" data-path="courses.${i}.prerequisite">${this._escHtml(c.prerequisite || '')}</td>
      </tr>`
    ).join('');
    return `
      <h6 style="font-weight:600;margin-bottom:12px;">Danh sách học phần</h6>
      <div style="overflow-x:auto;">
        <table class="table table-bordered table-sm">
          <thead>
            <tr>
              <th>Mã HP</th><th>Tên học phần</th>
              <th title="Tổng tín chỉ">TC</th>
              <th title="Lý thuyết">LT</th>
              <th title="Thực hành">TH</th>
              <th title="Tự học">Tự học</th>
              <th>Loại HP</th>
              <th>Tiên quyết</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  _tabBlocks(d) {
    const blocks = d.knowledgeBlocks || [];
    if (!blocks.length) return '<p style="color:var(--text-muted);">Không có dữ liệu cấu trúc khối kiến thức.</p>';
    const rows = blocks.map((b, i) =>
      `<tr>
        <td style="padding:8px;" contenteditable="true" data-path="knowledgeBlocks.${i}.name">${this._escHtml(b.name || '')}</td>
        <td style="padding:8px;text-align:center;" contenteditable="true" data-path="knowledgeBlocks.${i}.credits">${this._escHtml(String(b.credits ?? ''))}</td>
        <td style="padding:8px;" contenteditable="true" data-path="knowledgeBlocks.${i}.required">${this._escHtml(b.required || '')}</td>
        <td style="padding:8px;" contenteditable="true" data-path="knowledgeBlocks.${i}.elective">${this._escHtml(b.elective || '')}</td>
      </tr>`
    ).join('');
    return `
      <h6 style="font-weight:600;margin-bottom:12px;">Cấu trúc khối kiến thức</h6>
      <div style="overflow-x:auto;">
        <table class="table table-bordered">
          <thead><tr><th>Tên khối</th><th style="width:80px;">Tín chỉ</th><th>Bắt buộc</th><th>Tự chọn</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  _tabPOPLO(d) {
    const pos = d.objectives || [];
    const plos = d.plos || [];
    const matrix = d.poploMatrix || {};

    if (!pos.length || !plos.length) return '<p style="color:var(--text-muted);">Không có đủ dữ liệu PO/PLO để hiển thị ma trận.</p>';

    const poCodes = pos.map(p => p.code);
    const ploCodes = plos.map(p => p.code);

    const headerCells = poCodes.map(pc => `<th style="text-align:center;padding:6px;min-width:50px;">${this._escHtml(pc)}</th>`).join('');
    const rows = ploCodes.map(ploCode => {
      const cells = poCodes.map(poCode => {
        const key = `${ploCode}|${poCode}`;
        const checked = !!(matrix[key] || matrix[`${poCode}|${ploCode}`]);
        return `<td style="text-align:center;padding:4px;">
          <span class="plo-cell" data-plo="${this._escAttr(ploCode)}" data-po="${this._escAttr(poCode)}" style="
            display:inline-block;width:28px;height:28px;line-height:28px;
            border-radius:4px;cursor:pointer;font-weight:700;font-size:14px;
            background:${checked ? 'var(--primary,#0d6efd)' : '#f0f0f0'};
            color:${checked ? '#fff' : '#ccc'};
            transition:background 0.15s,color 0.15s;
          ">${checked ? 'X' : ''}</span>
        </td>`;
      }).join('');
      return `<tr>
        <td style="padding:6px;font-weight:500;white-space:nowrap;">${this._escHtml(ploCode)}</td>
        ${cells}
      </tr>`;
    }).join('');

    return `
      <h6 style="font-weight:600;margin-bottom:12px;">Ma trận PO-PLO <small style="font-weight:400;color:var(--text-muted);">(click để bật/tắt)</small></h6>
      <div style="overflow-x:auto;">
        <table class="table table-bordered table-sm" id="iw-poplo-table">
          <thead>
            <tr>
              <th style="padding:6px;">PLO \\ PO</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  _tabCoursePI(d) {
    const courses = d.courses || [];
    const pis = d.pis || [];
    const matrix = d.coursePIMatrix || {};

    if (!courses.length || !pis.length) return '<p style="color:var(--text-muted);">Không có đủ dữ liệu course/PI để hiển thị ma trận.</p>';

    const courseCodes = courses.map(c => c.code);
    const piCodes = pis.map(p => p.code);

    const headerCells = piCodes.map(pc => `<th style="text-align:center;padding:4px;min-width:60px;font-size:12px;">${this._escHtml(pc)}</th>`).join('');

    const rows = courseCodes.map(courseCode => {
      const cells = piCodes.map(piCode => {
        const key = `${courseCode}|${piCode}`;
        const val = matrix[key] || '';
        return `<td style="text-align:center;padding:2px;">
          <span contenteditable="true" data-cpi="${this._escAttr(key)}" style="
            display:inline-block;min-width:40px;padding:2px 4px;
            border:1px solid transparent;border-radius:3px;
            font-size:12px;
          " onfocus="this.style.border='1px solid var(--primary,#0d6efd)'" onblur="this.style.border='1px solid transparent'">${this._escHtml(val)}</span>
        </td>`;
      }).join('');
      return `<tr>
        <td style="padding:6px;font-weight:500;white-space:nowrap;font-size:12px;">${this._escHtml(courseCode)}</td>
        ${cells}
      </tr>`;
    }).join('');

    return `
      <h6 style="font-weight:600;margin-bottom:12px;">Ma trận Course-PI</h6>
      <div style="overflow-x:auto;">
        <table class="table table-bordered table-sm" id="iw-coursepi-table">
          <thead>
            <tr>
              <th style="padding:6px;">HP \\ PI</th>
              ${headerCells}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  _tabSchedule(d) {
    const schedule = d.teachingPlan || [];
    if (!schedule.length) return '<p style="color:var(--text-muted);">Không có dữ liệu kế hoạch giảng dạy.</p>';

    // Group by semester
    const groups = {};
    schedule.forEach((item, i) => {
      const sem = item.semester || 'Khác';
      if (!groups[sem]) groups[sem] = [];
      groups[sem].push({ ...item, _idx: i });
    });

    const html = Object.entries(groups).map(([sem, items]) => {
      const rows = items.map(item =>
        `<tr>
          <td style="padding:8px;" contenteditable="true" data-path="teachingPlan.${item._idx}.course_code">${this._escHtml(item.course_code || '')}</td>
          <td style="padding:8px;" contenteditable="true" data-path="teachingPlan.${item._idx}.course_name">${this._escHtml(item.course_name || '')}</td>
          <td style="padding:8px;text-align:center;" contenteditable="true" data-path="teachingPlan.${item._idx}.credits">${this._escHtml(String(item.credits ?? ''))}</td>
          <td style="padding:8px;" contenteditable="true" data-path="teachingPlan.${item._idx}.notes">${this._escHtml(item.notes || '')}</td>
        </tr>`
      ).join('');
      return `
        <h6 style="margin:12px 0 6px;font-weight:600;color:var(--primary,#0d6efd);">Học kỳ ${this._escHtml(String(sem))}</h6>
        <table class="table table-bordered table-sm">
          <thead><tr><th>Mã HP</th><th>Tên học phần</th><th style="width:70px;">TC</th><th>Ghi chú</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      `;
    }).join('');
    return `<h6 style="font-weight:600;margin-bottom:12px;">Kế hoạch giảng dạy (theo học kỳ)</h6>${html}`;
  },

  _tabAssessment(d) {
    const assessments = d.assessmentPlan || [];
    if (!assessments.length) return '<p style="color:var(--text-muted);">Không có dữ liệu kế hoạch đánh giá.</p>';
    const rows = assessments.map((a, i) =>
      `<tr>
        <td style="padding:8px;" contenteditable="true" data-path="assessmentPlan.${i}.course_code">${this._escHtml(a.course_code || '')}</td>
        <td style="padding:8px;" contenteditable="true" data-path="assessmentPlan.${i}.method">${this._escHtml(a.method || '')}</td>
        <td style="padding:8px;text-align:center;" contenteditable="true" data-path="assessmentPlan.${i}.weight">${this._escHtml(String(a.weight ?? ''))}</td>
        <td style="padding:8px;" contenteditable="true" data-path="assessmentPlan.${i}.plo_codes">${this._escHtml(Array.isArray(a.plo_codes) ? a.plo_codes.join(', ') : (a.plo_codes || ''))}</td>
        <td style="padding:8px;" contenteditable="true" data-path="assessmentPlan.${i}.notes">${this._escHtml(a.notes || '')}</td>
      </tr>`
    ).join('');
    return `
      <h6 style="font-weight:600;margin-bottom:12px;">Kế hoạch đánh giá</h6>
      <div style="overflow-x:auto;">
        <table class="table table-bordered table-sm">
          <thead><tr><th>Mã HP</th><th>Phương pháp</th><th style="width:80px;">Trọng số (%)</th><th>PLO liên quan</th><th>Ghi chú</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  },

  _tabDescriptions(d) {
    const descs = d.courseDescriptions || [];
    if (!descs.length) return '<p style="color:var(--text-muted);">Không có dữ liệu mô tả học phần.</p>';
    const items = descs.map((desc, i) =>
      `<div style="border:1px solid var(--border);border-radius:6px;padding:12px;margin-bottom:12px;">
        <div style="display:flex;gap:12px;margin-bottom:8px;">
          <div style="font-weight:600;color:var(--primary,#0d6efd);min-width:80px;" contenteditable="true" data-path="courseDescriptions.${i}.code">${this._escHtml(desc.code || '')}</div>
          <div style="font-weight:500;" contenteditable="true" data-path="courseDescriptions.${i}.name">${this._escHtml(desc.name || '')}</div>
        </div>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Mô tả tiếng Việt:</div>
        <div contenteditable="true" data-path="courseDescriptions.${i}.description_vi" style="padding:6px;border:1px dashed var(--border);border-radius:4px;min-height:40px;font-size:13px;">${this._escHtml(desc.description_vi || '')}</div>
        <div style="font-size:13px;color:var(--text-muted);margin:8px 0 4px;">Mô tả tiếng Anh:</div>
        <div contenteditable="true" data-path="courseDescriptions.${i}.description_en" style="padding:6px;border:1px dashed var(--border);border-radius:4px;min-height:40px;font-size:13px;">${this._escHtml(desc.description_en || '')}</div>
      </div>`
    ).join('');
    return `<h6 style="font-weight:600;margin-bottom:12px;">Mô tả học phần</h6>${items}`;
  },

  // ======= SYNC & TOGGLE =======

  syncEdits() {
    // Sync contenteditable cells with data-path back to parsedData
    document.querySelectorAll('[data-path]').forEach(el => {
      const path = el.dataset.path;
      const value = el.textContent;
      this._setPath(this.parsedData, path, value);
    });

    // Sync Course-PI matrix cells with data-cpi
    document.querySelectorAll('[data-cpi]').forEach(el => {
      const key = el.dataset.cpi;
      const value = el.textContent.trim();
      if (!this.parsedData.coursePIMatrix) this.parsedData.coursePIMatrix = {};
      this.parsedData.coursePIMatrix[key] = value;
    });

    // Invalidate rendered tab cache so re-renders use updated data
    this.renderedTabs = {};
  },

  _setPath(obj, path, value) {
    const parts = path.split('.');
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (cur[p] === undefined || cur[p] === null) {
        cur[p] = isNaN(parts[i + 1]) ? {} : [];
      }
      cur = cur[p];
    }
    const last = parts[parts.length - 1];
    cur[last] = value;
  },

  togglePOPLO(cell) {
    const ploCode = cell.dataset.plo;
    const poCode = cell.dataset.po;
    const key = `${ploCode}|${poCode}`;
    if (!this.parsedData.poploMatrix) this.parsedData.poploMatrix = {};
    const current = !!this.parsedData.poploMatrix[key];
    this.parsedData.poploMatrix[key] = !current;
    if (!current) {
      cell.textContent = 'X';
      cell.style.background = 'var(--primary,#0d6efd)';
      cell.style.color = '#fff';
    } else {
      cell.textContent = '';
      cell.style.background = '#f0f0f0';
      cell.style.color = '#ccc';
    }
    // Invalidate po-plo tab cache
    delete this.renderedTabs['po-plo'];
  },

  // ======= SAVE =======

  async _confirmSave() {
    this.syncEdits();

    const deptSelect = document.getElementById('iw-dept-select');
    const yearInput = document.getElementById('iw-year-input');

    if (!deptSelect || !deptSelect.value) {
      window.toast.error('Vui lòng chọn khoa quản lý.');
      return;
    }
    if (!yearInput || !yearInput.value.trim()) {
      window.toast.error('Vui lòng nhập năm học.');
      return;
    }

    const confirmed = confirm(
      `Xác nhận lưu chương trình đào tạo?\n\nKhoa: ${deptSelect.options[deptSelect.selectedIndex]?.text}\nNăm học: ${yearInput.value.trim()}`
    );
    if (!confirmed) return;

    const saveBtn = document.getElementById('iw-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang lưu...';

    try {
      const data = this.parsedData;
      if (data.version) data.version.academic_year = yearInput.value.trim();
      const payload = {
        ...data,
        department_id: parseInt(deptSelect.value, 10),
      };
      const res = await fetch('/api/import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lỗi lưu dữ liệu');
      window.toast.success('Đã lưu chương trình thành công!');
      window.App.navigate('version-editor', { versionId: json.version_id });
    } catch (e) {
      window.toast.error(e.message);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Lưu chương trình';
    }
  },

  _backToUpload() {
    this.parsedData = null;
    this.renderedTabs = {};
    document.getElementById('iw-body').innerHTML = this._uploadStepHTML();
    this._bindUpload();
  },

  // ======= HELPERS =======

  _escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  _escAttr(str) {
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
};
