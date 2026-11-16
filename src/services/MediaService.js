
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

const MEDIA_ROOT = path.resolve(process.cwd(), "public", "media");

class MediaService {
  // =====================================================
  // 1. COMMON HELPERS
  // =====================================================

  static resolveLocation(location = "") {
    const normalized = String(location)
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "");

    if (
      normalized.includes("\0") ||
      normalized.split("/").some(
        (segment) => segment === "." || segment === ".."
      )
    ) {
      throw new Error("INVALID_LOCATION");
    }

    const fullPath = path.resolve(MEDIA_ROOT, normalized);

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

  static async ensureDirectory(location = "") {
    const { fullPath } = this.resolveLocation(location);

    const rootStat = await fsp.lstat(MEDIA_ROOT).catch(() => null);

    if (
      !rootStat ||
      !rootStat.isDirectory() ||
      rootStat.isSymbolicLink()
    ) {
      throw new Error("MEDIA_ROOT_NOT_FOUND");
    }

    const relative = path.relative(MEDIA_ROOT, fullPath);
    let currentPath = MEDIA_ROOT;

    if (relative) {
      for (const segment of relative.split(path.sep)) {
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

  static async getAllowedFormats() {
    return MediaFormat.findAll({
      where: { isAllowed: true },
      order: [["extension", "ASC"]]
    });
  }

  static async getFormat(extension) {
    return MediaFormat.findOne({
      where: {
        extension: String(extension).toLowerCase(),
        isAllowed: true
      }
    });
  }

  static async validateMediaFile(file) {
    if (!file || !file.path || !file.originalname) {
      throw new Error("INVALID_UPLOAD_FILE");
    }

    const extension = path.extname(file.originalname)
      .slice(1)
      .toLowerCase();

    if (!extension) {
      throw new Error("INVALID_FILE_EXTENSION");
    }

    if (isDangerousExtension(extension)) {
      throw new Error("DANGEROUS_FILE_EXTENSION");
    }

    const format = await this.getFormat(extension);

    if (!format) {
      throw new Error("FORMAT_NOT_ALLOWED");
    }

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

    const allowedSize = Number(format.allowedSize);

    if (!Number.isFinite(allowedSize) || allowedSize <= 0) {
      throw new Error("INVALID_FORMAT_CONFIGURATION");
    }

    if (Number(file.size) > allowedSize) {
      const allowedMB = (allowedSize / (1024 * 1024)).toFixed(2);
      throw new Error(`SIZE_EXCEEDS_LIMIT:${allowedMB}MB`);
    }

    // Validate actual file content, not only its extension/MIME.
    await validateUploadedFile(file, extension);

    return { extension, format };
  }

  static async getExistingFile(targetPath) {
    const stat = await fsp.lstat(targetPath).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });

    if (!stat) return false;

    if (stat.isSymbolicLink() || !stat.isFile()) {
      throw new Error("INVALID_TARGET_FILE");
    }

    return true;
  }

  static async removeTempFile(file) {
    if (file?.path) {
      await fsp.unlink(file.path).catch(() => {});
    }
  }

  static updateUploadProgress(app, uploadId, data) {
    if (!uploadId || !app?.locals?.uploadProgress?.[uploadId]) {
      return;
    }

    Object.assign(
      app.locals.uploadProgress[uploadId],
      data
    );
  }

  static isUploadCancelled(app, uploadId) {
    return Boolean(
      uploadId &&
      app?.locals?.uploadProgress?.[uploadId]?.status === "cancelled"
    );
  }

  // =====================================================
  // 2. CREATE FOLDER
  // =====================================================

  static async createFolder(folderName, parentPath = "") {
    const cleanFolderName = String(folderName || "").trim();

    if (!validateName(cleanFolderName)) {
      throw new Error("INVALID_FOLDER_NAME");
    }

    const parentDirectory = await this.ensureDirectory(parentPath);
    const folderPath = path.join(parentDirectory, cleanFolderName);

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

  // =====================================================
  // 3. SINGLE FILE UPLOAD
  // =====================================================

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
    let backupPath = null;

    try {
      const directory = await this.ensureDirectory(location);
      const { extension } = await this.validateMediaFile(file);

      const originalBaseName = validateOriginalFileName(
        file.originalname,
        extension
      );

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

        if (customExtension && customExtension !== extension) {
          throw new Error("INVALID_FILE_NAME");
        }

        baseName = customExtension
          ? path.parse(customName).name
          : customName;

        if (!validateName(baseName)) {
          throw new Error("INVALID_FILE_NAME");
        }
      }

      let finalName = `${baseName}.${extension}`;
      targetPath = path.join(directory, finalName);

      let exists = await this.getExistingFile(targetPath);

      if (exists) {
        if (!["replace", "rename"].includes(conflictAction)) {
          throw new Error("FILE_ALREADY_EXISTS");
        }

        if (conflictAction === "rename") {
          let counter = 1;

          do {
            const suffix = String(counter).padStart(2, "0");
            finalName = `${baseName}_${suffix}.${extension}`;
            targetPath = path.join(directory, finalName);

            exists = await this.getExistingFile(targetPath);
            counter++;
          } while (exists);
        }
      }

      if (conflictAction === "replace" && exists) {
        backupPath = path.join(
          directory,
          `.backup-${crypto.randomUUID()}`
        );

        await fsp.rename(targetPath, backupPath);
      }

      try {
        await fsp.rename(file.path, targetPath);
        uploadedFileMoved = true;
      } catch (error) {
        if (backupPath) {
          await fsp.rename(backupPath, targetPath).catch(() => {});
          backupPath = null;
        }

        throw error;
      }

      if (backupPath) {
        await fsp.unlink(backupPath).catch(() => {});
        backupPath = null;
      }

      const stat = await fsp.stat(targetPath);

      const relativePath = path.posix.join(
        location.replace(/\\/g, "/"),
        finalName
      );

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
      if (!uploadedFileMoved) {
        await this.removeTempFile(file);
      }
    }
  }

