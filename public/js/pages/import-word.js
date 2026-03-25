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
      <div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <button class="btn btn-secondary btn-sm" onclick="window.App.navigate('programs')">← Quay lại</button>
          <span style="color:var(--text-muted);">/ Import</span>
        </div>
        <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.3px;">Import Chương trình từ Word</h1>
      </div>
      <div id="iw-body">
        ${this._uploadStepHTML()}
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
          border-radius: var(--radius-lg);
          padding: 48px 32px;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.2s, background 0.2s;
          background: var(--bg-secondary);
        ">
          <div style="font-size:48px;margin-bottom:12px;">📄</div>
          <div style="font-size:16px;font-weight:600;margin-bottom:8px;">Kéo thả file .docx vào đây</div>
          <div style="color:var(--text-muted);margin-bottom:16px;">hoặc</div>
          <button class="btn btn-primary" id="iw-pick-btn">Chọn file</button>
          <input type="file" id="iw-file-input" accept=".docx" style="display:none;">
        </div>
        <div id="iw-upload-error" style="color:var(--danger);margin-top:12px;display:none;"></div>
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
      dropZone.style.borderColor = 'var(--primary)';
      dropZone.style.background = 'rgba(35,131,226,0.05)';
    });
    dropZone.addEventListener('dragleave', () => {
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.background = 'var(--bg-secondary)';
    });
    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.background = 'var(--bg-secondary)';
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
      if (res.ok) this.allDepartments = await res.json();
      this.departments = this.allDepartments.filter(d => d.type === 'KHOA' || d.type === 'VIEN' || d.type === 'TRUNG_TAM');
    } catch (e) { this.allDepartments = []; this.departments = []; }
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
      <!-- Warnings/errors bar -->
      ${(errCount + warnCount) > 0 ? `<div style="margin-bottom:16px;">
        ${errCount > 0 ? `<div style="padding:10px 14px;border-radius:var(--radius-lg);background:var(--danger-bg);border:1px solid var(--danger);color:var(--danger);margin-bottom:8px;display:flex;align-items:center;gap:8px;">
          <strong>Lỗi:</strong>
          <span class="badge badge-danger">${errCount}</span>
          <span>${this._escHtml(errors.slice(0, 3).join(' | '))}${errCount > 3 ? ` và ${errCount - 3} lỗi khác...` : ''}</span>
        </div>` : ''}
        ${warnCount > 0 ? `<div style="padding:10px 14px;border-radius:var(--radius-lg);background:var(--warning-bg);border:1px solid var(--warning);color:var(--warning);display:flex;align-items:center;gap:8px;">
          <strong>Cảnh báo:</strong>
          <span class="badge badge-warning">${warnCount}</span>
          <span>${this._escHtml(warnings.slice(0, 3).join(' | '))}${warnCount > 3 ? ` và ${warnCount - 3} cảnh báo khác...` : ''}</span>
        </div>` : ''}
      </div>` : ''}

      <!-- Save area -->
      <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-bottom:16px;padding:14px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
        <div class="input-group" style="min-width:180px;flex:1;margin:0;"><label>Khoa quản lý <span style="color:var(--danger);">*</span></label><select id="iw-dept-select">${deptOptions}</select></div>
        <div class="input-group" style="min-width:160px;flex:1;margin:0;"><label>Ngành</label><select id="iw-nganh-select"><option value="">— Toàn khoa —</option></select></div>
        <div class="input-group" style="width:140px;margin:0;"><label>Năm học <span style="color:var(--danger);">*</span></label><input type="text" id="iw-year-input" placeholder="2024-2025" value="${this._escAttr(d.version?.academic_year || d.academic_year || '')}"></div>
        <button class="btn btn-secondary btn-sm" onclick="window.ImportWordPage._backToUpload()">← Chọn lại file</button>
        <button class="btn btn-primary btn-sm" id="iw-save-btn" ${errCount > 0 ? 'disabled' : ''} onclick="window.ImportWordPage._confirmSave()">Lưu chương trình</button>
      </div>
      ${errCount > 0 ? `<div style="color:var(--danger);font-size:13px;margin-bottom:12px;">Có ${errCount} lỗi cần sửa trước khi lưu.</div>` : ''}

      <!-- Tab navigation -->
      <div class="tab-bar" id="iw-tabs">
        <div class="tab-item active" data-tab="general">Thông tin</div>
        <div class="tab-item" data-tab="po">Mục tiêu PO</div>
        <div class="tab-item" data-tab="plo">Chuẩn đầu ra PLO</div>
        <div class="tab-item" data-tab="pi">Chỉ số PI</div>
        <div class="tab-item" data-tab="courses">Danh sách HP</div>
        <div class="tab-item" data-tab="blocks">Cấu trúc khối KT</div>
        <div class="tab-item" data-tab="po-plo">Ma trận PO-PLO</div>
        <div class="tab-item" data-tab="course-pi">Ma trận Course-PI</div>
        <div class="tab-item" data-tab="schedule">KH giảng dạy</div>
        <div class="tab-item" data-tab="assessment">KH đánh giá</div>
        <div class="tab-item" data-tab="descriptions">Mô tả HP</div>
      </div>
      <div id="iw-tab-content" style="min-height:300px;padding-top:16px;"></div>
    `;

    this._bindTabs();
    this._bindDeptNganh();
    this._renderTab('general');
  },

  _bindDeptNganh() {
    const deptSel = document.getElementById('iw-dept-select');
    const nganhSel = document.getElementById('iw-nganh-select');
    const updateNganh = () => {
      const khoaId = deptSel.value;
      const children = (this.allDepartments || []).filter(d => d.parent_id == khoaId && d.type === 'BO_MON');
      nganhSel.innerHTML = '<option value="">— Toàn khoa —</option>' +
        children.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
    };
    deptSel.addEventListener('change', updateNganh);
    updateNganh();
  },

  _bindTabs() {
    document.querySelectorAll('#iw-tabs .tab-item').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('#iw-tabs .tab-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        this.syncEdits();
        this._renderTab(el.dataset.tab);
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
    if (tab === 'course-pi') {
      document.querySelectorAll('#iw-tab-content select[data-cpi]').forEach(sel => {
        sel.addEventListener('change', () => {
          const key = sel.dataset.cpi;
          if (!this.parsedData.coursePIMatrix) this.parsedData.coursePIMatrix = {};
          this.parsedData.coursePIMatrix[key] = sel.value;
          delete this.renderedTabs['course-pi'];
        });
      });
    }
  },

  // ======= TAB RENDERERS =======

  _tabGeneral(d) {
    const prog = d.program || {};
    const ver = d.version || {};
    const longTextPaths = ['version.job_positions', 'general_objective', 'version.graduation_requirements', 'version.training_process', 'version.reference_programs'];
    const fields = [
      ['Tên ngành (Việt)', 'program.name', prog.name],
      ['Tên ngành (Anh)', 'program.name_en', prog.name_en],
      ['Mã ngành', 'program.code', prog.code],
      ['Trình độ', 'program.degree', prog.degree],
      ['Tên văn bằng', 'program.degree_name', prog.degree_name],
      ['Tổng tín chỉ', 'program.total_credits', prog.total_credits],
      ['Hình thức đào tạo', 'program.training_mode', prog.training_mode],
      ['Trường cấp bằng', 'program.institution', prog.institution],
    ];
    const versionFields = [
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

    const renderField = ([label, path, val]) => {
      const isLong = longTextPaths.includes(path);
      if (isLong) {
        return `<div class="input-group" style="margin:0 0 12px;">
          <label>${this._escHtml(label)}</label>
          <textarea rows="3" data-path="${this._escAttr(path)}">${this._escHtml(val ?? '')}</textarea>
        </div>`;
      }
      return `<div class="input-group" style="margin:0 0 12px;">
        <label>${this._escHtml(label)}</label>
        <input type="text" data-path="${this._escAttr(path)}" value="${this._escAttr(val ?? '')}">
      </div>`;
    };

    return `
      <div style="max-width:480px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Thông tin ngành</h3>
        ${fields.map(renderField).join('')}
        <h3 style="font-size:15px;font-weight:600;margin:24px 0 16px;">Thông tin phiên bản</h3>
        ${versionFields.map(renderField).join('')}
      </div>
    `;
  },

  _tabPO(d) {
    const pos = d.objectives || [];
    if (!pos.length) return '<p style="color:var(--text-muted);font-size:13px;">Không có dữ liệu mục tiêu PO.</p>';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Mục tiêu chương trình (PO)</h3>
        <span style="color:var(--text-muted);font-size:13px;">${pos.length} mục tiêu</span>
      </div>
      <div id="iw-po-list">
        ${pos.map((po, i) => `
          <div class="tree-node" style="display:flex;justify-content:space-between;align-items:start;">
            <div style="flex:1;">
              <strong style="color:var(--primary);">${this._escHtml(po.code || '')}</strong>
              <span contenteditable="true" data-path="objectives.${i}.description" style="color:var(--text-muted);margin-left:8px;font-size:13px;">${this._escHtml(po.description || '')}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  _tabPLO(d) {
    const plos = d.plos || [];
    if (!plos.length) return '<p style="color:var(--text-muted);font-size:13px;">Không có dữ liệu chuẩn đầu ra PLO.</p>';
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Chuẩn đầu ra (PLO)</h3>
        <span style="color:var(--text-muted);font-size:13px;">${plos.length} PLO</span>
      </div>
      <table class="data-table">
        <thead><tr><th style="width:90px;">Mã</th><th style="width:80px;">Bloom</th><th>Mô tả</th><th style="width:120px;">PO liên quan</th></tr></thead>
        <tbody>
          ${plos.map((plo, i) => `
            <tr>
              <td><strong style="color:var(--primary);" contenteditable="true" data-path="plos.${i}.code">${this._escHtml(plo.code || '')}</strong></td>
              <td><span class="badge badge-info">${this._escHtml(String(plo.bloom_level ?? ''))}</span></td>
              <td style="font-size:13px;" contenteditable="true" data-path="plos.${i}.description">${this._escHtml(plo.description || '')}</td>
              <td contenteditable="true" data-path="plos.${i}.po_codes" style="font-size:13px;">${this._escHtml(Array.isArray(plo.po_codes) ? plo.po_codes.join(', ') : (plo.po_codes || ''))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  _tabPI(d) {
    const pis = d.pis || [];
    if (!pis.length) return '<p style="color:var(--text-muted);font-size:13px;">Không có dữ liệu chỉ số PI.</p>';

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
          <td style="width:100px;" contenteditable="true" data-path="pis.${pi._idx}.code"><strong style="color:var(--primary);">${this._escHtml(pi.code || '')}</strong></td>
          <td style="font-size:13px;" contenteditable="true" data-path="pis.${pi._idx}.description">${this._escHtml(pi.description || '')}</td>
        </tr>`
      ).join('');
      return `
        <div style="margin-bottom:20px;">
          <div style="display:flex;align-items:center;margin-bottom:8px;">
            <strong style="color:var(--primary);">${this._escHtml(plo)}</strong>
            <span style="color:var(--text-muted);font-size:12px;margin-left:8px;">${items.length} PI</span>
          </div>
          <table class="data-table">
            <thead><tr><th style="width:100px;">Mã PI</th><th>Mô tả</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
    }).join('');
    return `
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Chỉ số PI (nhóm theo PLO)</h3>
      ${html}
    `;
  },

  _tabCourses(d) {
    const courses = d.courses || [];
    if (!courses.length) return '<p style="color:var(--text-muted);font-size:13px;">Không có dữ liệu học phần.</p>';
    const totalCredits = courses.reduce((s, c) => s + (Number(c.credits_total) || 0), 0);
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Danh sách học phần</h3>
        <span style="color:var(--text-muted);font-size:13px;">${totalCredits} TC / ${courses.length} HP</span>
      </div>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Mã</th><th>Tên HP</th>
              <th title="Tổng tín chỉ" style="width:50px;">TC</th>
              <th title="Lý thuyết" style="width:40px;">LT</th>
              <th title="Thực hành" style="width:40px;">TH</th>
              <th title="Đồ án" style="width:40px;">ĐA</th>
              <th title="Thực tập" style="width:40px;">TT</th>
              <th style="width:50px;">HK</th>
              <th style="width:80px;">Loại</th>
              <th>Nhóm TC</th>
            </tr>
          </thead>
          <tbody>
            ${courses.map((c, i) => {
              const typeLabel = (c.course_type || '').toLowerCase();
              const isRequired = typeLabel === 'required' || typeLabel === 'bắt buộc' || typeLabel === 'bb';
              const typeBadge = isRequired ? 'badge-success' : 'badge-warning';
              const typeText = isRequired ? 'BB' : 'TC';
              return `<tr>
                <td contenteditable="true" data-path="courses.${i}.code"><strong>${this._escHtml(c.code || '')}</strong></td>
                <td contenteditable="true" data-path="courses.${i}.name">${this._escHtml(c.name || '')}</td>
                <td style="text-align:center;" contenteditable="true" data-path="courses.${i}.credits_total">${this._escHtml(String(c.credits_total ?? ''))}</td>
                <td style="text-align:center;" contenteditable="true" data-path="courses.${i}.credits_theory">${this._escHtml(String(c.credits_theory ?? ''))}</td>
                <td style="text-align:center;" contenteditable="true" data-path="courses.${i}.credits_practice">${this._escHtml(String(c.credits_practice ?? ''))}</td>
                <td style="text-align:center;" contenteditable="true" data-path="courses.${i}.credits_project">${this._escHtml(String(c.credits_project ?? ''))}</td>
                <td style="text-align:center;" contenteditable="true" data-path="courses.${i}.credits_internship">${this._escHtml(String(c.credits_internship ?? ''))}</td>
                <td style="text-align:center;">${c.semester ? `<span class="badge badge-info">HK ${this._escHtml(String(c.semester))}</span>` : ''}</td>
                <td><span class="badge ${typeBadge}">${typeText}</span></td>
                <td contenteditable="true" data-path="courses.${i}.elective_group" style="font-size:13px;">${this._escHtml(c.elective_group || '')}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  _tabBlocks(d) {
    const blocks = d.knowledgeBlocks || [];
    if (!blocks.length) return '<p style="color:var(--text-muted);font-size:13px;">Không có dữ liệu cấu trúc khối kiến thức.</p>';
    return `
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Cấu trúc khối kiến thức</h3>
      <table class="data-table">
        <thead><tr><th>Tên khối</th><th style="width:80px;">Tổng TC</th><th style="width:80px;">BB</th><th style="width:80px;">TC</th></tr></thead>
        <tbody>
          ${blocks.map((b, i) => {
            const isParent = b.is_parent || b.parent === true || b.level === 0;
            return `<tr>
              <td style="${isParent ? 'font-weight:600;' : 'padding-left:24px;'}" contenteditable="true" data-path="knowledgeBlocks.${i}.name">${this._escHtml(b.name || '')}</td>
              <td style="text-align:center;" contenteditable="true" data-path="knowledgeBlocks.${i}.credits">${this._escHtml(String(b.credits ?? ''))}</td>
              <td style="text-align:center;" contenteditable="true" data-path="knowledgeBlocks.${i}.required">${this._escHtml(String(b.required ?? ''))}</td>
              <td style="text-align:center;" contenteditable="true" data-path="knowledgeBlocks.${i}.elective">${this._escHtml(String(b.elective ?? ''))}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  },

  _tabPOPLO(d) {
    const pos = d.objectives || [];
    const plos = d.plos || [];
    const matrix = d.poploMatrix || {};

    if (!pos.length || !plos.length) return '<p style="color:var(--text-muted);font-size:13px;">Không có đủ dữ liệu PO/PLO để hiển thị ma trận.</p>';

    const poCodes = pos.map(p => p.code);
    const ploCodes = plos.map(p => p.code);

    const headerCells = poCodes.map(pc => `<th style="text-align:center;min-width:50px;font-size:12px;">${this._escHtml(pc)}</th>`).join('');
    const rows = ploCodes.map(ploCode => {
      const cells = poCodes.map(poCode => {
        const key = `${ploCode}|${poCode}`;
        const checked = !!(matrix[key] || matrix[`${poCode}|${ploCode}`]);
        return `<td style="text-align:center;padding:4px;">
          <span class="plo-cell" data-plo="${this._escAttr(ploCode)}" data-po="${this._escAttr(poCode)}" style="
            display:inline-block;width:28px;height:28px;line-height:28px;
            border-radius:var(--radius);cursor:pointer;font-weight:700;font-size:14px;
            background:${checked ? 'var(--primary)' : 'var(--bg-secondary)'};
            color:${checked ? '#fff' : 'var(--text-muted)'};
            transition:background 0.15s,color 0.15s;
          ">${checked ? 'X' : ''}</span>
        </td>`;
      }).join('');
      return `<tr>
        <td style="position:sticky;left:0;z-index:5;background:#fff;box-shadow:inset -1px 0 0 var(--border);font-weight:500;white-space:nowrap;">${this._escHtml(ploCode)}</td>
        ${cells}
      </tr>`;
    }).join('');

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Ma trận PO-PLO</h3>
        <span style="color:var(--text-muted);font-size:12px;">Click để bật/tắt</span>
      </div>
      <div style="overflow-x:auto;padding-bottom:16px;">
        <table class="data-table" id="iw-poplo-table" style="white-space:nowrap;">
          <thead>
            <tr>
              <th style="position:sticky;left:0;z-index:10;background:var(--bg-secondary);box-shadow:inset -1px 0 0 var(--border);">PLO \\ PO</th>
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

    if (!courses.length || !pis.length) return '<p style="color:var(--text-muted);font-size:13px;">Không có đủ dữ liệu course/PI để hiển thị ma trận.</p>';

    const courseCodes = courses.map(c => c.code);
    const piCodes = pis.map(p => p.code);

    const headerCells = piCodes.map(pc => `<th style="text-align:center;min-width:55px;font-size:11px;padding:4px;">${this._escHtml(pc)}</th>`).join('');

    const rows = courseCodes.map(courseCode => {
      const cells = piCodes.map(piCode => {
        const key = `${courseCode}|${piCode}`;
        const val = matrix[key] || '0';
        return `<td style="text-align:center;padding:2px;">
          <select data-cpi="${this._escAttr(key)}" style="width:38px;padding:1px;font-size:11px;border:1px solid var(--border);border-radius:var(--radius);cursor:pointer;font-family:inherit;">
            <option value="0" ${val === '0' || val === '' || val === 0 ? 'selected' : ''}>—</option>
            <option value="1" ${val === '1' || val === 1 ? 'selected' : ''}>1</option>
            <option value="2" ${val === '2' || val === 2 ? 'selected' : ''}>2</option>
            <option value="3" ${val === '3' || val === 3 ? 'selected' : ''}>3</option>
          </select>
        </td>`;
      }).join('');
      return `<tr>
        <td style="position:sticky;left:0;z-index:5;background:#fff;box-shadow:inset -1px 0 0 var(--border);font-size:12px;white-space:nowrap;"><strong>${this._escHtml(courseCode)}</strong></td>
        ${cells}
      </tr>`;
    }).join('');

    return `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Ma trận Course-PI</h3>
        <span style="color:var(--text-muted);font-size:12px;">— = 0, 1 = Thấp, 2 = TB, 3 = Cao</span>
      </div>
      <div style="overflow-x:auto;padding-bottom:16px;">
        <table class="data-table" id="iw-coursepi-table" style="white-space:nowrap;">
          <thead>
            <tr>
              <th style="position:sticky;left:0;z-index:10;background:var(--bg-secondary);box-shadow:inset -1px 0 0 var(--border);">HP \\ PI</th>
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
    if (!schedule.length) return '<p style="color:var(--text-muted);font-size:13px;">Không có dữ liệu kế hoạch giảng dạy.</p>';

    // Group by semester
    const groups = {};
    schedule.forEach((item, i) => {
      const sem = item.semester || 'Khác';
      if (!groups[sem]) groups[sem] = [];
      groups[sem].push({ ...item, _idx: i });
    });

    const semKeys = Object.keys(groups).sort((a, b) => a - b);

    return `
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Kế hoạch giảng dạy</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:24px;">
        ${semKeys.map(sem => {
          const items = groups[sem];
          const semCredits = items.reduce((s, it) => s + (Number(it.credits) || 0), 0);
          return `
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                <strong style="font-size:14px;">Học kỳ ${this._escHtml(String(sem))}</strong>
                <span style="color:var(--text-muted);font-size:12px;">${semCredits} TC</span>
              </div>
              ${items.map(item => `
                <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;border-bottom:1px solid var(--divider);">
                  <span>
                    <strong contenteditable="true" data-path="teachingPlan.${item._idx}.course_code">${this._escHtml(item.course_code || '')}</strong>
                    <span contenteditable="true" data-path="teachingPlan.${item._idx}.course_name" style="margin-left:4px;">${this._escHtml(item.course_name || '')}</span>
                  </span>
                  <span style="color:var(--text-muted);" contenteditable="true" data-path="teachingPlan.${item._idx}.credits">${this._escHtml(String(item.credits ?? ''))}</span>
                </div>
              `).join('')}
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  _tabAssessment(d) {
    const assessments = d.assessmentPlan || [];
    if (!assessments.length) return '<p style="color:var(--text-muted);font-size:13px;">Không có dữ liệu kế hoạch đánh giá.</p>';
    return `
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Kế hoạch đánh giá</h3>
      <div style="overflow-x:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>PLO</th><th>PI</th><th>HP mẫu</th><th>Công cụ</th><th>Tiêu chuẩn</th><th>Ngưỡng</th><th>HK</th><th>GV</th><th>Đơn vị</th>
            </tr>
          </thead>
          <tbody>
            ${assessments.map((a, i) => `
              <tr>
                <td contenteditable="true" data-path="assessmentPlan.${i}.plo_codes" style="font-size:13px;">${this._escHtml(Array.isArray(a.plo_codes) ? a.plo_codes.join(', ') : (a.plo_codes || ''))}</td>
                <td contenteditable="true" data-path="assessmentPlan.${i}.pi_codes" style="font-size:13px;">${this._escHtml(Array.isArray(a.pi_codes) ? a.pi_codes.join(', ') : (a.pi_codes || ''))}</td>
                <td contenteditable="true" data-path="assessmentPlan.${i}.course_code" style="font-size:13px;">${this._escHtml(a.course_code || '')}</td>
                <td contenteditable="true" data-path="assessmentPlan.${i}.method" style="font-size:13px;">${this._escHtml(a.method || '')}</td>
                <td contenteditable="true" data-path="assessmentPlan.${i}.criteria" style="font-size:13px;">${this._escHtml(a.criteria || '')}</td>
                <td contenteditable="true" data-path="assessmentPlan.${i}.weight" style="font-size:13px;text-align:center;">${this._escHtml(String(a.weight ?? ''))}</td>
                <td contenteditable="true" data-path="assessmentPlan.${i}.semester" style="font-size:13px;text-align:center;">${this._escHtml(String(a.semester ?? ''))}</td>
                <td contenteditable="true" data-path="assessmentPlan.${i}.instructor" style="font-size:13px;">${this._escHtml(a.instructor || '')}</td>
                <td contenteditable="true" data-path="assessmentPlan.${i}.notes" style="font-size:13px;">${this._escHtml(a.notes || '')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  },

  _tabDescriptions(d) {
    const descs = d.courseDescriptions || [];
    if (!descs.length) return '<p style="color:var(--text-muted);font-size:13px;">Không có dữ liệu mô tả học phần.</p>';
    return `
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Mô tả học phần</h3>
      <table class="data-table">
        <thead><tr><th style="width:100px;">Mã HP</th><th style="width:200px;">Tên HP</th><th>Mô tả</th></tr></thead>
        <tbody>
          ${descs.map((desc, i) => `
            <tr>
              <td contenteditable="true" data-path="courseDescriptions.${i}.code"><strong style="color:var(--primary);">${this._escHtml(desc.code || '')}</strong></td>
              <td contenteditable="true" data-path="courseDescriptions.${i}.name" style="font-size:13px;">${this._escHtml(desc.name || '')}</td>
              <td contenteditable="true" data-path="courseDescriptions.${i}.description_vi" style="font-size:13px;">${this._escHtml(desc.description_vi || '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  },

  // ======= SYNC & TOGGLE =======

  syncEdits() {
    // Sync input/textarea/contenteditable cells with data-path back to parsedData
    document.querySelectorAll('[data-path]').forEach(el => {
      const path = el.dataset.path;
      let value;
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        value = el.value;
      } else {
        value = el.textContent;
      }
      this._setPath(this.parsedData, path, value);
    });

    // Sync Course-PI matrix selects with data-cpi
    document.querySelectorAll('select[data-cpi]').forEach(el => {
      const key = el.dataset.cpi;
      if (!this.parsedData.coursePIMatrix) this.parsedData.coursePIMatrix = {};
      this.parsedData.coursePIMatrix[key] = el.value;
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
      cell.style.background = 'var(--primary)';
      cell.style.color = '#fff';
    } else {
      cell.textContent = '';
      cell.style.background = 'var(--bg-secondary)';
      cell.style.color = 'var(--text-muted)';
    }
    // Invalidate po-plo tab cache
    delete this.renderedTabs['po-plo'];
  },

  // ======= SAVE =======

  async _confirmSave() {
    this.syncEdits();

    const deptSelect = document.getElementById('iw-dept-select');
    const nganhSelect = document.getElementById('iw-nganh-select');
    const yearInput = document.getElementById('iw-year-input');

    if (!deptSelect || !deptSelect.value) {
      window.toast.error('Vui lòng chọn khoa quản lý.');
      return;
    }
    if (!yearInput || !yearInput.value.trim()) {
      window.toast.error('Vui lòng nhập năm học.');
      return;
    }

    // Use ngành if selected, otherwise use khoa
    const selectedDeptId = nganhSelect?.value || deptSelect.value;
    const selectedDeptName = nganhSelect?.value
      ? nganhSelect.options[nganhSelect.selectedIndex]?.text
      : deptSelect.options[deptSelect.selectedIndex]?.text;

    const confirmed = confirm(
      `Xác nhận lưu chương trình đào tạo?\n\nĐơn vị: ${selectedDeptName}\nNăm học: ${yearInput.value.trim()}`
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
        department_id: parseInt(selectedDeptId, 10),
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
