import { Op } from "sequelize";
import { AuditLog, User } from "../models/index.js";

export const getAuditLogs = async (req, res) => {
  try {
    const { action, username, from_date, to_date, search, page = 1 } = req.query;
    const limit = 25;
    const offset = (parseInt(page, 10) - 1) * limit;

    const where = {};

    if (action && action !== "ALL") {
      where.action = action;
    }

    if (username && username.trim()) {
      where.username = { [Op.like]: `%${username.trim()}%` };
    }

    if (from_date && to_date) {
      where.created_at = {
        [Op.between]: [new Date(`${from_date}T00:00:00`), new Date(`${to_date}T23:59:59`)]
      };
    } else if (from_date) {
      where.created_at = { [Op.gte]: new Date(`${from_date}T00:00:00`) };
    } else if (to_date) {
      where.created_at = { [Op.lte]: new Date(`${to_date}T23:59:59`) };
    }

    if (search && search.trim()) {
      where[Op.or] = [
        { details: { [Op.like]: `%${search.trim()}%` } },
        { entity_id: { [Op.like]: `%${search.trim()}%` } },
        { ip_address: { [Op.like]: `%${search.trim()}%` } }
      ];
    }

    const { count, rows } = await AuditLog.findAndCountAll({
      where,
      include: [{ model: User, as: "user" }],
      order: [["created_at", "DESC"]],
      limit,
      offset
    });

    const totalPages = Math.ceil(count / limit) || 1;

    // Distinct actions for dropdown
    const distinctActions = [
      "USER_LOGIN",
      "USER_LOGOUT",
      "FAILED_LOGIN",
      "VISITOR_CHECKED_IN",
      "VISITOR_CHECKED_OUT",
      "VISITOR_DENIED",
      "VISITOR_REGISTERED",
      "RECORD_CORRECTED",
      "CELL_TRANSFER",
      "HEADCOUNT_SUBMITTED",
      "HEADCOUNT_REVIEWED",
      "USER_CREATED",
      "USER_UPDATED",
      "USER_ACTIVATED",
      "USER_DEACTIVATED",
      "SYSTEM_SETTINGS_UPDATED"
    ];

    res.render("audit-logs", {
      title: "System Security & Audit Trail Logs",
      logs: rows.map(l => l.toJSON()),
      totalRecords: count,
      currentPage: parseInt(page, 10),
      totalPages,
      distinctActions,
      filters: {
        action: action || "ALL",
        username: username || "",
        from_date: from_date || "",
        to_date: to_date || "",
        search: search || ""
      }
    });
  } catch (error) {
    console.error("Audit logs error:", error);
    req.flash("error_msg", "Error loading audit logs: " + error.message);
    res.redirect("/dashboard");
  }
};

