import bcrypt from "bcrypt";
import type { Request } from "express";
import { Row, execute, query, queryOne } from "./config/db";
import { can } from "./middleware/auth";
import { teamMemberUpload } from "./middleware/upload";
import { isOpeningEquity, paySheetPostedSql, postPaySheet, syncOpeningEquity, systemAccounts, unpostPaySheet, withBalances } from "./services/accounting";
import { ResourceDef } from "./utils/crud";
import { HttpError, badRequest, round2, toNum } from "./utils/http";
import { sendMail, taskAssignedMail, welcomeMail } from "./utils/mailer";

const pad = (n: number) => String(n).padStart(2, "0");
export const nowStr = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
export const today = () => nowStr().slice(0, 10);
const toDate = (s: string) => new Date(String(s).replace(" ", "T"));
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** SRS 2.2: interns, contractors and clients work only with what is assigned to them. */
const OWN_WORK_ROLES = ["intern", "contractor", "client"];
export const seesOwnWorkOnly = (req: Request) => !!req.user && req.user.permissions !== "all" && OWN_WORK_ROLES.includes(req.user.role_name);
const ownScope = (where: string, times = 1) => (req: Request) =>
  seesOwnWorkOnly(req) ? { where, params: Array(times).fill(req.user!.id) } : undefined;

// ------------------------------------------------------------ user management

const roles: ResourceDef = {
  table: "roles",
  label: "Role",
  columns: ["role_name", "permissions"],
  required: ["role_name"],
  orderBy: "id",
  listSql: "SELECT r.*, (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id) AS user_count FROM roles r",
  beforeSave: (data, { existing }) => {
    if (existing?.role_name === "super-admin" && data.role_name && data.role_name !== "super-admin") {
      throw badRequest("The super-admin role cannot be renamed.");
    }
    if (existing?.role_name === "super-admin") data.permissions = "all";
  },
  beforeDelete: async (existing) => {
    if (existing.role_name === "super-admin") throw badRequest("The super-admin role cannot be deleted.");
    const used = await queryOne("SELECT COUNT(*) AS n FROM users WHERE role_id = ?", [existing.id]);
    if (used?.n) throw new HttpError(409, `${used.n} user(s) still have this role. Reassign them first.`);
  },
};

const modules: ResourceDef = {
  table: "modules",
  label: "Module",
  columns: ["module_name", "actions"],
  required: ["module_name"],
  orderBy: "id",
};

const users: ResourceDef = {
  table: "users",
  label: "User",
  columns: ["name", "email", "password", "role_id"],
  required: ["name", "email", "password", "role_id"],
  hide: ["password"],
  orderBy: "id",
  listSql: "SELECT u.*, r.role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id",
  beforeSave: async (data, { isCreate }) => {
    if (data.email) {
      data.email = String(data.email).toLowerCase();
      if (!EMAIL.test(data.email)) throw badRequest("Enter a valid email address.");
    }
    if (data.password) {
      if (String(data.password).length < 8) throw badRequest("Password must be at least 8 characters.");
      data.password = await bcrypt.hash(String(data.password), 12);
    } else if (!isCreate) {
      delete data.password; // blank password on edit = keep the current one
    }
  },
  afterSave: async (row, { isCreate }) => {
    if (isCreate) void sendMail(row.email, "Welcome to IBMS", welcomeMail(row.name));
  },
  beforeDelete: (existing, req) => {
    if (existing.id === req.user?.id) throw badRequest("You cannot delete your own account.");
  },
};

// ------------------------------------------------------------ task management

/** TM-01-02 / TM-01-03: percent complete and running cost are derived from the project's tasks. */
export async function recalcProject(projectId: number | null | undefined) {
  if (!projectId) return;
  await execute(
    `UPDATE projects p SET
       percent_completed = LEAST(100, COALESCE(ROUND(
         (SELECT COALESCE(SUM(t.estimated_time),0) FROM tasks t WHERE t.project_id = p.id AND t.status = 'Completed')
         / NULLIF(p.estimated_time,0) * 100), 0)),
       running_cost = COALESCE((
         SELECT SUM(t.actual_time / 60 * COALESCE((SELECT MAX(m.hourly_rate) FROM team_members m WHERE m.user_id = t.assigned_to), 0))
         FROM tasks t WHERE t.project_id = p.id), 0)
     WHERE p.id = ?`,
    [projectId]
  );
}

