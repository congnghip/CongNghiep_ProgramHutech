// My Syllabus Assignments Page (Đề cương của tôi)
window.MyAssignmentsPage = {
  assignments: [],

  async render(container) {
    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <div class="card-title">Đề cương được phân công</div>
        </div>
        <div style="padding:0 20px 20px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mã HP</th>
                <th>Tên học phần</th>
                <th>TC</th>
                <th>CTĐT</th>
                <th>Khoa/Ngành</th>
                <th>Người phân công</th>
                <th>Hạn nộp</th>
                <th>Còn lại</th>
                <th>Trạng thái</th>
                <th></th>
              </tr>
            </thead>
            <tbody id="my-assignments-tbody">
              <tr><td colspan="10"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    await this.loadData();
  },

  async loadData() {
    try {
      const res = await fetch('/api/my-assignments');
      if (!res.ok) throw new Error('Lỗi tải dữ liệu');
      this.assignments = await res.json();
      this.renderTable();
    } catch (e) {
      document.getElementById('my-assignments-tbody').innerHTML =
        `<tr><td colspan="10" style="color:var(--danger);text-align:center;">${e.message}</td></tr>`;
    }
  },

  renderTable() {
    const tbody = document.getElementById('my-assignments-tbody');
    const statusLabels = {
      draft: 'Nháp', submitted: 'Đã nộp', approved_tbm: 'TBM ✓',
      approved_khoa: 'Khoa ✓', approved_pdt: 'PĐT ✓', published: 'Công bố'
    };

    if (!this.assignments.length) {
      tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--text-muted);">Chưa có phân công nào.</td></tr>';
      return;
    }

    tbody.innerHTML = this.assignments.map(a => {
      const sylStatus = a.syllabus_status ? statusLabels[a.syllabus_status] || a.syllabus_status : 'Chưa tạo';
      const statusClass = a.syllabus_status
        ? (a.syllabus_status === 'published' ? 'badge-success' : 'badge-info')
        : 'badge-neutral';

      // Deadline calculation
      let daysLeft = '';
      let daysClass = '';
      if (a.deadline) {
        const dl = new Date(a.deadline);
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        dl.setHours(0, 0, 0, 0);
        const diff = Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
        if (diff < 0) {
          daysLeft = `Quá ${Math.abs(diff)} ngày`;
          daysClass = 'color:var(--danger);font-weight:600;';
        } else if (diff <= 3) {
          daysLeft = `${diff} ngày`;
          daysClass = 'color:var(--warning);font-weight:600;';
        } else {
          daysLeft = `${diff} ngày`;
        }
      }

      const deadlineStr = a.deadline ? new Date(a.deadline).toLocaleDateString('vi-VN') : '—';
      const ctdt = `${a.program_code || a.program_name} (${a.academic_year})`;

      // Action button
      let actionBtn = '';
      if (!a.syllabus_id) {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="window.MyAssignmentsPage.createAndOpen(${a.assignment_id})">Tạo ĐC</button>`;
      } else if (a.syllabus_status === 'draft') {
        actionBtn = `<button class="btn btn-primary btn-sm" onclick="window.App.navigate('syllabus-editor',{syllabusId:${a.syllabus_id}})">Soạn</button>`;
      } else {
        actionBtn = `<button class="btn btn-secondary btn-sm" onclick="window.App.navigate('syllabus-editor',{syllabusId:${a.syllabus_id}})">Xem</button>`;
      }

      return `<tr>
        <td><strong>${a.course_code}</strong></td>
        <td>${a.course_name}</td>
        <td style="text-align:center;">${a.credits}</td>
        <td style="font-size:12px;">${ctdt}</td>
        <td style="font-size:12px;color:var(--text-muted);">${a.dept_name}</td>
        <td style="font-size:12px;">${a.assigned_by_name}</td>
        <td style="font-size:12px;">${deadlineStr}</td>
        <td style="font-size:12px;${daysClass}">${daysLeft}</td>
        <td><span class="badge ${statusClass}">${sylStatus}</span></td>
        <td style="white-space:nowrap;">${actionBtn}</td>
      </tr>`;
    }).join('');
  },

  async createAndOpen(assignmentId) {
    try {
      const res = await fetch(`/api/my-assignments/${assignmentId}/create-syllabus`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        // If syllabus already exists, navigate to it
        if (data.syllabus_id) {
          window.App.navigate('syllabus-editor', { syllabusId: data.syllabus_id });
          return;
        }
        throw new Error(data.error);
      }
      window.toast.success('Đã tạo đề cương');
      window.App.navigate('syllabus-editor', { syllabusId: data.id });
    } catch (e) { window.toast.error(e.message); }
  }
};
