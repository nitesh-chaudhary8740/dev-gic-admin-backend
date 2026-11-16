const { Menu, MenuTranslation, Language, Page } = require("../models");
const sequelize = require("../config/database");
const { Op } = require("sequelize");
const {
  encryptUrlParam,
  decryptUrlParam,
} = require("../utils/urlParamCrypto");

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const createError = (message, status = 400, code) => {
  const error = new Error(message);
  error.status = status;
  if (code) error.code = code;
  return error;
};

const getActiveMenu = async (menuId, transaction) => {
  const menu = await Menu.findOne({
    where: {
      id: menuId,
      isDeleted: false,
    },
    transaction,
  });

  if (!menu) {
    throw createError("Menu not found.", 404);
  }

  return menu;
};

const getActiveTranslation = async (
  menuId,
  menuTranslationId,
  transaction
) => {
  const translation = await MenuTranslation.findOne({
    where: {
      id: menuTranslationId,
      menuId,
      isDeleted: false,
    },
    transaction,
  });

  if (!translation) {
    throw createError(
      "Active menu translation not found for this menu.",
      404
    );
  }

  return translation;
};

const validateLanguage = async (languageId, transaction) => {
  const language = await Language.findByPk(languageId, {
    transaction,
  });

  if (!language) {
    throw createError("Language not found.", 404);
  }

  if (!language.isPublished) {
    throw createError(
      "Language is not published.",
      400
    );
  }

  return language;
};

const validateParent = async (
  parentId,
  menuId = null,
  transaction
) => {
  if (parentId === null || parentId === undefined) {
    return null;
  }

  if (menuId !== null && Number(parentId) === Number(menuId)) {
    throw createError("A menu cannot be its own parent.");
  }

  let currentId = Number(parentId);

  while (currentId !== null) {
    const parent = await Menu.findOne({
      where: {
        id: currentId,
        isDeleted: false,
      },
      attributes: ["id", "parentId"],
      transaction,
    });

    if (!parent) {
      throw createError("Parent menu not found.", 404);
    }

    if (menuId !== null && Number(parent.id) === Number(menuId)) {
      throw createError(
        "This parent assignment would create a menu cycle."
      );
    }

    currentId =
      parent.parentId === null
        ? null
        : Number(parent.parentId);
  }

  return Number(parentId);
};

const validateUniqueUrl = async (
  languageId,
  menuURL,
  excludeTranslationId = null,
  transaction
) => {
  const where = {
    languageId,
    menuURL,
    isDeleted: false,
  };

  if (excludeTranslationId !== null) {
    where.id = { [Op.ne]: excludeTranslationId };
  }

  const existing = await MenuTranslation.findOne({
    where,
    attributes: ["id"],
    transaction,
  });

  if (existing) {
    throw createError(
      "URL already exists for another active menu in this language.",
      409,
      "MENU_URL_ALREADY_EXISTS"
    );
  }
};

// --------------------------------------------------
// CREATE MENU + FIRST TRANSLATION
// Uses default language, auto-adds language code prefix to URL
// --------------------------------------------------

const createMenu = async (data) => {
  const {
    menuTitle,
    menuURL,
    parentId = null,
    isPublished = false,
    isDefault = false,
  } = data;

  if (!menuTitle || !menuURL) {
    throw createError("menuTitle and menuURL are required.");
  }

  return sequelize.transaction(async (transaction) => {
    // 1. Default language fetch karo
    const defaultLanguage = await Language.findOne({
      where: { isDefault: true, isPublished: true },
      transaction,
    });

    if (!defaultLanguage) {
      throw createError(
        "Default language not set. Please set a default language first.",
        400,
        "DEFAULT_LANGUAGE_MISSING"
      );
    }

    // 2. URL mein language code prefix add karo
    let finalURL = menuURL.trim();
    const prefix = `/${defaultLanguage.code}`;

    if (!finalURL.startsWith(prefix)) {
      if (finalURL === "/") {
        finalURL = `${prefix}/`;
      } else if (finalURL.startsWith("/")) {
        finalURL = `${prefix}${finalURL}`;
      } else {
        finalURL = `${prefix}/${finalURL}`;
      }
    }

    // 3. Parent validate karo
    await validateParent(parentId, null, transaction);

    // 4. URL unique check
    await validateUniqueUrl(defaultLanguage.id, finalURL, null, transaction);

    // 5. Agar isDefault = true hai, toh baaki sab ka false karo
    if (isDefault) {
      await Menu.update({ isDefault: false }, { where: {}, transaction });
    }

    // 6. Menu create karo
    const menu = await Menu.create(
      {
        parentId,
        isPublished,
        isDefault,
        isDeleted: false,
      },
      { transaction }
    );

    // 7. Translation create karo
    const translation = await MenuTranslation.create(
      {
        menuId: menu.id,
        languageId: defaultLanguage.id,
        menuTitle,
        menuURL: finalURL,
        isDeleted: false,
      },
      { transaction }
    );

    return {
      ...menu.get({ plain: true }),
      translations: [translation],
    };
  });
};

