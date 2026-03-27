## Context

Hiện tại, mã nguồn frontend cho việc hiển thị và chỉnh sửa nội dung chi tiết đề cương (Mục 11-13: Mô tả, Mục tiêu, Tiên quyết, Phương pháp, Lịch trình) đang bị phân tán và lặp lại giữa `syllabus-pdf-import.js` và `syllabus-editor.js`. Sự phân tán này không chỉ gây khó khăn cho bảo trì mà còn làm mất mát dữ liệu do cấu trúc `schedule` không đồng nhất:
- `syllabus-pdf-import.js` sử dụng bảng 4 cột (Tuần, Chủ đề, Hoạt động, CLO).
- `syllabus-editor.js` sử dụng bảng 8 cột đầy đủ theo mẫu chuẩn.
- `services/syllabus-pdf-import.js` (backend) đang thực hiện logic normalization làm gộp hoặc mất các trường dữ liệu AI đã bóc tách được.

## Goals / Non-Goals

**Goals:**
- Thống nhất Data Model cho `schedule` thành 8 trường đầy đủ trong toàn bộ hệ thống.
- Xây dựng một component JavaScript (hoặc bộ hàm dùng chung) để quản lý UI/UX cho các mục 11-13.
- Loại bỏ code lặp lại trong `syllabus-pdf-import.js` và `syllabus-editor.js`.
- Đảm bảo Bước 2 của Import PDF hiển thị đầy đủ dữ liệu AI bóc tách được để người dùng rà soát.

**Non-Goals:**
- Thay đổi cấu trúc cơ sở dữ liệu (chỉ thay đổi nội dung JSON bên trong trường `content`).
- Thay đổi logic bóc tách của AI (chỉ thay đổi cách xử lý kết quả bóc tách).
- Refactor các tab khác (1-8, 9-10, 14, 15-17) trừ khi cần thiết để hỗ trợ tab 11-13.

## Decisions

### 1. Kiến trúc Component
**Quyết định**: Tạo một "View Object" hoặc "UI Fragment" dùng chung thay vì một Class phức tạp, vì kiến trúc hiện tại của dự án đang sử dụng các plain object gắn vào `window`.
- **Lý do**: Đảm bảo tính nhất quán với phong cách code hiện tại của dự án (`SyllabusEditorPage`, `SyllabusPdfImportPage`).
- **Thực hiện**: Tạo `public/js/components/syllabus-details-section.js`.

### 2. Thống nhất Schema Schedule
**Quyết định**: Sử dụng schema 8 cột của `SyllabusEditorPage` làm chuẩn cho toàn hệ thống.
- **Các trường**: `week`, `topic`, `content`, `theory_hours`, `practice_hours`, `teaching_method`, `materials`, `clos`.
- **Lý do**: Đây là schema đầy đủ nhất, khớp với mẫu đề cương chuẩn của nhà trường.

### 3. Cập nhật Backend Normalization
**Quyết định**: Sửa hàm `normalizeCanonicalPayload` và `mapPayloadToSyllabusContent` trong `services/syllabus-pdf-import.js`.
- **Lý do**: Ngăn chặn việc gộp trường `content` và `activities`, cũng như giữ lại `theory_hours`, `practice_hours`, `materials`.

### 4. Giao diện Bước 2 (Import PDF)
**Quyết định**: Nâng cấp bảng rà soát lịch trình lên 8 cột, sử dụng cùng một hàm render với Syllabus Editor.
- **Lý do**: Cho phép người dùng kiểm tra và sửa lỗi AI bóc tách ở các cột chi tiết ngay từ bước rà soát.

## Risks / Trade-offs

- **[Risk] Giao diện bảng 8 cột quá rộng cho màn hình nhỏ** → **Mitigation**: Sử dụng `overflow-x: auto` và thiết lập `min-width` cho bảng, đảm bảo trải nghiệm cuộn ngang mượt mà trên desktop (đối tượng người dùng chính là giảng viên soạn thảo).
- **[Risk] Dữ liệu cũ trong Database có cấu trúc 4 cột** → **Mitigation**: Viết hàm migration đơn giản hoặc fallback logic trong component để map dữ liệu cũ sang cấu trúc mới (ví dụ: gộp `activities` cũ vào trường `content` mới).
