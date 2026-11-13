import { Router } from "express";
import { query, queryOne } from "../config/db";
import { allow } from "../middleware/auth";
import { balanceSheet, cashFlow, deleteTransaction, isSystemTransaction, profitAndLoss, saveTransaction } from "../services/accounting";
import { audit } from "../utils/audit";
import { badRequest, notFound } from "../utils/http";

const LIST = `SELECT t.*, l.name AS ledger_account_name, l.account_code
              FROM transactions t LEFT JOIN ledger_accounts l ON l.id = t.ledger_account_id`;

// ---------------------------------------------------------------- transactions
export const transactions = Router();

transactions.get("/", allow("transactions", "view"), async (_req, res) => {
  res.json(await query(`${LIST} ORDER BY t.date DESC, t.id DESC`));
});

transactions.get("/:id", allow("transactions", "view"), async (req, res) => {
  const row = await queryOne(`${LIST} WHERE t.id = ?`, [Number(req.params.id)]);
  if (!row) throw notFound("Transaction");
  res.json(row);
});

/** Payroll postings are created from the pay sheet and can only be changed there. */
async function assertEditable(id: number) {
  const row = await queryOne("SELECT customer_id, vendor_id, for_what FROM transactions WHERE id = ?", [id]);
  if (!row) throw notFound("Transaction");
  if (isSystemTransaction(row)) throw badRequest("This entry was posted by payroll. Change it from the Pay Sheet.");
  if (/\[INV-\d+\]$/.test(row.for_what || "")) throw badRequest("This entry was posted by an invoice. Change it from Invoices.");
}

transactions.post("/", allow("transactions", "full"), async (req, res) => {
  const id = await saveTransaction(req.body);
  audit(req, "create", "transactions", id, { type: req.body?.type, amount_now: req.body?.amount_now, amount_later: req.body?.amount_later });
  res.status(201).json(await queryOne(`${LIST} WHERE t.id = ?`, [id]));
});

transactions.put("/:id", allow("transactions", "full"), async (req, res) => {
  await assertEditable(Number(req.params.id));
  const id = await saveTransaction(req.body, Number(req.params.id));
  audit(req, "update", "transactions", id, { amount_now: req.body?.amount_now, amount_later: req.body?.amount_later });
  res.json(await queryOne(`${LIST} WHERE t.id = ?`, [id]));
});

transactions.delete("/:id", allow("transactions", "full"), async (req, res) => {
  await assertEditable(Number(req.params.id));
  await deleteTransaction(Number(req.params.id));
  audit(req, "delete", "transactions", Number(req.params.id));
  res.status(204).end();
});

// ---------------------------------------------------------------- reports
export const reports = Router();
reports.use(allow("reports", "view"));

const DATE = /^\d{4}-\d{2}-\d{2}$/;
function range(q: Record<string, unknown>) {
  const now = new Date();
  const from = String(q.from || `${now.getFullYear()}-01-01`);
  const to = String(q.to || `${now.getFullYear()}-12-31`);
  if (!DATE.test(from) || !DATE.test(to)) throw badRequest("Dates must be YYYY-MM-DD.");
  if (to < from) throw badRequest("The end date cannot be before the start date.");
  return { from, to };
}

reports.get("/profit-loss", async (req, res) => {
  const { from, to } = range(req.query);
  res.json(await profitAndLoss(from, to));
});

reports.get("/balance-sheet", async (req, res) => {
  const { to } = range(req.query);
  res.json(await balanceSheet(to));
});

// AC-03-03: vendors flagged 1099 with what they were paid in the year.
reports.get("/1099", async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const vendors = await query(
    `SELECT v.id, v.contact_name, v.business_name, v.tax_id, v.email, v.phone,
            COALESCE(SUM(t.amount_now),0) AS total_paid, COUNT(t.id) AS payments
     FROM vendors v
     LEFT JOIN transactions t ON t.vendor_id = v.id AND t.type = 'money_out' AND YEAR(t.date) = ?
     WHERE v.is_1099 = 1
     GROUP BY v.id, v.contact_name, v.business_name, v.tax_id, v.email, v.phone
     ORDER BY total_paid DESC`,
    [year]
  );
  res.json({ year, vendors, total: vendors.reduce((s, v) => s + Number(v.total_paid), 0) });
});

reports.get("/cash-flow", async (req, res) => {
  const { from, to } = range(req.query);
  res.json(await cashFlow(from, to));
});
