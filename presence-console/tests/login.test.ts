import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { authenticate, AUTH_UNAVAILABLE, defineNewPassword, LOGIN_FAILED, loginLimiter } from "@/lib/auth/login";
import { createLimiter } from "@/lib/auth/rate-limit";
import { sendRecoveryEmail } from "@/lib/auth/supabase";
import { setupFixture, type Fixture } from "./helpers/fixture";
import { subjectFor } from "./helpers/db";
import { fakeAuth } from "./helpers/fake-auth";

let f: Fixture;
let auth: ReturnType<typeof fakeAuth>;
const PASSWORD = "MotDePasse-2026";

beforeAll(async () => {
  f = await setupFixture();
  auth = fakeAuth();
  // Comptes Supabase correspondant aux utilisateurs de la fixture (idp_subject).
  for (const u of f.data.users) auth.addAccount(u.email, subjectFor(u.id), PASSWORD);
});
afterAll(async () => {
  auth?.restore();
  await f?.close();
});
beforeEach(() => {
  auth.setDown(false);
});

describe("connexion par Supabase Auth", () => {
  it("ouvre l'accès d'un administrateur ATIE et révoque aussitôt la session Supabase", async () => {
    const r = await authenticate("Admin@ATIE.example", PASSWORD, "203.0.113.1");
    expect(r).toMatchObject({ ok: true, userId: f.id("usr_admin"), role: "atie_admin", atie: true, sessionMinutes: 30 });
    const grant = auth.calls.find((c) => c.path === "/token?grant_type=password")!;
    expect(grant.method).toBe("POST");
    expect(grant.headers.apikey).toBe("cle-anon-de-test");
    expect(grant.headers.authorization).toBeUndefined();
    expect(auth.calls.some((c) => c.path === "/logout")).toBe(true);
    expect(auth.activeTokens()).toBe(0);
    const last = await f.pg.query<{ last: string | null }>("SELECT last_login_at AS last FROM atie.users WHERE id = $1", [f.id("usr_admin")]);
    expect(last.rows[0].last).not.toBeNull();
    const ev = await f.pg.query<{ detail: string }>("SELECT detail FROM atie.audit_events WHERE action = 'auth.login' AND actor_id = $1", [f.id("usr_admin")]);
    expect(ev.rows).toHaveLength(1);
    expect(ev.rows[0].detail).not.toContain("203.0.113.1"); // empreinte, jamais l'IP en clair
  });

  it("résout un client vers son entreprise", async () => {
    const r = await authenticate("reception@chaletdulac.example", PASSWORD, "203.0.113.2");
    expect(r).toMatchObject({ ok: true, userId: f.id("usr_chalet_admin"), role: "org_admin", atie: false });
  });

  it("donne le même message générique pour un mauvais mot de passe, un compte inconnu ou sans accès console", async () => {
    expect(await authenticate("admin@atie.example", "faux", "203.0.113.3")).toEqual({ ok: false, error: LOGIN_FAILED });
    expect(await authenticate("personne@nulle-part.example", PASSWORD, "203.0.113.3")).toEqual({ ok: false, error: LOGIN_FAILED });
    // Compte Supabase valide mais absent de atie.users.
    auth.addAccount("intrus@exemple.example", "11111111-2222-4333-8444-555555555555", PASSWORD);
    expect(await authenticate("intrus@exemple.example", PASSWORD, "203.0.113.3")).toEqual({ ok: false, error: LOGIN_FAILED });
    // Compte invité (pas encore actif) et compte désactivé.
    expect(await authenticate("kanzlei@moser.example", PASSWORD, "203.0.113.4")).toEqual({ ok: false, error: LOGIN_FAILED });
    await f.pg.query("UPDATE atie.users SET status = 'disabled' WHERE id = $1", [f.id("usr_alpes_admin")]);
    expect(await authenticate("atelier@garagedesalpes.example", PASSWORD, "203.0.113.4")).toEqual({ ok: false, error: LOGIN_FAILED });
  });

  it("signale une indisponibilité sans rien révéler", async () => {
    auth.setDown(true);
    const r = await authenticate("admin@atie.example", PASSWORD, "203.0.113.5");
    expect(r).toEqual({ ok: false, error: AUTH_UNAVAILABLE });
  });

  it("bloque après 5 tentatives pour un couple IP + e-mail, sans bloquer les autres", async () => {
    for (let i = 0; i < 5; i++) await authenticate("operations@atie.example", "faux", "198.51.100.7");
    const blocked = await authenticate("operations@atie.example", PASSWORD, "198.51.100.7");
    expect(blocked.ok).toBe(false);
    expect(!blocked.ok && blocked.error).toMatch(/Trop de tentatives/);
    const other = await authenticate("operations@atie.example", PASSWORD, "198.51.100.8");
    expect(other.ok).toBe(true);
    loginLimiter.reset("198.51.100.7|operations@atie.example");
  });

  it("limite par fenêtre de temps", () => {
    const l = createLimiter({ max: 2, windowMs: 1000 });
    expect(l.hit("k", 0).allowed).toBe(true);
    expect(l.hit("k", 10).allowed).toBe(true);
    expect(l.hit("k", 20)).toEqual({ allowed: false, retryAfterMs: 980 });
    expect(l.hit("k", 1001).allowed).toBe(true);
  });
});

