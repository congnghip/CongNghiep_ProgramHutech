## ADDED Requirements

### Requirement: Backend Full Data Normalization
Hệ thống Backend PHẢI chuẩn hóa và lưu giữ đầy đủ 8 cột thông tin cho `schedule` từ dữ liệu AI bóc tách được (hoặc từ mockup), không được gộp hoặc loại bỏ bất kỳ trường nào.

#### Scenario: Normalize AI output with 8 columns
- **WHEN** AI trả về kết quả bóc tách lịch trình chứa 8 trường dữ liệu (week, topic, content, theory_hours, practice_hours, teaching_method, materials, clos)
- **THEN** hàm `normalizeCanonicalPayload` PHẢI trả về một object `schedule` giữ nguyên 8 trường này

#### Scenario: Fallback for missing fields
- **WHEN** AI hoặc Heuristic bóc tách không có đủ 8 trường dữ liệu
- **THEN** hệ thống PHẢI điền giá trị mặc định (rỗng hoặc 0) cho các trường còn thiếu để đảm bảo cấu trúc JSON luôn đủ 8 trường

### Requirement: Database Record Consistency
Dữ liệu đề cương lưu vào database PHẢI tuân thủ cấu trúc `schedule` 8 trường đồng nhất.

#### Scenario: Save imported syllabus to DB
- **WHEN** người dùng hoàn tất Bước 3 và nhấn "Hoàn tất" (Bước 4)
- **THEN** hệ thống lưu vào bảng `syllabi` một trường `content` chứa mảng `schedule` với đầy đủ 8 trường dữ liệu cho mỗi tuần
