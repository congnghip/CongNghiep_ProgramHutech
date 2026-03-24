## Why

Nhóm đang có luồng import DOCX và giao diện wizard 4 bước hoạt động trong codebase, nhưng phần mô tả dành cho AI lại đang nằm rải rác giữa template, spec kỹ thuật, và ghi chú khám phá. Cần một change chính thức để gom các quyết định UI, 10 tab tái sử dụng, và nguyên tắc visual language thành một spec thống nhất để các lần thiết kế hoặc sinh code tiếp theo bám đúng giao diện hiện tại của dự án.

## What Changes

- Tạo một capability mới mô tả giao diện import CTDT từ DOCX theo góc nhìn sản phẩm và UI contract, tập trung vào wizard 4 bước, 10 tab tái sử dụng, summary cards, trạng thái validation, và luồng success.
- Chuẩn hoá yêu cầu về visual language của trang import để AI và người triển khai giữ đồng bộ với HUTECH admin workspace hiện tại.
- Xác định ranh giới giữa nội dung “spec để AI đọc” và chi tiết triển khai kỹ thuật đã có trong tài liệu workflow/import hiện tại.
- Liệt kê các bước triển khai để tạo hoặc cập nhật file spec nguồn duy nhất cho màn import trong repo.

## Capabilities

### New Capabilities
- `docx-import-ui-spec`: Định nghĩa nguồn spec chuẩn cho giao diện import DOCX, bao gồm cấu trúc wizard 4 bước, 10 tab, và ngôn ngữ giao diện cần giữ đồng bộ với workspace hiện tại.

### Modified Capabilities

## Impact

- OpenSpec artifacts cho change mới tại `openspec/changes/document-import-ui-spec/`.
- Tài liệu/spec liên quan đến import DOCX và giao diện CTDT trong repo.
- Quy trình làm việc khi dùng AI để dựng hoặc chỉnh sửa màn import trong tương lai.
