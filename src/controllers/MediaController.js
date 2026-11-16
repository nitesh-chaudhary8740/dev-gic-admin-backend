
const MediaService = require("../services/MediaService");

class MediaController {
  // =====================================================
  // COMMON HELPERS
  // =====================================================

  static getHttpStatus(error) {
    const statusMap = {
      FILE_REQUIRED: 400,
      FILES_REQUIRED: 400,
      INVALID_LOCATION: 400,
      INVALID_FOLDER_NAME: 400,
      INVALID_FILE_NAME: 400,
      INVALID_FILE_EXTENSION: 400,
      DANGEROUS_FILE_EXTENSION: 400,
      FORMAT_NOT_ALLOWED: 400,
      INVALID_MIME_TYPE: 400,
      INVALID_FORMAT_CONFIGURATION: 500,
      INVALID_UPLOAD_FILE: 400,
      INVALID_TARGET_FILE: 400,
      FILE_ALREADY_EXISTS: 409,
      FOLDER_ALREADY_EXISTS: 409,
      FOLDER_NOT_FOUND: 404,
      MEDIA_NOT_FOUND: 404,
      INVALID_MEDIA_FILE: 400,
      FOLDER_NOT_EMPTY: 409,
      ROOT_FOLDER_DELETE_NOT_ALLOWED: 400,
      MEDIA_ROOT_NOT_FOUND: 500,
      INVALID_CONFLICT_ACTION: 400,
    };

    if (error?.statusCode) {
      return error.statusCode;
    }

    if (error?.message?.startsWith("SIZE_EXCEEDS_LIMIT:")) {
      return 413;
    }

    return statusMap[error?.message] || 500;
  }

  static async cleanupFiles(files = []) {
    await Promise.all(
      files.map(async (file) => {
        try {
          if (file) {
            await MediaService.removeTempFile(file);
          }
        } catch (error) {
          console.error(
            "Temporary file cleanup failed:",
            file?.filename || file?.originalname,
            error.message
          );
        }
      })
    );
  }

  static cleanupProgress(app, uploadId) {
    if (!uploadId) return;

    setTimeout(() => {
      const progress = app.locals.uploadProgress?.[uploadId];

      if (
        progress &&
        ["completed", "cancelled", "error"].includes(progress.status)
      ) {
        delete app.locals.uploadProgress[uploadId];
      }
    }, 30000);
  }

  // =====================================================
  // 1. GET CONTENT BY LOCATION
  // GET /api/admin/media/contents?location=images
  // =====================================================

  static async getContentByLocation(req, res) {
    try {
      const location = req.query.location || "";

      const result = await MediaService.getContentByLocation(location);

      return res.status(200).json({
        success: true,
        message: "Media contents fetched successfully.",
        data: result,
      });
    } catch (error) {
      return res.status(MediaController.getHttpStatus(error)).json({
        success: false,
        message: error.message || "Unable to fetch media contents.",
      });
    }
  }

  // =====================================================
  // 2. CREATE FOLDER
  // POST /api/admin/media/folders
  // =====================================================

  static async createFolder(req, res) {
    try {
      const { folderName, parentPath = "" } = req.body;

      if (
        typeof folderName !== "string" ||
        !folderName.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Folder name is required.",
        });
      }

      const result = await MediaService.createFolder(
        folderName,
        parentPath
      );

