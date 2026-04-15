// Audit Logs Page — Notion-style
window.AuditLogsPage = {
  currentOffset: 0,
  pageSize: 30,

  // Việt hóa API path thành mô tả dễ đọc
  translateAction(action) {
    if (!action) return { method: '?', desc: '' };
    const parts = action.split(' ');
    const method = parts[0] || '';
    const path = parts.slice(1).join(' ').replace('/api/', '');

    const methodLabels = { POST: 'Tạo', PUT: 'Cập nhật', DELETE: 'Xóa', GET: 'Xem' };
    const methodLabel = methodLabels[method] || method;

    // Pattern matching for Vietnamese descriptions
    const patterns = [
      // Auth
      [/^auth\/login$/, 'Đăng nhập'],
      [/^auth\/logout$/, 'Đăng xuất'],
      [/^auth\/change-password$/, 'Đổi mật khẩu'],
      [/^auth\/me$/, 'Xem thông tin cá nhân'],
      // Programs
      [/^programs$/, 'chương trình ĐT'],
      [/^programs\/\d+$/, 'chương trình ĐT'],
      [/^programs\/\d+\/versions$/, 'khóa CTĐT'],
      // Versions
      [/^versions\/(\d+)$/, 'khóa CTĐT'],
      [/^versions\/(\d+)\/objectives$/, 'mục tiêu PO'],
      [/^versions\/(\d+)\/plos$/, 'chuẩn đầu ra PLO'],
      [/^versions\/(\d+)\/courses$/, 'học phần trong CTĐT'],
      [/^versions\/(\d+)\/po-plo-map$/, 'ma trận PO ↔ PLO'],
      [/^versions\/(\d+)\/course-plo-map$/, 'ma trận HP ↔ PLO'],
      [/^versions\/(\d+)\/course-pi-map$/, 'ma trận HP ↔ PI'],
      [/^versions\/(\d+)\/assessments$/, 'đánh giá CĐR'],
      [/^versions\/(\d+)\/syllabi$/, 'đề cương'],
      [/^versions\/(\d+)\/assignments$/, 'phân công đề cương'],
      [/^versions\/(\d+)\/assignments\/\d+$/, 'phân công đề cương'],
      [/^versions\/(\d+)\/knowledge-blocks$/, 'khối kiến thức'],
      [/^versions\/(\d+)\/teaching-plan$/, 'kế hoạch giảng dạy'],
      [/^versions\/(\d+)\/teaching-plan\/bulk$/, 'kế hoạch giảng dạy'],
      [/^versions\/(\d+)\/course-relations$/, 'quan hệ học phần'],
      // PLOs & PIs
      [/^plos\/(\d+)$/, 'chuẩn đầu ra PLO'],
      [/^plos\/(\d+)\/pis$/, 'chỉ số PI'],
      [/^pis\/(\d+)$/, 'chỉ số PI'],
      // Objectives
      [/^objectives\/(\d+)$/, 'mục tiêu PO'],
      // Courses
      [/^courses$/, 'học phần'],
      [/^courses\/all$/, 'học phần'],
      [/^courses\/(\d+)$/, 'học phần'],
      [/^version-courses\/(\d+)$/, 'học phần trong CTĐT'],
      // Knowledge blocks
      [/^knowledge-blocks\/(\d+)$/, 'khối kiến thức'],
      [/^knowledge-blocks\/(\d+)\/assign-courses$/, 'gán HP vào khối KT'],
      // Syllabi & CLOs
      [/^syllabi\/(\d+)$/, 'đề cương'],
      [/^syllabi\/(\d+)\/clos$/, 'CLO đề cương'],
      [/^syllabi\/(\d+)\/clo-plo-map$/, 'ma trận CLO ↔ PLO'],
      [/^syllabi\/(\d+)\/import-pdf$/, 'import PDF đề cương'],
      [/^clos\/(\d+)$/, 'CLO đề cương'],
      // Assessments
      [/^assessments\/(\d+)$/, 'đánh giá CĐR'],
      // Assignments
      [/^my-assignments$/, 'đề cương được phân công'],
      [/^my-assignments\/(\d+)\/create-syllabus$/, 'đề cương (từ phân công)'],
      [/^assignments\/eligible-gv$/, 'GV đủ điều kiện phân công'],
      // Approval
      [/^approval\/submit$/, 'nộp phê duyệt'],
      [/^approval\/review$/, 'phê duyệt / từ chối'],
      [/^approval\/pending$/, 'Xem danh sách chờ duyệt'],
      [/^approval\/history\/.*$/, 'Xem lịch sử phê duyệt'],
      [/^approval\/rejected\/.*$/, 'xóa từ chối'],
      // Users & RBAC
      [/^users$/, 'tài khoản'],
      [/^users\/(\d+)$/, 'tài khoản'],
      [/^users\/(\d+)\/roles$/, 'vai trò người dùng'],
      [/^users\/\d+\/roles\/\w+\/\d+$/, 'vai trò người dùng'],
      [/^users\/(\d+)\/toggle-active$/, 'trạng thái tài khoản'],
      [/^roles$/, 'vai trò'],
      [/^roles\/(\d+)$/, 'vai trò'],
      [/^roles\/(\d+)\/permissions$/, 'phân quyền vai trò'],
      [/^permissions$/, 'quyền hạn'],
      [/^departments$/, 'đơn vị'],
      [/^departments\/(\d+)$/, 'đơn vị'],
      // Export & Import
      [/^export\/version\/(\d+)$/, 'xuất CTĐT'],
      [/^import\/parse-word$/, 'phân tích file Word'],
      [/^import\/save$/, 'lưu dữ liệu import'],
      // Dashboard & System
      [/^dashboard\/stats$/, 'Xem thống kê'],
      [/^health$/, 'Kiểm tra hệ thống'],
    ];

    for (const [regex, label] of patterns) {
      if (regex.test(path)) {
        // Special cases where label is already a complete phrase (starts with uppercase)
        if (/^[A-ZĐ]/.test(label)) {
          return { method, desc: label };
        }
        if (label === 'nộp phê duyệt' || label === 'phê duyệt / từ chối') {
          return { method, desc: label.charAt(0).toUpperCase() + label.slice(1) };
        }
        return { method, desc: `${methodLabel} ${label}` };
      }
    }

    return { method, desc: `${methodLabel} ${path}` };
  },

  async render(container) {
    this.currentOffset = 0;
    await this.loadLogs(container);
  },

  async loadLogs(container) {
    try {
      const data = await fetch(`/api/audit-logs?limit=${this.pageSize}&offset=${this.currentOffset}`).then(r => r.json());
      const totalPages = Math.ceil(data.total / this.pageSize);
      const currentPage = Math.floor(this.currentOffset / this.pageSize) + 1;

      container.innerHTML = `
        <div class="flex-between mb-6">
          <h1 class="page-title">Nhật ký hệ thống</h1>
          <span class="text-muted" style="font-size:13px;">${data.total} bản ghi</span>
        </div>
        <table class="data-table">
          <thead><tr><th style="width:150px;">Thời gian</th><th>Người dùng</th><th style="width:60px;">Loại</th><th>Thao tác</th><th>IP</th></tr></thead>
          <tbody>
            ${data.logs.length === 0 ? '<tr><td colspan="5" class="text-muted" style="text-align:center;">Chưa có nhật ký</td></tr>' : data.logs.map(l => {
              const { method, desc } = this.translateAction(l.action);
              const badgeClass = method === 'POST' ? 'success' : method === 'DELETE' ? 'danger' : 'warning';
              const methodLabel = { POST: 'Tạo', PUT: 'Sửa', DELETE: 'Xóa', GET: 'Xem' }[method] || method;
              return `<tr style="font-size:13px;">
                <td class="text-muted">${new Date(l.created_at).toLocaleString('vi-VN')}</td>
                <td style="font-weight:500;">${l.user_name || '?'}</td>
                <td><span class="badge badge-${badgeClass}">${methodLabel}</span></td>
                <td style="font-size:12px;">${desc}</td>
                <td style="color:var(--text-light);font-size:12px;">${l.ip || ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
        ${totalPages > 1 ? `
          <div class="flex-row mt-6" style="justify-content:center;gap:12px;">
            <button class="btn btn-secondary btn-sm" ${currentPage <= 1 ? 'disabled' : ''} onclick="window.AuditLogsPage.prev()">← Trước</button>
            <span class="text-muted-sm">Trang ${currentPage} / ${totalPages}</span>
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
