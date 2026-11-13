import { Router } from "express";
import { execute, query } from "../config/db";
import { Level, MODULES, ROLES, accessForRole, permit } from "../middleware/auth";
import { audit } from "../utils/audit";
import { badRequest, notFound } from "../utils/http";

// ---------------------------------------------------------------- module access (UM-03-03)
const router = Router();
router.use(permit(ROLES.ADMIN));

/** The whole matrix: every module, and what each role may currently do in it. */
router.get("/", async (_req, res) => {
  const roles = await query("SELECT id, role_name, permissions FROM roles ORDER BY id");
  res.json({
    modules: MODULES.map(({ key, label, group, readOnly }) => ({ key, label, group, readOnly: !!readOnly })),
    roles: await Promise.all(
      roles.map(async (r) => ({
        id: r.id,
        role_name: r.role_name,
        // A role with permissions "all" (super-admin) always has everything and cannot be restricted.
        locked: r.permissions === "all",
        access: await accessForRole(r as { id: number; role_name: string; permissions: string }),
      }))
    ),
  });
});

/** Turns a module off, to view-only, or fully on for one role. Applies on that role's next request. */
router.put("/", async (req, res) => {
  const roleId = Number(req.body?.role_id);
  const moduleKey = String(req.body?.module_key || "");
  const access = String(req.body?.access || "") as Level;
  const mod = MODULES.find((m) => m.key === moduleKey);
  if (!mod) throw badRequest("Unknown module.");
  if (!["none", "view", "full"].includes(access)) throw badRequest("Access must be none, view or full.");
  if (mod.readOnly && access === "full") throw badRequest(`${mod.label} can only be viewed, so choose View or No access.`);
  const [role] = await query("SELECT id, role_name, permissions FROM roles WHERE id = ?", [roleId]);
  if (!role) throw notFound("Role");
  if (role.permissions === "all") throw badRequest("This role has full access to everything and cannot be restricted.");
  await execute("INSERT INTO role_module_access (role_id, module_key, access) VALUES (?,?,?) ON DUPLICATE KEY UPDATE access = VALUES(access)", [roleId, moduleKey, access]);
  audit(req, "module-access", "roles", roleId, { module: moduleKey, access });
  res.json({ role_id: roleId, module_key: moduleKey, access });
});

/** Puts one role back to the built-in defaults. */
router.delete("/:roleId", async (req, res) => {
  await execute("DELETE FROM role_module_access WHERE role_id = ?", [Number(req.params.roleId)]);
  audit(req, "module-access-reset", "roles", Number(req.params.roleId));
  res.status(204).end();
});

export default router;

// ---------------------------------------------------------------- dropdown lookups
/**
 * Forms need names for dropdowns (assign a task to a user, pick a ledger account...) even when the
 * user's role cannot open that module. These return only the id and the few columns a label needs.
 */
const LOOKUPS: Record<string, string> = {
  users: "SELECT u.id, u.name, r.role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id ORDER BY u.name",
  roles: "SELECT id, role_name FROM roles ORDER BY id",
  projects: "SELECT id, project_name FROM projects ORDER BY project_name",
  "team-members": "SELECT id, first_name, middle_name, surname FROM team_members ORDER BY first_name",
  businesses: "SELECT id, business_name FROM businesses ORDER BY business_name",
  customers: "SELECT id, contact_name, business_name FROM customers ORDER BY contact_name",
  vendors: "SELECT id, contact_name, business_name FROM vendors ORDER BY contact_name",
  "ledger-accounts": "SELECT id, account_code, name, account_type FROM ledger_accounts ORDER BY account_code",
};

export const lookups = Router();
lookups.get("/:resource", async (req, res) => {
  const sql = LOOKUPS[String(req.params.resource)];
  if (!sql) throw notFound("Lookup");
  res.json(await query(sql));
});
