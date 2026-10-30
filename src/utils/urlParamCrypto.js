const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

const getEncryptionKey = () => {
  const keyHex = process.env.URL_PARAM_ENCRYPTION_KEY;

  if (!keyHex || !/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error(
      "URL_PARAM_ENCRYPTION_KEY must be a 64-character hex key."
    );
  }

  return Buffer.from(keyHex, "hex");
};

// Encrypt a URL parameter
const encryptUrlParam = (value) => {
  if (value === undefined || value === null || value === "") {
    throw new Error("Value to encrypt is required.");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: iv.authTag.ciphertext
  return [
    iv.toString("base64url"),
    authTag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
};

// Decrypt a URL parameter
const decryptUrlParam = (token) => {
  if (typeof token !== "string" || !token) {
    throw new Error("Invalid encrypted parameter.");
  }

  const parts = token.split(".");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted parameter.");
  }

  const [ivPart, authTagPart, encryptedPart] = parts;

  // Validate base64url characters
  const isBase64Url = (part) =>
    /^[A-Za-z0-9_-]+$/.test(part);

  if (
    !isBase64Url(ivPart) ||
    !isBase64Url(authTagPart) ||
    !isBase64Url(encryptedPart)
  ) {
    throw new Error("Invalid encrypted parameter.");
  }

  const iv = Buffer.from(ivPart, "base64url");
  const authTag = Buffer.from(authTagPart, "base64url");
  const encrypted = Buffer.from(encryptedPart, "base64url");

  if (
    iv.length !== IV_LENGTH ||
    authTag.length !== AUTH_TAG_LENGTH ||
    encrypted.length === 0
  ) {
    throw new Error("Invalid encrypted parameter.");
  }

  const key = getEncryptionKey();

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    iv
  );

  decipher.setAuthTag(authTag);

  // Tampered token par final() error throw karega
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};

module.exports = {
  encryptUrlParam,
  decryptUrlParam,
};