// Approval Page — Notion-style
window.ApprovalPage = {
  async render(container) {
    container.innerHTML = '<div class="spinner"></div>';
    try {
      const data = await fetch('/api/approval/pending').then(r => r.json());
      const statusLabels = { 
        submitted: 'Đã nộp', 
        approved_tbm: 'TBM ✓', 
        approved_khoa: 'Khoa ✓', 
        approved_pdt: 'PĐT ✓',
        published: 'Đã công bố',
        rejected: 'Đã từ chối',
        draft: 'Bản nháp'
      };

      const renderTrackingText = (item, type) => {
        if (item.is_rejected) return 'Đã từ chối';
        if (item.status === 'published') return 'Đã công bố';
        return 'Đã nộp';
      };

      // Helper to determine required permission for approval based on current status
      const getRequiredPerm = (status, type) => {
        if (type === 'program_version') {
          return {
            submitted: 'programs.approve_khoa',
            approved_khoa: 'programs.approve_pdt',
            approved_pdt: 'programs.approve_bgh'
          }[status];
        } else {
          return {
            submitted: 'syllabus.approve_tbm',
            approved_tbm: 'syllabus.approve_khoa',
            approved_khoa: 'syllabus.approve_pdt',
            approved_pdt: 'syllabus.approve_bgh'
          }[status];
        }
      };

      container.innerHTML = `
        <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.3px;margin-bottom:24px;">Phê duyệt</h1>

        <div style="margin-bottom:32px;">
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">Chương trình ĐT theo dõi phê duyệt</h3>
          ${(data.programs || []).length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Không có CTĐT nào chờ duyệt.</p>' : `
            <table class="data-table">
              <thead><tr><th>Chương trình</th><th>Năm học</th><th>Khoa</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                ${data.programs.map(p => {
                  const perm = getRequiredPerm(p.status, 'program_version');
                  const canApprove = typeof p.can_approve === 'boolean' ? p.can_approve : window.App.hasPerm(perm);
                  const displayStatus = p.display_status || p.status;
                  return `<tr>
                    <td style="font-weight:500;">${p.program_name}</td>
                    <td>${p.academic_year}</td>
                    <td style="color:var(--text-muted);">${p.dept_name || ''}</td>
                    <td><span class="badge ${p.is_rejected ? 'badge-danger' : (displayStatus === 'published' ? 'badge-success' : 'badge-info')}">${statusLabels[displayStatus] || displayStatus}</span></td>
                    <td style="white-space:nowrap;">
                      ${canApprove ? `
                        <button class="btn btn-primary btn-sm" onclick="window.ApprovalPage.approve(${p.id},'program_version')">Duyệt</button>
                        <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.ApprovalPage.showRejectModal(${p.id},'program_version')">Từ chối</button>
                      ` : `<span style="color:var(--text-muted);font-size:12px;">${renderTrackingText(p, 'program_version')}</span>`}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div style="margin-bottom:32px;">
          <h3 style="font-size:15px;font-weight:600;margin-bottom:12px;">Đề cương theo dõi phê duyệt</h3>
          ${(data.syllabi || []).length === 0 ? '<p style="color:var(--text-muted);font-size:13px;">Không có đề cương nào chờ duyệt.</p>' : `
            <table class="data-table">
              <thead><tr><th>Mã</th><th>Tên HP</th><th>Tác giả</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                ${data.syllabi.map(s => {
                  const perm = getRequiredPerm(s.status, 'syllabus');
                  const canApprove = typeof s.can_approve === 'boolean' ? s.can_approve : window.App.hasPerm(perm);
                  const displayStatus = s.display_status || s.status;
                  return `<tr>
                    <td><strong>${s.course_code || ''}</strong></td>
                    <td>${s.course_name || ''}</td>
                    <td style="color:var(--text-muted);">${s.author_name || '?'}</td>
                    <td><span class="badge ${s.is_rejected ? 'badge-danger' : (displayStatus === 'published' ? 'badge-success' : 'badge-info')}">${statusLabels[displayStatus] || displayStatus}</span></td>
                    <td style="white-space:nowrap;">
                      ${canApprove ? `
                        <button class="btn btn-primary btn-sm" onclick="window.ApprovalPage.approve(${s.id},'syllabus')">Duyệt</button>
                        <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.ApprovalPage.showRejectModal(${s.id},'syllabus')">Từ chối</button>
                      ` : `<span style="color:var(--text-muted);font-size:12px;">${renderTrackingText(s, 'syllabus')}</span>`}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          `}
        </div>

        <!-- Reject modal -->
        <div class="modal-overlay" id="reject-modal">
          <div class="modal">
            <div class="modal-header"><h2>Từ chối phê duyệt</h2></div>
            <div class="modal-body">
              <input type="hidden" id="reject-entity-id">
              <input type="hidden" id="reject-entity-type">
              <div class="input-group"><label>Lý do từ chối</label><textarea id="reject-notes" rows="3" placeholder="Nhập lý do..."></textarea></div>
              <div class="modal-footer">
                <button class="btn btn-secondary" onclick="document.getElementById('reject-modal').classList.remove('active')">Hủy</button>
                <button class="btn btn-danger" onclick="window.ApprovalPage.confirmReject()">Từ chối</button>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${e.message}</p></div>`;
    }
  },

  async approve(id, type) {
    if (!confirm('Phê duyệt?')) return;
    try {
      const res = await fetch('/api/approval/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: type, entity_id: id, action: 'approve' })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã phê duyệt');
      this.render(document.getElementById('page-content'));
    } catch (e) { window.toast.error(e.message); }
  },

  showRejectModal(id, type) {
    document.getElementById('reject-entity-id').value = id;
    document.getElementById('reject-entity-type').value = type;
    document.getElementById('reject-notes').value = '';
    document.getElementById('reject-modal').classList.add('active');
  },

  async confirmReject() {
    const id = document.getElementById('reject-entity-id').value;
    const type = document.getElementById('reject-entity-type').value;
    const notes = document.getElementById('reject-notes').value.trim();
    try {
      const res = await fetch('/api/approval/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: type, entity_id: parseInt(id), action: 'reject', notes })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      document.getElementById('reject-modal').classList.remove('active');
      window.toast.success('Đã từ chối');
      this.render(document.getElementById('page-content'));
    } catch (e) { window.toast.error(e.message); }
  },

  destroy() {}
};
