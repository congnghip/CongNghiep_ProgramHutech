# Automation Test System Design — HUTECH Program Management

**Date:** 2026-04-04
**Approach:** Pure E2E (Playwright)
**Scope:** All 14 modules (~166 test cases)

---

## 1. Decisions

| Decision | Choice |
|----------|--------|
| Scope | All 14 modules, full coverage |
| Approach | Pure E2E — all tests run through real browser |
| Environment | Dev server (`localhost:3600`), manually started via `make dev` |
| Test data | Use existing database seed data, tests cleanup after themselves |
| File structure | Single file `tests/all_features.test.js` with `describe` blocks |
| Reporting | Terminal (list) + HTML report + Custom CSV reporter |

---

## 2. File Structure

```
tests/
├── all_features.test.js      # Single test file (~166 test cases)
├── test-cases.csv             # Test case registry with auto-filled results
├── csv-reporter.js            # Custom Playwright reporter → writes to CSV
playwright.config.js           # Playwright configuration
```

---

## 3. CSV Format

```csv
ID,Module,TestCase,Input,ExpectedResult,Result,Date
TC_AUTH_01,Authentication,Dang nhap thanh cong,username=admin; password=admin123,Chuyen huong toi Dashboard,,
```

- Columns `Result` and `Date` are initially empty
- `csv-reporter.js` writes `Pass`/`Fail`/`Skip` to `Result` and current date to `Date` after each run
- Running a single test only updates that row; other rows keep their previous results
- IDs in CSV without matching tests retain empty Result

---

## 4. Test Case Structure

Each test case is an independent `test()` function. Title starts with the ID matching CSV.

```js
describe('Module Name', () => {
  test('TC_XXX_NN: Description', async ({ page }) => {
    // 1. Navigate
    // 2. Interact (fill, click)
    // 3. Assert (toast, URL, visibility)
  });
});
```

Rules:
- Each CSV row = 1 independent `test()` function
- Each test handles its own login if needed (no inter-test dependency)
- Async/await for all Playwright operations
- Assertions check UI feedback: toast messages, error divs, URL changes, element visibility

---

## 5. Test Cases by Module (~166 total)

### 5.1 Authentication (11 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_AUTH_01 | Positive | Dang nhap thanh cong | admin / admin123 | Sidebar visible, dashboard loads |
| TC_AUTH_02 | Negative | Dang nhap trong tai khoan | empty / admin123 | Login error visible |
| TC_AUTH_03 | Negative | Dang nhap trong mat khau | admin / empty | Login error visible |
| TC_AUTH_04 | Negative | Dang nhap sai mat khau | admin / wrongpass | Login error "Sai ten dang nhap hoac mat khau" |
| TC_AUTH_05 | Negative | Dang nhap sai tai khoan | nonexist / pass123 | Login error visible |
| TC_AUTH_06 | Positive | Dang xuat thanh cong | click logout | Login form visible |
| TC_AUTH_07 | Positive | Doi mat khau thanh cong | current + new + confirm | Toast success |
| TC_AUTH_08 | Negative | Doi MK - sai mat khau cu | wrong current pass | Error message in modal |
| TC_AUTH_09 | Negative | Doi MK - mat khau moi khong khop | new != confirm | Error message in modal |
| TC_AUTH_10 | Edge | Dang nhap ky tu dac biet | <script>alert(1)</script> / pass | Login error, no XSS |
| TC_AUTH_11 | Edge | Dang nhap chuoi cuc dai | 1000-char string / pass | Login error, no crash |

### 5.2 Dashboard (4 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_DASH_01 | Positive | Hien thi dashboard sau login | login as admin | 6 metric cards visible |
| TC_DASH_02 | Positive | Hien thi hoat dong gan day | login as admin | Activity table has rows |
| TC_DASH_03 | Negative | Dashboard khi khong co quyen | login as basic user | Limited or empty metrics |
| TC_DASH_04 | Edge | Dashboard voi DB trong | fresh database | Cards show 0, no crash |

