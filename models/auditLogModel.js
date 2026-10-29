import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const AuditLog = sequelize.define("AuditLog", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  entity: {
    type: DataTypes.STRING,
    allowNull: true
  },
  entity_id: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ip_address: {
    type: DataTypes.STRING,
    allowNull: true
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "audit_logs",
  timestamps: true,
  updatedAt: false
});

export default AuditLog;

