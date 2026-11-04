# Sổ mã IMEI / SN nội bộ

- Samsung: `35399` + 9 số ngẫu nhiên + Luhn. Xiaomi: `86799` + 9 số ngẫu nhiên + Luhn. Hãng còn lại: mã tài khoản + số ngẫu nhiên cho đủ 14 số + Luhn.
- Apple iPhone 13 trở lên: `S99` + 8 ký tự ngẫu nhiên, tổng cộng 11 ký tự. Apple iPhone còn lại: `S99` + 10 ký tự ngẫu nhiên, tổng cộng 13 ký tự. Dùng chữ hoa và số, loại O và I. SN không tính Luhn. Đây là độ dài chủ trang đã chốt.
- IMEI được kiểm tra Luhn. IMEI / SN ở đây là mã nội bộ; không xác nhận mã do hãng cấp hay mã của thiết bị thật.
- Mod cần quyền riêng: `imei` (xem sổ của mình), `action:imei-create`, `action:imei-cancel-own`, `action:imei-manage-all` (xem và hủy mã của mọi người). Admin giữ toàn quyền. API đọc lại quyền tài khoản ở mỗi yêu cầu.
- Quyền hủy mã của mình chỉ có hiệu lực trong 2 phút kể từ lúc lượt cấp được ghi vào sổ. Đúng mốc 2 phút trở đi, chỉ quyền quản lý toàn bộ sổ (hoặc Admin toàn quyền) mới hủy được. Thông báo hết hạn: “Cần Hủy Mã Liên Hệ Quản Lý: 37804 - Lê Thanh Sang”. Máy chủ xét giờ lại trước mỗi lần ghi. Gửi lại một lệnh hủy đã hoàn tất vẫn trả kết quả cũ, không đụng lượt cấp mới.

## Lưu và cấp mã

Dùng bảng `system_settings` đang có, với khóa chính `key`; không cần đổi cấu trúc cơ sở dữ liệu. Không dùng upsert cho sổ mã.

- `IMEI_V1_REQUEST_<actor>_<uuid>`: kế hoạch bất biến của một lượt tạo, gồm mã ứng viên, hãng và chủ lượt. Lưu trước khi cấp. Trình duyệt giữ UUID để gửi lại đúng lượt sau khi rớt mạng.
- `IMEI_V1_CODE_<code>`: sổ riêng của một IMEI hoặc SN, có revision và toàn bộ lịch sử cấp, hủy. Mỗi thay đổi dùng INSERT với khóa duy nhất hoặc PATCH kiểm tra revision. Chỉ một lượt chưa hủy được giữ mã.
- Mã đã hủy được chọn trước khi tạo số ngẫu nhiên. Mỗi lần cấp lại có UUID khác. Hủy theo UUID của lượt cấp, không hủy chỉ theo dãy số.
- Mã được chọn lại phải đúng cả phần đầu và độ dài. Hai mục Apple có phần đầu giống nhau nhưng không dùng lẫn độ dài. IMEI Xiaomi cũ đầu `867` vẫn tra cứu, hủy và nhận lại qua UUID cũ; lượt chưa cấp theo quy tắc cũ phải tạo lại với đầu `86799`.
- Nếu ứng viên bị người khác nhận giữa lúc chọn và ghi, ghi kết quả xung đột vào sổ. Lượt ấy không được tự đổi sang ứng viên khác; người dùng tạo lượt mới. Nhờ vậy, gửi lại một yêu cầu sau khi mất phản hồi không thể cấp dư mã.
- Lịch sử lấy từng trang 20 lượt. Sổ IMEI bị loại khỏi phần đọc cấu hình chung để không tải theo các trang công khai. Bản sao lưu toàn bộ `system_settings` có giữ sổ này.

## Khôi phục

Giữ nguyên cả hai nhóm khóa khi sao lưu, phục hồi hoặc dọn dữ liệu. Không xóa riêng kế hoạch hay sổ mã. Phục hồi bản sao lưu cũ có thể làm mất các lượt cấp sau ngày sao lưu; phải đối chiếu trước khi mở lại chức năng. Không chỉnh sổ bằng API cấu hình chung.

`node --test tests/imei.test.cjs tests/admin-setup.test.cjs tests/portal-navigation.test.cjs` kiểm tra Luhn, cấp đồng thời, phản hồi thất lạc, hủy/cấp lại, hủy nhầm lượt cũ, phân trang và quyền Mod.
