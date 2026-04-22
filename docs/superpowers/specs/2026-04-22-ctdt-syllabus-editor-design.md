# Đề cương CTDT — kế thừa đề cương gốc, chỉ sửa mục 3, 9, 10

**Ngày:** 2026-04-22
**Trạng thái:** Design approved, pending implementation plan
**Phạm vi:** `public/js/pages/syllabus-editor.js`, `server.js`, helper migrate/normalize nội dung syllabus CTDT

## 1. Bối cảnh

Hệ thống hiện có hai luồng liên quan:

- **Đề cương gốc / đề cương cơ bản** theo học phần, lưu ở `course_base_syllabi`
- **Đề cương trong CTDT** theo version, lưu ở `version_syllabi`

Hiện tại editor của đề cương CTDT (`syllabus-editor.js`) là một editor riêng, dùng shape nội dung cũ hơn đề cương gốc và cho phép sửa rộng trên nhiều tab:

- Thông tin chung
- CLO
- CLO ↔ PI
- Nội dung chi tiết
- Đánh giá
- Tài liệu

Điều này làm đề cương CTDT bị lệch khỏi đề cương gốc và không phản ánh đúng yêu cầu nghiệp vụ mới:

- đề cương CTDT phải **giống đề cương gốc**
- nhưng chỉ được sửa các mục **3, 9, 10**
- các mục còn lại phải **copy một lần từ đề cương gốc rồi khóa**

## 2. Mục tiêu

Biến editor của đề cương CTDT thành một editor kế thừa đề cương gốc:

- Khi tạo hoặc tải từ đề cương gốc, toàn bộ nội dung của đề cương gốc được sao chép vào đề cương CTDT
- Sau khi copy, đề cương CTDT chỉ cho phép sửa:
  - **Mục 3**: thuộc khối kiến thức trong ngữ cảnh CTDT
  - **Mục 9**: ma trận đóng góp của học phần cho CĐR CTDT
  - **Mục 10**: chỉ phần mapping của CLO trong CTDT
- Các mục còn lại hiển thị giống đề cương gốc nhưng ở trạng thái read-only

## 3. Phạm vi

### Trong phạm vi

- Đồng bộ editor CTDT về cùng shape nội dung với đề cương gốc
- Thiết kế lại UI editor CTDT để bám cấu trúc đề cương gốc
- Khóa các mục ngoài `3, 9, 10`
- Chỉ cho sửa mapping ở mục `10`, không cho sửa danh sách/mô tả CLO
- Thêm guard phía backend để tránh client ghi nhầm các mục bị khóa
- Tương thích ngược với dữ liệu `version_syllabi.content` cũ

### Ngoài phạm vi

- Thay đổi editor của đề cương gốc
- Tự đồng bộ ngược từ đề cương gốc sang đề cương CTDT sau khi đã copy
- Xây editor mới hoàn toàn tách khỏi `syllabus-editor.js`
- Thiết kế lại workflow phê duyệt
- Thay đổi export CTDT ở cấp chương trình (`/api/export/version/:vId`)

## 4. Quyết định chính

### 4.1 Copy một lần rồi khóa

Phương án được chọn:

- Đề cương CTDT **copy nội dung từ đề cương gốc một lần**
- Sau khi copy, các mục ngoài `3, 9, 10` bị khóa
- Nếu đề cương gốc thay đổi về sau, đề cương CTDT **không tự cập nhật**
- Muốn nhận lại nội dung mới từ đề cương gốc, người dùng phải chủ động bấm lại `Lấy từ ĐC cơ bản` và chấp nhận ghi đè

Lý do:

- đúng với yêu cầu nghiệp vụ
- tránh side effect ngầm khi đề cương gốc thay đổi
- giữ lịch sử chỉnh sửa của đề cương CTDT độc lập sau thời điểm copy

### 4.2 Mục 10 chỉ sửa mapping, không sửa CLO

Ở đề cương CTDT:

- danh sách CLO là **kế thừa từ đề cương gốc**, hiển thị read-only
- người dùng chỉ được sửa mapping của CLO với PI/PLO trong version hiện tại

Lý do:

- CLO mô tả học phần, không phải đặc tính riêng của một CTDT
- tránh việc CTDT làm lệch định nghĩa CLO gốc của học phần

### 4.3 Mục 3 là override theo CTDT, không ghi đè dữ liệu gốc của học phần

Không sửa trực tiếp các trường master của `courses` khi thao tác trong đề cương CTDT.

Thay vào đó:

- đề cương gốc vẫn là nguồn chuẩn của học phần
- đề cương CTDT lưu phần khác biệt của mục 3 như một override cục bộ trong `version_syllabi.content`

Lý do:

- tránh làm thay đổi toàn bộ học phần chỉ vì một CTDT cụ thể
- giữ đúng ranh giới giữa dữ liệu base course và dữ liệu theo version

### 4.4 Mục 9 là dữ liệu theo version, không copy cứng

