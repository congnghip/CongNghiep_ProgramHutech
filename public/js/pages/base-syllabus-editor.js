// Base Syllabus Editor — đề cương cơ bản (per course, not per version)

const BS_INP = 'width:100%;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;';

window.BaseSyllabusEditorPage = {
  courseId: null,
  course: null,
  baseSyllabus: null,
  activeTab: 0,
  isNew: false,

  async render(container, courseId) {
    this.courseId = courseId;
    this.activeTab = 0;
    this.isNew = false;
    container.innerHTML = '<div class="spinner"></div>';

    try {
      // Fetch course info
      const courseRes = await fetch('/api/courses').then(r => r.json());
      this.course = courseRes.find(c => c.id === parseInt(courseId));
      if (!this.course) throw new Error('Không tìm thấy học phần');

      // Fetch versions của khoa (để chọn canonical_version_id)
      try {
        const vRes = await fetch('/api/versions').then(r => r.ok ? r.json() : []);
        this.departmentVersions = (Array.isArray(vRes) ? vRes : [])
          .filter(v => v.department_id === this.course.department_id);
      } catch (_) { this.departmentVersions = []; }

      // Fetch PLO/PI của canonical version (nếu có)
      this.canonicalPlos = [];
      this.canonicalPis = [];
      if (this.course.canonical_version_id) {
        try {
          this.canonicalPlos = await fetch(`/api/versions/${this.course.canonical_version_id}/plos`).then(r => r.ok ? r.json() : []);
          this.canonicalPis = await fetch(`/api/versions/${this.course.canonical_version_id}/pis`).then(r => r.ok ? r.json() : []);
        } catch (_) {}
      }

      // Fetch base syllabus
      const bsRes = await fetch(`/api/courses/${courseId}/base-syllabus`);
      if (bsRes.ok) {
        this.baseSyllabus = await bsRes.json();
        this.baseSyllabus.content = typeof this.baseSyllabus.content === 'string'
          ? JSON.parse(this.baseSyllabus.content)
          : (this.baseSyllabus.content || {});
      } else {
        this.isNew = true;
        this.baseSyllabus = { content: { _schema_version: 2 } };
      }
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="icon">!</div><p>${e.message}</p></div>`;
      return;
    }

    const c = this.course;
    const editable = window.App.hasPerm('courses.edit');
    const bs = this.baseSyllabus;
    const updatedInfo = bs.updated_by_name
      ? `Cập nhật lần cuối bởi <strong>${bs.updated_by_name}</strong> vào ${new Date(bs.updated_at).toLocaleString('vi-VN')}`
      : '';

    container.innerHTML = `
      <div class="page-header">
        <nav class="breadcrumb-nav mb-3">
          <a href="#" onclick="event.preventDefault();window.App.navigate('courses')" class="breadcrumb-link">Danh mục Học phần</a>
          <span class="breadcrumb-sep">›</span>
          <span class="breadcrumb-current">Đề cương cơ bản</span>
        </nav>
        <div class="flex-between">
          <div>
            <h1 class="page-title" style="font-size:22px;">Đề cương cơ bản — ${c.code ? c.code + ' ' : ''}${c.name}</h1>
            <div class="page-header-meta">
              <span class="badge badge-info">${c.credits} TC</span>
              ${this.isNew ? '<span class="badge badge-warning">Chưa có nội dung</span>' : '<span class="badge badge-success">Đã có nội dung</span>'}
              ${updatedInfo ? `<span class="text-muted-sm">${updatedInfo}</span>` : ''}
            </div>
          </div>
          <div class="page-header-actions">
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.saveAll()">Lưu tất cả</button>' : ''}
          </div>
        </div>
      </div>
      <div class="tab-bar" id="bs-tabs">
        <div class="tab-item active" data-tab="0">Thông tin chung</div>
        <div class="tab-item" data-tab="1">CLO</div>
        <div class="tab-item" data-tab="2">Nội dung giảng dạy</div>
        <div class="tab-item" data-tab="3">Đánh giá</div>
        <div class="tab-item" data-tab="4">Tài liệu</div>
      </div>
      <div id="bs-tab-content"><div class="spinner"></div></div>

      <!-- Add Outline Lesson Modal -->
      <div id="bs-outline-add-modal" class="modal-overlay">
        <div class="modal" style="max-width:640px;">
          <div class="modal-header"><h2>Thêm bài học</h2></div>
          <div class="modal-body">
            <form id="bs-outline-add-form">
              <div class="input-group">
                <label>Tên bài <span class="required-mark">*</span></label>
                <input type="text" id="bs-outline-add-title" required placeholder="VD: Chương 1 — Giới thiệu">
              </div>
              <div style="display:flex;gap:12px;">
                <div class="input-group" style="flex:1;">
                  <label>Số tiết</label>
                  <input type="number" id="bs-outline-add-hours" min="0" value="0">
                </div>
              </div>
              <div class="input-group">
                <label>Nội dung chi tiết (mỗi dòng = 1 mục)</label>
                <textarea id="bs-outline-add-topics" rows="4"></textarea>
              </div>
              <div class="input-group">
                <label>Phương pháp dạy học</label>
                <textarea id="bs-outline-add-methods" rows="3"></textarea>
              </div>
              <div class="modal-error" id="bs-outline-add-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('bs-outline-add-modal').classList.remove('active')">Hủy</button>
                <button type="submit" class="btn btn-primary">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;

    // Tab switching
    document.querySelectorAll('#bs-tabs .tab-item').forEach(tab => {
      tab.addEventListener('click', () => {
        this._collectCurrentTabIntoState();
        document.querySelectorAll('#bs-tabs .tab-item').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeTab = parseInt(tab.dataset.tab);
        this.renderTab();
      });
    });

    // Outline add form
    document.getElementById('bs-outline-add-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.submitAddOutline();
    });

    this.renderTab();
  },

  renderTab() {
    const body = document.getElementById('bs-tab-content');
    body.innerHTML = '<div class="spinner"></div>';
    const editable = window.App.hasPerm('courses.edit');
    const c = this.baseSyllabus.content || {};
    switch (this.activeTab) {
      case 0: this.renderGeneralTab(body, editable, c); break;
      case 1: this.renderCLOTab(body, editable); break;
      case 2: this.renderOutlineTab(body, editable, c); break;
      case 3: this.renderGradingTab(body, editable, c); break;
      case 4: this.renderResourcesTab(body, editable, c); break;
    }
  },

  // ============ TAB 0: Thông tin chung ============
  renderGeneralTab(body, editable, c) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const dis = editable ? '' : 'disabled';
    const co = this.course;
    const versions = this.departmentVersions || [];
    const creditsDisplay = `${co.credits || 0} (${co.credits_theory || 0}, ${co.credits_practice || 0})`;
    body.innerHTML = `
      <div style="max-width:820px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Thông tin chung</h3>

        <div style="display:flex;gap:12px;">
          <div class="input-group" style="flex:1;"><label>Tên tiếng Việt</label><input type="text" id="bs-name-vi" ${dis} value="${esc(co.name)}"></div>
          <div class="input-group" style="flex:1;"><label>Tên tiếng Anh</label><input type="text" id="bs-name-en" ${dis} value="${esc(co.name_en)}"></div>
        </div>

        <div style="display:flex;gap:12px;">
          <div class="input-group" style="width:160px;"><label>Mã HP</label><input type="text" disabled value="${esc(co.code)}"></div>
          <div class="input-group" style="flex:1;"><label>Số tín chỉ (TC, LT, TH)</label><input type="text" disabled value="${esc(creditsDisplay)} TC"></div>
          <div class="input-group" style="flex:1;"><label>Khoa quản lý</label><input type="text" disabled value="${esc(co.dept_name)}"></div>
        </div>

        <div style="display:flex;gap:12px;">
          <div class="input-group" style="flex:1;">
            <label>Khối kiến thức</label>
            <select id="bs-knowledge-area" ${dis}>
              <option value="">-- Chọn --</option>
              <option value="general" ${co.knowledge_area==='general'?'selected':''}>GD đại cương</option>
              <option value="professional" ${co.knowledge_area==='professional'?'selected':''}>GD chuyên nghiệp</option>
            </select>
          </div>
          <div class="input-group" style="flex:1;">
            <label>Yêu cầu</label>
            <select id="bs-course-req" ${dis}>
              <option value="">-- Chọn --</option>
              <option value="required" ${co.course_requirement==='required'?'selected':''}>Bắt buộc</option>
              <option value="elective" ${co.course_requirement==='elective'?'selected':''}>Tự chọn</option>
            </select>
          </div>
          <div class="input-group" style="flex:1;">
            <label>Trình độ đào tạo</label>
            <select id="bs-training-level" ${dis}>
              <option value="Đại học" ${(co.training_level||'Đại học')==='Đại học'?'selected':''}>Đại học</option>
              <option value="Sau đại học" ${co.training_level==='Sau đại học'?'selected':''}>Sau đại học</option>
            </select>
          </div>
        </div>

        <div class="input-group">
          <label>CTĐT chuẩn <span style="color:var(--text-muted);font-weight:normal;">(dùng để map CLO → PLO/PI)</span></label>
          <select id="bs-canonical-version" ${dis}>
            <option value="">-- Chưa chọn --</option>
            ${versions.map(v => {
              const label = esc(v.code || v.academic_year || ('Version #'+v.id));
              return `<option value="${v.id}" ${co.canonical_version_id===v.id?'selected':''}>${label}</option>`;
            }).join('')}
          </select>
        </div>

        <div style="display:flex;gap:12px;">
          <div class="input-group" style="flex:1;"><label>Học phần tiên quyết (mục 6)</label><input type="text" id="bs-prereq" ${dis} value="${esc(c.prerequisites)}"></div>
          <div class="input-group" style="flex:1;"><label>Ngôn ngữ giảng dạy</label><input type="text" id="bs-lang-inst" ${dis} value="${esc(c.language_instruction)}"></div>
        </div>

        <div class="input-group"><label>Mục tiêu học phần (mục 7)</label><textarea id="bs-course-obj" ${dis} rows="3">${esc(c.course_objectives)}</textarea></div>
        <div class="input-group"><label>Mô tả tóm tắt nội dung HP (mục 11)</label><textarea id="bs-course-desc" ${dis} rows="3">${esc(c.course_description)}</textarea></div>

        <h4 style="font-size:14px;font-weight:600;margin:20px 0 8px;">Phương pháp, hình thức tổ chức dạy học (mục 12)</h4>
        <table class="data-table" id="bs-teaching-methods-table">
          <thead><tr><th style="width:35%;">Phương pháp</th><th>Mục tiêu</th>${editable?'<th style="width:50px;"></th>':''}</tr></thead>
          <tbody>
            ${(Array.isArray(c.teaching_methods)?c.teaching_methods:[]).map((t,i)=>`<tr>
              <td><input type="text" data-field="method" value="${esc(t.method)}" ${dis} style="${BS_INP}"></td>
              <td><input type="text" data-field="objective" value="${esc(t.objective)}" ${dis} style="${BS_INP}"></td>
              ${editable?`<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>`:''}
            </tr>`).join('')}
          </tbody>
        </table>
        ${editable?'<button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="window.BaseSyllabusEditorPage.addTeachingMethodRow()">+ Thêm dòng</button>':''}
      </div>
    `;
  },

  addTeachingMethodRow() {
    const tbody = document.querySelector('#bs-teaching-methods-table tbody');
    if (!tbody) return;
    tbody.insertAdjacentHTML('beforeend', `<tr>
      <td><input type="text" data-field="method" style="${BS_INP}"></td>
      <td><input type="text" data-field="objective" style="${BS_INP}"></td>
      <td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`);
  },

  _collectGeneral() {
    const desc = document.getElementById('bs-course-desc');
    if (!desc) return;
    // Content fields (JSONB)
    const tmTable = document.getElementById('bs-teaching-methods-table');
    const teaching_methods = tmTable
      ? Array.from(tmTable.querySelectorAll('tbody tr')).map(r => ({
          method: r.querySelector('[data-field="method"]').value,
          objective: r.querySelector('[data-field="objective"]').value,
        })).filter(t => t.method || t.objective)
      : [];
    this.baseSyllabus.content = {
      ...this.baseSyllabus.content,
      course_description: desc.value,
      course_objectives: document.getElementById('bs-course-obj').value,
      prerequisites: document.getElementById('bs-prereq').value,
      language_instruction: document.getElementById('bs-lang-inst').value,
      teaching_methods,
    };
    // Master fields (stored separately, saved via PUT /api/courses/:id)
    this._pendingCourseUpdate = {
      name: document.getElementById('bs-name-vi').value,
      name_en: document.getElementById('bs-name-en').value,
      knowledge_area: document.getElementById('bs-knowledge-area').value || null,
      course_requirement: document.getElementById('bs-course-req').value || null,
      training_level: document.getElementById('bs-training-level').value,
      canonical_version_id: parseInt(document.getElementById('bs-canonical-version').value) || null,
    };
  },

  // ============ TAB 1: CLOs ============
  async renderCLOTab(body, editable) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const bloomLabels = ['', '1 — Nhớ', '2 — Hiểu', '3 — Áp dụng', '4 — Phân tích', '5 — Đánh giá', '6 — Sáng tạo'];
    let clos = [];
    try {
      clos = await fetch(`/api/courses/${this.courseId}/base-syllabus/clos`).then(r => r.json());
    } catch (e) { /* empty */ }

    // Fetch mappings for each CLO
    const mappings = {};
    for (const c of clos) {
      try {
        mappings[c.id] = await fetch(`/api/base-clos/${c.id}/mappings`).then(r => r.json());
      } catch (_) { mappings[c.id] = { plo_ids: [], pi_ids: [] }; }
    }

    const plos = this.canonicalPlos || [];
    const pis = this.canonicalPis || [];
    const noCanonical = !this.course.canonical_version_id;

    body.innerHTML = `
      ${noCanonical ? '<div class="alert alert-warning" style="margin-bottom:12px;">⚠️ Chưa chọn CTĐT chuẩn ở tab Thông tin chung — chưa thể map PLO/PI.</div>' : ''}
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Chuẩn đầu ra môn học (CLO) — Mục 10</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.showBaseCLOForm()">+ Thêm CLO</button>' : ''}
      </div>
      <table class="data-table">
        <thead><tr>
          <th style="width:80px;">Mã</th>
          <th>Mô tả</th>
          <th style="width:110px;">Bloom</th>
          <th style="width:180px;">PLO đáp ứng</th>
          <th style="width:180px;">PI đáp ứng</th>
          ${editable ? '<th style="width:100px;"></th>' : ''}
        </tr></thead>
        <tbody>
          ${clos.length === 0 ? `<tr><td colspan="${editable ? 6 : 5}" style="color:var(--text-muted);text-align:center;">Chưa có CLO</td></tr>` : clos.map(c => {
            const m = mappings[c.id] || { plo_ids: [], pi_ids: [] };
            const ploCodes = m.plo_ids.map(id => (plos.find(p => p.id === id) || {}).code).filter(Boolean).join(', ');
            const piCodes = m.pi_ids.map(id => (pis.find(p => p.id === id) || {}).code).filter(Boolean).join(', ');
            return `
            <tr>
              <td><strong style="color:var(--primary);">${esc(c.code)}</strong></td>
              <td style="font-size:13px;">${esc(c.description)}</td>
              <td><span class="badge badge-info">${bloomLabels[c.bloom_level] || c.bloom_level}</span></td>
              <td style="font-size:12px;">${esc(ploCodes) || '<span style="color:var(--text-muted);">—</span>'}</td>
              <td style="font-size:12px;">${esc(piCodes) || '<span style="color:var(--text-muted);">—</span>'}</td>
              ${editable ? `<td style="white-space:nowrap;">
                <button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.editBaseCLO(${c.id})">Sửa</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.BaseSyllabusEditorPage.deleteBaseCLO(${c.id})">Xóa</button>
              </td>` : ''}
            </tr>
          `; }).join('')}
        </tbody>
      </table>
      <div id="bs-clo-form" style="display:none;margin-top:16px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);">
        <input type="hidden" id="bs-clo-edit-id">
        <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;">
          <div class="input-group" style="width:100px;margin:0;"><label>Mã</label><input type="text" id="bs-clo-code" placeholder="CLO1"></div>
          <div class="input-group" style="flex:1;min-width:200px;margin:0;"><label>Mô tả</label><input type="text" id="bs-clo-desc"></div>
          <div class="input-group" style="width:140px;margin:0;">
            <label>Bloom Level</label>
            <select id="bs-clo-bloom">
              <option value="1">1 — Nhớ</option>
              <option value="2">2 — Hiểu</option>
              <option value="3">3 — Áp dụng</option>
              <option value="4">4 — Phân tích</option>
              <option value="5">5 — Đánh giá</option>
              <option value="6">6 — Sáng tạo</option>
            </select>
          </div>
        </div>
        <div style="display:flex;gap:10px;margin-top:10px;">
          <div class="input-group" style="flex:1;margin:0;">
            <label>PLO đáp ứng</label>
            <select id="bs-clo-plos" multiple size="4" ${noCanonical ? 'disabled' : ''}>
              ${plos.map(p => `<option value="${p.id}">${esc(p.code)} — ${esc((p.description||'').substring(0,60))}</option>`).join('')}
            </select>
          </div>
          <div class="input-group" style="flex:1;margin:0;">
            <label>PI đáp ứng</label>
            <select id="bs-clo-pis" multiple size="4" ${noCanonical ? 'disabled' : ''}>
              ${pis.map(p => `<option value="${p.id}">${esc(p.code)} — ${esc((p.description||'').substring(0,60))}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="margin-top:10px;display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.saveBaseCLO()">Lưu</button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('bs-clo-form').style.display='none'">Hủy</button>
        </div>
      </div>
    `;
  },

  showBaseCLOForm(id, code, desc, bloom, ploIds, piIds) {
    document.getElementById('bs-clo-edit-id').value = id || '';
    document.getElementById('bs-clo-code').value = code || '';
    document.getElementById('bs-clo-desc').value = desc || '';
    document.getElementById('bs-clo-bloom').value = bloom || 1;
    const ploSel = document.getElementById('bs-clo-plos');
    const piSel = document.getElementById('bs-clo-pis');
    Array.from(ploSel.options).forEach(o => o.selected = (ploIds || []).includes(parseInt(o.value)));
    Array.from(piSel.options).forEach(o => o.selected = (piIds || []).includes(parseInt(o.value)));
    document.getElementById('bs-clo-form').style.display = 'block';
  },

  async editBaseCLO(id) {
    const [clos, mappings] = await Promise.all([
      fetch(`/api/courses/${this.courseId}/base-syllabus/clos`).then(r => r.json()),
      fetch(`/api/base-clos/${id}/mappings`).then(r => r.json()),
    ]);
    const c = clos.find(x => x.id === id);
    if (c) this.showBaseCLOForm(c.id, c.code, c.description, c.bloom_level, mappings.plo_ids, mappings.pi_ids);
  },

  async saveBaseCLO() {
    const id = document.getElementById('bs-clo-edit-id').value;
    const code = document.getElementById('bs-clo-code').value.trim();
    const description = document.getElementById('bs-clo-desc').value.trim();
    const bloom_level = parseInt(document.getElementById('bs-clo-bloom').value) || 1;
    const plo_ids = Array.from(document.getElementById('bs-clo-plos').selectedOptions).map(o => parseInt(o.value));
    const pi_ids = Array.from(document.getElementById('bs-clo-pis').selectedOptions).map(o => parseInt(o.value));
    if (!code) { window.toast.warning('Nhập mã CLO'); return; }
    try {
      const url = id ? `/api/base-clos/${id}` : `/api/courses/${this.courseId}/base-syllabus/clos`;
      const res = await fetch(url, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, description, bloom_level })
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error);
      // Save mappings
      await fetch(`/api/base-clos/${saved.id}/mappings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plo_ids, pi_ids }),
      });
      window.toast.success(id ? 'Đã cập nhật CLO' : 'Đã thêm CLO');
      document.getElementById('bs-clo-form').style.display = 'none';
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },

  async deleteBaseCLO(id) {
    const confirmed = await window.ui.confirm({
      title: 'Xóa CLO', message: 'Bạn có chắc muốn xóa CLO này?',
      confirmText: 'Xóa', cancelText: 'Hủy', tone: 'warning'
    });
    if (!confirmed) return;
    try {
      await fetch(`/api/base-clos/${id}`, { method: 'DELETE' });
      window.toast.success('Đã xóa CLO');
      this.renderTab();
    } catch (e) { window.toast.error(e.message); }
  },

  // ============ TAB 2: Nội dung giảng dạy ============
  renderOutlineTab(body, editable, c) {
    const lessons = c.course_outline || [];
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Nội dung chi tiết học phần</h3>
        <div style="display:flex;gap:8px;">
          ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.openAddOutlineModal()">+ Thêm bài</button>' : ''}
        </div>
      </div>
      <div id="bs-outline-container">
        ${lessons.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có nội dung. Bấm "+ Thêm bài" để bắt đầu.</p>' :
          lessons.map((l, i) => this._outlineRowHtml(l, i, editable)).join('')}
      </div>
    `;
  },

  _outlineRowHtml(l, i, editable) {
    const dis = editable ? '' : 'disabled';
    const topicsStr = Array.isArray(l.topics) ? l.topics.join('\n') : '';
    return `<div class="outline-row" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        <strong style="color:var(--primary);white-space:nowrap;">Bài ${l.lesson || i + 1}</strong>
        <input type="text" data-field="title" value="${(l.title || '').replace(/"/g, '&quot;')}" ${dis} placeholder="Tên bài" style="flex:1;${BS_INP}">
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;white-space:nowrap;">Số tiết:</label><input type="number" data-field="hours" value="${l.hours || 0}" ${dis} min="0" style="width:60px;${BS_INP}text-align:center;"></div>
        ${editable ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('.outline-row').remove()">✕</button>` : ''}
      </div>
      <div style="display:flex;gap:12px;">
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nội dung chi tiết (mỗi dòng = 1 mục)</label><textarea data-field="topics" ${dis} rows="3" style="${BS_INP}">${topicsStr}</textarea></div>
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Phương pháp dạy học</label><textarea data-field="teaching_methods" ${dis} rows="3" style="${BS_INP}">${l.teaching_methods || ''}</textarea></div>
      </div>
    </div>`;
  },

  openAddOutlineModal() {
    document.getElementById('bs-outline-add-form').reset();
    document.getElementById('bs-outline-add-hours').value = '0';
    const errorEl = document.getElementById('bs-outline-add-error');
    errorEl.classList.remove('show');
    errorEl.textContent = '';
    document.getElementById('bs-outline-add-modal').classList.add('active');
    App.modalGuard('bs-outline-add-modal', () => this.submitAddOutline());
  },

  submitAddOutline() {
    const title = document.getElementById('bs-outline-add-title').value.trim();
    const errorEl = document.getElementById('bs-outline-add-error');
    if (!title) {
      errorEl.textContent = 'Nhập tên bài';
      errorEl.classList.add('show');
      return;
    }
    const hours = parseFloat(document.getElementById('bs-outline-add-hours').value) || 0;
    const topics = document.getElementById('bs-outline-add-topics').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    const teaching_methods = document.getElementById('bs-outline-add-methods').value;

    this._collectOutline();

    const existing = this.baseSyllabus.content.course_outline || [];
    this.baseSyllabus.content = {
      ...this.baseSyllabus.content,
      course_outline: [
        ...existing,
        { lesson: existing.length + 1, title, hours, topics, teaching_methods, clos: [] },
      ],
    };

    document.getElementById('bs-outline-add-modal').classList.remove('active');
    window.toast.success('Đã thêm bài (chưa lưu)');
    this.renderTab();
  },

  _collectOutline() {
    const container = document.getElementById('bs-outline-container');
    if (!container) return;
    const rows = container.querySelectorAll('.outline-row');
    const course_outline = Array.from(rows).map((r, i) => ({
      lesson: i + 1,
      title: r.querySelector('[data-field="title"]').value,
      hours: parseFloat(r.querySelector('[data-field="hours"]').value) || 0,
      topics: r.querySelector('[data-field="topics"]').value.split('\n').map(s => s.trim()).filter(Boolean),
      teaching_methods: r.querySelector('[data-field="teaching_methods"]').value,
      clos: [],
    }));
    this.baseSyllabus.content = { ...this.baseSyllabus.content, course_outline };
  },

  // ============ TAB 2: Đánh giá ============
  renderGradingTab(body, editable, c) {
    const items = c.assessment_methods || [];
    const dis = editable ? '' : 'disabled';
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Hình thức đánh giá</h3>
      </div>
      <table class="data-table" id="bs-grading-table">
        <thead><tr><th>Thành phần</th><th style="width:70px;">%</th><th>Hình thức đánh giá</th>${editable ? '<th></th>' : ''}</tr></thead>
        <tbody>
          ${items.map((g, i) => `<tr data-idx="${i}">
            <td><input type="text" value="${g.component || ''}" data-field="component" ${dis} style="${BS_INP}"></td>
            <td><input type="number" value="${g.weight || 0}" data-field="weight" ${dis} min="0" max="100" style="${BS_INP}text-align:center;"></td>
            <td><input type="text" value="${g.assessment_tool || ''}" data-field="assessment_tool" ${dis} style="${BS_INP}"></td>
            ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>` : ''}
          </tr>`).join('')}
        </tbody>
      </table>
      ${editable ? '<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="window.BaseSyllabusEditorPage.addGradingRow()">+ Thêm dòng</button>' : ''}
    `;
  },

  addGradingRow() {
    const tbody = document.querySelector('#bs-grading-table tbody');
    tbody.insertAdjacentHTML('beforeend', `<tr>
      <td><input type="text" data-field="component" style="${BS_INP}"></td>
      <td><input type="number" data-field="weight" value="0" style="${BS_INP}text-align:center;"></td>
      <td><input type="text" data-field="assessment_tool" style="${BS_INP}"></td>
      <td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>
    </tr>`);
  },

  _collectGrading() {
    const table = document.getElementById('bs-grading-table');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    const assessment_methods = Array.from(rows).map(r => ({
      component: r.querySelector('[data-field="component"]').value,
      weight: parseInt(r.querySelector('[data-field="weight"]').value) || 0,
      assessment_tool: r.querySelector('[data-field="assessment_tool"]').value,
      clos: [],
    }));
    this.baseSyllabus.content = { ...this.baseSyllabus.content, assessment_methods };
  },

  // ============ TAB 3: Tài liệu ============
  renderResourcesTab(body, editable, c) {
    const textbooks = Array.isArray(c.textbooks) ? c.textbooks : [];
    const references = Array.isArray(c.references) ? c.references : [];
    const req = c.course_requirements || { software: [], hardware: [], lab_equipment: [], classroom_setup: '' };
    const dis = editable ? '' : 'disabled';

    body.innerHTML = `
      <div style="max-width:600px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Tài liệu & Yêu cầu</h3>
        <div class="input-group"><label>Giáo trình chính (mỗi dòng = 1 tài liệu)</label>
          <textarea id="bs-textbooks" ${dis} rows="3" placeholder="Tên sách, Tác giả, NXB">${textbooks.join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Tài liệu tham khảo (mỗi dòng = 1 tài liệu)</label>
          <textarea id="bs-references" ${dis} rows="3" placeholder="Bài báo, website...">${references.join('\n')}</textarea>
        </div>
        <h4 style="font-size:14px;font-weight:600;margin:20px 0 12px;">Yêu cầu học phần</h4>
        <div class="input-group"><label>Phần mềm / Công cụ (mỗi dòng = 1 item)</label>
          <textarea id="bs-software" ${dis} rows="3">${(req.software || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Phần cứng (mỗi dòng = 1 item)</label>
          <textarea id="bs-hardware" ${dis} rows="2">${(req.hardware || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Thiết bị phòng thí nghiệm (mỗi dòng = 1 item)</label>
          <textarea id="bs-lab" ${dis} rows="2">${(req.lab_equipment || []).join('\n')}</textarea>
        </div>
        <div class="input-group"><label>Yêu cầu phòng học</label>
          <input type="text" id="bs-classroom" ${dis} value="${req.classroom_setup || ''}" placeholder="VD: Phòng máy tính">
        </div>
      </div>
    `;
  },

  _collectResources() {
    const textbooks = document.getElementById('bs-textbooks');
    if (!textbooks) return;
    const toArr = id => document.getElementById(id).value.split('\n').map(s => s.trim()).filter(Boolean);
    this.baseSyllabus.content = {
      ...this.baseSyllabus.content,
      textbooks: toArr('bs-textbooks'),
      references: toArr('bs-references'),
      course_requirements: {
        software: toArr('bs-software'),
        hardware: toArr('bs-hardware'),
        lab_equipment: toArr('bs-lab'),
        classroom_setup: document.getElementById('bs-classroom').value,
      },
    };
  },

  // ============ COLLECT + SAVE ============
  _collectCurrentTabIntoState() {
    switch (this.activeTab) {
      case 0: this._collectGeneral(); break;
      // case 1: CLO tab uses API CRUD directly — no local state collection needed
      case 2: this._collectOutline(); break;
      case 3: this._collectGrading(); break;
      case 4: this._collectResources(); break;
    }
  },

  async saveAll() {
    try {
      this._collectCurrentTabIntoState();

      // 1. Save master fields (if any)
      if (this._pendingCourseUpdate) {
        const r = await fetch(`/api/courses/${this.course.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this._pendingCourseUpdate),
        });
        if (!r.ok) throw new Error((await r.json()).error || 'Lỗi lưu thông tin HP');
        Object.assign(this.course, await r.json());
        this._pendingCourseUpdate = null;
      }

      // 2. Save content
      const res = await fetch(`/api/courses/${this.courseId}/base-syllabus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: this.baseSyllabus.content }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Lỗi lưu');
      const saved = await res.json();
      this.baseSyllabus = { ...this.baseSyllabus, ...saved };
      this.baseSyllabus.content = typeof saved.content === 'string' ? JSON.parse(saved.content) : saved.content;
      this.isNew = false;
      window.toast.success('Đã lưu đề cương cơ bản');
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  destroy() {}
};
