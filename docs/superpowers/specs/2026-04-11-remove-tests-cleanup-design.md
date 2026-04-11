# Dọn dẹp: loại bỏ toàn bộ test artifacts khỏi dự án

**Ngày:** 2026-04-11
**Trạng thái:** Đã duyệt thiết kế
**Mục tiêu:** Gỡ bỏ toàn bộ hạ tầng test (Playwright) khỏi repository để chuẩn bị cho các thay đổi lớn sắp tới. Làm dự án gọn hơn, tránh test code lỗi thời cản trở refactor.

## Bối cảnh

Dự án hiện có một bộ test Playwright (166 test cases) bao phủ UI end-to-end. Với các thay đổi lớn sắp tới, việc duy trì test hiện tại sẽ tạo ma sát không đáng: mỗi thay đổi UI sẽ làm gãy test, mà test cũ không còn phản ánh đúng hướng đi mới.

Quyết định của chủ dự án: xóa sạch test hiện tại. Nếu sau này cần test lại, sẽ viết lại từ đầu theo hạ tầng mới.

## Xác nhận an toàn

Đã kiểm tra: **không có file nào trong `server.js`, `db.js`, hoặc `public/**` import từ `tests/`.** Tests là client Playwright độc lập, chỉ gọi chương trình chính qua HTTP. Xóa thư mục `tests/` không ảnh hưởng runtime.

## Phạm vi dọn dẹp

### 1. File và thư mục cần xóa

- `tests/` — toàn bộ thư mục, gồm:
  - `all_features.test.js`
  - `notifications.spec.js`
  - `sidebar-collapse.spec.js`
  - `main-content-width.spec.js`
  - `export-word.spec.js`
  - `csv-reporter.js`
  - `generate-excel-report.js`
  - `test-cases.csv`
- `playwright.config.js`
- `playwright-report/` — thư mục HTML report
- `test-results/` — thư mục artifacts khi chạy test
- `TestReport.xlsx` — file báo cáo Excel đã sinh từ trước

### 2. Sửa `package.json`

Xóa các mục sau:

- `scripts.test`
- `scripts["test:headed"]`
- `scripts["test:report"]`
- Toàn bộ khối `devDependencies` (hiện chỉ chứa `@playwright/test`)

Kết quả: `package.json` không còn bất kỳ tham chiếu nào tới Playwright hay test.

### 3. Sửa `Makefile`

Xóa các mục sau:

- Khai báo `.PHONY`: bỏ `test test-headed test-one test-module test-report test-excel`
- Section "Test" trong target `help` (6 dòng echo từ `"  Test:"` đến `"  make test-excel ..."`)
- Toàn bộ section `# --- Test commands ---` gồm 6 target: `test`, `test-headed`, `test-one`, `test-module`, `test-report`, `test-excel`

### 4. Xóa plan files cũ trong `docs/superpowers/plans/`

Ba plan files này tham chiếu trực tiếp vào các test đã xóa, nên cũng xóa luôn:

- `docs/superpowers/plans/2026-04-08-notification-center.md`
- `docs/superpowers/plans/2026-04-09-inline-approval-in-editors.md`
- `docs/superpowers/plans/2026-04-10-hp-plo-checkbox.md`

### 5. Đồng bộ lại dependencies

Sau khi sửa `package.json`, chạy:

```bash
npm install
```

Mục đích:
- Cập nhật `package-lock.json` để loại bỏ các entry `@playwright/test`, `playwright`, `playwright-core`.
- Prune `node_modules/` để xoá các package không còn được khai báo trong `package.json`.

## Tiêu chí hoàn thành

Sau khi thực hiện xong, dự án phải thoả các điều kiện:

1. `grep -ri "playwright" --exclude-dir=node_modules` không trả về kết quả trong source code, `Makefile`, `package.json`, `package-lock.json`.
2. `grep -r "tests/" --exclude-dir=node_modules` không trả về kết quả trong source code và `Makefile`.
3. `make help` chạy được và không còn hiển thị section Test.
4. `npm run dev` khởi động server bình thường trên port 3600.
5. Không còn thư mục `tests/`, `playwright-report/`, `test-results/`, không còn file `playwright.config.js`, `TestReport.xlsx`.

## Rủi ro và xử lý

- **Rủi ro:** Lỡ xóa tài liệu spec (không phải plan) có giá trị. **Giảm thiểu:** chỉ xóa 3 file trong `plans/` đã nêu tên, không động tới `docs/superpowers/specs/` hay các plan khác.
- **Rủi ro:** `npm install` thay đổi version của dependency khác ngoài ý muốn. **Giảm thiểu:** kiểm tra `git diff package-lock.json` sau khi chạy, chỉ nhận khi thay đổi chỉ liên quan tới playwright.
- **Rủi ro:** Vẫn còn CI/hook gọi tới `npm test`. **Giảm thiểu:** kiểm tra `.github/`, `.husky/`, `docker-compose.yml` trước khi commit.

## Không làm trong scope này

- Không viết test mới.
- Không sửa nội dung các plan/spec khác ngoài 3 file plan đã nêu.
- Không refactor code chương trình chính.
- Không đụng tới `node_modules` thủ công (chỉ qua `npm install`).
