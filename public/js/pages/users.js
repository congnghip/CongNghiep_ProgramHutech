// Users Page — CRUD + Multi-role assignment
window.UsersPage = {
  users: [],
  roles: [],
  departments: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Quản lý Tài khoản</div>
          <button class="btn btn-primary" onclick="window.UsersPage.openAddModal()">+ Tạo tài khoản</button>
        </div>
        <div class="table-responsive" style="padding:0 20px 20px;">
          <table class="data-table">
            <thead><tr><th>Tên đăng nhập</th><th>Tên hiển thị</th><th>Đơn vị</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
            <tbody id="users-tbody"><tr><td colspan="6" class="text-center"><div class="spinner"></div></td></tr></tbody>
          </table>
        </div>
      </div>

      <!-- User Modal -->
      <div id="user-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2 id="user-modal-title">Tạo tài khoản</h2></div>
          <div class="modal-body">
            <form id="user-form">
              <input type="hidden" id="u-edit-id">
              <div class="input-group">
                <label>Tên đăng nhập <span style="color:var(--danger);">*</span></label>
                <input type="text" id="u-username" required placeholder="VD: nguyenvana">
              </div>
              <div class="input-group">
                <label>Mật khẩu</label>
                <input type="password" id="u-password" placeholder="(bỏ trống nếu không đổi)">
              </div>
              <div class="input-group">
                <label>Tên hiển thị <span style="color:var(--danger);">*</span></label>
                <input type="text" id="u-display" required placeholder="VD: Nguyễn Văn A">
              </div>
              <div class="input-group">
                <label>Email</label>
                <input type="email" id="u-email" placeholder="VD: a@hutech.edu.vn">
              </div>
              <div class="input-group">
                <label>Đơn vị công tác <span style="color:var(--danger);">*</span></label>
                <select id="u-dept" required></select>
              </div>
              <div class="modal-error" id="u-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="window.UsersPage.closeModal()">Hủy</button>
                <button type="submit" class="btn btn-primary" id="u-save-btn">Tạo mới</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <!-- Role Assignment Modal -->
      <div id="role-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2 id="role-modal-title">Gán vai trò</h2></div>
          <div class="modal-body">
            <input type="hidden" id="role-user-id">
            <div id="role-current-list" style="margin-bottom:16px;"></div>
            <div class="input-group">
              <label>Thêm vai trò</label>
              <select id="role-select"></select>
            </div>
            <div class="input-group">
              <label>Tại đơn vị</label>
              <select id="role-dept-select"></select>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn btn-secondary" onclick="window.UsersPage.closeRoleModal()">Đóng</button>
              <button type="button" class="btn btn-primary" onclick="window.UsersPage.assignRole()">+ Gán</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('user-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.saveUser();
    });
    await this.loadData();
  },

  loadData() {
    return Promise.all([
      fetch('/api/users').then(r => r.json()),
      fetch('/api/roles').then(r => r.json()),
      fetch('/api/departments').then(r => r.json()),
    ]).then(([users, roles, depts]) => {
      this.users = users;
      this.roles = roles;
      this.departments = depts;
      this.renderTable();
    }).catch(e => {
      document.getElementById('users-tbody').innerHTML = `<tr><td colspan="6" style="color:var(--danger);">Lỗi: ${e.message}</td></tr>`;
    });
  },

  renderTable() {
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = this.users.map(u => {
      const rolesBadges = u.roles && u.roles.length && u.roles[0].role_code
        ? u.roles.map(r => `<span class="badge badge-primary" style="margin:1px;">${r.role_name}@${r.dept_code}</span>`).join(' ')
        : '<span class="text-muted">Chưa gán</span>';
      return `
        <tr>
          <td style="font-weight:500;">${u.username}</td>
          <td>${u.display_name}</td>
          <td style="font-size:12px;">${u.dept_name || '—'}</td>
          <td style="font-size:11px;">${rolesBadges}</td>
          <td><span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Hoạt động' : 'Khóa'}</span></td>
          <td style="white-space:nowrap;">
            <button class="btn btn-secondary btn-sm" onclick="window.UsersPage.openEditModal(${u.id})" title="Sửa">Sửa</button>
            <button class="btn btn-secondary btn-sm" onclick="window.UsersPage.openRoleModal(${u.id})" title="Gán vai trò">Vai trò</button>
          </td>
        </tr>`;
    }).join('');
  },

  openAddModal() {
    document.getElementById('user-modal-title').textContent = 'Tạo tài khoản';
    document.getElementById('user-form').reset();
    document.getElementById('u-edit-id').value = '';
    document.getElementById('u-username').disabled = false;
    document.getElementById('u-password').required = true;
    
    const deptSel = document.getElementById('u-dept');
    deptSel.innerHTML = '<option value="">-- Chọn đơn vị --</option>' + 
      this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');

    document.getElementById('u-error').classList.remove('show');
    document.getElementById('u-save-btn').textContent = 'Tạo mới';
    document.getElementById('user-modal').classList.add('active');
  },

  openEditModal(id) {
    const u = this.users.find(x => x.id === id);
    if (!u) return;
    document.getElementById('user-modal-title').textContent = 'Sửa tài khoản';
    document.getElementById('u-edit-id').value = u.id;
    document.getElementById('u-username').value = u.username;
    document.getElementById('u-username').disabled = true;
    document.getElementById('u-password').value = '';
    document.getElementById('u-password').required = false;
    document.getElementById('u-display').value = u.display_name;
    document.getElementById('u-email').value = u.email || '';
    
    const deptSel = document.getElementById('u-dept');
    deptSel.innerHTML = '<option value="">-- Chọn đơn vị --</option>' + 
      this.departments.map(d => `<option value="${d.id}" ${u.department_id == d.id ? 'selected' : ''}>${d.name} (${d.code})</option>`).join('');

    document.getElementById('u-error').classList.remove('show');
    document.getElementById('u-save-btn').textContent = 'Cập nhật';
    document.getElementById('user-modal').classList.add('active');
  },

  closeModal() { document.getElementById('user-modal').classList.remove('active'); },

  async saveUser() {
    const id = document.getElementById('u-edit-id').value;
    const username = document.getElementById('u-username').value.trim();
    const password = document.getElementById('u-password').value;
    const display_name = document.getElementById('u-display').value.trim();
    const email = document.getElementById('u-email').value.trim();
    const department_id = document.getElementById('u-dept').value;
    const errorEl = document.getElementById('u-error');
    try {
      const payload = { display_name, email, department_id };
      if (password) payload.password = password;
      if (!id) payload.username = username;
      const url = id ? `/api/users/${id}` : '/api/users';
      const method = id ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      this.closeModal();
      window.toast.success(id ? 'Đã cập nhật tài khoản' : 'Đã tạo tài khoản');
      await this.loadData();
    } catch (e) {
      errorEl.textContent = e.message;
      errorEl.classList.add('show');
    }
  },

  // Role Assignment
  openRoleModal(userId) {
    const u = this.users.find(x => x.id === userId);
    if (!u) return;
    document.getElementById('role-modal-title').textContent = `Vai trò: ${u.display_name}`;
    document.getElementById('role-user-id').value = userId;

    // Current roles
    const list = document.getElementById('role-current-list');
    const roles = u.roles && u.roles[0]?.role_code ? u.roles : [];
    list.innerHTML = roles.length === 0
      ? '<p class="text-muted" style="font-size:12px;">Chưa có vai trò nào</p>'
      : roles.map(r => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg-secondary);border-radius:6px;margin-bottom:4px;font-size:12px;">
            <span><span class="badge badge-primary">${r.role_name}</span> <span class="text-muted">@ ${r.dept_name}</span></span>
            <button class="btn btn-secondary btn-sm" style="color:var(--danger);padding:2px 6px;" onclick="window.UsersPage.removeRole(${userId},'${r.role_code}',${r.dept_id || 0})">✕</button>
          </div>
        `).join('');

    // Populate selects
    const roleSel = document.getElementById('role-select');
    roleSel.innerHTML = this.roles.map(r => `<option value="${r.code}">${r.name} (Level ${r.level})</option>`).join('');
    const deptSel = document.getElementById('role-dept-select');
    deptSel.innerHTML = this.departments.map(d => `<option value="${d.id}">${d.name} (${d.code})</option>`).join('');

    document.getElementById('role-modal').classList.add('active');
  },

  closeRoleModal() { document.getElementById('role-modal').classList.remove('active'); },

  async assignRole() {
    const userId = document.getElementById('role-user-id').value;
    const role_code = document.getElementById('role-select').value;
    const department_id = document.getElementById('role-dept-select').value;
    try {
      const res = await fetch(`/api/users/${userId}/roles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_code, department_id })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error); }
      window.toast.success('Đã gán vai trò');
      await this.loadData();
      this.openRoleModal(parseInt(userId));
    } catch (e) { window.toast.error(e.message); }
  },

  async removeRole(userId, roleCode, deptId) {
    try {
      await fetch(`/api/users/${userId}/roles/${roleCode}/${deptId}`, { method: 'DELETE' });
      window.toast.success('Đã gỡ vai trò');
      await this.loadData();
      this.openRoleModal(userId);
    } catch (e) { window.toast.error(e.message); }
  },

  destroy() {}
};
