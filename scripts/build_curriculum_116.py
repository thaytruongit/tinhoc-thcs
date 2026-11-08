# -*- coding: utf-8 -*-
"""
Trích xuất và tổng hợp toàn bộ 116 tiết học (Khối 6, 7, 8, 9 - 29 tiết/khối)
từ NLS-AI-6..9.docx + authenticPdfExtracts.ts + authenticVerbatimExtracts.ts + exam_generator.py
Đảm bảo 100% câu hỏi hữu cơ, đúng sự thật SGK, không bịa đặt, không trùng lặp.
"""
import sys
import os
import re
import json
import docx

sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = "C:/Users/manht/tinhoc-thcs"
DATA_DIR = os.path.join(BASE_DIR, "data")
JS_DIR = os.path.join(BASE_DIR, "js")


def load_ts_json_object(ts_path: str, marker: str) -> dict:
    with open(ts_path, "r", encoding="utf-8") as f:
        content = f.read()
    idx = content.find(marker)
    if idx == -1:
        raise ValueError(f"Marker {marker} not found in {ts_path}")
    start_brace = content.find("{", idx)
    end_brace = content.rfind("}")
    json_str = content[start_brace:end_brace + 1]
    return json.loads(json_str)


def detect_allowed_extensions(title: str, muc_kt: str, stage4_text: str) -> list:
    combined = f"{title} {muc_kt} {stage4_text}".lower()
    exts = []
    if any(k in combined for k in ["bảng tính", "excel", "countif", "sumif", "hàm if", "biểu đồ", "lọc dữ liệu", "sắp xếp", "xác thực dữ liệu", "tài chính"]):
        exts.append(".xlsx")
    if any(k in combined for k in ["trình chiếu", "powerpoint", "trang chiếu", "bản mẫu", "slide"]):
        exts.append(".pptx")
    if any(k in combined for k in ["văn bản", "word", "định dạng văn bản", "tạo bảng", "tìm kiếm và thay thế", "sổ lưu niệm", "đầu trang", "chân trang", "danh sách dạng liệt kê"]):
        exts.append(".docx")
    if any(k in combined for k in ["scratch", "lập chương trình", "tạo chương trình", "đoán số", "gỡ lỗi", "biến", "hằng"]):
        exts.extend([".sb3", ".docx", ".pptx"])
    if not exts:
        exts = [".docx", ".xlsx", ".pptx"]
    # luôn cho phép cả 3 định dạng chuẩn để HS nộp linh hoạt
    for std in [".docx", ".xlsx", ".pptx"]:
        if std not in exts:
            exts.append(std)
    return exts


