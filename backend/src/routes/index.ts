import { Router } from "express";
import { authenticate } from "../middleware/auth";
import accessRoutes, { lookups } from "./access.routes";
import invoiceRoutes from "./invoices.routes";
import { resources } from "../resources";
import { crudRouter } from "../utils/crud";
import { reports, transactions } from "./accounting.routes";
import authRoutes from "./auth.routes";
import { customerMail, reminders } from "./communications.routes";
import dashboardRoutes from "./dashboard.routes";
import { payroll, timesheet } from "./team.routes";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});
router.use("/auth", authRoutes);

// Everything below requires a signed-in user.
router.use(authenticate);

router.use("/dashboard", dashboardRoutes);
router.use("/lookup", lookups);
router.use("/role-access", accessRoutes);
router.use("/invoices", invoiceRoutes);
router.use("/transactions", transactions);
router.use("/reports", reports);

// Custom actions are mounted before the generic CRUD router of the same path.
router.use("/customers", customerMail);
router.use("/reminders", reminders);
router.use("/master-pay-sheet", payroll);
router.use("/master-time-sheet", timesheet);

for (const [path, def] of Object.entries(resources)) {
  router.use(`/${path}`, crudRouter(def, path));
}

export default router;
