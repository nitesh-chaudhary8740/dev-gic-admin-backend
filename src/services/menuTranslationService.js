
const {
  Menu,
  MenuTranslation,
  Language,
  Page,
} = require("../models");
const {
  encryptUrlParam,
  decryptUrlParam,
} = require("../utils/urlParamCrypto");

async function createTranslation(data) {
  const menu = await Menu.findOne({
    where: {
      id: data.menuId,
      isDeleted: false,
    },
  });

  if (!menu) {
    throw Object.assign(new Error("Menu not found."), {
      status: 404,
    });
  }

  const language = await Language.findOne({
    where: {
      id: data.languageId,
      isPublished: true,
    },
  });

  if (!language) {
    throw Object.assign(
      new Error("Published language not found."),
      { status: 404 }
    );
  }

  return MenuTranslation.create({
    menuId: data.menuId,
    languageId: data.languageId,
    menuTitle: data.menuTitle,
    menuURL: data.menuURL,
  });
}

async function getAllTranslations(filters = {}) {
  const where = {};

  if (filters.menuId) {
    where.menuId = filters.menuId;
  }

  if (filters.languageId) {
    where.languageId = filters.languageId;
  }

  return MenuTranslation.findAll({
    where,
    include: [
      {
        model: Menu,
        as: "menu",
      },
      {
        model: Language,
        as: "language",
      },
    ],
    order: [["id", "ASC"]],
  });
}

async function getTranslationById(id) {
  const translation = await MenuTranslation.findByPk(id, {
    include: [
      {
        model: Menu,
        as: "menu",
      },
      {
        model: Language,
        as: "language",
      },
      {
        model: Page,
        as: "page",
      },
    ],
  });

  if (!translation) {
    throw Object.assign(
      new Error("Menu translation not found."),
      { status: 404 }
    );
  }

  return translation;
}

async function updateTranslation(id, data) {
  const translation = await MenuTranslation.findByPk(id);

  if (!translation) {
    throw Object.assign(
      new Error("Menu translation not found."),
      { status: 404 }
    );
  }

  if (data.menuId !== undefined) {
    const menu = await Menu.findOne({
      where: {
        id: data.menuId,
        isDeleted: false,
      },
    });

    if (!menu) {
      throw Object.assign(new Error("Menu not found."), {
        status: 404,
      });
    }
  }

  if (data.languageId !== undefined) {
    const language = await Language.findOne({
      where: {
        id: data.languageId,
        isPublished: true,
      },
    });

    if (!language) {
      throw Object.assign(
        new Error("Published language not found."),
        { status: 404 }
      );
    }
  }

  const allowedFields = [
    "menuId",
    "languageId",
    "menuTitle",
    "menuURL",
  ];

  const updates = {};

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      updates[field] = data[field];
    }
  }

  await translation.update(updates);

  return getTranslationById(id);
}

async function deleteTranslation(id) {
  const translation = await MenuTranslation.findByPk(id);

  if (!translation) {
    throw Object.assign(
      new Error("Menu translation not found."),
      { status: 404 }
    );
  }

  const linkedPage = await Page.findOne({
    where: {
      menuTranslationId: id,
    },
  });

  if (linkedPage) {
    throw Object.assign(
      new Error(
        "Cannot delete this translation while its page exists."
      ),
      { status: 409 }
    );
  }

  await translation.destroy();

  return {
    id: Number(id),
    deleted: true,
  };
}

async function getMenuHierarchy(languageId) {
  const language = await Language.findOne({
    where: {
      id: languageId,
      isPublished: true,
    },
  });

  if (!language) {
    throw Object.assign(
      new Error("Published language not found."),
      { status: 404 }
    );
  }

  const menus = await Menu.findAll({
    where: {
      isDeleted: false,
      isPublished: true,
    },
    include: [
      {
        model: MenuTranslation,
        as: "translations",
        where: {
          languageId,
        },
        required: true,
      },
    ],
    order: [["id", "ASC"]],
  });

  const nodes = new Map();

  for (const record of menus) {
    const menu = record.toJSON();
    const translation = menu.translations?.[0];

    if (!translation) continue;

    nodes.set(menu.id, {
      id: menu.id,
      parentId: menu.parentId,
      menuTranslationId: translation.id,
      menuTitle: translation.menuTitle,
      menuURL: translation.menuURL,
      children: [],
    });
  }

  const roots = [];

  for (const node of nodes.values()) {
    if (node.parentId !== null && nodes.has(node.parentId)) {
      nodes.get(node.parentId).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}




// Public navbar hierarchy for a selected language
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
    attributes: ["id", "parentId"],
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
      children: [],
      // Internal parentId is used only to build the tree.
      _parentId: menu.parentId,
    });
  }

  const roots = [];

  for (const node of nodes.values()) {
    const parentId = node._parentId;

    // Remove internal DB relationship data from the public response.
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
  createTranslation,
  getAllTranslations,
  getTranslationById,
  updateTranslation,
  deleteTranslation,
  getMenuHierarchy,
  getPublicMenuHierarchy,
};
