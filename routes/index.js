import express from "express";
import {
  loginPage,
  loginUser,
  logoutUser,
  listUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword
} from "../controllers/authController.js";
import { getDashboard } from "../controllers/dashboardController.js";
import {
  registrationPage,
  registerVisitor,
  searchVisitors,
  getVisitorPass
} from "../controllers/visitorController.js";
import {
  getLogbook,
  checkOutVisitor,
  denyVisit,
  editVisitRecord,
  exportLogbookCSV
} from "../controllers/logbookController.js";
import {
  getCellManagement,
  transferInmateCell,
  getInmateHistory
} from "../controllers/cellController.js";
import {
  getHeadcount,
  submitHeadcount,
  reviewHeadcount,
  exportHeadcountCSV
} from "../controllers/headcountController.js";
import { getReports, printReport } from "../controllers/reportController.js";
import { getAuditLogs } from "../controllers/auditController.js";
import { getSettings, updateSettings } from "../controllers/settingController.js";
import { requireAuth, requireRole } from "../middleware/authMiddleware.js";

const router = express.Router();

// Authentication
router.get("/login", loginPage);
router.post("/login", loginUser);
router.get("/logout", logoutUser);
router.get("/register", (req, res) => {
  req.flash("error_msg", "Self-registration is disabled for secure government facility terminals. Accounts are provisioned by the Custodial Administrator.");
  res.redirect("/login");
});
router.get("/forgot-password", (req, res) => {
  req.flash("error_msg", "To reset your password, contact your Custodial Shift Supervisor or System Administrator.");
  res.redirect("/login");
});

// Main Navigation / Dashboard
router.get("/", requireAuth, getDashboard);
router.get("/dashboard", requireAuth, getDashboard);

// 1. Visitor Registration
router.get("/visitors/register", requireAuth, registrationPage);
router.post("/visitors/register", requireAuth, registerVisitor);
router.get("/visitors/search", requireAuth, searchVisitors);
router.get("/visitors/pass/:id", requireAuth, getVisitorPass);

// 2. Visitor Logbook
router.get("/logbook", requireAuth, getLogbook);
router.post("/logbook/:id/check-out", requireAuth, checkOutVisitor);
router.post("/logbook/:id/deny", requireAuth, denyVisit);
router.post("/logbook/:id/edit", requireAuth, editVisitRecord);
router.get("/logbook/export/csv", requireAuth, exportLogbookCSV);

// 3. Inmate Cell Assignments
router.get("/cells", requireAuth, getCellManagement);
router.post("/cells/transfer", requireAuth, requireRole(["admin", "supervisor"]), transferInmateCell);
router.get("/cells/inmate/:id/history", requireAuth, getInmateHistory);

// 4. Daily Attendance & Headcount
router.get("/headcount", requireAuth, getHeadcount);
router.post("/headcount/submit", requireAuth, submitHeadcount);
router.post("/headcount/review", requireAuth, requireRole(["admin", "supervisor"]), reviewHeadcount);
router.get("/headcount/export/csv", requireAuth, exportHeadcountCSV);

// 5. Reports & Exports
router.get("/reports", requireAuth, getReports);
router.get("/reports/print", requireAuth, printReport);

// 6. Security Audit Logs (Supervisor & Admin)
router.get("/audit-logs", requireAuth, requireRole(["admin", "supervisor"]), getAuditLogs);

// 7. User Management (Admin Only)
router.get("/users", requireAuth, requireRole(["admin"]), listUsers);
router.post("/users", requireAuth, requireRole(["admin"]), createUser);
router.post("/users/:id/update", requireAuth, requireRole(["admin"]), updateUser);
router.post("/users/:id/status", requireAuth, requireRole(["admin"]), toggleUserStatus);
router.post("/users/:id/reset-password", requireAuth, requireRole(["admin"]), resetUserPassword);

// 8. System Settings (Admin Only)
router.get("/settings", requireAuth, requireRole(["admin"]), getSettings);
router.post("/settings", requireAuth, requireRole(["admin"]), updateSettings);

export default router;
