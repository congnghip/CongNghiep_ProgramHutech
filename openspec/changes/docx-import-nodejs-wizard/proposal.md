## Why

Hiện tại, việc nhập liệu chương trình đào tạo (CTDT) từ các file Word (.docx) đang phụ thuộc vào một bộ Parser bằng Python không đồng nhất với codebase chính (Node.js). Điều này gây khó khăn cho việc bảo trì, triển khai và không tận dụng được các thành phần UI/UX sẵn có. Cần một giải pháp Node.js thuần túy để tự động hóa việc trích xuất dữ liệu, cung cấp giao diện Wizard 4 bước chuyên nghiệp và đảm bảo tính toàn vẹn của dữ liệu thông qua quy trình kiểm soát chặt chẽ.

## What Changes

- **Hệ thống Parser Node.js**: Xây dựng bộ trích xuất dữ liệu DOCX mới bằng Node.js (thay thế Python), hỗ trợ đọc cấu trúc bảng phức tạp và các ô bị gộp (merged cells).
- **Giao diện Wizard 4 bước**: Triển khai luồng nhập liệu chuẩn: Chọn tệp -> Phân tích & Chỉnh sửa (Preview) -> Xác thực (Validate) -> Lưu chính thức (Commit).
- **Module hóa 10 Tab CTDT**: Tách các tab nội dung từ `version-editor.js` thành các component dùng chung để tái sử dụng trong màn hình Preview của Wizard.
- **Tính năng Real-time Validation & Auto-save**: Sử dụng bảng tạm trong Database để lưu trạng thái phiên làm việc, cho phép người dùng sửa lỗi trực tiếp trên giao diện với phản hồi tức thì.
- **Giao dịch nguyên tử (Atomic Commit)**: Đảm bảo dữ liệu chỉ được lưu vào hệ thống chính khi tất cả các ràng buộc đã được thỏa mãn trong một Database Transaction duy nhất.

## Capabilities

### New Capabilities
- `docx-import-wizard`: Cung cấp giao diện Wizard 4 bước và logic điều hướng luồng nhập liệu từ file .docx.
- `nodejs-docx-parser`: Dịch vụ backend chuyên trách việc phân tích cấu trúc XML của file .docx để trích xuất thông tin CTDT, PO, PLO, Môn học và Ma trận.
- `import-session-management`: Quản lý trạng thái lưu tạm và kiểm tra ràng buộc dữ liệu (Validation) trong quá trình import.

### Modified Capabilities
- `training-program-management`: Thêm điểm truy cập "Import từ DOCX" trong danh sách chương trình đào tạo.

## Impact

- **Backend**: Thêm các route API mới cho `/api/import/docx/*`, dịch vụ parser mới, và bảng `docx_import_sessions` trong PostgreSQL.
- **Frontend**: Thêm trang `SyllabusImportPage.js`, module hóa `version-editor.js` để tách các tab thành components tại `public/js/components/training-tabs.js`.
- **Dependencies**: Thêm thư viện `adm-zip` và `fast-xml-parser` vào `package.json`.
