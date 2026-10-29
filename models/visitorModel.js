import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Visitor = sequelize.define("Visitor", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  visitor_code: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  full_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  id_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  id_number: {
    type: DataTypes.STRING,
    allowNull: false
  },
  contact_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: true
  },
  is_banned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  ban_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "visitors",
  timestamps: true
});

export default Visitor;

