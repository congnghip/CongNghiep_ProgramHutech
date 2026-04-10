// Approval Page — Notion-style
window.ApprovalPage = {
  async render(container) {
    container.innerHTML = '<div class="spinner"></div>';
    try {
      const data = await fetch('/api/approval/pending').then(r => r.json());
      const statusLabels = {
        draft: 'Nháp',
        submitted: 'Đã nộp',
        approved_tbm: 'TBM ✓',
        approved_khoa: 'Khoa ✓',
        approved_pdt: 'PĐT ✓'
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

      // Check if user has ANY approval permission for an entity type
      const hasAnyApproval = (type) => {
        const perms = type === 'program_version'
          ? ['programs.approve_khoa', 'programs.approve_pdt', 'programs.approve_bgh']
          : ['syllabus.approve_tbm', 'syllabus.approve_khoa', 'syllabus.approve_pdt', 'syllabus.approve_bgh'];
        return perms.some(p => window.App.hasPerm(p));
      };

      container.innerHTML = `
        <h1 class="page-title mb-6">Phê duyệt</h1>

        <div class="mb-8">
          <h3 class="section-title mb-3">Chương trình ĐT</h3>
          ${(data.programs || []).length === 0 ? '<p class="text-muted" style="font-size:13px;">Không có CTĐT nào.</p>' : `
            <table class="data-table">
              <thead><tr><th>Chương trình</th><th>Năm học</th><th>Khoa</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                ${data.programs.map(p => {
                  const perm = getRequiredPerm(p.status, 'program_version');
                  const canApprove = perm && window.App.hasPerm(perm);
                  return `<tr style="cursor:pointer;" onclick="window.App.navigate('version-editor',{versionId:${p.id}})">
                    <td style="font-weight:500;color:var(--primary);">${p.program_name}</td>
                    <td>${p.academic_year}</td>
                    <td class="text-muted">${p.dept_name || ''}</td>
                    <td><span class="badge ${p.is_rejected ? 'badge-danger' : (p.status === 'published' ? 'badge-success' : 'badge-info')}">${p.is_rejected ? 'Bị từ chối' : (statusLabels[p.status] || p.status)}</span>
                      ${p.is_rejected && p.rejection_reason ? `<div class="text-muted mt-2" style="font-size:11px;">${p.rejection_reason}</div>` : ''}
                    </td>
                    <td style="white-space:nowrap;" onclick="event.stopPropagation()">
                      ${p.is_rejected ? `
                        ${hasAnyApproval('program_version') ? `<button class="btn btn-danger btn-sm" onclick="window.ApprovalPage.deleteRejected(${p.id},'program_version')">Xóa</button>` : '<span style="color:var(--danger);font-size:12px;">Đã bị từ chối</span>'}
                      ` : canApprove ? `
                        <button class="btn btn-primary btn-sm" onclick="window.ApprovalPage.approve(${p.id},'program_version')">Duyệt</button>
                        <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.ApprovalPage.showRejectModal(${p.id},'program_version')">Từ chối</button>
                      ` : '<span style="color:var(--text-muted);font-size:12px;">Chờ phê duyệt</span>'}
                    </td>
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          `}
        </div>

        <div class="mb-8">
          <h3 class="section-title mb-3">Đề cương</h3>
          ${(data.syllabi || []).length === 0 ? '<p class="text-muted" style="font-size:13px;">Không có đề cương nào.</p>' : `
            <table class="data-table">
              <thead><tr><th>Mã</th><th>Tên HP</th><th>CTĐT</th><th>Tác giả</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                ${data.syllabi.map(s => {
                  const perm = getRequiredPerm(s.status, 'syllabus');
                  const canApprove = perm && window.App.hasPerm(perm);
                  return `<tr style="cursor:pointer;" onclick="window.App.navigate('syllabus-editor',{syllabusId:${s.id}})">
                    <td><strong>${s.course_code || ''}</strong></td>
                    <td style="color:var(--primary);">${s.course_name || ''}</td>
                    <td style="font-size:12px;color:var(--text-muted);">${s.program_name || ''}${s.academic_year ? ` (${s.academic_year})` : ''}</td>
                    <td class="text-muted">${s.author_name || '?'}</td>
                    <td><span class="badge ${s.is_rejected ? 'badge-danger' : 'badge-info'}">${s.is_rejected ? 'Bị từ chối' : (statusLabels[s.status] || s.status)}</span>
                      ${s.is_rejected && s.rejection_reason ? `<div class="text-muted mt-2" style="font-size:11px;">${s.rejection_reason}</div>` : ''}
                    </td>
                    <td style="white-space:nowrap;" onclick="event.stopPropagation()">
                      ${s.is_rejected ? `
                        ${hasAnyApproval('syllabus') ? `<button class="btn btn-danger btn-sm" onclick="window.ApprovalPage.deleteRejected(${s.id},'syllabus')">Xóa</button>` : '<span style="color:var(--danger);font-size:12px;">Đã bị từ chối</span>'}
                      ` : canApprove ? `
                        <button class="btn btn-primary btn-sm" onclick="window.ApprovalPage.approve(${s.id},'syllabus')">Duyệt</button>
                        <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.ApprovalPage.showRejectModal(${s.id},'syllabus')">Từ chối</button>
                      ` : '<span style="color:var(--text-muted);font-size:12px;">Chờ phê duyệt</span>'}
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
    const confirmed = await window.ui.confirm({
      title: 'Phê duyệt hồ sơ',
      eyebrow: 'Xác nhận thao tác',
      message: 'Bạn có chắc muốn phê duyệt mục này?',
      confirmText: 'Phê duyệt',
      cancelText: 'Hủy'
    });
    if (!confirmed) return;
    try {
      const res = await fetch('/api/approval/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: type, entity_id: id, action: 'approve' })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã phê duyệt');
      if (window.App.refreshNotificationCount) window.App.refreshNotificationCount();
      this.render(document.getElementById('page-content'));
    } catch (e) { window.toast.error(e.message); }
  },

  showRejectModal(id, type) {
    document.getElementById('reject-entity-id').value = id;
    document.getElementById('reject-entity-type').value = type;
    document.getElementById('reject-notes').value = '';
    document.getElementById('reject-modal').classList.add('active');
    App.modalGuard('reject-modal', () => ApprovalPage.confirmReject());
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
      if (window.App.refreshNotificationCount) window.App.refreshNotificationCount();
      this.render(document.getElementById('page-content'));
    } catch (e) { window.toast.error(e.message); }
  },

  async deleteRejected(id, type) {
    const confirmed = await window.ui.confirm({
      title: 'Xóa mục bị từ chối',
      eyebrow: 'Xác nhận xóa',
      message: 'Xóa vĩnh viễn mục này? Hành động không thể hoàn tác.',
      confirmText: 'Xóa',
      cancelText: 'Hủy'
    });
    if (!confirmed) return;
    try {
      const res = await fetch(`/api/approval/rejected/${type}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã xóa');
      this.render(document.getElementById('page-content'));
    } catch (e) { window.toast.error(e.message); }
  },

  destroy() {}
};