const projects: ResourceDef = {
  table: "projects",
  label: "Project",
  scope: ownScope("created_by = ? OR id IN (SELECT project_id FROM tasks WHERE assigned_to = ?)", 2),
  columns: ["project_name", "type", "start_date", "deadline", "estimated_cost", "running_cost", "estimated_time", "percent_completed", "main_category", "sub_category", "created_by"],
  required: ["project_name"],
  listSql: `SELECT p.*, u.name AS created_by_name,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count
            FROM projects p LEFT JOIN users u ON u.id = p.created_by`,
  beforeSave: (data, { isCreate, req }) => {
    if (isCreate && !data.created_by) data.created_by = req.user!.id;
    if (data.start_date && data.deadline && data.deadline < data.start_date) throw badRequest("Deadline cannot be before the start date.");
  },
  afterSave: (row) => recalcProject(row.id),
};

const TASK_STATUSES = ["Pending", "In Progress", "Completed", "On Hold"];
const ASSIGNEE_FIELDS = ["status", "assignee_notes", "start_time", "end_time", "document_link"];
const TRACKED = ["task_name", "project_id", "assigned_to", "department", "estimated_time", "actual_time", "deadline", "assigned_date", "status", "document_link", "assignor_notes", "assignee_notes"];

const tasks: ResourceDef = {
  table: "tasks",
  label: "Task",
  scope: ownScope("assigned_to = ?"),
  columns: ["task_name", "project_id", "assigned_to", "assigned_by", "department", "estimated_time", "actual_time", "deadline", "assigned_date", "status", "document_link", "assignor_notes", "assignee_notes", "start_time", "end_time"],
  required: ["task_name", "project_id"],
  canUpdate: (req, existing) => existing.assigned_to === req.user?.id,
  listSql: `SELECT t.*, p.project_name, a.name AS assigned_to_name, b.name AS assigned_by_name
            FROM tasks t
            LEFT JOIN projects p ON p.id = t.project_id
            LEFT JOIN users a ON a.id = t.assigned_to
            LEFT JOIN users b ON b.id = t.assigned_by`,
  beforeSave: (data, { isCreate, existing, req }) => {
    // An assignee who is not a manager may only report progress on the task.
    if (!isCreate && !can(req, "tasks", "full")) {
      for (const key of Object.keys(data)) if (!ASSIGNEE_FIELDS.includes(key)) delete data[key];
    }
    if (isCreate) {
      data.assigned_by ??= req.user!.id;
      data.assigned_date ??= today();
      data.status ??= "Pending";
    }
    if (data.status && !TASK_STATUSES.includes(data.status)) throw badRequest(`Status must be one of: ${TASK_STATUSES.join(", ")}.`);
    for (const k of ["start_time", "end_time"]) if (typeof data[k] === "string") data[k] = data[k].replace("T", " ");

    const merged = { ...(existing || {}), ...data };
    if (merged.status === "In Progress" && !merged.start_time) data.start_time = merged.start_time = nowStr();
    // TM-02-03: actual time is calculated from start/end when the task is completed.
    if (merged.status === "Completed" && (isCreate || existing?.status !== "Completed" || data.start_time || data.end_time)) {
      if (!merged.end_time) data.end_time = merged.end_time = nowStr();
      if (merged.start_time) {
        const minutes = Math.round((toDate(merged.end_time).getTime() - toDate(merged.start_time).getTime()) / 60000);
        if (minutes < 0) throw badRequest("End time cannot be before start time.");
        data.actual_time = minutes;
      }
    }
  },
  afterSave: async (row, { isCreate, existing, req }) => {
    const changes: [string, unknown, unknown][] = [];
    if (isCreate) {
      if (row.assigned_to) changes.push(["assigned_to", null, row.assigned_to]);
    } else {
      for (const f of TRACKED) {
        const before = existing![f] ?? null;
        const after = row[f] ?? null;
        if (String(before) !== String(after)) changes.push([f, before, after]);
      }
    }
    for (const [field, before, after] of changes) {
      await execute("INSERT INTO task_history (task_id, field_name, old_value, new_value, changed_by) VALUES (?,?,?,?,?)", [
        row.id,
        field,
        before === null ? null : String(before),
        after === null ? null : String(after),
        req.user!.id,
      ]);
    }
    await recalcProject(row.project_id);
    if (existing && existing.project_id !== row.project_id) await recalcProject(existing.project_id);

    // TM-02-06: notify the assignee when a task is assigned to them.
    if (row.assigned_to && row.assigned_to !== existing?.assigned_to) {
      const assignee = await queryOne("SELECT name, email FROM users WHERE id = ?", [row.assigned_to]);
      if (assignee) void sendMail(assignee.email, `New task: ${row.task_name}`, taskAssignedMail(assignee.name, row.task_name, row.deadline));
    }
  },
  afterDelete: (existing) => recalcProject(existing.project_id),
};

