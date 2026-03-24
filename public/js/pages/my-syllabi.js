// My Syllabi Page — Personal assignments for lecturers
window.MySyllabiPage = {
  syllabi: [],

  async render(container) {
    container.innerHTML = `
      <div style="margin-bottom:24px;">
        <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.3px;">Đề cương của tôi</h1>
        <p style="color:var(--text-muted);margin-top:4px;">Danh sách các đề cương học phần bạn được phân công soạn thảo.</p>
      </div>

      <div class="card">
        <div class="table-responsive" style="padding:0 20px 20px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Mã HP</th>
                <th>Tên học phần</th>
                <th>Năm học</th>
                <th>Ngành / Khoa</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody id="my-syllabi-tbody">
              <tr><td colspan="6" class="text-center"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    await this.loadData();
  },

  async loadData() {
    try {
      const res = await fetch('/api/my-syllabi');
      this.syllabi = await res.json();
      this.renderTable();
    } catch (e) {
      document.getElementById('my-syllabi-tbody').innerHTML = `<tr><td colspan="6" style="color:var(--danger);">Lỗi: ${e.message}</td></tr>`;
    }
  },

  renderTable() {
    const tbody = document.getElementById('my-syllabi-tbody');
    const statusLabels = { draft: 'Nháp', submitted: 'Đã nộp', approved_tbm: 'TBM ✓', approved_khoa: 'Khoa ✓', approved_pdt: 'PĐT ✓', published: 'Công bố' };
    
    if (this.syllabi.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center" style="color:var(--text-muted);padding:40px;">Bạn chưa được phân công đề cương nào.</td></tr>';
      return;
    }

    tbody.innerHTML = this.syllabi.map(s => `
      <tr>
        <td><strong>${s.course_code}</strong></td>
        <td>${s.course_name}</td>
        <td>${s.academic_year}</td>
        <td style="font-size:12px;color:var(--text-muted);">${s.program_name} <br/> <small>${s.dept_name || ''}</small></td>
        <td><span class="badge badge-info">${statusLabels[s.status] || s.status}</span></td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="window.App.navigate('syllabus-editor', { syllabusId: ${s.id} })">
            ${s.status === 'draft' ? 'Soạn thảo' : 'Xem chi tiết'}
          </button>
        </td>
      </tr>
    `).join('');
  },

  destroy() {}
};