// --------------------------------------------------
// GET ALL MENUS
// --------------------------------------------------

const getAllMenus = async (languageId = null) => {
  const translationWhere = {
    isDeleted: false,
  };

  if (languageId !== null && languageId !== undefined) {
    translationWhere.languageId = languageId;
  }

  return Menu.findAll({
    where: {
      isDeleted: false,
    },
    include: [
      {
        model: Menu,
        as: "parent",
        attributes: ["id", "parentId", "isPublished", "isDefault"],
        required: false,
      },
      {
        model: Menu,
        as: "children",
        where: { isDeleted: false },
        attributes: ["id", "parentId", "isPublished", "isDefault"],
        required: false,
      },
      {
        model: MenuTranslation,
        as: "translations",
        where: translationWhere,
        required: languageId !== null && languageId !== undefined,
        include: [
          {
            model: Language,
            as: "language",
            attributes: ["id", "name", "code", "displayName", "isPublished"],
          },
          {
            model: Page,
            as: "page",
            required: false,
            where: { isDeleted: false },
          },
        ],
      },
    ],
    order: [["id", "ASC"]],
  });
};

// --------------------------------------------------
// GET MENU BY ID
// --------------------------------------------------

const getMenuById = async (menuId, languageId = null) => {
  const translationWhere = {
    isDeleted: false,
  };

  if (languageId !== null && languageId !== undefined) {
    translationWhere.languageId = languageId;
  }

  const menu = await Menu.findOne({
    where: {
      id: menuId,
      isDeleted: false,
    },
    include: [
      {
        model: Menu,
        as: "parent",
        attributes: ["id", "parentId", "isPublished", "isDefault"],
        required: false,
      },
      {
        model: Menu,
        as: "children",
        where: { isDeleted: false },
        required: false,
      },
      {
        model: MenuTranslation,
        as: "translations",
        where: translationWhere,
        required: false,
        include: [
          {
            model: Language,
            as: "language",
            attributes: ["id", "name", "code", "displayName", "isPublished"],
          },
          {
            model: Page,
            as: "page",
            required: false,
            where: { isDeleted: false },
          },
        ],
      },
    ],
  });

  if (!menu) {
    throw createError("Menu not found.", 404);
  }

  return menu;
};

// --------------------------------------------------
// GET DEFAULT MENU (by language)
// --------------------------------------------------

const getDefaultMenu = async (languageId) => {
  // 1. Default menu dhundo
  const menu = await Menu.findOne({
    where: { isDefault: true, isDeleted: false },
  });

  if (!menu) {
    throw createError("Default menu not found.", 404);
  }

  // 2. Us menu ki di gayi language mein translation dhundo
  const translation = await MenuTranslation.findOne({
    where: {
      menuId: menu.id,
      languageId,
      isDeleted: false,
    },
    include: [
      {
        model: Language,
        as: "language",
        attributes: ["id", "name", "code", "displayName", "isDefault"],
      },
      {
        model: Page,
        as: "page",
        where: { isDeleted: false },
        required: false,
      },
    ],
  });

  if (!translation) {
    throw createError(
      "Default menu translation not found for this language.",
      404
    );
  }

  return {
    menuId: menu.id,
    menuTranslationId: translation.id,
    menuTitle: translation.menuTitle,
    menuURL: translation.menuURL,
    languageId: translation.languageId,
    language: translation.language,
    content: translation.page?.content || "",
    isPublished: translation.page?.isPublished || false,
  };
};

