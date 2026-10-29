import { DataTypes } from "sequelize";
import { sequelize } from "./db.js";

export const Inmate = sequelize.define("Inmate", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  inmate_number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  first_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  last_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  middle_name: {
    type: DataTypes.STRING,
    allowNull: true
  },
  gender: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Male"
  },
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  date_admitted: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  case_number: {
    type: DataTypes.STRING,
    allowNull: true
  },
  security_level: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Medium" // 'Maximum', 'Medium', 'Minimum'
  },
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Active" // 'Active', 'In Transit', 'Released', 'Solitary', 'Hospitalized'
  },
  cell_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: "inmates",
  timestamps: true,
  getterMethods: {
    fullName() {
      const middle = this.middle_name ? ` ${this.middle_name}` : "";
      return `${this.last_name}, ${this.first_name}${middle}`;
    }
  }
});

export default Inmate;

