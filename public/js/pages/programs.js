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
        <div class="modal">
          <div class="modal-header"><h2 id="prog-modal-title">Tạo CTĐT</h2></div>
          <div class="modal-body">
            <form id="prog-form">
              <input type="hidden" id="prog-edit-id">
              <div class="input-group">
                <label>Khoa/Viện <span style="color:var(--danger);">*</span></label>
                <select id="prog-dept" required></select>
              </div>
              <div class="input-group">
                <label>Tên ngành <span style="color:var(--danger);">*</span></label>
                <input type="text" id="prog-name" required placeholder="VD: Ngôn ngữ Trung Quốc">
              </div>
              <div class="input-group">
                <label>Mã ngành</label>
                <input type="text" id="prog-code" placeholder="VD: 7220204">
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
                <label>Tổng tín chỉ</label>
                <input type="number" id="prog-credits" placeholder="VD: 130" min="1">
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
    `;
    document.getElementById('prog-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveProgram();
    });
    await this.loadData();
  },

  async loadData() {
    try {
      const [programs, depts] = await Promise.all([
        fetch('/api/programs').then(r => r.json()),
        fetch('/api/departments').then(r => r.json()),
      ]);
      this.programs = programs;
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

    // Group by department
    const grouped = {};
    this.programs.forEach(p => {
      if (!grouped[p.dept_name]) grouped[p.dept_name] = [];
      grouped[p.dept_name].push(p);
    });

    content.innerHTML = Object.entries(grouped).map(([dept, progs]) => `
      <div style="margin-bottom:20px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:10px;color:var(--text);">${dept}</h3>
        <div style="display:grid;gap:10px;">
          ${progs.map(p => `
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
          `).join('')}
        </div>
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
    document.getElementById('prog-code').value = p.code || '';
    document.getElementById('prog-degree').value = p.degree;
    document.getElementById('prog-credits').value = p.total_credits || '';
    document.getElementById('prog-error').classList.remove('show');
    document.getElementById('prog-save-btn').textContent = 'Cập nhật';
    document.getElementById('prog-modal').classList.add('active');
  },

  populateDeptSelect(selectedId) {
    const sel = document.getElementById('prog-dept');
    sel.innerHTML = this.departments.map(d =>
      `<option value="${d.id}" ${d.id == selectedId ? 'selected' : ''}>${d.name} (${d.code})</option>`
    ).join('');
  },

  closeModal() { document.getElementById('prog-modal').classList.remove('active'); },

  async saveProgram() {
    const id = document.getElementById('prog-edit-id').value;
    const name = document.getElementById('prog-name').value.trim();
    const code = document.getElementById('prog-code').value.trim();
    const department_id = document.getElementById('prog-dept').value;
    const degree = document.getElementById('prog-degree').value;
    const total_credits = parseInt(document.getElementById('prog-credits').value) || null;
    const errorEl = document.getElementById('prog-error');

    if (!name) { errorEl.textContent = 'Vui lòng nhập tên ngành'; errorEl.classList.add('show'); return; }
    try {
      const url = id ? `/api/programs/${id}` : '/api/programs';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, code, department_id, degree, total_credits })
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

  // Version Modal
  async openVersionModal(programId) {
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
    try {
      const versions = await fetch(`/api/programs/${programId}/versions`).then(r => r.json());
      const statusColors = { draft: 'badge-warning', submitted: 'badge-info', approved_khoa: 'badge-info', approved_pdt: 'badge-info', published: 'badge-success' };
      const statusLabels = { draft: 'Bản nháp', submitted: 'Đã nộp', approved_khoa: 'Duyệt Khoa ✓', approved_pdt: 'Duyệt PĐT ✓', published: 'Đã công bố' };

      content.innerHTML = `
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
          <button class="btn btn-secondary btn-sm" onclick="window.ProgramsPage.loadData()">← Quay lại</button>
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

  destroy() {}
};
