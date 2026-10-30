const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MenuTranslation = sequelize.define(
  "MenuTranslation",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    menuId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "menus",
        key: "id",
      },
    },

    languageId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: "languages",
        key: "id",
      },
    },

    menuTitle: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Menu title is required.",
        },
        len: {
          args: [1, 255],
          msg: "Menu title must be between 1 and 255 characters.",
        },
      },
    },

    menuURL: {
      type: DataTypes.STRING(500),
      allowNull: false,
      validate: {
        notEmpty: {
          msg: "Menu URL is required.",
        },
        len: {
          args: [1, 500],
          msg: "Menu URL must be between 1 and 500 characters.",
        },
      },
      // ❌ Yahan se index hata diya gaya hai
    },

    isDeleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "menu_translations",
    timestamps: true,

    // ✅ Indexes sirf yahan aayenge
    indexes: [
      {
        name: "uq_menu_translation_menu_language",
        unique: true,
        fields: ["menuId", "languageId"],
      },
      // ✅ Naya index yahan add kiya
      {
        name: "uq_menu_translation_language_url",
        unique: true,
        fields: ["languageId", "menuURL"],
      },
    ],
  }
);

module.exports = MenuTranslation;