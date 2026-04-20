# Base Syllabus — Hoàn thiện theo mẫu BM03/QT2b/DBCL

**Ngày:** 2026-04-18
**Trạng thái:** Design approved, pending implementation plan
**Mẫu đối chiếu:** `AIT129.pdf` — mẫu Đề cương chi tiết học phần của HUTECH (form BM03/QT2b/DBCL), 17 mục.

## 1. Bối cảnh & vấn đề

Trang "Đề cương cơ bản" ([public/js/pages/base-syllabus-editor.js](../../../public/js/pages/base-syllabus-editor.js)) hiện chỉ lưu được một phần nhỏ của mẫu BM03/QT2b/DBCL. Đối chiếu với `AIT129.pdf`:

| # | Mục trong mẫu | Trạng thái hiện tại |
|---|---|---|
| 1 | Tên HP (Việt + Anh) | Thiếu tên tiếng Anh (`courses.name_en`) |
| 2 | Mã HP | OK (`courses.code`) |
| 3 | Thuộc khối kiến thức (GDDC/GDCN × BB/TC) | **Thiếu** |
| 4 | Trình độ đào tạo | **Thiếu** |
| 5 | Số tín chỉ (LT/TH) | Có column nhưng chưa surface UI |
| 6 | HP học trước | OK (`content.prerequisites`) |
| 7 | Mục tiêu HP | OK (`content.course_objectives`) |
| 8 | Đơn vị quản lý HP | OK (`courses.department_id`) — chỉ cần join |
| 9 | Ma trận HP → PLO | Nằm ở CTĐT, không thuộc base |
| 10 | CLO + PI + PLO mapping | **Thiếu mapping PI/PLO** |
| 11 | Mô tả tóm tắt | OK (`content.course_description`) |
| 12 | Phương pháp dạy học (bảng) | Chỉ có textarea tự do |
| 13 | Nội dung chi tiết (LT/TH tiết + CLO) | **Thiếu tách LT/TH và CLO mapping** |
| 14 | Đánh giá (Quy định, Bài đánh giá, CLO) | **Thiếu 3 cột** |
| 15 | Tài liệu (giáo trình / tham khảo / công cụ theo lĩnh vực) | Có một phần, flat, chưa phân category |
| 16 | Hướng dẫn sinh viên tự học | **Thiếu hoàn toàn** |
| 17 | Các yêu cầu của HP | Có một phần (software/hardware/lab), thiếu free-text |

Hệ quả: đề cương không đủ dữ liệu để xuất PDF/DOCX đúng mẫu BM03; mapping CLO → PI/PLO (cần cho AOL/ABET) không có chỗ lưu.

## 2. Mục tiêu

Đề cương cơ bản chứa đủ 17 mục của mẫu BM03/QT2b/DBCL và xuất được 2 format:
- **PDF** (Puppeteer headless Chromium)
- **DOCX** (thư viện `docx`)

Cả 2 format dùng chung một render model build từ DB, đảm bảo output nhất quán.

## 3. Phạm vi

### Trong phạm vi
- Mở rộng schema: `courses` (5 cột), `base_syllabus_clos` mapping tables (2 bảng mới), `content` JSON v3
- Editor UI: mở rộng 5 tab hiện có
- Export endpoints: PDF + DOCX
- Validation trước khi xuất
- Backward-compat đọc content v2 cũ (lazy upgrade)

### Ngoài phạm vi
- Sửa module version syllabus để hiển thị unresolved mappings
- Data migration bulk cho content v2 → v3 (lazy upgrade khi user mở editor)
- Multi-khoa header PDF (hiện assume khoa được resolve qua `courses.department_id`)
- "Bản chính thức" / "Bản dự thảo" (in rỗng, user tự tick tay)

## 4. Quyết định kiến trúc chính

### 4.1 CLO → PLO/PI mapping: canonical version FK

Base syllabus là per-course nhưng PLO/PI trong hệ thống hiện tại là per-version. Giải pháp:

