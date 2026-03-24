## Context

Hiện tại, hệ thống quản lý chương trình đào tạo (CTDT) yêu cầu người dùng nhập liệu thủ công từng phần (PO, PLO, PI, Môn học, Ma trận). Việc nhập từ file Word (.docx) hiện đang dùng một parser Python độc lập, không tích hợp sâu vào quy trình nghiệp vụ trên giao diện Node.js. Cần một giải pháp đồng bộ bằng Node.js để tự động hóa việc trích xuất và cung cấp giao diện Wizard để người dùng kiểm soát dữ liệu trước khi lưu chính thức.

## Goals / Non-Goals

**Goals:**
- Thay thế hoàn toàn Parser Python bằng Node.js Parser sử dụng `adm-zip` và `fast-xml-parser`.
- Triển khai giao diện Wizard 4 bước: 
  1. Tải lên (Upload)
  2. Xem trước & Chỉnh sửa (Preview & Edit) - sử dụng lại các component Tab CTDT.
  3. Kiểm tra ràng buộc (Validation) - đảm bảo tính hợp lệ của PO, PLO, Môn học.
  4. Hoàn tất (Commit) - lưu vào database bằng Transaction.
- Module hóa các Tab từ `version-editor.js` để dùng chung.
- Quản lý trạng thái nhập liệu qua bảng `docx_import_sessions`.

**Non-Goals:**
- Không hỗ trợ các định dạng file khác ngoài .docx.
- Không tự động sửa lỗi dữ liệu trong file Word (chỉ cảnh báo và cho phép sửa trên UI).
- Không thay đổi logic nghiệp vụ của các bảng CTDT hiện tại.

## Decisions

- **Parser Engine**: Sử dụng `adm-zip` để giải nén file .docx và `fast-xml-parser` để chuyển `word/document.xml` thành đối tượng JSON. Lựa chọn này vì nhẹ và không phụ thuộc vào các thư viện native hoặc dịch vụ bên ngoài.
- **Session Management**: Lưu trữ dữ liệu thô đã trích xuất vào bảng `docx_import_sessions` (cột JSONB). Điều này cho phép người dùng dừng lại và tiếp tục sau, đồng thời giúp việc Validation diễn ra dễ dàng hơn.
- **Component Reuse**: Tách các tab PO, PLO, Môn học, Ma trận từ `version-editor.js` thành các component độc lập trong `public/js/components/training-tabs.js`. Điều này giảm trùng lặp mã và đảm bảo tính nhất quán giữa màn hình chỉnh sửa và màn hình import.
- **Atomic Commit**: Toàn bộ quá trình lưu dữ liệu từ bảng tạm sang các bảng chính (programs, program_versions, ...) phải nằm trong một `BEGIN...COMMIT` block.

## Risks / Trade-offs

- [Risk] Cấu trúc file .docx phức tạp (bảng lồng nhau, ô gộp) có thể làm parser trích xuất sai → [Mitigation] Triển khai bộ phân tích XML linh hoạt và cho phép người dùng chỉnh sửa dữ liệu ở bước Preview.
- [Risk] Dữ liệu import lớn gây treo server khi parse → [Mitigation] Thực hiện parsing bất đồng bộ và sử dụng stream nếu cần, mặc dù file CTDT thường không quá 10MB.
- [Risk] Xung đột dữ liệu khi nhiều người cùng import → [Mitigation] Sử dụng `user_id` và `session_id` để cô lập phiên làm việc.