const taskHistory: ResourceDef = {
  table: "task_history",
  label: "Task history",
  scope: ownScope("task_id IN (SELECT id FROM tasks WHERE assigned_to = ?)"),
  columns: [],
  readOnly: true,
  orderBy: "changed_at DESC, id DESC",
  listSql: `SELECT h.*, t.task_name, p.project_name, u.name AS changed_by_name
            FROM task_history h
            LEFT JOIN tasks t ON t.id = h.task_id
            LEFT JOIN projects p ON p.id = t.project_id
            LEFT JOIN users u ON u.id = h.changed_by`,
};

const FILE_FIELDS = ["profile_picture", "cnic_upload", "cv_upload", "contract_upload"];

const teamMembers: ResourceDef = {
  table: "team_members",
  label: "Team member",
  columns: [
    "user_id", "first_name", "middle_name", "surname", "company_name", "cnic_ntn", "cell", "email", "address_line1", "address_line2",
    "city", "province", "member_type", "start_date", "status", "schedule", "salary", "hourly_rate", "weekly_hours", "monthly_hours",
    "overtime_rate", "flat_rate", "commissions", "over_ride", "bank_name", "account_number", "iban", "jazz_cash", "easy_paisa", "notes",
  ],
  required: ["first_name"],
  writeMiddleware: [teamMemberUpload],
  listSql: "SELECT m.*, u.name AS user_name FROM team_members m LEFT JOIN users u ON u.id = m.user_id",
  beforeSave: (data, { req }) => {
    if (data.email && !EMAIL.test(data.email)) throw badRequest("Enter a valid email address.");
    // Uploaded files are stored on disk; only their public path goes into the table.
    const files = (req.files || {}) as Record<string, Express.Multer.File[]>;
    for (const f of FILE_FIELDS) {
      if (files[f]?.[0]) data[f] = `/uploads/${files[f][0].filename}`;
      else if (req.body?.[`remove_${f}`] === "1") data[f] = null;
    }
  },
};

const MEMBER_JOIN = "TRIM(CONCAT_WS(' ', m.first_name, m.middle_name, m.surname)) AS member_name, m.cnic_ntn";

/** TM-04-02 / TM-04-03 */
export function computePay(r: Row) {
  const total_overtime = round2(toNum(r.overtime_hours) * toNum(r.overtime_rate));
  const gross_payout = round2(toNum(r.base_salary) + total_overtime + toNum(r.bonus_comm) + toNum(r.flat_rate));
  const net_payout = round2(gross_payout - (toNum(r.tax_withheld) + toNum(r.gratuity) + toNum(r.insurance) + toNum(r.other_deductions)));
  return { total_overtime, gross_payout, net_payout };
}

const masterPaySheet: ResourceDef = {
  table: "master_pay_sheet",
  label: "Pay sheet entry",
  columns: ["team_member_id", "month", "total_regular_hours", "hourly_rate", "base_salary", "overtime_hours", "overtime_rate", "bonus_comm", "flat_rate", "tax_withheld", "gratuity", "insurance", "other_deductions"],
  required: ["team_member_id", "month"],
  orderBy: "month DESC, id DESC",
  listSql: `SELECT s.*, ${MEMBER_JOIN}, ${paySheetPostedSql("s")} AS posted FROM master_pay_sheet s LEFT JOIN team_members m ON m.id = s.team_member_id`,
  beforeSave: (data, { existing }) => {
    if (typeof data.month === "string") data.month = `${data.month.slice(0, 7)}-01`; // month is stored as its first day
    Object.assign(data, computePay({ ...(existing || {}), ...data }));
  },
  // Every pay sheet row is posted to the ledger: salary expense, cash paid, deductions payable.
  afterSave: (row) => postPaySheet(row),
  afterDelete: (existing) => unpostPaySheet(existing.id),
};

