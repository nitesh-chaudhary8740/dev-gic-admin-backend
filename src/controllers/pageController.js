
const pageService = require("../services/pageService");

// --------------------------------------------------
// COMMON ERROR HANDLER
// --------------------------------------------------

const handleError = (res, error) => {
  console.error(error);

  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      success: false,
      message:
        error.code === "PAGE_ALREADY_EXISTS"
          ? "A page already exists for this menu translation."
          : "A page record already exists for this menu translation.",
      code: error.code || "PAGE_ALREADY_EXISTS",
    });
  }

  if (
    error.name === "SequelizeValidationError" ||
    error.name === "SequelizeDatabaseError" &&
      error.parent?.code === "ER_DATA_TOO_LONG"
  ) {
    return res.status(400).json({
      success: false,
      message: "Invalid page data.",
      errors: error.errors?.map((item) => ({
        field: item.path,
        message: item.message,
      })),
    });
  }

  if (
    error.name === "SequelizeForeignKeyConstraintError" ||
    error.parent?.code === "ER_NO_REFERENCED_ROW_2" ||
    error.parent?.code === "ER_NO_REFERENCED_ROW"
  ) {
    return res.status(400).json({
      success: false,
      message:
        "The referenced menu translation does not exist.",
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

// --------------------------------------------------
// VALIDATE POSITIVE INTEGER IDs
// --------------------------------------------------

const isValidId = (id) => {
  if (
    id === undefined ||
    id === null ||
    String(id).trim() === ""
  ) {
    return false;
  }

  const value = Number(id);

  return Number.isSafeInteger(value) && value > 0;
};

// --------------------------------------------------
// CREATE PAGE
// Requires menuTranslationId and content
// --------------------------------------------------

const createPage = async (req, res) => {
  try {
    const { menuTranslationId, content, isPublished } = req.body;

    if (!isValidId(menuTranslationId)) {
      return res.status(400).json({
        success: false,
        message: "A valid menuTranslationId is required.",
        field: "menuTranslationId",
      });
    }

    if (typeof content !== "string") {
      return res.status(400).json({
        success: false,
        message: "content must be a string.",
        field: "content",
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

    const page = await pageService.createPage({
      menuTranslationId: Number(menuTranslationId),
      content,
      ...(isPublished !== undefined ? { isPublished } : {}),
    });

    return res.status(201).json({
      success: true,
      message: "Page created successfully.",
      data: page,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// GET ALL ACTIVE PAGES
// --------------------------------------------------

const getAllPages = async (req, res) => {
  try {
    const pages = await pageService.getAllPages();

    return res.status(200).json({
      success: true,
      data: pages,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// GET PAGE BY ID
// --------------------------------------------------

const getPageById = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID.",
      });
    }

    const page = await pageService.getPageById(
      Number(req.params.id)
    );

    return res.status(200).json({
      success: true,
      data: page,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// UPDATE PAGE DETAILS
// Only content and isPublished can be updated
// --------------------------------------------------

const updatePage = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID.",
      });
    }

    const { content, isPublished } = req.body;

    if (
      content !== undefined &&
      typeof content !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "content must be a string.",
        field: "content",
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
      content === undefined &&
      isPublished === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: "Provide content or isPublished to update.",
      });
    }

    const page = await pageService.updatePage(
      Number(req.params.id),
      {
        ...(content !== undefined ? { content } : {}),
        ...(isPublished !== undefined ? { isPublished } : {}),
      }
    );

    return res.status(200).json({
      success: true,
      message: "Page updated successfully.",
      data: page,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// ADD / SAVE CONTENT
// --------------------------------------------------

const addContent = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID.",
      });
    }

    if (typeof req.body.content !== "string") {
      return res.status(400).json({
        success: false,
        message: "content is required and must be a string.",
        field: "content",
      });
    }

    const page = await pageService.addContent(
      Number(req.params.id),
      req.body.content
    );

    return res.status(200).json({
      success: true,
      message: "Content saved successfully.",
      data: page,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// UPDATE CONTENT uses the same service operation
const updateContent = async (req, res) => addContent(req, res);

// --------------------------------------------------
// PUBLISH PAGE
// --------------------------------------------------

const publishPage = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID.",
      });
    }

    const page = await pageService.publishPage(
      Number(req.params.id)
    );

    return res.status(200).json({
      success: true,
      message: "Page published successfully.",
      data: page,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// UNPUBLISH PAGE
// --------------------------------------------------

const unpublishPage = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID.",
      });
    }

    const page = await pageService.unpublishPage(
      Number(req.params.id)
    );

    return res.status(200).json({
      success: true,
      message: "Page unpublished successfully.",
      data: page,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// TOGGLE PUBLISH STATUS
// --------------------------------------------------

const togglePublish = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID.",
      });
    }

    const page = await pageService.togglePublish(
      Number(req.params.id)
    );

    return res.status(200).json({
      success: true,
      message: "Page publication status updated.",
      data: page,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// SOFT DELETE PAGE
// Keep this endpoint only if pages can be deleted
// independently of their menu translations.
// --------------------------------------------------

const deletePage = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID.",
      });
    }

    const page = await pageService.deletePage(
      Number(req.params.id)
    );

    return res.status(200).json({
      success: true,
      message: "Page deleted successfully.",
      data: page,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// RESTORE SOFT-DELETED PAGE
// --------------------------------------------------

const restorePage = async (req, res) => {
  try {
    if (!isValidId(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid page ID.",
      });
    }

    const page = await pageService.restorePage(
      Number(req.params.id)
    );

    return res.status(200).json({
      success: true,
      message: "Page restored successfully.",
      data: page,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
// --------------------------------------------------
// PUBLIC: GET PAGE CONTENT USING ENCRYPTED TRANSLATION ID
// --------------------------------------------------
// --------------------------------------------------
const getPageContentByUrl = async (req, res) => {
  try {
    const { encryptedLanguageId } = req.params;
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        success: false,
        message: "URL query parameter is required.",
      });
    }

    const data = await pageService.getPageContentByUrl(
      encryptedLanguageId,
      url
    );

    return res.status(200).json({
      success: true,
      message: "Page content fetched successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
const getPageContent = async (req, res) => {
  try {
    const { encryptedMenuId, encryptedLanguageId } = req.params;

    const data = await pageService.getPageContent(
      encryptedMenuId,
      encryptedLanguageId
    );

    return res.status(200).json({
      success: true,
      message: "Page content fetched successfully.",
      data,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
module.exports = {
  createPage,
  getAllPages,
  getPageById,
  updatePage,
  addContent,
  updateContent,
  publishPage,
  unpublishPage,
  togglePublish,
  deletePage,
  restorePage,
  getPageContent,getPageContentByUrl
};
