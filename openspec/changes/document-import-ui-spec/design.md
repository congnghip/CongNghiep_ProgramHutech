## Context

Repo hiện đã có luồng import DOCX hoạt động, màn wizard import riêng, màn chi tiết phiên bản CTDT với 10 tab, cùng một số tài liệu kỹ thuật mô tả workflow parse/validate/commit. Tuy nhiên, phần mô tả dành cho AI để tái tạo hoặc chỉnh sửa giao diện import vẫn chưa có một nguồn chuẩn duy nhất, khiến cùng một yêu cầu có thể bị diễn giải khác nhau giữa các lần dùng AI hoặc giữa tài liệu và code đang chạy.

Change này nhằm tạo một lớp đặc tả tập trung cho giao diện import hiện tại, dựa trên code thực tế trong template/admin views và các tài liệu workflow đã có, để thống nhất cách mô tả cấu trúc 4 bước, cách tái sử dụng 10 tab, và visual language của workspace HUTECH.

## Goals / Non-Goals

**Goals:**
- Xác định một nguồn spec duy nhất mô tả giao diện import DOCX hiện tại theo cách AI có thể đọc và làm theo.
- Ghi lại rõ các quyết định UI cốt lõi: wizard 4 bước, stepper, summary cards, banner trạng thái, validation flow, success flow, và 10 tab tái sử dụng.
- Neo phần mô tả giao diện vào ngôn ngữ thiết kế đang có của admin workspace để tránh AI sinh ra layout lạc tông.

**Non-Goals:**
- Không thay đổi hành vi parse, validate, commit, hay data model của tính năng import.
- Không thay đổi template hoặc triển khai frontend/backend của màn import trong change này.
- Không thay thế các tài liệu kỹ thuật parser hiện có; chỉ xác định vai trò và phạm vi của file spec UI mới.

## Decisions

- Tạo một capability OpenSpec mới thay vì sửa các spec workflow hiện có.
  Lý do: nhu cầu chính là chuẩn hóa contract mô tả UI import dành cho AI, không phải thay đổi requirement của workspace chung hay approval workflow. Cách này giúp giữ scope hẹp và tránh sửa các spec có mục đích khác.

- Dùng một file spec duy nhất cho capability `docx-import-ui-spec`.
  Lý do: user muốn “command arguments tạo thành 1 file spec”, và phạm vi thay đổi hiện đủ tập trung để một spec file bao trùm các requirement chính mà không bị chia nhỏ quá mức.

- Đặc tả sẽ bám vào giao diện đang có trong code thay vì thiết kế lại.
  Lý do: mục tiêu là giúp AI “làm giống giao diện hiện tại của dự án”, nên source of truth phải là template/admin view đang chạy và danh sách tab thật trong code.

- Phân tách rõ ba lớp tài liệu:
  - Tài liệu workflow/import kỹ thuật: giải thích parse, validate, commit, edge cases.
  - Spec UI mới: giải thích màn import phải trông như thế nào, gồm những bước nào, tái sử dụng tab nào, và hành vi UI nào là bắt buộc.
  - Tasks: liệt kê công việc để tạo hoặc cập nhật file spec nguồn chuẩn trong repo.
  Lý do: tách lớp giúp AI khác đọc đúng tài liệu cho đúng mục tiêu, tránh lẫn mô tả visual với chi tiết parser.

## Risks / Trade-offs

- [Risk] Spec UI có thể trùng lặp một phần với `docx_import_workflow_spec.md` hoặc các ghi chú hiện có -> Mitigation: ghi rõ spec mới là contract UI/UX và chỉ tham chiếu tài liệu kỹ thuật cho phần backend workflow.
- [Risk] Giao diện code thực tế thay đổi sau này nhưng spec không cập nhật -> Mitigation: tasks phải yêu cầu đối chiếu spec với template/admin view hiện hành và cập nhật khi UI thay đổi đáng kể.
- [Risk] Requirement viết quá trừu tượng, AI vẫn dựng sai giao diện -> Mitigation: requirement phải nêu cụ thể 4 bước, đủ 10 tab, tone màu/kiểu card/nút, và điều kiện hiển thị các trạng thái lỗi-thành công.
