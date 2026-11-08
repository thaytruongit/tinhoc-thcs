# -*- coding: utf-8 -*-
"""
scripts/patch_app_step3_exams.py
Triển khai BƯỚC 3: Chế độ Kiểm tra Định kỳ có Kiểm soát (Proctored Periodic Exams)
- Giáo viên ra đề / giao đề cho từng lớp với thời gian đếm ngược tùy chọn.
- Học sinh chỉ được làm đề khi Giáo viên đã giao đề cho lớp.
- Chế độ kiểm soát chống gian lận:
  + Khóa sao chép, cấm chuột phải, cấm bôi đen.
  + Bắt sự kiện chuyển tab / rời màn hình (visibilitychange, blur) và trừ điểm theo cấu hình của GV.
  + Cảnh báo vi phạm toàn màn hình và tự động thu bài nếu vượt quá số lần cho phép.
  + Đồng hồ đếm ngược từng giây và tự động thu bài khi hết giờ.
  + Bảng giám sát phòng thi thời gian thực của Giáo viên.
"""
import sys
import os
import re

sys.stdout.reconfigure(encoding="utf-8")

APP_JS = "C:/Users/manht/tinhoc-thcs/js/app.js"
with open(APP_JS, "r", encoding="utf-8") as f:
    code = f.read()

# 1. Bổ sung state cho bài thi có kiểm soát
old_state_part = """    activeExamId: null,
    examAnswers: {},
    examTimeLeftSec: 0,
    examTimerInterval: null,"""

new_state_part = """    activeExamId: null,
    examAnswers: {},
    examTimeLeftSec: 0,
    examTimerInterval: null,
    examViolationsCount: 0,
    examPenaltyPoints: 0,
    showViolationModal: false,
    examSubmitResult: null,"""

if old_state_part in code:
    code = code.replace(old_state_part, new_state_part)
    print("Patched exam state.")

# 2. Bổ sung listener cho sự kiện EXAM_SESSION_SYNC
old_listeners_marker = """  window.addEventListener("MQTT_STATUS_CHANGED", (e) => {
    state.isMqttConnected = !!(e.detail && e.detail.connected);
    renderApp();
  });"""

new_listeners_marker = """  window.addEventListener("MQTT_STATUS_CHANGED", (e) => {
    state.isMqttConnected = !!(e.detail && e.detail.connected);
    renderApp();
  });
  window.addEventListener("EXAM_SESSION_SYNC", () => {
    renderApp();
  });"""

if old_listeners_marker in code and "EXAM_SESSION_SYNC" not in code:
    code = code.replace(old_listeners_marker, new_listeners_marker)
    print("Patched EXAM_SESSION_SYNC listener.")

# 3. Bổ sung tab "exams" vào Admin Portal Navigation
old_admin_nav = """            <nav class="flex flex-wrap items-center gap-1.5 bg-slate-800 p-1 rounded-xl">
              <button data-ad-tab="live" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.adminTab === "live" ? "bg-indigo-600 text-white shadow" : "text-slate-300 hover:text-white"
              }">
                📡 Điều khiển Phòng Live & Chấm Drive
              </button>
              <button data-ad-tab="students" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.adminTab === "students" ? "bg-indigo-600 text-white shadow" : "text-slate-300 hover:text-white"
              }">
                👨‍🎓 Quản lý Khối / Lớp / Học sinh (670 HS)
              </button>"""

new_admin_nav = """            <nav class="flex flex-wrap items-center gap-1.5 bg-slate-800 p-1 rounded-xl">
              <button data-ad-tab="live" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.adminTab === "live" ? "bg-indigo-600 text-white shadow" : "text-slate-300 hover:text-white"
              }">
                📡 Điều khiển Phòng Live & Chấm Drive
              </button>
              <button data-ad-tab="exams" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.adminTab === "exams" ? "bg-indigo-600 text-white shadow" : "text-slate-300 hover:text-white"
              }">
                📝 Giao Đề & Giám Sát Thi Định Kỳ
              </button>
              <button data-ad-tab="students" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.adminTab === "students" ? "bg-indigo-600 text-white shadow" : "text-slate-300 hover:text-white"
              }">
                👨‍🎓 Quản lý Khối / Lớp / Học sinh (670 HS)
              </button>"""

if old_admin_nav in code:
    code = code.replace(old_admin_nav, new_admin_nav)
    print("Patched admin nav with exams tab.")

# 4. Bổ sung router render trong renderAdminPortal
old_admin_router = """        <main class="max-w-7xl w-full mx-auto flex-1 p-4 md:p-6">
          ${state.adminTab === "live" ? renderAdminLiveController(live) : ""}
          ${state.adminTab === "students" ? renderAdminStudentManager() : ""}
          ${state.adminTab === "reports" ? renderAdminReports() : ""}
          ${state.adminTab === "config" ? renderAdminDriveConfig() : ""}
        </main>"""

