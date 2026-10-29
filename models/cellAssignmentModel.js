import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const CellAssignment = sequelize.define("CellAssignment", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  inmate_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  from_cell_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  to_cell_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  transfer_reason: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  authorized_by_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Active" // 'Active', 'Completed', 'Cancelled'
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "cell_assignments",
  timestamps: true
});

export default CellAssignment;

