# Syllabus PDF Import Operations

## Phase-1 scope

- Ho tro PDF text-based la muc tieu chinh.
- PDF scan-like, file OCR kem, va bang bi vo layout van duoc cho retry/review, nhung khong cam ket auto-map on dinh.
- Gioi han file hien tai la `15MB`.
- Muc tieu latency van hanh la `30-60 giay` cho phan lon PDF text-based khi dung Groq normalization.
- Heuristic fallback duoc dung cho local verification, prompt tuning va so sanh fixture; khong duoc xem la thay the cho Groq path trong production.

## Fixture set

- `decuong/AIT129_Trí tuệ nhân tạo ứng dụng.pdf`
  - Mau CNTT co heading danh so, bang CLO va bang danh gia tach cot.
  - Dung de do kha nang cat section, nhan CLO, tai lieu va cong cu.
- `decuong/PHT317_Syllabus.pdf`
  - Mau GDTC co section pha tron giua heading thuong va heading danh so.
  - Dung de do kha nang giu duoc CLO, prerequisite, va outline thuc hanh dai.

## Verification workflow

1. Chay `node scripts/verify_syllabus_pdf_import.js`.
2. Xem `average_score` tren fixture.
3. Neu co mismatch lap lai, uu tien sua theo thu tu:
   - course identity / CLO
   - week schedule
   - assessment weights
   - resources va warning quality
4. Kiem tra `negative_checks` de dam bao empty input, oversize input, validation, va retry path van dung.

## Rollout notes

- Can cau hinh `GROQ_API_KEY` va, neu can, `GROQ_MODEL` cho Groq path.
- Nen log `engine`, `provider`, `model`, `processing_ms`, `layout_chars`, `plain_chars`, `page_count`, va `prompt_version` de theo doi chat luong.
- Neu import that bai:
  - Kiem tra file co phai PDF text-based hay khong.
  - Retry session tu extraction text co san.
  - Neu output bi lech section, bo sung fixture/expected review truoc khi doi prompt production.
  - Neu Groq het quota, timeout, hoac response malformed, chuyen sang heuristic fallback de debug parser/validation.

## Current limitations

- Mapping danh gia trong cac PDF tach dong manh van chua on dinh nhu CLO/course identity.
- Tools/resources dai co the lan sang phan huong dan tu hoc neu heading PDF qua vo layout.
- Heuristic fallback uu tien khong trich xuat bua; khi bang chung yeu thi warning se tang len thay vi tu dien day du bang moi gia.
