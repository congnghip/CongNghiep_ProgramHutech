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
          ${window.App.hasPerm('programs.create') ? `<button class="btn btn-primary" onclick="window.ProgramsPage.openAddModal()">+ Tạo CTĐT</button>` : ''}
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
              <p style="font-weight:600;margin-bottom:8px;">Thông tin cơ bản</p>
              <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Các trường có dấu * là bắt buộc.</p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="input-group">
                  <label>Mã chương trình <span style="color:var(--danger);">*</span></label>
                  <input type="text" id="prog-code" required placeholder="VD: 7220204">
                </div>
                <div class="input-group">
                  <label>Khoa quản lý <span style="color:var(--danger);">*</span></label>
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
                  <label>Tên chương trình (Tiếng Việt) <span style="color:var(--danger);">*</span></label>
                  <input type="text" id="prog-name" required placeholder="VD: Ngôn ngữ Trung Quốc" maxlength="255">
                </div>
                <div class="input-group">
                  <label>Tên chương trình (Tiếng Anh) <span style="color:var(--danger);">*</span></label>
                  <input type="text" id="prog-name-en" required placeholder="VD: Chinese Language" maxlength="255">
                </div>
                <div class="input-group">
                  <label>Tổng tín chỉ</label>
                  <input type="number" id="prog-credits" placeholder="VD: 130" min="1">
                </div>
              </div>

              <hr style="border:none;border-top:2px dashed var(--border);margin:16px 0;">
              <p style="font-weight:600;margin-bottom:8px;">Thông tin bổ sung</p>
              <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">Cung cấp thêm thông tin để đội ngũ tuyển sinh và đào tạo nắm rõ đặc điểm chương trình.</p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
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

              <div class="modal-error" id="prog-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="window.ProgramsPage.closeModal()">Hủy</button>
                <button type="submit" class="btn btn-primary" id="prog-save-btn">Tạo mới</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Version Modal -->
      <div id="ver-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2 id="ver-modal-title">Tạo phiên bản mới</h2></div>
          <div class="modal-body">
            <input type="hidden" id="ver-program-id">
            <div class="input-group">
              <label>Năm học <span style="color:var(--danger);">*</span></label>
              <input type="text" id="ver-year" required placeholder="VD: 2025-2026">
            </div>
            <div class="input-group">
              <label>Copy từ phiên bản</label>
              <select id="ver-copy-from"><option value="">— Tạo mới trắng —</option></select>
            </div>
            <div class="modal-error" id="ver-error"></div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="document.getElementById('ver-modal').classList.remove('active')">Hủy</button>
              <button type="button" class="btn btn-primary" onclick="window.ProgramsPage.createVersion()">Tạo phiên bản</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Version Edit Modal -->
      <div id="ver-edit-modal" class="modal-overlay">
        <div class="modal" style="max-width:720px;max-height:90vh;display:flex;flex-direction:column;">
          <div class="modal-header" style="flex-shrink:0;"><h2 id="ver-edit-modal-title">Chỉnh Sửa Phiên Bản</h2></div>
          <div class="modal-body" style="overflow-y:auto;flex:1;">
            <form id="ver-edit-form">
              <input type="hidden" id="ver-edit-id">
              <input type="hidden" id="ver-edit-program-id">
              <input type="hidden" id="ver-edit-program-name">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                <div class="input-group">
                  <label>Số Phiên Bản <span style="color:var(--danger);">*</span></label>
                  <input type="text" id="ver-edit-year" required placeholder="VD: 2025-2026">
                </div>
                <div class="input-group">
                  <label>Tên Phiên Bản</label>
                  <input type="text" id="ver-edit-name" placeholder="VD: phiên bản năm học 2025-2026">
                </div>
                <div class="input-group">
                  <label>Tổng Số Tín Chỉ</label>
                  <input type="number" id="ver-edit-credits" placeholder="VD: 125" min="1">
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
              <div class="modal-error" id="ver-edit-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('ver-edit-modal').classList.remove('active')">Hủy</button>
                <button type="submit" class="btn btn-primary" id="ver-edit-save-btn">Cập Nhật</button>
              </div>
            </form>
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
      await this.saveVersionEdit();
    });
    document.getElementById('prog-notes').addEventListener('input', () => this.updateNotesCount());
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
        this.viewVersions(pId, pName);
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
      <div class="tree-node" style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-weight:600;font-size:14px;">${p.name}</div>
          <div style="font-size:11px;color:var(--text-muted);">
            Mã: ${p.code || '—'} · ${p.degree} · ${p.total_credits || '?'} TC ·
            <span class="badge badge-neutral">${p.version_count} phiên bản</span>
          </div>
        </div>
        <div style="display:flex;gap:4px;">
          <button class="btn btn-secondary btn-sm" onclick="window.ProgramsPage.viewVersions(${p.id},'${p.name.replace(/'/g,"\\'")}')">Phiên bản</button>
          ${window.App.hasPerm('programs.create_version') ? `<button class="btn btn-secondary btn-sm" onclick="window.ProgramsPage.openVersionModal(${p.id})">+ Phiên bản</button>` : ''}
          ${window.App.hasPerm('programs.edit') ? `<button class="btn btn-secondary btn-sm" onclick="window.ProgramsPage.openEditModal(${p.id})">✏️</button>` : ''}
          ${window.App.hasPerm('programs.delete_draft') ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.ProgramsPage.deleteProgram(${p.id}, '${p.name.replace(/'/g, "\\'")}')">🗑️</button>` : ''}
        </div>
      </div>
    `;

    content.innerHTML = Object.entries(tree).map(([khoa, data]) => `
      <div style="margin-bottom:24px;">
        <h3 style="font-size:15px;font-weight:700;margin-bottom:10px;color:var(--text);border-bottom:2px solid var(--border);padding-bottom:6px;">${khoa}</h3>
        ${data.directProgs.length ? `<div style="display:grid;gap:8px;margin-bottom:12px;">${data.directProgs.map(renderProg).join('')}</div>` : ''}
        ${Object.entries(data.nganhs).map(([nganh, progs]) => `
          <div style="margin-left:20px;margin-bottom:14px;">
            <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-muted);">${nganh}</h4>
            <div style="display:grid;gap:8px;">
              ${progs.map(renderProg).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
  },

  async deleteProgram(id, name) {
    if (!confirm(`Bạn có chắc chắn muốn xóa CTĐT "${name}"? Thao tác này sẽ xóa tất cả các phiên bản, PO, PLO và dữ liệu liên quan.`)) return;
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
    document.getElementById('prog-error').classList.remove('show');
    document.getElementById('prog-save-btn').textContent = 'Tạo mới';
    document.getElementById('prog-modal').classList.add('active');
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
    document.getElementById('prog-error').classList.remove('show');
    document.getElementById('prog-save-btn').textContent = 'Cập nhật';
    document.getElementById('prog-modal').classList.add('active');
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
    const errorEl = document.getElementById('prog-error');

    if (!name) { errorEl.textContent = 'Vui lòng nhập tên chương trình (Tiếng Việt)'; errorEl.classList.add('show'); return; }
    if (!name_en) { errorEl.textContent = 'Vui lòng nhập tên chương trình (Tiếng Anh)'; errorEl.classList.add('show'); return; }
    if (!code) { errorEl.textContent = 'Vui lòng nhập mã chương trình'; errorEl.classList.add('show'); return; }
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
      errorEl.textContent = e.message;
      errorEl.classList.add('show');
    }
  },

  updateNotesCount() {
    const val = document.getElementById('prog-notes').value;
    const counter = document.getElementById('prog-notes-count');
    if (counter) counter.textContent = `Tối đa 1000 ký tự — ${val.length}/1000`;
  },

  // Version Modal
  async openVersionModal(programId) {
    document.getElementById('ver-modal-title').textContent = 'Tạo phiên bản mới';
    document.getElementById('ver-program-id').value = programId;
    const now = new Date();
    const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    document.getElementById('ver-year').value = `${year}-${year + 1}`;

    // Load existing versions for copy
    try {
      const versions = await fetch(`/api/programs/${programId}/versions`).then(r => r.json());
      const sel = document.getElementById('ver-copy-from');
      sel.innerHTML = '<option value="">— Tạo mới trắng —</option>';
      versions.forEach(v => {
        sel.innerHTML += `<option value="${v.id}">${v.academic_year} (${v.status}${v.is_locked ? ' 🔒' : ''})</option>`;
      });
    } catch (e) {}

    document.getElementById('ver-error').classList.remove('show');
    document.getElementById('ver-modal').classList.add('active');
  },

  async createVersion() {
    const programId = document.getElementById('ver-program-id').value;
    const academic_year = document.getElementById('ver-year').value.trim();
    const copy_from_version_id = document.getElementById('ver-copy-from').value || null;
    const errorEl = document.getElementById('ver-error');

    if (!academic_year) { errorEl.textContent = 'Vui lòng nhập năm học'; errorEl.classList.add('show'); return; }
    try {
      const res = await fetch(`/api/programs/${programId}/versions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academic_year, copy_from_version_id: copy_from_version_id ? parseInt(copy_from_version_id) : null })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      document.getElementById('ver-modal').classList.remove('active');
      window.toast.success(`Đã tạo phiên bản ${academic_year}` + (copy_from_version_id ? ' (đã copy dữ liệu)' : ''));
      await this.loadData();
    } catch (e) {
      errorEl.textContent = e.message;
      errorEl.classList.add('show');
      window.toast.error(e.message);
    }
  },

  // View versions
  async viewVersions(programId, programName) {
    const content = document.getElementById('programs-content');
    content.innerHTML = '<div class="spinner"></div>';

    // Change header button from "Tạo CTĐT" to "Tạo phiên bản"
    const cardHeader = content.closest('.card').querySelector('.card-header');
    this._originalHeaderHTML = cardHeader.innerHTML;
    cardHeader.innerHTML = `
      <div class="card-title">Phiên bản - ${programName}</div>
      ${window.App.hasPerm('programs.create_version') ? `<button class="btn btn-primary" onclick="window.ProgramsPage.openVersionModal(${programId})">+ Tạo phiên bản</button>` : ''}
    `;

    try {
      const versions = await fetch(`/api/programs/${programId}/versions`).then(r => r.json());
      const statusColors = { draft: 'badge-warning', submitted: 'badge-info', approved_khoa: 'badge-info', approved_pdt: 'badge-info', published: 'badge-success' };
      const statusLabels = { draft: 'Bản nháp', submitted: 'Đã nộp', approved_khoa: 'Duyệt Khoa ✓', approved_pdt: 'Duyệt PĐT ✓', published: 'Đã công bố' };

      content.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <button class="btn btn-secondary btn-sm" onclick="window.ProgramsPage.backToList()">← Quay lại</button>
          <h3 style="font-size:15px;font-weight:600;">Phiên bản: ${programName}</h3>
        </div>
        ${versions.length === 0
          ? '<div class="empty-state"><div class="icon">📭</div><p>Chưa có phiên bản nào</p></div>'
          : `<div style="display:grid;gap:10px;">
            ${versions.map(v => `
              <div class="tree-node" style="display:flex;justify-content:space-between;align-items:center;${v.is_locked ? 'opacity:0.7;' : ''}">
                <div>
                  <div style="font-weight:600;font-size:15px;">
                    ${v.academic_year}
                    ${v.is_locked ? '<span class="badge badge-danger" style="margin-left:6px;">🔒 Khóa</span>' : ''}
                  </div>
                  <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">
                    <span class="badge ${statusColors[v.status] || 'badge-neutral'}">${statusLabels[v.status] || v.status}</span>
                    ${v.is_rejected ? '<span class="badge badge-danger">Bị từ chối</span>' : ''}
                    · Hoàn thành: ${v.completion_pct || 0}%
                    · Tạo: ${new Date(v.created_at).toLocaleDateString('vi-VN')}
                    ${v.copied_from_id ? ' · Copy từ phiên bản trước' : ''}
                  </div>
                </div>
                <div style="display:flex;gap:4px;">
                  ${window.App.hasPerm('programs.create_version') ? `<button class="btn btn-secondary btn-sm" title="Nhân bản phiên bản này" onclick="window.ProgramsPage.cloneVersion(${programId}, ${v.id}, '${v.academic_year}')">📋 Nhân bản</button>` : ''}
                  ${window.App.hasPerm('programs.edit') && v.status === 'draft' ? `<button class="btn btn-secondary btn-sm" title="Chỉnh sửa phiên bản" onclick="window.ProgramsPage.openVersionEditModal(${v.id}, ${programId}, '${programName.replace(/'/g, "\\'")}')">✏️</button>` : ''}
                  <button class="btn btn-primary btn-sm" onclick="window.App.navigate('version-editor',{versionId:${v.id}})">${v.status === 'draft' ? 'Soạn thảo' : 'Xem'}</button>
                  ${window.App.hasPerm('programs.delete_draft') && v.status === 'draft' ? `
                    <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.ProgramsPage.deleteVersion(${v.id}, '${v.academic_year}', ${programId}, '${programName.replace(/'/g, "\\'")}')">🗑️</button>
                  ` : ''}
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

  // Clone version — open modal pre-filled with copy from selected version
  async cloneVersion(programId, sourceVersionId, sourceYear) {
    document.getElementById('ver-program-id').value = programId;
    // Auto-generate next academic year
    const match = sourceYear.match(/^(\d{4})-(\d{4})$/);
    if (match) {
      const nextStart = parseInt(match[2]);
      document.getElementById('ver-year').value = `${nextStart}-${nextStart + 1}`;
    } else {
      document.getElementById('ver-year').value = '';
    }

    // Load existing versions for copy dropdown and pre-select source
    try {
      const versions = await fetch(`/api/programs/${programId}/versions`).then(r => r.json());
      const sel = document.getElementById('ver-copy-from');
      sel.innerHTML = '<option value="">— Tạo mới trắng —</option>';
      versions.forEach(v => {
        sel.innerHTML += `<option value="${v.id}" ${v.id === sourceVersionId ? 'selected' : ''}>${v.academic_year} (${v.status}${v.is_locked ? ' 🔒' : ''})</option>`;
      });
    } catch (e) {}

    document.getElementById('ver-modal-title').textContent = `Nhân bản từ ${sourceYear}`;
    document.getElementById('ver-error').classList.remove('show');
    document.getElementById('ver-modal').classList.add('active');
  },

  async deleteVersion(id, year, programId, programName) {
    if (!confirm(`Bạn có chắc muốn xóa phiên bản năm học "${year}" của CTĐT "${programName}"?`)) return;
    try {
      const res = await fetch(`/api/versions/${id}`, { method: 'DELETE' });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      window.toast.success(`Đã xóa phiên bản ${year}`);
      await this.viewVersions(programId, programName);
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  // Version Edit Modal
  async openVersionEditModal(versionId, programId, programName) {
    try {
      const v = await fetch(`/api/versions/${versionId}`).then(r => r.json());
      document.getElementById('ver-edit-id').value = v.id;
      document.getElementById('ver-edit-program-id').value = programId;
      document.getElementById('ver-edit-program-name').value = programName;
      document.getElementById('ver-edit-modal-title').textContent = `Chỉnh Sửa Phiên Bản - ${programName}`;
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
      document.getElementById('ver-edit-error').classList.remove('show');
      document.getElementById('ver-edit-modal').classList.add('active');
    } catch (e) {
      window.toast.error('Không thể tải dữ liệu phiên bản: ' + e.message);
    }
  },

  async saveVersionEdit() {
    const id = document.getElementById('ver-edit-id').value;
    const programId = document.getElementById('ver-edit-program-id').value;
    const programName = document.getElementById('ver-edit-program-name').value;
    const academic_year = document.getElementById('ver-edit-year').value.trim();
    const errorEl = document.getElementById('ver-edit-error');

    if (!academic_year) { errorEl.textContent = 'Vui lòng nhập số phiên bản'; errorEl.classList.add('show'); return; }

    const body = {
      academic_year,
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

    try {
      const res = await fetch(`/api/versions/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      document.getElementById('ver-edit-modal').classList.remove('active');
      window.toast.success('Đã cập nhật phiên bản');
      await this.viewVersions(parseInt(programId), programName);
    } catch (e) {
      errorEl.textContent = e.message;
      errorEl.classList.add('show');
    }
  },

  destroy() {}
};
