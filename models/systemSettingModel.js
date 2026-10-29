import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const SystemSetting = sequelize.define("SystemSetting", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  setting_key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  setting_value: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  category: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "General"
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  updated_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: "system_settings",
  timestamps: true
});

export default SystemSetting;

