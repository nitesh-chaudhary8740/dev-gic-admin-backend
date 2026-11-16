const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Page = sequelize.define(
  "Page",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    menuId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    languageId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
    },

    content: {
      type: DataTypes.TEXT("long"),
      allowNull: false,
    },

    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "pages",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["menuId", "languageId"],
      },
    ],
  }
);

module.exports = Page;