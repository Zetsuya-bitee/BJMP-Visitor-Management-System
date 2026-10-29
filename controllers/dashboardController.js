import { Op } from "sequelize";
import {
  Visit,
  Visitor,
  Inmate,
  Cell,
  Headcount,
  SystemSetting
} from "../models/index.js";

export const getDashboard = async (req, res) => {
  try {
    const selectedDate = req.query.date || new Date().toISOString().split("T")[0];

    // 1. Visit Metrics for Selected Date
    const totalTodayVisits = await Visit.count({
      where: { visit_date: selectedDate }
    });

    // Currently Inside (status: 'Checked In')
    const currentInsideVisitors = await Visit.findAll({
      where: {
        status: "Checked In"
      },
      include: [
        { model: Visitor, as: "visitor" },
        { model: Inmate, as: "inmate", include: [{ model: Cell, as: "cell" }] }
      ],
      order: [["created_at", "ASC"]]
    });

    const completedVisits = await Visit.count({
      where: {
        visit_date: selectedDate,
        status: "Checked Out"
      }
    });

    const expectedVisits = await Visit.count({
      where: {
        visit_date: selectedDate,
        status: "Registered"
      }
    });

    const deniedVisits = await Visit.count({
      where: {
        visit_date: selectedDate,
        status: "Denied"
      }
    });

    // 2. Inmates Metrics
    const activeInmatesCount = await Inmate.count({
      where: { status: "Active" }
    });

    // Cells and occupancy
    const cells = await Cell.findAll({
      include: [
        {
          model: Inmate,
          as: "inmates",
          where: { status: "Active" },
          required: false
        }
      ],
      order: [["cell_number", "ASC"]]
    });

    const cellBreakdown = cells.map(cell => {
      const inmateCount = cell.inmates ? cell.inmates.length : 0;
      const percentage = cell.capacity > 0 ? Math.round((inmateCount / cell.capacity) * 100) : 0;
      return {
        id: cell.id,
        cell_number: cell.cell_number,
        block: cell.block,
        capacity: cell.capacity,
        occupancy: inmateCount,
        percentage,
        isFull: inmateCount >= cell.capacity,
        status: cell.status
      };
    });

    // 3. Latest Visitor Log Entries
    const latestVisits = await Visit.findAll({
      include: [
        { model: Visitor, as: "visitor" },
        { model: Inmate, as: "inmate" }
      ],
      order: [["created_at", "DESC"]],
      limit: 7
    });

    // 4. Daily Headcount Status
    const todayHeadcounts = await Headcount.findAll({
      where: { date: selectedDate },
      order: [["created_at", "DESC"]]
    });

    // 5. Active Alerts
    // Check for visitors checked in without checking out (overstay check)
    const alertThresholdMinutes = 60; // 1 hour threshold
    const now = new Date();
    const overstayAlerts = [];

    for (const v of currentInsideVisitors) {
      const visitCreated = new Date(v.created_at);
      const diffMinutes = Math.floor((now - visitCreated) / (1000 * 60));
      if (diffMinutes >= alertThresholdMinutes) {
        overstayAlerts.push({
          reference_no: v.reference_no,
          visitor_name: v.visitor.full_name,
          inmate_name: `${v.inmate.last_name}, ${v.inmate.first_name}`,
          time_in: v.time_in || "N/A",
          durationMinutes: diffMinutes,
          visiting_area: v.visiting_area
        });
      }
    }

    // Check if headcount is missing or has discrepancies
    const headcountAlerts = [];
    const hasDiscrepancy = todayHeadcounts.some(h => h.status === "Discrepancy");
    if (hasDiscrepancy) {
      headcountAlerts.push("Active Headcount Discrepancy detected for today. Supervisory review required!");
    }
    if (todayHeadcounts.length === 0) {
      headcountAlerts.push("No Headcount has been recorded yet for today.");
    }

    // Facility Info
    const facilityNameSetting = await SystemSetting.findOne({ where: { setting_key: "facility_name" } });
    const facilityName = facilityNameSetting ? facilityNameSetting.setting_value : "BJMP District Jail";

    res.render("dashboard", {
      title: "Custodial Command Dashboard",
      selectedDate,
      totalTodayVisits,
      currentInsideCount: currentInsideVisitors.length,
      currentInsideVisitors: currentInsideVisitors.map(v => v.toJSON()),
      completedVisits,
      expectedVisits,
      deniedVisits,
      activeInmatesCount,
      cellBreakdown,
      latestVisits: latestVisits.map(v => v.toJSON()),
      todayHeadcounts: todayHeadcounts.map(h => h.toJSON()),
      overstayAlerts,
      headcountAlerts,
      facilityName
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    req.flash("error_msg", "Error loading dashboard metrics: " + error.message);
    res.render("dashboard", {
      title: "Custodial Command Dashboard",
      selectedDate: new Date().toISOString().split("T")[0],
      totalTodayVisits: 0,
      currentInsideCount: 0,
      completedVisits: 0,
      expectedVisits: 0,
      activeInmatesCount: 0,
      cellBreakdown: [],
      latestVisits: [],
      todayHeadcounts: [],
      overstayAlerts: [],
      headcountAlerts: []
    });
  }
};

