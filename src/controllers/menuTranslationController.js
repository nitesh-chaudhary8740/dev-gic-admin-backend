const service = require("../services/menuTranslationService");

function handleError(res, error) {
  if (error.name === "SequelizeUniqueConstraintError") {
    return res.status(409).json({
      success: false,
      message: "A translation already exists for this menu/language or URL."
    });
  }

  const status = error.status || 500;
  return res.status(status).json({
    success: false,
    message: status === 500 ? "Internal server error" : error.message
  });
}

function positiveInt(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

exports.create = async (req, res) => {
  try {
    const { menuId, languageId, menuTitle, menuURL } = req.body;
    if (!positiveInt(menuId) || !positiveInt(languageId) ||
        typeof menuTitle !== "string" || !menuTitle.trim() ||
        typeof menuURL !== "string" || !menuURL.trim()) {
      return res.status(400).json({
        success: false,
        message: "menuId, languageId, menuTitle and menuURL are required."
      });
    }

    const data = await service.createTranslation({
      menuId: Number(menuId),
      languageId: Number(languageId),
      menuTitle: menuTitle.trim(),
      menuURL: menuURL.trim()
    });
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getAll = async (req, res) => {
  try {
    const data = await service.getAllTranslations({
      menuId: req.query.menuId,
      languageId: req.query.languageId
    });
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.getById = async (req, res) => {
  try {
    const id = positiveInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid id." });
    const data = await service.getTranslationById(id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.update = async (req, res) => {
  try {
    const id = positiveInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid id." });

    const { menuTitle, menuURL, menuId, languageId } = req.body;
    if (menuTitle !== undefined &&
        (typeof menuTitle !== "string" || !menuTitle.trim())) {
      return res.status(400).json({ success: false, message: "menuTitle must not be empty." });
    }
    if (menuURL !== undefined &&
        (typeof menuURL !== "string" || !menuURL.trim())) {
      return res.status(400).json({ success: false, message: "menuURL must not be empty." });
    }
    if (menuId !== undefined && !positiveInt(menuId)) {
      return res.status(400).json({ success: false, message: "Invalid menuId." });
    }
    if (languageId !== undefined && !positiveInt(languageId)) {
      return res.status(400).json({ success: false, message: "Invalid languageId." });
    }

    const data = await service.updateTranslation(id, {
      ...(menuTitle !== undefined ? { menuTitle: menuTitle.trim() } : {}),
      ...(menuURL !== undefined ? { menuURL: menuURL.trim() } : {}),
      ...(menuId !== undefined ? { menuId: Number(menuId) } : {}),
      ...(languageId !== undefined ? { languageId: Number(languageId) } : {})
    });
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.remove = async (req, res) => {
  try {
    const id = positiveInt(req.params.id);
    if (!id) return res.status(400).json({ success: false, message: "Invalid id." });
    const data = await service.deleteTranslation(id);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};

exports.hierarchy = async (req, res) => {
  try {
    const languageId = positiveInt(req.query.languageId);
    if (!languageId) {
      return res.status(400).json({
        success: false,
        message: "Provide a valid languageId query parameter."
      });
    }
    const data = await service.getMenuHierarchy(languageId);
    return res.json({ success: true, data });
  } catch (error) {
    return handleError(res, error);
  }
};
exports.getPublicMenuHierarchy = async (req, res) => {
  console.log("public hieracy is called")
  try {
    const { encryptedLanguageId } = req.params;

    const hierarchy = await service.getPublicMenuHierarchy(
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