const hoursBetween = (login: string, logout: string) => {
  const mins = (t: string) => {
    const [h, m, s] = t.split(":").map(Number);
    return h * 60 + (m || 0) + (s || 0) / 60;
  };
  return round2((mins(logout) - mins(login)) / 60);
};

/** total_hours = logout - login, pay_value = total_hours x the member's hourly rate. */
export async function computeTime(r: Row) {
  if (!r.login || !r.logout) return { total_hours: 0, pay_value: 0 };
  const total_hours = hoursBetween(String(r.login), String(r.logout));
  if (total_hours < 0) throw badRequest("Logout cannot be before login.");
  const member = await queryOne("SELECT hourly_rate FROM team_members WHERE id = ?", [r.team_member_id]);
  return { total_hours, pay_value: round2(total_hours * toNum(member?.hourly_rate)) };
}

const masterTimeSheet: ResourceDef = {
  table: "master_time_sheet",
  label: "Time sheet entry",
  columns: ["team_member_id", "date", "login", "logout"],
  required: ["team_member_id", "date"],
  orderBy: "date DESC, id DESC",
  listSql: `SELECT s.*, ${MEMBER_JOIN} FROM master_time_sheet s LEFT JOIN team_members m ON m.id = s.team_member_id`,
  beforeSave: async (data, { existing }) => {
    Object.assign(data, await computeTime({ ...(existing || {}), ...data }));
  },
};

const skills: ResourceDef = {
  table: "skills",
  label: "Skill",
  columns: ["team_member_id", "main_category", "sub_category", "estimated_time_min", "estimated_cost"],
  required: ["team_member_id", "main_category"],
  listSql: `SELECT s.*, ${MEMBER_JOIN} FROM skills s LEFT JOIN team_members m ON m.id = s.team_member_id`,
};

// ------------------------------------------------------------ accounting

const businesses: ResourceDef = {
  table: "businesses",
  label: "Business",
  columns: ["user_id", "first_name", "last_name", "business_name", "industry", "business_structure", "ssn_ein_ntn_cnic", "phone", "ext", "web_address", "email", "num_employees", "num_contractors", "budget_month_start", "budget_month_end", "bank_name", "account_no", "current_balance"],
  required: ["business_name"],
  listSql: "SELECT b.*, u.name AS user_name FROM businesses b LEFT JOIN users u ON u.id = b.user_id",
  beforeSave: (data, { existing }) => {
    // The fiscal year end is inferred: one year after the budget month start, minus a day.
    const start = data.budget_month_start;
    if (start && !data.budget_month_end && start !== existing?.budget_month_start) {
      const d = new Date(`${start}T00:00:00Z`);
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      d.setUTCDate(d.getUTCDate() - 1);
      data.budget_month_end = d.toISOString().slice(0, 10);
    }
  },
  // A new business with bank details gets its bank account in the chart of accounts, opening with the current balance.
  afterSave: async (row, { isCreate }) => {
    if (!isCreate || !row.bank_name) return;
    const name = `Bank - ${row.bank_name} (${row.business_name})`.slice(0, 190);
    if (await queryOne("SELECT id FROM ledger_accounts WHERE name = ?", [name])) return;
    let code = `10${String(row.id).padStart(2, "0")}`;
    while (await queryOne("SELECT id FROM ledger_accounts WHERE account_code = ?", [code])) code = `${code}-B`;
    await execute("INSERT INTO ledger_accounts SET ?", [
      { name, account_code: code, account_type: "Asset", sub_type: "Cash/Bank", category: "Bank Account", start_date: row.budget_month_start || today(), start_balance: toNum(row.current_balance) },
    ]);
    await syncOpeningEquity();
  },
};

const creditLeft = (column: string, control: "receivable" | "payable") => async (data: Row, { existing, isCreate }: { existing?: Row; isCreate: boolean }) => {
  if (data.email && !EMAIL.test(data.email)) throw badRequest("Enter a valid email address.");
  // New customers link to Accounts Receivable and new vendors to Accounts Payable unless another account is chosen.
  if (isCreate && !data.linked_ledger_account_id) data.linked_ledger_account_id = (await systemAccounts())[control].id;
  const merged = { ...(existing || {}), ...data };
  data[column] = round2(toNum(merged.credit_limit) - toNum(merged.amount_owed));
};

