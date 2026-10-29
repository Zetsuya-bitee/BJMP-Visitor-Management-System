import { Op } from "sequelize";
import {
  Visit,
  Visitor,
  Inmate,
  Cell,
  User,
  SystemSetting
} from "../models/index.js";
import { logAudit } from "../middleware/auditLogger.js";
import { formatTime12 } from "./visitorController.js";

export const getLogbook = async (req, res) => {
  try {
    const {
      search,
      status,
      from_date,
      to_date,
      sort = "newest",
      page = 1
    } = req.query;

    const limit = 20;
    const offset = (parseInt(page, 10) - 1) * limit;

    const where = {};

    // Date range filter
    if (from_date && to_date) {
      where.visit_date = { [Op.between]: [from_date, to_date] };
    } else if (from_date) {
      where.visit_date = { [Op.gte]: from_date };
    } else if (to_date) {
      where.visit_date = { [Op.lte]: to_date };
    }

    // Status filter
    if (status && status !== "ALL") {
      where.status = status;
    }

    // Search filter across reference_no, visitor name/id, inmate name/number
    const include = [
      {
        model: Visitor,
        as: "visitor",
        required: true
      },
      {
        model: Inmate,
        as: "inmate",
        required: true,
        include: [{ model: Cell, as: "cell" }]
      },
      { model: User, as: "checkInOfficer" },
      { model: User, as: "checkOutOfficer" },
      { model: User, as: "deniedBy" },
      { model: User, as: "lastEditedBy" }
    ];

    if (search && search.trim()) {
      const q = search.trim();
      where[Op.or] = [
        { reference_no: { [Op.like]: `%${q}%` } },
        { "$visitor.full_name$": { [Op.like]: `%${q}%` } },
        { "$visitor.id_number$": { [Op.like]: `%${q}%` } },
        { "$inmate.first_name$": { [Op.like]: `%${q}%` } },
        { "$inmate.last_name$": { [Op.like]: `%${q}%` } },
        { "$inmate.inmate_number$": { [Op.like]: `%${q}%` } }
      ];
    }

    const orderDirection = sort === "oldest" ? "ASC" : "DESC";

    const { count, rows } = await Visit.findAndCountAll({
      where,
      include,
      order: [["created_at", orderDirection]],
      limit,
      offset,
      distinct: true
    });

    const totalPages = Math.ceil(count / limit) || 1;

    // Check active inside visitors count for badge
    const activeInsideCount = await Visit.count({ where: { status: "Checked In" } });

    res.render("logbook", {
      title: "Digital Visitor Logbook",
      visits: rows.map(r => r.toJSON()),
      totalRecords: count,
      currentPage: parseInt(page, 10),
      totalPages,
      activeInsideCount,
      filters: {
        search: search || "",
        status: status || "ALL",
        from_date: from_date || "",
        to_date: to_date || "",
        sort
      }
    });
  } catch (error) {
    console.error("Logbook error:", error);
    req.flash("error_msg", "Error loading visitor logbook: " + error.message);
    res.redirect("/dashboard");
  }
};

// Check-out Visitor
export const checkOutVisitor = async (req, res) => {
  try {
    const { id } = req.params;
    const { remarks } = req.body;

    const visit = await Visit.findByPk(id, {
      include: [
        { model: Visitor, as: "visitor" },
        { model: Inmate, as: "inmate" }
      ]
    });

    if (!visit) {
      req.flash("error_msg", "Visit record not found.");
      return res.redirect("/logbook");
    }

    if (visit.status !== "Checked In") {
      req.flash("error_msg", `Cannot check out: Visit is currently "${visit.status}".`);
      return res.redirect("/logbook");
    }

    visit.status = "Checked Out";
    visit.time_out = formatTime12();
    visit.check_out_officer_id = req.session.user.id;
    if (remarks) {
      visit.remarks = (visit.remarks ? visit.remarks + " | " : "") + remarks.trim();
    }
    await visit.save();

    await logAudit({
      req,
      user: req.session.user,
      action: "VISITOR_CHECKED_OUT",
      entity: "Visit",
      entityId: visit.reference_no,
      details: `Gate Officer processed checkout for visitor ${visit.visitor.full_name} visiting ${visit.inmate.last_name}. Exit time: ${visit.time_out}.`
    });

    req.flash("success_msg", `Visitor "${visit.visitor.full_name}" has officially CHECKED OUT at ${visit.time_out}.`);
    res.redirect("/logbook");
  } catch (error) {
    console.error("Checkout error:", error);
    req.flash("error_msg", "Failed to check out visitor: " + error.message);
    res.redirect("/logbook");
  }
};

// Deny Visit
export const denyVisit = async (req, res) => {
  try {
    const { id } = req.params;
    const { denial_reason } = req.body;

    if (!denial_reason || denial_reason.trim().length === 0) {
      req.flash("error_msg", "You must provide an official justification to deny a visitor.");
      return res.redirect("/logbook");
    }

    const visit = await Visit.findByPk(id, {
      include: [
        { model: Visitor, as: "visitor" },
        { model: Inmate, as: "inmate" }
      ]
    });

    if (!visit) {
      req.flash("error_msg", "Visit record not found.");
      return res.redirect("/logbook");
    }

    const previousStatus = visit.status;
    visit.status = "Denied";
    visit.denial_reason = denial_reason.trim();
    visit.denied_by_id = req.session.user.id;
    await visit.save();

    await logAudit({
      req,
      user: req.session.user,
      action: "VISITOR_DENIED",
      entity: "Visit",
      entityId: visit.reference_no,
      details: `Visit ${visit.reference_no} changed from ${previousStatus} to DENIED by officer. Reason: ${visit.denial_reason}`
    });

    req.flash("error_msg", `Visit ${visit.reference_no} marked as DENIED.`);
    res.redirect("/logbook");
  } catch (error) {
    console.error("Deny visit error:", error);
    req.flash("error_msg", "Failed to deny visit.");
    res.redirect("/logbook");
  }
};

