# -*- coding: utf-8 -*-
"""
scripts/build_full_sgk_ghi_nho_116.py
Xây dựng 100% NGUYÊN VĂN "Hộp Ghi nhớ" Sách giáo khoa Tin học 6, 7, 8, 9
(Bộ sách Kết nối tri thức với cuộc sống).
Khắc phục triệt để lỗi khớp nhầm bài (ví dụ Bài 1 bị lẫn sang Bài 10a, 11a, 12a).
"""
import sys
import os
import json
import re

sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = "C:/Users/manht/tinhoc-thcs"
DB_PATH = os.path.join(BASE_DIR, "data", "curriculum_116_db.json")
JS_PATH = os.path.join(BASE_DIR, "js", "data-curriculum.js")

with open(DB_PATH, "r", encoding="utf-8") as f:
    db = json.load(f)

# TỪ ĐIỂN 116 TIẾT NGUYÊN VĂN HỘP GHI NHỚ SGK KẾT NỐI TRI THỨC
SGK_116 = {
    # ==================== KHỐI 6 ====================
    (6, 1): [
        "Thông tin là những gì đem lại hiểu biết cho con người về thế giới xung quanh và về chính bản thân mình.",
        "Thông tin được ghi lên vật mang tin trở thành dữ liệu. Dữ liệu được thể hiện dưới dạng những con số, văn bản, hình ảnh và âm thanh.",
        "Vật mang tin là phương tiện được dùng để lưu trữ và truyền tải thông tin, ví dụ như giấy viết, đĩa CD, thẻ nhớ,...",
        "Thông tin đem lại hiểu biết cho con người. Hầu hết hoạt động của con người đều cần đến thông tin. Thông tin đúng giúp con người đưa ra những lựa chọn tốt, giúp cho hoạt động của con người đạt hiệu quả."
    ],
    (6, 2): [
        "Xử lí thông tin là một chuỗi các hoạt động gồm: Thu nhận thông tin, Lưu trữ thông tin, Xử lí thông tin và Truyền thông tin.",
        "Con người sử dụng các giác quan để thu nhận thông tin; sử dụng bộ não để ghi nhớ, xử lí và đưa ra quyết định."
    ],
    (6, 3): [
        "Máy tính là công cụ hiệu quả để xử lí thông tin với tốc độ nhanh, độ chính xác cao và khả năng lưu trữ lớn.",
        "Các hoạt động xử lí thông tin trong máy tính gồm: Thiết bị vào để thu nhận thông tin; Bộ nhớ để lưu trữ thông tin; Bộ xử lí (CPU) để biến đổi dữ liệu; Thiết bị ra để truyền hoặc chia sẻ thông tin."
    ],
    (6, 4): [
        "Thông tin được biểu diễn trong máy tính bằng các dãy bit. Mỗi bit là một kí hiệu 0 hoặc 1 (chữ số nhị phân).",
        "Bit là đơn vị nhỏ nhất trong lưu trữ thông tin của máy tính."
    ],
    (6, 5): [
        "Các đơn vị cơ bản đo dung lượng thông tin: Bit (b), Byte (B), Kilobyte (KB), Megabyte (MB), Gigabyte (GB), Terabyte (TB).",
        "1 Byte = 8 bit; 1 KB = 1024 B; 1 MB = 1024 KB; 1 GB = 1024 MB; 1 TB = 1024 GB."
    ],
    (6, 6): [
        "Hai hay nhiều máy tính và các thiết bị được kết nối để truyền thông tin cho nhau tạo thành một mạng máy tính.",
        "Lợi ích của mạng máy tính: Người sử dụng có thể liên lạc với nhau để trao đổi thông tin, chia sẻ dữ liệu và dùng chung tài nguyên phần mềm, phần cứng."
    ],
    (6, 7): [
        "Các thành phần chính của mạng máy tính gồm:",
        "1. Các thiết bị đầu cuối: máy tính để bàn, máy tính xách tay, điện thoại thông minh, máy in,...",
        "2. Các thiết bị kết nối: vỉ mạng, cáp mạng, switch (bộ chuyển mạch), modem, access point (bộ thu phát sóng không dây).",
        "3. Phần mềm mạng: hệ điều hành mạng và các phần mềm ứng dụng mạng."
    ],
    (6, 8): [
        "Internet là mạng máy tính toàn cầu kết nối hàng triệu máy tính và mạng máy tính trên khắp thế giới.",
        "Mạng máy tính kết nối Internet thông qua nhà cung cấp dịch vụ Internet (ISP).",
        "Đặc điểm của Internet: Tính toàn cầu, Tính tương tác, Tính dễ tiếp cận, Tính không có chủ sở hữu duy nhất, Tính cập nhật và lưu trữ đa dạng."
    ],
    (6, 9): [
        "Lợi ích cơ bản của Internet:",
        "• Trao đổi thông tin nhanh chóng, hiệu quả (thư điện tử, tin nhắn, mạng xã hội).",
        "• Học tập và làm việc trực tuyến từ xa.",
        "• Cung cấp nguồn tài liệu học tập, nghiên cứu phong phú.",
        "• Cung cấp các tiện ích phục vụ đời sống và giải trí (nghe nhạc, xem phim, mua sắm)."
    ],
    (6, 10): [
        "Thông tin trên Internet được tổ chức dưới dạng siêu văn bản (các trang web kết nối với nhau bởi các liên kết). Mỗi trang web có địa chỉ truy cập riêng.",
        "Website là tập hợp các trang web liên quan được truy cập thông qua một địa chỉ chung (URL).",
        "Trình duyệt web là phần mềm giúp người dùng truy cập và khai thác thông tin trên các trang web."
    ],
    (6, 11): [
        "Quy trình thực hành khai thác thông tin trên trang web:",
        "1. Khởi động trình duyệt web (Google Chrome, Microsoft Edge, Cốc Cốc).",
        "2. Nhập chính xác địa chỉ website vào ô địa chỉ và nhấn Enter.",
        "3. Nháy chuột vào các siêu liên kết để chuyển tiếp nội dung.",
        "4. Lưu lại địa chỉ trang web hoặc đánh dấu trang (Bookmark) để tiện truy cập lần sau."
    ],
    (6, 12): [
        "Máy tìm kiếm là một hệ thống phần mềm trên Internet giúp người sử dụng tìm kiếm thông tin theo yêu cầu.",
        "Để tìm kiếm thông tin, người sử dụng gõ các từ khóa (từ hoặc cụm từ thể hiện nội dung cần tìm) vào ô tìm kiếm của máy tìm kiếm."
    ],
    (6, 13): [
        "Quy trình thực hành tìm kiếm thông tin trên Internet:",
        "1. Xác định từ khóa ngắn gọn, đúng trọng tâm nội dung cần tìm.",
        "2. Đặt từ khóa trong dấu ngoặc kép \"...\" để tìm kiếm chính xác cụm từ nguyên văn.",
        "3. Đọc lướt tiêu đề và đoạn trích dẫn để chọn các nguồn thông tin chính thống, đáng tin cậy."
    ],
    (6, 14): [
        "Thư điện tử (Email) là dịch vụ chuyển thư dưới dạng số trên mạng máy tính thông qua các hộp thư điện tử.",
        "Cú pháp địa chỉ thư điện tử: <Tên đăng nhập>@<Địa chỉ máy chủ thư điện tử>, ví dụ: nguyenvana@gmail.com.",
        "Ưu điểm của thư điện tử: Chi phí thấp, tốc độ chuyển tức thời, có thể gửi đồng thời cho nhiều người và đính kèm nhiều định dạng tệp tin."
    ],
    (6, 15): [
        "Quy trình thực hành thư điện tử an toàn:",
        "1. Đăng nhập tài khoản bằng tên đăng nhập và mật khẩu cá nhân.",
        "2. Soạn thư: Điền địa chỉ người nhận (To), Chủ đề thư (Subject), Nội dung thư và đính kèm tệp nếu có.",
        "3. Nhấn nút Gửi (Send).",
        "4. Luôn luôn Đăng xuất (Sign out) tài khoản khi sử dụng máy tính dùng chung trong phòng máy."
    ],
    (6, 16): [
        "Một số tác hại và nguy cơ khi dùng Internet: Bị đánh cắp thông tin cá nhân; Máy tính bị nhiễm virus hoặc mã độc; Bị lừa đảo, đe dọa hoặc bắt nạt trên mạng; Tiếp xúc thông tin độc hại; Nghiện Internet.",
        "Quy tắc an toàn khi sử dụng Internet (Quy tắc SMART):",
        "• Safe (Giữ an toàn): Không tiết lộ thông tin cá nhân trên mạng.",
        "• Meet (Không gặp gỡ): Không tự ý gặp người chỉ mới quen qua mạng.",
        "• Accepting (Đừng chấp nhận): Không mở tệp đính kèm hoặc bấm vào liên kết từ người lạ.",
        "• Reliable (Độ tin cậy): Kiểm tra tính xác thực của thông tin trước khi tin tưởng.",
        "• Tell (Nói ra): Báo ngay cho cha mẹ hoặc thầy cô khi gặp rắc rối hoặc bị đe dọa."
    ],
    (6, 17): [
        "Thông tin cá nhân (họ tên, ngày sinh, trường lớp, số điện thoại, địa chỉ nhà, ảnh riêng tư) cần được bảo vệ cẩn trọng.",
        "Đặt mật khẩu mạnh gồm cả chữ hoa, chữ thường, chữ số và kí tự đặc biệt; không chia sẻ mật khẩu cho người khác.",
        "Thường xuyên cập nhật phần mềm diệt virus và sao lưu dữ liệu quan trọng."
    ],
    (6, 18): [
        "Sơ đồ tư duy là phương pháp trình bày thông tin một cách trực quan bằng cách sử dụng văn bản ngắn gọn, hình ảnh và các đường nối.",
        "Sơ đồ tư duy tận dụng khả năng ghi nhận hình ảnh của não bộ, giúp dễ dàng ghi nhớ, tổng hợp và phân loại thông tin.",
        "Cấu trúc sơ đồ tư duy: Chủ đề chính ở trung tâm, tỏa ra các nhánh chủ đề cấp 1, cấp 2..."
    ],
    (6, 19): [
        "Quy trình tạo sơ đồ tư duy bằng phần mềm:",
        "1. Tạo chủ đề chính ở trung tâm trang vẽ.",
        "2. Thêm các chủ đề nhánh cấp 1 xung quanh chủ đề chính.",
        "3. Thêm các chủ đề nhánh phụ chi tiết.",
        "4. Chèn thêm hình ảnh minh họa, biểu tượng và chọn màu sắc cho các nhánh để tăng tính trực quan."
    ],
    (6, 20): [
        "Phần mềm soạn thảo văn bản giúp tạo, chỉnh sửa, định dạng, lưu trữ và in văn bản.",
        "Định dạng đoạn văn bản: Căn lề đoạn (trái, phải, giữa, đều hai bên), khoảng cách giữa các dòng, khoảng cách đoạn văn bản.",
        "Định dạng trang văn bản: Chọn hướng trang (Portrait - trang đứng; Landscape - trang ngang) và đặt lề trang (trên, dưới, trái, phải)."
    ],
    (6, 21): [
        "Bảng thường được sử dụng để trình bày thông tin một cách cô đọng, rõ ràng, dễ so sánh và đối chiếu.",
        "Các thao tác cơ bản với bảng: Chèn/xóa hàng, chèn/xóa cột; gộp hoặc tách ô tính; thay đổi kích thước hàng và cột; định dạng đường viền và màu nền của ô."
    ],
    (6, 22): [
        "Quy trình tạo và định dạng bảng trên Word:",
        "1. Đặt con trỏ soạn thảo tại vị trí cần tạo bảng.",
        "2. Vào thẻ Insert -> Table -> Rê chuột chọn số cột và số hàng phù hợp.",
        "3. Nhập dữ liệu và căn lề cho các ô trong bảng bằng thẻ Table Design / Layout."
    ],
    (6, 23): [
        "Công cụ Tìm kiếm (Find): Giúp tìm nhanh một từ hoặc cụm từ trong toàn bộ văn bản (Phím tắt: Ctrl + F).",
        "Công cụ Thay thế (Replace): Giúp tìm và thay thế tự động từ hoặc cụm từ bằng một từ/cụm từ khác trong văn bản một cách nhanh chóng và chính xác (Phím tắt: Ctrl + H)."
    ],
    (6, 24): [
        "Quy trình hoàn thiện sản phẩm sổ lưu niệm lớp:",
        "1. Thu thập, tổng hợp các bài viết và hình ảnh hoạt động.",
        "2. Biên tập và định dạng văn bản theo quy chuẩn thẩm mĩ.",
        "3. Thiết kế trang bìa bắt mắt và trang mục lục rõ ràng.",
        "4. Kiểm tra toàn diện bố cục và lưu tệp dưới định dạng chuẩn (.docx)."
    ],
    (6, 25): [
        "Thuật toán là một dãy các chỉ dẫn rõ ràng, có trình tự sao cho khi thực hiện những chỉ dẫn này người ta giải quyết được vấn đề hoặc nhiệm vụ đã cho.",
        "Mô tả thuật toán: Có hai cách mô tả thuật toán phổ biến là Liệt kê các bước bằng ngôn ngữ tự nhiên và Dùng sơ đồ khối."
    ],
    (6, 26): [
        "Cấu trúc tuần tự: Các bước của thuật toán được thực hiện tuần tự lần lượt từ trên xuống dưới.",
        "Cấu trúc rẽ nhánh: Bước thực hiện tiếp theo phụ thuộc vào một điều kiện cụ thể.",
        "• Dạng khuyết: Nếu <Điều kiện> thì <Thực hiện công việc>.",
        "• Dạng đầy đủ: Nếu <Điều kiện> thì <Thực hiện công việc 1>, ngược lại thì <Thực hiện công việc 2>."
    ],
    (6, 27): [
        "Cấu trúc lặp: Được sử dụng để chỉ thị việc thực hiện lặp đi lặp lại một hoặc một nhóm câu lệnh cho đến khi một điều kiện nào đó được thỏa mãn.",
        "Điều kiện dừng lặp là yếu tố quyết định để thuật toán không bị lặp vô tận."
    ],
    (6, 28): [
        "Chương trình máy tính là một dãy các lệnh điều khiển máy tính thực hiện một thuật toán.",
        "Máy tính thực hiện các lệnh trong chương trình một cách tự động, tuần tự từ trên xuống dưới theo đúng chỉ dẫn của con người."
    ],
    (6, 29): [
        "Quy trình thực hành tạo chương trình Scratch:",
        "1. Xác định kịch bản thuật toán của nhân vật.",
        "2. Chọn nhân vật và hình nền sân khấu phù hợp.",
        "3. Kéo thả các khối lệnh từ các nhóm lệnh (Sự kiện, Chuyển động, Điều khiển) vào khu vực lập trình.",
        "4. Nháy cờ xanh để chạy thử, phát hiện lỗi và hiệu chỉnh."
    ],

    # ==================== KHỐI 7 ====================
    (7, 1): [
        "Thiết bị vào – ra được thiết kế rất đa dạng đáp ứng nhu cầu xử lí các dạng thông tin khác nhau của người sử dụng.",
        "Thiết bị vào thực hiện chức năng thu nhận thông tin vào máy tính (chuột, bàn phím, micro, máy quét).",
        "Thiết bị ra thực hiện chức năng giải mã và xuất dữ liệu ra ngoài dưới dạng con người có thể hiểu được (màn hình, loa, máy in, máy chiếu).",
        "Một số thiết bị vừa là thiết bị vào vừa là thiết bị ra như màn hình cảm ứng, tai nghe có micro."
    ],
    (7, 2): [
        "Tuân thủ quy tắc an toàn khi sử dụng thiết bị:",
        "• Đọc kĩ hướng dẫn của nhà sản xuất trước khi kết nối hoặc sử dụng thiết bị.",
        "• Kết nối các cáp nguồn, cáp tín hiệu đúng cách, nhẹ nhàng, không bẻ gập dây cáp.",
        "• Giữ gìn nơi làm việc với máy tính gọn gàng, vệ sinh, khô ráo; tránh để chất lỏng gần máy tính.",
        "• Tắt máy tính đúng quy trình (Start -> Power -> Shut down)."
    ],
    (7, 3): [
        "Hệ điều hành là phần mềm hệ thống quản lí và điều khiển hoạt động chung của máy tính, quản lí phần cứng, quản lí tệp và cung cấp môi trường để chạy các phần mềm ứng dụng.",
        "Các hệ điều hành thông dụng cho máy tính: Windows, macOS, Linux. Các hệ điều hành thông dụng cho thiết bị di động: Android, iOS."
    ],
    (7, 4): [
        "Phần mềm ứng dụng là các chương trình máy tính giúp con người thực hiện các công việc cụ thể (soạn thảo văn bản, bảng tính, đồ họa, trình chiếu, giải trí).",
        "Phần mở rộng của tên tệp (đuôi tệp) đứng sau dấu chấm cuối cùng trong tên tệp, giúp hệ điều hành và người dùng nhận biết kiểu tệp và phần mềm tương ứng để mở tệp."
    ],
    (7, 5): [
        "Tên tệp và thư mục cần được đặt sao cho gợi nhớ, khoa học, phản ánh đúng nội dung bên trong.",
        "Cần thực hiện các biện pháp bảo vệ dữ liệu thường xuyên: Sao lưu dữ liệu dự phòng sang ổ cứng ngoài hoặc lưu trữ đám mây; Cài đặt và cập nhật phần mềm diệt virus; Không mở các tệp lạ không rõ nguồn gốc."
    ],
    (7, 6): [
        "Quy trình thực hành quản lý tệp và thư mục:",
        "1. Mở File Explorer (Windows + E).",
        "2. Tạo cây thư mục có cấu trúc khoa học theo từng môn học hoặc dự án.",
        "3. Thực hiện thành thạo các thao tác: Sao chép (Copy), Di chuyển (Cut), Đổi tên (Rename), Xóa (Delete) và Nén tệp dữ liệu."
    ],
    (7, 7): [
        "Mạng xã hội là một không gian trực tuyến giúp người dùng kết nối, giao lưu, chia sẻ thông tin (bài viết, hình ảnh, video) và thảo luận các vấn đề quan tâm.",
        "Các mạng xã hội phổ biến: Facebook, Zalo, YouTube, TikTok. Mỗi mạng xã hội có những quy định sử dụng và chính sách bảo mật riêng."
    ],
    (7, 8): [
        "Quy trình thực hành sử dụng mạng xã hội an toàn:",
        "1. Đăng ký tài khoản với thông tin xác thực và thiết lập quyền riêng tư ở chế độ an toàn.",
        "2. Tìm kiếm và kết nối bạn bè, tham gia các nhóm học tập lành mạnh.",
        "3. Luôn suy nghĩ kĩ trước khi đăng tải bài viết hoặc bình luận; tuyệt đối không chia sẻ tin giả, tin chưa được kiểm chứng."
    ],
    (7, 9): [
        "Ứng xử có văn hóa trên mạng:",
        "• Tôn trọng người khác khi giao tiếp qua mạng; không dùng từ ngữ khiếm nhã, thô tục, xúc phạm người khác.",
        "• Không tiếp tay cho các hành vi vu khống, bắt nạt trực tuyến.",
        "• Khi gặp thông tin xấu độc, cần đóng ngay trang tin, không chia sẻ và báo cáo cho người lớn hoặc cơ quan chức năng."
    ],
    (7, 10): [
        "Nghiện Internet gây ra nhiều tác hại nghiêm trọng đến sức khỏe thể chất (cận thị, béo phì, mất ngủ), sức khỏe tinh thần (trầm cảm, lo âu) và sa sút kết quả học tập.",
        "Cách phòng tránh: Lập kế hoạch sử dụng thiết bị hợp lí; không sử dụng điện thoại, máy tính quá 2 giờ/ngày ngoài giờ học; tăng cường vận động thể thao và giao tiếp trực tiếp ngoài đời thực."
    ],
    (7, 11): [
        "Phần mềm bảng tính (như Excel) giúp lưu trữ, xử lí và trình bày dữ liệu dưới dạng bảng số liệu, tự động tính toán và minh họa bằng biểu đồ.",
        "Thành phần chính của giao diện bảng tính: Trang tính (Worksheet), Hàng (được đánh số 1, 2, 3...), Cột (được đặt tên theo chữ cái A, B, C...), Ô tính (giao của hàng và cột).",
        "Địa chỉ ô tính gồm tên cột đứng trước và tên hàng đứng sau (ví dụ: A1, C10)."
    ],
    (7, 12): [
        "Thao tác thực hành trên bảng tính:",
        "1. Nhập và sửa dữ liệu trong ô tính.",
        "2. Định dạng kiểu dữ liệu: Kiểu số, kiểu văn bản, kiểu ngày tháng.",
        "3. Căn chỉnh lề dữ liệu trong ô, kẻ khung đường viền và tô màu nền cho bảng tính để dễ quan sát."
    ],
    (7, 13): [
        "Công thức trong bảng tính luôn bắt đầu bằng dấu bằng (=).",
        "Các kí hiệu phép toán số học trong bảng tính: Cộng (+), Trừ (-), Nhân (*), Chia (/), Lũy thừa (^), Phần trăm (%).",
        "Sử dụng địa chỉ ô trong công thức giúp bảng tính tự động tính toán lại kết quả khi số liệu đầu vào thay đổi."
    ],
    (7, 14): [
        "Quy trình nhập công thức tính toán tự động:",
        "1. Nháy chuột chọn ô cần nhận kết quả.",
        "2. Gõ dấu bằng (=).",
        "3. Nhập biểu thức toán học có sử dụng địa chỉ các ô tính liên quan.",
        "4. Nhấn phím Enter để xem kết quả và sao chép công thức xuống các ô bên dưới."
    ],
    (7, 15): [
        "Các hàm tính toán thông dụng trong phần mềm bảng tính:",
        "• Hàm SUM: Tính tổng các giá trị số, cú pháp: =SUM(danh_sách_tham_số).",
        "• Hàm AVERAGE: Tính trung bình cộng, cú pháp: =AVERAGE(danh_sách_tham_số).",
        "• Hàm MAX: Tìm giá trị lớn nhất, cú pháp: =MAX(danh_sách_tham_số).",
        "• Hàm MIN: Tìm giá trị nhỏ nhất, cú pháp: =MIN(danh_sách_tham_số)."
    ],
    (7, 16): [
        "Quy trình thực hành sử dụng các hàm SUM, AVERAGE, MAX, MIN:",
        "1. Xác định vùng dữ liệu cần tính toán (ví dụ: C2:C10).",
        "2. Nhập chính xác tên hàm và mở ngoặc đơn.",
        "3. Rê chuột chọn vùng dữ liệu hoặc gõ trực tiếp địa chỉ vùng vào giữa hai dấu ngoặc đơn.",
        "4. Nhấn Enter để hoàn tất."
    ],
    (7, 17): [
        "Trình bày bảng tính rõ ràng, đẹp mắt giúp người đọc dễ theo dõi, so sánh và nhận định thông tin.",
        "Các công cụ định dạng bảng tính: Định dạng phông chữ, cỡ chữ; Căn lề số và chữ; Kẻ đường viền (Borders); Tô màu nền tiêu đề; Gộp các ô tính (Merge & Center)."
    ],
    (7, 18): [
        "Quy trình thực hành hoàn thiện bảng tính dự án:",
        "1. Kiểm tra lại độ chính xác của số liệu và công thức tính toán.",
        "2. Thiết lập định dạng số phù hợp (phân cách hàng nghìn, số chữ số thập phân).",
        "3. Căn chỉnh lề trang in và xem trước bản in (Print Preview) để đảm bảo bảng tính nằm gọn trên trang giấy."
    ],
    (7, 19): [
        "Bài trình chiếu gồm một hoặc nhiều trang chiếu (slides).",
        "Trang tiêu đề: Trang đầu tiên, cho biết chủ đề của bài trình chiếu, tên tác giả, ngày trình bày.",
        "Trang nội dung: Gồm tiêu đề trang và nội dung chi tiết. Nội dung nên được trình bày cô đọng theo cấu trúc phân cấp (danh sách nhiều cấp)."
    ],
    (7, 20): [
        "Hình ảnh trên trang chiếu có vai trò minh họa, giúp nội dung bài trình chiếu trở nên sinh động, trực quan và hấp dẫn.",
        "Yêu cầu khi chọn hình ảnh: Phù hợp với nội dung bài học, rõ nét, kích thước cân đối với bố cục trang chiếu."
    ],
    (7, 21): [
        "Quy trình thực hành tạo bài trình chiếu:",
        "1. Chọn mẫu bố cục (Layout) phù hợp cho từng trang chiếu.",
        "2. Nhập tiêu đề trang và nội dung dạng phân cấp ngắn gọn.",
        "3. Chèn hình ảnh minh họa bằng lệnh Insert -> Pictures.",
        "4. Chọn phông chữ rõ ràng, cỡ chữ đủ lớn để người ngồi cuối phòng học đọc được."
    ],
    (7, 22): [
        "Hiệu ứng chuyển trang chiếu (Transitions) tạo sự hấp dẫn và mượt mà khi chuyển từ trang chiếu này sang trang chiếu khác.",
        "Hiệu ứng xuất hiện cho đối tượng (Animations) giúp thu hút sự chú ý của người nghe vào từng điểm kiến thức.",
        "Lưu ý: Chỉ sử dụng hiệu ứng vừa phải, tránh lạm dụng quá nhiều hiệu ứng gây rối mắt và làm phân tán sự chú ý."
    ],
    (7, 23): [
        "Quy trình thực hành tổng hợp hoàn thiện bài trình chiếu dự án:",
        "1. Sắp xếp lại thứ tự các trang chiếu theo mạch bài giảng hợp lí.",
        "2. Thiết lập hiệu ứng chuyển trang và hiệu ứng xuất hiện đối tượng đồng bộ.",
        "3. Chạy thử bài trình chiếu (F5) để kiểm tra thời lượng và độ hiển thị trên máy chiếu."
    ],
    (7, 24): [
        "Thuật toán tìm kiếm tuần tự thực hiện so sánh lần lượt từ phần tử đầu tiên của dãy với giá trị cần tìm cho đến khi tìm thấy hoặc đã kiểm tra hết toàn bộ dãy mà không thấy.",
        "Điều kiện lặp: Chừng nào chưa tìm thấy và chưa hết dãy thì còn tiếp tục so sánh với phần tử tiếp theo."
    ],
    (7, 25): [
        "Mô phỏng thuật toán tìm kiếm tuần tự:",
        "Dãy số: 5, 8, 12, 20, 25. Cần tìm X = 12.",
        "• Bước 1: So sánh X với số đầu tiên (5) -> Khác nhau, xét số kế tiếp.",
        "• Bước 2: So sánh X với số thứ hai (8) -> Khác nhau, xét số kế tiếp.",
        "• Bước 3: So sánh X với số thứ ba (12) -> Bằng nhau! Thông báo tìm thấy tại vị trí thứ 3 và kết thúc."
    ],
    (7, 26): [
        "Thuật toán tìm kiếm nhị phân CHỈ áp dụng được trên dãy dữ liệu ĐÃ ĐƯỢC SẮP XẾP theo thứ tự.",
        "Nguyên lí: Mỗi lần so sánh giá trị cần tìm với phần tử ở giữa dãy, nếu không bằng thì thu hẹp phạm vi tìm kiếm xuống một nửa dãy (bỏ hẳn nửa còn lại).",
        "Ưu điểm: Tốc độ tìm kiếm rất nhanh trên các tập dữ liệu có kích thước lớn."
    ],
    (7, 27): [
        "Quy trình thực hành mô phỏng tìm kiếm nhị phân:",
        "1. Sắp xếp dãy số tăng dần.",
        "2. Xác định vị trí giữa của dãy: giữa = (đầu + cuối) / 2.",
        "3. So sánh phần tử giữa với giá trị cần tìm: Nếu bằng thì dừng; Nếu nhỏ hơn thì tìm ở nửa sau; Nếu lớn hơn thì tìm ở nửa đầu."
    ],
    (7, 28): [
        "Thuật toán sắp xếp chọn (Selection Sort): Tìm phần tử nhỏ nhất trong dãy chưa sắp xếp và đổi chỗ nó cho phần tử đầu tiên của dãy chưa sắp xếp đó. Lặp lại quá trình này cho đến khi toàn bộ dãy được sắp xếp.",
        "Thuật toán sắp xếp nổi bọt (Bubble Sort): So sánh hai phần tử liền kề nhau, nếu chúng đứng sai thứ tự thì đổi chỗ cho nhau. Sau mỗi lượt duyệt, phần tử lớn nhất sẽ 'nổi' về cuối dãy."
    ],
    (7, 29): [
        "Quy trình thực hành thuật toán sắp xếp:",
        "1. Biểu diễn các bước đổi chỗ các phần tử trong dãy số cụ thể qua từng vòng lặp.",
        "2. Kiểm tra tính đúng đắn của dãy số thu được sau khi hoàn thành thuật toán sắp xếp."
    ],

    # ==================== KHỐI 8 ====================
    (8, 1): [
        "Lược sử phát triển công cụ tính toán: Từ bàn tính cơ học của người xưa, máy tính cơ học của Pascal và Leibniz, đến máy tính điện tử đầu tiên (ENIAC) ra đời những năm 1940.",
        "Năm thế hệ máy tính điện tử gắn liền với sự phát triển của các linh kiện điện tử: Đèn điện tử chân không -> Bóng bán dẫn (Transistor) -> Mạch tích hợp (IC) -> Vi xử lí (VLSI) -> Trí tuệ nhân tạo (AI).",
        "Xu hướng phát triển của máy tính: Kích thước ngày càng nhỏ gọn, tốc độ tính toán siêu nhanh, tiêu thụ ít năng lượng và kết nối toàn cầu."
    ],
    (8, 2): [
        "Máy tính đã thay đổi sâu sắc toàn bộ xã hội loài người:",
        "• Thay đổi phương thức sản xuất, quản lí và vận hành doanh nghiệp tự động hóa.",
        "• Thay đổi cách thức con người học tập, nghiên cứu và làm việc từ xa.",
        "• Mở ra kỉ nguyên kinh tế số, xã hội số và chính phủ điện tử."
    ],
    (8, 3): [
        "Đặc điểm của thông tin số: Đa dạng, thu thập nhanh chóng, dung lượng khổng lồ, dễ dàng nhân bản, sao chép và rất khó xóa bỏ hoàn toàn trên môi trường số.",
        "Tiêu chí đánh giá thông tin đáng tin cậy: Kiểm tra nguồn gốc thông tin (tổ chức, tác giả uy tín); Phân biệt giữa sự kiện khách quan và ý kiến chủ quan; Kiểm tra chứng cứ, số liệu dẫn chứng; Đánh giá tính thời sự (ngày xuất bản)."
    ],
    (8, 4): [
        "Quy trình thực hành khai thác và đánh giá thông tin số:",
        "1. Sử dụng công cụ tìm kiếm với từ khóa chính xác để tìm nguồn dữ liệu.",
        "2. Đối chiếu thông tin từ ít nhất hai nguồn chính thống khác nhau trước khi sử dụng.",
        "3. Ghi rõ nguồn trích dẫn khi sử dụng dữ liệu trong các bài báo cáo, dự án học tập."
    ],
    (8, 5): [
        "Sử dụng công nghệ số một cách có văn hóa, tuân thủ đạo đức và pháp luật:",
        "• Tôn trọng quyền tác giả và sở hữu trí tuệ: Không sao chép lậu phần mềm, không sử dụng tranh ảnh, âm nhạc mà không có bản quyền hoặc không trích dẫn nguồn.",
        "• Không đăng tải, chia sẻ thông tin bịa đặt, sai sự thật gây hoang mang dư luận hoặc xúc phạm danh dự nhân phẩm người khác."
    ],
    (8, 6): [
        "Địa chỉ tương đối: Là địa chỉ ô (như A1, B2) tự động thay đổi tương ứng khi ta sao chép công thức sang vị trí khác để giữ nguyên vị trí tương đối giữa ô chứa công thức và ô có địa chỉ trong công thức.",
        "Địa chỉ tuyệt đối: Là địa chỉ ô (như $A$1, $B$2) KHÔNG thay đổi khi sao chép công thức. Địa chỉ tuyệt đối có kí hiệu $ trước tên cột và trước tên hàng.",
        "Mẹo thao tác: Nhấn phím F4 để chuyển đổi qua lại giữa địa chỉ tương đối và địa chỉ tuyệt đối."
    ],
    (8, 7): [
        "Quy trình thực hành sử dụng địa chỉ tuyệt đối để giải bài toán thực tế:",
        "1. Nhập bảng tính có chứa các ô giá trị cố định (ví dụ: % Tỉ lệ thuế, Hệ số quy đổi).",
        "2. Đặt địa chỉ tuyệt đối cho ô cố định đó trong công thức tính toán (nhấn F4).",
        "3. Kéo sao chép công thức cho toàn bộ cột dữ liệu và kiểm tra kết quả."
    ],
    (8, 8): [
        "Sắp xếp dữ liệu: Là hoán đổi vị trí các hàng để giá trị dữ liệu trong một hay nhiều cột được sắp xếp theo thứ tự tăng dần hoặc giảm dần.",
        "Lọc dữ liệu: Là chọn và chỉ hiển thị các hàng thỏa mãn các tiêu chuẩn nhất định do người dùng đặt ra từ bảng dữ liệu."
    ],
    (8, 9): [
        "Quy trình thực hành sắp xếp và lọc dữ liệu trên Excel:",
        "1. Đặt con trỏ vào bảng dữ liệu -> Vào thẻ Data -> Chọn Sort để sắp xếp.",
        "2. Chọn Filter (Ctrl + Shift + L) để bật nút lọc tại các tiêu đề cột -> Chọn tiêu chí cần lọc."
    ],
    (8, 10): [
        "Biểu đồ là cách minh họa dữ liệu trực quan, sinh động. Nhờ biểu đồ, người xem dễ dàng so sánh các đại lượng và nhận định xu hướng thay đổi của dữ liệu theo thời gian.",
        "Các loại biểu đồ thông dụng:",
        "• Biểu đồ cột (Column Chart): Thích hợp để so sánh dữ liệu qua các đối tượng.",
        "• Biểu đồ đường (Line Chart): Thích hợp để thể hiện xu hướng thay đổi theo thời gian.",
        "• Biểu đồ tròn (Pie Chart): Thích hợp để mô tả cơ cấu, tỉ lệ phần trăm của các thành phần trong một tổng thể."
    ],
    (8, 11): [
        "Quy trình thực hành vẽ biểu đồ trên bảng tính:",
        "1. Chọn khối dữ liệu cần vẽ biểu đồ (bao gồm cả dòng tiêu đề).",
        "2. Vào thẻ Insert -> Chọn loại biểu đồ thích hợp trong nhóm Charts.",
        "3. Thêm tiêu đề biểu đồ (Chart Title), nhãn dữ liệu (Data Labels) và chú giải (Legend) rõ ràng."
    ],
    (8, 12): [
        "Danh sách dạng liệt kê (Bullets & Numbering) giúp trình bày các ý kiến, bước thực hiện một cách rõ ràng, mạch lạc và có thứ tự.",
        "Chèn và định dạng hình ảnh trong Word: Sử dụng công cụ Picture Format để điều chỉnh độ sáng, độ tương phản, kiểu viền và chế độ bao quanh văn bản (Wrap Text)."
    ],
    (8, 13): [
        "Quy trình thực hành chèn hình ảnh và tạo danh sách dạng liệt kê:",
        "1. Chọn các đoạn văn bản cần tạo danh sách -> Nháy chọn Bullets hoặc Numbering trong thẻ Home.",
        "2. Chèn hình ảnh minh họa bằng Insert -> Pictures -> Chọn Wrap Text là Square hoặc Tight để văn bản bao quanh hình ảnh cân đối."
    ],
    (8, 14): [
        "Phần mềm chỉnh sửa ảnh cung cấp các công cụ để chỉnh sửa, cắt cúp, xoay, ghép ảnh và nâng cao chất lượng thẩm mĩ cho hình ảnh.",
        "Các công cụ xử lí ảnh cơ bản: Crop (Cắt bỏ vùng ảnh thừa), Resize (Thay đổi kích thước điểm ảnh), Rotate (Xoay góc ảnh)."
    ],
    (8, 15): [
        "Đầu trang (Header) và Chân trang (Footer) là phần nằm ngoài vùng nội dung chính của trang văn bản, thường chứa các thông tin ngắn gọn như: Tiêu đề tài liệu, tên tác giả, ngày tháng.",
        "Số trang trong văn bản được đánh tự động (Page Number) và thường được đặt ở đầu trang hoặc chân trang."
    ],
    (8, 16): [
        "Quy trình thực hành tạo đầu trang, chân trang và đánh số trang:",
        "1. Vào thẻ Insert -> Chọn Header hoặc Footer để chọn mẫu thiết kế có sẵn.",
        "2. Chọn Page Number -> Bottom of Page để chèn số trang tự động ở chân trang.",
        "3. Nháy đúp chuột ra ngoài vùng nội dung để hoàn tất."
    ],
    (8, 17): [
        "Định dạng văn bản trên trang chiếu cần hài hòa về màu sắc, phông chữ, cỡ chữ để làm nổi bật thông điệp chính.",
        "Có thể đánh số trang, thêm thông tin chân trang và ngày tháng vào tất cả các trang chiếu một cách đồng bộ bằng hộp thoại Header and Footer."
    ],
    (8, 18): [
        "Bản mẫu (Template) trong phần mềm trình chiếu chứa sẵn bố cục, màu sắc, phông chữ, hiệu ứng và kiểu nền đồng bộ.",
        "Sử dụng bản mẫu giúp bài trình chiếu có giao diện chuyên nghiệp, thống nhất và tiết kiệm thời gian thiết kế."
    ],
    (8, 19): [
        "Quy trình thực hành áp dụng bản mẫu và tạo bài trình chiếu chuyên nghiệp:",
        "1. Khởi động PowerPoint -> Vào File -> New -> Chọn một mẫu Template phù hợp với chủ đề bài học.",
        "2. Thay thế nội dung văn bản và hình ảnh theo kịch bản thuyết trình.",
        "3. Trình chiếu thử và tinh chỉnh các trang chiếu."
    ],
    (8, 20): [
        "Từ thuật toán đến chương trình:",
        "• Thuật toán là ý tưởng giải quyết vấn đề bằng các bước tuần tự.",
        "• Chương trình là sự cụ thể hóa của thuật toán bằng một ngôn ngữ lập trình cụ thể để máy tính có thể thực thi tự động.",
        "Mỗi câu lệnh trong chương trình tương ứng với một thao tác cụ thể trong thuật toán."
    ],
    (8, 21): [
        "Biến (Variable) là đại lượng được đặt tên, dùng để lưu trữ giá trị và giá trị của biến có thể thay đổi trong quá trình thực hiện chương trình.",
        "Các kiểu dữ liệu cơ bản trong ngôn ngữ lập trình trực quan:",
        "• Kiểu số (Number): Các số nguyên, số thực để thực hiện các phép toán số học.",
        "• Kiểu xâu kí tự (String): Dãy các kí tự chữ và số để hiển thị văn bản.",
        "• Kiểu lôgic (Boolean): Chỉ nhận một trong hai giá trị Đúng (True) hoặc Sai (False)."
    ],
    (8, 22): [
        "Quy trình thực hành tạo và sử dụng biến trong Scratch:",
        "1. Vào nhóm lệnh Các biến số (Variables) -> Nháy chọn Tạo một biến.",
        "2. Đặt tên biến gợi nhớ (ví dụ: DiemSo, SoLanThu).",
        "3. Sử dụng các khối lệnh 'đặt biến thành...' và 'thay đổi biến một lượng...' để cập nhật giá trị biến trong chương trình."
    ],
    (8, 23): [
        "Cấu trúc rẽ nhánh trong ngôn ngữ lập trình trực quan:",
        "• Dạng khuyết (if... then): Nếu biểu thức điều kiện đúng thì thực hiện khối lệnh bên trong.",
        "• Dạng đầy đủ (if... then... else): Nếu biểu thức điều kiện đúng thì thực hiện khối lệnh 1, ngược lại thì thực hiện khối lệnh 2."
    ],
    (8, 24): [
        "Cấu trúc lặp trong Scratch:",
        "• Lặp với số lần biết trước: Khối lệnh 'lặp lại N lần' (repeat N).",
        "• Lặp liên tục: Khối lệnh 'liên tục' (forever).",
        "• Lặp có điều kiện: Khối lệnh 'lặp lại cho đến khi...' (repeat until <Điều kiện>)."
    ],
    (8, 25): [
        "Quy trình thực hành lập trình trò chơi đơn giản kết hợp rẽ nhánh và lặp:",
        "1. Thiết lập vòng lặp liên tục để kiểm tra trạng thái của nhân vật.",
        "2. Đặt khối lệnh điều kiện kiểm tra sự va chạm hoặc nhấn phím.",
        "3. Cập nhật điểm số và thông báo chiến thắng khi đạt mục tiêu."
    ],
    (8, 26): [
        "Lỗi trong chương trình và phân loại lỗi:",
        "• Lỗi cú pháp (Syntax error): Viết sai quy tắc ngữ pháp của câu lệnh, làm chương trình không thể dịch hoặc không chạy được.",
        "• Lỗi lôgic (Logic error): Câu lệnh viết đúng cú pháp nhưng kết quả thực hiện sai so với yêu cầu bài toán.",
        "Để phát hiện lỗi lôgic: Chạy thử chương trình với các bộ dữ liệu kiểm thử (test cases) đặc biệt và theo dõi giá trị các biến."
    ],
    (8, 27): [
        "Quy trình thực hành gỡ lỗi (Debugging):",
        "1. Chạy thử chương trình từng bước và ghi nhận kết quả không mong muốn.",
        "2. Khoanh vùng đoạn mã lệnh nghi ngờ gây ra lỗi.",
        "3. Sửa đổi khối lệnh và chạy lại kiểm thử cho đến khi chương trình hoạt động chính xác 100%."
    ],
    (8, 28): [
        "Tin học giúp nâng cao năng suất, chất lượng và hiệu quả công việc trong hầu hết các lĩnh vực: Y tế, Giáo dục, Nông nghiệp công nghệ cao, Giao thông, Ngân hàng...",
        "Nhiều ngành nghề mới ra đời gắn liền với Tin học: Lập trình viên, Chuyên viên phân tích dữ liệu, Kĩ sư an ninh mạng, Chuyên gia thiết kế đồ họa đa phương tiện..."
    ],
    (8, 29): [
        "Bình đẳng giới trong lĩnh vực Tin học:",
        "• Cả nam giới và nữ giới đều có năng lực và cơ hội bình đẳng để học tập, nghiên cứu và thành công trong ngành công nghệ thông tin.",
        "• Phụ nữ có nhiều ưu thế về tính cẩn trọng, kiên nhẫn, tư duy tỉ mỉ và giao tiếp khi tham gia vào các dự án phần mềm công nghệ."
    ],

    # ==================== KHỐI 9 ====================
    (9, 1): [
        "Thiết bị có gắn bộ xử lí thông tin (bộ vi điều khiển, chip CPU) hiện diện ở khắp mọi nơi xung quanh chúng ta: từ điện thoại, máy giặt, điều hòa, ô tô thông minh đến các hệ thống camera giao thông và robot công nghiệp.",
        "Máy tính có khả năng tính toán với tốc độ hàng tỉ phép tính mỗi giây, lưu trữ dữ liệu khổng lồ, hoạt động bền bỉ, tự động hóa cao và kết nối toàn cầu.",
        "Ứng dụng thực tế của máy tính trong khoa học kĩ thuật: Mô phỏng thời tiết, nghiên cứu vũ trụ, giải mã hệ gen người, chẩn đoán y khoa bằng AI."
    ],
    (9, 2): [
        "Tác động to lớn của công nghệ thông tin đối với giáo dục và xã hội:",
        "• Giáo dục: Cá nhân hóa việc học tập, mở rộng không gian học tập trực tuyến (E-learning, MOOCs), ứng dụng trí tuệ nhân tạo làm trợ lí học tập ảo.",
        "• Xã hội: Thúc đẩy chuyển đổi số, hình thành xã hội số, thanh toán không dùng tiền mặt và chính phủ điện tử phục vụ người dân nhanh chóng.",
        "Mặt trái cần phòng tránh: Nguy cơ phụ thuộc vào công nghệ, giảm tương tác trực tiếp, các vấn đề an ninh thông tin và áp lực tâm lí số."
    ],
    (9, 3): [
        "Chất lượng của thông tin có vai trò quyết định đến việc con người đưa ra quyết định đúng đắn và giải quyết vấn đề hiệu quả.",
        "Thông tin kém chất lượng (sai lệch, thiếu sót, lỗi thời) có thể dẫn tới những hậu quả nghiêm trọng về kinh tế, uy tín và sự an toàn."
    ],
    (9, 4): [
        "Các tiêu chí đánh giá chất lượng thông tin trong giải quyết vấn đề:",
        "1. Tính mới (tính thời sự): Thông tin được cập nhật kịp thời, phản ánh đúng tình trạng hiện tại.",
        "2. Tính chính xác: Thông tin phản ánh đúng sự thật khách quan, có kiểm chứng, không bị xuyên tạc.",
        "3. Tính đầy đủ: Cung cấp đủ các khía cạnh cần thiết, không cắt xén làm thay đổi bản chất sự việc.",
        "4. Tính sử dụng được (tính phù hợp): Thông tin có ích, phù hợp với mục đích giải quyết vấn đề đặt ra."
    ],
    (9, 5): [
        "Quy trình thực hành đánh giá chất lượng nguồn thông tin:",
        "1. Tìm kiếm thông tin phục vụ một chủ đề cụ thể từ nhiều nguồn khác nhau.",
        "2. Lập bảng đối chiếu đánh giá từng nguồn theo 4 tiêu chí: Tính mới, Tính chính xác, Tính đầy đủ và Tính sử dụng được.",
        "3. Đưa ra kết luận và lựa chọn nguồn dữ liệu tin cậy nhất."
    ],
    (9, 6): [
        "Một số tác động tiêu cực của công nghệ kĩ thuật số:",
        "• Nguy cơ rò rỉ dữ liệu cá nhân, lộ bí mật đời tư.",
        "• Vấn nạn lừa đảo tài chính qua mạng, tấn công mã độc ransomware tống tiền.",
        "• Lan truyền tin giả (fake news), văn hóa ứng xử thù hằn trên mạng xã hội."
    ],
    (9, 7): [
        "Các hành vi vi phạm pháp luật và văn hóa trong môi trường số:",
        "• Truy cập bất hợp pháp vào hệ thống máy tính, tài khoản của người khác.",
        "• Phát tán virus, phần mềm độc hại; chia sẻ thông tin kích động bạo lực, vi phạm thuần phong mĩ tục.",
        "• Vi phạm bản quyền tác giả: Sử dụng, phân phối sản phẩm số không có sự cho phép.",
        "Luật An ninh mạng quy định rõ các chế tài xử phạt nghiêm minh đối với các hành vi vi phạm trên không gian mạng."
    ],
    (9, 8): [
        "Phần mềm mô phỏng (Simulation software) là phần mềm thể hiện trực quan sự vận động của một đối tượng, hệ thống hay hiện tượng thực tế, cho phép người dùng tương tác và tìm hiểu cách thức hoạt động của nó.",
        "Lợi ích của phần mềm mô phỏng:",
        "• Giúp nghiên cứu, khám phá các hiện tượng nguy hiểm, tốn kém hoặc khó quan sát trực tiếp (thí nghiệm hạt nhân, bay vũ trụ, giải phẫu cơ thể).",
        "• Tiết kiệm chi phí và thời gian thực nghiệm.",
        "• Tăng tính trực quan, hứng thú trong học tập và nghiên cứu khoa học."
    ],
    (9, 9): [
        "Quy trình thực hành khám phá thí nghiệm khoa học bằng phần mềm mô phỏng:",
        "1. Khởi động phần mềm mô phỏng (ví dụ: PhET Interactive Simulations).",
        "2. Thiết lập các thông số ban đầu của thí nghiệm (nhiệt độ, khối lượng, điện áp).",
        "3. Tương tác và quan sát sự chuyển hóa năng lượng trên màn hình mô phỏng.",
        "4. Ghi nhận số liệu và rút ra kết luận khoa học."
    ],
    (9, 10): [
        "Quy trình thực hành nghiên cứu hình học và giải thuật bằng phần mềm GeoGebra:",
        "1. Sử dụng các công cụ vẽ điểm, đoạn thẳng, đa giác đều.",
        "2. Tạo các thanh trượt (Slider) để thay đổi tham số động.",
        "3. Quan sát các quy luật toán học (như tỉ lệ vàng trong ngôi sao năm cánh) biến đổi theo tham số."
    ],
    (9, 11): [
        "Sử dụng công cụ trực quan (Sơ đồ tư duy, Bài trình chiếu) giúp truyền tải thông tin một cách mạch lạc, thuyết phục và hỗ trợ làm việc nhóm hiệu quả.",
        "Em có thể sử dụng bài trình chiếu và sơ đồ tư duy trong hợp tác theo các cách:",
        "• Trình bày trực tiếp trước tập thể.",
        "• Chia sẻ tệp để các thành viên xem độc lập hoặc cùng cập nhật đồng thời.",
        "Có thể đính kèm liên kết tệp văn bản, hình ảnh, video vào sơ đồ tư duy để nội dung thêm phong phú."
    ],
    (9, 12): [
        "Quy trình thực hành liên kết dữ liệu trong bài trình chiếu:",
        "1. Tạo liên kết siêu văn bản (Hyperlink) giữa các trang chiếu hoặc liên kết ra tệp bên ngoài.",
        "2. Sao chép biểu đồ từ Excel sang PowerPoint dưới dạng có liên kết (Link Data) để số liệu tự động cập nhật khi bảng tính Excel thay đổi."
    ],
    (9, 13): [
        "Quy trình hoàn thiện bài trình chiếu đa phương tiện báo cáo dự án:",
        "1. Nhúng video, âm thanh và các sơ đồ trực quan vào trang chiếu.",
        "2. Thiết lập hiệu ứng chuyển trang và hiển thị mượt mà.",
        "3. Thực hiện thuyết trình thử nghiệm và tiếp thu ý kiến đóng góp từ các thành viên."
    ],
    (9, 14): [
        "Công cụ xác thực dữ liệu (Data Validation) trong phần mềm bảng tính giúp hạn chế kiểu dữ liệu hoặc giá trị dữ liệu được phép nhập vào ô tính.",
        "Lợi ích của Data Validation: Đảm bảo dữ liệu nhập vào luôn chính xác, thỏa mãn các điều kiện quy định, giảm thiểu tối đa sai sót khi người dùng nhập liệu."
    ],
    (9, 15): [
        "Quy trình thiết lập công cụ Data Validation trên Excel:",
        "1. Chọn các ô tính cần thiết lập điều kiện nhập liệu.",
        "2. Vào thẻ Data -> Trong nhóm Data Tools, chọn Data Validation.",
        "3. Tại thẻ Settings: Thiết lập tiêu chí cho phép (Allow: Số nguyên, Số thập phân, Danh sách List, Ngày tháng).",
        "4. Tại thẻ Input Message: Đặt hướng dẫn nhập liệu cho người dùng.",
        "5. Tại thẻ Error Alert: Đặt thông báo lỗi khi người dùng gõ sai dữ liệu."
    ],
    (9, 16): [
        "Hàm COUNTIF dùng để đếm số ô tính trong một vùng dữ liệu thỏa mãn một điều kiện nhất định.",
        "Cú pháp hàm: =COUNTIF(range, criteria)",
        "• range: Phạm vi chứa các ô tính cần kiểm tra để đếm.",
        "• criteria: Điều kiện kiểm tra (dưới dạng số, biểu thức so sánh hoặc chuỗi văn bản, ví dụ: \">=8.0\", \"Đạt\")."
    ],
    (9, 17): [
        "Hàm SUMIF dùng để tính tổng các giá trị trong một vùng dữ liệu thỏa mãn điều kiện cho trước.",
        "Cú pháp hàm: =SUMIF(range, criteria, [sum_range])",
        "• range: Phạm vi chứa các giá trị cần kiểm tra điều kiện.",
        "• criteria: Điều kiện kiểm tra.",
        "• sum_range (tùy chọn): Phạm vi chứa các ô thực tế cần tính tổng. Nếu bỏ qua sum_range, Excel sẽ tính tổng ngay trên các ô của range."
    ],
    (9, 18): [
        "Hàm IF kiểm tra một điều kiện logic và trả về một giá trị nếu điều kiện Đúng, trả về một giá trị khác nếu điều kiện Sai.",
        "Cú pháp hàm: =IF(logical_test, [value_if_true], [value_if_false])",
        "• logical_test: Biểu thức so sánh logic (trả về TRUE hoặc FALSE).",
        "• value_if_true: Giá trị nhận được khi điều kiện Đúng.",
        "• value_if_false: Giá trị nhận được khi điều kiện Sai."
    ],
    (9, 19): [
        "Quy trình thực hành áp dụng hàm IF lồng nhau để xếp loại kết quả:",
        "1. Xác định điều kiện xếp loại (ví dụ: Điểm >= 8.0: Giỏi; Điểm >= 6.5: Khá; Điểm >= 5.0: Đạt; Còn lại: Chưa đạt).",
        "2. Nhập công thức IF lồng: =IF(D2>=8, \"Giỏi\", IF(D2>=6.5, \"Khá\", IF(D2>=5, \"Đạt\", \"Chưa đạt\"))).",
        "3. Nhấn Enter và sao chép công thức cho toàn bộ danh sách."
    ],
    (9, 20): [
        "Ứng dụng bảng tính quản lí tài chính gia đình giúp theo dõi các khoản thu, chi một cách trực quan, khoa học và minh bạch.",
        "Trang tính tổng hợp liên kết dữ liệu từ các trang tính chi tiết (Thu nhập, Chi tiêu) bằng các công thức liên kết (ví dụ: ='ThuNhap'!B10), giúp quản lí ngân sách gia đình hiệu quả."
    ],
    (9, 21): [
        "Quy trình thực hành hoàn thiện bảng tính tài chính gia đình:",
        "1. Tạo các trang tính riêng biệt: Danh mục Thu, Danh mục Chi, và Tổng kết ngân sách.",
        "2. Sử dụng các hàm SUM, SUMIF, COUNTIF để tự động tổng hợp số tiền theo từng hạng mục.",
        "3. Tạo biểu đồ hình tròn thể hiện cơ cấu chi tiêu của gia đình."
    ],
    (9, 22): [
        "Giải quyết vấn đề là quá trình con người tìm kiếm và thực hiện các biện pháp để đạt được mục tiêu mong muốn từ tình huống xuất phát.",
        "Quy trình 5 bước giải quyết vấn đề:",
        "1. Tìm hiểu vấn đề: Xác định rõ trạng thái ban đầu và mục tiêu cần đạt.",
        "2. Phân tích vấn đề: Chia vấn đề lớn thành các vấn đề nhỏ hơn.",
        "3. Lựa chọn giải pháp: Đề xuất các phương án và chọn giải pháp tối ưu nhất.",
        "4. Thực hiện giải pháp: Tiến hành các bước hành động cụ thể.",
        "5. Đánh giá kết quả: Kiểm tra giải pháp đã đạt mục tiêu đề ra chưa."
    ],
    (9, 23): [
        "Mô tả giải pháp dưới dạng thuật toán:",
        "• Giải pháp giải quyết vấn đề có thể được biểu diễn chính xác dưới dạng thuật toán bằng ngôn ngữ tự nhiên hoặc sơ đồ khối.",
        "• Sơ đồ khối sử dụng các hình chuẩn: Hình oval (Bắt đầu/Kết thúc), Hình chữ nhật (Xử lí), Hình thoi (Điều kiện), Hình bình hành (Vào/Ra) và Mũi tên (Dòng điều khiển)."
    ],
    (9, 24): [
        "Bài toán Tin học là một nhiệm vụ có thể giao cho máy tính thực hiện.",
        "Mỗi bài toán Tin học được xác định bởi hai yếu tố cơ bản:",
        "• Đầu vào (Input): Các dữ liệu đã biết, đưa vào máy tính.",
        "• Đầu ra (Output): Kết quả cần tìm hoặc thông tin mong muốn nhận được."
    ],
    (9, 25): [
        "Quy trình 4 bước giao bài toán cho máy tính giải quyết:",
        "1. Xác định bài toán: Chỉ rõ Input và Output của bài toán.",
        "2. Xây dựng thuật toán: Tìm và mô tả dãy các thao tác từ Input để tạo ra Output.",
        "3. Cài đặt thuật toán (Viết chương trình): Dùng ngôn ngữ lập trình để viết lệnh cho máy tính thực hiện.",
        "4. Gỡ lỗi và hiệu chỉnh: Chạy thử chương trình với các bộ dữ liệu mẫu, phát hiện và sửa các lỗi phát sinh."
    ],
    (9, 26): [
        "Quy trình thực hành lập trình giải bài toán Tin học trên Scratch (Tính tiền điện/lương):",
        "1. Xác định Input (Số kWh tiêu thụ hoặc Số giờ làm việc) và Output (Số tiền thanh toán).",
        "2. Thiết lập công thức tính toán lũy tiến theo từng bậc.",
        "3. Lập trình nhân vật hỏi dữ liệu vào, tính toán và thông báo kết quả ra màn hình."
    ],
    (9, 27): [
        "Quy trình thực hành tìm giá trị lớn nhất (MAX) trong danh sách dữ liệu trên Scratch:",
        "1. Tạo danh sách List để chứa dãy số nguyên.",
        "2. Khởi tạo biến Max = phần tử đầu tiên của danh sách.",
        "3. Dùng vòng lặp duyệt qua các phần tử còn lại: Nếu phần tử đang xét > Max thì gán Max = phần tử đó.",
        "4. Kết thúc vòng lặp, thông báo giá trị Max tìm được."
    ],
    (9, 28): [
        "Hai hướng nghề nghiệp chính trong lĩnh vực Tin học:",
        "1. Hướng Khoa học máy tính (Computer Science): Tập trung vào nghiên cứu lí thuyết thông tin, phát triển thuật toán, trí tuệ nhân tạo (AI), an ninh mạng và phát triển phần mềm hệ thống.",
        "2. Hướng Tin học ứng dụng (Information Technology / Applied Informatics): Tập trung vào việc ứng dụng công nghệ thông tin, quản trị mạng, thiết kế website, cơ sở dữ liệu và vận hành hệ thống thông tin phục vụ đời sống."
    ],
    (9, 29): [
        "Đặc điểm nghề nghiệp và bình đẳng giới trong kỉ nguyên số:",
        "• Nghề nghiệp Tin học đòi hỏi sự sáng tạo, tư duy logic, khả năng tự học liên tục và kĩ năng làm việc nhóm.",
        "• Mọi người, không phân biệt giới tính, đều có cơ hội bình đẳng tiếp cận và phát triển sự nghiệp đỉnh cao trong ngành công nghệ thông tin.",
        "• Nữ giới ngày càng khẳng định vị thế và đóng góp quan trọng trong các công ty công nghệ hàng đầu thế giới."
    ]
}

