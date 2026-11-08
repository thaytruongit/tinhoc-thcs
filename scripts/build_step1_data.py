# -*- coding: utf-8 -*-
"""
Bước 1: Trích xuất & Chuẩn hóa Dữ liệu Học sinh (670 HS từ 2 tệp CSV)
và Ngân hàng Học liệu Hữu cơ 116 Tiết (Khối 6, 7, 8, 9 - 29 tiết/khối) + Đề Kiểm tra Định kỳ.
"""
import sys
import os
import re
import csv
import json
import unicodedata
import docx

sys.stdout.reconfigure(encoding="utf-8")

BASE_DIR = "C:/Users/manht/tinhoc-thcs"
DATA_DIR = os.path.join(BASE_DIR, "data")
JS_DIR = os.path.join(BASE_DIR, "js")
os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(JS_DIR, exist_ok=True)


def remove_accents(text: str) -> str:
    text = text.replace("đ", "d").replace("Đ", "D")
    nfkd = unicodedata.normalize("NFKD", text)
    return "".join([c for c in nfkd if not unicodedata.combining(c)])


def generate_username(full_name: str, class_name: str, existing_usernames: set) -> str:
    clean_name = remove_accents(full_name.strip()).lower()
    parts = [re.sub(r"[^a-z0-9]", "", p) for p in clean_name.split() if p]
    if not parts:
        base = f"{class_name.lower()}_hs"
    else:
        given_name = parts[-1]
        initials = "".join(p[0] for p in parts[:-1])
        base = f"{class_name.lower()}_{given_name}{initials}"
    candidate = base
    counter = 2
    while candidate in existing_usernames:
        candidate = f"{base}{counter}"
        counter += 1
    existing_usernames.add(candidate)
    return candidate


def build_students():
    raw_csv_path = os.path.join(DATA_DIR, "raw_students.csv")
    students = []
    existing_usernames = set()
    class_counters = {}

    with open(raw_csv_path, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader, start=1):
            full_name = row["Họ tên"].strip()
            dob = row["Ngày sinh"].strip()
            class_name = row["Lớp"].strip().upper()
            if not full_name or not class_name:
                continue
            grade = int(class_name[0])
            class_counters[class_name] = class_counters.get(class_name, 0) + 1
            seat_num = class_counters[class_name]
            group_num = (seat_num - 1) // 2 + 1
            username = generate_username(full_name, class_name, existing_usernames)

            students.append({
                "id": f"HS_{class_name}_{seat_num:02d}",
                "stt": seat_num,
                "username": username,
                "password": "123",
                "fullName": full_name,
                "dob": dob,
                "className": class_name,
                "grade": grade,
                "seatNumber": seat_num,
                "defaultGroup": f"Nhóm {group_num:02d} (Bàn {group_num})",
                "xp": 0,
                "level": 1,
                "completedLessons": [],
                "lessonScores": {},
                "examScores": {}
            })

    classes_summary = {}
    for s in students:
        cid = s["className"]
        if cid not in classes_summary:
            classes_summary[cid] = {
                "id": cid,
                "name": f"Lớp {cid}",
                "grade": s["grade"],
                "studentCount": 0
            }
        classes_summary[cid]["studentCount"] += 1

    output = {
        "adminAccount": {
            "username": "admin",
            "password": "666",
            "fullName": "Thầy Trường IT - Quản trị viên",
            "role": "admin",
            "driveRootPath": "H:\\My Drive\\Giảng dạy\\NOP_BAI_THUC_HANH"
        },
        "classes": list(sorted(classes_summary.values(), key=lambda x: (x["grade"], x["id"]))),
        "students": students
    }

    with open(os.path.join(DATA_DIR, "students_db.json"), "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    with open(os.path.join(JS_DIR, "data-students.js"), "w", encoding="utf-8") as f:
        f.write("// Tự động sinh từ 2 tệp danh sách học sinh (670 học sinh - 15 lớp Khối 6, 7, 8, 9)\n")
        f.write("window.INITIAL_STUDENTS_DB = ")
        json.dump(output, f, ensure_ascii=False, indent=2)
        f.write(";\n")

    print(f"[OK] Đã nạp {len(students)} học sinh thuộc {len(classes_summary)} lớp.")
    return output


if __name__ == "__main__":
    build_students()
