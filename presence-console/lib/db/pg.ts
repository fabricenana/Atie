import "server-only";
import { readFileSync } from "node:fs";
import { Pool, types, type PoolConfig } from "pg";
import type { Database, Queryable } from "./types";

/**
 * Connexion PostgreSQL (node-postgres) : un pool par processus, transactions explicites.
 * DATABASE_URL vise le pooler de session Supabase (port 5432) : SET LOCAL ROLE et
 * set_config(..., true) restent attachés à la transaction en cours.
 * L'URL n'est jamais journalisée.
 */

const INT8 = 20;
const NUMERIC = 1700;
const DATE = 1082;

/** Entiers 64 bits (centimes, compteurs) et numeric en nombres JS ; dates calendaires en texte. */
const typeParsers = {
  getTypeParser(oid: number, format?: "text" | "binary") {
    if (oid === INT8 || oid === NUMERIC) return (v: string) => Number(v);
    if (oid === DATE) return (v: string) => v;
    // `format` est toujours « text » en pratique (pas de protocole binaire ici).
    return types.getTypeParser(oid, format ?? "text");
  },
};

/**
 * Configuration du pool à partir de DATABASE_URL.
 * TLS : obligatoire hors machine locale. Avec DATABASE_CA_CERT (PEM) ou sslrootcert=<fichier>,
 * le certificat du serveur est vérifié ; sinon la connexion est chiffrée sans vérification
 * de l'autorité (certificat Supabase hors magasin système).
 */
export function poolConfig(url: string, env: Record<string, string | undefined> = process.env): PoolConfig {
  const u = new URL(url);
  const sslmode = u.searchParams.get("sslmode");
  const rootcert = u.searchParams.get("sslrootcert");
  for (const k of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) u.searchParams.delete(k);
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);

  let ssl: PoolConfig["ssl"];
  const ca = env.DATABASE_CA_CERT || (rootcert && rootcert !== "system" ? readFileSync(rootcert, "utf8") : "");
  if (sslmode === "disable" || (local && !sslmode)) ssl = false;
  else if (ca) ssl = { ca, rejectUnauthorized: true };
  else ssl = { rejectUnauthorized: false };

  const max = Number(env.DATABASE_POOL_MAX ?? 5);
  return {
    connectionString: u.toString(),
    ssl,
    max: Number.isInteger(max) && max > 0 ? max : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    application_name: "atie-console",
    types: typeParsers,
  };
}

export function createPgDatabase(url: string): Database {
  const pool = new Pool(poolConfig(url));
  // Une connexion inactive coupée par le serveur ne doit pas faire tomber le processus.
  pool.on("error", () => undefined);
  return {
    async transaction(setup, fn) {
      const client = await pool.connect();
      let broken: Error | undefined;
      try {
        await client.query("BEGIN");
        for (const sql of setup) await client.query(sql);
        const result = await fn(client as unknown as Queryable);
        await client.query("COMMIT");
        return result;
      } catch (e) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          broken = rollbackError as Error;
        }
        throw e;
      } finally {
        client.release(broken);
      }
    },
  };
}
