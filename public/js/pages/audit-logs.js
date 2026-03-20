// Audit Logs Page — Notion-style
window.AuditLogsPage = {
  currentOffset: 0,
  pageSize: 30,

  async render(container) {
    this.currentOffset = 0;
    await this.loadLogs(container);
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
              return `<tr style="font-size:13px;">
                <td style="color:var(--text-muted);">${new Date(l.created_at).toLocaleString('vi-VN')}</td>
                <td style="font-weight:500;">${l.user_name || '?'}</td>
                <td><span class="badge badge-${method === 'POST' ? 'success' : method === 'DELETE' ? 'danger' : 'warning'}">${methodLabels[method] || method}</span></td>
                <td style="font-family:monospace;font-size:12px;color:var(--text-muted);">${target}</td>
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
