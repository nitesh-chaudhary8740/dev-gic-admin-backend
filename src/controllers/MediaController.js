
const MediaService = require("../services/MediaService");

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
