import { SystemSetting } from "../models/index.js";
import { logAudit } from "../middleware/auditLogger.js";

export const getSettings = async (req, res) => {
  try {
    const settings = await SystemSetting.findAll({
      order: [["category", "ASC"], ["setting_key", "ASC"]]
    });

    res.render("settings", {
      title: "Facility Configuration & System Settings",
      facilitySettings: settings.map(s => s.toJSON())
    });
  } catch (error) {
    console.error("Settings error:", error);
    req.flash("error_msg", "Error loading system settings: " + error.message);
    res.redirect("/dashboard");
  }
};

export const updateSettings = async (req, res) => {
  try {
    const updates = req.body; // e.g. { facility_name: "...", visiting_hours: "..." }

    for (const [key, val] of Object.entries(updates)) {
      if (typeof val === "string") {
        await SystemSetting.update(
          {
            setting_value: val.trim(),
            updated_by_id: req.session.user.id
          },
          { where: { setting_key: key } }
        );
      }
    }

    await logAudit({
      req,
      user: req.session.user,
      action: "SYSTEM_SETTINGS_UPDATED",
      entity: "SystemSetting",
      entityId: "ALL",
      details: `Administrator updated facility configuration parameters.`
    });

    req.flash("success_msg", "Facility system settings successfully updated.");
    res.redirect("/settings");
  } catch (error) {
    console.error("Update settings error:", error);
    req.flash("error_msg", "Failed to update settings: " + error.message);
    res.redirect("/settings");
  }
};
