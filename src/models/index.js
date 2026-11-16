const sequelize = require("../config/database");

const Menu = require("./Menu");
const MenuTranslation = require("./MenuTranslation");
const Page = require("./Page");
const Language = require("./Language");
const Media = require("./Media");
const MediaFormat = require("./MediaFormat");

// Menu self association
Menu.belongsTo(Menu, {
  as: "parent",
  foreignKey: "parentId"
});

Menu.hasMany(Menu, {
  as: "children",
  foreignKey: "parentId"
});

// Menu translations
Menu.hasMany(MenuTranslation, {
  as: "translations",
  foreignKey: "menuId"
});

MenuTranslation.belongsTo(Menu, {
  as: "menu",
  foreignKey: "menuId"
});

// Language translations
Language.hasMany(MenuTranslation, {
  as: "translations",
  foreignKey: "languageId"
});

MenuTranslation.belongsTo(Language, {
  as: "language",
  foreignKey: "languageId"
});

// Page association
MenuTranslation.hasOne(Page, {
  as: "page",
  foreignKey: "menuTranslationId"
});

Page.belongsTo(MenuTranslation, {
  as: "menuTranslation",
  foreignKey: "menuTranslationId"
});

module.exports = {
  sequelize,
  Menu,
  MenuTranslation,
  Page,
  Language,
  Media,
  MediaFormat
};