const {
  Page,
  Menu,
  MenuTranslation,
  Language,
} = require("../models");

const sequelize = require("../config/database");
const { decryptUrlParam } = require("../utils/urlParamCrypto");

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const createError = (message, status = 400, code) => {
  const error = new Error(message);
  error.status = status;

  if (code) {
    error.code = code;
  }

  return error;
};

const getActivePage = async (id, transaction) => {
  const page = await Page.findOne({
    where: {
      id,
      isDeleted: false,
    },
    transaction,
  });

  if (!page) {
    throw createError("Page not found.", 404);
  }

  return page;
};

const getActiveTranslation = async (
  menuTranslationId,
  transaction
) => {
  const translation = await MenuTranslation.findOne({
    where: {
      id: menuTranslationId,
      isDeleted: false,
    },
    include: [
      {
        model: Menu,
        as: "menu",
        required: true,
        where: {
          isDeleted: false,
        },
      },
      {
        model: Language,
        as: "language",
        required: true,
      },
    ],
    transaction,
  });

  if (!translation) {
    throw createError(
      "Active menu translation not found.",
      404
    );
  }

  return translation;
};

const validateCanPublish = async (
  menuTranslationId,
  transaction
) => {
  const translation = await getActiveTranslation(
    menuTranslationId,
    transaction
  );

  if (!translation.language.isPublished) {
    throw createError(
      "Cannot publish a page for an unpublished language.",
      409
    );
  }

  if (!translation.menu.isPublished) {
    throw createError(
      "Cannot publish a page for an unpublished menu.",
      409
    );
  }

  return translation;
};

// Shared include for page retrieval.
// Page -> MenuTranslation -> Menu + Language
const pageDetailsInclude = [
  {
    model: MenuTranslation,
    as: "menuTranslation",
    required: true,
    where: {
      isDeleted: false,
    },
    include: [
      {
        model: Menu,
        as: "menu",
        required: true,
        where: {
          isDeleted: false,
        },
        attributes: [
          "id",
          "parentId",
          "isPublished",
          "isDeleted",
          "isDefault",
        ],
      },
      {
        model: Language,
        as: "language",
        required: true,
        attributes: [
          "id",
          "name",
          "code",
          "displayName",
          "isPublished",
          "isDefault",
        ],
      },
    ],
  },
];

// --------------------------------------------------
// CREATE PAGE
// --------------------------------------------------

const createPage = async (data) => {
  const { menuTranslationId, content } = data;

  if (
    menuTranslationId === undefined ||
    menuTranslationId === null
  ) {
    throw createError("menuTranslationId is required.");
  }

  if (typeof content !== "string") {
    throw createError("content must be a string.");
  }

  return sequelize.transaction(async (transaction) => {
    const translation = await getActiveTranslation(
      menuTranslationId,
      transaction
    );

    const existingPage = await Page.findOne({
      where: {
        menuTranslationId,
      },
      transaction,
    });

    if (existingPage) {
      if (!existingPage.isDeleted) {
        throw createError(
          "A page already exists for this menu translation.",
          409,
          "PAGE_ALREADY_EXISTS"
        );
      }

      throw createError(
        "A deleted page already exists for this translation. Restore the existing page instead.",
        409,
        "DELETED_PAGE_EXISTS"
      );
    }

    const isPublished =
      data.isPublished !== undefined
        ? data.isPublished
        : false;

    if (isPublished) {
      await validateCanPublish(
        translation.id,
        transaction
      );
    }

    return Page.create(
      {
        menuTranslationId: translation.id,
        content,
        isPublished,
        isDeleted: false,
      },
      { transaction }
    );
  });
};

// --------------------------------------------------
// GET ALL ACTIVE PAGES
// --------------------------------------------------

const getAllPages = async () => {
  return Page.findAll({
    where: {
      isDeleted: false,
    },
    include: pageDetailsInclude,
    order: [["id", "ASC"]],
  });
};

// --------------------------------------------------
// GET PAGE BY ID
// --------------------------------------------------

