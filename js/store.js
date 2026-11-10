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
    SESSION_USER: "THCS_MD_SESSION_USER_V2",
    ACTIVE_EXAM_SESSION: "THCS_MD_ACTIVE_EXAM_SESSION_V2",
    EXAM_SUBS: "THCS_MD_EXAM_SUBS_V2",
    EXAM_VIOLATIONS: "THCS_MD_EXAM_VIOLATIONS_V2",
    HOMEWORK_ASSIGNMENTS: "THCS_MD_HOMEWORK_ASSIGNMENTS_V2",
    HOMEWORK_SUBS: "THCS_MD_HOMEWORK_SUBS_V2"
  };

  // Kênh cục bộ trong cùng 1 trình duyệt
  const localBroadcast = typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("THCS_MAO_DIEN_LOCAL_SYNC")
    : null;

  // Cấu hình Kênh Đám mây MQTT WSS (Hỗ trợ đa máy chủ dự phòng)
  const MQTT_BROKERS = [
    "wss://broker.emqx.io:8084/mqtt",
    "wss://broker.hivemq.com:8884/mqtt"
  ];
  let currentBrokerIndex = 0;
  const MQTT_TOPIC_PREFIX = "thcs-maodien/tinhoc-thcs/";
  const LIVE_ROOM_TOPIC = MQTT_TOPIC_PREFIX + "live-room-main";
  const LIVE_EVENT_TOPIC = MQTT_TOPIC_PREFIX + "live-events";
  const EXAM_SESSION_TOPIC = MQTT_TOPIC_PREFIX + "exam-session";
  const HOMEWORK_TOPIC = MQTT_TOPIC_PREFIX + "homework";

  let mqttClient = null;
  let isMqttConnected = false;

  function initMqttCloudSync() {
    if (typeof mqtt === "undefined") {
      console.warn("MQTT library not loaded, falling back to local broadcast only.");
      return;
    }

    const clientId = "client_" + Math.random().toString(16).substring(2, 10);
    const brokerUrl = MQTT_BROKERS[currentBrokerIndex];

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
        window.dispatchEvent(new CustomEvent("MQTT_STATUS_CHANGED", { detail: { connected: true, broker: brokerUrl } }));

        // Lắng nghe kênh phòng chung, sự kiện, kỳ thi, bài tập về nhà và kênh từng lớp
        mqttClient.subscribe([LIVE_ROOM_TOPIC, LIVE_EVENT_TOPIC, EXAM_SESSION_TOPIC, HOMEWORK_TOPIC, MQTT_TOPIC_PREFIX + "class/+"], { qos: 1 });

        // Học sinh vừa mở trang sẽ phát tín hiệu xin đồng bộ trạng thái mới nhất từ máy Giáo viên
        const user = getSessionUser();
        if (user && user.role === "student") {
          publishMqtt(LIVE_EVENT_TOPIC, { type: "REQUEST_CURRENT_STATE", from: user.username, className: user.className });
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
        console.warn("MQTT Connection Warning on", brokerUrl, err);
      });

      mqttClient.on("close", () => {
        isMqttConnected = false;
        window.dispatchEvent(new CustomEvent("MQTT_STATUS_CHANGED", { detail: { connected: false } }));
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

    if (topic === LIVE_ROOM_TOPIC || topic.startsWith(MQTT_TOPIC_PREFIX + "class/") || data.type === "LIVE_STATE_CHANGED") {
      // Nhận trạng thái mới nhất từ Giáo viên phát xuống
      if (data.payload) {
        localStorage.setItem(STORAGE_KEYS.LIVE_STATE, JSON.stringify(data.payload));
        window.dispatchEvent(new CustomEvent("APP_REALTIME_SYNC", { detail: data.payload }));
      }
    } else if (topic === EXAM_SESSION_TOPIC || data.type === "EXAM_SESSION_CHANGED") {
      if (data.payload) {
        localStorage.setItem(STORAGE_KEYS.ACTIVE_EXAM_SESSION, JSON.stringify(data.payload));
        window.dispatchEvent(new CustomEvent("EXAM_SESSION_SYNC", { detail: data.payload }));
        window.dispatchEvent(new CustomEvent("APP_REALTIME_SYNC", { detail: data.payload }));
      }
    } else if (topic === HOMEWORK_TOPIC || data.type === "HOMEWORK_ASSIGNMENT_CHANGED") {
      if (data.payload) {
        localStorage.setItem(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, JSON.stringify(data.payload));
        window.dispatchEvent(new CustomEvent("HOMEWORK_SYNC", { detail: data.payload }));
        window.dispatchEvent(new CustomEvent("APP_REALTIME_SYNC", { detail: data.payload }));
      }
    } else if (topic === LIVE_EVENT_TOPIC) {
      if (data.type === "REQUEST_CURRENT_STATE") {
        // Nếu là máy Giáo viên, trả lời ngay trạng thái hiện tại kèm cờ retain
        const user = getSessionUser();
        if (user && user.role === "admin") {
          const current = loadLiveState();
          publishMqtt(LIVE_ROOM_TOPIC, { type: "LIVE_STATE_CHANGED", payload: current }, true);
          if (current.className) {
            publishMqtt(MQTT_TOPIC_PREFIX + "class/" + current.className, { type: "LIVE_STATE_CHANGED", payload: current }, true);
          }
          const examSession = getActiveExamSession();
          if (examSession) {
            publishMqtt(EXAM_SESSION_TOPIC, { type: "EXAM_SESSION_CHANGED", payload: examSession }, true);
          }
          const hw = getHomeworkAssignments();
          if (hw && hw.length > 0) {
            publishMqtt(HOMEWORK_TOPIC, { type: "HOMEWORK_ASSIGNMENT_CHANGED", payload: hw }, true);
          }
        }
      } else if (data.type === "HOMEWORK_SUBMISSION") {
        const sub = data.payload;
        const list = loadJSON(STORAGE_KEYS.HOMEWORK_SUBS, []);
        const idx = list.findIndex(x => x.id === sub.id || (x.assignmentId === sub.assignmentId && x.studentId === sub.studentId));
        if (idx >= 0) list[idx] = sub;
        else list.unshift(sub);
        localStorage.setItem(STORAGE_KEYS.HOMEWORK_SUBS, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("APP_REALTIME_SYNC", { detail: sub }));
      } else if (data.type === "HOMEWORK_GRADED") {
        const sub = data.payload;
        const list = loadJSON(STORAGE_KEYS.HOMEWORK_SUBS, []);
        const idx = list.findIndex(x => x.id === sub.id);
        if (idx >= 0) list[idx] = sub;
        localStorage.setItem(STORAGE_KEYS.HOMEWORK_SUBS, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("APP_REALTIME_SYNC", { detail: sub }));
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
      } else if (data.type === "EXAM_SUBMISSION") {
        const sub = data.payload;
        const subs = loadJSON(STORAGE_KEYS.EXAM_SUBS, []);
        const idx = subs.findIndex(x => x.studentId === sub.studentId && x.examId === sub.examId);
        if (idx >= 0) subs[idx] = sub;
        else subs.unshift(sub);
        localStorage.setItem(STORAGE_KEYS.EXAM_SUBS, JSON.stringify(subs));
        window.dispatchEvent(new CustomEvent("APP_REALTIME_SYNC", { detail: sub }));
      } else if (data.type === "STUDENT_EXAM_VIOLATION") {
        const violation = data.payload;
        const vios = loadJSON(STORAGE_KEYS.EXAM_VIOLATIONS, []);
        vios.unshift(violation);
        localStorage.setItem(STORAGE_KEYS.EXAM_VIOLATIONS, JSON.stringify(vios));
        window.dispatchEvent(new CustomEvent("APP_REALTIME_SYNC", { detail: violation }));
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

    // Tự động đẩy đồng bộ lên CSDL Google Drive ở chế độ nền (không làm nghẽn giao diện)
    triggerAutoCloudSync(db);
  }

  let autoSyncDebounceTimer = null;
  function triggerAutoCloudSync(db) {
    const cfg = loadJSON(STORAGE_KEYS.GAS_CONFIG, {});
    if (!cfg.gasWebAppUrl || !cfg.gasWebAppUrl.startsWith("http")) return;

    if (autoSyncDebounceTimer) clearTimeout(autoSyncDebounceTimer);
    autoSyncDebounceTimer = setTimeout(async () => {
      try {
        await fetch(cfg.gasWebAppUrl, {
          method: "POST",
          body: JSON.stringify({
            action: "syncStudentProgress",
            students: db.students
          })
        });
      } catch (e) {
        // Dự phòng offline, tự động retry ở lần thao tác tiếp theo
      }
    }, 1500);
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
    if (newState.className) {
      publishMqtt(MQTT_TOPIC_PREFIX + "class/" + newState.className, { type: "LIVE_STATE_CHANGED", payload: newState }, true);
    }

    // 2. Phát qua kênh Cục bộ cùng máy
    broadcastLocal("LIVE_STATE_CHANGED", newState);
  }

  // Quản lý Ca Kiểm tra Định kỳ có Kiểm soát (Proctored Exam Session)
  function getActiveExamSession() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.ACTIVE_EXAM_SESSION);
      if (raw) {
        const s = JSON.parse(raw);
        if (s && s.status === "active") return s;
      }
    } catch (e) {}
    return null;
  }

  function saveActiveExamSession(session) {
    session.updatedAt = Date.now();
    localStorage.setItem(STORAGE_KEYS.ACTIVE_EXAM_SESSION, JSON.stringify(session));
    publishMqtt(EXAM_SESSION_TOPIC, { type: "EXAM_SESSION_CHANGED", payload: session }, true);
    broadcastLocal("EXAM_SESSION_CHANGED", session);
  }

  function closeExamSession() {
    const s = getActiveExamSession() || { status: "closed" };
    s.status = "closed";
    s.closedAt = Date.now();
    localStorage.setItem(STORAGE_KEYS.ACTIVE_EXAM_SESSION, JSON.stringify(s));
    publishMqtt(EXAM_SESSION_TOPIC, { type: "EXAM_SESSION_CHANGED", payload: s }, true);
    broadcastLocal("EXAM_SESSION_CHANGED", s);
  }

  function recordExamViolation(violation) {
    violation.timestamp = new Date().toLocaleTimeString("vi-VN");
    const list = loadJSON(STORAGE_KEYS.EXAM_VIOLATIONS, []);
    list.unshift(violation);
    localStorage.setItem(STORAGE_KEYS.EXAM_VIOLATIONS, JSON.stringify(list));
    publishMqtt(LIVE_EVENT_TOPIC, { type: "STUDENT_EXAM_VIOLATION", payload: violation });
    broadcastLocal("STUDENT_EXAM_VIOLATION", violation);
  }

  function getExamViolations() {
    return loadJSON(STORAGE_KEYS.EXAM_VIOLATIONS, []);
  }

  function saveExamSubmission(sub) {
    sub.submittedAt = new Date().toLocaleTimeString("vi-VN");
    const list = loadJSON(STORAGE_KEYS.EXAM_SUBS, []);
    const idx = list.findIndex(x => x.studentId === sub.studentId && x.examId === sub.examId);
    if (idx >= 0) list[idx] = sub;
    else list.unshift(sub);
    localStorage.setItem(STORAGE_KEYS.EXAM_SUBS, JSON.stringify(list));
    publishMqtt(LIVE_EVENT_TOPIC, { type: "EXAM_SUBMISSION", payload: sub });
    broadcastLocal("EXAM_SUBMISSION", sub);
  }

  function getExamSubmissions() {
    return loadJSON(STORAGE_KEYS.EXAM_SUBS, []);
  }

  // ============================================================================
  // QUẢN LÝ BÀI TẬP VỀ NHÀ & DỮ LIỆU THÔ ĐÍNH KÈM (HOMEWORK SYSTEM)
  // ============================================================================
  function getDefaultHomeworkAssignments() {
    // Dữ liệu CSV thô mã hóa để học sinh tải về mở bằng Excel/Calc
    const sampleCsvContent = "\uFEFF" + [
      "STT,Họ và tên,Lớp,Toán,Ngữ Văn,Tiếng Anh,Tin học,Điểm TB,Xếp loại",
      "1,Nguyễn Văn An,7A11,8.5,8.0,9.0,9.5,,",
      "2,Trần Thị Bình,7A11,7.0,8.5,8.0,8.5,,",
      "3,Lê Hoàng Cường,7A11,9.0,7.5,8.5,10.0,,",
      "4,Phạm Ngọc Dung,7A11,6.5,7.0,7.5,8.0,,",
      "5,Vũ Đức Giang,7A11,8.0,8.0,8.0,9.0,,",
      "6,Đỗ Thùy Linh,7A11,9.5,9.0,9.5,10.0,,",
      "7,Hoàng Minh Long,7A11,7.5,7.0,8.0,8.5,,",
      "8,Bùi Ánh Tuyết,7A11,8.5,9.0,9.0,9.5,,",
      ",,,,,Điểm Cao Nhất:,,,",
      ",,,,,Điểm Thấp Nhất:,,,",
      ",,,,,Điểm TB Cả Lớp:,,,"
    ].join("\r\n");

    const sampleXlsxDataUrl = "data:text/csv;charset=utf-8," + encodeURIComponent(sampleCsvContent);

    // Ảnh SVG biểu đồ / bảng điểm mẫu sắc nét
    const sampleTableSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e40af"/>
      <stop offset="100%" stop-color="#3b82f6"/>
    </linearGradient>
  </defs>
  <rect width="640" height="360" fill="#f8fafc" rx="16"/>
  <rect x="24" y="20" width="592" height="48" fill="url(#headerGrad)" rx="10"/>
  <text x="320" y="50" fill="#ffffff" font-family="'Segoe UI', sans-serif" font-size="16" font-weight="bold" text-anchor="middle">BẢNG KẾT QUẢ HỌC TẬP HỌC KỲ I — LỚP 7A11</text>
  <rect x="24" y="78" width="592" height="32" fill="#e2e8f0" rx="4"/>
  <text x="45" y="99" font-family="sans-serif" font-size="12" font-weight="bold" fill="#334155">STT</text>
  <text x="130" y="99" font-family="sans-serif" font-size="12" font-weight="bold" fill="#334155">Họ và tên</text>
  <text x="260" y="99" font-family="sans-serif" font-size="12" font-weight="bold" fill="#334155">Toán</text>
  <text x="330" y="99" font-family="sans-serif" font-size="12" font-weight="bold" fill="#334155">Văn</text>
  <text x="400" y="99" font-family="sans-serif" font-size="12" font-weight="bold" fill="#334155">Anh</text>
  <text x="470" y="99" font-family="sans-serif" font-size="12" font-weight="bold" fill="#334155">Tin học</text>
  <text x="555" y="99" font-family="sans-serif" font-size="12" font-weight="bold" fill="#1e40af">Điểm TB</text>
  <line x1="24" y1="145" x2="616" y2="145" stroke="#e2e8f0"/>
  <text x="45" y="135" font-family="sans-serif" font-size="12" fill="#64748b">1</text>
  <text x="130" y="135" font-family="sans-serif" font-size="12" font-weight="600" fill="#1e293b">Nguyễn Văn An</text>
  <text x="265" y="135" font-family="sans-serif" font-size="12" fill="#334155">8.5</text>
  <text x="335" y="135" font-family="sans-serif" font-size="12" fill="#334155">8.0</text>
  <text x="405" y="135" font-family="sans-serif" font-size="12" fill="#334155">9.0</text>
  <text x="475" y="135" font-family="sans-serif" font-size="12" fill="#334155">9.5</text>
  <text x="560" y="135" font-family="sans-serif" font-size="13" font-weight="bold" fill="#16a34a">8.75</text>
  <line x1="24" y1="180" x2="616" y2="180" stroke="#e2e8f0"/>
  <text x="45" y="170" font-family="sans-serif" font-size="12" fill="#64748b">2</text>
  <text x="130" y="170" font-family="sans-serif" font-size="12" font-weight="600" fill="#1e293b">Trần Thị Bình</text>
  <text x="265" y="170" font-family="sans-serif" font-size="12" fill="#334155">7.0</text>
  <text x="335" y="170" font-family="sans-serif" font-size="12" fill="#334155">8.5</text>
  <text x="405" y="170" font-family="sans-serif" font-size="12" fill="#334155">8.0</text>
  <text x="475" y="170" font-family="sans-serif" font-size="12" fill="#334155">8.5</text>
  <text x="560" y="170" font-family="sans-serif" font-size="13" font-weight="bold" fill="#16a34a">8.00</text>
  <rect x="24" y="245" width="592" height="95" fill="#eff6ff" stroke="#93c5fd" stroke-width="1.5" rx="10"/>
  <text x="40" y="272" font-family="sans-serif" font-size="13" font-weight="bold" fill="#1e40af">📌 Yêu cầu sản phẩm hoàn thành:</text>
  <text x="40" y="296" font-family="sans-serif" font-size="12" fill="#1e3a8a">1. Tính Điểm TB = AVERAGE(Toán, Văn, Anh, Tin) và làm tròn 2 chữ số thập phân.</text>
  <text x="40" y="316" font-family="sans-serif" font-size="12" fill="#1e3a8a">2. Điền công thức hàm MAX, MIN tìm điểm cao nhất, thấp nhất của cả lớp.</text>
  <text x="40" y="334" font-family="sans-serif" font-size="12" fill="#1e3a8a">3. Kẻ khung viền đầy đủ, tô màu tiêu đề nổi bật và nộp tệp .xlsx về Google Drive.</text>
</svg>`;
    const sampleTableImgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(sampleTableSvg);

    return [
      {
        id: "HW_G7_T12",
        grade: 7,
        period: 12,
        targetClass: "ALL",
        title: "BTVN Tiết 12: Thiết kế bảng tính theo dõi điểm và tính điểm trung bình môn bằng hàm AVERAGE, MAX, MIN",
        lessonTitle: "Bài 7: Định dạng dữ liệu và tính toán trong bảng tính (Tiếp theo)",
        deadline: "2026-11-20T23:59",
        createdAt: "09/11/2026 08:30",
        description: "Các em tải về 2 tệp đính kèm do Thầy cung cấp bên dưới (Tệp Excel dữ liệu thô và Tệp ảnh mẫu bảng điểm). Sau đó thực hiện:\n1. Mở file Excel, áp dụng hàm =AVERAGE(...) để tính cột Điểm TB cho tất cả học sinh.\n2. Dùng hàm =MAX(...) và =MIN(...) xác định điểm cao nhất, thấp nhất của cả lớp.\n3. Định dạng kẻ khung viền (Borders), tô màu hàng tiêu đề và căn lề số thập phân 2 chữ số.\n4. Lưu file định dạng .xlsx và nộp bài lên hệ thống trước hạn.",
        attachments: [
          {
            id: "att_g7_1",
            name: "Bang_Diem_Mau_Lop7.xlsx",
            type: "xlsx",
            mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            sizeKB: 18,
            dataUrl: sampleXlsxDataUrl
          },
          {
            id: "att_g7_2",
            name: "Mau_Trinh_Bay_Bang_Diem.png",
            type: "image",
            mimeType: "image/svg+xml",
            sizeKB: 32,
            dataUrl: sampleTableImgDataUrl
          }
        ]
      },
      {
        id: "HW_G8_T10",
        grade: 8,
        period: 10,
        targetClass: "ALL",
        title: "BTVN Tiết 10: Xây dựng bài thuyết trình đa phương tiện về chủ đề An toàn thông tin trên Internet",
        lessonTitle: "Bài 5: Ứng dụng tin học trong học tập và đời sống",
        deadline: "2026-11-22T21:00",
        createdAt: "08/11/2026 15:00",
        description: "Các em tải về tệp ảnh sơ đồ hướng dẫn. Sử dụng PowerPoint để thiết kế bài thuyết trình tối thiểu 5 trang gồm: Trang 1 (Tiêu đề + Họ tên), Trang 2 (Các nguy cơ mất an toàn thông tin), Trang 3 (Quy tắc mật khẩu an toàn), Trang 4 (Phòng chống lừa đảo mạng), Trang 5 (Thông điệp gửi các bạn). Đính kèm file trình chiếu .pptx để nộp.",
        attachments: [
          {
            id: "att_g8_1",
            name: "So_Do_Mau_An_Toan_Mang.png",
            type: "image",
            mimeType: "image/svg+xml",
            sizeKB: 28,
            dataUrl: sampleTableImgDataUrl
          }
        ]
      },
      {
        id: "HW_G6_T04",
        grade: 6,
        period: 4,
        targetClass: "ALL",
        title: "BTVN Tiết 4: Soạn thảo và định dạng văn bản Thông báo Kế hoạch tham quan học tập",
        lessonTitle: "Bài 3: Mạng có dây và mạng không dây",
        deadline: "2026-11-18T23:59",
        createdAt: "07/11/2026 10:00",
        description: "Các em tải tệp dữ liệu thô và ảnh mẫu. Thực hiện định dạng văn bản đúng chuẩn thể thức hành chính (phông chữ Times New Roman cỡ 13pt, dãn dòng 1.2, căn lề justified, chèn bảng phân công nhiệm vụ). Lưu tệp sản phẩm định dạng .docx hoặc .pdf và nộp bài.",
        attachments: [
          {
            id: "att_g6_1",
            name: "Noi_Dung_Tho_Ke_Hoach.docx",
            type: "docx",
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            sizeKB: 24,
            dataUrl: sampleXlsxDataUrl
          }
        ]
      }
    ];
  }

  function getHomeworkAssignments() {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch (e) {}
    const def = getDefaultHomeworkAssignments();
    localStorage.setItem(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, JSON.stringify(def));
    return def;
  }

  function saveHomeworkAssignments(list) {
    saveJSON(STORAGE_KEYS.HOMEWORK_ASSIGNMENTS, list, "HOMEWORK_UPDATED");
    publishMqtt(HOMEWORK_TOPIC, { type: "HOMEWORK_ASSIGNMENT_CHANGED", payload: list }, true);
  }

  function addOrUpdateHomeworkAssignment(hw) {
    const list = getHomeworkAssignments();
    const idx = list.findIndex(x => x.id === hw.id);
    if (idx >= 0) {
      list[idx] = hw;
    } else {
      if (!hw.id) hw.id = "HW_G" + hw.grade + "_T" + String(hw.period).padStart(2, "0") + "_" + Date.now();
      list.unshift(hw);
    }
    saveHomeworkAssignments(list);
    return hw;
  }

  function deleteHomeworkAssignment(hwId) {
    let list = getHomeworkAssignments();
    list = list.filter(x => x.id !== hwId);
    saveHomeworkAssignments(list);
  }

  function getHomeworkSubs() {
    return loadJSON(STORAGE_KEYS.HOMEWORK_SUBS, []);
  }

  function saveHomeworkSubs(list) {
    saveJSON(STORAGE_KEYS.HOMEWORK_SUBS, list, "HOMEWORK_SUBS_UPDATED");
  }

  function saveHomeworkSubmission(sub) {
    sub.submittedAt = UtilitiesFormatDateNow();
    const list = getHomeworkSubs();
    const idx = list.findIndex(x => x.id === sub.id || (x.assignmentId === sub.assignmentId && x.studentId === sub.studentId));
    if (idx >= 0) {
      sub.id = list[idx].id;
      list[idx] = sub;
    } else {
      if (!sub.id) sub.id = "HWSUB_" + Date.now() + "_" + Math.random().toString(36).substring(2, 6);
      list.unshift(sub);
    }
    saveHomeworkSubs(list);
    publishMqtt(LIVE_EVENT_TOPIC, { type: "HOMEWORK_SUBMISSION", payload: sub });
    broadcastLocal("HOMEWORK_SUBMISSION", sub);
    return sub;
  }

  function gradeHomeworkSub(subId, score, comment) {
    const list = getHomeworkSubs();
    const sub = list.find(s => s.id === subId);
    if (!sub) return null;
    sub.teacherScore = Number(score);
    sub.teacherComment = comment || "";
    sub.gradedAt = UtilitiesFormatDateNow();
    saveHomeworkSubs(list);

    // Thưởng XP cho học sinh dựa theo điểm số (Điểm x 10 + 20 XP hoàn thành)
    const earnedXP = Math.round(sub.teacherScore * 10) + 20;
    const db = loadStudentsDB();
    const st = db.students.find(s => s.id === sub.studentId);
    if (st) {
      st.xp = (Number(st.xp) || 0) + earnedXP;
      st.level = Math.floor(st.xp / 500) + 1;
      saveStudentsDB(db);
    }

    publishMqtt(LIVE_EVENT_TOPIC, { type: "HOMEWORK_GRADED", payload: sub });
    broadcastLocal("HOMEWORK_GRADED", sub);
    return sub;
  }

  function UtilitiesFormatDateNow() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
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

  // ============================================================================
  // HỆ THỐNG HUY HIỆU & VINH DANH HỌC SINH (BADGES & HONOR ROLL)
  // ============================================================================
  const BADGES_DEFINITIONS = [
    {
      id: "badge_first_step",
      icon: "🌟",
      title: "Khởi Đầu Nan",
      description: "Hoàn thành bài học đầu tiên trong chương trình",
      condition: (st) => (st.completedLessons || []).length >= 1,
      xpReward: 50
    },
    {
      id: "badge_combo_master",
      icon: "⚡",
      title: "Tia Chớp Minigame",
      description: "Đạt chuỗi đúng liên tiếp từ 3 câu trở lên trong Minigame",
      condition: (st, ctx) => (ctx && ctx.maxStreak >= 3),
      xpReward: 100
    },
    {
      id: "badge_practical_star",
      icon: "🎯",
      title: "Tay Nghề Xuất Sắc",
      description: "Đạt điểm 9.0 - 10 trong bài thực hành nộp Google Drive",
      condition: (st) => Object.values(st.lessonScores || {}).some(r => Number(r.act3 || 0) >= 9.0),
      xpReward: 150
    },
    {
      id: "badge_team_player",
      icon: "🤝",
      title: "Đồng Đội Vàng",
      description: "Ghép cặp nhóm máy và cùng hoàn thành từ 2 bài học trở lên",
      condition: (st) => (st.completedLessons || []).length >= 2,
      xpReward: 100
    },
    {
      id: "badge_exam_ace",
      icon: "🏆",
      title: "Thủ Khoa Định Kỳ",
      description: "Đạt điểm từ 9.0 trở lên trong bài kiểm tra định kỳ có kiểm soát",
      condition: (st) => Object.values(st.examScores || {}).some(e => Number(e.score || 0) >= 9.0),
      xpReward: 200
    },
    {
      id: "badge_diligent",
      icon: "📚",
      title: "Học Bá Chăm Chỉ",
      description: "Hoàn thành từ 5 bài học trở lên trong năm học",
      condition: (st) => (st.completedLessons || []).length >= 5,
      xpReward: 200
    },
    {
      id: "badge_class_top",
      icon: "🥇",
      title: "Ngôi Sao Lớp Học",
      description: "Đạt vị trí Top 3 trên Bảng xếp hạng của Lớp",
      condition: (st, ctx, rank) => rank && rank <= 3,
      xpReward: 250
    },
    {
      id: "badge_grandmaster",
      icon: "👑",
      title: "Bậc Thầy Tin Học",
      description: "Đạt Cấp độ 5 trở lên hoặc tích lũy từ 2000 XP",
      condition: (st) => Number(st.level || 1) >= 5 || Number(st.xp || 0) >= 2000,
      xpReward: 300
    }
  ];

  function evaluateStudentBadges(studentId, context) {
    const db = loadStudentsDB();
    const st = db.students.find(s => s.id === studentId);
    if (!st) return [];

    if (!Array.isArray(st.badges)) st.badges = [];
    const newlyAwarded = [];

    // Tính thứ hạng lớp để xét huy hiệu Top lớp
    let classRank = null;
    try {
      const analytics = getStudentAnalytics(studentId);
      if (analytics) classRank = analytics.classRank;
    } catch (e) {}

    BADGES_DEFINITIONS.forEach(b => {
      if (!st.badges.includes(b.id)) {
        try {
          if (b.condition(st, context, classRank)) {
            st.badges.push(b.id);
            st.xp = (Number(st.xp) || 0) + b.xpReward;
            st.level = Math.floor(st.xp / 500) + 1;
            newlyAwarded.push(b);
          }
        } catch (err) {}
      }
    });

    if (newlyAwarded.length > 0) {
      saveStudentsDB(db);
      newlyAwarded.forEach(b => {
        publishMqtt(LIVE_EVENT_TOPIC, {
          type: "BADGE_AWARDED",
          payload: {
            studentId: st.id,
            studentName: st.fullName,
            className: st.className,
            badge: b,
            timestamp: UtilitiesFormatDateNow()
          }
        });
      });
      window.dispatchEvent(new CustomEvent("BADGE_UNLOCKED", { detail: { student: st, badges: newlyAwarded } }));
    }

    return newlyAwarded;
  }

  function creditGroupScoreAndXP(memberIds, lessonId, activityKey, score10, xpEarned, context) {
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

    // Tự động kiểm tra và trao tặng huy hiệu cho tất cả thành viên trong nhóm
    validIds.forEach(id => {
      evaluateStudentBadges(id, context);
    });
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

  // ============================================================================
  // CƠ CHẾ LƯU TRỮ LÂU DÀI: SAO LƯU ĐÁM MÂY GOOGLE DRIVE & XUẤT NHẬP TỆP JSON
  // ============================================================================
  async function backupDBToCloud() {
    const cfg = loadJSON(STORAGE_KEYS.GAS_CONFIG, {});
    if (!cfg.gasWebAppUrl || !cfg.gasWebAppUrl.startsWith("http")) {
      throw new Error("Chưa cấu hình URL Web App Google Apps Script!");
    }
    const db = loadStudentsDB();
    const res = await fetch(cfg.gasWebAppUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "backupCloudDB",
        database: db
      })
    });
    return await res.json();
  }

  async function restoreDBFromCloud() {
    const cfg = loadJSON(STORAGE_KEYS.GAS_CONFIG, {});
    if (!cfg.gasWebAppUrl || !cfg.gasWebAppUrl.startsWith("http")) {
      throw new Error("Chưa cấu hình URL Web App Google Apps Script!");
    }
    const res = await fetch(cfg.gasWebAppUrl, {
      method: "POST",
      body: JSON.stringify({
        action: "restoreCloudDB"
      })
    });
    const json = await res.json();
    if (json && json.status === "ok" && json.database) {
      saveStudentsDB(json.database);
      return json;
    }
    throw new Error(json.message || "Không thể tải dữ liệu từ Google Drive");
  }

  function exportDBToJSON() {
    const db = loadStudentsDB();
    const jsonStr = JSON.stringify(db, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    a.href = url;
    a.download = `THCS_MaoDien_DuLieuHocSinh_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function syncSingleStudentToCloud(student) {
    const cfg = loadJSON(STORAGE_KEYS.GAS_CONFIG, {});
    if (!cfg.gasWebAppUrl || !cfg.gasWebAppUrl.startsWith("http")) return null;
    try {
      const res = await fetch(cfg.gasWebAppUrl, {
        method: "POST",
        body: JSON.stringify({
          action: "syncStudentProgress",
          student: student
        })
      });
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  function importDBFromJSON(jsonString) {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !Array.isArray(parsed.students)) {
      throw new Error("Định dạng tệp sao lưu không hợp lệ (Thiếu danh sách students)!");
    }
    saveStudentsDB(parsed);
    return parsed;
  }

  window.AppStore = {
    STORAGE_KEYS,
    localBroadcast,
    publishMqtt,
    isMqttConnected: () => isMqttConnected,
    LIVE_EVENT_TOPIC,
    EXAM_SESSION_TOPIC,
    HOMEWORK_TOPIC,
    generateStudentUsername,
    loadStudentsDB,
    saveStudentsDB,
    loadLiveState,
    saveLiveState,
    // Kiểm tra định kỳ có kiểm soát
    getActiveExamSession,
    saveActiveExamSession,
    closeExamSession,
    recordExamViolation,
    getExamViolations,
    saveExamSubmission,
    getExamSubmissions,
    // Quản lý bài tập về nhà & dữ liệu đính kèm
    getHomeworkAssignments,
    saveHomeworkAssignments,
    saveSingleHomeworkAssignment,
    getHomeworkSubs,
    saveHomeworkSubmission,
    gradeHomeworkSubmission,
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
    getStudentAnalytics,
    // Hệ thống Huy hiệu & Lưu trữ lâu dài
    BADGES_DEFINITIONS,
    evaluateStudentBadges,
    backupDBToCloud,
    restoreDBFromCloud,
    exportDBToJSON,
    importDBFromJSON
  };
})();
