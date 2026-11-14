import fs from "fs";
import path from "path";
import mysql from "mysql2/promise";
import { env, sslOptions } from "../config/env";

/** Creates the database (if missing) and every table from database/schema.sql. Safe to re-run. */
async function migrate() {
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
    ssl: sslOptions(),
  });
  await conn.query(`CREATE DATABASE IF NOT EXISTS \`${env.db.name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await conn.query(`USE \`${env.db.name}\``);
  const schema = fs.readFileSync(path.resolve(process.cwd(), "database/schema.sql"), "utf8");
  await conn.query(schema);
  const [tables] = await conn.query("SHOW TABLES");
  console.log(`Database "${env.db.name}" is ready with ${(tables as unknown[]).length} tables.`);
  await conn.end();
}

migrate().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
