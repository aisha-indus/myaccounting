import type { Request } from "express";
import winston from "winston";

// SRS 5.2: every critical action (create, update, delete, sign-in, financial entry) is recorded.
// The documentation sheet has no audit table, so the trail is written to logs/audit.log (one JSON line per action).
const auditLogger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), winston.format.json()),
  transports: [new winston.transports.File({ filename: "logs/audit.log" })],
});

export function audit(req: Request, action: string, entity: string, id?: number | string, detail?: unknown) {
  auditLogger.info({ action, entity, id, user_id: req.user?.id, user: req.user?.email, role: req.user?.role_name, ip: req.ip, detail });
}