// --------------------------------------------------
// UPDATE COMMON MENU FIELDS
// --------------------------------------------------

const updateMenu = async (menuId, data) => {
  return sequelize.transaction(async (transaction) => {
    const menu = await getActiveMenu(menuId, transaction);
    const updates = {};

    if (data.parentId !== undefined) {
      updates.parentId = await validateParent(
        data.parentId,
        menuId,
        transaction
      );
    }

    if (data.isPublished !== undefined) {
      updates.isPublished = data.isPublished;
    }

    // isDefault updateMenu se nahi badlega - alag endpoint hai

    await menu.update(updates, { transaction });

    return menu;
  });
};

// --------------------------------------------------
// SET DEFAULT MENU
// --------------------------------------------------

const setDefaultMenu = async (menuId) => {
  return sequelize.transaction(async (transaction) => {
    const menu = await Menu.findOne({
      where: { id: menuId, isDeleted: false },
      transaction,
    });

    if (!menu) {
      throw createError("Menu not found.", 404);
    }

    if (!menu.isPublished) {
      throw createError(
        "Cannot set an unpublished menu as default.",
        400
      );
    }

    // Baaki sab ka isDefault = false karo
    await Menu.update(
      { isDefault: false },
      { where: { id: { [Op.ne]: menuId } }, transaction }
    );

    // Is menu ko default banao
    await menu.update({ isDefault: true }, { transaction });

    return menu;
  });
};

// --------------------------------------------------
// ADD ANOTHER LANGUAGE TO EXISTING MENU
// --------------------------------------------------

const addMenuTranslation = async (menuId, data) => {
  const { languageId, menuTitle, menuURL } = data;

  if (
    languageId === undefined ||
    !menuTitle ||
    !menuURL
  ) {
    throw createError(
      "languageId, menuTitle and menuURL are required."
    );
  }

  return sequelize.transaction(async (transaction) => {
    await getActiveMenu(menuId, transaction);
    const language = await validateLanguage(languageId, transaction);

    // URL mein language code prefix add karo
    let finalURL = menuURL.trim();
    const prefix = `/${language.code}`;

    if (!finalURL.startsWith(prefix)) {
      if (finalURL === "/") {
        finalURL = `${prefix}/`;
      } else if (finalURL.startsWith("/")) {
        finalURL = `${prefix}${finalURL}`;
      } else {
        finalURL = `${prefix}/${finalURL}`;
      }
    }

    const existing = await MenuTranslation.findOne({
      where: {
        menuId,
        languageId,
      },
      transaction,
    });

    if (existing) {
      if (!existing.isDeleted) {
        throw createError(
          "This menu already has a translation for the selected language.",
          409,
          "MENU_TRANSLATION_ALREADY_EXISTS"
        );
      }

      throw createError(
        "A deleted translation already exists for this menu and language. Restore or manage the existing translation instead.",
        409,
        "DELETED_MENU_TRANSLATION_EXISTS"
      );
    }

    await validateUniqueUrl(
      languageId,
      finalURL,
      null,
      transaction
    );

    return MenuTranslation.create(
      {
        menuId,
        languageId,
        menuTitle,
        menuURL: finalURL,
        isDeleted: false,
      },
      { transaction }
    );
  });
};

// --------------------------------------------------
// UPDATE TRANSLATION TITLE / URL
// --------------------------------------------------

const updateMenuTranslation = async (
  menuId,
  menuTranslationId,
  data
) => {
  return sequelize.transaction(async (transaction) => {
    await getActiveMenu(menuId, transaction);

    const translation = await getActiveTranslation(
      menuId,
      menuTranslationId,
      transaction
    );

    const updates = {};

    if (data.menuTitle !== undefined) {
      updates.menuTitle = data.menuTitle;
    }

    if (data.menuURL !== undefined) {
      // Language code prefix add karo agar nahi hai
      const language = await Language.findByPk(translation.languageId, {
        transaction,
      });
      let finalURL = data.menuURL.trim();
      const prefix = `/${language.code}`;

      if (!finalURL.startsWith(prefix)) {
        if (finalURL === "/") {
          finalURL = `${prefix}/`;
        } else if (finalURL.startsWith("/")) {
          finalURL = `${prefix}${finalURL}`;
        } else {
          finalURL = `${prefix}/${finalURL}`;
        }
      }

      await validateUniqueUrl(
        translation.languageId,
        finalURL,
        menuTranslationId,
        transaction
      );

      updates.menuURL = finalURL;
    }

    await translation.update(updates, { transaction });

    return translation;
  });
};

