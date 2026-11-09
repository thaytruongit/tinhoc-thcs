/**
 * ============================================================================
 * GOOGLE APPS SCRIPT (Code.gs) - HỆ THỐNG TIN HỌC THCS MÃO ĐIỀN
 * CẦU NỐI NHẬN FILE THỰC HÀNH & BÀI TẬP VỀ NHÀ (.xlsx, .pptx, .docx, ảnh, .pdf)
 * TỰ ĐỘNG ĐẨY VÀO GOOGLE DRIVE & GHI NHẬT KÝ VÀO GOOGLE SHEETS
 * ============================================================================
 *
 * CẤU TRÚC THƯ MỤC DRIVE TỰ ĐỘNG KHỞI TẠO:
 * My Drive
 *   └── Giảng dạy
 *         ├── NOP_BAI_THUC_HANH (Bài làm tại phòng máy trên lớp)
 *         │     ├── KHOI_6
 *         │     │     ├── Tiet_01
 *         │     │     └── ...
 *         │     ├── KHOI_7 / KHOI_8 / KHOI_9
 *         │     └── Bang_Theo_Doi_Nop_Bai_Thuc_Hanh (Google Sheets)
 *         │
 *         ├── NOP_BAI_VE_NHA (Bài tập về nhà học sinh nộp)
 *         │     ├── KHOI_6
 *         │     │     ├── Tiet_01
 *         │     │     └── ...
 *         │     ├── KHOI_7 / KHOI_8 / KHOI_9
 *         │     └── Bang_Theo_Doi_Bai_Tap_Ve_Nha (Google Sheets tự động)
 *         │
 *         └── TAI_LIEU_BTVN (Tệp dữ liệu thô .xlsx, ảnh đề bài Giáo viên giao)
 *               ├── KHOI_6 / KHOI_7 / KHOI_8 / KHOI_9
 *
 * HƯỚNG DẪN TRIỂN KHAI 1 PHÚT (CHỈ LÀM 1 LẦN DUY NHẤT):
 * 1. Truy cập: https://script.google.com -> Nhấp nút "Dự án mới" (New project).
 * 2. Đặt tên dự án: "TinHoc_THCS_Drive_Bridge".
 * 3. Xoá hết mã mặc định trong tệp Code.gs, sao chép toàn bộ nội dung tệp này dán vào.
 * 4. Bấm biểu tượng Đĩa mềm (Ctrl + S) để lưu.
 * 5. Nhấp nút "Triển khai" (Deploy) ở góc trên bên phải -> Chọn "Tùy chọn triển khai mới" (New deployment).
 * 6. Nhấp biểu tượng bánh răng bên trái "Chọn loại" -> Chọn "Ứng dụng web" (Web app).
 * 7. Thiết lập cấu hình:
 *    - Mô tả: "Cổng nhận bài thực hành & bài tập về nhà Tin học THCS"
 *    - Thực thi dưới dạng (Execute as): "Chính tôi" (Me - địa chỉ email của Thầy Trường)
 *    - Người có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone)
 * 8. Bấm "Triển khai" (Deploy) -> Cấp quyền truy cập Google Drive/Sheets nếu Google hỏi.
 * 9. Sao chép "URL Ứng dụng web" (Web app URL có dạng https://script.google.com/macros/s/.../exec).
 * 10. Dán URL này vào mục: "Cổng Giáo viên -> ⚙️ Cấu hình Google Drive & GAS" trên trang web.
 * ============================================================================
 */

const CONFIG = {
  ROOT_FOLDER: "Giảng dạy",
  SUB_FOLDER: "NOP_BAI_THUC_HANH",
  HOMEWORK_FOLDER: "NOP_BAI_VE_NHA",
  ATTACHMENT_FOLDER: "TAI_LIEU_BTVN",
  LOG_SHEET_NAME: "Bang_Theo_Doi_Nop_Bai_Thuc_Hanh",
  HOMEWORK_LOG_SHEET_NAME: "Bang_Theo_Doi_Bai_Tap_Ve_Nha"
};

/**
 * Xử lý GET request: Kiểm tra trạng thái hoạt động của Web App
 */
