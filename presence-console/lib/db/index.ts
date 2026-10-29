import "server-only";
import { createPgDatabase } from "./pg";
import type { Database, Queryable, Row } from "./types";

export type { Database, Queryable, Row } from "./types";

/**
 * Accès à PostgreSQL (schéma « atie ») : deux portes d'entrée transactionnelles.
 *
 *  - withStaff : personnel ATIE. Rôle propriétaire (la RLS ne s'applique pas) ;
 *    les droits sont vérifiés AVANT, dans le code (assertPermission / requireAdmin).
 *  - withOrg : espace client. SET LOCAL ROLE atie_app + app.current_org_id = entreprise
 *    de la session : la RLS (db/migrations/002_app_role.sql) filtre réellement les lignes.
 *
 * Chaque appel ouvre sa propre transaction ; l'audit d'une action s'écrit dans la même.
 */

export class DatabaseUnavailableError extends Error {
  constructor() {
    super("Base de données non configurée (DATABASE_URL absente).");
  }
}

const g = globalThis as unknown as { __atieDb?: Database };

/** Base utilisée par l'application (créée à la première requête). */
export function getDatabase(): Database {
  if (g.__atieDb) return g.__atieDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new DatabaseUnavailableError();
  g.__atieDb = createPgDatabase(url);
  return g.__atieDb;
}

/** Remplace la base (tests uniquement). */
export function setDatabase(db: Database | undefined) {
  g.__atieDb = db;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const SEARCH_PATH = "SET LOCAL search_path = atie, extensions";

export function withStaff<T>(fn: (q: Queryable) => Promise<T>): Promise<T> {
  return getDatabase().transaction([SEARCH_PATH], fn);
}

export function withOrg<T>(orgId: string, fn: (q: Queryable) => Promise<T>): Promise<T> {
  // L'identifiant vient de la session serveur ; il est revalidé avant d'être inséré
  // dans l'instruction (SET n'accepte pas de paramètre lié).
  if (!isUuid(orgId)) return Promise.reject(new Error("Entreprise de session invalide."));
  return getDatabase().transaction(
    [SEARCH_PATH, "SET LOCAL ROLE atie_app", `SELECT set_config('app.current_org_id', '${orgId.toLowerCase()}', true)`],
    fn,
  );
}

// ---------------------------------------------------------------------------
// Lecture des lignes : dates en ISO 8601, entiers 64 bits en nombres.
// ---------------------------------------------------------------------------

function normalize(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return Number(v);
  return v;
}

export async function rows<R = Row>(q: Queryable, sql: string, params: unknown[] = []): Promise<R[]> {
  const res = await q.query(sql, params);
  return res.rows.map((r) => {
    const out: Row = {};
    for (const k of Object.keys(r)) out[k] = normalize(r[k]);
    return out as R;
  });
}

export async function one<R = Row>(q: Queryable, sql: string, params: unknown[] = []): Promise<R | null> {
  return (await rows<R>(q, sql, params))[0] ?? null;
}

/** Ajoute une entrée au journal d'audit, dans la transaction en cours. Jamais de secret. */
export async function audit(
  q: Queryable,
  actorId: string | null,
  organizationId: string | null,
  action: string,
  target: string,
  detail = "",
) {
  await q.query(
    "INSERT INTO audit_events (organization_id, actor_id, action, target, detail) VALUES ($1, $2, $3, $4, $5)",
    [organizationId, actorId, action, target.slice(0, 300), detail.slice(0, 500)],
  );
}

/** Code SQLSTATE d'une erreur PostgreSQL (23505 : doublon, 23503 : clé étrangère…). */
export function pgCode(e: unknown): string | undefined {
  return typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : undefined;
}
