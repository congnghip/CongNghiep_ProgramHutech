# Dọn dẹp test artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xoá toàn bộ hạ tầng test Playwright khỏi dự án (files, scripts, devDependencies, Makefile targets, plan tài liệu cũ), đồng thời đồng bộ lại lockfile và `node_modules`, để repo gọn hơn trước các thay đổi lớn sắp tới.

**Architecture:** Chia công việc thành 6 task tuần tự, mỗi task thay đổi một mảng cụ thể (filesystem → package.json → Makefile → docs plans → dependencies → final verification). Mỗi task kết thúc bằng verification + commit độc lập để dễ revert nếu có sự cố.

**Tech Stack:** Node.js/npm, GNU Make, Bash shell, Git.

**Spec tham chiếu:** [docs/superpowers/specs/2026-04-11-remove-tests-cleanup-design.md](../specs/2026-04-11-remove-tests-cleanup-design.md)

---

## Task 1: Xác minh an toàn và chụp snapshot repo hiện tại

**Files:**
- Read-only: `server.js`, `db.js`, `public/**`, `docker-compose.yml`, `docker-compose copy.yml`

Mục tiêu: đảm bảo không có code runtime nào import từ `tests/` hoặc dùng Playwright, và không có CI/hook chạy test trước khi bắt đầu xoá.

- [ ] **Step 1: Kiểm tra code chính có import từ `tests/` không**

Run:
```bash
grep -rn "require.*tests/\|from ['\"]tests/" server.js db.js public/ 2>/dev/null
```

Expected: không có kết quả (exit code 1, `grep` im lặng).

Nếu có kết quả: DỪNG LẠI, báo lại cho người review, không tiếp tục plan.

- [ ] **Step 2: Kiểm tra code chính có require `@playwright/test` không**

Run:
```bash
grep -rn "@playwright/test" server.js db.js public/ 2>/dev/null
```

Expected: không có kết quả.

- [ ] **Step 3: Kiểm tra `.github/` và `.husky/` có tồn tại không**

Run:
```bash
ls -la .github .husky 2>&1 | grep -v "No such file"
```

Expected: output rỗng (không có thư mục nào).

Nếu tồn tại: mở ra đọc, tìm bất kỳ hook/CI nào gọi `npm test`, `playwright`, hoặc `tests/`. Nếu có, báo lại cho người review trước khi tiếp tục.

- [ ] **Step 4: Kiểm tra `docker-compose.yml` có gọi test runner không**

Run:
```bash
grep -nE "playwright|npm test|tests/" docker-compose.yml "docker-compose copy.yml" 2>&1
```

Expected: output rỗng. (Healthcheck `test: ["CMD-SHELL", ...]` đã được loại trừ vì pattern yêu cầu `playwright|npm test|tests/`.)

- [ ] **Step 5: Đảm bảo working tree sạch**

Run:
```bash
git status --porcelain
```

Expected: output rỗng (không có file thay đổi chưa commit).

Nếu có: dừng lại, hỏi người dùng có muốn commit/stash trước khi bắt đầu không.

- [ ] **Step 6: Không commit gì**

Task 1 là read-only. Không có thay đổi để commit.

---

## Task 2: Xoá thư mục và file test khỏi filesystem

**Files:**
- Delete: `tests/` (toàn bộ thư mục, 8 file)
- Delete: `playwright.config.js`
- Delete: `playwright-report/` (toàn bộ thư mục)
- Delete: `test-results/` (toàn bộ thư mục)
- Delete: `TestReport.xlsx`

- [ ] **Step 1: Xoá thư mục `tests/`**

Run:
```bash
rm -rf tests/
```

Verify:
```bash
ls tests/ 2>&1
```

Expected: `ls: cannot access 'tests/': No such file or directory`

- [ ] **Step 2: Xoá `playwright.config.js`**

Run:
```bash
rm playwright.config.js
```

Verify:
```bash
ls playwright.config.js 2>&1
```

Expected: `ls: cannot access 'playwright.config.js': No such file or directory`

- [ ] **Step 3: Xoá `playwright-report/`**

Run:
```bash
rm -rf playwright-report/
```

Verify:
```bash
ls playwright-report/ 2>&1
```

Expected: `ls: cannot access 'playwright-report/': No such file or directory`

- [ ] **Step 4: Xoá `test-results/`**

Run:
```bash
rm -rf test-results/
```

Verify:
```bash
ls test-results/ 2>&1
```

Expected: `ls: cannot access 'test-results/': No such file or directory`

- [ ] **Step 5: Xoá `TestReport.xlsx`**

