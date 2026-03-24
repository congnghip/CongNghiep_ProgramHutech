# AI Implementation Guide: 4-Step Document Import Workflow

Tài liệu này mô tả chi tiết quy trình 4 bước để Import dữ liệu từ một tài liệu văn bản (Word/PDF) vào hệ thống quản lý chương trình đào tạo. Tài liệu tập trung vào các khái niệm cốt lõi, ràng buộc nghiệp vụ (business constraints) và các cách thức xử lý lỗi (error handling) đã chắt lọc được, không phụ thuộc vào bất kỳ ngôn ngữ lập trình hay framework cụ thể nào (Language & Framework Agnostic).

## I. Tổng Quan 4 Bước Cấu Trúc Luồng (The 4-Step Workflow)

Quá trình import dữ liệu cực kì phức tạp nếu làm trong 1 lần. Do đó, hệ thống chia làm 4 bước tuần tự để đảm bảo dữ liệu "Sạch" và "Chính xác" trước khi lưu vào Cơ sở dữ liệu (Database).

### Bước 1: Parse & Nhận dạng dữ liệu (Extract & Parse)
- **Mục tiêu:** Nhận file upload từ người dùng, trích xuất toàn bộ Text, Tables (Bảng biểu), cấu trúc đoạn văn, sau đó ánh xạ thành một cấu trúc JSON/Object đa tầng được chuẩn hoá.
- **Quy tắc:** Tuyệt đối **không** tạo bất cứ dữ liệu rác nào trong Database ở bước này. Toàn bộ quá trình chạy hoàn toàn trên RAM/bộ nhớ và trả lại kết quả thô về phía ứng dụng của người dùng (Client/Frontend).

### Bước 2: Bơm dữ liệu & Chỉnh sửa thủ công (Preview, Map & Edit)
- **Mục tiêu:** Hiển thị cục dữ liệu đã Parse ở Bước 1 lên một giao diện tương tác (thường là giao diện phân chia theo từng Tabs: Thông tin chung, PO, PLO, PI, Môn học, Ma trận).
- **Quy tắc:**
  - Nhận diện người máy (bot) không bao giờ có thể đọc chính xác 100% file văn bản do format dị biệt từ người soạn thảo.
  - Cho phép người dùng bổ sung các trường bị thiết sót, xóa các hàng bị nhận diện sai, hoặc điền bù các tham số mà bộ Parse không đọc được. Toàn bộ thay đổi đang thao tác cấu trúc JSON tạm ở Client.

### Bước 3: Xác thực tính toàn vẹn (Validate)
- **Mục tiêu:** Nhấn nút kiểm tra dữ liệu trước khi đẩy đi.
- **Quy tắc:**
  - Client gửi toàn bộ mạng lưới dữ liệu lên Server.
  - Server kiểm tra ràng buộc chéo (Cross-validation): Các môn học có tồn tại không? Tín chỉ thực hành / lý thuyết cộng lại có bằng tổng tín chỉ không? Có môn học nào map vào một PLO/PI không tồn tại không?
  - Báo lỗi chi tiết trả về chính xác tọa độ lỗi (Ở Tab nào, dòng chữ nào, thuộc tính nào).

### Bước 4: Lưu trữ Nguyên tử (Atomic Commit)
- **Mục tiêu:** Ghi dữ liệu chính thức vào Cơ sở dữ liệu.
- **Quy tắc:** Thực thi **Transaction (Giao dịch nguyên tử)**. Thêm mới đồng loạt từ Cha -> Con. Nếu chèn một record (ví dụ: một liên kết Ma trận bị lỗi) thì toàn bộ hệ thống phải Rollback lại từ đầu, đảm bảo không có bất kỳ rác nào trong DB.

---

## II. Các Ràng Buộc Nghiệp Vụ Cốt Lõi (Business Constraints & Parsing Rules)

Dựa trên kinh nghiệm xử lý tài liệu thực tế, các quy tắc sau **bắt buộc phải chú ý** khi phát triển bộ Parser để tránh các lỗi thường gặp:

### 1. Bóc tách Thông tin chung (Program Info)
- **Vấn đề:** Các thuật ngữ "Tên tiếng Việt", "Tên tiếng Anh", "Mã ngành" có thể có hoặc không có dấu hai chấm (`:`), hoặc có khoảng trắng thừa do lỗi gõ phím của người dùng.
- **Xử lý:** Cần áp dụng cơ chế làm sạch (`strip()`, `trim()`) và kiểm tra chuỗi chứa (contains) thay vì so sánh bằng chính xác tuyệt đối.

