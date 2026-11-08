/**
 * MAIN APPLICATION CONTROLLER (js/app.js)
 * Hệ thống Phòng học Live & Cổng Học tập Tin học THCS (Khối 6, 7, 8, 9)
 */

(function () {
  const Store = window.AppStore;
  const Curriculum = window.CURRICULUM_DB || { lessons: [], periodicExams: [] };

  let state = {
    currentUser: null, // { role: 'admin' | 'student', ... }
    loginRoleTab: "student", // 'student' | 'admin'
    loginGradeFilter: 7,
    loginClassFilter: "7A11",
    loginSelectedStudentId: "",
    // Student Portal state
    studentTab: "live", // 'live' | 'preclass' | 'practice' | 'exams' | 'analytics'
    partnerIds: [], // Danh sách ID bạn cùng nhóm đã ghép cặp
    groupName: "Nhóm 01",
    selectedHomePeriod: 1,
    activeExamId: null,
    examAnswers: {},
    examTimeLeftSec: 0,
    examTimerInterval: null,
    // Activity 1 & 2 interactive state
    wsFillAnswers: {},
    wsGroupAnswers: {},
    mgSelectedAnswers: {},
    mgSubmittedLessonId: null,
    // Admin Portal state
    adminTab: "live", // 'live' | 'students' | 'reports' | 'config'
    adminGradeFilter: "ALL",
    adminClassFilter: "ALL",
    adminSearchQuery: "",
    editingStudentId: null,
    showBulkImportModal: false,
    notification: null
  };

  // Khôi phục phiên đăng nhập
  try {
    const savedSession = sessionStorage.getItem(Store.STORAGE_KEYS.SESSION_USER);
    if (savedSession) {
      state.currentUser = JSON.parse(savedSession);
      if (state.currentUser && state.currentUser.role === "student") {
        state.partnerIds = state.currentUser.partnerIds || [state.currentUser.id];
        state.groupName = state.currentUser.groupName || state.currentUser.defaultGroup || "Nhóm 01";
      }
    }
  } catch (e) {}

  // Lắng nghe đồng bộ Realtime giữa tab Giáo viên và Học sinh (Kênh Đám mây MQTT Đa trình duyệt + Kênh Cục bộ)
  if (Store.localBroadcast) {
    Store.localBroadcast.onmessage = () => {
      renderApp();
    };
  }
  window.addEventListener("APP_REALTIME_SYNC", () => {
    renderApp();
  });
  window.addEventListener("storage", () => {
    renderApp();
  });

  function showToast(msg, type = "success") {
    state.notification = { msg, type };
    renderApp();
    setTimeout(() => {
      if (state.notification && state.notification.msg === msg) {
        state.notification = null;
        renderApp();
      }
    }, 3500);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getLesson(grade, period) {
    return Curriculum.lessons.find(l => Number(l.grade) === Number(grade) && Number(l.period) === Number(period))
      || Curriculum.lessons[0];
  }

  // ============================================================================
  // RENDER ROOT
  // ============================================================================
  function renderApp() {
    const root = document.getElementById("app-root");
    if (!root) return;

    const toastHtml = state.notification
      ? `<div class="fixed bottom-5 right-5 z-50 px-5 py-3 rounded-xl shadow-xl font-semibold text-white flex items-center gap-2 ${
          state.notification.type === "error" ? "bg-red-600" : "bg-emerald-600"
        }">
          <span>${state.notification.type === "error" ? "⚠️" : "✅"}</span>
          <span>${escapeHtml(state.notification.msg)}</span>
        </div>`
      : "";

    if (!state.currentUser) {
      root.innerHTML = renderLoginScreen() + toastHtml;
      bindLoginEvents();
      return;
    }

    if (state.currentUser.role === "admin") {
      root.innerHTML = renderAdminPortal() + toastHtml;
      bindAdminEvents();
    } else {
      root.innerHTML = renderStudentPortal() + toastHtml;
      bindStudentEvents();
    }
  }

  // ============================================================================
  // 1. MÀN HÌNH ĐĂNG NHẬP (HỌC SINH MK 123 & GIÁO VIÊN MK 666)
  // ============================================================================
  function renderLoginScreen() {
    const db = Store.loadStudentsDB();
    const classesOfGrade = db.classes.filter(c => Number(c.grade) === Number(state.loginGradeFilter));
    if (classesOfGrade.length > 0 && !classesOfGrade.some(c => c.id === state.loginClassFilter)) {
      state.loginClassFilter = classesOfGrade[0].id;
    }
    const studentsOfClass = db.students.filter(s => s.className === state.loginClassFilter);
    const selectedStudent = studentsOfClass.find(s => s.id === state.loginSelectedStudentId) || studentsOfClass[0];
    if (selectedStudent && !state.loginSelectedStudentId) {
      state.loginSelectedStudentId = selectedStudent.id;
    }

    return `
      <div class="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 flex flex-col justify-center items-center p-4">
        <div class="max-w-4xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 border border-slate-200">
          <!-- Banner trái -->
          <div class="md:col-span-5 bg-gradient-to-br from-blue-600 to-indigo-800 text-white p-8 flex flex-col justify-between">
            <div>
              <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-bold tracking-wider uppercase mb-4">
                🏫 Trường THCS Mão Điền
              </div>
              <h1 class="text-2xl font-extrabold leading-tight mb-3">
                HỆ THỐNG PHÒNG HỌC LIVE & CỔNG HỌC TẬP TIN HỌC THCS
              </h1>
              <p class="text-blue-100 text-sm mb-6">
                Tích hợp Học trực tiếp tại Phòng máy (Ghép cặp nhóm, 3 Hoạt động, Nộp sản phẩm Google Drive) & Cổng tự học tại nhà 29 tiết Khối 6, 7, 8, 9.
              </p>
              <div class="space-y-2.5 text-xs text-blue-100">
                <div class="flex items-center gap-2 bg-white/10 p-2.5 rounded-xl">
                  <span class="text-lg">👥</span>
                  <span><b>670 Học sinh (15 Lớp):</b> Khối 6, 7, 8, 9 chuẩn hóa tài khoản tự động</span>
                </div>
                <div class="flex items-center gap-2 bg-white/10 p-2.5 rounded-xl">
                  <span class="text-lg">⚡</span>
                  <span><b>Phòng Live 3 Hoạt động:</b> Khám phá Nhóm & Ghi vở • Minigame • Thực hành nộp Drive</span>
                </div>
                <div class="flex items-center gap-2 bg-white/10 p-2.5 rounded-xl">
                  <span class="text-lg">🏠</span>
                  <span><b>Cổng Học tại nhà:</b> Tìm hiểu bài trước, Ôn luyện, Kiểm tra định kỳ & So sánh Lớp/Khối</span>
                </div>
              </div>
            </div>
            <div class="mt-6 pt-4 border-t border-white/20 text-xs text-blue-200 flex justify-between">
              <span>KNTT • CV 3456 • AI 3439</span>
              <span>GitHub Pages Cloud</span>
            </div>
          </div>

          <!-- Form đăng nhập phải -->
          <div class="md:col-span-7 p-8">
            <div class="flex rounded-xl bg-slate-100 p-1 mb-6">
              <button id="tab-login-student" class="flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                state.loginRoleTab === "student" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:text-slate-900"
              }">
                👨‍🎓 Cổng Học sinh (MK: 123)
              </button>
              <button id="tab-login-admin" class="flex-1 py-2.5 rounded-lg text-sm font-bold transition ${
                state.loginRoleTab === "admin" ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:text-slate-900"
              }">
                👨‍🏫 Cổng Giáo viên (MK: 666)
              </button>
            </div>

            ${
              state.loginRoleTab === "student"
                ? `
              <div class="space-y-4">
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-600 uppercase mb-1">1. Chọn Khối</label>
                    <select id="login-grade-select" class="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:border-blue-600 focus:outline-none">
                      ${[6, 7, 8, 9]
                        .map(g => `<option value="${g}" ${Number(state.loginGradeFilter) === g ? "selected" : ""}>Khối ${g}</option>`)
                        .join("")}
                    </select>
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-600 uppercase mb-1">2. Chọn Lớp</label>
                    <select id="login-class-select" class="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:border-blue-600 focus:outline-none">
                      ${classesOfGrade
                        .map(c => `<option value="${c.id}" ${state.loginClassFilter === c.id ? "selected" : ""}>${c.name} (${c.studentCount} HS)</option>`)
                        .join("")}
                    </select>
                  </div>
                </div>

                <div>
                  <label class="block text-xs font-bold text-slate-600 uppercase mb-1">3. Chọn Họ tên Học sinh trong lớp (Tự điền Tài khoản)</label>
                  <select id="login-student-select" class="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-semibold text-sm focus:border-blue-600 focus:outline-none">
                    ${studentsOfClass
                      .map(
                        s => `<option value="${s.id}" ${selectedStudent && selectedStudent.id === s.id ? "selected" : ""}>
                          STT ${String(s.stt).padStart(2, "0")} — ${escapeHtml(s.fullName)} (${s.dob}) [TK: ${s.username}]
                        </option>`
                      )
                      .join("")}
                  </select>
                </div>

                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-600 uppercase mb-1">Tài khoản (Username)</label>
                    <input id="login-username-input" type="text" value="${selectedStudent ? escapeHtml(selectedStudent.username) : ""}"
                      placeholder="VD: 7a11_anltb"
                      class="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-mono text-sm bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none" />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-600 uppercase mb-1">Mật khẩu chung</label>
                    <input id="login-password-input" type="password" value="123"
                      placeholder="Mật khẩu mặc định: 123"
                      class="w-full px-3 py-2.5 rounded-xl border border-slate-300 font-bold text-sm focus:border-blue-600 focus:outline-none" />
                  </div>
                </div>

                <div class="bg-blue-50 border border-blue-200 rounded-xl p-3">
                  <label class="block text-xs font-bold text-blue-900 uppercase mb-1">
                    🤝 Ghép cặp Nhóm máy (Tùy chọn bạn cùng bàn để cộng điểm chung cho nhóm):
                  </label>
                  <select id="login-partner-select" class="w-full px-3 py-2 rounded-lg border border-blue-300 text-sm bg-white">
                    <option value="">-- Làm cá nhân hoặc chọn bạn ghép cặp sau --</option>
                    ${studentsOfClass
                      .filter(s => !selectedStudent || s.id !== selectedStudent.id)
                      .map(s => `<option value="${s.id}">Ghép cặp với: ${escapeHtml(s.fullName)} (${s.username})</option>`)
                      .join("")}
                  </select>
                </div>

                <button id="btn-student-login" class="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-600/25 transition">
                  🚀 Đăng nhập Vào Phòng Live & Cổng Học Tập
                </button>
              </div>
            `
                : `
              <div class="space-y-4">
                <div class="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-xs text-indigo-900">
                  <b>Tài khoản Quản trị Giáo viên:</b> Tài khoản mặc định <code>admin</code> — Mật khẩu: <code>666</code>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-600 uppercase mb-1">Tài khoản Quản trị</label>
                  <input id="admin-username-input" type="text" value="admin"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm" />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-600 uppercase mb-1">Mật khẩu Giáo viên (666)</label>
                  <input id="admin-password-input" type="password" value="666" placeholder="Nhập mật khẩu 666"
                    class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm" />
                </div>
                <button id="btn-admin-login" class="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-base shadow-lg shadow-indigo-600/25 transition">
                  🔐 Đăng nhập Cổng Quản trị Giáo viên
                </button>
              </div>
            `
            }
          </div>
        </div>
      </div>
    `;
  }

  function bindLoginEvents() {
    const tabSt = document.getElementById("tab-login-student");
    const tabAd = document.getElementById("tab-login-admin");
    if (tabSt) tabSt.onclick = () => { state.loginRoleTab = "student"; renderApp(); };
    if (tabAd) tabAd.onclick = () => { state.loginRoleTab = "admin"; renderApp(); };

    const gradeSel = document.getElementById("login-grade-select");
    if (gradeSel) {
      gradeSel.onchange = (e) => {
        state.loginGradeFilter = Number(e.target.value);
        state.loginSelectedStudentId = "";
        renderApp();
      };
    }

    const classSel = document.getElementById("login-class-select");
    if (classSel) {
      classSel.onchange = (e) => {
        state.loginClassFilter = e.target.value;
        state.loginSelectedStudentId = "";
        renderApp();
      };
    }

    const stSel = document.getElementById("login-student-select");
    if (stSel) {
      stSel.onchange = (e) => {
        state.loginSelectedStudentId = e.target.value;
        renderApp();
      };
    }

    const btnStLogin = document.getElementById("btn-student-login");
    if (btnStLogin) {
      btnStLogin.onclick = () => {
        const db = Store.loadStudentsDB();
        const uname = (document.getElementById("login-username-input")?.value || "").trim().toLowerCase();
        const pwd = (document.getElementById("login-password-input")?.value || "").trim();
        const partnerId = document.getElementById("login-partner-select")?.value || "";

        const found = db.students.find(s => s.username.toLowerCase() === uname);
        if (!found) {
          showToast("Không tìm thấy tài khoản học sinh: " + uname, "error");
          return;
        }
        if (String(found.password || "123") !== pwd) {
          showToast("Mật khẩu không đúng (Mật khẩu mặc định là 123)", "error");
          return;
        }

        const memberIds = [found.id];
        let memberNames = [found.fullName];
        if (partnerId && partnerId !== found.id) {
          const partner = db.students.find(s => s.id === partnerId);
          if (partner) {
            memberIds.push(partner.id);
            memberNames.push(partner.fullName);
          }
        }

        const gName = found.defaultGroup || `Nhóm Máy ${String(found.seatNumber || 1).padStart(2, "0")}`;
        state.partnerIds = memberIds;
        state.groupName = gName;
        state.selectedHomePeriod = 1;

        // Đăng ký nhóm vào danh sách nhóm đang hoạt động trong Phòng Live
        const groups = Store.getGroups().filter(g => !g.memberIds.some(id => memberIds.includes(id)));
        groups.push({
          groupId: "GRP_" + found.className + "_" + found.id,
          groupName: gName,
          className: found.className,
          grade: found.grade,
          memberIds: memberIds,
          memberNames: memberNames,
          joinedAt: new Date().toLocaleTimeString("vi-VN")
        });
        Store.saveGroups(groups);

        state.currentUser = {
          ...found,
          role: "student",
          partnerIds: memberIds,
          memberNames: memberNames,
          groupName: gName
        };
        sessionStorage.setItem(Store.STORAGE_KEYS.SESSION_USER, JSON.stringify(state.currentUser));
        showToast(`Xin chào ${memberNames.join(" & ")} (${found.className})!`);
      };
    }

    const btnAdLogin = document.getElementById("btn-admin-login");
    if (btnAdLogin) {
      btnAdLogin.onclick = () => {
        const pwd = (document.getElementById("admin-password-input")?.value || "").trim();
        if (pwd !== "666") {
          showToast("Sai mật khẩu Quản trị viên! (Mật khẩu chuẩn: 666)", "error");
          return;
        }
        state.currentUser = {
          username: "admin",
          fullName: "Thầy Trường IT (Quản trị viên)",
          role: "admin"
        };
        sessionStorage.setItem(Store.STORAGE_KEYS.SESSION_USER, JSON.stringify(state.currentUser));
        showToast("Đã đăng nhập Cổng Quản trị Giáo viên!");
      };
    }
  }

  // ============================================================================
  // 2. CỔNG THÔNG TIN HỌC TẬP HỌC SINH (PHÒNG LIVE TRÊN LỚP + TỰ HỌC TẠI NHÀ)
  // ============================================================================
  function renderStudentPortal() {
    const db = Store.loadStudentsDB();
    const freshStudent = db.students.find(s => s.id === state.currentUser.id) || state.currentUser;
    const live = Store.loadLiveState();
    const currentMembers = db.students.filter(s => state.partnerIds.includes(s.id));
    const memberNamesStr = currentMembers.length > 0
      ? currentMembers.map(m => m.fullName).join(" + ")
      : freshStudent.fullName;

    // Kiểm tra khóa màn hình từ Giáo viên
    const lockOverlayHtml = live.screenLocked
      ? `<div class="screen-lock-overlay">
          <div class="w-24 h-24 rounded-full bg-blue-600/30 border-2 border-blue-400 flex items-center justify-center text-5xl mb-6 pulse-ring">
            🔒
          </div>
          <h2 class="text-3xl font-extrabold mb-3">MÀN HÌNH ĐANG ĐƯỢC GIÁO VIÊN TẠM KHÓA</h2>
          <p class="max-w-xl text-blue-200 text-lg">${escapeHtml(live.lockMessage)}</p>
          <div class="mt-6 px-4 py-2 rounded-full bg-white/10 text-xs text-slate-300">
            Màn hình sẽ tự động mở khóa ngay khi Giáo viên phát lệnh hoạt động tiếp theo
          </div>
        </div>`
      : "";

    return `
      ${lockOverlayHtml}
      <div class="min-h-screen flex flex-col bg-slate-100">
        <!-- Top Header Học sinh -->
        <header class="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 shadow-sm">
          <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-extrabold text-lg">
                ${escapeHtml(freshStudent.className)}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-extrabold text-slate-900">${escapeHtml(memberNamesStr)}</span>
                  <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                    🤝 ${escapeHtml(state.groupName)}
                  </span>
                </div>
                <div class="text-xs text-slate-500">
                  TK: <b>${escapeHtml(freshStudent.username)}</b> • Cấp độ ${freshStudent.level || 1} • <b>${freshStudent.xp || 0} XP</b>
                </div>
              </div>
            </div>

            <!-- Menu 5 Chức năng Học sinh (1 Phòng Live + 4 Hoạt động Tại nhà) -->
            <nav class="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
              <button data-st-tab="live" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.studentTab === "live" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-white"
              }">
                ⚡ Phòng Live Trên Lớp
              </button>
              <button data-st-tab="preclass" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.studentTab === "preclass" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-white"
              }">
                📖 Tìm hiểu bài trước
              </button>
              <button data-st-tab="practice" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.studentTab === "practice" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-white"
              }">
                🎯 Ôn luyện 29 Tiết
              </button>
              <button data-st-tab="exams" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.studentTab === "exams" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-white"
              }">
                📝 Kiểm tra Định kỳ
              </button>
              <button data-st-tab="analytics" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.studentTab === "analytics" ? "bg-blue-600 text-white shadow" : "text-slate-600 hover:bg-white"
              }">
                📊 Tiến độ & So sánh Lớp/Khối
              </button>
            </nav>

            <button id="btn-logout" class="px-3 py-2 rounded-xl border border-slate-300 hover:bg-red-50 hover:text-red-600 text-xs font-bold text-slate-600">
              Đăng xuất
            </button>
          </div>
        </header>

        <!-- Nội dung chính -->
        <main class="max-w-7xl w-full mx-auto flex-1 p-4 md:p-6">
          ${state.studentTab === "live" ? renderStudentLiveClassroom(freshStudent, live, db) : ""}
          ${state.studentTab === "preclass" ? renderStudentPreClass(freshStudent) : ""}
          ${state.studentTab === "practice" ? renderStudentSelfPractice(freshStudent) : ""}
          ${state.studentTab === "exams" ? renderStudentPeriodicExams(freshStudent) : ""}
          ${state.studentTab === "analytics" ? renderStudentAnalyticsView(freshStudent) : ""}
        </main>
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // 2.1. PHÒNG LIVE TRÊN LỚP (GHÉP CẶP NHÓM & 3 HOẠT ĐỘNG DO GIÁO VIÊN ĐIỀU PHỐI)
  // ----------------------------------------------------------------------------
  function renderStudentLiveClassroom(student, live, db) {
    // Lấy bài học đang được Giáo viên mở (hoặc theo khối của học sinh)
    const activeLesson = getLesson(live.grade || student.grade, live.period || 1);
    const sameClassPeers = db.students.filter(s => s.className === student.className && s.id !== student.id);
    const currentPartnerId = state.partnerIds.find(id => id !== student.id) || "";

    return `
      <div class="space-y-5">
        <!-- Thanh Trạng thái Phòng Live & Ghép cặp Nhóm -->
        <div class="bg-gradient-to-r from-blue-700 to-indigo-800 rounded-2xl p-5 text-white shadow-lg flex flex-wrap items-center justify-between gap-4">
          <div>
            <div class="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-200 mb-1">
              <span class="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span>PHÒNG LIVE ĐANG ĐỒNG BỘ THEO GIÁO VIÊN ĐIỀU KHIỂN • KHỐI ${activeLesson.grade} - TIẾT ${activeLesson.period}</span>
            </div>
            <h2 class="text-xl font-extrabold">${escapeHtml(activeLesson.title)}</h2>
            <p class="text-xs text-blue-100 mt-0.5">${escapeHtml(activeLesson.mucKT)} • <span class="underline">${escapeHtml(activeLesson.lessonTypeLabel)}</span></p>
          </div>

          <!-- Chọn/Đổi bạn ghép cặp nhóm -->
          <div class="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/20 flex flex-wrap items-center gap-2">
            <span class="text-xs font-bold">🤝 Ghép cặp nhóm (Điểm tính chung):</span>
            <select id="live-partner-change" class="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-900 bg-white">
              <option value="">-- Làm cá nhân (${escapeHtml(student.fullName)}) --</option>
              ${sameClassPeers
                .map(
                  p => `<option value="${p.id}" ${currentPartnerId === p.id ? "selected" : ""}>
                    Cùng nhóm với: ${escapeHtml(p.fullName)} (${p.username})
                  </option>`
                )
                .join("")}
            </select>
          </div>
        </div>

        <!-- Thanh 3 Hoạt động do Giáo viên điều phối -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="p-4 rounded-2xl border-2 flex items-center gap-3 ${
            live.currentActivity === 1
              ? "border-blue-600 bg-blue-50 text-blue-950 shadow-sm"
              : "border-slate-200 bg-white text-slate-400"
          }">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg ${
              live.currentActivity === 1 ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
            }">1</div>
            <div>
              <div class="text-xs font-bold uppercase">Hoạt động 1 ${live.currentActivity === 1 ? "• ĐANG MỞ" : ""}</div>
              <div class="font-bold text-sm">Khám phá Kiến thức mới</div>
              <div class="text-xs opacity-75">Phiếu học tập Nhóm & Slide Ghi vở</div>
            </div>
          </div>

          <div class="p-4 rounded-2xl border-2 flex items-center gap-3 ${
            live.currentActivity === 2
              ? "border-purple-600 bg-purple-50 text-purple-950 shadow-sm"
              : "border-slate-200 bg-white text-slate-400"
          }">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg ${
              live.currentActivity === 2 ? "bg-purple-600 text-white" : "bg-slate-100 text-slate-400"
            }">2</div>
            <div>
              <div class="text-xs font-bold uppercase">Hoạt động 2 ${live.currentActivity === 2 ? "• ĐANG MỞ" : ""}</div>
              <div class="font-bold text-sm">Luyện tập Củng cố</div>
              <div class="text-xs opacity-75">Minigame Đấu trường Tri thức</div>
            </div>
          </div>

          <div class="p-4 rounded-2xl border-2 flex items-center gap-3 ${
            live.currentActivity === 3
              ? "border-emerald-600 bg-emerald-50 text-emerald-950 shadow-sm"
              : "border-slate-200 bg-white text-slate-400"
          }">
            <div class="w-10 h-10 rounded-xl flex items-center justify-center font-extrabold text-lg ${
              live.currentActivity === 3 ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-400"
            }">3</div>
            <div>
              <div class="text-xs font-bold uppercase">Hoạt động 3 ${live.currentActivity === 3 ? "• ĐANG MỞ" : ""}</div>
              <div class="font-bold text-sm">Vận dụng & Thực hành</div>
              <div class="text-xs opacity-75">${activeLesson.isPractical ? "Nộp file (.docx, .xlsx, .pptx) ➔ Drive" : "Tiết Lý thuyết (Không nộp file)"}</div>
            </div>
          </div>
        </div>

        <!-- Khung Tương tác theo Hoạt động Giáo viên đang điều phối -->
        ${live.currentActivity === 1 ? renderLiveActivity1(activeLesson, live) : ""}
        ${live.currentActivity === 2 ? renderLiveActivity2(activeLesson) : ""}
        ${live.currentActivity === 3 ? renderLiveActivity3(activeLesson, student) : ""}
      </div>
    `;
  }

  // Hoạt động 1: Khám phá Kiến thức mới (Phiếu học tập điện tử Nhóm + Slide Kiến thức Ghi vở)
  function renderLiveActivity1(lesson, live) {
    const act1 = lesson.activity1_discovery;
    const ws = act1.worksheet;
    const nb = act1.notebookSlide;

    return `
      <div class="space-y-5">
        ${
          live.showNotebookSlide
            ? `
          <!-- SLIDE KIẾN THỨC GHI VỞ DO GIÁO VIÊN BẬT -->
          <div class="notebook-paper">
            <div class="flex items-center justify-between border-b-2 border-amber-400 pb-3 mb-4">
              <h3 class="text-lg font-extrabold text-amber-950">${escapeHtml(nb.slideTitle)}</h3>
              <span class="px-3 py-1 rounded-full bg-amber-600 text-white text-xs font-bold">
                ✍️ HỌC SINH GHI NỘI DUNG TRỌNG TÂM VÀO VỞ
              </span>
            </div>
            <div class="space-y-3 text-slate-900 font-medium text-base">
              ${nb.coreConcepts.map(line => `<p class="leading-relaxed">${escapeHtml(line)}</p>`).join("")}
            </div>
            <div class="mt-4 pt-3 border-t border-amber-300 flex flex-wrap gap-2 items-center">
              <span class="text-xs font-bold text-amber-900 uppercase">Từ khóa cốt lõi:</span>
              ${nb.keyTerms.map(t => `<span class="px-2.5 py-1 rounded-lg bg-amber-200/80 text-amber-950 text-xs font-bold">${escapeHtml(t)}</span>`).join("")}
            </div>
          </div>
        `
            : ""
        }

        <!-- PHIẾU HỌC TẬP ĐIỆN TỬ NHÓM -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <span class="text-xs font-bold text-blue-600 uppercase">Hoạt động Thảo luận Nhóm Cặp đôi</span>
              <h3 class="text-lg font-extrabold text-slate-900">${escapeHtml(ws.worksheetTitle)}</h3>
            </div>
            <span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-bold">
              Điểm cộng đồng thời cho cả nhóm (+100 XP)
            </span>
          </div>

          <!-- Hộp từ khóa gợi ý -->
          <div class="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <div class="text-xs font-bold text-slate-500 uppercase mb-2">
              💡 Hộp Từ khóa Gợi ý (Bấm hoặc gõ từ khóa vào ô trống bên dưới):
            </div>
            <div class="flex flex-wrap gap-2">
              ${ws.wordBank.map(w => `<span class="word-chip">${escapeHtml(w)}</span>`).join("")}
            </div>
          </div>

          <!-- Phần 1: Điền khuyết hoàn thành khái niệm SGK -->
          <div class="space-y-3">
            <h4 class="font-bold text-sm text-slate-800 uppercase">Phần I. Hoàn thành khái niệm trọng tâm:</h4>
            ${ws.fillBlanks
              .map(
                (fb, idx) => `
              <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div class="text-sm font-medium text-slate-800">
                  <b>Câu ${idx + 1}:</b> ${escapeHtml(fb.statement)}
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-xs font-bold text-blue-700">Điền từ khóa:</span>
                  <select data-ws-fb="${fb.id}" class="ws-fb-input px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-bold bg-white">
                    <option value="">-- Chọn từ khóa phù hợp --</option>
                    ${ws.wordBank.map(w => `<option value="${escapeHtml(w)}">${escapeHtml(w)}</option>`).join("")}
                  </select>
                </div>
              </div>
            `
              )
              .join("")}
          </div>

          <!-- Phần 2: Thảo luận tình huống nhóm -->
          <div class="space-y-3">
            <h4 class="font-bold text-sm text-slate-800 uppercase">Phần II. Thảo luận Tình huống Thực tế:</h4>
            <div class="p-4 rounded-xl bg-indigo-50 border border-indigo-200 text-sm text-indigo-950 font-medium">
              <b>Tình huống:</b> ${escapeHtml(ws.discussionPrompt)}
            </div>
            ${ws.groupQuestions
              .map(
                gq => `
              <div class="space-y-1.5">
                <label class="block text-sm font-bold text-slate-700">${escapeHtml(gq.label)} ${escapeHtml(gq.question)}</label>
                <textarea data-ws-gq="${gq.id}" rows="2" placeholder="Nhóm thảo luận và nhập câu trả lời..."
                  class="ws-gq-input w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:border-blue-600 focus:outline-none"></textarea>
              </div>
            `
              )
              .join("")}
          </div>

          <button id="btn-submit-worksheet" class="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-lg transition">
            📤 Nộp Phiếu Học Tập Nhóm (Tính điểm cho cả Nhóm)
          </button>
        </div>
      </div>
    `;
  }

  // Hoạt động 2: Luyện tập Củng cố (Minigame Đấu trường Tri thức)
  function renderLiveActivity2(lesson) {
    const questions = lesson.activity2_minigame.questions || [];
    const isSubmitted = state.mgSubmittedLessonId === lesson.id;

    return `
      <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <span class="text-xs font-bold text-purple-600 uppercase">Hoạt động 2 • Củng cố Kiến thức</span>
            <h3 class="text-lg font-extrabold text-slate-900">🎮 ${escapeHtml(lesson.activity2_minigame.title)}</h3>
          </div>
          <span class="px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-bold">
            🔥 Chuỗi đúng liên tiếp nhận thưởng Combo XP (+150 XP)
          </span>
        </div>

        <div class="space-y-4">
          ${questions
            .map(
              q => `
            <div class="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 space-y-3">
              <div class="flex items-center justify-between">
                <span class="px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800 text-xs font-bold">
                  Câu ${q.order} • Mức ${escapeHtml(q.level)}
                </span>
                <span class="text-xs font-bold text-slate-500">${q.points} điểm</span>
              </div>
              <p class="font-bold text-slate-900 text-sm whitespace-pre-line">${escapeHtml(q.question)}</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                ${q.options
                  .map(opt => {
                    const selected = state.mgSelectedAnswers[q.id] === opt.letter;
                    let btnStyle = selected
                      ? "border-purple-600 bg-purple-600 text-white"
                      : "border-slate-300 bg-white text-slate-800 hover:border-purple-400";
                    if (isSubmitted) {
                      if (opt.isCorrect) btnStyle = "border-emerald-600 bg-emerald-600 text-white";
                      else if (selected && !opt.isCorrect) btnStyle = "border-red-600 bg-red-600 text-white";
                    }
                    return `
                      <button data-mg-q="${q.id}" data-mg-letter="${opt.letter}"
                        class="mg-opt-btn text-left p-3 rounded-xl border-2 font-semibold text-sm transition flex items-start gap-2 ${btnStyle}">
                        <span class="font-extrabold">${opt.letter}.</span>
                        <span>${escapeHtml(opt.text)}</span>
                      </button>
                    `;
                  })
                  .join("")}
              </div>
              ${
                isSubmitted
                  ? `<div class="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                      💡 <b>Giải thích chuẩn SGK:</b> ${escapeHtml(q.options.find(o => o.isCorrect)?.explanation || "")}
                    </div>`
                  : ""
              }
            </div>
          `
            )
            .join("")}
        </div>

        <button id="btn-submit-minigame" class="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-lg transition">
          🏆 Nộp Bài Minigame Củng cố & Nhận Điểm XP Nhóm
        </button>
      </div>
    `;
  }

  // Hoạt động 3: Vận dụng & Thực hành (Chỉ bật cho 43 Tiết Thực hành: Nộp file .docx, .xlsx, .pptx chạy thẳng về Google Drive của Thầy)
  function renderLiveActivity3(lesson, student) {
    const act3 = lesson.activity3_practical;
    if (!lesson.isPractical) {
      return `
        <div class="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-3">
          <div class="text-5xl">📘</div>
          <h3 class="text-xl font-extrabold text-slate-900">Tiết Lý thuyết — Không yêu cầu nộp tệp sản phẩm thực hành</h3>
          <p class="text-sm text-slate-600 max-w-xl mx-auto">
            Theo phân phối chương trình, <b>Tiết ${lesson.period} (${escapeHtml(lesson.title)})</b> là tiết Lý thuyết. Cổng nộp sản phẩm <code>.docx, .xlsx, .pptx</code> về Google Drive chỉ mở cho 43 tiết Thực hành.
          </p>
        </div>
      `;
    }

    const mySubs = Store.getDriveSubs().filter(
      sub => sub.lessonId === lesson.id && sub.memberIds.includes(student.id)
    );

    return `
      <div class="bg-white rounded-2xl border border-emerald-300 shadow-sm p-6 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-4">
          <div>
            <span class="text-xs font-bold text-emerald-600 uppercase">Hoạt động 3 • Dành riêng cho Tiết Thực hành</span>
            <h3 class="text-lg font-extrabold text-slate-900">💻 ${escapeHtml(act3.taskTitle)}</h3>
          </div>
          <span class="px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold">
            📂 Tự động lưu về: H:\\My Drive\\Giảng dạy\\NOP_BAI_THUC_HANH\\${escapeHtml(act3.driveSubfolder)}
          </span>
        </div>

        <!-- Yêu cầu thực hành -->
        <div class="p-4 rounded-xl bg-emerald-50 border border-emerald-200 space-y-2">
          <div class="text-xs font-bold text-emerald-900 uppercase">📋 Nhiệm vụ Thực hành trên máy tính:</div>
          <p class="text-sm text-emerald-950 font-medium">${escapeHtml(act3.instructions)}</p>
          <div class="text-xs text-emerald-800 pt-1">
            <b>Định dạng sản phẩm nhận:</b> <code>.docx</code> (Word), <code>.xlsx</code> (Excel), <code>.pptx</code> (PowerPoint), <code>.sb3</code> (Scratch)
          </div>
        </div>

        <!-- Khung tải tệp nộp về Google Drive của Thầy -->
        <div class="border-2 border-dashed border-emerald-400 rounded-2xl p-6 text-center bg-slate-50 space-y-3">
          <div class="text-4xl">📤</div>
          <div class="font-bold text-slate-800">
            Chọn tệp sản phẩm thực hành của Nhóm (.docx, .xlsx, .pptx)
          </div>
          <input id="practical-file-input" type="file" accept=".docx,.xlsx,.pptx,.sb3,.pdf,.png"
            class="block mx-auto text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700" />
          <p class="text-xs text-slate-500">
            Hệ thống sẽ tự động chuẩn hóa tên file theo Lớp + Nhóm + Họ tên và gửi thẳng về thư mục Google Drive của Thầy Trường.
          </p>
          <button id="btn-upload-drive" class="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-lg transition">
            🚀 Nộp Sản Phẩm Thực Hành Về Google Drive Giáo Viên
          </button>
        </div>

        <!-- Trạng thái bài đã nộp & Điểm Giáo viên chấm -->
        ${
          mySubs.length > 0
            ? `
          <div class="space-y-2">
            <h4 class="text-xs font-bold uppercase text-slate-600">Sản phẩm Nhóm đã nộp:</h4>
            ${mySubs
              .map(
                s => `
              <div class="p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-sm">
                <div>
                  <span class="font-bold text-slate-900">📎 ${escapeHtml(s.standardizedFileName)}</span>
                  <div class="text-xs text-slate-500">Nộp lúc: ${escapeHtml(s.submittedAt)} • Nhóm: ${escapeHtml(s.memberNames.join(", "))}</div>
                </div>
                <div>
                  ${
                    s.teacherScore !== null && s.teacherScore !== undefined
                      ? `<span class="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold">
                          ✅ Giáo viên đã chấm: ${s.teacherScore}/10 điểm (${escapeHtml(s.teacherComment || "Tốt")})
                        </span>`
                      : `<span class="px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-bold">
                          ⏳ Đã lưu vào Drive Giáo viên — Đang chờ Thầy chấm điểm
                        </span>`
                  }
                </div>
              </div>
            `
              )
              .join("")}
          </div>
        `
            : ""
        }
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // 2.2. CỔNG HỌC TẬP TẠI NHÀ: TÌM HIỂU BÀI TRƯỚC, ÔN LUYỆN, KIỂM TRA ĐỊNH KỲ, SO SÁNH LỚP/KHỐI
  // ----------------------------------------------------------------------------
  function renderStudentPreClass(student) {
    const lessonsOfGrade = Curriculum.lessons.filter(l => Number(l.grade) === Number(student.grade));
    const currentLesson = getLesson(student.grade, state.selectedHomePeriod);

    return `
      <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <span class="text-xs font-bold text-blue-600 uppercase">Hoạt động Tại nhà • Chuẩn bị Bài mới</span>
            <h2 class="text-xl font-extrabold text-slate-900">📖 Tìm hiểu Bài trước (Khối ${student.grade} - 29 Tiết)</h2>
          </div>
          <select id="home-period-select" class="px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-sm">
            ${lessonsOfGrade
              .map(
                l => `<option value="${l.period}" ${Number(state.selectedHomePeriod) === l.period ? "selected" : ""}>
                  Tiết ${l.period}: ${escapeHtml(l.title)} (${l.isPractical ? "Thực hành" : "Lý thuyết"})
                </option>`
              )
              .join("")}
          </select>
        </div>

        <div class="notebook-paper">
          <h3 class="font-extrabold text-amber-950 text-base mb-2">
            📌 Tóm tắt Kiến thức Trọng tâm — Tiết ${currentLesson.period}: ${escapeHtml(currentLesson.title)}
          </h3>
          <div class="space-y-2 text-sm text-slate-900">
            ${currentLesson.activity1_discovery.notebookSlide.coreConcepts.map(c => `<p>${escapeHtml(c)}</p>`).join("")}
          </div>
        </div>

        <div class="space-y-4">
          <h4 class="font-bold text-sm uppercase text-slate-700">Câu hỏi Tìm hiểu trước khi lên lớp (+50 XP Chuẩn bị bài):</h4>
          ${currentLesson.homePortal.preClassQuestions
            .map(
              (pq, idx) => `
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div class="font-bold text-sm text-slate-900">Câu ${idx + 1}: ${escapeHtml(pq.question)}</div>
              <div class="text-xs text-blue-700">💡 Gợi ý SGK: ${escapeHtml(pq.hint)}</div>
              <textarea rows="2" placeholder="Nhập nội dung em tìm hiểu được..."
                class="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"></textarea>
            </div>
          `
            )
            .join("")}
          <button id="btn-complete-preclass" class="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow">
            ✅ Hoàn thành Tìm hiểu Bài trước (+50 XP)
          </button>
        </div>
      </div>
    `;
  }

  function renderStudentSelfPractice(student) {
    const lessonsOfGrade = Curriculum.lessons.filter(l => Number(l.grade) === Number(student.grade));
    const currentLesson = getLesson(student.grade, state.selectedHomePeriod);

    return `
      <div class="space-y-5">
        <div class="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span class="text-xs font-bold text-purple-600 uppercase">Hoạt động Tại nhà • Tự Ôn luyện 29 Tiết</span>
            <h2 class="text-xl font-extrabold text-slate-900">🎯 Tự Ôn luyện & Củng cố Kiến thức Khối ${student.grade}</h2>
          </div>
          <select id="practice-period-select" class="px-3.5 py-2 rounded-xl border border-slate-300 font-bold text-sm">
            ${lessonsOfGrade
              .map(
                l => `<option value="${l.period}" ${Number(state.selectedHomePeriod) === l.period ? "selected" : ""}>
                  Tiết ${l.period}: ${escapeHtml(l.title)}
                </option>`
              )
              .join("")}
          </select>
        </div>
        ${renderLiveActivity2(currentLesson)}
      </div>
    `;
  }

  function renderStudentPeriodicExams(student) {
    const exams = Curriculum.periodicExams.filter(e => Number(e.grade) === Number(student.grade));
    const activeExam = exams.find(e => e.id === state.activeExamId);

    if (!activeExam) {
      return `
        <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div>
            <span class="text-xs font-bold text-indigo-600 uppercase">Khảo thí Chuẩn Ma trận Đặc tả Bộ GD&ĐT</span>
            <h2 class="text-xl font-extrabold text-slate-900">📝 Bài Kiểm tra Định kỳ — Khối ${student.grade}</h2>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            ${exams
              .map(ex => {
                const prev = (student.examScores || {})[ex.id];
                return `
                  <div class="p-5 rounded-2xl border border-slate-200 bg-slate-50 flex flex-col justify-between gap-4">
                    <div>
                      <span class="px-2.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-bold">
                        ${escapeHtml(ex.examCode)} • ${escapeHtml(ex.periodRange)}
                      </span>
                      <h3 class="font-extrabold text-base text-slate-900 mt-2">${escapeHtml(ex.title)}</h3>
                      <p class="text-xs text-slate-500 mt-1">Thời gian: ${ex.durationMinutes} phút • Thang điểm: 10.0</p>
                    </div>
                    <div class="flex items-center justify-between pt-3 border-t border-slate-200">
                      <span class="text-xs font-bold ${prev ? "text-emerald-700" : "text-slate-500"}">
                        ${prev ? `✅ Điểm cao nhất: ${prev.score}/10` : "Chưa làm bài"}
                      </span>
                      <button data-start-exam="${ex.id}" class="start-exam-btn px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold">
                        🚀 Bắt đầu Làm bài
                      </button>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>
      `;
    }

    return `
      <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <h2 class="text-lg font-extrabold text-slate-900">${escapeHtml(activeExam.title)}</h2>
            <p class="text-xs text-slate-500">Phạm vi: ${escapeHtml(activeExam.periodRange)} • 10 câu hỏi chuẩn SGK</p>
          </div>
          <div class="flex items-center gap-3">
            <span class="px-3.5 py-1.5 rounded-xl bg-red-100 text-red-800 font-extrabold text-sm">
              ⏱️ Thời gian: 45:00
            </span>
            <button id="btn-cancel-exam" class="px-3 py-1.5 rounded-xl border border-slate-300 text-xs font-bold">Quay lại</button>
          </div>
        </div>

        <div class="space-y-4">
          ${activeExam.questions
            .map(
              q => `
            <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5">
              <div class="flex justify-between text-xs font-bold text-slate-500">
                <span>Câu ${q.num} (${escapeHtml(q.level)}) — ${escapeHtml(q.lessonRef)}</span>
                <span>${q.points} điểm</span>
              </div>
              <p class="font-bold text-sm text-slate-900 whitespace-pre-line">${escapeHtml(q.question)}</p>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-2">
                ${q.options
                  .map(
                    opt => `
                  <button data-ex-q="${q.num}" data-ex-letter="${opt.letter}"
                    class="ex-opt-btn text-left p-2.5 rounded-xl border-2 text-sm font-semibold ${
                      state.examAnswers[q.num] === opt.letter
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 bg-white text-slate-800"
                    }">
                    <b>${opt.letter}.</b> ${escapeHtml(opt.text)}
                  </button>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
            )
            .join("")}
        </div>

        <button id="btn-submit-exam" class="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg">
          📤 Nộp Bài Kiểm Tra Định Kỳ & Chấm Điểm
        </button>
      </div>
    `;
  }

  function renderStudentAnalyticsView(student) {
    const stats = Store.getStudentAnalytics(student.id);
    if (!stats) return "";

    const pctLessons = Math.min(100, Math.round((stats.completedCount / 29) * 100));

    return `
      <div class="space-y-6">
        <!-- Thẻ tổng hợp cá nhân -->
        <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div class="text-xs font-bold text-slate-500 uppercase">Điểm TB Cá nhân</div>
            <div class="text-3xl font-extrabold text-blue-600 mt-1">${stats.overallAvg} <span class="text-sm text-slate-400">/ 10</span></div>
            <div class="text-xs text-slate-500 mt-1">TB Bài học: ${stats.lessonAvg} • TB Định kỳ: ${stats.examAvg}</div>
          </div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div class="text-xs font-bold text-slate-500 uppercase">Tổng Điểm Kinh Nghiệm</div>
            <div class="text-3xl font-extrabold text-purple-600 mt-1">${stats.student.xp || 0} XP</div>
            <div class="text-xs text-slate-500 mt-1">Cấp độ hiện tại: Level ${stats.student.level || 1}</div>
          </div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div class="text-xs font-bold text-slate-500 uppercase">Xếp hạng Trong Lớp (${escapeHtml(student.className)})</div>
            <div class="text-3xl font-extrabold text-emerald-600 mt-1">Hạng #${stats.classRank}</div>
            <div class="text-xs text-slate-500 mt-1">Trên tổng số ${stats.classTotal} học sinh lớp ${escapeHtml(student.className)}</div>
          </div>
          <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div class="text-xs font-bold text-slate-500 uppercase">Xếp hạng Toàn Khối ${student.grade}</div>
            <div class="text-3xl font-extrabold text-amber-600 mt-1">Hạng #${stats.gradeRank}</div>
            <div class="text-xs text-slate-500 mt-1">Trên tổng số ${stats.gradeTotal} học sinh Khối ${student.grade}</div>
          </div>
        </div>

        <!-- Bảng So sánh Tương quan: Cá nhân vs Trung bình Lớp vs Trung bình Khối -->
        <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <h3 class="text-lg font-extrabold text-slate-900">
            📊 So sánh Kết quả Cá nhân với Trung bình Lớp (${escapeHtml(student.className)}) & Toàn Khối ${student.grade}
          </h3>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- So sánh Điểm số -->
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div class="font-bold text-sm text-slate-800">1. So sánh Điểm Trung bình (Thang điểm 10):</div>
              <div class="space-y-2 text-xs font-bold">
                <div>
                  <div class="flex justify-between mb-1"><span>Cá nhân (${escapeHtml(student.fullName)})</span><span>${stats.overallAvg} đ</span></div>
                  <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-blue-600 rounded-full" style="width: ${Math.min(100, stats.overallAvg * 10)}%"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between mb-1"><span>Trung bình Lớp ${escapeHtml(student.className)}</span><span>${stats.classAvgScore} đ</span></div>
                  <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-emerald-500 rounded-full" style="width: ${Math.min(100, stats.classAvgScore * 10)}%"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between mb-1"><span>Trung bình Toàn Khối ${student.grade}</span><span>${stats.gradeAvgScore} đ</span></div>
                  <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-amber-500 rounded-full" style="width: ${Math.min(100, stats.gradeAvgScore * 10)}%"></div>
                  </div>
                </div>
              </div>
            </div>

            <!-- So sánh XP -->
            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
              <div class="font-bold text-sm text-slate-800">2. So sánh Điểm Tiến bộ XP Tích lũy:</div>
              <div class="space-y-2 text-xs font-bold">
                <div>
                  <div class="flex justify-between mb-1"><span>XP Cá nhân em</span><span>${stats.student.xp || 0} XP</span></div>
                  <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-purple-600 rounded-full" style="width: ${Math.min(100, ((stats.student.xp || 0) / 1000) * 100)}%"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between mb-1"><span>XP Trung bình Lớp ${escapeHtml(student.className)}</span><span>${stats.classAvgXP} XP</span></div>
                  <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-indigo-500 rounded-full" style="width: ${Math.min(100, (stats.classAvgXP / 1000) * 100)}%"></div>
                  </div>
                </div>
                <div>
                  <div class="flex justify-between mb-1"><span>XP Trung bình Toàn Khối ${student.grade}</span><span>${stats.gradeAvgXP} XP</span></div>
                  <div class="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                    <div class="h-full bg-teal-500 rounded-full" style="width: ${Math.min(100, (stats.gradeAvgXP / 1000) * 100)}%"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Tiến độ 29 tiết -->
          <div class="pt-3 border-t border-slate-200">
            <div class="flex justify-between text-xs font-bold mb-1.5">
              <span>Tiến độ hoàn thành Chương trình 29 Tiết Khối ${student.grade}</span>
              <span>${stats.completedCount} / 29 Tiết (${pctLessons}%)</span>
            </div>
            <div class="w-full h-3.5 bg-slate-200 rounded-full overflow-hidden">
              <div class="h-full bg-gradient-to-r from-blue-600 to-emerald-500" style="width: ${pctLessons}%"></div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function bindStudentEvents() {
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
      btnLogout.onclick = () => {
        sessionStorage.removeItem(Store.STORAGE_KEYS.SESSION_USER);
        state.currentUser = null;
        renderApp();
      };
    }

    document.querySelectorAll("[data-st-tab]").forEach(btn => {
      btn.onclick = () => {
        state.studentTab = btn.getAttribute("data-st-tab");
        renderApp();
      };
    });

    // Đổi bạn ghép cặp nhóm ngay trong Phòng Live
    const partnerSel = document.getElementById("live-partner-change");
    if (partnerSel) {
      partnerSel.onchange = (e) => {
        const db = Store.loadStudentsDB();
        const pid = e.target.value;
        const memberIds = [state.currentUser.id];
        const memberNames = [state.currentUser.fullName];
        if (pid) {
          const p = db.students.find(s => s.id === pid);
          if (p) {
            memberIds.push(p.id);
            memberNames.push(p.fullName);
          }
        }
        state.partnerIds = memberIds;
        state.currentUser.partnerIds = memberIds;
        state.currentUser.memberNames = memberNames;
        sessionStorage.setItem(Store.STORAGE_KEYS.SESSION_USER, JSON.stringify(state.currentUser));
        showToast("Đã cập nhật nhóm ghép cặp: " + memberNames.join(" & "));
      };
    }

    // Nộp Phiếu học tập điện tử Nhóm (Hoạt động 1)
    const btnSubmitWs = document.getElementById("btn-submit-worksheet");
    if (btnSubmitWs) {
      btnSubmitWs.onclick = () => {
        const live = Store.loadLiveState();
        const lesson = getLesson(live.grade || state.currentUser.grade, live.period || 1);
        const ws = lesson.activity1_discovery.worksheet;

        let correctCount = 0;
        ws.fillBlanks.forEach(fb => {
          const sel = document.querySelector(`[data-ws-fb="${fb.id}"]`);
          const val = (sel?.value || "").trim().toLowerCase();
          if (val && val === fb.correctAnswer.toLowerCase()) {
            correctCount++;
          }
        });

        let answeredDiscussion = 0;
        ws.groupQuestions.forEach(gq => {
          const ta = document.querySelector(`[data-ws-gq="${gq.id}"]`);
          if (ta && ta.value.trim().length >= 5) answeredDiscussion++;
        });

        const totalItems = Math.max(1, ws.fillBlanks.length + ws.groupQuestions.length);
        const rawScore = ((correctCount + answeredDiscussion) / totalItems) * 10;
        const finalScore = Number(Math.max(4, rawScore).toFixed(1));
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
          submittedAt: new Date().toLocaleTimeString("vi-VN")
        });
        Store.saveWorksheetSubs(subs);
        showToast(`Đã nộp Phiếu học tập Nhóm! Điểm nhóm: ${finalScore}/10 (+${xpEarned} XP cho cả nhóm)`);
      };
    }

    // Chọn đáp án Minigame (Hoạt động 2 & Tự ôn luyện)
    document.querySelectorAll(".mg-opt-btn").forEach(btn => {
      btn.onclick = () => {
        const qid = btn.getAttribute("data-mg-q");
        const letter = btn.getAttribute("data-mg-letter");
        state.mgSelectedAnswers[qid] = letter;
        renderApp();
      };
    });

    const btnSubmitMg = document.getElementById("btn-submit-minigame");
    if (btnSubmitMg) {
      btnSubmitMg.onclick = () => {
        const live = Store.loadLiveState();
        const lesson = state.studentTab === "live"
          ? getLesson(live.grade || state.currentUser.grade, live.period || 1)
          : getLesson(state.currentUser.grade, state.selectedHomePeriod);
        const questions = lesson.activity2_minigame.questions || [];

        let correct = 0;
        let streak = 0;
        let maxStreak = 0;
        questions.forEach(q => {
          if (state.mgSelectedAnswers[q.id] === q.correctLetter) {
            correct++;
            streak++;
            if (streak > maxStreak) maxStreak = streak;
          } else {
            streak = 0;
          }
        });

        const score10 = Number(((correct / Math.max(1, questions.length)) * 10).toFixed(1));
        const comboBonus = maxStreak >= 3 ? 50 : 0;
        const xpEarned = Math.round(score10 * 15) + comboBonus;

        state.mgSubmittedLessonId = lesson.id;
        Store.creditGroupScoreAndXP(state.partnerIds, lesson.id, "act2", score10, xpEarned);

        const mgSubs = Store.getMinigameSubs();
        mgSubs.unshift({
          id: "MG_" + Date.now(),
          lessonId: lesson.id,
          className: state.currentUser.className,
          groupName: state.groupName,
          memberIds: state.partnerIds,
          memberNames: state.currentUser.memberNames || [state.currentUser.fullName],
          score: score10,
          maxStreak,
          submittedAt: new Date().toLocaleTimeString("vi-VN")
        });
        Store.saveMinigameSubs(mgSubs);
        showToast(`Hoàn thành Minigame: Đúng ${correct}/${questions.length} câu (${score10} điểm, +${xpEarned} XP cho cả nhóm)!`);
      };
    }

    // Nộp file sản phẩm Thực hành (.docx, .xlsx, .pptx) về Google Drive của Thầy (Hoạt động 3)
    const btnUploadDrive = document.getElementById("btn-upload-drive");
    if (btnUploadDrive) {
      btnUploadDrive.onclick = async () => {
        const fileInput = document.getElementById("practical-file-input");
        const file = fileInput?.files?.[0];
        if (!file) {
          showToast("Vui lòng chọn tệp sản phẩm (.docx, .xlsx, .pptx) trước khi nộp!", "error");
          return;
        }

        const live = Store.loadLiveState();
        const lesson = getLesson(live.grade || state.currentUser.grade, live.period || 1);
        const ext = "." + (file.name.split(".").pop() || "docx").toLowerCase();
        const memberNames = state.currentUser.memberNames || [state.currentUser.fullName];
        const cleanNames = memberNames.map(n => n.split(" ").pop()).join("_");
        const standardizedFileName = `${state.currentUser.className}_${state.groupName.replace(/\s+/g, "")}_${cleanNames}_Tiet${String(lesson.period).padStart(2, "0")}${ext}`;

        const reader = new FileReader();
        reader.onload = async () => {
          const dataUrl = String(reader.result || "");
          const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
          const gasCfg = Store.getGasConfig();

          let driveFileUrl = dataUrl;
          if (gasCfg.gasWebAppUrl && gasCfg.gasWebAppUrl.startsWith("http")) {
            try {
              const res = await fetch(gasCfg.gasWebAppUrl, {
                method: "POST",
                body: JSON.stringify({
                  action: "uploadPracticalFile",
                  driveFolderId: gasCfg.driveFolderId,
                  grade: lesson.grade,
                  period: lesson.period,
                  className: state.currentUser.className,
                  groupName: state.groupName,
                  memberNames: memberNames.join(", "),
                  standardizedFileName,
                  mimeType: file.type || "application/octet-stream",
                  base64Data
                })
              });
              const json = await res.json();
              if (json && json.fileUrl) driveFileUrl = json.fileUrl;
            } catch (err) {
              console.warn("GAS Drive Upload fallback to local store:", err);
            }
          }

          const driveSubs = Store.getDriveSubs();
          driveSubs.unshift({
            id: "DRV_" + Date.now(),
            lessonId: lesson.id,
            grade: lesson.grade,
            period: lesson.period,
            lessonTitle: lesson.title,
            className: state.currentUser.className,
            groupName: state.groupName,
            memberIds: state.partnerIds,
            memberNames: memberNames,
            originalFileName: file.name,
            standardizedFileName,
            fileSizeKB: Math.round(file.size / 1024),
            driveFolderPath: `H:\\My Drive\\Giảng dạy\\NOP_BAI_THUC_HANH\\KHOI_${lesson.grade}\\Tiet_${String(lesson.period).padStart(2, "0")}`,
            fileDataUrl: driveFileUrl,
            teacherScore: null,
            teacherComment: "",
            submittedAt: new Date().toLocaleString("vi-VN")
          });
          Store.saveDriveSubs(driveSubs);

          // Thưởng trước 50 XP chuyên cần nộp sản phẩm cho cả nhóm
          Store.creditGroupScoreAndXP(state.partnerIds, lesson.id, "act3", 8.0, 50);
          showToast(`Đã nộp "${standardizedFileName}" về Google Drive của Thầy Trường! (+50 XP)`);
        };
        reader.readAsDataURL(file);
      };
    }

    // Sự kiện Cổng Học tập tại nhà
    const homePeriodSel = document.getElementById("home-period-select");
    if (homePeriodSel) {
      homePeriodSel.onchange = (e) => {
        state.selectedHomePeriod = Number(e.target.value);
        renderApp();
      };
    }

    const practicePeriodSel = document.getElementById("practice-period-select");
    if (practicePeriodSel) {
      practicePeriodSel.onchange = (e) => {
        state.selectedHomePeriod = Number(e.target.value);
        renderApp();
      };
    }

    const btnPreClass = document.getElementById("btn-complete-preclass");
    if (btnPreClass) {
      btnPreClass.onclick = () => {
        const lesson = getLesson(state.currentUser.grade, state.selectedHomePeriod);
        Store.creditGroupScoreAndXP([state.currentUser.id], lesson.id, "act1", 9.0, 50);
        showToast("Đã ghi nhận hoàn thành Tìm hiểu bài trước (+50 XP)!");
      };
    }

    // Kiểm tra định kỳ
    document.querySelectorAll(".start-exam-btn").forEach(btn => {
      btn.onclick = () => {
        state.activeExamId = btn.getAttribute("data-start-exam");
        state.examAnswers = {};
        renderApp();
      };
    });

    const btnCancelExam = document.getElementById("btn-cancel-exam");
    if (btnCancelExam) {
      btnCancelExam.onclick = () => {
        state.activeExamId = null;
        renderApp();
      };
    }

    document.querySelectorAll(".ex-opt-btn").forEach(btn => {
      btn.onclick = () => {
        const qnum = btn.getAttribute("data-ex-q");
        const letter = btn.getAttribute("data-ex-letter");
        state.examAnswers[qnum] = letter;
        renderApp();
      };
    });

    const btnSubmitExam = document.getElementById("btn-submit-exam");
    if (btnSubmitExam) {
      btnSubmitExam.onclick = () => {
        const ex = Curriculum.periodicExams.find(e => e.id === state.activeExamId);
        if (!ex) return;
        let correct = 0;
        ex.questions.forEach(q => {
          if (state.examAnswers[q.num] === q.correctLetter) correct++;
        });
        const score = Number(((correct / ex.questions.length) * 10).toFixed(1));
        const db = Store.loadStudentsDB();
        const st = db.students.find(s => s.id === state.currentUser.id);
        if (st) {
          if (!st.examScores) st.examScores = {};
          st.examScores[ex.id] = { score, completedAt: new Date().toLocaleDateString("vi-VN") };
          st.xp = (Number(st.xp) || 0) + Math.round(score * 20);
          st.level = Math.floor(st.xp / 500) + 1;
          Store.saveStudentsDB(db);
        }
        state.activeExamId = null;
        showToast(`Hoàn thành ${ex.title}: Đạt ${score}/10 điểm (+${Math.round(score * 20)} XP)!`);
      };
    }
  }

  // ============================================================================
  // 3. CỔNG QUẢN TRỊ GIÁO VIÊN (MẬT KHẨU 666)
  // ============================================================================
  function renderAdminPortal() {
    const live = Store.loadLiveState();

    return `
      <div class="min-h-screen flex flex-col bg-slate-100">
        <!-- Top Header Giáo viên -->
        <header class="bg-slate-900 text-white px-5 py-3.5 sticky top-0 z-30 shadow-lg">
          <div class="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-extrabold text-lg">
                GV
              </div>
              <div>
                <h1 class="font-extrabold text-base">CỔNG QUẢN TRỊ GIÁO VIÊN • TRƯỜNG THCS MÃO ĐIỀN</h1>
                <p class="text-xs text-slate-400">
                  Phòng Live: Khối ${live.grade} - Tiết ${live.period} • Hoạt động ${live.currentActivity} • Màn hình HS: ${
                    live.screenLocked ? "🔒 ĐANG KHÓA" : "🔓 ĐANG MỞ"
                  }
                </p>
              </div>
            </div>

            <nav class="flex flex-wrap items-center gap-1.5 bg-slate-800 p-1 rounded-xl">
              <button data-ad-tab="live" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.adminTab === "live" ? "bg-indigo-600 text-white shadow" : "text-slate-300 hover:text-white"
              }">
                📡 Điều khiển Phòng Live & Chấm Drive
              </button>
              <button data-ad-tab="students" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.adminTab === "students" ? "bg-indigo-600 text-white shadow" : "text-slate-300 hover:text-white"
              }">
                👨‍🎓 Quản lý Khối / Lớp / Học sinh (670 HS)
              </button>
              <button data-ad-tab="reports" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.adminTab === "reports" ? "bg-indigo-600 text-white shadow" : "text-slate-300 hover:text-white"
              }">
                📊 Báo cáo Tổng hợp Kết quả
              </button>
              <button data-ad-tab="config" class="px-3.5 py-2 rounded-lg text-xs font-bold transition ${
                state.adminTab === "config" ? "bg-indigo-600 text-white shadow" : "text-slate-300 hover:text-white"
              }">
                ⚙️ Cấu hình Google Drive & GAS
              </button>
            </nav>

            <button id="btn-admin-logout" class="px-3 py-2 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white text-xs font-bold transition">
              Đăng xuất
            </button>
          </div>
        </header>

        <main class="max-w-7xl w-full mx-auto flex-1 p-4 md:p-6">
          ${state.adminTab === "live" ? renderAdminLiveController(live) : ""}
          ${state.adminTab === "students" ? renderAdminStudentManager() : ""}
          ${state.adminTab === "reports" ? renderAdminReports() : ""}
          ${state.adminTab === "config" ? renderAdminDriveConfig() : ""}
        </main>
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // 3.1. BỘ ĐIỀU KHIỂN PHÒNG LIVE (CHUYỂN 3 HOẠT ĐỘNG, KHÓA/MỞ MÀN HÌNH & CHẤM FILE DRIVE)
  // ----------------------------------------------------------------------------
  function renderAdminLiveController(live) {
    const db = Store.loadStudentsDB();
    const lessonsOfGrade = Curriculum.lessons.filter(l => Number(l.grade) === Number(live.grade));
    const currentLesson = getLesson(live.grade, live.period);
    const driveSubs = Store.getDriveSubs();
    const wsSubs = Store.getWorksheetSubs();
    const mgSubs = Store.getMinigameSubs();
    const activeGroups = Store.getGroups();

    return `
      <div class="space-y-6">
        <!-- Bảng Điều khiển Trung tâm của Giáo viên -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <span class="text-xs font-bold text-indigo-600 uppercase">Động cơ Điều phối Live Do Giáo viên Làm chủ</span>
              <h2 class="text-xl font-extrabold text-slate-900">🎛️ Trung tâm Điều khiển Tiết dạy Phòng máy</h2>
            </div>

            <!-- Nút Khóa / Mở màn hình Học sinh tức thì -->
            <button id="btn-toggle-screen-lock" class="px-5 py-3 rounded-xl font-extrabold text-sm shadow-lg transition flex items-center gap-2 ${
              live.screenLocked
                ? "bg-red-600 hover:bg-red-700 text-white animate-pulse"
                : "bg-slate-900 hover:bg-slate-800 text-white"
            }">
              <span>${live.screenLocked ? "🔓 MỞ KHÓA MÀN HÌNH HỌC SINH" : "🔒 KHÓA MÀN HÌNH HỌC SINH"}</span>
            </button>
          </div>

          <!-- Chọn Khối / Lớp / Tiết học -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Chọn Khối giảng dạy</label>
              <select id="admin-live-grade" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm">
                ${[6, 7, 8, 9].map(g => `<option value="${g}" ${Number(live.grade) === g ? "selected" : ""}>Khối ${g} (29 Tiết)</option>`).join("")}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Chọn Lớp trong Phòng máy</label>
              <select id="admin-live-class" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm">
                ${db.classes
                  .filter(c => Number(c.grade) === Number(live.grade))
                  .map(c => `<option value="${c.id}" ${live.className === c.id ? "selected" : ""}>${c.name} (${c.studentCount} HS)</option>`)
                  .join("")}
              </select>
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-500 uppercase mb-1">Chọn Tiết học (PPCT 1..29)</label>
              <select id="admin-live-period" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm">
                ${lessonsOfGrade
                  .map(
                    l => `<option value="${l.period}" ${Number(live.period) === l.period ? "selected" : ""}>
                      Tiết ${l.period} [${l.isPractical ? "THỰC HÀNH" : "LÝ THUYẾT"}]: ${escapeHtml(l.title)}
                    </option>`
                  )
                  .join("")}
              </select>
            </div>
          </div>

          <!-- Bộ 3 nút Chuyển Hoạt động đồng bộ xuống máy Học sinh -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            <div class="p-4 rounded-2xl border-2 space-y-3 ${
              live.currentActivity === 1 ? "border-blue-600 bg-blue-50" : "border-slate-200 bg-slate-50"
            }">
              <div class="flex items-center justify-between">
                <span class="px-2.5 py-0.5 rounded-md bg-blue-600 text-white text-xs font-bold">Hoạt động 1</span>
                ${live.currentActivity === 1 ? `<span class="text-xs font-extrabold text-blue-700">● ĐANG PHÁT</span>` : ""}
              </div>
              <div class="font-extrabold text-slate-900">Khám phá Kiến thức mới</div>
              <p class="text-xs text-slate-600">Phiếu học tập điện tử Nhóm + Slide Kiến thức Ghi vở</p>
              <div class="flex flex-col gap-2">
                <button data-set-activity="1" class="set-act-btn w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                  ▶️ Phát Hoạt động 1 xuống Lớp
                </button>
                <button id="btn-toggle-notebook" class="w-full py-2 rounded-xl border-2 border-amber-500 font-bold text-xs ${
                  live.showNotebookSlide ? "bg-amber-500 text-white" : "bg-amber-50 text-amber-900"
                }">
                  ${live.showNotebookSlide ? "📒 Đang hiện Slide Ghi vở (Bấm để ẩn)" : "📒 Bật Slide Kiến thức Ghi vở"}
                </button>
              </div>
            </div>

            <div class="p-4 rounded-2xl border-2 space-y-3 ${
              live.currentActivity === 2 ? "border-purple-600 bg-purple-50" : "border-slate-200 bg-slate-50"
            }">
              <div class="flex items-center justify-between">
                <span class="px-2.5 py-0.5 rounded-md bg-purple-600 text-white text-xs font-bold">Hoạt động 2</span>
                ${live.currentActivity === 2 ? `<span class="text-xs font-extrabold text-purple-700">● ĐANG PHÁT</span>` : ""}
              </div>
              <div class="font-extrabold text-slate-900">Luyện tập Củng cố</div>
              <p class="text-xs text-slate-600">Minigame trắc nghiệm tốc độ (5 câu hỏi hữu cơ của tiết học)</p>
              <button data-set-activity="2" class="set-act-btn w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs">
                ▶️ Phát Hoạt động 2 (Minigame)
              </button>
            </div>

            <div class="p-4 rounded-2xl border-2 space-y-3 ${
              live.currentActivity === 3 ? "border-emerald-600 bg-emerald-50" : "border-slate-200 bg-slate-50"
            }">
              <div class="flex items-center justify-between">
                <span class="px-2.5 py-0.5 rounded-md bg-emerald-600 text-white text-xs font-bold">Hoạt động 3</span>
                ${live.currentActivity === 3 ? `<span class="text-xs font-extrabold text-emerald-700">● ĐANG PHÁT</span>` : ""}
              </div>
              <div class="font-extrabold text-slate-900">Vận dụng & Thực hành</div>
              <p class="text-xs text-slate-600">
                ${
                  currentLesson.isPractical
                    ? "Tiết Thực hành: HS nộp file (.docx, .xlsx, .pptx) tự lưu về Google Drive"
                    : "Tiết Lý thuyết: Tự động ẩn cổng nộp file sản phẩm"
                }
              </p>
              <button data-set-activity="3" class="set-act-btn w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
                ▶️ Phát Hoạt động 3 (Thực hành Drive)
              </button>
            </div>
          </div>
        </div>

        <!-- Khu vực Chấm Sản phẩm Thực hành Nộp về Google Drive (H:\My Drive\Giảng dạy) -->
        <div class="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
            <div>
              <span class="text-xs font-bold text-emerald-600 uppercase">Kho lưu trữ: H:\\My Drive\\Giảng dạy\\NOP_BAI_THUC_HANH</span>
              <h3 class="text-lg font-extrabold text-slate-900">
                📂 Sản phẩm Thực hành Học sinh đã nộp (${driveSubs.length} bài) — Giáo viên Tự chấm
              </h3>
            </div>
          </div>

          ${
            driveSubs.length === 0
              ? `<div class="p-6 text-center text-sm text-slate-500 bg-slate-50 rounded-xl">
                  Chưa có nhóm học sinh nào nộp tệp thực hành (.docx, .xlsx, .pptx) trong phiên này.
                </div>`
              : `<div class="space-y-3">
                  ${driveSubs
                    .map(
                      sub => `
                    <div class="p-4 rounded-xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-4">
                      <div class="space-y-1">
                        <div class="flex items-center gap-2">
                          <span class="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-bold">${escapeHtml(sub.className)}</span>
                          <span class="font-extrabold text-sm text-slate-900">📎 ${escapeHtml(sub.standardizedFileName)}</span>
                          <span class="text-xs text-slate-500">(${sub.fileSizeKB} KB)</span>
                        </div>
                        <div class="text-xs text-slate-600">
                          <b>Thành viên Nhóm:</b> ${escapeHtml(sub.memberNames.join(" + "))} • <b>Thư mục Drive:</b> <code>${escapeHtml(sub.driveFolderPath)}</code>
                        </div>
                      </div>

                      <div class="flex flex-wrap items-center gap-2">
                        <a href="${sub.fileDataUrl}" download="${escapeHtml(sub.standardizedFileName)}" target="_blank"
                          class="px-3 py-2 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-800 text-xs font-bold">
                          👁️ Mở / Tải File
                        </a>
                        <input id="grade-score-${sub.id}" type="number" min="0" max="10" step="0.5"
                          value="${sub.teacherScore !== null ? sub.teacherScore : 9.0}"
                          class="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 text-sm font-bold text-center" />
                        <input id="grade-comment-${sub.id}" type="text" placeholder="Nhận xét..."
                          value="${escapeHtml(sub.teacherComment || "Hoàn thành tốt sản phẩm")}"
                          class="w-44 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs" />
                        <button data-grade-sub="${sub.id}" class="grade-sub-btn px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                          ✅ Lưu Điểm Nhóm
                        </button>
                      </div>
                    </div>
                  `
                    )
                    .join("")}
                </div>`
          }
        </div>

        <!-- Theo dõi Nhóm Ghép cặp & Bài nộp Hoạt động 1, 2 -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h4 class="font-extrabold text-sm text-slate-900 uppercase">
              🤝 Danh sách Nhóm Ghép cặp & Phiếu Học tập Nhóm (${wsSubs.length} bài)
            </h4>
            <div class="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              ${
                wsSubs.length === 0 && activeGroups.length === 0
                  ? `<p class="text-xs text-slate-500">Chưa có nhóm ghép cặp nào nộp phiếu.</p>`
                  : wsSubs
                      .map(
                        w => `
                      <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
                        <div>
                          <b>${escapeHtml(w.className)} • ${escapeHtml(w.memberNames.join(" + "))}</b>
                          <div class="text-slate-500">Bài: ${escapeHtml(w.lessonId)} • Lúc ${escapeHtml(w.submittedAt)}</div>
                        </div>
                        <span class="px-2.5 py-1 rounded-full bg-blue-100 text-blue-800 font-extrabold">${w.score}/10 đ</span>
                      </div>
                    `
                      )
                      .join("")
              }
            </div>
          </div>

          <div class="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <h4 class="font-extrabold text-sm text-slate-900 uppercase">
              🏆 Bảng Xếp hạng Minigame Củng cố (${mgSubs.length} lượt)
            </h4>
            <div class="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
              ${
                mgSubs.length === 0
                  ? `<p class="text-xs text-slate-500">Chưa có lượt nộp Minigame nào.</p>`
                  : mgSubs
                      .map(
                        m => `
                      <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex justify-between items-center text-xs">
                        <div>
                          <b>${escapeHtml(m.className)} • ${escapeHtml(m.memberNames.join(" + "))}</b>
                          <div class="text-slate-500">Chuỗi đúng: 🔥 ${m.maxStreak} • Lúc ${escapeHtml(m.submittedAt)}</div>
                        </div>
                        <span class="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-extrabold">${m.score}/10 đ</span>
                      </div>
                    `
                      )
                      .join("")
              }
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // 3.2. QUẢN LÝ KHỐI, LỚP, TÀI KHOẢN HỌC SINH (THÊM, SỬA, XÓA & NẠP HÀNG LOẠT TỰ SINH TK, MK 123)
  // ----------------------------------------------------------------------------
  function renderAdminStudentManager() {
    const db = Store.loadStudentsDB();
    let filtered = db.students;
    if (state.adminGradeFilter !== "ALL") {
      filtered = filtered.filter(s => Number(s.grade) === Number(state.adminGradeFilter));
    }
    if (state.adminClassFilter !== "ALL") {
      filtered = filtered.filter(s => s.className === state.adminClassFilter);
    }
    if (state.adminSearchQuery.trim()) {
      const q = state.adminSearchQuery.trim().toLowerCase();
      filtered = filtered.filter(
        s => s.fullName.toLowerCase().includes(q) || s.username.toLowerCase().includes(q) || s.className.toLowerCase().includes(q)
      );
    }

    const editingSt = state.editingStudentId ? db.students.find(s => s.id === state.editingStudentId) : null;

    return `
      <div class="space-y-6">
        <!-- Thanh công cụ Quản lý & Nạp Học sinh -->
        <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <span class="text-xs font-bold text-indigo-600 uppercase">Quản lý Danh sách 4 Khối (6, 7, 8, 9)</span>
              <h2 class="text-xl font-extrabold text-slate-900">
                👨‍🎓 Quản lý Tài khoản Học sinh (Tổng: ${db.students.length} HS / ${db.classes.length} Lớp)
              </h2>
            </div>
            <div class="flex flex-wrap gap-2">
              <button id="btn-open-bulk-import" class="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow">
                📥 Nạp Danh sách Học sinh (Họ tên, Ngày sinh, Lớp) ➔ Tự sinh TK, MK 123
              </button>
              <button id="btn-export-accounts-csv" class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold">
                📄 Xuất Danh sách Tài khoản (.CSV Excel)
              </button>
            </div>
          </div>

          <!-- Form Thêm mới / Sửa Học sinh -->
          <div class="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div class="md:col-span-2">
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">
                ${editingSt ? "✏️ Sửa Họ và tên Học sinh" : "➕ Thêm Học sinh mới (Họ và tên)"}
              </label>
              <input id="form-st-name" type="text" value="${editingSt ? escapeHtml(editingSt.fullName) : ""}"
                placeholder="VD: Nguyễn Văn Minh"
                class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Ngày sinh</label>
              <input id="form-st-dob" type="text" value="${editingSt ? escapeHtml(editingSt.dob) : ""}"
                placeholder="DD/MM/YYYY"
                class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm bg-white" />
            </div>
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Lớp (6A10..9A16)</label>
              <input id="form-st-class" type="text" value="${editingSt ? escapeHtml(editingSt.className) : "7A11"}"
                placeholder="VD: 7A11"
                class="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm font-bold uppercase bg-white" />
            </div>
            <div class="flex gap-2">
              <button id="btn-save-student" class="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs">
                ${editingSt ? "💾 Lưu cập nhật" : "➕ Thêm (Tự sinh TK, MK 123)"}
              </button>
              ${
                editingSt
                  ? `<button id="btn-cancel-edit" class="px-3 py-2 rounded-lg bg-slate-200 text-slate-700 font-bold text-xs">Hủy</button>`
                  : ""
              }
            </div>
          </div>

          <!-- Hộp thoại Nạp hàng loạt (Bulk Import) -->
          ${
            state.showBulkImportModal
              ? `
            <div class="p-5 rounded-2xl bg-emerald-50 border-2 border-emerald-500 space-y-3">
              <div class="flex justify-between items-center">
                <h3 class="font-extrabold text-sm text-emerald-950 uppercase">
                  📥 Nạp Danh sách Học sinh Hàng loạt (Họ tên, Ngày sinh, Lớp)
                </h3>
                <button id="btn-close-bulk" class="text-xs font-bold text-slate-500 hover:text-slate-800">✖ Đóng</button>
              </div>
              <p class="text-xs text-emerald-900">
                Dán trực tiếp từ Excel hoặc CSV (mỗi dòng 1 học sinh theo cấu trúc: <code>Họ tên, Ngày sinh, Lớp</code>). Hệ thống sẽ <b>tự động sinh Tài khoản duy nhất</b> và gán <b>Mật khẩu mặc định 123</b>.
              </p>
              <textarea id="bulk-import-textarea" rows="6"
                placeholder="Lê Thị Bảo An,19/08/2014,7A11&#10;Lê Danh Tuấn Anh,08/10/2014,7A11"
                class="w-full p-3 rounded-xl border border-emerald-300 font-mono text-xs bg-white"></textarea>
              <div class="flex flex-wrap items-center justify-between gap-3">
                <input id="bulk-csv-file" type="file" accept=".csv,.txt" class="text-xs" />
                <div class="flex gap-2">
                  <button id="btn-run-bulk-append" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
                    ✅ Nạp Bổ sung vào Danh sách
                  </button>
                  <button id="btn-run-bulk-replace" class="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold">
                    🔄 Thay thế Toàn bộ Danh sách bằng Dữ liệu trên
                  </button>
                </div>
              </div>
            </div>
          `
              : ""
          }

          <!-- Bộ lọc Khối / Lớp / Tìm kiếm -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select id="filter-st-grade" class="px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold">
              <option value="ALL">Tất cả 4 Khối (${db.students.length} HS)</option>
              ${[6, 7, 8, 9]
                .map(
                  g => `<option value="${g}" ${String(state.adminGradeFilter) === String(g) ? "selected" : ""}>
                    Khối ${g} (${db.students.filter(s => Number(s.grade) === g).length} HS)
                  </option>`
                )
                .join("")}
            </select>

            <select id="filter-st-class" class="px-3 py-2 rounded-xl border border-slate-300 text-sm font-bold">
              <option value="ALL">Tất cả các Lớp (${db.classes.length} Lớp)</option>
              ${db.classes
                .filter(c => state.adminGradeFilter === "ALL" || Number(c.grade) === Number(state.adminGradeFilter))
                .map(
                  c => `<option value="${c.id}" ${state.adminClassFilter === c.id ? "selected" : ""}>
                    ${c.name} (${c.studentCount} HS)
                  </option>`
                )
                .join("")}
            </select>

            <input id="filter-st-search" type="text" value="${escapeHtml(state.adminSearchQuery)}"
              placeholder="🔍 Tìm theo Họ tên, Tài khoản hoặc Lớp..."
              class="px-3.5 py-2 rounded-xl border border-slate-300 text-sm" />
          </div>

          <!-- Bảng Danh sách Học sinh -->
          <div class="overflow-x-auto max-h-[520px] custom-scrollbar border border-slate-200 rounded-xl">
            <table class="w-full text-left border-collapse text-xs">
              <thead class="bg-slate-100 text-slate-700 sticky top-0">
                <tr>
                  <th class="p-3 border-b">STT</th>
                  <th class="p-3 border-b">Khối / Lớp</th>
                  <th class="p-3 border-b">Họ và tên Học sinh</th>
                  <th class="p-3 border-b">Ngày sinh</th>
                  <th class="p-3 border-b">Tài khoản (Tự sinh)</th>
                  <th class="p-3 border-b">Mật khẩu</th>
                  <th class="p-3 border-b">XP / Level</th>
                  <th class="p-3 border-b text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-200">
                ${filtered
                  .slice(0, 250)
                  .map(
                    (s, idx) => `
                  <tr class="hover:bg-slate-50">
                    <td class="p-3 font-bold text-slate-500">${idx + 1}</td>
                    <td class="p-3"><span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">${escapeHtml(s.className)}</span></td>
                    <td class="p-3 font-bold text-slate-900">${escapeHtml(s.fullName)}</td>
                    <td class="p-3 text-slate-600">${escapeHtml(s.dob)}</td>
                    <td class="p-3 font-mono font-bold text-indigo-700">${escapeHtml(s.username)}</td>
                    <td class="p-3 font-mono text-slate-600">${escapeHtml(s.password || "123")}</td>
                    <td class="p-3 font-bold text-purple-700">${s.xp || 0} XP (Lv.${s.level || 1})</td>
                    <td class="p-3 text-right space-x-1">
                      <button data-edit-st="${s.id}" class="edit-st-btn px-2.5 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-bold">Sửa</button>
                      <button data-del-st="${s.id}" class="del-st-btn px-2.5 py-1 rounded bg-red-100 hover:bg-red-200 text-red-800 font-bold">Xóa</button>
                    </td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
          <div class="text-xs text-slate-500">
            Đang hiển thị ${Math.min(filtered.length, 250)} / ${filtered.length} học sinh khớp bộ lọc.
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // 3.3. BÁO CÁO TỔNG HỢP KẾT QUẢ (THEO KHỐI, LỚP, CÁ NHÂN)
  // ----------------------------------------------------------------------------
  function renderAdminReports() {
    const db = Store.loadStudentsDB();
    let list = db.students;
    if (state.adminGradeFilter !== "ALL") {
      list = list.filter(s => Number(s.grade) === Number(state.adminGradeFilter));
    }
    if (state.adminClassFilter !== "ALL") {
      list = list.filter(s => s.className === state.adminClassFilter);
    }

    return `
      <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
          <div>
            <span class="text-xs font-bold text-indigo-600 uppercase">Thống kê & Nghiệm thu</span>
            <h2 class="text-xl font-extrabold text-slate-900">📊 Báo cáo Tổng hợp Kết quả Học tập & XP</h2>
          </div>
          <div class="flex gap-2">
            <select id="rep-grade-filter" class="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold">
              <option value="ALL">Tất cả 4 Khối</option>
              ${[6, 7, 8, 9].map(g => `<option value="${g}" ${String(state.adminGradeFilter) === String(g) ? "selected" : ""}>Khối ${g}</option>`).join("")}
            </select>
            <select id="rep-class-filter" class="px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold">
              <option value="ALL">Tất cả các Lớp</option>
              ${db.classes.map(c => `<option value="${c.id}" ${state.adminClassFilter === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
            </select>
            <button id="btn-export-report-csv" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold">
              📥 Xuất Bảng Điểm Tổng Hợp (.CSV Excel)
            </button>
          </div>
        </div>

        <div class="overflow-x-auto max-h-[540px] custom-scrollbar border border-slate-200 rounded-xl">
          <table class="w-full text-left border-collapse text-xs">
            <thead class="bg-slate-100 text-slate-700 sticky top-0">
              <tr>
                <th class="p-3 border-b">Lớp</th>
                <th class="p-3 border-b">Họ và tên</th>
                <th class="p-3 border-b">Tài khoản</th>
                <th class="p-3 border-b">Số tiết đã học</th>
                <th class="p-3 border-b">TB Bài học</th>
                <th class="p-3 border-b">TB Kiểm tra Định kỳ</th>
                <th class="p-3 border-b">Tổng XP</th>
                <th class="p-3 border-b">Hạng Lớp / Khối</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${list
                .slice(0, 200)
                .map(s => {
                  const st = Store.getStudentAnalytics(s.id);
                  return `
                    <tr class="hover:bg-slate-50">
                      <td class="p-3 font-bold">${escapeHtml(s.className)}</td>
                      <td class="p-3 font-bold text-slate-900">${escapeHtml(s.fullName)}</td>
                      <td class="p-3 font-mono text-indigo-700">${escapeHtml(s.username)}</td>
                      <td class="p-3">${st.completedCount} / 29</td>
                      <td class="p-3 font-bold text-blue-700">${st.lessonAvg}</td>
                      <td class="p-3 font-bold text-emerald-700">${st.examAvg}</td>
                      <td class="p-3 font-extrabold text-purple-700">${s.xp || 0} XP</td>
                      <td class="p-3 font-semibold">#${st.classRank} Lớp • #${st.gradeRank} Khối ${s.grade}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // 3.4. CẤU HÌNH KẾT NỐI GOOGLE DRIVE (H:\My Drive\Giảng dạy)
  // ----------------------------------------------------------------------------
  function renderAdminDriveConfig() {
    const cfg = Store.getGasConfig();
    return `
      <div class="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div>
          <span class="text-xs font-bold text-emerald-600 uppercase">Lưu trữ Sản phẩm Thực hành Học sinh</span>
          <h2 class="text-xl font-extrabold text-slate-900">⚙️ Cấu hình Cầu nối Google Drive (H:\\My Drive\\Giảng dạy)</h2>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">
              Đường dẫn Thư mục Google Drive trên Máy Giáo viên:
            </label>
            <input id="cfg-drive-local" type="text" value="${escapeHtml(cfg.driveLocalPath)}"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm bg-slate-50" />
          </div>
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1">
              ID Thư mục Google Drive Đích (Tùy chọn, mặc định lưu vào Giảng dạy/NOP_BAI_THUC_HANH):
            </label>
            <input id="cfg-drive-folder-id" type="text" value="${escapeHtml(cfg.driveFolderId)}"
              placeholder="Để trống sẽ tự tạo thư mục NOP_BAI_THUC_HANH trong Giảng dạy"
              class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm" />
          </div>
        </div>

        <div>
          <label class="block text-xs font-bold text-slate-700 uppercase mb-1">
            URL Web App Google Apps Script (Nhận file .docx, .xlsx, .pptx từ máy học sinh đẩy vào Google Drive):
          </label>
          <input id="cfg-gas-url" type="text" value="${escapeHtml(cfg.gasWebAppUrl)}"
            placeholder="https://script.google.com/macros/s/.../exec"
            class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-mono text-sm" />
        </div>

        <button id="btn-save-gas-config" class="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow">
          💾 Lưu Cấu hình Kết nối Google Drive
        </button>
      </div>
    `;
  }

  function bindAdminEvents() {
    const btnLogout = document.getElementById("btn-admin-logout");
    if (btnLogout) {
      btnLogout.onclick = () => {
        sessionStorage.removeItem(Store.STORAGE_KEYS.SESSION_USER);
        state.currentUser = null;
        renderApp();
      };
    }

    document.querySelectorAll("[data-ad-tab]").forEach(btn => {
      btn.onclick = () => {
        state.adminTab = btn.getAttribute("data-ad-tab");
        renderApp();
      };
    });

    // Điều khiển Phòng Live
    const btnLock = document.getElementById("btn-toggle-screen-lock");
    if (btnLock) {
      btnLock.onclick = () => {
        const live = Store.loadLiveState();
        live.screenLocked = !live.screenLocked;
        Store.saveLiveState(live);
        showToast(live.screenLocked ? "🔒 Đã KHÓA toàn bộ màn hình học sinh!" : "🔓 Đã MỞ KHÓA màn hình học sinh!");
      };
    }

    const gradeSel = document.getElementById("admin-live-grade");
    if (gradeSel) {
      gradeSel.onchange = (e) => {
        const live = Store.loadLiveState();
        live.grade = Number(e.target.value);
        const db = Store.loadStudentsDB();
        const firstClass = db.classes.find(c => Number(c.grade) === live.grade);
        if (firstClass) live.className = firstClass.id;
        Store.saveLiveState(live);
        renderApp();
      };
    }

    const classSel = document.getElementById("admin-live-class");
    if (classSel) {
      classSel.onchange = (e) => {
        const live = Store.loadLiveState();
        live.className = e.target.value;
        Store.saveLiveState(live);
        renderApp();
      };
    }

    const periodSel = document.getElementById("admin-live-period");
    if (periodSel) {
      periodSel.onchange = (e) => {
        const live = Store.loadLiveState();
        live.period = Number(e.target.value);
        Store.saveLiveState(live);
        showToast(`Đã chuyển Phòng Live sang Khối ${live.grade} - Tiết ${live.period}!`);
      };
    }

    document.querySelectorAll(".set-act-btn").forEach(btn => {
      btn.onclick = () => {
        const act = Number(btn.getAttribute("data-set-activity"));
        const live = Store.loadLiveState();
        live.currentActivity = act;
        Store.saveLiveState(live);
        showToast(`Đã phát Hoạt động ${act} xuống toàn bộ màn hình Học sinh!`);
      };
    });

    const btnNotebook = document.getElementById("btn-toggle-notebook");
    if (btnNotebook) {
      btnNotebook.onclick = () => {
        const live = Store.loadLiveState();
        live.currentActivity = 1;
        live.showNotebookSlide = !live.showNotebookSlide;
        Store.saveLiveState(live);
        showToast(live.showNotebookSlide ? "📒 Đã bật Slide Kiến thức Ghi vở trên máy học sinh!" : "Đã ẩn Slide Ghi vở!");
      };
    }

    // Chấm điểm sản phẩm thực hành Drive
    document.querySelectorAll(".grade-sub-btn").forEach(btn => {
      btn.onclick = () => {
        const subId = btn.getAttribute("data-grade-sub");
        const scoreVal = Number(document.getElementById(`grade-score-${subId}`)?.value || 0);
        const commentVal = (document.getElementById(`grade-comment-${subId}`)?.value || "").trim();

        const subs = Store.getDriveSubs();
        const target = subs.find(s => s.id === subId);
        if (target) {
          target.teacherScore = scoreVal;
          target.teacherComment = commentVal;
          Store.saveDriveSubs(subs);
          Store.creditGroupScoreAndXP(target.memberIds, target.lessonId, "act3", scoreVal, Math.round(scoreVal * 20));
          showToast(`Đã chấm ${scoreVal}/10 điểm cho nhóm: ${target.memberNames.join(" + ")}!`);
        }
      };
    });

    // Quản lý học sinh (Thêm, Sửa, Xóa, Bulk Import)
    const fGrade = document.getElementById("filter-st-grade");
    if (fGrade) {
      fGrade.onchange = (e) => {
        state.adminGradeFilter = e.target.value;
        state.adminClassFilter = "ALL";
        renderApp();
      };
    }
    const fClass = document.getElementById("filter-st-class");
    if (fClass) {
      fClass.onchange = (e) => {
        state.adminClassFilter = e.target.value;
        renderApp();
      };
    }
    const fSearch = document.getElementById("filter-st-search");
    if (fSearch) {
      fSearch.oninput = (e) => {
        state.adminSearchQuery = e.target.value;
        renderApp();
      };
    }

    const btnSaveSt = document.getElementById("btn-save-student");
    if (btnSaveSt) {
      btnSaveSt.onclick = () => {
        const fullName = (document.getElementById("form-st-name")?.value || "").trim();
        const dob = (document.getElementById("form-st-dob")?.value || "").trim() || "01/01/2014";
        const className = (document.getElementById("form-st-class")?.value || "").trim().toUpperCase();
        if (!fullName || !className) {
          showToast("Vui lòng nhập đầy đủ Họ tên và Lớp!", "error");
          return;
        }
        const grade = Number(className[0]) || 7;
        const db = Store.loadStudentsDB();

        if (state.editingStudentId) {
          const st = db.students.find(s => s.id === state.editingStudentId);
          if (st) {
            st.fullName = fullName;
            st.dob = dob;
            st.className = className;
            st.grade = grade;
          }
          state.editingStudentId = null;
          Store.saveStudentsDB(db);
          showToast("Đã cập nhật thông tin học sinh!");
        } else {
          const existingSet = new Set(db.students.map(s => s.username));
          const username = Store.generateStudentUsername(fullName, className, existingSet);
          const classCount = db.students.filter(s => s.className === className).length + 1;
          db.students.push({
            id: `HS_${className}_${Date.now()}`,
            stt: classCount,
            username,
            password: "123",
            fullName,
            dob,
            className,
            grade,
            seatNumber: classCount,
            defaultGroup: `Nhóm ${String(Math.ceil(classCount / 2)).padStart(2, "0")}`,
            xp: 0,
            level: 1,
            completedLessons: [],
            lessonScores: {},
            examScores: {}
          });
          Store.saveStudentsDB(db);
          showToast(`Đã thêm "${fullName}" (${className}) -> Tài khoản tự sinh: ${username} | MK: 123`);
        }
      };
    }

    const btnCancelEdit = document.getElementById("btn-cancel-edit");
    if (btnCancelEdit) {
      btnCancelEdit.onclick = () => {
        state.editingStudentId = null;
        renderApp();
      };
    }

    document.querySelectorAll(".edit-st-btn").forEach(btn => {
      btn.onclick = () => {
        state.editingStudentId = btn.getAttribute("data-edit-st");
        renderApp();
      };
    });

    document.querySelectorAll(".del-st-btn").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-del-st");
        const db = Store.loadStudentsDB();
        db.students = db.students.filter(s => s.id !== id);
        Store.saveStudentsDB(db);
        showToast("Đã xóa tài khoản học sinh!");
      };
    });

    const btnOpenBulk = document.getElementById("btn-open-bulk-import");
    if (btnOpenBulk) {
      btnOpenBulk.onclick = () => {
        state.showBulkImportModal = !state.showBulkImportModal;
        renderApp();
      };
    }
    const btnCloseBulk = document.getElementById("btn-close-bulk");
    if (btnCloseBulk) {
      btnCloseBulk.onclick = () => {
        state.showBulkImportModal = false;
        renderApp();
      };
    }

    const bulkFileInput = document.getElementById("bulk-csv-file");
    if (bulkFileInput) {
      bulkFileInput.onchange = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          const ta = document.getElementById("bulk-import-textarea");
          if (ta) ta.value = String(r.result || "");
        };
        r.readAsText(f, "utf-8");
      };
    }

    function executeBulkImport(replaceAll) {
      const rawText = (document.getElementById("bulk-import-textarea")?.value || "").trim();
      if (!rawText) {
        showToast("Vui lòng dán danh sách (Họ tên, Ngày sinh, Lớp) hoặc chọn tệp CSV!", "error");
        return;
      }
      const db = Store.loadStudentsDB();
      if (replaceAll) db.students = [];
      const existingSet = new Set(db.students.map(s => s.username));

      const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      let added = 0;
      lines.forEach(line => {
        const parts = line.split(/[,\t;]/).map(p => p.trim());
        if (parts.length < 3) return;
        const [fullName, dob, classNameRaw] = parts;
        if (fullName.toLowerCase().includes("họ tên") || fullName.toLowerCase().includes("ho ten")) return;
        const className = classNameRaw.toUpperCase();
        const grade = Number(className[0]) || 7;
        const username = Store.generateStudentUsername(fullName, className, existingSet);
        const stt = db.students.filter(s => s.className === className).length + 1;

        db.students.push({
          id: `HS_${className}_${stt}_${Date.now()}_${added}`,
          stt,
          username,
          password: "123",
          fullName,
          dob,
          className,
          grade,
          seatNumber: stt,
          defaultGroup: `Nhóm ${String(Math.ceil(stt / 2)).padStart(2, "0")}`,
          xp: 0,
          level: 1,
          completedLessons: [],
          lessonScores: {},
          examScores: {}
        });
        added++;
      });

      Store.saveStudentsDB(db);
      state.showBulkImportModal = false;
      showToast(`Đã nạp thành công ${added} học sinh! (Tự sinh Tài khoản, Mật khẩu chung: 123)`);
    }

    const btnBulkAppend = document.getElementById("btn-run-bulk-append");
    if (btnBulkAppend) btnBulkAppend.onclick = () => executeBulkImport(false);
    const btnBulkReplace = document.getElementById("btn-run-bulk-replace");
    if (btnBulkReplace) btnBulkReplace.onclick = () => executeBulkImport(true);

    // Xuất CSV danh sách tài khoản
    const btnExportAcc = document.getElementById("btn-export-accounts-csv");
    if (btnExportAcc) {
      btnExportAcc.onclick = () => {
        const db = Store.loadStudentsDB();
        const rows = [["STT", "Khối", "Lớp", "Họ và tên", "Ngày sinh", "Tài khoản (Username)", "Mật khẩu", "XP"]];
        db.students.forEach((s, i) => {
          rows.push([i + 1, s.grade, s.className, s.fullName, s.dob, s.username, s.password || "123", s.xp || 0]);
        });
        const csvContent = "\uFEFF" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "Danh_Sach_Tai_Khoan_Hoc_Sinh_THCS_Mao_Dien.csv";
        a.click();
      };
    }

    // Báo cáo
    const repGrade = document.getElementById("rep-grade-filter");
    if (repGrade) repGrade.onchange = (e) => { state.adminGradeFilter = e.target.value; renderApp(); };
    const repClass = document.getElementById("rep-class-filter");
    if (repClass) repClass.onchange = (e) => { state.adminClassFilter = e.target.value; renderApp(); };

    const btnExportRep = document.getElementById("btn-export-report-csv");
    if (btnExportRep) {
      btnExportRep.onclick = () => {
        const db = Store.loadStudentsDB();
        const rows = [["Lớp", "Họ và tên", "Tài khoản", "Số tiết đã học", "TB Bài học", "TB Định kỳ", "Tổng XP", "Hạng Lớp", "Hạng Khối"]];
        db.students.forEach(s => {
          const st = Store.getStudentAnalytics(s.id);
          rows.push([s.className, s.fullName, s.username, st.completedCount, st.lessonAvg, st.examAvg, s.xp || 0, st.classRank, st.gradeRank]);
        });
        const csvContent = "\uFEFF" + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "Bao_Cao_Ket_Qua_Tin_Hoc_THCS_Mao_Dien.csv";
        a.click();
      };
    }

    // Lưu cấu hình Google Drive
    const btnSaveCfg = document.getElementById("btn-save-gas-config");
    if (btnSaveCfg) {
      btnSaveCfg.onclick = () => {
        const driveLocalPath = (document.getElementById("cfg-drive-local")?.value || "").trim();
        const driveFolderId = (document.getElementById("cfg-drive-folder-id")?.value || "").trim();
        const gasWebAppUrl = (document.getElementById("cfg-gas-url")?.value || "").trim();
        Store.saveGasConfig({ driveLocalPath, driveFolderId, gasWebAppUrl });
        showToast("Đã lưu cấu hình kết nối Google Drive!");
      };
    }
  }

  document.addEventListener("DOMContentLoaded", renderApp);
})();
