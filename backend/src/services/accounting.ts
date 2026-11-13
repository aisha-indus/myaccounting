import { Row, pool, query, withTransaction } from "../config/db";
import { HttpError, badRequest, notFound, round2, toNum } from "../utils/http";

export type TxType = "money_in" | "money_out";

export interface TxInput {
  type: TxType;
  date: string;
  customer_id?: number | null;
  vendor_id?: number | null;
  for_what?: string | null;
  ledger_account_id: number;
  amount_now: number;
  amount_later: number;
}

interface SaveOptions {
  /** Seed only: the sample data pays for equipment (an Asset) with Money Out. */
  skipTypeCheck?: boolean;
  /** Seed only: sample customers/vendors already carry their owed amounts. */
  skipPartyUpdate?: boolean;
  /** System postings (payroll): no customer/vendor, this name is shown instead. */
  partyName?: string;
  /** Journal description for the "later" line of a system posting. */
  laterLabel?: string;
}

/** Anything that can run a query: the pool, or a connection inside a transaction. */
type Db = { query: (sql: string, params?: any) => Promise<any> };

const q = async (db: Db, sql: string, params: any[] = []) => {
  const [rows] = await db.query(sql, params);
  return rows as Row[];
};

const todayStr = () => new Date().toISOString().slice(0, 10);

interface AccountDefaults {
  name: string;
  account_code: string;
  account_type: string;
  sub_type: string;
  category: string;
}

/** Returns the first account matching `where`, creating it from `def` when the chart of accounts has none. */
async function ensureAccount(db: Db, where: string, def: AccountDefaults): Promise<Row> {
  const [found] = await q(db, `SELECT * FROM ledger_accounts WHERE ${where} ORDER BY id LIMIT 1`);
  if (found) return found;
  let code = def.account_code;
  for (let i = 1; (await q(db, "SELECT id FROM ledger_accounts WHERE account_code = ?", [code])).length; i++) code = `${def.account_code}-${i}`;
  const [result] = await db.query("INSERT INTO ledger_accounts SET ?", [{ ...def, account_code: code, start_date: todayStr(), start_balance: 0 }]);
  const [created] = await q(db, "SELECT * FROM ledger_accounts WHERE id = ?", [(result as { insertId: number }).insertId]);
  return created;
}

const OPENING_WHERE = "account_type='Equity' AND category='Opening Balance'";
const SALARY_WHERE = "account_type='Expense' AND (category='Salary' OR sub_type='Salary' OR name LIKE '%Salar%')";

/**
 * The accounts every posting needs. They are found in the chart of accounts by type / sub type /
 * category and created automatically when missing, so a transaction never fails for lack of setup.
 */
export async function systemAccounts(db: Db = pool) {
  const cash = await ensureAccount(db, "account_type='Asset' AND sub_type='Cash/Bank'", {
    name: "Cash", account_code: "1000", account_type: "Asset", sub_type: "Cash/Bank", category: "Cash",
  });
  const receivable = await ensureAccount(db, "account_type='Asset' AND (category='Receivables' OR name LIKE '%Receivable%')", {
    name: "Accounts Receivable", account_code: "1100", account_type: "Asset", sub_type: "Current Assets", category: "Receivables",
  });
  const payable = await ensureAccount(db, "account_type='Liability' AND (category='Payables' OR name LIKE '%Payable%')", {
    name: "Accounts Payable", account_code: "2000", account_type: "Liability", sub_type: "Current Liabilities", category: "Payables",
  });
  return { cash, receivable, payable };
}

/**
 * Keeps the books balanced automatically. Start balances typed on ledger accounts are one-sided,
 * so their difference is carried by an "Opening Balance Equity" account that is recalculated
 * whenever any account changes. Assets always equal liabilities + equity as a result.
 */
