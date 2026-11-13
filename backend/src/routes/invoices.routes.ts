import { Router } from "express";
import { Row, execute, query, queryOne } from "../config/db";
import { allow } from "../middleware/auth";
import { deleteTransaction, saveTransaction, systemAccounts } from "../services/accounting";
import { audit } from "../utils/audit";
import { HttpError, badRequest, notFound, round2, toNum } from "../utils/http";

/**
 * Invoices are tied into the books:
 *  - Saving an invoice posts its total as receivable (debit Accounts Receivable, credit the income account)
 *    and raises what the customer owes. The posting is a transaction tagged "[INV-<id>]".
 *  - A payment is a Money In to Accounts Receivable tagged "[INVP-<id>]": it lowers what the customer owes.
 *    Amount paid is always the sum of those payments, so deleting one from Transactions reopens the invoice.
 */
const router = Router();

const numberOf = (id: number) => `INV-${String(id).padStart(4, "0")}`;
const PAID_SQL = "COALESCE((SELECT SUM(p.amount_now) FROM transactions p WHERE p.customer_id = i.customer_id AND p.for_what LIKE CONCAT('%[INVP-', i.id, ']')), 0)";
const LIST = `SELECT i.*, c.contact_name, c.business_name AS customer_business, c.email AS customer_email, c.phone AS customer_phone, c.tax_id AS customer_tax_id,
                     b.business_name AS from_business, b.email AS from_email, b.phone AS from_phone, b.web_address AS from_web, b.ssn_ein_ntn_cnic AS from_tax_id,
                     l.name AS ledger_account_name, ${PAID_SQL} AS amount_paid
              FROM invoices i
              JOIN customers c ON c.id = i.customer_id
              LEFT JOIN businesses b ON b.id = i.business_id
              LEFT JOIN ledger_accounts l ON l.id = i.ledger_account_id`;

const today = () => new Date().toLocaleDateString("en-CA");

/** Adds balance and status. Status is worked out, never stored, so it can never go stale. */
function shape(row: Row): Row {
  const balance = round2(toNum(row.total) - toNum(row.amount_paid));
  const status = balance <= 0 ? "Paid" : row.due_date && String(row.due_date) < today() ? "Overdue" : toNum(row.amount_paid) > 0 ? "Partial" : "Unpaid";
  return { ...row, balance: Math.max(balance, 0), status };
}

