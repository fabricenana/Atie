import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decodeSession, encodeSession, resolveViewer } from "@/lib/auth/session";
import { setupFixture, type Fixture } from "./helpers/fixture";

describe("session signée", () => {
  const exp = Date.now() + 60_000;

  it("décode un jeton valide", () => {
    expect(decodeSession(encodeSession({ uid: "usr_admin", exp }))).toEqual({ uid: "usr_admin", exp });
  });

  it("rejette un jeton expiré", () => {
    expect(decodeSession(encodeSession({ uid: "usr_admin", exp: Date.now() - 1 }))).toBeNull();
  });

  it("rejette un jeton falsifié (changement d'utilisateur)", () => {
    const token = encodeSession({ uid: "usr_lumiere_admin", exp });
    const [, sig] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ uid: "usr_super", exp })).toString("base64url")}.${sig}`;
    expect(decodeSession(forged)).toBeNull();
    expect(decodeSession("n'importe.quoi")).toBeNull();
    expect(decodeSession(undefined)).toBeNull();
  });
});

describe("résolution de l'utilisateur depuis la base", () => {
  let f: Fixture;
  const exp = Date.now() + 60_000;
  beforeAll(async () => {
    f = await setupFixture();
  });
  afterAll(async () => {
    await f?.close();
  });

  it("résout l'entreprise du client depuis son appartenance, jamais depuis la requête", async () => {
    const v = (await resolveViewer(f.id("usr_chalet_admin"), exp))!;
    expect(v.role).toBe("org_admin");
    expect(v.organization?.id).toBe(f.id("org_chalet"));
    const viewer = (await resolveViewer(f.id("usr_lumiere_view"), exp))!;
    expect(viewer.role).toBe("org_viewer");
    expect(viewer.organization?.id).toBe(f.id("org_lumiere"));
  });

  it("refuse un utilisateur inconnu, non actif ou un identifiant mal formé", async () => {
    expect(await resolveViewer(f.id("usr_inexistant"), exp)).toBeNull();
    expect(await resolveViewer(f.id("usr_moser_admin"), exp)).toBeNull(); // invité, pas encore actif
    expect(await resolveViewer("usr_admin", exp)).toBeNull();
  });

  it("donne un rôle ATIE sans entreprise au personnel", async () => {
    const v = (await resolveViewer(f.id("usr_ops"), exp))!;
    expect(v.role).toBe("atie_operator");
    expect(v.organization).toBeNull();
  });

  it("coupe l'accès dès qu'un compte est désactivé", async () => {
    const uid = f.id("usr_rive_admin");
    expect(await resolveViewer(uid, exp)).not.toBeNull();
    await f.pg.query("UPDATE atie.users SET status = 'disabled' WHERE id = $1", [uid]);
    expect(await resolveViewer(uid, exp)).toBeNull();
  });
});