Run:
```bash
rm TestReport.xlsx
```

Verify:
```bash
ls TestReport.xlsx 2>&1
```

Expected: `ls: cannot access 'TestReport.xlsx': No such file or directory`

- [ ] **Step 6: Smoke test — khởi động server để xác nhận app không bị ảnh hưởng**

Run (trong terminal phụ, hoặc background):
```bash
timeout 8 npm run dev 2>&1 | head -30
```

Expected: log thấy server khởi động trên port 3600 mà không có lỗi `Cannot find module` hay lỗi liên quan đến Playwright.

Tham khảo: tìm dòng như `HUTECH Program listening on` hay tương tự trong log khởi động của `server.js`.

- [ ] **Step 7: Commit**

```bash
git add -A
git status
git commit -m "$(cat <<'EOF'
chore: remove test files and playwright artifacts

Xoá toàn bộ thư mục tests/, playwright.config.js, playwright-report/,
test-results/, và TestReport.xlsx. Chuẩn bị cho thay đổi lớn sắp tới,
test code hiện tại sẽ không còn phù hợp.
EOF
)"
```

Verify:
```bash
git log -1 --stat
```

Expected: thấy commit vừa tạo, có các file đã xoá.

---

## Task 3: Dọn `package.json`

**Files:**
- Modify: `package.json`

Hiện trạng `package.json` (các key cần sửa):
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "test": "npx playwright test",
    "test:headed": "npx playwright test --headed",
    "test:report": "npx playwright show-report"
  },
  "dependencies": { /* giữ nguyên */ },
  "devDependencies": {
    "@playwright/test": "^1.58.2"
  }
}
```

Mục tiêu sau khi sửa:
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
  "dependencies": { /* giữ nguyên */ }
}
```

- [ ] **Step 1: Xoá 3 script test khỏi `package.json`**

Dùng editor sửa `package.json`: xoá 3 dòng `"test": ...`, `"test:headed": ...`, `"test:report": ...` trong khối `scripts`. Nhớ xoá cả dấu phẩy trailing của dòng `"dev": ...` để JSON vẫn hợp lệ.

Kết quả khối `scripts` phải như sau:
```json
"scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  },
```

- [ ] **Step 2: Xoá toàn bộ khối `devDependencies` khỏi `package.json`**

Xoá cả 3 dòng:
```json
"devDependencies": {
    "@playwright/test": "^1.58.2"
  }
```

Nhớ xoá luôn dấu phẩy ở cuối dòng `"dependencies": { ... }` đứng trên nếu cần (vì `devDependencies` là key cuối cùng trong file).

- [ ] **Step 3: Kiểm tra JSON vẫn hợp lệ**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 4: Kiểm tra `package.json` không còn tham chiếu tới playwright/test**

Run:
```bash
grep -E "playwright|\"test" package.json
```

Expected: không có kết quả.

- [ ] **Step 5: Commit thay đổi `package.json` (chưa chạy `npm install`)**

```bash
git add package.json
git commit -m "$(cat <<'EOF'
chore: drop test scripts and playwright devDependency from package.json
EOF
)"
```

Verify:
```bash
git log -1 --stat
```

Expected: thấy commit vừa tạo với 1 file đã sửa.

---

## Task 4: Dọn `Makefile`

**Files:**
- Modify: `Makefile`

Hiện trạng (các phần cần xoá):

1. Dòng `.PHONY` ở đầu file có chứa `test test-headed test-one test-module test-report test-excel`
2. Section "Test:" trong target `help` (6 dòng echo, bắt đầu từ `@echo ""` phía trên `@echo "  Test:"` tới dòng `make test-excel`)
3. Section `# --- Test commands ---` ở cuối file với 6 target

- [ ] **Step 1: Sửa dòng `.PHONY`**

Thay dòng:
```makefile
.PHONY: help up down restart logs logs-app logs-db app-shell db-shell dev start test test-headed test-one test-module test-report test-excel
```

Thành:
```makefile
.PHONY: help up down restart logs logs-app logs-db app-shell db-shell dev start
```

- [ ] **Step 2: Xoá section "Test:" trong target `help`**

Trong target `help`, xoá 7 dòng này (bao gồm dòng `@echo ""` trống đứng ngay trước section Test):
```makefile
	@echo ""
	@echo "  Test:"
	@echo "  make test                    - Chạy toàn bộ 166 test cases"
	@echo "  make test-headed             - Chạy test với browser hiển thị"
	@echo "  make test-one TC=TC_AUTH_01  - Chạy 1 test case"
	@echo "  make test-module M=Approval  - Chạy 1 module"
	@echo "  make test-report             - Mở HTML report"
	@echo "  make test-excel              - Xuất kết quả ra TestReport.xlsx"
```

