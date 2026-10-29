import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { idle } from "@/lib/action-result";
import { encodeSession, SESSION_COOKIE } from "@/lib/auth/session";
import { setupFixture, type Fixture } from "./helpers/fixture";
import { fakeAuth } from "./helpers/fake-auth";

/**
 * Actions serveur de bout en bout sur PGlite : session (cookie signé simulé),
 * permissions vérifiées côté serveur, écriture + audit dans la même transaction.
 */

const jar = vi.hoisted(() => ({ token: "" }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === "atie_session" && jar.token ? { value: jar.token } : undefined) }),
  headers: async () => new Headers({ host: "console.test.invalid", "x-forwarded-proto": "https" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

const { setOrganizationSuspended, inviteOrgUser } = await import("@/lib/actions/organizations");
const { createSupportRequest, updateVisitorRequestStatus, requestTopup } = await import("@/lib/actions/client");
const { addKnowledgeText } = await import("@/lib/actions/knowledge");

let f: Fixture;
let auth: ReturnType<typeof fakeAuth>;
beforeAll(async () => {
  f = await setupFixture();
  auth = fakeAuth();
});
afterAll(async () => {
  auth?.restore();
  await f?.close();
});

const signInAs = (fixtureUserId: string) => {
  jar.token = encodeSession({ uid: f.id(fixtureUserId), exp: Date.now() + 60_000 });
  expect(SESSION_COOKIE).toBe("atie_session");
};
const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};
const count = async (sql: string, params: unknown[] = []) => (await f.pg.query<{ n: number }>(`SELECT count(*)::int AS n FROM ${sql}`, params)).rows[0].n;

describe("actions du back-office", () => {
  it("refusent une action sensible à un opérateur, sans rien modifier", async () => {
    signInAs("usr_ops");
    const r = await setOrganizationSuspended({ id: f.id("org_lumiere"), suspend: "1" });
    expect(r).toEqual({ ok: false, message: "Action non autorisée pour ce rôle." });
    expect((await f.pg.query<{ s: string }>("SELECT status::text AS s FROM atie.organizations WHERE id = $1", [f.id("org_lumiere")])).rows[0].s).toBe("active");
  });

  it("refusent tout sans session", async () => {
    jar.token = "";
    const r = await setOrganizationSuspended({ id: f.id("org_lumiere"), suspend: "1" });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Session expirée/);
  });

  it("suspendent une entreprise avec audit dans la même transaction", async () => {
    signInAs("usr_admin");
    const before = await count("atie.audit_events WHERE action = 'organization.suspend'");
    const r = await setOrganizationSuspended({ id: f.id("org_rive"), suspend: "1" });
    expect(r.ok).toBe(true);
    const org = (await f.pg.query<{ s: string }>("SELECT status::text AS s FROM atie.organizations WHERE id = $1", [f.id("org_rive")])).rows[0];
    expect(org.s).toBe("suspended");
    expect(await count("atie.receptionists WHERE organization_id = $1 AND status = 'live'", [f.id("org_rive")])).toBe(0);
    expect(await count("atie.audit_events WHERE action = 'organization.suspend'")).toBe(before + 1);
  });

  it("enregistrent une source de Knowledge Base versionnée, en attente d'indexation", async () => {
    signInAs("usr_ops");
    const r = await addKnowledgeText(idle, form({ orgId: f.id("org_horizon"), title: "Horaires", category: "Accueil", content: "Ouvert du lundi au vendredi." }));
    expect(r.ok).toBe(true);
    const src = (await f.pg.query<{ id: string; s: string }>("SELECT id, index_status::text AS s FROM atie.knowledge_sources WHERE title = 'Horaires'")).rows[0];
    expect(src.s).toBe("pending");
    expect(await count("atie.knowledge_documents WHERE source_id = $1 AND version = 1", [src.id])).toBe(1);
  });

  it("invitent un utilisateur client : compte Supabase (clé service) puis lignes users + appartenance", async () => {
    signInAs("usr_admin");
    const r = await inviteOrgUser(idle, form({ organizationId: f.id("org_horizon"), fullName: "Paul Test", email: "Paul@Horizon.example", role: "org_viewer" }));
    expect(r).toMatchObject({ ok: true });
    const call = auth.calls.find((c) => c.path.startsWith("/invite"))!;
    expect(call.headers.authorization).toBe("Bearer cle-service-de-test");
    expect(call.path).toContain(encodeURIComponent("https://console.test.invalid/connexion/nouveau-mot-de-passe"));
    const u = (await f.pg.query<{ status: string; sub: string }>("SELECT status, idp_subject AS sub FROM atie.users WHERE email = 'paul@horizon.example'")).rows[0];
    expect(u.status).toBe("invited");
    expect(u.sub).toBe(auth.accountId("paul@horizon.example"));
    expect(await count("atie.organization_users m JOIN atie.users u ON u.id = m.user_id WHERE u.email = 'paul@horizon.example' AND m.organization_id = $1", [f.id("org_horizon")])).toBe(1);
    const dup = await inviteOrgUser(idle, form({ organizationId: f.id("org_horizon"), fullName: "Paul Test", email: "paul@horizon.example", role: "org_viewer" }));
    expect(dup.ok).toBe(false);
  });
});