### 2. Thu thập Mục tiêu (POs) & Chuẩn đầu ra (PLOs)
- **Vấn đề:** 
  - Thường PO nằm ở định dạng văn bản thường (Paragaph) với tiền tố "PO1:", "PO2".
  - Một số PLO lại nằm trong bảng biểu.
- **Xử lý:** 
  - Với văn bản thường (Paragraph), dùng **Regular Expression (Regex)** (VD: `^PO\d+:`) để bắt các đoạn văn bắt đầu bằng PO.
  - Khi bóc bảng PLO, cần chú ý cột "Mức độ" (Level) và một cột chứa các PO tương ứng map với nó (có thể cách nhau bằng dấu phẩy).

### 3. Tổ chức cấu trúc Môn học & Khối kiến thức
- **Lỗi kinh điển:** Cột tiêu đề "Khối kiến thức" (Ví dụ: Kiến thức giáo dục đại cương) thường bị **Merge (Gộp ô ngang/dọc)** toàn bộ bảng.
- **Cách nhận diện và xử lý (Fix adopted):** 
  - Tracking biến `current_block`: Khi đọc theo từng hàng (Row), nếu thấy 3 cột đầu tiên có giá trị trống hoặc có giá trị string giống hệt nhau (do lỗi parse merged cell) thì gán đó là Tên Block hiện tại. Các môn học ở các dòng tiếp theo sẽ tự động được kế thừa `current_block` này cho đến khi gặp dòng Group mới.
  - Mã học phần (Course code) thường có chuỗi cấu trúc nhất định, bắt buộc dùng Regex để nhận diện (Ví dụ: `^[A-Z]{3,}\d+[A-Z]?$` - 3 chữ hoa + số).

### 4. Ma trận Mapping (PO-PLO và Course-PI)
Ma trận là nơi parse phức tạp nhất vì dính đến rất nhiều Merge Cell.

- **Ma trận đánh dấu "X":** Dễ nhận dạng, tìm các ô chứa kí tự "X" (Cần cẩn thận `x` viết thường hoặc có khoảng trắng).
- **Ma trận trọng số mãng (Course - PI Mapping - số 1, 2, 3):**
  - **Lỗi 1 - Định vị sai Dòng chứa Mã tham chiếu (PI Matrix):** Trong file Word, cột PI nằm bên dưới ô PLO bị merge. Bộ parser sẽ dễ chọn sai dòng.
    *Cách fix:* Không fix cứng theo index row. Quét từ Row 1 tới Row 3, dùng RegEx check dòng nào chứa định dạng số (VD: `1.1`, `1.2`) thì khẳng định đó là Dòng Header PI.
  - **Lỗi 2 - Không lấy được mã PLO cha của PI:** Ô PLO bị merge nằm trên ô PI. Do thư viện đọc table theo cell mảng hai chiều, ô PLO của các cột sau bị rỗng.
    *Cách fix:* Viết cơ chế Fallback (Lấy mượn). Đọc cột PLO, nếu rỗng, lấy giá trị PLO của column sát bên trái gán qua.
  - **Lỗi 3 - Mã PI không đồng nhất:** Lúc gõ file Word, có mã là `1.1`, có mã là `PI.1.1`.
    *Cách fix:* Luôn chuẩn hóa (Normalize) sau khi bắt được chuỗi -> Tự động thêm tiền tố `PI.` nếu phát hiện chuỗi mới bắt đầu bằng thẻ số.
  - **Lỗi 4 - Cột "Mã Học Phần" chạy lung tung:** Có bảng Mã dọc nằm ở cột 0, bảng khác Mã dọc bị lùi sang cột 1 do dư số Thứ tự (STT).
    *Cách fix:* Check song song Cột 0 và Cột 1, ô nào pass qua điều kiện Regex định dạng Môn học thì chốt lấy ô đó làm "Mã HP".

---

## III. Tại sao AI cần biết những điều này cho các dự án ngôn ngữ khác?
Nếu triển khai luồng workflow này ở dự án Golang, Node.js, hay C#, AI vẫn sẽ gặp lại các vấn đề vật lý tương tự với cấu trúc của thư viện Doc/PDF reader. Việc hiểu trước các cấu trúc mảng 2 chiều bị đứt gãy do "Merged Cell" (Ô gộp) và áp dụng cơ chế "Stateful parsing" (Lưu biến tracking trạng thái ở dòng lặp hiện tại như `current_block`, `previous_PLO_header`) chính là chìa khóa để xử lý thành công tính năng Import Matrix.
