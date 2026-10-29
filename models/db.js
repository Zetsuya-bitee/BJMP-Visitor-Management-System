import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const dialect = process.env.DB_DIALECT || "sqlite";
let sequelizeInstance;

if (dialect === "mysql") {
  sequelizeInstance = new Sequelize(
    process.env.DB_NAME || "BJMP",
    process.env.DB_USER || "root",
    process.env.DB_PASS || "",
    {
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      dialect: "mysql",
      logging: false,
      define: {
        timestamps: true,
        underscored: true
      }
    }
  );
} else {
  // Default to SQLite for zero-config persistence
  const storagePath = process.env.DB_STORAGE || path.join(process.cwd(), "bjmp_database.sqlite");
  sequelizeInstance = new Sequelize({
    dialect: "sqlite",
    storage: storagePath,
    logging: false,
    define: {
      timestamps: true,
      underscored: true
    }
  });
}

export const sequelize = sequelizeInstance;
export default sequelize;
