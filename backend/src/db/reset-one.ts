import { execute, pool, query, queryOne } from "../config/db";

/**
 * Removes the sample rows and leaves a clean database with one sign-in user.
 * Roles and modules are kept: they are system setup (sign-in and registration depend on them).
 * Run with: npm run db:reset   (then add records from the app)
 */
async function reset() {
  const admin = await queryOne(
    "SELECT u.name, u.email, u.password, u.role_id FROM users u JOIN roles r ON r.id = u.role_id WHERE r.role_name = 'super-admin' ORDER BY u.id LIMIT 1"
  );
  if (!admin) throw new Error("No super-admin user found, nothing was changed.");

  const tables = [
    "invoice_items", "invoices",
    "journal_entries", "transactions", "customers", "vendors", "ledger_accounts", "businesses", "skills", "master_time_sheet",
    "master_pay_sheet", "team_members", "task_history", "tasks", "projects", "users",
  ];
  const conn = await pool.getConnection();
  try {
    await conn.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const t of tables) await conn.query(`TRUNCATE TABLE \`${t}\``);
    await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    conn.release();
  }
  // The same super-admin keeps the same email and password, now as user #1.
  await execute("INSERT INTO users SET ?", [admin]);
  const counts = await query("SELECT (SELECT COUNT(*) FROM users) AS users, (SELECT COUNT(*) FROM roles) AS roles, (SELECT COUNT(*) FROM modules) AS modules");
  console.log(`Sample data removed. Kept sign-in user ${admin.email}.`, counts[0]);
}

reset()
  .catch((err) => {
    console.error("Reset failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
