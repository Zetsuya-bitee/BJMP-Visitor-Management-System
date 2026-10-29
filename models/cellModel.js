import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Cell = sequelize.define("Cell", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  cell_number: {
    type: DataTypes.STRING,
    allowNull: false
  },
  block: {
    type: DataTypes.STRING,
    allowNull: false
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10
  },
  current_occupancy: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Active" // 'Active', 'Maintenance', 'Quarantine'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "cells",
  timestamps: true
});

export default Cell;

