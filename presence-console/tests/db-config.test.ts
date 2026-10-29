import { describe, expect, it } from "vitest";
import { poolConfig } from "@/lib/db/pg";

describe("configuration du pool PostgreSQL", () => {
  const url = "postgresql://postgres.ref:mot%40passe@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require";

  it("chiffre toujours une connexion distante et retire les paramètres TLS de l'URL", () => {
    const c = poolConfig(url, {});
    expect(c.ssl).toEqual({ rejectUnauthorized: false });
    expect(c.connectionString).not.toContain("sslmode");
    expect(c.connectionString).toContain("mot%40passe");
    expect(c.max).toBe(5);
  });

  it("vérifie le certificat quand l'autorité est fournie", () => {
    const c = poolConfig(url, { DATABASE_CA_CERT: "-----BEGIN CERTIFICATE-----\nAAA\n-----END CERTIFICATE-----" });
    expect(c.ssl).toMatchObject({ rejectUnauthorized: true });
  });

  it("laisse une base locale sans TLS, et respecte sslmode=disable", () => {
    expect(poolConfig("postgresql://u:p@localhost:5432/db", {}).ssl).toBe(false);
    expect(poolConfig("postgresql://u:p@db.interne:5432/db?sslmode=disable", {}).ssl).toBe(false);
  });

  it("convertit bigint et numeric en nombres, garde les dates calendaires en texte", () => {
    const types = poolConfig(url, {}).types as { getTypeParser: (oid: number, f?: string) => (v: string) => unknown };
    expect(types.getTypeParser(20)("2990")).toBe(2990);
    expect(types.getTypeParser(1700)("12.50")).toBe(12.5);
    expect(types.getTypeParser(1082)("2026-10-29")).toBe("2026-10-29");
  });
});
