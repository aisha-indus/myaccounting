import mysql from "mysql2/promise";
import { env, sslOptions } from "./env";

// dateStrings keeps DATE/DATETIME as plain "YYYY-MM-DD" strings (no timezone shifting),
// decimalNumbers returns DECIMAL(15,2) columns as JS numbers.
export const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  ssl: sslOptions(),
  decimalNumbers: true,
});

export type Row = Record<string, any>;

export async function query<T = Row>(sql: string, params: any[] = []): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

export async function queryOne<T = Row>(sql: string, params: any[] = []): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

export async function execute(sql: string, params: any[] = []) {
  const [result] = await pool.query(sql, params);
  return result as mysql.ResultSetHeader;
}

/** Runs `fn` inside a MySQL transaction (SRS 2.4: accounting entries must be transactional). */
export async function withTransaction<T>(fn: (conn: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
