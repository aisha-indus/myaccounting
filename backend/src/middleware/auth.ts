import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { query, queryOne } from "../config/db";
import { HttpError, forbidden } from "../utils/http";

export type Level = "none" | "view" | "full";
const RANK: Record<Level, number> = { none: 0, view: 1, full: 2 };

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  permissions: string;
  /** What this user's role may do in each module (see MODULES). */
  access: Record<string, Level>;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/** Role groups used for the default access of each module (SRS 2.2 user classes). */
export const ROLES = {
  ADMIN: ["super-admin"],
  ACCOUNTING: ["super-admin", "finance"],
  ACCOUNTING_READ: ["super-admin", "finance", "manager"],
  TEAM: ["super-admin", "hr", "finance", "manager"],
  WORK: ["super-admin", "agent", "manager"],
};
const EVERYONE: string[] | undefined = undefined;

export interface ModuleDef {
  /** Same as the API path, e.g. "team-members". */
  key: string;
  label: string;
  group: string;
  /** Roles that can open the module by default. `undefined` = every signed-in user. */
  read: string[] | undefined;
  /** Roles that can add / edit / delete by default. */
  write: string[];
  /** Nothing can be edited here (history, journal, reports), so access is only "none" or "view". */
  readOnly?: boolean;
}

/**
 * Every module of the app with its default access. A super admin can override any of these
 * per role from Module Access (UM-03-03); overrides are stored in role_module_access.
 */
export const MODULES: ModuleDef[] = [
  { key: "projects", label: "Projects", group: "Task Management", read: EVERYONE, write: ROLES.WORK },
  { key: "tasks", label: "Tasks", group: "Task Management", read: EVERYONE, write: ROLES.WORK },
  { key: "task-history", label: "Task History", group: "Task Management", read: EVERYONE, write: [], readOnly: true },
  { key: "team-members", label: "Team Members", group: "Task Management", read: ROLES.TEAM, write: ["super-admin", "hr"] },
  { key: "skills", label: "Skills", group: "Task Management", read: ROLES.TEAM, write: ["super-admin", "hr"] },
  { key: "master-time-sheet", label: "Time Sheet", group: "Task Management", read: ROLES.TEAM, write: ["super-admin", "hr", "manager"] },
  { key: "master-pay-sheet", label: "Pay Sheet", group: "Task Management", read: ROLES.TEAM, write: ["super-admin", "finance", "hr"] },
  { key: "businesses", label: "Businesses", group: "Accounting", read: ROLES.ACCOUNTING_READ, write: ROLES.ACCOUNTING },
  { key: "customers", label: "Customers", group: "Accounting", read: ROLES.ACCOUNTING_READ, write: ROLES.ACCOUNTING },
  { key: "vendors", label: "Vendors", group: "Accounting", read: ROLES.ACCOUNTING_READ, write: ROLES.ACCOUNTING },
  { key: "invoices", label: "Invoices", group: "Accounting", read: ROLES.ACCOUNTING_READ, write: ROLES.ACCOUNTING },
  { key: "transactions", label: "Transactions", group: "Accounting", read: ROLES.ACCOUNTING_READ, write: ROLES.ACCOUNTING },
  { key: "ledger-accounts", label: "Ledger Accounts", group: "Accounting", read: ROLES.ACCOUNTING_READ, write: ROLES.ACCOUNTING },
  { key: "journal-entries", label: "Journal Entries", group: "Accounting", read: ROLES.ACCOUNTING_READ, write: [], readOnly: true },
  { key: "reports", label: "Reports", group: "Accounting", read: ROLES.ACCOUNTING_READ, write: [], readOnly: true },
  { key: "users", label: "Users", group: "User Management", read: ROLES.ADMIN, write: ROLES.ADMIN },
  { key: "roles", label: "Roles", group: "User Management", read: ROLES.ADMIN, write: ROLES.ADMIN },
  { key: "modules", label: "Modules", group: "User Management", read: ROLES.ADMIN, write: ROLES.ADMIN },
];

const defaultLevel = (m: ModuleDef, roleName: string): Level =>
  m.write.includes(roleName) ? "full" : !m.read || m.read.includes(roleName) ? "view" : "none";

/** Effective access of a role: built-in defaults with the saved overrides on top. A role with permissions "all" gets everything. */
export async function accessForRole(role: { id: number; role_name: string; permissions: string }): Promise<Record<string, Level>> {
  const isAll = role.permissions === "all";
  const access: Record<string, Level> = {};
  for (const m of MODULES) access[m.key] = isAll ? "full" : defaultLevel(m, role.role_name);
  if (isAll) return access;
  const overrides = await query("SELECT module_key, access FROM role_module_access WHERE role_id = ?", [role.id]);
  for (const o of overrides) if (o.module_key in access) access[o.module_key] = o.access as Level;
  return access;
}

export const signToken = (userId: number) =>
  jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: env.jwtExpiresIn as jwt.SignOptions["expiresIn"] });

export async function loadUser(id: number): Promise<AuthUser | undefined> {
  const user = await queryOne<Omit<AuthUser, "access">>(
    `SELECT u.id, u.name, u.email, u.role_id, r.role_name, r.permissions
     FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`,
    [id]
  );
  if (!user) return undefined;
  return { ...user, access: await accessForRole({ id: user.role_id, role_name: user.role_name, permissions: user.permissions }) };
}

/** Requires a valid JWT. The role and its access are re-read on every request so changes apply immediately. */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new HttpError(401, "Please sign in.");
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload;
  } catch {
    throw new HttpError(401, "Your session has expired. Please sign in again.");
  }
  const user = await loadUser(Number(payload.sub));
  if (!user) throw new HttpError(401, "Account no longer exists.");
  req.user = user;
  next();
}

export const hasRole = (user: AuthUser | undefined, roles: string[]) =>
  !!user && (user.permissions === "all" || roles.includes(user.role_name));

/** Allows the request only for the given roles. Used for the few things that are always admin-only. */
export const permit = (roles: string[]) => (req: Request, _res: Response, next: NextFunction) => {
  if (!hasRole(req.user, roles)) throw forbidden();
  next();
};

/** Whether the signed-in user has at least `level` in a module. */
export const can = (req: Request, moduleKey: string, level: Level) => RANK[req.user?.access[moduleKey] || "none"] >= RANK[level];

/** Allows the request only when the user's role has at least `level` in the module. */
export const allow = (moduleKey: string, level: Level) => (req: Request, _res: Response, next: NextFunction) => {
  if (!can(req, moduleKey, level)) throw forbidden(level === "view" ? "Your role does not have access to this module." : "Your role can view this module but not change it.");
  next();
};
