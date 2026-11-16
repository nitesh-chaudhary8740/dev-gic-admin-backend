
const fs = require("fs/promises");
const path = require("path");

// -----------------------------------------
// SAFE NAME VALIDATION
// -----------------------------------------

function validateName(name) {
  if (typeof name !== "string") return false;

  const value = name.trim();

  if (
    !value ||
    value.length > 150 ||
    value === "." ||
    value === ".." ||
    value.startsWith(".") ||
    /[. ]$/.test(value) ||
    /[<>:"/\\|?*\x00-\x1F\x7F]/u.test(value) ||
    /[\u202A-\u202E\u2066-\u2069]/u.test(value) ||
    value.includes("..")
  ) {
    return false;
  }

  const reservedNames =
    /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/i;

  if (reservedNames.test(value)) {
    return false;
  }

  return /^[\p{L}\p{N} _().-]+$/u.test(value);
}

// -----------------------------------------
// DANGEROUS EXTENSIONS
// -----------------------------------------

function isDangerousExtension(extension) {
  const dangerousExtensions = new Set([
    "php", "php3", "php4", "php5", "php7", "php8",
    "phtml", "phar", "pht", "phps",
    "asp", "aspx", "ashx", "asmx",
    "jsp", "jspx",
    "cgi", "pl", "py", "rb",
    "js", "mjs", "cjs",
    "html", "htm", "xhtml",
    "svg", "xml",
    "exe", "dll", "com", "scr",
    "bat", "cmd", "ps1", "vbs", "vbe",
    "sh", "bash", "zsh",
    "jar", "msi", "app",
    "hta", "wsf", "wsh"
  ]);

  return dangerousExtensions.has(
    String(extension).toLowerCase()
  );
}

// -----------------------------------------
// ORIGINAL FILE NAME VALIDATION
// -----------------------------------------

function validateOriginalFileName(originalName, extension) {
  if (
    typeof originalName !== "string" ||
    !originalName.trim() ||
    originalName.length > 255 ||
    originalName.includes("/") ||
    originalName.includes("\\")
  ) {
    throw new Error("INVALID_FILE_NAME");
  }

  const parsed = path.parse(originalName);

  if (
    !parsed.name ||
    parsed.ext.slice(1).toLowerCase() !== extension
  ) {
    throw new Error("INVALID_FILE_NAME");
  }

  const parts = parsed.name.split(".");

  for (const part of parts.slice(1)) {
    if (isDangerousExtension(part)) {
      throw new Error("DANGEROUS_FILE_NAME");
    }
  }

  if (!validateName(parsed.name)) {
    throw new Error("INVALID_FILE_NAME");
  }

  return parsed.name;
}

// -----------------------------------------
// FILE SIGNATURE VALIDATION
// -----------------------------------------

function hasValidSignature(buffer, extension) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return false;
  }

  const startsWith = (...bytes) =>
    bytes.every((byte, index) => buffer[index] === byte);

  switch (extension) {
    case "jpg":
    case "jpeg":
      return (
        startsWith(0xFF, 0xD8, 0xFF) &&
        buffer[buffer.length - 2] === 0xFF &&
        buffer[buffer.length - 1] === 0xD9
      );

    case "png":
      return startsWith(
        0x89, 0x50, 0x4E, 0x47,
        0x0D, 0x0A, 0x1A, 0x0A
      );

    case "gif":
      return (
        buffer.subarray(0, 6).toString("ascii") === "GIF87a" ||
        buffer.subarray(0, 6).toString("ascii") === "GIF89a"
      );

    case "pdf":
      return buffer.subarray(0, 5).toString("ascii") === "%PDF-";

    case "mp3":
      return (
        buffer.subarray(0, 3).toString("ascii") === "ID3" ||
        (buffer[0] === 0xFF && (buffer[1] & 0xE0) === 0xE0)
      );

    case "mp4":
    case "m4a":
      return (
        buffer.length >= 12 &&
        buffer.subarray(4, 8).toString("ascii") === "ftyp"
      );

    case "wav":
      return (
        buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
        buffer.subarray(8, 12).toString("ascii") === "WAVE"
      );

    case "ogg":
      return buffer.subarray(0, 4).toString("ascii") === "OggS";

    case "zip":
    case "docx":
    case "xlsx":
    case "pptx":
      return (
        startsWith(0x50, 0x4B, 0x03, 0x04) ||
        startsWith(0x50, 0x4B, 0x05, 0x06) ||
        startsWith(0x50, 0x4B, 0x07, 0x08)
      );

    case "rar":
      return (
        buffer.subarray(0, 7).equals(
          Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00])
        ) ||
        buffer.subarray(0, 8).equals(
          Buffer.from([0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x01, 0x00])
        )
      );

    case "doc":
    case "xls":
    case "ppt":
      return startsWith(
        0xD0, 0xCF, 0x11, 0xE0,
        0xA1, 0xB1, 0x1A, 0xE1
      );

    case "txt":
    case "csv":
      return isSafeTextFile(buffer);

    default:
      return false;
  }
}

