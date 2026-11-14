import app from "./app";
import { pool } from "./config/db";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { syncOpeningEquity, systemAccounts } from "./services/accounting";
import { startReminders } from "./services/reminders";

async function start() {
  try {
    await pool.query("SELECT 1");
    logger.info(`MySQL connected (${env.db.user}@${env.db.host}:${env.db.port}/${env.db.name})`);
  } catch (err) {
    logger.error(`Cannot connect to MySQL: ${(err as Error).message}`);
    logger.error("Check the DB_* values in .env, then run: npm run db:setup");
    process.exit(1);
  }
  // Make sure the control accounts exist and the opening balances are balanced before serving.
  try {
    await systemAccounts();
    await syncOpeningEquity();
  } catch (err) {
    logger.error(`Ledger check failed (run npm run db:setup if tables are missing): ${(err as Error).message}`);
  }
  // A Vercel function only runs while answering a request, so the hourly timer is skipped there.
  if (!env.serverless) startReminders();
  app.listen(env.port, () => logger.info(`IBMS API listening on http://localhost:${env.port}/api`));
}

void start();
