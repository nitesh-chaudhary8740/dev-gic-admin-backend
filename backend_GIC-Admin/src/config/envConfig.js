
require("dotenv").config();

const envConfig = {

  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: Number(process.env.PORT) || 3000,
  SITE_NAME: process.env.SITE_NAME || "gic-admin",

  LAN_IP: process.env.LAN_IP || "localhost",

  API_BASE_URL:
    process.env.API_BASE_URL || "http://localhost:3000",

  API_BASE_URL_ALT:
    process.env.API_BASE_URL_ALT || "http://localhost:3001",


  DB: {
    HOST: process.env.DB_HOST || "localhost",
    PORT: Number(process.env.DB_PORT) || 3306,
    USER: process.env.DB_USER || "root",
    PASSWORD: process.env.DB_PASSWORD || "",
    NAME: process.env.DB_NAME || "gic_admin",
  },

  DB_SYNC_ALTER:
    String(process.env.DB_SYNC_ALTER).toLowerCase() === "true",


  SESSION_SECRET:
    process.env.SESSION_SECRET || "change-this-session-secret",

  COOKIE_SECURE:
    String(process.env.COOKIE_SECURE).toLowerCase() === "true",

  TRUST_PROXY:
    String(process.env.TRUST_PROXY).toLowerCase() === "true",

  // ==========================================
  // FIRST ADMIN USER
  // ==========================================
  ADMIN: {
    NAME: process.env.ADMIN_NAME || "Administrator",
    EMAIL: process.env.ADMIN_EMAIL || "admin@example.com",
    PASSWORD: process.env.ADMIN_PASSWORD || "",
  },

  // ==========================================
  // URL PARAM ENCRYPTION
  // ==========================================
  URL_PARAM_ENCRYPTION_KEY:
    process.env.URL_PARAM_ENCRYPTION_KEY || "",
};

module.exports = envConfig;