      return res.status(201).json({
        success: true,
        message: "Folder created successfully.",
        data: result,
      });
    } catch (error) {
      return res.status(MediaController.getHttpStatus(error)).json({
        success: false,
        message: error.message || "Unable to create folder.",
      });
    }
  }

  // =====================================================
  // 3. SINGLE FILE UPLOAD
  // POST /api/admin/media/upload
  // =====================================================

  static async uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a file to upload.",
        });
      }

      const {
        location = "",
        fileName = "",
        conflictAction = "cancel",
      } = req.body;

      const result = await MediaService.uploadFile({
        file: req.file,
        location,
        fileName,
        conflictAction,
      });

      return res.status(201).json({
        success: true,
        message: "File uploaded successfully.",
        data: result,
      });
    } catch (error) {
      await MediaController.cleanupFiles(
        req.file ? [req.file] : []
      );

      return res.status(MediaController.getHttpStatus(error)).json({
        success: false,
        message: error.message || "Unable to upload file.",
      });
    }
  }

  // =====================================================
  // 4. BULK FILE UPLOAD
  // POST /api/admin/media/bulk-upload
  // =====================================================

  static async bulkUpload(req, res) {
    const files = req.files || [];

    const {
      location = "",
      conflictAction = "cancel",
      uploadId,
    } = req.body || {};

    try {
      if (!files.length) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one file to upload.",
        });
      }

      if (files.length > 100) {
        await MediaController.cleanupFiles(files);

        return res.status(400).json({
          success: false,
          message: "You can upload a maximum of 100 files at a time.",
        });
      }

      if (!["cancel", "rename", "replace"].includes(conflictAction)) {
        await MediaController.cleanupFiles(files);

        return res.status(400).json({
          success: false,
          message: "Invalid conflict action.",
        });
      }

      if (
        typeof uploadId !== "string" ||
        !/^bulk_[a-zA-Z0-9_-]{1,100}$/.test(uploadId)
      ) {
        await MediaController.cleanupFiles(files);

        return res.status(400).json({
          success: false,
          message: "A valid upload ID is required.",
        });
      }

      if (!req.app.locals.uploadProgress) {
        req.app.locals.uploadProgress = {};
      }

      // Prevent reuse of an existing upload ID.
      if (req.app.locals.uploadProgress[uploadId]) {
        await MediaController.cleanupFiles(files);

        return res.status(409).json({
          success: false,
          message: "This upload ID is already in use.",
        });
      }

      // Initialize progress for the entire batch.
      req.app.locals.uploadProgress[uploadId] = {
        status: "processing",
        totalFiles: files.length,
        processedFiles: 0,
        currentFile: "",
        currentFileProgress: 0,
        message: "Starting bulk upload...",
      };

      const result = await MediaService.bulkUploadFiles({
        files,
        location,
        conflictAction,
        uploadId,
        app: req.app,
      });

      const progress =
        req.app.locals.uploadProgress[uploadId];

      if (progress) {
        if (result.cancelled || progress.status === "cancelled") {
          Object.assign(progress, {
            status: "cancelled",
            currentFile: "",
            message: "Upload cancelled.",
          });
        } else {
          Object.assign(progress, {
            status: "completed",
            processedFiles: files.length,
            currentFile: "",
            currentFileProgress: 100,
            message: "Bulk upload finished.",
          });
        }
      }

      MediaController.cleanupProgress(req.app, uploadId);

      return res.status(200).json({
        success: true,
        message:
          result.cancelled || progress?.status === "cancelled"
            ? "Bulk upload cancelled."
            : "Bulk upload processed.",
        data: result,
      });
    } catch (error) {
      await MediaController.cleanupFiles(files);

      if (
        uploadId &&
        req.app.locals.uploadProgress?.[uploadId]
      ) {
        Object.assign(
          req.app.locals.uploadProgress[uploadId],
          {
            status: "error",
            currentFile: "",
            message: error.message || "Bulk upload failed.",
          }
        );

        MediaController.cleanupProgress(req.app, uploadId);
      }

      return res.status(MediaController.getHttpStatus(error)).json({
        success: false,
        message: error.message || "Unable to process bulk upload.",
      });
    }
  }

  // =====================================================
  // 5. GET BULK UPLOAD PROGRESS
  // GET /api/admin/media/upload-progress/:uploadId
  // SSE
  // =====================================================

  static async getUploadProgress(req, res) {
    const { uploadId } = req.params;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    let closed = false;
    let waitingTime = 0;

    const interval = setInterval(() => {
      if (closed || res.writableEnded) {
        clearInterval(interval);
        return;
      }

      const progress =
        req.app.locals.uploadProgress?.[uploadId];

      // The POST request may still be passing through Multer.
      if (!progress) {
        waitingTime += 300;

        res.write(
          `data: ${JSON.stringify({
            status: "waiting",
            message: "Waiting for upload to start...",
          })}\n\n`
        );

        // Avoid keeping an abandoned SSE connection indefinitely.
        if (waitingTime >= 300000) {
          res.write("event: end\ndata: {}\n\n");
          res.end();
          clearInterval(interval);
        }

        return;
      }

      // Send current progress.
      res.write(`data: ${JSON.stringify(progress)}\n\n`);

      // Close SSE when processing finishes.
      if (
        ["completed", "cancelled", "error"].includes(progress.status)
      ) {
        res.write("event: end\ndata: {}\n\n");
        res.end();
        clearInterval(interval);
      }
    }, 300);

    // Stop polling when the client disconnects.
    res.on("close", () => {
      closed = true;
      clearInterval(interval);
    });
  }

  // =====================================================
  // 6. CANCEL BULK UPLOAD
  // POST /api/admin/media/cancel-upload/:uploadId
  // =====================================================

  static async cancelBulkUpload(req, res) {
    try {
      const { uploadId } = req.params;

      const progress =
        req.app.locals.uploadProgress?.[uploadId];

      if (!progress) {
        return res.status(404).json({
          success: false,
          message: "Upload not found or already finished.",
        });
      }

      if (progress.status !== "processing") {
        return res.status(409).json({
          success: false,
          message: "Upload is not currently processing.",
        });
      }

      progress.status = "cancelled";
      progress.message = "Upload cancellation requested.";

      return res.status(200).json({
        success: true,
        message: "Upload cancellation requested.",
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: error.message || "Unable to cancel upload.",
      });
    }
  }

  // =====================================================
  // 7. DELETE FILE
  // DELETE /api/admin/media/files/:id
  // =====================================================

  static async deleteFile(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "File location is required.",
        });
      }

      const result = await MediaService.deleteFile(id);

      return res.status(200).json({
        success: true,
        message: "File deleted successfully.",
        data: result,
      });
    } catch (error) {
      return res.status(MediaController.getHttpStatus(error)).json({
        success: false,
        message: error.message || "Unable to delete file.",
      });
    }
  }
