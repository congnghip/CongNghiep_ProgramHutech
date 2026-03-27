/**
 * SyllabusDetailsSection Component
 * Shared component for Sections 11, 12, 13 (Summary, Objectives, Prerequisites, Methods, Schedule)
 */
window.SyllabusDetailsSection = {
  container: null,
  data: null,
  editable: false,

  /**
   * Initialize and render the component
   * @param {HTMLElement} container - The container to render into
   * @param {Object} data - Syllabus data object
   * @param {boolean} editable - Whether the fields are editable
   */
  init(container, data, editable = false) {
    this.container = container;
    this.data = data || {};
    this.editable = editable;
    this.render();
  },

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * Render the component UI
   */
  render() {
    if (!this.container) return;
    const c = this.data;
    const editable = this.editable;

    // Standardize schedule rows (ensure at least 1 row if empty and editable)
    const rows = this.getScheduleRows(c);

    this.container.innerHTML = `
      <div style="display:grid;gap:24px;">
        <!-- Section 11 & 12: Descriptions -->
        <div class="card" style="margin-bottom:0;">
          <div class="card-header" style="padding-bottom:12px;border-bottom:1px solid var(--divider);margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="badge badge-neutral" style="font-weight:700;">11-12</span>
              <h3 class="card-title">Mô tả, mục tiêu và phương pháp dạy học</h3>
            </div>
          </div>
          
          <div class="card-body" style="display:grid;grid-template-columns:1fr;gap:20px;">
            <div class="input-group" style="margin-bottom:0;">
              <label>Mô tả tóm tắt nội dung học phần</label>
              <textarea id="syl-shared-summary" ${editable ? '' : 'disabled'} rows="5" placeholder="Mô tả tóm tắt HP">${this.escapeHtml(c.summary || c.course_description)}</textarea>
            </div>
            <div class="input-group" style="margin-bottom:0;">
              <label>Mục tiêu của học phần</label>
              <textarea id="syl-shared-objectives" ${editable ? '' : 'disabled'} rows="5" placeholder="Các mục tiêu sau khi hoàn thành học phần">${this.escapeHtml(c.objectives || c.course_objectives)}</textarea>
            </div>
            <div class="input-group" style="margin-bottom:0;">
              <label>Điều kiện tiên quyết / Học phần học trước</label>
              <textarea id="syl-shared-prereq" ${editable ? '' : 'disabled'} rows="3" placeholder="Nhập học phần tiên quyết">${this.escapeHtml(c.prerequisites)}</textarea>
            </div>
            <div class="input-group" style="margin-bottom:0;">
              <label>Phương pháp, hình thức tổ chức dạy học</label>
              <textarea id="syl-shared-methods" ${editable ? '' : 'disabled'} rows="4" placeholder="Giảng dạy tích cực, thảo luận, bài tập, tự nghiên cứu...">${this.escapeHtml(c.methods || c.learning_methods)}</textarea>
            </div>
          </div>
        </div>

        <!-- Section 13: Schedule -->
        <div class="card" style="margin-bottom:0;">
          <div class="card-header" style="padding-bottom:12px;border-bottom:1px solid var(--divider);margin-bottom:20px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span class="badge badge-neutral" style="font-weight:700;">13</span>
              <h3 class="card-title">Nội dung chi tiết học phần</h3>
            </div>
            ${editable ? `
              <button class="btn btn-secondary btn-sm" id="syl-shared-add-row-btn">+ Thêm dòng</button>
            ` : ''}
          </div>

          <div class="card-body">
            <div style="overflow-x:auto;border:1px solid var(--border);border-radius:var(--radius);background:var(--bg-secondary);">
              <table class="data-table" id="syl-shared-schedule-table" style="min-width:1200px;background:var(--bg);">
                <thead>
                  <tr style="background:var(--bg-secondary);">
                    <th style="width:60px;text-align:center;">Tuần</th>
                    <th style="width:200px;">Tên bài / chủ đề</th>
                    <th style="min-width:200px;">Nội dung chi tiết</th>
                    <th style="width:60px;text-align:center;">LT</th>
                    <th style="width:60px;text-align:center;">TH</th>
                    <th style="width:200px;">Phương pháp dạy học</th>
                    <th style="width:200px;">Tài liệu / nhiệm vụ SV</th>
                    <th style="width:120px;">CLO</th>
                    ${editable ? '<th style="width:40px;"></th>' : ''}
                  </tr>
                </thead>
                <tbody>
                  ${rows.map(row => this.renderRowHtml(row, editable)).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    `;

    // Inject styles if not already present
    this.injectStyles();

    if (editable) {
      document.getElementById('syl-shared-add-row-btn')?.addEventListener('click', () => this.addScheduleRow());
      this.container.querySelectorAll('[data-action="remove-row"]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (confirm('Xóa dòng này?')) btn.closest('tr').remove();
        });
      });
    }
  },

  /**
   * Get formatted schedule rows from data
   */
  getScheduleRows(c) {
    if (!c) return this.editable ? [{ week: 1, topic: '', content: '', theory_hours: '', practice_hours: '', teaching_method: '', materials: '', clos: '' }] : [];
    
    const schedule = Array.isArray(c.schedule) ? c.schedule : [];
    if (schedule.length) {
      return schedule.map((row, index) => {
        if (!row) return { week: index + 1, topic: '', content: '', theory_hours: '', practice_hours: '', teaching_method: '', materials: '', clos: '' };
        return {
          week: row.week || index + 1,
          topic: row.topic || '',
          content: row.content || row.activities || '',
          theory_hours: row.theory_hours ?? '',
          practice_hours: row.practice_hours ?? '',
          teaching_method: row.teaching_method || row.activities || '',
          materials: row.materials || '',
          clos: row.clos || ''
        };
      });
    }
    return this.editable ? [{ week: 1, topic: '', content: '', theory_hours: '', practice_hours: '', teaching_method: '', materials: '', clos: '' }] : [];
  },

  /**
   * Render HTML for a single schedule row
   */
  renderRowHtml(row, editable) {
    return `
      <tr class="syl-row">
        <td><input type="number" data-field="week" value="${this.escapeHtml(String(row.week || ''))}" ${editable ? '' : 'disabled'} class="syl-input syl-input-center"></td>
        <td><input type="text" data-field="topic" value="${this.escapeHtml(row.topic)}" ${editable ? '' : 'disabled'} class="syl-input" placeholder="Tên bài học..."></td>
        <td><textarea data-field="content" ${editable ? '' : 'disabled'} rows="2" class="syl-textarea">${this.escapeHtml(row.content)}</textarea></td>
        <td><input type="number" data-field="theory_hours" value="${this.escapeHtml(String(row.theory_hours ?? ''))}" ${editable ? '' : 'disabled'} class="syl-input syl-input-center"></td>
        <td><input type="number" data-field="practice_hours" value="${this.escapeHtml(String(row.practice_hours ?? ''))}" ${editable ? '' : 'disabled'} class="syl-input syl-input-center"></td>
        <td><textarea data-field="teaching_method" ${editable ? '' : 'disabled'} rows="2" class="syl-textarea">${this.escapeHtml(row.teaching_method)}</textarea></td>
        <td><textarea data-field="materials" ${editable ? '' : 'disabled'} rows="2" class="syl-textarea">${this.escapeHtml(row.materials)}</textarea></td>
        <td><input type="text" data-field="clos" value="${this.escapeHtml(row.clos)}" ${editable ? '' : 'disabled'} class="syl-input" placeholder="CLO1, CLO2"></td>
        ${editable ? `
          <td style="text-align:center;">
            <button class="btn-remove-row" data-action="remove-row" title="Xóa dòng">✕</button>
          </td>
        ` : ''}
      </tr>
    `;
  },

  /**
   * Add a new row to the schedule table
   */
  addScheduleRow() {
    const tbody = this.container.querySelector('#syl-shared-schedule-table tbody');
    if (!tbody) return;
    const nextIndex = tbody.querySelectorAll('tr').length + 1;
    const rowHtml = this.renderRowHtml({ week: nextIndex }, true);
    tbody.insertAdjacentHTML('beforeend', rowHtml);
    
    const lastRow = tbody.lastElementChild;
    lastRow.querySelector('[data-action="remove-row"]')?.addEventListener('click', () => {
      if (confirm('Xóa dòng này?')) lastRow.remove();
    });
  },

  /**
   * Inject specific styles for the component
   */
  injectStyles() {
    if (document.getElementById('syl-shared-styles')) return;
    const style = document.createElement('style');
    style.id = 'syl-shared-styles';
    style.innerHTML = `
      .syl-input {
        width: 100%;
        padding: 4px 6px;
        border: 1px solid transparent;
        border-radius: 4px;
        font-size: 13px;
        font-family: inherit;
        background: transparent;
      }
      .syl-input:hover:not(:disabled) { background: var(--bg-secondary); border-color: var(--border); }
      .syl-input:focus { outline: none; border-color: var(--primary); background: #fff; box-shadow: 0 0 0 2px rgba(35,131,226,0.1); }
      .syl-input-center { text-align: center; }
      
      .syl-textarea {
        width: 100%;
        padding: 4px 6px;
        border: 1px solid transparent;
        border-radius: 4px;
        font-size: 13px;
        font-family: inherit;
        background: transparent;
        resize: vertical;
        min-height: 38px;
        display: block;
      }
      .syl-textarea:hover:not(:disabled) { background: var(--bg-secondary); border-color: var(--border); }
      .syl-textarea:focus { outline: none; border-color: var(--primary); background: #fff; box-shadow: 0 0 0 2px rgba(35,131,226,0.1); }
      
      .btn-remove-row {
        background: none;
        border: none;
        color: var(--text-light);
        cursor: pointer;
        font-size: 14px;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.1s;
      }
      .btn-remove-row:hover { color: var(--danger); background: var(--danger-bg); }
      
      .data-table td { padding: 4px 6px !important; }
    `;
    document.head.appendChild(style);
  },

  /**
   * Capture data from the UI and return a standardized object
   */
  capture() {
    if (!this.container) return null;
    
    const getElValue = (id) => {
      const el = document.getElementById(id);
      return el ? el.value.trim() : '';
    };

    const scheduleRows = Array.from(this.container.querySelectorAll('#syl-shared-schedule-table tbody tr')).map(row => {
      const getVal = (selector) => {
        const el = row.querySelector(selector);
        return el ? el.value : '';
      };
      
      return {
        week: parseInt(getVal('[data-field="week"]'), 10) || 0,
        topic: getVal('[data-field="topic"]').trim(),
        content: getVal('[data-field="content"]').trim(),
        theory_hours: parseInt(getVal('[data-field="theory_hours"]'), 10) || 0,
        practice_hours: parseInt(getVal('[data-field="practice_hours"]'), 10) || 0,
        teaching_method: getVal('[data-field="teaching_method"]').trim(),
        materials: getVal('[data-field="materials"]').trim(),
        clos: getVal('[data-field="clos"]').trim()
      };
    }).filter(item => item.week || item.topic || item.content);

    return {
      summary: getElValue('syl-shared-summary'),
      objectives: getElValue('syl-shared-objectives'),
      prerequisites: getElValue('syl-shared-prereq'),
      methods: getElValue('syl-shared-methods'),
      schedule: scheduleRows
    };
  }
};
