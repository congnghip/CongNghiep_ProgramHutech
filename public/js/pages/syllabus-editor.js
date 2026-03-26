window.SyllabusEditorPage = {
  syllabusId: null,
  syllabus: null,
  routeContext: {},
  clos: [],
  plos: [],
  activeTab: 0,

  escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  normalizeImportMetadata(raw = {}) {
    const metadata = raw && typeof raw === 'object' ? raw : {};
    const legacyMode = `${metadata.mode || ''}`.toLowerCase();
    const engine = `${metadata.engine || metadata.processing_engine || legacyMode || metadata.provider || ''}`.toLowerCase();
    const isMock = engine === 'mock' || engine === 'heuristic' || metadata.ai_model === 'mock-local';
    return {
      engine: isMock ? 'mock' : (engine || 'groq'),
      provider: `${metadata.provider || (isMock ? 'heuristic' : 'groq')}`.toLowerCase(),
      model: metadata.model || metadata.ai_model || (isMock ? 'mock-local' : ''),
      prompt_version: metadata.prompt_version || ''
    };
  },

  getImportSourceLabel(raw = {}) {
    const metadata = this.normalizeImportMetadata(raw);
    if (metadata.engine === 'mock') return 'PDF heuristic fallback';
    return `PDF + ${String(metadata.provider || 'groq').toUpperCase()}`;
  },

  hasOwn(obj, key) {
    return Object.prototype.hasOwnProperty.call(obj || {}, key);
  },

  buildEmptyContent() {
    const current = this.getContent();
    return {
      ...current,
      course_name_vi: '',
      course_name_en: '',
      course_code: '',
      credits: 0,
      language_instruction: 'vi',
      knowledge_block: '',
      course_category: '',
      course_level: 'Đại học',
      managing_unit: '',
      summary: '',
      objectives: '',
      prerequisites: '',
      methods: '',
      self_study_guidance: '',
      course_requirements: '',
      notes: '',
      schedule: [],
      grading: [],
      textbooks: '',
      references: '',
      tools: '',
      import_metadata: {}
    };
  },

  async render(container, syllabusId, params = {}) {
    this.syllabusId = syllabusId;
    this.routeContext = params || {};
    container.innerHTML = '<div class="spinner"></div>';

    try {
      this.syllabus = await fetch(`/api/syllabi/${syllabusId}`).then(r => r.json());
      if (this.syllabus.error) throw new Error(this.syllabus.error);
      const content = typeof this.syllabus.content === 'string'
        ? JSON.parse(this.syllabus.content)
        : (this.syllabus.content || {});
      this.syllabus.content = content;
    } catch (e) {
      container.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p>${this.escapeHtml(e.message)}</p></div>`;
      return;
    }

    const statusLabels = {
      draft: 'Nháp',
      submitted: 'Đã nộp',
      approved_tbm: 'TBM ✓',
      approved_khoa: 'Khoa ✓',
      approved_pdt: 'PĐT ✓',
      published: 'Công bố'
    };
    const editable = this.syllabus.status === 'draft';
    const content = this.getContent();
    const authorLabel = this.syllabus.author_name || this.syllabus.authors?.map(item => item.display_name).join(', ') || '?';
    const hasImportMetadata = content.import_metadata && Object.keys(content.import_metadata).length > 0;
    const importMetadata = this.normalizeImportMetadata(content.import_metadata);

    container.innerHTML = `
      <div style="margin-bottom:28px;">
        <div id="syllabus-breadcrumb" style="margin-bottom:8px;"></div>
        <div style="padding:22px 24px;border:1px solid var(--border);border-radius:18px;background:#fff;margin-bottom:18px;">
          <div style="text-align:center;border-bottom:1px solid var(--border);padding-bottom:14px;margin-bottom:18px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Trường Đại học Công nghệ TP. HCM · Khoa Công nghệ thông tin</div>
            <div style="font-size:24px;font-weight:800;letter-spacing:-0.4px;">ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:6px;">Mẫu cấu trúc tham chiếu theo đề cương chuẩn BM03/QT2b/ĐBCL</div>
          </div>
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;">
          <div>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
              <span style="display:inline-flex;align-items:center;padding:4px 10px;border-radius:999px;background:#f3f4f6;color:#111827;font-size:12px;font-weight:700;">
                BM03/QT2b/ĐBCL
              </span>
              <span class="badge badge-info">${statusLabels[this.syllabus.status] || this.syllabus.status}</span>
              ${hasImportMetadata ? `<span style="display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:#f3f4f6;color:#374151;font-size:12px;font-weight:600;">Nguồn: ${this.escapeHtml(this.getImportSourceLabel(content.import_metadata))}</span>` : ''}
              ${hasImportMetadata && importMetadata.model ? `<span style="display:inline-flex;align-items:center;padding:5px 10px;border-radius:999px;background:#eef6ff;color:#1d4ed8;font-size:12px;font-weight:600;">Model: ${this.escapeHtml(importMetadata.model)}</span>` : ''}
            </div>
            <h1 style="font-size:30px;line-height:1.18;font-weight:800;letter-spacing:-0.5px;margin:0 0 8px 0;">${this.escapeHtml(content.course_name_vi || this.syllabus.course_name)}</h1>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--text-muted);font-size:13px;">
              <span><strong style="color:var(--text-primary);">${this.escapeHtml(content.course_code || this.syllabus.course_code || '---')}</strong></span>
              <span>${this.escapeHtml(String(content.credits || this.syllabus.credits || 0))} TC</span>
              <span>${this.escapeHtml(content.course_level || 'Đại học')}</span>
              <span>${this.escapeHtml(authorLabel)}</span>
            </div>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            ${editable && this.routeContext.versionId ? `<button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.openPdfImport()">Import PDF</button>` : ''}
            ${editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.submitForApproval()">Nộp duyệt</button>' : ''}
          </div>
        </div>
        </div>
      </div>


      <div class="tab-bar" id="syl-tabs">
        <div class="tab-item active" data-tab="0">Mục 1-8</div>
        <div class="tab-item" data-tab="1">Mục 9-10</div>
        <div class="tab-item" data-tab="2">Mục 11-13</div>
        <div class="tab-item" data-tab="3">Mục 14</div>
        <div class="tab-item" data-tab="4">Mục 15-17</div>
      </div>
      <div id="syl-tab-content"><div class="spinner"></div></div>
    `;

    document.querySelectorAll('#syl-tabs .tab-item').forEach(el => {
      el.addEventListener('click', () => {
        document.querySelectorAll('#syl-tabs .tab-item').forEach(node => node.classList.remove('active'));
        el.classList.add('active');
        this.activeTab = parseInt(el.dataset.tab, 10);
        this.renderSylTab();
      });
    });

    this.updateBreadcrumb();
    this.renderSylTab();
  },

  renderMetaCard(label, value) {
    return `
      <div style="padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:#fff;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:5px;">${this.escapeHtml(label)}</div>
        <div style="font-size:14px;font-weight:600;color:var(--text-primary);line-height:1.45;">${this.escapeHtml(value)}</div>
      </div>
    `;
  },

  renderFieldStateHint(value) {
    const normalized = String(value ?? '').trim();
    return normalized ? '' : '<div style="margin-top:6px;font-size:12px;color:var(--text-muted);">Trống</div>';
  },

  getContent() {
    const c = this.syllabus?.content || {};
    return {
      ...c,
      course_name_vi: this.hasOwn(c, 'course_name_vi') ? c.course_name_vi : (this.syllabus?.course_name || ''),
      course_name_en: this.hasOwn(c, 'course_name_en') ? c.course_name_en : '',
      course_code: this.hasOwn(c, 'course_code') ? c.course_code : (this.syllabus?.course_code || ''),
      credits: this.hasOwn(c, 'credits') ? c.credits : (this.syllabus?.credits || 0),
      language_instruction: this.hasOwn(c, 'language_instruction') ? c.language_instruction : 'vi',
      knowledge_block: this.hasOwn(c, 'knowledge_block') ? c.knowledge_block : '',
      course_category: this.hasOwn(c, 'course_category') ? c.course_category : '',
      course_level: this.hasOwn(c, 'course_level') ? c.course_level : 'Đại học',
      managing_unit: this.hasOwn(c, 'managing_unit') ? c.managing_unit : '',
      summary: this.hasOwn(c, 'summary') ? c.summary : '',
      objectives: this.hasOwn(c, 'objectives') ? c.objectives : '',
      prerequisites: this.hasOwn(c, 'prerequisites') ? c.prerequisites : '',
      methods: this.hasOwn(c, 'methods') ? c.methods : '',
      self_study_guidance: this.hasOwn(c, 'self_study_guidance') ? c.self_study_guidance : '',
      course_requirements: this.hasOwn(c, 'course_requirements') ? c.course_requirements : '',
      notes: this.hasOwn(c, 'notes') ? c.notes : '',
      schedule: Array.isArray(c.schedule) ? c.schedule : [],
      grading: Array.isArray(c.grading) ? c.grading : [],
      textbooks: this.hasOwn(c, 'textbooks') ? c.textbooks : '',
      references: this.hasOwn(c, 'references') ? c.references : '',
      tools: this.hasOwn(c, 'tools') ? c.tools : '',
      import_metadata: this.hasOwn(c, 'import_metadata') ? c.import_metadata : {}
    };
  },

  getBreadcrumbItems() {
    if (this.routeContext.programId && this.routeContext.programName) {
      return [
        { label: 'Chương trình đào tạo', page: 'programs' },
        {
          label: 'Phiên bản',
          page: 'programs',
          params: {
            programId: this.routeContext.programId,
            programName: this.routeContext.programName
          }
        },
        { label: 'Đề cương' }
      ];
    }

    if (this.routeContext.sourcePage === 'my-syllabi') {
      return [
        { label: 'Đề cương của tôi', page: 'my-syllabi' },
        { label: 'Đề cương' }
      ];
    }

    return [{ label: 'Đề cương' }];
  },

  updateBreadcrumb() {
    const breadcrumb = document.getElementById('syllabus-breadcrumb');
    if (breadcrumb) breadcrumb.innerHTML = window.App.renderBreadcrumb(this.getBreadcrumbItems());
  },

  async renderSylTab() {
    const body = document.getElementById('syl-tab-content');
    body.innerHTML = '<div class="spinner"></div>';
    this.updateBreadcrumb();
    const editable = this.syllabus.status === 'draft';
    const c = this.getContent();

    try {
      switch (this.activeTab) {
        case 0:
          this.renderGeneralTab(body, editable, c);
          break;
        case 1:
          await this.renderLearningOutcomeTab(body, editable);
          break;
        case 2:
          this.renderScheduleTab(body, editable, c);
          break;
        case 3:
          this.renderGradingTab(body, editable, c);
          break;
        case 4:
          this.renderResourcesTab(body, editable, c);
          break;
        default:
          this.renderGeneralTab(body, editable, c);
      }
    } catch (e) {
      body.innerHTML = `<p style="color:var(--danger);">Lỗi: ${this.escapeHtml(e.message)}</p>`;
    }
  },

  renderSectionHeader(number, title, description, actionHtml = '') {
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:18px;flex-wrap:wrap;margin-bottom:20px;">
        <div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px;">
            <span style="display:inline-flex;min-width:46px;height:30px;padding:0 12px;border-radius:999px;align-items:center;justify-content:center;background:#111827;color:#fff;font-size:12px;font-weight:800;">${this.escapeHtml(number)}</span>
            <h3 style="font-size:20px;font-weight:780;letter-spacing:-0.2px;margin:0;">${this.escapeHtml(title)}</h3>
          </div>
          <p style="margin:0;color:var(--text-muted);font-size:14px;line-height:1.65;max-width:820px;">${this.escapeHtml(description)}</p>
        </div>
        ${actionHtml}
      </div>
    `;
  },

  renderGeneralTab(body, editable, c) {
    body.innerHTML = `
      <div style="display:grid;gap:20px;">
        <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
          ${this.renderSectionHeader('1-8', 'Thông tin nhận diện học phần', 'Bám theo các mục 1 đến 8 trong đề cương chuẩn PDF.', editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveGeneral()">Lưu thông tin</button>' : '')}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px 24px;">
            <div class="input-group" style="grid-column:span 2;"><label>Tên học phần tiếng Việt</label><textarea id="syl-course-name-vi" ${editable ? '' : 'disabled'} rows="3" placeholder="TRÍ TUỆ NHÂN TẠO ỨNG DỤNG">${this.escapeHtml(c.course_name_vi)}</textarea>${this.renderFieldStateHint(c.course_name_vi)}</div>
            <div class="input-group" style="grid-column:span 2;"><label>Tên học phần tiếng Anh</label><textarea id="syl-course-name-en" ${editable ? '' : 'disabled'} rows="3" placeholder="Applied Artificial Intelligence">${this.escapeHtml(c.course_name_en)}</textarea>${this.renderFieldStateHint(c.course_name_en)}</div>
            <div class="input-group"><label>Mã học phần</label><input type="text" id="syl-course-code" ${editable ? '' : 'disabled'} value="${this.escapeHtml(c.course_code)}" placeholder="AIT129">${this.renderFieldStateHint(c.course_code)}</div>
            <div class="input-group"><label>Số tín chỉ</label><input type="number" id="syl-credits" ${editable ? '' : 'disabled'} value="${this.escapeHtml(String(c.credits || ''))}" placeholder="3">${this.renderFieldStateHint(c.credits)}</div>
            <div class="input-group"><label>Ngôn ngữ giảng dạy</label><input type="text" id="syl-language" ${editable ? '' : 'disabled'} value="${this.escapeHtml(c.language_instruction)}" placeholder="vi / en">${this.renderFieldStateHint(c.language_instruction)}</div>
            <div class="input-group"><label>Trình độ đào tạo</label><input type="text" id="syl-level" ${editable ? '' : 'disabled'} value="${this.escapeHtml(c.course_level)}" placeholder="Đại học"></div>
            <div class="input-group"><label>Thuộc khối kiến thức</label><input type="text" id="syl-knowledge-block" ${editable ? '' : 'disabled'} value="${this.escapeHtml(c.knowledge_block)}" placeholder="Kiến thức GD chuyên nghiệp"></div>
            <div class="input-group"><label>Tính chất học phần</label><input type="text" id="syl-course-category" ${editable ? '' : 'disabled'} value="${this.escapeHtml(c.course_category)}" placeholder="Bắt buộc / Tự chọn"></div>
            <div class="input-group" style="grid-column:1 / -1;"><label>Đơn vị quản lý học phần</label><textarea id="syl-managing-unit" ${editable ? '' : 'disabled'} rows="3" placeholder="Khoa Công nghệ thông tin">${this.escapeHtml(c.managing_unit)}</textarea>${this.renderFieldStateHint(c.managing_unit)}</div>
          </div>
        </section>

        <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
          ${this.renderSectionHeader('7, 11, 12', 'Mục tiêu, mô tả và phương pháp dạy học', 'Gom các nội dung cốt lõi trong phần mô tả tóm tắt, mục tiêu và phương pháp tổ chức dạy học.')}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(360px,1fr));gap:20px 24px;">
            <div class="input-group" style="grid-column:1 / -1;"><label>Mô tả tóm tắt nội dung học phần</label><textarea id="syl-summary" ${editable ? '' : 'disabled'} rows="6" placeholder="Mô tả tóm tắt HP">${this.escapeHtml(c.summary)}</textarea>${this.renderFieldStateHint(c.summary)}</div>
            <div class="input-group" style="grid-column:1 / -1;"><label>Mục tiêu của học phần</label><textarea id="syl-objectives" ${editable ? '' : 'disabled'} rows="6" placeholder="Các mục tiêu sau khi hoàn thành học phần">${this.escapeHtml(c.objectives)}</textarea>${this.renderFieldStateHint(c.objectives)}</div>
            <div class="input-group" style="grid-column:1 / -1;"><label>Học phần học trước</label><textarea id="syl-prereq" ${editable ? '' : 'disabled'} rows="3" placeholder="Nhập học phần tiên quyết">${this.escapeHtml(c.prerequisites)}</textarea>${this.renderFieldStateHint(c.prerequisites)}</div>
            <div class="input-group" style="grid-column:1 / -1;"><label>Các yêu cầu của học phần</label><textarea id="syl-requirements" ${editable ? '' : 'disabled'} rows="4" placeholder="Phần mềm, hạ tầng, điều kiện học tập">${this.escapeHtml(c.course_requirements)}</textarea>${this.renderFieldStateHint(c.course_requirements)}</div>
            <div class="input-group" style="grid-column:1 / -1;"><label>Phương pháp, hình thức tổ chức dạy học</label><textarea id="syl-methods" ${editable ? '' : 'disabled'} rows="5" placeholder="Giảng dạy tích cực, thảo luận, bài tập, tự nghiên cứu...">${this.escapeHtml(c.methods)}</textarea>${this.renderFieldStateHint(c.methods)}</div>
          </div>
        </section>
      </div>
    `;
  },

  async saveContent(content, successMessage, fallbackErrorMessage) {
    const res = await fetch(`/api/syllabi/${this.syllabusId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) throw new Error((await res.json()).error || fallbackErrorMessage);
    this.syllabus.content = content;
    window.toast.success(successMessage);
  },

  async saveGeneral() {
    const content = {
      ...this.syllabus.content,
      course_name_vi: document.getElementById('syl-course-name-vi').value.trim(),
      course_name_en: document.getElementById('syl-course-name-en').value.trim(),
      course_code: document.getElementById('syl-course-code').value.trim(),
      credits: parseInt(document.getElementById('syl-credits').value, 10) || 0,
      language_instruction: document.getElementById('syl-language').value.trim(),
      course_level: document.getElementById('syl-level').value.trim(),
      knowledge_block: document.getElementById('syl-knowledge-block').value.trim(),
      course_category: document.getElementById('syl-course-category').value.trim(),
      managing_unit: document.getElementById('syl-managing-unit').value.trim(),
      summary: document.getElementById('syl-summary').value,
      objectives: document.getElementById('syl-objectives').value,
      prerequisites: document.getElementById('syl-prereq').value.trim(),
      course_requirements: document.getElementById('syl-requirements').value.trim(),
      methods: document.getElementById('syl-methods').value
    };

    try {
      await this.saveContent(content, 'Đã lưu phần thông tin chuẩn', 'Không thể lưu đề cương');
      this.render(document.getElementById('page-content'), this.syllabusId, this.routeContext);
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  async clearContent() {
    if (!confirm('Xóa sạch toàn bộ nội dung đề cương và đưa về trạng thái trống?')) return;
    try {
      const clos = await fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json());
      const clearMapRes = await fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: [] })
      });
      if (!clearMapRes.ok) {
        throw new Error((await clearMapRes.json()).error || 'Không thể xóa liên kết CLO-PLO');
      }

      for (const clo of clos) {
        const res = await fetch(`/api/clos/${clo.id}`, { method: 'DELETE' });
        if (!res.ok) {
          throw new Error((await res.json()).error || `Không thể xóa CLO ${clo.code}`);
        }
      }

      const content = this.buildEmptyContent();
      await this.saveContent(content, 'Đã xóa sạch nội dung đề cương', 'Không thể xóa sạch nội dung đề cương');
      this.clos = [];
      this.render(document.getElementById('page-content'), this.syllabusId, this.routeContext);
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  async deleteSyllabus() {
    if (!confirm('Xóa hẳn đề cương này? Thao tác này dùng để test lại từ đầu.')) return;
    try {
      const res = await fetch(`/api/syllabi/${this.syllabusId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Không thể xóa đề cương');
      window.toast.success('Đã xóa đề cương');
      if (this.routeContext.versionId || this.syllabus?.version_id) {
        window.App.navigate('version-editor', {
          versionId: this.routeContext.versionId || this.syllabus.version_id,
          programId: this.routeContext.programId,
          programName: this.routeContext.programName,
          tabKey: 'syllabi'
        });
        return;
      }
      window.App.navigate('my-syllabi');
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  async renderLearningOutcomeTab(body, editable) {
    const [clos, maps, plos] = await Promise.all([
      fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json()),
      fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`).then(r => r.json()),
      fetch(`/api/versions/${this.syllabus.version_id}/plos`).then(r => r.json())
    ]);
    this.clos = clos;

    const mapObj = {};
    maps.forEach(item => {
      mapObj[`${item.clo_id}-${item.plo_id}`] = item.contribution_level;
    });

    body.innerHTML = `
      <div style="display:grid;gap:20px;">
        <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
          ${this.renderSectionHeader('9', 'Bảng trích ngang ma trận đóng góp học phần cho PLO', 'Bảng này giúp đối chiếu nhanh mức độ đóng góp của từng CLO vào các PLO của chương trình.', editable ? '<button class="btn btn-primary btn-sm" id="save-clo-plo-btn">Lưu ma trận</button>' : '')}
          ${(!clos.length || !plos.length)
            ? '<p style="color:var(--text-muted);font-size:13px;">Cần có CLO và PLO trước khi hiển thị ma trận đóng góp.</p>'
            : `
              <p style="color:var(--text-muted);font-size:12px;margin:0 0 12px 0;">Ký hiệu: — = không đóng góp, 1 = thấp, 2 = trung bình, 3 = cao.</p>
              <div style="overflow-x:auto;">
                <table class="data-table" id="clo-plo-table">
                  <thead>
                    <tr>
                      <th style="min-width:120px;">CLO</th>
                      ${plos.map(plo => `<th style="text-align:center;min-width:58px;font-size:11px;">${this.escapeHtml(plo.code)}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${clos.map(clo => `
                      <tr>
                        <td><strong>${this.escapeHtml(clo.code)}</strong></td>
                        ${plos.map(plo => {
                          const value = mapObj[`${clo.id}-${plo.id}`] || 0;
                          return `
                            <td style="text-align:center;">
                              <select data-clo="${clo.id}" data-plo="${plo.id}" style="width:48px;padding:4px;font-size:12px;border:1px solid var(--border);border-radius:var(--radius);font-family:inherit;" ${editable ? '' : 'disabled'}>
                                <option value="0" ${value === 0 ? 'selected' : ''}>—</option>
                                <option value="1" ${value === 1 ? 'selected' : ''}>1</option>
                                <option value="2" ${value === 2 ? 'selected' : ''}>2</option>
                                <option value="3" ${value === 3 ? 'selected' : ''}>3</option>
                              </select>
                            </td>
                          `;
                        }).join('')}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
        </section>

        <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
          ${this.renderSectionHeader('10', 'Chuẩn đầu ra của học phần (CLO)', 'Trình bày theo dạng bảng mục 10 trong đề cương mẫu: mã CLO, mô tả, và quy chiếu ra chuẩn đầu ra CTĐT.', editable ? '<button class="btn btn-primary btn-sm" id="add-clo-btn">+ Thêm CLO</button>' : '')}
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:120px;">Mã CLO</th>
                <th>Chuẩn đầu ra học phần</th>
                <th style="min-width:160px;">PLO liên quan</th>
                ${editable ? '<th style="width:120px;"></th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${clos.length === 0
                ? `<tr><td colspan="${editable ? 4 : 3}" style="color:var(--text-muted);text-align:center;">Chưa có CLO</td></tr>`
                : clos.map(clo => {
                  const linkedPlos = plos
                    .filter(plo => (mapObj[`${clo.id}-${plo.id}`] || 0) > 0)
                    .map(plo => plo.code)
                    .join(', ');
                  return `
                    <tr>
                      <td><strong style="color:var(--primary);font-size:13px;">${this.escapeHtml(clo.code)}</strong></td>
                      <td style="font-size:13px;line-height:1.7;">${this.escapeHtml(clo.description || '')}</td>
                      <td style="font-size:13px;color:${linkedPlos ? 'var(--text-primary)' : 'var(--text-muted)'};">${this.escapeHtml(linkedPlos || 'Chưa quy chiếu')}</td>
                      ${editable ? `
                        <td style="white-space:nowrap;">
                          <button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.editCLO(${clo.id}, '${this.escapeHtml(clo.code)}', \`${this.escapeHtml((clo.description || '').replace(/`/g, "'"))}\`)">Sửa</button>
                          <button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="window.SyllabusEditorPage.deleteCLO(${clo.id})">Xóa</button>
                        </td>
                      ` : ''}
                    </tr>
                  `;
                }).join('')}
            </tbody>
          </table>
          <div id="clo-form-area" style="display:none;margin-top:16px;padding:18px;background:var(--bg-secondary);border-radius:14px;">
            <input type="hidden" id="clo-edit-id">
            <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;">
              <div class="input-group" style="width:120px;margin:0;"><label>Mã</label><input type="text" id="clo-code" placeholder="CLO1"></div>
              <div class="input-group" style="flex:1;min-width:320px;margin:0;"><label>Mô tả</label><input type="text" id="clo-desc" placeholder="Mô tả CLO"></div>
              <button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveCLO()">Lưu</button>
              <button class="btn btn-secondary btn-sm" onclick="document.getElementById('clo-form-area').style.display='none'">Hủy</button>
            </div>
          </div>
        </section>
      </div>
    `;

    document.getElementById('add-clo-btn')?.addEventListener('click', () => {
      document.getElementById('clo-edit-id').value = '';
      document.getElementById('clo-code').value = `CLO${this.clos.length + 1}`;
      document.getElementById('clo-desc').value = '';
      document.getElementById('clo-form-area').style.display = 'block';
    });

    document.getElementById('save-clo-plo-btn')?.addEventListener('click', async () => {
      const selects = document.querySelectorAll('#clo-plo-table select');
      const mappings = [];
      selects.forEach(select => {
        const value = parseInt(select.value, 10);
        if (value > 0) {
          mappings.push({
            clo_id: parseInt(select.dataset.clo, 10),
            plo_id: parseInt(select.dataset.plo, 10),
            contribution_level: value
          });
        }
      });

      try {
        const res = await fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mappings })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        window.toast.success(`Đã lưu ${mappings.length} liên kết`);
      } catch (e) {
        window.toast.error(e.message);
      }
    });
  },

  editCLO(id, code, desc) {
    document.getElementById('clo-edit-id').value = id;
    document.getElementById('clo-code').value = code;
    document.getElementById('clo-desc').value = desc;
    document.getElementById('clo-form-area').style.display = 'block';
  },

  async saveCLO() {
    const id = document.getElementById('clo-edit-id').value;
    const code = document.getElementById('clo-code').value.trim();
    const description = document.getElementById('clo-desc').value.trim();
    if (!code) {
      window.toast.warning('Nhập mã CLO');
      return;
    }

    try {
      const url = id ? `/api/clos/${id}` : `/api/syllabi/${this.syllabusId}/clos`;
      const res = await fetch(url, {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, description })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success(id ? 'Đã cập nhật CLO' : 'Đã thêm CLO');
      this.renderSylTab();
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  async deleteCLO(id) {
    if (!confirm('Xóa CLO này?')) return;
    await fetch(`/api/clos/${id}`, { method: 'DELETE' });
    window.toast.success('Đã xóa');
    this.renderSylTab();
  },

  async renderCLOPLOTab(body, editable) {
    const [clos, maps] = await Promise.all([
      fetch(`/api/syllabi/${this.syllabusId}/clos`).then(r => r.json()),
      fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`).then(r => r.json())
    ]);
    const plos = await fetch(`/api/versions/${this.syllabus.version_id}/plos`).then(r => r.json());

    if (!clos.length || !plos.length) {
      body.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Cần có CLO và PLO trước.</p>';
      return;
    }

    const mapObj = {};
    maps.forEach(item => {
      mapObj[`${item.clo_id}-${item.plo_id}`] = item.contribution_level;
    });

    body.innerHTML = `
      <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
        ${this.renderSectionHeader('9-10', 'Ma trận đóng góp CLO ↔ PLO', 'Tương ứng bảng ma trận đóng góp trong đề cương chuẩn và phần quy chiếu chuẩn đầu ra học phần.', editable ? '<button class="btn btn-primary btn-sm" id="save-clo-plo-btn">Lưu ma trận</button>' : '')}
        <p style="color:var(--text-muted);font-size:12px;margin:0 0 12px 0;">— = Không đóng góp · 1 = Thấp · 2 = Trung bình · 3 = Cao</p>
        <div style="overflow-x:auto;">
          <table class="data-table" id="clo-plo-table">
            <thead>
              <tr>
                <th style="min-width:140px;">CLO</th>
                ${plos.map(plo => `<th style="text-align:center;min-width:58px;font-size:11px;">${this.escapeHtml(plo.code)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${clos.map(clo => `
                <tr>
                  <td><strong>${this.escapeHtml(clo.code)}</strong><div style="color:var(--text-muted);font-size:12px;margin-top:4px;">${this.escapeHtml(clo.description || '')}</div></td>
                  ${plos.map(plo => {
                    const value = mapObj[`${clo.id}-${plo.id}`] || 0;
                    return `
                      <td style="text-align:center;">
                        <select data-clo="${clo.id}" data-plo="${plo.id}" style="width:48px;padding:4px;font-size:12px;border:1px solid var(--border);border-radius:var(--radius);font-family:inherit;" ${editable ? '' : 'disabled'}>
                          <option value="0" ${value === 0 ? 'selected' : ''}>—</option>
                          <option value="1" ${value === 1 ? 'selected' : ''}>1</option>
                          <option value="2" ${value === 2 ? 'selected' : ''}>2</option>
                          <option value="3" ${value === 3 ? 'selected' : ''}>3</option>
                        </select>
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;

    document.getElementById('save-clo-plo-btn')?.addEventListener('click', async () => {
      const selects = document.querySelectorAll('#clo-plo-table select');
      const mappings = [];
      selects.forEach(select => {
        const value = parseInt(select.value, 10);
        if (value > 0) {
          mappings.push({
            clo_id: parseInt(select.dataset.clo, 10),
            plo_id: parseInt(select.dataset.plo, 10),
            contribution_level: value
          });
        }
      });

      try {
        const res = await fetch(`/api/syllabi/${this.syllabusId}/clo-plo-map`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mappings })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        window.toast.success(`Đã lưu ${mappings.length} liên kết`);
      } catch (e) {
        window.toast.error(e.message);
      }
    });
  },

  getScheduleRows(c) {
    if (Array.isArray(c.schedule) && c.schedule.length) {
      return c.schedule.map((row, index) => ({
        week: row.week || index + 1,
        topic: row.topic || '',
        content: row.content || '',
        theory_hours: row.theory_hours ?? row.hours?.theory ?? '',
        practice_hours: row.practice_hours ?? row.hours?.practice ?? '',
        teaching_method: row.teaching_method || row.activities || '',
        materials: row.materials || row.assignments || '',
        clos: row.clos || row.clo_mapping || ''
      }));
    }

    return Array.from({ length: 6 }, (_, index) => ({
      week: index + 1,
      topic: '',
      content: '',
      theory_hours: '',
      practice_hours: '',
      teaching_method: '',
      materials: '',
      clos: ''
    }));
  },

  renderScheduleTab(body, editable, c) {
    const rows = this.getScheduleRows(c);
    body.innerHTML = `
      <section style="padding:22px;border:1px solid var(--border);border-radius:20px;background:#fff;">
        ${this.renderSectionHeader('13', 'Nội dung chi tiết học phần', 'Bảng này được dựng theo cấu trúc bài học, số tiết, phương pháp tổ chức dạy học và CLO đáp ứng trong PDF mẫu.', editable ? '<div style="display:flex;gap:8px;"><button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.addScheduleRow()">+ Thêm dòng</button><button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveSchedule()">Lưu nội dung</button></div>' : '')}
        <div style="overflow-x:auto;">
          <table class="data-table" id="schedule-table" style="min-width:1240px;">
            <thead>
              <tr>
                <th style="width:70px;">Bài</th>
                <th style="min-width:220px;">Tên bài / chủ đề</th>
                <th style="min-width:220px;">Nội dung chi tiết</th>
                <th style="width:70px;">LT</th>
                <th style="width:70px;">TH</th>
                <th style="min-width:240px;">Phương pháp, hình thức dạy học</th>
                <th style="min-width:220px;">Tài liệu / nhiệm vụ SV</th>
                <th style="width:120px;">Đáp ứng CLO</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <td><input type="text" data-field="week" value="${this.escapeHtml(String(row.week || ''))}" ${editable ? '' : 'disabled'} style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;text-align:center;"></td>
                  <td><input type="text" data-field="topic" value="${this.escapeHtml(row.topic)}" ${editable ? '' : 'disabled'} style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
                  <td><textarea data-field="content" ${editable ? '' : 'disabled'} rows="3" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;resize:vertical;">${this.escapeHtml(row.content)}</textarea></td>
                  <td><input type="number" data-field="theory_hours" value="${this.escapeHtml(String(row.theory_hours ?? ''))}" ${editable ? '' : 'disabled'} style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;text-align:center;"></td>
                  <td><input type="number" data-field="practice_hours" value="${this.escapeHtml(String(row.practice_hours ?? ''))}" ${editable ? '' : 'disabled'} style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;text-align:center;"></td>
                  <td><textarea data-field="teaching_method" ${editable ? '' : 'disabled'} rows="3" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;resize:vertical;">${this.escapeHtml(row.teaching_method)}</textarea></td>
                  <td><textarea data-field="materials" ${editable ? '' : 'disabled'} rows="3" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;resize:vertical;">${this.escapeHtml(row.materials)}</textarea></td>
                  <td><input type="text" data-field="clos" value="${this.escapeHtml(row.clos)}" ${editable ? '' : 'disabled'} placeholder="CLO1, CLO4" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  },

  addScheduleRow() {
    const tbody = document.querySelector('#schedule-table tbody');
    if (!tbody) return;
    const nextIndex = tbody.querySelectorAll('tr').length + 1;
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><input type="text" data-field="week" value="${nextIndex}" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;text-align:center;"></td>
        <td><input type="text" data-field="topic" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
        <td><textarea data-field="content" rows="3" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;resize:vertical;"></textarea></td>
        <td><input type="number" data-field="theory_hours" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;text-align:center;"></td>
        <td><input type="number" data-field="practice_hours" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;text-align:center;"></td>
        <td><textarea data-field="teaching_method" rows="3" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;resize:vertical;"></textarea></td>
        <td><textarea data-field="materials" rows="3" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;resize:vertical;"></textarea></td>
        <td><input type="text" data-field="clos" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
      </tr>
    `);
  },

  async saveSchedule() {
    const rows = Array.from(document.querySelectorAll('#schedule-table tbody tr')).map(row => ({
      week: parseInt(row.querySelector('[data-field="week"]').value, 10) || 0,
      topic: row.querySelector('[data-field="topic"]').value.trim(),
      content: row.querySelector('[data-field="content"]').value.trim(),
      theory_hours: parseInt(row.querySelector('[data-field="theory_hours"]').value, 10) || 0,
      practice_hours: parseInt(row.querySelector('[data-field="practice_hours"]').value, 10) || 0,
      teaching_method: row.querySelector('[data-field="teaching_method"]').value.trim(),
      materials: row.querySelector('[data-field="materials"]').value.trim(),
      clos: row.querySelector('[data-field="clos"]').value.trim()
    })).filter(item => item.week || item.topic || item.content || item.teaching_method || item.materials || item.clos);

    const content = { ...this.syllabus.content, schedule: rows };

    try {
      await this.saveContent(content, 'Đã lưu nội dung chi tiết học phần', 'Không thể lưu lịch giảng dạy');
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  getGradingRows(c) {
    if (Array.isArray(c.grading) && c.grading.length) {
      return c.grading.map(item => ({
        group: item.group || '',
        component: item.component || '',
        rule: item.rule || item.method || '',
        assessment: item.assessment || '',
        weight: item.weight || 0,
        clos: item.clos || ''
      }));
    }

    return [
      { group: 'Điểm đánh giá quá trình', component: 'Chuyên cần và hoạt động tích cực', rule: '', assessment: '', weight: 20, clos: 'CLO4' },
      { group: 'Điểm đánh giá quá trình', component: 'Bài tập nhóm', rule: '', assessment: 'Bài 1, 2, 3, 5', weight: 20, clos: 'CLO1, CLO2' },
      { group: 'Điểm đánh giá quá trình', component: 'Bài tập cá nhân', rule: '', assessment: 'Bài 4', weight: 10, clos: 'CLO3' },
      { group: 'Điểm thi kết thúc HP', component: 'Đồ án học phần', rule: '', assessment: 'Bài 5 - 6', weight: 50, clos: 'CLO2, CLO3' }
    ];
  },

  renderGradingTab(body, editable, c) {
    const rows = this.getGradingRows(c);
    body.innerHTML = `
      <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
        ${this.renderSectionHeader('14', 'Phương pháp kiểm tra, đánh giá', 'Giao diện này bám bảng thành phần điểm, quy định, bài đánh giá, trọng số và chuẩn đầu ra đáp ứng trong mẫu chuẩn PDF.', editable ? '<div style="display:flex;gap:8px;"><button class="btn btn-secondary btn-sm" onclick="window.SyllabusEditorPage.addGradingRow()">+ Thêm dòng</button><button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveGrading()">Lưu đánh giá</button></div>' : '')}
        <div style="overflow-x:auto;">
          <table class="data-table" id="grading-table" style="min-width:1100px;">
            <thead>
              <tr>
                <th style="min-width:150px;">Nhóm điểm</th>
                <th style="min-width:180px;">Điểm thành phần</th>
                <th style="min-width:220px;">Quy định</th>
                <th style="min-width:180px;">Bài đánh giá</th>
                <th style="width:90px;">Trọng số</th>
                <th style="min-width:120px;">CLO</th>
                ${editable ? '<th style="width:60px;"></th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => `
                <tr>
                  <td><input type="text" data-field="group" value="${this.escapeHtml(row.group)}" ${editable ? '' : 'disabled'} style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
                  <td><input type="text" data-field="component" value="${this.escapeHtml(row.component)}" ${editable ? '' : 'disabled'} style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
                  <td><input type="text" data-field="rule" value="${this.escapeHtml(row.rule)}" ${editable ? '' : 'disabled'} style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
                  <td><input type="text" data-field="assessment" value="${this.escapeHtml(row.assessment)}" ${editable ? '' : 'disabled'} style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
                  <td><input type="number" data-field="weight" value="${this.escapeHtml(String(row.weight || 0))}" ${editable ? '' : 'disabled'} min="0" max="100" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;text-align:center;"></td>
                  <td><input type="text" data-field="clos" value="${this.escapeHtml(row.clos)}" ${editable ? '' : 'disabled'} style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
                  ${editable ? '<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest(\'tr\').remove()">✕</button></td>' : ''}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;
  },

  addGradingRow() {
    const tbody = document.querySelector('#grading-table tbody');
    if (!tbody) return;
    tbody.insertAdjacentHTML('beforeend', `
      <tr>
        <td><input type="text" data-field="group" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
        <td><input type="text" data-field="component" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
        <td><input type="text" data-field="rule" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
        <td><input type="text" data-field="assessment" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
        <td><input type="number" data-field="weight" value="0" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;text-align:center;"></td>
        <td><input type="text" data-field="clos" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:var(--radius);font-size:13px;font-family:inherit;"></td>
        <td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" onclick="this.closest('tr').remove()">✕</button></td>
      </tr>
    `);
  },

  async saveGrading() {
    const rows = Array.from(document.querySelectorAll('#grading-table tbody tr')).map(row => ({
      group: row.querySelector('[data-field="group"]').value.trim(),
      component: row.querySelector('[data-field="component"]').value.trim(),
      rule: row.querySelector('[data-field="rule"]').value.trim(),
      assessment: row.querySelector('[data-field="assessment"]').value.trim(),
      weight: parseInt(row.querySelector('[data-field="weight"]').value, 10) || 0,
      method: row.querySelector('[data-field="rule"]').value.trim(),
      clos: row.querySelector('[data-field="clos"]').value.trim()
    })).filter(item => item.group || item.component || item.rule || item.assessment || item.weight || item.clos);

    const content = { ...this.syllabus.content, grading: rows };

    try {
      await this.saveContent(content, 'Đã lưu phương pháp đánh giá', 'Không thể lưu hình thức đánh giá');
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  renderResourcesTab(body, editable, c) {
    body.innerHTML = `
      <div style="display:grid;gap:20px;">
        <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
          ${this.renderSectionHeader('15', 'Tài liệu phục vụ học phần', 'Bám các nhóm tài liệu chính, tài liệu tham khảo và công cụ phục vụ học tập.', editable ? '<button class="btn btn-primary btn-sm" onclick="window.SyllabusEditorPage.saveResources()">Lưu tài liệu</button>' : '')}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px 24px;">
            <div class="input-group" style="grid-column:1 / -1;"><label>Tài liệu / giáo trình chính</label><textarea id="syl-textbooks" ${editable ? '' : 'disabled'} rows="7" placeholder="Tên sách, tác giả, đơn vị phát hành">${this.escapeHtml(c.textbooks)}</textarea>${this.renderFieldStateHint(c.textbooks)}</div>
            <div class="input-group" style="grid-column:1 / -1;"><label>Tài liệu tham khảo / bổ sung</label><textarea id="syl-references" ${editable ? '' : 'disabled'} rows="7" placeholder="Thông tư, bài báo, website, khung năng lực...">${this.escapeHtml(c.references)}</textarea>${this.renderFieldStateHint(c.references)}</div>
            <div class="input-group" style="grid-column:1 / -1;"><label>Các công cụ phục vụ học phần</label><textarea id="syl-tools" ${editable ? '' : 'disabled'} rows="5" placeholder="Google Search, Scholar, AutoML, IBM Watson...">${this.escapeHtml(c.tools)}</textarea>${this.renderFieldStateHint(c.tools)}</div>
          </div>
        </section>

        <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
          ${this.renderSectionHeader('16-17', 'Hướng dẫn tự học và yêu cầu học phần', 'Dùng cho nhiệm vụ tự học của sinh viên và các yêu cầu bổ sung của học phần.')}
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px 24px;">
            <div class="input-group"><label>Hướng dẫn sinh viên tự học</label><textarea id="syl-self-study" ${editable ? '' : 'disabled'} rows="8" placeholder="BÀI 1..., đọc tài liệu..., dùng công cụ...">${this.escapeHtml(c.self_study_guidance)}</textarea>${this.renderFieldStateHint(c.self_study_guidance)}</div>
            <div class="input-group"><label>Các yêu cầu khác của học phần</label><textarea id="syl-notes" ${editable ? '' : 'disabled'} rows="8" placeholder="Yêu cầu phần mềm, thiết bị, thái độ học tập...">${this.escapeHtml(c.notes)}</textarea>${this.renderFieldStateHint(c.notes)}</div>
          </div>
        </section>
      </div>
    `;
  },

  async saveResources() {
    const content = {
      ...this.syllabus.content,
      textbooks: document.getElementById('syl-textbooks').value,
      references: document.getElementById('syl-references').value,
      tools: document.getElementById('syl-tools').value,
      self_study_guidance: document.getElementById('syl-self-study').value,
      notes: document.getElementById('syl-notes').value
    };

    try {
      await this.saveContent(content, 'Đã lưu tài liệu và hướng dẫn tự học', 'Không thể lưu tài liệu tham khảo');
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  async submitForApproval() {
    if (!confirm('Nộp đề cương để phê duyệt?')) return;
    try {
      const res = await fetch('/api/approval/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_type: 'syllabus', entity_id: this.syllabusId })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      window.toast.success('Đã nộp');
      this.syllabus.status = 'submitted';
      this.render(document.getElementById('page-content'), this.syllabusId, this.routeContext);
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  openPdfImport() {
    const versionId = this.routeContext.versionId || this.syllabus?.version_id;
    if (!versionId) {
      window.toast.warning('Không xác định được phiên bản để mở import PDF.');
      return;
    }
    window.App.navigate('syllabus-pdf-import', {
      versionId,
      programId: this.routeContext.programId,
      programName: this.routeContext.programName,
      tabKey: 'syllabi',
      syllabusId: this.syllabusId,
      targetCourseId: this.syllabus?.course_id
    });
  },

  destroy() {}
};
