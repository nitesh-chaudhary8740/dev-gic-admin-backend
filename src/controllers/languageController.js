
const languageService = require("../services/languageService");

const handleError = (res, error) => {
  console.error(error);

  if (error.name === "SequelizeUniqueConstraintError") {
    const fields = Object.keys(error.fields || {});
    const field = fields[0];

    let message = "Language name or code already exists.";

    if (field === "name") {
      message = "A language with this name already exists.";
    } else if (field === "code") {
      message = "A language with this code already exists.";
    }

    return res.status(409).json({
      success: false,
      message,
      field: field || undefined,
      code: "LANGUAGE_ALREADY_EXISTS",
    });
  }

  if (error.name === "SequelizeValidationError") {
    return res.status(400).json({
      success: false,
      message: "Invalid language data.",
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

// --------------------------------------------------
// CREATE LANGUAGE
// --------------------------------------------------

const createLanguage = async (req, res) => {
  try {
    const { name, code, isPublished } = req.body;

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Language name is required.",
        field: "name",
      });
    }

    if (typeof code !== "string" || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: "Language code is required.",
        field: "code",
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

    const language = await languageService.createLanguage({
      name: name.trim(),
      code: code.trim(),
      ...(isPublished !== undefined ? { isPublished } : {}),
    });

    return res.status(201).json({
      success: true,
      message: "Language created successfully.",
      data: language,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// GET ALL LANGUAGES - CMS
// --------------------------------------------------

const getAllLanguages = async (req, res) => {
  try {
    const languages = await languageService.getAllLanguages();

    return res.status(200).json({
      success: true,
      data: languages,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// GET PUBLISHED LANGUAGES - PUBLIC SITE
// --------------------------------------------------

const getPublishedLanguages = async (req, res) => {
  try {
    const languages =
      await languageService.getPublishedLanguages();

    return res.status(200).json({
      success: true,
      data: languages,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// GET LANGUAGE BY ID
// --------------------------------------------------

const getLanguageById = async (req, res) => {
  try {
    const language =
      await languageService.getLanguageById(req.params.id);

    return res.status(200).json({
      success: true,
      data: language,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// UPDATE LANGUAGE
// --------------------------------------------------

const updateLanguage = async (req, res) => {
  try {
    const { name, code, isPublished } = req.body;

    if (
      name !== undefined &&
      (typeof name !== "string" || !name.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "name must be a non-empty string.",
        field: "name",
      });
    }

    if (
      code !== undefined &&
      (typeof code !== "string" || !code.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "code must be a non-empty string.",
        field: "code",
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

    const updates = {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(code !== undefined ? { code: code.trim() } : {}),
      ...(isPublished !== undefined ? { isPublished } : {}),
    };

    const language = await languageService.updateLanguage(
      req.params.id,
      updates
    );

    return res.status(200).json({
      success: true,
      message: "Language updated successfully.",
      data: language,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// PUBLISH LANGUAGE
// --------------------------------------------------

const publishLanguage = async (req, res) => {
  try {
    const language =
      await languageService.publishLanguage(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Language published successfully.",
      data: language,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// --------------------------------------------------
// UNPUBLISH LANGUAGE
// --------------------------------------------------

const unpublishLanguage = async (req, res) => {
  try {
    const language =
      await languageService.unpublishLanguage(req.params.id);

    return res.status(200).json({
      success: true,
      message: "Language unpublished successfully.",
      data: language,
    });
  } catch (error) {
    return handleError(res, error);
  }
};
const getPublicLanguages = async (req, res) => {
  try {
    const languages = await languageService.getPublicLanguages();

    return res.status(200).json({
      success: true,
      message: "Public languages fetched successfully.",
      data: languages,
    });
  } catch (error) {
    console.error("Error fetching public languages:", error);

    return res.status(error.status || 500).json({
      success: false,
      message:
        error.status === 404
          ? error.message
          : "Unable to fetch public languages.",
    });
  }
};

// GET /api/languages/public/:encryptedId
const getPublicLanguageById = async (req, res) => {
  try {
    const { encryptedId } = req.params;

    const language =
      await languageService.getPublicLanguageById(encryptedId);

    return res.status(200).json({
      success: true,
      message: "Public language fetched successfully.",
      data: language,
    });
  } catch (error) {
    console.error("Error fetching public language:", error);

    return res.status(error.status || 500).json({
      success: false,
      message:
        error.status === 404
          ? "Language not found."
          : "Unable to fetch public language.",
    });
  }
};



module.exports = {
  createLanguage,
  getAllLanguages,
  getPublishedLanguages,
  getLanguageById,
  updateLanguage,
  publishLanguage,
  unpublishLanguage,
  getPublicLanguages,
  getPublicLanguageById,
};