// DELETE /api/admin/media/files
static async deleteFiles(req, res) {
  try {
    const { location = "", fileNames = [] } = req.body;

    const result = await MediaService.deleteFiles({
      location,
      fileNames
    });

    return res.status(200).json({
      success: true,
      message: "File deletion process completed.",
      data: result
    });

  } catch (error) {
    console.error("Bulk file deletion error:", error);

    const statusCode =
      error.message === "FILES_REQUIRED" ||
      error.message === "TOO_MANY_FILES"
        ? 400
        : error.message === "INVALID_LOCATION"
          ? 400
          : error.message === "FOLDER_NOT_FOUND"
            ? 404
            : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Unable to delete files."
    });
  }
}
  // =====================================================
  // 8. DELETE FOLDER
  // DELETE /api/admin/media/folders
  // =====================================================

  static async deleteFolder(req, res) {
    try {
      const { location } = req.body;

      if (
        typeof location !== "string" ||
        !location.trim()
      ) {
        return res.status(400).json({
          success: false,
          message: "Folder location is required.",
        });
      }

      const result = await MediaService.deleteFolder(location);

      return res.status(200).json({
        success: true,
        message: "Folder deleted successfully.",
        data: result,
      });
    } catch (error) {
      return res.status(MediaController.getHttpStatus(error)).json({
        success: false,
        message: error.message || "Unable to delete folder.",
      });
    }
  }
}

module.exports = MediaController;
