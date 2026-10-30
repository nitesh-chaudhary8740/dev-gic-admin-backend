
const express = require("express");
const router = express.Router();
const controller = require("../controllers/menuTranslationController");
const menuController = require("../controllers/menuController");
//public routes
router.get("/navmenus/:encryptedLanguageId",controller.getPublicMenuHierarchy);
// Create menu + its first translation
router.post("/", menuController.createMenu);

// Language-specific nested navbar hierarchy
// Example: /hierarchy?languageId=1&publishedOnly=true
router.get("/hierarchy", menuController.getMenuHierarchy);

// List menus; optional query: ?languageId=1
router.get("/", menuController.getAllMenus);

// Add a translation to an existing menu
router.post("/:id/translations", menuController.addMenuTranslation);

// Update a particular translation's title or URL
router.patch(
  "/:id/translations/:menuTranslationId",
  menuController.updateMenuTranslation
);

// Get menu by ID; optional query: ?languageId=1
router.get("/:id", menuController.getMenuById);

// Update common menu fields, such as parentId and isPublished
router.patch("/:id", menuController.updateMenu);

// Publish controls
router.patch("/:id/publish", menuController.publishMenu);
router.patch("/:id/unpublish", menuController.unpublishMenu);
router.patch("/:id/toggle-publish", menuController.togglePublish);

// Soft delete and restore menu
router.delete("/:id", menuController.deleteMenu);
router.patch("/:id/restore", menuController.restoreMenu);
// Public hierarchy endpoint

module.exports = router;