const getPageById = async (id) => {
  const page = await Page.findOne({
    where: {
      id,
      isDeleted: false,
    },
    include: pageDetailsInclude,
  });

  if (!page) {
    throw createError("Page not found.", 404);
  }

  return page;
};

// --------------------------------------------------
// UPDATE PAGE
// --------------------------------------------------

const updatePage = async (id, data) => {
  return sequelize.transaction(async (transaction) => {
    const page = await getActivePage(id, transaction);

    const updates = {};

    if (data.content !== undefined) {
      if (typeof data.content !== "string") {
        throw createError("content must be a string.");
      }

      updates.content = data.content;
    }

    if (data.isPublished !== undefined) {
      if (typeof data.isPublished !== "boolean") {
        throw createError("isPublished must be a boolean.");
      }

      if (data.isPublished) {
        await validateCanPublish(
          page.menuTranslationId,
          transaction
        );
      }

      updates.isPublished = data.isPublished;
    }

    await page.update(updates, { transaction });

    return page;
  });
};

// --------------------------------------------------
// ADD / UPDATE CONTENT
// --------------------------------------------------

const addContent = async (id, content) => {
  if (typeof content !== "string") {
    throw createError("content must be a string.");
  }

  const page = await getActivePage(id);

  await page.update({ content });

  return page;
};

const updateContent = async (id, content) => {
  return addContent(id, content);
};

// --------------------------------------------------
// PUBLISH / UNPUBLISH
// --------------------------------------------------

const publishPage = async (id) => {
  return sequelize.transaction(async (transaction) => {
    const page = await getActivePage(id, transaction);

    await validateCanPublish(
      page.menuTranslationId,
      transaction
    );

    await page.update(
      { isPublished: true },
      { transaction }
    );

    return page;
  });
};

const unpublishPage = async (id) => {
  const page = await getActivePage(id);

  await page.update({
    isPublished: false,
  });

  return page;
};

const togglePublish = async (id) => {
  const page = await getActivePage(id);

  if (!page.isPublished) {
    await validateCanPublish(page.menuTranslationId);
  }

  await page.update({
    isPublished: !page.isPublished,
  });

  return page;
};

// --------------------------------------------------
// INTERNAL SOFT DELETE
// --------------------------------------------------

const deletePage = async (id, transaction = null) => {
  const performDelete = async (tx) => {
    const page = await getActivePage(id, tx);

    await page.update(
      {
        isDeleted: true,
        isPublished: false,
      },
      { transaction: tx }
    );

    return page;
  };

  if (transaction) {
    return performDelete(transaction);
  }

  return sequelize.transaction(performDelete);
};

// --------------------------------------------------
// RESTORE PAGE
// --------------------------------------------------

const restorePage = async (id) => {
  return sequelize.transaction(async (transaction) => {
    const page = await Page.findByPk(id, {
      transaction,
    });

    if (!page) {
      throw createError("Page not found.", 404);
    }

    if (!page.isDeleted) {
      return page;
    }

    await getActiveTranslation(
      page.menuTranslationId,
      transaction
    );

    await page.update(
      {
        isDeleted: false,
        isPublished: false,
      },
      { transaction }
    );

    return page;
  });
};

// --------------------------------------------------
// GET PAGE CONTENT (by encrypted menuId + languageId)
// Used for language change (same menu, new language)
// --------------------------------------------------

