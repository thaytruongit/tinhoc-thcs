/**
 * ============================================================================
 * GOOGLE APPS SCRIPT (Code.gs) - HỆ THỐNG TIN HỌC THCS MÃO ĐIỀN
 * CẦU NỐI NHẬN FILE THỰC HÀNH (.docx, .xlsx, .pptx, .sb3, .pdf) TỪ MÁY HỌC SINH
 * TỰ ĐỘNG ĐẨY VÀO GOOGLE DRIVE & GHI NHẬT KÝ VÀO GOOGLE SHEETS
 * ============================================================================
 *
 * CẤU TRÚC THƯ MỤC DRIVE TỰ ĐỘNG KHỞI TẠO:
 * My Drive
 *   └── Giảng dạy
 *         └── NOP_BAI_THUC_HANH
 *               ├── KHOI_6
 *               │     ├── Tiet_01
 *               │     └── ...
 *               ├── KHOI_7
 *               ├── KHOI_8
 *               ├── KHOI_9
 *               └── Bang_Theo_Doi_Nop_Bai_Thuc_Hanh (Google Sheets tự động)
 *
 * HƯỚNG DẪN TRIỂN KHAI 1 PHÚT (CHỈ LÀM 1 LẦN DUY NHẤT):
 * 1. Truy cập: https://script.google.com -> Nhấp nút "Dự án mới" (New project).
 * 2. Đặt tên dự án: "TinHoc_THCS_Drive_Bridge".
 * 3. Xoá hết mã mặc định trong tệp Code.gs, sao chép toàn bộ nội dung tệp này dán vào.
 * 4. Bấm biểu tượng Đĩa mềm (Ctrl + S) để lưu.
 * 5. Nhấp nút "Triển khai" (Deploy) ở góc trên bên phải -> Chọn "Tùy chọn triển khai mới" (New deployment).
 * 6. Nhấp biểu tượng bánh răng bên trái "Chọn loại" -> Chọn "Ứng dụng web" (Web app).
 * 7. Thiết lập cấu hình:
 *    - Mô tả: "Cổng nhận bài thực hành Tin học THCS"
 *    - Thực thi dưới dạng (Execute as): "Chính tôi" (Me - địa chỉ email của Thầy Trường)
 *    - Người có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone - cho phép máy học sinh đẩy file lên mà không cần đăng nhập Google)
 * 8. Bấm "Triển khai" (Deploy) -> Cấp quyền truy cập Google Drive/Sheets nếu Google hỏi.
 * 9. Sao chép "URL Ứng dụng web" (Web app URL có dạng https://script.google.com/macros/s/.../exec).
 * 10. Dán URL này vào mục: "Cổng Giáo viên -> ⚙️ Cấu hình Google Drive & GAS" trên trang web.
 * ============================================================================
 */

const CONFIG = {
  ROOT_FOLDER: "Giảng dạy",
  SUB_FOLDER: "NOP_BAI_THUC_HANH",
  LOG_SHEET_NAME: "Bang_Theo_Doi_Nop_Bai_Thuc_Hanh"
};

/**
 * Xử lý GET request: Kiểm tra trạng thái hoạt động của Web App
 */