async function load(id: number): Promise<Row> {
  const row = await queryOne(`${LIST} WHERE i.id = ?`, [id]);
  if (!row) throw notFound("Invoice");
  const items = await query("SELECT id, description, quantity, unit_price, amount FROM invoice_items WHERE invoice_id = ? ORDER BY id", [id]);
  const payments = await query("SELECT id, date, amount_now AS amount FROM transactions WHERE customer_id = ? AND for_what LIKE ? ORDER BY date, id", [row.customer_id, `%[INVP-${id}]`]);
  return { ...shape(row), items, payments };
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Validates the request body and works out the money. Totals are always calculated here, never trusted from the client. */
async function parse(body: Row) {
  const customer = await queryOne("SELECT id, business_id FROM customers WHERE id = ?", [Number(body?.customer_id)]);
  if (!customer) throw badRequest("Select a customer.");
  if (!DATE.test(String(body.issue_date || ""))) throw badRequest("Issue date is required.");
  if (body.due_date && !DATE.test(String(body.due_date))) throw badRequest("Due date is not valid.");
  if (body.due_date && body.due_date < body.issue_date) throw badRequest("Due date cannot be before the issue date.");

  const items: Row[] = (Array.isArray(body.items) ? body.items : [])
    .map((it: Row): Row => ({ description: String(it.description || "").trim(), quantity: round2(toNum(it.quantity)), unit_price: round2(toNum(it.unit_price)) }))
    .filter((it: Row) => it.description);
  if (!items.length) throw badRequest("Add at least one line with a description.");
  for (const it of items) {
    if (it.quantity <= 0) throw badRequest(`"${it.description}": quantity must be more than zero.`);
    if (it.unit_price < 0) throw badRequest(`"${it.description}": price cannot be negative.`);
    it.amount = round2(it.quantity * it.unit_price);
  }
  const taxRate = toNum(body.tax_rate);
  if (taxRate < 0 || taxRate > 100) throw badRequest("Tax rate must be between 0 and 100.");
  const subtotal = round2(items.reduce((s: number, it: Row) => s + it.amount, 0));
  const tax_amount = round2((subtotal * taxRate) / 100);
  const total = round2(subtotal + tax_amount);
  if (total <= 0) throw badRequest("The invoice total must be more than zero.");

  // The income account the sale is credited to. Defaults to the first Income account in the chart.
  let account = body.ledger_account_id ? await queryOne("SELECT id, account_type FROM ledger_accounts WHERE id = ?", [Number(body.ledger_account_id)]) : undefined;
  if (!account) account = await queryOne("SELECT id, account_type FROM ledger_accounts WHERE account_type = 'Income' ORDER BY id LIMIT 1");
  if (!account) {
    const created = await execute("INSERT INTO ledger_accounts SET ?", [
      { name: "Sales Revenue", account_code: `4000-${Date.now() % 10000}`, account_type: "Income", sub_type: "Sales Revenue", category: "Sales", start_date: today(), start_balance: 0 },
    ]);
    account = { id: created.insertId, account_type: "Income" };
  }
  if (account.account_type !== "Income") throw badRequest("Choose an Income account for the invoice.");

  return {
    items,
    invoice: {
      customer_id: customer.id,
      business_id: body.business_id ? Number(body.business_id) : customer.business_id,
      issue_date: body.issue_date,
      due_date: body.due_date || null,
      ledger_account_id: account.id,
      subtotal,
      tax_rate: taxRate,
      tax_amount,
      total,
      notes: String(body.notes || "").trim() || null,
    },
  };
}

const post = (id: number, invoice: Row, transactionId?: number) =>
  saveTransaction(
    { type: "money_in", date: invoice.issue_date, customer_id: invoice.customer_id, for_what: `Invoice ${numberOf(id)} [INV-${id}]`, ledger_account_id: invoice.ledger_account_id, amount_now: 0, amount_later: invoice.total },
    transactionId
  );

router.get("/", allow("invoices", "view"), async (_req, res) => {
  res.json((await query(`${LIST} ORDER BY i.issue_date DESC, i.id DESC`)).map(shape));
});

router.get("/:id", allow("invoices", "view"), async (req, res) => {
  res.json(await load(Number(req.params.id)));
});

router.post("/", allow("invoices", "full"), async (req, res) => {
  const { invoice, items } = await parse(req.body);
  const result = await execute("INSERT INTO invoices SET ?", [{ ...invoice, created_by: req.user!.id }]);
  const id = result.insertId;
  try {
    for (const it of items) await execute("INSERT INTO invoice_items SET ?", [{ ...it, invoice_id: id }]);
    const transactionId = await post(id, invoice);
    await execute("UPDATE invoices SET invoice_number = ?, transaction_id = ? WHERE id = ?", [numberOf(id), transactionId, id]);
  } catch (err) {
    await execute("DELETE FROM invoices WHERE id = ?", [id]); // nothing half-saved if the ledger posting fails
    throw err;
  }
  audit(req, "create", "invoices", id, { total: invoice.total });
  res.status(201).json(await load(id));
});

router.put("/:id", allow("invoices", "full"), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await load(id);
  const { invoice, items } = await parse(req.body);
  if (invoice.customer_id !== existing.customer_id && existing.payments.length) throw badRequest("This invoice has payments, so its customer cannot be changed.");
  if (invoice.total < toNum(existing.amount_paid)) throw badRequest(`${toNum(existing.amount_paid).toFixed(2)} has already been paid. The total cannot be less than that.`);
  const transactionId = await post(id, invoice, existing.transaction_id || undefined);
  await execute("UPDATE invoices SET ? WHERE id = ?", [{ ...invoice, transaction_id: transactionId }, id]);
  await execute("DELETE FROM invoice_items WHERE invoice_id = ?", [id]);
  for (const it of items) await execute("INSERT INTO invoice_items SET ?", [{ ...it, invoice_id: id }]);
  audit(req, "update", "invoices", id, { total: invoice.total });
  res.json(await load(id));
});

router.delete("/:id", allow("invoices", "full"), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await load(id);
  if (existing.payments.length) throw new HttpError(409, "This invoice has payments. Delete those payments from Transactions first.");
  if (existing.transaction_id) await deleteTransaction(existing.transaction_id);
  await execute("DELETE FROM invoices WHERE id = ?", [id]);
  audit(req, "delete", "invoices", id);
  res.status(204).end();
});

/** Records money received against the invoice. */
router.post("/:id/payments", allow("invoices", "full"), async (req, res) => {
  const id = Number(req.params.id);
  const invoice = await load(id);
  const amount = round2(toNum(req.body?.amount));
  const date = String(req.body?.date || today());
  if (!DATE.test(date)) throw badRequest("Payment date is not valid.");
  if (amount <= 0) throw badRequest("Enter the amount received.");
  if (amount > invoice.balance) throw badRequest(`Only ${toNum(invoice.balance).toFixed(2)} is still due on this invoice.`);
  const { receivable } = await systemAccounts();
  await saveTransaction({ type: "money_in", date, customer_id: invoice.customer_id, for_what: `Payment for ${invoice.invoice_number} [INVP-${id}]`, ledger_account_id: receivable.id, amount_now: amount, amount_later: 0 });
  audit(req, "payment", "invoices", id, { amount });
  res.status(201).json(await load(id));
});

export default router;
