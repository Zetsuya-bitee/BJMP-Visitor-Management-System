import { sequelize } from "./db.js";
import User from "./userModel.js";
import Cell from "./cellModel.js";
import Inmate from "./inmateModel.js";
import CellAssignment from "./cellAssignmentModel.js";
import Visitor from "./visitorModel.js";
import Visit from "./visitModel.js";
import Headcount from "./headcountModel.js";
import AuditLog from "./auditLogModel.js";
import SystemSetting from "./systemSettingModel.js";

// Relationships
Cell.hasMany(Inmate, { foreignKey: "cell_id", as: "inmates" });
Inmate.belongsTo(Cell, { foreignKey: "cell_id", as: "cell" });

Inmate.hasMany(CellAssignment, { foreignKey: "inmate_id", as: "cellHistory" });
CellAssignment.belongsTo(Inmate, { foreignKey: "inmate_id", as: "inmate" });
CellAssignment.belongsTo(Cell, { foreignKey: "from_cell_id", as: "fromCell" });
CellAssignment.belongsTo(Cell, { foreignKey: "to_cell_id", as: "toCell" });
CellAssignment.belongsTo(User, { foreignKey: "authorized_by_id", as: "authorizedBy" });

Visitor.hasMany(Visit, { foreignKey: "visitor_id", as: "visits" });
Visit.belongsTo(Visitor, { foreignKey: "visitor_id", as: "visitor" });

Inmate.hasMany(Visit, { foreignKey: "inmate_id", as: "visits" });
Visit.belongsTo(Inmate, { foreignKey: "inmate_id", as: "inmate" });

Visit.belongsTo(User, { foreignKey: "check_in_officer_id", as: "checkInOfficer" });
Visit.belongsTo(User, { foreignKey: "check_out_officer_id", as: "checkOutOfficer" });
Visit.belongsTo(User, { foreignKey: "denied_by_id", as: "deniedBy" });
Visit.belongsTo(User, { foreignKey: "last_edited_by_id", as: "lastEditedBy" });

Headcount.belongsTo(User, { foreignKey: "conducting_officer_id", as: "conductingOfficer" });
Headcount.belongsTo(User, { foreignKey: "reviewed_by_id", as: "reviewedBy" });

AuditLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

export {
  sequelize,
  User,
  Cell,
  Inmate,
  CellAssignment,
  Visitor,
  Visit,
  Headcount,
  AuditLog,
  SystemSetting
};

