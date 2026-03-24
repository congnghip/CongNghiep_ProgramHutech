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
      this.initModalDismiss();
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

    getUserRoles() {
      return this.userRoles;
    },

    hasRole(roleCode) {
      return this.userRoles.some(role => role.role_code === roleCode);
    },

    escapeHtml(value = '') {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    navigateFromEncoded(page, encodedParams) {
      const params = encodedParams ? JSON.parse(decodeURIComponent(encodedParams)) : undefined;
      return this.navigate(page, params);
    },

    renderBreadcrumb(items = []) {
      const parts = items
        .filter(item => item && item.label)
        .map((item) => {
          const label = this.escapeHtml(item.label);
          if (!item.page) {
            return `<span style="font-weight:600;color:var(--text);">${label}</span>`;
          }

          const encodedParams = encodeURIComponent(JSON.stringify(item.params || {}));
          return `<button type="button" onclick="window.App.navigateFromEncoded('${item.page}','${encodedParams}')" style="background:none;border:none;padding:0;color:var(--text-muted);cursor:pointer;font:inherit;">${label}</button>`;
        });

      return `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">${parts.join('<span style="color:var(--text-muted);">/</span>')}</div>`;
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
              ${this.hasRole('GIANG_VIEN') ? `
              <div class="nav-item" data-page="my-syllabi">
                <span class="icon">📝</span> Đề cương của tôi
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
        await window.VersionEditorPage.render(container, params.versionId, params);
        this.checkPermissions(container);
        return;
      }
      if (page === 'syllabus-editor' && params?.syllabusId) {
        this.currentPage = window.SyllabusEditorPage;
        await window.SyllabusEditorPage.render(container, params.syllabusId, params);
        this.checkPermissions(container);
        return;
      }

      const pages = {
        dashboard: window.DashboardPage,
        departments: window.DepartmentsPage,
        users: window.UsersPage,
        programs: window.ProgramsPage,
        courses: window.CoursesPage,
        'my-syllabi': window.MySyllabiPage,
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

    initModalDismiss() {
      const shouldHandleCloseButton = (target) => {
        const btn = target.closest('.modal-footer .btn.btn-secondary');
        if (!btn || btn.type === 'submit') return false;
        const label = (btn.textContent || '').trim().toLowerCase();
        return ['huy', 'hủy', 'dong', 'đóng', 'tat', 'tắt'].includes(label);
      };

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.type === 'attributes') {
            if (!(mutation.target instanceof HTMLElement)) return;
            const overlay = mutation.target;
            if (!overlay.classList.contains('modal-overlay') || !overlay.classList.contains('active')) return;
            this.captureModalState(overlay);
            return;
          }

          const activeOverlay = mutation.target instanceof HTMLElement
            ? mutation.target.closest('.modal-overlay.active')
            : null;
          if (!activeOverlay || activeOverlay.dataset.modalTouched === 'true') return;
          this.captureModalState(activeOverlay);
        });
      });

      observer.observe(document.body, {
        subtree: true,
        attributes: true,
        childList: true,
        attributeFilter: ['class']
      });

      document.addEventListener('input', (event) => {
        const overlay = event.target.closest('.modal-overlay.active');
        if (overlay) overlay.dataset.modalTouched = 'true';
      });

      document.addEventListener('change', (event) => {
        const overlay = event.target.closest('.modal-overlay.active');
        if (overlay) overlay.dataset.modalTouched = 'true';
      });

      document.addEventListener('click', (event) => {
        const overlay = event.target.closest('.modal-overlay.active');
        if (!overlay) return;
        const isBackdropClick = event.target === overlay;
        const isCloseButtonClick = shouldHandleCloseButton(event.target);
        if (!isBackdropClick && !isCloseButtonClick) return;

        event.preventDefault();
        event.stopPropagation();
        this.requestModalClose(overlay);
      }, true);
    },

    captureModalState(overlay) {
      overlay.dataset.modalTouched = 'false';
      overlay.dataset.initialState = this.serializeModalState(overlay);
    },

    serializeModalState(overlay) {
      const fields = overlay.querySelectorAll('input, select, textarea');
      return JSON.stringify(Array.from(fields).map((field, index) => ({
        index,
        type: field.type || field.tagName.toLowerCase(),
        id: field.id || '',
        value: field.type === 'checkbox' || field.type === 'radio'
          ? field.checked
          : field.value
      })));
    },

    hasUnsavedModalChanges(overlay) {
      const initialState = overlay.dataset.initialState ?? this.serializeModalState(overlay);
      return initialState !== this.serializeModalState(overlay);
    },

    requestModalClose(overlay) {
      if (!this.hasUnsavedModalChanges(overlay)) {
        overlay.classList.remove('active');
        return;
      }

      const wantsSave = window.confirm('Bạn có muốn lưu thay đổi trước khi đóng không?');
      if (wantsSave) {
        this.submitModalChanges(overlay);
        return;
      }

      overlay.classList.remove('active');
    },

    submitModalChanges(overlay) {
      const form = overlay.querySelector('form');
      if (form) {
        if (typeof form.requestSubmit === 'function') form.requestSubmit();
        else form.submit();
        return;
      }

      const primaryButton = overlay.querySelector('.modal-footer .btn.btn-primary');
      if (primaryButton) {
        primaryButton.click();
        return;
      }

      overlay.classList.remove('active');
    },
  };

  window.App = App;
  App.init();
})();
