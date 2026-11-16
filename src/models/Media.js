// src/models/Media.js

const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Media = sequelize.define(
  "Media",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },

    originalName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },

    path: {
      type: DataTypes.STRING(1000),
      allowNull: false
    },

    size: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false
    },

    format: {
      type: DataTypes.STRING(20),
      allowNull: false
    },

    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: true
    }
  },
  {
    tableName: "media",
    timestamps: true
  }
);

module.exports = Media;