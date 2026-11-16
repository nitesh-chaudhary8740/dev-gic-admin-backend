const Language = require("./Language");
const Menu = require("./Menu");
const Page = require("./Page");

// Language -> Pages
Language.hasMany(Page, {
  foreignKey: "languageId",
  as: "pages",
});

Page.belongsTo(Language, {
  foreignKey: "languageId",
  as: "language",
});

// Menu -> Pages
Menu.hasMany(Page, {
  foreignKey: "menuId",
  as: "pages",
});

Page.belongsTo(Menu, {
  foreignKey: "menuId",
  as: "menu",
});

// Menu -> Menu (parent/children)
Menu.belongsTo(Menu, {
  foreignKey: "parentId",
  as: "parent",
});

Menu.hasMany(Menu, {
  foreignKey: "parentId",
  as: "children",
});

module.exports = {
  Language,
  Menu,
  Page,
};   