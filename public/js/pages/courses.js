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
            <thead><tr><th>Mã HP</th><th>Tên học phần</th><th>TC</th><th>Đơn vị quản lý</th><th>ĐC cơ bản</th><th>Thao tác</th></tr></thead>
            <tbody id="courses-tbody"><tr><td colspan="6"><div class="spinner"></div></td></tr></tbody>
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
                <label>Mã học phần <span class="required-mark">*</span></label>
                <input type="text" id="c-code" required placeholder="VD: CHN107">
              </div>
              <div class="input-group">
                <label>Tên học phần <span class="required-mark">*</span></label>
                <input type="text" id="c-name" required placeholder="VD: Tiếng Trung 1">
              </div>
              <div class="input-group">
                <label>Số tín chỉ</label>
                <input type="number" id="c-credits" value="3" min="1" max="20">
              </div>
              <div class="flex-row">
                <div class="input-group" style="flex:1;margin:0;"><label>LT</label><input type="text" id="c-lt" value="0" inputmode="numeric" pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
                <div class="input-group" style="flex:1;margin:0;"><label>TH</label><input type="text" id="c-th" value="0" inputmode="numeric" pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
                <div class="input-group" style="flex:1;margin:0;"><label>ĐA</label><input type="text" id="c-da" value="0" inputmode="numeric" pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
                <div class="input-group" style="flex:1;margin:0;"><label>TT</label><input type="text" id="c-tt" value="0" inputmode="numeric" pattern="[0-9]*" oninput="this.value=this.value.replace(/[^0-9]/g,'')"></div>
              </div>
              <div class="flex-row">
                <div class="input-group" style="flex:1;margin:0;">
                  <label>Khoa/Viện</label>
                  <select id="c-khoa"></select>
                </div>
                <div class="input-group" style="flex:1;margin:0;">
                  <label>Ngành</label>
                  <select id="c-nganh"><option value="">— Toàn khoa —</option></select>
                </div>
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
    await this.loadData();
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
      ? '<tr><td colspan="6" class="text-center text-muted">Không tìm thấy</td></tr>'
      : filtered.map(c => `<tr>
          <td><strong>${c.code}</strong></td>
          <td>${c.name}</td>
          <td class="text-center">${c.credits}</td>
          <td><span class="badge badge-info">${c.dept_name || '—'}</span></td>
          <td class="text-center">
            ${c.has_base_syllabus ? '<span class="badge badge-success">Có</span>' : '<span class="badge" style="background:var(--bg-secondary);color:var(--text-muted);">Chưa có</span>'}
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.App.navigate('base-syllabus-editor',{courseId:${c.id}})">ĐC cơ bản</button>
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
    document.getElementById('c-lt').value = c ? (c.credits_theory || 0) : 0;
    document.getElementById('c-th').value = c ? (c.credits_practice || 0) : 0;
    document.getElementById('c-da').value = c ? (c.credits_project || 0) : 0;
    document.getElementById('c-tt').value = c ? (c.credits_internship || 0) : 0;
    document.getElementById('c-desc').value = c ? (c.description || '') : '';
    // Cascading Khoa → Ngành dropdowns
    const khoaSel = document.getElementById('c-khoa');
    const nganhSel = document.getElementById('c-nganh');
    const khoaList = this.departments.filter(d => ['KHOA', 'VIEN', 'TRUNG_TAM', 'PHONG'].includes(d.type));
    khoaSel.innerHTML = '<option value="">— Chọn —</option>' +
      khoaList.map(d => `<option value="${d.id}">${d.name}</option>`).join('');

    const populateNganh = (khoaId) => {
      const children = this.departments.filter(d => d.parent_id == khoaId && d.type === 'BO_MON');
      nganhSel.innerHTML = '<option value="">— Toàn khoa —</option>' +
        children.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    };
    khoaSel.onchange = () => { populateNganh(khoaSel.value); nganhSel.value = ''; };

    // Pre-select when editing
    if (c && c.department_id) {
      const dept = this.departments.find(d => d.id === c.department_id);
      if (dept && dept.type === 'BO_MON') {
        khoaSel.value = dept.parent_id;
        populateNganh(dept.parent_id);
        nganhSel.value = dept.id;
      } else if (dept) {
        khoaSel.value = dept.id;
        populateNganh(dept.id);
      }
    } else {
      populateNganh(null);
    }
    document.getElementById('c-save-btn').textContent = c ? 'Cập nhật' : 'Thêm';
    document.getElementById('c-error').classList.remove('show');
    document.getElementById('course-modal').classList.add('active');
    App.modalGuard('course-modal', () => CoursesPage.save());
  },

  async save() {
    const id = document.getElementById('c-edit-id').value;
    const payload = {
      code: document.getElementById('c-code').value.trim(),
      name: document.getElementById('c-name').value.trim(),
      credits: parseInt(document.getElementById('c-credits').value),
      credits_theory: parseInt(document.getElementById('c-lt').value) || 0,
      credits_practice: parseInt(document.getElementById('c-th').value) || 0,
      credits_project: parseInt(document.getElementById('c-da').value) || 0,
      credits_internship: parseInt(document.getElementById('c-tt').value) || 0,
      department_id: document.getElementById('c-nganh').value || document.getElementById('c-khoa').value || null,
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
    const confirmed = await window.ui.confirm({
      title: 'Xóa học phần',
      eyebrow: 'Xác nhận thao tác',
      message: 'Bạn có chắc muốn xóa học phần này?',
      confirmText: 'Xóa',
      cancelText: 'Giữ lại',
      tone: 'danger',
      confirmVariant: 'danger'
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã xóa HP');
      await this.loadData();
    } catch (e) { window.toast.error(e.message); }
  },

  destroy() {}
};