### 5.3 Program Management (14 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_PROG_01 | Positive | Xem danh sach CTDT | navigate to programs | Programs list visible |
| TC_PROG_02 | Positive | Tao CTDT moi thanh cong | code, name, dept | Toast success, program in list |
| TC_PROG_03 | Positive | Sua CTDT thanh cong | update name | Toast success |
| TC_PROG_04 | Positive | Xoa CTDT draft | delete draft program | Toast success, removed from list |
| TC_PROG_05 | Positive | Archive CTDT | click archive | Program moves to archived tab |
| TC_PROG_06 | Positive | Tao version moi | select year | Toast success, version created |
| TC_PROG_07 | Negative | Tao CTDT trong ma | empty code | Modal error visible |
| TC_PROG_08 | Negative | Tao CTDT trong ten | empty name | Modal error visible |
| TC_PROG_09 | Negative | Tao CTDT trung ma | duplicate code | Modal error or toast error |
| TC_PROG_10 | Negative | Xoa CTDT khong phai draft | non-draft program | Error message or button disabled |
| TC_PROG_11 | Negative | Tao version trung nam | duplicate year | Error message |
| TC_PROG_12 | Edge | Tao CTDT ky tu dac biet | name with <>&"' | Saved correctly, no XSS |
| TC_PROG_13 | Edge | Tao CTDT ten cuc dai | 500-char name | Saved or appropriate error |
| TC_PROG_14 | Edge | Unarchive CTDT | unarchive | Program returns to active list |

### 5.4 Version Editor (38 cases)

#### 5.4.1 Info Tab (4 cases)
| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_VER_01 | Positive | Xem thong tin version | open version editor | Info tab loads with data |
| TC_VER_02 | Positive | Cap nhat thong tin version | edit description | Toast success |
| TC_VER_03 | Negative | Cap nhat voi field trong | clear required field | Error message |
| TC_VER_04 | Edge | Cap nhat voi HTML content | <b>bold</b> in field | Saved without rendering HTML |

#### 5.4.2 PO - Program Objectives (5 cases)
| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_VER_05 | Positive | Them PO moi | code + description | PO appears in list |
| TC_VER_06 | Positive | Sua PO | update description | Toast success |
| TC_VER_07 | Positive | Xoa PO | delete PO | Removed from list |
| TC_VER_08 | Negative | Them PO trong ma | empty code | Error message |
| TC_VER_09 | Negative | Them PO trung ma | duplicate code | Error message |

#### 5.4.3 PLO - Program Learning Outcomes (5 cases)
| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_VER_10 | Positive | Them PLO moi | code + description | PLO appears in list |
| TC_VER_11 | Positive | Sua PLO | update description | Toast success |
| TC_VER_12 | Positive | Xoa PLO | delete PLO | Removed from list |
| TC_VER_13 | Negative | Them PLO trong ma | empty code | Error message |
| TC_VER_14 | Negative | Them PLO trung ma | duplicate code | Error message |

#### 5.4.4 PI - Performance Indicators (4 cases)
| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_VER_15 | Positive | Them PI cho PLO | select PLO, add PI | PI appears under PLO |
| TC_VER_16 | Positive | Sua PI | update description | Toast success |
| TC_VER_17 | Positive | Xoa PI | delete PI | Removed from list |
| TC_VER_18 | Negative | Them PI trong noi dung | empty description | Error message |

#### 5.4.5 PO-PLO Matrix (3 cases)
| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_VER_19 | Positive | Map PO voi PLO | check checkbox in matrix | Toast success on save |
| TC_VER_20 | Positive | Unmap PO-PLO | uncheck checkbox | Toast success on save |
| TC_VER_21 | Edge | Map tat ca PO voi 1 PLO | check all in column | Saved correctly |

#### 5.4.6 Knowledge Blocks (4 cases)
| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_VER_22 | Positive | Tao khoi kien thuc | name + type | Block appears in list |
| TC_VER_23 | Positive | Gan hoc phan vao khoi | assign courses | Courses listed under block |
| TC_VER_24 | Negative | Tao khoi trong ten | empty name | Error message |
| TC_VER_25 | Positive | Xoa khoi kien thuc | delete block | Removed from list |

#### 5.4.7 Courses in Version (4 cases)
| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_VER_26 | Positive | Them hoc phan vao version | select course | Course added to list |
| TC_VER_27 | Positive | Xoa hoc phan khoi version | remove course | Removed from list |
| TC_VER_28 | Negative | Them hoc phan da ton tai | duplicate course | Error message |
| TC_VER_29 | Positive | Cap nhat thong tin HP trong version | edit semester/type | Toast success |

#### 5.4.8 Course-PLO Matrix (3 cases)
| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_VER_30 | Positive | Map HP voi PLO | set level in matrix | Toast success on save |
| TC_VER_31 | Positive | Unmap HP-PLO | clear level | Toast success on save |
| TC_VER_32 | Edge | Map tat ca HP voi 1 PLO | fill entire column | Saved correctly |

