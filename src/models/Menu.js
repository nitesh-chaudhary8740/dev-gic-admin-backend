const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Menu = sequelize.define("Menu", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: { model: "menus", key: "id" }
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
  tableName: "menus",
  timestamps: true
});

module.exports = Menu;