new_admin_router = """        <main class="max-w-7xl w-full mx-auto flex-1 p-4 md:p-6">
          ${state.adminTab === "live" ? renderAdminLiveController(live) : ""}
          ${state.adminTab === "exams" ? renderAdminExamManager() : ""}
          ${state.adminTab === "students" ? renderAdminStudentManager() : ""}
          ${state.adminTab === "reports" ? renderAdminReports() : ""}
          ${state.adminTab === "config" ? renderAdminDriveConfig() : ""}
        </main>"""

if old_admin_router in code:
    code = code.replace(old_admin_router, new_admin_router)
    print("Patched admin main router.")

# 5. Định nghĩa renderAdminExamManager (Giao diện Quản lý & Giao đề thi của Giáo viên)
admin_exam_manager_code = """
  // ----------------------------------------------------------------------------
  // 3.1b. CỔNG GIÁO VIÊN: GIAO ĐỀ & GIÁM SÁT THI ĐỊNH KỲ CÓ CHỐNG GIAN LẬN
  // ----------------------------------------------------------------------------
  function renderAdminExamManager() {
    const db = Store.loadStudentsDB();
    const activeSession = Store.getActiveExamSession();
    const allExams = Curriculum.periodicExams || [];
    const violations = Store.getExamViolations();
    const submissions = Store.getExamSubmissions();

    const selectedGrade = state.adminExamSelectedGrade || 7;
    const examsOfGrade = allExams.filter(e => Number(e.grade) === Number(selectedGrade));
    const classesOfGrade = db.classes.filter(c => Number(c.grade) === Number(selectedGrade));

    return `
      <div class="space-y-6">
        <!-- Bảng điều khiển Giao đề thi -->
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <span class="text-xs font-bold text-indigo-600 uppercase">Khảo thí Định kỳ Chuẩn Ma trận Đặc tả</span>
              <h2 class="text-xl font-extrabold text-slate-900 mt-0.5">
                📝 Quản lý & Giao Đề Thi Định Kỳ (Chế độ Giám sát Chống Gian Lận)
              </h2>
            </div>
            ${
              activeSession && activeSession.status === "active"
                ? `<div class="flex items-center gap-2">
                    <span class="inline-block w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                    <span class="px-3.5 py-1.5 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
                      ● ĐANG MỞ CA THI CHO LỚP ${escapeHtml(activeSession.targetClass)} (${activeSession.durationMinutes} phút)
                    </span>
                    <button id="btn-close-exam-session" class="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-sm transition">
                      🛑 Đóng Ca Thi Ngay
                    </button>
                  </div>`
                : `<span class="px-3.5 py-1.5 rounded-full bg-slate-100 text-slate-600 font-bold text-xs">
                    ⚪ Chưa có ca thi nào đang mở
                  </span>`
            }
          </div>

          <!-- Thiết lập Ca thi -->
          <div class="grid grid-cols-1 md:grid-cols-4 gap-4 p-5 rounded-2xl bg-indigo-50/70 border border-indigo-200">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">1. Chọn Khối</label>
              <select id="exam-cfg-grade" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm bg-white">
                ${[6, 7, 8, 9].map(g => `<option value="${g}" ${Number(selectedGrade) === g ? "selected" : ""}>Khối ${g}</option>`).join("")}
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">2. Chọn Đề thi Định kỳ</label>
              <select id="exam-cfg-id" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm bg-white">
                ${examsOfGrade.map(e => `<option value="${e.id}">${escapeHtml(e.examCode)} — ${escapeHtml(e.title)} (20 câu)</option>`).join("")}
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">3. Giao cho Lớp nào?</label>
              <select id="exam-cfg-class" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm bg-white">
                <option value="ALL">Tất cả các lớp Khối ${selectedGrade}</option>
                ${classesOfGrade.map(c => `<option value="${c.id}">${c.name} (${c.studentCount} HS)</option>`).join("")}
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">4. Thời gian làm bài (Phút)</label>
              <select id="exam-cfg-duration" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm bg-white">
                <option value="15">15 Phút (Kiểm tra 15p)</option>
                <option value="45" selected>45 Phút (Kiểm tra Định kỳ 1 tiết)</option>
                <option value="60">60 Phút</option>
                <option value="90">90 Phút</option>
              </select>
            </div>
          </div>

          <!-- Thiết lập Chống gian lận (Anti-Cheat Parameters) -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label class="block text-xs font-bold text-slate-700 uppercase">Trừ điểm mỗi lần chuyển tab / rời màn hình:</label>
              <select id="exam-cfg-deduction" class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold bg-white">
                <option value="0.5" selected>Trừ -0.5 điểm / lần vi phạm</option>
                <option value="1.0">Trừ -1.0 điểm / lần vi phạm</option>
                <option value="2.0">Trừ -2.0 điểm / lần vi phạm</option>
                <option value="0">Không trừ điểm (Chỉ cảnh báo)</option>
              </select>
              <p class="text-[11px] text-slate-500">Hệ thống tự động phát hiện khi HS chuyển sang tab khác hoặc mở ứng dụng khác.</p>
            </div>

            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <label class="block text-xs font-bold text-slate-700 uppercase">Số lần vi phạm tối đa trước khi thu bài:</label>
              <select id="exam-cfg-max-vios" class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold bg-white">
                <option value="3" selected>Vi phạm quá 3 lần ➔ Tự động thu bài</option>
                <option value="2">Vi phạm quá 2 lần ➔ Tự động thu bài</option>
                <option value="5">Vi phạm quá 5 lần ➔ Tự động thu bài</option>
              </select>
              <p class="text-[11px] text-slate-500">Khi vượt quá ngưỡng, hệ thống sẽ tự động chấm điểm và khóa bài thi ngay lập tức.</p>
            </div>

            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col justify-between">
              <div>
                <label class="block text-xs font-bold text-slate-700 uppercase">Quy chuẩn Bảo mật Phòng thi:</label>
                <div class="text-xs text-slate-600 mt-1 space-y-0.5">
                  <div>🔒 Khóa chuột phải, cấm Copy/Paste</div>
                  <div>🚫 Khóa phím F12, Ctrl+C, Ctrl+V, Alt+Tab</div>
                </div>
              </div>
              <button id="btn-launch-exam-session" class="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold text-sm shadow-md transition mt-2">
                🚀 GIAO ĐỀ CHO LỚP & BẮT ĐẦU TÍNH GIỜ
              </button>
            </div>
          </div>
        </div>

        <!-- BẢNG GIÁM SÁT PHÒNG THI TRỰC TIẾP (LIVE EXAM PROCTOR MONITOR) -->
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
            <div>
              <span class="text-xs font-bold text-red-600 uppercase">Giám sát Thời gian thực</span>
              <h3 class="text-lg font-extrabold text-slate-900">
                🚨 Bảng Giám Sát Phòng Thi & Nhật Ký Vi Phạm Chuyển Tab (${submissions.length} bài đã nộp, ${violations.length} lượt vi phạm)
              </h3>
            </div>
            <button id="btn-export-exam-results" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm">
              📥 Xuất Kết Quả Điểm Thi (.CSV Excel)
            </button>
          </div>

          <div class="overflow-x-auto max-h-[480px] custom-scrollbar border border-slate-200 rounded-xl">
            <table class="w-full text-left border-collapse text-xs">
              <thead class="bg-slate-100 text-slate-700 sticky top-0">
                <tr>
                  <th class="p-3 border-b">STT</th>
                  <th class="p-3 border-b">Lớp</th>
                  <th class="p-3 border-b">Học sinh</th>
                  <th class="p-3 border-b">Tài khoản</th>
                  <th class="p-3 border-b">Bài thi</th>
                  <th class="p-3 border-b text-center">Số lần Chuyển Tab</th>
                  <th class="p-3 border-b text-center">Điểm Vi Phạm Trừ</th>
                  <th class="p-3 border-b text-center">Điểm Gốc</th>
                  <th class="p-3 border-b text-center font-extrabold">Điểm Thực Nhận</th>
                  <th class="p-3 border-b text-right">Trạng thái</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                ${
                  submissions.length === 0
                    ? `<tr><td colspan="10" class="p-6 text-center text-slate-500">Chưa có bài thi nào được nộp trong phiên này.</td></tr>`
                    : submissions.map((sub, idx) => `
                        <tr class="hover:bg-slate-50 ${sub.violations > 0 ? "bg-red-50/40" : ""}">
                          <td class="p-3 font-bold text-slate-500">${idx + 1}</td>
                          <td class="p-3 font-bold">${escapeHtml(sub.className)}</td>
                          <td class="p-3 font-bold text-slate-900">${escapeHtml(sub.studentName)}</td>
                          <td class="p-3 font-mono text-indigo-700">${escapeHtml(sub.username)}</td>
                          <td class="p-3 text-slate-600">${escapeHtml(sub.examTitle || sub.examId)}</td>
                          <td class="p-3 text-center">
                            ${
                              sub.violations > 0
                                ? `<span class="px-2.5 py-1 rounded-full bg-red-100 text-red-800 font-extrabold text-xs">
                                    ⚠️ ${sub.violations} lần
                                  </span>`
                                : `<span class="text-emerald-700 font-bold">0</span>`
                            }
                          </td>
                          <td class="p-3 text-center text-red-700 font-bold">-${sub.penaltyPoints || 0} đ</td>
                          <td class="p-3 text-center font-semibold">${sub.rawScore} đ</td>
                          <td class="p-3 text-center font-extrabold text-sm ${sub.finalScore >= 5 ? "text-emerald-700" : "text-red-700"}">
                            ${sub.finalScore} / 10
                          </td>
                          <td class="p-3 text-right">
                            <span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                              Đã nộp (${escapeHtml(sub.submittedAt)})
                            </span>
                          </td>
                        </tr>
                      `).join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }
"""

