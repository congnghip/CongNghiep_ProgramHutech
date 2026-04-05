// Import Word Page — parse .docx, show summary, save draft, redirect to version-editor
window.ImportWordPage = {
  parsedData: null,
  departments: [],
  allDepartments: [],

  async render(container) {
    this.container = container;
    this.parsedData = null;

    container.innerHTML = `
      <div style="margin-bottom:24px;">
        <div class="flex-row mb-2">
          <button class="btn btn-secondary btn-sm" onclick="window.App.navigate('programs')">← Quay lại</button>
          <span class="text-muted">/ Import</span>
        </div>
        <h1 class="page-title">Import Chương trình từ Word</h1>
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
      // Check if program code already exists
      this.existingProgram = null;
      const code = this.parsedData?.program?.code;
      if (code) {
        const programs = await fetch('/api/programs').then(r => r.json());
        const found = programs.find(p => p.code === code);
        if (found) this.existingProgram = found;
      }
      this._renderSummary();
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

  _renderSummary() {
    const d = this.parsedData;
    const warnings = d.warnings || [];
    const errors = d.errors || [];
    const errCount = errors.length;
    const warnCount = warnings.length;
    const prog = d.program || {};
    const ver = d.version || {};

    // Stats
    const stats = [
      { label: 'Tên ngành', value: prog.name || '—', icon: '🎓' },
      { label: 'Mã ngành', value: prog.code || '—', icon: '🔢' },
      { label: 'Trình độ', value: prog.degree || '—', icon: '📋' },
      { label: 'Tổng tín chỉ', value: prog.total_credits || '—', icon: '📊' },
      { label: 'Mục tiêu PO', value: (d.objectives || []).length, icon: '🎯' },
      { label: 'Chuẩn đầu ra PLO', value: (d.plos || []).length, icon: '📐' },
      { label: 'Chỉ số PI', value: (d.pis || []).length, icon: '📏' },
      { label: 'Học phần', value: (d.courses || []).length, icon: '📚' },
      { label: 'Khối kiến thức', value: (d.knowledgeBlocks || []).length, icon: '🧱' },
      { label: 'KH giảng dạy', value: (d.teachingPlan || []).length + ' mục', icon: '📅' },
      { label: 'KH đánh giá', value: (d.assessmentPlan || []).length + ' mục', icon: '✅' },
      { label: 'Mô tả HP', value: (d.courseDescriptions || []).length, icon: '📝' },
    ];

    const deptOptions = this.departments.map(dep =>
      `<option value="${dep.id}">${dep.name}</option>`
    ).join('');

    document.getElementById('iw-body').innerHTML = `
      <!-- Errors -->
      ${errCount > 0 ? `<div style="padding:12px 16px;border-radius:var(--radius-lg);background:var(--danger-bg);border:1px solid var(--danger);color:var(--danger);margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <strong>Lỗi (${errCount})</strong>
          <span style="font-size:12px;">— Cần sửa file Word và upload lại</span>
        </div>
        <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.8;">
          ${errors.map(e => `<li>${this._esc(e)}</li>`).join('')}
        </ul>
      </div>` : ''}

      <!-- Warnings -->
      ${warnCount > 0 ? `<div style="padding:12px 16px;border-radius:var(--radius-lg);background:var(--warning-bg);border:1px solid var(--warning);color:var(--warning);margin-bottom:12px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
          <strong>Cảnh báo (${warnCount})</strong>
          <span style="font-size:12px;">— Có thể chỉnh sửa sau khi tạo bản nháp</span>
        </div>
        <ul style="margin:0;padding-left:20px;font-size:13px;line-height:1.8;">
          ${warnings.map(w => `<li>${this._esc(w)}</li>`).
          join('')}
        </ul>
      </div>` : ''}

      <!-- Success message if no errors -->
      ${errCount === 0 ? `<div style="padding:12px 16px;border-radius:var(--radius-lg);background:var(--success-bg);border:1px solid var(--success);color:var(--success);margin-bottom:12px;display:flex;align-items:center;gap:8px;">
        <strong>Phân tích thành công!</strong>
        <span style="font-size:13px;">Dữ liệu sẵn sàng để tạo bản nháp${warnCount > 0 ? ` (${warnCount} cảnh báo)` : ''}.</span>
      </div>` : ''}

      <!-- Stats grid -->
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Tổng kết nội dung</h3>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:24px;">
        ${stats.map(s => `
          <div style="padding:12px 16px;background:var(--bg-secondary);border-radius:var(--radius-lg);display:flex;align-items:center;gap:10px;">
            <span style="font-size:20px;">${s.icon}</span>
            <div>
              <div style="font-size:12px;color:var(--text-muted);">${s.label}</div>
              <div style="font-size:14px;font-weight:600;">${this._esc(String(s.value))}</div>
            </div>
          </div>
        `).join('')}
      </div>

      <!-- Existing program notice -->
      ${this.existingProgram ? `
      <div style="padding:12px 16px;border-radius:var(--radius-lg);background:var(--info-bg, #e8f4fd);border:1px solid var(--info, #2196F3);color:var(--info, #1976D2);margin-bottom:12px;display:flex;align-items:center;gap:8px;">
        <strong>CTĐT đã tồn tại:</strong>
        <span style="font-size:13px;">"${this._esc(this.existingProgram.name)}" (Mã: ${this._esc(this.existingProgram.code)}) — sẽ tạo phiên bản mới cho CTĐT này.</span>
      </div>` : ''}

      <!-- Save area -->
      <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">${this.existingProgram ? 'Tạo phiên bản mới' : 'Tạo bản nháp CTĐT'}</h3>
      <div style="padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
        <div class="flex-row" style="gap:10px;align-items:flex-end;flex-wrap:wrap;">
          ${this.existingProgram ? '' : `
          <div class="input-group" style="min-width:180px;flex:1;margin:0;">
            <label>Khoa quản lý <span style="color:var(--danger);">*</span></label>
            <select id="iw-dept-select">${deptOptions}</select>
          </div>
          <div class="input-group" style="min-width:160px;flex:1;margin:0;">
            <label>Ngành <span style="color:var(--danger);">*</span></label>
            <select id="iw-nganh-select"><option value="">— Chọn ngành —</option></select>
          </div>
          `}
          <div class="input-group" style="width:140px;margin:0;">
            <label>Năm học <span style="color:var(--danger);">*</span></label>
            <input type="text" id="iw-year-input" placeholder="2024-2025" value="${this._escAttr(ver.academic_year || d.academic_year || '')}">
          </div>
        </div>
        <div class="flex-row mt-4" style="justify-content:flex-end;">
          <button class="btn btn-secondary btn-sm" onclick="window.ImportWordPage._backToUpload()">← Chọn lại file</button>
          <button class="btn btn-primary btn-sm" id="iw-save-btn" ${errCount > 0 ? 'disabled' : ''} onclick="window.ImportWordPage._confirmSave()">
            ${this.existingProgram ? 'Tạo phiên bản & Chỉnh sửa' : 'Tạo bản nháp & Chỉnh sửa'}
          </button>
        </div>
        ${errCount > 0 ? `<div style="color:var(--danger);font-size:13px;margin-top:8px;">Có ${errCount} lỗi — không thể tạo bản nháp. Sửa file Word và upload lại.</div>` : ''}
      </div>
    `;

    if (!this.existingProgram) this._bindDeptNganh();
  },

  _bindDeptNganh() {
    const deptSel = document.getElementById('iw-dept-select');
    const nganhSel = document.getElementById('iw-nganh-select');
    const updateNganh = () => {
      const khoaId = deptSel.value;
      const children = (this.allDepartments || []).filter(d => d.parent_id == khoaId && d.type === 'BO_MON');
      nganhSel.innerHTML = '<option value="">— Chọn ngành —</option>' +
        children.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');
    };
    deptSel.addEventListener('change', updateNganh);
    updateNganh();
  },

  async _confirmSave() {
    const deptSelect = document.getElementById('iw-dept-select');
    const nganhSelect = document.getElementById('iw-nganh-select');
    const yearInput = document.getElementById('iw-year-input');

    if (!this.existingProgram && (!nganhSelect || !nganhSelect.value)) {
      window.toast?.error('Vui lòng chọn ngành.');
      return;
    }
    if (!yearInput || !yearInput.value.trim()) {
      window.toast?.error('Vui lòng nhập năm học.');
      return;
    }
    // Auto-fix single year → YYYY-YYYY+1
    let yearVal = yearInput.value.trim();
    if (/^\d{4}$/.test(yearVal)) {
      yearVal = `${yearVal}-${parseInt(yearVal) + 1}`;
      yearInput.value = yearVal;
    }
    if (!/^\d{4}-\d{4}$/.test(yearVal)) {
      window.toast?.error('Năm học phải có dạng YYYY-YYYY (VD: 2025-2026).');
      return;
    }

    const progName = this.parsedData?.program?.name || 'CTĐT';
    const poCount = (this.parsedData?.objectives || []).length;
    const ploCount = (this.parsedData?.plos || []).length;
    const courseCount = (this.parsedData?.courses || []).length;
    const confirmMsg = this.existingProgram
      ? `Xác nhận tạo phiên bản mới cho CTĐT "${this.existingProgram.name}"?\n\nNăm học: ${yearVal}\nNội dung: ${poCount} PO, ${ploCount} PLO, ${courseCount} học phần\n\nSau khi tạo, bạn sẽ được chuyển đến trang chỉnh sửa phiên bản.`
      : `Xác nhận tạo bản nháp CTĐT?\n\nNgành: ${nganhSelect.options[nganhSelect.selectedIndex]?.text}\nNăm học: ${yearVal}\nNội dung: ${poCount} PO, ${ploCount} PLO, ${courseCount} học phần\n\nSau khi tạo, bạn sẽ được chuyển đến trang chỉnh sửa phiên bản.`;
    const confirmed = await window.ui.confirm({
      title: this.existingProgram ? 'Tạo phiên bản mới' : 'Tạo bản nháp CTĐT',
      eyebrow: 'Xác nhận tạo dữ liệu',
      message: confirmMsg,
      confirmText: 'Tạo & mở',
      cancelText: 'Xem lại'
    });
    if (!confirmed) return;

    const saveBtn = document.getElementById('iw-save-btn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Đang tạo...';

    try {
      const data = this.parsedData;
      if (data.version) data.version.academic_year = yearVal;
      const payload = {
        ...data,
        department_id: this.existingProgram ? this.existingProgram.department_id : parseInt(nganhSelect.value || deptSelect.value, 10),
        existing_program_id: this.existingProgram ? this.existingProgram.id : null,
      };
      const res = await fetch('/api/import/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Lỗi lưu dữ liệu');
      window.toast?.success('Đã tạo bản nháp! Đang chuyển đến trang chỉnh sửa...');
      // Redirect to version-editor
      window.App.navigate('version-editor', { versionId: json.version_id });
    } catch (e) {
      window.toast?.error(e.message);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Tạo bản nháp & Chỉnh sửa';
    }
  },

  _backToUpload() {
    this.parsedData = null;
    document.getElementById('iw-body').innerHTML = this._uploadStepHTML();
    this._bindUpload();
  },

  _esc(str) {
    return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  },

  _escAttr(str) {
    return String(str ?? '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
};
