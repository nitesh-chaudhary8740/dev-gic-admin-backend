const { Sequelize } = require("sequelize");
const envConfig = require("./envConfig");

const sequelize = new Sequelize(
  envConfig.DB.NAME,
  envConfig.DB.USER,
  envConfig.DB.PASSWORD,
  {
    host: envConfig.DB.HOST,
    port: envConfig.DB.PORT,
    dialect: "mysql",

    logging:
      envConfig.NODE_ENV === "development"
        ? console.log
        : false,

    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

module.exports = sequelize;
