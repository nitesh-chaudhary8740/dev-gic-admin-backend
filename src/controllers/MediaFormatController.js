
const { MediaFormat } = require("../models");

class MediaFormatController {

  // GET /api/admin/media/formats
  static async getFormats(req, res) {
    try {
      const formats = await MediaFormat.findAll({
        order: [["extension", "ASC"]]
      });

      return res.status(200).json({
        success: true,
        message: "Media formats fetched successfully.",
        data: formats
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Unable to fetch media formats.",
        error: error.message
      });
    }
  }

  // POST /api/admin/media/formats
  static async createFormat(req, res) {
    try {
      let {
        extension,
        mimeTypes,
        category,
        allowedSize = 5242880
      } = req.body;

      if (!extension || !category) {
        return res.status(400).json({
          success: false,
          message: "Extension and category are required."
        });
      }

      extension = extension
        .trim()
        .toLowerCase()
        .replace(/^\./, "");

      if (!/^[a-z0-9]{1,20}$/.test(extension)) {
        return res.status(400).json({
          success: false,
          message: "Invalid file extension."
        });
      }

      if (!Array.isArray(mimeTypes) || mimeTypes.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one MIME type is required."
        });
      }

      const allowedCategories = [
        "image",
        "audio",
        "video",
        "document",
        "archive"
      ];

      category = category.toLowerCase();

      if (!allowedCategories.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid media category."
        });
      }

      // Validate allowed size (bytes)
      if (
        !Number.isSafeInteger(Number(allowedSize)) ||
        Number(allowedSize) <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "allowedSize must be a positive safe integer in bytes."
        });
      }

      allowedSize = Number(allowedSize);

      // Normalize and validate MIME types
      mimeTypes = [...new Set(
        mimeTypes
          .filter(type => typeof type === "string")
          .map(type => type.trim().toLowerCase())
          .filter(Boolean)
      )];

      if (mimeTypes.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one valid MIME type is required."
        });
      }

      const existing = await MediaFormat.findOne({
        where: { extension }
      });

      if (existing) {
        return res.status(409).json({
          success: false,
          message: "This extension already exists."
        });
      }

      const format = await MediaFormat.create({
        extension,
        mimeTypes,
        category,
        allowedSize,
        isAllowed: true
      });

      return res.status(201).json({
        success: true,
        message: "Media format created successfully.",
        data: format
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Unable to create media format.",
        error: error.message
      });
    }
  }

  // PUT /api/admin/media/formats/:id
  static async updateFormat(req, res) {
    try {
      const { id } = req.params;
      const { mimeTypes, category, allowedSize } = req.body;

      const format = await MediaFormat.findByPk(id);

      if (!format) {
        return res.status(404).json({
          success: false,
          message: "Media format not found."
        });
      }

      if (
        mimeTypes !== undefined &&
        (
          !Array.isArray(mimeTypes) ||
          mimeTypes.length === 0 ||
          mimeTypes.some(type =>
            typeof type !== "string" || !type.trim()
          )
        )
      ) {
        return res.status(400).json({
          success: false,
          message: "MIME types must be a non-empty array of valid strings."
        });
      }

      const allowedCategories = [
        "image",
        "audio",
        "video",
        "document",
        "archive"
      ];

      if (category !== undefined) {
        if (
          typeof category !== "string" ||
          !allowedCategories.includes(category.toLowerCase())
        ) {
          return res.status(400).json({
            success: false,
            message: "Invalid media category."
          });
        }
      }

      // Validate allowed size only when supplied
      if (allowedSize !== undefined) {
        if (
          !Number.isSafeInteger(Number(allowedSize)) ||
          Number(allowedSize) <= 0
        ) {
          return res.status(400).json({
            success: false,
            message: "allowedSize must be a positive safe integer in bytes."
          });
        }
      }

      const updatedData = {};

      if (mimeTypes !== undefined) {
        updatedData.mimeTypes = [...new Set(
          mimeTypes.map(type => type.trim().toLowerCase())
        )];
      }

      if (category !== undefined) {
        updatedData.category = category.toLowerCase();
      }

      if (allowedSize !== undefined) {
        updatedData.allowedSize = Number(allowedSize);
      }

      await format.update(updatedData);

      return res.status(200).json({
        success: true,
        message: "Media format updated successfully.",
        data: format
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Unable to update media format.",
        error: error.message
      });
    }
  }

  // PATCH /api/admin/media/formats/:id/status
  static async updateFormatStatus(req, res) {
    try {
      const { id } = req.params;
      const { isAllowed } = req.body;

      if (typeof isAllowed !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isAllowed must be true or false."
        });
      }

      const format = await MediaFormat.findByPk(id);

      if (!format) {
        return res.status(404).json({
          success: false,
          message: "Media format not found."
        });
      }

      await format.update({ isAllowed });

      return res.status(200).json({
        success: true,
        message: `Format ${isAllowed ? "enabled" : "disabled"} successfully.`,
        data: format
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Unable to update format status.",
        error: error.message
      });
    }
  }

  // DELETE /api/admin/media/formats/:id
  static async deleteFormat(req, res) {
    try {
      const { id } = req.params;

      const format = await MediaFormat.findByPk(id);

      if (!format) {
        return res.status(404).json({
          success: false,
          message: "Media format not found."
        });
      }

      await format.destroy();

      return res.status(200).json({
        success: true,
        message: "Media format deleted successfully."
      });

    } catch (error) {
      return res.status(500).json({
        success: false,
        message: "Unable to delete media format.",
        error: error.message
      });
    }
  }
}

module.exports = MediaFormatController;
