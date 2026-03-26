## ADDED Requirements

### Requirement: Canonical Content Mapping to Syllabus Storage
Hệ thống SHALL map phần nội dung chung của canonical syllabus payload vào `version_syllabi.content` theo một cấu trúc ổn định tương thích với editor đề cương hiện có.

#### Scenario: Lưu phần content của đề cương
- **WHEN** một session import được commit thành công
- **THEN** hệ thống SHALL ghi các trường như mô tả, mục tiêu, điều kiện tiên quyết, phương pháp, lịch giảng dạy, hình thức đánh giá, và tài liệu vào `version_syllabi.content`

### Requirement: CLO Persistence Mapping
Hệ thống SHALL map danh sách CLO từ canonical payload vào bảng `course_clos` gắn với học phần của đề cương.

#### Scenario: Tạo hoặc cập nhật CLO từ import
- **WHEN** canonical payload chứa danh sách CLO đã được review
- **THEN** hệ thống SHALL lưu mỗi CLO với mã và mô tả tương ứng vào `course_clos` của học phần đích

### Requirement: Controlled CLO-PLO Mapping
Hệ thống SHALL chỉ lưu mapping `CLO -> PLO` khi các liên kết đó hợp lệ với version hiện tại và không còn cờ cảnh báo bắt buộc review.

#### Scenario: Chặn lưu mapping chưa được xác nhận
- **WHEN** canonical payload chứa liên kết `CLO -> PLO` có confidence thấp hoặc tham chiếu tới PLO không tồn tại
- **THEN** hệ thống SHALL không tự động commit liên kết đó vào `clo_plo_map`

### Requirement: Transactional Persistence Integrity
Hệ thống SHALL thực hiện persistence của đề cương import trong một transaction duy nhất để tránh trạng thái lưu nửa chừng.

#### Scenario: Rollback khi lỗi giữa chừng
- **WHEN** việc lưu `version_syllabi.content` thành công nhưng phát sinh lỗi ở bước lưu CLO hoặc mapping
- **THEN** hệ thống SHALL rollback toàn bộ transaction và không để lại dữ liệu commit dở dang

### Requirement: Source-aware Import Metadata
Hệ thống SHALL lưu metadata đủ để truy vết nguồn import và chất lượng kết quả chuẩn hóa của bản đề cương đã commit hoặc của session trước commit.

#### Scenario: Truy vết bản import
- **WHEN** quản trị viên hoặc người phát triển cần kiểm tra một bản đề cương được tạo từ import PDF
- **THEN** hệ thống SHALL có thể truy vết được nguồn file, thời điểm import, và metadata AI liên quan từ session hoặc metadata lưu kèm
