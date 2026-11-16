const path = require("path");

const MediaService = require("../services/MediaService");
const { MediaFormat } = require("../models");

class MediaController {

  // GET /api/admin/media/contents?location=images
  static async getContentByLocation(req, res) {
    try {
      const location = req.query.location || "";

      const result = await MediaService.getContentByLocation(location);

      return res.status(200).json({
        success: true,
        message: "Media contents fetched successfully.",
        data: result
      });

    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Unable to fetch media contents."
      });
    }
  }

  // POST /api/admin/media/folders
  static async createFolder(req, res) {
    try {
      const { folderName, parentPath = "" } = req.body;

      if (!folderName || !folderName.trim()) {
        return res.status(400).json({
          success: false,
          message: "Folder name is required."
        });
      }

      const result = await MediaService.createFolder(
        folderName,
        parentPath
      );

      return res.status(201).json({
        success: true,
        message: "Folder created successfully.",
        data: result
      });

    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Unable to create folder."
      });
    }
  }

  // POST /api/admin/media/upload
  static async uploadFile(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "Please select a file to upload."
        });
      }

      const {
        location = "",
        fileName = "",
        conflictAction = "cancel"
      } = req.body;

      // Get file extension
      const extension = path
        .extname(req.file.originalname)
        .replace(/^\./, "")
        .toLowerCase();

      if (!extension) {
        return res.status(400).json({
          success: false,
          message: "File extension is missing."
        });
      }

      // Find allowed format from database
      const format = await MediaFormat.findOne({
        where: {
          extension,
          isAllowed: true
        }
      });

      if (!format) {
        return res.status(400).json({
          success: false,
          message: `File format .${extension} is not allowed.`
        });
      }

      // Validate MIME type
      const allowedMimeTypes = Array.isArray(format.mimeTypes)
        ? format.mimeTypes
        : [];

      if (!allowedMimeTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Invalid MIME type for this file format."
        });
      }

      // Validate file size in bytes
      const allowedSize = Number(format.allowedSize);
      const uploadedSize = Number(req.file.size);

      if (
        !Number.isSafeInteger(allowedSize) ||
        allowedSize <= 0
      ) {
        return res.status(500).json({
          success: false,
          message: "Invalid allowed file size configuration."
        });
      }

      if (uploadedSize > allowedSize) {
        const allowedSizeMB = (
          allowedSize / (1024 * 1024)
        ).toFixed(2);

        return res.status(413).json({
          success: false,
          message: `File size exceeds the allowed limit of ${allowedSizeMB} MB.`,
          data: {
            extension,
            uploadedSize,
            allowedSize,
            allowedSizeMB
          }
        });
      }

      // Upload file
      const result = await MediaService.uploadFile({
        file: req.file,
        location,
        fileName,
        conflictAction
      });

      return res.status(201).json({
        success: true,
        message: "File uploaded successfully.",
        data: result
      });

    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Unable to upload file."
      });
    }
  }

  // 🟢 NAYA: POST /api/admin/media/bulk-upload
  static async bulkUpload(req, res) {
    try {
      const files = req.files || [];
      const {
        location = "",
        conflictAction = "cancel",
        uploadId
      } = req.body;

      if (!files.length) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one file to upload."
        });
      }

      if (files.length > 100) {
        return res.status(400).json({
          success: false,
          message: "You can upload a maximum of 100 files at a time."
        });
      }

      // 🟢 Initialize SSE progress store
      if (uploadId) {
        if (!req.app.locals.uploadProgress) {
          req.app.locals.uploadProgress = {};
        }

        req.app.locals.uploadProgress[uploadId] = {
          status: "processing",
          totalFiles: files.length,
          processedFiles: 0,
          currentFile: "",
          currentFileProgress: 0,
          message: "Starting bulk upload..."
        };
      }

      // 🟢 Call service (no DB inside service for bulk)
      const result = await MediaService.bulkUploadFiles({
        files,
        location,
        conflictAction,
        uploadId,
        app: req.app
      });

      // 🟢 Mark as completed
      if (uploadId && req.app.locals.uploadProgress?.[uploadId]) {
        Object.assign(req.app.locals.uploadProgress[uploadId], {
          status: "completed",
          message: "Bulk upload finished.",
          currentFile: "",
          currentFileProgress: 100
        });

        // Optional cleanup after 30s so memory doesn't grow
        setTimeout(() => {
          if (req.app.locals.uploadProgress?.[uploadId]) {
            delete req.app.locals.uploadProgress[uploadId];
          }
        }, 30000);
      }

      return res.status(200).json({
        success: true,
        message: "Bulk upload processed.",
        data: result
      });

    } catch (error) {
      if (req.body?.uploadId && req.app.locals.uploadProgress?.[req.body.uploadId]) {
        Object.assign(req.app.locals.uploadProgress[req.body.uploadId], {
          status: "error",
          message: error.message || "Bulk upload failed."
        });
      }

      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Unable to process bulk upload."
      });
    }
  }

  // DELETE /api/admin/media/files/:id
  static async deleteFile(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "File location is required."
        });
      }

      const result = await MediaService.deleteFile(id);

      return res.status(200).json({
        success: true,
        message: "File deleted successfully.",
        data: result
      });

    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Unable to delete file."
      });
    }
  }

  // DELETE /api/admin/media/folders
  static async deleteFolder(req, res) {
    try {
      const { location } = req.body;

      if (!location || !location.trim()) {
        return res.status(400).json({
          success: false,
          message: "Folder location is required."
        });
      }

      const result = await MediaService.deleteFolder(location);

      return res.status(200).json({
        success: true,
        message: "Folder deleted successfully.",
        data: result
      });

    } catch (error) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || "Unable to delete folder."
      });
    }
  }
}

module.exports = MediaController;