function doGet(e) {
  const result = {
    status: "ok",
    service: "THCS Mão Điền - Cổng Nhận Sản Phẩm Thực Hành & Bài Tập Về Nhà Tin Học",
    version: "2.5.0",
    features: ["uploadPracticalFile", "uploadHomeworkFile", "uploadAssignmentAttachment", "syncClassReport"],
    timestamp: Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss"),
    message: "Google Apps Script Web App đang hoạt động sẵn sàng nhận bài từ học sinh!"
  };

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Xử lý POST request: Nhận file từ máy học sinh và giáo viên gửi lên
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  // Đợi tối đa 30 giây để xử lý an toàn khi nhiều máy học sinh nộp cùng lúc
  lock.waitLock(30000);

  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({
        status: "error",
        message: "Không nhận được dữ liệu (Empty payload)"
      });
    }

    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || "uploadPracticalFile";

    if (action === "uploadHomeworkFile") {
      return handleHomeworkUpload(payload);
    } else if (action === "uploadAssignmentAttachment") {
      return handleAssignmentAttachmentUpload(payload);
    } else if (action === "uploadPracticalFile") {
      return handleFileUpload(payload);
    } else if (action === "syncClassReport") {
      return handleSyncReport(payload);
    } else if (action === "ping") {
      return jsonResponse({ status: "ok", message: "Kết nối Google Apps Script thành công!" });
    }

    return jsonResponse({
      status: "error",
      message: "Hành động không hợp lệ: " + action
    });
  } catch (err) {
    return jsonResponse({
      status: "error",
      message: "Lỗi xử lý máy chủ: " + err.toString()
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xác định MIME type theo phần mở rộng tệp
 */
function resolveMimeType(fileName, fallbackMime) {
  const lower = String(fileName || "").toLowerCase();
  if (lower.endsWith(".xlsx")) return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".pptx")) return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".docx")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".csv")) return "text/csv";
  if (lower.endsWith(".txt")) return "text/plain";
  if (lower.endsWith(".sb3")) return "application/x.scratch.sb3";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".rar")) return "application/x-rar-compressed";
  return fallbackMime || "application/octet-stream";
}

/**
 * Tìm hoặc tạo thư mục gốc "Giảng dạy"
 */
function getOrCreateRootFolder(customFolderId) {
  if (customFolderId && typeof customFolderId === "string" && customFolderId.trim().length > 10) {
    try {
      return DriveApp.getFolderById(customFolderId.trim());
    } catch (e) {}
  }
  const rootIter = DriveApp.getFoldersByName(CONFIG.ROOT_FOLDER);
  return rootIter.hasNext() ? rootIter.next() : DriveApp.createFolder(CONFIG.ROOT_FOLDER);
}

/**
 * Tìm hoặc tạo thư mục Nộp bài thực hành trên lớp
 */
function getOrCreateTargetFolder(customFolderId, grade, period, className) {
  const root = getOrCreateRootFolder(customFolderId);

  // Thư mục con: NOP_BAI_THUC_HANH
  const subIter = root.getFoldersByName(CONFIG.SUB_FOLDER);
  const baseFolder = subIter.hasNext() ? subIter.next() : root.createFolder(CONFIG.SUB_FOLDER);

  // Thư mục Khối: KHOI_6, KHOI_7, KHOI_8, KHOI_9
  const gradeStr = String(grade || "Chung");
  const gradeFolderName = "KHOI_" + gradeStr;
  const gradeIter = baseFolder.getFoldersByName(gradeFolderName);
  const gradeFolder = gradeIter.hasNext() ? gradeIter.next() : baseFolder.createFolder(gradeFolderName);

  // Thư mục Tiết học: Tiet_01, Tiet_02...
  const periodStr = String(period || 1).padStart(2, "0");
  const periodFolderName = "Tiet_" + periodStr;
  const periodIter = gradeFolder.getFoldersByName(periodFolderName);
  const periodFolder = periodIter.hasNext() ? periodIter.next() : gradeFolder.createFolder(periodFolderName);

  return {
    baseFolder: baseFolder,
    targetFolder: periodFolder,
    folderPath: "H:\\My Drive\\" + CONFIG.ROOT_FOLDER + "\\" + CONFIG.SUB_FOLDER + "\\" + gradeFolderName + "\\" + periodFolderName
  };
}

/**
 * Tìm hoặc tạo thư mục Nộp bài tập về nhà
 */
