const menuService = require("../services/menuService");

const handleError = (res, error) => {
  console.error(error);

  if (
    error.name === "SequelizeUniqueConstraintError" ||
    error.code === "MENU_URL_ALREADY_EXISTS" ||
    error.code === "MENU_TRANSLATION_ALREADY_EXISTS"
  ) {
    return res.status(409).json({
      success: false,
      message: error.message || "A conflicting menu record already exists.",
      ...(error.code ? { code: error.code } : {}),
    });
  }

  if (error.name === "SequelizeValidationError") {
    return res.status(400).json({
      success: false,
      message: "Invalid menu data.",
      errors: error.errors?.map((item) => ({
        field: item.path,
        message: item.message,
      })),
    });
  }

  const status = error.status || 500;

  return res.status(status).json({
    success: false,
    message:
      status >= 500
        ? "Internal server error."
        : error.message,
    ...(error.code ? { code: error.code } : {}),
  });
};

const parseId = (value) => {
  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return null;
  }

  return id;
};

// --------------------------------------------------
// CREATE MENU + FIRST TRANSLATION
// languageId ki zaroorat nahi, backend default language use karega
// --------------------------------------------------

const createMenu = async (req, res) => {
  try {
    const { menuTitle, menuURL, parentId, isPublished, isDefault } = req.body;

    if (typeof menuTitle !== "string" || !menuTitle.trim()) {
      return res.status(400).json({
        success: false,
        message: "menuTitle is required.",
        field: "menuTitle",
      });
    }

    if (typeof menuURL !== "string" || !menuURL.trim()) {
      return res.status(400).json({
        success: false,
        message: "menuURL is required.",
        field: "menuURL",
      });
    }

    if (
      parentId !== undefined &&
      parentId !== null &&
      !parseId(parentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "parentId must be a valid menu ID or null.",
        field: "parentId",
      });
    }

    if (
      isPublished !== undefined &&
      typeof isPublished !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "isPublished must be a boolean.",
        field: "isPublished",
      });
    }

    if (
      isDefault !== undefined &&
      typeof isDefault !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "isDefault must be a boolean.",
        field: "isDefault",
      });
    }

    const menu = await menuService.createMenu({
      menuTitle: menuTitle.trim(),
      menuURL: menuURL.trim(),
      parentId:
        parentId === undefined || parentId === null
          ? null
          : parseId(parentId),
      ...(isPublished !== undefined ? { isPublished } : {}),
      ...(isDefault !== undefined ? { isDefault } : {}),
    });

    return res.status(201).json({
      success: true,
      message: "Menu and its translation created successfully.",
      data: menu,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// GET ALL MENUS
// --------------------------------------------------

const getAllMenus = async (req, res) => {
  try {
    const languageId = parseId(req.query.languageId);

    if (
      req.query.languageId !== undefined &&
      languageId === null
    ) {
      return res.status(400).json({
        success: false,
        message: "languageId must be a valid positive integer.",
      });
    }

    const menus = await menuService.getAllMenus(languageId);

    return res.status(200).json({
      success: true,
      data: menus,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// GET DEFAULT MENU
// GET /api/menus/default?languageId=1
// --------------------------------------------------

const getDefaultMenu = async (req, res) => {
  try {
    const languageId = parseId(req.query.languageId);

    if (!languageId) {
      return res.status(400).json({
        success: false,
        message: "A valid languageId query parameter is required.",
      });
    }

    const data = await menuService.getDefaultMenu(languageId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// GET MENU BY ID
// --------------------------------------------------

const getMenuById = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID.",
      });
    }

    const languageId = parseId(req.query.languageId);

    if (
      req.query.languageId !== undefined &&
      languageId === null
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid languageId.",
      });
    }

    const menu = await menuService.getMenuById(id, languageId);

    return res.status(200).json({
      success: true,
      data: menu,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// UPDATE COMMON MENU FIELDS
// isDefault nahi badlega - alag endpoint hai
// --------------------------------------------------

const updateMenu = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID.",
      });
    }

    const { parentId, isPublished } = req.body;

    if (
      parentId !== undefined &&
      parentId !== null &&
      !parseId(parentId)
    ) {
      return res.status(400).json({
        success: false,
        message: "parentId must be a valid menu ID or null.",
      });
    }

    if (
      isPublished !== undefined &&
      typeof isPublished !== "boolean"
    ) {
      return res.status(400).json({
        success: false,
        message: "isPublished must be a boolean.",
      });
    }

    if (
      parentId === undefined &&
      isPublished === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide parentId or isPublished to update.",
      });
    }

    const menu = await menuService.updateMenu(id, {
      ...(parentId !== undefined
        ? {
            parentId:
              parentId === null ? null : parseId(parentId),
          }
        : {}),
      ...(isPublished !== undefined ? { isPublished } : {}),
    });

    return res.status(200).json({
      success: true,
      message: "Menu updated successfully.",
      data: menu,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// SET DEFAULT MENU (Naya)
// PATCH /api/menus/:id/set-default
// --------------------------------------------------

const setDefaultMenu = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID.",
      });
    }

    const menu = await menuService.setDefaultMenu(id);

    return res.status(200).json({
      success: true,
      message: "Menu set as default successfully.",
      data: menu,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// ADD TRANSLATION TO EXISTING MENU
// --------------------------------------------------

const addMenuTranslation = async (req, res) => {
  try {
    const menuId = parseId(req.params.id);
    const { languageId, menuTitle, menuURL } = req.body;

    if (!menuId) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID.",
      });
    }

    if (!parseId(languageId)) {
      return res.status(400).json({
        success: false,
        message: "A valid languageId is required.",
      });
    }

    if (typeof menuTitle !== "string" || !menuTitle.trim()) {
      return res.status(400).json({
        success: false,
        message: "menuTitle is required.",
      });
    }

    if (typeof menuURL !== "string" || !menuURL.trim()) {
      return res.status(400).json({
        success: false,
        message: "menuURL is required.",
      });
    }

    const translation = await menuService.addMenuTranslation(
      menuId,
      {
        languageId: parseId(languageId),
        menuTitle: menuTitle.trim(),
        menuURL: menuURL.trim(),
      }
    );

    return res.status(201).json({
      success: true,
      message: "Menu translation created successfully.",
      data: translation,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// UPDATE TRANSLATION TITLE / URL
// --------------------------------------------------

const updateMenuTranslation = async (req, res) => {
  try {
    const menuId = parseId(req.params.id);
    const menuTranslationId = parseId(
      req.params.menuTranslationId
    );

    if (!menuId || !menuTranslationId) {
      return res.status(400).json({
        success: false,
        message: "Valid menu ID and menuTranslationId are required.",
      });
    }

    const { menuTitle, menuURL } = req.body;

    if (menuTitle === undefined && menuURL === undefined) {
      return res.status(400).json({
        success: false,
        message: "Provide menuTitle or menuURL to update.",
      });
    }

    if (
      menuTitle !== undefined &&
      (typeof menuTitle !== "string" || !menuTitle.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "menuTitle must be a non-empty string.",
      });
    }

    if (
      menuURL !== undefined &&
      (typeof menuURL !== "string" || !menuURL.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "menuURL must be a non-empty string.",
      });
    }

    const translation =
      await menuService.updateMenuTranslation(
        menuId,
        menuTranslationId,
        {
          ...(menuTitle !== undefined
            ? { menuTitle: menuTitle.trim() }
            : {}),
          ...(menuURL !== undefined
            ? { menuURL: menuURL.trim() }
            : {}),
        }
      );

    return res.status(200).json({
      success: true,
      message: "Menu translation updated successfully.",
      data: translation,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// PUBLISH / UNPUBLISH / TOGGLE
// --------------------------------------------------

const publishMenu = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID.",
      });
    }

    const menu = await menuService.publishMenu(id);

    return res.status(200).json({
      success: true,
      message: "Menu published successfully.",
      data: menu,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const unpublishMenu = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID.",
      });
    }

    const menu = await menuService.unpublishMenu(id);

    return res.status(200).json({
      success: true,
      message: "Menu unpublished successfully.",
      data: menu,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const togglePublish = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID.",
      });
    }

    const menu = await menuService.togglePublish(id);

    return res.status(200).json({
      success: true,
      message: "Menu publication status updated.",
      data: menu,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// DELETE / RESTORE
// --------------------------------------------------

const deleteMenu = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID.",
      });
    }

    const menu = await menuService.deleteMenu(id);

    return res.status(200).json({
      success: true,
      message: "Menu deleted successfully.",
      data: menu,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const restoreMenu = async (req, res) => {
  try {
    const id = parseId(req.params.id);

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID.",
      });
    }

    const menu = await menuService.restoreMenu(id);

    return res.status(200).json({
      success: true,
      message: "Menu restored successfully.",
      data: menu,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// LANGUAGE-SPECIFIC NAVBAR HIERARCHY (Admin)
// --------------------------------------------------

const getMenuHierarchy = async (req, res) => {
  try {
    const languageId = parseId(req.query.languageId);

    if (!languageId) {
      return res.status(400).json({
        success: false,
        message: "A valid languageId query parameter is required.",
      });
    }

    const publishedOnly =
      req.query.publishedOnly === "true";

    const menus = await menuService.getMenuHierarchy(
      languageId,
      { publishedOnly }
    );

    return res.status(200).json({
      success: true,
      data: menus,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
// --------------------------------------------------
// GET PARENT URL PATH
// GET /api/menus/parent-url-path?parentId=5&languageId=1
// --------------------------------------------------

const getParentURLPath = async (req, res) => {
  try {
    const { parentId, languageId } = req.query;

    if (!parentId || !parseId(parentId)) {
      return res.status(400).json({
        success: false,
        message: "Valid parentId query parameter is required.",
      });
    }

    if (!languageId || !parseId(languageId)) {
      return res.status(400).json({
        success: false,
        message: "Valid languageId query parameter is required.",
      });
    }

    const data = await menuService.getParentURLPath(
      parseId(parentId),
      parseId(languageId)
    );

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
// --------------------------------------------------
// PUBLIC NAVBAR HIERARCHY (encrypted language ID)
// --------------------------------------------------

const getPublicMenuHierarchy = async (req, res) => {
  try {
    const { encryptedLanguageId } = req.params;

    const hierarchy = await menuService.getPublicMenuHierarchy(
      encryptedLanguageId
    );

    return res.status(200).json({
      success: true,
      message: "Public navigation fetched successfully.",
      data: hierarchy,
    });
  } catch (error) {
    return res.status(error.status || 500).json({
      success: false,
      message:
        error.status === 404
          ? error.message
          : "Unable to fetch public navigation.",
    });
  }
};

module.exports = {
  createMenu,
  getAllMenus,
  getMenuById,
  getDefaultMenu,
  updateMenu,
  setDefaultMenu,
  addMenuTranslation,
  updateMenuTranslation,
  publishMenu,
  unpublishMenu,
  togglePublish,
  deleteMenu,
  restoreMenu,
  getParentURLPath,
  getMenuHierarchy,
  getPublicMenuHierarchy,
};