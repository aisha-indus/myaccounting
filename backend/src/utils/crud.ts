import { Request, RequestHandler, Router } from "express";
import { Row, execute, query, queryOne } from "../config/db";
import { allow, can } from "../middleware/auth";
import { audit } from "./audit";
import { badRequest, forbidden, notFound } from "./http";

export interface Ctx {
  req: Request;
  isCreate: boolean;
  id?: number;
  existing?: Row;
}

export interface ResourceDef {
  /** Table name, exactly as in the documentation sheet. */
  table: string;
  label: string;
  /** Columns a client is allowed to write. Anything else in the body is ignored. */
  columns: string[];
  required?: string[];
  /** SELECT used for lists and single reads (may join display names). Must expose `id`. */
  listSql?: string;
  orderBy?: string;
  readOnly?: boolean;
  /** Columns never returned to the client. */
  hide?: string[];
  /** Extra middleware for create/update (e.g. multer). */
  writeMiddleware?: RequestHandler[];
  /** Lets a user outside `write` update a specific row (e.g. a task assignee). */
  canUpdate?: (req: Request, existing: Row) => boolean;
  beforeSave?: (data: Row, ctx: Ctx) => Promise<void> | void;
  afterSave?: (row: Row, ctx: Ctx) => Promise<void> | void;
  beforeDelete?: (existing: Row, req: Request) => Promise<void> | void;
  afterDelete?: (existing: Row, req: Request) => Promise<void> | void;
  mapRow?: (row: Row) => Row;
  /** Limits which rows a user may read (e.g. an intern only sees their own tasks). Return nothing for no limit. */
  scope?: (req: Request) => { where: string; params: any[] } | undefined;
}

/** Picks whitelisted columns from the body; "" becomes NULL, booleans become 0/1. */
export function pickColumns(def: ResourceDef, body: Row = {}): Row {
  const data: Row = {};
  for (const col of def.columns) {
    let v = body[col];
    if (v === undefined) continue;
    if (typeof v === "string") {
      v = v.trim();
      if (v === "" || v === "null" || v === "undefined") v = null;
      else if (v === "true") v = 1;
      else if (v === "false") v = 0;
    }
    if (typeof v === "boolean") v = v ? 1 : 0;
    data[col] = v;
  }
  return data;
}

export function reader(def: ResourceDef) {
  const base = def.listSql || `SELECT * FROM \`${def.table}\``;
  const shape = (row: Row) => {
    for (const h of def.hide || []) delete row[h];
    return def.mapRow ? def.mapRow(row) : row;
  };
  return {
    all: async (req?: Request) => {
      const s = req && def.scope?.(req);
      return (await query(`SELECT * FROM (${base}) x ${s ? `WHERE ${s.where}` : ""} ORDER BY ${def.orderBy || "id DESC"}`, s ? s.params : [])).map(shape);
    },
    one: async (id: number, req?: Request) => {
      const s = req && def.scope?.(req);
      const row = await queryOne(`SELECT * FROM (${base}) x WHERE id = ?${s ? ` AND (${s.where})` : ""}`, [id, ...(s ? s.params : [])]);
      return row ? shape(row) : undefined;
    },
  };
}

/** `moduleKey` decides who may read (view) and write (full); see MODULES in middleware/auth.ts. */
export function crudRouter(def: ResourceDef, moduleKey: string): Router {
  const router = Router();
  const read = reader(def);
  const guardRead: RequestHandler[] = [allow(moduleKey, "view")];

  const rawById = async (id: number) => {
    const row = await queryOne(`SELECT * FROM \`${def.table}\` WHERE id = ?`, [id]);
    if (!row) throw notFound(def.label);
    return row;
  };
  const idOf = (req: Request) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) throw badRequest("Invalid id.");
    return id;
  };

  router.get("/", ...guardRead, async (req, res) => {
    res.json(await read.all(req));
  });

  router.get("/:id", ...guardRead, async (req, res) => {
    const row = await read.one(idOf(req), req);
    if (!row) throw notFound(def.label);
    res.json(row);
  });

  if (def.readOnly) return router;

  router.post("/", allow(moduleKey, "full"), ...(def.writeMiddleware || []), async (req, res) => {
    const data = pickColumns(def, req.body);
    const ctx: Ctx = { req, isCreate: true };
    await def.beforeSave?.(data, ctx);
    const missing = (def.required || []).filter((c) => data[c] === undefined || data[c] === null);
    if (missing.length) throw badRequest(`Required: ${missing.join(", ")}`, { fields: missing });
    const result = await execute(`INSERT INTO \`${def.table}\` SET ?`, [data]);
    const row = (await read.one(result.insertId))!;
    await def.afterSave?.(await rawById(result.insertId), { ...ctx, id: result.insertId });
    audit(req, "create", def.table, result.insertId);
    res.status(201).json(row);
  });

  router.put("/:id", ...(def.writeMiddleware || []), async (req, res) => {
    const id = idOf(req);
    const existing = await rawById(id);
    if (!can(req, moduleKey, "full") && !def.canUpdate?.(req, existing)) throw forbidden();
    const data = pickColumns(def, req.body);
    const ctx: Ctx = { req, isCreate: false, id, existing };
    await def.beforeSave?.(data, ctx);
    const blank = (def.required || []).filter((c) => c in data && data[c] === null);
    if (blank.length) throw badRequest(`Required: ${blank.join(", ")}`, { fields: blank });
    if (Object.keys(data).length) await execute(`UPDATE \`${def.table}\` SET ? WHERE id = ?`, [data, id]);
    await def.afterSave?.(await rawById(id), ctx);
    audit(req, "update", def.table, id, { fields: Object.keys(data).filter((k) => k !== "password") });
    res.json(await read.one(id));
  });

  router.delete("/:id", allow(moduleKey, "full"), async (req, res) => {
    const id = idOf(req);
    const existing = await rawById(id);
    await def.beforeDelete?.(existing, req);
    await execute(`DELETE FROM \`${def.table}\` WHERE id = ?`, [id]);
    await def.afterDelete?.(existing, req);
    audit(req, "delete", def.table, id);
    res.status(204).end();
  });

  return router;
}
