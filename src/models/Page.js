const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Page = sequelize.define("Page", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  menuTranslationId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: { model: "menu_translations", key: "id" }
  },
  content: {
    type: DataTypes.TEXT("long"),
    allowNull: true
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  isDeleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: "pages",
  timestamps: true
});

module.exports = Page;
