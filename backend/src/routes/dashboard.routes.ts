import { Router } from "express";
import { query, queryOne } from "../config/db";
import { can } from "../middleware/auth";
import { seesOwnWorkOnly } from "../resources";

const router = Router();

/** One call that feeds every dashboard widget. Finance figures are only included for roles allowed to see them. */
router.get("/", async (req, res) => {
  const finance = can(req, "transactions", "view");
  // Interns, contractors and clients only see their own tasks and the projects those belong to.
  const mine = seesOwnWorkOnly(req);
  const me = req.user!.id;
  const projectWhere = mine ? "WHERE (created_by = ? OR id IN (SELECT project_id FROM tasks WHERE assigned_to = ?))" : "";
  const projectParams = mine ? [me, me] : [];

  const [projectStats, taskStats, teamStats] = await Promise.all([
    queryOne(
      `SELECT COUNT(*) AS total,
              COALESCE(SUM(percent_completed >= 100),0) AS completed,
              COALESCE(SUM(percent_completed < 100 AND deadline < CURDATE()),0) AS overdue,
              COALESCE(SUM(percent_completed < 100 AND (deadline IS NULL OR deadline >= CURDATE())),0) AS active
       FROM projects ${projectWhere}`,
      projectParams
    ),
    query(`SELECT status, COUNT(*) AS count FROM tasks ${mine ? "WHERE assigned_to = ?" : ""} GROUP BY status`, mine ? [me] : []),
    queryOne("SELECT COUNT(*) AS total, COALESCE(SUM(status = 'Active'),0) AS active FROM team_members"),
  ]);

  const projects = await query(
    `SELECT id, project_name, type, deadline, percent_completed, running_cost, estimated_cost
     FROM projects ${projectWhere} ORDER BY (percent_completed >= 100), deadline IS NULL, deadline LIMIT 6`,
    projectParams
  );

  const pendingTasks = await query(
    `SELECT t.id, t.task_name, t.status, t.deadline, t.department, p.project_name, u.name AS assigned_to_name
     FROM tasks t LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN users u ON u.id = t.assigned_to
     WHERE t.status <> 'Completed' ${mine ? "AND t.assigned_to = ?" : ""} ORDER BY t.deadline IS NULL, t.deadline LIMIT 6`,
    mine ? [me] : []
  );

  let money = null;
  if (finance) {
    const [totals, cash, monthly, recent] = await Promise.all([
      queryOne(
        `SELECT COALESCE(SUM(CASE WHEN type='money_in'  THEN amount_now END),0)   AS money_in,
                COALESCE(SUM(CASE WHEN type='money_out' THEN amount_now END),0)   AS money_out
         FROM transactions`
      ),
      queryOne(
        `SELECT COALESCE(SUM(l.start_balance),0)
                + COALESCE((SELECT SUM(j.debit_amount - j.credit_amount) FROM journal_entries j
                            JOIN ledger_accounts c ON c.id = j.account_id WHERE c.sub_type = 'Cash/Bank'),0) AS balance
         FROM ledger_accounts l WHERE l.sub_type = 'Cash/Bank'`
      ),
      query(
        `SELECT DATE_FORMAT(date, '%Y-%m') AS month,
                COALESCE(SUM(CASE WHEN type='money_in'  THEN amount_now END),0) AS money_in,
                COALESCE(SUM(CASE WHEN type='money_out' THEN amount_now END),0) AS money_out
         FROM transactions GROUP BY month ORDER BY month DESC LIMIT 6`
      ),
      query("SELECT id, type, date, party_name, for_what, amount_now, amount_later, status FROM transactions ORDER BY date DESC, id DESC LIMIT 6"),
    ]);
    // What customers still owe us / we still owe vendors, straight from their running balances.
    const dues = await queryOne(
      "SELECT (SELECT COALESCE(SUM(amount_owed),0) FROM customers) AS receivable, (SELECT COALESCE(SUM(amount_owed),0) FROM vendors) AS payable"
    );
    money = { ...totals, ...dues, cash_balance: cash?.balance ?? 0, monthly: monthly.reverse(), recent };
  }

  res.json({ projectStats, taskStats, teamStats, projects, pendingTasks, money });
});

export default router;
