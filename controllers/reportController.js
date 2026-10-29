import { Op } from "sequelize";
import {
  Visit,
  Visitor,
  Inmate,
  Cell,
  Headcount,
  AuditLog,
  User,
  SystemSetting
} from "../models/index.js";
import { logAudit } from "../middleware/auditLogger.js";

export const getReports = async (req, res) => {
  try {
    const {
      report_type = "daily_visitor_log",
      from_date,
      to_date,
      status
    } = req.query;

    const todayStr = new Date().toISOString().split("T")[0];
    const startDate = from_date || todayStr;
    const endDate = to_date || todayStr;

    let reportData = [];
    let summaryStats = {};

    if (report_type === "daily_visitor_log" || report_type === "completed_denied" || report_type === "visitor_date_range") {
      const where = {
        visit_date: { [Op.between]: [startDate, endDate] }
      };

      if (report_type === "completed_denied") {
        where.status = { [Op.in]: ["Checked Out", "Denied"] };
      } else if (status && status !== "ALL") {
        where.status = status;
      }

      reportData = await Visit.findAll({
        where,
        include: [
          { model: Visitor, as: "visitor" },
          { model: Inmate, as: "inmate", include: [{ model: Cell, as: "cell" }] },
          { model: User, as: "checkInOfficer" },
          { model: User, as: "checkOutOfficer" }
        ],
        order: [["visit_date", "DESC"], ["created_at", "DESC"]]
      });

      summaryStats = {
        total: reportData.length,
        checkedIn: reportData.filter(v => v.status === "Checked In").length,
        checkedOut: reportData.filter(v => v.status === "Checked Out").length,
        denied: reportData.filter(v => v.status === "Denied").length,
        registered: reportData.filter(v => v.status === "Registered").length
      };
    } else if (report_type === "currently_checked_in" || report_type === "uncompleted_checkouts") {
      // Visitors who are currently Checked In (and have not checked out)
      reportData = await Visit.findAll({
        where: {
          status: "Checked In"
        },
        include: [
          { model: Visitor, as: "visitor" },
          { model: Inmate, as: "inmate", include: [{ model: Cell, as: "cell" }] },
          { model: User, as: "checkInOfficer" }
        ],
        order: [["created_at", "ASC"]]
      });

      const now = new Date();
      reportData = reportData.map(v => {
        const item = v.toJSON();
        const diffMins = Math.floor((now - new Date(v.created_at)) / (1000 * 60));
        item.durationMinutes = diffMins;
        item.isOverstay = diffMins > 60;
        return item;
      });

      summaryStats = {
        total: reportData.length,
        overstayCount: reportData.filter(v => v.isOverstay).length
      };
    } else if (report_type === "cell_assignment_summary") {
      // Cell occupancy and inmate breakdown
      const cells = await Cell.findAll({
        include: [
          {
            model: Inmate,
            as: "inmates",
            where: { status: "Active" },
            required: false
          }
        ],
        order: [["block", "ASC"], ["cell_number", "ASC"]]
      });

      reportData = cells.map(c => {
        const inmates = c.inmates || [];
        return {
          id: c.id,
          cell_number: c.cell_number,
          block: c.block,
          capacity: c.capacity,
          occupancy: inmates.length,
          available: c.capacity - inmates.length,
          percentage: c.capacity > 0 ? Math.round((inmates.length / c.capacity) * 100) : 0,
          status: c.status,
          inmates: inmates.map(i => ({
            inmate_number: i.inmate_number,
            name: `${i.last_name}, ${i.first_name}`,
            security_level: i.security_level,
            date_admitted: i.date_admitted
          }))
        };
      });

      const totalCap = reportData.reduce((acc, c) => acc + c.capacity, 0);
      const totalOcc = reportData.reduce((acc, c) => acc + c.occupancy, 0);

      summaryStats = {
        totalCells: reportData.length,
        totalCapacity: totalCap,
        totalInmates: totalOcc,
        overallOccupancyRate: totalCap > 0 ? Math.round((totalOcc / totalCap) * 100) : 0
      };
    } else if (report_type === "headcount_records" || report_type === "headcount_discrepancies") {
      const where = {
        date: { [Op.between]: [startDate, endDate] }
      };

      if (report_type === "headcount_discrepancies") {
        where.status = { [Op.in]: ["Discrepancy", "Reviewed"] };
        where.difference = { [Op.ne]: 0 };
      }

      reportData = await Headcount.findAll({
        where,
        include: [
          { model: User, as: "conductingOfficer" },
          { model: User, as: "reviewedBy" }
        ],
        order: [["date", "DESC"], ["shift", "ASC"]]
      });

      summaryStats = {
        totalCounts: reportData.length,
        matched: reportData.filter(h => h.status === "Matched").length,
        discrepancies: reportData.filter(h => h.status === "Discrepancy" || h.difference !== 0).length,
        reviewed: reportData.filter(h => h.status === "Reviewed").length
      };
    } else if (report_type === "user_activity") {
      reportData = await AuditLog.findAll({
        where: {
          created_at: {
            [Op.between]: [new Date(`${startDate}T00:00:00`), new Date(`${endDate}T23:59:59`)]
          }
        },
        include: [{ model: User, as: "user" }],
        order: [["created_at", "DESC"]],
        limit: 100
      });

      summaryStats = {
        totalActions: reportData.length
      };
    }

    const facilitySetting = await SystemSetting.findOne({ where: { setting_key: "facility_name" } });
    const facilityCodeSetting = await SystemSetting.findOne({ where: { setting_key: "facility_code" } });

    res.render("reports", {
      title: "Reports & Record Exports",
      report_type,
      startDate,
      endDate,
      status: status || "ALL",
      reportData: Array.isArray(reportData) && reportData[0] && reportData[0].toJSON ? reportData.map(d => d.toJSON()) : reportData,
      summaryStats,
      generatedAt: new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
      facilityName: facilitySetting ? facilitySetting.setting_value : "BJMP San Jose District Jail",
      facilityCode: facilityCodeSetting ? facilityCodeSetting.setting_value : "BJMP-DJ-04",
      currentUser: req.session.user
    });
  } catch (error) {
    console.error("Reports error:", error);
    req.flash("error_msg", "Error loading reports: " + error.message);
    res.redirect("/dashboard");
  }
};

