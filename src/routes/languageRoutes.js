const express = require("express");
const router = express.Router();

const languageController = require("../controllers/languageController");

// ==========================================
// PUBLIC ROUTES (static paths FIRST)
// ==========================================
router.get("/published", languageController.getPublishedLanguages);
router.get("/public", languageController.getPublicLanguages);
router.get(
  "/public/:encryptedId",
  languageController.getPublicLanguageById
);

// ==========================================
// ADMIN ROUTES (param routes LAST)
// ==========================================
router.post("/", languageController.createLanguage);
router.get("/", languageController.getAllLanguages);
router.get("/:id", languageController.getLanguageById);
router.put("/:id", languageController.updateLanguage);
router.patch("/:id/publish", languageController.publishLanguage);
router.patch("/:id/unpublish", languageController.unpublishLanguage);

module.exports = router;