#### 5.4.9 Course-PI Matrix (2 cases)
| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_VER_33 | Positive | Map HP voi PI | check in matrix | Toast success |
| TC_VER_34 | Positive | Unmap HP-PI | uncheck | Toast success |

#### 5.4.10 Teaching Plan (2 cases)
| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_VER_35 | Positive | Cap nhat ke hoach giang day | set semester for courses | Toast success |
| TC_VER_36 | Positive | Thiet lap tien quyet HP | set prerequisite | Toast success |

#### 5.4.11 Flowchart (2 cases)
| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_VER_37 | Positive | Xem so do tien trinh | open flowchart tab | SVG diagram renders |
| TC_VER_38 | Edge | Flowchart khi khong co HP | version with no courses | Empty state or message |

### 5.5 Courses Master (13 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_COURSE_01 | Positive | Xem danh sach hoc phan | navigate to courses | Courses table visible |
| TC_COURSE_02 | Positive | Tim kiem hoc phan theo ma | search by code | Filtered results |
| TC_COURSE_03 | Positive | Tim kiem hoc phan theo ten | search by name | Filtered results |
| TC_COURSE_04 | Positive | Them hoc phan moi | code, name, credits, dept | Toast success, course in list |
| TC_COURSE_05 | Positive | Sua hoc phan | update name | Toast success |
| TC_COURSE_06 | Negative | Them HP trong ma | empty code | Modal error |
| TC_COURSE_07 | Negative | Them HP trong ten | empty name | Modal error |
| TC_COURSE_08 | Negative | Them HP trung ma | duplicate code | Error message |
| TC_COURSE_09 | Negative | Them HP tin chi = 0 | credits = 0 | Error message |
| TC_COURSE_10 | Negative | Xoa HP dang su dung | course used in version | Error message |
| TC_COURSE_11 | Edge | Them HP ky tu dac biet | name with <>&"' | Saved correctly |
| TC_COURSE_12 | Edge | Them HP ten cuc dai | 500-char name | Saved or appropriate error |
| TC_COURSE_13 | Edge | Tim kiem khong co ket qua | nonexistent search | Empty state message |

### 5.6 Syllabus Editor (16 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_SYL_01 | Positive | Mo editor de cuong | click syllabus | Editor loads with data |
| TC_SYL_02 | Positive | Cap nhat thong tin chung | edit description | Toast success |
| TC_SYL_03 | Positive | Them CLO moi | code + description + level | CLO in list |
| TC_SYL_04 | Positive | Sua CLO | update description | Toast success |
| TC_SYL_05 | Positive | Xoa CLO | delete CLO | Removed from list |
| TC_SYL_06 | Positive | Map CLO voi PLO | set mapping | Toast success |
| TC_SYL_07 | Positive | Import PDF de cuong | upload PDF file | Content parsed and filled |
| TC_SYL_08 | Positive | Luu de cuong | click save | Toast success |
| TC_SYL_09 | Negative | Them CLO trong ma | empty code | Error message |
| TC_SYL_10 | Negative | Them CLO trung ma | duplicate code | Error message |
| TC_SYL_11 | Negative | Import file khong phai PDF | upload .txt file | Error message |
| TC_SYL_12 | Negative | Import PDF rong | empty PDF | Error or empty content |
| TC_SYL_13 | Negative | Luu de cuong voi field bat buoc trong | clear required field | Error message |
| TC_SYL_14 | Edge | CLO voi mo ta cuc dai | 1000-char description | Saved or error |
| TC_SYL_15 | Edge | CLO voi ky tu dac biet | <script> in desc | Saved without XSS |
| TC_SYL_16 | Edge | Import PDF cuc lon | large PDF file | Timeout or handled gracefully |

### 5.7 Approval Workflow (11 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_APPR_01 | Positive | Submit version de duyet | click submit | Toast success, status = submitted |
| TC_APPR_02 | Positive | Duyet version cap Khoa | approve as LANH_DAO_KHOA | Status = approved_khoa |
| TC_APPR_03 | Positive | Duyet version cap PDT | approve as PHONG_DAO_TAO | Status = approved_pdt |
| TC_APPR_04 | Positive | Duyet version cap BGH | approve as BAN_GIAM_HIEU | Status = approved_bgh → published |
| TC_APPR_05 | Positive | Tu choi version | reject with reason | Status = rejected, reason visible |
| TC_APPR_06 | Negative | Submit version da submit | re-submit | Error or button disabled |
| TC_APPR_07 | Negative | Duyet khi khong co quyen | login as GIANG_VIEN | Approve button not visible |
| TC_APPR_08 | Negative | Tu choi khong co ly do | reject with empty notes | Error message |
| TC_APPR_09 | Negative | Duyet version khong phai cua minh | wrong department | Error message |
| TC_APPR_10 | Edge | Xoa version bi tu choi | delete rejected | Toast success, removed |
| TC_APPR_11 | Edge | Submit lai sau khi bi tu choi | re-submit after fix | Status = submitted again |

