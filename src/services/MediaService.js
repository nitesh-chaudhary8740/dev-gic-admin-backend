const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const { MediaFormat } = require("../models");

const {
  validateName,
  isDangerousExtension,
  validateOriginalFileName,
  validateUploadedFile
} = require("../utils/mediaValidation");

const MEDIA_ROOT = path.resolve(
  process.cwd(),
  "public",
  "media"
);

class MediaService {

  // -----------------------------------------
  // COMMON HELPERS
  // -----------------------------------------

  static resolveLocation(location = "") {
    const normalized = String(location)
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "");

    if (
      normalized.includes("\0") ||
      normalized.split("/").some(
        part => part === "." || part === ".."
      )
    ) {
      throw new Error("INVALID_LOCATION");
    }

    const fullPath = path.resolve(
      MEDIA_ROOT,
      normalized
    );

    if (
      fullPath !== MEDIA_ROOT &&
      !fullPath.startsWith(MEDIA_ROOT + path.sep)
    ) {
      throw new Error("INVALID_LOCATION");
    }

    return {
      fullPath,
      relativePath: normalized
    };
  }

  // -----------------------------------------
  // CHECK DIRECTORY AND SYMBOLIC LINKS
  // -----------------------------------------

  static async ensureDirectory(location = "") {
    const { fullPath } = this.resolveLocation(location);

    // Check media root first
    const rootStat = await fsp.lstat(MEDIA_ROOT).catch(() => null);

    if (
      !rootStat ||
      !rootStat.isDirectory() ||
      rootStat.isSymbolicLink()
    ) {
      throw new Error("MEDIA_ROOT_NOT_FOUND");
    }

    // Check every directory component
    const relative = path.relative(MEDIA_ROOT, fullPath);

    let currentPath = MEDIA_ROOT;

    if (relative) {
      const segments = relative.split(path.sep);

      for (const segment of segments) {
        currentPath = path.join(currentPath, segment);

        const stat = await fsp.lstat(currentPath).catch(() => null);

        if (
          !stat ||
          !stat.isDirectory() ||
          stat.isSymbolicLink()
        ) {
          throw new Error("FOLDER_NOT_FOUND");
        }
      }
    }

    return fullPath;
  }

  // -----------------------------------------
  // GET ALLOWED FORMATS
  // -----------------------------------------

  static async getAllowedFormats() {
    return MediaFormat.findAll({
      where: {
        isAllowed: true
      },
      order: [
        ["extension", "ASC"]
      ]
    });
  }

  // -----------------------------------------
  // GET SINGLE ALLOWED FORMAT
  // -----------------------------------------

  static async getFormat(extension) {
    return MediaFormat.findOne({
      where: {
        extension: extension.toLowerCase(),
        isAllowed: true
      }
    });
  }

  // -----------------------------------------
  // 1. CREATE FOLDER
  // -----------------------------------------

  static async createFolder(folderName, parentPath = "") {
    const cleanFolderName = String(folderName || "").trim();

    if (!validateName(cleanFolderName)) {
      throw new Error("INVALID_FOLDER_NAME");
    }

    const parentDirectory =
      await this.ensureDirectory(parentPath);

    const folderPath = path.join(
      parentDirectory,
      cleanFolderName
    );

    try {
      await fsp.mkdir(folderPath);
    } catch (error) {
      if (error.code === "EEXIST") {
        throw new Error("FOLDER_ALREADY_EXISTS");
      }

      throw error;
    }

    const relativePath = path.posix.join(
      parentPath.replace(/\\/g, "/"),
      cleanFolderName
    );

    return {
      id: `folder:${relativePath}`,
      type: "folder",
      name: cleanFolderName,
      path: relativePath
    };
  }

  // -----------------------------------------
  // 2. UPLOAD FILE (Single)
  // -----------------------------------------

  static async uploadFile({
    file,
    location = "",
    fileName = "",
    conflictAction = ""
  }) {
    if (!file) {
      throw new Error("FILE_REQUIRED");
    }

    let uploadedFileMoved = false;
    let targetPath = null;

    try {

      // Validate destination directory
      const directory =
        await this.ensureDirectory(location);

      // -----------------------------------------
      // EXTENSION VALIDATION
      // -----------------------------------------

      const extension = path.extname(file.originalname)
        .slice(1)
        .toLowerCase();

      if (!extension) {
        throw new Error("INVALID_FILE_EXTENSION");
      }

      // Block executable and script extensions
      if (isDangerousExtension(extension)) {
        throw new Error("DANGEROUS_FILE_EXTENSION");
      }

      // -----------------------------------------
      // DATABASE FORMAT VALIDATION
      // -----------------------------------------

      const format = await this.getFormat(extension);

      if (!format) {
        throw new Error("FORMAT_NOT_ALLOWED");
      }

      // Sequelize JSON column may return array or string
      let mimeTypes = format.mimeTypes;

      if (typeof mimeTypes === "string") {
        try {
          mimeTypes = JSON.parse(mimeTypes);
        } catch {
          throw new Error("INVALID_FORMAT_CONFIGURATION");
        }
      }

      if (
        !Array.isArray(mimeTypes) ||
        !mimeTypes.includes(file.mimetype)
      ) {
        throw new Error("INVALID_MIME_TYPE");
      }

      // -----------------------------------------
      // ORIGINAL FILE NAME VALIDATION
      // -----------------------------------------

      const originalBaseName =
        validateOriginalFileName(
          file.originalname,
          extension
        );

      // -----------------------------------------
      // CUSTOM FILE NAME VALIDATION
      // -----------------------------------------

      let baseName = originalBaseName;

      if (fileName) {
        const customName = String(fileName).trim();

        if (
          customName.includes("/") ||
          customName.includes("\\")
        ) {
          throw new Error("INVALID_FILE_NAME");
        }

        const customExtension = path.extname(customName)
          .slice(1)
          .toLowerCase();

        if (
          customExtension &&
          customExtension !== extension
        ) {
          throw new Error("INVALID_FILE_NAME");
        }

        baseName = customExtension
          ? path.parse(customName).name
          : customName;

        if (!validateName(baseName)) {
          throw new Error("INVALID_FILE_NAME");
        }
      }

      // -----------------------------------------
      // ACTUAL FILE CONTENT VALIDATION
      // -----------------------------------------

      await validateUploadedFile(file, extension);

      // -----------------------------------------
      // DUPLICATE FILE HANDLING
      // -----------------------------------------

      let finalName = `${baseName}.${extension}`;

      targetPath = path.join(directory, finalName);

      const getExisting = async (target) => {
        const stat = await fsp.lstat(target).catch(error => {
          if (error.code === "ENOENT") return null;
          throw error;
        });

        if (!stat) return false;

        if (
          stat.isSymbolicLink() ||
          !stat.isFile()
        ) {
          throw new Error("INVALID_TARGET_FILE");
        }

        return true;
      };

      let exists = await getExisting(targetPath);

      if (exists) {

        if (!["replace", "rename"].includes(conflictAction)) {
          throw new Error("FILE_ALREADY_EXISTS");
        }

        // -----------------------------------------
        // RENAME DUPLICATE
        // -----------------------------------------

        if (conflictAction === "rename") {
          let counter = 1;

          do {
            const suffix = String(counter).padStart(2, "0");

            finalName = `${baseName}_${suffix}.${extension}`;

            targetPath = path.join(directory, finalName);

            exists = await getExisting(targetPath);

            counter++;
          } while (exists);
        }
      }

      // Relative path from public/media
      const relativePath = path.posix.join(
        location.replace(/\\/g, "/"),
        finalName
      );

      // -----------------------------------------
      // REPLACE EXISTING FILE
      // -----------------------------------------

      if (conflictAction === "replace" && exists) {

        const backupPath = path.join(
          directory,
          `.backup-${crypto.randomUUID()}`
        );

        await fsp.rename(targetPath, backupPath);

        try {
          await fsp.rename(file.path, targetPath);

          uploadedFileMoved = true;

          await fsp.unlink(backupPath);

        } catch (error) {

          // Remove new file if it was moved
          if (uploadedFileMoved) {
            await fsp.unlink(targetPath).catch(() => {});
          }

          // Restore old file
          await fsp.rename(backupPath, targetPath).catch(() => {});

          throw error;
        }

      } else {

        // -----------------------------------------
        // NEW FILE UPLOAD
        // -----------------------------------------

        await fsp.rename(file.path, targetPath);

        uploadedFileMoved = true;
      }

      // -----------------------------------------
      // RESPONSE
      // -----------------------------------------

      const stat = await fsp.stat(targetPath);

      return {
        id: `file:${relativePath}`,
        type: "file",
        name: finalName,
        fileName: finalName,
        originalName: file.originalname,
        path: relativePath,
        url: `/media/${relativePath}`,
        size: stat.size,
        format: extension,
        mimeType: file.mimetype,
        createdAt: stat.birthtime,
        updatedAt: stat.mtime
      };

    } finally {

      // Remove temporary upload if not moved
      if (!uploadedFileMoved && file.path) {
        await fsp.unlink(file.path).catch(() => {});
      }
    }
  }

  // -----------------------------------------
  // 🟢 3. BULK UPLOAD FILES (NEW)
  // No DB. Chunked stream copy with SSE progress.
  // -----------------------------------------

  static async bulkUploadFiles({
    files,
    location = "",
    conflictAction = "cancel",
    uploadId,
    app
  }) {
    const results = { success: [], skipped: [], failed: [] };

    // Resolve destination directory
    const { fullPath: destinationDir } = this.resolveLocation(location);

    // Ensure directory exists (but not via ensureDirectory — that requires parent exist)
    await fsp.mkdir(destinationDir, { recursive: true });

    const totalFiles = files.length;

    const updateProgress = (data) => {
      if (uploadId && app && app.locals.uploadProgress && app.locals.uploadProgress[uploadId]) {
        Object.assign(app.locals.uploadProgress[uploadId], data);
      }
    };

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];
      const originalName = file.originalname;
      const fileSize = Number(file.size) || 0;

      updateProgress({
        processedFiles: i,
        currentFile: originalName,
        currentFileProgress: 0,
        message: `Processing ${originalName}...`
      });

      const extension = path.extname(originalName).slice(1).toLowerCase();

      // Reject dangerous extensions
      if (!extension || isDangerousExtension(extension)) {
        await fsp.unlink(file.path).catch(() => {});
        results.failed.push({ name: originalName, reason: "INVALID_FILE_EXTENSION" });
        continue;
      }

      // Resolve final name
      let finalName = originalName;
      let targetPath = path.join(destinationDir, finalName);

      try {
        const exists = await fsp.access(targetPath).then(() => true).catch(() => false);

        if (exists) {
          if (conflictAction === "cancel") {
            await fsp.unlink(file.path).catch(() => {});
            results.skipped.push({ name: originalName, reason: "NAME_CONFLICT" });
            continue;
          }

          if (conflictAction === "rename") {
            const parsed = path.parse(originalName);
            let counter = 1;
            do {
              finalName = `${parsed.name}(${counter})${parsed.ext}`;
              targetPath = path.join(destinationDir, finalName);
              counter++;
            } while (await fsp.access(targetPath).then(() => true).catch(() => false));
          }

          if (conflictAction === "replace") {
            // If exists, remove first (we stream below)
            await fsp.unlink(targetPath).catch(() => {});
          }
        }

        // -----------------------------------------
        // 🟢 Chunked stream copy with progress
        // -----------------------------------------
        await new Promise((resolve, reject) => {
          const readStream = fs.createReadStream(file.path, {
            highWaterMark: 64 * 1024 // 64 KB chunks
          });
          const writeStream = fs.createWriteStream(targetPath);

          let bytesWritten = 0;
          let lastReportedPercent = -1;

          readStream.on("data", (chunk) => {
            bytesWritten += chunk.length;

            if (fileSize > 0) {
              const percent = Math.floor((bytesWritten / fileSize) * 100);

              // Throttle: only update on percent change
              if (percent !== lastReportedPercent) {
                lastReportedPercent = percent;
                updateProgress({
                  currentFileProgress: percent,
                  message: `Uploading ${originalName} (${percent}%)`
                });
              }
            }
          });

          readStream.on("error", (err) => {
            writeStream.destroy();
            reject(err);
          });

          writeStream.on("error", (err) => {
            readStream.destroy();
            reject(err);
          });

          writeStream.on("finish", async () => {
            await fsp.unlink(file.path).catch(() => {});
            resolve();
          });

          readStream.pipe(writeStream);
        });

        results.success.push({
          originalName,
          savedName: finalName
        });

        updateProgress({
          processedFiles: i + 1,
          currentFileProgress: 100
        });

      } catch (err) {
        await fsp.unlink(file.path).catch(() => {});
        results.failed.push({ name: originalName, reason: err.message });
        updateProgress({
          processedFiles: i + 1,
          currentFileProgress: 100,
          message: `Failed: ${originalName}`
        });
      }
    }

    return results;
  }

  // -----------------------------------------
  // 4. DELETE FILE
  // -----------------------------------------

  static async deleteFile(location) {
    if (!location) {
      throw new Error("INVALID_LOCATION");
    }

    const { fullPath, relativePath } =
      this.resolveLocation(location);

    const parentPath = path.posix.dirname(relativePath);

    await this.ensureDirectory(
      parentPath === "." ? "" : parentPath
    );

    const stat = await fsp.lstat(fullPath).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });

    if (!stat) {
      throw new Error("MEDIA_NOT_FOUND");
    }

    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error("INVALID_MEDIA_FILE");
    }

    await fsp.unlink(fullPath);

    return {
      path: relativePath,
      message: "File deleted successfully."
    };
  }

  // -----------------------------------------
  // 5. DELETE EMPTY FOLDER
  // -----------------------------------------

  static async deleteFolder(location) {
    if (!location) {
      throw new Error("ROOT_FOLDER_DELETE_NOT_ALLOWED");
    }

    const { fullPath, relativePath } =
      this.resolveLocation(location);

    const parentPath = path.posix.dirname(relativePath);

    await this.ensureDirectory(
      parentPath === "." ? "" : parentPath
    );

    const stat = await fsp.lstat(fullPath).catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });

    if (!stat || !stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error("FOLDER_NOT_FOUND");
    }

    const contents = await fsp.readdir(fullPath);

    if (contents.length > 0) {
      throw new Error("FOLDER_NOT_EMPTY");
    }

    await fsp.rmdir(fullPath);

    return {
      path: relativePath,
      message: "Folder deleted successfully."
    };
  }

  // -----------------------------------------
  // 6. GET CONTENT BY LOCATION
  // -----------------------------------------

  static async getContentByLocation(location = "") {
    const normalizedLocation = String(location)
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "");

    const directory =
      await this.ensureDirectory(normalizedLocation);

    const entries = await fsp.readdir(directory);

    const contents = [];

    for (const entryName of entries) {
      const fullPath = path.join(directory, entryName);
      const stat = await fsp.lstat(fullPath);

      if (stat.isSymbolicLink()) continue;

      const relativePath = path.posix.join(
        normalizedLocation,
        entryName
      );

      if (stat.isDirectory()) {
        contents.push({
          id: `folder:${relativePath}`,
          type: "folder",
          name: entryName,
          path: relativePath,
          size: 0,
          createdAt: stat.birthtime,
          updatedAt: stat.mtime
        });
      } else if (stat.isFile()) {
        contents.push({
          id: `file:${relativePath}`,
          type: "file",
          name: entryName,
          fileName: entryName,
          path: relativePath,
          url: `/media/${relativePath}`,
          size: stat.size,
          format: path.extname(entryName).slice(1).toLowerCase(),
          createdAt: stat.birthtime,
          updatedAt: stat.mtime
        });
      }
    }

    contents.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === "folder" ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return {
      location: normalizedLocation,
      total: contents.length,
      contents
    };
  }

  // -----------------------------------------
  // 7. GET ALLOWED FORMATS
  // -----------------------------------------

  static async getFormats() {
    return this.getAllowedFormats();
  }
}

module.exports = MediaService;