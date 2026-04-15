// Dashboard Page — Notion-style
window.DashboardPage = {
  async render(container) {
    container.innerHTML = '<div class="spinner"></div>';
    try {
      const stats = await fetch('/api/dashboard/stats').then(r => r.json());
      const role = window.App.getHighestRole();

      const vTotal = Object.values(stats.versions || {}).reduce((s, v) => s + v, 0);
      const sTotal = Object.values(stats.syllabi || {}).reduce((s, v) => s + v, 0);

      container.innerHTML = `
        <div class="mb-8">
          <h1 class="page-title" style="font-size:28px;letter-spacing:-0.5px;">Xin chào, ${window.App.currentUser.display_name}</h1>
          <p class="text-muted mt-2">${role.role_name} · ${role.dept_name || 'HUTECH'}</p>
        </div>

        <div class="grid-3col mb-8" style="gap:0;">
          ${this.metric('Chương trình', stats.programs)}
          ${this.metric('Khóa', vTotal)}
          ${this.metric('Học phần', stats.courses)}
          ${this.metric('Đề cương', sTotal)}
          ${this.metric('Người dùng', stats.users)}
          ${this.metric('Chờ duyệt', stats.pendingApprovals)}
        </div>

        <div class="grid-2col mb-8" style="gap:40px;">
          <div>
            <h3 class="section-title mb-3">Khóa CTĐT</h3>
            ${this.statusList(stats.versions || {}, {
              draft: 'Nháp', submitted: 'Đã nộp', approved_khoa: 'Khoa ✓', approved_pdt: 'PĐT ✓', published: 'Công bố'
            })}
          </div>
          <div>
            <h3 class="section-title mb-3">Đề cương</h3>
            ${this.statusList(stats.syllabi || {}, {
              draft: 'Nháp', submitted: 'Đã nộp', published: 'Công bố'
            })}
          </div>
        </div>

        <div>
          <h3 class="section-title mb-3">Hoạt động gần đây</h3>
          ${(stats.recentActivity || []).length === 0
            ? '<p class="text-muted" style="font-size:13px;">Chưa có hoạt động nào.</p>'
            : `<div>
              ${stats.recentActivity.map(a => `
                <div class="flex-between" style="padding:6px 0;border-bottom:1px solid var(--row-divider);font-size:13px;">
                  <div>
                    <span style="font-weight:500;">${a.display_name || '?'}</span>
                    <span style="color:var(--text-muted);margin-left:6px;">${this.actionLabel(a.action)}</span>
                  </div>
                  <span style="color:var(--text-light);font-size:12px;">${this.timeAgo(a.created_at)}</span>
                </div>
              `).join('')}
            </div>`
          }
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><h3>Lỗi</h3><p>${e.message}</p></div>`;
    }
  },

  metric(label, value) {
    return `<div style="padding:16px 0;border-bottom:1px solid var(--row-divider);">
      <div class="stat-value" style="font-size:28px;">${value}</div>
      <div class="stat-label mt-2">${label}</div>
    </div>`;
  },

  statusList(data, config) {
    const entries = Object.entries(config);
    const total = entries.reduce((s, [k]) => s + (data[k] || 0), 0);
    if (total === 0) return '<p class="text-muted" style="font-size:13px;">Chưa có dữ liệu</p>';
    return entries.map(([key, label]) => {
      const count = data[key] || 0;
      return `<div class="flex-between" style="padding:4px 0;font-size:13px;">
        <span class="text-muted">${label}</span>
        <span style="font-weight:500;">${count}</span>
      </div>`;
    }).join('');
  },

  actionLabel(action) {
    if (!action) return '';
    // Reuse audit-logs translation if available
    if (window.AuditLogsPage && window.AuditLogsPage.translateAction) {
      return window.AuditLogsPage.translateAction(action).desc;
    }
    // Fallback inline translation
    const parts = action.split(' ');
    const method = parts[0];
    const path = (parts.slice(1).join(' ') || '').replace('/api/', '');
    const methodLabels = { POST: 'Tạo', PUT: 'Cập nhật', DELETE: 'Xóa', GET: 'Xem' };
    const methodLabel = methodLabels[method] || method;
    const pathMap = {
      'auth/login': 'Đăng nhập', 'auth/logout': 'Đăng xuất', 'auth/change-password': 'Đổi mật khẩu',
      'programs': 'chương trình ĐT', 'courses': 'học phần', 'users': 'tài khoản',
      'roles': 'vai trò', 'departments': 'đơn vị', 'approval/submit': 'nộp phê duyệt',
      'approval/review': 'phê duyệt / từ chối',
    };
    const cleaned = path.replace(/\/\d+/g, '').replace(/\/$/, '');
    if (pathMap[cleaned]) {
      const label = pathMap[cleaned];
      if (['Đăng nhập', 'Đăng xuất', 'Đổi mật khẩu', 'nộp phê duyệt', 'phê duyệt / từ chối'].includes(label)) {
        return label.charAt(0).toUpperCase() + label.slice(1);
      }
      return `${methodLabel} ${label}`;
    }
    // Version sub-resources
    const versionMatch = cleaned.match(/^versions\/(.+)$/);
    if (versionMatch) {
      const sub = { 'objectives': 'mục tiêu PO', 'plos': 'CĐR PLO', 'courses': 'học phần CTĐT',
        'po-plo-map': 'ma trận PO↔PLO', 'course-plo-map': 'ma trận HP↔PLO', 'course-pi-map': 'ma trận HP↔PI',
        'assessments': 'đánh giá CĐR', 'syllabi': 'đề cương', 'assignments': 'phân công đề cương',
      }[versionMatch[1]] || versionMatch[1];
      return `${methodLabel} ${sub}`;
    }
    return `${methodLabel} ${cleaned.replace(/\//g, ' › ') || ''}`;
  },

  timeAgo(date) {
    if (!date) return '';
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (s < 60) return 'vừa xong';
    if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
    if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
    return `${Math.floor(s / 86400)} ngày trước`;
  },

  destroy() {}
};