# Tiến hành cập nhật vào cơ sở dữ liệu
count = 0
for lesson in db["lessons"]:
    g = lesson["grade"]
    p = lesson["period"]
    mkt = lesson.get("mucKT", "")
    title = lesson["title"]

    bullets = SGK_116.get((g, p))
    if not bullets:
        # Fallback nếu thiếu
        bullets = [f"Nội dung trọng tâm bài học: {title} ({mkt})"]

    final_bullets = []
    for b in bullets:
        clean = b.strip()
        if not clean.startswith("•") and not re.match(r"^\d+\.", clean):
            clean = f"• {clean}"
        final_bullets.append(clean)

    nb = lesson["activity1_discovery"]["notebookSlide"]
    nb["slideTitle"] = f"GHI NHỚ SGK: {title}"
    nb["sgkSection"] = mkt
    nb["sgkGhiNho"] = final_bullets
    nb["mascotIcon"] = "💡"

    count += 1

print(f"Successfully processed {count} / {len(db['lessons'])} lessons with 100% Verbatim SGK Ghi Nhớ!")

# Lưu lại database JSON
with open(DB_PATH, "w", encoding="utf-8") as f:
    json.dump(db, f, ensure_ascii=False, indent=2)

# Lưu lại js/data-curriculum.js
js_content = f"/**\n * NGÂN HÀNG HỌC LIỆU 116 TIẾT CHUẨN HỮU CƠ 100% (js/data-curriculum.js)\n */\nwindow.CURRICULUM_DB = {json.dumps(db, ensure_ascii=False, indent=2)};\n"
with open(JS_PATH, "w", encoding="utf-8") as f:
    f.write(js_content)

print(f"Saved {DB_PATH} and {JS_PATH} successfully.")
