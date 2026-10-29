import dotenv from "dotenv";
import { Sequelize } from "sequelize";
import { sequelize } from "./models/index.js";
import inquirer from "inquirer";

dotenv.config();

const dialect = process.env.DB_DIALECT || "sqlite";

try {
  if (dialect === "mysql") {
    const host = process.env.DB_HOST || "localhost";
    const port = process.env.DB_PORT || 3306;
    const user = process.env.DB_USER || "root";
    const password = process.env.DB_PASS || "";
    const dbName = process.env.DB_NAME || "BJMP";

    const rootSequelize = new Sequelize(`mysql://${user}:${password}@${host}:${port}/`, {
      logging: false
    });

    const { createDb } = await inquirer.prompt([
      {
        type: "confirm",
        name: "createDb",
        message: `MySQL Database '${dbName}' may not exist. Create it?`,
        default: true
      }
    ]);

    if (createDb) {
      await rootSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
      console.log(`✅ MySQL database '${dbName}' ensured.`);
    }
    await rootSequelize.close();
  }

  await sequelize.authenticate();
  console.log(`✅ Connected to database (${dialect})!`);

  await sequelize.sync({ force: false, alter: true });
  console.log("✅ Tables synchronized for all models!");
} catch (err) {
  console.error("❌ Migration failed:", err.message);
} finally {
  process.exit();
}
