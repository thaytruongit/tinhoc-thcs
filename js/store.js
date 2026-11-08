/**
 * STORE & HYBRID REALTIME ENGINE (js/store.js)
 * Tích hợp Kênh truyền Thời gian thực Đám mây (MQTT over WSS) + Kênh Nội bộ (BroadcastChannel/localStorage)
 * Hoạt động hoàn hảo giữa các Trình duyệt khác nhau (Google Chrome vs Microsoft Edge)
 * và giữa 45 máy tính độc lập trong phòng máy trường học (LAN/Internet).
 */

(function () {
  const STORAGE_KEYS = {
    STUDENTS_DB: "THCS_MD_STUDENTS_DB_V2",
    LIVE_STATE: "THCS_MD_LIVE_STATE_V2",
    GROUPS_LIST: "THCS_MD_GROUPS_V2",
    WORKSHEET_SUBS: "THCS_MD_WORKSHEET_SUBS_V2",
    MINIGAME_SUBS: "THCS_MD_MINIGAME_SUBS_V2",
    DRIVE_SUBS: "THCS_MD_DRIVE_SUBS_V2",
    GAS_CONFIG: "THCS_MD_GAS_CONFIG_V2",
    SESSION_USER: "THCS_MD_SESSION_USER_V2"
  };

  // Kênh cục bộ trong cùng 1 trình duyệt
  const localBroadcast = typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("THCS_MAO_DIEN_LOCAL_SYNC")
    : null;

  // Cấu hình Kênh Đám mây MQTT WSS (Miễn phí, chuẩn bảo mật WSS chạy trên mọi mạng LAN trường học)
  const MQTT_BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt"
  ];
  const MQTT_TOPIC_PREFIX = "thcs-maodien/tinhoc-thcs/";
  const LIVE_ROOM_TOPIC = MQTT_TOPIC_PREFIX + "live-room-main";
  const LIVE_EVENT_TOPIC = MQTT_TOPIC_PREFIX + "live-events";

  let mqttClient = null;
  let isMqttConnected = false;

  function initMqttCloudSync() {
    if (typeof mqtt === "undefined") {
      console.warn("MQTT library not loaded, falling back to local broadcast only.");
      return;
    }

    const clientId = "client_" + Math.random().toString(16).substring(2, 10);
    const brokerUrl = MQTT_BROKERS[0];

    try {
      mqttClient = mqtt.connect(brokerUrl, {
        clientId: clientId,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 2500,
        keepalive: 30
      });

      mqttClient.on("connect", () => {
        isMqttConnected = true;
        console.log("⚡ Realtime Cloud WSS Connected:", brokerUrl);
        // Lắng nghe lệnh từ Giáo viên và sự kiện từ toàn bộ máy Học sinh
        mqttClient.subscribe([LIVE_ROOM_TOPIC, LIVE_EVENT_TOPIC], { qos: 1 });

        // Học sinh vừa mở trang sẽ phát tín hiệu xin đồng bộ trạng thái mới nhất từ máy Giáo viên
        const user = getSessionUser();
        if (user && user.role === "student") {
          publishMqtt(LIVE_EVENT_TOPIC, { type: "REQUEST_CURRENT_STATE", from: user.username });
        }
      });

      mqttClient.on("message", (topic, message) => {
        try {
          const data = JSON.parse(message.toString());
          handleIncomingRealtimeMessage(topic, data);
        } catch (e) {
          console.error("MQTT Message Parse Error:", e);
        }
      });

      mqttClient.on("error", (err) => {
        console.warn("MQTT Connection Warning:", err);
      });

      mqttClient.on("close", () => {
        isMqttConnected = false;
      });
    } catch (e) {
      console.warn("MQTT Init Exception:", e);
    }
  }

  function publishMqtt(topic, payload, retain = false) {
    if (mqttClient && isMqttConnected) {
      try {
        mqttClient.publish(topic, JSON.stringify(payload), { qos: 1, retain: retain });
      } catch (e) {}
    }
  }

  function handleIncomingRealtimeMessage(topic, data) {
    if (!data || !data.type) return;

    if (topic === LIVE_ROOM_TOPIC || data.type === "LIVE_STATE_CHANGED") {
      // Nhận trạng thái mới nhất từ Giáo viên phát xuống
      if (data.payload) {
        localStorage.setItem(STORAGE_KEYS.LIVE_STATE, JSON.stringify(data.payload));
        window.dispatchEvent(new CustomEvent("APP_REALTIME_SYNC", { detail: data.payload }));
      }
    } else if (topic === LIVE_EVENT_TOPIC) {
      if (data.type === "REQUEST_CURRENT_STATE") {
        // Nếu là máy Giáo viên, trả lời ngay trạng thái hiện tại kèm cờ retain
        const user = getSessionUser();
        if (user && user.role === "admin") {
          const current = loadLiveState();
          publishMqtt(LIVE_ROOM_TOPIC, { type: "LIVE_STATE_CHANGED", payload: current }, true);
        }
      } else if (data.type === "STUDENT_SUBMISSION") {
        // Nhận bài nộp của học sinh (Phiếu nhóm / Minigame / Drive) cập nhật vào danh sách của GV
        const sub = data.payload;
        if (sub.subType === "worksheet") {
          const list = loadJSON(STORAGE_KEYS.WORKSHEET_SUBS, []);
          if (!list.some(x => x.id === sub.id)) {
            list.unshift(sub);
            localStorage.setItem(STORAGE_KEYS.WORKSHEET_SUBS, JSON.stringify(list));
          }
        } else if (sub.subType === "minigame") {
          const list = loadJSON(STORAGE_KEYS.MINIGAME_SUBS, []);
          if (!list.some(x => x.id === sub.id)) {
            list.unshift(sub);
            localStorage.setItem(STORAGE_KEYS.MINIGAME_SUBS, JSON.stringify(list));
          }
        } else if (sub.subType === "drive") {
          const list = loadJSON(STORAGE_KEYS.DRIVE_SUBS, []);
          if (!list.some(x => x.id === sub.id)) {
            list.unshift(sub);
            localStorage.setItem(STORAGE_KEYS.DRIVE_SUBS, JSON.stringify(list));
          }
        }
        window.dispatchEvent(new CustomEvent("APP_REALTIME_SYNC", { detail: sub }));
      } else if (data.type === "GROUP_REGISTERED") {
        const groups = loadJSON(STORAGE_KEYS.GROUPS_LIST, []);
        if (!groups.some(g => g.groupId === data.payload.groupId)) {
          groups.push(data.payload);
          localStorage.setItem(STORAGE_KEYS.GROUPS_LIST, JSON.stringify(groups));
          window.dispatchEvent(new CustomEvent("APP_REALTIME_SYNC", { detail: groups }));
        }
      }
    }
  }

  function getSessionUser() {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEYS.SESSION_USER);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return null;
  }

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
    } catch (e) {}
    const initial = window.INITIAL_STUDENTS_DB || { adminAccount: { username: "admin", password: "666" }, classes: [], students: [] };
    localStorage.setItem(STORAGE_KEYS.STUDENTS_DB, JSON.stringify(initial));
    return JSON.parse(JSON.stringify(initial));
  }

  function saveStudentsDB(db) {
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
    broadcastLocal("DB_UPDATED", { timestamp: Date.now() });
  }

  function getDefaultLiveState() {
    return {
      isLiveOpen: true,
      roomCode: "LIVE-MD",
      grade: 7,
      className: "7A11",
      period: 12,
      currentActivity: 1,
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

    // 1. Phát qua kênh MQTT Đám mây (Đến tất cả trình duyệt khác: Chrome, Edge, 45 PC)
    publishMqtt(LIVE_ROOM_TOPIC, { type: "LIVE_STATE_CHANGED", payload: newState }, true);

    // 2. Phát qua kênh Cục bộ cùng máy
    broadcastLocal("LIVE_STATE_CHANGED", newState);
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
    if (eventName) broadcastLocal(eventName, { timestamp: Date.now() });
  }

  function broadcastLocal(type, payload) {
    if (localBroadcast) {
      try {
        localBroadcast.postMessage({ type, payload });
      } catch (e) {}
    }
  }

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

  // Khởi động kênh Realtime Đám mây
  if (typeof window !== "undefined") {
    setTimeout(initMqttCloudSync, 100);
  }

  window.AppStore = {
    STORAGE_KEYS,
    localBroadcast,
    publishMqtt,
    LIVE_EVENT_TOPIC,
    generateStudentUsername,
    loadStudentsDB,
    saveStudentsDB,
    loadLiveState,
    saveLiveState,
    getGroups: () => loadJSON(STORAGE_KEYS.GROUPS_LIST, []),
    saveGroups: (list) => {
      saveJSON(STORAGE_KEYS.GROUPS_LIST, list, "GROUPS_UPDATED");
      if (list.length > 0) {
        publishMqtt(LIVE_EVENT_TOPIC, { type: "GROUP_REGISTERED", payload: list[list.length - 1] });
      }
    },
    getWorksheetSubs: () => loadJSON(STORAGE_KEYS.WORKSHEET_SUBS, []),
    saveWorksheetSubs: (list) => {
      saveJSON(STORAGE_KEYS.WORKSHEET_SUBS, list, "SUBS_UPDATED");
      if (list.length > 0) {
        publishMqtt(LIVE_EVENT_TOPIC, { type: "STUDENT_SUBMISSION", payload: { ...list[0], subType: "worksheet" } });
      }
    },
    getMinigameSubs: () => loadJSON(STORAGE_KEYS.MINIGAME_SUBS, []),
    saveMinigameSubs: (list) => {
      saveJSON(STORAGE_KEYS.MINIGAME_SUBS, list, "SUBS_UPDATED");
      if (list.length > 0) {
        publishMqtt(LIVE_EVENT_TOPIC, { type: "STUDENT_SUBMISSION", payload: { ...list[0], subType: "minigame" } });
      }
    },
    getDriveSubs: () => loadJSON(STORAGE_KEYS.DRIVE_SUBS, []),
    saveDriveSubs: (list) => {
      saveJSON(STORAGE_KEYS.DRIVE_SUBS, list, "DRIVE_SUBS_UPDATED");
      if (list.length > 0) {
        publishMqtt(LIVE_EVENT_TOPIC, { type: "STUDENT_SUBMISSION", payload: { ...list[0], subType: "drive" } });
      }
    },
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