- `courses.canonical_version_id` — FK đến `program_versions(id)`, là "CTĐT chủ lực" của HP.
- 2 bảng mapping mới (`base_clo_plo_map`, `base_clo_pi_map`) dùng FK cứng tới `version_plos` và `plo_pis` của canonical version.
- Khi clone base vào version khác: resolve PLO/PI theo mã text (`PLO1`, `PI1.01`) giữa canonical và target; nếu không match → flag `unresolved_mappings` ở target (xử lý ở spec khác).

**Lý do:** FK cứng để data integrity cao, vẫn in được mã text ra PDF, tránh refactor lớn của catalog canonical toàn khoa.

### 4.2 Cấu trúc nội dung mục 13 + 16: flat + merged

- Mỗi bài trong `course_outline` có cả trường giờ LT/TH và trường tự học (giờ + tasks).
- PDF render 2 bảng tách biệt (mục 13 và 16) nhưng data cùng 1 nguồn.
- Tránh duplication và drift giữa 13 và 16.

### 4.3 Cấu trúc đánh giá mục 14: flat, group khi render

- `assessment_methods` là flat list; mỗi row có `component` (tên nhóm).
- PDF gộp `GROUP BY component` khi render (rowspan cho cột Thành phần).
- Trọng số nhóm = tổng con (tự tính, không lưu).

### 4.4 Export: cả PDF lẫn DOCX

- PDF: template HTML + CSS print → Puppeteer; output nhất quán, không cần user tương tác.
- DOCX: thư viện `docx` (pure JS); user có thể sửa nhẹ trong Word trước khi ký.
- Cả 2 build từ cùng render model → đồng bộ.

## 5. Data model

### 5.1 `courses` — thêm cột

```sql
ALTER TABLE courses ADD COLUMN IF NOT EXISTS name_en VARCHAR(300);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS knowledge_area VARCHAR(20);
  -- 'general' = Kiến thức GD đại cương
  -- 'professional' = Kiến thức GD chuyên nghiệp
ALTER TABLE courses ADD COLUMN IF NOT EXISTS course_requirement VARCHAR(20);
  -- 'required' = Bắt buộc
  -- 'elective' = Tự chọn
ALTER TABLE courses ADD COLUMN IF NOT EXISTS training_level VARCHAR(30) DEFAULT 'Đại học';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS canonical_version_id
  INT REFERENCES program_versions(id) ON DELETE SET NULL;
```

### 5.2 Mapping CLO → PLO/PI (2 bảng mới)

```sql
CREATE TABLE IF NOT EXISTS base_clo_plo_map (
  id SERIAL PRIMARY KEY,
  base_clo_id INT REFERENCES base_syllabus_clos(id) ON DELETE CASCADE,
  plo_id INT REFERENCES version_plos(id) ON DELETE CASCADE,
  UNIQUE(base_clo_id, plo_id)
);
CREATE TABLE IF NOT EXISTS base_clo_pi_map (
  id SERIAL PRIMARY KEY,
  base_clo_id INT REFERENCES base_syllabus_clos(id) ON DELETE CASCADE,
  pi_id INT REFERENCES plo_pis(id) ON DELETE CASCADE,
  UNIQUE(base_clo_id, pi_id)
);
CREATE INDEX IF NOT EXISTS idx_bc_plo_clo ON base_clo_plo_map(base_clo_id);
CREATE INDEX IF NOT EXISTS idx_bc_pi_clo ON base_clo_pi_map(base_clo_id);
```

PLO/PI options trên UI lọc theo `courses.canonical_version_id`.

### 5.3 `course_base_syllabi.content` — schema v3

