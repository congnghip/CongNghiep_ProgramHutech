// Courses Master List Page
window.CoursesPage = {
  courses: [],
  departments: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Danh mục Học phần</div>
          ${window.App.hasPerm('courses.create') ? `<button class="btn btn-primary" onclick="window.CoursesPage.openModal()">+ Thêm HP</button>` : ''}
        </div>
        <div style="padding:0 20px 20px;">
          <div class="input-group" style="margin-bottom:16px;">
            <input type="text" id="course-search" placeholder="Tìm kiếm theo mã hoặc tên..." style="max-width:400px;">
          </div>
          <table class="data-table">
            <thead><tr><th>Mã HP</th><th>Tên học phần</th><th>TC</th><th>Đơn vị quản lý</th><th>Thao tác</th></tr></thead>
            <tbody id="courses-tbody"><tr><td colspan="5"><div class="spinner"></div></td></tr></tbody>
          </table>
        </div>
      </div>

      <div id="course-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2 id="course-modal-title">Thêm học phần</h2></div>
          <div class="modal-body">
            <form id="course-form">
              <input type="hidden" id="c-edit-id">
              <div class="input-group">
                <label>Mã học phần <span style="color:var(--danger);">*</span></label>
                <input type="text" id="c-code" required placeholder="VD: CHN107">
              </div>
              <div class="input-group">
                <label>Tên học phần <span style="color:var(--danger);">*</span></label>
                <input type="text" id="c-name" required placeholder="VD: Tiếng Trung 1">
              </div>
              <div class="input-group">
                <label>Số tín chỉ</label>
                <input type="number" id="c-credits" value="3" min="1" max="20">
              </div>
              <div class="input-group">
                <label>Đơn vị quản lý (Khoa/Viện)</label>
                <select id="c-khoa"></select>
              </div>
              <div class="input-group">
                <label>Bộ môn quản lý trực tiếp</label>
                <select id="c-nganh"></select>
              </div>
              <div class="input-group">
                <label>Mô tả</label>
                <textarea id="c-desc" placeholder="Mô tả tóm tắt HP (dưới 150 từ)"></textarea>
              </div>
              <div class="modal-error" id="c-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('course-modal').classList.remove('active')">Hủy</button>
                <button type="submit" class="btn btn-primary" id="c-save-btn">Thêm</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
    document.getElementById('course-form').addEventListener('submit', async (e) => { e.preventDefault(); await this.save(); });
    document.getElementById('course-search').addEventListener('input', () => this.renderTable());
    document.getElementById('c-khoa').addEventListener('change', (e) => this.populateNganhSelect(e.target.value, null));
    await this.loadData();
  },

  populateNganhSelect(khoaId, selectedNganhId) {
    const nganhSel = document.getElementById('c-nganh');
    if (!khoaId) {
      nganhSel.innerHTML = '<option value="">— Vui lòng chọn Khoa/Viện trước —</option>';
      nganhSel.disabled = true;
      return;
    }
    const children = this.departments.filter(d => d.parent_id == khoaId && d.type === 'BO_MON');
    nganhSel.disabled = false;
    nganhSel.innerHTML = '<option value="">— Trực thuộc cấp toàn Khoa/Viện —</option>' + 
      children.map(d => `<option value="${d.id}" ${d.id == selectedNganhId ? 'selected' : ''}>${d.name}</option>`).join('');
  },

  async loadData() {
    const [courses, depts] = await Promise.all([
      fetch('/api/courses').then(r => r.json()),
      fetch('/api/departments').then(r => r.json()),
    ]);
    this.courses = courses;
    this.departments = depts;
    this.renderTable();
  },

  renderTable() {
    const q = (document.getElementById('course-search')?.value || '').toLowerCase();
    const filtered = q ? this.courses.filter(c => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) : this.courses;
    document.getElementById('courses-tbody').innerHTML = filtered.length === 0
      ? '<tr><td colspan="5" class="text-center text-muted">Không tìm thấy</td></tr>'
      : filtered.map(c => `<tr>
          <td><strong>${c.code}</strong></td>
          <td>${c.name}</td>
          <td class="text-center">${c.credits}</td>
          <td><span class="badge badge-info">${c.dept_name || '—'}</span></td>
          <td>
            ${window.App.hasPerm('courses.edit') ? `<button class="btn btn-secondary btn-sm" onclick="window.CoursesPage.openModal(${c.id})">Sửa</button>
            <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.CoursesPage.del(${c.id})">Xóa</button>` : ''}
          </td>
        </tr>`).join('');
  },

  openModal(id) {
    const c = id ? this.courses.find(x => x.id === id) : null;
    document.getElementById('course-modal-title').textContent = c ? 'Sửa học phần' : 'Thêm học phần';
    document.getElementById('c-edit-id').value = c ? c.id : '';
    document.getElementById('c-code').value = c ? c.code : '';
    document.getElementById('c-name').value = c ? c.name : '';
    document.getElementById('c-credits').value = c ? c.credits : 3;
    document.getElementById('c-desc').value = c ? (c.description || '') : '';
    
    // Resolve selected department into Khoa and Nganh
    let selectedKhoaId = '';
    let selectedNganhId = '';
    if (c && c.department_id) {
      const deptInfo = this.departments.find(d => d.id === c.department_id);
      if (deptInfo) {
        if (deptInfo.type === 'BO_MON' && deptInfo.parent_id) {
          selectedKhoaId = deptInfo.parent_id;
          selectedNganhId = c.department_id;
        } else {
          selectedKhoaId = c.department_id;
        }
      }
    }

    const khoas = this.departments.filter(d => ['KHOA', 'VIEN', 'TRUNG_TAM'].includes(d.type));
    const khoaSel = document.getElementById('c-khoa');
    khoaSel.innerHTML = '<option value="">— Chọn Đơn vị quản lý (Khoa/Viện) —</option>' + 
      khoas.map(d => `<option value="${d.id}" ${d.id == selectedKhoaId ? 'selected' : ''}>${d.name}</option>`).join('');

    this.populateNganhSelect(selectedKhoaId, selectedNganhId);

    document.getElementById('c-save-btn').textContent = c ? 'Cập nhật' : 'Thêm';
    document.getElementById('c-error').classList.remove('show');
    document.getElementById('course-modal').classList.add('active');
  },

  async save() {
    const id = document.getElementById('c-edit-id').value;
    const nganhVal = document.getElementById('c-nganh').value;
    const khoaVal = document.getElementById('c-khoa').value;
    
    const payload = {
      code: document.getElementById('c-code').value.trim(),
      name: document.getElementById('c-name').value.trim(),
      credits: parseInt(document.getElementById('c-credits').value) || 3,
      department_id: nganhVal || khoaVal || null,
      description: document.getElementById('c-desc').value.trim(),
    };
    try {
      const res = await fetch(id ? `/api/courses/${id}` : '/api/courses', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      document.getElementById('course-modal').classList.remove('active');
      window.toast.success(id ? 'Đã cập nhật HP' : 'Đã thêm HP');
      await this.loadData();
    } catch (e) {
      document.getElementById('c-error').textContent = e.message;
      document.getElementById('c-error').classList.add('show');
    }
  },

  async del(id) {
    if (!confirm('Xóa học phần này?')) return;
    try {
      const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Lỗi khi xóa');
      }
      window.toast.success('Đã xóa HP');
      await this.loadData();
    } catch (e) { 
      window.toast.error(e.message); 
    }
  },

  destroy() {}
};
