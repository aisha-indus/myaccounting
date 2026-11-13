import nodemailer from "nodemailer";
import { env } from "../config/env";
import { logger } from "../config/logger";

const transporter = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
    })
  : null;

/** Sends an email. Never throws: a mail failure must not break the request that triggered it. */
export async function sendMail(to: string, subject: string, html: string) {
  if (!transporter) {
    logger.info(`[mail not sent - SMTP not configured] to=${to} subject="${subject}"`);
    return;
  }
  try {
    await transporter.sendMail({ from: env.smtp.from, to, subject, html });
  } catch (err) {
    logger.error(`Mail to ${to} failed: ${(err as Error).message}`);
  }
}

const wrap = (title: string, body: string) => `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;padding:24px;color:#0f172a">
    <h2 style="margin:0 0 12px">${title}</h2>
    <div style="font-size:14px;line-height:1.6">${body}</div>
    <p style="font-size:12px;color:#64748b;margin-top:24px">IBMS - Accounting &amp; Business Management System</p>
  </div>`;

export const welcomeMail = (name: string) =>
  wrap(`Welcome, ${name}`, `Your IBMS account is ready. <a href="${env.clientUrl}/login">Sign in</a> to get started.`);

export const resetMail = (name: string, link: string) =>
  wrap("Reset your password", `Hi ${name},<br>Use the link below to choose a new password. It is valid for 60 minutes.<br><br><a href="${link}">${link}</a>`);

export const taskAssignedMail = (name: string, task: string, deadline: string | null) =>
  wrap("New task assigned", `Hi ${name},<br>You have been assigned <b>${task}</b>${deadline ? ` (deadline ${deadline})` : ""}.<br><a href="${env.clientUrl}/tasks">Open tasks</a>`);

export const smtpConfigured = !!transporter;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A plain message written by a user (bulk customer email): escaped, line breaks kept. */
export const messageMail = (title: string, message: string) => wrap(escapeHtml(title), escapeHtml(message).replace(/\n/g, "<br>"));

export const taskDueMail = (name: string, task: string, deadline: string) =>
  wrap("Task due tomorrow", `Hi ${escapeHtml(name)},<br><b>${escapeHtml(task)}</b> is due on ${deadline}.<br><a href="${env.clientUrl}/tasks">Open tasks</a>`);

export const paymentDueMail = (name: string, amount: string, dueDate: string, from: string) =>
  wrap("Payment reminder", `Dear ${escapeHtml(name)},<br>This is a reminder that <b>${amount}</b> is due on ${dueDate}.<br><br>Thank you,<br>${escapeHtml(from)}`);

export const billDueMail = (name: string, vendor: string, amount: string, dueDate: string) =>
  wrap("Vendor payment due", `Hi ${escapeHtml(name)},<br><b>${amount}</b> is owed to <b>${escapeHtml(vendor)}</b>, due on ${dueDate}.<br><a href="${env.clientUrl}/vendors">Open vendors</a>`);