```js
{
  _schema_version: 3,

  // Mục 6, 7, 11 (text fields cơ bản)
  course_objectives: string,       // mục 7
  course_description: string,      // mục 11
  prerequisites: string,           // mục 6
  language_instruction: string,

  // Mục 12 — bảng có cấu trúc
  teaching_methods: [
    { method: string, objective: string }
  ],

  // Mục 13 + 16 (gộp — mỗi bài đầy đủ cả tự học)
  course_outline: [
    {
      lesson: int,
      title: string,
      lt_hours: number,             // mục 13 — cột LT
      th_hours: number,             // mục 13 — cột TH
      topics: string[],             // mục 13 — nội dung chi tiết
      teaching_methods: string,     // mục 13 — phương pháp dạy học (free text)
      clo_codes: string[],          // mục 13 — đáp ứng CĐR (VD ['CLO1','CLO4'])
      self_study_hours: number,     // mục 16 — số tiết tự học
      self_study_tasks: string[]    // mục 16 — nhiệm vụ SV
    }
  ],

  // Mục 14 — flat, PDF group by component
  assessment_methods: [
    {
      component: string,            // tên nhóm (VD "Điểm đánh giá quá trình")
      description: string,          // Quy định (VD "Bài tập nhóm")
      task_ref: string,             // Bài đánh giá (VD "Bài 1,2,3,5")
      weight: number,               // Trọng số %
      clo_codes: string[]           // CLO đáp ứng
    }
  ],

  // Mục 15
  textbooks: string[],              // Giáo trình chính
  references: string[],             // Tài liệu tham khảo/bổ sung
  tools: [                          // Các công cụ theo lĩnh vực
    { category: string, items: string[] }
  ],

  // Mục 17
  other_requirements: string        // free text
}
```

### 5.4 Backward-compat khi đọc content v2

Khi `_schema_version < 3`:
- `hours` → `lt_hours`, set `th_hours = 0`
- `learning_methods: string` → parse thành `teaching_methods: [{method:<line>, objective:''}]` (mỗi dòng = 1 row)
- `course_requirements.software[]` → merge thành `tools: [{category:'Phần mềm', items:[...]}]`; tương tự `hardware` → `"Phần cứng"`, `lab_equipment` → `"Thiết bị phòng thí nghiệm"`
- `course_requirements.classroom_setup` → append vào `other_requirements`
- `assessment_methods[].assessment_tool` → map thành `description`; `task_ref` và `clo_codes` default rỗng

Lần save đầu sau upgrade: bump `_schema_version = 3`. Không mass-migrate — lazy upgrade khi editor mở.

## 6. Editor UI

5 tab hiện có, mở rộng nội dung.

### Tab 0 — Thông tin chung

```
[Tên tiếng Việt]          [Tên tiếng Anh]
[Mã HP]                   [Số TC: LT / TH / ĐA / TT]       (readonly)
[Khoa quản lý]                                             (readonly)
[Khối kiến thức: ● GD đại cương ○ GD chuyên nghiệp]
[Yêu cầu:        ● Bắt buộc       ○ Tự chọn]
[Trình độ đào tạo: Đại học ▾]
[CTĐT chuẩn (để map CLO→PLO/PI): <select>]
[HP tiên quyết]           [Ngôn ngữ giảng dạy]
[Mục tiêu HP (mục 7)]       — textarea
[Mô tả tóm tắt HP (mục 11)] — textarea
[Phương pháp tổ chức dạy học (mục 12)]
  Bảng: [Phương pháp] [Mục tiêu]  + Thêm dòng
```

Các trường master (`name_en`, `knowledge_area`, `course_requirement`, `training_level`, `canonical_version_id`) PUT vào `/api/courses/:id`, KHÔNG nằm trong `content`. Các trường khác nằm trong `content`.

### Tab 1 — CLO

Thêm 2 cột **PLO đáp ứng** (multi-select) và **PI đáp ứng** (multi-select). Options lấy từ canonical version. Nếu course chưa set `canonical_version_id` → disable 2 cột, hiện cảnh báo "Chưa chọn CTĐT chuẩn ở tab Thông tin chung".

### Tab 2 — Nội dung giảng dạy

Mỗi row bài:
- **Phần chính** (luôn hiện): `Bài N | Tên bài | LT tiết | TH tiết | Nội dung chi tiết | Phương pháp dạy học | CLO đáp ứng (multi-select)`
- **Phần "Tự học"** (toggle "▸ Hướng dẫn tự học"): `Số tiết tự học` + `Nhiệm vụ SV` (textarea, 1 dòng = 1 task)

Footer bảng: Tổng LT / Tổng TH / Tổng tự học.

### Tab 3 — Đánh giá

Cột: `Thành phần | Quy định | Bài đánh giá | Trọng số % | CLO đáp ứng | ✕`
Dưới bảng: hiển thị tổng trọng số theo `component`; cảnh báo nếu tổng toàn bảng ≠ 100%.

### Tab 4 — Tài liệu & yêu cầu

