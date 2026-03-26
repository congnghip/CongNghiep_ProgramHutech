## ADDED Requirements

### Requirement: Import engine selection SHALL distinguish LLM and heuristic paths
Hệ thống SHALL chọn đường xử lý import PDF dựa trên một engine rõ ràng, trong đó Groq là LLM engine mặc định cho production flow và heuristic/mock chỉ là fallback hoặc debug path.

#### Scenario: Tạo session với engine mặc định
- **WHEN** người dùng tải lên một file PDF mà không chọn debug fallback đặc biệt
- **THEN** hệ thống SHALL tạo phiên import sử dụng engine Groq làm đường chuẩn hóa mặc định

#### Scenario: Chạy fallback heuristic có chủ đích
- **WHEN** người dùng hoặc hệ thống kích hoạt heuristic/debug path theo cơ chế được hỗ trợ
- **THEN** hệ thống SHALL chạy parser heuristic mà không gắn nhãn đây là cùng loại engine với LLM provider

### Requirement: Retry flow SHALL preserve the original engine choice
Hệ thống SHALL retry phiên import PDF theo cùng engine đã được ghi nhận trên session, trừ khi có thao tác điều khiển rõ ràng để chuyển engine.

#### Scenario: Retry phiên Groq
- **WHEN** người dùng retry một session đã được tạo bằng engine Groq
- **THEN** hệ thống SHALL gọi lại normalization qua Groq thay vì ngầm chuyển sang heuristic path

#### Scenario: Retry phiên heuristic
- **WHEN** người dùng retry một session đã được tạo bằng heuristic/debug path
- **THEN** hệ thống SHALL tiếp tục xử lý bằng heuristic path đã chọn