const customers: ResourceDef = {
  table: "customers",
  label: "Customer",
  columns: ["contact_name", "business_name", "tax_id", "phone", "web_address", "what_is_this_for", "user_id", "business_id", "due_date", "login_url", "email", "credit_limit", "amount_owed", "auto_billing", "turn_on_reminder", "linked_ledger_account_id"],
  required: ["contact_name"],
  listSql: `SELECT c.*, u.name AS user_name, b.business_name AS owner_business_name, l.name AS ledger_account_name
            FROM customers c
            LEFT JOIN users u ON u.id = c.user_id
            LEFT JOIN businesses b ON b.id = c.business_id
            LEFT JOIN ledger_accounts l ON l.id = c.linked_ledger_account_id`,
  beforeSave: creditLeft("balance_of_credit_given", "receivable"),
};

const vendors: ResourceDef = {
  table: "vendors",
  label: "Vendor",
  columns: ["type", "contact_name", "business_name", "tax_id", "is_1099", "phone", "email", "web_address", "login_url", "user_id", "due_date", "credit_limit", "auto_billing", "turn_on_reminder", "amount_owed", "what_is_this_for", "linked_ledger_account_id"],
  required: ["contact_name"],
  listSql: `SELECT v.*, u.name AS user_name, l.name AS ledger_account_name
            FROM vendors v
            LEFT JOIN users u ON u.id = v.user_id
            LEFT JOIN ledger_accounts l ON l.id = v.linked_ledger_account_id`,
  beforeSave: creditLeft("balance_left_on_credit", "payable"),
};

const ACCOUNT_TYPES = ["Asset", "Liability", "Equity", "Income", "Expense"];

const ledgerAccounts: ResourceDef = {
  table: "ledger_accounts",
  label: "Ledger account",
  columns: ["name", "account_code", "account_type", "sub_type", "category", "start_date", "start_balance"],
  required: ["name", "account_code", "account_type"],
  orderBy: "account_code",
  listSql: `SELECT l.*, COALESCE(j.d,0) AS total_debit, COALESCE(j.c,0) AS total_credit, COALESCE(j.n,0) AS entry_count
            FROM ledger_accounts l
            LEFT JOIN (SELECT account_id, SUM(debit_amount) d, SUM(credit_amount) c, COUNT(*) n FROM journal_entries GROUP BY account_id) j
              ON j.account_id = l.id`,
  mapRow: withBalances,
  beforeSave: (data, { existing }) => {
    // The opening balance equity account is maintained by the system; only its name and code can change.
    if (existing && isOpeningEquity(existing)) for (const k of ["account_type", "sub_type", "category", "start_balance"]) delete data[k];
    if (data.account_type && !ACCOUNT_TYPES.includes(data.account_type)) throw badRequest(`Account type must be one of: ${ACCOUNT_TYPES.join(", ")}.`);
  },
  afterSave: () => syncOpeningEquity().then(() => undefined),
  afterDelete: () => syncOpeningEquity().then(() => undefined),
  beforeDelete: async (existing) => {
    if (isOpeningEquity(existing)) throw badRequest("This account keeps the books balanced and cannot be deleted.");
    const used = await queryOne("SELECT COUNT(*) AS n FROM journal_entries WHERE account_id = ?", [existing.id]);
    if (used?.n) throw new HttpError(409, "This account has journal entries and cannot be deleted.");
  },
};

const journalEntries: ResourceDef = {
  table: "journal_entries",
  label: "Journal entry",
  columns: [],
  readOnly: true,
  listSql: `SELECT j.*, l.name AS account_name, l.account_code, l.account_type, t.date, t.type AS transaction_type, t.party_name, t.for_what
            FROM journal_entries j
            LEFT JOIN ledger_accounts l ON l.id = j.account_id
            LEFT JOIN transactions t ON t.id = j.transaction_id`,
  orderBy: "transaction_id DESC, id",
};

/** URL path -> definition. Paths are the table names with dashes. */
export const resources: Record<string, ResourceDef> = {
  roles,
  modules,
  users,
  projects,
  tasks,
  "task-history": taskHistory,
  "team-members": teamMembers,
  "master-pay-sheet": masterPaySheet,
  "master-time-sheet": masterTimeSheet,
  skills,
  businesses,
  customers,
  vendors,
  "ledger-accounts": ledgerAccounts,
  "journal-entries": journalEntries,
};

export { query };