# Chèn hàm renderAdminExamManager vào trước bindAdminEvents
if "renderAdminExamManager" not in code:
    code = code.replace("  function bindAdminEvents() {", admin_exam_manager_code + "\n  function bindAdminEvents() {")
    print("Inserted renderAdminExamManager definition.")

# 6. Thay thế hoàn toàn renderStudentPeriodicExams bằng Chế độ Thi Có Kiểm Soát
old_render_student_exams_pattern = re.search(r"function renderStudentPeriodicExams\(student\) \{.+?\n  \}", code, re.DOTALL)

new_render_student_exams = """function renderStudentPeriodicExams(student) {
    const allExams = Curriculum.periodicExams || [];
    const examsOfGrade = allExams.filter(e => Number(e.grade) === Number(student.grade));
    const activeSession = Store.getActiveExamSession();

    // Kiểm tra xem Giáo viên đã giao đề cho lớp của học sinh này chưa?
    const isExamAssignedToMe = activeSession && activeSession.status === "active"
      && (activeSession.targetClass === "ALL" || activeSession.targetClass.toUpperCase() === student.className.toUpperCase())
      && Number(activeSession.grade) === Number(student.grade);

    const activeExam = isExamAssignedToMe
      ? allExams.find(e => e.id === activeSession.examId) || examsOfGrade[0]
      : null;

    // Nếu học sinh đang trong trạng thái làm bài thi
    if (state.activeExamId && activeExam && activeExam.id === state.activeExamId) {
      const minutes = Math.floor(state.examTimeLeftSec / 60);
      const seconds = state.examTimeLeftSec % 60;
      const timeStr = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
      const penalty = (state.examViolationsCount * Number(activeSession.deductionPerViolation || 0.5)).toFixed(1);

      return `
        <!-- Overlay cảnh báo vi phạm khi học sinh chuyển tab -->
        ${
          state.showViolationModal
            ? `
          <div class="anticheat-violation-overlay">
            <div class="w-20 h-20 rounded-full bg-white/20 border-2 border-white flex items-center justify-center text-4xl mb-4 animate-bounce">
              🚨
            </div>
            <h2 class="text-3xl font-extrabold mb-2">CẢNH BÁO VI PHẠM QUY CHẾ THI!</h2>
            <p class="max-w-xl text-lg text-red-100 font-medium leading-relaxed mb-4">
              Em vừa <b>chuyển sang tab khác hoặc rời khỏi cửa sổ bài thi</b>! Hệ thống giám sát đã tự động ghi nhận nhật ký vi phạm gửi về máy Giáo viên.
            </p>
            <div class="p-4 rounded-2xl bg-black/30 border border-white/20 text-sm font-bold space-y-1 mb-6">
              <div>⚠️ Số lần vi phạm hiện tại: <span class="text-yellow-300 text-lg">${state.examViolationsCount}</span> / ${activeSession.maxViolations} lần</div>
              <div>📉 Điểm bị trừ phạt: <span class="text-yellow-300 text-lg">-${penalty}</span> điểm</div>
              <div class="text-xs text-red-200 pt-1">Lưu ý: Nếu vi phạm quá ${activeSession.maxViolations} lần, hệ thống sẽ TỰ ĐỘNG THU BÀI và khóa bài thi ngay lập tức!</div>
            </div>
            <button id="btn-dismiss-violation" class="px-8 py-3.5 rounded-2xl bg-white text-red-700 hover:bg-red-50 font-extrabold text-base shadow-2xl transition">
              Tôi cam kết quay lại làm bài và không tái phạm
            </button>
          </div>
        `
            : ""
        }

        <!-- GIAO DIỆN LÀM BÀI THI CÓ KIỂM SOÁT -->
        <div class="no-select space-y-6">
          <!-- Thanh trạng thái bài thi bám dính (Sticky Bar) -->
          <div class="bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-950 rounded-2xl p-5 text-white shadow-xl sticky top-20 z-20 flex flex-wrap items-center justify-between gap-4 border border-indigo-700/50">
            <div>
              <div class="flex items-center gap-2">
                <span class="inline-block w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
                <span class="text-xs uppercase tracking-wider font-extrabold text-red-300">
                  CHẾ ĐỘ THI CÓ KIỂM SOÁT • LỚP ${escapeHtml(student.className)}
                </span>
              </div>
              <h2 class="text-lg font-extrabold mt-0.5">${escapeHtml(activeExam.title)}</h2>
              <div class="text-xs text-slate-300">Học sinh: <b>${escapeHtml(student.fullName)}</b> (${escapeHtml(student.username)})</div>
            </div>

            <!-- Đồng hồ đếm ngược & Chỉ số vi phạm -->
            <div class="flex flex-wrap items-center gap-3">
              <div class="px-4 py-2 rounded-xl bg-red-600/30 border border-red-500 text-center">
                <div class="text-[10px] uppercase font-bold text-red-200">Thời gian còn lại</div>
                <div id="exam-countdown-display" class="text-2xl font-mono font-extrabold text-red-400">
                  ⏱️ ${timeStr}
                </div>
              </div>

              <div class="px-4 py-2 rounded-xl bg-amber-600/30 border border-amber-500 text-center">
                <div class="text-[10px] uppercase font-bold text-amber-200">Vi phạm chuyển tab</div>
                <div class="text-xl font-extrabold text-amber-300">
                  ⚠️ ${state.examViolationsCount} / ${activeSession.maxViolations} (-${penalty}đ)
                </div>
              </div>

              <button id="btn-finish-exam-early" class="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-sm shadow-lg transition">
                📤 Nộp Bài Thi
              </button>
            </div>
          </div>

          <!-- Danh sách câu hỏi kiểm tra -->
          <div class="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 space-y-6 shadow-sm">
            <div class="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-semibold flex items-center gap-2">
              <span>🔒</span>
              <span><b>Quy chế thi:</b> Đã khóa sao chép, cấm bôi đen và cấm chuột phải. Mỗi lần chuyển tab sang màn hình khác sẽ bị trừ <b>${activeSession.deductionPerViolation} điểm</b>!</span>
            </div>

            <div class="space-y-5">
              ${activeExam.questions.map((q, idx) => {
                const selected = state.examAnswers[q.num || idx + 1];
                return `
                  <div class="p-5 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
                    <div class="flex justify-between items-center text-xs font-bold text-slate-500">
                      <span class="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800">
                        Câu ${idx + 1} (${escapeHtml(q.level || "Thông hiểu")})
                      </span>
                      <span>${q.points || 0.5} điểm</span>
                    </div>
                    <p class="font-bold text-sm text-slate-900 whitespace-pre-line leading-relaxed">
                      ${escapeHtml(q.question)}
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      ${q.options.map(opt => {
                        const isChosen = selected === opt.letter;
                        return `
                          <button data-ex-q="${q.num || idx + 1}" data-ex-letter="${opt.letter}"
                            class="proctored-ex-opt text-left p-3 rounded-xl border-2 font-semibold text-sm transition flex items-start gap-2 ${
                              isChosen
                                ? "border-indigo-600 bg-indigo-600 text-white shadow-xs"
                                : "border-slate-300 bg-white text-slate-800 hover:border-indigo-400"
                            }">
                            <span class="font-extrabold">${opt.letter}.</span>
                            <span>${escapeHtml(opt.text)}</span>
                          </button>
                        `;
                      }).join("")}
                    </div>
                  </div>
                `;
              }).join("")}
            </div>

            <button id="btn-submit-proctored-exam" class="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-extrabold text-base shadow-xl transition flex items-center justify-center gap-2">
              <span>📤 Hoàn Thành & Nộp Bài Thi Có Giám Sát</span>
            </button>
          </div>
        </div>
      `;
    }

    // Giao diện danh sách đề thi (khi học sinh chưa vào làm bài)
    return `
      <div class="space-y-6">
        <!-- Thông báo Trạng thái Ca thi từ Giáo viên -->
        ${
          isExamAssignedToMe
            ? `
          <div class="bg-gradient-to-r from-indigo-700 via-blue-700 to-indigo-800 rounded-3xl p-6 text-white shadow-xl flex flex-wrap items-center justify-between gap-4 border border-indigo-500 animate-pulse">
            <div>
              <div class="flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-amber-300 mb-1">
                <span class="inline-block w-3 h-3 rounded-full bg-emerald-400 animate-ping"></span>
                <span>GIÁO VIÊN ĐÃ MỞ CA THI CHO LỚP ${escapeHtml(student.className)}</span>
              </div>
              <h2 class="text-2xl font-extrabold">${escapeHtml(activeExam.title)}</h2>
              <p class="text-xs text-blue-100 mt-1">
                Thời gian: <b>${activeSession.durationMinutes} phút</b> • Chế độ: <b>Kiểm soát chống sao chép, cấm chuyển tab (Trừ ${activeSession.deductionPerViolation}đ/lần)</b>
              </p>
            </div>
            <button id="btn-enter-active-exam" class="px-6 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold text-sm shadow-xl transition transform hover:scale-105">
              🚀 VÀO LÀM BÀI THI NGAY
            </button>
          </div>
        `
            : `
          <div class="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5 text-center space-y-2">
            <div class="text-3xl">🔒</div>
            <h3 class="font-extrabold text-amber-950 text-base">
              CHƯA CÓ CA THI NÀO ĐƯỢC MỞ CHO LỚP ${escapeHtml(student.className)}
            </h3>
            <p class="text-xs text-amber-900 max-w-xl mx-auto">
              Theo quy chế khảo thí của Trường THCS Mão Điền, đề kiểm tra định kỳ chỉ mở khi Giáo viên phát lệnh <b>"Giao đề"</b> trong tiết kiểm tra. Khi Thầy bắt đầu ca thi, nút <b>Vào làm bài thi</b> sẽ tự động kích hoạt trên màn hình của em!
            </p>
          </div>
        `
        }

        <!-- Danh sách Đề thi Định kỳ chuẩn Ma trận Đặc tả của Khối -->
        <div class="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 space-y-5">
          <div>
            <span class="text-xs font-bold text-indigo-600 uppercase">Ngân hàng Đề thi Khảo thí Bộ GD&ĐT</span>
            <h2 class="text-xl font-extrabold text-slate-900 mt-0.5">
              📝 Bài Kiểm tra Định kỳ — Khối ${student.grade} (20 câu trắc nghiệm / 45 phút)
            </h2>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${examsOfGrade.map(ex => {
              const myScores = student.examScores || {};
              const record = myScores[ex.id];
              return `
                <div class="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-4">
                  <div>
                    <div class="flex justify-between items-center">
                      <span class="px-2.5 py-0.5 rounded-md bg-indigo-100 text-indigo-800 text-xs font-bold">
                        ${escapeHtml(ex.examCode)} • ${escapeHtml(ex.periodRange)}
                      </span>
                      <span class="text-xs text-slate-500 font-semibold">45 phút • 20 câu</span>
                    </div>
                    <h3 class="font-extrabold text-base text-slate-900 mt-2">${escapeHtml(ex.title)}</h3>
                    <p class="text-xs text-slate-500 mt-1">Đề kiểm tra chuẩn ma trận kiến thức Tin học ${student.grade} KNTT</p>
                  </div>

                  <div class="flex items-center justify-between pt-3 border-t border-slate-200">
                    <div>
                      ${
                        record
                          ? `<span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-extrabold">
                              ✅ Điểm: ${record.score}/10 ${record.violations ? `(Vi phạm: ${record.violations} lần)` : ""}
                            </span>`
                          : `<span class="text-xs text-slate-400 font-bold">Chưa có điểm</span>`
                      }
                    </div>

                    <div>
                      ${
                        isExamAssignedToMe && activeSession.examId === ex.id
                          ? `<button class="start-active-exam-btn px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs shadow-md">
                              🚀 Vào Thi Ngay
                            </button>`
                          : `<button disabled class="px-4 py-2 rounded-xl bg-slate-200 text-slate-400 font-bold text-xs cursor-not-allowed">
                              🔒 Đề chưa mở
                            </button>`
                      }
                    </div>
                  </div>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      </div>
    `;
  }"""