def build_organic_minigame_questions(grade: int, period: int, title: str, muc_kt: str, yccd: str,
                                     nls_text: str, ai_text: str, ext_item: dict, verb_item: dict,
                                     all_period_wordbanks: list) -> list:
    """
    Tạo 5 câu hỏi trắc nghiệm hữu cơ cho Hoạt động 2 (Luyện tập Minigame)
    bám sát 100% mệnh đề kiến thức của đúng tiết học đó trong SGK (từ fillBlankQuestions, shortAnswerQuestions,
    wordBank, NLS, AI của tiết đó), không trùng lặp giữa các câu và các tiết.
    """
    questions = []
    fb_list = ext_item.get("fillBlankQuestions", [])
    sa_list = ext_item.get("shortAnswerQuestions", [])
    wb = ext_item.get("wordBank", [])

    # Gom kho từ khóa của các tiết khác cùng khối làm phương án nhiễu hữu cơ
    other_words = []
    for owb in all_period_wordbanks:
        for w in owb:
            if w not in wb and w not in other_words and len(w) > 2:
                other_words.append(w)

    # Câu 1, 2, 3: Sinh từ các mệnh đề khái niệm chuẩn SGK (fillBlankQuestions) của tiết học
    for idx, fb in enumerate(fb_list[:3]):
        correct_ans = fb.get("correctAnswer", "").strip()
        post_text = fb.get("postText", "").strip()
        pre_text = fb.get("preText", "").strip()
        clean_pre = re.sub(r"^Mệnh đề\s*[a-d1-4]\)\s*:\s*", "", pre_text, flags=re.I).strip()
        if clean_pre:
            statement = f"{clean_pre} [___] {post_text}"
        else:
            statement = f"Điền thuật ngữ chính xác vào mệnh đề SGK sau: «[___] {post_text}»"

        # Chọn 3 phương án nhiễu không trùng đáp án đúng
        distractors = [w for w in wb if w.lower() != correct_ans.lower()]
        for ow in other_words[(period * 3 + idx) % max(1, len(other_words)):]:
            if len(distractors) >= 3:
                break
            if ow.lower() != correct_ans.lower() and ow not in distractors:
                distractors.append(ow)
        while len(distractors) < 3:
            fallback = ["Phần cứng máy tính", "Bộ nhớ đệm", "Giao thức kết nối", "Dữ liệu thô"][len(distractors)]
            if fallback not in distractors and fallback.lower() != correct_ans.lower():
                distractors.append(fallback)

        opts_raw = [
            {"text": correct_ans, "isCorrect": True, "explanation": f"Chính xác theo SGK ({title}): «{correct_ans} {post_text}»."},
            {"text": distractors[0], "isCorrect": False, "explanation": f"Chưa đúng. Thuật ngữ chính xác phải là «{correct_ans}»."},
            {"text": distractors[1], "isCorrect": False, "explanation": f"Chưa đúng. Thuật ngữ chính xác phải là «{correct_ans}»."},
            {"text": distractors[2], "isCorrect": False, "explanation": f"Chưa đúng. Thuật ngữ chính xác phải là «{correct_ans}»."}
        ]
        # Đảo vị trí đáp án đúng theo (grade + period + idx) % 4 để phân bố đều A, B, C, D
        rot = (grade + period + idx) % 4
        opts_rotated = opts_raw[rot:] + opts_raw[:rot]
        letters = ["A", "B", "C", "D"]
        options = []
        correct_letter = "A"
        for l_idx, o in enumerate(opts_rotated):
            letter = letters[l_idx]
            if o["isCorrect"]:
                correct_letter = letter
            options.append({
                "letter": letter,
                "text": o["text"],
                "isCorrect": o["isCorrect"],
                "explanation": o["explanation"]
            })

        questions.append({
            "id": f"G{grade}_T{period:02d}_Q{idx+1}",
            "order": idx + 1,
            "level": "Nhận biết" if idx == 0 else "Thông hiểu",
            "question": statement,
            "options": options,
            "correctLetter": correct_letter,
            "points": 2.0
        })

    # Câu 4: Sinh từ câu hỏi phân tích tình huống thực tế (shortAnswerQuestions[0]) của đúng tiết học đó
    if sa_list:
        sa0 = sa_list[0]
        q_text = sa0.get("question", "").strip()
        sample_ans = sa0.get("sampleAnswer", "").strip()
        prompt_ctx = ext_item.get("shortAnswerPrompt", "").lstrip(":\n ").strip()
        full_q4 = f"Tình huống ({title}): {prompt_ctx}\n👉 Hỏi: {q_text}" if len(prompt_ctx) < 180 else f"Trong bài {title}: {q_text}"

        # Lấy các sampleAnswer của câu hỏi khác hoặc mệnh đề đối lập làm nhiễu
        wrong_sa = [
            "Chỉ lưu trữ dữ liệu thô mà không thực hiện bất kỳ thao tác xử lý hay kiểm tra nào.",
            "Tắt toàn bộ kết nối thiết bị ngoại vi và khởi động lại hệ điều hành ngay lập tức.",
            "Xóa bỏ toàn bộ tệp dữ liệu gốc trên ổ đĩa trước khi lưu kết quả mới."
        ]
        if len(sa_list) > 1 and sa_list[1].get("sampleAnswer", "").strip() != sample_ans:
            wrong_sa[0] = f"Nhầm lẫn với yếu tố khác: {sa_list[1].get('sampleAnswer', '').strip()}"

        opts_q4 = [
            {"text": sample_ans, "isCorrect": True, "explanation": f"Đúng bản chất tình huống trong bài {title}."},
            {"text": wrong_sa[0], "isCorrect": False, "explanation": f"Chưa chính xác. Đáp án đúng là: {sample_ans}"},
            {"text": wrong_sa[1], "isCorrect": False, "explanation": f"Chưa chính xác. Đáp án đúng là: {sample_ans}"},
            {"text": wrong_sa[2], "isCorrect": False, "explanation": f"Chưa chính xác. Đáp án đúng là: {sample_ans}"}
        ]
        rot4 = (grade + period + 3) % 4
        opts_q4 = opts_q4[rot4:] + opts_q4[:rot4]
        letters = ["A", "B", "C", "D"]
        options4 = []
        correct_l4 = "A"
        for l_idx, o in enumerate(opts_q4):
            letter = letters[l_idx]
            if o["isCorrect"]:
                correct_l4 = letter
            options4.append({
                "letter": letter,
                "text": o["text"],
                "isCorrect": o["isCorrect"],
                "explanation": o["explanation"]
            })
        questions.append({
            "id": f"G{grade}_T{period:02d}_Q4",
            "order": 4,
            "level": "Thông hiểu",
            "question": full_q4,
            "options": options4,
            "correctLetter": correct_l4,
            "points": 2.0
        })

    # Câu 5: Câu hỏi Vận dụng Năng lực số (CV 3456) & Năng lực AI (QĐ 3439) của đúng tiết đó
    ai_clean = ai_text.strip() if ai_text else "Ứng dụng AI hỗ trợ xử lý dữ liệu thông minh và an toàn."
    nls_clean = nls_text.strip() if nls_text else "Thực hiện đúng quy trình thao tác kỹ thuật số."
    q5_prompt = verb_item.get("cau7VanDungAI", "").strip()
    if not q5_prompt:
        q5_prompt = f"Trong {title}, việc kết hợp Năng lực số và Trí tuệ nhân tạo (AI) được thể hiện đúng đắn nhất qua nhận định nào sau đây?"
    else:
        q5_prompt = f"Câu hỏi Vận dụng AI ({title}): {q5_prompt}"

    correct_q5 = f"{ai_clean} (Kết hợp chuẩn Năng lực số: {nls_clean[:110]}...)" if len(nls_clean) > 110 else f"{ai_clean} ({nls_clean})"
    opts_q5 = [
        {"text": correct_q5, "isCorrect": True, "explanation": f"Chính xác theo Khung Năng lực AI QĐ 3439 & CV 3456 của Tiết {period}."},
        {"text": "AI tự động quyết định hoàn toàn mọi việc, con người không cần kiểm chứng lại dữ liệu đầu vào.", "isCorrect": False, "explanation": "Sai: Con người luôn phải kiểm chứng thông tin và chịu trách nhiệm đạo đức số."},
        {"text": "Chỉ sử dụng thao tác thủ công trên giấy, tuyệt đối không dùng phần mềm hay công cụ số.", "isCorrect": False, "explanation": "Sai: Cần vận dụng công cụ số và AI đúng mục đích để nâng cao hiệu quả."},
        {"text": "Chia sẻ công khai toàn bộ mật khẩu và dữ liệu cá nhân lên mạng để AI xử lý nhanh hơn.", "isCorrect": False, "explanation": "Sai: Vi phạm nguyên tắc an toàn và bảo mật thông tin số."}
    ]
    rot5 = (grade * 2 + period) % 4
    opts_q5 = opts_q5[rot5:] + opts_q5[:rot5]
    letters = ["A", "B", "C", "D"]
    options5 = []
    correct_l5 = "A"
    for l_idx, o in enumerate(opts_q5):
        letter = letters[l_idx]
        if o["isCorrect"]:
            correct_l5 = letter
        options5.append({
            "letter": letter,
            "text": o["text"],
            "isCorrect": o["isCorrect"],
            "explanation": o["explanation"]
        })
    questions.append({
        "id": f"G{grade}_T{period:02d}_Q5",
        "order": 5,
        "level": "Vận dụng",
        "question": q5_prompt,
        "options": options5,
        "correctLetter": correct_l5,
        "points": 2.0
    })

    return questions


