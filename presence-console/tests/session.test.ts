import { describe, expect, it } from "vitest";
import { decodeSession, encodeSession, resolveViewer } from "@/lib/auth/session";

describe("session de démonstration signée", () => {
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

  it("résout l'entreprise du client depuis son appartenance, jamais depuis la requête", () => {
    const v = resolveViewer("usr_chalet_admin", exp)!;
    expect(v.role).toBe("org_admin");
    expect(v.organization?.id).toBe("org_chalet");
    const viewer = resolveViewer("usr_lumiere_view", exp)!;
    expect(viewer.role).toBe("org_viewer");
    expect(viewer.organization?.id).toBe("org_lumiere");
  });

  it("refuse un utilisateur inconnu ou non actif", () => {
    expect(resolveViewer("usr_inexistant", exp)).toBeNull();
    expect(resolveViewer("usr_moser_admin", exp)).toBeNull(); // invité, pas encore actif
  });

  it("donne un rôle ATIE sans entreprise au personnel", () => {
    const v = resolveViewer("usr_ops", exp)!;
    expect(v.role).toBe("atie_operator");
    expect(v.organization).toBeNull();
  });
});