### 5.8 User Management (11 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_USER_01 | Positive | Xem danh sach users | navigate to users | Users table visible |
| TC_USER_02 | Positive | Tao user moi | username, password, display name | Toast success, user in list |
| TC_USER_03 | Positive | Sua user | update display name | Toast success |
| TC_USER_04 | Positive | Gan vai tro cho user | select role + dept | Role badge visible on user |
| TC_USER_05 | Positive | Xoa vai tro khoi user | remove role | Role removed |
| TC_USER_06 | Negative | Tao user trong username | empty username | Modal error |
| TC_USER_07 | Negative | Tao user trong mat khau | empty password | Modal error |
| TC_USER_08 | Negative | Tao user trung username | duplicate username | Error message |
| TC_USER_09 | Negative | Xoa user dang hoat dong | delete active user | Error or confirmation |
| TC_USER_10 | Edge | Toggle user active/inactive | toggle status | Status changes, toast success |
| TC_USER_11 | Edge | Tao user ky tu dac biet | special chars in name | Saved correctly |

### 5.9 RBAC Admin (16 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_RBAC_01 | Positive | Xem tab Tai khoan | click tab | Users list visible |
| TC_RBAC_02 | Positive | Tim kiem user | search by name | Filtered results |
| TC_RBAC_03 | Positive | Loc user theo vai tro | select role filter | Filtered results |
| TC_RBAC_04 | Positive | Xem tab Vai tro | click tab | Roles list visible |
| TC_RBAC_05 | Positive | Tao vai tro moi | code + name + level | Toast success |
| TC_RBAC_06 | Positive | Gan quyen cho vai tro | check permissions | Toast success |
| TC_RBAC_07 | Positive | Xem Ma tran quyen | click tab | Matrix table visible |
| TC_RBAC_08 | Positive | Xem tab Don vi | click tab | Departments list visible |
| TC_RBAC_09 | Negative | Tao vai tro trong ma | empty code | Error message |
| TC_RBAC_10 | Negative | Tao vai tro trung ma | duplicate code | Error message |
| TC_RBAC_11 | Negative | Xoa vai tro dang su dung | role assigned to users | Error message |
| TC_RBAC_12 | Negative | Truy cap RBAC khong phai admin | login as non-admin | Page not visible or redirected |
| TC_RBAC_13 | Negative | Gan vai tro khong chon phong ban | role without dept | Error message |
| TC_RBAC_14 | Edge | Tim kiem khong ket qua | nonexistent name | Empty state |
| TC_RBAC_15 | Edge | Tao vai tro ky tu dac biet | special chars | Saved or error |
| TC_RBAC_16 | Edge | Sua vai tro va cap nhat quyen | edit + permissions change | Both saved correctly |

### 5.10 Departments (9 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_DEPT_01 | Positive | Xem danh sach don vi | navigate to departments | Tree view visible |
| TC_DEPT_02 | Positive | Tao don vi moi | code, name, type | Toast success, in tree |
| TC_DEPT_03 | Positive | Sua don vi | update name | Toast success |
| TC_DEPT_04 | Positive | Tao don vi con | set parent | Child under parent in tree |
| TC_DEPT_05 | Negative | Tao don vi trong ma | empty code | Modal error |
| TC_DEPT_06 | Negative | Tao don vi trung ma | duplicate code | Error message |
| TC_DEPT_07 | Negative | Xoa don vi co don vi con | parent with children | Error message |
| TC_DEPT_08 | Edge | Tao don vi ky tu dac biet | special chars in name | Saved correctly |
| TC_DEPT_09 | Edge | Tao don vi ten cuc dai | 300-char name | Saved or error |

### 5.11 Audit Logs (5 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_AUDIT_01 | Positive | Xem nhat ky he thong | navigate to audit logs | Table with log entries |
| TC_AUDIT_02 | Positive | Phan trang nhat ky | click next page | New page of entries |
| TC_AUDIT_03 | Positive | Hien thi badge mau theo action | view logs | POST=green, PUT=orange, DELETE=red |
| TC_AUDIT_04 | Negative | Xem audit khi khong co quyen | non-admin user | Page not visible |
| TC_AUDIT_05 | Edge | Phan trang khi het data | click next at last page | Button disabled or no more data |

