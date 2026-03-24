// Audit Logs Page — Notion-style
window.AuditLogsPage = {
  currentOffset: 0,
  pageSize: 30,

  async render(container) {
    this.currentOffset = 0;
    await this.loadLogs(container);
  },

  translateAction(method, target) {
    if (!target) return 'Không xác định';
    let t = target.split('?')[0].replace(/\/$/, ''); // Remove query string & trailing slash
    
    // Auth & Generic
    if (t.includes('auth/login')) return 'Đăng nhập hệ thống';
    
    // Approval & Workflow
    if (t.includes('approval/submit')) return 'Nộp yêu cầu Phê duyệt';
    if (t.includes('approval/review')) return 'Phê duyệt / Đánh giá yêu cầu';
    
    // Roles & Users
    if (t.match(/^roles\/\d+\/permissions/)) return 'Cập nhật phân quyền cho Vai trò';
    if (t.match(/^users\/\d+\/roles/)) return method === 'DELETE' ? 'Gỡ vai trò Người dùng' : 'Gán vai trò Người dùng';
    if (t.startsWith('roles')) return 'Quản lý Hệ thống Vai trò';
    if (t.startsWith('users')) return 'Quản lý Danh sách Người dùng';
    
    // Syllabus & Assignments
    if (t.startsWith('assignments')) return 'Phân công biên soạn Đề cương';
    if (t.startsWith('syllabus')) return 'Quản lý Đề cương Chi tiết';
    
    // Programs & Versions
    if (t.match(/^versions\/\d+\/clone/)) return 'Nhân bản phiên bản CTĐT';
    if (t.match(/^versions\/\d+\/courses/)) return 'Cập nhật danh sách Môn học (Ma trận)';
    if (t.match(/^versions\/\d+\/objectives/)) return 'Cập nhật Mục tiêu Đào tạo (PO)';
    if (t.match(/^programs\/\d+\/versions/)) return 'Quản lý Phiên bản CTĐT';
    if (t.startsWith('versions')) return 'Thông tin Phiên bản CTĐT';
    if (t.startsWith('programs')) return 'Danh sách Chương trình Đào tạo';
    
    // Core categories
    if (t.startsWith('departments')) return 'Danh mục Phòng ban / Đơn vị';
    if (t.startsWith('courses')) return 'Danh mục Học phần / Môn học';
    
    // Default fallback
    return `[Hệ thống] Tác động vào ${t}`;
  },

  async loadLogs(container) {
    try {
      const data = await fetch(`/api/audit-logs?limit=${this.pageSize}&offset=${this.currentOffset}`).then(r => r.json());
      const methodLabels = { POST: 'Tạo', PUT: 'Sửa', DELETE: 'Xóa' };
      const totalPages = Math.ceil(data.total / this.pageSize);
      const currentPage = Math.floor(this.currentOffset / this.pageSize) + 1;

      container.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:24px;">
          <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.3px;">Nhật ký hệ thống</h1>
          <span style="color:var(--text-muted);font-size:13px;">${data.total} bản ghi</span>
        </div>
        <table class="data-table">
          <thead><tr><th style="width:150px;">Thời gian</th><th>Người dùng</th><th style="width:60px;">Loại</th><th>Thao tác</th><th>IP</th></tr></thead>
          <tbody>
            ${data.logs.length === 0 ? '<tr><td colspan="5" style="color:var(--text-muted);text-align:center;">Chưa có nhật ký</td></tr>' : data.logs.map(l => {
              const method = l.action?.split(' ')[0] || '';
              const target = l.action?.split(' ').slice(1).join(' ').replace('/api/', '') || '';
              const translated = window.AuditLogsPage.translateAction(method, target);
              return `<tr style="font-size:13px;">
                <td style="color:var(--text-muted);">${new Date(l.created_at).toLocaleString('vi-VN')}</td>
                <td style="font-weight:500;">${l.user_name || '?'}</td>
                <td><span class="badge badge-${method === 'POST' ? 'success' : method === 'DELETE' ? 'danger' : 'warning'}">${methodLabels[method] || method}</span></td>
                <td style="font-weight:500;font-size:13px;color:var(--text-main);" title="${target}">${translated}</td>
                <td style="color:var(--text-light);font-size:12px;">${l.ip || ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        ${totalPages > 1 ? `
          <div style="display:flex;justify-content:center;align-items:center;gap:12px;margin-top:20px;">
            <button class="btn btn-secondary btn-sm" ${currentPage <= 1 ? 'disabled' : ''} onclick="window.AuditLogsPage.prev()">← Trước</button>
            <span style="color:var(--text-muted);font-size:12px;">Trang ${currentPage} / ${totalPages}</span>
            <button class="btn btn-secondary btn-sm" ${currentPage >= totalPages ? 'disabled' : ''} onclick="window.AuditLogsPage.next()">Tiếp →</button>
          </div>
        ` : ''}
      `;
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
    }
  },

  prev() { this.currentOffset = Math.max(0, this.currentOffset - this.pageSize); this.loadLogs(document.getElementById('page-content')); },
  next() { this.currentOffset += this.pageSize; this.loadLogs(document.getElementById('page-content')); },
  destroy() {}
};
