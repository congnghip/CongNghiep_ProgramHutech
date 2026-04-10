// HUTECH Program — Frontend App (Notion-style)
(function() {
  const App = {
    currentUser: null,
    userRoles: [],
    userPerms: [],
    isAdmin: false,
    currentPage: null,
    notificationUnread: 0,
    notificationFilter: 'all',
    notificationPollTimer: null,
    sidebarCollapsed: false,
    sidebarStorageKey: 'hutech.sidebar.collapsed',

    loadSidebarPreference() {
      try {
        this.sidebarCollapsed = localStorage.getItem(this.sidebarStorageKey) === 'true';
      } catch (e) {
        this.sidebarCollapsed = false;
      }
    },

    persistSidebarPreference() {
      try {
        localStorage.setItem(this.sidebarStorageKey, String(this.sidebarCollapsed));
      } catch (e) {
        return;
      }
    },

    applySidebarState() {
      document.querySelector('.layout')?.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
      document.querySelector('.sidebar')?.classList.toggle('collapsed', this.sidebarCollapsed);

      const toggle = document.querySelector('[data-sidebar-toggle]');
      if (toggle) {
        toggle.setAttribute('aria-expanded', String(!this.sidebarCollapsed));
        toggle.setAttribute('aria-label', this.sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar');
        toggle.textContent = this.sidebarCollapsed ? '»' : '«';
      }
    },

    toggleSidebar() {
      this.sidebarCollapsed = !this.sidebarCollapsed;
      this.persistSidebarPreference();
      this.applySidebarState();
    },

    async init() {
      this.initToast();
      this.initDialog();
      this.initModalScrollLock();
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const data = await res.json();
          this.currentUser = data.user;
          this.userRoles = data.roles;
          this.userPerms = data.permissions;
          this.isAdmin = data.isAdmin;
          this.loadSidebarPreference();
          this.renderApp();
        } else {
          this.renderLogin();
        }
      } catch (e) { this.renderLogin(); }
    },

    hasPerm(code) {
      if (this.isAdmin) return true;
      if (this.userPerms.includes(code)) return true;
      // HIERARCHY: programs.edit grants view permissions
      const isViewPerm = code === 'programs.view_published' || code === 'programs.view_draft';
      if (isViewPerm) {
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
        <div class="layout ${this.sidebarCollapsed ? 'sidebar-collapsed' : ''}">
          <div class="sidebar ${this.sidebarCollapsed ? 'collapsed' : ''}">
            <div class="sidebar-header">
              <div class="sidebar-brand">
                <span class="sidebar-brand-icon">🎓</span>
                <h1>HUTECH Program</h1>
              </div>
              <button
                type="button"
                class="sidebar-toggle"
                data-sidebar-toggle
                aria-label="${this.sidebarCollapsed ? 'Mở rộng sidebar' : 'Thu gọn sidebar'}"
                aria-expanded="${String(!this.sidebarCollapsed)}"
              >${this.sidebarCollapsed ? '»' : '«'}</button>
            </div>
            <nav class="sidebar-nav">
              <div class="nav-item active" data-page="dashboard" title="Tổng quan">
                <span class="icon">📊</span>
                <span class="nav-label">Tổng quan</span>
              </div>
              <div class="nav-item" id="notification-nav" data-notification-trigger title="Thông báo">
                <span class="icon">🔔</span>
                <span class="nav-label nav-label-grow">Thông báo</span>
                <span class="notification-badge" id="notification-badge" style="display:none;"></span>
              </div>

              <div class="nav-section">Đào tạo</div>
              ${(this.hasPerm('programs.view_published') || this.hasPerm('programs.view_draft')) ? `
              <div class="nav-item" data-page="programs" title="Chương trình ĐT">
                <span class="icon">📋</span>
                <span class="nav-label">Chương trình ĐT</span>
              </div>` : ''}
              ${this.hasPerm('courses.view') ? `
              <div class="nav-item" data-page="courses" title="Học phần">
                <span class="icon">📚</span>
                <span class="nav-label">Học phần</span>
              </div>` : ''}
              ${this.userRoles.some(r => r.role_code === 'GIANG_VIEN') ? `
              <div class="nav-item" data-page="my-assignments" title="Đề cương của tôi">
                <span class="icon">📝</span>
                <span class="nav-label">Đề cương của tôi</span>
              </div>` : ''}
              <div class="nav-item" data-page="approval" title="Phê duyệt">
                <span class="icon">📬</span>
                <span class="nav-label">Phê duyệt</span>
              </div>

              ${this.isAdmin ? `
              <div class="nav-section">Cài đặt</div>
              <div class="nav-item" data-page="rbac-admin" title="Phân quyền">
                <span class="icon">⚙️</span>
                <span class="nav-label">Phân quyền</span>
              </div>
              <div class="nav-item" data-page="audit-logs" title="Nhật ký">
                <span class="icon">📜</span>
                <span class="nav-label">Nhật ký</span>
              </div>
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
        <div class="notification-drawer-backdrop" id="notification-drawer-backdrop" onclick="window.App.closeNotificationsDrawer()"></div>
        <aside class="notification-drawer" id="notification-drawer" role="dialog" aria-modal="true" aria-labelledby="notification-drawer-title">
          <div class="notification-drawer-header">
            <div>
              <h2 id="notification-drawer-title">Thông báo</h2>
              <p id="notification-drawer-subtitle">Các việc cần bạn xử lý và kết quả phê duyệt.</p>
            </div>
            <button type="button" class="notification-close" aria-label="Đóng thông báo" onclick="window.App.closeNotificationsDrawer()">×</button>
          </div>
          <div class="notification-drawer-actions">
            <button type="button" class="notification-filter active" data-filter="all">Tất cả</button>
            <button type="button" class="notification-filter" data-filter="unread">Chưa đọc</button>
            <button type="button" class="notification-filter" data-filter="actionable">Cần xử lý</button>
          </div>
          <div class="notification-drawer-toolbar">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.App.markAllNotificationsRead()">Đánh dấu tất cả đã đọc</button>
          </div>
          <div class="notification-list" id="notification-list">
            <div class="spinner"></div>
          </div>
        </aside>
      `;

      document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => this.navigate(item.dataset.page));
      });
      document.querySelector('[data-sidebar-toggle]')?.addEventListener('click', () => this.toggleSidebar());
      document.getElementById('notification-nav')?.addEventListener('click', () => this.openNotificationsDrawer());
      document.querySelectorAll('.notification-filter').forEach(btn => {
        btn.addEventListener('click', () => this.setNotificationFilter(btn.dataset.filter));
      });
      document.getElementById('notification-list')?.addEventListener('click', (e) => {
        const item = e.target.closest('.notification-item[data-notification-id]');
        if (!item) return;
        this.openNotification(item.dataset.notificationId);
      });
      document.getElementById('notification-list')?.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        const item = e.target.closest('.notification-item[data-notification-id]');
        if (!item) return;
        if (e.key === ' ') e.preventDefault();
        this.openNotification(item.dataset.notificationId);
      });
      document.getElementById('notification-drawer')?.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.closeNotificationsDrawer();
      });

      this.applySidebarState();
      this.startNotificationPolling();
      this.navigate('dashboard');
    },

    async navigate(page, params) {
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
      const activeNav = Array.from(document.querySelectorAll('.nav-item[data-page]'))
        .find(item => item.dataset.page === page);
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
        'my-assignments': window.MyAssignmentsPage,
        'audit-logs': window.AuditLogsPage,
        'rbac-admin': window.RBACAdminPage,
        'import-word': window.ImportWordPage,
      };

      const pageModule = pages[page];
      if (pageModule) {
        if (page === 'rbac-admin' && window.RBACAdminPage) {
          window.RBACAdminPage.activeTab = 0;
        }
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

    async refreshNotificationCount() {
      try {
        const res = await fetch('/api/notifications/unread-count');
        if (!res.ok) return;
        const data = await res.json().catch(() => ({}));
        this.notificationUnread = Number(data?.unread || 0);
        const badge = document.getElementById('notification-badge');
        if (!badge) return;
        if (this.notificationUnread > 0) {
          badge.textContent = this.notificationUnread > 99 ? '99+' : String(this.notificationUnread);
          badge.style.display = 'inline-flex';
        } else {
          badge.textContent = '';
          badge.style.display = 'none';
        }
      } catch (e) {
        return;
      }
    },

    startNotificationPolling() {
      this.stopNotificationPolling();
      this.refreshNotificationCount();
      this.notificationPollTimer = setInterval(() => {
        this.refreshNotificationCount();
      }, 60000);
    },

    stopNotificationPolling() {
      if (this.notificationPollTimer) {
        clearInterval(this.notificationPollTimer);
        this.notificationPollTimer = null;
      }
    },

    openNotificationsDrawer() {
      document.getElementById('notification-drawer')?.classList.add('active');
      document.getElementById('notification-drawer-backdrop')?.classList.add('active');
      this.loadNotifications();
    },

    closeNotificationsDrawer() {
      document.getElementById('notification-drawer')?.classList.remove('active');
      document.getElementById('notification-drawer-backdrop')?.classList.remove('active');
    },

    setNotificationFilter(filter) {
      this.notificationFilter = filter || 'all';
      document.querySelectorAll('.notification-filter').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === this.notificationFilter);
      });
      this.loadNotifications();
    },

    async loadNotifications() {
      const list = document.getElementById('notification-list');
      if (!list) return;
      list.innerHTML = '<div class="spinner"></div>';

      try {
        const res = await fetch(`/api/notifications?filter=${encodeURIComponent(this.notificationFilter || 'all')}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Không thể tải thông báo');

        const notifications = Array.isArray(data.notifications) ? data.notifications : [];
        this.notificationItems = notifications;

        if (!notifications.length) {
          const emptyMap = {
            unread: 'Bạn chưa có thông báo chưa đọc.',
            actionable: 'Hiện chưa có thông báo cần xử lý.',
            all: 'Chưa có thông báo nào.'
          };
          list.innerHTML = `
            <div class="notification-empty">
              <div class="icon">🔔</div>
              <h3>Trống</h3>
              <p>${emptyMap[this.notificationFilter] || emptyMap.all}</p>
            </div>
          `;
          return;
        }

        list.innerHTML = notifications.map(n => this.renderNotificationItem(n)).join('');
      } catch (e) {
        list.innerHTML = `
          <div class="notification-empty notification-error">
            <div class="icon">⚠️</div>
            <h3>Không thể tải thông báo</h3>
            <p>${this.escapeHtml(e.message || 'Đã có lỗi xảy ra.')}</p>
          </div>
        `;
      }
    },

    renderNotificationItem(notification) {
      const title = this.escapeHtml(notification?.title || 'Thông báo');
      const body = this.escapeHtml(notification?.body || '');
      const time = this.escapeHtml(this.formatNotificationTime(notification?.created_at));
      const isRead = !!notification?.is_read;

      return `
        <div class="notification-item ${isRead ? 'is-read' : 'is-unread'}" data-notification-id="${notification.id}" role="button" tabindex="0" aria-label="${title}">
          <div class="notification-item-main">
            <div class="notification-item-title-row">
              <div class="notification-item-title">${title}</div>
              ${isRead ? '<span class="notification-item-state">Đã đọc</span>' : '<span class="notification-item-dot" aria-hidden="true"></span>'}
            </div>
            ${body ? `<div class="notification-item-body">${body}</div>` : ''}
            <div class="notification-item-time">${time}</div>
          </div>
        </div>
      `;
    },

    async openNotification(notificationId) {
      const notification = (this.notificationItems || []).find(n => String(n.id) === String(notificationId));
      if (!notification) return;
      const destination = this.normalizeNotificationDestination(notification);

      try {
        const res = await fetch(`/api/notifications/${notification.id}/read`, { method: 'POST' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Không thể đánh dấu thông báo đã đọc');
        }
        await this.refreshNotificationCount();
      } catch (e) {
        window.toast?.error(e.message || 'Không thể đánh dấu thông báo đã đọc');
      } finally {
        this.closeNotificationsDrawer();
        if (destination) this.navigate(destination.page, destination.params);
      }
    },

    normalizeNotificationDestination(notification) {
      const params = notification?.link_params && typeof notification.link_params === 'object' && !Array.isArray(notification.link_params)
        ? notification.link_params
        : {};

      if (notification?.link_page === 'approval') {
        return { page: 'approval', params: {} };
      }

      if (notification?.link_page === 'my-assignments') {
        if (Object.prototype.hasOwnProperty.call(params, 'assignmentId')) {
          const assignmentId = this.toPositiveInteger(params.assignmentId);
          return assignmentId ? { page: 'my-assignments', params: { assignmentId } } : null;
        }
        return { page: 'my-assignments', params: {} };
      }

      if (notification?.link_page === 'version-editor') {
        const versionId = this.toPositiveInteger(params.versionId);
        return versionId ? { page: 'version-editor', params: { versionId } } : null;
      }

      if (notification?.link_page === 'syllabus-editor') {
        const syllabusId = this.toPositiveInteger(params.syllabusId);
        return syllabusId ? { page: 'syllabus-editor', params: { syllabusId } } : null;
      }

      return null;
    },

    toPositiveInteger(value) {
      if (typeof value === 'number') {
        return Number.isSafeInteger(value) && value > 0 ? value : null;
      }
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      if (!/^[1-9]\d*$/.test(trimmed)) return null;
      const parsed = Number(trimmed);
      return Number.isSafeInteger(parsed) ? parsed : null;
    },

    async markAllNotificationsRead() {
      try {
        const res = await fetch('/api/notifications/read-all', { method: 'POST' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Không thể đánh dấu tất cả đã đọc');
        }
        await Promise.all([this.refreshNotificationCount(), this.loadNotifications()]);
      } catch (e) {
        window.toast?.error(e.message || 'Không thể đánh dấu tất cả đã đọc');
      }
    },

    formatNotificationTime(dateValue) {
      const date = new Date(dateValue);
      if (Number.isNaN(date.getTime())) return '';

      const diffMs = Date.now() - date.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMinutes < 1) return 'Vừa xong';
      if (diffMinutes < 60) return `${diffMinutes} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays < 7) return `${diffDays} ngày trước`;

      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(date);
    },

    escapeHtml(value) {
      return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    },

    async logout() {
      this.stopNotificationPolling();
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
      App.modalGuard('chpw-modal', () => App.submitChangePassword());
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

    // ====== MODAL SCROLL LOCK ======
    initModalScrollLock() {
      const observer = new MutationObserver(() => {
        const hasActiveModal = document.querySelector('.modal-overlay.active');
        document.body.classList.toggle('modal-open', !!hasActiveModal);
      });
      observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['class'] });
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

    initDialog() {
      if (document.getElementById('ui-dialog-overlay')) return;

      const overlay = document.createElement('div');
      overlay.className = 'modal-overlay ui-dialog-overlay';
      overlay.id = 'ui-dialog-overlay';
      overlay.innerHTML = `
        <div class="modal ui-dialog" role="dialog" aria-modal="true" aria-labelledby="ui-dialog-title">
          <div class="ui-dialog-header">
            <div class="ui-dialog-badge" id="ui-dialog-badge">?</div>
            <div class="ui-dialog-copy">
              <div class="ui-dialog-eyebrow" id="ui-dialog-eyebrow"></div>
              <h2 id="ui-dialog-title">Thông báo</h2>
            </div>
          </div>
          <div class="modal-body ui-dialog-body">
            <div class="ui-dialog-message" id="ui-dialog-message"></div>
            <div class="ui-dialog-input-wrap" id="ui-dialog-input-wrap">
              <input type="text" id="ui-dialog-input" class="ui-dialog-input">
            </div>
            <div class="modal-error" id="ui-dialog-error"></div>
            <div class="modal-footer ui-dialog-footer">
              <button type="button" class="btn btn-secondary" id="ui-dialog-cancel">Hủy</button>
              <button type="button" class="btn btn-secondary" id="ui-dialog-discard" style="display:none"></button>
              <button type="button" class="btn btn-primary" id="ui-dialog-confirm">Xác nhận</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);

      const titleEl = document.getElementById('ui-dialog-title');
      const eyebrowEl = document.getElementById('ui-dialog-eyebrow');
      const badgeEl = document.getElementById('ui-dialog-badge');
      const messageEl = document.getElementById('ui-dialog-message');
      const inputWrapEl = document.getElementById('ui-dialog-input-wrap');
      const inputEl = document.getElementById('ui-dialog-input');
      const errorEl = document.getElementById('ui-dialog-error');
      const cancelBtn = document.getElementById('ui-dialog-cancel');
      const discardBtn = document.getElementById('ui-dialog-discard');
      const confirmBtn = document.getElementById('ui-dialog-confirm');

      const queue = [];
      let activeRequest = null;

      const toneIcons = {
        info: 'i',
        success: '✓',
        warning: '!',
        danger: '!'
      };

      const defaults = {
        alert: {
          title: 'Thông báo',
          confirmText: 'Đã hiểu',
          tone: 'info',
          dismissible: true
        },
        confirm: {
          title: 'Xác nhận',
          confirmText: 'Xác nhận',
          cancelText: 'Hủy',
          tone: 'info',
          dismissible: true
        },
        prompt: {
          title: 'Nhập thông tin',
          confirmText: 'Lưu',
          cancelText: 'Hủy',
          tone: 'info',
          dismissible: true,
          required: false,
          trim: true,
          inputType: 'text'
        }
      };

      const normalizeModeOptions = (mode, options) => ({ ...defaults[mode], ...options, mode });

      const showError = (message) => {
        if (!message) {
          errorEl.textContent = '';
          errorEl.classList.remove('show');
          return;
        }
        errorEl.textContent = message;
        errorEl.classList.add('show');
      };

      const finish = (result) => {
        if (!activeRequest) return;
        const request = activeRequest;
        activeRequest = null;
        overlay.classList.remove('active');
        setTimeout(() => {
          request.resolve(result);
          if (queue.length) {
            showNext();
          }
        }, 150);
      };

      const cancel = () => {
        if (!activeRequest) return;
        finish(activeRequest.mode === 'prompt' ? null : false);
      };

      const discard = () => {
        if (!activeRequest) return;
        finish('discard');
      };

      const submit = () => {
        if (!activeRequest) return;

        if (activeRequest.mode !== 'prompt') {
          finish(true);
          return;
        }

        const rawValue = inputEl.value ?? '';
        const value = activeRequest.trim === false ? rawValue : rawValue.trim();

        if (activeRequest.required && !value) {
          showError(activeRequest.requiredMessage || 'Vui lòng nhập thông tin.');
          return;
        }

        if (typeof activeRequest.validate === 'function') {
          const validationMessage = activeRequest.validate(value);
          if (validationMessage) {
            showError(validationMessage);
            return;
          }
        }

        finish(value);
      };

      const showNext = () => {
        if (activeRequest || !queue.length) return;
        activeRequest = queue.shift();

        overlay.dataset.mode = activeRequest.mode;
        overlay.dataset.tone = activeRequest.tone || 'info';
        badgeEl.textContent = activeRequest.icon || toneIcons[activeRequest.tone] || toneIcons.info;
        titleEl.textContent = activeRequest.title;
        messageEl.textContent = activeRequest.message || '';
        eyebrowEl.textContent = activeRequest.eyebrow || '';
        eyebrowEl.style.display = activeRequest.eyebrow ? 'block' : 'none';

        inputWrapEl.style.display = activeRequest.mode === 'prompt' ? 'block' : 'none';
        if (activeRequest.mode === 'prompt') {
          inputEl.type = activeRequest.inputType || 'text';
          inputEl.placeholder = activeRequest.placeholder || '';
          inputEl.value = activeRequest.inputValue ?? '';
          inputEl.autocomplete = activeRequest.autocomplete || 'off';
          inputEl.select();
        } else {
          inputEl.value = '';
        }

        cancelBtn.style.display = activeRequest.mode === 'alert' ? 'none' : '';
        cancelBtn.textContent = activeRequest.cancelText || 'Hủy';
        discardBtn.style.display = activeRequest.discardText ? '' : 'none';
        if (activeRequest.discardText) discardBtn.textContent = activeRequest.discardText;
        confirmBtn.textContent = activeRequest.confirmText || 'Xác nhận';
        confirmBtn.className = `btn ${activeRequest.confirmVariant === 'danger' || activeRequest.tone === 'danger' ? 'btn-danger' : 'btn-primary'}`;

        showError('');
        overlay.classList.add('active');

        setTimeout(() => {
          if (activeRequest?.mode === 'prompt') inputEl.focus();
          else confirmBtn.focus();
        }, 20);
      };

      const open = (mode, options) => new Promise(resolve => {
        queue.push({ ...normalizeModeOptions(mode, options), resolve });
        showNext();
      });

      const normalizeOptions = (mode, messageOrOptions, maybeOptions = {}) => {
        if (typeof messageOrOptions === 'object' && messageOrOptions !== null && !Array.isArray(messageOrOptions)) {
          return messageOrOptions;
        }
        return { ...maybeOptions, message: String(messageOrOptions ?? '') };
      };

      overlay.addEventListener('click', (e) => {
        if (e.target !== overlay || !activeRequest?.dismissible) return;
        cancel();
      });
      cancelBtn.addEventListener('click', cancel);
      discardBtn.addEventListener('click', discard);
      confirmBtn.addEventListener('click', submit);
      inputEl.addEventListener('input', () => showError(''));
      document.addEventListener('keydown', (e) => {
        if (!activeRequest || !overlay.classList.contains('active')) return;
        if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
        if (e.key === 'Enter' && activeRequest.mode === 'prompt' && document.activeElement === inputEl) {
          e.preventDefault();
          submit();
        }
      });

      window.ui = {
        alert(messageOrOptions, options = {}) {
          return open('alert', normalizeOptions('alert', messageOrOptions, options));
        },
        confirm(messageOrOptions, options = {}) {
          return open('confirm', normalizeOptions('confirm', messageOrOptions, options));
        },
        prompt(messageOrOptions, defaultValue = '', options = {}) {
          if (typeof messageOrOptions === 'object' && messageOrOptions !== null && !Array.isArray(messageOrOptions)) {
            return open('prompt', messageOrOptions);
          }
          return open('prompt', { ...options, message: String(messageOrOptions ?? ''), inputValue: defaultValue ?? '' });
        },
      };
    },

    // ====== MODAL GUARD (unsaved changes) ======
    modalGuard(modalId, saveCallback) {
      const modal = document.getElementById(modalId);
      if (!modal) return;

      // Snapshot current form values
      const snapshot = new Map();
      modal.querySelectorAll('input:not([type=hidden]), select, textarea').forEach(el => {
        snapshot.set(el, el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value);
      });

      // Remove previous guard listener
      if (modal._guardListener) modal.removeEventListener('click', modal._guardListener);

      modal._guardListener = async (e) => {
        if (e.target !== modal) return;

        // Check dirty
        let dirty = false;
        for (const [el, val] of snapshot) {
          const cur = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value;
          if (cur !== val) { dirty = true; break; }
        }

        if (!dirty) {
          modal.classList.remove('active');
          return;
        }

        const result = await window.ui.confirm({
          title: 'Thay đổi chưa lưu',
          message: 'Bạn có muốn lưu các thay đổi?',
          confirmText: 'Lưu',
          cancelText: 'Hủy',
          discardText: 'Không lưu',
          tone: 'warning',
          dismissible: false,
        });

        if (result === true) {
          await saveCallback();
        } else if (result === 'discard') {
          modal.classList.remove('active');
        }
      };

      modal.addEventListener('click', modal._guardListener);
    },
  };

  window.App = App;
  App.init();
})();
