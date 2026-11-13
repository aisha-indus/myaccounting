import { Router } from "express";
import { execute, query, queryOne } from "../config/db";
import { allow } from "../middleware/auth";
import { computePay, computeTime, nowStr, today } from "../resources";
import { paySheetPostedSql, postPaySheet } from "../services/accounting";
import { badRequest, round2, toNum } from "../utils/http";

// ---------------------------------------------------------------- payroll
export const payroll = Router();

/** Creates a pay sheet row for every active team member for the given month (skips members already done). */
payroll.post("/generate", allow("master-pay-sheet", "full"), async (req, res) => {
  const raw = String(req.body?.month || "");
  if (!/^\d{4}-\d{2}/.test(raw)) throw badRequest("Month is required (YYYY-MM).");
  const month = `${raw.slice(0, 7)}-01`;
  const members = await query(
    `SELECT m.* FROM team_members m
     WHERE m.status = 'Active'
       AND NOT EXISTS (SELECT 1 FROM master_pay_sheet s WHERE s.team_member_id = m.id AND s.month = ?)`,
    [month]
  );
  for (const m of members) {
    // TM-03-04: standard hours = monthly hours, or weekly hours x weeks in the month.
    const standard = toNum(m.monthly_hours) || Math.round(toNum(m.weekly_hours) * 4.33);
    // Hours actually clocked on the time sheet that month drive regular and overtime hours.
    const sheet = await queryOne("SELECT COALESCE(SUM(total_hours),0) AS worked FROM master_time_sheet WHERE team_member_id = ? AND date BETWEEN ? AND LAST_DAY(?)", [m.id, month, month]);
    const worked = toNum(sheet?.worked);
    const regular = worked > 0 ? (standard ? Math.min(worked, standard) : worked) : standard;
    const overtime = worked > 0 && standard ? Math.max(0, worked - standard) : 0;
    const rate = toNum(m.hourly_rate);
    const row = {
      team_member_id: m.id,
      month,
      total_regular_hours: Math.round(regular),
      hourly_rate: rate,
      base_salary: m.salary !== null ? toNum(m.salary) : round2(regular * rate),
      overtime_hours: Math.round(overtime),
      overtime_rate: toNum(m.overtime_rate) || round2(rate * 1.5),
      bonus_comm: toNum(m.commissions),
      flat_rate: toNum(m.flat_rate),
      tax_withheld: 0,
      gratuity: 0,
      insurance: 0,
      other_deductions: 0,
    };
    const pay = { ...row, ...computePay(row) };
    const result = await execute("INSERT INTO master_pay_sheet SET ?", [pay]);
    await postPaySheet({ ...pay, id: result.insertId });
  }
  res.status(201).json({ created: members.length, month });
});

/** Posts every pay sheet row that is not in the ledger yet (rows created before automatic posting). */
payroll.post("/post", allow("master-pay-sheet", "full"), async (_req, res) => {
  const rows = await query(`SELECT s.* FROM master_pay_sheet s WHERE NOT ${paySheetPostedSql("s")} AND s.gross_payout > 0`);
  for (const row of rows) await postPaySheet(row);
  res.json({ posted: rows.length });
});

// ---------------------------------------------------------------- timesheet clock
export const timesheet = Router();

const myMember = (userId: number) => queryOne("SELECT * FROM team_members WHERE user_id = ? ORDER BY id LIMIT 1", [userId]);
const openEntry = (memberId: number) =>
  queryOne("SELECT * FROM master_time_sheet WHERE team_member_id = ? AND date = ? AND logout IS NULL ORDER BY id DESC LIMIT 1", [memberId, today()]);

/** Whether the signed-in user is linked to a team member, and whether they are clocked in right now. */
timesheet.get("/clock", async (req, res) => {
  const member = await myMember(req.user!.id);
  if (!member) return res.json({ linked: false, clockedIn: false });
  const open = await openEntry(member.id);
  res.json({ linked: true, clockedIn: !!open, since: open?.login || null });
});

/** TM-04-05: one button that clocks in, or clocks out if already clocked in today. */
timesheet.post("/clock", async (req, res) => {
  const member = await myMember(req.user!.id);
  if (!member) throw badRequest("Your user is not linked to a team member yet. Ask HR to link it.");
  const time = nowStr().slice(11);
  const open = await openEntry(member.id);
  if (open) {
    const calc = await computeTime({ ...open, logout: time });
    await execute("UPDATE master_time_sheet SET logout = ?, total_hours = ?, pay_value = ? WHERE id = ?", [time, calc.total_hours, calc.pay_value, open.id]);
    return res.json({ clockedIn: false, time });
  }
  await execute("INSERT INTO master_time_sheet (team_member_id, date, login) VALUES (?,?,?)", [member.id, today(), time]);
  res.status(201).json({ clockedIn: true, time });
});