// -----------------------------------------
// TEXT / SCRIPT CONTENT VALIDATION
// -----------------------------------------

function isSafeTextFile(buffer) {
  let content;

  try {
    content = new TextDecoder("utf-8", {
      fatal: true
    }).decode(buffer);
  } catch {
    return false;
  }

  if (content.includes("\0")) {
    return false;
  }

  const dangerousPatterns = [
    /<\s*script\b/i,
    /<\s*iframe\b/i,
    /<\s*object\b/i,
    /<\s*embed\b/i,
    /<\s*applet\b/i,
    /<\s*html\b/i,
    /<\s*body\b/i,
    /<\s*svg\b/i,
    /<\s*php\b/i,
    /<\?php/i,
    /<\?=/i,
    /\bjavascript\s*:/i,
    /\bvbscript\s*:/i,
    /\bon(load|error|click|mouseover|focus|submit)\s*=/i,
    /document\s*\.\s*(write|cookie)/i,
    /window\s*\.\s*location/i,
    /\beval\s*\(/i
  ];

  return !dangerousPatterns.some(pattern =>
    pattern.test(content)
  );
}

// -----------------------------------------
// PDF ACTIVE CONTENT CHECK
// -----------------------------------------

function validatePdfContent(buffer) {
  const content = buffer.toString("latin1");

  const dangerousPdfPatterns = [
    /\/JavaScript\b/i,
    /\/JS\b/i,
    /\/OpenAction\b/i,
    /\/AA\b/i,
    /\/Launch\b/i,
    /\/EmbeddedFile\b/i
  ];

  if (
    dangerousPdfPatterns.some(pattern =>
      pattern.test(content)
    )
  ) {
    throw new Error("UNSAFE_PDF_CONTENT");
  }
}

// -----------------------------------------
// COMPLETE FILE VALIDATION
// -----------------------------------------

async function validateUploadedFile(file, extension) {
  const stat = await fs.lstat(file.path).catch(() => null);

  if (
    !stat ||
    !stat.isFile() ||
    stat.isSymbolicLink() ||
    stat.size === 0
  ) {
    throw new Error("INVALID_UPLOAD_FILE");
  }

  const buffer = await fs.readFile(file.path);

  if (!hasValidSignature(buffer, extension)) {
    throw new Error("INVALID_FILE_SIGNATURE");
  }

  if (extension === "pdf") {
    validatePdfContent(buffer);
  }

  if (["txt", "csv"].includes(extension)) {
    if (!isSafeTextFile(buffer)) {
      throw new Error("UNSAFE_FILE_CONTENT");
    }
  }

  return true;
}

// -----------------------------------------
// EXPORTS
// -----------------------------------------

module.exports = {
  validateName,
  isDangerousExtension,
  validateOriginalFileName,
  hasValidSignature,
  isSafeTextFile,
  validatePdfContent,
  validateUploadedFile
};