### 5.12 My Assignments (6 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_ASSIGN_01 | Positive | Xem danh sach phan cong | navigate as teacher | Assignments table visible |
| TC_ASSIGN_02 | Positive | Tao de cuong tu phan cong | click create syllabus | Syllabus editor opens |
| TC_ASSIGN_03 | Positive | Hien thi deadline va mau sac | view assignments | Color-coded deadlines |
| TC_ASSIGN_04 | Negative | Xem khi khong co phan cong | user with no assignments | Empty state message |
| TC_ASSIGN_05 | Negative | Tao de cuong khi da ton tai | duplicate create | Error or opens existing |
| TC_ASSIGN_06 | Edge | Hien thi deadline qua han | overdue assignment | Red color indicator |

### 5.13 Import Word (8 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_IMPORT_01 | Positive | Upload file Word | .docx file | File parsed, preview shown |
| TC_IMPORT_02 | Positive | Luu du lieu tu Word | confirm import | Program/version created, toast success |
| TC_IMPORT_03 | Positive | Preview truoc khi luu | after upload | Parsed data visible for review |
| TC_IMPORT_04 | Negative | Upload file khong phai Word | .pdf file | Error message |
| TC_IMPORT_05 | Negative | Upload file Word rong | empty .docx | Error or empty preview |
| TC_IMPORT_06 | Negative | Upload file qua lon | >10MB file | Error message |
| TC_IMPORT_07 | Edge | Word voi format khong chuan | badly formatted doc | Partial parse or error |
| TC_IMPORT_08 | Edge | Word voi ky tu dac biet | special chars in content | Parsed correctly |

### 5.14 Flowchart (4 cases)

| ID | Type | Test Case | Input | Expected Result |
|----|------|-----------|-------|-----------------|
| TC_FLOW_01 | Positive | Xem so do chuong trinh | open flowchart tab | SVG diagram renders |
| TC_FLOW_02 | Positive | Tuong tac voi node | click on course node | Node highlighted or info shown |
| TC_FLOW_03 | Negative | Flowchart khong co du lieu | version without courses | Empty state or message |
| TC_FLOW_04 | Edge | Flowchart voi nhieu HP | 50+ courses | Renders without performance issue |

---

## 6. Custom CSV Reporter (`csv-reporter.js`)

### Mechanism
1. Implements Playwright's `Reporter` interface
2. `onTestEnd(test, result)` — collects test ID (extracted from title prefix `TC_XXX_NN`) and status
3. `onEnd()` — reads `test-cases.csv`, matches IDs, writes `Result` (Pass/Fail/Skip) and `Date` (YYYY-MM-DD), saves file

### Edge cases
- Test skipped → Result = `Skip`
- Test failed → Result = `Fail` (details in HTML report)
- CSV row without matching test → Result column unchanged
- Running single test → only that row updated, others preserved

---

## 7. Playwright Configuration

```js
// playwright.config.js
{
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['./tests/csv-reporter.js']
  ],
  use: {
    baseURL: 'http://localhost:3600',
    headless: true,
    screenshot: 'only-on-failure'
  }
}
```

### Commands
| Command | Purpose |
|---------|---------|
| `npx playwright test` | Run all tests |
| `npx playwright test -g "TC_AUTH_01"` | Run single test case |
| `npx playwright test -g "Authentication"` | Run one module |
| `npx playwright test --headed` | Run with visible browser |
| `npx playwright show-report` | Open HTML report |

---

## 8. Test Patterns

### Login helper (used within tests, not a shared fixture)
Each test that needs authentication will:
1. `page.goto(baseURL)`
2. `page.fill('#login-user', username)`
3. `page.fill('#login-pass', password)`
4. `page.click('#login-form button[type="submit"]')`
5. `page.waitForSelector('.sidebar')`

### Assertion patterns
- **Toast success:** `page.locator('.toast-success')` visible with expected text
- **Toast error:** `page.locator('.toast-error')` visible
- **Modal error:** `page.locator('.modal-error')` visible with text
- **Login error:** `page.locator('#login-error')` visible
- **Navigation:** check `.nav-item.active` or page content
- **Table data:** check `tbody tr` count or content
- **Element visibility:** `expect(locator).toBeVisible()` / `toBeHidden()`

### Cleanup pattern
Tests that create data should delete it in a `test.afterEach` or at the end of the test to avoid polluting the database for subsequent tests.
