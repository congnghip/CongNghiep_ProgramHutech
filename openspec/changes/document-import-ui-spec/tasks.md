## 1. Source Alignment

- [ ] 1.1 Rà soát lại `import_wizard.html`, `program_version_detail.html`, `admin_views.py`, và các tài liệu import hiện có để xác nhận nguồn sự thật cho wizard 4 bước và 10 tab.
- [ ] 1.2 Ghi nhận các yếu tố visual language bắt buộc của trang import hiện tại, gồm màu nhấn, kiểu card, stepper, badges, action buttons, và trạng thái banner.

## 2. Spec Authoring

- [ ] 2.1 Tạo hoặc cập nhật một file spec nguồn duy nhất mô tả giao diện import DOCX theo hướng AI-readable.
- [ ] 2.2 Bổ sung vào file spec phần mô tả đầy đủ 4 bước, 10 tab tái sử dụng, summary cards, validation state, commit state, và success state.
- [ ] 2.3 Tách rõ trong file spec đâu là contract UI/UX và đâu là phần chỉ tham chiếu sang tài liệu workflow kỹ thuật hiện có.

## 3. Validation And Adoption

- [ ] 3.1 Đối chiếu file spec vừa tạo với giao diện đang có trong code để bảo đảm không thiếu tab, thiếu bước, hoặc lệch tông UI.
- [ ] 3.2 Kiểm tra lại wording của file spec để AI khác có thể dùng trực tiếp làm prompt hoặc context mà không cần suy diễn thêm.
- [ ] 3.3 Cập nhật tài liệu liên quan hoặc điểm tham chiếu trong repo để đội ngũ biết file spec mới là nguồn chuẩn khi cần mô tả lại màn import.
