## ADDED Requirements

### Requirement: Node.js DOCX Extraction
Hệ thống SHALL sử dụng bộ thư viện Node.js để phân tích tệp .docx (thay thế Python parser cũ).

#### Scenario: Phân tích file .docx
- **WHEN** Hệ thống nhận file .docx tại endpoint API
- **THEN** Dịch vụ Parser SHALL giải nén file bằng `adm-zip` và đọc `word/document.xml`

### Requirement: XML Parsing and Data Structure Extraction
Hệ thống SHALL chuyển đổi XML từ file .docx thành cấu trúc dữ liệu JSON phản ánh CTDT.

#### Scenario: Trích xuất bảng dữ liệu PO và PLO
- **WHEN** Parser tìm thấy các bảng có nhãn "Mục tiêu chương trình đào tạo" hoặc "Chuẩn đầu ra"
- **THEN** Hệ thống SHALL trích xuất các ô trong bảng và chuẩn hóa văn bản (loại bỏ khoảng trắng thừa)

### Requirement: Support for Merged Cells and Nested Tables
Bộ Parser Node.js SHALL hỗ trợ trích xuất chính xác dữ liệu từ các ô bị gộp (merged cells) trong bảng môn học hoặc ma trận.

#### Scenario: Đọc ô gộp trong Ma trận PO-PLO
- **WHEN** Ma trận có các ô gộp biểu diễn mối quan hệ giữa PO và PLO
- **THEN** Hệ thống SHALL nhân bản giá trị ô gộp cho tất cả các hàng/cột tương ứng trong cấu trúc dữ liệu JSON đầu ra
