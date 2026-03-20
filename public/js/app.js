// HUTECH Program — Frontend App (Notion-style)
(function() {
  const App = {
    currentUser: null,
    userRoles: [],
    userPerms: [],
    isAdmin: false,
    currentPage: null,

    async init() {
      this.initToast();
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          this.currentUser = data.user;
          this.userRoles = data.roles;
          this.userPerms = data.permissions;
          this.isAdmin = data.isAdmin;
          this.renderApp();
        } else {
          this.renderLogin();
        }
      } catch (e) { this.renderLogin(); }
    },

    hasPerm(code) {
      if (this.isAdmin) return true;
      if (this.userPerms.includes(code)) return true;
      // HIERARCHY: programs.edit grants all programs.*.edit, syllabus.edit, and programs.view_*
      const isEditPerm = (code.startsWith('programs.') && code.endsWith('.edit')) || code === 'syllabus.edit';
      const isViewPerm = code === 'programs.view_published' || code === 'programs.view_draft';
      if (isEditPerm || isViewPerm) {
        return this.userPerms.includes('programs.edit');
      }
      return false;
    },

    getHighestRole() {
      if (!this.userRoles.length) return { role_name: 'N/A', dept_name: '' };
      return this.userRoles.reduce((a, b) => a.level > b.level ? a : b);
    },

    // ====== LOGIN ======
    renderLogin() {
      document.getElementById('app').innerHTML = `
        <div class="login-container">
          <div class="login-box">
            <div class="logo">🎓</div>
            <h1>HUTECH Program</h1>
            <p class="subtitle">Quản lý Chương trình Đào tạo</p>
            <div id="login-error" class="login-error"></div>
            <form id="login-form">
              <div class="input-group">
                <label>Tên đăng nhập</label>
                <input type="text" id="login-user" required autofocus placeholder="Nhập tên đăng nhập">
              </div>
              <div class="input-group">
                <label>Mật khẩu</label>
                <input type="password" id="login-pass" required placeholder="Nhập mật khẩu">
              </div>
              <button type="submit" class="btn btn-primary" style="width:100%;justify-content:center;padding:10px;">
                Đăng nhập
              </button>
            </form>
          </div>
        </div>
      `;
      document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-user').value;
        const password = document.getElementById('login-pass').value;
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          this.currentUser = data.user;
          this.userRoles = data.roles;
          await this.init();
        } catch (err) {
          document.getElementById('login-error').textContent = err.message;
        }
      });
    },

    // ====== MAIN APP ======
    renderApp() {
      const role = this.getHighestRole();
      document.getElementById('app').innerHTML = `
        <div class="layout">
          <div class="sidebar">
            <div class="sidebar-header">
              <span style="font-size:18px;">🎓</span>
              <h1>HUTECH Program</h1>
            </div>
            <nav class="sidebar-nav">
              <div class="nav-item active" data-page="dashboard">
                <span class="icon">📊</span> Tổng quan
              </div>

              <div class="nav-section">Đào tạo</div>
              ${(this.hasPerm('programs.view_published') || this.hasPerm('programs.view_draft')) ? `
              <div class="nav-item" data-page="programs">
                <span class="icon">📋</span> Chương trình ĐT
              </div>` : ''}
              ${this.hasPerm('courses.view') ? `
              <div class="nav-item" data-page="courses">
                <span class="icon">📚</span> Học phần
              </div>` : ''}
              <div class="nav-item" data-page="approval">
                <span class="icon">📬</span> Phê duyệt
              </div>

              ${this.hasPerm('rbac.manage_users') || this.hasPerm('rbac.manage_departments') || this.hasPerm('rbac.manage_roles') ? `
              <div class="nav-section">Cài đặt</div>
              <div class="nav-item" data-page="rbac-admin">
                <span class="icon">⚙️</span> Phân quyền
              </div>
              ${this.hasPerm('rbac.view_audit_logs') ? `
              <div class="nav-item" data-page="audit-logs">
                <span class="icon">📜</span> Nhật ký
              </div>` : ''}
              ` : ''}
            </nav>
            <div class="sidebar-user">
              <div class="user-info">
                <div class="user-name">${this.currentUser.display_name}</div>
                <div class="user-role">${role.role_name}</div>
              </div>
              <div style="display:flex;gap:4px;">
                <button class="logout-btn" style="flex:1;" onclick="window.App.openChangePassword()">Đổi MK</button>
                <button class="logout-btn" style="flex:1;" onclick="window.App.logout()">Đăng xuất</button>
              </div>
            </div>
          </div>
          <main class="main-content" id="page-content"></main>
        </div>

        <!-- Change Password Modal (global) -->
        <div class="modal-overlay" id="chpw-modal">
          <div class="modal">
            <div class="modal-header"><h2>Đổi mật khẩu</h2></div>
            <div class="modal-body">
              <div class="input-group"><label>Mật khẩu hiện tại <span style="color:var(--danger);">*</span></label><input type="password" id="chpw-current" required></div>
              <div class="input-group"><label>Mật khẩu mới <span style="color:var(--danger);">*</span></label><input type="password" id="chpw-new" required></div>
              <div class="input-group"><label>Xác nhận mật khẩu mới <span style="color:var(--danger);">*</span></label><input type="password" id="chpw-confirm" required></div>
              <div class="modal-error" id="chpw-error"></div>
              <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('chpw-modal').classList.remove('active')">Hủy</button>
                <button class="btn btn-primary" onclick="window.App.submitChangePassword()">Đổi mật khẩu</button>
              </div>
            </div>
          </div>
        </div>
      `;

      document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => this.navigate(item.dataset.page));
      });
      this.navigate('dashboard');
    },

    async navigate(page, params) {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const activeNav = document.querySelector(`.nav-item[data-page="${page}"]`);
      if (activeNav) activeNav.classList.add('active');

      const container = document.getElementById('page-content');
      container.innerHTML = '<div class="spinner"></div>';

      if (this.currentPage && this.currentPage.destroy) this.currentPage.destroy();

      if (page === 'version-editor' && params?.versionId) {
        this.currentPage = window.VersionEditorPage;
        await window.VersionEditorPage.render(container, params.versionId);
        this.checkPermissions(container);
        return;
      }
      if (page === 'syllabus-editor' && params?.syllabusId) {
        this.currentPage = window.SyllabusEditorPage;
        await window.SyllabusEditorPage.render(container, params.syllabusId);
        this.checkPermissions(container);
        return;
      }

      const pages = {
        dashboard: window.DashboardPage,
        departments: window.DepartmentsPage,
        users: window.UsersPage,
        programs: window.ProgramsPage,
        courses: window.CoursesPage,
        approval: window.ApprovalPage,
        'audit-logs': window.AuditLogsPage,
        'rbac-admin': window.RBACAdminPage,
      };

      const pageModule = pages[page];
      if (pageModule) {
        this.currentPage = pageModule;
        await pageModule.render(container, params);
        this.checkPermissions(container);
      } else {
        container.innerHTML = `<div class="empty-state"><div class="icon">🚧</div><h3>Đang phát triển</h3><p>Trang này sẽ sớm ra mắt.</p></div>`;
      }
    },

    /**
     * Scans the container for elements with [data-perm] and hides/shows them 
     * based on the current user's permissions.
     */
    checkPermissions(container = document) {
      const elements = container.querySelectorAll('[data-perm]');
      elements.forEach(el => {
        const requiredPerm = el.getAttribute('data-perm');
        if (!this.hasPerm(requiredPerm)) {
          el.style.display = 'none';
          el.setAttribute('data-perm-hidden', 'true');
        } else {
          // If it was hidden before, we might want to restore original display 
          // or just remove the property. Defaulting to block/inline-block
          // is risky, so we just remove the display property if it was set to none.
          if (el.style.display === 'none') {
            el.style.removeProperty('display');
          }
          el.removeAttribute('data-perm-hidden');
        }
      });
    },

    async logout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      this.currentUser = null;
      this.renderLogin();
    },

    openChangePassword() {
      document.getElementById('chpw-current').value = '';
      document.getElementById('chpw-new').value = '';
      document.getElementById('chpw-confirm').value = '';
      document.getElementById('chpw-error').classList.remove('show');
      document.getElementById('chpw-modal').classList.add('active');
    },

    async submitChangePassword() {
      const current = document.getElementById('chpw-current').value;
      const newPw = document.getElementById('chpw-new').value;
      const confirm = document.getElementById('chpw-confirm').value;
      const errEl = document.getElementById('chpw-error');

      if (!current || !newPw) { errEl.textContent = 'Vui lòng nhập đầy đủ.'; errEl.classList.add('show'); return; }
      if (newPw.length < 6) { errEl.textContent = 'Mật khẩu mới phải ít nhất 6 ký tự.'; errEl.classList.add('show'); return; }
      if (newPw !== confirm) { errEl.textContent = 'Mật khẩu xác nhận không khớp.'; errEl.classList.add('show'); return; }

      try {
        const res = await fetch('/api/auth/change-password', {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ current_password: current, new_password: newPw })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        document.getElementById('chpw-modal').classList.remove('active');
        window.toast.success('Đã đổi mật khẩu thành công');
      } catch (e) {
        errEl.textContent = e.message;
        errEl.classList.add('show');
      }
    },

    // ====== TOAST ======
    initToast() {
      const container = document.createElement('div');
      container.className = 'toast-container';
      container.id = 'toast-container';
      document.body.appendChild(container);

      window.toast = {
        show(msg, type = 'info', duration = 3000) {
          const t = document.createElement('div');
          const icons = { success: '✓', error: '✕', warning: '!', info: 'i' };
          t.className = `toast toast-${type}`;
          t.innerHTML = `<span style="font-weight:700;">${icons[type] || ''}</span><span>${msg}</span>`;
          t.onclick = () => { t.classList.add('removing'); setTimeout(() => t.remove(), 200); };
          document.getElementById('toast-container').appendChild(t);
          setTimeout(() => { t.classList.add('removing'); setTimeout(() => t.remove(), 200); }, duration);
        },
        success(m) { this.show(m, 'success'); },
        error(m) { this.show(m, 'error', 5000); },
        warning(m) { this.show(m, 'warning', 4000); },
        info(m) { this.show(m, 'info'); },
      };
    },
  };

  window.App = App;
  App.init();
})();