describe("actions de l'espace client (rôle atie_app + RLS)", () => {
  it("créent une demande d'assistance pour l'entreprise de la session, avec audit", async () => {
    signInAs("usr_lumiere_admin");
    const r = await createSupportRequest(idle, form({ kind: "issue", subject: "Bulle invisible", message: "La bulle n'apparaît plus sur mobile." }));
    expect(r.ok).toBe(true);
    const row = (await f.pg.query<{ org: string }>("SELECT organization_id AS org FROM atie.support_requests WHERE subject = 'Bulle invisible'")).rows[0];
    expect(row.org).toBe(f.id("org_lumiere"));
    expect(await count("atie.audit_events WHERE action = 'support.create' AND organization_id = $1", [f.id("org_lumiere")])).toBe(1);
    expect(await count("atie.notifications WHERE organization_id IS NULL AND body = 'Bulle invisible'")).toBe(1);
  });

  it("ne modifient jamais une demande visiteur d'une autre entreprise", async () => {
    signInAs("usr_lumiere_admin");
    const foreign = f.data.visitorRequests.find((v) => v.organizationId === "org_chalet" && v.status === "new")!;
    const r = await updateVisitorRequestStatus(idle, form({ id: f.id(foreign.id), status: "archived" }));
    expect(r).toEqual({ ok: false, message: "Demande introuvable." });
    expect((await f.pg.query<{ s: string }>("SELECT status AS s FROM atie.visitor_requests WHERE id = $1", [f.id(foreign.id)])).rows[0].s).toBe("new");
  });

  it("refusent les écritures à un utilisateur en lecture seule", async () => {
    signInAs("usr_lumiere_view");
    const r = await createSupportRequest(idle, form({ kind: "issue", subject: "Lecture seule", message: "Je ne devrais pas pouvoir." }));
    expect(r.ok).toBe(false);
    expect(await count("atie.support_requests WHERE subject = 'Lecture seule'")).toBe(0);
  });

  it("n'acceptent qu'une recharge de la grille validée", async () => {
    signInAs("usr_chalet_admin");
    expect((await requestTopup(idle, form({ minutes: "50" }))).ok).toBe(false);
    const r = await requestTopup(idle, form({ minutes: "30" }));
    expect(r.ok).toBe(true);
    const t = (await f.pg.query<{ c: number }>("SELECT price_cents::int AS c FROM atie.minute_topups WHERE organization_id = $1 AND status = 'requested'", [f.id("org_chalet")])).rows;
    expect(t.map((x) => x.c)).toEqual([1900]);
  });
});
