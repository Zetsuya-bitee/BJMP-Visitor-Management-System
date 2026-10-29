import { Op } from "sequelize";
import {
  Visitor,
  Visit,
  Inmate,
  Cell,
  SystemSetting,
  User
} from "../models/index.js";
import { logAudit } from "../middleware/auditLogger.js";

// Helper to format 12-hour time (e.g. "09:30 AM")
export const formatTime12 = (date = new Date()) => {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
  });
};

// Render Registration Form
export const registrationPage = async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];
    const currentTimeStr = formatTime12();

    // Generate suggested Visitor Code and Reference Number
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const dateCompact = todayStr.replace(/-/g, "");
    const generatedVisitorCode = `VIS-${dateCompact}-${randomSuffix}`;
    const generatedRefNumber = `VRN-${dateCompact}-${randomSuffix}`;

    // Active inmates for dropdown
    const inmates = await Inmate.findAll({
      where: { status: "Active" },
      include: [{ model: Cell, as: "cell" }],
      order: [["last_name", "ASC"]]
    });

    // Visiting Areas setting
    const areasSetting = await SystemSetting.findOne({ where: { setting_key: "visiting_areas" } });
    const visitingAreas = areasSetting
      ? areasSetting.setting_value.split(",").map(a => a.trim())
      : ["Visiting Hall A", "Visiting Hall B", "Conjugal Pavilion", "Attorney-Client Booth", "Gate Reception Area"];

    res.render("visitor-register", {
      title: "Visitor Registration & Processing",
      generatedVisitorCode,
      generatedRefNumber,
      todayStr,
      currentTimeStr,
      inmates: inmates.map(i => i.toJSON()),
      visitingAreas,
      currentUser: req.session.user
    });
  } catch (error) {
    console.error("Registration page error:", error);
    req.flash("error_msg", "Error loading registration form: " + error.message);
    res.redirect("/dashboard");
  }
};

// Quick Search for Visitor (JSON)
export const searchVisitors = async (req, res) => {
  try {
    const q = req.query.q || "";
    if (q.trim().length < 2) {
      return res.json([]);
    }

    const visitors = await Visitor.findAll({
      where: {
        [Op.or]: [
          { full_name: { [Op.like]: `%${q}%` } },
          { id_number: { [Op.like]: `%${q}%` } },
          { visitor_code: { [Op.like]: `%${q}%` } },
          { contact_number: { [Op.like]: `%${q}%` } }
        ]
      },
      limit: 10
    });

    res.json(visitors);
  } catch (error) {
    console.error("Search visitors error:", error);
    res.status(500).json({ error: "Failed to search visitors" });
  }
};

