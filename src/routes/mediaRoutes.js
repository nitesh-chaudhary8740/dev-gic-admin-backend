
const express = require("express");
const router = express.Router();

const MediaController = require("../controllers/MediaController");
const MediaFormatController = require("../controllers/MediaFormatController");

const {
  upload,
  bulkUpload
} = require("../middlewares/mediaUpload");

// =====================================================
// MEDIA CONTENTS
// =====================================================

router.get(
  "/contents",
  MediaController.getContentByLocation
);

// =====================================================
// FILE MANAGEMENT
// =====================================================

// Single file upload
router.post(
  "/upload",
  upload.single("file"),
  MediaController.uploadFile
);

// Bulk file upload
router.post(
  "/bulk-upload",
  bulkUpload.array("files", 100),
  MediaController.bulkUpload
);

// Bulk upload progress (SSE)
router.get(
  "/upload-progress/:uploadId",
  MediaController.getUploadProgress
);

// Cancel bulk upload
router.post(
  "/cancel-upload/:uploadId",
  MediaController.cancelBulkUpload
);

// Delete media file
router.delete(
  "/files/:id",
  MediaController.deleteFile
);
router.delete("/files", MediaController.deleteFiles);
// =====================================================
// FOLDER MANAGEMENT
// =====================================================

router.post(
  "/folders",
  MediaController.createFolder
);

router.delete(
  "/folders",
  MediaController.deleteFolder
);

// =====================================================
// MEDIA FORMAT MANAGEMENT
// =====================================================

router.get(
  "/formats",
  MediaFormatController.getFormats
);

router.post(
  "/formats",
  MediaFormatController.createFormat
);

router.put(
  "/formats/:id",
  MediaFormatController.updateFormat
);

router.patch(
  "/formats/:id/status",
  MediaFormatController.updateFormatStatus
);

router.delete(
  "/formats/:id",
  MediaFormatController.deleteFormat
);

module.exports = router;
