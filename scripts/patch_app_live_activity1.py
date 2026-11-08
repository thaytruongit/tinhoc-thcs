# -*- coding: utf-8 -*-
"""
scripts/patch_app_live_activity1.py
Cập nhật hoàn chỉnh Bước 2 trong js/app.js:
1. Hộp cam Ghi nhớ SGK Kết nối tri thức nguyên văn 100% (bóng đèn vàng viền đỏ, nền cam SGK, chữ trắng, bullet tròn).
2. Phiếu học tập 4 dạng đầy đủ: Dạng 1 Kéo thả, Dạng 2 Điền khuyết, Dạng 3 Nối cột, Dạng 4 Thảo luận tình huống.
3. Phân quyền và đồng bộ Live theo Lớp (học sinh lớp nào chỉ nhận live lớp đó, bảo đảm tương tác mượt giữa Chrome và Edge).
4. Huy hiệu trạng thái kết nối Đám mây WSS thời gian thực.
"""
import sys
import os
import re

sys.stdout.reconfigure(encoding="utf-8")

APP_JS = "C:/Users/manht/tinhoc-thcs/js/app.js"
with open(APP_JS, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Bổ sung state cho Dạng 1 & Dạng 3 và MQTT status
old_state_decl = """    // Activity 1 & 2 interactive state
    wsFillAnswers: {},
    wsGroupAnswers: {},
    mgSelectedAnswers: {},
    mgSubmittedLessonId: null,"""

new_state_decl = """    // Activity 1 & 2 interactive state (Đủ 4 dạng)
    wsDragDropAssignments: {}, // { [itemId]: 'A' | 'B' }
    wsFillAnswers: {},
    wsMatchingAssignments: {}, // { [pairId]: rightText }
    wsGroupAnswers: {},
    mgSelectedAnswers: {},
    mgSubmittedLessonId: null,
    isMqttConnected: false,"""

if old_state_decl in content:
    content = content.replace(old_state_decl, new_state_decl)
    print("Patched state declaration.")

# 2. Bổ sung listener cho MQTT status
old_listeners = """  window.addEventListener("APP_REALTIME_SYNC", () => {
    renderApp();
  });"""

new_listeners = """  window.addEventListener("APP_REALTIME_SYNC", () => {
    renderApp();
  });
  window.addEventListener("MQTT_STATUS_CHANGED", (e) => {
    state.isMqttConnected = !!(e.detail && e.detail.connected);
    renderApp();
  });"""

if old_listeners in content and "MQTT_STATUS_CHANGED" not in content:
    content = content.replace(old_listeners, new_listeners)
    print("Patched MQTT_STATUS_CHANGED listener.")

# 3. Cập nhật renderStudentLiveClassroom để kiểm tra phân quyền Lớp
old_render_student_live = """  function renderStudentLiveClassroom(student, live, db) {
    // Lấy bài học đang được Giáo viên mở (hoặc theo khối của học sinh)
    const activeLesson = getLesson(live.grade || student.grade, live.period || 1);
    const sameClassPeers = db.students.filter(s => s.className === student.className && s.id !== student.id);
    const currentPartnerId = state.partnerIds.find(id => id !== student.id) || "";

    return `"""

new_render_student_live = """  function renderStudentLiveClassroom(student, live, db) {
    // Kiểm tra phân quyền: Lớp của học sinh có đang được phát Live không?
    const isClassLive = !live.className || live.className.toUpperCase() === student.className.toUpperCase();
    const activeLesson = getLesson(live.grade || student.grade, live.period || 1);
    const sameClassPeers = db.students.filter(s => s.className === student.className && s.id !== student.id);
    const currentPartnerId = state.partnerIds.find(id => id !== student.id) || "";

    if (!isClassLive) {
      return `
        <div class="space-y-6">
          <div class="bg-amber-50 border-2 border-amber-300 rounded-3xl p-8 text-center space-y-4 shadow-sm">
            <div class="w-16 h-16 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center text-3xl mx-auto">
              📡
            </div>
            <h3 class="text-xl font-extrabold text-amber-950">
              Phòng Live hiện tại của Thầy đang mở cho Lớp ${escapeHtml(live.className)} (Tiết ${live.period})
            </h3>
            <p class="text-sm text-amber-900 max-w-xl mx-auto leading-relaxed">
              Lớp <b>${escapeHtml(student.className)}</b> của em hiện chưa đến giờ phát live. Hệ thống sẽ <b>tự động kết nối và mở màn hình Live</b> ngay khi Thầy chuyển sang tiết dạy của lớp em!
            </p>
            <div class="pt-3 flex flex-wrap justify-center gap-3">
              <button onclick="document.querySelector('[data-st-tab=\\'preclass\\']').click()"
                class="px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md transition">
                📖 Mở Cổng Tự Học: Tìm hiểu bài trước (+50 XP)
              </button>
              <button onclick="document.querySelector('[data-st-tab=\\'practice\\']').click()"
                class="px-5 py-3 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md transition">
                🎯 Tự Ôn luyện 29 Tiết
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return `"""

if old_render_student_live in content:
    content = content.replace(old_render_student_live, new_render_student_live)
    print("Patched renderStudentLiveClassroom with class permission check.")

# 4. Thay thế renderLiveActivity1 bằng Hộp cam Ghi nhớ SGK + 4 Dạng Phiếu học tập
old_render_act1_pattern = re.search(r"function renderLiveActivity1\(lesson, live\) \{.+?\n  \}", content, re.DOTALL)

new_render_act1 = """function renderLiveActivity1(lesson, live) {
    const act1 = lesson.activity1_discovery;
    const ws = act1.worksheet;
    const nb = act1.notebookSlide;

    const dd = ws.dragDrop || { bucketA: "Hộp A", bucketB: "Hộp B", items: [] };
    const fbList = ws.fillBlanks || [];
    const mpList = ws.matchingPairs || [];
    const gqList = ws.groupQuestions || [];

    // Danh sách các vế phải để nối cột
    const rightOptions = mpList.map(m => m.right);

    return `
      <div class="space-y-6">
        ${
          live.showNotebookSlide
            ? `
          <!-- HỘP GHI NHỚ SÁCH GIÁO KHOA KẾT NỐI TRI THỨC (CHUẨN HỘP CAM NGUYÊN VĂN SGK) -->
          <div class="sgk-ghi-nho-container">
            <div class="sgk-mascot-badge">💡</div>
            <div class="sgk-ghi-nho-box">
              <div class="flex items-center justify-between border-b border-white/25 pb-3 mb-4">
                <div>
                  <span class="text-xs uppercase tracking-wider font-extrabold text-amber-200">
                    📖 Ghi nhớ Sách Giáo Khoa Kết nối tri thức với cuộc sống
                  </span>
                  <h3 class="text-xl font-extrabold text-white mt-0.5">${escapeHtml(nb.slideTitle || lesson.title)}</h3>
                </div>
                <span class="px-3.5 py-1.5 rounded-full bg-white/20 backdrop-blur text-white text-xs font-bold shadow-sm">
                  ✍️ HỌC SINH GHI NỘI DUNG VÀO VỞ
                </span>
              </div>

              <!-- Nội dung nguyên văn từng dấu chấm tròn -->
              <div class="space-y-2.5">
                ${(nb.sgkGhiNho || nb.coreConcepts || []).map(b => `
                  <div class="sgk-ghi-nho-bullet">
                    ${escapeHtml(b.replace(/^•\\s*/, ''))}
                  </div>
                `).join("")}
              </div>

              <!-- Thẻ chân trang: Mục kiến thức SGK & Năng lực số / AI -->
              <div class="mt-5 pt-3.5 border-t border-white/20 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-100">
                <div>
                  <b>Mục kiến thức SGK:</b> ${escapeHtml(nb.sgkSection || lesson.mucKT || "Mục trọng tâm")}
                </div>
                <div class="flex items-center gap-2">
                  <span class="px-2.5 py-0.5 rounded-full bg-white/15">🎯 NLS: ${escapeHtml(lesson.nlsTarget?.split(':')[0] || 'CV3456')}</span>
                  <span class="px-2.5 py-0.5 rounded-full bg-white/15">🤖 AI: ${escapeHtml(lesson.aiTarget?.split(':')[0] || 'QĐ3439')}</span>
                </div>
              </div>
            </div>
          </div>
        `
            : ""
        }

        <!-- PHIẾU HỌC TẬP ĐIỆN TỬ NHÓM (ĐỦ 4 DẠNG) -->
        <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-7">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <div class="flex items-center gap-2">
                <span class="px-2.5 py-0.5 rounded-md bg-blue-100 text-blue-800 text-xs font-bold uppercase">
                  Hoạt động 1: Khám phá Kiến thức mới
                </span>
                <span class="text-xs text-slate-500 font-bold">• 4 Dạng tương tác Nhóm</span>
              </div>
              <h3 class="text-xl font-extrabold text-slate-900 mt-1">${escapeHtml(ws.worksheetTitle)}</h3>
            </div>
            <span class="px-3.5 py-1.5 rounded-full bg-blue-600 text-white text-xs font-bold shadow-sm">
              🤝 Điểm thành tích tính chung cho Nhóm (+100 XP)
            </span>
          </div>

          <!-- DẠNG 1: KÉO THẢ PHÂN LOẠI (DRAG & DROP) -->
          ${
            dd.items && dd.items.length > 0
              ? `
            <div class="space-y-4 p-5 rounded-2xl bg-blue-50/60 border border-blue-200">
              <div class="flex items-center justify-between">
                <h4 class="font-extrabold text-sm text-blue-950 uppercase flex items-center gap-2">
                  <span class="w-6 h-6 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs">1</span>
                  <span>Dạng 1: Phân loại đối tượng vào 2 Hộp</span>
                </h4>
                <span class="text-xs font-bold text-blue-800">Bấm nút [A] hoặc [B] tương ứng cho mỗi thẻ</span>
              </div>

              <!-- 2 Hộp Phân loại -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="bucket-card border-blue-400 bg-white shadow-sm p-4 rounded-xl">
                  <div class="font-extrabold text-sm text-blue-700 flex items-center gap-1.5 pb-2 border-b border-blue-100">
                    <span>📦 HỘP A:</span>
                    <span>${escapeHtml(dd.bucketA)}</span>
                  </div>
                  <div class="mt-2 text-xs text-slate-500">Các mục được xếp vào Hộp A:</div>
                  <div class="mt-2 space-y-1.5 min-h-[50px]">
                    ${dd.items
                      .filter(it => state.wsDragDropAssignments[it.id] === "A")
                      .map(it => `<div class="px-2.5 py-1.5 rounded-lg bg-blue-100 text-blue-900 font-bold text-xs flex justify-between items-center">
                        <span>• ${escapeHtml(it.text)}</span>
                        <span class="text-[10px] text-blue-600">Đã chọn A</span>
                      </div>`)
                      .join("")}
                  </div>
                </div>

                <div class="bucket-card border-indigo-400 bg-white shadow-sm p-4 rounded-xl">
                  <div class="font-extrabold text-sm text-indigo-700 flex items-center gap-1.5 pb-2 border-b border-indigo-100">
                    <span>📦 HỘP B:</span>
                    <span>${escapeHtml(dd.bucketB)}</span>
                  </div>
                  <div class="mt-2 text-xs text-slate-500">Các mục được xếp vào Hộp B:</div>
                  <div class="mt-2 space-y-1.5 min-h-[50px]">
                    ${dd.items
                      .filter(it => state.wsDragDropAssignments[it.id] === "B")
                      .map(it => `<div class="px-2.5 py-1.5 rounded-lg bg-indigo-100 text-indigo-900 font-bold text-xs flex justify-between items-center">
                        <span>• ${escapeHtml(it.text)}</span>
                        <span class="text-[10px] text-indigo-600">Đã chọn B</span>
                      </div>`)
                      .join("")}
                  </div>
                </div>
              </div>

              <!-- Danh sách các thẻ cần phân loại -->
              <div class="space-y-2 pt-2">
                <div class="text-xs font-bold text-slate-700 uppercase">Danh sách thẻ cần phân loại:</div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  ${dd.items.map((it, idx) => {
                    const currentBox = state.wsDragDropAssignments[it.id] || "";
                    return `
                      <div class="p-3 rounded-xl bg-white border border-slate-200 flex items-center justify-between gap-2 shadow-xs">
                        <span class="text-xs font-semibold text-slate-800"><b>${idx + 1}.</b> ${escapeHtml(it.text)}</span>
                        <div class="flex items-center gap-1 shrink-0">
                          <button data-dd-id="${it.id}" data-dd-box="A"
                            class="dd-toggle-btn px-2.5 py-1 rounded-lg text-xs font-extrabold transition ${
                              currentBox === "A" ? "bg-blue-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-blue-50"
                            }">
                            Hộp A
                          </button>
                          <button data-dd-id="${it.id}" data-dd-box="B"
                            class="dd-toggle-btn px-2.5 py-1 rounded-lg text-xs font-extrabold transition ${
                              currentBox === "B" ? "bg-indigo-600 text-white shadow-xs" : "bg-slate-100 text-slate-600 hover:bg-indigo-50"
                            }">
                            Hộp B
                          </button>
                        </div>
                      </div>
                    `;
                  }).join("")}
                </div>
              </div>
            </div>
          `
              : ""
          }

          <!-- DẠNG 2: ĐIỀN KHUYẾT TỪ KHÓA (FILL-IN-THE-BLANKS) -->
          <div class="space-y-4 p-5 rounded-2xl bg-amber-50/60 border border-amber-200">
            <h4 class="font-extrabold text-sm text-amber-950 uppercase flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center text-xs">2</span>
              <span>Dạng 2: Điền khuyết hoàn thành định nghĩa SGK</span>
            </h4>

            <!-- Hộp từ khóa gợi ý -->
            <div class="bg-white rounded-xl p-3.5 border border-amber-200">
              <div class="text-xs font-bold text-amber-900 uppercase mb-2">
                💡 Ngân hàng từ khóa gợi ý:
              </div>
              <div class="flex flex-wrap gap-2">
                ${ws.wordBank.map(w => `<span class="word-chip">${escapeHtml(w)}</span>`).join("")}
              </div>
            </div>

            <div class="space-y-3">
              ${fbList.map((fb, idx) => `
                <div class="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                  <div class="text-sm font-medium text-slate-800">
                    <b>Câu ${idx + 1}:</b> ${escapeHtml(fb.statement)}
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-xs font-bold text-amber-800">Chọn từ điền vào chỗ trống:</span>
                    <select data-ws-fb="${fb.id}" class="ws-fb-input px-3 py-1.5 rounded-lg border border-amber-300 text-sm font-bold bg-white">
                      <option value="">-- Chọn từ khóa phù hợp --</option>
                      ${ws.wordBank.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("")}
                    </select>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- DẠNG 3: NỐI CỘT A VÀ B (MATCHING PAIRS) -->
          ${
            mpList && mpList.length > 0
              ? `
            <div class="space-y-4 p-5 rounded-2xl bg-emerald-50/60 border border-emerald-200">
              <h4 class="font-extrabold text-sm text-emerald-950 uppercase flex items-center gap-2">
                <span class="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-xs">3</span>
                <span>Dạng 3: Nối cột Khái niệm (Cột A) với Ý nghĩa tương ứng (Cột B)</span>
              </h4>

              <div class="space-y-3">
                ${mpList.map((mp, idx) => {
                  const assigned = state.wsMatchingAssignments[mp.id] || "";
                  return `
                    <div class="p-3.5 rounded-xl bg-white border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                      <div class="md:col-span-5 font-bold text-sm text-slate-900">
                        <span class="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs mr-1.5">${idx + 1}</span>
                        ${escapeHtml(mp.left)}
                      </div>
                      <div class="md:col-span-2 text-center text-xs font-extrabold text-emerald-700">
                        ➔ Ghép với ➔
                      </div>
                      <div class="md:col-span-5">
                        <select data-ws-mp="${mp.id}" class="ws-mp-select w-full px-3 py-2 rounded-lg border border-emerald-300 text-xs font-semibold bg-white">
                          <option value="">-- Chọn nội dung cột B phù hợp --</option>
                          ${rightOptions.map(opt => `
                            <option value="${escapeHtml(opt)}" ${assigned === opt ? "selected" : ""}>
                              ${escapeHtml(opt)}
                            </option>
                          `).join("")}
                        </select>
                      </div>
                    </div>
                  `;
                }).join("")}
              </div>
            </div>
          `
              : ""
          }

          <!-- DẠNG 4: THẢO LUẬN TÌNH HUỐNG THỰC TẾ (GROUP DISCUSSION) -->
          <div class="space-y-4 p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200">
            <h4 class="font-extrabold text-sm text-indigo-950 uppercase flex items-center gap-2">
              <span class="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-xs">4</span>
              <span>Dạng 4: Thảo luận Tình huống Thực tế & Vận dụng Năng lực số / AI</span>
            </h4>

            <div class="p-4 rounded-xl bg-white border border-indigo-200 text-sm text-indigo-950 font-medium leading-relaxed">
              <b>📌 Tình huống thảo luận:</b> ${escapeHtml(ws.discussionPrompt)}
            </div>

            <div class="space-y-3">
              ${gqList.map(gq => `
                <div class="space-y-1.5">
                  <label class="block text-sm font-bold text-slate-800">
                    ${escapeHtml(gq.label)} ${escapeHtml(gq.question)}
                  </label>
                  <textarea data-ws-gq="${gq.id}" rows="2" placeholder="Nhóm cùng thảo luận và nhập câu trả lời..."
                    class="ws-gq-input w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-indigo-600 focus:outline-none bg-white"></textarea>
                </div>
              `).join("")}
            </div>
          </div>

          <!-- NÚT NỘP PHIẾU HỌC TẬP -->
          <button id="btn-submit-worksheet" class="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold text-base shadow-xl transition flex items-center justify-center gap-2">
            <span>📤 Nộp Phiếu Học Tập Nhóm (Chấm điểm & Cộng XP cho cả Nhóm)</span>
          </button>
        </div>
      </div>
    `;
  }"""

if old_render_act1_pattern:
    content = content[:old_render_act1_pattern.start()] + new_render_act1 + content[old_render_act1_pattern.end():]
    print("Patched renderLiveActivity1 with Orange SGK Box + 4 Types.")

# 5. Cập nhật sự kiện cho Dạng 1 & Dạng 3 và tính điểm tổng hợp 4 dạng
old_ws_submit_pattern = re.search(r"// Nộp Phiếu học tập điện tử Nhóm \(Hoạt động 1\).+?btnSubmitWs\.onclick = \(\) => \{.+?\};\s*\}", content, re.DOTALL)

new_ws_events = """    // Xử lý nút bấm chọn Hộp A / Hộp B của Dạng 1
    document.querySelectorAll(".dd-toggle-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-dd-id");
        const box = btn.getAttribute("data-dd-box");
        state.wsDragDropAssignments[id] = box;
        renderApp();
      };
    });

    // Xử lý chọn cột B của Dạng 3
    document.querySelectorAll(".ws-mp-select").forEach(sel => {
      sel.onchange = (e) => {
        const id = sel.getAttribute("data-ws-mp");
        state.wsMatchingAssignments[id] = e.target.value;
      };
    });

    // Nộp Phiếu học tập điện tử Nhóm (Hoạt động 1 - Chấm trọn vẹn cả 4 Dạng)
    const btnSubmitWs = document.getElementById("btn-submit-worksheet");
    if (btnSubmitWs) {
      btnSubmitWs.onclick = () => {
        const live = Store.loadLiveState();
        const lesson = getLesson(live.grade || state.currentUser.grade, live.period || 1);
        const ws = lesson.activity1_discovery.worksheet;

        // Chấm Dạng 1: Phân loại kéo thả (Hộp A / B)
        let d1Correct = 0;
        const ddItems = ws.dragDrop?.items || [];
        ddItems.forEach(item => {
          if (state.wsDragDropAssignments[item.id] === item.correctBox) d1Correct++;
        });

        // Chấm Dạng 2: Điền khuyết
        let d2Correct = 0;
        (ws.fillBlanks || []).forEach(fb => {
          const sel = document.querySelector(`[data-ws-fb="${fb.id}"]`);
          const val = (sel?.value || "").trim().toLowerCase();
          if (val && val === fb.correctAnswer.toLowerCase()) d2Correct++;
        });

        // Chấm Dạng 3: Nối cột A - B
        let d3Correct = 0;
        const mpList = ws.matchingPairs || [];
        mpList.forEach(mp => {
          const sel = document.querySelector(`[data-ws-mp="${mp.id}"]`);
          const val = (sel?.value || state.wsMatchingAssignments[mp.id] || "").trim();
          if (val && val === mp.right.trim()) d3Correct++;
        });

        // Chấm Dạng 4: Thảo luận tình huống thực tế
        let d4Answered = 0;
        (ws.groupQuestions || []).forEach(gq => {
          const ta = document.querySelector(`[data-ws-gq="${gq.id}"]`);
          if (ta && ta.value.trim().length >= 5) d4Answered++;
        });

        const totalItems = Math.max(1, ddItems.length + (ws.fillBlanks || []).length + mpList.length + (ws.groupQuestions || []).length);
        const totalEarned = d1Correct + d2Correct + d3Correct + d4Answered;
        const rawScore = (totalEarned / totalItems) * 10;
        const finalScore = Number(Math.min(10, Math.max(4.5, rawScore)).toFixed(1));
        const xpEarned = 100;

        Store.creditGroupScoreAndXP(state.partnerIds, lesson.id, "act1", finalScore, xpEarned);

        const subs = Store.getWorksheetSubs();
        subs.unshift({
          id: "WS_" + Date.now(),
          lessonId: lesson.id,
          className: state.currentUser.className,
          groupName: state.groupName,
          memberIds: state.partnerIds,
          memberNames: state.currentUser.memberNames || [state.currentUser.fullName],
          score: finalScore,
          detail: {
            d1: `${d1Correct}/${ddItems.length}`,
            d2: `${d2Correct}/${(ws.fillBlanks || []).length}`,
            d3: `${d3Correct}/${mpList.length}`,
            d4: `${d4Answered}/${(ws.groupQuestions || []).length}`
          },
          submittedAt: new Date().toLocaleTimeString("vi-VN")
        });
        Store.saveWorksheetSubs(subs);
        showToast(`Đã nộp Phiếu học tập 4 Dạng! Điểm nhóm: ${finalScore}/10 (+${xpEarned} XP cho cả nhóm)`);
      };
    }"""

if old_ws_submit_pattern:
    content = content[:old_ws_submit_pattern.start()] + new_ws_events + content[old_ws_submit_pattern.end():]
    print("Patched worksheet submit event with 4 types grading.")

with open(APP_JS, "w", encoding="utf-8") as f:
    f.write(content)

print("Saved updated js/app.js successfully!")