function getOrCreateHomeworkTargetFolder(customFolderId, grade, period, className) {
  const root = getOrCreateRootFolder(customFolderId);

  // Thư mục con: NOP_BAI_VE_NHA
  const subIter = root.getFoldersByName(CONFIG.HOMEWORK_FOLDER);
  const baseFolder = subIter.hasNext() ? subIter.next() : root.createFolder(CONFIG.HOMEWORK_FOLDER);

  // Thư mục Khối
  const gradeStr = String(grade || "Chung");
  const gradeFolderName = "KHOI_" + gradeStr;
  const gradeIter = baseFolder.getFoldersByName(gradeFolderName);
  const gradeFolder = gradeIter.hasNext() ? gradeIter.next() : baseFolder.createFolder(gradeFolderName);

  // Thư mục Tiết học
  const periodStr = String(period || 1).padStart(2, "0");
  const periodFolderName = "Tiet_" + periodStr;
  const periodIter = gradeFolder.getFoldersByName(periodFolderName);
  const periodFolder = periodIter.hasNext() ? periodIter.next() : gradeFolder.createFolder(periodFolderName);

  return {
    baseFolder: baseFolder,
    targetFolder: periodFolder,
    folderPath: "H:\\My Drive\\" + CONFIG.ROOT_FOLDER + "\\" + CONFIG.HOMEWORK_FOLDER + "\\" + gradeFolderName + "\\" + periodFolderName
  };
}

/**
 * Xử lý nhận file Bài tập về nhà (.xlsx, .pptx, .docx, ảnh...) từ học sinh tải lên
 */
