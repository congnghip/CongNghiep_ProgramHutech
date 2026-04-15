# Rename "Phiên Bản" → "Khóa" + Single-Year `academic_year`

## Summary

Thống nhất lại tên hiển thị của khái niệm `program_versions` (bản chất là các "khóa" tuyển sinh cách nhau 1 năm của một CTĐT): UI gọi là **"Khóa"** thay vì "phiên bản", và trường `academic_year` rút về **1 năm duy nhất** ("2026") thay vì khoảng "2026-2027".

Thay đổi rename-only ở UI + 1 migration chuẩn hoá dữ liệu. Schema cột, URL route, biến JS, field name trong code đều **giữ nguyên** để giảm rủi ro.

## Background

### Khái niệm hiện tại

- Bảng `program_versions` ([db.js:88-116](../../../db.js#L88-L116)) lưu các "phiên bản" của một CTĐT theo năm học.
- Cột `academic_year VARCHAR(20) NOT NULL`, có `UNIQUE(program_id, academic_year)`.
- Dữ liệu hiện tại: 1 row duy nhất với value `"2026-2027"`.
- Không validate server-side; client validate bằng regex `^\d{4}-\d{4}$` ở [programs.js:617-620](../../../public/js/pages/programs.js#L617-L620).

### UI label "phiên bản"

Theo explore, cụm "phiên bản" (đủ case variation) xuất hiện ~23 chỗ qua 6 file:
- `public/js/pages/programs.js` (~15 chỗ)
- `public/js/pages/version-editor.js` (~4 chỗ)
- `public/js/pages/import-word.js` (~5 chỗ)
- `public/js/pages/dashboard.js` (~2 chỗ)
- `public/js/pages/audit-logs.js` (~2 chỗ)
- `public/js/pages/approval.js` (~1 chỗ — dùng "Năm học" đã sẵn)

### Xung đột ngữ nghĩa "khóa"

Từ "khóa"/"Khóa" đã được dùng để chỉ **trạng thái locked** (`is_locked`, badge "Đã khóa", error "Phiên bản đã bị khóa..."). User chấp nhận nhập nhằng ngữ cảnh — không đổi nghĩa "locked". Người dùng tự phân biệt qua ngữ pháp ("Khóa K26 đã khóa" = cohort K26 đã bị lock).

## Approach

**Rename-only, minimum surgery.** Schema `VARCHAR(20)` giữ nguyên. Migration idempotent chạy trong `initDB()`. UI find/replace thủ công để đảm bảo ngữ pháp Vietnamese. Validation chỉ sửa regex client.

Đã loại approach refactor cột thành `cohort_year INT`: sạch hơn về schema nhưng churn cao, lợi ích chủ yếu aesthetic.

## Data Migration

Thêm vào cuối `initDB()` trong [db.js](../../../db.js):

```sql
UPDATE program_versions
   SET academic_year = SUBSTRING(academic_year FROM 1 FOR 4)
 WHERE academic_year ~ '^\d{4}-\d{4}$';
```

- Idempotent: chạy lần 2 không match → no-op.
- 1 row hiện tại "2026-2027" → "2026".
- Format đã đúng ("2026") hoặc format lạ (NULL, "invalid") → không đụng.
- `UNIQUE(program_id, academic_year)` vẫn OK (chỉ 1 row trong DB).

## Validation Changes

### `programs.js`

Tại [programs.js:617-620](../../../public/js/pages/programs.js#L617-L620) (chỗ validate academic_year trước khi tạo/sửa khóa):

- **Trước:** regex `^\d{4}-\d{4}$`, error message tham chiếu "YYYY-YYYY" / "Số Phiên Bản".
- **Sau:** regex `^\d{4}$`, error message "Khóa phải có định dạng 4 chữ số, ví dụ 2026."

### `import-word.js`

Nếu có validate format năm nhập từ Word, cũng đổi sang `^\d{4}$`. Nếu không validate, không đụng.

### Server-side

Không đụng. Server không validate format `academic_year` — vẫn `INSERT` string as-is.

### Word parser (`word-parser.js`)

Không đụng. Parser set `academic_year = new Date().getFullYear().toString()` ([word-parser.js:460](../../../word-parser.js#L460)) — đã là 4 chữ số, tương thích format mới.

## UI Label Find/Replace

### Quy tắc mapping

| Hiện tại | Mới |
|---|---|
| "Phiên bản" / "Phiên Bản" | "Khóa" |
| "phiên bản" | "khóa" |
| "Số Phiên Bản" | "Số Khóa" |
| "Tên Phiên Bản" | "Tên Khóa" |
| "phiên bản mới" | "khóa mới" |
| "phiên bản này" | "khóa này" |
| "Tạo phiên bản" | "Tạo khóa" |
| "Nhân bản phiên bản" | "Nhân bản khóa" |
| "Xóa phiên bản" | "Xóa khóa" |
| "Phiên bản: ${name}" | "Khóa: ${name}" |
| "Chưa có phiên bản nào" | "Chưa có khóa nào" |
| "phiên bản CTĐT" | "khóa CTĐT" |
| "Vui lòng nhập số phiên bản" | "Vui lòng nhập số khóa" |
| "Đã xóa phiên bản ${year}" | "Đã xóa khóa ${year}" |
| "Đã tạo phiên bản ${academic_year}" | "Đã tạo khóa ${academic_year}" |
| "Thông tin phiên bản" | "Thông tin khóa" |
| "Phiên bản" (metric dashboard) | "Khóa" |
| "Phiên bản CTĐT" (section header) | "Khóa CTĐT" |
| "...sẽ tạo phiên bản mới..." | "...sẽ tạo khóa mới..." |
| "Không thể tải dữ liệu phiên bản" | "Không thể tải dữ liệu khóa" |
| "Đã cập nhật phiên bản" | "Đã cập nhật khóa" |

Thực hiện thủ công từng chỗ, đọc ngữ cảnh để đảm bảo ngữ pháp hợp lý.

### KHÔNG đổi

| Thứ không đổi | Lý do |
|---|---|
| `version_id`, `version`, `versions` (tên biến/field JS) | Code internals, không hiển thị |
| Tên bảng `program_versions`, cột `academic_year` | Schema giữ nguyên |
| URL: `/api/versions/:id`, `/api/programs/:pid/versions`, `/api/version-courses/...` | Không đổi route để tránh breaking |
| Page module `VersionEditorPage`, file `version-editor.js`, `version-editor.html` (nếu có) | Tên file/module không đổi |
| "Đã khóa" (badge trạng thái locked), `is_locked` | Khái niệm khác, user tự phân biệt qua ngữ cảnh |
| Error "Phiên bản đã bị khóa" ([server.js](../../../server.js)) | Server string giữ nguyên cho an toàn — user ít gặp |
| "Khóa luận" (nếu có đâu đó) | Nghĩa khác (thesis) |
| "Năm học" label ở approval table và form version-editor | Là label của trường năm cụ thể (4 chữ số), giữ nguyên. "Khóa" là khái niệm tổng, "Năm học" là thuộc tính năm — phân biệt rõ hơn nếu giữ |

## Server Error Messages — Decision

Server có vài string "Phiên bản đã bị khóa..." ([server.js:103, 2208, 2347](../../../server.js)). **Giữ nguyên ở server** vì:
- User ít gặp các error message đó (chỉ khi thao tác bị block do locked).
- Đổi server text tăng risk nhưng lợi ích thấp.
- Có thể clean up sau ở spec riêng nếu user quan tâm.

Nhưng **client-side error text hiển thị cho user phải đổi**, nếu gặp trường hợp client tự build message tham chiếu "phiên bản". Theo explore, đa số là label UI tĩnh, em sẽ check từng chỗ trong plan.

## Edge Cases

| Case | Hành vi |
|---|---|
| User tạo khóa mới nhập "2026" | Pass validation, lưu "2026" |
| User tạo khóa mới nhập "2026-2027" | Fail validation, toast "Khóa phải có định dạng 4 chữ số, ví dụ 2026." |
| Migration chạy 2 lần | Lần 2 no-op |
| Row đã format "2026" sẵn | Không đụng |
| Row format lạ (NULL, "invalid") | Không đụng — user tự fix |
| `UNIQUE(program_id, academic_year)` collision sau migration | Không xảy ra với DB hiện tại (chỉ 1 row). Nếu sau này có program có cả "2026" và "2026-2027", chạy migration sẽ fail UNIQUE. Mitigate bằng cách kiểm trước khi deploy. |
| Word import với academic_year từ parser | Parser tạo `YYYY` sẵn, pass validation mới |

## Out of Scope

- Đổi schema column `academic_year` → `cohort_year INT` (refactor lớn, làm sau nếu cần).
- Rename URL routes `/api/versions/*` → `/api/khoa/*` (breaking change, không cần thiết).
- Rename file `version-editor.js`, page route `version-editor` → `khoa-editor` (churn cao, không cần thiết).
- Rename field `is_locked` hay đổi label "Đã khóa" sang từ khác (user chấp nhận ngữ cảnh).
- Đổi server-side error strings ("Phiên bản đã bị khóa...").
- Thêm UI hiển thị format đẹp hơn (ví dụ "K26" prefix) — có thể làm spec riêng.

## Manual Test Plan

Không có test framework. Verify thủ công.

### Test 1 — Migration idempotent

1. Restart server (`make dev`) → quan sát log khởi động không lỗi.
2. `docker exec -i program-db psql -U program -d program_db -c "SELECT id, academic_year FROM program_versions;"`
   - Row hiện tại "2026-2027" → giờ phải là "2026".
3. Restart lần 2 → query lại → vẫn "2026" (không đổi, không lỗi).

### Test 2 — Validation client

1. Mở trang Programs → click "Tạo phiên bản" (giờ là "Tạo khóa") trên 1 CTĐT.
2. Nhập "2026" → submit → success.
3. Nhập "2026-2027" → submit → toast lỗi format.
4. Nhập "abcd" → submit → toast lỗi format.

### Test 3 — UI labels

Scan qua các trang: Programs, Version Editor, Import Word, Dashboard, Audit Logs, Approval.
- Không còn chữ "phiên bản" / "Phiên Bản" (case-insensitive) ở text hiển thị user.
- Label "Khóa" / "khóa" xuất hiện đúng ngữ cảnh.
- Trừ những chỗ hợp lệ: "Đã khóa" (badge locked), "Khóa luận" (nếu có).

### Test 4 — Không regression chức năng

- Tạo khóa mới → success, xuất hiện trong list.
- Sửa khóa → lưu OK.
- Nhân bản khóa → version mới tạo, inherit data.
- Xóa khóa → toast "Đã xóa khóa 2026".
- Mở Version Editor của khóa → tất cả tab hoạt động, badge "Đã khóa" vẫn hiển thị đúng nếu version locked.

### Test 5 — Import Word

- Upload file Word → "Tạo khóa mới" → check khóa được tạo với `academic_year` 4 chữ số.

### Test 6 — Approval + Audit

- Trang Approval: column "Năm học" hiển thị "2026" (không còn range).
- Trang Audit Logs: log entries tham chiếu "khóa CTĐT" (nếu có).
