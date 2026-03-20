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
        <div style="margin-bottom:32px;">
          <h1 style="font-size:28px;font-weight:700;letter-spacing:-0.5px;">Xin chào, ${window.App.currentUser.display_name}</h1>
          <p style="color:var(--text-muted);margin-top:4px;">${role.role_name} · ${role.dept_name || 'HUTECH'}</p>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0;margin-bottom:32px;">
          ${this.metric('Chương trình', stats.programs)}
          ${this.metric('Phiên bản', vTotal)}
          ${this.metric('Học phần', stats.courses)}
          ${this.metric('Đề cương', sTotal)}
          ${this.metric('Người dùng', stats.users)}
          ${this.metric('Chờ duyệt', stats.pendingApprovals)}
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-bottom:32px;">
          <div>
            <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">Phiên bản CTĐT</h3>
            ${this.statusList(stats.versions || {}, {
              draft: 'Nháp', submitted: 'Đã nộp', approved_khoa: 'Khoa ✓', approved_pdt: 'PĐT ✓', published: 'Công bố'
            })}
          </div>
          <div>
            <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">Đề cương</h3>
            ${this.statusList(stats.syllabi || {}, {
              draft: 'Nháp', submitted: 'Đã nộp', approved_tbm: 'TBM ✓', approved_khoa: 'Khoa ✓', approved_pdt: 'PĐT ✓', published: 'Công bố'
            })}
          </div>
        </div>

        <div>
          <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">Hoạt động gần đây</h3>
          ${(stats.recentActivity || []).length === 0
            ? '<p style="color:var(--text-muted);font-size:13px;">Chưa có hoạt động nào.</p>'
            : `<div>
              ${stats.recentActivity.map(a => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--divider);font-size:13px;">
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
    return `<div style="padding:16px 0;border-bottom:1px solid var(--divider);">
      <div style="font-size:28px;font-weight:700;color:var(--text);letter-spacing:-0.5px;">${value}</div>
      <div style="font-size:12px;color:var(--text-muted);margin-top:2px;">${label}</div>
    </div>`;
  },

  statusList(data, config) {
    const entries = Object.entries(config);
    const total = entries.reduce((s, [k]) => s + (data[k] || 0), 0);
    if (total === 0) return '<p style="color:var(--text-muted);font-size:13px;">Chưa có dữ liệu</p>';
    return entries.map(([key, label]) => {
      const count = data[key] || 0;
      return `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;">
        <span style="color:var(--text-muted);">${label}</span>
        <span style="font-weight:500;">${count}</span>
      </div>`;
    }).join('');
  },

  actionLabel(action) {
    if (!action) return '';
    const parts = action.split(' ');
    const method = parts[0];
    const path = parts.slice(1).join(' ');
    const map = { POST: 'tạo mới', PUT: 'cập nhật', DELETE: 'xóa' };
    const target = path?.replace('/api/', '').replace(/\/\d+/g, '').replace(/\//g, ' › ') || '';
    return `${map[method] || method} ${target}`;
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
