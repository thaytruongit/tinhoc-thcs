/**
 * ============================================================================
 * HOMEWORK MODULE (js/homework.js)
 * Chức năng Giao & Nộp Bài Tập Về Nhà Môn Tin Học THCS
 * - Giáo viên giao bài theo Tiết học chỉ định (Phân phối chương trình 29 Tiết/Khối)
 * - Đính kèm tệp dữ liệu thô (.xlsx, hình ảnh minh họa, .docx, .pptx) để HS tải về
 * - Học sinh tải dữ liệu thô về máy tính, làm bài và nộp sản phẩm hoàn thành
 * - Tự động đẩy file sản phẩm (.xlsx, .pptx, .docx...) lên Google Drive qua GAS
 * - Giáo viên tải bài làm, chấm điểm, nhận xét và cộng điểm thưởng XP
 * ============================================================================
 */

window.HomeworkModule = (function () {
  const Store = window.AppStore;
  const Curriculum = window.CURRICULUM_DB || { lessons: [] };

  /**
   * Tải tệp xuống máy tính học sinh / giáo viên
   */
  function triggerFileDownload(dataUrl, fileName) {
    if (!dataUrl) {
      if (typeof window.showToast === "function") {
        window.showToast("Không tìm thấy dữ liệu tệp tải về!", "error");
      } else {
        alert("Không tìm thấy dữ liệu tệp tải về!");
      }
      return;
    }

    try {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = fileName || "tai_lieu_dinh_kem";
      if (!dataUrl.startsWith("data:")) {
        a.target = "_blank";
      }
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      if (typeof window.showToast === "function") {
        window.showToast(`Đang tải "${fileName || 'tệp'}" về máy tính...`);
      }
    } catch (e) {
      window.open(dataUrl, "_blank");
    }
  }

  /**
   * Nhận diện định dạng tệp và trả về cấu hình biểu tượng
   */
  function detectFileType(fileName) {
    const lower = String(fileName || "").toLowerCase();
    if (lower.endsWith(".xlsx") || lower.endsWith(".xls") || lower.endsWith(".csv")) {
      return { type: "xlsx", label: "Excel (.xlsx)", icon: "📊", color: "bg-emerald-100 text-emerald-800 border-emerald-300" };
    }
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".webp") || lower.endsWith(".gif") || lower.endsWith(".svg")) {
      return { type: "image", label: "Hình ảnh", icon: "🖼️", color: "bg-purple-100 text-purple-800 border-purple-300" };
    }
    if (lower.endsWith(".docx") || lower.endsWith(".doc")) {
      return { type: "docx", label: "Word (.docx)", icon: "📝", color: "bg-blue-100 text-blue-800 border-blue-300" };
    }
    if (lower.endsWith(".pptx") || lower.endsWith(".ppt")) {
      return { type: "pptx", label: "PowerPoint (.pptx)", icon: "📽️", color: "bg-orange-100 text-orange-800 border-orange-300" };
    }
    if (lower.endsWith(".pdf")) {
      return { type: "pdf", label: "PDF Document", icon: "📕", color: "bg-red-100 text-red-800 border-red-300" };
    }
    if (lower.endsWith(".sb3")) {
      return { type: "scratch", label: "Scratch Project (.sb3)", icon: "🐱", color: "bg-amber-100 text-amber-800 border-amber-300" };
    }
    if (lower.endsWith(".zip") || lower.endsWith(".rar")) {
      return { type: "zip", label: "Tệp nén (.zip)", icon: "🗂️", color: "bg-indigo-100 text-indigo-800 border-indigo-300" };
    }
    return { type: "file", label: "Tệp đính kèm", icon: "📎", color: "bg-slate-100 text-slate-800 border-slate-300" };
  }

  /**
   * Định dạng chuỗi hạn nộp thân thiện
   */
  function formatDeadline(deadlineStr) {
    if (!deadlineStr) return { text: "Không giới hạn", isExpired: false, isNear: false };
    try {
      const d = new Date(deadlineStr);
      if (isNaN(d.getTime())) return { text: deadlineStr, isExpired: false, isNear: false };

      const now = new Date();
      const diffMs = d.getTime() - now.getTime();
      const isExpired = diffMs < 0;
      const hoursLeft = Math.round(diffMs / (1000 * 60 * 60));
      const isNear = !isExpired && hoursLeft <= 24;

      const dd = String(d.getDate()).padStart(2, "0");
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const yyyy = d.getFullYear();
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");

      let relativeText = "";
      if (isExpired) {
        relativeText = "(Đã hết hạn)";
      } else if (hoursLeft < 24) {
        relativeText = `(Còn ${hoursLeft} giờ)`;
      } else {
        const daysLeft = Math.round(hoursLeft / 24);
        relativeText = `(Còn ${daysLeft} ngày)`;
      }

      return {
        text: `${hh}:${min} ngày ${dd}/${mm}/${yyyy} ${relativeText}`,
        isExpired,
        isNear,
        rawFormatted: `${dd}/${mm}/${yyyy} ${hh}:${min}`
      };
    } catch (e) {
      return { text: deadlineStr, isExpired: false, isNear: false };
    }
  }

  function getLessonTitle(grade, period) {
    const list = Curriculum.lessons || [];
    const found = list.find(l => Number(l.grade) === Number(grade) && Number(l.period) === Number(period));
    return found ? `${found.title}` : `Tiết ${period}`;
  }

  // ============================================================================
  // 1. GIAO DIỆN BÀI TẬP VỀ NHÀ CHO HỌC SINH (STUDENT VIEW)
  // ============================================================================
  function renderStudentHomeworkView(student) {
    const state = window.AppState || {};
    const assignments = Store.getHomeworkAssignments();
    const allSubs = Store.getHomeworkSubs();

    // Lọc bài tập dành cho khối và lớp của học sinh
    const myAssignments = assignments.filter(hw => {
      const matchGrade = Number(hw.grade) === Number(student.grade);
      const matchClass = !hw.targetClass || hw.targetClass === "ALL" || hw.targetClass.toUpperCase() === student.className.toUpperCase();
      return matchGrade && matchClass;
    });

    // Thống kê tiến độ
    const mySubs = allSubs.filter(s => s.studentId === student.id);
    const submittedHwIds = new Set(mySubs.map(s => s.assignmentId));
    const totalAssigned = myAssignments.length;
    const totalSubmitted = myAssignments.filter(h => submittedHwIds.has(h.id)).length;
    const totalPending = totalAssigned - totalSubmitted;
    const totalGraded = mySubs.filter(s => typeof s.teacherScore === "number").length;

    // Lọc theo trạng thái và tiết học
    const filterStatus = state.homeworkFilterStatus || "ALL";
    const filterPeriod = state.homeworkFilterPeriod || "ALL";

    let displayList = myAssignments.filter(hw => {
      const isSub = submittedHwIds.has(hw.id);
      if (filterStatus === "PENDING" && isSub) return false;
      if (filterStatus === "SUBMITTED" && !isSub) return false;
      if (filterPeriod !== "ALL" && Number(hw.period) !== Number(filterPeriod)) return false;
      return true;
    });

    return `
      <div class="space-y-6">
        <!-- Banner Tiêu đề & Thống kê tiến độ -->
        <div class="bg-gradient-to-r from-blue-700 via-indigo-700 to-sky-700 rounded-3xl p-6 text-white shadow-lg">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="px-3 py-1 rounded-full bg-white/20 text-white text-xs font-extrabold uppercase backdrop-blur-sm">
                  🏠 Cổng Học Tập Tại Nhà
                </span>
                <span class="text-xs text-blue-200">Khối ${student.grade} • Lớp ${student.className}</span>
              </div>
              <h1 class="text-2xl md:text-3xl font-extrabold">BÀI TẬP VỀ NHÀ & NỘP SẢN PHẨM GOOGLE DRIVE</h1>
              <p class="text-sm text-blue-100 max-w-2xl mt-1">
                Tải tệp dữ liệu thô (Excel, ảnh đề bài...) do Thầy giao về máy để làm bài. Hoàn thành và nộp tệp sản phẩm (.xlsx, .pptx, .docx) trực tiếp vào thư mục Google Drive của Thầy Trường để nhận điểm và XP!
              </p>
            </div>

            <!-- Thẻ đếm tiến độ -->
            <div class="grid grid-cols-3 gap-2.5 sm:gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/20 text-center">
              <div class="px-2">
                <div class="text-2xl font-black">${totalAssigned}</div>
                <div class="text-[11px] text-blue-200 font-semibold uppercase">Được giao</div>
              </div>
              <div class="px-2 border-x border-white/20">
                <div class="text-2xl font-black text-emerald-300">${totalSubmitted}</div>
                <div class="text-[11px] text-emerald-200 font-semibold uppercase">Đã nộp</div>
              </div>
              <div class="px-2">
                <div class="text-2xl font-black text-amber-300">${totalPending}</div>
                <div class="text-[11px] text-amber-200 font-semibold uppercase">Cần làm</div>
              </div>
            </div>
          </div>

          <!-- Thanh điều hướng & bộ lọc -->
          <div class="mt-6 pt-4 border-t border-white/20 flex flex-wrap items-center justify-between gap-3">
            <div class="flex flex-wrap items-center gap-2">
              <button data-hw-filter="ALL" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                filterStatus === "ALL" ? "bg-white text-blue-900 shadow" : "bg-white/10 hover:bg-white/20 text-white"
              }">
                Tất cả bài tập (${totalAssigned})
              </button>
              <button data-hw-filter="PENDING" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                filterStatus === "PENDING" ? "bg-amber-400 text-amber-950 shadow" : "bg-white/10 hover:bg-white/20 text-white"
              }">
                ⚠️ Cần nộp / Chưa nộp (${totalPending})
              </button>
              <button data-hw-filter="SUBMITTED" class="px-3.5 py-1.5 rounded-xl text-xs font-bold transition ${
                filterStatus === "SUBMITTED" ? "bg-emerald-400 text-emerald-950 shadow" : "bg-white/10 hover:bg-white/20 text-white"
              }">
                ✅ Đã nộp bài (${totalSubmitted})
              </button>
            </div>

            <div class="flex items-center gap-2 text-xs">
              <span class="text-blue-200 font-bold">Lọc theo Tiết học:</span>
              <select id="hw-period-filter" class="px-3 py-1.5 rounded-xl bg-white/20 border border-white/30 text-white font-bold text-xs focus:bg-white focus:text-slate-900">
                <option value="ALL" class="text-slate-900">Tất cả 29 Tiết</option>
                ${Array.from({ length: 29 }, (_, i) => i + 1).map(p => `
                  <option value="${p}" ${Number(filterPeriod) === p ? "selected" : ""} class="text-slate-900">
                    Tiết ${p}: ${window.escapeHtml(getLessonTitle(student.grade, p))}
                  </option>
                `).join("")}
              </select>
            </div>
          </div>
        </div>

        <!-- Danh sách bài tập về nhà -->
        ${
          displayList.length === 0
            ? `
            <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
              <div class="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mx-auto">
                🎉
              </div>
              <h3 class="text-lg font-extrabold text-slate-800">Không có bài tập nào trong mục này!</h3>
              <p class="text-sm text-slate-500 max-w-md mx-auto">
                ${
                  filterStatus === "PENDING"
                    ? "Chúc mừng em đã hoàn thành toàn bộ bài tập về nhà được giao! Hãy tiếp tục duy trì tinh thần tự học nhé."
                    : "Hiện tại Thầy chưa giao bài tập cho tiết học này hoặc không có dữ liệu phù hợp."
                }
              </p>
            </div>
          `
            : `
            <div class="space-y-6">
              ${displayList.map(hw => renderStudentHomeworkCard(hw, student, mySubs)).join("")}
            </div>
          `
        }
      </div>

      <!-- Modal xem trước ảnh đề bài (Nếu học sinh bấm xem) -->
      ${renderImagePreviewModal(state.homeworkViewingAttachment)}
    `;
  }

  /**
   * Render thẻ chi tiết từng Bài tập về nhà cho Học sinh
   */
  function renderStudentHomeworkCard(hw, student, mySubs) {
    const sub = mySubs.find(s => s.assignmentId === hw.id);
    const hasSubmitted = !!sub;
    const deadlineInfo = formatDeadline(hw.deadline);
    const state = window.AppState || {};
    const isReuploading = state.studentReuploadingHwId === hw.id;

    // Chuẩn hóa tên file gợi ý cho học sinh
    const cleanStudentName = (student.fullName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9]/g, "");
    const standardizedSampleName = `[BTVN]_${student.className}_${cleanStudentName}_Tiet${String(hw.period).padStart(2, "0")}.xlsx`;

    return `
      <div class="bg-white rounded-3xl border ${hasSubmitted ? "border-emerald-200 shadow-sm" : "border-slate-200 shadow-md"} p-6 transition">
        <!-- Header Thẻ: Tiết học & Trạng thái -->
        <div class="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-xs font-extrabold">
                📌 Tiết ${hw.period} • Khối ${hw.grade}
              </span>
              <span class="text-xs font-semibold text-slate-500">
                ${window.escapeHtml(hw.lessonTitle || getLessonTitle(hw.grade, hw.period))}
              </span>
              ${
                hw.targetClass && hw.targetClass !== "ALL"
                  ? `<span class="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold">Lớp ${hw.targetClass}</span>`
                  : `<span class="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">Toàn khối</span>`
              }
            </div>
            <h3 class="text-xl font-extrabold text-slate-900 pt-1">
              ${window.escapeHtml(hw.title)}
            </h3>
          </div>

          <!-- Trạng thái Nộp bài & Hạn nộp -->
          <div class="flex flex-col items-end gap-1.5">
            ${
              hasSubmitted
                ? typeof sub.teacherScore === "number"
                  ? `<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-100 border border-purple-300 text-purple-900 font-extrabold text-xs shadow-sm">
                      <span>⭐</span> ĐÃ CHẤM: ${sub.teacherScore}/10 ĐIỂM
                    </div>`
                  : `<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 font-extrabold text-xs shadow-sm">
                      <span>✅</span> ĐÃ NỘP BÀI VÀO DRIVE
                    </div>`
                : deadlineInfo.isExpired
                ? `<div class="px-3 py-1.5 rounded-xl bg-red-100 border border-red-300 text-red-800 font-extrabold text-xs">
                    ⛔ ĐÃ HẾT HẠN NỘP
                  </div>`
                : `<div class="px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-300 text-amber-900 font-extrabold text-xs">
                    ⏳ CHƯA NỘP BÀI
                  </div>`
            }
            <div class="text-[11px] ${deadlineInfo.isExpired ? "text-red-600 font-bold" : deadlineInfo.isNear ? "text-amber-700 font-bold" : "text-slate-500"}">
              Hạn nộp: ${window.escapeHtml(deadlineInfo.text)}
            </div>
          </div>
        </div>

        <!-- Nội dung yêu cầu làm bài -->
        <div class="py-4">
          <div class="text-xs font-bold uppercase text-slate-500 mb-1">📝 Yêu cầu & Hướng dẫn làm bài:</div>
          <div class="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-sm text-slate-800 whitespace-pre-line leading-relaxed">
            ${window.escapeHtml(hw.description)}
          </div>
        </div>

        <!-- KHU VỰC 1: TỆP DỮ LIỆU THÔ DO GIÁO VIÊN ĐÍNH KÈM (TẢI VỀ LÀM BÀI) -->
        ${
          hw.attachments && hw.attachments.length > 0
            ? `
            <div class="mb-5 p-5 rounded-2xl bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="text-xl">📁</span>
                  <div>
                    <h4 class="font-extrabold text-blue-950 text-sm">
                      TỆP DỮ LIỆU THÔ & ĐỀ BÀI ĐÍNH KÈM (Em hãy tải về máy tính để làm bài)
                    </h4>
                    <p class="text-xs text-blue-700">
                      Bấm vào nút "⬇ Tải về tệp này" để lưu file vào máy và mở bằng phần mềm (Excel, Word, PowerPoint...)
                    </p>
                  </div>
                </div>
                <span class="px-2.5 py-1 rounded-full bg-blue-200/80 text-blue-900 text-xs font-extrabold">
                  ${hw.attachments.length} tệp
                </span>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                ${hw.attachments.map(att => renderAttachmentItemForStudent(att)).join("")}
              </div>
            </div>
          `
            : ""
        }

        <!-- KHU VỰC 2: NỘP SẢN PHẨM HOÀN THÀNH CHO TIẾT HỌC (ĐẨY LÊN GOOGLE DRIVE) -->
        <div class="pt-2">
          ${
            hasSubmitted && !isReuploading
              ? renderSubmittedStatusBox(hw, sub)
              : renderUploadHomeworkBox(hw, student, standardizedSampleName, isReuploading)
          }
        </div>
      </div>
    `;
  }

  /**
   * Render từng tệp đính kèm dữ liệu thô cho học sinh
   */
  function renderAttachmentItemForStudent(att) {
    const meta = detectFileType(att.name);
    const isImage = meta.type === "image";

    return `
      <div class="flex flex-col justify-between p-3.5 rounded-xl bg-white border border-blue-200 shadow-sm hover:shadow transition">
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-xl ${meta.color} flex items-center justify-center text-xl flex-shrink-0">
            ${meta.icon}
          </div>
          <div class="min-w-0 flex-1">
            <div class="font-bold text-xs text-slate-900 truncate" title="${window.escapeHtml(att.name)}">
              ${window.escapeHtml(att.name)}
            </div>
            <div class="text-[11px] text-slate-500 mt-0.5">
              ${meta.label} • <b>${att.sizeKB || 10} KB</b>
            </div>
          </div>
        </div>

        <div class="mt-3 flex items-center gap-2 pt-2 border-t border-slate-100">
          <button data-hw-download-att="${window.escapeHtml(att.id)}"
                  data-hw-att-name="${window.escapeHtml(att.name)}"
                  class="flex-1 py-1.5 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition">
            <span>⬇</span> Tải về tệp này
          </button>
          ${
            isImage
              ? `<button data-hw-preview-img="${window.escapeHtml(att.id)}"
                         class="px-2.5 py-1.5 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 font-bold text-xs" title="Xem ảnh mẫu phóng to">
                  👁 Xem ảnh
                </button>`
              : ""
          }
        </div>
      </div>
    `;
  }

  /**
   * Render hộp thông tin bài đã nộp thành công
   */
  function renderSubmittedStatusBox(hw, sub) {
    const meta = detectFileType(sub.fileName);
    const isGraded = typeof sub.teacherScore === "number";

    return `
      <div class="p-5 rounded-2xl bg-emerald-50/70 border-2 border-emerald-300 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xl shadow">
              ✅
            </div>
            <div>
              <h4 class="font-extrabold text-emerald-950 text-sm">
                BÀI LÀM ĐÃ ĐƯỢC TẢI LÊN LƯU TRỮ VÀO GOOGLE DRIVE CỦA THẦY
              </h4>
              <p class="text-xs text-emerald-800">
                Thời gian nộp: <b>${window.escapeHtml(sub.submittedAt || "")}</b> • Trạng thái: 
                <span class="font-bold underline">${isGraded ? "Thầy đã chấm điểm" : "Đang chờ Thầy chấm bài"}</span>
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2">
            ${
              sub.fileUrl
                ? `<a href="${window.escapeHtml(sub.fileUrl)}" target="_blank"
                      class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-black text-white font-bold text-xs flex items-center gap-1.5 shadow transition">
                    <span>🌐</span> Mở xem trên Google Drive
                  </a>`
                : ""
            }
            <button data-hw-download-sub="${window.escapeHtml(sub.id)}"
                    class="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs flex items-center gap-1.5 shadow transition">
              <span>⬇</span> Tải bài đã nộp (${sub.fileSizeKB || 0} KB)
            </button>
            <button data-hw-reupload="${window.escapeHtml(hw.id)}"
                    class="px-3 py-2 rounded-xl border border-emerald-400 text-emerald-900 hover:bg-emerald-100 font-bold text-xs transition">
              🔄 Nộp bản cập nhật
            </button>
          </div>
        </div>

        <!-- Thông tin tệp nộp -->
        <div class="p-3 rounded-xl bg-white border border-emerald-200 flex items-center justify-between text-xs">
          <div class="flex items-center gap-2 truncate">
            <span class="text-lg">${meta.icon}</span>
            <span class="font-bold text-slate-800 truncate">${window.escapeHtml(sub.fileName || "BaiTapVeNha")}</span>
            <span class="text-slate-500">(${sub.fileSizeKB || 0} KB)</span>
          </div>
          <span class="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
            Đã đồng bộ Drive
          </span>
        </div>

        <!-- Nếu giáo viên đã chấm điểm -->
        ${
          isGraded
            ? `
            <div class="p-4 rounded-xl bg-gradient-to-r from-purple-100 to-indigo-100 border border-purple-300 flex flex-wrap items-center justify-between gap-3">
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="text-xl">🏆</span>
                  <span class="font-extrabold text-purple-950 text-sm">KẾT QUẢ ĐÁNH GIÁ CỦA THẦY GIÁO:</span>
                </div>
                <div class="text-xs text-purple-900">
                  ${
                    sub.teacherComment
                      ? `💬 <b>Lời nhận xét:</b> "${window.escapeHtml(sub.teacherComment)}"`
                      : "Thầy đã ghi nhận và chấm điểm sản phẩm thực hành của em."
                  }
                </div>
              </div>
              <div class="text-right">
                <div class="text-3xl font-black text-purple-700">${sub.teacherScore} <span class="text-base text-purple-950">/ 10 đ</span></div>
                <span class="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-purple-200 text-purple-800">
                  +${Math.round(sub.teacherScore * 10) + 20} XP Hoàn thành
                </span>
              </div>
            </div>
          `
            : ""
        }
      </div>
    `;
  }

  /**
   * Render hộp chọn file và nộp bài lên Google Drive
   */
  function renderUploadHomeworkBox(hw, student, sampleFileName, isReuploading) {
    return `
      <div class="border-2 border-dashed border-blue-300 hover:border-blue-500 rounded-2xl p-6 bg-slate-50 transition space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex items-center gap-2">
            <span class="text-2xl">📤</span>
            <div>
              <h4 class="font-extrabold text-slate-900 text-sm">
                ${isReuploading ? "NỘP BẢN CẬP NHẬT MỚI (GHI ĐÈ BẢN CŨ)" : `NỘP SẢN PHẨM BÀI LÀM CHO TIẾT ${hw.period}`}
              </h4>
              <p class="text-xs text-slate-500">
                Chấp nhận các định dạng bảng tính, trình chiếu, văn bản: <code>.xlsx, .pptx, .docx, ảnh, .pdf, .sb3, .zip</code>
              </p>
            </div>
          </div>
          ${
            isReuploading
              ? `<button data-hw-cancel-reupload="${window.escapeHtml(hw.id)}" class="text-xs font-bold text-slate-600 hover:text-slate-900">
                  ✕ Hủy nộp lại
                </button>`
              : ""
          }
        </div>

        <div class="p-4 rounded-xl bg-white border border-slate-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div class="flex-1 w-full space-y-1">
            <label class="block text-xs font-bold text-slate-700 uppercase">
              1. Chọn tệp bài làm hoàn thành từ máy tính:
            </label>
            <input type="file" id="hw-file-input-${hw.id}"
                   accept=".xlsx,.xls,.pptx,.ppt,.docx,.doc,.pdf,.png,.jpg,.jpeg,.webp,.sb3,.zip,.csv"
                   class="w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer" />
            <div id="hw-selected-file-info-${hw.id}" class="text-[11px] text-slate-500 italic mt-1">
              Chưa chọn tệp nào. Tên file trên Google Drive sẽ tự động chuẩn hóa dạng: <b>${sampleFileName}</b>
            </div>
          </div>

          <div class="flex flex-col sm:flex-row items-center gap-2 w-full md:w-auto">
            <button data-hw-submit-btn="${window.escapeHtml(hw.id)}"
                    class="w-full md:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs shadow-lg transition flex items-center justify-center gap-2">
              <span>🚀</span> Nộp Lên Google Drive (+50 XP)
            </button>
          </div>
        </div>

        <div class="text-[11px] text-slate-500 flex items-center gap-2 bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
          <span>ℹ️</span>
          <span>
            Hệ thống Google Apps Script sẽ tự động lưu bài nộp vào thư mục Drive của Thầy Trường theo phân loại:
            <b>Giảng dạy &gt; NOP_BAI_VE_NHA &gt; KHOI_${hw.grade} &gt; Tiet_${String(hw.period).padStart(2, "0")}</b>
          </span>
        </div>
      </div>
    `;
  }

  /**
   * Modal xem phóng to ảnh đề bài
   */
  function renderImagePreviewModal(att) {
    if (!att || !att.dataUrl) return "";

    return `
      <div id="hw-img-preview-modal" class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
          <div class="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <div class="flex items-center gap-2">
              <span class="text-xl">🖼️</span>
              <div>
                <h4 class="font-extrabold text-slate-900 text-sm">${window.escapeHtml(att.name)}</h4>
                <p class="text-xs text-slate-500">Ảnh đề bài / Minh họa mẫu</p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button data-hw-download-att="${window.escapeHtml(att.id)}" data-hw-att-name="${window.escapeHtml(att.name)}"
                      class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                ⬇ Tải ảnh này
              </button>
              <button id="btn-close-hw-img-modal" class="w-8 h-8 rounded-full bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold flex items-center justify-center">
                ✕
              </button>
            </div>
          </div>
          <div class="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-100">
            <img src="${att.dataUrl}" alt="${window.escapeHtml(att.name)}" class="max-w-full max-h-[70vh] rounded-xl shadow border border-slate-300 object-contain" />
          </div>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // 2. GIAO DIỆN QUẢN TRỊ VIÊN: GIAO BÀI TẬP VỀ NHÀ & CHẤM ĐIỂM SẢN PHẨM (ADMIN)
  // ============================================================================
  function renderAdminHomeworkManager() {
    const state = window.AppState || {};
    const assignments = Store.getHomeworkAssignments();
    const subs = Store.getHomeworkSubs();
    const db = Store.loadStudentsDB();

    const activeTab = state.adminHomeworkTab || "list"; // 'list' | 'create' | 'submissions'
    const gradeFilter = state.adminHomeworkGradeFilter || "ALL";

    let filteredAssignments = assignments;
    if (gradeFilter !== "ALL") {
      filteredAssignments = assignments.filter(hw => Number(hw.grade) === Number(gradeFilter));
    }

    // Thống kê nhanh
    const totalAssignments = assignments.length;
    const totalSubs = subs.length;
    const totalGraded = subs.filter(s => typeof s.teacherScore === "number").length;
    const totalWaiting = totalSubs - totalGraded;

    return `
      <div class="space-y-6">
        <!-- Banner Tiêu đề & Tổng quan -->
        <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 shadow-xl border border-indigo-900/50">
          <div class="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <span class="px-3 py-1 rounded-full bg-indigo-500/30 text-indigo-300 text-xs font-extrabold uppercase border border-indigo-400/30">
                  Quản Trị Học Tập
                </span>
                <span class="text-xs text-slate-400">Trường THCS Mão Điền</span>
              </div>
              <h2 class="text-2xl md:text-3xl font-extrabold">🏠 GIAO BÀI TẬP VỀ NHÀ & CHẤM SẢN PHẨM GOOGLE DRIVE</h2>
              <p class="text-xs md:text-sm text-slate-300 max-w-2xl mt-1">
                Giao bài tập về nhà theo từng Tiết học cụ thể; đính kèm tệp dữ liệu thô (.xlsx, ảnh đề bài mẫu...) cho học sinh tải về; nhận sản phẩm và chấm điểm trực tiếp từ thư mục Google Drive.
              </p>
            </div>

            <!-- Thống kê nhanh -->
            <div class="grid grid-cols-4 gap-2 bg-slate-800/80 p-3.5 rounded-2xl border border-slate-700 text-center">
              <div class="px-2">
                <div class="text-2xl font-black text-white">${totalAssignments}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase">Bài đã giao</div>
              </div>
              <div class="px-2 border-l border-slate-700">
                <div class="text-2xl font-black text-emerald-400">${totalSubs}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase">Lượt nộp</div>
              </div>
              <div class="px-2 border-l border-slate-700">
                <div class="text-2xl font-black text-purple-400">${totalGraded}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase">Đã chấm</div>
              </div>
              <div class="px-2 border-l border-slate-700">
                <div class="text-2xl font-black text-amber-400">${totalWaiting}</div>
                <div class="text-[10px] text-slate-400 font-bold uppercase">Chờ chấm</div>
              </div>
            </div>
          </div>

          <!-- Thanh Tabs Quản trị -->
          <div class="mt-6 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-2">
              <button data-ad-hw-tab="list" class="px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "list" ? "bg-indigo-600 text-white shadow" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }">
                📋 Danh Sách Bài Tập Đã Giao (${totalAssignments})
              </button>
              <button data-ad-hw-tab="create" class="px-4 py-2 rounded-xl text-xs font-bold transition ${
                activeTab === "create" ? "bg-indigo-600 text-white shadow" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
              }">
                ➕ Giao Bài Tập Về Nhà Mới
              </button>
              ${
                state.adminHomeworkSelectedId
                  ? `<button data-ad-hw-tab="submissions" class="px-4 py-2 rounded-xl text-xs font-bold transition ${
                      activeTab === "submissions" ? "bg-indigo-600 text-white shadow" : "bg-slate-800 hover:bg-slate-700 text-slate-300"
                    }">
                      📥 Chấm Điểm Bài Nộp Đang Chọn
                    </button>`
                  : ""
              }
            </div>

            <!-- Bộ lọc Khối -->
            ${
              activeTab === "list"
                ? `
                <div class="flex items-center gap-2 text-xs">
                  <span class="text-slate-400 font-bold">Lọc Khối:</span>
                  <select id="ad-hw-grade-filter" class="px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-white font-bold text-xs">
                    <option value="ALL">Tất cả Khối 6, 7, 8, 9</option>
                    <option value="6" ${gradeFilter === "6" ? "selected" : ""}>Khối 6</option>
                    <option value="7" ${gradeFilter === "7" ? "selected" : ""}>Khối 7</option>
                    <option value="8" ${gradeFilter === "8" ? "selected" : ""}>Khối 8</option>
                    <option value="9" ${gradeFilter === "9" ? "selected" : ""}>Khối 9</option>
                  </select>
                </div>
              `
                : ""
            }
          </div>
        </div>

        <!-- Khung Nội dung chính của Quản trị -->
        ${activeTab === "create" ? renderAdminCreateHomeworkForm(db) : ""}
        ${activeTab === "list" ? renderAdminAssignmentsList(filteredAssignments, subs, db) : ""}
        ${activeTab === "submissions" ? renderAdminSubmissionsTable(state.adminHomeworkSelectedId, assignments, subs, db) : ""}
      </div>
    `;
  }

  /**
   * Form Giao Bài Tập Về Nhà Mới (Kèm đính kèm file dữ liệu thô xlsx, ảnh...)
   */
  function renderAdminCreateHomeworkForm(db) {
    const state = window.AppState || {};
    const isEditing = !!state.adminHomeworkEditingId;
    const editingHw = isEditing ? Store.getHomeworkAssignments().find(h => h.id === state.adminHomeworkEditingId) : null;

    const selectedGrade = state.adminHomeworkCreateGrade || (editingHw ? editingHw.grade : 7);
    const selectedPeriod = state.adminHomeworkCreatePeriod || (editingHw ? editingHw.period : 12);
    const selectedClass = state.adminHomeworkCreateClass || (editingHw ? editingHw.targetClass : "ALL");

    const lessonsOfGrade = (Curriculum.lessons || []).filter(l => Number(l.grade) === Number(selectedGrade));
    const classesOfGrade = (db.classes || []).filter(c => Number(c.grade) === Number(selectedGrade));
    const currentLesson = lessonsOfGrade.find(l => Number(l.period) === Number(selectedPeriod)) || lessonsOfGrade[0];

    const pendingFiles = state.adminHomeworkPendingFiles || (editingHw ? editingHw.attachments || [] : []);

    return `
      <div class="bg-white rounded-3xl border border-slate-200 shadow-md p-6 space-y-6">
        <div class="border-b border-slate-200 pb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span class="text-xs font-bold text-indigo-600 uppercase">
              ${isEditing ? "Chỉnh sửa bài tập đã giao" : "Tạo bài tập mới"}
            </span>
            <h3 class="text-xl font-extrabold text-slate-900 mt-0.5">
              ${isEditing ? `✏️ Chỉnh Sửa Bài Tập: ${window.escapeHtml(editingHw.title)}` : "➕ GIAO BÀI TẬP VỀ NHÀ CHO TIẾT HỌC CHỈ ĐỊNH"}
            </h3>
          </div>
          <button id="btn-cancel-create-hw" class="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-xs font-bold text-slate-700">
            ✕ Hủy bỏ & Quay lại
          </button>
        </div>

        <form id="form-create-homework" class="space-y-6">
          <!-- Hàng 1: Khối, Tiết học, Lớp áp dụng -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4 p-5 rounded-2xl bg-indigo-50/60 border border-indigo-200">
            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                1. Chọn Khối Lớp:
              </label>
              <select id="ad-hw-input-grade" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm bg-white">
                <option value="6" ${Number(selectedGrade) === 6 ? "selected" : ""}>Khối 6 (29 Tiết)</option>
                <option value="7" ${Number(selectedGrade) === 7 ? "selected" : ""}>Khối 7 (29 Tiết)</option>
                <option value="8" ${Number(selectedGrade) === 8 ? "selected" : ""}>Khối 8 (29 Tiết)</option>
                <option value="9" ${Number(selectedGrade) === 9 ? "selected" : ""}>Khối 9 (29 Tiết)</option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                2. Chọn Tiết học Phân phối chương trình:
              </label>
              <select id="ad-hw-input-period" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm bg-white">
                ${lessonsOfGrade.map(l => `
                  <option value="${l.period}" ${Number(selectedPeriod) === Number(l.period) ? "selected" : ""}>
                    Tiết ${l.period}: ${window.escapeHtml(l.title)} ${l.isPractical ? "⚡ [Thực hành]" : ""}
                  </option>
                `).join("")}
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                3. Giao cho Lớp nào:
              </label>
              <select id="ad-hw-input-class" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm bg-white">
                <option value="ALL" ${selectedClass === "ALL" ? "selected" : ""}>Tất cả các lớp Khối ${selectedGrade}</option>
                ${classesOfGrade.map(c => `
                  <option value="${c.id}" ${selectedClass === c.id ? "selected" : ""}>
                    ${c.name} (${c.studentCount} Học sinh)
                  </option>
                `).join("")}
              </select>
            </div>
          </div>

          <!-- Tên bài học hiển thị động -->
          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 flex items-center gap-2">
            <span class="text-base">📖</span>
            <span>
              Bài học liên kết SGK: <b>Tiết ${currentLesson ? currentLesson.period : selectedPeriod} — ${window.escapeHtml(currentLesson ? currentLesson.fullTitle || currentLesson.title : "")}</b>
            </span>
          </div>

          <!-- Hàng 2: Tiêu đề & Hạn nộp -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2">
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Tiêu đề Bài tập về nhà: <span class="text-red-500">*</span>
              </label>
              <input type="text" id="ad-hw-input-title" required
                     placeholder="Ví dụ: BTVN Tiết 12: Thiết kế bảng tính theo dõi điểm và tính điểm trung bình môn"
                     value="${editingHw ? window.escapeHtml(editingHw.title) : ""}"
                     class="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-bold text-sm" />
            </div>

            <div>
              <label class="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                Hạn chót nộp bài: <span class="text-red-500">*</span>
              </label>
              <input type="datetime-local" id="ad-hw-input-deadline" required
                     value="${editingHw && editingHw.deadline ? editingHw.deadline : getDefaultDeadlineInputValue()}"
                     class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 font-bold text-sm bg-white" />
            </div>
          </div>

          <!-- Hàng 3: Hướng dẫn & Yêu cầu -->
          <div>
            <label class="block text-xs font-bold text-slate-700 uppercase mb-1.5">
              Nội dung Yêu cầu chi tiết & Hướng dẫn học sinh làm bài: <span class="text-red-500">*</span>
            </label>
            <textarea id="ad-hw-input-desc" rows="5" required
                      placeholder="Nhập chi tiết các bước học sinh cần thực hiện...&#10;1. Tải file Excel mẫu đính kèm bên dưới.&#10;2. Dùng hàm AVERAGE, MAX, MIN tính toán các cột điểm.&#10;3. Kẻ bảng viền xanh và nộp file .xlsx lên Drive."
                      class="w-full px-4 py-3 rounded-xl border border-slate-300 text-sm leading-relaxed">${editingHw ? window.escapeHtml(editingHw.description) : ""}</textarea>
          </div>

          <!-- HÀNG 4: ĐÍNH KÈM TỆP DỮ LIỆU THÔ (.XLSX, HÌNH ẢNH MINH HỌA...) -->
          <div class="p-5 rounded-2xl bg-slate-50 border-2 border-dashed border-indigo-300 space-y-4">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 class="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <span>📎</span> ĐÍNH KÈM TỆP DỮ LIỆU THÔ & ĐỀ BÀI (Để học sinh tải về làm)
                </h4>
                <p class="text-xs text-slate-600 mt-0.5">
                  Thầy có thể chọn tệp Excel mẫu (<code>.xlsx, .csv</code>), ảnh chụp bảng biểu minh họa (<code>.png, .jpg</code>), tệp văn bản (<code>.docx</code>) hoặc slide (<code>.pptx</code>).
                </p>
              </div>

              <div>
                <label for="ad-hw-file-input" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs cursor-pointer inline-flex items-center gap-2 shadow transition">
                  <span>📁</span> Chọn tệp từ máy tính Thầy
                </label>
                <input type="file" id="ad-hw-file-input" multiple
                       accept=".xlsx,.xls,.pptx,.ppt,.docx,.doc,.png,.jpg,.jpeg,.webp,.pdf,.zip,.csv"
                       class="hidden" />
              </div>
            </div>

            <!-- Danh sách các tệp đang đính kèm -->
            <div id="ad-hw-pending-files-list" class="space-y-2">
              ${
                pendingFiles.length === 0
                  ? `<div class="p-6 text-center text-xs text-slate-500 italic bg-white rounded-xl border border-slate-200">
                      Chưa có tệp dữ liệu thô nào được đính kèm. Nhấp nút "Chọn tệp từ máy tính Thầy" để thêm file .xlsx hoặc hình ảnh đề bài.
                    </div>`
                  : pendingFiles.map((f, idx) => {
                      const meta = detectFileType(f.name);
                      return `
                        <div class="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-200 text-xs">
                          <div class="flex items-center gap-3 truncate">
                            <span class="text-xl">${meta.icon}</span>
                            <div>
                              <div class="font-bold text-slate-900 truncate">${window.escapeHtml(f.name)}</div>
                              <div class="text-[11px] text-slate-500">${meta.label} • ${f.sizeKB || 0} KB</div>
                            </div>
                          </div>
                          <div class="flex items-center gap-2">
                            ${
                              meta.type === "image" && f.dataUrl
                                ? `<button type="button" data-ad-preview-img="${idx}" class="px-2.5 py-1 rounded-lg border border-purple-300 text-purple-700 hover:bg-purple-50 font-bold text-xs">
                                    👁 Xem thử
                                  </button>`
                                : ""
                            }
                            <button type="button" data-ad-remove-pending-file="${idx}" class="px-2.5 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs">
                              ✕ Xóa
                            </button>
                          </div>
                        </div>
                      `;
                    }).join("")
              }
            </div>
          </div>

          <!-- Nút hành động -->
          <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button type="button" id="btn-cancel-create-hw-2" class="px-5 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-sm">
              Hủy bỏ
            </button>
            <button type="submit" class="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white font-extrabold text-sm shadow-lg transition flex items-center gap-2">
              <span>🚀</span> ${isEditing ? "Cập Nhật Bài Tập Về Nhà" : "Phát & Giao Bài Tập Về Nhà Ngay"}
            </button>
          </div>
        </form>
      </div>
    `;
  }

  function getDefaultDeadlineInputValue() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    d.setHours(23, 59, 0, 0);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  /**
   * Danh sách bài tập đã giao (Quản trị viên)
   */
  function renderAdminAssignmentsList(assignments, subs, db) {
    if (assignments.length === 0) {
      return `
        <div class="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-4">
          <div class="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-3xl mx-auto">
            🏠
          </div>
          <h3 class="text-lg font-extrabold text-slate-800">Chưa có bài tập về nhà nào được giao!</h3>
          <p class="text-sm text-slate-500 max-w-md mx-auto">
            Thầy hãy bấm nút "➕ Giao Bài Tập Về Nhà Mới" bên trên để giao bài cho các lớp kèm tệp dữ liệu thô (.xlsx, ảnh minh họa).
          </p>
        </div>
      `;
    }

    return `
      <div class="space-y-4">
        ${assignments.map(hw => {
          const hwSubs = subs.filter(s => s.assignmentId === hw.id);
          const gradedCount = hwSubs.filter(s => typeof s.teacherScore === "number").length;
          const deadline = formatDeadline(hw.deadline);

          return `
            <div class="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 hover:shadow transition">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="space-y-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="px-3 py-1 rounded-full bg-indigo-100 text-indigo-900 font-extrabold text-xs">
                      📌 Khối ${hw.grade} • Tiết ${hw.period}
                    </span>
                    <span class="text-xs font-semibold text-slate-500">
                      ${window.escapeHtml(hw.lessonTitle || getLessonTitle(hw.grade, hw.period))}
                    </span>
                    <span class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                      ${hw.targetClass === "ALL" ? `Tất cả lớp Khối ${hw.grade}` : `Lớp ${hw.targetClass}`}
                    </span>
                  </div>
                  <h3 class="text-lg font-extrabold text-slate-900 pt-1">
                    ${window.escapeHtml(hw.title)}
                  </h3>
                </div>

                <div class="flex items-center gap-2">
                  <button data-ad-view-subs="${window.escapeHtml(hw.id)}"
                          class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-sm transition flex items-center gap-1.5">
                    <span>📥</span> Xem bài nộp (${hwSubs.length}) & Chấm điểm
                  </button>
                  <button data-ad-edit-hw="${window.escapeHtml(hw.id)}"
                          class="px-3 py-2 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs">
                    ✏️ Sửa
                  </button>
                  <button data-ad-delete-hw="${window.escapeHtml(hw.id)}"
                          class="px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs">
                    🗑️ Xóa
                  </button>
                </div>
              </div>

              <!-- Nội dung tóm tắt & Hạn nộp -->
              <div class="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                ${window.escapeHtml(hw.description)}
              </div>

              <!-- Danh sách tệp dữ liệu thô đính kèm -->
              ${
                hw.attachments && hw.attachments.length > 0
                  ? `
                  <div class="flex flex-wrap items-center gap-2 pt-1">
                    <span class="text-xs font-bold text-slate-500">📁 Tệp dữ liệu thô đính kèm:</span>
                    ${hw.attachments.map(att => {
                      const meta = detectFileType(att.name);
                      return `
                        <button data-hw-download-att="${window.escapeHtml(att.id)}"
                                data-hw-att-name="${window.escapeHtml(att.name)}"
                                class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition"
                                title="Bấm để tải thử nghiệm">
                          <span>${meta.icon}</span>
                          <span class="truncate max-w-[180px]">${window.escapeHtml(att.name)}</span>
                          <span class="text-[10px] text-slate-500">(${att.sizeKB || 0} KB)</span>
                          <span class="text-blue-600 text-[11px]">⬇</span>
                        </button>
                      `;
                    }).join("")}
                  </div>
                `
                  : `<div class="text-xs text-slate-400 italic">Không có tệp dữ liệu thô đính kèm.</div>`
              }

              <!-- Footer Thẻ: Thống kê nộp bài -->
              <div class="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
                <div class="flex items-center gap-4">
                  <span>⏰ Hạn nộp: <b class="${deadline.isExpired ? "text-red-600" : "text-slate-800"}">${window.escapeHtml(deadline.text)}</b></span>
                  <span>📅 Tạo ngày: <b>${hw.createdAt || "09/11/2026"}</b></span>
                </div>

                <div class="flex items-center gap-3">
                  <span class="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-extrabold text-xs">
                    ✅ Đã nộp: ${hwSubs.length} học sinh
                  </span>
                  <span class="px-2.5 py-1 rounded-full bg-purple-100 text-purple-800 font-extrabold text-xs">
                    ⭐ Đã chấm: ${gradedCount} / ${hwSubs.length} bài
                  </span>
                </div>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  /**
   * Bảng chấm điểm bài nộp của học sinh (Admin Submissions View)
   */
  function renderAdminSubmissionsTable(assignmentId, assignments, subs, db) {
    const hw = assignments.find(h => h.id === assignmentId);
    if (!hw) {
      return `
        <div class="p-6 text-center text-slate-500">
          Không tìm thấy bài tập được chọn. <button data-ad-hw-tab="list" class="text-blue-600 underline font-bold">Quay lại danh sách</button>
        </div>
      `;
    }

    const hwSubs = subs.filter(s => s.assignmentId === hw.id);

    return `
      <div class="bg-white rounded-3xl border border-slate-200 shadow-md p-6 space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <div class="flex items-center gap-2 mb-1">
              <button data-ad-hw-tab="list" class="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700">
                ← Quay lại Danh sách bài tập
              </button>
              <span class="text-xs font-bold text-indigo-600">Khối ${hw.grade} • Tiết ${hw.period}</span>
            </div>
            <h3 class="text-xl font-extrabold text-slate-900">
              📥 BẢNG CHẤM ĐIỂM SẢN PHẨM: ${window.escapeHtml(hw.title)}
            </h3>
            <p class="text-xs text-slate-500 mt-0.5">
              Tổng số học sinh đã nộp: <b>${hwSubs.length}</b> • Đã chấm: <b>${hwSubs.filter(s => typeof s.teacherScore === "number").length}</b> bài
            </p>
          </div>

          <div class="flex items-center gap-2">
            <button id="btn-export-hw-subs-csv" class="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs shadow-sm">
              📊 Xuất Bảng Điểm (.CSV Excel)
            </button>
          </div>
        </div>

        <!-- Bảng danh sách bài nộp -->
        <div class="overflow-x-auto border border-slate-200 rounded-2xl">
          <table class="w-full text-left border-collapse text-xs">
            <thead class="bg-slate-100 text-slate-700 uppercase font-bold sticky top-0">
              <tr>
                <th class="p-3 border-b">STT</th>
                <th class="p-3 border-b">Lớp</th>
                <th class="p-3 border-b">Họ và tên Học sinh</th>
                <th class="p-3 border-b">Thời gian nộp</th>
                <th class="p-3 border-b">Tệp sản phẩm (.xlsx, .pptx, .docx)</th>
                <th class="p-3 border-b text-center">Thao tác tải / xem</th>
                <th class="p-3 border-b text-center" style="width: 140px;">Điểm số (0-10)</th>
                <th class="p-3 border-b" style="width: 250px;">Lời nhận xét của Thầy</th>
                <th class="p-3 border-b text-right">Lưu điểm</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
              ${
                hwSubs.length === 0
                  ? `<tr><td colspan="9" class="p-8 text-center text-slate-500 font-medium italic">Chưa có học sinh nào nộp sản phẩm cho bài tập này.</td></tr>`
                  : hwSubs.map((sub, idx) => {
                      const meta = detectFileType(sub.fileName);
                      const isGraded = typeof sub.teacherScore === "number";

                      return `
                        <tr class="hover:bg-slate-50 transition ${isGraded ? "bg-purple-50/20" : ""}">
                          <td class="p-3 font-bold text-slate-500">${idx + 1}</td>
                          <td class="p-3 font-bold">${window.escapeHtml(sub.className || "")}</td>
                          <td class="p-3 font-bold text-slate-900">
                            <div>${window.escapeHtml(sub.studentName || "")}</div>
                            <div class="text-[10px] text-slate-400 font-normal">Mã: ${window.escapeHtml(sub.studentId || "")}</div>
                          </td>
                          <td class="p-3 text-slate-600">
                            <div>${window.escapeHtml(sub.submittedAt || "")}</div>
                          </td>
                          <td class="p-3">
                            <div class="flex items-center gap-1.5 font-bold text-slate-800">
                              <span>${meta.icon}</span>
                              <span class="truncate max-w-[180px]" title="${window.escapeHtml(sub.fileName || "")}">${window.escapeHtml(sub.fileName || "Tệp nộp")}</span>
                            </div>
                            <div class="text-[10px] text-slate-500">${meta.label} • ${sub.fileSizeKB || 0} KB</div>
                          </td>
                          <td class="p-3 text-center">
                            <div class="flex items-center justify-center gap-1.5">
                              <button data-hw-download-sub="${window.escapeHtml(sub.id)}"
                                      class="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition" title="Tải file học sinh nộp về máy">
                                ⬇ Tải về
                              </button>
                              ${
                                sub.fileUrl
                                  ? `<a href="${window.escapeHtml(sub.fileUrl)}" target="_blank"
                                        class="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs" title="Mở xem trên Google Drive">
                                      🌐 Drive
                                    </a>`
                                  : ""
                              }
                            </div>
                          </td>
                          <td class="p-3 text-center">
                            <input type="number" min="0" max="10" step="0.5"
                                   id="grade-score-${sub.id}"
                                   value="${isGraded ? sub.teacherScore : ""}"
                                   placeholder="Điểm 0-10"
                                   class="w-20 px-2 py-1.5 rounded-lg border border-slate-300 font-extrabold text-center text-sm ${
                                     isGraded ? "bg-purple-50 text-purple-900 border-purple-300" : ""
                                   }" />
                          </td>
                          <td class="p-3">
                            <input type="text"
                                   id="grade-comment-${sub.id}"
                                   value="${isGraded ? window.escapeHtml(sub.teacherComment || "") : ""}"
                                   placeholder="Nhận xét (VD: Dùng đúng hàm AVERAGE, trình bày đẹp...)"
                                   class="w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs" />
                          </td>
                          <td class="p-3 text-right">
                            <button data-ad-save-grade="${window.escapeHtml(sub.id)}"
                                    class="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-sm transition">
                              💾 Lưu
                            </button>
                          </td>
                        </tr>
                      `;
                    }).join("")
              }
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // ============================================================================
  // 3. GẮN SỰ KIỆN TƯƠNG TÁC (EVENT LISTENERS)
  // ============================================================================

  function bindStudentHomeworkEvents() {
    const state = window.AppState || {};

    // 1. Lọc theo trạng thái
    document.querySelectorAll("[data-hw-filter]").forEach(btn => {
      btn.onclick = () => {
        state.homeworkFilterStatus = btn.getAttribute("data-hw-filter");
        if (typeof window.renderApp === "function") window.renderApp();
      };
    });

    // 2. Lọc theo tiết học
    const periodSel = document.getElementById("hw-period-filter");
    if (periodSel) {
      periodSel.onchange = (e) => {
        state.homeworkFilterPeriod = e.target.value;
        if (typeof window.renderApp === "function") window.renderApp();
      };
    }

    // 3. Tải tệp dữ liệu thô đính kèm
    document.querySelectorAll("[data-hw-download-att]").forEach(btn => {
      btn.onclick = () => {
        const attId = btn.getAttribute("data-hw-download-att");
        const assignments = Store.getHomeworkAssignments();
        for (const hw of assignments) {
          const found = (hw.attachments || []).find(a => a.id === attId);
          if (found) {
            triggerFileDownload(found.dataUrl || found.downloadUrl, found.name);
            return;
          }
        }
      };
    });

    // 4. Xem ảnh đề bài phóng to
    document.querySelectorAll("[data-hw-preview-img]").forEach(btn => {
      btn.onclick = () => {
        const attId = btn.getAttribute("data-hw-preview-img");
        const assignments = Store.getHomeworkAssignments();
        for (const hw of assignments) {
          const found = (hw.attachments || []).find(a => a.id === attId);
          if (found) {
            state.homeworkViewingAttachment = found;
            if (typeof window.renderApp === "function") window.renderApp();
            return;
          }
        }
      };
    });

    // Đóng modal ảnh phóng to
    const btnCloseImg = document.getElementById("btn-close-hw-img-modal");
    if (btnCloseImg) {
      btnCloseImg.onclick = () => {
        state.homeworkViewingAttachment = null;
        if (typeof window.renderApp === "function") window.renderApp();
      };
    }

    // 5. Tải bài nộp của học sinh
    document.querySelectorAll("[data-hw-download-sub]").forEach(btn => {
      btn.onclick = () => {
        const subId = btn.getAttribute("data-hw-download-sub");
        const sub = Store.getHomeworkSubs().find(s => s.id === subId);
        if (sub) {
          triggerFileDownload(sub.fileDataUrl || sub.fileUrl, sub.fileName);
        }
      };
    });

    // 6. Nộp lại bài
    document.querySelectorAll("[data-hw-reupload]").forEach(btn => {
      btn.onclick = () => {
        state.studentReuploadingHwId = btn.getAttribute("data-hw-reupload");
        if (typeof window.renderApp === "function") window.renderApp();
      };
    });

    document.querySelectorAll("[data-hw-cancel-reupload]").forEach(btn => {
      btn.onclick = () => {
        state.studentReuploadingHwId = null;
        if (typeof window.renderApp === "function") window.renderApp();
      };
    });

    // 7. Lắng nghe thay đổi chọn file nộp của học sinh
    document.querySelectorAll("input[id^='hw-file-input-']").forEach(input => {
      input.onchange = (e) => {
        const hwId = input.id.replace("hw-file-input-", "");
        const file = e.target.files?.[0];
        const infoDiv = document.getElementById(`hw-selected-file-info-${hwId}`);
        if (infoDiv && file) {
          const sizeKB = Math.round(file.size / 1024);
          infoDiv.innerHTML = `Đã chọn: <b class="text-blue-700">${window.escapeHtml(file.name)}</b> (${sizeKB} KB). Bấm nút nộp bên phải để gửi lên Google Drive!`;
        }
      };
    });

    // 8. Bấm nút Nộp bài lên Google Drive qua GAS
    document.querySelectorAll("[data-hw-submit-btn]").forEach(btn => {
      btn.onclick = async () => {
        const hwId = btn.getAttribute("data-hw-submit-btn");
        const fileInput = document.getElementById(`hw-file-input-${hwId}`);
        const file = fileInput?.files?.[0];

        if (!file) {
          if (typeof window.showToast === "function") {
            window.showToast("Em hãy chọn tệp sản phẩm (.xlsx, .pptx, .docx...) trước khi bấm nộp!", "error");
          } else {
            alert("Em hãy chọn tệp sản phẩm trước khi bấm nộp!");
          }
          return;
        }

        const hw = Store.getHomeworkAssignments().find(h => h.id === hwId);
        if (!hw) return;

        const student = state.currentUser;
        if (!student) return;

        // Đổi trạng thái nút bấm loading
        const originalBtnText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<span>⏳</span> Đang tải lên Drive...`;

        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target.result;
          const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : "";
          const sizeKB = Math.round(file.size / 1024);

          // Tên file chuẩn hóa
          const cleanStudentName = (student.fullName || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^a-zA-Z0-9]/g, "");
          const cleanOriginalFileName = file.name.replace(/\s+/g, "_");
          const standardizedFileName = `[BTVN]_${student.className}_${cleanStudentName}_Tiet${String(hw.period).padStart(2, "0")}_${cleanOriginalFileName}`;

          const gasCfg = Store.getGasConfig();
          let driveFileUrl = dataUrl;

          // Nếu có cấu hình GAS Web App URL, thực hiện tải lên Google Drive
          if (gasCfg.gasWebAppUrl && gasCfg.gasWebAppUrl.startsWith("http")) {
            try {
              const res = await fetch(gasCfg.gasWebAppUrl, {
                method: "POST",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                  action: "uploadHomeworkFile",
                  driveFolderId: gasCfg.driveFolderId,
                  grade: hw.grade,
                  period: hw.period,
                  className: student.className,
                  studentId: student.id,
                  studentName: student.fullName,
                  assignmentId: hw.id,
                  assignmentTitle: hw.title,
                  fileName: file.name,
                  standardizedFileName: standardizedFileName,
                  mimeType: file.type,
                  base64Data: base64Data
                })
              });
              const json = await res.json();
              if (json && json.fileUrl) {
                driveFileUrl = json.fileUrl;
              }
            } catch (err) {
              console.warn("GAS Drive Homework Upload fallback:", err);
            }
          }

          // Lưu bài nộp vào Store
          const subRecord = {
            id: "HWSUB_" + hw.id + "_" + student.id,
            assignmentId: hw.id,
            assignmentTitle: hw.title,
            grade: hw.grade,
            period: hw.period,
            className: student.className,
            studentId: student.id,
            studentName: student.fullName,
            fileName: standardizedFileName,
            fileSizeKB: sizeKB,
            fileDataUrl: dataUrl,
            fileUrl: driveFileUrl,
            teacherScore: null,
            teacherComment: ""
          };

          Store.saveHomeworkSubmission(subRecord);

          // Thưởng 50 XP nộp bài về nhà
          const db = Store.loadStudentsDB();
          const st = db.students.find(s => s.id === student.id);
          if (st) {
            st.xp = (Number(st.xp) || 0) + 50;
            st.level = Math.floor(st.xp / 500) + 1;
            Store.saveStudentsDB(db);
          }

          state.studentReuploadingHwId = null;
          if (typeof window.showToast === "function") {
            window.showToast(`Đã nộp "${standardizedFileName}" vào Google Drive thành công! (+50 XP)`);
          }
          if (typeof window.renderApp === "function") window.renderApp();
        };

        reader.readAsDataURL(file);
      };
    });
  }

  function bindAdminHomeworkEvents() {
    const state = window.AppState || {};

    // 1. Chuyển tab con trong Quản trị BTVN
    document.querySelectorAll("[data-ad-hw-tab]").forEach(btn => {
      btn.onclick = () => {
        state.adminHomeworkTab = btn.getAttribute("data-ad-hw-tab");
        if (state.adminHomeworkTab === "create") {
          state.adminHomeworkEditingId = null;
          state.adminHomeworkPendingFiles = [];
        }
        if (typeof window.renderApp === "function") window.renderApp();
      };
    });

    // 2. Lọc Khối trong danh sách BTVN
    const gradeFilterSel = document.getElementById("ad-hw-grade-filter");
    if (gradeFilterSel) {
      gradeFilterSel.onchange = (e) => {
        state.adminHomeworkGradeFilter = e.target.value;
        if (typeof window.renderApp === "function") window.renderApp();
      };
    }

    // 3. Thay đổi Khối khi tạo bài tập mới
    const inputGradeSel = document.getElementById("ad-hw-input-grade");
    if (inputGradeSel) {
      inputGradeSel.onchange = (e) => {
        state.adminHomeworkCreateGrade = Number(e.target.value);
        state.adminHomeworkCreatePeriod = 1;
        state.adminHomeworkCreateClass = "ALL";
        if (typeof window.renderApp === "function") window.renderApp();
      };
    }

    const inputPeriodSel = document.getElementById("ad-hw-input-period");
    if (inputPeriodSel) {
      inputPeriodSel.onchange = (e) => {
        state.adminHomeworkCreatePeriod = Number(e.target.value);
        if (typeof window.renderApp === "function") window.renderApp();
      };
    }

    // 4. Hủy form tạo bài tập
    const btnCancel1 = document.getElementById("btn-cancel-create-hw");
    const btnCancel2 = document.getElementById("btn-cancel-create-hw-2");
    if (btnCancel1) btnCancel1.onclick = () => { state.adminHomeworkTab = "list"; if (typeof window.renderApp === "function") window.renderApp(); };
    if (btnCancel2) btnCancel2.onclick = () => { state.adminHomeworkTab = "list"; if (typeof window.renderApp === "function") window.renderApp(); };

    // 5. Chọn tệp đính kèm dữ liệu thô (XLSX, ảnh...) từ máy Giáo viên
    const adFileInput = document.getElementById("ad-hw-file-input");
    if (adFileInput) {
      adFileInput.onchange = (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        if (!state.adminHomeworkPendingFiles) state.adminHomeworkPendingFiles = [];

        let readCount = 0;
        files.forEach((file, i) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target.result;
            const sizeKB = Math.round(file.size / 1024);
            const fileItem = {
              id: "att_" + Date.now() + "_" + i + "_" + Math.random().toString(36).substring(2, 6),
              name: file.name,
              sizeKB: sizeKB,
              type: detectFileType(file.name).type,
              mimeType: file.type,
              dataUrl: dataUrl
            };
            state.adminHomeworkPendingFiles.push(fileItem);

            readCount++;
            if (readCount === files.length) {
              if (typeof window.renderApp === "function") window.renderApp();
              if (typeof window.showToast === "function") {
                window.showToast(`Đã đính kèm ${files.length} tệp dữ liệu thô!`);
              }
            }
          };
          reader.readAsDataURL(file);
        });
      };
    }

    // 6. Xóa tệp khỏi danh sách đính kèm
    document.querySelectorAll("[data-ad-remove-pending-file]").forEach(btn => {
      btn.onclick = () => {
        const idx = Number(btn.getAttribute("data-ad-remove-pending-file"));
        if (state.adminHomeworkPendingFiles && state.adminHomeworkPendingFiles[idx]) {
          state.adminHomeworkPendingFiles.splice(idx, 1);
          if (typeof window.renderApp === "function") window.renderApp();
        }
      };
    });

    // 7. Submit form Tạo / Sửa bài tập về nhà
    const formCreate = document.getElementById("form-create-homework");
    if (formCreate) {
      formCreate.onsubmit = (e) => {
        e.preventDefault();
        const grade = Number(document.getElementById("ad-hw-input-grade")?.value || 7);
        const period = Number(document.getElementById("ad-hw-input-period")?.value || 12);
        const targetClass = document.getElementById("ad-hw-input-class")?.value || "ALL";
        const title = document.getElementById("ad-hw-input-title")?.value?.trim();
        const deadline = document.getElementById("ad-hw-input-deadline")?.value;
        const description = document.getElementById("ad-hw-input-desc")?.value?.trim();

        if (!title || !description) {
          if (typeof window.showToast === "function") window.showToast("Vui lòng nhập đầy đủ tiêu đề và nội dung bài tập!", "error");
          return;
        }

        const now = new Date();
        const createdDateStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

        const hwObject = {
          id: state.adminHomeworkEditingId || ("HW_G" + grade + "_T" + String(period).padStart(2, "0") + "_" + Date.now()),
          grade: grade,
          period: period,
          targetClass: targetClass,
          title: title,
          lessonTitle: getLessonTitle(grade, period),
          deadline: deadline,
          createdAt: createdDateStr,
          description: description,
          attachments: state.adminHomeworkPendingFiles || []
        };

        Store.addOrUpdateHomeworkAssignment(hwObject);
        state.adminHomeworkTab = "list";
        state.adminHomeworkEditingId = null;
        state.adminHomeworkPendingFiles = [];

        if (typeof window.showToast === "function") {
          window.showToast(`🎉 Đã giao bài tập Tiết ${period} cho Lớp ${targetClass}! Đã phát tín hiệu Realtime.`);
        }
        if (typeof window.renderApp === "function") window.renderApp();
      };
    }

    // 8. Xem danh sách bài nộp của 1 bài tập
    document.querySelectorAll("[data-ad-view-subs]").forEach(btn => {
      btn.onclick = () => {
        state.adminHomeworkSelectedId = btn.getAttribute("data-ad-view-subs");
        state.adminHomeworkTab = "submissions";
        if (typeof window.renderApp === "function") window.renderApp();
      };
    });

    // 9. Sửa bài tập đã giao
    document.querySelectorAll("[data-ad-edit-hw]").forEach(btn => {
      btn.onclick = () => {
        const hwId = btn.getAttribute("data-ad-edit-hw");
        const hw = Store.getHomeworkAssignments().find(h => h.id === hwId);
        if (hw) {
          state.adminHomeworkEditingId = hw.id;
          state.adminHomeworkTab = "create";
          state.adminHomeworkCreateGrade = hw.grade;
          state.adminHomeworkCreatePeriod = hw.period;
          state.adminHomeworkCreateClass = hw.targetClass || "ALL";
          state.adminHomeworkPendingFiles = JSON.parse(JSON.stringify(hw.attachments || []));
          if (typeof window.renderApp === "function") window.renderApp();
        }
      };
    });

    // 10. Xóa bài tập
    document.querySelectorAll("[data-ad-delete-hw]").forEach(btn => {
      btn.onclick = () => {
        const hwId = btn.getAttribute("data-ad-delete-hw");
        if (confirm("Thầy có chắc chắn muốn xóa bài tập về nhà này không? Toàn bộ bài nộp liên quan sẽ bị xóa.")) {
          Store.deleteHomeworkAssignment(hwId);
          if (typeof window.showToast === "function") {
            window.showToast("Đã xóa bài tập về nhà thành công!");
          }
          if (typeof window.renderApp === "function") window.renderApp();
        }
      };
    });

    // 11. Lưu điểm và lời nhận xét
    document.querySelectorAll("[data-ad-save-grade]").forEach(btn => {
      btn.onclick = () => {
        const subId = btn.getAttribute("data-ad-save-grade");
        const scoreInput = document.getElementById(`grade-score-${subId}`);
        const commentInput = document.getElementById(`grade-comment-${subId}`);

        const score = parseFloat(scoreInput?.value);
        if (isNaN(score) || score < 0 || score > 10) {
          if (typeof window.showToast === "function") window.showToast("Vui lòng nhập điểm hợp lệ từ 0 đến 10!", "error");
          return;
        }

        const comment = commentInput?.value || "";
        Store.gradeHomeworkSub(subId, score, comment);

        if (typeof window.showToast === "function") {
          window.showToast(`Đã lưu kết quả chấm: ${score} điểm! (Học sinh được cộng +${Math.round(score * 10) + 20} XP)`);
        }
        if (typeof window.renderApp === "function") window.renderApp();
      };
    });

    // 12. Xuất bảng điểm BTVN dạng CSV Excel
    const btnExportCsv = document.getElementById("btn-export-hw-subs-csv");
    if (btnExportCsv) {
      btnExportCsv.onclick = () => {
        const hwId = state.adminHomeworkSelectedId;
        const hw = Store.getHomeworkAssignments().find(h => h.id === hwId);
        const subs = Store.getHomeworkSubs().filter(s => s.assignmentId === hwId);

        const rows = [
          ["STT", "Khối", "Lớp", "Tiết học", "Họ và tên", "Mã HS", "Tên file nộp", "Thời gian nộp", "Điểm số", "Lời nhận xét của Thầy", "Link Drive"]
        ];

        subs.forEach((s, idx) => {
          rows.push([
            idx + 1,
            s.grade || "",
            s.className || "",
            s.period || "",
            `"${(s.studentName || '').replace(/"/g, '""')}"`,
            s.studentId || "",
            `"${(s.fileName || '').replace(/"/g, '""')}"`,
            s.submittedAt || "",
            typeof s.teacherScore === "number" ? s.teacherScore : "",
            `"${(s.teacherComment || '').replace(/"/g, '""')}"`,
            s.fileUrl || ""
          ]);
        });

        const csvContent = "\uFEFF" + rows.map(r => r.join(",")).join("\r\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const safeTitle = (hw?.title || "BTVN").replace(/[^a-zA-Z0-9]/g, "_");
        triggerFileDownload(url, `Bang_Diem_${safeTitle}.csv`);
      };
    }
  }

  return {
    triggerFileDownload,
    detectFileType,
    formatDeadline,
    renderStudentHomeworkView,
    renderAdminHomeworkManager,
    bindStudentHomeworkEvents,
    bindAdminHomeworkEvents
  };
})();