Mục 9 không được lưu như một bản sao tĩnh từ đề cương gốc.

Thay vào đó:

- mục 9 trong editor CTDT luôn hiển thị từ mapping thật của học phần trong version hiện tại
- nếu user sửa mục 9, thực chất là đang sửa mapping học phần trong CTDT đó

Lý do:

- mục 9 là dữ liệu theo CTDT/version
- tránh duplication giữa editor đề cương CTDT và ma trận version

## 5. Mô hình dữ liệu

## 5.1 Shape chuẩn của `version_syllabi.content`

Editor CTDT sẽ đọc/ghi theo cùng shape logic với đề cương gốc mới:

```js
{
  _schema_version: 4,

  course_objectives: string,
  course_description: string,
  prerequisites: string,
  prerequisites_concurrent: string,
  language_instruction: string,

  teaching_methods: [
    { method: string, objective: string }
  ],

  course_outline: [
    {
      lesson: number,
      title: string,
      lt_hours: number,
      th_hours: number,
      topics: string[],
      teaching_methods: string,
      clo_codes: string[],
      self_study_hours: number,
      self_study_tasks: string[]
    }
  ],

  assessment_methods: [
    {
      component: string,
      description: string,
      task_ref: string,
      weight: number,
      clo_codes: string[]
    }
  ],

  textbooks: string[],
  references: string[],
  tools: [
    { category: string, items: string[] }
  ],
  other_requirements: string,

  instructor: {
    primary: {
      name: string,
      title_degree: string,
      office_address: string,
      phone: string,
      email: string,
      website: string
    },
    assistant: {
      name: string,
      title_degree: string,
      office_address: string,
      phone: string,
      email: string,
      website: string
    },
    contact_note: string
  },

  signatures: {
    date_text: string,
    khoa_vien: string,
    nganh_bo_mon: string,
    nguoi_bien_soan: string
  },

  ctdt_overrides: {
    section3: {
      knowledge_area: string | null,
      course_requirement: string | null
    }
  }
}
```

Ghi chú:

- Các trường của `ctdt_overrides.section3` là phần cho phép sửa trong editor CTDT
- Các mục `9` và `10` không cần nhét vào `content`, vì dữ liệu của chúng đến từ mapping của version

## 5.2 Backward compatibility

Nếu `version_syllabi.content` đang ở schema cũ:

- Khi mở editor CTDT, hệ thống sẽ migrate in-memory sang shape chuẩn mới
- Không mass-migrate toàn bộ DB
- Lần save đầu tiên từ editor mới sẽ lưu lại theo shape mới

Migration phải xử lý ít nhất:

- `learning_methods: string` -> `teaching_methods[]`
- `course_outline[].hours` -> `lt_hours`, `th_hours = 0`
- `course_outline[].clos` -> `clo_codes`
- `assessment_methods[].assessment_tool` -> `description`
- `assessment_methods[].clos` -> `clo_codes`
- `course_requirements` -> `tools` + `other_requirements`

## 6. UI đề cương CTDT

## 6.1 Nguyên tắc hiển thị

Editor CTDT phải nhìn gần giống đề cương gốc:

- cùng cách nhóm nội dung theo mục chuẩn
- cùng cách gọi tên phần/mục
- phần nào bị khóa phải thể hiện rõ là được kế thừa từ đề cương gốc

Trên page nên có note ngắn:

> Các mục ngoài 3, 9, 10 được kế thừa từ đề cương gốc và không chỉnh sửa trong đề cương CTDT.

## 6.2 Bố cục đề xuất

### Khu vực 1 — Thông tin chung

Hiển thị mục `1–8` theo cấu trúc đề cương gốc.

Trong đó:

- `1, 2, 4, 5, 6, 7, 8`: read-only
- `3`: editable

Mục 3 ở CTDT chỉ cho sửa phần phân loại trong bối cảnh version:

- khối kiến thức
- tính chất bắt buộc/tự chọn

### Khu vực 2 — Mục 9

Tab hoặc section riêng cho:

- ma trận đóng góp học phần vào PLO/PI của version hiện tại

Phần này editable.

### Khu vực 3 — Mục 10

Hiển thị:

- danh sách CLO read-only: mã, mô tả, Bloom
- vùng chỉnh sửa mapping CLO ↔ PI của CTDT

Không cho:

- thêm CLO
- sửa CLO
- xóa CLO

### Khu vực 4 — Các mục còn lại

Hiển thị mục `11–17` giống đề cương gốc nhưng read-only:

- mô tả học phần
- phương pháp dạy học
- nội dung chi tiết
- đánh giá
- tài liệu
- tự học
- yêu cầu học phần
- thông tin giảng viên nếu có

## 6.3 Hành vi của nút `Lấy từ ĐC cơ bản`

Khi bấm:

- copy toàn bộ nội dung đề cương gốc vào `version_syllabi.content`
- copy toàn bộ base CLO vào `course_clos`
- sau đó editor CTDT chỉ cho sửa mục `3, 9, 10`

