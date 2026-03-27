window.SyllabusPdfImportPage = {
  currentStep: 1,
  sessionId: null,
  sessionData: null,
  versionId: null,
  version: null,
  versionCourses: [],
  useMockMode: false,
  reviewActiveTab: 0,
  pendingStep2Focus: null,
  preferredTargetCourseId: null,
  preferredSyllabusId: null,

  steps: [
    { number: 1, title: 'Tải lên PDF', description: 'Chọn đề cương PDF' },
    { number: 2, title: 'Rà soát', description: 'Kiểm tra bản chuẩn hóa' },
    { number: 3, title: 'Xác thực', description: 'Kiểm tra ràng buộc' },
    { number: 4, title: 'Hoàn tất', description: 'Lưu vào đề cương' }
  ],

  normalizeImportMetadata(raw = {}) {
    const metadata = raw && typeof raw === 'object' ? raw : {};
    const diagnostics = metadata.diagnostics && typeof metadata.diagnostics === 'object'
      ? metadata.diagnostics
      : {};
    const legacyMode = `${metadata.mode || ''}`.toLowerCase();
    const engine = `${metadata.engine || metadata.processing_engine || legacyMode || metadata.provider || 'groq'}`.toLowerCase() || 'groq';
    const isMock = engine === 'mock' || engine === 'heuristic';
    const provider = `${metadata.provider || (isMock ? 'heuristic' : 'groq')}`.toLowerCase();
    const model = metadata.model || metadata.ai_model || (isMock ? 'mock-local' : '');

    return {
      source_file: metadata.source_file || '',
      extraction_method: metadata.extraction_method || (isMock ? 'pdftotext+mock-smart' : `pdftotext+${provider}`),
      engine: isMock ? 'mock' : engine,
      provider,
      model,
      ai_model: model,
      prompt_version: metadata.prompt_version || '',
      inferred_fields: Array.isArray(metadata.inferred_fields) ? metadata.inferred_fields : [],
      fallback_used: Boolean(metadata.fallback_used || isMock),
      diagnostics
    };
  },

  getImportDisplaySource(metadata = {}) {
    const normalized = this.normalizeImportMetadata(metadata);
    if (normalized.engine === 'mock') return 'PDF heuristic fallback';
    const provider = normalized.provider ? normalized.provider.toUpperCase() : 'AI';
    return `PDF + ${provider}`;
  },

  normalizeSessionData(raw = {}) {
    const payload = raw && typeof raw === 'object' ? raw : {};
    const courseIdentity = payload.course_identity && typeof payload.course_identity === 'object'
      ? payload.course_identity
      : {};
    const general = payload.general && typeof payload.general === 'object'
      ? payload.general
      : {};
    const requirements = general.requirements && typeof general.requirements === 'object'
      ? general.requirements
      : {};
    const resources = payload.resources && typeof payload.resources === 'object'
      ? payload.resources
      : {};
    const confidence = payload.confidence && typeof payload.confidence === 'object'
      ? payload.confidence
      : {};
    const metadata = this.normalizeImportMetadata(payload.import_metadata);
    const target = payload.target && typeof payload.target === 'object'
      ? payload.target
      : {};

    return {
      course_identity: {
        course_code: courseIdentity.course_code || '',
        course_name_vi: courseIdentity.course_name_vi || '',
        course_name_en: courseIdentity.course_name_en || '',
        credits: Number.isFinite(Number(courseIdentity.credits)) ? Number(courseIdentity.credits) : 0,
        language_instruction: courseIdentity.language_instruction || 'vi'
      },
      general: {
        summary: general.summary || '',
        objectives: general.objectives || '',
        prerequisites: general.prerequisites || '',
        methods: general.methods || '',
        requirements: {
          software: Array.isArray(requirements.software) ? requirements.software.join('\n') : '',
          hardware: Array.isArray(requirements.hardware) ? requirements.hardware.join('\n') : '',
          lab_equipment: Array.isArray(requirements.lab_equipment) ? requirements.lab_equipment.join('\n') : '',
          classroom_setup: requirements.classroom_setup || ''
        }
      },
      clos: Array.isArray(payload.clos) ? payload.clos.map((item, index) => ({
        code: item.code || `CLO${index + 1}`,
        description: item.description || '',
        bloom_level: item.bloom_level || 'understand',
        plo_mapping: Array.isArray(item.plo_mapping) ? item.plo_mapping.join(', ') : (item.plo_mapping || ''),
        confidence: item.confidence || 'medium'
      })) : [],
      schedule: Array.isArray(payload.schedule) ? payload.schedule.map((item, index) => ({
        week: Number.isFinite(Number(item.week)) ? Number(item.week) : index + 1,
        topic: item.topic || '',
        activities: item.activities || '',
        clos: item.clos || ''
      })) : [],
      assessments: Array.isArray(payload.assessments) ? payload.assessments.map(item => ({
        component: item.component || '',
        weight: Number.isFinite(Number(item.weight)) ? Number(item.weight) : 0,
        method: item.method || '',
        clos: item.clos || ''
      })) : [],
      resources: {
        textbooks: resources.textbooks || '',
        references: resources.references || '',
        tools: resources.tools || ''
      },
      warnings: Array.isArray(payload.warnings) ? payload.warnings : [],
      confidence: {
        overall: confidence.overall || 'medium',
        fields: confidence.fields && typeof confidence.fields === 'object' ? confidence.fields : {}
      },
      import_metadata: {
        ...metadata
      },
      target: {
        course_id: target.course_id || '',
        syllabus_id: target.syllabus_id || null
      }
    };
  },

  denormalizeSessionData() {
    const payload = this.sessionData?.review_payload;
    if (!payload) return {};

    return {
      course_identity: {
        ...payload.course_identity,
        credits: Number(payload.course_identity.credits || 0)
      },
      general: {
        ...payload.general,
        requirements: {
          software: `${payload.general.requirements.software || ''}`.split('\n').map(v => v.trim()).filter(Boolean),
          hardware: `${payload.general.requirements.hardware || ''}`.split('\n').map(v => v.trim()).filter(Boolean),
          lab_equipment: `${payload.general.requirements.lab_equipment || ''}`.split('\n').map(v => v.trim()).filter(Boolean),
          classroom_setup: payload.general.requirements.classroom_setup || ''
        }
      },
      clos: (payload.clos || []).map(item => ({
        code: item.code,
        description: item.description,
        bloom_level: item.bloom_level,
        plo_mapping: `${item.plo_mapping || ''}`.split(',').map(v => v.trim()).filter(Boolean),
        confidence: item.confidence || 'medium'
      })),
      schedule: (payload.schedule || []).map(item => ({
        week: Number(item.week || 1),
        topic: item.topic,
        activities: item.activities,
        clos: item.clos
      })),
      assessments: (payload.assessments || []).map(item => ({
        component: item.component,
        weight: Number(item.weight || 0),
        method: item.method,
        clos: item.clos
      })),
      resources: { ...payload.resources },
      warnings: payload.warnings || [],
      confidence: payload.confidence || { overall: 'medium', fields: {} },
      import_metadata: payload.import_metadata || {},
      target: {
        course_id: payload.target.course_id ? Number(payload.target.course_id) : null,
        syllabus_id: payload.target.syllabus_id ? Number(payload.target.syllabus_id) : null
      }
    };
  },

  async parseApiResponse(res, fallbackMessage = 'Có lỗi xảy ra khi gọi API') {
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    const isJson = contentType.includes('application/json');
    if (!isJson) {
      throw new Error(`${fallbackMessage}. Backend không trả JSON hợp lệ.`);
    }
    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error(`${fallbackMessage}. JSON phản hồi không hợp lệ.`);
    }
  },

  renderReviewMetaCard(label, value) {
    return `
      <div style="padding:12px 14px;border:1px solid var(--border);border-radius:12px;background:#fff;">
        <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:5px;">${label}</div>
        <div style="font-size:14px;font-weight:600;color:var(--text-primary);line-height:1.45;">${value}</div>
      </div>
    `;
  },

  renderFieldStateHint(value) {
    const normalized = String(value ?? '').trim();
    return normalized ? '' : '<div style="margin-top:6px;font-size:12px;color:var(--text-muted);">Trống</div>';
  },

  renderReviewSectionHeader(number, title, description, actionHtml = '') {
    return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:16px;">
        <div>
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <span style="display:inline-flex;min-width:42px;height:28px;padding:0 10px;border-radius:999px;align-items:center;justify-content:center;background:#111827;color:#fff;font-size:12px;font-weight:800;">${number}</span>
            <h3 style="font-size:19px;font-weight:780;letter-spacing:-0.2px;margin:0;">${title}</h3>
          </div>
          <p style="margin:0;color:var(--text-muted);font-size:13px;line-height:1.55;">${description}</p>
        </div>
        ${actionHtml}
      </div>
    `;
  },

  updateReviewTabs() {
    document.querySelectorAll('#import-review-tabs .tab-item').forEach(tab => {
      tab.classList.toggle('active', Number(tab.dataset.tab) === this.reviewActiveTab);
    });
    document.querySelectorAll('[data-review-panel]').forEach(panel => {
      panel.style.display = Number(panel.dataset.reviewPanel) === this.reviewActiveTab ? 'block' : 'none';
    });
  },

  bindReviewTabs() {
    document.querySelectorAll('#import-review-tabs .tab-item').forEach(tab => {
      tab.addEventListener('click', async () => {
        const newTab = Number(tab.dataset.tab);
        if (newTab === this.reviewActiveTab) return;

        this.reviewActiveTab = newTab;
        if (typeof this.hasUnsavedChanges === 'function' && this.hasUnsavedChanges()) {
          this.isDirty = false;
          await this.renderStepContent();
        } else {
          this.updateReviewTabs();
        }
      });
    });
    this.updateReviewTabs();
  },

  inferValidationTarget(issue) {
    const msg = `${issue?.msg || issue || ''}`;

    if (/học phần đích/i.test(msg)) return { tab: 0, selector: '#target-course-id' };
    if (/mã học phần/i.test(msg)) return { tab: 0, selector: '#course-code' };
    if (/tên học phần tiếng việt/i.test(msg)) return { tab: 0, selector: '#course-name-vi' };
    if (/tên học phần tiếng anh/i.test(msg)) return { tab: 0, selector: '#course-name-en' };
    if (/tín chỉ/i.test(msg)) return { tab: 0, selector: '#course-credits' };
    if (/ngôn ngữ giảng dạy/i.test(msg)) return { tab: 0, selector: '#course-language' };
    if (/clo|chuẩn đầu ra học phần/i.test(msg)) return { tab: 1, selector: '#clo-table' };
    if (/mô tả|mục tiêu học phần|điều kiện tiên quyết|phương pháp/i.test(msg)) return { tab: 2, selector: '#general-summary' };
    if (/tuần|lịch học|schedule|chủ đề|nội dung chi tiết/i.test(msg)) return { tab: 2, selector: '#schedule-table' };
    if (/đánh giá|trọng số|%|thành phần điểm|assessment/i.test(msg)) return { tab: 3, selector: '#assessment-table' };
    if (/giáo trình|tài liệu tham khảo|công cụ|phần mềm yêu cầu|requirements/i.test(msg)) return { tab: 4, selector: '#resources-textbooks' };

    return null;
  },

  async jumpToValidationTarget(issue) {
    const target = this.inferValidationTarget(issue);
    if (!target) return;
    this.pendingStep2Focus = target;
    this.currentStep = 2;
    this.reviewActiveTab = Number.isFinite(Number(target.tab)) ? Number(target.tab) : 0;
    localStorage.setItem('syllabus_pdf_import_current_step', this.currentStep);
    this.updateStepper();
    await this.renderStepContent();
  },

  applyPendingStep2Focus() {
    const target = this.pendingStep2Focus;
    if (!target) return;
    this.pendingStep2Focus = null;

    const tryFocus = () => {
      const el = target.selector ? document.querySelector(target.selector) : null;
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      el.classList.add('validation-jump-highlight');
      el.style.transition = 'box-shadow 0.25s ease, background-color 0.25s ease';
      el.style.boxShadow = '0 0 0 3px rgba(0,102,204,0.18)';
      el.style.backgroundColor = 'rgba(0,102,204,0.06)';
      if (typeof el.focus === 'function') {
        try { el.focus({ preventScroll: true }); } catch (_) { el.focus(); }
      }
      setTimeout(() => {
        el.classList.remove('validation-jump-highlight');
        el.style.boxShadow = '';
        el.style.backgroundColor = '';
      }, 2200);
    };

    setTimeout(tryFocus, 80);
  },

  async render(container, params = {}) {
    this.versionId = params.versionId;
    this.preferredTargetCourseId = params.targetCourseId || null;
    this.preferredSyllabusId = params.syllabusId || null;
    this.sourcePage = params.sourcePage || null;
    this.sessionId = params.sessionId || localStorage.getItem('syllabus_pdf_import_session_id');
    this.currentStep = parseInt(localStorage.getItem('syllabus_pdf_import_current_step') || '1', 10);
    if (!this.versionId) {
      container.innerHTML = '<div class="empty-state"><div class="icon">❌</div><p>Thiếu versionId để import đề cương PDF.</p></div>';
      return;
    }

    container.classList.add('main-content-wide', 'main-content-import');
    const [versionRes, coursesRes] = await Promise.all([
      fetch(`/api/versions/${this.versionId}`),
      fetch(`/api/versions/${this.versionId}/courses`)
    ]);
    this.version = await versionRes.json();
    this.versionCourses = await coursesRes.json();

    if (this.sessionId) {
      await this.loadSession();
      if (this.sessionData) {
        if (this.currentStep < 2) this.currentStep = 2;
      }
    }

    this.renderWizardFrame(container);
    await this.renderStepContent();
  },

  renderWizardFrame(container) {
    container.innerHTML = `
      <div style="margin-bottom:24px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;">
          <div>
            <div id="syllabus-import-breadcrumb" style="margin-bottom:8px;"></div>
            <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.3px;">Nhập đề cương từ PDF</h1>
            <p style="color:var(--text-muted);font-size:14px;margin-top:4px;">Chuẩn hóa đề cương bằng AI rồi rà soát trước khi lưu vào tab Đề cương của CTĐT.</p>
          </div>
          <div style="min-width:260px;padding:14px 16px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-secondary);">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">Phiên bản đang thao tác</div>
            <div style="font-weight:700;">${this.version.academic_year || ''}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:6px;">${this.version.program_name || ''}</div>
          </div>
        </div>
      </div>

      <div class="wizard-stepper" style="display:flex;justify-content:space-between;margin-bottom:32px;position:relative;padding:0 20px;">
        <div style="position:absolute;top:15px;left:40px;right:40px;height:2px;background:var(--border);z-index:1;"></div>
        <div id="wizard-progress-bar" style="position:absolute;top:15px;left:40px;width:0%;height:2px;background:var(--primary);z-index:2;transition:width 0.3s ease;"></div>
        ${this.steps.map(s => `
          <div class="wizard-step" data-step="${s.number}" style="position:relative;z-index:3;display:flex;flex-direction:column;align-items:center;width:120px;text-align:center;">
            <div class="step-icon" style="width:32px;height:32px;border-radius:50%;background:var(--bg-secondary);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;margin-bottom:8px;transition:all 0.3s ease;">${s.number}</div>
            <div style="font-size:13px;font-weight:600;color:var(--text-muted);">${s.title}</div>
          </div>
        `).join('')}
      </div>

      <div style="display:flex;justify-content:flex-start;gap:12px;margin-bottom:16px;">
        <button class="btn btn-secondary wizard-prev-btn" style="visibility:hidden;">Quay lại</button>
        <button class="btn btn-primary wizard-next-btn">Tiếp tục</button>
        <button class="btn btn-secondary wizard-retry-btn" style="display:none;">Chạy lại AI</button>
        <button class="btn btn-secondary wizard-cancel-btn" style="margin-left:auto;color:var(--danger);display:none;">Hủy phiên</button>
      </div>

      <div id="step-container" style="background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:28px 24px;min-height:400px;box-shadow:var(--shadow-sm);">
        <div class="spinner"></div>
      </div>
    `;

    document.querySelectorAll('.wizard-prev-btn').forEach(btn => btn.addEventListener('click', () => this.prevStep()));
    document.querySelectorAll('.wizard-next-btn').forEach(btn => btn.addEventListener('click', () => this.nextStep()));
    document.querySelectorAll('.wizard-retry-btn').forEach(btn => btn.addEventListener('click', () => this.retryAi()));
    document.querySelectorAll('.wizard-cancel-btn').forEach(btn => btn.addEventListener('click', () => this.cancelImport()));

    const breadcrumb = document.getElementById('syllabus-import-breadcrumb');
    if (breadcrumb) {
      if (this.sourcePage === 'my-syllabi') {
        breadcrumb.innerHTML = window.App.renderBreadcrumb([
          { label: 'Đề cương của tôi', page: 'my-syllabi' },
          { 
            label: 'Soạn thảo',
            page: 'syllabus-editor',
            params: { syllabusId: this.preferredSyllabusId, sourcePage: 'my-syllabi' }
          },
          { label: 'Nhập PDF đề cương' }
        ]);
      } else {
        breadcrumb.innerHTML = window.App.renderBreadcrumb([
          { label: 'Chương trình đào tạo', page: 'programs' },
          {
            label: 'Phiên bản',
            page: 'version-editor',
            params: {
              versionId: this.versionId,
              programId: this.version.program_id,
              programName: this.version.program_name
            }
          },
          {
            label: 'Đề cương',
            page: 'version-editor',
            params: {
              versionId: this.versionId,
              programId: this.version.program_id,
              programName: this.version.program_name,
              tabKey: 'syllabi'
            }
          },
          { label: 'Nhập PDF đề cương' }
        ]);
      }
    }

    this.updateStepper();
  },

  updateStepper() {
    const steps = document.querySelectorAll('.wizard-step');
    const progressBar = document.getElementById('wizard-progress-bar');
    steps.forEach((el, i) => {
      const stepNum = i + 1;
      const icon = el.querySelector('.step-icon');
      const label = el.querySelector('div:last-child');
      if (stepNum < this.currentStep) {
        icon.style.background = 'var(--primary)';
        icon.style.borderColor = 'var(--primary)';
        icon.style.color = '#fff';
        icon.innerHTML = '✓';
        label.style.color = 'var(--primary)';
      } else if (stepNum === this.currentStep) {
        icon.style.background = '#fff';
        icon.style.borderColor = 'var(--primary)';
        icon.style.color = 'var(--primary)';
        label.style.color = 'var(--text-main)';
      } else {
        icon.style.background = 'var(--bg-secondary)';
        icon.style.borderColor = 'var(--border)';
        icon.style.color = 'var(--text-muted)';
        icon.innerHTML = stepNum;
        label.style.color = 'var(--text-muted)';
      }
    });
    if (progressBar) {
      progressBar.style.width = `${((this.currentStep - 1) / (this.steps.length - 1)) * 100}%`;
    }

    const prevBtn = document.querySelector('.wizard-prev-btn');
    const nextBtn = document.querySelector('.wizard-next-btn');
    const retryBtn = document.querySelector('.wizard-retry-btn');
    const cancelBtn = document.querySelector('.wizard-cancel-btn');
    if (prevBtn) prevBtn.style.visibility = this.currentStep > 1 ? 'visible' : 'hidden';
    if (nextBtn) nextBtn.textContent = this.currentStep === 4 ? 'Mở đề cương' : (this.currentStep === 3 ? 'Hoàn tất' : 'Tiếp tục');
    if (retryBtn) retryBtn.style.display = this.currentStep >= 2 && this.currentStep <= 3 && this.sessionId ? 'inline-flex' : 'none';
    if (cancelBtn) cancelBtn.style.display = this.sessionId ? 'inline-flex' : 'none';
  },

  async renderStepContent() {
    const container = document.getElementById('step-container');
    container.innerHTML = '<div class="spinner"></div>';
    if (this.currentStep === 1) this.renderStep1(container);
    if (this.currentStep === 2) this.renderStep2(container);
    if (this.currentStep === 3) this.renderStep3(container);
    if (this.currentStep === 4) this.renderStep4(container);
    this.updateStepper();
  },

  renderStep1(container) {
    container.innerHTML = `
      <div style="text-align:center;max-width:560px;margin:40px auto;">
        <div style="font-size:48px;margin-bottom:20px;">📕</div>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">Tải lên file đề cương PDF</h2>
        <p style="color:var(--text-muted);font-size:14px;line-height:1.6;margin-bottom:24px;">
          Hệ thống sẽ dùng AI để bóc tách và chuẩn hóa đề cương về một form thống nhất, sau đó bạn rà soát lại trước khi lưu vào tab Đề cương.
        </p>

        <div id="drop-zone" style="border:2px dashed var(--border);border-radius:var(--radius-lg);padding:40px;background:var(--bg-secondary);cursor:pointer;transition:all 0.2s ease;">
          <input type="file" id="pdf-file-input" accept=".pdf,application/pdf" style="display:none;">
          <div id="drop-zone-text" style="font-size:14px;color:var(--text-muted);">
            Kéo thả file vào đây hoặc <span style="color:var(--primary);font-weight:600;">nhấn để chọn file PDF</span>
          </div>
          <div id="file-name-container" style="margin-top:12px;display:none;align-items:center;justify-content:center;gap:12px;">
            <div id="file-name" style="font-weight:600;color:var(--primary);"></div>
            <button id="remove-file-btn" class="btn btn-secondary btn-sm" style="padding:2px 8px;font-size:12px;color:var(--danger);border-radius:var(--radius);">Gỡ file</button>
          </div>
        </div>

      </div>
    `;

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('pdf-file-input');
    const fileNameContainer = document.getElementById('file-name-container');
    const fileNameDisplay = document.getElementById('file-name');
    const dropZoneText = document.getElementById('drop-zone-text');
    const removeBtn = document.getElementById('remove-file-btn');

    dropZone.onclick = (e) => {
      if (e.target.closest('#file-name-container')) return;
      fileInput.click();
    };

    removeBtn.onclick = (e) => {
      e.stopPropagation();
      fileInput.value = '';
      fileNameContainer.style.display = 'none';
      dropZoneText.style.display = 'block';
      dropZone.style.borderColor = 'var(--border)';
      dropZone.style.background = 'var(--bg-secondary)';
    };

    fileInput.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      fileNameDisplay.textContent = file.name;
      fileNameContainer.style.display = 'flex';
      dropZoneText.style.display = 'none';
      dropZone.style.borderColor = 'var(--primary)';
      dropZone.style.background = 'rgba(0, 102, 204, 0.05)';
    };

  },

  renderStep2(container) {
    this.isDirty = false;
    const payload = this.sessionData?.review_payload;
    if (!payload) {
      container.innerHTML = '<p style="color:var(--danger);">Không có dữ liệu review để hiển thị.</p>';
      return;
    }

    const overallConfidence = payload.confidence?.overall || 'medium';
    if (!payload.target.course_id && this.preferredTargetCourseId) {
      payload.target.course_id = Number(this.preferredTargetCourseId);
    }
    if (!payload.target.syllabus_id && this.preferredSyllabusId) {
      payload.target.syllabus_id = Number(this.preferredSyllabusId);
    }
    container.innerHTML = `
      <div style="display:grid;gap:20px;">
        <div style="padding:28px 30px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
          <div style="text-align:center;border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:22px;">
            <div style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--text-muted);margin-bottom:4px;">Trường Đại học Công nghệ TP. HCM · Khoa Công nghệ thông tin</div>
            <div style="font-size:26px;font-weight:800;letter-spacing:-0.4px;">ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:6px;">Bản rà soát chuẩn hóa từ PDF trước khi lưu vào hệ thống</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;flex-wrap:wrap;">
            <div>
              <h2 style="font-size:32px;line-height:1.18;font-weight:800;letter-spacing:-0.5px;margin:0 0 8px 0;">${payload.course_identity.course_name_vi || 'Đề cương đang chuẩn hóa'}</h2>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;color:var(--text-muted);font-size:13px;">
                <span><strong style="color:var(--text-primary);">${payload.course_identity.course_code || '---'}</strong></span>
                <span>${payload.course_identity.credits || 0} TC</span>
              </div>
            </div>
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
              <button class="btn btn-secondary btn-sm" id="save-review-btn">Lưu thay đổi</button>
            </div>
          </div>
        </div>

        <div class="tab-bar" id="import-review-tabs">
          <div class="tab-item active" data-tab="0">Mục 1-8</div>
          <div class="tab-item" data-tab="1">Mục 9-10</div>
          <div class="tab-item" data-tab="2">Mục 11-13</div>
          <div class="tab-item" data-tab="3">Mục 14</div>
          <div class="tab-item" data-tab="4">Mục 15-17</div>
        </div>

        <div data-review-panel="0">
          <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
            ${this.renderReviewSectionHeader('1-8', 'Thông tin nhận diện học phần', 'Khớp với phần mở đầu của đề cương mẫu: tên học phần, mã, tín chỉ, học phần đích và thông tin cơ bản.', '')}
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:20px 24px;">
              <div class="input-group" style="grid-column:1 / -1;"><label>Học phần đích trong CTĐT</label>
                <select id="target-course-id">
                  <option value="">Chọn học phần đích...</option>
                  ${this.versionCourses.map(course => `<option value="${course.course_id}" ${Number(payload.target.course_id) === Number(course.course_id) ? 'selected' : ''}>${course.course_code} — ${course.course_name}</option>`).join('')}
                </select>
                ${this.renderFieldStateHint(payload.target.course_id)}
              </div>
              <div class="input-group"><label>Mã học phần</label><input type="text" id="course-code" value="${payload.course_identity.course_code || ''}">${this.renderFieldStateHint(payload.course_identity.course_code)}</div>
              <div class="input-group" style="grid-column:span 2;"><label>Tên học phần tiếng Việt</label><textarea id="course-name-vi" rows="3">${payload.course_identity.course_name_vi || ''}</textarea>${this.renderFieldStateHint(payload.course_identity.course_name_vi)}</div>
              <div class="input-group" style="grid-column:span 2;"><label>Tên học phần tiếng Anh</label><textarea id="course-name-en" rows="3">${payload.course_identity.course_name_en || ''}</textarea>${this.renderFieldStateHint(payload.course_identity.course_name_en)}</div>
              <div class="input-group"><label>Số tín chỉ</label><input type="number" id="course-credits" value="${payload.course_identity.credits || 0}">${this.renderFieldStateHint(payload.course_identity.credits)}</div>
              <div class="input-group"><label>Ngôn ngữ giảng dạy</label><input type="text" id="course-language" value="${payload.course_identity.language_instruction || 'vi'}">${this.renderFieldStateHint(payload.course_identity.language_instruction)}</div>
              <div class="input-group" style="grid-column:1 / -1;"><label>Nguồn file</label><input type="text" id="import-source-file" value="${this.sessionData.source_filename || payload.import_metadata.source_file || 'PDF upload'}" disabled></div>
            </div>
          </section>
        </div>

        <div data-review-panel="1" style="display:none;">
          <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
            ${this.renderReviewSectionHeader('9-10', 'Ma trận đóng góp và chuẩn đầu ra học phần', 'Rà soát CLO trước khi lưu, bao gồm mô tả, Bloom và liên kết PLO.', '<button class="btn btn-secondary btn-sm" id="add-clo-row">+ Thêm CLO</button>')}
            <table class="data-table" id="clo-table">
              <thead><tr><th>Mã CLO</th><th>Chuẩn đầu ra học phần</th><th>Bloom</th><th>PLO liên quan</th><th></th></tr></thead>
              <tbody>
                ${payload.clos.map(clo => `
                  <tr data-confidence="${clo.confidence || 'medium'}">
                    <td><input type="text" data-field="code" value="${clo.code || ''}"></td>
                    <td><input type="text" data-field="description" value="${clo.description || ''}"></td>
                    <td><input type="text" data-field="bloom_level" value="${clo.bloom_level || ''}"></td>
                    <td>
                      <input type="text" data-field="plo_mapping" value="${clo.plo_mapping || ''}" placeholder="PLO1, PLO2">
                      <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">AI confidence: ${clo.confidence || 'medium'}</div>
                    </td>
                    <td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" data-action="remove-row">✕</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </section>
        </div>

        <div data-review-panel="2" id="syl-details-section-container" style="display:none;">
          <!-- Component will be rendered here -->
        </div>

        <div data-review-panel="3" style="display:none;">
          <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
            ${this.renderReviewSectionHeader('14', 'Phương pháp kiểm tra, đánh giá', 'Rà soát thành phần điểm, trọng số và CLO được đánh giá.', '<button class="btn btn-secondary btn-sm" id="add-assessment-row">+ Thêm dòng</button>')}
            <table class="data-table" id="assessment-table">
              <thead><tr><th>Thành phần</th><th>%</th><th>Hình thức</th><th>CLO</th><th></th></tr></thead>
              <tbody>
                ${payload.assessments.map(item => `
                  <tr>
                    <td><input type="text" data-field="component" value="${item.component || ''}"></td>
                    <td><input type="number" data-field="weight" value="${item.weight || 0}" style="width:80px;"></td>
                    <td><input type="text" data-field="method" value="${item.method || ''}"></td>
                    <td><input type="text" data-field="clos" value="${item.clos || ''}"></td>
                    <td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" data-action="remove-row">✕</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </section>
        </div>

        <div data-review-panel="4" style="display:none;">
          <section style="padding:28px;border:1px solid var(--border);border-radius:24px;background:#fff;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
            ${this.renderReviewSectionHeader('15-17', 'Tài liệu phục vụ học phần và yêu cầu bổ sung', 'Giữ đúng tinh thần phần tài liệu, công cụ và điều kiện học tập trong đề cương mẫu.', '')}
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:20px 24px;">
              <div class="input-group" style="grid-column:1 / -1;"><label>Giáo trình chính</label><textarea id="resources-textbooks" rows="6">${payload.resources.textbooks || ''}</textarea>${this.renderFieldStateHint(payload.resources.textbooks)}</div>
              <div class="input-group" style="grid-column:1 / -1;"><label>Tài liệu tham khảo</label><textarea id="resources-references" rows="6">${payload.resources.references || ''}</textarea>${this.renderFieldStateHint(payload.resources.references)}</div>
              <div class="input-group" style="grid-column:1 / -1;"><label>Công cụ / phần mềm</label><textarea id="resources-tools" rows="5">${payload.resources.tools || ''}</textarea>${this.renderFieldStateHint(payload.resources.tools)}</div>
              <div class="input-group" style="grid-column:1 / -1;"><label>Phần mềm yêu cầu</label><textarea id="requirements-software" rows="4">${payload.general.requirements.software || ''}</textarea>${this.renderFieldStateHint(payload.general.requirements.software)}</div>
            </div>
          </section>
        </div>
      </div>
    `;

    document.getElementById('save-review-btn')?.addEventListener('click', () => this.saveReview());
    document.getElementById('add-clo-row')?.addEventListener('click', () => { this.addTableRow('clo-table', ['code', 'description', 'bloom_level', 'plo_mapping']); this.isDirty = true; });
    document.getElementById('add-assessment-row')?.addEventListener('click', () => { this.addTableRow('assessment-table', ['component', 'weight', 'method', 'clos']); this.isDirty = true; });
    
    // Initialize shared details section for Section 11-13
    const detailsContainer = document.getElementById('syl-details-section-container');
    if (detailsContainer && payload.general && window.SyllabusDetailsSection) {
      window.SyllabusDetailsSection.init(detailsContainer, {
        summary: payload.general.summary || payload.general.course_description || '',
        objectives: payload.general.objectives || payload.general.course_objectives || '',
        prerequisites: payload.general.prerequisites || '',
        methods: payload.general.methods || payload.general.learning_methods || '',
        schedule: payload.schedule || []
      }, true);
    } else if (!window.SyllabusDetailsSection) {
      console.error('SyllabusDetailsSection component not loaded');
    }

    container.querySelectorAll('[data-action="remove-row"]').forEach(btn => {
      btn.addEventListener('click', () => { btn.closest('tr').remove(); this.isDirty = true; });
    });
    
    const contentWrapper = container.firstElementChild;
    if (contentWrapper) {
      const markDirty = (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) this.isDirty = true;
      };
      contentWrapper.addEventListener('input', markDirty);
      contentWrapper.addEventListener('change', markDirty);
    }

    this.bindReviewTabs();
    this.applyPendingStep2Focus();
  },

  renderStep3(container) {
    const validationErrors = Array.isArray(this.sessionData?.validation_errors) ? this.sessionData.validation_errors : [];
    const warnings = Array.isArray(this.sessionData?.warnings) ? this.sessionData.warnings : [];
    const issues = [
      ...validationErrors.map(item => typeof item === 'string' ? { type: 'error', msg: item } : { type: 'error', ...item }),
      ...warnings.map(item => typeof item === 'string' ? { type: 'warning', msg: item } : { type: 'warning', ...item })
    ];
    const errorCount = issues.filter(item => item.type === 'error').length;
    const warningCount = issues.filter(item => item.type === 'warning').length;

    container.innerHTML = `
      <div style="max-width:980px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap;margin-bottom:18px;">
          <div>
            <h2 style="font-size:18px;font-weight:700;">Kết quả validation</h2>
            <p style="color:var(--text-muted);font-size:13px;margin-top:4px;">Bấm vào từng lỗi hoặc cảnh báo để quay lại đúng vùng cần rà soát. Mục nào không có đích cụ thể sẽ chỉ hiển thị để tham chiếu.</p>
          </div>
          <button class="btn btn-primary btn-sm" id="run-validation-btn">Kiểm tra lại</button>
        </div>

        <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px;">
          <div style="padding:18px;border:1px solid var(--border);border-radius:18px;background:#fff;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Lỗi nghiêm trọng</div>
            <div style="font-size:28px;font-weight:700;color:var(--danger);">${errorCount}</div>
          </div>
          <div style="padding:18px;border:1px solid var(--border);border-radius:18px;background:#fff;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Cảnh báo</div>
            <div style="font-size:28px;font-weight:700;color:var(--warning);">${warningCount}</div>
          </div>
          <div style="padding:18px;border:1px solid var(--border);border-radius:18px;background:#fff;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:6px;">Trạng thái</div>
            <div style="font-size:18px;font-weight:700;color:${errorCount ? 'var(--danger)' : 'var(--success)'};">${errorCount ? 'Cần chỉnh sửa' : 'Sẵn sàng commit'}</div>
          </div>
        </div>

        <div style="border:1px solid var(--border);border-radius:20px;background:#fff;overflow:hidden;box-shadow:0 8px 24px rgba(15,23,42,0.04);">
          <div style="padding:18px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
            <div>
              <h3 style="font-size:15px;font-weight:700;margin:0 0 4px;">Danh sách cần rà soát</h3>
              <p style="margin:0;font-size:13px;color:var(--text-muted);">Danh sách này thống nhất với logic validation trước khi commit.</p>
            </div>
            ${errorCount > 0 ? `<div style="font-size:12px;color:var(--danger);font-weight:600;">Cần xử lý lỗi trước khi hoàn tất</div>` : `<div style="font-size:12px;color:var(--success);font-weight:600;">Không còn lỗi chặn commit</div>`}
          </div>
          <div style="max-height:420px;overflow-y:auto;">
            ${issues.length === 0 ? `
              <div style="padding:28px;text-align:center;color:var(--success);">
                <div style="font-size:28px;margin-bottom:8px;">✓</div>
                <strong>Dữ liệu đã sẵn sàng.</strong> Không tìm thấy lỗi hoặc cảnh báo đáng chú ý.
              </div>
            ` : issues.map((issue, index) => {
              const target = this.inferValidationTarget(issue);
              const isClickable = Boolean(target);
              return `
                <button
                  type="button"
                  class="${isClickable ? 'validation-issue-row' : 'validation-issue-static'}"
                  data-issue-index="${index}"
                  ${isClickable ? '' : 'disabled'}
                  style="width:100%;padding:14px 18px;border:0;border-bottom:1px solid var(--border);display:flex;align-items:flex-start;gap:12px;background:transparent;text-align:left;cursor:${isClickable ? 'pointer' : 'default'};opacity:1;"
                >
                  <span style="display:inline-flex;align-items:center;justify-content:center;min-width:24px;height:24px;border-radius:999px;background:${issue.type === 'error' ? 'rgba(215,58,73,0.12)' : 'rgba(255,166,0,0.14)'};color:${issue.type === 'error' ? 'var(--danger)' : 'var(--warning)'};font-weight:800;font-size:12px;">${issue.type === 'error' ? '✕' : '!'}</span>
                  <div style="flex:1;min-width:0;">
                    <div style="font-size:13px;font-weight:600;color:var(--text-main);line-height:1.55;">${issue.msg || ''}</div>
                    <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${isClickable ? 'Bấm để quay lại đúng khu vực ở bước Rà soát.' : 'Cảnh báo này chỉ dùng để tham chiếu, không có đích focus cụ thể.'}</div>
                  </div>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    container.querySelectorAll('.validation-issue-row').forEach(btn => {
      btn.addEventListener('click', async () => {
        const issue = issues[parseInt(btn.dataset.issueIndex, 10)];
        if (!issue) return;
        await this.jumpToValidationTarget(issue);
      });
    });
    document.getElementById('run-validation-btn')?.addEventListener('click', () => this.runValidation(true));
  },

  renderStep4(container) {
    const targetCourse = this.versionCourses.find(course => Number(course.course_id) === Number(this.sessionData?.review_payload?.target?.course_id));
    container.innerHTML = `
      <div style="text-align:center;max-width:560px;margin:40px auto;">
        <div style="font-size:52px;margin-bottom:16px;">✅</div>
        <h2 style="font-size:22px;font-weight:700;margin-bottom:12px;">Đã nhập đề cương thành công</h2>
        <p style="color:var(--text-muted);font-size:14px;line-height:1.6;margin-bottom:24px;">
          Bản đề cương PDF đã được chuẩn hóa và lưu vào hệ thống. Bạn có thể mở đề cương để tiếp tục chỉnh sửa chi tiết hoặc nộp duyệt.
        </p>
        <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-secondary);text-align:left;margin-bottom:18px;">
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--divider);font-size:13px;"><span>Học phần</span><strong>${targetCourse ? `${targetCourse.course_code} — ${targetCourse.course_name}` : 'N/A'}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--divider);font-size:13px;"><span>Session</span><strong>#${this.sessionId}</strong></div>
          <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span>Trạng thái</span><strong>${this.sessionData?.status || 'completed'}</strong></div>
        </div>
        <div style="display:flex;justify-content:center;gap:12px;">
          <button class="btn btn-secondary" id="back-version-btn">Quay về tab Đề cương</button>
          <button class="btn btn-primary" id="open-syllabus-btn">Mở đề cương</button>
        </div>
      </div>
    `;

    document.getElementById('back-version-btn')?.addEventListener('click', () => {
      window.App.navigate('version-editor', {
        versionId: this.versionId,
        programId: this.version.program_id,
        programName: this.version.program_name,
        tabKey: 'syllabi'
      });
    });
    document.getElementById('open-syllabus-btn')?.addEventListener('click', async () => {
      const syllabusId = this.sessionData?.review_payload?.target?.syllabus_id;
      if (!syllabusId) {
        window.toast.warning('Không tìm thấy syllabusId để mở.');
        return;
      }
      window.App.navigate('syllabus-editor', {
        syllabusId,
        versionId: this.versionId,
        programId: this.version.program_id,
        programName: this.version.program_name,
        tabKey: 'syllabi'
      });
    });
  },

  addTableRow(tableId, fields) {
    const tbody = document.querySelector(`#${tableId} tbody`);
    if (!tbody) return;
    const row = document.createElement('tr');
    row.innerHTML = fields.map(field => `<td><input type="${field === 'weight' || field === 'week' ? 'number' : 'text'}" data-field="${field}" value=""></td>`).join('') + `<td><button class="btn btn-secondary btn-sm" style="color:var(--danger);" data-action="remove-row">✕</button></td>`;
    tbody.appendChild(row);
    row.querySelector('[data-action="remove-row"]')?.addEventListener('click', () => row.remove());
  },

  hasUnsavedChanges() {
    if (this.currentStep !== 2 || !document.getElementById('import-review-tabs')) return false;
    return Boolean(this.isDirty);
  },

  captureReviewPayloadFromDom() {
    if (!this.sessionData) return;
    const payload = this.sessionData.review_payload;

    const targetCourseEl = document.getElementById('target-course-id');
    const courseCodeEl = document.getElementById('course-code');
    const courseNameViEl = document.getElementById('course-name-vi');
    const courseNameEnEl = document.getElementById('course-name-en');
    const courseCreditsEl = document.getElementById('course-credits');
    const courseLanguageEl = document.getElementById('course-language');
    const resourcesTextbooksEl = document.getElementById('resources-textbooks');
    const resourcesReferencesEl = document.getElementById('resources-references');
    const resourcesToolsEl = document.getElementById('resources-tools');
    const requirementsSoftwareEl = document.getElementById('requirements-software');

    if (targetCourseEl) payload.target.course_id = targetCourseEl.value || '';
    if (courseCodeEl) payload.course_identity.course_code = courseCodeEl.value.trim() || '';
    if (courseNameViEl) payload.course_identity.course_name_vi = courseNameViEl.value.trim() || '';
    if (courseNameEnEl) payload.course_identity.course_name_en = courseNameEnEl.value.trim() || '';
    if (courseCreditsEl) payload.course_identity.credits = Number(courseCreditsEl.value || 0);
    if (courseLanguageEl) payload.course_identity.language_instruction = courseLanguageEl.value.trim() || 'vi';
    
    // Initialize general if missing
    if (!payload.general) payload.general = {};

    // Capture data from the shared component for Sections 11-13
    if (window.SyllabusDetailsSection) {
      const detailsData = window.SyllabusDetailsSection.capture();
      if (detailsData) {
        payload.general.summary = detailsData.summary;
        payload.general.objectives = detailsData.objectives;
        payload.general.prerequisites = detailsData.prerequisites;
        payload.general.methods = detailsData.methods;
        
        // Also sync to legacy fields used by some AI providers or old sessions
        payload.general.course_description = detailsData.summary;
        payload.general.course_objectives = detailsData.objectives;
        payload.general.learning_methods = detailsData.methods;
        
        payload.schedule = detailsData.schedule;
      }
    }

    if (resourcesTextbooksEl) payload.resources.textbooks = resourcesTextbooksEl.value.trim() || '';
    if (resourcesReferencesEl) payload.resources.references = resourcesReferencesEl.value.trim() || '';
    if (resourcesToolsEl) payload.resources.tools = resourcesToolsEl.value.trim() || '';
    if (requirementsSoftwareEl) payload.general.requirements.software = requirementsSoftwareEl.value.trim() || '';

    const readRows = (tableId) => Array.from(document.querySelectorAll(`#${tableId} tbody tr`)).map(row => {
      const obj = {};
      row.querySelectorAll('input').forEach(input => {
        obj[input.dataset.field] = input.type === 'number' ? Number(input.value || 0) : input.value.trim();
      });
      if (tableId === 'clo-table') {
        obj.confidence = row.dataset.confidence || 'medium';
      }
      return obj;
    }).filter(row => Object.values(row).some(Boolean));

    if (document.getElementById('clo-table')) {
      payload.clos = readRows('clo-table');
    }
    if (document.getElementById('schedule-table')) {
      payload.schedule = readRows('schedule-table');
    }
    if (document.getElementById('assessment-table')) {
      payload.assessments = readRows('assessment-table');
    }
  },

  async loadSession() {
    if (!this.sessionId) return;
    const res = await fetch(`/api/syllabus-import-pdf/session/${this.sessionId}`);
    const data = await this.parseApiResponse(res, 'Không tải được phiên import PDF');
    if (!res.ok) throw new Error(data.error);
    this.sessionData = {
      ...data,
      canonical_payload: this.normalizeSessionData(data.canonical_payload),
      review_payload: this.normalizeSessionData(data.review_payload || data.canonical_payload)
    };
    this.useMockMode = this.normalizeImportMetadata(this.sessionData?.ai_metadata).engine === 'mock';
  },

  async saveReview(showToast = true) {
    this.captureReviewPayloadFromDom();
    const payload = this.denormalizeSessionData();
    const res = await fetch(`/api/syllabus-import-pdf/session/${this.sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review_payload: payload })
    });
    const data = await this.parseApiResponse(res, 'Không thể lưu thay đổi review');
    if (!res.ok) throw new Error(data.error);
    this.sessionData = {
      ...data,
      canonical_payload: this.normalizeSessionData(data.canonical_payload),
      review_payload: this.normalizeSessionData(data.review_payload || data.canonical_payload)
    };
    if (showToast) window.toast.success('Đã lưu thay đổi');
    this.isDirty = false;
  },

  async uploadPdf() {
    const fileInput = document.getElementById('pdf-file-input');
    const file = fileInput?.files?.[0];
    if (!file) {
      throw new Error('Vui lòng chọn file PDF trước khi tiếp tục.');
    }
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`/api/versions/${this.versionId}/syllabus-import-pdf/session`, {
      method: 'POST',
      body: formData
    });
    const data = await this.parseApiResponse(res, 'Không thể tạo phiên import PDF');
    if (!res.ok) throw new Error(data.error);
    this.sessionId = data.id;
    this.sessionData = {
      ...data,
      canonical_payload: this.normalizeSessionData(data.canonical_payload),
      review_payload: this.normalizeSessionData(data.review_payload || data.canonical_payload)
    };
    localStorage.setItem('syllabus_pdf_import_session_id', this.sessionId);
    this.useMockMode = this.normalizeImportMetadata(this.sessionData?.ai_metadata).engine === 'mock';
  },

  async runValidation(showToast = false) {
    const res = await fetch(`/api/syllabus-import-pdf/session/${this.sessionId}/validate`, { method: 'POST' });
    const data = await this.parseApiResponse(res, 'Không thể validate phiên import PDF');
    if (!res.ok) throw new Error(data.error);
    this.sessionData = {
      ...data.session,
      canonical_payload: this.normalizeSessionData(data.session.canonical_payload),
      review_payload: this.normalizeSessionData(data.session.review_payload || data.session.canonical_payload)
    };
    if (showToast) {
      if (data.success) window.toast.success('Validation thành công');
      else window.toast.warning('Validation vẫn còn lỗi, vui lòng kiểm tra lại');
      this.renderStep3(document.getElementById('step-container'));
    }
    return data.success;
  },

  async retryAi() {
    if (!this.sessionId) return;
    try {
      const res = await fetch(`/api/syllabus-import-pdf/session/${this.sessionId}/retry`, { method: 'POST' });
      const data = await this.parseApiResponse(res, 'Không thể chạy lại AI');
      if (!res.ok) throw new Error(data.error);
      this.sessionData = {
        ...data,
        canonical_payload: this.normalizeSessionData(data.canonical_payload),
        review_payload: this.normalizeSessionData(data.review_payload || data.canonical_payload)
      };
      this.useMockMode = this.normalizeImportMetadata(this.sessionData?.ai_metadata).engine === 'mock';
      window.toast.success(this.useMockMode ? 'Đã chạy lại heuristic fallback và cập nhật bản review' : 'Đã chạy lại Groq và cập nhật bản review');
      if (this.currentStep >= 2 && this.currentStep <= 3) {
        await this.renderStepContent();
      }
    } catch (e) {
      window.toast.error(e.message);
    }
  },

  async nextStep() {
    const nextBtn = document.querySelector('.wizard-next-btn');
    const prevBtn = document.querySelector('.wizard-prev-btn');
    const originalNextText = nextBtn ? nextBtn.textContent : 'Tiếp tục';
    const loadingHtml = `<span style="width:14px;height:14px;border:2px solid rgba(255,255,255,0.3);border-top-color:#fff;border-radius:50%;margin:0 6px 0 0;display:inline-block;vertical-align:middle;animation:spin 0.6s linear infinite;box-sizing:border-box;"></span><span style="display:inline-block;vertical-align:middle;">${originalNextText}</span>`;

    try {
      if (this.currentStep === 1) {
        if (nextBtn) {
          nextBtn.innerHTML = loadingHtml;
          nextBtn.disabled = true;
        }
        if (prevBtn) prevBtn.disabled = true;
        await this.uploadPdf();
        this.currentStep = 2;
      } else if (this.currentStep === 2) {
        if (nextBtn) {
          nextBtn.innerHTML = loadingHtml;
          nextBtn.disabled = true;
        }
        if (prevBtn) prevBtn.disabled = true;
        const ok = await this.runValidation();
        this.currentStep = 3;
        if (!ok) window.toast.warning('Vẫn còn lỗi cần xử lý trước khi commit.');
      } else if (this.currentStep === 3) {
        if (nextBtn) {
          nextBtn.innerHTML = loadingHtml;
          nextBtn.disabled = true;
        }
        if (prevBtn) prevBtn.disabled = true;
        const ok = await this.runValidation();
        if (!ok) {
          throw new Error('Phiên import còn lỗi nghiêm trọng. Hãy quay lại bước Rà soát để chỉnh sửa.');
        }
        const res = await fetch(`/api/syllabus-import-pdf/session/${this.sessionId}/commit`, { method: 'POST' });
        const data = await this.parseApiResponse(res, 'Không thể commit đề cương PDF');
        if (!res.ok) throw new Error(data.error);
        this.sessionData = {
          ...data.session,
          canonical_payload: this.normalizeSessionData(data.session.canonical_payload),
          review_payload: this.normalizeSessionData(data.session.review_payload || data.session.canonical_payload)
        };
        this.currentStep = 4;
      } else if (this.currentStep === 4) {
        const syllabusId = this.sessionData?.review_payload?.target?.syllabus_id;
        if (syllabusId) {
          window.App.navigate('syllabus-editor', {
            syllabusId,
            versionId: this.versionId,
            programId: this.version.program_id,
            programName: this.version.program_name,
            tabKey: 'syllabi',
            sourcePage: this.sourcePage
          });
          return;
        }
      }

      localStorage.setItem('syllabus_pdf_import_current_step', this.currentStep);
      await this.renderStepContent();
    } catch (e) {
      if (nextBtn) nextBtn.innerHTML = originalNextText;
      window.toast.error(e.message);
    } finally {
      if (nextBtn) nextBtn.disabled = false;
      if (prevBtn) prevBtn.disabled = false;
    }
  },

  async prevStep() {
    if (this.currentStep <= 1) return;
    if (this.currentStep === 3) {
      this.currentStep = 2;
    } else {
      this.currentStep -= 1;
    }
    localStorage.setItem('syllabus_pdf_import_current_step', this.currentStep);
    await this.renderStepContent();
  },

  cancelImport() {
    if (!confirm('Bạn có chắc chắn muốn hủy phiên bản tải lên này?')) return;
    localStorage.removeItem('syllabus_pdf_import_session_id');
    localStorage.removeItem('syllabus_pdf_import_current_step');
    this.sessionId = null;
    this.sessionData = null;
    this.currentStep = 1;
    this.renderStepContent();
  },

  destroy() {}
};
