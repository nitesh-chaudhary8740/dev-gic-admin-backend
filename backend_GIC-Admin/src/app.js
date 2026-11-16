
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const compression = require("compression");
const cors = require("cors");
const swaggerUi = require("swagger-ui-express");

const envConfig = require("./config/envConfig");
const swaggerSpec = require("./config/swagger");

// Register Sequelize models and associations
require("./models");

// API routes
const languageRoutes = require("./routes/languageRoutes");
const menuRoutes = require("./routes/menuRoutes");
const pageRoutes = require("./routes/pageRoutes");

// Error handlers
const { notFound, errorHandler } = require("./middlewares/error");

const app = express();

const isProd = envConfig.NODE_ENV === "production";

// ==========================================
// TRUST PROXY
// ==========================================

if (envConfig.TRUST_PROXY) {
  app.set("trust proxy", 1);
}

// ==========================================
// SECURITY HEADERS
// ==========================================

const helmetOptions = {
  crossOriginEmbedderPolicy: false,

  hsts: isProd
    ? {
        maxAge: 31536000,
        includeSubDomains: true,
      }
    : false,
};

// Development HTTP/LAN testing
if (!isProd) {
  helmetOptions.contentSecurityPolicy = {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "upgrade-insecure-requests": null,
    },
  };
}

app.use(helmet(helmetOptions));

// ==========================================
// COMPRESSION
// ==========================================

app.use(compression());

// ==========================================
// REQUEST LOGGING
// ==========================================

app.use(morgan(isProd ? "combined" : "dev"));

// ==========================================
// CORS
// ==========================================

const developmentOrigins = [
  // Local frontend
  "http://localhost:5173",
  "http://localhost:5174",

  // Localhost IP
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",

  // LAN frontend
  `http://${envConfig.LAN_IP}:5173`,
  `http://${envConfig.LAN_IP}:5174`,
];

const productionOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      // Allow requests without Origin.
      // Example: curl, Postman, server-to-server requests.
      if (!origin) {
        return callback(null, true);
      }

      // Development
      if (
        !isProd &&
        developmentOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      // Production
      if (
        isProd &&
        productionOrigins.includes(origin)
      ) {
        return callback(null, true);
      }

      return callback(
        new Error(`CORS blocked origin: ${origin}`)
      );
    },

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

// ==========================================
// REQUEST BODY PARSERS
// ==========================================

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

// ==========================================
// HEALTH CHECK
// ==========================================

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: `${envConfig.SITE_NAME || "GIC CMS"} API is running`,
  });
});

// ==========================================
// SWAGGER API DOCUMENTATION
// ==========================================

app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    explorer: true,

    swaggerOptions: {
      validatorUrl: null,
    },

    customSiteTitle: "GIC Admin CMS API",
  })
);

// ==========================================
// CMS API ROUTES
// ==========================================

app.use("/api/languages", languageRoutes);
app.use("/api/menus", menuRoutes);
app.use("/api/pages", pageRoutes);

// ==========================================
// 404 HANDLER
// ==========================================

app.use(notFound);

// ==========================================
// CENTRAL ERROR HANDLER
// ==========================================

app.use(errorHandler);

module.exports = app;
