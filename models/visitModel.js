import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Visit = sequelize.define("Visit", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  reference_no: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  visitor_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  inmate_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  visit_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  time_in: {
    type: DataTypes.STRING,
    allowNull: true
  },
  time_out: {
    type: DataTypes.STRING,
    allowNull: true
  },
  relationship: {
    type: DataTypes.STRING,
    allowNull: false
  },
  purpose: {
    type: DataTypes.STRING,
    allowNull: false
  },
  visiting_area: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Visiting Hall A"
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Registered" // 'Registered', 'Checked In', 'Checked Out', 'Cancelled', 'Denied'
  },
  denial_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  denied_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  check_in_officer_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  check_out_officer_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  correction_reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  last_edited_by_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "visits",
  timestamps: true
});

export default Visit;