describe("mot de passe oublié et invitation", () => {
  it("envoie la demande de réinitialisation avec la clé anon et l'adresse de retour", async () => {
    expect(await sendRecoveryEmail("admin@atie.example", "https://console.test.invalid/connexion/nouveau-mot-de-passe")).toBe(true);
    const call = auth.calls.filter((c) => c.path.startsWith("/recover")).pop()!;
    expect(call.headers.apikey).toBe("cle-anon-de-test");
    expect(call.path).toContain(encodeURIComponent("https://console.test.invalid/connexion/nouveau-mot-de-passe"));
  });

  it("définit le mot de passe via token_hash, une seule fois", async () => {
    const subject = subjectFor("usr_admin");
    await sendRecoveryEmail("admin@atie.example", "https://console.test.invalid/x");
    expect(await defineNewPassword({ password: "NouveauMot2026", tokenHash: `hash-${subject}`, type: "recovery" })).toEqual({ ok: true });
    expect((await authenticate("admin@atie.example", "NouveauMot2026", "192.0.2.1")).ok).toBe(true);
    const again = await defineNewPassword({ password: "EncoreAutre2026", tokenHash: `hash-${subject}`, type: "recovery" });
    expect(again.ok).toBe(false);
  });

  it("active un compte invité quand il définit son mot de passe (jeton du fragment)", async () => {
    const subject = subjectFor("usr_moser_admin");
    auth.addAccount("kanzlei@moser.example", subject, "provisoire");
    const grant = await authenticate("kanzlei@moser.example", "provisoire", "192.0.2.2");
    expect(grant.ok).toBe(false); // encore « invited » dans atie.users
    // Jeton d'accès tel que le lien Supabase par défaut le place dans #access_token.
    await sendRecoveryEmail("kanzlei@moser.example", "https://console.test.invalid/x");
    const token = await (await import("@/lib/auth/supabase")).verifyEmailToken(`hash-${subject}`, "recovery");
    expect(token).toBeTruthy();
    expect(await defineNewPassword({ password: "Bienvenue2026", accessToken: token! })).toEqual({ ok: true });
    const st = await f.pg.query<{ status: string }>("SELECT status FROM atie.users WHERE id = $1", [f.id("usr_moser_admin")]);
    expect(st.rows[0].status).toBe("active");
    expect((await authenticate("kanzlei@moser.example", "Bienvenue2026", "192.0.2.2")).ok).toBe(true);
  });

  it("refuse un lien invalide", async () => {
    const r = await defineNewPassword({ password: "Valable2026", accessToken: "jeton-inconnu" });
    expect(r.ok).toBe(false);
  });
});
