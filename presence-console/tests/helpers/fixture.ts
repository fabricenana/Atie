import type { PGlite } from "@electric-sql/pglite";
import { setDatabase } from "@/lib/db";
import { runInScope, type Scope } from "@/lib/db/scope";
import { buildSeed, type Dataset } from "../fixtures/seed";
import { createTestDb, loadFixture, useTestDb } from "./db";

/** Base PGlite migrée + jeu de données de test, branchée sur l'application. */
export interface Fixture {
  pg: PGlite;
  data: Dataset;
  /** Identifiant de la fixture (org_lumiere…) → UUID en base. */
  id: (fixtureId: string) => string;
  staff: <T>(fn: () => Promise<T>) => Promise<T>;
  asOrg: <T>(fixtureOrgId: string, fn: () => Promise<T>) => Promise<T>;
  close: () => Promise<void>;
}

export async function setupFixture(now = new Date()): Promise<Fixture> {
  const pg = await createTestDb();
  const data = buildSeed(now);
  const id = await loadFixture(pg, data);
  useTestDb(pg);
  const run = <T>(scope: Scope, fn: () => Promise<T>) => runInScope(scope, fn);
  return {
    pg,
    data,
    id,
    staff: (fn) => run({ kind: "staff" }, fn),
    asOrg: (orgId, fn) => run({ kind: "org", orgId: id(orgId) }, fn),
    close: async () => {
      setDatabase(undefined);
      await pg.close();
    },
  };
}