// Controlled Correction / Edit of Visit Record
export const editVisitRecord = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      relationship,
      purpose,
      visiting_area,
      correction_reason,
      remarks
    } = req.body;

    if (!correction_reason || correction_reason.trim().length === 0) {
      req.flash("error_msg", "Audit Requirement: A justification reason is mandatory when correcting an official record.");
      return res.redirect("/logbook");
    }

    const visit = await Visit.findByPk(id, {
      include: [{ model: Visitor, as: "visitor" }]
    });

    if (!visit) {
      req.flash("error_msg", "Visit record not found.");
      return res.redirect("/logbook");
    }

    const oldDetails = `Rel: ${visit.relationship}, Purp: ${visit.purpose}, Area: ${visit.visiting_area}`;

    visit.relationship = relationship || visit.relationship;
    visit.purpose = purpose || visit.purpose;
    visit.visiting_area = visiting_area || visit.visiting_area;
    visit.correction_reason = correction_reason.trim();
    visit.last_edited_by_id = req.session.user.id;
    if (remarks) {
      visit.remarks = remarks.trim();
    }
    await visit.save();

    const newDetails = `Rel: ${visit.relationship}, Purp: ${visit.purpose}, Area: ${visit.visiting_area}`;

    await logAudit({
      req,
      user: req.session.user,
      action: "RECORD_CORRECTED",
      entity: "Visit",
      entityId: visit.reference_no,
      details: `Record corrected by officer. Reason: "${correction_reason}". Before: [${oldDetails}] -> After: [${newDetails}]`
    });

    req.flash("success_msg", `Record ${visit.reference_no} successfully updated with audit log entry.`);
    res.redirect("/logbook");
  } catch (error) {
    console.error("Edit visit record error:", error);
    req.flash("error_msg", "Failed to correct visit record.");
    res.redirect("/logbook");
  }
};

// Export to CSV
export const exportLogbookCSV = async (req, res) => {
  try {
    const { search, status, from_date, to_date } = req.query;

    const where = {};
    if (from_date && to_date) {
      where.visit_date = { [Op.between]: [from_date, to_date] };
    } else if (from_date) {
      where.visit_date = { [Op.gte]: from_date };
    } else if (to_date) {
      where.visit_date = { [Op.lte]: to_date };
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    const visits = await Visit.findAll({
      where,
      include: [
        { model: Visitor, as: "visitor" },
        { model: Inmate, as: "inmate", include: [{ model: Cell, as: "cell" }] },
        { model: User, as: "checkInOfficer" },
        { model: User, as: "checkOutOfficer" }
      ],
      order: [["created_at", "DESC"]]
    });

    const headers = [
      "Reference Number",
      "Visitor Name",
      "ID Type",
      "ID Number",
      "Contact Number",
      "Inmate Name",
      "Inmate Number",
      "Cell Assignment",
      "Relationship",
      "Purpose",
      "Visiting Area",
      "Visit Date",
      "Time In",
      "Time Out",
      "Status",
      "Processing Officer",
      "Denial Reason",
      "Remarks"
    ];

    const escapeCsv = (field) => {
      if (field === null || field === undefined) return '""';
      const str = String(field).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = visits.map(v => [
      v.reference_no,
      v.visitor ? v.visitor.full_name : "",
      v.visitor ? v.visitor.id_type : "",
      v.visitor ? v.visitor.id_number : "",
      v.visitor ? v.visitor.contact_number : "",
      v.inmate ? `${v.inmate.last_name}, ${v.inmate.first_name}` : "",
      v.inmate ? v.inmate.inmate_number : "",
      v.inmate && v.inmate.cell ? v.inmate.cell.cell_number : "Unassigned",
      v.relationship,
      v.purpose,
      v.visiting_area,
      v.visit_date,
      v.time_in || "N/A",
      v.time_out || "N/A",
      v.status,
      v.checkInOfficer ? v.checkInOfficer.name : "N/A",
      v.denial_reason || "",
      v.remarks || ""
    ]);

    const csvContent = [headers.join(","), ...rows.map(r => r.map(escapeCsv).join(","))].join("\r\n");

    await logAudit({
      req,
      user: req.session.user,
      action: "EXPORT_LOGBOOK_CSV",
      entity: "Logbook",
      entityId: "CSV",
      details: `Exported ${visits.length} visitor logbook records to CSV.`
    });

    const filename = `BJMP_Visitor_Logbook_${new Date().toISOString().split("T")[0]}.csv`;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send("\uFEFF" + csvContent); // Add UTF-8 BOM for Excel compatibility
  } catch (error) {
    console.error("Export CSV error:", error);
    req.flash("error_msg", "Failed to export CSV: " + error.message);
    res.redirect("/logbook");
  }
};