- **Giáo trình chính** (textarea, mỗi dòng = 1 item)
- **Tài liệu tham khảo/bổ sung** (textarea)
- **Công cụ theo lĩnh vực** (mục 15) — list `[{category, items[]}]`, mỗi entry có input `Lĩnh vực` + textarea `Công cụ (mỗi dòng = 1)` + nút "+ Thêm lĩnh vực"
- **Các yêu cầu của HP** (mục 17) — textarea đơn

### Hành động trên page header

- `Lưu tất cả` — lưu content + call riêng API cập nhật courses fields nếu user sửa
- `Xuất PDF` — mở `/api/courses/:id/base-syllabus/export.pdf`
- `Xuất DOCX` — mở `/api/courses/:id/base-syllabus/export.docx`

### Validation trước khi xuất

Khi user bấm xuất, gọi `POST /api/courses/:id/base-syllabus/validate`. Nếu có issue → hiện dialog danh sách lỗi, không cho xuất.

## 7. API

### Endpoint mới
| Method | Path | Mô tả |
|---|---|---|
| GET | `/api/courses/:id/base-syllabus/export.pdf` | Stream PDF (Puppeteer) |
| GET | `/api/courses/:id/base-syllabus/export.docx` | Stream DOCX |
| GET | `/api/courses/:id/base-syllabus/render-model` | Render model JSON (debug + preview) |
| GET | `/api/base-clos/:id/mappings` | Trả `{plo_ids[], pi_ids[]}` |
| PUT | `/api/base-clos/:id/mappings` | Body `{plo_ids[], pi_ids[]}` — replace all |
| POST | `/api/courses/:id/base-syllabus/validate` | Trả `{ok, issues[]}` |

### Endpoint thay đổi
- `PUT /api/courses/:id` — chấp nhận thêm fields `name_en, knowledge_area, course_requirement, training_level, canonical_version_id`
- `DELETE /api/base-clos/:id` — cascade xóa `base_clo_plo_map`/`base_clo_pi_map` (qua FK ON DELETE CASCADE)

### Phân quyền
- View + Export: `courses.view`
- Edit master fields: `courses.edit`
- Edit content: `courses.edit` (giữ pattern hiện tại)

## 8. Export renderer

### Render model (shared backend object)

```js
{
  form_code: 'BM03/QT2b/DBCL',
  faculty: string,                          // resolve từ courses.department_id
  course: {
    code, name_vi, name_en,
    knowledge_area, course_requirement,
    training_level,
    credits_display,                        // VD "3 (3, 0) TC" build từ credits_theory/practice
    prerequisites,
    managing_unit,                          // resolve từ departments.name qua courses.department_id (== faculty)
    objectives, description,
    language_instruction
  },
  teaching_methods: [{method, objective}],
  plo_matrix_row: { /* trích từ canonical version_pi_courses */ },
  clos: [{code, description, bloom_level, pi_codes[], plo_codes[]}],
  outline: [{lesson, title, lt_hours, th_hours, topics[], teaching_methods, clo_codes[]}],
  outline_totals: {lt, th},
  assessment_groups: [{component, items: [{description, task_ref, weight, clo_codes[]}]}],
  resources: {textbooks[], references[], tools: [{category, items[]}]},
  self_study: [{lesson, title, hours, tasks[]}],
  other_requirements: string,
  signatures: {date: '', khoa_vien: '', nganh: '', nguoi_bien_soan: ''}
}
```

### PDF (Puppeteer)
- Template EJS/HBS → HTML có `@media print` CSS chuẩn A4 portrait
- Puppeteer `pdf({format: 'A4', margin: {top: '20mm', bottom: '20mm', left: '20mm', right: '15mm'}})`
- Dep mới: `puppeteer`; Docker image phải thêm `chromium` (update `Dockerfile`)

### DOCX (thư viện `docx`)
- Nested tables cho mục 9, 10, 13, 14, 16 theo layout AIT129
- Dep mới: `docx` (pure JS, ~3MB)
- Response: `Content-Disposition: attachment; filename="<code>_de-cuong.docx"`