Sau khi xoá, target `help` nên kết thúc bằng dòng `@echo "  make start       - Chạy chương trình ở môi trường production local (npm start)"`.

- [ ] **Step 3: Xoá section `# --- Test commands ---`**

Xoá toàn bộ 18 dòng sau (từ section header đến target cuối cùng `test-excel`):
```makefile
# --- Test commands ---
test:
	npx playwright test

test-headed:
	npx playwright test --headed

test-one:
	npx playwright test -g "$(TC)"

test-module:
	npx playwright test -g "$(M)"

test-report:
	npx playwright show-report

test-excel:
	node tests/generate-excel-report.js
```

- [ ] **Step 4: Kiểm tra `Makefile` không còn tham chiếu tới test/playwright**

Run:
```bash
grep -nE "playwright|test" Makefile
```

Expected: không có kết quả.

- [ ] **Step 5: Kiểm tra `make help` chạy được và không lỗi**

Run:
```bash
make help
```

Expected:
- Không có lỗi cú pháp Makefile.
- Output hiển thị sections `Docker:` và `App:`, KHÔNG còn section `Test:`.

- [ ] **Step 6: Kiểm tra `make dev` target vẫn tồn tại (smoke)**

Run:
```bash
make -n dev
```

Expected: in ra `npm run dev` (dry-run, không thực thi).

- [ ] **Step 7: Commit**

```bash
git add Makefile
git commit -m "$(cat <<'EOF'
chore: remove test targets from Makefile

Xoá 6 target test (test, test-headed, test-one, test-module,
test-report, test-excel), section help, và khai báo .PHONY tương ứng.
EOF
)"
```

Verify:
```bash
git log -1 --stat
```

Expected: commit vừa tạo với 1 file đã sửa.

---

## Task 5: Xoá 3 plan file cũ tham chiếu tới test

**Files:**
- Delete: `docs/superpowers/plans/2026-04-08-notification-center.md`
- Delete: `docs/superpowers/plans/2026-04-09-inline-approval-in-editors.md`
- Delete: `docs/superpowers/plans/2026-04-10-hp-plo-checkbox.md`

- [ ] **Step 1: Xoá 3 file plan cũ**

Run:
```bash
rm docs/superpowers/plans/2026-04-08-notification-center.md
rm docs/superpowers/plans/2026-04-09-inline-approval-in-editors.md
rm docs/superpowers/plans/2026-04-10-hp-plo-checkbox.md
```

- [ ] **Step 2: Verify 3 file đã bị xoá**

Run:
```bash
ls docs/superpowers/plans/
```

Expected: chỉ còn plan hiện tại `2026-04-11-remove-tests-cleanup.md` (và có thể các plan khác không nằm trong danh sách xoá).

- [ ] **Step 3: Verify `docs/superpowers/plans/` không còn tham chiếu `tests/` hoặc `playwright`**

Run:
```bash
grep -rn "tests/\|playwright" docs/superpowers/plans/
```

Expected: không có kết quả (hoặc chỉ còn trong chính plan cleanup hiện tại — kiểm tra xem match có nằm trong file `2026-04-11-remove-tests-cleanup.md` không, nếu đúng thì OK).

- [ ] **Step 4: Commit**

```bash
git add -A docs/superpowers/plans/
git commit -m "$(cat <<'EOF'
docs: remove outdated plan files that reference deleted tests

Ba plan trong docs/superpowers/plans/ (2026-04-08 notification center,
2026-04-09 inline approval in editors, 2026-04-10 hp plo checkbox) đều
tham chiếu trực tiếp vào tests đã xoá, nên xoá luôn để đồng bộ.
EOF
)"
```

Verify:
```bash
git log -1 --stat
```

Expected: commit vừa tạo với 3 file đã xoá.

---

## Task 6: Đồng bộ `package-lock.json` và `node_modules`

**Files:**
- Modify: `package-lock.json`
- Modify: `node_modules/` (prune)

- [ ] **Step 1: Chạy `npm install` để đồng bộ lockfile**

Run:
```bash
npm install
```

Expected:
- Không có error.
- Output có dòng tương tự `removed N packages` (hoặc `added 0 removed N`), với N > 0 (vì đã bỏ `@playwright/test`).
- Kết thúc với prompt bình thường.

- [ ] **Step 2: Verify `package-lock.json` không còn playwright**

Run:
```bash
grep -c "playwright" package-lock.json
```

