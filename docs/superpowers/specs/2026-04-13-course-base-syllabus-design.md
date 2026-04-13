# Đề cương cơ bản (Base Syllabus) cho học phần

**Ngày:** 2026-04-13

## Tổng quan

Thêm tính năng "đề cương cơ bản" gắn với từng học phần trong catalog. Đề cương cơ bản chứa nội dung giảng dạy chung của HP (không map tới CTDT), dùng làm template khi soạn đề cương chi tiết cho một version cụ thể.

**Mục tiêu:** Giảm công sức soạn đề cương chi tiết — mỗi khi HP xuất hiện trong CTDT mới, GV không cần viết lại từ đầu mà có sẵn nội dung cơ bản để chỉnh sửa.

## Database Schema

Tạo bảng mới `course_base_syllabi`:

```sql
CREATE TABLE IF NOT EXISTS course_base_syllabi (
  id SERIAL PRIMARY KEY,
  course_id INT REFERENCES courses(id) ON DELETE CASCADE UNIQUE,
  content JSONB DEFAULT '{}',
  updated_by INT REFERENCES users(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

- Quan hệ 1:1 với `courses` (constraint `UNIQUE(course_id)`)
- `ON DELETE CASCADE` — xóa HP thì xóa luôn đề cương cơ bản
- `updated_by` — track người chỉnh sửa lần cuối

### Cấu trúc `content` JSONB

Giống `version_syllabi.content` (schema version 2) nhưng không có CLO-related fields:

```json
{
  "_schema_version": 2,
  "course_description": "",
  "course_objectives": "",
  "prerequisites": "",
  "language_instruction": "",
  "learning_methods": "",
  "course_outline": [
    { "lesson": 1, "title": "", "hours": 0, "topics": [], "teaching_methods": "", "clos": [] }
  ],
  "assessment_methods": [
    { "component": "", "weight": 0, "assessment_tool": "", "clos": [] }
  ],
  "textbooks": [],
  "references": [],
  "course_requirements": {
    "software": [],
    "hardware": [],
    "lab_equipment": [],
    "classroom_setup": ""
  }
}
```

Field `clos` trong `course_outline` và `assessment_methods` giữ lại dưới dạng mảng rỗng để giữ cấu trúc tương thích khi copy sang đề cương chi tiết.

## API Endpoints

| Method | Endpoint | Mô tả | Permission |
|--------|----------|--------|------------|
| GET | `/api/courses/:courseId/base-syllabus` | Lấy đề cương cơ bản | `courses.view` |
| PUT | `/api/courses/:courseId/base-syllabus` | Tạo mới hoặc cập nhật (upsert) | `courses.edit` |
| DELETE | `/api/courses/:courseId/base-syllabus` | Xóa đề cương cơ bản | `courses.edit` |

### Chi tiết

- **GET** — trả về `{ id, course_id, content, updated_by, updated_at }` hoặc `404` nếu chưa có.
- **PUT** — nhận `{ content }` trong body. INSERT nếu chưa tồn tại, UPDATE nếu đã có (`ON CONFLICT(course_id) DO UPDATE`). Cập nhật `updated_by` = user hiện tại, `updated_at` = NOW().
- **DELETE** — xóa record. Trả `204 No Content`.

### Tích hợp tạo đề cương chi tiết

Sửa endpoint `POST /api/versions/:vId/syllabi`:

1. Khi tạo mới, query `course_base_syllabi` theo `course_id`
2. Nếu **có** → copy `content` vào `version_syllabi.content` mới tạo
3. Nếu **không** → tạo trống, trả thêm flag `no_base_syllabus: true`

Cũng sửa endpoint `POST /api/my-assignments/:assignmentId/create-syllabus` tương tự (đây là entry point khi GV tạo đề cương từ trang phân công).

## Frontend

### Quản lý đề cương cơ bản — trang Courses catalog

Trong trang Courses hiện tại (`public/js/pages/courses.js`):

**Danh sách HP:**
- Thêm badge/indicator trong bảng cho biết HP đã có đề cương cơ bản hay chưa

**Truy cập editor:**
- Thêm nút "Đề cương cơ bản" bên cạnh thông tin HP (trong row actions hoặc detail view)
- Click mở editor đề cương cơ bản

### Editor đề cương cơ bản

Full page (tương tự syllabus editor), navigate từ trang Courses. Route: `#base-syllabus-editor?courseId=...`

Tái sử dụng layout tương tự syllabus editor, với 4 tabs:

| Tab | Nội dung |
|-----|----------|
| 0 - Thông tin chung | course_description, course_objectives, prerequisites, language_instruction, learning_methods |
| 1 - Nội dung giảng dạy | course_outline (tuần, giờ, chủ đề, phương pháp) |
| 2 - Đánh giá | assessment_methods (thành phần, trọng số, công cụ) |
| 3 - Tài liệu & yêu cầu | textbooks, references, course_requirements |

**Khác biệt với syllabus editor:**
- Không có Tab CLOs và Tab CLO-PLO Mapping
- Không có status bar / workflow phê duyệt
- Chỉ có nút "Lưu"
- Hiển thị metadata: "Cập nhật lần cuối bởi [tên] vào [ngày giờ]"

### Thông báo khi tạo đề cương chi tiết

Khi tạo đề cương chi tiết mới mà HP chưa có đề cương cơ bản:
- Frontend nhận `no_base_syllabus: true` từ API response
- Hiển thị toast/banner: "Học phần này chưa có đề cương cơ bản. Nội dung đề cương sẽ được tạo trống."

## Luồng dữ liệu

```
COURSES CATALOG
  │
  ├── Nút "Đề cương cơ bản" → Editor (4 tabs)
  │   └── Lưu → PUT /api/courses/:id/base-syllabus
  │             → course_base_syllabi table
  │
  ▼
Khi tạo đề cương chi tiết (POST /api/versions/:vId/syllabi):
  │
  ├── Có đề cương cơ bản → copy content vào version_syllabi mới
  └── Không có → tạo trống + thông báo
  │
  ▼
SYLLABUS EDITOR (đề cương chi tiết, 6 tabs đầy đủ)
  GV chỉnh sửa, bổ sung CLO, submit → workflow phê duyệt
```

## Phạm vi & giới hạn

- Đề cương cơ bản và đề cương chi tiết **hoàn toàn độc lập** sau khi copy. Sửa đề cương cơ bản không ảnh hưởng đề cương chi tiết đã tạo.
- Một HP có 0 hoặc 1 đề cương cơ bản.
- Áp dụng cho cả HP thường lẫn HP đề xuất (`is_proposed = true`).
- Không cần quyền mới — tái sử dụng `courses.view` và `courses.edit`.
- Không có workflow phê duyệt cho đề cương cơ bản.
