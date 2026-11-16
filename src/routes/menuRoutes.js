const express = require("express");
const router = express.Router();

const menuController = require("../controllers/menuController");

// ==========================================
// STATIC / PUBLIC ROUTES (param routes se PEHLE)
// ==========================================

// Default menu (home page) for a selected language
// GET /api/menus/default?languageId=1
router.get("/default", menuController.getDefaultMenu);

// Admin: Language-specific nested navbar hierarchy
// GET /api/menus/hierarchy?languageId=1&publishedOnly=true
router.get("/hierarchy", menuController.getMenuHierarchy);
router.get("/parent-url-path", menuController.getParentURLPath); 
// Public: Nested navbar hierarchy for a selected language (encrypted ID)
// GET /api/menus/navmenus/:encryptedLanguageId
router.get(
  "/navmenus/:encryptedLanguageId",
  menuController.getPublicMenuHierarchy
);

// ==========================================
// ADMIN ROUTES
// ==========================================

// Create menu + its first translation (default language)
router.post("/", menuController.createMenu);

// List menus; optional query: ?languageId=1
router.get("/", menuController.getAllMenus);

// ID-based routes
router.get("/:id", menuController.getMenuById);
router.patch("/:id", menuController.updateMenu);

// Set menu as default (home page)
router.patch("/:id/set-default", menuController.setDefaultMenu);

// Publish controls
router.patch("/:id/publish", menuController.publishMenu);
router.patch("/:id/unpublish", menuController.unpublishMenu);
router.patch("/:id/toggle-publish", menuController.togglePublish);

// Soft delete and restore
router.delete("/:id", menuController.deleteMenu);
router.patch("/:id/restore", menuController.restoreMenu);

// Translations for a menu
router.post("/:id/translations", menuController.addMenuTranslation);
router.patch(
  "/:id/translations/:menuTranslationId",
  menuController.updateMenuTranslation
);

module.exports = router;