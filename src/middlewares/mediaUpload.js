
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const TEMP_DIR = path.resolve(
  process.cwd(),
  "storage",
  "temp",
  "media"
);

fs.mkdirSync(TEMP_DIR, { recursive: true });

// =====================================================
// STORAGE
// =====================================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, TEMP_DIR);
  },

  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const uniqueName =
      `${Date.now()}-${crypto.randomUUID()}${extension}`;

    cb(null, uniqueName);
  }
});

// =====================================================
// MULTER CONFIGURATION
// =====================================================

const singleUpload = multer({
  storage,

  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 1
  }
});

const bulkUploadObj = multer({
  storage,

  limits: {
    fileSize: 50 * 1024 * 1024,
    files: 100
  }
});

// =====================================================
// TEMP FILE CLEANUP
// =====================================================

const cleanupTempFiles = async (files = []) => {
  await Promise.all(
    files.map((file) => {
      if (!file?.path) return Promise.resolve();

      return fs.promises.unlink(file.path).catch(() => {});
    })
  );
};

// =====================================================
// BULK UPLOAD ERROR HANDLER
// =====================================================

const bulkUpload = {
  array: (fieldName, maxCount) => {
    const multerMiddleware = bulkUploadObj.array(
      fieldName,
      maxCount
    );

    return (req, res, next) => {
      multerMiddleware(req, res, async (err) => {
        if (!err) {
          return next();
        }

        // Clean files already written to temporary storage.
        await cleanupTempFiles(req.files || []);

        if (err instanceof multer.MulterError) {
          let statusCode = 400;
          let message = "File upload error.";

          switch (err.code) {
            case "LIMIT_FILE_SIZE":
              statusCode = 413;
              message =
                "File size exceeds the allowed limit of 50 MB.";
              break;

            case "LIMIT_FILE_COUNT":
              statusCode = 400;
              message =
                "You can upload a maximum of 100 files at a time.";
              break;

            case "LIMIT_UNEXPECTED_FILE":
              statusCode = 400;
              message = "Unexpected file field.";
              break;

            case "LIMIT_FIELD_COUNT":
              statusCode = 400;
              message = "Too many form fields.";
              break;

            default:
              statusCode = 400;
          }

          return res.status(statusCode).json({
            success: false,
            message,
            code: err.code
          });
        }

        return res.status(400).json({
          success: false,
          message: err.message || "Failed to process upload."
        });
      });
    };
  }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
  upload: singleUpload,
  bulkUpload
};
