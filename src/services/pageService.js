
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
          "isPublished",
        ],
      },
    ],
  },
];

// --------------------------------------------------
// CREATE PAGE
// One page per menu translation
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
// CMS management
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
// Relation is immutable through this method
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

    // Do not accept menuId, languageId, or
    // menuTranslationId changes through this method.
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
// Do not expose an independent page-delete route
// if deletion is managed through menu translations.
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
// Only when its translation and menu are active
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

  // Validate decrypted IDs
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
        attributes: [],
        where: {
          isDeleted: false,
          isPublished: true,
        },
      },
      {
        model: Language,
        as: "language",
        required: true,
        attributes: ["name", "code"],
        where: {
          isPublished: true,
        },
      },
      {
        model: Page,
        as: "page",
        required: true,
        attributes: ["content"],
        where: {
          isPublished: true,
          isDeleted: false,
        },
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
    title: translation.menuTitle,
    url: translation.menuURL,
    content: translation.page.content,
    language: {
      name: translation.language.name,
      code: translation.language.code,
    },
  };
};


const getPageContentByUrl = async (encryptedLanguageId, rawUrl) => {
  let languageId;

  // 1. Decrypt & Validate Language ID
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

  // 2. Normalize URL (Ensure leading slash and no trailing slash)
  if (!rawUrl) {
    throw createError("URL parameter is required.", 400);
  }

  let normalizedUrl = decodeURIComponent(rawUrl).trim();
  if (!normalizedUrl.startsWith("/")) {
    normalizedUrl = `/${normalizedUrl}`;
  }
  // Remove trailing slash (optional, depends on how you save URLs in DB)
  if (normalizedUrl.length > 1 && normalizedUrl.endsWith("/")) {
    normalizedUrl = normalizedUrl.slice(0, -1);
  }

  // 3. Fetch MenuTranslation based on URL and Language
  const translation = await MenuTranslation.findOne({
    where: {
      languageId: Number(languageId),
      menuURL: normalizedUrl,
      isDeleted: false,
    },
    attributes: ["id", "menuTitle", "menuURL"],
    include: [
      {
        model: Menu,
        as: "menu",
        required: true,
        attributes: [],
        where: {
          isDeleted: false,
          isPublished: true,
        },
      },
      {
        model: Language,
        as: "language",
        required: true,
        attributes: ["name", "code"],
        where: {
          isPublished: true,
        },
      },
      {
        model: Page,
        as: "page",
        required: false, // `false` rakha hai kyunki kuch pages custom React component ho sakte hain (content: null)
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

  // 4. Return formatted response
  return {
    title: translation.menuTitle,
    url: translation.menuURL,
    content: translation.page ? translation.page.content : null,
    language: {
      name: translation.language.name,
      code: translation.language.code,
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
  getPageContentByUrl
};
