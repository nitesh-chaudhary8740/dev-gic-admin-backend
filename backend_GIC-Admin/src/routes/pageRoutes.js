const express = require("express");
const router = express.Router();

const pageController = require("../controllers/pageController");

// ==========================================
// ✅ PUBLIC ROUTES (Must be at the top)
// ==========================================

// Get page content by URL (e.g., /about-us)
router.get(
  "/content/by-url/:encryptedLanguageId",
  pageController.getPageContentByUrl
);

// Get page content by encrypted menu & language ID
router.get(
  "/content/:encryptedMenuId/:encryptedLanguageId",
  pageController.getPageContent
);

// ==========================================
// ADMIN ROUTES
// ==========================================

// Create a page for a menu translation
router.post("/", pageController.createPage);

// List active pages
router.get("/", pageController.getAllPages);

// Save / update page content
router.post("/:id/content", pageController.addContent);
router.put("/:id/content", pageController.updateContent);

// Publish controls
router.patch("/:id/publish", pageController.publishPage);
router.patch("/:id/unpublish", pageController.unpublishPage);
router.patch("/:id/toggle-publish", pageController.togglePublish);

// Get, update page details
router.get("/:id", pageController.getPageById);
router.patch("/:id", pageController.updatePage);

module.exports = router;