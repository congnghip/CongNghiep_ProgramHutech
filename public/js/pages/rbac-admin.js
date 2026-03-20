// RBAC Admin — 4-Tab Management (Notion-style)
window.RBACAdminPage = {
  activeTab: 0,
  users: [], roles: [], departments: [], permissions: [],

  async render(container) {
    container.innerHTML = `
      <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.3px;margin-bottom:24px;">Phân quyền hệ thống</h1>
      <div class="tab-bar" id="rbac-tabs">
        <div class="tab-item active" data-tab="0">Tài khoản</div>
        <div class="tab-item" data-tab="1">Vai trò</div>
        <div class="tab-item" data-tab="2">Ma trận quyền</div>
        <div class="tab-item" data-tab="3">Đơn vị</div>
      </div>
      <div id="rbac-content"><div class="spinner"></div></div>
    `;
    document.querySelectorAll('#rbac-tabs .tab-item').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('#rbac-tabs .tab-item').forEach(e => e.classList.remove('active'));
        el.classList.add('active');
        this.activeTab = parseInt(el.dataset.tab);
        this.renderCurrentTab();
      });
    });
    await this.loadAll();
    this.renderCurrentTab();
  },

  async loadAll() {
    const [users, roles, depts] = await Promise.all([
      fetch('/api/users').then(r => r.json()).catch(() => []),
      fetch('/api/roles').then(r => r.json()).catch(() => []),
      fetch('/api/departments').then(r => r.json()).catch(() => []),
    ]);
    this.users = users;
    this.roles = roles;
    this.departments = depts;
  },

  renderCurrentTab() {
    const body = document.getElementById('rbac-content');
    body.innerHTML = '<div class="spinner"></div>';
    switch (this.activeTab) {
      case 0: this.renderUsersTab(body); break;
      case 1: this.renderRolesTab(body); break;
      case 2: this.renderPermMatrixTab(body); break;
      case 3: this.renderDeptsTab(body); break;
    }
  },

  // ===== TAB 1: Tài khoản =====
  renderUsersTab(body) {
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <div style="display:flex;gap:10px;align-items:center;">
          <input type="text" id="user-search" placeholder="Tìm kiếm..." style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;width:220px;">
          <select id="user-filter-role" style="padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;">
            <option value="">Tất cả vai trò</option>
            ${this.roles.map(r => `<option value="${r.code}">${r.name}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary btn-sm" onclick="window.RBACAdminPage.openUserModal()">+ Tạo tài khoản</button>
      </div>
      <table class="data-table">
        <thead><tr><th>Tên đăng nhập</th><th>Tên hiển thị</th><th>Vai trò</th><th>Trạng thái</th><th></th></tr></thead>
        <tbody id="rbac-users-tbody"></tbody>
      </table>

      <div id="user-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2 id="user-modal-title">Tạo tài khoản</h2></div>
          <div class="modal-body">
            <form id="user-form">
              <input type="hidden" id="u-edit-id">
              <div class="input-group"><label>Tên đăng nhập <span style="color:var(--danger);">*</span></label><input type="text" id="u-username" required placeholder="username"></div>
              <div class="input-group"><label>Mật khẩu</label><input type="password" id="u-password" placeholder="(bỏ trống nếu không đổi)"></div>
              <div class="input-group"><label>Tên hiển thị <span style="color:var(--danger);">*</span></label><input type="text" id="u-display" required placeholder="Họ tên"></div>
              <div class="input-group"><label>Email</label><input type="email" id="u-email" placeholder="email@hutech.edu.vn"></div>
              <div class="modal-error" id="u-error"></div>
              <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick="document.getElementById('user-modal').classList.remove('active')">Hủy</button>
                <button type="submit" class="btn btn-primary" id="u-save-btn">Tạo mới</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <div id="role-assign-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2 id="role-assign-title">Gán vai trò</h2></div>
          <div class="modal-body">
            <input type="hidden" id="ra-user-id">
            <div id="ra-current" style="margin-bottom:16px;"></div>
            <div style="display:flex;gap:8px;align-items:end;">
              <div class="input-group" style="flex:1;margin:0;"><label>Vai trò</label><select id="ra-role"></select></div>
              <div class="input-group" style="flex:1;margin:0;"><label>Đơn vị</label><select id="ra-dept"></select></div>
              <button class="btn btn-primary btn-sm" onclick="window.RBACAdminPage.assignRole()">Gán</button>
            </div>
            <div class="modal-footer" style="padding-top:16px;">
              <button class="btn btn-secondary" onclick="document.getElementById('role-assign-modal').classList.remove('active')">Đóng</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.getElementById('user-form').addEventListener('submit', async e => { e.preventDefault(); await this.saveUser(); });
    document.getElementById('user-search').addEventListener('input', () => this.filterUsers());
    document.getElementById('user-filter-role').addEventListener('change', () => this.filterUsers());
    this.filterUsers();
  },

  filterUsers() {
    const q = (document.getElementById('user-search')?.value || '').toLowerCase();
    const roleFilter = document.getElementById('user-filter-role')?.value || '';
    let filtered = this.users;
    if (q) filtered = filtered.filter(u => u.username.toLowerCase().includes(q) || u.display_name.toLowerCase().includes(q));
    if (roleFilter) filtered = filtered.filter(u => u.roles?.some(r => r.role_code === roleFilter));

    document.getElementById('rbac-users-tbody').innerHTML = filtered.length === 0
      ? '<tr><td colspan="5" style="color:var(--text-muted);text-align:center;">Không tìm thấy</td></tr>'
      : filtered.map(u => {
        const rolesBadges = u.roles?.length && u.roles[0]?.role_code
          ? u.roles.map(r => `<span class="badge badge-primary" style="margin:1px;">${r.role_name}@${r.dept_code}</span>`).join(' ')
          : '<span class="text-muted">Chưa gán</span>';
        return `<tr>
          <td style="font-weight:500;">${u.username}</td>
          <td>${u.display_name}</td>
          <td style="font-size:11px;">${rolesBadges}</td>
          <td>
            <button class="btn btn-sm ${u.is_active ? 'btn-secondary' : 'btn-danger'}" style="font-size:11px;" onclick="window.RBACAdminPage.toggleActive(${u.id})">
              ${u.is_active ? 'Hoạt động' : 'Đã khóa'}
            </button>
          </td>
          <td style="white-space:nowrap;">
            <button class="btn btn-secondary btn-sm" onclick="window.RBACAdminPage.openUserModal(${u.id})">Sửa</button>
            <button class="btn btn-secondary btn-sm" onclick="window.RBACAdminPage.openRoleAssignModal(${u.id})">Vai trò</button>
            <button class="btn btn-secondary btn-sm" onclick="window.RBACAdminPage.resetPassword(${u.id})">Reset MK</button>
            <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.RBACAdminPage.deleteUser(${u.id})">Xóa</button>
          </td>
        </tr>`;
      }).join('');
  },

  openUserModal(id) {
    const u = id ? this.users.find(x => x.id === id) : null;
    document.getElementById('user-modal-title').textContent = u ? 'Sửa tài khoản' : 'Tạo tài khoản';
    document.getElementById('u-edit-id').value = u ? u.id : '';
    document.getElementById('u-username').value = u ? u.username : '';
    document.getElementById('u-username').disabled = !!u;
    document.getElementById('u-password').value = '';
    document.getElementById('u-password').required = !u;
    document.getElementById('u-display').value = u ? u.display_name : '';
    document.getElementById('u-email').value = u ? (u.email || '') : '';
    document.getElementById('u-save-btn').textContent = u ? 'Cập nhật' : 'Tạo mới';
    document.getElementById('u-error').classList.remove('show');
    document.getElementById('user-modal').classList.add('active');
  },

  async saveUser() {
    const id = document.getElementById('u-edit-id').value;
    const payload = {
      display_name: document.getElementById('u-display').value.trim(),
      email: document.getElementById('u-email').value.trim(),
    };
    const pass = document.getElementById('u-password').value;
    if (pass) payload.password = pass;
    if (!id) payload.username = document.getElementById('u-username').value.trim();
    try {
      const res = await fetch(id ? `/api/users/${id}` : '/api/users', {
        method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      document.getElementById('user-modal').classList.remove('active');
      window.toast.success(id ? 'Đã cập nhật' : 'Đã tạo');
      await this.loadAll(); this.filterUsers();
    } catch (e) {
      document.getElementById('u-error').textContent = e.message;
      document.getElementById('u-error').classList.add('show');
    }
  },

  async toggleActive(id) {
    try {
      const res = await fetch(`/api/users/${id}/toggle-active`, { method: 'PUT' });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      window.toast.success(data.is_active ? 'Đã mở khóa' : 'Đã khóa');
      await this.loadAll(); this.filterUsers();
    } catch (e) { window.toast.error(e.message); }
  },

  async deleteUser(id) {
    if (!confirm('Xóa tài khoản này? Thao tác không thể hoàn tác.')) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã xóa');
      await this.loadAll(); this.filterUsers();
    } catch (e) { window.toast.error(e.message); }
  },

  openRoleAssignModal(userId) {
    const u = this.users.find(x => x.id === userId);
    if (!u) return;
    document.getElementById('role-assign-title').textContent = `Vai trò: ${u.display_name}`;
    document.getElementById('ra-user-id').value = userId;
    const roles = u.roles?.length && u.roles[0]?.role_code ? u.roles : [];
    document.getElementById('ra-current').innerHTML = roles.length === 0
      ? '<p style="color:var(--text-muted);font-size:12px;">Chưa có vai trò</p>'
      : roles.map(r => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;background:var(--bg-secondary);border-radius:var(--radius);margin-bottom:4px;font-size:12px;">
          <span><span class="badge badge-primary">${r.role_name}</span> <span class="text-muted">@ ${r.dept_name}</span></span>
          <button class="btn btn-secondary btn-sm" style="color:var(--danger);padding:2px 6px;" onclick="window.RBACAdminPage.removeRole(${userId},'${r.role_code}',${r.department_id})">✕</button>
        </div>
      `).join('');
    document.getElementById('ra-role').innerHTML = this.roles.map(r => `<option value="${r.code}">${r.name} (L${r.level}, ${r.perm_count || 0} quyền)</option>`).join('');
    document.getElementById('ra-dept').innerHTML = this.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('');
    document.getElementById('role-assign-modal').classList.add('active');
  },

  async assignRole() {
    const userId = document.getElementById('ra-user-id').value;
    try {
      const res = await fetch(`/api/users/${userId}/roles`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_code: document.getElementById('ra-role').value, department_id: document.getElementById('ra-dept').value })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã gán');
      await this.loadAll(); this.openRoleAssignModal(parseInt(userId));
    } catch (e) { window.toast.error(e.message); }
  },

  async removeRole(userId, roleCode, deptId) {
    try {
      await fetch(`/api/users/${userId}/roles/${roleCode}/${deptId}`, { method: 'DELETE' });
      window.toast.success('Đã gỡ');
      await this.loadAll(); this.openRoleAssignModal(userId);
    } catch (e) { window.toast.error(e.message); }
  },

  async resetPassword(id) {
    const newPw = prompt('Nhập mật khẩu mới cho user (tối thiểu 6 ký tự):');
    if (!newPw || newPw.length < 6) { if (newPw !== null) window.toast.error('Mật khẩu phải ít nhất 6 ký tự'); return; }
    try {
      const res = await fetch(`/api/users/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPw })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã reset mật khẩu');
    } catch (e) { window.toast.error(e.message); }
  },

  // ===== TAB 2: Vai trò =====
  renderRolesTab(body) {
    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Danh sách vai trò</h3>
        <button class="btn btn-primary btn-sm" onclick="window.RBACAdminPage.openRoleModal()">+ Tạo vai trò</button>
      </div>
      <table class="data-table">
        <thead><tr><th>Mã</th><th>Tên</th><th>Level</th><th>Users</th><th>Quyền</th><th>Loại</th><th></th></tr></thead>
        <tbody>
          ${this.roles.map(r => `<tr>
            <td style="font-family:monospace;font-size:12px;">${r.code}</td>
            <td style="font-weight:500;">${r.name}</td>
            <td style="text-align:center;">${r.level}</td>
            <td style="text-align:center;">${r.user_count || 0}</td>
            <td style="text-align:center;">${r.perm_count || 0}</td>
            <td>${r.is_system ? '<span class="badge badge-neutral">Hệ thống</span>' : '<span class="badge badge-info">Tùy chỉnh</span>'}</td>
            <td style="white-space:nowrap;">
              <button class="btn btn-secondary btn-sm" onclick="window.RBACAdminPage.openRoleModal(${r.id})">Sửa</button>
              ${!r.is_system ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.RBACAdminPage.deleteRole(${r.id})">Xóa</button>` : ''}
            </td>
          </tr>`).join('')}
        </tbody>
      </table>

      <div id="role-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2 id="role-modal-title">Tạo vai trò</h2></div>
          <div class="modal-body">
            <input type="hidden" id="r-edit-id">
            <div class="input-group"><label>Mã vai trò <span style="color:var(--danger);">*</span></label><input type="text" id="r-code" required placeholder="MY_ROLE"></div>
            <div class="input-group"><label>Tên <span style="color:var(--danger);">*</span></label><input type="text" id="r-name" required placeholder="Tên vai trò"></div>
            <div class="input-group"><label>Level</label><input type="number" id="r-level" min="1" max="99" value="1"></div>
            <div class="modal-error" id="r-error"></div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('role-modal').classList.remove('active')">Hủy</button>
              <button class="btn btn-primary" onclick="window.RBACAdminPage.saveRole()">Lưu</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  openRoleModal(id) {
    const r = id ? this.roles.find(x => x.id === id) : null;
    document.getElementById('role-modal-title').textContent = r ? 'Sửa vai trò' : 'Tạo vai trò';
    document.getElementById('r-edit-id').value = r ? r.id : '';
    document.getElementById('r-code').value = r ? r.code : '';
    document.getElementById('r-code').disabled = !!r;
    document.getElementById('r-name').value = r ? r.name : '';
    document.getElementById('r-level').value = r ? r.level : 1;
    document.getElementById('r-error').classList.remove('show');
    document.getElementById('role-modal').classList.add('active');
  },

  async saveRole() {
    const id = document.getElementById('r-edit-id').value;
    const payload = { name: document.getElementById('r-name').value.trim(), level: parseInt(document.getElementById('r-level').value) };
    if (!id) payload.code = document.getElementById('r-code').value.trim();
    try {
      const res = await fetch(id ? `/api/roles/${id}` : '/api/roles', {
        method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      document.getElementById('role-modal').classList.remove('active');
      window.toast.success(id ? 'Đã cập nhật' : 'Đã tạo');
      await this.loadAll(); this.renderRolesTab(document.getElementById('rbac-content'));
    } catch (e) {
      document.getElementById('r-error').textContent = e.message;
      document.getElementById('r-error').classList.add('show');
    }
  },

  async deleteRole(id) {
    if (!confirm('Xóa vai trò này?')) return;
    try {
      const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã xóa');
      await this.loadAll(); this.renderRolesTab(document.getElementById('rbac-content'));
    } catch (e) { window.toast.error(e.message); }
  },

  // ===== TAB 3: Ma trận phân quyền =====
  async renderPermMatrixTab(body) {
    body.innerHTML = '<div class="spinner"></div>';
    try {
      this.permissions = await fetch('/api/permissions').then(r => r.json());
    } catch (e) {
      body.innerHTML = '<p style="color:var(--danger);">Không có quyền truy cập ma trận phân quyền.</p>';
      return;
    }

    // Group permissions by module
    const modules = {};
    this.permissions.forEach(p => {
      if (!modules[p.module]) modules[p.module] = [];
      modules[p.module].push(p);
    });

    // Load current role-permission mappings
    const rolePerms = {};
    for (const r of this.roles) {
      try {
        const perms = await fetch(`/api/roles/${r.id}/permissions`).then(res => res.json());
        rolePerms[r.id] = new Set(perms.map(p => p.id));
      } catch (e) {
        rolePerms[r.id] = new Set();
      }
    }

    const moduleLabels = {
      programs: 'Chương trình đào tạo (CTĐT)',
      programs_granular: 'CTĐT (Soạn thảo chi tiết)',
      plo: 'Chuẩn đầu ra (PLO)',
      syllabus: 'Đề cương học phần',
      courses: 'Danh mục học phần',
      rbac: 'Quản trị hệ thống',
      portfolio: 'Hồ sơ giáo dục'
    };

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Ma trận phân quyền</h3>
        <button class="btn btn-primary btn-sm" id="save-perm-matrix">Lưu thay đổi</button>
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-bottom:12px;">✓ = Đã gán quyền. Click vào ô để bật/tắt.</p>
      <div style="overflow-x:auto; border-radius: var(--radius); border: 1px solid var(--border);">
        <table class="perm-matrix-table" id="perm-matrix">
          <thead>
            <tr>
              <th style="min-width:240px; text-align: left;">Mô tả quyền</th>
              ${this.roles.map(r => `<th style="min-width:110px;">${r.name}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${Object.entries(modules).map(([mod, perms]) => `
              <tr>
                <td colspan="${this.roles.length + 1}" class="mod-header">${moduleLabels[mod] || mod}</td>
              </tr>
              ${perms.map(p => `
                <tr class="mod-${mod}">
                  <td style="font-size:13px; font-weight: 500;" title="${p.code}">${p.description || p.code}</td>
                  ${this.roles.map(r => {
                    const checked = rolePerms[r.id]?.has(p.id);
                    return `<td style="text-align:center;">
                      <input type="checkbox" data-role="${r.id}" data-perm="${p.id}" ${checked ? 'checked' : ''}
                        style="width:16px;height:16px;cursor:pointer;">
                    </td>`;
                  }).join('')}
                </tr>
              `).join('')}
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('save-perm-matrix').addEventListener('click', async () => {
      const btn = document.getElementById('save-perm-matrix');
      const originalText = btn.textContent;
      btn.textContent = 'Đang lưu...';
      btn.disabled = true;

      try {
        for (const r of this.roles) {
          const checkboxes = document.querySelectorAll(`#perm-matrix input[data-role="${r.id}"]:checked`);
          const permIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.perm));
          await fetch(`/api/roles/${r.id}/permissions`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ permission_ids: permIds })
          });
        }
        window.toast.success('Đã lưu ma trận phân quyền thành công');
      } catch (e) {
        window.toast.error('Lỗi khi lưu: ' + e.message);
      } finally {
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  },

  // ===== TAB 4: Đơn vị =====
  renderDeptsTab(body) {
    const tree = this.buildDeptTree();
    const badges = { ROOT:'badge-neutral', KHOA:'badge-info', VIEN:'badge-success', TRUNG_TAM:'badge-warning', BO_MON:'badge-neutral', PHONG:'badge-neutral' };

    const renderNode = (node, depth = 0) => {
      const indent = depth * 28;
      return `
        <div class="tree-node" style="margin-left:${indent}px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div>
              <div style="font-weight:500;font-size:14px;">${node.name}</div>
              <div style="font-size:11px;color:var(--text-muted);">${node.code} · <span class="badge ${badges[node.type] || 'badge-neutral'}">${node.type}</span></div>
            </div>
            <div style="display:flex;gap:4px;">
              ${node.type !== 'ROOT' ? `<button class="btn btn-secondary btn-sm" onclick="window.RBACAdminPage.openDeptModal(null, ${node.id})">Sửa</button>` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.RBACAdminPage.openDeptModal(${node.id})">+ Con</button>
              ${node.type !== 'ROOT' && !node.children.length ? `<button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.RBACAdminPage.deleteDept(${node.id})">Xóa</button>` : ''}
            </div>
          </div>
          ${node.children.length ? `<div style="margin-top:4px;">${node.children.map(c => renderNode(c, depth + 1)).join('')}</div>` : ''}
        </div>
      `;
    };

    body.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="font-size:15px;font-weight:600;">Cây đơn vị tổ chức</h3>
        <button class="btn btn-primary btn-sm" onclick="window.RBACAdminPage.openDeptModal()">+ Tạo đơn vị</button>
      </div>
      ${tree.map(n => renderNode(n)).join('')}

      <div id="dept-modal" class="modal-overlay">
        <div class="modal">
          <div class="modal-header"><h2 id="dept-modal-title">Tạo đơn vị</h2></div>
          <div class="modal-body">
            <input type="hidden" id="d-edit-id">
            <div class="input-group"><label>Đơn vị cha</label><select id="d-parent"><option value="">— Gốc —</option>${this.departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}</select></div>
            <div class="input-group"><label>Mã <span style="color:var(--danger);">*</span></label><input type="text" id="d-code" required placeholder="K.ABC"></div>
            <div class="input-group"><label>Tên <span style="color:var(--danger);">*</span></label><input type="text" id="d-name" required placeholder="Tên đơn vị"></div>
            <div class="input-group"><label>Loại</label>
              <select id="d-type"><option value="KHOA">Khoa</option><option value="VIEN">Viện</option><option value="TRUNG_TAM">Trung tâm</option><option value="BO_MON">Bộ môn</option><option value="PHONG">Phòng ban</option></select>
            </div>
            <div class="modal-error" id="d-error"></div>
            <div class="modal-footer">
              <button class="btn btn-secondary" onclick="document.getElementById('dept-modal').classList.remove('active')">Hủy</button>
              <button class="btn btn-primary" onclick="window.RBACAdminPage.saveDept()">Lưu</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  openDeptModal(parentId, editId) {
    if (editId) {
      const d = this.departments.find(x => x.id === editId);
      if (!d) return;
      document.getElementById('dept-modal-title').textContent = 'Sửa đơn vị';
      document.getElementById('d-edit-id').value = d.id;
      document.getElementById('d-parent').value = d.parent_id || '';
      document.getElementById('d-code').value = d.code;
      document.getElementById('d-code').disabled = true;
      document.getElementById('d-name').value = d.name;
      document.getElementById('d-type').value = d.type;
    } else {
      document.getElementById('dept-modal-title').textContent = 'Tạo đơn vị mới';
      document.getElementById('d-edit-id').value = '';
      document.getElementById('d-parent').value = parentId || '';
      document.getElementById('d-code').value = '';
      document.getElementById('d-code').disabled = false;
      document.getElementById('d-name').value = '';
    }
    document.getElementById('d-error').classList.remove('show');
    document.getElementById('dept-modal').classList.add('active');
  },

  async saveDept() {
    const id = document.getElementById('d-edit-id').value;
    const payload = {
      name: document.getElementById('d-name').value.trim(),
      type: document.getElementById('d-type').value,
      parent_id: document.getElementById('d-parent').value || null,
    };
    if (!id) payload.code = document.getElementById('d-code').value.trim();
    try {
      const res = await fetch(id ? `/api/departments/${id}` : '/api/departments', {
        method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      document.getElementById('dept-modal').classList.remove('active');
      window.toast.success(id ? 'Đã cập nhật' : 'Đã tạo');
      await this.loadAll(); this.renderDeptsTab(document.getElementById('rbac-content'));
    } catch (e) {
      document.getElementById('d-error').textContent = e.message;
      document.getElementById('d-error').classList.add('show');
    }
  },

  async deleteDept(id) {
    if (!confirm('Xóa đơn vị này?')) return;
    try {
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã xóa');
      await this.loadAll(); this.renderDeptsTab(document.getElementById('rbac-content'));
    } catch (e) { window.toast.error(e.message); }
  },

  buildDeptTree() {
    const map = {};
    const roots = [];
    this.departments.forEach(d => { map[d.id] = { ...d, children: [] }; });
    this.departments.forEach(d => {
      if (d.parent_id && map[d.parent_id]) map[d.parent_id].children.push(map[d.id]);
      else roots.push(map[d.id]);
    });
    return roots;
  },

  destroy() {}
};
