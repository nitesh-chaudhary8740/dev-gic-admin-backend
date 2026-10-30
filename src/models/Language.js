
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Language = sequelize.define(
  "Language",
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },

    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: "Language name is required.",
        },
        len: {
          args: [1, 100],
          msg: "Language name must be between 1 and 100 characters.",
        },
      },
    },

    code: {
      type: DataTypes.STRING(6),
      allowNull: false,
      unique: true,
      validate: {
        notEmpty: {
          msg: "Language code is required.",
        },
        len: {
          args: [2, 6],
          msg: "Language code must be between 2 and 6 characters.",
        },
        is: {
          args: /^[a-z]{2,3}(-[a-zA-Z0-9]{2,3})?$/,
          msg: "Use a valid lowercase language code, optionally with a short region suffix.",
        },
      },
    },

    isPublished: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "languages",
    timestamps: true,
  }
);

module.exports = Language;
