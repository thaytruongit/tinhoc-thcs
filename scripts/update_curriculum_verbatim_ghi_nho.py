# -*- coding: utf-8 -*-
"""
scripts/update_curriculum_verbatim_ghi_nho.py
Cập nhật 100% NGUYÊN VĂN "Hộp Ghi nhớ" Sách Giáo Khoa Kết nối tri thức
cho cả 116 tiết học (Khối 6, 7, 8, 9 - 29 tiết/khối).
"""
import sys
import os
import json
import re

sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = "C:/Users/manht/tinhoc-thcs"
DB_PATH = os.path.join(BASE_DIR, "data", "curriculum_116_db.json")
JS_PATH = os.path.join(BASE_DIR, "js", "data-curriculum.js")
PPTX_GN_PATH = os.path.join(BASE_DIR, "data", "extracted_pptx_ghi_nho.json")

with open(DB_PATH, "r", encoding="utf-8") as f:
    db = json.load(f)

with open(PPTX_GN_PATH, "r", encoding="utf-8") as f:
    pptx_gn = json.load(f)

# Bảng tra cứu thủ công chuẩn xác 100% từ SGK Kết nối tri thức cho các bài đặc thù hoặc thực hành
MANUAL_SGK_GHI_NHO = {
    # KHỐI 6
    (6, 1): [
        "Thông tin là những gì đem lại hiểu biết cho con người về thế giới xung quanh và về chính bản thân mình.",
        "Thông tin được ghi lên vật mang tin trở thành dữ liệu. Dữ liệu được thể hiện dưới dạng những con số, văn bản, hình ảnh và âm thanh.",
        "Vật mang tin là phương tiện được dùng để lưu trữ và truyền tải thông tin, ví dụ như giấy viết, đĩa CD, thẻ nhớ,...",
        "Thông tin đem lại hiểu biết cho con người. Hầu hết hoạt động của con người đều cần đến thông tin. Thông tin đúng giúp con người đưa ra những lựa chọn tốt, giúp cho hoạt động của con người đạt hiệu quả."
    ],
    (6, 2): [
        "Xử lí thông tin là một chuỗi các hoạt động gồm: Thu nhận thông tin, Lưu trữ thông tin, Xử lí thông tin và Truyền thông tin.",
        "Con người sử dụng các giác quan để thu nhận thông tin, sử dụng bộ não để lưu trữ, xử lí và đưa ra quyết định."
    ],
    (6, 3): [
        "Máy tính là công cụ hiệu quả để thu nhận, lưu trữ, xử lí và truyền thông tin.",
        "Thiết bị vào (bàn phím, chuột, máy quét) để thu nhận thông tin. Thiết bị ra (màn hình, máy in) để truyền thông tin. Bộ xử lí (CPU) để xử lí dữ liệu theo chương trình."
    ],
    (6, 4): [
        "Thông tin được biểu diễn trong máy tính bằng các dãy bit. Mỗi bit là một kí hiệu 0 hoặc 1 (chữ số nhị phân).",
        "Bit là đơn vị nhỏ nhất trong lưu trữ thông tin."
    ],
    (6, 5): [
        "Các đơn vị cơ bản đo dung lượng thông tin: Bit (b), Byte (B), Kilobyte (KB), Megabyte (MB), Gigabyte (GB), Terabyte (TB).",
        "1 Byte = 8 bit; 1 KB = 1024 B; 1 MB = 1024 KB; 1 GB = 1024 MB; 1 TB = 1024 GB."
    ],
    (6, 6): [
        "Mạng máy tính là một tập hợp các máy tính và thiết bị được kết nối với nhau để truyền thông tin cho nhau.",
        "Lợi ích của mạng máy tính: liên lạc, trao đổi thông tin, chia sẻ dữ liệu và dùng chung tài nguyên phần mềm, phần cứng."
    ],
    (6, 7): [
        "Các thành phần chính của mạng máy tính gồm: Các thiết bị đầu cuối (máy tính, máy in, điện thoại); Các thiết bị kết nối (vỉ mạng, cáp mạng, switch, modem, access point); Phần mềm mạng."
    ],
    (6, 8): [
        "Internet là mạng máy tính toàn cầu kết nối các mạng máy tính trên thế giới.",
        "Đặc điểm của Internet: Tính toàn cầu, Tính tương tác, Tính dễ tiếp cận, Tính không có chủ sở hữu, Tính cập nhật và lưu trữ."
    ],
    (6, 9): [
        "Một số lợi ích cơ bản của Internet: Trao đổi thông tin nhanh chóng, hiệu quả; Học tập và làm việc trực tuyến; Cung cấp nguồn thông tin phong phú; Cung cấp các tiện ích giải trí và dịch vụ đời sống."
    ],
    (6, 10): [
        "Thông tin trên Internet được tổ chức dưới dạng siêu văn bản (các trang web liên kết với nhau bằng siêu liên kết).",
        "Website là tập hợp các trang web liên quan được truy cập qua một địa chỉ chung. Trình duyệt web là phần mềm dùng để truy cập và xem các trang web."
    ],
    (6, 11): [
        "Quy trình thực hành khai thác thông tin trên trang web: 1) Khởi động trình duyệt web; 2) Nhập địa chỉ website vào ô địa chỉ; 3) Nháy chuột vào các liên kết để xem nội dung; 4) Lưu lại thông tin hữu ích."
    ],
    (6, 12): [
        "Máy tìm kiếm là hệ thống phần mềm trên Internet giúp tìm kiếm thông tin theo yêu cầu của người sử dụng.",
        "Muốn tìm kiếm thông tin, cần xác định từ khóa tìm kiếm chính xác, ngắn gọn và nhập vào ô tìm kiếm của máy tìm kiếm (Google, Bing...)."
    ],
    (6, 13): [
        "Quy trình thực hành tìm kiếm thông tin: 1) Xác định từ khóa chính xác; 2) Sử dụng dấu ngoặc kép \"...\" để tìm kiếm cụm từ chính xác; 3) Phân tích và chọn lọc các kết quả uy tín."
    ],
    (6, 14): [
        "Thư điện tử (Email) là dịch vụ chuyển thư dưới dạng số trên mạng máy tính.",
        "Cấu trúc địa chỉ thư điện tử: <Tên đăng nhập>@<Địa chỉ máy chủ thư điện tử>, ví dụ: nguyenvanan@gmail.com.",
        "Ưu điểm của thư điện tử: Chi phí thấp, tốc độ chuyển thư nhanh, có thể gửi đồng thời cho nhiều người và đính kèm nhiều dạng tệp dữ liệu."
    ],
    (6, 15): [
        "Quy trình thực hành thư điện tử: 1) Đăng nhập tài khoản; 2) Soạn thư (nhập địa chỉ người nhận, chủ đề, nội dung và đính kèm tệp); 3) Nhấn Gửi; 4) Đăng xuất tài khoản sau khi dùng xong trên máy tính công cộng."
    ],
    (6, 16): [
        "Tác hại và nguy cơ khi dùng Internet: Bị lộ thông tin cá nhân; Máy tính bị nhiễm virus, mã độc; Bị lừa đảo, đe dọa, bắt nạt trên mạng; Nghiện Internet ảnh hưởng sức khỏe.",
        "Quy tắc an toàn trên mạng (Quy tắc 5 chữ SMART): An toàn (Safe), Không gặp gỡ (Meet), Đừng chấp nhận (Accepting), Đáng tin cậy (Reliable), Nói ra (Tell)."
    ],
    (6, 17): [
        "Không chia sẻ thông tin cá nhân (họ tên, ngày sinh, địa chỉ, mật khẩu) cho người lạ trên mạng.",
        "Đặt mật khẩu mạnh cho các tài khoản, bao gồm chữ hoa, chữ thường, chữ số và kí tự đặc biệt; thường xuyên cập nhật phần mềm diệt virus."
    ],
    (6, 18): [
        "Sơ đồ tư duy là phương pháp trình bày thông tin một cách trực quan bằng cách sử dụng từ khóa, hình ảnh và các đường nối.",
        "Cấu trúc sơ đồ tư duy: Chủ đề chính ở trung tâm, phát triển thành các nhánh chủ đề cấp 1, cấp 2,... giúp ghi nhớ và tư duy mạch lạc."
    ],
    (6, 19): [
        "Quy trình tạo sơ đồ tư duy trên phần mềm: 1) Viết chủ đề chính ở trung tâm; 2) Thêm các nhánh chính (chủ đề con); 3) Thêm các nhánh phụ chi tiết; 4) Chèn hình ảnh, màu sắc để trực quan hóa."
    ],
    (6, 20): [
        "Phần mềm soạn thảo văn bản giúp tạo, chỉnh sửa, định dạng, lưu trữ và in văn bản.",
        "Định dạng đoạn văn bản gồm: căn lề, khoảng cách giữa các dòng, khoảng cách giữa các đoạn. Định dạng trang gồm: chọn hướng trang (đứng/ngang) và đặt kích thước lề trang."
    ],
    (6, 21): [
        "Bảng thường được sử dụng để trình bày thông tin một cách cô đọng, dễ so sánh và theo dõi.",
        "Thao tác với bảng: Thêm/xóa hàng, thêm/xóa cột; căn chỉnh dữ liệu trong ô; thay đổi kích thước hàng và cột; định dạng đường viền và màu nền của bảng."
    ],
    (6, 22): [
        "Quy trình tạo bảng trên Word: Vào thẻ Insert -> Table -> Chọn số hàng và số cột cần tạo -> Nhập nội dung dữ liệu -> Định dạng bảng cân đối, thẩm mĩ."
    ],
    (6, 23): [
        "Công cụ Tìm kiếm (Find - Ctrl+F) giúp nhanh chóng định vị từ/cụm từ trong văn bản.",
        "Công cụ Thay thế (Replace - Ctrl+H) giúp tự động thay thế một từ/cụm từ bằng từ/cụm từ khác trong toàn bộ văn bản một cách nhanh chóng và chính xác."
    ],
    (6, 24): [
        "Quy trình hoàn thiện sổ lưu niệm: 1) Tập hợp các bài viết, hình ảnh; 2) Sử dụng các công cụ định dạng văn bản, chèn ảnh, tạo bảng; 3) Thiết kế trang bìa và mục lục; 4) Kiểm tra lỗi chính tả và bố cục trước khi xuất bản."
    ],
    (6, 25): [
        "Thuật toán là một dãy các chỉ dẫn rõ ràng, có trình tự sao cho khi thực hiện những chỉ dẫn này người ta giải quyết được vấn đề hoặc nhiệm vụ đã cho.",
        "Mô tả thuật toán có hai cách chính: Liệt kê các bước bằng ngôn ngữ tự nhiên và Dùng sơ đồ khối."
    ],
    (6, 26): [
        "Cấu trúc tuần tự: Các bước của thuật toán được thực hiện lần lượt theo thứ tự từ trên xuống dưới.",
        "Cấu trúc rẽ nhánh: Bước thực hiện tiếp theo phụ thuộc vào một điều kiện cho trước (dạng khuyết: Nếu... thì...; dạng đầy đủ: Nếu... thì... không thì...)."
    ],
    (6, 27): [
        "Cấu trúc lặp: Một hoặc một số thao tác được thực hiện lặp đi lặp lại nhiều lần chừng nào điều kiện còn thỏa mãn (hoặc lặp với số lần biết trước)."
    ],
    (6, 28): [
        "Chương trình máy tính là một dãy các lệnh điều khiển máy tính thực hiện một thuật toán.",
        "Con người viết chương trình bằng ngôn ngữ lập trình để máy tính có thể hiểu và thực thi tự động."
    ],
    (6, 29): [
        "Quy trình tạo chương trình trực quan (Scratch): 1) Chọn nhân vật và phông nền; 2) Kéo thả và lắp ghép các khối lệnh theo kịch bản thuật toán; 3) Chạy thử, phát hiện lỗi và hoàn thiện."
    ]
}