// Printable Report View (Formatted for print/PDF)
export const printReport = async (req, res) => {
  try {
    const {
      report_type = "daily_visitor_log",
      from_date,
      to_date,
      status
    } = req.query;

    const todayStr = new Date().toISOString().split("T")[0];
    const startDate = from_date || todayStr;
    const endDate = to_date || todayStr;

    // Reuse query logic
    let reportData = [];
    if (report_type.startsWith("daily_visitor_log") || report_type === "completed_denied" || report_type === "visitor_date_range") {
      const where = { visit_date: { [Op.between]: [startDate, endDate] } };
      if (status && status !== "ALL") where.status = status;
      reportData = await Visit.findAll({
        where,
        include: [
          { model: Visitor, as: "visitor" },
          { model: Inmate, as: "inmate", include: [{ model: Cell, as: "cell" }] },
          { model: User, as: "checkInOfficer" },
          { model: User, as: "checkOutOfficer" }
        ],
        order: [["visit_date", "ASC"], ["time_in", "ASC"]]
      });
    } else if (report_type === "currently_checked_in" || report_type === "uncompleted_checkouts") {
      reportData = await Visit.findAll({
        where: { status: "Checked In" },
        include: [
          { model: Visitor, as: "visitor" },
          { model: Inmate, as: "inmate", include: [{ model: Cell, as: "cell" }] },
          { model: User, as: "checkInOfficer" }
        ],
        order: [["created_at", "ASC"]]
      });
    } else if (report_type === "cell_assignment_summary") {
      reportData = await Cell.findAll({
        include: [{ model: Inmate, as: "inmates", where: { status: "Active" }, required: false }],
        order: [["block", "ASC"], ["cell_number", "ASC"]]
      });
    } else if (report_type.startsWith("headcount")) {
      reportData = await Headcount.findAll({
        where: { date: { [Op.between]: [startDate, endDate] } },
        include: [
          { model: User, as: "conductingOfficer" },
          { model: User, as: "reviewedBy" }
        ],
        order: [["date", "ASC"], ["shift", "ASC"]]
      });
    } else if (report_type === "user_activity") {
      reportData = await AuditLog.findAll({
        where: {
          created_at: {
            [Op.between]: [new Date(`${startDate}T00:00:00`), new Date(`${endDate}T23:59:59`)]
          }
        },
        include: [{ model: User, as: "user" }],
        order: [["created_at", "DESC"]],
        limit: 100
      });
    }

    const facilitySetting = await SystemSetting.findOne({ where: { setting_key: "facility_name" } });
    const facilityCodeSetting = await SystemSetting.findOne({ where: { setting_key: "facility_code" } });

    res.render("report-print", {
      layout: false,
      title: `Official BJMP Report - ${report_type.toUpperCase()}`,
      report_type,
      startDate,
      endDate,
      status: status || "ALL",
      reportData: Array.isArray(reportData) && reportData[0] && reportData[0].toJSON ? reportData.map(d => d.toJSON()) : reportData,
      generatedAt: new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" }),
      facilityName: facilitySetting ? facilitySetting.setting_value : "BJMP San Jose District Jail",
      facilityCode: facilityCodeSetting ? facilityCodeSetting.setting_value : "BJMP-DJ-04",
      currentUser: req.session.user
    });
  } catch (error) {
    console.error("Print report error:", error);
    res.status(500).send("Error rendering printable report.");
  }
};

