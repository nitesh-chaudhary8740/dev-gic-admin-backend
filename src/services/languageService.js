
const { Language } = require("../models");
const {
  encryptUrlParam,
  decryptUrlParam,
} = require("../utils/urlParamCrypto");

// Get language by database ID (Admin use)
const getLanguageById = async (id) => {
  const language = await Language.findByPk(id);

  if (!language) {
    throw Object.assign(new Error("Language not found."), {
      status: 404,
    });
  }

  return language;
};

// Create language (Admin use)
const createLanguage = async (data) => {
  return Language.create({
    name: data.name,
    code: data.code,
    isPublished:
      data.isPublished !== undefined ? data.isPublished : true,
  });
};

// Get all languages (Admin use)
const getAllLanguages = async () => {
  return Language.findAll({
    order: [["id", "ASC"]],
  });
};

// Get published languages (existing method)
const getPublishedLanguages = async () => {
  return Language.findAll({
    where: { isPublished: true },
    order: [["id", "ASC"]],
  });
};

// Get public languages with encrypted IDs
const getPublicLanguages = async () => {
  const languages = await Language.findAll({
    where: { isPublished: true },
    attributes: ["id", "name", "code", "isPublished"],
    order: [["id", "ASC"]],
  });

  return languages.map((language) => {
    const item = language.toJSON();

    return {
      publicId: encryptUrlParam(item.id),
      name: item.name,
      code: item.code,
    };
  });
};

// Get one public language using its encrypted ID
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
    attributes: ["name", "code", "isPublished"],
  });

  if (!language) {
    throw Object.assign(new Error("Language not found."), {
      status: 404,
    });
  }

  return language;
};

// Update language (Admin use)
const updateLanguage = async (id, data) => {
  const language = await getLanguageById(id);

  const updates = {};

  if (data.name !== undefined) {
    updates.name = data.name;
  }

  if (data.code !== undefined) {
    updates.code = data.code;
  }

  if (data.isPublished !== undefined) {
    updates.isPublished = data.isPublished;
  }

  await language.update(updates);

  return language;
};

// Publish language (Admin use)
const publishLanguage = async (id) => {
  const language = await getLanguageById(id);

  await language.update({ isPublished: true });

  return language;
};

// Unpublish language (Admin use)
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
  updateLanguage,
  publishLanguage,
  unpublishLanguage,
};
