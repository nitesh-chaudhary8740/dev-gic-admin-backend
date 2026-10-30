const sequelize = require("../config/database");

const Menu = require("./Menu");
const MenuTranslation = require("./MenuTranslation");
const Page = require("./Page");
const Language = require("./Language");

// A menu can have a parent and multiple child menus.
Menu.belongsTo(Menu, {
  as: "parent",
  foreignKey: "parentId"
});
Menu.hasMany(Menu, {
  as: "children",
  foreignKey: "parentId"
});

// Each logical menu has one translation per language.
Menu.hasMany(MenuTranslation, {
  as: "translations",
  foreignKey: "menuId"
});
MenuTranslation.belongsTo(Menu, {
  as: "menu",
  foreignKey: "menuId"
});

Language.hasMany(MenuTranslation, {
  as: "translations",
  foreignKey: "languageId"
});
MenuTranslation.belongsTo(Language, {
  as: "language",
  foreignKey: "languageId"
});

// Each translated menu can have one page.
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
  Language
};
