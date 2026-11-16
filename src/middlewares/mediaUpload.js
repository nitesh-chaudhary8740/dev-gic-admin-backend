const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const TEMP_DIR = path.resolve(process.cwd(), "storage", "temp", "media");

// Ensure temporary directory exists
fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      `${Date.now()}-${crypto.randomUUID()}` +
      path.extname(file.originalname).toLowerCase();

    cb(null, uniqueName);
  }
});

// 1. Existing Single Upload
const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).replace(".", "").toLowerCase();
    if (!extension) return cb(new Error("File extension is required."));
    cb(null, true);
  }
});

// 2. Bulk Upload Configuration (Max 100 files)
const bulkUpload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB per file
    files: 100
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(file.originalname).replace(".", "").toLowerCase();
    if (!extension) return cb(new Error("File extension is required."));
    cb(null, true);
  }
});

// Export both
module.exports = { upload, bulkUpload };