export async function syncOpeningEquity(db: Db = pool) {
  const opening = await ensureAccount(db, OPENING_WHERE, {
    name: "Opening Balance Equity", account_code: "3900", account_type: "Equity", sub_type: "Capital", category: "Opening Balance",
  });
  const [sum] = await q(
    db,
    `SELECT COALESCE(SUM(CASE WHEN account_type IN ('Asset','Expense') THEN start_balance ELSE -start_balance END), 0) AS diff
     FROM ledger_accounts WHERE id <> ?`,
    [opening.id]
  );
  await db.query("UPDATE ledger_accounts SET start_balance = ? WHERE id = ?", [round2(toNum(sum.diff)), opening.id]);
  return opening;
}

export const isOpeningEquity = (row: Row) => row.account_type === "Equity" && row.category === "Opening Balance";

const statusOf = (now: number, later: number) => (later <= 0 ? "completed" : now <= 0 ? "pending" : "partial");

type System = Awaited<ReturnType<typeof systemAccounts>>;

/**
 * A payment against an existing balance: Money In posted to Accounts Receivable (or Cash),
 * or Money Out posted to Accounts Payable. It reduces what the customer / vendor owes.
 */
const isSettlement = (tx: Row, sys: System) =>
  tx.type === "money_in" ? [sys.receivable.id, sys.cash.id].includes(tx.ledger_account_id) : tx.ledger_account_id === sys.payable.id;

/**
 * Updates what the customer owes us / we owe the vendor, and the remaining credit.
 * A normal transaction adds its "later" amount; a settlement subtracts its "now" amount.
 */
async function applyParty(db: Db, tx: Row, sign: 1 | -1, sys: System) {
  const delta = sign * (toNum(tx.amount_later) - (isSettlement(tx, sys) ? toNum(tx.amount_now) : 0));
  if (!delta) return;
  if (tx.type === "money_in" && tx.customer_id) {
    await db.query("UPDATE customers SET amount_owed = amount_owed + ?, balance_of_credit_given = credit_limit - (amount_owed) WHERE id = ?", [delta, tx.customer_id]);
  } else if (tx.type === "money_out" && tx.vendor_id) {
    await db.query("UPDATE vendors SET amount_owed = amount_owed + ?, balance_left_on_credit = credit_limit - (amount_owed) WHERE id = ?", [delta, tx.vendor_id]);
  }
}

async function writeJournal(db: Db, txId: number, tx: Row, account: Row, sys: System, laterLabel?: string) {
  const { cash, receivable, payable } = sys;
  const now = toNum(tx.amount_now);
  const later = toNum(tx.amount_later);
  const total = round2(now + later);
  const what = tx.for_what || (tx.type === "money_in" ? "Money in" : "Money out");
  const lines: { account_id: number; debit: number; credit: number; description: string }[] = [];

  if (tx.type === "money_in") {
    if (now > 0) lines.push({ account_id: cash.id, debit: now, credit: 0, description: later > 0 ? "Cash received (partial)" : "Cash received" });
    if (later > 0) lines.push({ account_id: receivable.id, debit: later, credit: 0, description: laterLabel || "Accounts receivable" });
    // Money received into the cash account itself is treated as collection of a receivable.
    const creditAccount = account.id === cash.id ? receivable : account;
    lines.push({ account_id: creditAccount.id, debit: 0, credit: total, description: what });
  } else {
    lines.push({ account_id: account.id, debit: total, credit: 0, description: what });
    if (now > 0) lines.push({ account_id: cash.id, debit: 0, credit: now, description: later > 0 ? "Cash paid (partial)" : "Cash paid" });
    if (later > 0) lines.push({ account_id: payable.id, debit: 0, credit: later, description: laterLabel || "Accounts payable" });
  }

  const debit = round2(lines.reduce((s, l) => s + l.debit, 0));
  const credit = round2(lines.reduce((s, l) => s + l.credit, 0));
  if (debit !== credit) throw new HttpError(500, "Journal entry is not balanced.");

  const stamp = `${tx.date} ${new Date().toTimeString().slice(0, 8)}`;
  for (const l of lines) {
    await db.query("INSERT INTO journal_entries (transaction_id, account_id, debit_amount, credit_amount, description, created_at) VALUES (?,?,?,?,?,?)", [
      txId, l.account_id, l.debit, l.credit, l.description, stamp,
    ]);
  }
}

