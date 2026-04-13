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

  async approve(entityId, entityType) {
    // For program_version: check for proposed courses first
    if (entityType === 'program_version') {
      try {
        const proposedRes = await fetch(`/api/versions/${entityId}/proposed-courses`);
        const proposed = await proposedRes.json();
        if (proposed.length > 0) {
          this.showAssignCodeModal(entityId, proposed);
          return;
        }
      } catch (e) { /* proceed to normal approval */ }
    }
    this._doApprove(entityId, entityType);
  },

  async _doApprove(entityId, entityType) {
    const confirmed = await window.ui.confirm({
      title: 'Xác nhận duyệt',
      message: entityType === 'program_version'
        ? 'Bạn có chắc muốn duyệt chương trình đào tạo này?'
        : 'Bạn có chắc muốn duyệt đề cương này?',
      confirmText: 'Duyệt',
      cancelText: 'Hủy'
    });
    if (!confirmed) return;
    try {
      const res = await fetch('/api/approval/review', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: entityType, entity_id: entityId, action: 'approve' })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã duyệt thành công');
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

  showAssignCodeModal(versionId, proposedCourses) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay active';
    modal.id = 'assign-code-modal';
    modal.innerHTML = `
      <div class="modal" style="max-width:700px;">
        <div class="modal-header"><h2>Gán mã học phần đề xuất</h2></div>
        <div class="modal-body">
          <p style="color:var(--warning);margin-bottom:16px;font-size:13px;">
            CTĐT này có ${proposedCourses.length} học phần đề xuất cần gán mã trước khi duyệt.
          </p>
          <div id="proposed-list">
            ${proposedCourses.map(c => `
              <div class="proposed-item" data-course-id="${c.id}" style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-md);margin-bottom:10px;">
                <div style="font-weight:600;margin-bottom:6px;">${c.name} <span style="color:var(--text-muted);font-size:12px;">(${c.credits} TC)</span></div>
                <div style="display:flex;gap:8px;align-items:end;">
                  <div class="input-group" style="flex:1;margin:0;">
                    <label>Gán mã mới</label>
                    <input type="text" class="assign-code-input" data-cid="${c.id}" placeholder="Nhập mã HP" maxlength="20">
                  </div>
                  <span style="color:var(--text-muted);font-size:12px;padding-bottom:8px;">hoặc</span>
                  <div class="input-group" style="flex:1;margin:0;">
                    <label>Gộp vào HP đã có</label>
                    <select class="merge-target-select" data-cid="${c.id}">
                      <option value="">— Chọn HP —</option>
                    </select>
                  </div>
                  <button class="btn btn-primary btn-sm assign-code-btn" data-cid="${c.id}" style="white-space:nowrap;" disabled>Xác nhận</button>
                </div>
                <div class="assign-status" data-cid="${c.id}" style="margin-top:4px;font-size:12px;"></div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" onclick="document.getElementById('assign-code-modal').remove()">Đóng</button>
          <button class="btn btn-primary" id="approve-after-assign" disabled onclick="window.ApprovalPage.approveAfterAssign(${versionId})">Duyệt CTĐT</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Load catalog courses into merge dropdowns
    fetch('/api/courses/all').then(r => r.json()).then(courses => {
      modal.querySelectorAll('.merge-target-select').forEach(sel => {
        courses.forEach(c => {
          sel.innerHTML += `<option value="${c.id}">${c.code} — ${c.name}</option>`;
        });
      });
    });

    // Enable confirm buttons when input is provided
    modal.querySelectorAll('.assign-code-input').forEach(input => {
      input.addEventListener('input', () => {
        const cid = input.dataset.cid;
        const btn = modal.querySelector(`.assign-code-btn[data-cid="${cid}"]`);
        const sel = modal.querySelector(`.merge-target-select[data-cid="${cid}"]`);
        btn.disabled = !(input.value.trim() || sel.value);
        if (input.value.trim()) sel.value = '';
      });
    });
    modal.querySelectorAll('.merge-target-select').forEach(sel => {
      sel.addEventListener('change', () => {
        const cid = sel.dataset.cid;
        const btn = modal.querySelector(`.assign-code-btn[data-cid="${cid}"]`);
        const input = modal.querySelector(`.assign-code-input[data-cid="${cid}"]`);
        btn.disabled = !(sel.value || input.value.trim());
        if (sel.value) input.value = '';
      });
    });

    // Handle confirm for individual course
    modal.querySelectorAll('.assign-code-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const cid = btn.dataset.cid;
        const input = modal.querySelector(`.assign-code-input[data-cid="${cid}"]`);
        const sel = modal.querySelector(`.merge-target-select[data-cid="${cid}"]`);
        const statusDiv = modal.querySelector(`.assign-status[data-cid="${cid}"]`);
        const item = modal.querySelector(`.proposed-item[data-course-id="${cid}"]`);

        try {
          if (input.value.trim()) {
            const res = await fetch(`/api/proposed-courses/${cid}/assign-code`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: input.value.trim() })
            });
            if (!res.ok) throw new Error((await res.json()).error);
            statusDiv.innerHTML = `<span style="color:var(--success);">✓ Đã gán mã: ${input.value.trim()}</span>`;
          } else if (sel.value) {
            const res = await fetch(`/api/proposed-courses/${cid}/merge`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ target_course_id: parseInt(sel.value) })
            });
            if (!res.ok) throw new Error((await res.json()).error);
            statusDiv.innerHTML = `<span style="color:var(--success);">✓ Đã gộp</span>`;
          }
          item.style.opacity = '0.5';
          btn.disabled = true;
          input.disabled = true;
          sel.disabled = true;

          // Check if all done
          const remaining = modal.querySelectorAll('.proposed-item:not([style*="opacity"])');
          if (remaining.length === 0) {
            document.getElementById('approve-after-assign').disabled = false;
          }
        } catch (e) {
          statusDiv.innerHTML = `<span style="color:var(--danger);">${e.message}</span>`;
        }
      });
    });
  },

  async approveAfterAssign(versionId) {
    document.getElementById('assign-code-modal')?.remove();
    this._doApprove(versionId, 'program_version');
  },

  destroy() {}
};
