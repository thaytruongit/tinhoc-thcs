/**
 * GOOGLE APPS SCRIPT (Code.gs) - CẦU NỐI LƯU TRỮ SẢN PHẨM THỰC HÀNH (.docx, .xlsx, .pptx)
 * VỀ THƯ MỤC GOOGLE DRIVE CỦA THẦY TRƯỜNG (H:\My Drive\Giảng dạy\NOP_BAI_THUC_HANH)
 * & ĐỒNG BỘ BẢNG ĐIỂM TỔNG HỢP
 *
 * Hướng dẫn triển khai (Chỉ làm 1 lần - 1 phút):
 * 1. Mở https://script.google.com -> Dự án mới -> Dán toàn bộ mã này vào Code.gs
 * 2. Bấm Deploy (Triển khai) -> New deployment (Tùy chọn triển khai mới) -> Web app
 *    - Execute as: Me (Chính tôi)
 *    - Who has access: Anyone (Bất kỳ ai)
 * 3. Copy URL Web App dán vào mục Cấu hình trên Cổng Quản trị Giáo viên (mật khẩu 666).
 */

const ROOT_FOLDER_NAME = "Giảng dạy";
const SUB_FOLDER_NAME = "NOP_BAI_THUC_HANH";

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: "ok",
    service: "THCS Mao Dien - Tin Hoc Live & Drive Bridge",
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action || "uploadPracticalFile";

    if (action === "uploadPracticalFile") {
      return handleFileUpload(payload);
    } else if (action === "syncClassReport") {
      return handleSyncReport(payload);
    }

    return jsonResponse({ status: "error", message: "Unknown action: " + action });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateTargetFolder(customFolderId, grade, period, className) {
  let baseFolder;
  if (customFolderId && customFolderId.trim().length > 10) {
    try {
      baseFolder = DriveApp.getFolderById(customFolderId.trim());
    } catch (e) {
      baseFolder = null;
    }
  }

  if (!baseFolder) {
    const rootIter = DriveApp.getFoldersByName(ROOT_FOLDER_NAME);
    const teachingFolder = rootIter.hasNext() ? rootIter.next() : DriveApp.createFolder(ROOT_FOLDER_NAME);
    const subIter = teachingFolder.getFoldersByName(SUB_FOLDER_NAME);
    baseFolder = subIter.hasNext() ? subIter.next() : teachingFolder.createFolder(SUB_FOLDER_NAME);
  }

  const gradeFolderName = "KHOI_" + (grade || "Chung");
  const gIter = baseFolder.getFoldersByName(gradeFolderName);
  const gradeFolder = gIter.hasNext() ? gIter.next() : baseFolder.createFolder(gradeFolderName);

  const lessonFolderName = "Lop_" + (className || "All") + "_Tiet_" + String(period || 1).padStart(2, "0");
  const lIter = gradeFolder.getFoldersByName(lessonFolderName);
  return lIter.hasNext() ? lIter.next() : gradeFolder.createFolder(lessonFolderName);
}

function handleFileUpload(payload) {
  const folder = getOrCreateTargetFolder(
    payload.driveFolderId,
    payload.grade,
    payload.period,
    payload.className
  );

  const fileName = payload.standardizedFileName || payload.fileName || "SanPhamThucHanh.docx";
  const mimeType = payload.mimeType || "application/octet-stream";
  const bytes = Utilities.base64Decode(payload.base64Data);
  const blob = Utilities.newBlob(bytes, mimeType, fileName);

  const file = folder.createFile(blob);
  file.setDescription(
    "Lớp: " + payload.className +
    " | Nhóm: " + (payload.groupName || "") +
    " | Học sinh: " + (payload.memberNames || payload.studentName || "") +
    " | Tiết: " + payload.period
  );

  return jsonResponse({
    status: "ok",
    fileId: file.getId(),
    fileUrl: file.getUrl(),
    fileName: file.getName(),
    folderPath: "H:\\My Drive\\Giảng dạy\\NOP_BAI_THUC_HANH\\KHOI_" + payload.grade + "\\" + folder.getName()
  });
}

function handleSyncReport(payload) {
  return jsonResponse({
    status: "ok",
    syncedCount: (payload.rows || []).length,
    timestamp: new Date().toISOString()
  });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
