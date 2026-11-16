const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Menu = sequelize.define(
  "Menu",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    menuTitle: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    menuURL: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },

    parentId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },

    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },

    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "menus",
    timestamps: true,
  }
);

module.exports = Menu;