Thông điệp confirm phải nói rõ:

- thao tác này sẽ ghi đè nội dung CTDT hiện tại
- nội dung được sao chép từ đề cương gốc
- sau khi sao chép chỉ mục `3, 9, 10` được chỉnh sửa

## 7. Backend và API

## 7.1 Guard phía server cho nội dung bị khóa

`PUT /api/syllabi/:id` hiện nhận nguyên `content`.

Để phù hợp với yêu cầu mới, server phải chặn việc client ghi nhầm các mục bị khóa.

Hướng xử lý:

- Lấy `content` hiện tại của syllabus
- Normalize content hiện tại và content gửi lên
- Chỉ merge phần override được phép sửa cho editor CTDT:
  - `ctdt_overrides.section3`
- Các mục khác của content giữ nguyên nếu request đến từ luồng editor CTDT

Nếu chưa đủ thông tin để phân biệt request nào là editor CTDT mới, có thể:

- thêm endpoint chuyên biệt cho section 3
- hoặc thêm cờ request rõ ràng từ frontend

Ưu tiên:

- không phá các luồng cũ khác ngoài phạm vi spec này
- tránh mở đường cho frontend bypass khóa chỉ vì gửi raw JSON

## 7.2 Mục 9

Mục 9 dùng dữ liệu version-level hiện có:

- `course_plo_map`
- nếu cần thêm PI-level thì dùng `course-pi-map` / dữ liệu suy ra tương ứng

Nếu frontend đang phải fetch dữ liệu quá rộng rồi tự lọc, có thể thêm helper/API mỏng để lấy đúng:

- mapping của **một học phần trong một version**

## 7.3 Mục 10

Mục 10 tiếp tục dùng:

- danh sách CLO từ `course_clos`
- mapping từ `clo_pi_map`

UI mới không gọi các route:

- thêm/sửa/xóa CLO

Nhưng vẫn dùng route save mapping hiện có cho `CLO ↔ PI`.

Nếu cần hiển thị PLO ở mục 10:

- ưu tiên suy ra từ PI đã map
- chưa bắt buộc thêm bảng map CLO ↔ PLO mới cho CTDT

## 8. Thay đổi ở frontend

File chính: `public/js/pages/syllabus-editor.js`

Các thay đổi mong đợi:

- bỏ mô hình tab cũ nơi hầu như tab nào cũng editable
- normalize `this.syllabus.content` sang shape mới khi load
- render editor theo các mục chuẩn của đề cương gốc
- loại bỏ hoặc disable các thao tác:
  - import PDF
  - thêm/sửa/xóa CLO
  - sửa nội dung chi tiết
  - sửa đánh giá
  - sửa tài liệu
  - sửa các mục kế thừa khác
- `saveAll()` chỉ lưu:
  - override mục 3
  - chỉnh sửa mục 9
  - chỉnh sửa mapping mục 10

## 9. Kiểm thử chấp nhận

## 9.1 Trường hợp cơ bản

1. Tạo hoặc mở một đề cương CTDT đã có đề cương gốc
2. Bấm `Lấy từ ĐC cơ bản`
3. Xác nhận:
   - nội dung CTDT được copy từ đề cương gốc
   - các mục ngoài `3, 9, 10` hiển thị read-only
   - mục `3` chỉnh được
   - mục `9` chỉnh được
   - mục `10` chỉ chỉnh mapping được, CLO không chỉnh được

## 9.2 Reload

1. Sửa mục `3`, `9`, `10`
2. Lưu
3. Reload trang
4. Xác nhận:
   - phần đã sửa vẫn còn
   - phần bị khóa không bị đổi ngoài ý muốn

## 9.3 Không ảnh hưởng đề cương gốc

1. Chỉnh mục `3`, `9`, `10` trong đề cương CTDT
2. Mở lại đề cương gốc của học phần
3. Xác nhận đề cương gốc không bị thay đổi do thao tác ở CTDT

## 9.4 Dữ liệu cũ

1. Mở một đề cương CTDT cũ đang ở schema cũ
2. Editor vẫn render được
3. Save thành công
4. Mở lại không lỗi

## 10. Rủi ro và lưu ý

- `syllabus-editor.js` hiện đang chứa nhiều logic cũ; việc đổi sang shape mới cần làm cẩn thận để không phá import hoặc approval ngoài phạm vi
- Nếu `load-from-base` vẫn copy raw content cũ mà không normalize, UI mới sẽ còn phát sinh drift
- Nếu guard chỉ làm ở UI mà không làm ở server, client vẫn có thể ghi nhầm các mục bị khóa

## 11. Kết quả mong muốn

Sau thay đổi này, đề cương CTDT trở thành:

- một bản sao có kiểm soát của đề cương gốc
- hiển thị gần giống đề cương gốc
- chỉ cho phép chỉnh đúng các phần mang tính CTDT là mục `3, 9, 10`
- giữ ranh giới rõ giữa dữ liệu học phần gốc và dữ liệu theo CTDT
