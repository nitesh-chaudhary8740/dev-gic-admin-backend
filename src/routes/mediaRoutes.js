
const express = require("express");

const router = express.Router();

const MediaController = require("../controllers/MediaController");
const MediaFormatController = require("../controllers/MediaFormatController");

const upload = require("../middlewares/mediaUpload");

// // Replace this import with your existing admin authentication middleware.
// const authMiddleware = require("../middlewares/authMiddleware");

// // All media management routes require admin authentication.
// router.use(authMiddleware);

// ======================================
// MEDIA CONTENTS
// ======================================

// Get files and folders by location
// GET /api/admin/media/contents?location=images
router.get(
  "/contents",
  MediaController.getContentByLocation
);

// Get individual media details
// GET /api/admin/media/:id
router.get(
  "/:id",
  MediaController.getMediaById
);

// ======================================
// FILE MANAGEMENT
// ======================================

// Upload media file
// POST /api/admin/media/upload
router.post(
  "/upload",
  upload.single("file"),
  MediaController.uploadFile
);

// Delete media file
// DELETE /api/admin/media/files/:id
router.delete(
  "/files/:id",
  MediaController.deleteFile
);

// ======================================
// FOLDER MANAGEMENT
// ======================================

// Create folder
// POST /api/admin/media/folders
router.post(
  "/folders",
  MediaController.createFolder
);

// Delete empty folder
// DELETE /api/admin/media/folders
router.delete(
  "/folders",
  MediaController.deleteFolder
);

// ======================================
// MEDIA FORMAT MANAGEMENT
// ======================================

// Get all supported formats
// GET /api/admin/media/formats
router.get(
  "/formats",
  MediaFormatController.getFormats
);

// Add new format
// POST /api/admin/media/formats
router.post(
  "/formats",
  MediaFormatController.createFormat
);

// Update format
// PUT /api/admin/media/formats/:id
router.put(
  "/formats/:id",
  MediaFormatController.updateFormat
);

// Enable / Disable format
// PATCH /api/admin/media/formats/:id/status
router.patch(
  "/formats/:id/status",
  MediaFormatController.updateFormatStatus
);

// Delete format
// DELETE /api/admin/media/formats/:id
router.delete(
  "/formats/:id",
  MediaFormatController.deleteFormat
);

module.exports = router;