def build_all_116_lessons():
    ext_path = "C:/Users/manht/tinhoc/src/data/authenticPdfExtracts.ts"
    verb_path = "C:/Users/manht/tinhoc/src/data/authenticVerbatimExtracts.ts"
    pdf_extracts = load_ts_json_object(ext_path, "AUTHENTIC_PDF_EXTRACTS")
    verb_extracts = load_ts_json_object(verb_path, "AUTHENTIC_VERBATIM_PDF_TEXT")

    all_lessons = []
    stats = {"total": 0, "practical": 0, "theory": 0}

    for grade in [6, 7, 8, 9]:
        doc_path = f"C:/Users/manht/Documents/ppt-master-main/Input/NLS-AI-{grade}.docx"
        doc = docx.Document(doc_path)
        table = doc.tables[0]

        # Thu thập wordBank toàn khối để tạo phương án nhiễu chéo
        grade_wordbanks = []
        for p in range(1, 30):
            k = f"k{grade}-tiet-{p}"
            if k in pdf_extracts:
                grade_wordbanks.append(pdf_extracts[k].get("wordBank", []))

        current_topic = ""
        for row in table.rows[1:]:
            cells = [c.text.strip().replace("\n", " ") for c in row.cells]
            if not cells or len(cells) < 7:
                continue
            if cells[0]:
                current_topic = cells[0]
            try:
                period = int(re.sub(r"[^0-9]", "", cells[1]))
            except ValueError:
                continue

            title = cells[2]
            muc_kt = cells[3]
            yccd = cells[4]
            nls_target = cells[5]
            ai_target = cells[6]
            general_obj = cells[7] if len(cells) > 7 else ""

            is_practical = ("thực hành" in title.lower()) or ("thực hành" in muc_kt.lower())
            lesson_key = f"k{grade}-tiet-{period}"
            ext_item = pdf_extracts.get(lesson_key, {})
            verb_item = verb_extracts.get(lesson_key, {})

            # 1. Xây dựng Slide Kiến thức Ghi vở (Notebook Summary Box)
            notebook_lines = []
            for fb in ext_item.get("fillBlankQuestions", []):
                ans = fb.get("correctAnswer", "").strip()
                post = fb.get("postText", "").strip()
                if ans and post:
                    notebook_lines.append(f"• {ans}: {post}")
            if not notebook_lines:
                notebook_lines.append(f"• Nội dung trọng tâm: {muc_kt}")
                notebook_lines.append(f"• Yêu cầu cần đạt: {yccd}")
            notebook_lines.append(f"• Năng lực số ({nls_target.split(':')[0]}): {nls_target}")
            notebook_lines.append(f"• Ứng dụng AI ({ai_target.split(':')[0]}): {ai_target}")

            # 2. Xây dựng Phiếu học tập điện tử Nhóm (Hoạt động 1: Khám phá)
            fill_blanks = []
            for fb in ext_item.get("fillBlankQuestions", []):
                fill_blanks.append({
                    "id": fb.get("id"),
                    "label": fb.get("label", "•"),
                    "statement": f"[___] {fb.get('postText', '').strip()}",
                    "correctAnswer": fb.get("correctAnswer", "").strip(),
                    "accepted": fb.get("accepted", [fb.get("correctAnswer", "").strip()]),
                    "points": 2.0
                })

            group_questions = []
            for sa in ext_item.get("shortAnswerQuestions", []):
                group_questions.append({
                    "id": sa.get("id"),
                    "label": sa.get("label", ""),
                    "question": sa.get("question", ""),
                    "sampleAnswer": sa.get("sampleAnswer", ""),
                    "points": 2.0
                })

            # 3. Xây dựng Minigame Củng cố (Hoạt động 2: Luyện tập)
            minigame_questions = build_organic_minigame_questions(
                grade, period, title, muc_kt, yccd, nls_target, ai_target,
                ext_item, verb_item, grade_wordbanks
            )

            # 4. Xây dựng Hoạt động 3: Vận dụng / Thực hành nộp file lên Google Drive (Chỉ bật cho Tiết Thực hành)
            stage4_text = verb_item.get("stage4OriginalText", "") or f"Thực hành trên máy tính theo nội dung: {muc_kt}. Lưu tệp sản phẩm và nộp lên hệ thống."
            allowed_exts = detect_allowed_extensions(title, muc_kt, stage4_text)
            drive_subfolder = f"KHOI_{grade}/Tiet_{period:02d}"

            activity3_practical = {
                "enabled": is_practical,
                "onlyForPracticalLesson": True,
                "taskTitle": f"Bài tập Thực hành Tiết {period}: {title}",
                "mucKT": muc_kt,
                "instructions": stage4_text,
                "allowedExtensions": allowed_exts,
                "driveRootPath": "H:\\My Drive\\Giảng dạy\\NOP_BAI_THUC_HANH",
                "driveSubfolder": drive_subfolder,
                "namingConvention": "[Lop]_[Nhom]_[HoTen]_Tiet[XX].[ext]",
                "gradingMode": "teacher_manual",
                "maxPoints": 10.0,
                "rubric": [
                    {"criteria": "Thực hiện đúng và đầy đủ yêu cầu kỹ thuật của bài thực hành", "maxScore": 5.0},
                    {"criteria": "Trình bày khoa học, thẩm mỹ, đặt tên tệp đúng quy chuẩn", "maxScore": 3.0},
                    {"criteria": "Phối hợp nhóm tốt, nộp sản phẩm đúng thời gian quy định", "maxScore": 2.0}
                ]
            }

            # 5. Dữ liệu Cổng Học tập Tại nhà (Tìm hiểu bài trước & Tự ôn luyện)
            home_portal = {
                "preClassSummary": general_obj or yccd,
                "preClassQuestions": [
                    {
                        "id": f"G{grade}_T{period:02d}_PRE1",
                        "question": verb_item.get("cau4ThongHieu", f"Nêu khái niệm trọng tâm trong {title}."),
                        "hint": f"Xem mục «{muc_kt}» trong SGK Tin học {grade}."
                    },
                    {
                        "id": f"G{grade}_T{period:02d}_PRE2",
                        "question": verb_item.get("cau5ThongHieu", f"Giải thích ý nghĩa thực tiễn của {muc_kt}."),
                        "hint": yccd
                    }
                ],
                "applicationPrompts": [
                    verb_item.get("cau6VanDung", ""),
                    verb_item.get("cau7VanDungAI", "")
                ]
            }

            lesson_obj = {
                "id": f"G{grade}_T{period:02d}",
                "lessonKey": lesson_key,
                "grade": grade,
                "period": period,
                "topic": current_topic,
                "title": title,
                "mucKT": muc_kt,
                "yccd": yccd,
                "nlsTarget": nls_target,
                "aiTarget": ai_target,
                "generalObjective": general_obj,
                "isPractical": is_practical,
                "lessonTypeLabel": "Tiết Thực hành (Nộp file Drive)" if is_practical else "Tiết Lý thuyết",
                "activity1_discovery": {
                    "title": f"Hoạt động 1: Khám phá Kiến thức mới — {title}",
                    "worksheet": {
                        "worksheetTitle": f"PHIẾU HỌC TẬP NHÓM • KHỐI {grade} - TIẾT {period}: {title.upper()}",
                        "wordBank": ext_item.get("wordBank", []),
                        "fillBlanks": fill_blanks,
                        "discussionPrompt": ext_item.get("shortAnswerPrompt", "").lstrip(":\n ").strip(),
                        "groupQuestions": group_questions
                    },
                    "notebookSlide": {
                        "slideTitle": f"📌 NỘI DUNG GHI VỞ — TIẾT {period}: {title.upper()}",
                        "coreConcepts": notebook_lines,
                        "keyTerms": ext_item.get("wordBank", [])
                    }
                },
                "activity2_minigame": {
                    "title": f"Hoạt động 2: Minigame Đấu trường Củng cố — Tiết {period}",
                    "timePerQuestionSec": 25,
                    "questions": minigame_questions
                },
                "activity3_practical": activity3_practical,
                "homePortal": home_portal
            }

            all_lessons.append(lesson_obj)
            stats["total"] += 1
            if is_practical:
                stats["practical"] += 1
            else:
                stats["theory"] += 1

    # Xây dựng Bộ đề Kiểm tra Định kỳ (Giữa kỳ I, Cuối kỳ I, Giữa kỳ II, Cuối kỳ II) cho 4 khối 6, 7, 8, 9
    periodic_exams = []
    exam_Configs = [
        ("GK1", "Kiểm tra Định kỳ Giữa Học kỳ I", 1, 8, 45),
        ("CK1", "Kiểm tra Định kỳ Cuối Học kỳ I", 1, 16, 45),
        ("GK2", "Kiểm tra Định kỳ Giữa Học kỳ II", 17, 23, 45),
        ("CK2", "Kiểm tra Định kỳ Cuối Học kỳ II", 17, 29, 45),
    ]
    for grade in [6, 7, 8, 9]:
        grade_lessons = [l for l in all_lessons if l["grade"] == grade]
        for code, name, p_start, p_end, duration in exam_Configs:
            scope_lessons = [l for l in grade_lessons if p_start <= l["period"] <= p_end]
            exam_questions = []
            # Rút 10 câu hỏi hữu cơ đại diện cho các tiết trong phạm vi kiểm tra
            q_counter = 1
            for sl in scope_lessons:
                for mq in sl["activity2_minigame"]["questions"][:2]:
                    if q_counter > 10:
                        break
                    exam_questions.append({
                        "num": q_counter,
                        "lessonRef": f"Tiết {sl['period']}: {sl['title']}",
                        "level": mq["level"],
                        "question": mq["question"],
                        "options": mq["options"],
                        "correctLetter": mq["correctLetter"],
                        "points": 1.0
                    })
                    q_counter += 1
                if q_counter > 10:
                    break

            periodic_exams.append({
                "id": f"EXAM_G{grade}_{code}",
                "grade": grade,
                "examCode": code,
                "title": f"{name} — Môn Tin học {grade} (THCS Mão Điền)",
                "periodRange": f"Tiết {p_start} đến Tiết {p_end}",
                "durationMinutes": duration,
                "totalPoints": 10.0,
                "questions": exam_questions
            })

    curriculum_output = {
        "stats": stats,
        "lessons": all_lessons,
        "periodicExams": periodic_exams
    }

    with open(os.path.join(DATA_DIR, "curriculum_116_db.json"), "w", encoding="utf-8") as f:
        json.dump(curriculum_output, f, ensure_ascii=False, indent=2)

    with open(os.path.join(JS_DIR, "data-curriculum.js"), "w", encoding="utf-8") as f:
        f.write("// Tự động trích xuất từ NLS-AI-6..9.docx & SGK Kết nối tri thức (116 tiết + 16 đề kiểm tra định kỳ)\n")
        f.write("window.CURRICULUM_DB = ")
        json.dump(curriculum_output, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(f"[OK] Đã tạo {stats['total']} tiết học ({stats['theory']} Lý thuyết, {stats['practical']} Thực hành) và {len(periodic_exams)} đề kiểm tra định kỳ.")


if __name__ == "__main__":
    build_all_116_lessons()