if old_render_student_exams_pattern:
    code = code[:old_render_student_exams_pattern.start()] + new_render_student_exams + code[old_render_student_exams_pattern.end():]
    print("Patched renderStudentPeriodicExams with proctored logic.")

# 7. Cập nhật bindAdminEvents với các sự kiện giao đề và xuất kết quả thi
old_bind_admin_marker = """    // Điều khiển Phòng Live
    const btnLock = document.getElementById("btn-toggle-screen-lock");"""

new_bind_admin_events = """    // Giao đề thi Định kỳ có Kiểm soát (Admin Exam Manager)
    const gradeExamSel = document.getElementById("exam-cfg-grade");
    if (gradeExamSel) {
      gradeExamSel.onchange = (e) => {
        state.adminExamSelectedGrade = Number(e.target.value);
        renderApp();
      };
    }

    const btnLaunchExam = document.getElementById("btn-launch-exam-session");
    if (btnLaunchExam) {
      btnLaunchExam.onclick = () => {
        const grade = Number(document.getElementById("exam-cfg-grade")?.value || 7);
        const examId = document.getElementById("exam-cfg-id")?.value;
        const targetClass = document.getElementById("exam-cfg-class")?.value || "ALL";
        const durationMinutes = Number(document.getElementById("exam-cfg-duration")?.value || 45);
        const deductionPerViolation = Number(document.getElementById("exam-cfg-deduction")?.value || 0.5);
        const maxViolations = Number(document.getElementById("exam-cfg-max-vios")?.value || 3);

        const allExams = Curriculum.periodicExams || [];
        const ex = allExams.find(e => e.id === examId) || allExams[0];

        const session = {
          sessionId: "EXS_" + Date.now(),
          examId: ex.id,
          examTitle: ex.title,
          grade: grade,
          targetClass: targetClass,
          durationMinutes: durationMinutes,
          deductionPerViolation: deductionPerViolation,
          maxViolations: maxViolations,
          status: "active",
          startedAt: Date.now()
        };

        Store.saveActiveExamSession(session);
        showToast(`Đã GIAO ĐỀ "${ex.title}" cho Lớp ${targetClass} (Thời gian: ${durationMinutes} phút)!`);
      };
    }

    const btnCloseExam = document.getElementById("btn-close-exam-session");
    if (btnCloseExam) {
      btnCloseExam.onclick = () => {
        Store.closeExamSession();
        showToast("Đã đóng ca thi định kỳ!");
      };
    }

    const btnExportExamRes = document.getElementById("btn-export-exam-results");
    if (btnExportExamRes) {
      btnExportExamRes.onclick = () => {
        const subs = Store.getExamSubmissions();
        const rows = [["STT", "Lớp", "Họ và tên", "Tài khoản", "Bài thi", "Số lần vi phạm chuyển tab", "Điểm trừ", "Điểm gốc", "Điểm thực nhận", "Thời gian nộp"]];
        subs.forEach((s, idx) => {
          rows.push([idx + 1, s.className, s.studentName, s.username, s.examTitle, s.violations, s.penaltyPoints, s.rawScore, s.finalScore, s.submittedAt]);
        });
        const csvContent = "\\uFEFF" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "Ket_Qua_Kiem_Tra_Dinh_Ky_THCS_Mao_Dien.csv";
        a.click();
      };
    }

    // Điều khiển Phòng Live
    const btnLock = document.getElementById("btn-toggle-screen-lock");"""

