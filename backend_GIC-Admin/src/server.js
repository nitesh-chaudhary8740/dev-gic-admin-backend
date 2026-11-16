
const envConfig = require("./config/envConfig");
const app = require("./app");
const sequelize = require("./config/database");

async function startServer() {
  try {
    // Test MySQL connection
    await sequelize.authenticate();

    console.log("MySQL connected successfully");

    // Sync models only when required
    if (envConfig.DB_SYNC_ALTER) {
      await sequelize.sync({ alter: true });
      console.log("Database models synchronized with alter.");
    } else {
      await sequelize.sync();
      console.log("Database models synchronized.");
    }

    // Start HTTP server on all network interfaces
    const server = app.listen(envConfig.PORT, "0.0.0.0", () => {
      console.log("-----------------------------------");
      console.log(`${envConfig.SITE_NAME} API started`);
      console.log(`Environment: ${envConfig.NODE_ENV}`);
      console.log(`Port: ${envConfig.PORT}`);
      console.log(`Local API: http://localhost:${envConfig.PORT}`);
      console.log(`Health: http://localhost:${envConfig.PORT}/health`);
      console.log(`Swagger: http://localhost:${envConfig.PORT}/api-docs`);
      console.log(
        `LAN API: http://${envConfig.LAN_IP}:${envConfig.PORT}`
      );
      console.log("-----------------------------------");
    });

    server.on("error", (error) => {
      console.error("HTTP server error:", error.message);
    });
  } catch (error) {
    console.error("Server startup failed:", error.message);
    process.exit(1);
  }
}

startServer();