/** Creates or updates a Money In / Money Out transaction together with its journal entries (AC-04). */
export async function saveTransaction(input: TxInput, id?: number, opts: SaveOptions = {}): Promise<number> {
  const type = input.type;
  if (type !== "money_in" && type !== "money_out") throw badRequest("Type must be money_in or money_out.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(input.date || ""))) throw badRequest("A valid date is required.");
  const now = round2(toNum(input.amount_now));
  const later = round2(toNum(input.amount_later));
  if (now < 0 || later < 0) throw badRequest("Amounts cannot be negative.");
  if (now + later <= 0) throw badRequest("Enter an amount now, an amount later, or both.");

  return withTransaction(async (conn) => {
    const sys = await systemAccounts(conn);
    const [account] = await q(conn, "SELECT * FROM ledger_accounts WHERE id = ?", [input.ledger_account_id]);
    if (!account) throw badRequest("Select a ledger account.");
    if (!opts.skipTypeCheck && !opts.partyName) {
      const allowed = type === "money_in" ? ["Asset", "Income"] : ["Expense", "Liability"];
      if (!allowed.includes(account.account_type)) {
        throw badRequest(`For ${type === "money_in" ? "Money In" : "Money Out"} the account must be of type ${allowed.join(" or ")}.`);
      }
    }

    let party: Row | undefined;
    if (!opts.partyName) {
      if (type === "money_in") {
        [party] = await q(conn, "SELECT * FROM customers WHERE id = ?", [input.customer_id]);
        if (!party) throw badRequest("Select the customer the money is coming from.");
      } else {
        [party] = await q(conn, "SELECT * FROM vendors WHERE id = ?", [input.vendor_id]);
        if (!party) throw badRequest("Select the vendor the money is going to.");
      }
    }

    const row: Row = {
      type,
      date: input.date,
      party_name: opts.partyName || party!.business_name || party!.contact_name,
      customer_id: type === "money_in" && party ? party.id : null,
      vendor_id: type === "money_out" && party ? party.id : null,
      for_what: input.for_what || null,
      ledger_account_id: account.id,
      amount_now: now,
      amount_later: later,
      status: statusOf(now, later),
    };

    if (party && isSettlement(row, sys)) {
      const side = type === "money_in" ? "received from the customer" : "paid to the vendor";
      if (later > 0) throw badRequest(`This account records a payment against an existing balance, so enter only the amount ${side} now.`);
      const owed = round2(toNum(party.amount_owed));
      if (!id && now > owed) {
        throw badRequest(`The outstanding balance with ${row.party_name} is ${owed.toFixed(2)}. Enter that amount or less.`);
      }
    }

    let txId = id;
    if (txId) {
      const [existing] = await q(conn, "SELECT * FROM transactions WHERE id = ? FOR UPDATE", [txId]);
      if (!existing) throw notFound("Transaction");
      await applyParty(conn, existing, -1, sys);
      await conn.query("DELETE FROM journal_entries WHERE transaction_id = ?", [txId]);
      await conn.query("UPDATE transactions SET ? WHERE id = ?", [row, txId]);
    } else {
      const [result] = await conn.query("INSERT INTO transactions SET ?", [row]);
      txId = (result as { insertId: number }).insertId;
    }

    await writeJournal(conn, txId, row, account, sys, opts.laterLabel);
    if (!opts.skipPartyUpdate) await applyParty(conn, row, 1, sys);
    return txId;
  });
}

export async function deleteTransaction(id: number) {
  await withTransaction(async (conn) => {
    const [existing] = await q(conn, "SELECT * FROM transactions WHERE id = ? FOR UPDATE", [id]);
    if (!existing) throw notFound("Transaction");
    await applyParty(conn, existing, -1, await systemAccounts(conn));
    await conn.query("DELETE FROM transactions WHERE id = ?", [id]); // journal entries cascade
  });
}

// ---------------------------------------------------------------- payroll posting

const payTag = (id: number) => `[PS-${id}]`;
const SYSTEM_TX = "customer_id IS NULL AND vendor_id IS NULL";
/** A transaction with no customer and no vendor was posted by the system (payroll) and is managed there. */
export const isSystemTransaction = (tx: Row) => tx.customer_id === null && tx.vendor_id === null;

const findPayTx = (paySheetId: number) =>
  query(`SELECT id FROM transactions WHERE ${SYSTEM_TX} AND for_what LIKE ?`, [`%${payTag(paySheetId)}`]).then((r) => r[0]?.id as number | undefined);

/**
 * Posts a pay sheet row to the ledger: salary expense for the gross pay-out, cash for the net
 * pay-out, and the deductions (tax, gratuity, insurance, other) as a payable. Re-posts on edit.
 */
export async function postPaySheet(row: Row) {
  const existing = await findPayTx(row.id);
  const gross = round2(toNum(row.gross_payout));
  const net = round2(toNum(row.net_payout));
  if (gross <= 0) {
    if (existing) await deleteTransaction(existing);
    return;
  }
  if (net < 0) throw badRequest("Deductions are larger than the gross pay-out.");
  const member = (await query("SELECT TRIM(CONCAT_WS(' ', first_name, middle_name, surname)) AS name FROM team_members WHERE id = ?", [row.team_member_id]))[0];
  const salary = await ensureAccount(pool, SALARY_WHERE, { name: "Salaries & Wages", account_code: "5900", account_type: "Expense", sub_type: "Salary", category: "Salary" });
  const month = String(row.month).slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const payDate = `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`; // last day of the pay month
  const name = member?.name || "Team member";
  await saveTransaction(
    { type: "money_out", date: payDate, for_what: `Payroll ${month} - ${name} ${payTag(row.id)}`, ledger_account_id: salary.id, amount_now: net, amount_later: round2(gross - net) },
    existing,
    { partyName: name, laterLabel: "Payroll deductions payable" }
  );
}

export async function unpostPaySheet(paySheetId: number) {
  const existing = await findPayTx(paySheetId);
  if (existing) await deleteTransaction(existing);
}

/** SQL fragment: 1 when the pay sheet row `alias` has been posted to the ledger. */
export const paySheetPostedSql = (alias: string) =>
  `EXISTS (SELECT 1 FROM transactions pt WHERE pt.customer_id IS NULL AND pt.vendor_id IS NULL AND pt.for_what LIKE CONCAT('%[PS-', ${alias}.id, ']'))`;

// ---------------------------------------------------------------- reporting

const DEBIT_NORMAL = ["Asset", "Expense"];

interface AccountTotals extends Row {
  debit: number;
  credit: number;
}

/** Every ledger account with its journal debits/credits between two dates (inclusive). */
async function accountTotals(from: string, to: string): Promise<AccountTotals[]> {
  return query<AccountTotals>(
    `SELECT l.*, COALESCE(s.d,0) AS debit, COALESCE(s.c,0) AS credit
     FROM ledger_accounts l
     LEFT JOIN (
       SELECT j.account_id, SUM(j.debit_amount) d, SUM(j.credit_amount) c
       FROM journal_entries j LEFT JOIN transactions t ON t.id = j.transaction_id
       WHERE COALESCE(t.date, DATE(j.created_at)) BETWEEN ? AND ?
       GROUP BY j.account_id
     ) s ON s.account_id = l.id
     ORDER BY l.account_code`,
    [from, to]
  );
}

const MIN = "1900-01-01";
const MAX = "2999-12-31";

interface Line {
  id: number;
  name: string;
  account_code: string;
  balance: number;
}
interface Group {
  name: string;
  total: number;
  accounts: Line[];
}

function group(accounts: AccountTotals[], balanceOf: (a: AccountTotals) => number, key: "sub_type" | "category" = "sub_type"): Group[] {
  const map = new Map<string, Group>();
  for (const a of accounts) {
    const name = a[key] || "Other";
    const g: Group = map.get(name) || { name, total: 0, accounts: [] };
    const balance = round2(balanceOf(a));
    g.accounts.push({ id: a.id, name: a.name, account_code: a.account_code, balance });
    g.total = round2(g.total + balance);
    map.set(name, g);
  }
  return [...map.values()];
}
const sum = (groups: Group[]) => round2(groups.reduce((s, g) => s + g.total, 0));

async function incomeStatement(from: string, to: string) {
  const accounts = await accountTotals(from, to);
  const income = group(accounts.filter((a) => a.account_type === "Income"), (a) => a.credit - a.debit, "category");
  const expense = group(accounts.filter((a) => a.account_type === "Expense"), (a) => a.debit - a.credit, "category");
  const totalIncome = sum(income);
  const totalExpense = sum(expense);
  return { income, expense, totalIncome, totalExpense, netProfit: round2(totalIncome - totalExpense) };
}

/** Length-matched period immediately before [from, to], for comparative reports (AC-06-06). */
function previousPeriod(from: string, to: string) {
  const day = 86400000;
  const f = new Date(`${from}T00:00:00Z`).getTime();
  const t = new Date(`${to}T00:00:00Z`).getTime();
  const prevTo = new Date(f - day);
  const prevFrom = new Date(f - day - (t - f));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(prevFrom), to: iso(prevTo) };
}