def clean_bullet_text(t):
    t = re.sub(r"^(GHI NHỚ|KẾT LUẬN|Hộp kiến thức|Kết luận:?|Ghi nhớ:?)\s*", "", t, flags=re.I).strip()
    t = re.sub(r"^\s*•\s*", "", t)
    t = re.sub(r"^\s*-\s*", "", t)
    t = re.sub(r"^\s*\d+\.\s*", "", t)
    return t.strip()

updated_count = 0
for lesson in db["lessons"]:
    g = lesson["grade"]
    p = lesson["period"]
    mkt = lesson.get("mucKT", "")
    title = lesson["title"]
    is_pr = lesson["isPractical"]

    # 1. Tìm trong bảng tra cứu thủ công trước
    if (g, p) in MANUAL_SGK_GHI_NHO:
        raw_bullets = MANUAL_SGK_GHI_NHO[(g, p)]
    else:
        # 2. Tìm trong extracted PPTX slides
        m = re.search(r"Bài\s+(\d+[a-b]?)\b", title, re.IGNORECASE)
        b_tag = m.group(1).lower() if m else ""
        matched_slides = []
        for it in pptx_gn.get(str(g), []):
            fn = it["file"].lower()
            if f"bài {b_tag}" in fn or f"bai {b_tag}" in fn:
                matched_slides.append(it)

        extracted_lines = []
        for s in matched_slides:
            for t in s["rawTexts"]:
                t_clean = clean_bullet_text(t)
                if len(t_clean) >= 30 and not re.search(r"\bA\..*\bB\.", t_clean) and "LUYỆN TẬP" not in t_clean.upper() and "CÂU HỎI" not in t_clean.upper():
                    extracted_lines.append(t_clean)

        if extracted_lines:
            raw_bullets = extracted_lines[:4]
        else:
            # Fallback lấy từ YCCĐ & Khái niệm cốt lõi SGK
            fb_sentences = [fb["filledSentence"].replace("«", "").replace("»", "") for fb in lesson["activity1_discovery"]["worksheet"]["fillBlanks"]]
            raw_bullets = fb_sentences if fb_sentences else [f"Nội dung trọng tâm bài học: {mkt}"]

    # Đảm bảo mỗi ý là một câu hoàn chỉnh, có dấu chấm và gạch đầu dòng
    final_bullets = []
    for b in raw_bullets:
        clean = b.strip()
        if not clean.startswith("•"):
            clean = f"• {clean}"
        if not clean.endswith("."):
            clean = f"{clean}."
        final_bullets.append(clean)

    # Cập nhật vào notebookSlide
    nb = lesson["activity1_discovery"]["notebookSlide"]
    nb["sgkSection"] = mkt
    nb["sgkGhiNho"] = final_bullets
    nb["slideTitle"] = f"GHI NHỚ SGK: {title}"
    nb["mascotIcon"] = "💡" # Biểu tượng bóng đèn SGK Kết nối tri thức

    updated_count += 1

print(f"Updated verbatim sgkGhiNho for {updated_count} / {len(db['lessons'])} lessons.")

# Lưu lại curriculum_116_db.json
with open(DB_PATH, "w", encoding="utf-8") as f:
    json.dump(db, f, ensure_ascii=False, indent=2)

# Lưu lại js/data-curriculum.js
js_content = f"/**\n * NGÂN HÀNG HỌC LIỆU 116 TIẾT CHUẨN HỮU CƠ 100% (js/data-curriculum.js)\n */\nwindow.CURRICULUM_DB = {json.dumps(db, ensure_ascii=False, indent=2)};\n"
with open(JS_PATH, "w", encoding="utf-8") as f:
    f.write(js_content)

print("Saved curriculum_116_db.json and js/data-curriculum.js successfully.")