Expected: `0`

- [ ] **Step 3: Verify `node_modules/@playwright` không còn**

Run:
```bash
ls node_modules/@playwright 2>&1
```

Expected: `ls: cannot access 'node_modules/@playwright': No such file or directory`

- [ ] **Step 4: Verify `node_modules/playwright` và `node_modules/playwright-core` không còn**

Run:
```bash
ls node_modules/playwright node_modules/playwright-core 2>&1
```

Expected: cả hai đều `No such file or directory`.

- [ ] **Step 5: Smoke test — khởi động dev server lần cuối**

Run:
```bash
timeout 8 npm run dev 2>&1 | head -30
```

Expected: server khởi động bình thường trên port 3600, không có lỗi `Cannot find module`.

- [ ] **Step 6: Kiểm tra `git diff package-lock.json` chỉ thay đổi các entry liên quan playwright**

Run:
```bash
git diff --stat package-lock.json
git diff package-lock.json | grep -E "^[+-]" | grep -vE "^[+-]{3}" | head -40
```

Expected: chỉ thấy `-` (xoá) dòng liên quan tới `@playwright/test`, `playwright`, `playwright-core`, không có `+` (thêm) dòng mới cho package khác. Nếu có `+` cho package khác, dừng lại, hỏi người review trước khi commit.

- [ ] **Step 7: Commit lockfile**

```bash
git add package-lock.json
git commit -m "$(cat <<'EOF'
chore: sync package-lock.json after removing playwright
EOF
)"
```

Verify:
```bash
git log -1 --stat
```

Expected: commit vừa tạo với `package-lock.json` đã sửa.

---

## Task 7: Final verification — đảm bảo repo sạch hết dấu vết test

**Files:** không có thay đổi trừ khi tìm thấy residue.

Mục tiêu: sau 6 task ở trên, chạy lại toàn bộ tiêu chí chấp nhận trong spec để chắc chắn không còn tàn dư.

- [ ] **Step 1: grep toàn bộ dự án cho `playwright`**

Run:
```bash
grep -rIn "playwright" --exclude-dir=node_modules --exclude-dir=.git .
```

Expected: không có kết quả.

Nếu có kết quả: xác định file, xoá tham chiếu, commit thêm một commit fix, rồi chạy lại grep này.

- [ ] **Step 2: grep toàn bộ dự án cho `tests/`**

Run:
```bash
grep -rIn "tests/" --exclude-dir=node_modules --exclude-dir=.git .
```

Expected: không có kết quả ngoài file plan hiện tại `docs/superpowers/plans/2026-04-11-remove-tests-cleanup.md` (plan này có thể nhắc `tests/` trong phần mô tả task — chấp nhận).

- [ ] **Step 3: Verify `make help` không có section Test**

Run:
```bash
make help
```

Expected: output có `Docker:` và `App:`, KHÔNG có `Test:`.

- [ ] **Step 4: Verify `npm run dev` vẫn khởi động server**

Run:
```bash
timeout 8 npm run dev 2>&1 | head -30
```

Expected: server khởi động bình thường trên port 3600.

- [ ] **Step 5: Verify 5 file/thư mục đã xoá không còn**

Run:
```bash
ls tests playwright.config.js playwright-report test-results TestReport.xlsx 2>&1
```

Expected: mỗi mục in ra `No such file or directory`.

- [ ] **Step 6: Verify `package.json` không có `devDependencies` và không có `test*` scripts**

Run:
```bash
node -e "const p=require('./package.json'); console.log('scripts:', Object.keys(p.scripts).join(',')); console.log('devDependencies:', p.devDependencies ? Object.keys(p.devDependencies).join(',') : 'NONE')"
```

Expected:
```
scripts: start,dev
devDependencies: NONE
```

- [ ] **Step 7: Verify git log hiển thị 5 commit từ plan này**

Run:
```bash
git log --oneline -10
```

Expected: thấy 5 commit gần nhất từ Task 2 → Task 6, kèm commit spec đã có từ trước:
- `chore: sync package-lock.json after removing playwright`
- `docs: remove outdated plan files that reference deleted tests`
- `chore: remove test targets from Makefile`
- `chore: drop test scripts and playwright devDependency from package.json`
- `chore: remove test files and playwright artifacts`
- `docs: add test removal cleanup design spec` (từ trước)

- [ ] **Step 8: Không commit thêm (task chỉ verify)**

Nếu tất cả step pass, plan hoàn tất. Nếu Step 1 hoặc Step 2 tìm thấy residue, fix và commit thêm một commit cleanup rồi chạy lại Task 7.
