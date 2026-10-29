import { Op } from "sequelize";
import {
  Headcount,
  Inmate,
  User
} from "../models/index.js";
import { logAudit } from "../middleware/auditLogger.js";

// List and Manage Headcounts
export const getHeadcount = async (req, res) => {
  try {
    const selectedDate = req.query.date || new Date().toISOString().split("T")[0];

    // Current active inmates is the facility source-of-truth expected count
    const activeInmateCount = await Inmate.count({ where: { status: "Active" } });

    // Existing headcounts for this date
    const headcounts = await Headcount.findAll({
      where: { date: selectedDate },
      include: [
        { model: User, as: "conductingOfficer" },
        { model: User, as: "reviewedBy" }
      ],
      order: [["created_at", "ASC"]]
    });

    // Defined Shifts
    const standardShifts = [
      "Morning (06:00 - 14:00)",
      "Afternoon (14:00 - 22:00)",
      "Night (22:00 - 06:00)"
    ];

    // Check which shifts exist; if not, create pending shift entry for easy verification
    for (const shiftName of standardShifts) {
      const exists = headcounts.find(h => h.shift === shiftName);
      if (!exists) {
        const newRecord = await Headcount.create({
          date: selectedDate,
          shift: shiftName,
          expected_count: activeInmateCount,
          verified_count: null,
          difference: 0,
          status: "Pending"
        });
        const reloaded = await Headcount.findByPk(newRecord.id, {
          include: [
            { model: User, as: "conductingOfficer" },
            { model: User, as: "reviewedBy" }
          ]
        });
        headcounts.push(reloaded);
      }
    }

    // Historical records for date range review
    const recentRecords = await Headcount.findAll({
      where: {
        date: { [Op.ne]: selectedDate }
      },
      include: [
        { model: User, as: "conductingOfficer" },
        { model: User, as: "reviewedBy" }
      ],
      order: [["date", "DESC"], ["created_at", "DESC"]],
      limit: 15
    });

    res.render("headcount", {
      title: "Daily Attendance & Physical Headcount",
      selectedDate,
      activeInmateCount,
      headcounts: headcounts.map(h => h.toJSON()),
      recentRecords: recentRecords.map(r => r.toJSON())
    });
  } catch (error) {
    console.error("Headcount error:", error);
    req.flash("error_msg", "Error loading headcount records: " + error.message);
    res.redirect("/dashboard");
  }
};

// Submit Verified Physical Count
export const submitHeadcount = async (req, res) => {
  try {
    const { headcount_id, verified_count, remarks, date } = req.body;

    if (!headcount_id || verified_count === undefined || verified_count === "") {
      req.flash("error_msg", "Mandatory requirement: Physical verified count number must be explicitly entered.");
      return res.redirect(`/headcount?date=${date || ""}`);
    }

    const headcount = await Headcount.findByPk(headcount_id);
    if (!headcount) {
      req.flash("error_msg", "Headcount record not found.");
      return res.redirect("/headcount");
    }

    const countNum = parseInt(verified_count, 10);
    if (isNaN(countNum) || countNum < 0) {
      req.flash("error_msg", "Invalid count number entered.");
      return res.redirect(`/headcount?date=${headcount.date}`);
    }

    // Explicit verification
    const diff = countNum - headcount.expected_count;
    let newStatus = "Matched";

    if (diff !== 0) {
      newStatus = "Discrepancy";
      if (!remarks || remarks.trim().length === 0) {
        req.flash("error_msg", `COUNT DISCREPANCY DETECTED (${countNum} vs expected ${headcount.expected_count}): An authorized remark explaining the discrepancy is MANDATORY before submission!`);
        return res.redirect(`/headcount?date=${headcount.date}`);
      }
    }

    headcount.verified_count = countNum;
    headcount.difference = diff;
    headcount.status = newStatus;
    headcount.conducting_officer_id = req.session.user.id;
    headcount.verified_at = new Date();
    if (remarks) {
      headcount.remarks = remarks.trim();
    }
    await headcount.save();

    await logAudit({
      req,
      user: req.session.user,
      action: "HEADCOUNT_SUBMITTED",
      entity: "Headcount",
      entityId: headcount.id,
      details: `Headcount submitted for ${headcount.shift} on ${headcount.date}. Expected: ${headcount.expected_count}, Verified: ${countNum}, Difference: ${diff}. Status: ${newStatus}.`
    });

    if (newStatus === "Discrepancy") {
      req.flash("error_msg", `WARNING: Headcount discrepancy submitted (${diff > 0 ? "+" + diff : diff}). Immediate supervisory acknowledgement required!`);
    } else {
      req.flash("success_msg", `Headcount successfully submitted and MATCHED (${countNum}/${headcount.expected_count}).`);
    }

    res.redirect(`/headcount?date=${headcount.date}`);
  } catch (error) {
    console.error("Submit headcount error:", error);
    req.flash("error_msg", "Failed to submit headcount: " + error.message);
    res.redirect("/headcount");
  }
};

