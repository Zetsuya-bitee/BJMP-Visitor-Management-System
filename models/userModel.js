import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "gate_officer" // 'admin', 'supervisor', 'gate_officer'
  },
  badge_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "active" // 'active', 'inactive'
  },
  last_login: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: "users",
  timestamps: true
});

export { sequelize };
export default User;
