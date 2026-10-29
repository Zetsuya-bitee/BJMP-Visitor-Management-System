import { AuditLog } from "../models/index.js";

export async function logAudit({ req, user, action, entity, entityId, details }) {
  try {
    const userId = user?.id || req?.session?.user?.id || null;
    const username = user?.username || req?.session?.user?.username || "SYSTEM";
    const ipAddress = req?.headers["x-forwarded-for"] || req?.socket?.remoteAddress || "127.0.0.1";

    await AuditLog.create({
      user_id: userId,
      username,
      action,
      entity,
      entity_id: String(entityId || "N/A"),
      ip_address: typeof ipAddress === "string" ? ipAddress : "127.0.0.1",
      details
    });
  } catch (error) {
    console.error("Audit log error:", error.message);
  }
}