### Template layout
- Header: `BM03/QT2b/DBCL` (góc phải italic), `TRƯỜNG ĐẠI HỌC CÔNG NGHỆ TP. HCM` + tên khoa (resolve từ department)
- Title: **ĐỀ CƯƠNG CHI TIẾT HỌC PHẦN**
- 17 ô đánh số 1–17 y hệt mẫu AIT129
- Footer: "TP. Hồ Chí Minh, ngày… tháng… năm ${YYYY}" + 3 cột ký `Trưởng khoa/viện | Trưởng ngành/bộ môn | Người biên soạn`
- Ô "Bản chính thức" in rỗng (user tick tay khi in)

## 9. Validation rules

Server-side mirror UI, chạy qua `POST /api/courses/:id/base-syllabus/validate`:

```js
{ ok: boolean, issues: [
  { code: 'NO_CANONICAL', message: 'Chưa chọn CTĐT chuẩn' },
  { code: 'NO_NAME_EN', message: 'Chưa nhập tên tiếng Anh' },
  { code: 'NO_KNOWLEDGE_AREA', message: 'Chưa chọn khối kiến thức' },
  { code: 'CLO_NO_PLO', clo_code: 'CLO1', message: 'CLO1 chưa map PLO' },
  { code: 'CLO_NO_PI', clo_code: 'CLO2', message: 'CLO2 chưa map PI' },
  { code: 'LESSON_NO_CLO', lesson: 3, message: 'Bài 3 chưa chọn CLO đáp ứng' },
  { code: 'WEIGHT_SUM', actual: 90, message: 'Tổng trọng số đánh giá = 90% (cần 100%)' }
]}
```

UI hiển thị issues theo nhóm trong dialog trước khi cho xuất.

## 10. Tích hợp với version syllabus (clone flow)

Data model hỗ trợ nhưng CODE clone nằm ngoài spec này:

- Khi tạo version syllabus từ base: clone CLO sang `version_syllabus_clos` giữ `code`
- Resolve CLO→PLO/PI qua mã text giữa canonical version và target version
- Nếu không match được (target thiếu PLO cùng code) → flag `unresolved_mappings[]` để user xử lý thủ công
- UI hiển thị unresolved mappings là **spec khác** (sẽ làm sau nếu cần)

## 11. Testing

Dự án không có test framework — spec này không dựng framework mới.

- **Manual test checklist** trong plan: tạo 1 HP mới → điền đủ 17 mục → xuất PDF/DOCX → đối chiếu với AIT129.pdf
- **Smoke test script** ([scripts/smoke-base-syllabus.js](../../../scripts/smoke-base-syllabus.js)) call các API mới, check status + structure

## 12. Dependencies & infrastructure

**Thêm vào `package.json`:**
- `puppeteer` (+ Chromium ~200MB, cần update Dockerfile)
- `docx` (~3MB, pure JS)
- Template engine nhẹ — `ejs` hoặc `handlebars` (chọn 1 trong plan)

**Dockerfile thay đổi:**
- Cài Chromium system package (`chromium` hoặc dùng puppeteer's bundled Chromium)
- Hoặc dùng `puppeteer-core` + system Chromium để giảm image size

## 13. Rủi ro & mitigation

| Rủi ro | Mitigation |
|---|---|
| Puppeteer làm image Docker phình to | Dùng `puppeteer-core` + system Chromium; hoặc tạo layer cache riêng |
| Content v2 cũ parse sai khi lazy upgrade | Unit-test logic upgrade trên 3-5 sample content v2 trước khi deploy |
| Canonical version bị xóa | FK `ON DELETE SET NULL` — UI hiện cảnh báo "Chưa có CTĐT chuẩn" khi canonical null |
| PLO/PI của canonical bị xóa sau khi đã map | FK `ON DELETE CASCADE` xóa luôn mapping — validation sẽ catch |
| DOCX render lệch layout | So sánh bằng mắt với AIT129.pdf gốc trong manual test checklist |

## 14. Success criteria

- Editor lưu được đủ 17 mục cho HP AIT129, reproduce được nội dung mẫu
- PDF export + DOCX export ra file đối chiếu được với AIT129.pdf gốc (form BM03 layout khớp)
- Validation chặn được các case thiếu dữ liệu cơ bản
- Content v2 cũ mở lại được không mất dữ liệu
