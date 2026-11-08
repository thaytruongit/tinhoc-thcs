/**
 * STORE & REALTIME ENGINE (js/store.js)
 * Quản lý toàn bộ trạng thái:
 * - 670 Học sinh (15 lớp Khối 6, 7, 8, 9), Thêm/Sửa/Xóa & Nạp hàng loạt (Họ tên, Ngày sinh, Lớp) -> Tự sinh TK, MK 123
 * - Admin (Tài khoản: admin, Mật khẩu: 666)
 * - Động cơ Điều phối Phòng Live (Chuyển 3 hoạt động, Bật/Tắt Slide Ghi vở, Khóa/Mở màn hình, Ghép cặp nhóm)
 * - Cổng Học tập tại nhà (Tìm hiểu bài trước, Ôn luyện 29 tiết, Kiểm tra định kỳ, So sánh Cá nhân vs Lớp & Khối)
 * - Cầu nối nộp file Thực hành (.docx, .xlsx, .pptx) tự chạy về Google Drive của Thầy (H:\My Drive\Giảng dạy)
 */

(function () {
  const STORAGE_KEYS = {
    STUDENTS_DB: "THCS_MD_STUDENTS_DB_V2",
    LIVE_STATE: "THCS_MD_LIVE_STATE_V2",
    GROUPS_LIST: "THCS_MD_GROUPS_V2",
    WORKSHEET_SUBS: "THCS_MD_WORKSHEET_SUBS_V2",
    MINIGAME_SUBS: "THCS_MD_MINIGAME_SUBS_V2",
    DRIVE_SUBS: "THCS_MD_DRIVE_SUBS_V2",
    HOME_PROGRESS: "THCS_MD_HOME_PROGRESS_V2",
    GAS_CONFIG: "THCS_MD_GAS_CONFIG_V2",
    SESSION_USER: "THCS_MD_SESSION_USER_V2"
  };

  const liveChannel = typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("THCS_MAO_DIEN_LIVE_SYNC")
    : null;

  function removeVietnameseAccents(str) {
    if (!str) return "";
    return str
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function generateStudentUsername(fullName, className, existingUsernamesSet) {
    const cleanClass = String(className || "6A10").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
    const cleanName = removeVietnameseAccents(String(fullName || "").trim()).toLowerCase();
    const parts = cleanName.split(/\s+/).map(p => p.replace(/[^a-z0-9]/g, "")).filter(Boolean);
    let base = cleanClass + "_hs";
    if (parts.length > 0) {
      const given = parts[parts.length - 1];
      const initials = parts.slice(0, -1).map(p => p[0]).join("");
      base = `${cleanClass}_${given}${initials}`;
    }
    let candidate = base;
    let counter = 2;
    while (existingUsernamesSet.has(candidate)) {
      candidate = `${base}${counter}`;
      counter++;
    }
    existingUsernamesSet.add(candidate);
    return candidate;
  }

  function loadStudentsDB() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.STUDENTS_DB);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.students) && parsed.students.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn("Load students DB fallback to initial:", e);
    }
    const initial = window.INITIAL_STUDENTS_DB || { adminAccount: { username: "admin", password: "666" }, classes: [], students: [] };
    localStorage.setItem(STORAGE_KEYS.STUDENTS_DB, JSON.stringify(initial));
    return JSON.parse(JSON.stringify(initial));
  }

  function saveStudentsDB(db) {
    // Recompute class counts
    const classMap = {};
    db.students.forEach(s => {
      const cid = String(s.className || "").toUpperCase();
      const grade = Number(s.grade) || Number(cid[0]) || 6;
      if (!classMap[cid]) {
        classMap[cid] = { id: cid, name: `Lớp ${cid}`, grade: grade, studentCount: 0 };
      }
      classMap[cid].studentCount++;
    });
    db.classes = Object.values(classMap).sort((a, b) => a.grade - b.grade || a.id.localeCompare(b.id));
    localStorage.setItem(STORAGE_KEYS.STUDENTS_DB, JSON.stringify(db));
    broadcastEvent("DB_UPDATED", { timestamp: Date.now() });
  }

  function getDefaultLiveState() {
    return {
      isLiveOpen: true,
      roomCode: "LIVE-MD",
      grade: 7,
      className: "7A11",
      period: 12, // Mặc định mở sẵn 1 tiết để GV/HS thấy ngay, GV đổi bất kỳ tiết 1..29
      currentActivity: 1, // 1: Khám phá (Phiếu nhóm + Ghi vở), 2: Luyện tập (Minigame), 3: Vận dụng/Thực hành (Nộp file Drive)
      showNotebookSlide: false,
      screenLocked: false,
      lockMessage: "🔒 MÀN HÌNH ĐANG TẠM KHÓA — Các em hãy hướng mắt lên màn hình máy chiếu và lắng nghe Thầy hướng dẫn!",
      updatedAt: Date.now()
    };
  }

  function loadLiveState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.LIVE_STATE);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    const def = getDefaultLiveState();
    localStorage.setItem(STORAGE_KEYS.LIVE_STATE, JSON.stringify(def));
    return def;
  }

  function saveLiveState(newState) {
    newState.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEYS.LIVE_STATE, JSON.stringify(newState));
    broadcastEvent("LIVE_STATE_CHANGED", newState);
  }

  function loadJSON(key, defaultVal) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return defaultVal;
  }

  function saveJSON(key, val, eventName) {
    localStorage.setItem(key, JSON.stringify(val));
    if (eventName) broadcastEvent(eventName, { timestamp: Date.now() });
  }

  function broadcastEvent(type, payload) {
    if (liveChannel) {
      try {
        liveChannel.postMessage({ type, payload });
      } catch (e) {}
    }
  }

  // Cộng điểm bài học và XP đồng thời cho tất cả học sinh trong nhóm
  function creditGroupScoreAndXP(memberIds, lessonId, activityKey, score10, xpEarned) {
    const db = loadStudentsDB();
    const validIds = Array.isArray(memberIds) ? memberIds : [memberIds];
    db.students.forEach(st => {
      if (validIds.includes(st.id)) {
        if (!st.lessonScores) st.lessonScores = {};
        if (!st.lessonScores[lessonId]) {
          st.lessonScores[lessonId] = { act1: null, act2: null, act3: null, final: 0 };
        }
        const rec = st.lessonScores[lessonId];
        const prevActScore = rec[activityKey] || 0;
        rec[activityKey] = Math.max(prevActScore, Number(score10.toFixed(2)));

        // Tính điểm trung bình bài học từ các hoạt động đã tham gia
        const scores = [rec.act1, rec.act2, rec.act3].filter(v => typeof v === "number" && v !== null);
        if (scores.length > 0) {
          rec.final = Number((scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2));
        }

        if (!Array.isArray(st.completedLessons)) st.completedLessons = [];
        if (!st.completedLessons.includes(lessonId)) {
          st.completedLessons.push(lessonId);
        }

        st.xp = (Number(st.xp) || 0) + Number(xpEarned || 0);
        st.level = Math.floor(st.xp / 500) + 1;
      }
    });
    saveStudentsDB(db);
  }

  // Tính toán chỉ số cá nhân & so sánh với trung bình Lớp và Khối
  function getStudentAnalytics(studentId) {
    const db = loadStudentsDB();
    const student = db.students.find(s => s.id === studentId);
    if (!student) return null;

    function calcAvgLessonScore(s) {
      const vals = Object.values(s.lessonScores || {}).map(x => Number(x.final || 0)).filter(v => v > 0);
      if (vals.length === 0) return 0;
      return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
    }

    function calcAvgExamScore(s) {
      const vals = Object.values(s.examScores || {}).map(x => Number(x.score || 0));
      if (vals.length === 0) return 0;
      return Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2));
    }

    function calcOverallScore(s) {
      const lAvg = calcAvgLessonScore(s);
      const eAvg = calcAvgExamScore(s);
      if (lAvg > 0 && eAvg > 0) return Number(((lAvg + eAvg) / 2).toFixed(2));
      return lAvg || eAvg || 0;
    }

    const classPeers = db.students.filter(s => s.className === student.className);
    const gradePeers = db.students.filter(s => Number(s.grade) === Number(student.grade));

    const studentAvg = calcOverallScore(student);
    const classScores = classPeers.map(calcOverallScore);
    const gradeScores = gradePeers.map(calcOverallScore);

    const activeClassScores = classScores.filter(v => v > 0);
    const activeGradeScores = gradeScores.filter(v => v > 0);

    const classAvgScore = activeClassScores.length > 0
      ? Number((activeClassScores.reduce((a, b) => a + b, 0) / activeClassScores.length).toFixed(2))
      : 0;
    const gradeAvgScore = activeGradeScores.length > 0
      ? Number((activeGradeScores.reduce((a, b) => a + b, 0) / activeGradeScores.length).toFixed(2))
      : 0;

    const classAvgXP = classPeers.length > 0
      ? Math.round(classPeers.reduce((a, b) => a + (Number(b.xp) || 0), 0) / classPeers.length)
      : 0;
    const gradeAvgXP = gradePeers.length > 0
      ? Math.round(gradePeers.reduce((a, b) => a + (Number(b.xp) || 0), 0) / gradePeers.length)
      : 0;

    const sortedClassByXP = [...classPeers].sort((a, b) => (Number(b.xp) || 0) - (Number(a.xp) || 0) || calcOverallScore(b) - calcOverallScore(a));
    const sortedGradeByXP = [...gradePeers].sort((a, b) => (Number(b.xp) || 0) - (Number(a.xp) || 0) || calcOverallScore(b) - calcOverallScore(a));

    const classRank = sortedClassByXP.findIndex(s => s.id === student.id) + 1;
    const gradeRank = sortedGradeByXP.findIndex(s => s.id === student.id) + 1;

    return {
      student,
      lessonAvg: calcAvgLessonScore(student),
      examAvg: calcAvgExamScore(student),
      overallAvg: studentAvg,
      completedCount: (student.completedLessons || []).length,
      classAvgScore,
      gradeAvgScore,
      classAvgXP,
      gradeAvgXP,
      classRank,
      classTotal: classPeers.length,
      gradeRank,
      gradeTotal: gradePeers.length
    };
  }

  window.AppStore = {
    STORAGE_KEYS,
    liveChannel,
    generateStudentUsername,
    loadStudentsDB,
    saveStudentsDB,
    loadLiveState,
    saveLiveState,
    getGroups: () => loadJSON(STORAGE_KEYS.GROUPS_LIST, []),
    saveGroups: (list) => saveJSON(STORAGE_KEYS.GROUPS_LIST, list, "GROUPS_UPDATED"),
    getWorksheetSubs: () => loadJSON(STORAGE_KEYS.WORKSHEET_SUBS, []),
    saveWorksheetSubs: (list) => saveJSON(STORAGE_KEYS.WORKSHEET_SUBS, list, "SUBS_UPDATED"),
    getMinigameSubs: () => loadJSON(STORAGE_KEYS.MINIGAME_SUBS, []),
    saveMinigameSubs: (list) => saveJSON(STORAGE_KEYS.MINIGAME_SUBS, list, "SUBS_UPDATED"),
    getDriveSubs: () => loadJSON(STORAGE_KEYS.DRIVE_SUBS, []),
    saveDriveSubs: (list) => saveJSON(STORAGE_KEYS.DRIVE_SUBS, list, "DRIVE_SUBS_UPDATED"),
    getGasConfig: () => loadJSON(STORAGE_KEYS.GAS_CONFIG, {
      gasWebAppUrl: "",
      driveFolderId: "",
      driveLocalPath: "H:\\My Drive\\Giảng dạy\\NOP_BAI_THUC_HANH"
    }),
    saveGasConfig: (cfg) => saveJSON(STORAGE_KEYS.GAS_CONFIG, cfg, "CONFIG_UPDATED"),
    creditGroupScoreAndXP,
    getStudentAnalytics
  };
})();
