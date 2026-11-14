import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { pool } from "../config/db";

/**
 * Copies this PC's database into the online (cloud) MySQL, so the deployed app has the same
 * users, accounts and records. Reads the online connection from backend/.env.cloud.
 *
 *   npm run db:copy-to-cloud
 *
 * Creates the tables online if missing. Stops without changing anything if the online
 * database already has users, so it can never overwrite live data.
 */
const TABLES = [
  "roles", "modules", "users", "projects", "tasks", "task_history", "team_members", "master_pay_sheet", "master_time_sheet",
  "skills", "businesses", "ledger_accounts", "customers", "vendors", "transactions", "journal_entries", "invoices",
  "invoice_items", "role_module_access",
];

async function copy() {
  const file = path.resolve(process.cwd(), ".env.cloud");
  if (!fs.existsSync(file)) throw new Error("backend/.env.cloud not found. Copy .env.cloud.example to .env.cloud and fill in the online database details.");
  const cloud = dotenv.parse(fs.readFileSync(file));
  for (const key of ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"]) {
    if (!cloud[key]) throw new Error(`${key} is empty in .env.cloud.`);
  }
  const ca = (cloud.DB_SSL_CA || "").replace(/\\n/g, "\n").trim();

  const target = await mysql.createConnection({
    host: cloud.DB_HOST,
    port: Number(cloud.DB_PORT),
    user: cloud.DB_USER,
    password: cloud.DB_PASSWORD,
    multipleStatements: true,
    dateStrings: true,
    ssl: cloud.DB_SSL === "false" ? undefined : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false },
  });
  console.log(`Connected to ${cloud.DB_HOST}`);

  try {
    await target.query(`CREATE DATABASE IF NOT EXISTS \`${cloud.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await target.query(`USE \`${cloud.DB_NAME}\``);
    await target.query(fs.readFileSync(path.resolve(process.cwd(), "database/schema.sql"), "utf8"));
    console.log("Tables are ready online.");

    const [[{ n }]] = (await target.query("SELECT COUNT(*) AS n FROM users")) as any;
    if (n > 0) throw new Error(`The online database already has ${n} user(s). Nothing was copied, so no online data was overwritten.`);

    await target.query("SET FOREIGN_KEY_CHECKS = 0");
    for (const table of TABLES) {
      const [rows] = (await pool.query(`SELECT * FROM \`${table}\``)) as any;
      for (const row of rows) await target.query(`INSERT INTO \`${table}\` SET ?`, [row]);
      console.log(`  ${table}: ${rows.length}`);
    }
    await target.query("SET FOREIGN_KEY_CHECKS = 1");
    console.log("\nDone. The online database now matches this PC. Sign in online with the same email and password.");
  } finally {
    await target.end();
  }
}

copy()
  .catch((err) => {
    console.error("Copy failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
