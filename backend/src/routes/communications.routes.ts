import { Router } from "express";
import { query } from "../config/db";
import { ROLES, allow, permit } from "../middleware/auth";
import { runReminders } from "../services/reminders";
import { audit } from "../utils/audit";
import { badRequest } from "../utils/http";
import { messageMail, sendMail, smtpConfigured } from "../utils/mailer";

/** Extra customer actions, mounted before the generic /customers CRUD router. */
export const customerMail = Router();

// AC-02-04: one email to many customers. `only_owing` limits it to customers with a balance due.
customerMail.post("/email", allow("customers", "full"), async (req, res) => {
  const subject = String(req.body?.subject || "").trim();
  const message = String(req.body?.message || "").trim();
  if (!subject || !message) throw badRequest("Subject and message are required.");
  const customers = await query(`SELECT id, contact_name, email FROM customers ${req.body?.only_owing ? "WHERE amount_owed > 0" : ""}`);
  const withEmail = customers.filter((c) => c.email);
  for (const c of withEmail) await sendMail(c.email, subject, messageMail(subject, `Dear ${c.contact_name},\n\n${message}`));
  audit(req, "bulk-email", "customers", undefined, { subject, recipients: withEmail.length });
  res.json({ sent: withEmail.length, skipped: customers.length - withEmail.length, smtpConfigured });
});

/** Runs the automatic reminder check right now (it also runs by itself every hour). */
export const reminders = Router();
reminders.post("/run", permit(ROLES.ADMIN), async (_req, res) => {
  res.json({ ...(await runReminders()), smtpConfigured });
});