  // =====================================================
  // 4. STREAM COPY WITH PROGRESS AND CANCELLATION
  // =====================================================

  static async copyFileWithProgress({
    sourcePath,
    targetPath,
    fileSize,
    app,
    uploadId,
    originalName
  }) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(sourcePath, {
        highWaterMark: 64 * 1024
      });

      // "wx" prevents accidentally overwriting an existing target.
      const writeStream = fs.createWriteStream(targetPath, {
        flags: "wx"
      });

      let bytesWritten = 0;
      let lastPercent = -1;
      let settled = false;

      const cleanup = async (error) => {
        if (settled) return;
        settled = true;

        readStream.destroy();
        writeStream.destroy();

        await fsp.unlink(targetPath).catch(() => {});

        reject(error);
      };

      readStream.on("data", (chunk) => {
        if (this.isUploadCancelled(app, uploadId)) {
          cleanup(new Error("CANCELLED_BY_USER"));
          return;
        }

        bytesWritten += chunk.length;

        if (fileSize > 0) {
          const percent = Math.min(
            100,
            Math.floor((bytesWritten / fileSize) * 100)
          );

          if (percent !== lastPercent) {
            lastPercent = percent;

            this.updateUploadProgress(app, uploadId, {
              currentFileProgress: percent,
              message: `Processing ${originalName} (${percent}%)`
            });
          }
        }
      });

      readStream.on("error", cleanup);
      writeStream.on("error", cleanup);

      writeStream.on("finish", () => {
        if (settled) return;
        settled = true;
        resolve();
      });

