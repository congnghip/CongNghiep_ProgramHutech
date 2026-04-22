# Design: Chọn khối kiến thức khi thêm học phần vào CTDT

**Date:** 2026-04-22  
**Status:** Approved

## Tóm tắt

Khi người dùng thêm học phần vào CTDT (tab "Học phần" trong version-editor), form thêm HP cần có thêm trường **Khối kiến thức** (bắt buộc), hiển thị dạng grouped dropdown với 2 cấp (cha → con leaf).

## Bối cảnh kỹ thuật

- `version_courses` đã có cột `knowledge_block_id INT REFERENCES knowledge_blocks(id) ON DELETE SET NULL` (ALTER TABLE đã chạy trong `db.js`)
- `POST /api/versions/:vId/courses` hiện chỉ nhận `course_id`, `semester`, `course_type` — chưa xử lý `knowledge_block_id`
- API `GET /api/versions/:vId/knowledge-blocks` đã trả về cây blocks (dùng trong tab Khối KT)
- `knowledge_blocks` có cột `level` và `parent_id`; khối leaf = không có con

## Thay đổi

### 1. Backend — `server.js`

**Route `POST /api/versions/:vId/courses`:**
- Nhận thêm `knowledge_block_id` từ body
- Validate: không được null/undefined
- Validate: `knowledge_block_id` phải tồn tại và `version_id` của block phải khớp với `:vId`
- Validate: block phải là leaf (không có con) — nhất quán với logic assign-courses hiện tại
- INSERT thêm cột `knowledge_block_id`

### 2. Frontend — `public/js/pages/version-editor.js`

**Hàm `renderCoursesTab`:**
- Load danh sách knowledge blocks của version (fetch `/api/versions/:vId/knowledge-blocks`) song song với dữ liệu hiện tại
- Thêm `<select id="add-vc-block">` vào form thêm HP, dạng grouped:
  - Khối cha → `<optgroup label="...">` (disabled, không chọn được)
  - Khối con leaf → `<option value="{id}">` (chọn được)
  - Nếu khối không có con → là `<option>` trực tiếp (không wrap trong optgroup)
- Thêm placeholder option rỗng `<option value="">-- Chọn khối KT --</option>` làm default

**Hàm `addCourse()`:**
- Đọc `knowledge_block_id` từ `#add-vc-block`
- Validate: nếu rỗng → `window.toast.error('Vui lòng chọn khối kiến thức')` và return
- Gửi `knowledge_block_id` trong body POST

## Không thay đổi

- Tab Khối KT và flow assign-courses trong tab đó giữ nguyên
- Schema DB không thay đổi (cột đã có)
- Proposed course modal xử lý riêng (không thay đổi trong scope này)

## Tiêu chí hoàn thành

- [ ] Thêm HP thành công với khối KT được chọn → `knowledge_block_id` được lưu đúng trong `version_courses`
- [ ] Bỏ trống khối KT → toast lỗi, không POST
- [ ] Dropdown hiển thị đúng cấu trúc cha/con của version hiện tại
- [ ] Không làm hỏng flow hiện tại (xóa HP, tab Khối KT, ma trận)
