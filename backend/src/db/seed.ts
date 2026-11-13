import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import { execute, pool, queryOne } from "../config/db";
import { env } from "../config/env";
import { saveTransaction } from "../services/accounting";

type Rows = Record<string, any>[];

/**
 * Loads the sample rows from the documentation spreadsheet (database/seed-data.json).
 * The sheet's sample foreign keys to ledger accounts (101, 201, ...) do not exist in its
 * own ledger_accounts sample, so those are mapped to real accounts below.
 */
async function seed() {
  if (!env.seedPassword || env.seedPassword.length < 8) {
    throw new Error("Set SEED_PASSWORD (8+ characters) in .env first. Every sample user gets this password.");
  }
  if ((await queryOne("SELECT COUNT(*) AS n FROM roles"))?.n) {
    throw new Error("The database already has data. Seed only runs on an empty database.");
  }

  const data: Record<string, Rows> = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "database/seed-data.json"), "utf8"));
  const insert = async (table: string, rows: Rows) => {
    for (const row of rows) await execute(`INSERT INTO \`${table}\` SET ?`, [row]);
    console.log(`  ${table}: ${rows.length}`);
  };

  const hash = await bcrypt.hash(env.seedPassword, 12);
  const ledgerCodes = data.ledger_accounts.map((a) => ({ ...a, account_code: String(a.account_code) }));

  await insert("roles", data.roles);
  await insert("modules", data.modules);
  await insert("users", data.users.map((u) => ({ ...u, password: hash })));
  await insert("projects", data.projects);
  await insert("tasks", data.tasks);
  await insert("task_history", data.task_history);
  await insert("team_members", data.team_members);
  await insert("master_pay_sheet", data.master_pay_sheet);
  await insert("master_time_sheet", data.master_time_sheet);
  await insert("skills", data.skills);
  await insert("businesses", data.businesses.map((b) => ({ ...b, ext: b.ext === null ? null : String(b.ext), account_no: String(b.account_no) })));
  await insert("ledger_accounts", ledgerCodes);
  await insert("customers", data.customers.map((c) => ({ ...c, linked_ledger_account_id: 2 }))); // Accounts Receivable
  await insert("vendors", data.vendors.map((v) => ({ ...v, linked_ledger_account_id: 4 }))); // Accounts Payable

  // Transactions go through the real service so their journal entries are generated, not copied.
  // Account per sample transaction id, matching the journal_entries sample in the sheet.
  const accountFor: Record<number, number> = { 3: 7, 5: 8, 7: 3, 9: 9 };
  for (const t of data.transactions) {
    await saveTransaction(
      {
        type: t.type,
        date: String(t.date).slice(0, 10),
        customer_id: t.customer_id,
        vendor_id: t.vendor_id,
        for_what: t.for_what,
        ledger_account_id: t.type === "money_in" ? 6 : accountFor[t.id] ?? 7,
        amount_now: t.amount_now,
        amount_later: t.amount_later,
      },
      undefined,
      { skipTypeCheck: true, skipPartyUpdate: true }
    );
  }
  console.log(`  transactions: ${data.transactions.length} (+ journal entries)`);

  console.log("\nSeed complete. Sign in with any sample user, e.g. bob@example.com (super-admin), using SEED_PASSWORD.");
}

seed()
  .catch((err) => {
    console.error("Seed failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