if old_bind_admin_marker in code and "btnLaunchExam" not in code:
    code = code.replace(old_bind_admin_marker, new_bind_admin_events)
    print("Patched bindAdminEvents with exam management events.")

# 8. Cập nhật bindStudentEvents với Anti-Cheat Engine và Đồng hồ đếm ngược
anti_cheat_student_logic = """
    // Xử lý vào làm bài thi có kiểm soát
    const btnEnterExam = document.getElementById("btn-enter-active-exam") || document.querySelector(".start-active-exam-btn");
    if (btnEnterExam) {
      btnEnterExam.onclick = () => {
        const activeSession = Store.getActiveExamSession();
        if (!activeSession || activeSession.status !== "active") {
          showToast("Ca thi chưa được Giáo viên kích hoạt!", "error");
          return;
        }

        state.activeExamId = activeSession.examId;
        state.examAnswers = {};
        state.examViolationsCount = 0;
        state.examTimeLeftSec = activeSession.durationMinutes * 60;
        state.showViolationModal = false;

        // Bắt đầu đếm ngược từng giây
        if (state.examTimerInterval) clearInterval(state.examTimerInterval);
        state.examTimerInterval = setInterval(() => {
          if (state.examTimeLeftSec > 0) {
            state.examTimeLeftSec--;
            const disp = document.getElementById("exam-countdown-display");
            if (disp) {
              const m = Math.floor(state.examTimeLeftSec / 60);
              const s = state.examTimeLeftSec % 60;
              disp.innerText = `⏱️ ${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }
          } else {
            clearInterval(state.examTimerInterval);
            state.examTimerInterval = null;
            showToast("ĐÃ HẾT GIỜ LÀM BÀI! Hệ thống tự động thu bài thi...", "error");
            submitCurrentProctoredExam(true);
          }
        }, 1000);

        // Kích hoạt Anti-Cheat Listeners
        attachAntiCheatListeners(activeSession);
        renderApp();
      };
    }

    // Xử lý chọn đáp án bài thi có kiểm soát
    document.querySelectorAll(".proctored-ex-opt").forEach(btn => {
      btn.onclick = () => {
        const qnum = btn.getAttribute("data-ex-q");
        const letter = btn.getAttribute("data-ex-letter");
        state.examAnswers[qnum] = letter;
        renderApp();
      };
    });

    const btnDismissViolation = document.getElementById("btn-dismiss-violation");
    if (btnDismissViolation) {
      btnDismissViolation.onclick = () => {
        state.showViolationModal = false;
        renderApp();
      };
    }

    function submitCurrentProctoredExam(isAuto = false) {
      if (state.examTimerInterval) {
        clearInterval(state.examTimerInterval);
        state.examTimerInterval = null;
      }
      detachAntiCheatListeners();

      const activeSession = Store.getActiveExamSession();
      const allExams = Curriculum.periodicExams || [];
      const ex = allExams.find(e => e.id === state.activeExamId) || allExams[0];

      let correct = 0;
      ex.questions.forEach((q, idx) => {
        const ans = state.examAnswers[q.num || idx + 1];
        if (ans && ans === q.correctLetter) correct++;
      });

      const totalQ = ex.questions.length || 20;
      const rawScore = Number(((correct / totalQ) * 10).toFixed(1));
      const penaltyDeduction = Number(activeSession?.deductionPerViolation || 0.5);
      const penaltyPoints = Number((state.examViolationsCount * penaltyDeduction).toFixed(1));
      const finalScore = Number(Math.max(0, rawScore - penaltyPoints).toFixed(1));

      // Lưu kết quả vào cơ sở dữ liệu học sinh
      const db = Store.loadStudentsDB();
      const st = db.students.find(s => s.id === state.currentUser.id);
      if (st) {
        if (!st.examScores) st.examScores = {};
        st.examScores[ex.id] = {
          score: finalScore,
          rawScore: rawScore,
          violations: state.examViolationsCount,
          penalty: penaltyPoints,
          completedAt: new Date().toLocaleDateString("vi-VN")
        };
        st.xp = (Number(st.xp) || 0) + Math.round(finalScore * 25);
        st.level = Math.floor(st.xp / 500) + 1;
        Store.saveStudentsDB(db);
      }

      // Lưu bài nộp vào danh sách cho Giáo viên giám sát
      Store.saveExamSubmission({
        studentId: state.currentUser.id,
        studentName: state.currentUser.fullName,
        username: state.currentUser.username,
        className: state.currentUser.className,
        examId: ex.id,
        examTitle: ex.title,
        violations: state.examViolationsCount,
        penaltyPoints: penaltyPoints,
        rawScore: rawScore,
        finalScore: finalScore,
        autoSubmitted: isAuto
      });

      state.activeExamId = null;
      showToast(`Đã thu bài thi "${ex.title}": Điểm gốc ${rawScore}đ - Trừ ${penaltyPoints}đ vi phạm = Thực nhận ${finalScore}/10 đ!`);
    }

    const btnSubmitProctored = document.getElementById("btn-submit-proctored-exam") || document.getElementById("btn-finish-exam-early");
    if (btnSubmitProctored) {
      btnSubmitProctored.onclick = () => {
        if (confirm("Em có chắc chắn muốn nộp bài thi ngay bây giờ không?")) {
          submitCurrentProctoredExam(false);
        }
      };
    }
"""