// Process Visitor Registration
export const registerVisitor = async (req, res) => {
  try {
    const {
      visitor_code,
      full_name,
      id_type,
      id_number,
      contact_number,
      address,
      gender,
      inmate_id,
      relationship,
      purpose,
      visiting_area,
      visit_date,
      time_in,
      initial_status, // 'Checked In' or 'Registered' or 'Denied'
      denial_reason,
      remarks
    } = req.body;

    // 1. Validation
    if (!full_name || !id_type || !id_number || !inmate_id || !relationship || !purpose) {
      req.flash("error_msg", "Please fill out all mandatory visitor and visit fields.");
      return res.redirect("/visitors/register");
    }

    // 2. Check if inmate is active
    const inmate = await Inmate.findByPk(inmate_id);
    if (!inmate || inmate.status !== "Active") {
      req.flash("error_msg", "Selected inmate is currently not active in facility custody.");
      return res.redirect("/visitors/register");
    }

    // 3. Find or Create Visitor profile
    let visitor = await Visitor.findOne({
      where: {
        [Op.or]: [
          { id_number: id_number.trim(), id_type: id_type.trim() },
          { visitor_code: visitor_code.trim() }
        ]
      }
    });

    if (visitor) {
      // Check if visitor is banned
      if (visitor.is_banned) {
        req.flash("error_msg", `VISITATION BLOCKED: This visitor is banned from the facility! Reason: ${visitor.ban_reason || 'Security ban'}`);
        return res.redirect("/visitors/register");
      }

      // Update visitor details
      visitor.full_name = full_name.trim();
      visitor.contact_number = contact_number ? contact_number.trim() : visitor.contact_number;
      visitor.address = address ? address.trim() : visitor.address;
      visitor.gender = gender || visitor.gender;
      await visitor.save();
    } else {
      const code = visitor_code && visitor_code.trim().length > 3
        ? visitor_code.trim()
        : `VIS-${Date.now()}`;

      visitor = await Visitor.create({
        visitor_code: code,
        full_name: full_name.trim(),
        id_type: id_type.trim(),
        id_number: id_number.trim(),
        contact_number: contact_number ? contact_number.trim() : null,
        address: address ? address.trim() : null,
        gender: gender || null,
        is_banned: false
      });
    }

    // 4. DUPLICATE ACTIVE CHECK-IN PREVENTION
    if (initial_status === "Checked In") {
      const activeVisit = await Visit.findOne({
        where: {
          visitor_id: visitor.id,
          status: "Checked In"
        }
      });

      if (activeVisit) {
        req.flash(
          "error_msg",
          `DUPLICATE CHECK-IN BLOCKED: Visitor "${visitor.full_name}" is ALREADY checked in under Reference #${activeVisit.reference_no} without checking out!`
        );
        return res.redirect("/visitors/register");
      }
    }

    // 5. Generate unique Visit Reference Number
    const dateCompact = (visit_date || new Date().toISOString().split("T")[0]).replace(/-/g, "");
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const reference_no = `VRN-${dateCompact}-${randomSuffix}`;

    const status = initial_status || "Checked In";
    const actualTimeIn = status === "Checked In" ? (time_in || formatTime12()) : null;

    // If denied, must require denial reason
    if (status === "Denied" && (!denial_reason || denial_reason.trim().length === 0)) {
      req.flash("error_msg", "A detailed official reason is required when denying a visitor.");
      return res.redirect("/visitors/register");
    }

    const visit = await Visit.create({
      reference_no,
      visitor_id: visitor.id,
      inmate_id: inmate.id,
      visit_date: visit_date || new Date().toISOString().split("T")[0],
      time_in: actualTimeIn,
      time_out: null,
      relationship: relationship.trim(),
      purpose: purpose.trim(),
      visiting_area: visiting_area || "Visiting Hall A",
      status,
      denial_reason: status === "Denied" ? denial_reason.trim() : null,
      denied_by_id: status === "Denied" ? req.session.user.id : null,
      check_in_officer_id: req.session.user.id,
      remarks: remarks ? remarks.trim() : null
    });

    // 6. Audit Logging
    await logAudit({
      req,
      user: req.session.user,
      action: status === "Checked In" ? "VISITOR_CHECKED_IN" : (status === "Denied" ? "VISITOR_DENIED" : "VISITOR_REGISTERED"),
      entity: "Visit",
      entityId: visit.reference_no,
      details: `Gate Officer processed visitor ${visitor.full_name} for inmate ${inmate.last_name}, ${inmate.first_name}. Status: ${status}. Reference: ${visit.reference_no}.`
    });

    if (status === "Checked In") {
      req.flash("success_msg", `Visitor "${visitor.full_name}" successfully CHECKED IN! Reference: ${visit.reference_no}`);
      // Redirect to pass printable view or logbook
      return res.redirect(`/visitors/pass/${visit.id}`);
    } else if (status === "Denied") {
      req.flash("error_msg", `Visit DENIED for "${visitor.full_name}". Denial record logged.`);
      return res.redirect("/logbook");
    } else {
      req.flash("success_msg", `Visitor appointment registered. Reference: ${visit.reference_no}`);
      return res.redirect("/logbook");
    }
  } catch (error) {
    console.error("Register visitor error:", error);
    req.flash("error_msg", "Failed to process visitor registration: " + error.message);
    res.redirect("/visitors/register");
  }
};

// Printable Visitor Pass Page
export const getVisitorPass = async (req, res) => {
  try {
    const { id } = req.params;
    const visit = await Visit.findByPk(id, {
      include: [
        { model: Visitor, as: "visitor" },
        { model: Inmate, as: "inmate", include: [{ model: Cell, as: "cell" }] },
        { model: User, as: "checkInOfficer" }
      ]
    });

    if (!visit) {
      req.flash("error_msg", "Visit record not found.");
      return res.redirect("/logbook");
    }

    const facilitySetting = await SystemSetting.findOne({ where: { setting_key: "facility_name" } });
    const durationSetting = await SystemSetting.findOne({ where: { setting_key: "max_visit_duration_minutes" } });

    res.render("visitor-pass", {
      title: `Visitor Pass - ${visit.reference_no}`,
      visit: visit.toJSON(),
      facilityName: facilitySetting ? facilitySetting.setting_value : "BJMP San Jose District Jail",
      maxDuration: durationSetting ? durationSetting.setting_value : "60",
      currentUser: req.session.user
    });
  } catch (error) {
    console.error("Visitor pass error:", error);
    req.flash("error_msg", "Error loading visitor pass.");
    res.redirect("/logbook");
  }
};

