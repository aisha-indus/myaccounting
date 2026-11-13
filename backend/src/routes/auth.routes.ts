import bcrypt from "bcrypt";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { execute, queryOne } from "../config/db";
import { env } from "../config/env";
import { authenticate, loadUser, signToken } from "../middleware/auth";
import { audit } from "../utils/audit";
import { HttpError, badRequest } from "../utils/http";
import { resetMail, sendMail, welcomeMail } from "../utils/mailer";

const router = Router();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// UM-02-06: lock the account for 15 minutes after 5 failed attempts.
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; lockedUntil: number }>();

router.post("/login", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) throw badRequest("Email and password are required.");

  const entry = attempts.get(email);
  if (entry && entry.lockedUntil > Date.now()) {
    const mins = Math.ceil((entry.lockedUntil - Date.now()) / 60000);
    throw new HttpError(423, `Too many failed attempts. Try again in ${mins} minute(s).`);
  }

  const row = await queryOne("SELECT id, password FROM users WHERE email = ?", [email]);
  const ok = row ? await bcrypt.compare(password, row.password) : false;
  if (!row || !ok) {
    const count = (entry && entry.lockedUntil <= Date.now() ? entry.count : 0) + 1;
    attempts.set(email, { count: count >= MAX_ATTEMPTS ? 0 : count, lockedUntil: count >= MAX_ATTEMPTS ? Date.now() + LOCK_MS : 0 });
    audit(req, "sign-in-failed", "users", row?.id, { email });
    throw new HttpError(401, "Incorrect email or password.");
  }
  attempts.delete(email);
  audit(req, "sign-in", "users", row.id, { email });
  res.json({ token: signToken(row.id), user: await loadUser(row.id) });
});

// UM-02-01: self registration always gets the default "client" role.
router.post("/register", async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!name) throw badRequest("Name is required.");
  if (!EMAIL.test(email)) throw badRequest("Enter a valid email address.");
  if (password.length < 8) throw badRequest("Password must be at least 8 characters.");
  if (await queryOne("SELECT id FROM users WHERE email = ?", [email])) throw new HttpError(409, "An account with this email already exists.");
  const role = await queryOne("SELECT id FROM roles WHERE role_name = 'client'");
  if (!role) throw new HttpError(500, "Default role 'client' is missing. Run the database seed.");
  const hash = await bcrypt.hash(password, 12);
  const result = await execute("INSERT INTO users (name, email, password, role_id) VALUES (?,?,?,?)", [name, email, hash, role.id]);
  void sendMail(email, "Welcome to IBMS", welcomeMail(name));
  res.status(201).json({ token: signToken(result.insertId), user: await loadUser(result.insertId) });
});

router.get("/me", authenticate, (req, res) => {
  res.json(req.user);
});

// UM-02-05: reset link valid for 60 minutes. The token is signed with the current
// password hash, so it stops working as soon as the password changes.
const resetSecret = (hash: string) => `${env.jwtSecret}.${hash}`;

router.post("/forgot-password", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const user = await queryOne("SELECT id, name, email, password FROM users WHERE email = ?", [email]);
  if (user) {
    const token = jwt.sign({ sub: user.id }, resetSecret(user.password), { expiresIn: "60m" });
    const link = `${env.clientUrl}/reset-password?token=${encodeURIComponent(token)}`;
    void sendMail(user.email, "Reset your IBMS password", resetMail(user.name, link));
  }
  // Same answer either way so the form cannot be used to discover registered emails.
  res.json({ message: "If that email is registered, a reset link has been sent." });
});

router.post("/reset-password", async (req, res) => {
  const token = String(req.body?.token || "");
  const password = String(req.body?.password || "");
  if (password.length < 8) throw badRequest("Password must be at least 8 characters.");
  const decoded = jwt.decode(token) as jwt.JwtPayload | null;
  const user = decoded?.sub ? await queryOne("SELECT id, password FROM users WHERE id = ?", [Number(decoded.sub)]) : undefined;
  if (!user) throw badRequest("This reset link is invalid or has expired.");
  try {
    jwt.verify(token, resetSecret(user.password));
  } catch {
    throw badRequest("This reset link is invalid or has expired.");
  }
  await execute("UPDATE users SET password = ? WHERE id = ?", [await bcrypt.hash(password, 12), user.id]);
  res.json({ message: "Password updated. You can sign in now." });
});

export default router;