# Định nghĩa hàm attachAntiCheatListeners & detachAntiCheatListeners
anti_cheat_helpers = """
  let antiCheatVisibilityHandler = null;
  let antiCheatBlurHandler = null;
  let antiCheatContextMenuHandler = null;
  let antiCheatCopyHandler = null;
  let antiCheatKeydownHandler = null;

  function attachAntiCheatListeners(activeSession) {
    detachAntiCheatListeners();

    antiCheatVisibilityHandler = () => {
      if (document.hidden && state.activeExamId) {
        handleExamViolation(activeSession, "Chuyển tab hoặc ẩn cửa sổ trình duyệt");
      }
    };

    antiCheatBlurHandler = () => {
      if (state.activeExamId) {
        handleExamViolation(activeSession, "Rời con trỏ khỏi cửa sổ bài thi (Alt+Tab hoặc mở ứng dụng khác)");
      }
    };

    antiCheatContextMenuHandler = (e) => {
      e.preventDefault();
      showToast("🔒 Đã khóa chức năng chuột phải trong giờ thi!", "error");
    };

    antiCheatCopyHandler = (e) => {
      e.preventDefault();
      showToast("🔒 Quy chế thi cấm sao chép nội dung câu hỏi!", "error");
    };

    antiCheatKeydownHandler = (e) => {
      if (
        e.key === "F12" ||
        (e.ctrlKey && (e.key === "c" || e.key === "C" || e.key === "v" || e.key === "V" || e.key === "u" || e.key === "U" || e.key === "p" || e.key === "P")) ||
        (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "i" || e.key === "J" || e.key === "j"))
      ) {
        e.preventDefault();
        showToast("🔒 Phím tắt này bị vô hiệu hóa trong giờ thi!", "error");
      }
    };

    document.addEventListener("visibilitychange", antiCheatVisibilityHandler);
    window.addEventListener("blur", antiCheatBlurHandler);
    document.addEventListener("contextmenu", antiCheatContextMenuHandler);
    document.addEventListener("copy", antiCheatCopyHandler);
    document.addEventListener("paste", antiCheatCopyHandler);
    document.addEventListener("keydown", antiCheatKeydownHandler);
  }

  function detachAntiCheatListeners() {
    if (antiCheatVisibilityHandler) document.removeEventListener("visibilitychange", antiCheatVisibilityHandler);
    if (antiCheatBlurHandler) window.removeEventListener("blur", antiCheatBlurHandler);
    if (antiCheatContextMenuHandler) document.removeEventListener("contextmenu", antiCheatContextMenuHandler);
    if (antiCheatCopyHandler) document.removeEventListener("copy", antiCheatCopyHandler);
    if (antiCheatCopyHandler) document.removeEventListener("paste", antiCheatCopyHandler);
    if (antiCheatKeydownHandler) document.removeEventListener("keydown", antiCheatKeydownHandler);
  }

  function handleExamViolation(activeSession, reason) {
    state.examViolationsCount++;
    state.showViolationModal = true;

    Store.recordExamViolation({
      studentId: state.currentUser.id,
      studentName: state.currentUser.fullName,
      username: state.currentUser.username,
      className: state.currentUser.className,
      examId: state.activeExamId,
      violationNumber: state.examViolationsCount,
      reason: reason
    });

    renderApp();

    if (state.examViolationsCount >= Number(activeSession.maxViolations || 3)) {
      alert(`❌ Em đã vi phạm quy chế chuyển tab quá ${activeSession.maxViolations} lần cho phép! Hệ thống tự động thu bài thi ngay lập tức.`);
      submitCurrentProctoredExam(true);
    }
  }
"""

# Chèn antiCheat helpers trước bindStudentEvents
if "attachAntiCheatListeners" not in code:
    code = code.replace("  function bindStudentEvents() {", anti_cheat_helpers + "\n  function bindStudentEvents() {" + anti_cheat_student_logic)
    print("Inserted anti-cheat listeners and student events.")

with open(APP_JS, "w", encoding="utf-8") as f:
    f.write(code)

print("Saved updated js/app.js successfully!")
