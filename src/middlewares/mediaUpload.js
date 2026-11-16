
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const TEMP_DIR = path.resolve(process.cwd(), "storage", "temp", "media");

// Ensure temporary directory exists
fs.mkdirSync(TEMP_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      `${Date.now()}-${require("crypto").randomUUID()}` +
      path.extname(file.originalname).toLowerCase();

    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50 MB
    files: 1
  },

  fileFilter: (req, file, cb) => {
    // Preliminary check only.
    // Actual extension, MIME and file signature validation
    // must be performed in MediaService.

    const extension = path.extname(file.originalname)
      .replace(".", "")
      .toLowerCase();

    if (!extension) {
      return cb(new Error("File extension is required."));
    }

    cb(null, true);
  }
});

module.exports = upload;