export async function profitAndLoss(from: string, to: string) {
  const current = await incomeStatement(from, to);
  const prev = previousPeriod(from, to);
  const previous = await incomeStatement(prev.from, prev.to);
  return { from, to, ...current, previous: { ...prev, totalIncome: previous.totalIncome, totalExpense: previous.totalExpense, netProfit: previous.netProfit } };
}

export async function balanceSheet(asOf: string) {
  const accounts = await accountTotals(MIN, asOf);
  const start = (a: AccountTotals) => toNum(a.start_balance);
  const assets = group(accounts.filter((a) => a.account_type === "Asset"), (a) => start(a) + a.debit - a.credit);
  const liabilities = group(accounts.filter((a) => a.account_type === "Liability"), (a) => start(a) + a.credit - a.debit);
  const equity = group(accounts.filter((a) => a.account_type === "Equity"), (a) => start(a) + a.credit - a.debit);

  // Profit to date is carried into equity as retained earnings.
  const retained = round2(
    accounts.reduce((s, a) => {
      if (a.account_type === "Income") return s + start(a) + (a.credit - a.debit);
      if (a.account_type === "Expense") return s - start(a) - (a.debit - a.credit);
      return s;
    }, 0)
  );
  equity.push({ name: "Retained Earning", total: retained, accounts: [{ id: 0, name: "Retained earnings (profit to date)", account_code: "", balance: retained }] });

  const totalAssets = sum(assets);
  const totalLiabilities = sum(liabilities);
  const totalEquity = sum(equity);
  return {
    asOf,
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    liabilitiesAndEquity: round2(totalLiabilities + totalEquity),
    balanced: Math.abs(totalAssets - (totalLiabilities + totalEquity)) < 0.005,
  };
}