// Supervisor Review & Acknowledgement of Discrepancy
export const reviewHeadcount = async (req, res) => {
  try {
    const { headcount_id, supervisor_notes, date } = req.body;

    if (!supervisor_notes || supervisor_notes.trim().length === 0) {
      req.flash("error_msg", "Supervisor notes are mandatory when reviewing a headcount discrepancy.");
      return res.redirect(`/headcount?date=${date || ""}`);
    }

    const headcount = await Headcount.findByPk(headcount_id);
    if (!headcount) {
      req.flash("error_msg", "Headcount record not found.");
      return res.redirect("/headcount");
    }

    headcount.status = "Reviewed";
    headcount.reviewed_by_id = req.session.user.id;
    headcount.reviewed_at = new Date();
    headcount.supervisor_notes = supervisor_notes.trim();
    await headcount.save();

    await logAudit({
      req,
      user: req.session.user,
      action: "HEADCOUNT_REVIEWED",
      entity: "Headcount",
      entityId: headcount.id,
      details: `Supervisor ${req.session.user.name} reviewed and acknowledged headcount record for ${headcount.shift} (${headcount.date}). Notes: "${supervisor_notes.trim()}"`
    });

    req.flash("success_msg", `Headcount discrepancy on ${headcount.date} has been officially reviewed and acknowledged.`);
    res.redirect(`/headcount?date=${headcount.date}`);
  } catch (error) {
    console.error("Review headcount error:", error);
    req.flash("error_msg", "Failed to review headcount: " + error.message);
    res.redirect("/headcount");
  }
};

// Export Headcount CSV
export const exportHeadcountCSV = async (req, res) => {
  try {
    const { from_date, to_date } = req.query;
    const where = {};
    if (from_date && to_date) {
      where.date = { [Op.between]: [from_date, to_date] };
    }

    const headcounts = await Headcount.findAll({
      where,
      include: [
        { model: User, as: "conductingOfficer" },
        { model: User, as: "reviewedBy" }
      ],
      order: [["date", "DESC"], ["shift", "ASC"]]
    });

    const headers = [
      "Date",
      "Shift",
      "Expected Inmates",
      "Verified Inmates",
      "Discrepancy Count",
      "Headcount Status",
      "Conducting Officer",
      "Verified Timestamp",
      "Remarks / Explanation",
      "Reviewing Supervisor",
      "Reviewed Timestamp",
      "Supervisor Notes"
    ];

    const escapeCsv = (field) => {
      if (field === null || field === undefined) return '""';
      const str = String(field).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = headcounts.map(h => [
      h.date,
      h.shift,
      h.expected_count,
      h.verified_count !== null ? h.verified_count : "Pending",
      h.difference,
      h.status,
      h.conductingOfficer ? h.conductingOfficer.name : "N/A",
      h.verified_at ? new Date(h.verified_at).toLocaleString() : "N/A",
      h.remarks || "",
      h.reviewedBy ? h.reviewedBy.name : "N/A",
      h.reviewed_at ? new Date(h.reviewed_at).toLocaleString() : "N/A",
      h.supervisor_notes || ""
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.map(escapeCsv).join(","))].join("\r\n");

    const filename = `BJMP_Headcount_Report_${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csvContent);
  } catch (error) {
    console.error("Export headcount CSV error:", error);
    req.flash("error_msg", "Failed to export headcount CSV.");
    res.redirect("/headcount");
  }
};

