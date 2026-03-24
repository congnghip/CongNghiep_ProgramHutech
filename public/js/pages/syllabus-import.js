/**
 * Syllabus Import Page — 4-Step Wizard
 */
window.SyllabusImportPage = {
  currentStep: 1,
  sessionId: null,
  sessionData: null,
  activePreviewTab: 'info',
  saveTimer: null,
  touchedInfoFields: {},
  pendingStep2Focus: null,

  steps: [
    { number: 1, title: 'Tải lên file .docx', description: 'Chọn file CTĐT từ máy tính' },
    { number: 2, title: 'Xem trước dữ liệu', description: 'Kiểm tra và sửa đổi thông tin trích xuất' },
    { number: 3, title: 'Xác thực (Validation)', description: 'Kiểm tra các ràng buộc dữ liệu' },
    { number: 4, title: 'Hoàn tất', description: 'Lưu chính thức vào hệ thống' }
  ],

  previewTabs: [
    { key: 'info', label: 'Thông tin' },
    { key: 'po', label: 'Mục tiêu PO' },
    { key: 'plo', label: 'Chuẩn đầu ra PLO' },
    { key: 'pi', label: 'Chỉ số PI' },
    { key: 'po_plo', label: 'PO ↔ PLO' },
    { key: 'courses', label: 'Học phần' },
    { key: 'plan', label: 'Kế hoạch GD' },
    { key: 'course_plo', label: 'HP ↔ PLO' },
    { key: 'assessment', label: 'Đánh giá CĐR' },
    { key: 'syllabi', label: 'Đề cương' }
  ],

  validateAcademicYear(value) {
    const normalized = `${value || ''}`.trim();
    const match = /^(\d{4})-(\d{4})$/.exec(normalized);
    if (!match) {
      return { valid: false, message: 'Năm học phải đúng dạng 2025-2026.' };
    }
    if (parseInt(match[2], 10) !== parseInt(match[1], 10) + 1) {
      return { valid: false, message: 'Năm học phải là 2 năm liên tiếp, ví dụ 2025-2026.' };
    }
    return { valid: true, message: '' };
  },

  createTempId(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  },

  normalizeSessionData(raw = {}) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const totalCreditsRaw = source.total_credits;
    const totalCredits = totalCreditsRaw === '' || totalCreditsRaw === null || totalCreditsRaw === undefined
      ? ''
      : (Number.isFinite(Number(totalCreditsRaw)) && Number(totalCreditsRaw) > 0 ? Number(totalCreditsRaw) : '');
    const data = {
      program_name: source.program_name || '',
      program_code: source.program_code || '',
      degree: source.degree || 'Đại học',
      total_credits: totalCredits,
      academic_year: source.academic_year || '',
      version_name: source.version_name || 'Phiên bản Import',
      pos: Array.isArray(source.pos) ? source.pos.map((po, idx) => ({
        id: po.id || this.createTempId(`po${idx + 1}`),
        code: po.code || '',
        description: po.description || ''
      })) : [],
      plos: Array.isArray(source.plos) ? source.plos.map((plo, idx) => ({
        id: plo.id || this.createTempId(`plo${idx + 1}`),
        code: plo.code || '',
        bloom_level: Number.isFinite(Number(plo.bloom_level)) ? Number(plo.bloom_level) : 3,
        description: plo.description || ''
      })) : [],
      pis: Array.isArray(source.pis) ? source.pis.map((pi, idx) => ({
        id: pi.id || this.createTempId(`pi${idx + 1}`),
        plo_id: pi.plo_id || null,
        pi_code: pi.pi_code || '',
        description: pi.description || '',
        course_ids: Array.isArray(pi.course_ids) ? pi.course_ids : []
      })) : [],
      courses: Array.isArray(source.courses) ? source.courses.map((course, idx) => ({
        id: course.id || this.createTempId(`course${idx + 1}`),
        course_id: course.course_id || null,
        course_code: course.course_code || course.code || '',
        course_name: course.course_name || course.name || '',
        credits: Number.isFinite(Number(course.credits)) ? Number(course.credits) : 0,
        semester: Number.isFinite(Number(course.semester)) ? Number(course.semester) : 1,
        course_type: course.course_type || 'required',
        dept_name: course.dept_name || '',
        dept_code: course.dept_code || ''
      })) : [],
      po_plo_map: Array.isArray(source.po_plo_map) ? source.po_plo_map.map(map => ({
        po_id: map.po_id,
        plo_id: map.plo_id
      })) : [],
      course_plo_map: Array.isArray(source.course_plo_map) ? source.course_plo_map.map(map => ({
        course_id: map.course_id,
        plo_id: map.plo_id,
        contribution_level: Number.isFinite(Number(map.contribution_level)) ? Number(map.contribution_level) : 0
      })) : [],
      course_pi_map: Array.isArray(source.course_pi_map) ? source.course_pi_map.map(map => ({
        course_id: map.course_id,
        pi_id: map.pi_id,
        contribution_level: Number.isFinite(Number(map.contribution_level)) ? Number(map.contribution_level) : 0
      })) : [],
      assessments: Array.isArray(source.assessments) ? source.assessments.map((assessment, idx) => ({
        id: assessment.id || this.createTempId(`assessment${idx + 1}`),
        plo_id: assessment.plo_id || null,
        pi_id: assessment.pi_id || null,
        sample_course_id: assessment.sample_course_id || null,
        course_code: assessment.course_code || '',
        course_name: assessment.course_name || '',
        assessment_tool: assessment.assessment_tool || '',
        criteria: assessment.criteria || '',
        threshold: assessment.threshold || '',
        semester: assessment.semester || '',
        assessor: assessment.assessor || '',
        dept_code: assessment.dept_code || ''
      })) : [],
      syllabi: Array.isArray(source.syllabi) ? source.syllabi.map((syllabus, idx) => ({
        id: syllabus.id || this.createTempId(`syllabus${idx + 1}`),
        course_id: syllabus.course_id || null,
        course_code: syllabus.course_code || '',
        course_name: syllabus.course_name || '',
        credits: Number.isFinite(Number(syllabus.credits)) ? Number(syllabus.credits) : 0,
        status: syllabus.status || 'draft',
        content: syllabus.content && typeof syllabus.content === 'object' ? syllabus.content : {},
        authors: Array.isArray(syllabus.authors) ? syllabus.authors : []
      })) : [],
      plan_rows: Array.isArray(source.plan_rows) ? source.plan_rows : [],
      import_metadata: source.import_metadata && typeof source.import_metadata === 'object' ? source.import_metadata : {}
    };

    return data;
  },

  ensureSessionShape() {
    if (!this.sessionData) return null;
    this.sessionData.raw_data = this.normalizeSessionData(this.sessionData.raw_data);
    return this.sessionData.raw_data;
  },

  async parseApiResponse(res, fallbackMessage = 'Có lỗi xảy ra khi gọi API') {
    const contentType = res.headers.get('content-type') || '';
    const text = await res.text();
    const isJson = contentType.includes('application/json');

    if (!isJson) {
      const route = new URL(res.url).pathname;
      const statusPart = res.status ? ` (${res.status})` : '';
      const htmlHint = text.includes('<!DOCTYPE') || text.includes('<html')
        ? ' Backend đang trả về HTML thay vì JSON.'
        : '';
      throw new Error(`${fallbackMessage}${statusPart}.${htmlHint} Route lỗi: ${route}.`);
    }

    try {
      return text ? JSON.parse(text) : {};
    } catch (e) {
      throw new Error(`${fallbackMessage}. Phản hồi JSON không hợp lệ.`);
    }
  },

  async render(container, params = {}) {
    this.sessionId = params.sessionId || null;
    this.currentStep = this.sessionId ? 2 : 1;
    this.activePreviewTab = 'info';
    this.touchedInfoFields = {};
    this.pendingStep2Focus = null;
    container.classList.add('main-content-wide', 'main-content-import');

    this.renderWizardFrame(container);
    await this.renderStepContent();
  },

  renderWizardFrame(container) {
    container.innerHTML = `
      <div style="margin-bottom:24px;">
        <h1 style="font-size:24px;font-weight:700;letter-spacing:-0.3px;">Nhập Chương trình đào tạo từ file .docx</h1>
        <p style="color:var(--text-muted);font-size:14px;margin-top:4px;">Quy trình nhập liệu tự động thông qua 4 bước kiểm soát.</p>
      </div>

      <div class="wizard-stepper" style="display:flex;justify-content:space-between;margin-bottom:32px;position:relative;padding:0 20px;">
        <div style="position:absolute;top:15px;left:40px;right:40px;height:2px;background:var(--border);z-index:1;"></div>
        <div id="wizard-progress-bar" style="position:absolute;top:15px;left:40px;width:0%;height:2px;background:var(--primary);z-index:2;transition:width 0.3s ease;"></div>
        ${this.steps.map(s => `
          <div class="wizard-step" data-step="${s.number}" style="position:relative;z-index:3;display:flex;flex-direction:column;align-items:center;width:120px;text-align:center;">
            <div class="step-icon" style="width:32px;height:32px;border-radius:50%;background:var(--bg-secondary);border:2px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;margin-bottom:8px;transition:all 0.3s ease;">
              ${s.number}
            </div>
            <div style="font-size:13px;font-weight:600;color:var(--text-muted);">${s.title}</div>
          </div>
        `).join('')}
      </div>

      <div class="wizard-actions-top" style="display:flex;justify-content:flex-start;gap:12px;margin-bottom:16px;">
        <button class="btn btn-secondary wizard-prev-btn" style="visibility:hidden;">Quay lại</button>
        <button class="btn btn-primary wizard-next-btn">Tiếp tục</button>
      </div>

      <div id="step-container" style="background:var(--bg-primary);border:1px solid var(--border);border-radius:var(--radius-lg);padding:28px 24px;min-height:400px;box-shadow:var(--shadow-sm);">
        <div class="spinner"></div>
      </div>
    `;

    container.querySelectorAll('.wizard-prev-btn').forEach(btn => btn.addEventListener('click', () => this.prevStep()));
    container.querySelectorAll('.wizard-next-btn').forEach(btn => btn.addEventListener('click', () => this.nextStep()));
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
        icon.innerHTML = stepNum;
        label.style.color = 'var(--text-main)';
      } else {
        icon.style.background = 'var(--bg-secondary)';
        icon.style.borderColor = 'var(--border)';
        icon.style.color = 'var(--text-muted)';
        icon.innerHTML = stepNum;
        label.style.color = 'var(--text-muted)';
      }
    });

    const progress = ((this.currentStep - 1) / (this.steps.length - 1)) * 100;
    if (progressBar) progressBar.style.width = `${progress}%`;

    document.querySelectorAll('.wizard-prev-btn').forEach(prevBtn => {
      prevBtn.style.visibility = this.currentStep === 1 ? 'hidden' : 'visible';
    });
    document.querySelectorAll('.wizard-next-btn').forEach(nextBtn => {
      nextBtn.disabled = false;
      if (this.currentStep === this.steps.length) {
        nextBtn.textContent = 'Hoàn tất';
        nextBtn.className = 'btn btn-success wizard-next-btn';
      } else {
        nextBtn.textContent = 'Tiếp tục';
        nextBtn.className = 'btn btn-primary wizard-next-btn';
      }
    });
  },

  setNextButtonsState({ disabled = false, text = null, kind = null } = {}) {
    document.querySelectorAll('.wizard-next-btn').forEach(nextBtn => {
      nextBtn.disabled = disabled;
      if (text !== null) nextBtn.textContent = text;
      if (kind === 'success') nextBtn.className = 'btn btn-success wizard-next-btn';
      if (kind === 'primary') nextBtn.className = 'btn btn-primary wizard-next-btn';
    });
  },

  inferValidationTarget(error) {
    const msg = `${error?.msg || ''}`;

    if (/tên chương trình đào tạo/i.test(msg)) return { tab: 'info', selector: '#import-program-name' };
    if (/mã chương trình đào tạo|mã CTĐT/i.test(msg)) return { tab: 'info', selector: '#import-program-code' };
    if (/năm học/i.test(msg)) return { tab: 'info', selector: '#import-academic-year' };
    if (/tên phiên bản/i.test(msg)) return { tab: 'info', selector: '#import-version-name' };
    if (/bậc đào tạo/i.test(msg)) return { tab: 'info', selector: '#import-degree' };
    if (/tổng tín chỉ/i.test(msg)) return { tab: 'info', selector: '#import-total-credits' };
    if (/Mục tiêu đào tạo \(PO\)/i.test(msg)) return { tab: 'po' };
    if (/Chuẩn đầu ra \(PLO\)/i.test(msg)) return { tab: 'plo' };
    if (/PI\s*"/i.test(msg) || /PI\b.*PLO hợp lệ/i.test(msg)) {
      const piMatch = msg.match(/PI\s*"([^"]+)"/i);
      return { tab: 'pi', piCode: piMatch ? piMatch[1] : '' };
    }
    if (/Ma trận PO ↔ PLO/i.test(msg)) return { tab: 'po_plo' };
    if (/Ma trận HP ↔ PLO/i.test(msg)) return { tab: 'course_plo' };
    if (/Ma trận HP ↔ PI/i.test(msg)) return { tab: 'course_plo' };
    if (/Học phần\s*"/i.test(msg)) {
      const courseMatch = msg.match(/Học phần\s*"([^"]+)"/i);
      return { tab: 'courses', courseCode: courseMatch ? courseMatch[1] : '' };
    }

    return { tab: 'info' };
  },

  async jumpToValidationTarget(error) {
    const target = this.inferValidationTarget(error);
    this.pendingStep2Focus = target;
    this.currentStep = 2;
    this.activePreviewTab = target.tab || 'info';
    this.updateStepper();
    await this.renderStepContent();
  },

  applyPendingStep2Focus() {
    const target = this.pendingStep2Focus;
    if (!target) return;
    this.pendingStep2Focus = null;

    const tryFocus = () => {
      let el = null;
      if (target.selector) {
        el = document.querySelector(target.selector);
      } else if (target.courseCode) {
        el = document.querySelector(`[data-course-code="${target.courseCode}"]`);
      } else if (target.piCode) {
        el = document.querySelector(`[data-pi-code="${target.piCode}"]`);
      }

      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
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

  async renderStepContent() {
    const container = document.getElementById('step-container');
    container.innerHTML = '<div class="spinner"></div>';

    switch (this.currentStep) {
      case 1:
        this.renderStep1(container);
        break;
      case 2:
        await this.renderStep2(container);
        break;
      case 3:
        await this.renderStep3(container);
        break;
      case 4:
        this.renderStep4(container);
        break;
    }
  },

  renderStep1(container) {
    container.innerHTML = `
      <div style="text-align:center;max-width:500px;margin:40px auto;">
        <div style="font-size:48px;margin-bottom:20px;">📄</div>
        <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">Tải lên file Chương trình đào tạo</h2>
        <p style="color:var(--text-muted);font-size:14px;line-height:1.6;margin-bottom:24px;">
          Hệ thống hỗ trợ file .docx theo mẫu chuẩn của trường. Sau khi phân tích, dữ liệu sẽ được đưa sang 10 tab để kiểm tra và chỉnh sửa trước khi lưu.
        </p>

        <div id="drop-zone" style="border:2px dashed var(--border);border-radius:var(--radius-lg);padding:40px;background:var(--bg-secondary);cursor:pointer;transition:all 0.2s ease;">
          <input type="file" id="docx-file-input" accept=".docx" style="display:none;">
          <div style="font-size:14px;color:var(--text-muted);">
            Kéo thả file vào đây hoặc <span style="color:var(--primary);font-weight:600;">nhấn để chọn file</span>
          </div>
          <div id="file-name" style="margin-top:12px;font-weight:600;color:var(--primary);display:none;"></div>
        </div>
      </div>
    `;

    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('docx-file-input');
    const fileNameDisplay = document.getElementById('file-name');

    dropZone.onclick = () => fileInput.click();
    fileInput.onchange = e => {
      const file = e.target.files[0];
      if (!file) return;
      fileNameDisplay.textContent = file.name;
      fileNameDisplay.style.display = 'block';
      dropZone.style.borderColor = 'var(--primary)';
      dropZone.style.background = 'rgba(0, 102, 204, 0.05)';
    };
  },

  async loadSession() {
    if (!this.sessionId) return null;
    const res = await fetch(`/api/import/docx/session/${this.sessionId}`);
    const data = await this.parseApiResponse(res, 'Không tải được phiên import');
    if (!res.ok) throw new Error(data.error);
    this.sessionData = {
      ...data,
      raw_data: this.normalizeSessionData(data.raw_data)
    };
    return this.sessionData;
  },

  scheduleSessionSave(delay = 350) {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveSession().catch(err => window.toast.error(err.message));
    }, delay);
  },

  async saveSession() {
    if (!this.sessionId || !this.sessionData) return;
    this.ensureSessionShape();
    const res = await fetch(`/api/import/docx/session/${this.sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_data: this.sessionData.raw_data })
    });
    const data = await this.parseApiResponse(res, 'Không thể lưu thay đổi tạm thời');
    if (!res.ok) throw new Error(data.error);
    this.sessionData = {
      ...data,
      raw_data: this.normalizeSessionData(data.raw_data)
    };
  },

  getImportHandlers() {
    const page = this;
    const getData = () => page.ensureSessionShape();
    const getPloMap = () => {
      const map = {};
      (getData().course_plo_map || []).forEach(item => {
        map[`${item.course_id}-${item.plo_id}`] = item.contribution_level;
      });
      return map;
    };

    return {
      getPOs: () => getData().pos,
      savePO: async (vId, id, payload) => {
        const data = getData();
        if (id) {
          const idx = data.pos.findIndex(po => `${po.id}` === `${id}`);
          if (idx >= 0) data.pos[idx] = { ...data.pos[idx], ...payload };
        } else {
          data.pos.push({ id: page.createTempId('po'), code: '', description: '', ...payload });
        }
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },
      deletePO: async id => {
        const data = getData();
        data.pos = data.pos.filter(po => `${po.id}` !== `${id}`);
        data.po_plo_map = data.po_plo_map.filter(map => `${map.po_id}` !== `${id}`);
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },

      getPLOs: () => {
        const data = getData();
        return data.plos.map(plo => ({
          ...plo,
          pis: data.pis.filter(pi => `${pi.plo_id}` === `${plo.id}`)
        }));
      },
      savePLO: async (vId, id, payload) => {
        const data = getData();
        if (id) {
          const idx = data.plos.findIndex(plo => `${plo.id}` === `${id}`);
          if (idx >= 0) data.plos[idx] = { ...data.plos[idx], ...payload };
        } else {
          data.plos.push({ id: page.createTempId('plo'), code: '', bloom_level: 3, description: '', ...payload });
        }
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },
      deletePLO: async id => {
        const data = getData();
        data.plos = data.plos.filter(plo => `${plo.id}` !== `${id}`);
        data.pis = data.pis.filter(pi => `${pi.plo_id}` !== `${id}`);
        data.po_plo_map = data.po_plo_map.filter(map => `${map.plo_id}` !== `${id}`);
        data.course_plo_map = data.course_plo_map.filter(map => `${map.plo_id}` !== `${id}`);
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },

      getPIs: (vId, ploId) => getData().pis.filter(pi => `${pi.plo_id}` === `${ploId}`),
      savePI: async (ploId, id, payload) => {
        const data = getData();
        if (id) {
          const idx = data.pis.findIndex(pi => `${pi.id}` === `${id}`);
          if (idx >= 0) data.pis[idx] = { ...data.pis[idx], ...payload, plo_id: ploId };
        } else {
          data.pis.push({
            id: page.createTempId('pi'),
            plo_id: ploId,
            pi_code: '',
            description: '',
            course_ids: [],
            ...payload
          });
        }
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },
      deletePI: async id => {
        const data = getData();
        data.pis = data.pis.filter(pi => `${pi.id}` !== `${id}`);
        data.course_pi_map = data.course_pi_map.filter(map => `${map.pi_id}` !== `${id}`);
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },

      getVCourses: () => getData().courses,
      getAllCourses: () => fetch('/api/courses').then(r => r.json()),
      addCourse: async (vId, payload) => {
        const data = getData();
        const allCourses = await fetch('/api/courses').then(r => r.json());
        const selected = allCourses.find(course => `${course.id}` === `${payload.course_id}`);
        if (!selected) {
          return { ok: false, json: async () => ({ error: 'Không tìm thấy học phần để thêm' }) };
        }
        data.courses.push({
          id: page.createTempId('course'),
          course_id: selected.id,
          course_code: selected.code,
          course_name: selected.name,
          credits: selected.credits || 0,
          semester: payload.semester || 1,
          course_type: payload.course_type || 'required',
          dept_name: selected.dept_name || '',
          dept_code: selected.dept_code || ''
        });
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },
      removeCourse: async id => {
        const data = getData();
        data.courses = data.courses.filter(course => `${course.id}` !== `${id}`);
        data.course_plo_map = data.course_plo_map.filter(map => `${map.course_id}` !== `${id}`);
        data.course_pi_map = data.course_pi_map.filter(map => `${map.course_id}` !== `${id}`);
        data.pis = data.pis.map(pi => ({
          ...pi,
          course_ids: (pi.course_ids || []).filter(courseId => `${courseId}` !== `${id}`)
        }));
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },

      getPOPLOMappings: () => getData().po_plo_map,
      savePOPLOMappings: async (vId, payload) => {
        getData().po_plo_map = Array.isArray(payload.mappings) ? payload.mappings : [];
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },

      getCoursePLOMappings: () => getData().course_plo_map,
      saveCoursePLOMappings: async (vId, payload) => {
        getData().course_plo_map = Array.isArray(payload.mappings) ? payload.mappings : [];
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },

      getCoursePIMappings: () => {
        const data = getData();
        if (data.course_pi_map.length > 0) return data.course_pi_map;
        return data.pis.flatMap(pi => (pi.course_ids || []).map(courseId => ({
          course_id: courseId,
          pi_id: pi.id,
          contribution_level: 1
        })));
      },
      saveCoursePIMappings: async (vId, payload) => {
        const data = getData();
        data.course_pi_map = Array.isArray(payload.pi_mappings) ? payload.pi_mappings : [];

        const contributionMap = {};
        data.course_pi_map.forEach(mapping => {
          if (mapping.contribution_level > 0) contributionMap[`${mapping.pi_id}-${mapping.course_id}`] = true;
        });

        data.pis = data.pis.map(pi => ({
          ...pi,
          course_ids: data.courses
            .filter(course => contributionMap[`${pi.id}-${course.id}`] || ((pi.course_ids || []).includes(course.id) && !data.course_pi_map.length))
            .map(course => course.id)
        }));

        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },

      getAssessments: () => getData().assessments,
      saveAssessment: async (vId, payload) => {
        const data = getData();
        const selectedCourse = data.courses.find(course => `${course.course_id}` === `${payload.sample_course_id}` || `${course.id}` === `${payload.sample_course_id}`);
        data.assessments.push({
          id: page.createTempId('assessment'),
          ...payload,
          course_code: selectedCourse?.course_code || '',
          course_name: selectedCourse?.course_name || ''
        });
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },
      deleteAssessment: async id => {
        const data = getData();
        data.assessments = data.assessments.filter(assessment => `${assessment.id}` !== `${id}`);
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },

      getSyllabi: () => getData().syllabi,
      createSyllabus: async (vId, payload) => {
        const data = getData();
        const course = data.courses.find(item => `${item.course_id}` === `${payload.course_id}` || `${item.id}` === `${payload.course_id}`);
        if (!course) return { ok: false, json: async () => ({ error: 'Không tìm thấy học phần để tạo đề cương' }) };
        data.syllabi.push({
          id: page.createTempId('syllabus'),
          course_id: course.course_id || course.id,
          course_code: course.course_code,
          course_name: course.course_name,
          credits: course.credits,
          status: 'draft',
          content: payload.content || {},
          authors: []
        });
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },
      saveAssignment: async payload => {
        const data = getData();
        const syllabus = data.syllabi.find(item => `${item.id}` === `${payload.syllabus_id}`);
        if (syllabus) syllabus.authors = [];
        await page.saveSession();
        return { ok: true, json: async () => ({}) };
      },
      getAssignableUsers: async () => [],
      getAssignments: async () => [],

      getVersionInfo: () => ({
        program_name: getData().program_name,
        program_code: getData().program_code,
        degree: getData().degree,
        total_credits: getData().total_credits,
        academic_year: getData().academic_year,
        version_name: getData().version_name
      }),
      getCoursePloLevel(courseId, ploId) {
        return getPloMap()[`${courseId}-${ploId}`] || 0;
      }
    };
  },

  renderInfoTab(body) {
    const data = this.ensureSessionShape();
    body.innerHTML = `
      <div style="max-width:620px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="font-size:15px;font-weight:600;">Thông tin chung</h3>
          <span style="color:var(--text-muted);font-size:12px;">Tự động lưu vào phiên import</span>
        </div>
        <div class="input-group">
          <label>Tên ngành</label>
          <input type="text" id="import-program-name" data-info-field="program_name" value="${data.program_name || ''}" placeholder="Hệ thống thông tin" required>
          <div id="import-program-name-error" style="display:none;color:var(--danger);font-size:12px;margin-top:6px;">Trường này không được để trống.</div>
        </div>
        <div class="input-group">
          <label>Mã ngành</label>
          <input type="text" id="import-program-code" data-info-field="program_code" value="${data.program_code || ''}" placeholder="468498" required>
          <div id="import-program-code-error" style="display:none;color:var(--danger);font-size:12px;margin-top:6px;">Trường mã không được để trống.</div>
        </div>
        <div class="input-group">
          <label>Bậc đào tạo</label>
          <select id="import-degree" data-info-field="degree" required>
            ${['Đại học', 'Thạc sĩ', 'Tiến sĩ'].map(option => `<option value="${option}" ${data.degree === option ? 'selected' : ''}>${option}</option>`).join('')}
          </select>
        </div>
        <div class="input-group">
          <label>Tổng tín chỉ</label>
          <input type="text" id="import-total-credits" data-info-field="total_credits" inputmode="numeric" pattern="\\d+" value="${data.total_credits === '' ? '' : Number(data.total_credits)}" placeholder="132" required>
          <div id="import-total-credits-error" style="display:none;color:var(--danger);font-size:12px;margin-top:6px;">Tổng tín chỉ chỉ được nhập số.</div>
        </div>
        <div class="input-group">
          <label>Năm học</label>
          <input type="text" id="import-academic-year" data-info-field="academic_year" value="${data.academic_year || ''}" placeholder="2025-2026" required>
          <div id="import-academic-year-error" style="display:none;color:var(--danger);font-size:12px;margin-top:6px;">Năm học phải đúng dạng 2025-2026.</div>
        </div>
        <div class="input-group">
          <label>Tên phiên bản</label>
          <input type="text" id="import-version-name" data-info-field="version_name" value="${data.version_name || ''}" placeholder="Phiên bản Import" required>
          <div id="import-version-name-error" style="display:none;color:var(--danger);font-size:12px;margin-top:6px;">Trường này không được để trống.</div>
        </div>
        <div style="margin-top:20px;padding:16px;background:var(--bg-secondary);border-radius:var(--radius-lg);font-size:13px;color:var(--text-muted);line-height:1.6;">
          Các trường ở tab này là nguồn dữ liệu chính cho bước Validate và Commit. Nếu file DOCX chưa parse đủ metadata, bạn có thể bổ sung trực tiếp tại đây.
        </div>
      </div>
    `;

    const toggleError = (id, show, message = '') => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.display = show ? 'block' : 'none';
      if (message) el.textContent = message;
    };

    const bindField = (id, key, options = {}) => {
      const { transform = value => value, validate = null, errorId = null, showEmptyOnBlur = false } = options;
      const input = document.getElementById(id);
      if (!input) return;
      const applyValue = (shouldShowError = false) => {
        const rawValue = input.value;
        const value = transform(rawValue);
        if (`${rawValue}` !== `${value}`) input.value = value;
        this.sessionData.raw_data[key] = value;
        if (validate) {
          const result = validate(value);
          input.setCustomValidity(result.valid ? '' : result.message);
          if (errorId) {
            const shouldShow = shouldShowError && (!result.valid && (showEmptyOnBlur || `${value}`.trim() !== ''));
            toggleError(errorId, shouldShow, result.message);
          }
        } else if (errorId) {
          toggleError(errorId, shouldShowError && showEmptyOnBlur && !`${value}`.trim());
        }
        this.scheduleSessionSave();
      };
      input.addEventListener('input', () => {
        this.touchedInfoFields[key] = true;
        applyValue(false);
      });
      input.addEventListener('change', () => {
        this.touchedInfoFields[key] = true;
        applyValue(true);
        this.scheduleSessionSave(100);
      });
      input.addEventListener('blur', () => {
        this.touchedInfoFields[key] = true;
        applyValue(true);
      });
      applyValue(false);
    };

    bindField('import-program-name', 'program_name', {
      errorId: 'import-program-name-error'
    });
    bindField('import-program-code', 'program_code', {
      transform: value => value.trim(),
      errorId: 'import-program-code-error'
    });
    bindField('import-degree', 'degree');
    bindField('import-total-credits', 'total_credits', {
      transform: value => value.replace(/[^\d]/g, ''),
      validate: value => ({
        valid: /^\d+$/.test(`${value}`),
        message: 'Tổng tín chỉ chỉ được nhập số.'
      }),
      errorId: 'import-total-credits-error'
    });
    bindField('import-academic-year', 'academic_year', {
      transform: value => value.replace(/\s+/g, ''),
      validate: value => this.validateAcademicYear(value),
      errorId: 'import-academic-year-error'
    });
    bindField('import-version-name', 'version_name', {
      errorId: 'import-version-name-error'
    });
  },

  async renderStep2(container) {
    if (!this.sessionData && this.sessionId) {
      await this.loadSession();
    }

    if (!this.sessionData) {
      container.innerHTML = '<p>Không có dữ liệu phiên làm việc.</p>';
      return;
    }

    const data = this.ensureSessionShape();
    const tabBadges = {
      po: data.pos.length,
      plo: data.plos.length,
      pi: data.pis.length,
      courses: data.courses.length,
      assessment: data.assessments.length,
      syllabi: data.syllabi.length
    };

    container.innerHTML = `
      <div style="width:100%;max-width:none;">
        <div class="tab-bar" id="preview-import-tabs" style="margin-bottom:24px;display:flex;align-items:center;justify-content:flex-start;gap:16px;overflow:visible;flex-wrap:wrap;padding-right:4px;">
          ${this.previewTabs.map(tab => `
            <div class="tab-item ${tab.key === this.activePreviewTab ? 'active' : ''}" data-tab="${tab.key}" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 2px;text-align:center;font-size:13px;flex:0 0 auto;min-width:0;white-space:nowrap;">
              <span>${tab.label}</span>
              ${tabBadges[tab.key] ? `<span class="badge badge-neutral">${tabBadges[tab.key]}</span>` : ''}
            </div>
          `).join('')}
        </div>
        <div id="preview-tab-content" style="width:100%;max-width:none;max-height:680px;overflow:auto;padding-right:0;"></div>
      </div>
    `;

    const contentBody = document.getElementById('preview-tab-content');
    const handlers = this.getImportHandlers();

    const renderTab = async tabKey => {
      this.activePreviewTab = tabKey;
      container.querySelectorAll('#preview-import-tabs .tab-item').forEach(tab => tab.classList.toggle('active', tab.dataset.tab === tabKey));
      contentBody.innerHTML = '<div class="spinner"></div>';

      window.TrainingTabs.init(null, true, handlers, () => this.renderStep2(container));

      try {
        switch (tabKey) {
          case 'info':
            this.renderInfoTab(contentBody);
            break;
          case 'po':
            await window.TrainingTabs.renderPOTab(contentBody);
            break;
          case 'plo':
            await window.TrainingTabs.renderPLOTab(contentBody);
            break;
          case 'pi':
            await window.TrainingTabs.renderPITab(contentBody);
            break;
          case 'po_plo':
            await window.TrainingTabs.renderPOPLOMatrix(contentBody);
            break;
          case 'courses':
            await window.TrainingTabs.renderCoursesTab(contentBody);
            break;
          case 'plan':
            await window.TrainingTabs.renderPlanTab(contentBody);
            break;
          case 'course_plo':
            await window.TrainingTabs.renderCoursePLOMatrix(contentBody);
            break;
          case 'assessment':
            await window.TrainingTabs.renderAssessmentTab(contentBody);
            break;
          case 'syllabi':
            await window.TrainingTabs.renderSyllabiTab(contentBody);
            break;
          default:
            contentBody.innerHTML = '<p>Tab chưa được hỗ trợ.</p>';
        }
      } catch (e) {
        contentBody.innerHTML = `<div class="empty-state">Lỗi: ${e.message}</div>`;
      }
    };

    container.querySelectorAll('#preview-import-tabs .tab-item').forEach(tab => {
      tab.addEventListener('click', () => renderTab(tab.dataset.tab));
    });

    await renderTab(this.activePreviewTab || 'info');
    this.applyPendingStep2Focus();
  },

  async renderStep3(container) {
    container.innerHTML = `
      <div style="text-align:center;margin-top:40px;">
        <div class="spinner" style="margin-bottom:20px;"></div>
        <p style="color:var(--text-muted);">Đang kiểm tra các ràng buộc dữ liệu...</p>
      </div>
    `;

    try {
      await this.saveSession();
      const res = await fetch(`/api/import/docx/session/${this.sessionId}/validate`, { method: 'POST' });
      const data = await this.parseApiResponse(res, 'Không thể kiểm tra dữ liệu import');
      if (!res.ok) throw new Error(data.error);

      if (data.rawData) {
        this.sessionData.raw_data = this.normalizeSessionData(data.rawData);
      }

      const errors = data.errors || [];
      const errorCount = errors.filter(e => e.type === 'error').length;
      const warningCount = errors.filter(e => e.type === 'warning').length;

      container.innerHTML = `
        <div style="margin-bottom:24px;">
          <h2 style="font-size:18px;font-weight:700;margin-bottom:8px;">Kết quả kiểm tra dữ liệu</h2>
          <p style="color:var(--text-muted);font-size:14px;">Hệ thống đã kiểm tra metadata, cấu trúc và liên kết dữ liệu trước khi commit.</p>
        </div>

        <div style="display:flex;gap:16px;margin-bottom:24px;">
          <div style="flex:1;background:rgba(215, 58, 73, 0.05);border:1px solid var(--danger);border-radius:var(--radius-lg);padding:16px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:var(--danger);">${errorCount}</div>
            <div style="font-size:12px;color:var(--danger);font-weight:600;text-transform:uppercase;">Lỗi nghiêm trọng</div>
          </div>
          <div style="flex:1;background:rgba(255, 166, 0, 0.05);border:1px solid var(--warning);border-radius:var(--radius-lg);padding:16px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:var(--warning);">${warningCount}</div>
            <div style="font-size:12px;color:var(--warning);font-weight:600;text-transform:uppercase;">Cảnh báo</div>
          </div>
          <div style="flex:1;background:rgba(40, 167, 69, 0.05);border:1px solid var(--success);border-radius:var(--radius-lg);padding:16px;text-align:center;">
            <div style="font-size:24px;font-weight:700;color:var(--success);">✓</div>
            <div style="font-size:12px;color:var(--success);font-weight:600;text-transform:uppercase;">Sẵn sàng commit</div>
          </div>
        </div>

        <div style="max-height:300px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-secondary);">
          ${errors.length === 0 ? `
            <div style="padding:24px;text-align:center;color:var(--success);">
              <span style="font-size:24px;margin-bottom:8px;display:block;">🎉</span>
              <strong>Dữ liệu đã sẵn sàng.</strong> Không tìm thấy lỗi nghiêm trọng nào.
            </div>
          ` : errors.map((error, index) => `
            <button type="button" class="validation-issue-row" data-issue-index="${index}" style="width:100%;padding:12px 16px;border:0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;background:transparent;text-align:left;cursor:pointer;">
              <span style="color:${error.type === 'error' ? 'var(--danger)' : 'var(--warning)'};font-weight:bold;">${error.type === 'error' ? '✕' : '!'}</span>
              <span style="font-size:13px;color:var(--text-main);">${error.msg}</span>
            </button>
          `).join('')}
        </div>

        ${errorCount > 0 ? `
          <div style="margin-top:20px;padding:12px;background:rgba(215, 58, 73, 0.1);border-radius:var(--radius);color:var(--danger);font-size:13px;">
            Bạn cần quay lại bước 2 để sửa các lỗi nghiêm trọng trước khi sang bước Hoàn tất.
          </div>
        ` : ''}
      `;

      container.querySelectorAll('.validation-issue-row').forEach(btn => {
        btn.addEventListener('click', async () => {
          const issue = errors[parseInt(btn.dataset.issueIndex, 10)];
          if (!issue) return;
          await this.jumpToValidationTarget(issue);
        });
      });

      this.setNextButtonsState({ disabled: errorCount > 0 });
    } catch (e) {
      container.innerHTML = `<div class="empty-state">Lỗi: ${e.message}</div>`;
    }
  },

  renderStep4(container) {
    const data = this.ensureSessionShape() || {};
    container.innerHTML = `
      <div style="padding:12px 0 0;">
        <div style="text-align:center;padding:12px 0 28px;">
          <div style="font-size:48px;margin-bottom:20px;">🚀</div>
          <h2 style="font-size:20px;font-weight:700;margin-bottom:12px;">Sẵn sàng lưu dữ liệu</h2>
          <p style="color:var(--text-muted);font-size:14px;margin-bottom:24px;">
            Phiên import sẽ tạo CTĐT và phiên bản nháp trong hệ thống chính. Các tab nâng cao chưa có dữ liệu đầy đủ sẽ vẫn được giữ ở session nhưng không bắt buộc cho commit v1.
          </p>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;">
          <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-secondary);">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Chương trình</div>
            <div style="font-weight:700;">${data.program_name || 'Chưa nhập'}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${data.program_code || 'Chưa có mã'}</div>
          </div>
          <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-secondary);">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Phiên bản</div>
            <div style="font-weight:700;">${data.version_name || 'Phiên bản Import'}</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${data.academic_year || 'Chưa có năm học'}</div>
          </div>
          <div style="padding:16px;border:1px solid var(--border);border-radius:var(--radius-lg);background:var(--bg-secondary);">
            <div style="font-size:12px;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px;">Dữ liệu lõi</div>
            <div style="font-weight:700;">${data.pos.length} PO · ${data.plos.length} PLO</div>
            <div style="font-size:13px;color:var(--text-muted);margin-top:4px;">${data.courses.length} học phần</div>
          </div>
        </div>
      </div>
    `;
  },

  async nextStep() {
    if (this.currentStep === 1) {
      const fileInput = document.getElementById('docx-file-input');
      const file = fileInput.files[0];
      if (!file) {
        window.toast.warning('Hãy chọn file');
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const originalText = this.currentStep === this.steps.length ? 'Hoàn tất' : 'Tiếp tục';
      this.setNextButtonsState({ disabled: true, text: 'Đang xử lý...', kind: 'primary' });

      try {
        const res = await fetch('/api/import/docx/session', { method: 'POST', body: formData });
        const data = await this.parseApiResponse(res, 'Không thể tải file import');
        if (!res.ok) throw new Error(data.error);

        this.sessionId = data.id;
        this.sessionData = { id: data.id, raw_data: this.normalizeSessionData(data.rawData) };
        this.activePreviewTab = 'info';
        window.toast.success('Đã tải lên và phân tích file thành công');

        this.currentStep++;
        this.updateStepper();
        await this.renderStepContent();
      } catch (e) {
        window.toast.error(e.message);
      } finally {
        this.setNextButtonsState({ disabled: false, text: originalText, kind: 'primary' });
      }
      return;
    }

    if (this.currentStep < this.steps.length) {
      this.currentStep++;
      this.updateStepper();
      await this.renderStepContent();
      return;
    }

    this.setNextButtonsState({ disabled: true, text: 'Đang lưu...', kind: 'success' });

    try {
      await this.saveSession();
      const res = await fetch(`/api/import/docx/session/${this.sessionId}/commit`, { method: 'POST' });
      const data = await this.parseApiResponse(res, 'Không thể lưu chương trình đào tạo');
      if (!res.ok) throw new Error(data.error);

      window.toast.success('Đã nhập dữ liệu thành công vào hệ thống');
      window.App.navigate('version-editor', { versionId: data.versionId });
    } catch (e) {
      window.toast.error(e.message);
    } finally {
      this.setNextButtonsState({ disabled: false, text: 'Hoàn tất', kind: 'success' });
    }
  },

  prevStep() {
    if (this.currentStep <= 1) return;
    this.currentStep--;
    this.updateStepper();
    this.renderStepContent();
  },

  destroy() {
    clearTimeout(this.saveTimer);
  }
};
