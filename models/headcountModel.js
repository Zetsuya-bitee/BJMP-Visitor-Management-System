import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Headcount = sequelize.define("Headcount", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  shift: {
    type: DataTypes.STRING,
    allowNull: false // 'Morning (06:00 - 14:00)', 'Afternoon (14:00 - 22:00)', 'Night (22:00 - 06:00)'
  },
  expected_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  verified_count: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  difference: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Pending" // 'Pending', 'Matched', 'Discrepancy', 'Reviewed'
  },
  conducting_officer_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reviewed_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  supervisor_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "headcounts",
  timestamps: true
});

export default Headcount;