export async function cashFlow(from: string, to: string) {
  const cashAccounts = await query("SELECT id, start_balance FROM ledger_accounts WHERE account_type='Asset' AND sub_type='Cash/Bank'");
  const cashIds = cashAccounts.map((a) => a.id);
  if (!cashIds.length) {
    return { from, to, startingBalance: 0, operating: [], investing: [], financing: [], totalOperating: 0, totalInvesting: 0, totalFinancing: 0, totalCashFlow: 0, endingBalance: 0 };
  }
  const opening = cashAccounts.reduce((s, a) => s + toNum(a.start_balance), 0);
  const [before] = await query(
    `SELECT COALESCE(SUM(j.debit_amount - j.credit_amount),0) AS net
     FROM journal_entries j LEFT JOIN transactions t ON t.id = j.transaction_id
     WHERE j.account_id IN (?) AND COALESCE(t.date, DATE(j.created_at)) < ?`,
    [cashIds, from]
  );
  const startingBalance = round2(opening + toNum(before?.net));

  const lines = await query(
    `SELECT j.transaction_id, j.account_id, j.debit_amount, j.credit_amount, l.name, l.account_type, l.sub_type, l.category
     FROM journal_entries j
     JOIN ledger_accounts l ON l.id = j.account_id
     LEFT JOIN transactions t ON t.id = j.transaction_id
     WHERE COALESCE(t.date, DATE(j.created_at)) BETWEEN ? AND ?`,
    [from, to]
  );

  // Each transaction's cash movement is classified by the non-cash account on its other side.
  const byTx = new Map<number, Row[]>();
  for (const l of lines) byTx.set(l.transaction_id, [...(byTx.get(l.transaction_id) || []), l]);

  const buckets: Record<"operating" | "investing" | "financing", Map<string, number>> = {
    operating: new Map(),
    investing: new Map(),
    financing: new Map(),
  };
  for (const txLines of byTx.values()) {
    const cash = txLines.filter((l) => cashIds.includes(l.account_id)).reduce((s, l) => s + toNum(l.debit_amount) - toNum(l.credit_amount), 0);
    if (!cash) continue;
    const others = txLines.filter((l) => !cashIds.includes(l.account_id));
    const other = others.find((l) => !["Receivables", "Payables"].includes(l.category)) || others[0];
    let bucket: keyof typeof buckets = "operating";
    if (other?.account_type === "Asset" && ["Fixed Assets", "Other Assets"].includes(other.sub_type)) bucket = "investing";
    else if (other?.account_type === "Equity" || (other?.account_type === "Liability" && other.sub_type === "Long Term Liabilities")) bucket = "financing";
    const label = other?.name || "Other";
    buckets[bucket].set(label, round2((buckets[bucket].get(label) || 0) + cash));
  }

  const list = (m: Map<string, number>) => [...m.entries()].map(([name, amount]) => ({ name, amount }));
  const total = (m: Map<string, number>) => round2([...m.values()].reduce((s, v) => s + v, 0));
  const totalOperating = total(buckets.operating);
  const totalInvesting = total(buckets.investing);
  const totalFinancing = total(buckets.financing);
  const totalCashFlow = round2(totalOperating + totalInvesting + totalFinancing);
  return {
    from,
    to,
    startingBalance,
    operating: list(buckets.operating),
    investing: list(buckets.investing),
    financing: list(buckets.financing),
    totalOperating,
    totalInvesting,
    totalFinancing,
    totalCashFlow,
    endingBalance: round2(startingBalance + totalCashFlow),
  };
}

/** Debit / credit balance of an account including its opening balance (AC-05-03). */
export function withBalances(row: Row): Row {
  const start = toNum(row.start_balance);
  const debitNormal = DEBIT_NORMAL.includes(row.account_type);
  const net = round2((debitNormal ? start : -start) + toNum(row.total_debit) - toNum(row.total_credit));
  return { ...row, debit_balance: net > 0 ? net : 0, credit_balance: net < 0 ? -net : 0, balance: debitNormal ? net : -net };
}

export { MIN as MIN_DATE, MAX as MAX_DATE };