// --------------------------------------------------
// PUBLISH / UNPUBLISH MENU
// --------------------------------------------------

const publishMenu = async (menuId) => {
  const menu = await getActiveMenu(menuId);
  await menu.update({ isPublished: true });
  return menu;
};

const unpublishMenu = async (menuId) => {
  const menu = await getActiveMenu(menuId);
  await menu.update({ isPublished: false });
  return menu;
};

const togglePublish = async (menuId) => {
  const menu = await getActiveMenu(menuId);

  await menu.update({
    isPublished: !menu.isPublished,
  });

  return menu;
};

// --------------------------------------------------
// SOFT DELETE MENU
// --------------------------------------------------

const deleteMenu = async (menuId) => {
  return sequelize.transaction(async (transaction) => {
    const menu = await getActiveMenu(menuId, transaction);

    const childCount = await Menu.count({
      where: {
        parentId: menuId,
        isDeleted: false,
      },
      transaction,
    });

    if (childCount > 0) {
      throw createError(
        "Cannot delete a menu while active child menus exist.",
        409
      );
    }

    const translationCount = await MenuTranslation.count({
      where: {
        menuId,
        isDeleted: false,
      },
      transaction,
    });

    if (translationCount > 0) {
      throw createError(
        "Delete or soft-delete this menu's active translations first.",
        409
      );
    }

    await menu.update(
      {
        isDeleted: true,
        isPublished: false,
        isDefault: false,
      },
      { transaction }
    );

    return menu;
  });
};

// --------------------------------------------------
// RESTORE MENU
// --------------------------------------------------

const restoreMenu = async (menuId) => {
  return sequelize.transaction(async (transaction) => {
    const menu = await Menu.findByPk(menuId, { transaction });

    if (!menu) {
      throw createError("Menu not found.", 404);
    }

    if (!menu.isDeleted) {
      return menu;
    }

    if (menu.parentId !== null) {
      const parent = await Menu.findByPk(menu.parentId, {
        transaction,
      });

      if (!parent || parent.isDeleted) {
        throw createError(
          "Restore the parent menu before restoring this menu.",
          409
        );
      }
    }

    await menu.update(
      { isDeleted: false },
      { transaction }
    );

    return menu;
  });
};

// --------------------------------------------------
// LANGUAGE-SPECIFIC NESTED NAVBAR (Admin)
// --------------------------------------------------

const getMenuHierarchy = async (
  languageId,
  options = {}
) => {
  if (languageId === undefined || languageId === null) {
    throw createError("languageId is required.");
  }

  const language = await Language.findByPk(languageId);

  if (!language || !language.isPublished) {
    throw createError("Published language not found.", 404);
  }

  const menuWhere = {
    isDeleted: false,
  };

  if (options.publishedOnly) {
    menuWhere.isPublished = true;
  }

  const menus = await Menu.findAll({
    where: menuWhere,
    attributes: ["id", "parentId", "isPublished", "isDefault"],
    include: [
      {
        model: MenuTranslation,
        as: "translations",
        where: {
          languageId,
          isDeleted: false,
        },
        required: true,
        attributes: ["id", "menuTitle", "menuURL", "languageId"],
      },
    ],
    order: [["id", "ASC"]],
  });

  const menuMap = new Map();

  for (const record of menus) {
    const menu = record.get({ plain: true });
    const translation = menu.translations?.[0];

    if (!translation) continue;

    menuMap.set(menu.id, {
      id: menu.id,
      parentId: menu.parentId,
      isPublished: Boolean(menu.isPublished),
      isDefault: Boolean(menu.isDefault),
      menuTranslationId: translation.id,
      languageId: translation.languageId,
      menuTitle: translation.menuTitle,
      menuURL: translation.menuURL,
      children: [],
    });
  }

  const tree = [];

  for (const menu of menuMap.values()) {
    if (menu.parentId !== null && menuMap.has(menu.parentId)) {
      menuMap.get(menu.parentId).children.push(menu);
    } else {
      tree.push(menu);
    }
  }

  return tree;
};
// --------------------------------------------------
// GET PARENT URL PATH (for new menu URL generation)
// Given a parent menu ID and language ID, returns the full
// URL path of the parent hierarchy in that language.
// --------------------------------------------------

