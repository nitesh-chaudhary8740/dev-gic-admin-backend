const express = require("express");
const router = express.Router();

const MediaController = require("../controllers/MediaController");
const MediaFormatController = require("../controllers/MediaFormatController");

// 🟢 Import both middlewares
const { upload, bulkUpload } = require("../middlewares/mediaUpload");

// ======================================
// MEDIA CONTENTS
// ======================================

router.get(
  "/contents",
  MediaController.getContentByLocation
);

// ======================================
// FILE MANAGEMENT
// ======================================

// Upload media file (Single)
router.post(
  "/upload",
  upload.single("file"), // Ab yahan 'upload' defined hai
  MediaController.uploadFile
);

// 🟢 Upload media files (Bulk)
router.post(
  "/bulk-upload",
  bulkUpload.array("files", 100),
  MediaController.bulkUpload
);

// 🟢 SSE Progress Endpoint
router.get(
  "/upload-progress/:uploadId",
  (req, res) => {
    const { uploadId } = req.params;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");

    if (!req.app.locals.uploadProgress) {
      req.app.locals.uploadProgress = {};
    }

    const sendUpdate = () => {
      const data = req.app.locals.uploadProgress[uploadId];
      if (data) {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ status: "waiting", message: "Waiting for upload to start..." })}\n\n`);
      }
    };

    sendUpdate();
    const interval = setInterval(sendUpdate, 500);

    req.on("close", () => {
      clearInterval(interval);
    });
  }
);

// Delete media file
router.delete(
  "/files/:id",
  MediaController.deleteFile
);

// ======================================
// FOLDER MANAGEMENT
// ======================================

router.post(
  "/folders",
  MediaController.createFolder
);

router.delete(
  "/folders",
  MediaController.deleteFolder
);

// ======================================
// MEDIA FORMAT MANAGEMENT
// ======================================

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