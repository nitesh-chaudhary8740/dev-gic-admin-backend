const { Language, sequelize } = require("../models");
const { Op } = require("sequelize");
const {
  encryptUrlParam,
  decryptUrlParam,
} = require("../utils/urlParamCrypto");

// --------------------------------------------------
// GET LANGUAGE BY ID (Admin use)
// --------------------------------------------------
const getLanguageById = async (id) => {
  const language = await Language.findByPk(id);

  if (!language) {
    throw Object.assign(new Error("Language not found."), {
      status: 404,
    });
  }

  return language;
};

// --------------------------------------------------
// GET DEFAULT LANGUAGE
// --------------------------------------------------
const getDefaultLanguage = async () => {
  const language = await Language.findOne({
    where: { isDefault: true, isPublished: true },
  });

  if (!language) {
    throw Object.assign(new Error("Default language not found."), {
      status: 404,
    });
  }

  return language;
};

// --------------------------------------------------
// CREATE LANGUAGE (Admin use)
// --------------------------------------------------
const createLanguage = async (data) => {
  return sequelize.transaction(async (transaction) => {
    // Agar isDefault = true hai, toh baaki sab ka false karo
    if (data.isDefault) {
      await Language.update(
        { isDefault: false },
        { where: {}, transaction }
      );
    }

    return Language.create(
      {
        name: data.name,
        code: data.code,
        displayName: data.displayName || data.name,
        isPublished:
          data.isPublished !== undefined ? data.isPublished : true,
        isDefault: data.isDefault || false,
      },
      { transaction }
    );
  });
};

// --------------------------------------------------
// GET ALL LANGUAGES (Admin use)
// --------------------------------------------------
const getAllLanguages = async () => {
  return Language.findAll({
    order: [["id", "ASC"]],
  });
};

// --------------------------------------------------
// GET PUBLISHED LANGUAGES (Public site - internal)
// --------------------------------------------------
const getPublishedLanguages = async () => {
  return Language.findAll({
    where: { isPublished: true },
    order: [["id", "ASC"]],
  });
};

// --------------------------------------------------
// GET PUBLIC LANGUAGES (with encrypted IDs)
// --------------------------------------------------
const getPublicLanguages = async () => {
  const languages = await Language.findAll({
    where: { isPublished: true },
    attributes: ["id", "name", "code", "displayName", "isDefault", "isPublished"],
    order: [["id", "ASC"]],
  });

  return languages.map((language) => {
    const item = language.toJSON();

    return {
      publicId: encryptUrlParam(item.id),
      name: item.name,
      code: item.code,
      displayName: item.displayName,
      isDefault: item.isDefault,
    };
  });
};

// --------------------------------------------------
// GET ONE PUBLIC LANGUAGE (by encrypted ID)
// --------------------------------------------------
const getPublicLanguageById = async (encryptedId) => {
  let id;

  try {
    id = decryptUrlParam(encryptedId);
  } catch {
    throw Object.assign(new Error("Language not found."), {
      status: 404,
    });
  }

  // Database IDs must be positive integers
  if (!/^[1-9]\d*$/.test(id)) {
    throw Object.assign(new Error("Language not found."), {
      status: 404,
    });
  }

  const language = await Language.findOne({
    where: {
      id,
      isPublished: true,
    },
    attributes: ["id", "name", "code", "displayName", "isDefault", "isPublished"],
  });

  if (!language) {
    throw Object.assign(new Error("Language not found."), {
      status: 404,
    });
  }

  return {
    publicId: encryptedId,
    name: language.name,
    code: language.code,
    displayName: language.displayName,
    isDefault: language.isDefault,
  };
};

// --------------------------------------------------
// UPDATE LANGUAGE (Admin use)
// --------------------------------------------------
const updateLanguage = async (id, data) => {
  const language = await getLanguageById(id);

  const updates = {};

  if (data.name !== undefined) {
    updates.name = data.name;
  }

  if (data.code !== undefined) {
    updates.code = data.code;
  }

  if (data.displayName !== undefined) {
    updates.displayName = data.displayName;
  }

  if (data.isPublished !== undefined) {
    updates.isPublished = data.isPublished;
  }

  // isDefault updateLanguage se nahi badlega - alag endpoint hai

  await language.update(updates);

  return language;
};

// --------------------------------------------------
// SET DEFAULT LANGUAGE (Naya)
// --------------------------------------------------
const setDefaultLanguage = async (id) => {
  return sequelize.transaction(async (transaction) => {
    const language = await Language.findByPk(id, { transaction });

    if (!language) {
      throw Object.assign(new Error("Language not found."), {
        status: 404,
      });
    }

    // Agar language published nahi hai, toh default nahi ban sakti
    if (!language.isPublished) {
      throw Object.assign(
        new Error("Cannot set an unpublished language as default."),
        { status: 400 }
      );
    }

    // Baaki sab ka isDefault = false karo
    await Language.update(
      { isDefault: false },
      { where: { id: { [Op.ne]: id } }, transaction }
    );

    // Is language ko default banao
    await language.update({ isDefault: true }, { transaction });

    return language;
  });
};

// --------------------------------------------------
// PUBLISH LANGUAGE (Admin use)
// --------------------------------------------------
const publishLanguage = async (id) => {
  const language = await getLanguageById(id);

  await language.update({ isPublished: true });

  return language;
};

// --------------------------------------------------
// UNPUBLISH LANGUAGE (Admin use)
// --------------------------------------------------
const unpublishLanguage = async (id) => {
  const language = await getLanguageById(id);

  await language.update({ isPublished: false });

  return language;
};

module.exports = {
  createLanguage,
  getAllLanguages,
  getPublishedLanguages,
  getPublicLanguages,
  getPublicLanguageById,
  getLanguageById,
  getDefaultLanguage,
  updateLanguage,
  setDefaultLanguage,
  publishLanguage,
  unpublishLanguage,
};