// Programs Page — CTĐT CRUD + Version management
window.ProgramsPage = {
  programs: [],
  departments: [],

  async render(container, params = {}) {
    this.routeParams = params || {};
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Chương trình Đào tạo</div>
          <div class="flex-row">
            ${window.App.hasPerm('programs.import_word') ? `<button class="btn btn-outline-primary" onclick="window.App.navigate('import-word')">Import Word</button>` : ''}
            ${window.App.hasPerm('programs.create') ? `<button class="btn btn-primary" onclick="window.ProgramsPage.openAddModal()">+ Tạo CTĐT</button>` : ''}
          </div>
        </div>
        <div id="programs-content" class="card-body"><div class="spinner"></div></div>
      </div>

      <!-- CTDT Modal -->
      <div id="prog-modal" class="modal-overlay">
        <div class="modal" style="max-width:720px;max-height:90vh;display:flex;flex-direction:column;">
          <div class="modal-header" style="flex-shrink:0;"><h2 id="prog-modal-title">Tạo CTĐT</h2></div>
          <div class="modal-body" style="overflow-y:auto;flex:1;">
            <form id="prog-form">
              <input type="hidden" id="prog-edit-id">
              <p class="section-title mb-2" style="font-size:14px;">Thông tin cơ bản</p>
              <p class="text-muted mb-3" style="font-size:12px;">Các trường có dấu * là bắt buộc.</p>
              <div class="grid-2col">
                <div class="input-group">
                  <label>Mã chương trình <span class="required-mark">*</span></label>
                  <input type="text" id="prog-code" required placeholder="VD: 7220204">
                </div>
                <div class="input-group">
                  <label>Khoa quản lý <span class="required-mark">*</span></label>
                  <select id="prog-dept" required></select>
                </div>
                <div class="input-group">
                  <label>Ngành</label>
                  <select id="prog-nganh"><option value="">— Toàn khoa —</option></select>
                </div>
                <div class="input-group">
                  <label>Bậc đào tạo</label>
                  <select id="prog-degree">
                    <option value="Đại học">Đại học</option>
                    <option value="Cao đẳng">Cao đẳng</option>
                    <option value="Sau đại học">Sau đại học</option>
                  </select>
                </div>
                <div class="input-group">
                  <label>Tên chương trình (Tiếng Việt) <span class="required-mark">*</span></label>
                  <input type="text" id="prog-name" required placeholder="VD: Ngôn ngữ Trung Quốc" maxlength="255">
                </div>
                <div class="input-group">
                  <label>Tên chương trình (Tiếng Anh) <span class="required-mark">*</span></label>
                  <input type="text" id="prog-name-en" required placeholder="VD: Chinese Language" maxlength="255">
                </div>
                <div class="input-group">
                  <label>Tổng tín chỉ</label>
                  <input type="number" id="prog-credits" placeholder="VD: 130" min="1">
                </div>
              </div>

              <hr style="border:none;border-top:2px dashed var(--border);margin:16px 0;">
              <p class="section-title mb-2" style="font-size:14px;">Thông tin bổ sung</p>
              <p class="text-muted mb-3" style="font-size:12px;">Cung cấp thêm thông tin để đội ngũ tuyển sinh và đào tạo nắm rõ đặc điểm chương trình.</p>
              <div class="grid-2col">
                <div class="input-group">
                  <label>Cơ sở cấp bằng</label>
                  <input type="text" id="prog-institution" placeholder="VD: Trường Đại học Công nghệ TP.HCM">
                </div>
                <div class="input-group">
                  <label>Tên bằng cấp</label>
                  <input type="text" id="prog-degree-name" placeholder="VD: Cử nhân Ngôn ngữ Trung Quốc">
                </div>
                <div class="input-group">
                  <label>Hình thức đào tạo</label>
                  <select id="prog-training-mode">
                    <option value="Chính quy">Chính quy</option>
                    <option value="Vừa làm vừa học">Vừa làm vừa học</option>
                    <option value="Từ xa">Từ xa</option>
                    <option value="Liên thông">Liên thông</option>
                  </select>
                </div>
              </div>
              <div class="input-group" style="margin-top:12px;">
                <label>Ghi chú bổ sung</label>
                <textarea id="prog-notes" placeholder="Ghi chú bổ sung" rows="3" maxlength="1000" style="width:100%;resize:vertical;"></textarea>
                <span style="font-size:11px;color:var(--text-muted);" id="prog-notes-count">Tối đa 1000 ký tự — 0/1000</span>
              </div>

            </form>
          </div>
          <div class="modal-footer" style="flex-shrink:0;box-shadow:0 -4px 12px rgba(0,0,0,0.1);border-top:1px solid var(--border);padding:12px 24px;background:var(--bg, #fff);z-index:1;border-radius:0 0 12px 12px;">
            <button type="button" class="btn btn-secondary" onclick="window.ProgramsPage.closeModal()">Hủy</button>
            <button type="button" class="btn btn-primary" id="prog-save-btn" onclick="document.getElementById('prog-form').requestSubmit()">Tạo mới</button>
          </div>
        </div>
      </div>

      <!-- Version Edit Modal (used for both Create and Edit) -->
      <div id="ver-edit-modal" class="modal-overlay">
        <div class="modal" style="max-width:720px;max-height:90vh;display:flex;flex-direction:column;">
          <div class="modal-header" style="flex-shrink:0;"><h2 id="ver-edit-modal-title">Chỉnh Sửa Khóa</h2></div>
          <div class="modal-body" style="overflow-y:auto;flex:1;">
            <form id="ver-edit-form">
              <input type="hidden" id="ver-edit-id">
              <input type="hidden" id="ver-edit-program-id">
              <input type="hidden" id="ver-edit-program-name">
              <div class="grid-2col">
                <div class="input-group">
                  <label>Số Khóa <span class="required-mark">*</span></label>
                  <input type="text" id="ver-edit-year" required placeholder="VD: 2026" inputmode="numeric" maxlength="4" oninput="window.ProgramsPage.formatAcademicYear(this)">
                </div>
                <div class="input-group">
                  <label>Tên Khóa</label>
                  <input type="text" id="ver-edit-name" placeholder="VD: khóa năm 2026">
                </div>
                <div class="input-group" id="ver-edit-copy-group" style="display:none;">
                  <label>Copy từ khóa</label>
                  <select id="ver-copy-from"><option value="">— Tạo mới trắng —</option></select>
                </div>
                <div class="input-group">
                  <label>Tổng Số Tín Chỉ</label>
                  <input type="text" id="ver-edit-credits" placeholder="VD: 125" inputmode="numeric" oninput="this.value=this.value.replace(/[^0-9]/g,'')">
                </div>
                <div class="input-group">
                  <label>Thời Gian Đào Tạo</label>
                  <input type="text" id="ver-edit-duration" placeholder="VD: 3.5 năm">
                </div>
                <div class="input-group">
                  <label>Loại Thay Đổi</label>
                  <select id="ver-edit-change-type">
                    <option value="">— Chọn —</option>
                    <option value="Thay đổi nhỏ">Thay đổi nhỏ</option>
                    <option value="Thay đổi lớn">Thay đổi lớn</option>
                    <option value="Xây dựng mới">Xây dựng mới</option>
                  </select>
                </div>
                <div class="input-group">
                  <label>Trạng Thái</label>
                  <select id="ver-edit-status" disabled>
                    <option value="draft">Bản nháp</option>
                    <option value="submitted">Đã nộp</option>
                    <option value="approved_khoa">Duyệt Khoa</option>
                    <option value="approved_pdt">Duyệt PĐT</option>
                    <option value="published">Đã công bố</option>
                  </select>
                </div>
                <div class="input-group">
                  <label>Ngày Hiệu Lực</label>
                  <input type="date" id="ver-edit-effective-date">
                </div>
              </div>
              <div class="input-group" style="margin-top:12px;">
                <label>Tóm Tắt Thay Đổi</label>
                <textarea id="ver-edit-change-summary" rows="2" placeholder="Tóm tắt những thay đổi chính..." style="width:100%;resize:vertical;"></textarea>
              </div>
              <hr style="border:none;border-top:2px dashed var(--border);margin:16px 0;">
              <div class="input-group">
                <label>Thang Điểm Đánh Giá và Cách Thức Đánh Giá</label>
                <textarea id="ver-edit-grading" rows="3" style="width:100%;resize:vertical;"></textarea>
              </div>
              <div class="input-group">
                <label>Điều Kiện Tốt Nghiệp</label>
                <textarea id="ver-edit-graduation" rows="3" style="width:100%;resize:vertical;"></textarea>
              </div>
              <div class="input-group">
                <label>Vị Trí Việc Làm Sau Tốt Nghiệp</label>
                <textarea id="ver-edit-jobs" rows="3" style="width:100%;resize:vertical;"></textarea>
              </div>
              <div class="input-group">
                <label>Con Đường Học Tập Nâng Cao Trình Độ</label>
                <textarea id="ver-edit-further-edu" rows="3" style="width:100%;resize:vertical;"></textarea>
              </div>
              <div class="input-group">
                <label>Chương Trình Tham Khảo Khi Xây Dựng</label>
                <textarea id="ver-edit-reference" rows="3" style="width:100%;resize:vertical;"></textarea>
              </div>
              <div class="input-group">
                <label>Quy Trình Đào Tạo</label>
                <textarea id="ver-edit-training-process" rows="3" style="width:100%;resize:vertical;"></textarea>
              </div>
              <div class="input-group">
                <label>Đối Tượng Tuyển Sinh</label>
                <textarea id="ver-edit-admission-targets" rows="3" style="width:100%;resize:vertical;"></textarea>
              </div>
              <div class="input-group">
                <label>Tiêu Chí Tuyển Sinh</label>
                <textarea id="ver-edit-admission-criteria" rows="3" style="width:100%;resize:vertical;"></textarea>
              </div>
            </form>
          </div>
          <div class="modal-footer" style="flex-shrink:0;box-shadow:0 -4px 12px rgba(0,0,0,0.1);border-top:1px solid var(--border);padding:12px 24px;background:var(--bg, #fff);z-index:1;border-radius:0 0 12px 12px;">
            <button type="button" class="btn btn-secondary" onclick="document.getElementById('ver-edit-modal').classList.remove('active')">Hủy</button>
            <button type="button" class="btn btn-primary" id="ver-edit-save-btn" onclick="document.getElementById('ver-edit-form').requestSubmit()">Cập Nhật</button>
          </div>
        </div>
      </div>
    `;
    document.getElementById('prog-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveProgram();
    });
    document.getElementById('ver-edit-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveCohortOrVersion();
    });
    document.getElementById('prog-notes').addEventListener('input', () => this.updateNotesCount());

    // Backdrop click handled by App.modalGuard (set when modal opens)

    await this.loadData();
  },

  async loadData() {
    try {
      const [programs, depts] = await Promise.all([
        fetch('/api/programs').then(r => r.json()),
        fetch('/api/departments').then(r => r.json()),
      ]);
      this.programs = programs;
      this.allDepartments = depts;
      this.departments = depts.filter(d => ['KHOA', 'VIEN', 'TRUNG_TAM'].includes(d.type));
      if (this.routeParams && (this.routeParams.deptId || this.routeParams.deptName)) {
        this.programs = this.programs.filter(p => 
          (this.routeParams.deptId && p.department_id == this.routeParams.deptId) ||
          (this.routeParams.deptName && p.dept_name === this.routeParams.deptName)
        );
      }
      this.renderList();
      if (this.routeParams && this.routeParams.programId) {
        const pId = this.routeParams.programId;
        const pName = this.routeParams.programName || '';
        this.routeParams.programId = null; // Clear so back button works correctly
        this.viewCohorts(pId, pName);
      }
    } catch (e) {
      document.getElementById('programs-content').innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`;
    }
  },

  renderList() {
    const content = document.getElementById('programs-content');
    if (this.programs.length === 0) {
      content.innerHTML = '<div class="empty-state"><div class="icon">📭</div><h3>Chưa có CTĐT nào</h3><p>Nhấn "+ Tạo CTĐT" để bắt đầu</p></div>';
      return;
    }

    // Group by Khoa → Ngành → CTĐT
    // Structure: { khoaName: { directProgs: [...], nganhs: { nganhName: [...] } } }
    const tree = {};
    this.programs.forEach(p => {
      const isNganh = p.dept_type === 'BO_MON' && p.parent_dept_name;
      const khoaName = isNganh ? p.parent_dept_name : p.dept_name;
      const nganhName = isNganh ? p.dept_name : null;

      if (!tree[khoaName]) tree[khoaName] = { directProgs: [], nganhs: {} };
      if (nganhName) {
        if (!tree[khoaName].nganhs[nganhName]) tree[khoaName].nganhs[nganhName] = [];
        tree[khoaName].nganhs[nganhName].push(p);
      } else {
        tree[khoaName].directProgs.push(p);
      }
    });

    const renderProg = (p) => `
      <div class="tree-node flex-between" style="cursor:pointer;"
           onclick="window.ProgramsPage.viewCohorts(${p.id},'${p.name.replace(/'/g,"\\'")}')">
        <div style="flex:1;min-width:0;">
          <div style="font-weight:600;font-size:14px;">${p.name}</div>
          <div style="font-size:11px;color:var(--text-muted);">
            Mã: ${p.code || '—'} · ${p.degree} · ${p.total_credits || '?'} TC ·
            <span class="badge badge-neutral">${p.version_count} khóa</span>
          </div>
        </div>
        <div class="flex-row" style="flex-shrink:0;" onclick="event.stopPropagation()">
            ${window.App.hasPerm('programs.edit') ? `<button class="btn btn-sm btn-outline-secondary" onclick="window.ProgramsPage.openEditModal(${p.id})">Chỉnh sửa</button>` : ''}
            ${window.App.hasPerm('programs.delete_draft') ? `<button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="window.ProgramsPage.deleteProgram(${p.id}, '${p.name.replace(/'/g, "\\'")}')">Xóa</button>` : ''}
        </div>
      </div>
    `;

    content.innerHTML = Object.entries(tree).map(([khoa, data]) => `
      <div style="margin-bottom:24px;">
        <h3 class="section-title" style="font-weight:700;margin-bottom:10px;border-bottom:2px solid var(--border);padding-bottom:6px;">${khoa}</h3>
        ${data.directProgs.length ? `<div style="display:grid;gap:8px;margin-bottom:12px;">${data.directProgs.map(renderProg).join('')}</div>` : ''}
        ${Object.entries(data.nganhs).map(([nganh, progs]) => `
          <div style="margin-left:20px;margin-bottom:14px;">
            <h4 class="mb-2" style="font-size:13px;font-weight:600;color:var(--text-muted);">${nganh}</h4>
            <div style="display:grid;gap:8px;">
              ${progs.map(renderProg).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  },

  async deleteProgram(id, name) {
    const confirmed = await window.ui.confirm({
      title: 'Xóa chương trình đào tạo',
      eyebrow: 'Hành động nguy hiểm',
      message: `Bạn có chắc chắn muốn xóa CTĐT "${name}"?\n\nThao tác này sẽ xóa tất cả các khóa, PO, PLO và dữ liệu liên quan.`,
      confirmText: 'Xóa CTĐT',
      cancelText: 'Hủy',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/programs/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      window.toast.success('Đã xóa chương trình đào tạo');
      await this.loadData();
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  // CTDT Modal
  openAddModal() {
    document.getElementById('prog-modal-title').textContent = 'Tạo CTĐT mới';
    document.getElementById('prog-form').reset();
    document.getElementById('prog-edit-id').value = '';
    this.populateDeptSelect();
    document.getElementById('prog-save-btn').textContent = 'Tạo mới';
    document.getElementById('prog-modal').classList.add('active');
    App.modalGuard('prog-modal', () => ProgramsPage.saveProgram());
  },

  openEditModal(id) {
    const p = this.programs.find(x => x.id === id);
    if (!p) return;
    document.getElementById('prog-modal-title').textContent = 'Sửa CTĐT';
    document.getElementById('prog-edit-id').value = p.id;
    this.populateDeptSelect(p.department_id);
    document.getElementById('prog-name').value = p.name;
    document.getElementById('prog-name-en').value = p.name_en || '';
    document.getElementById('prog-code').value = p.code || '';
    document.getElementById('prog-degree').value = p.degree;
    document.getElementById('prog-credits').value = p.total_credits || '';
    document.getElementById('prog-institution').value = p.institution || '';
    document.getElementById('prog-degree-name').value = p.degree_name || '';
    document.getElementById('prog-training-mode').value = p.training_mode || 'Chính quy';
    document.getElementById('prog-notes').value = p.notes || '';
    this.updateNotesCount();
    document.getElementById('prog-save-btn').textContent = 'Cập nhật';
    document.getElementById('prog-modal').classList.add('active');
    App.modalGuard('prog-modal', () => ProgramsPage.saveProgram());
  },

  populateDeptSelect(selectedDeptId) {
    const sel = document.getElementById('prog-dept');
    sel.innerHTML = this.departments.map(d =>
      `<option value="${d.id}">${d.name} (${d.code})</option>`
    ).join('');

    // Determine if selectedDeptId is a ngành (BO_MON) or a khoa
    const selectedDept = this.allDepartments.find(d => d.id == selectedDeptId);
    if (selectedDept && selectedDept.type === 'BO_MON' && selectedDept.parent_id) {
      sel.value = selectedDept.parent_id;
      this.populateNganhSelect(selectedDept.parent_id, selectedDeptId);
    } else if (selectedDeptId) {
      sel.value = selectedDeptId;
      this.populateNganhSelect(selectedDeptId, null);
    } else {
      this.populateNganhSelect(sel.value, null);
    }

    sel.onchange = () => this.populateNganhSelect(sel.value, null);
  },

  populateNganhSelect(khoaId, selectedNganhId) {
    const nganhSel = document.getElementById('prog-nganh');
    const children = this.allDepartments.filter(
      d => d.parent_id == khoaId && d.type === 'BO_MON'
    );
    nganhSel.innerHTML = '<option value="">— Toàn khoa —</option>' +
      children.map(d =>
        `<option value="${d.id}" ${d.id == selectedNganhId ? 'selected' : ''}>${d.name} (${d.code})</option>`
      ).join('');
  },

  closeModal() { document.getElementById('prog-modal').classList.remove('active'); },

  async saveProgram() {
    const id = document.getElementById('prog-edit-id').value;
    const name = document.getElementById('prog-name').value.trim();
    const name_en = document.getElementById('prog-name-en').value.trim();
    const code = document.getElementById('prog-code').value.trim();
    const nganhVal = document.getElementById('prog-nganh').value;
    const department_id = nganhVal || document.getElementById('prog-dept').value;
    const degree = document.getElementById('prog-degree').value;
    const total_credits = parseInt(document.getElementById('prog-credits').value) || null;
    const institution = document.getElementById('prog-institution').value.trim() || null;
    const degree_name = document.getElementById('prog-degree-name').value.trim() || null;
    const training_mode = document.getElementById('prog-training-mode').value;
    const notes = document.getElementById('prog-notes').value.trim() || null;

    if (!name) { window.toast.error('Vui lòng nhập tên chương trình (Tiếng Việt)'); return; }
    if (!name_en) { window.toast.error('Vui lòng nhập tên chương trình (Tiếng Anh)'); return; }
    if (!code) { window.toast.error('Vui lòng nhập mã chương trình'); return; }
    try {
      const url = id ? `/api/programs/${id}` : '/api/programs';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, name_en, code, department_id, degree, total_credits, institution, degree_name, training_mode, notes })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      this.closeModal();
      window.toast.success(id ? 'Đã cập nhật CTĐT' : 'Đã tạo CTĐT');
      await this.loadData();
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  updateNotesCount() {
    const val = document.getElementById('prog-notes').value;
    const counter = document.getElementById('prog-notes-count');
    if (counter) counter.textContent = `Tối đa 1000 ký tự — ${val.length}/1000`;
  },

  // Cohort Modal — create a new cohort (academic year only)
  openCohortModal(programId) {
    document.getElementById('ver-edit-modal-title').textContent = 'Tạo khóa mới';
    document.getElementById('ver-edit-id').value = '';
    document.getElementById('ver-edit-program-id').value = programId;
    document.getElementById('ver-edit-program-name').value = '__cohort_mode__';
    document.getElementById('ver-edit-year').value = `${new Date().getFullYear()}`;
    document.getElementById('ver-edit-name').value = '';
    document.getElementById('ver-edit-copy-group').style.display = 'none';
    document.getElementById('ver-edit-credits').value = '';
    document.getElementById('ver-edit-duration').value = '';
    document.getElementById('ver-edit-change-type').value = '';
    document.getElementById('ver-edit-status').value = 'draft';
    document.getElementById('ver-edit-effective-date').value = '';
    document.getElementById('ver-edit-change-summary').value = '';
    document.getElementById('ver-edit-grading').value = '';
    document.getElementById('ver-edit-graduation').value = '';
    document.getElementById('ver-edit-jobs').value = '';
    document.getElementById('ver-edit-further-edu').value = '';
    document.getElementById('ver-edit-reference').value = '';
    document.getElementById('ver-edit-training-process').value = '';
    document.getElementById('ver-edit-admission-targets').value = '';
    document.getElementById('ver-edit-admission-criteria').value = '';
    document.getElementById('ver-edit-save-btn').textContent = 'Tạo khóa';
    document.getElementById('ver-edit-modal').classList.add('active');
    App.modalGuard('ver-edit-modal', () => ProgramsPage.saveCohortOrVersion());
  },

  // Variant Modal — create a new variant inside a cohort
  async openVariantModal(cohortId, variantType, programName) {
    const variantLabels = { DHCQ: 'Đại học Chính quy', QUOC_TE: 'Quốc Tế', VIET_HAN: 'Việt - Hàn', VIET_NHAT: 'Việt - Nhật' };
    document.getElementById('ver-edit-modal-title').textContent = `Tạo variant: ${variantLabels[variantType]}`;
    document.getElementById('ver-edit-id').value = '';
    document.getElementById('ver-edit-program-id').value = cohortId;
    document.getElementById('ver-edit-program-name').value = `__variant_mode__:${variantType}`;
    document.getElementById('ver-edit-year').value = '';
    document.getElementById('ver-edit-name').value = '';
    document.getElementById('ver-edit-credits').value = '';
    document.getElementById('ver-edit-duration').value = '';
    document.getElementById('ver-edit-change-type').value = '';
    document.getElementById('ver-edit-status').value = 'draft';
    document.getElementById('ver-edit-effective-date').value = '';
    document.getElementById('ver-edit-change-summary').value = '';
    document.getElementById('ver-edit-grading').value = '';
    document.getElementById('ver-edit-graduation').value = '';
    document.getElementById('ver-edit-jobs').value = '';
    document.getElementById('ver-edit-further-edu').value = '';
    document.getElementById('ver-edit-reference').value = '';
    document.getElementById('ver-edit-training-process').value = '';
    document.getElementById('ver-edit-admission-targets').value = '';
    document.getElementById('ver-edit-admission-criteria').value = '';
    document.getElementById('ver-edit-save-btn').textContent = 'Tạo variant';

    // Show copy dropdown with matching published variants from other cohorts
    document.getElementById('ver-edit-copy-group').style.display = '';
    const sel = document.getElementById('ver-copy-from');
    sel.innerHTML = '<option value="">— Tạo mới trắng —</option>';
    try {
      const cohortRes = await fetch(`/api/cohorts/${cohortId}`).then(r => r.json());
      const allVersions = await fetch(`/api/programs/${cohortRes.program_id}/versions`).then(r => r.json()).then(d => Array.isArray(d) ? d : []);
      const matching = allVersions
        .filter(v => v.variant_type === variantType && v.status === 'published' && v.cohort_id !== parseInt(cohortId))
        .sort((a, b) => b.academic_year.localeCompare(a.academic_year));
      matching.forEach(v => {
        sel.innerHTML += `<option value="${v.id}">Khóa ${v.academic_year} (published)</option>`;
      });
      if (matching.length > 0) sel.value = matching[0].id;
    } catch (e) {}

    document.getElementById('ver-edit-modal').classList.add('active');
    App.modalGuard('ver-edit-modal', () => ProgramsPage.saveCohortOrVersion());
  },

  async viewCohorts(programId, programName) {
    this._currentProgramId = programId;
    this._currentProgramName = programName;

    const content = document.getElementById('programs-content');
    content.innerHTML = '<div class="spinner"></div>';

    const cardHeader = content.closest('.card').querySelector('.card-header');
    this._originalHeaderHTML = cardHeader.innerHTML;
    cardHeader.innerHTML = `
      <div class="card-title">Khóa — ${programName}</div>
      ${window.App.hasPerm('programs.create_version') ? `<button class="btn btn-primary" onclick="window.ProgramsPage.openCohortModal(${programId})">+ Tạo khóa</button>` : ''}
    `;

    try {
      const cohorts = await fetch(`/api/programs/${programId}/cohorts`).then(r => r.json()).then(d => Array.isArray(d) ? d : []);
      const statusColors = { draft: 'badge-warning', submitted: 'badge-info', approved_khoa: 'badge-info', approved_pdt: 'badge-info', published: 'badge-success' };
      const statusLabels = { draft: 'Nháp', submitted: 'Đã nộp', approved_khoa: 'Duyệt Khoa ✓', approved_pdt: 'Duyệt PĐT ✓', published: 'Đã công bố' };
      const variantLabels = { DHCQ: 'Đại học Chính quy', QUOC_TE: 'Quốc Tế', VIET_HAN: 'Việt - Hàn', VIET_NHAT: 'Việt - Nhật' };
      const ALL_VARIANTS = ['DHCQ', 'QUOC_TE', 'VIET_HAN', 'VIET_NHAT'];

      const renderVariantSlots = (cohort) => ALL_VARIANTS.map(vt => {
        const v = (cohort.variants || []).find(x => x.variant_type === vt);
        if (!v) {
          return window.App.hasPerm('programs.create_version') ? `
            <div class="tree-node" style="opacity:0.5;display:flex;align-items:center;justify-content:space-between;">
              <span style="font-size:13px;color:var(--text-muted);">${variantLabels[vt]}</span>
              <button class="btn btn-sm btn-outline-primary" onclick="window.ProgramsPage.openVariantModal(${cohort.id},'${vt}','${programName.replace(/'/g,"\\'")}')">+ Tạo</button>
            </div>` : `<div class="tree-node" style="opacity:0.3;font-size:13px;color:var(--text-muted);">${variantLabels[vt]} — Chưa có</div>`;
        }
        return `
          <div class="tree-node flex-between" style="cursor:pointer;"
               onclick="window.App.navigate('version-editor',{versionId:${v.id}})">
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:13px;">${variantLabels[vt]}
                ${v.is_locked ? '<span class="badge badge-danger" style="margin-left:4px;">🔒</span>' : ''}
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                <span class="badge ${statusColors[v.status] || 'badge-neutral'}">${statusLabels[v.status] || v.status}</span>
                ${v.is_rejected ? '<span class="badge badge-danger">Từ chối</span>' : ''}
                · ${v.completion_pct || 0}%
              </div>
            </div>
            <div class="flex-row" style="flex-shrink:0;" onclick="event.stopPropagation()">
              ${window.App.hasPerm('programs.delete_draft') && v.status === 'draft' ? `<button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="window.ProgramsPage.deleteVariant(${v.id},'${variantLabels[vt]}',${cohort.id},${programId},'${programName.replace(/'/g,"\\'")}')">Xóa</button>` : ''}
            </div>
          </div>`;
      }).join('');

      content.innerHTML = `
        <div class="flex-row mb-4" style="gap:10px;">
          <button class="btn btn-secondary btn-sm" onclick="window.ProgramsPage.backToList()">← Quay lại</button>
          <h3 class="section-title">Khóa: ${programName}</h3>
        </div>
        ${cohorts.length === 0
          ? '<div class="empty-state"><div class="icon">📭</div><p>Chưa có khóa nào</p></div>'
          : `<div style="display:grid;gap:12px;">
            ${cohorts.map(c => `
              <div style="border:1px solid var(--border);border-radius:var(--radius-lg);overflow:hidden;">
                <div class="flex-between" style="padding:12px 16px;background:var(--bg-secondary);cursor:pointer;"
                     onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'">
                  <div style="font-weight:700;font-size:15px;">Khóa ${c.academic_year}
                    <span class="badge badge-neutral" style="margin-left:8px;">${(c.variants||[]).length} variant</span>
                  </div>
                  <div class="flex-row" onclick="event.stopPropagation()">
                    ${window.App.hasPerm('programs.delete_draft') ? `<button class="btn btn-sm btn-ghost" style="color:var(--danger);" onclick="window.ProgramsPage.deleteCohort(${c.id},'${c.academic_year}',${programId},'${programName.replace(/'/g,"\\'")}')">Xóa khóa</button>` : ''}
                  </div>
                </div>
                <div style="padding:12px 16px;display:grid;gap:8px;">
                  ${renderVariantSlots(c)}
                </div>
              </div>
            `).join('')}
          </div>`
        }
      `;
    } catch (e) {
      content.innerHTML = `<p style="color:var(--danger);">Lỗi: ${e.message}</p>`;
    }
  },

  // Back to program list — restore original header
  backToList() {
    const content = document.getElementById('programs-content');
    const cardHeader = content.closest('.card').querySelector('.card-header');
    if (this._originalHeaderHTML) {
      cardHeader.innerHTML = this._originalHeaderHTML;
      this._originalHeaderHTML = null;
    }
    this.loadData();
  },


  async deleteVariant(versionId, variantLabel, cohortId, programId, programName) {
    const confirmed = await window.ui.confirm({
      title: 'Xóa CTDT Variant',
      eyebrow: 'Xác nhận thao tác',
      message: `Xóa variant "${variantLabel}"? Thao tác này sẽ xóa toàn bộ nội dung (PLO, học phần, đề cương...).`,
      confirmText: 'Xóa',
      cancelText: 'Hủy',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/versions/${versionId}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      window.toast.success(`Đã xóa variant ${variantLabel}`);
      await this.viewCohorts(programId, programName);
    } catch (e) { window.toast.error(e.message); }
  },

  async deleteCohort(cohortId, year, programId, programName) {
    const confirmed = await window.ui.confirm({
      title: 'Xóa khóa',
      eyebrow: 'Xác nhận thao tác',
      message: `Xóa khóa "${year}" và tất cả các variant bên trong?`,
      confirmText: 'Xóa khóa',
      cancelText: 'Hủy',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/cohorts/${cohortId}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      window.toast.success(`Đã xóa khóa ${year}`);
      await this.viewCohorts(programId, programName);
    } catch (e) { window.toast.error(e.message); }
  },

  // Version Edit Modal
  async openVersionEditModal(versionId, programId, programName) {
    try {
      const v = await fetch(`/api/versions/${versionId}`).then(r => r.json());
      document.getElementById('ver-edit-id').value = v.id;
      document.getElementById('ver-edit-program-id').value = programId;
      document.getElementById('ver-edit-program-name').value = programName;
      document.getElementById('ver-edit-modal-title').textContent = `Chỉnh Sửa Khóa - ${programName}`;
      document.getElementById('ver-edit-save-btn').textContent = 'Cập Nhật';
      document.getElementById('ver-edit-copy-group').style.display = 'none';
      document.getElementById('ver-edit-year').value = v.academic_year || '';
      document.getElementById('ver-edit-name').value = v.version_name || '';
      document.getElementById('ver-edit-credits').value = v.total_credits || '';
      document.getElementById('ver-edit-duration').value = v.training_duration || '';
      document.getElementById('ver-edit-change-type').value = v.change_type || '';
      document.getElementById('ver-edit-status').value = v.status || 'draft';
      document.getElementById('ver-edit-effective-date').value = v.effective_date ? v.effective_date.split('T')[0] : '';
      document.getElementById('ver-edit-change-summary').value = v.change_summary || '';
      document.getElementById('ver-edit-grading').value = v.grading_scale || '';
      document.getElementById('ver-edit-graduation').value = v.graduation_requirements || '';
      document.getElementById('ver-edit-jobs').value = v.job_positions || '';
      document.getElementById('ver-edit-further-edu').value = v.further_education || '';
      document.getElementById('ver-edit-reference').value = v.reference_programs || '';
      document.getElementById('ver-edit-training-process').value = v.training_process || '';
      document.getElementById('ver-edit-admission-targets').value = v.admission_targets || '';
      document.getElementById('ver-edit-admission-criteria').value = v.admission_criteria || '';
        document.getElementById('ver-edit-modal').classList.add('active');
        App.modalGuard('ver-edit-modal', () => ProgramsPage.saveCohortOrVersion());
    } catch (e) {
      window.toast.error('Không thể tải dữ liệu khóa: ' + e.message);
    }
  },

  async saveCohortOrVersion() {
    const id = document.getElementById('ver-edit-id').value;
    const programOrCohortId = document.getElementById('ver-edit-program-id').value;
    const modeFlag = document.getElementById('ver-edit-program-name').value;

    if (id) {
      // Edit existing version
      const academic_year = document.getElementById('ver-edit-year').value.trim();
      if (!academic_year || !/^\d{4}$/.test(academic_year)) {
        window.toast.error('Số khóa phải có định dạng 4 chữ số (VD: 2026)'); return;
      }
      try {
        const res = await fetch(`/api/versions/${id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this._buildVersionBody())
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        document.getElementById('ver-edit-modal').classList.remove('active');
        window.toast.success('Đã cập nhật khóa');
        if (this._currentProgramId) await this.viewCohorts(this._currentProgramId, this._currentProgramName || '');
      } catch (e) { window.toast.error(e.message); }
      return;
    }

    if (modeFlag === '__cohort_mode__') {
      // Create cohort (academic_year only)
      const academic_year = document.getElementById('ver-edit-year').value.trim();
      if (!academic_year || !/^\d{4}$/.test(academic_year)) {
        window.toast.error('Số khóa phải có định dạng 4 chữ số (VD: 2026)'); return;
      }
      try {
        const res = await fetch(`/api/programs/${programOrCohortId}/cohorts`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ academic_year })
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        document.getElementById('ver-edit-modal').classList.remove('active');
        window.toast.success(`Đã tạo khóa ${academic_year}`);
        await this.viewCohorts(parseInt(programOrCohortId), this._currentProgramName || '');
      } catch (e) { window.toast.error(e.message); }
      return;
    }

    if (modeFlag && modeFlag.startsWith('__variant_mode__:')) {
      // Create variant inside cohort
      const variantType = modeFlag.split(':')[1];
      const copy_from_version_id = document.getElementById('ver-copy-from').value || null;
      const body = {
        variant_type: variantType,
        copy_from_version_id: copy_from_version_id ? parseInt(copy_from_version_id) : null,
        ...this._buildVersionBody()
      };
      try {
        const res = await fetch(`/api/cohorts/${programOrCohortId}/variants`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
        document.getElementById('ver-edit-modal').classList.remove('active');
        window.toast.success(`Đã tạo variant${copy_from_version_id ? ' (đã copy dữ liệu)' : ''}`);
        await this.viewCohorts(this._currentProgramId, this._currentProgramName || '');
      } catch (e) { window.toast.error(e.message); }
      return;
    }
  },

  _buildVersionBody() {
    return {
      academic_year: document.getElementById('ver-edit-year').value.trim() || null,
      version_name: document.getElementById('ver-edit-name').value.trim() || null,
      total_credits: parseInt(document.getElementById('ver-edit-credits').value) || null,
      training_duration: document.getElementById('ver-edit-duration').value.trim() || null,
      change_type: document.getElementById('ver-edit-change-type').value || null,
      effective_date: document.getElementById('ver-edit-effective-date').value || null,
      change_summary: document.getElementById('ver-edit-change-summary').value.trim() || null,
      grading_scale: document.getElementById('ver-edit-grading').value.trim() || null,
      graduation_requirements: document.getElementById('ver-edit-graduation').value.trim() || null,
      job_positions: document.getElementById('ver-edit-jobs').value.trim() || null,
      further_education: document.getElementById('ver-edit-further-edu').value.trim() || null,
      reference_programs: document.getElementById('ver-edit-reference').value.trim() || null,
      training_process: document.getElementById('ver-edit-training-process').value.trim() || null,
      admission_targets: document.getElementById('ver-edit-admission-targets').value.trim() || null,
      admission_criteria: document.getElementById('ver-edit-admission-criteria').value.trim() || null,
    };
  },

  // Format academic year input: chỉ chấp nhận tối đa 4 chữ số (YYYY).
  formatAcademicYear(input) {
    input.value = input.value.replace(/[^0-9]/g, '').substring(0, 4);
  },

  destroy() {}
};