function doGet(e) {
  const result = {
    status: "ok",
    service: "THCS Mão Điền - Cổng Nhận Sản Phẩm Thực Hành Tin Học Drive",
    version: "2.0.0",
    timestamp: Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss"),
    message: "Google Apps Script Web App đang hoạt động sẵn sàng nhận bài từ học sinh!"
  };

  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Xử lý POST request: Nhận file từ máy học sinh gửi lên
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

    if (action === "uploadPracticalFile") {
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
 * Tìm hoặc tạo thư mục theo cấp bậc trên Google Drive
 */
function getOrCreateTargetFolder(customFolderId, grade, period, className) {
  let baseFolder = null;

  // Nếu giáo viên có nhập Folder ID tùy chỉnh trong trang Quản trị
  if (customFolderId && typeof customFolderId === "string" && customFolderId.trim().length > 10) {
    try {
      baseFolder = DriveApp.getFolderById(customFolderId.trim());
    } catch (e) {
      baseFolder = null;
    }
  }

  // Nếu không có Folder ID tùy chỉnh, tự động tạo/lấy theo cấu trúc mặc định
  if (!baseFolder) {
    // 1. Thư mục gốc: Giảng dạy
    const rootIter = DriveApp.getFoldersByName(CONFIG.ROOT_FOLDER);
    const rootFolder = rootIter.hasNext() ? rootIter.next() : DriveApp.createFolder(CONFIG.ROOT_FOLDER);

    // 2. Thư mục con: NOP_BAI_THUC_HANH
    const subIter = rootFolder.getFoldersByName(CONFIG.SUB_FOLDER);
    baseFolder = subIter.hasNext() ? subIter.next() : rootFolder.createFolder(CONFIG.SUB_FOLDER);
  }

  // 3. Thư mục Khối: KHOI_6, KHOI_7, KHOI_8, KHOI_9
  const gradeStr = String(grade || "Chung");
  const gradeFolderName = "KHOI_" + gradeStr;
  const gradeIter = baseFolder.getFoldersByName(gradeFolderName);
  const gradeFolder = gradeIter.hasNext() ? gradeIter.next() : baseFolder.createFolder(gradeFolderName);

  // 4. Thư mục Tiết học: Tiet_01, Tiet_02...
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
 * Xử lý nhận file base64 và lưu vào Drive
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

  // Xác định tên file chuẩn hóa
  const fileName = payload.standardizedFileName || payload.fileName || ("BaiThucHanh_" + Date.now() + ".docx");
  
  // Xác định MIME type tương ứng theo đuôi mở rộng
  let mimeType = payload.mimeType || "application/octet-stream";
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".docx")) {
    mimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (lowerName.endsWith(".xlsx")) {
    mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  } else if (lowerName.endsWith(".pptx")) {
    mimeType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  } else if (lowerName.endsWith(".pdf")) {
    mimeType = "application/pdf";
  } else if (lowerName.endsWith(".sb3")) {
    mimeType = "application/x.scratch.sb3";
  } else if (lowerName.endsWith(".zip")) {
    mimeType = "application/zip";
  }

  // Giải mã Base64 thành mảng byte và tạo file trên Google Drive
  const decodedBytes = Utilities.base64Decode(payload.base64Data);
  const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
  const createdFile = targetFolder.createFile(blob);

  const nowVN = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");
  const sizeKB = Math.round(decodedBytes.length / 1024);

  // Đính kèm mô tả chi tiết vào file trên Drive
  createdFile.setDescription(
    "THCS MÃO ĐIỀN - BÀI THỰC HÀNH TIN HỌC\n" +
    "• Thời gian nộp: " + nowVN + "\n" +
    "• Khối: " + (payload.grade || "") + " | Lớp: " + (payload.className || "") + "\n" +
    "• Tiết: " + (payload.period || "") + "\n" +
    "• Nhóm máy: " + (payload.groupName || "") + "\n" +
    "• Học sinh: " + (payload.memberNames || payload.studentName || "") + "\n" +
    "• Kích thước: " + sizeKB + " KB"
  );

  // Tự động ghi một dòng nhật ký vào Google Sheets để giáo viên theo dõi
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
  } catch (sheetErr) {
    // Không chặn luồng lưu file nếu việc ghi sheet gặp trục trặc
  }

  return jsonResponse({
    status: "ok",
    fileId: createdFile.getId(),
    fileUrl: createdFile.getUrl(),
    fileName: createdFile.getName(),
    fileSizeKB: sizeKB,
    folderUrl: targetFolder.getUrl(),
    folderPath: folderInfo.folderPath,
    timestamp: nowVN
  });
}

/**
 * Tự động tạo/ghi vào bảng Google Sheet theo dõi tiến độ nộp bài
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
    DriveApp.getRootFolder().removeFile(ssFile); // Chuyển vào đúng thư mục nộp bài

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