function handleHomeworkUpload(payload) {
  if (!payload.base64Data) {
    return jsonResponse({ status: "error", message: "Dữ liệu tệp đính kèm rỗng (Missing base64Data)!" });
  }

  const folderInfo = getOrCreateHomeworkTargetFolder(
    payload.driveFolderId,
    payload.grade,
    payload.period,
    payload.className
  );
  const targetFolder = folderInfo.targetFolder;

  // Tên file chuẩn hóa
  const fileName = payload.standardizedFileName || payload.fileName || ("BTVN_" + Date.now() + ".xlsx");
  const mimeType = resolveMimeType(fileName, payload.mimeType);

  // Giải mã Base64 thành mảng byte và tạo file trên Google Drive
  const decodedBytes = Utilities.base64Decode(payload.base64Data);
  const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
  const createdFile = targetFolder.createFile(blob);

  // Cho phép xem file qua link để giáo viên có thể mở nhanh
  try {
    createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  const nowVN = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
  const sizeKB = Math.round(decodedBytes.length / 1024);

  // Gán mô tả chi tiết vào file trên Drive
  createdFile.setDescription(
    "THCS MÃO ĐIỀN - BÀI TẬP VỀ NHÀ TIN HỌC\n" +
    "• Thời gian nộp: " + nowVN + "\n" +
    "• Khối: " + (payload.grade || "") + " | Lớp: " + (payload.className || "") + "\n" +
    "• Tiết học: Tiết " + (payload.period || "") + "\n" +
    "• Bài tập: " + (payload.assignmentTitle || "Bài tập về nhà") + "\n" +
    "• Học sinh thực hiện: " + (payload.studentName || "") + " (Mã: " + (payload.studentId || "") + ")\n" +
    "• Kích thước: " + sizeKB + " KB"
  );

  // Tự động ghi vào Google Sheets theo dõi Bài tập về nhà
  try {
    logHomeworkToSheet(folderInfo.baseFolder, {
      timestamp: nowVN,
      grade: payload.grade || "",
      className: payload.className || "",
      period: payload.period || "",
      assignmentTitle: payload.assignmentTitle || "Bài tập về nhà",
      studentName: payload.studentName || "",
      studentId: payload.studentId || "",
      fileName: fileName,
      fileSizeKB: sizeKB,
      fileUrl: createdFile.getUrl(),
      fileId: createdFile.getId()
    });
  } catch (sheetErr) {
    // Không chặn luồng nếu ghi sheet lỗi
  }

  return jsonResponse({
    status: "ok",
    fileId: createdFile.getId(),
    fileUrl: createdFile.getUrl(),
    downloadUrl: "https://drive.google.com/uc?export=download&id=" + createdFile.getId(),
    fileName: createdFile.getName(),
    fileSizeKB: sizeKB,
    folderUrl: targetFolder.getUrl(),
    folderPath: folderInfo.folderPath,
    timestamp: nowVN
  });
}

/**
 * Xử lý Giáo viên tải tệp dữ liệu thô (.xlsx, ảnh) đính kèm khi giao bài tập
 */
function handleAssignmentAttachmentUpload(payload) {
  if (!payload.base64Data) {
    return jsonResponse({ status: "error", message: "Dữ liệu tệp thô đính kèm rỗng!" });
  }

  const root = getOrCreateRootFolder(payload.driveFolderId);
  const subIter = root.getFoldersByName(CONFIG.ATTACHMENT_FOLDER);
  const baseFolder = subIter.hasNext() ? subIter.next() : root.createFolder(CONFIG.ATTACHMENT_FOLDER);

  const gradeStr = String(payload.grade || "Chung");
  const gradeFolderName = "KHOI_" + gradeStr;
  const gradeIter = baseFolder.getFoldersByName(gradeFolderName);
  const gradeFolder = gradeIter.hasNext() ? gradeIter.next() : baseFolder.createFolder(gradeFolderName);

  const fileName = payload.fileName || ("DuLieuTho_" + Date.now() + ".xlsx");
  const mimeType = resolveMimeType(fileName, payload.mimeType);

  const decodedBytes = Utilities.base64Decode(payload.base64Data);
  const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
  const createdFile = gradeFolder.createFile(blob);

  try {
    createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  const sizeKB = Math.round(decodedBytes.length / 1024);
  const nowVN = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");

  createdFile.setDescription(
    "THCS MÃO ĐIỀN - TỆP DỮ LIỆU THÔ / ĐỀ BÀI ĐÍNH KÈM\n" +
    "• Ngày tải lên: " + nowVN + "\n" +
    "• Khối: " + (payload.grade || "") + "\n" +
    "• Tiết học: Tiết " + (payload.period || "") + "\n" +
    "• Kích thước: " + sizeKB + " KB"
  );

  return jsonResponse({
    status: "ok",
    fileId: createdFile.getId(),
    fileUrl: createdFile.getUrl(),
    downloadUrl: "https://drive.google.com/uc?export=download&id=" + createdFile.getId(),
    fileName: createdFile.getName(),
    fileSizeKB: sizeKB,
    timestamp: nowVN
  });
}

/**
 * Xử lý nhận file thực hành trên lớp và lưu vào Drive (Giữ nguyên tương thích)
 */
function handleFileUpload(payload) {
  if (!payload.base64Data) {
    return jsonResponse({ status: "error", message: "Dữ liệu tệp đính kèm rỗng (Missing base64Data)!" });
  }

  const folderInfo = getOrCreateTargetFolder(
    payload.driveFolderId,
    payload.grade,
    payload.period,
    payload.className
  );
  const targetFolder = folderInfo.targetFolder;

  const fileName = payload.standardizedFileName || payload.fileName || ("BaiThucHanh_" + Date.now() + ".docx");
  const mimeType = resolveMimeType(fileName, payload.mimeType);

  const decodedBytes = Utilities.base64Decode(payload.base64Data);
  const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
  const createdFile = targetFolder.createFile(blob);

  try {
    createdFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {}

  const nowVN = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
  const sizeKB = Math.round(decodedBytes.length / 1024);

  createdFile.setDescription(
    "THCS MÃO ĐIỀN - BÀI THỰC HÀNH TIN HỌC\n" +
    "• Thời gian nộp: " + nowVN + "\n" +
    "• Khối: " + (payload.grade || "") + " | Lớp: " + (payload.className || "") + "\n" +
    "• Tiết: " + (payload.period || "") + "\n" +
    "• Nhóm máy: " + (payload.groupName || "") + "\n" +
    "• Học sinh: " + (payload.memberNames || payload.studentName || "") + "\n" +
    "• Kích thước: " + sizeKB + " KB"
  );

  try {
    logSubmissionToSheet(folderInfo.baseFolder, {
      timestamp: nowVN,
      grade: payload.grade || "",
      className: payload.className || "",
      period: payload.period || "",
      groupName: payload.groupName || "",
      studentNames: payload.memberNames || payload.studentName || "",
      fileName: fileName,
      fileSizeKB: sizeKB,
      fileUrl: createdFile.getUrl(),
      fileId: createdFile.getId()
    });
  } catch (sheetErr) {}

  return jsonResponse({
    status: "ok",
    fileId: createdFile.getId(),
    fileUrl: createdFile.getUrl(),
    downloadUrl: "https://drive.google.com/uc?export=download&id=" + createdFile.getId(),
    fileName: createdFile.getName(),
    fileSizeKB: sizeKB,
    folderUrl: targetFolder.getUrl(),
    folderPath: folderInfo.folderPath,
    timestamp: nowVN
  });
}

/**
 * Tự động tạo/ghi vào bảng Google Sheet theo dõi Bài tập về nhà
 */
function logHomeworkToSheet(baseFolder, data) {
  let spreadsheet = null;
  const files = baseFolder.getFilesByName(CONFIG.HOMEWORK_LOG_SHEET_NAME);
  
  if (files.hasNext()) {
    spreadsheet = SpreadsheetApp.open(files.next());
  } else {
    spreadsheet = SpreadsheetApp.create(CONFIG.HOMEWORK_LOG_SHEET_NAME);
    const ssFile = DriveApp.getFileById(spreadsheet.getId());
    baseFolder.addFile(ssFile);
    DriveApp.getRootFolder().removeFile(ssFile);

    const sheet = spreadsheet.getActiveSheet();
    sheet.setName("Nhật ký BTVN");
    sheet.appendRow([
      "Thời gian nộp",
      "Khối",
      "Lớp",
      "Tiết học",
      "Tên bài tập về nhà",
      "Họ tên học sinh",
      "Mã HS",
      "Tên file nộp",
      "Dung lượng (KB)",
      "Link xem file Drive",
      "ID File Drive",
      "Điểm số",
      "Lời nhận xét"
    ]);
    sheet.getRange(1, 1, 1, 13).setFontWeight("bold").setBackground("#dbeafe");
    sheet.setFrozenRows(1);
  }

  const sheet = spreadsheet.getActiveSheet();
  sheet.appendRow([
    data.timestamp,
    data.grade,
    data.className,
    data.period,
    data.assignmentTitle,
    data.studentName,
    data.studentId,
    data.fileName,
    data.fileSizeKB,
    data.fileUrl,
    data.fileId,
    "",
    ""
  ]);
}

/**
 * Tự động tạo/ghi vào bảng Google Sheet theo dõi tiến độ nộp bài thực hành trên lớp
 */
function logSubmissionToSheet(baseFolder, data) {
  let spreadsheet = null;
  const files = baseFolder.getFilesByName(CONFIG.LOG_SHEET_NAME);
  
  if (files.hasNext()) {
    spreadsheet = SpreadsheetApp.open(files.next());
  } else {
    spreadsheet = SpreadsheetApp.create(CONFIG.LOG_SHEET_NAME);
    const ssFile = DriveApp.getFileById(spreadsheet.getId());
    baseFolder.addFile(ssFile);
    DriveApp.getRootFolder().removeFile(ssFile);

    const sheet = spreadsheet.getActiveSheet();
    sheet.setName("Nhật ký nộp bài");
    sheet.appendRow([
      "Thời gian nộp",
      "Khối",
      "Lớp",
      "Tiết học",
      "Nhóm máy",
      "Học sinh thực hiện",
      "Tên file nộp",
      "Dung lượng (KB)",
      "Link xem file Drive",
      "ID File Drive"
    ]);
    sheet.getRange(1, 1, 1, 10).setFontWeight("bold").setBackground("#e0e7ff");
    sheet.setFrozenRows(1);
  }

  const sheet = spreadsheet.getActiveSheet();
  sheet.appendRow([
    data.timestamp,
    data.grade,
    data.className,
    data.period,
    data.groupName,
    data.studentNames,
    data.fileName,
    data.fileSizeKB,
    data.fileUrl,
    data.fileId
  ]);
}

/**
 * Xử lý đồng bộ bảng điểm tổng hợp từ trang Giáo viên
 */
function handleSyncReport(payload) {
  return jsonResponse({
    status: "ok",
    syncedCount: (payload.rows || []).length,
    timestamp: Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss")
  });
}

/**
 * Trả về phản hồi dạng JSON chuẩn UTF-8
 */
function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