const getParentURLPath = async (parentId, languageId) => {
  if (!parentId || !languageId) {
    throw createError("parentId and languageId are required.", 400);
  }

  // Language validate karo
  const language = await Language.findByPk(languageId);
  if (!language || !language.isPublished) {
    throw createError("Published language not found.", 404);
  }

  // Parent menu dhundo
  const parent = await Menu.findOne({
    where: { id: parentId, isDeleted: false },
  });
  if (!parent) {
    throw createError("Parent menu not found.", 404);
  }

  // Parent hierarchy build karo (root tak)
  const path = [];
  let current = parent;
  const visited = new Set();

  while (current) {
    if (visited.has(current.id)) {
      throw createError("Menu hierarchy has a cycle.", 400);
    }
    visited.add(current.id);

    // Har menu ki translation dhundo us language mein
    const translation = await MenuTranslation.findOne({
      where: {
        menuId: current.id,
        languageId,
        isDeleted: false,
      },
      attributes: ["id", "menuURL", "menuTitle"],
    });

    if (!translation) {
      // Translation missing — 400 error with details
      throw createError(
        `Translation missing for menu ID ${current.id} in language "${language.code}". ` +
        `Please add the translation for this menu first.`,
        400,
        "PARENT_TRANSLATION_MISSING"
      );
    }

    path.unshift({
      menuId: current.id,
      menuTitle: translation.menuTitle,
      menuURL: translation.menuURL,
    });

    current = current.parentId
      ? await Menu.findOne({ where: { id: current.parentId, isDeleted: false } })
      : null;
  }

  // Full URL path build karo (last entry ka URL hi parent path hai)
  // Example: /en/about-us/corporate-management
  const parentURL = path[path.length - 1]?.menuURL || `/${language.code}/`;

  return {
    languageId,
    languageCode: language.code,
    parentId,
    hierarchy: path,
    parentURL, // Is URL ke baad new menu ka slug append hoga
  };
};
// --------------------------------------------------
// PUBLIC NAVBAR HIERARCHY (by encrypted language ID)
// --------------------------------------------------

async function getPublicMenuHierarchy(encryptedLanguageId) {
  let languageId;

  try {
    languageId = decryptUrlParam(encryptedLanguageId);
  } catch {
    throw Object.assign(new Error("Published language not found."), {
      status: 404,
    });
  }

  if (!/^[1-9]\d*$/.test(languageId)) {
    throw Object.assign(new Error("Published language not found."), {
      status: 404,
    });
  }

  const language = await Language.findOne({
    where: {
      id: languageId,
      isPublished: true,
    },
    attributes: ["id"],
  });

  if (!language) {
    throw Object.assign(new Error("Published language not found."), {
      status: 404,
    });
  }

  const menus = await Menu.findAll({
    where: {
      isDeleted: false,
      isPublished: true,
    },
    attributes: ["id", "parentId", "isDefault"],
    include: [
      {
        model: MenuTranslation,
        as: "translations",
        where: {
          languageId: language.id,
          isDeleted: false,
        },
        required: true,
        attributes: ["id", "menuTitle", "menuURL"],
      },
    ],
    order: [["id", "ASC"]],
  });

  const nodes = new Map();

  for (const record of menus) {
    const menu = record.get({ plain: true });
    const translation = menu.translations?.[0];

    if (!translation) continue;

    nodes.set(menu.id, {
      publicId: encryptUrlParam(translation.id),
      title: translation.menuTitle,
      url: translation.menuURL,
      isDefault: Boolean(menu.isDefault),
      children: [],
      _parentId: menu.parentId,
    });
  }

  const roots = [];

  for (const node of nodes.values()) {
    const parentId = node._parentId;

    delete node._parentId;

    if (parentId !== null && nodes.has(parentId)) {
      nodes.get(parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

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