const getPageContent = async (
  encryptedMenuId,
  encryptedLanguageId
) => {
  let menuId;
  let languageId;

  try {
    menuId = decryptUrlParam(encryptedMenuId);
    languageId = decryptUrlParam(encryptedLanguageId);
  } catch {
    throw createError("Invalid encrypted parameters.", 400);
  }

  if (
    !/^[1-9]\d*$/.test(menuId) ||
    !/^[1-9]\d*$/.test(languageId) ||
    !Number.isSafeInteger(Number(menuId)) ||
    !Number.isSafeInteger(Number(languageId))
  ) {
    throw createError("Invalid encrypted parameters.", 400);
  }

  const translation = await MenuTranslation.findOne({
    where: {
      menuId: Number(menuId),
      languageId: Number(languageId),
      isDeleted: false,
    },
    attributes: ["id", "menuTitle", "menuURL"],
    include: [
      {
        model: Menu,
        as: "menu",
        required: true,
        attributes: ["id", "isDefault"],
        where: {
          isDeleted: false,
          isPublished: true,
        },
      },
      {
        model: Language,
        as: "language",
        required: true,
        attributes: ["id", "name", "code", "displayName", "isDefault"],
        where: {
          isPublished: true,
        },
      },
      {
        model: Page,
        as: "page",
        required: false, // false: page na ho toh bhi translation return ho
        attributes: ["content", "isPublished"],
        where: {
          isPublished: true,
          isDeleted: false,
        },
        required: false,
      },
    ],
  });

  if (!translation) {
    throw createError(
      "Published page not found for this menu and language.",
      404
    );
  }

  return {
    menuId: translation.menuId,
    menuTranslationId: translation.id,
    title: translation.menuTitle,
    url: translation.menuURL,
    content: translation.page ? translation.page.content : null,
    isPublished: translation.page ? translation.page.isPublished : false,
    isDefaultMenu: Boolean(translation.menu?.isDefault),
    language: {
      id: translation.language.id,
      name: translation.language.name,
      code: translation.language.code,
      displayName: translation.language.displayName,
      isDefault: translation.language.isDefault,
    },
  };
};

// --------------------------------------------------
// GET PAGE CONTENT BY URL
// Used for direct URL access (e.g., /en/about-us)
// --------------------------------------------------

const getPageContentByUrl = async (encryptedLanguageId, rawUrl) => {
  let languageId;

  try {
    languageId = decryptUrlParam(encryptedLanguageId);
  } catch {
    throw createError("Invalid encrypted language ID.", 400);
  }

  if (
    !/^[1-9]\d*$/.test(languageId) ||
    !Number.isSafeInteger(Number(languageId))
  ) {
    throw createError("Invalid encrypted language ID.", 400);
  }

  if (!rawUrl) {
    throw createError("URL parameter is required.", 400);
  }

  let normalizedUrl = decodeURIComponent(rawUrl).trim();
  if (!normalizedUrl.startsWith("/")) {
    normalizedUrl = `/${normalizedUrl}`;
  }
  if (normalizedUrl.length > 1 && normalizedUrl.endsWith("/")) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }

  const translation = await MenuTranslation.findOne({
    where: {
      languageId: Number(languageId),
      menuURL: normalizedUrl,
      isDeleted: false,
    },
    attributes: ["id", "menuId", "menuTitle", "menuURL"],
    include: [
      {
        model: Menu,
        as: "menu",
        required: true,
        attributes: ["id", "isDefault"],
        where: {
          isDeleted: false,
          isPublished: true,
        },
      },
      {
        model: Language,
        as: "language",
        required: true,
        attributes: ["id", "name", "code", "displayName", "isDefault"],
        where: {
          isPublished: true,
        },
      },
      {
        model: Page,
        as: "page",
        required: false,
        attributes: ["content", "isPublished"],
        where: {
          isPublished: true,
          isDeleted: false,
        },
      },
    ],
  });

  if (!translation) {
    throw createError(
      "Published page not found for this URL and language.",
      404
    );
  }

  return {
    menuId: translation.menuId,
    menuTranslationId: translation.id,
    title: translation.menuTitle,
    url: translation.menuURL,
    content: translation.page ? translation.page.content : null,
    isPublished: translation.page ? translation.page.isPublished : false,
    isDefaultMenu: Boolean(translation.menu?.isDefault),
    language: {
      id: translation.language.id,
      name: translation.language.name,
      code: translation.language.code,
      displayName: translation.language.displayName,
      isDefault: translation.language.isDefault,
    },
  };
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
  getPageContent,
  getPageContentByUrl,
};