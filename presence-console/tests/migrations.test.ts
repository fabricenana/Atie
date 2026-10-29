import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createTestDb, migration002 } from "./helpers/db";

let pg: PGlite;
beforeAll(async () => {
  pg = await createTestDb();
});
afterAll(async () => {
  await pg?.close();
});

const one = async <T>(sql: string, params: unknown[] = []) => (await pg.query<T>(sql, params)).rows[0];

describe("migrations 001 et 002", () => {
  it("créent les 24 tables métier dans « atie » (+ settings en 002), rien dans « public »", async () => {
    const r = await one<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'atie'");
    expect(r.n).toBe(25);
    const pub = await one<{ n: number }>("SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'");
    expect(pub.n).toBe(0);
  });

  it("insèrent la grille validée (4 formules)", async () => {
    const rows = (await pg.query<{ code: string; c: number; m: number }>("SELECT code, monthly_price_cents::int AS c, included_minutes AS m FROM atie.plans ORDER BY c")).rows;
    expect(rows).toEqual([
      { code: "starter", c: 1200, m: 15 },
      { code: "essentiel", c: 2990, m: 50 },
      { code: "premium", c: 8900, m: 150 },
      { code: "business", c: 24900, m: 450 },
    ]);
  });

  it("créent atie_app sans connexion ni contournement de la RLS, membre accordé à postgres", async () => {
    const r = await one<{ login: boolean; bypass: boolean; superuser: boolean }>(
      "SELECT rolcanlogin AS login, rolbypassrls AS bypass, rolsuper AS superuser FROM pg_roles WHERE rolname = 'atie_app'",
    );
    expect(r).toEqual({ login: false, bypass: false, superuser: false });
    const m = await one<{ ok: boolean }>("SELECT pg_has_role('postgres', 'atie_app', 'MEMBER') AS ok");
    expect(m.ok).toBe(true);
  });

  it("activent la RLS sur toutes les tables lues par un client", async () => {
    const rows = (await pg.query<{ relname: string }>(
      "SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'atie' AND c.relkind = 'r' AND NOT c.relrowsecurity ORDER BY 1",
    )).rows.map((r) => r.relname);
    // Seule table sans RLS : la consommation fournisseurs, jamais accordée à atie_app.
    expect(rows).toEqual(["provider_usage"]);
    for (const t of rows) {
      const g = await one<{ ok: boolean }>("SELECT has_table_privilege('atie_app', $1, 'SELECT') AS ok", [`atie.${t}`]);
      expect(g.ok, t).toBe(false);
    }
  });

  it("n'accordent rien à anon, authenticated ni PUBLIC", async () => {
    const tables = (await pg.query<{ t: string }>("SELECT 'atie.' || tablename AS t FROM pg_tables WHERE schemaname = 'atie'")).rows;
    for (const role of ["anon", "authenticated"]) {
      for (const { t } of tables) {
        const r = await one<{ ok: boolean }>("SELECT has_table_privilege($1, $2, 'SELECT,INSERT,UPDATE,DELETE') AS ok", [role, t]);
        expect(r.ok, `${role} ${t}`).toBe(false);
      }
      const s = await one<{ ok: boolean }>("SELECT has_schema_privilege($1, 'atie', 'USAGE') AS ok", [role]);
      expect(s.ok).toBe(false);
    }
  });

  it("ne donnent à atie_app ni coût fournisseur, ni identifiant de connexion, ni Knowledge Base", async () => {
    const col = async (t: string, c: string) =>
      (await one<{ ok: boolean }>("SELECT has_column_privilege('atie_app', $1, $2, 'SELECT') AS ok", [t, c])).ok;
    expect(await col("atie.conversations", "provider_cost_cents")).toBe(false);
    expect(await col("atie.conversations", "backend_session_id")).toBe(false);
    expect(await col("atie.conversations", "billable_seconds")).toBe(true);
    expect(await col("atie.users", "idp_subject")).toBe(false);
    expect(await col("atie.users", "email")).toBe(true);
    for (const t of ["knowledge_sources", "knowledge_documents", "payments", "settings", "audit_events", "conversation_events"]) {
      const r = await one<{ ok: boolean }>("SELECT has_table_privilege('atie_app', $1, 'SELECT') AS ok", [`atie.${t}`]);
      expect(r.ok, t).toBe(false);
    }
  });

  it("ajoutent les deux avatars existants (Léa, Maya)", async () => {
    const rows = (await pg.query<{ name: string }>("SELECT name FROM atie.avatars ORDER BY name")).rows.map((r) => r.name);
    expect(rows).toEqual(["Léa", "Maya"]);
  });

  it("002 est rejouable sans erreur ni doublon", async () => {
    await pg.exec(migration002());
    const r = await one<{ n: number }>("SELECT count(*)::int AS n FROM atie.avatars");
    expect(r.n).toBe(2);
    const p = await one<{ n: number }>("SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'atie'");
    expect(p.n).toBe(15 + 9);
  });
});
