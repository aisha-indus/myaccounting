import fs from "fs";
import path from "path";
import { query } from "../config/db";
import { env } from "../config/env";
import { logger } from "../config/logger";
import { billDueMail, paymentDueMail, sendMail, taskDueMail } from "../utils/mailer";

/**
 * Automatic reminder emails (SRS TM-02-06 and the "Turn On Reminder" switch on customers and vendors).
 * Checked on start and then every hour; each reminder is sent at most once a day.
 *  - Task assignee: the day before a deadline, while the task is not completed.
 *  - Customer (reminder on, balance owed): from 3 days before the due date until paid.
 *  - Vendor (reminder on, balance owed): the owner user is reminded from 3 days before the due date.
 */
const STATE_FILE = path.resolve(env.dataDir, "logs/reminders.json");
const today = () => new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in local time

function loadSent(): Set<string> {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
    if (state.date === today()) return new Set(state.keys);
  } catch {
    /* first run or a new day */
  }
  return new Set();
}

const amount = (n: unknown) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function runReminders() {
  const sent = loadSent();
  const once = async (key: string, send: () => Promise<void>) => {
    if (sent.has(key)) return;
    await send();
    sent.add(key);
  };

  const tasks = await query(
    `SELECT t.id, t.task_name, t.deadline, u.name, u.email FROM tasks t JOIN users u ON u.id = t.assigned_to
     WHERE t.status <> 'Completed' AND t.deadline = DATE_ADD(CURDATE(), INTERVAL 1 DAY)`
  );
  for (const t of tasks) await once(`task-${t.id}`, () => sendMail(t.email, `Due tomorrow: ${t.task_name}`, taskDueMail(t.name, t.task_name, t.deadline)));

  const customers = await query(
    `SELECT c.id, c.contact_name, c.email, c.amount_owed, c.due_date, COALESCE(b.business_name, 'Accounts team') AS sender
     FROM customers c LEFT JOIN businesses b ON b.id = c.business_id
     WHERE c.turn_on_reminder = 1 AND c.amount_owed > 0 AND c.email IS NOT NULL AND c.due_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)`
  );
  for (const c of customers) await once(`customer-${c.id}`, () => sendMail(c.email, "Payment reminder", paymentDueMail(c.contact_name, amount(c.amount_owed), c.due_date, c.sender)));

  const vendors = await query(
    `SELECT v.id, COALESCE(v.business_name, v.contact_name) AS vendor, v.amount_owed, v.due_date, u.name, u.email
     FROM vendors v JOIN users u ON u.id = v.user_id
     WHERE v.turn_on_reminder = 1 AND v.amount_owed > 0 AND v.due_date <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)`
  );
  for (const v of vendors) await once(`vendor-${v.id}`, () => sendMail(v.email, `Payment due: ${v.vendor}`, billDueMail(v.name, v.vendor, amount(v.amount_owed), v.due_date)));

  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify({ date: today(), keys: [...sent] }));
  return { tasks: tasks.length, customers: customers.length, vendors: vendors.length };
}

export function startReminders() {
  const tick = () => runReminders().catch((err) => logger.error(`Reminder run failed: ${err.message}`));
  void tick();
  setInterval(tick, 60 * 60 * 1000).unref();
}
