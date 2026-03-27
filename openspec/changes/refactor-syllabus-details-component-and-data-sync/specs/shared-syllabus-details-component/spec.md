## ADDED Requirements

### Requirement: Shared Syllabus Details Component
Hệ thống PHẢI cung cấp một component dùng chung (JavaScript) để hiển thị và chỉnh sửa các Mục 11, 12, 13 của đề cương, bao gồm: Mô tả tóm tắt, Mục tiêu học phần, Điều kiện tiên quyết, Phương pháp dạy học và Bảng nội dung chi tiết (8 cột).

#### Scenario: Render component with data
- **WHEN** component được khởi tạo với một object chứa dữ liệu syllabus mục 11-13
- **THEN** hệ thống hiển thị đầy đủ các textarea cho phần text và bảng 8 cột cho lịch trình với dữ liệu tương ứng

#### Scenario: Add new schedule row
- **WHEN** người dùng nhấn nút "Thêm dòng" trong component
- **THEN** một dòng mới được thêm vào cuối bảng lịch trình với đầy đủ 8 cột input

#### Scenario: Capture data from component
- **WHEN** ứng dụng cha gọi hàm lấy dữ liệu từ component
- **THEN** component trả về một object JSON chứa toàn bộ thông tin đã nhập, bao gồm mảng `schedule` với 8 trường cho mỗi phần tử

### Requirement: Full 8-column Schedule Table
Bảng nội dung chi tiết (Mục 13) TRONG component PHẢI hiển thị đầy đủ 8 cột: Bài/Tuần, Tên bài/chủ đề, Nội dung chi tiết, LT (số tiết), TH (số tiết), Phương pháp/Hình thức dạy học, Tài liệu/Nhiệm vụ, và CLO đáp ứng.

#### Scenario: Display all columns in Review mode
- **WHEN** người dùng ở Bước 2 của quy trình Import PDF
- **THEN** bảng lịch trình hiển thị đầy đủ 8 cột để người dùng rà soát thông tin AI bóc tách được

#### Scenario: Edit numeric fields
- **WHEN** người dùng nhập giá trị vào cột LT hoặc TH
- **THEN** hệ thống chỉ cho phép nhập số và lưu giá trị đó vào model tương ứng
