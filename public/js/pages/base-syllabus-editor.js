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
          <div class="page-header-actions" style="display:flex;gap:8px;">
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.saveAll()">Lưu tất cả</button>' : ''}
            <button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.validateAndExport('pdf')">Xuất PDF</button>
            <button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.validateAndExport('docx')">Xuất DOCX</button>
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
        <div class="modal" style="max-width:720px;">
          <div class="modal-header"><h2>Thêm bài học</h2></div>
          <div class="modal-body">
            <form id="bs-outline-add-form">
              <div class="input-group">
                <label>Tên bài <span class="required-mark">*</span></label>
                <input type="text" id="bs-outline-add-title" required placeholder="VD: BÀI 1 — Giới thiệu">
              </div>
              <div style="display:flex;gap:12px;">
                <div class="input-group" style="flex:1;"><label>LT (tiết)</label><input type="number" id="bs-outline-add-lt" min="0" value="0"></div>
                <div class="input-group" style="flex:1;"><label>TH (tiết)</label><input type="number" id="bs-outline-add-th" min="0" value="0"></div>
                <div class="input-group" style="flex:1;"><label>Tự học (tiết)</label><input type="number" id="bs-outline-add-ss" min="0" value="0"></div>
              </div>
              <div class="input-group">
                <label>Nội dung chi tiết (mỗi dòng = 1 mục)</label>
                <textarea id="bs-outline-add-topics" rows="3"></textarea>
              </div>
              <div class="input-group">
                <label>Phương pháp dạy học</label>
                <textarea id="bs-outline-add-methods" rows="2"></textarea>
              </div>
              <div class="input-group">
                <label>Nhiệm vụ tự học của SV (mỗi dòng = 1 nhiệm vụ)</label>
                <textarea id="bs-outline-add-sstasks" rows="2"></textarea>
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

  async renderTab() {
    const body = document.getElementById('bs-tab-content');
    body.innerHTML = '<div class="spinner"></div>';
    const editable = window.App.hasPerm('courses.edit');
    const c = this.baseSyllabus.content || {};
    switch (this.activeTab) {
      case 0: this.renderGeneralTab(body, editable, c); break;
      case 1: this.renderCLOTab(body, editable); break;
      case 2: this.renderOutlineTab(body, editable, c); break;
      case 3: await this.renderGradingTab(body, editable, c); break;
      case 4: this.renderResourcesTab(body, editable, c); break;
    }
  },

  // ============ TAB 0: Thông tin chung ============
  renderGeneralTab(body, editable, c) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const dis = editable ? '' : 'disabled';
    const co = this.course;
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

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Chuẩn đầu ra môn học (CLO) — Mục 10</h3>
        ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.showBaseCLOForm()">+ Thêm CLO</button>' : ''}
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px;">
        Mapping CLO → PLO/PI sẽ được thực hiện ở đề cương cụ thể trong từng CTĐT.
      </p>
      <table class="data-table">
        <thead><tr>
          <th style="width:80px;">Mã</th>
          <th>Mô tả</th>
          <th style="width:140px;">Bloom</th>
          ${editable ? '<th style="width:100px;"></th>' : ''}
        </tr></thead>
        <tbody>
          ${clos.length === 0 ? `<tr><td colspan="${editable ? 4 : 3}" style="color:var(--text-muted);text-align:center;">Chưa có CLO</td></tr>` : clos.map(c => `
            <tr>
              <td><strong style="color:var(--primary);">${esc(c.code)}</strong></td>
              <td style="font-size:13px;">${esc(c.description)}</td>
              <td><span class="badge badge-info">${bloomLabels[c.bloom_level] || c.bloom_level}</span></td>
              ${editable ? `<td style="white-space:nowrap;">
                <button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.editBaseCLO(${c.id})">Sửa</button>
                <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.BaseSyllabusEditorPage.deleteBaseCLO(${c.id})">Xóa</button>
              </td>` : ''}
            </tr>
          `).join('')}
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
        <div style="margin-top:10px;display:flex;gap:6px;">
          <button class="btn btn-primary btn-sm" onclick="window.BaseSyllabusEditorPage.saveBaseCLO()">Lưu</button>
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('bs-clo-form').style.display='none'">Hủy</button>
        </div>
      </div>
    `;
  },

  showBaseCLOForm(id, code, desc, bloom) {
    document.getElementById('bs-clo-edit-id').value = id || '';
    document.getElementById('bs-clo-code').value = code || '';
    document.getElementById('bs-clo-desc').value = desc || '';
    document.getElementById('bs-clo-bloom').value = bloom || 1;
    document.getElementById('bs-clo-form').style.display = 'block';
  },

  async editBaseCLO(id) {
    const clos = await fetch(`/api/courses/${this.courseId}/base-syllabus/clos`).then(r => r.json());
    const c = clos.find(x => x.id === id);
    if (c) this.showBaseCLOForm(c.id, c.code, c.description, c.bloom_level);
  },

  async saveBaseCLO() {
    const id = document.getElementById('bs-clo-edit-id').value;
    const code = document.getElementById('bs-clo-code').value.trim();
    const description = document.getElementById('bs-clo-desc').value.trim();
    const bloom_level = parseInt(document.getElementById('bs-clo-bloom').value) || 1;
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
  async renderOutlineTab(body, editable, c) {
    const lessons = c.course_outline || [];
    // Load CLO codes from current course for multi-select options
    let cloCodes = [];
    try {
      const clos = await fetch(`/api/courses/${this.courseId}/base-syllabus/clos`).then(r => r.json());
      cloCodes = clos.map(x => x.code).filter(Boolean);
    } catch (_) {}
    this._currentCloCodes = cloCodes;

    const totals = lessons.reduce((acc, l) => ({
      lt: acc.lt + (l.lt_hours || 0),
      th: acc.th + (l.th_hours || 0),
      ss: acc.ss + (l.self_study_hours || 0),
    }), { lt: 0, th: 0, ss: 0 });

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Nội dung chi tiết học phần (mục 13 + 16)</h3>
        ${editable ? '<button class="btn btn-secondary btn-sm" onclick="window.BaseSyllabusEditorPage.openAddOutlineModal()">+ Thêm bài</button>' : ''}
      </div>
      <div id="bs-outline-container">
        ${lessons.length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có nội dung. Bấm "+ Thêm bài" để bắt đầu.</p>' :
          lessons.map((l, i) => this._outlineRowHtml(l, i, editable, cloCodes)).join('')}
      </div>
      ${lessons.length ? `<div style="margin-top:12px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius);font-size:13px;">
        <strong>Tổng:</strong> LT ${totals.lt} tiết &nbsp;|&nbsp; TH ${totals.th} tiết &nbsp;|&nbsp; Tự học ${totals.ss} tiết
      </div>` : ''}
    `;
  },

  _outlineRowHtml(l, i, editable, cloCodes) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const dis = editable ? '' : 'disabled';
    const topicsStr = Array.isArray(l.topics) ? l.topics.join('\n') : '';
    const tasksStr = Array.isArray(l.self_study_tasks) ? l.self_study_tasks.join('\n') : '';
    const codes = Array.isArray(cloCodes) ? cloCodes : [];
    const selected = Array.isArray(l.clo_codes) ? l.clo_codes : [];
    return `<div class="outline-row" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius-lg);padding:16px;margin-bottom:12px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:10px;">
        <strong style="color:var(--primary);white-space:nowrap;">Bài ${l.lesson || i + 1}</strong>
        <input type="text" data-field="title" value="${esc(l.title)}" ${dis} placeholder="Tên bài" style="flex:1;${BS_INP}">
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;">LT:</label><input type="number" data-field="lt_hours" value="${l.lt_hours || 0}" ${dis} min="0" style="width:56px;${BS_INP}text-align:center;"></div>
        <div style="display:flex;align-items:center;gap:4px;"><label style="font-size:12px;">TH:</label><input type="number" data-field="th_hours" value="${l.th_hours || 0}" ${dis} min="0" style="width:56px;${BS_INP}text-align:center;"></div>
        ${editable ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('.outline-row').remove()">✕</button>` : ''}
      </div>
      <div style="display:flex;gap:12px;margin-bottom:10px;">
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nội dung chi tiết (mỗi dòng = 1 mục)</label><textarea data-field="topics" ${dis} rows="3" style="${BS_INP}">${esc(topicsStr)}</textarea></div>
        <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Phương pháp dạy học</label><textarea data-field="teaching_methods" ${dis} rows="3" style="${BS_INP}">${esc(l.teaching_methods)}</textarea></div>
      </div>
      <div class="input-group" style="margin-bottom:10px;"><label style="font-size:12px;">CLO đáp ứng</label>
        <select data-field="clo_codes" multiple size="3" ${dis} style="${BS_INP}">
          ${codes.map(c => `<option value="${esc(c)}" ${selected.includes(c) ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
      </div>
      <details style="margin-top:6px;">
        <summary style="cursor:pointer;font-size:13px;font-weight:600;color:var(--primary);">▸ Hướng dẫn tự học (mục 16)</summary>
        <div style="display:flex;gap:12px;margin-top:8px;">
          <div class="input-group" style="width:150px;margin:0;"><label style="font-size:12px;">Số tiết tự học</label><input type="number" data-field="self_study_hours" value="${l.self_study_hours || 0}" ${dis} min="0" style="${BS_INP}text-align:center;"></div>
          <div class="input-group" style="flex:1;margin:0;"><label style="font-size:12px;">Nhiệm vụ SV (mỗi dòng = 1)</label><textarea data-field="self_study_tasks" ${dis} rows="3" style="${BS_INP}">${esc(tasksStr)}</textarea></div>
        </div>
      </details>
    </div>`;
  },

  openAddOutlineModal() {
    document.getElementById('bs-outline-add-form').reset();
    document.getElementById('bs-outline-add-lt').value = '0';
    document.getElementById('bs-outline-add-th').value = '0';
    document.getElementById('bs-outline-add-ss').value = '0';
    const errorEl = document.getElementById('bs-outline-add-error');
    errorEl.classList.remove('show');
    errorEl.textContent = '';
    document.getElementById('bs-outline-add-modal').classList.add('active');
    App.modalGuard('bs-outline-add-modal', () => this.submitAddOutline());
  },

  submitAddOutline() {
    const title = document.getElementById('bs-outline-add-title').value.trim();
    const errorEl = document.getElementById('bs-outline-add-error');
    if (!title) { errorEl.textContent = 'Nhập tên bài'; errorEl.classList.add('show'); return; }
    const lt_hours = parseFloat(document.getElementById('bs-outline-add-lt').value) || 0;
    const th_hours = parseFloat(document.getElementById('bs-outline-add-th').value) || 0;
    const self_study_hours = parseFloat(document.getElementById('bs-outline-add-ss').value) || 0;
    const topics = document.getElementById('bs-outline-add-topics').value.split('\n').map(s=>s.trim()).filter(Boolean);
    const teaching_methods = document.getElementById('bs-outline-add-methods').value;
    const self_study_tasks = document.getElementById('bs-outline-add-sstasks').value.split('\n').map(s=>s.trim()).filter(Boolean);

    this._collectOutline();

    const existing = this.baseSyllabus.content.course_outline || [];
    this.baseSyllabus.content = {
      ...this.baseSyllabus.content,
      course_outline: [
        ...existing,
        { lesson: existing.length + 1, title, lt_hours, th_hours, topics, teaching_methods, clo_codes: [], self_study_hours, self_study_tasks },
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
      lt_hours: parseFloat(r.querySelector('[data-field="lt_hours"]').value) || 0,
      th_hours: parseFloat(r.querySelector('[data-field="th_hours"]').value) || 0,
      topics: r.querySelector('[data-field="topics"]').value.split('\n').map(s => s.trim()).filter(Boolean),
      teaching_methods: r.querySelector('[data-field="teaching_methods"]').value,
      clo_codes: Array.from(r.querySelector('[data-field="clo_codes"]').selectedOptions).map(o => o.value),
      self_study_hours: parseFloat(r.querySelector('[data-field="self_study_hours"]').value) || 0,
      self_study_tasks: r.querySelector('[data-field="self_study_tasks"]').value.split('\n').map(s => s.trim()).filter(Boolean),
    }));
    this.baseSyllabus.content = { ...this.baseSyllabus.content, course_outline };
  },

  // ============ TAB 2: Đánh giá ============
  async renderGradingTab(body, editable, c) {
    const items = c.assessment_methods || [];
    const dis = editable ? '' : 'disabled';
    // Load CLO codes for multi-select
    let cloCodes = [];
    try {
      const clos = await fetch(`/api/courses/${this.courseId}/base-syllabus/clos`).then(r => r.json());
      cloCodes = clos.map(x => x.code).filter(Boolean);
    } catch (_) {}
    this._gradingCloCodes = cloCodes;

    const totalWeight = items.reduce((s, g) => s + (parseInt(g.weight) || 0), 0);
    const weightColor = totalWeight === 100 ? 'var(--success)' : 'var(--danger)';

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <h3 style="font-size:15px;font-weight:600;">Phương pháp kiểm tra/đánh giá (mục 14)</h3>
        <div style="font-size:13px;">Tổng trọng số: <strong style="color:${weightColor};">${totalWeight}%</strong></div>
      </div>
      <table class="data-table" id="bs-grading-table">
        <thead><tr>
          <th style="width:180px;">Thành phần</th>
          <th>Quy định</th>
          <th style="width:140px;">Bài đánh giá</th>
          <th style="width:80px;">%</th>
          <th style="width:160px;">CLO đáp ứng</th>
          ${editable ? '<th style="width:50px;"></th>' : ''}
        </tr></thead>
        <tbody>
          ${items.map((g, i) => this._gradingRowHtml(g, i, editable, cloCodes, dis)).join('')}
        </tbody>
      </table>
      ${editable ? '<button class="btn btn-secondary btn-sm" style="margin-top:12px;" onclick="window.BaseSyllabusEditorPage.addGradingRow()">+ Thêm dòng</button>' : ''}
    `;
  },

  _gradingRowHtml(g, i, editable, cloCodes, dis) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const selected = Array.isArray(g.clo_codes) ? g.clo_codes : [];
    return `<tr data-idx="${i}">
      <td><input type="text" value="${esc(g.component)}" data-field="component" ${dis} style="${BS_INP}" placeholder="VD: Điểm đánh giá quá trình"></td>
      <td><input type="text" value="${esc(g.description)}" data-field="description" ${dis} style="${BS_INP}" placeholder="VD: Bài tập nhóm"></td>
      <td><input type="text" value="${esc(g.task_ref)}" data-field="task_ref" ${dis} style="${BS_INP}" placeholder="VD: Bài 1,2,3,5"></td>
      <td><input type="number" value="${g.weight || 0}" data-field="weight" ${dis} min="0" max="100" style="${BS_INP}text-align:center;"></td>
      <td>
        <select data-field="clo_codes" multiple size="3" ${dis} style="${BS_INP}font-size:12px;">
          ${cloCodes.map(c => `<option value="${esc(c)}" ${selected.includes(c)?'selected':''}>${esc(c)}</option>`).join('')}
        </select>
      </td>
      ${editable ? `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>` : ''}
    </tr>`;
  },

  addGradingRow() {
    const tbody = document.querySelector('#bs-grading-table tbody');
    if (!tbody) return;
    const codes = this._gradingCloCodes || [];
    tbody.insertAdjacentHTML('beforeend', this._gradingRowHtml({}, tbody.children.length, true, codes, ''));
  },

  _collectGrading() {
    const table = document.getElementById('bs-grading-table');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    const assessment_methods = Array.from(rows).map(r => ({
      component: r.querySelector('[data-field="component"]').value,
      description: r.querySelector('[data-field="description"]').value,
      task_ref: r.querySelector('[data-field="task_ref"]').value,
      weight: parseInt(r.querySelector('[data-field="weight"]').value) || 0,
      clo_codes: Array.from(r.querySelector('[data-field="clo_codes"]').selectedOptions).map(o => o.value),
    }));
    this.baseSyllabus.content = { ...this.baseSyllabus.content, assessment_methods };
  },

  // ============ TAB 3: Tài liệu ============
  renderResourcesTab(body, editable, c) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const textbooks = Array.isArray(c.textbooks) ? c.textbooks : [];
    const references = Array.isArray(c.references) ? c.references : [];
    const tools = Array.isArray(c.tools) ? c.tools : [];
    const dis = editable ? '' : 'disabled';

    body.innerHTML = `
      <div style="max-width:820px;">
        <h3 style="font-size:15px;font-weight:600;margin-bottom:16px;">Tài liệu phục vụ học phần (mục 15)</h3>
        <div class="input-group"><label>Tài liệu/giáo trình chính (mỗi dòng = 1 tài liệu)</label>
          <textarea id="bs-textbooks" ${dis} rows="3" placeholder="Tên sách, Tác giả, NXB">${esc(textbooks.join('\n'))}</textarea>
        </div>
        <div class="input-group"><label>Tài liệu tham khảo/bổ sung (mỗi dòng = 1 tài liệu)</label>
          <textarea id="bs-references" ${dis} rows="3">${esc(references.join('\n'))}</textarea>
        </div>

        <h4 style="font-size:14px;font-weight:600;margin:20px 0 8px;">Các công cụ theo lĩnh vực</h4>
        <div id="bs-tools-container">
          ${tools.map((t, i) => this._toolCategoryHtml(t, i, editable, dis)).join('')}
        </div>
        ${editable ? '<button class="btn btn-secondary btn-sm" style="margin-top:8px;" onclick="window.BaseSyllabusEditorPage.addToolCategory()">+ Thêm lĩnh vực</button>' : ''}

        <h4 style="font-size:14px;font-weight:600;margin:24px 0 8px;">Các yêu cầu của HP (mục 17)</h4>
        <div class="input-group">
          <textarea id="bs-other-req" ${dis} rows="3" placeholder="Yêu cầu khác (nếu có)">${esc(c.other_requirements)}</textarea>
        </div>
      </div>
    `;
  },

  _toolCategoryHtml(t, i, editable, dis) {
    const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    const items = Array.isArray(t.items) ? t.items.join('\n') : '';
    return `<div class="tool-category" data-idx="${i}" style="border:1px solid var(--border);border-radius:var(--radius);padding:12px;margin-bottom:8px;background:var(--bg-secondary);">
      <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;">
        <label style="font-size:12px;white-space:nowrap;">Lĩnh vực:</label>
        <input type="text" data-field="category" value="${esc(t.category)}" ${dis} placeholder="VD: Kỹ thuật - Công nghệ" style="flex:1;${BS_INP}">
        ${editable ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('.tool-category').remove()">✕</button>` : ''}
      </div>
      <textarea data-field="items" ${dis} rows="3" placeholder="Mỗi dòng = 1 công cụ" style="${BS_INP}">${esc(items)}</textarea>
    </div>`;
  },

  addToolCategory() {
    const container = document.getElementById('bs-tools-container');
    if (!container) return;
    container.insertAdjacentHTML('beforeend', this._toolCategoryHtml({ category: '', items: [] }, container.children.length, true, ''));
  },

  _collectResources() {
    const textbooksEl = document.getElementById('bs-textbooks');
    if (!textbooksEl) return;
    const toArr = id => (document.getElementById(id)?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
    const toolsContainer = document.getElementById('bs-tools-container');
    const tools = toolsContainer ? Array.from(toolsContainer.querySelectorAll('.tool-category')).map(div => ({
      category: div.querySelector('[data-field="category"]').value,
      items: div.querySelector('[data-field="items"]').value.split('\n').map(s => s.trim()).filter(Boolean),
    })).filter(t => t.category || t.items.length) : [];
    this.baseSyllabus.content = {
      ...this.baseSyllabus.content,
      textbooks: toArr('bs-textbooks'),
      references: toArr('bs-references'),
      tools,
      other_requirements: document.getElementById('bs-other-req')?.value || '',
    };
    // Drop legacy v2 course_requirements if still present
    delete this.baseSyllabus.content.course_requirements;
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
        const courseResp = await r.json();
        if (!r.ok) throw new Error(courseResp.error || 'Lỗi lưu thông tin HP');
        Object.assign(this.course, courseResp);
        this._pendingCourseUpdate = null;
      }

      // 2. Save content
      const res = await fetch(`/api/courses/${this.courseId}/base-syllabus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: this.baseSyllabus.content }),
      });
      const saved = await res.json();
      if (!res.ok) throw new Error(saved.error || 'Lỗi lưu');
      this.baseSyllabus = { ...this.baseSyllabus, ...saved };
      this.baseSyllabus.content = typeof saved.content === 'string' ? JSON.parse(saved.content) : saved.content;
      this.isNew = false;
      window.toast.success('Đã lưu đề cương cơ bản');
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  async validateAndExport(format) {
    try {
      const v = await fetch(`/api/courses/${this.courseId}/base-syllabus/validate`, { method: 'POST' }).then(r => r.json());
      if (!v.ok) {
        const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const list = v.issues.map(i => `• ${esc(i.message)}`).join('<br>');
        const proceed = await window.ui.confirm({
          title: 'Đề cương chưa đầy đủ',
          message: `Còn các vấn đề sau:<br>${list}<br><br>Bạn vẫn muốn xuất?`,
          confirmText: 'Xuất dù vậy', cancelText: 'Hủy', tone: 'warning',
        });
        if (!proceed) return;
      }
      const url = `/api/courses/${this.courseId}/base-syllabus/export.${format}`;
      window.open(url, '_blank');
    } catch (e) { window.toast.error(e.message); }
  },

  destroy() {}
};