      readStream.pipe(writeStream);
    });
  }

  // =====================================================
  // 5. BULK FILE UPLOAD
  // =====================================================

  static async bulkUploadFiles({
    files = [],
    location = "",
    conflictAction = "cancel",
    uploadId,
    app
  }) {
    const results = {
      success: [],
      skipped: [],
      failed: [],
      cancelled: false
    };

    if (!Array.isArray(files) || files.length === 0) {
      throw new Error("FILES_REQUIRED");
    }

    if (!["cancel", "rename", "replace"].includes(conflictAction)) {
      throw new Error("INVALID_CONFLICT_ACTION");
    }

    const destinationDir = await this.ensureDirectory(location);
    const totalFiles = files.length;

    this.updateUploadProgress(app, uploadId, {
      status: "processing",
      totalFiles,
      processedFiles: 0,
      currentFile: "",
      currentFileProgress: 0,
      message: "Starting bulk upload..."
    });

    for (let i = 0; i < totalFiles; i++) {
      const file = files[i];

      if (this.isUploadCancelled(app, uploadId)) {
        results.cancelled = true;
        break;
      }

      const originalName = file.originalname || "Unknown file";
      let targetPath = null;
      let backupPath = null;
      let fileMoved = false;

      this.updateUploadProgress(app, uploadId, {
        processedFiles: i,
        currentFile: originalName,
        currentFileProgress: 0,
        message: `Validating ${originalName}...`
      });

      try {
        const { extension } = await this.validateMediaFile(file);

        // Validate and normalize the original filename.
        const baseName = validateOriginalFileName(
          originalName,
          extension
        );

        let finalName = `${baseName}.${extension}`;
        targetPath = path.join(destinationDir, finalName);

        let exists = await this.getExistingFile(targetPath);

        if (exists) {
          if (conflictAction === "cancel") {
            results.skipped.push({
              name: originalName,
              reason: "NAME_CONFLICT"
            });

            continue;
          }

          if (conflictAction === "rename") {
            let counter = 1;

            do {
              finalName = `${baseName}(${counter}).${extension}`;
              targetPath = path.join(destinationDir, finalName);

              exists = await this.getExistingFile(targetPath);
              counter++;
            } while (exists);
          }

          if (conflictAction === "replace") {
            backupPath = path.join(
              destinationDir,
              `.backup-${crypto.randomUUID()}`
            );

            await fsp.rename(targetPath, backupPath);
          }
        }

        if (this.isUploadCancelled(app, uploadId)) {
          if (backupPath) {
            await fsp.rename(backupPath, targetPath).catch(() => {});
            backupPath = null;
          }

          results.cancelled = true;
          break;
        }

        this.updateUploadProgress(app, uploadId, {
          currentFile: originalName,
          currentFileProgress: 0,
          message: `Copying ${originalName}...`
        });

        await this.copyFileWithProgress({
          sourcePath: file.path,
          targetPath,
          fileSize: Number(file.size) || 0,
          app,
          uploadId,
          originalName
        });

        fileMoved = true;

        // Remove the old version only after the new file is copied.
        if (backupPath) {
          await fsp.unlink(backupPath).catch(() => {});
          backupPath = null;
        }

        await this.removeTempFile(file);

        results.success.push({
          originalName,
          savedName: finalName
        });

        this.updateUploadProgress(app, uploadId, {
          processedFiles: i + 1,
          currentFile: originalName,
          currentFileProgress: 100,
          message: `Uploaded ${originalName}`
        });
      } catch (error) {
        // Remove an incomplete destination file.
        if (!fileMoved && targetPath) {
          await fsp.unlink(targetPath).catch(() => {});
        }

        // Restore the previous file if replacement failed.
        if (backupPath && targetPath) {
          await fsp.rename(backupPath, targetPath).catch(() => {});
          backupPath = null;
        }

        await this.removeTempFile(file);

        if (error.message === "CANCELLED_BY_USER") {
          results.cancelled = true;
          break;
        }

        let reason = error.message || "UPLOAD_FAILED";

        if (reason.startsWith("SIZE_EXCEEDS_LIMIT:")) {
          reason = `File size exceeds the allowed limit (${reason.split(":")[1]})`;
        }

        results.failed.push({
          name: originalName,
          reason
        });

        this.updateUploadProgress(app, uploadId, {
          processedFiles: i + 1,
          currentFile: originalName,
          currentFileProgress: 100,
          message: `Failed: ${originalName}`
        });
      }
    }

    // Remove remaining Multer temporary files after cancellation.
    if (results.cancelled) {
      for (const file of files) {
        await this.removeTempFile(file);
      }
    }

    this.updateUploadProgress(app, uploadId, {
      status: results.cancelled ? "cancelled" : "completed",
      processedFiles:
        results.success.length +
        results.skipped.length +
        results.failed.length,
      currentFile: "",
      currentFileProgress: results.cancelled ? 0 : 100,
      message: results.cancelled
        ? "Upload cancelled."
        : "Bulk upload completed."
    });

    return results;
  }

  // =====================================================
  // 6. DELETE FILE
  // =====================================================

  static async deleteFile(location) {
    if (!location) {
      throw new Error("INVALID_LOCATION");
    }

    const { fullPath, relativePath } = this.resolveLocation(location);
    const parentPath = path.posix.dirname(relativePath);

    await this.ensureDirectory(
      parentPath === "." ? "" : parentPath
    );

    const stat = await fsp.lstat(fullPath).catch((error) => {
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
  // =====================================================
  // 6A. DELETE MULTIPLE FILES
  // =====================================================

  static async deleteFiles({
    location = "",
    fileNames = []
  }) {
    if (!Array.isArray(fileNames) || fileNames.length === 0) {
      throw new Error("FILES_REQUIRED");
    }

    if (fileNames.length > 100) {
      throw new Error("TOO_MANY_FILES");
    }

    // Validate and resolve the selected folder.
    const { relativePath } = this.resolveLocation(location);
    const directory = await this.ensureDirectory(relativePath);

    const results = {
      deleted: [],
      failed: []
    };

    for (const fileName of fileNames) {
      // Never allow a filename to become a path.
      if (
        typeof fileName !== "string" ||
        !fileName ||
        fileName === "." ||
        fileName === ".." ||
        fileName.includes("/") ||
        fileName.includes("\\") ||
        fileName.includes("\0")
      ) {
        results.failed.push({
          fileName: String(fileName),
          reason: "INVALID_FILE_NAME"
        });

        continue;
      }

      const targetPath = path.join(directory, fileName);

      try {
        const stat = await fsp.lstat(targetPath).catch((error) => {
          if (error.code === "ENOENT") return null;
          throw error;
        });

        if (!stat) {
          results.failed.push({
            fileName,
            reason: "FILE_NOT_FOUND"
          });

          continue;
        }

        // Do not delete directories or symbolic links.
        if (stat.isSymbolicLink() || !stat.isFile()) {
          results.failed.push({
            fileName,
            reason: "INVALID_MEDIA_FILE"
          });

          continue;
        }

        await fsp.unlink(targetPath);

        results.deleted.push(fileName);

      } catch (error) {
        results.failed.push({
          fileName,
          reason: error.message || "DELETE_FAILED"
        });
      }
    }

    return {
      location: relativePath,
      totalRequested: fileNames.length,
      totalDeleted: results.deleted.length,
      totalFailed: results.failed.length,
      ...results
    };
  }
  // =====================================================
  // 7. DELETE EMPTY FOLDER
  // =====================================================

  static async deleteFolder(location) {
    if (!location) {
      throw new Error("ROOT_FOLDER_DELETE_NOT_ALLOWED");
    }

    const { fullPath, relativePath } = this.resolveLocation(location);
    const parentPath = path.posix.dirname(relativePath);

    await this.ensureDirectory(
      parentPath === "." ? "" : parentPath
    );

    const stat = await fsp.lstat(fullPath).catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });

    if (
      !stat ||
      !stat.isDirectory() ||
      stat.isSymbolicLink()
    ) {
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

  // =====================================================
  // 8. GET CONTENT BY LOCATION
  // =====================================================

  static async getContentByLocation(location = "") {
    const normalizedLocation = String(location)
      .replace(/\\/g, "/")
      .replace(/^\/+|\/+$/g, "");

    const directory = await this.ensureDirectory(normalizedLocation);
    const entries = await fsp.readdir(directory);
    const contents = [];

    for (const entryName of entries) {
      const fullPath = path.join(directory, entryName);
      const stat = await fsp.lstat(fullPath);

      // Never expose symbolic links.
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

  // =====================================================
  // 9. GET ALLOWED FORMATS
  // =====================================================

  static async getFormats() {
    return this.getAllowedFormats();
  }
}

module.exports = MediaService;
