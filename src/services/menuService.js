
const { Menu, MenuTranslation, Language, Page } = require("../models");
const sequelize = require("../config/database");

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
    where.id = { [require("sequelize").Op.ne]: excludeTranslationId };
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
// --------------------------------------------------

const createMenu = async (data) => {
  const {
    languageId,
    menuTitle,
    menuURL,
    parentId = null,
    isPublished = false,
  } = data;

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
    await validateLanguage(languageId, transaction);
    await validateParent(parentId, null, transaction);

    await validateUniqueUrl(
      languageId,
      menuURL,
      null,
      transaction
    );

    const menu = await Menu.create(
      {
        parentId,
        isPublished,
        isDeleted: false,
      },
      { transaction }
    );

    const translation = await MenuTranslation.create(
      {
        menuId: menu.id,
        languageId,
        menuTitle,
        menuURL,
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
// languageId omitted/null: all translations for CMS
// languageId supplied: only that language
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
        attributes: ["id", "parentId", "isPublished"],
        required: false,
      },
      {
        model: Menu,
        as: "children",
        where: { isDeleted: false },
        attributes: ["id", "parentId", "isPublished"],
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
            attributes: ["id", "name", "code", "isPublished"],
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
        attributes: ["id", "parentId", "isPublished"],
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
            attributes: ["id", "name", "code", "isPublished"],
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
// UPDATE COMMON MENU FIELDS
// parentId and menu-level publication
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

    await menu.update(updates, { transaction });

    return menu;
  });
};

// --------------------------------------------------
// ADD ANOTHER LANGUAGE TO EXISTING MENU
// Does not create another Menu record
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
    await validateLanguage(languageId, transaction);

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
      menuURL,
      null,
      transaction
    );

    return MenuTranslation.create(
      {
        menuId,
        languageId,
        menuTitle,
        menuURL,
        isDeleted: false,
      },
      { transaction }
    );
  });
};

// --------------------------------------------------
// UPDATE TRANSLATION TITLE / URL
// Language changes are handled by adding a translation
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
      await validateUniqueUrl(
        translation.languageId,
        data.menuURL,
        menuTranslationId,
        transaction
      );

      updates.menuURL = data.menuURL;
    }

    // Do not change menuId/languageId through this method.
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
// Require children/translations to be handled first
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
// LANGUAGE-SPECIFIC NESTED NAVBAR
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
    attributes: ["id", "parentId", "isPublished"],
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

module.exports = {
  createMenu,
  getAllMenus,
  getMenuById,
  updateMenu,
  addMenuTranslation,
  updateMenuTranslation,
  publishMenu,
  unpublishMenu,
  togglePublish,
  deleteMenu,
  restoreMenu,
  getMenuHierarchy,
};
