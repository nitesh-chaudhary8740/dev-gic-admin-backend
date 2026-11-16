
const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MediaFormat = sequelize.define(
  "MediaFormat",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    extension: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
    },

    mimeTypes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },

    category: {
      type: DataTypes.STRING(30),
      allowNull: false
    },

    allowedSize: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
      defaultValue: 5242880,
      comment: "Maximum allowed file size in bytes"
    },

    isAllowed: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    tableName: "media_formats",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["extension"]
      }
    ]
  }
);

module.exports = MediaFormat;
