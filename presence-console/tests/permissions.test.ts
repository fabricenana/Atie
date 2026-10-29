import { describe, expect, it } from "vitest";
import { can, isAtieRole, PERMISSIONS, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import type { Role } from "@/lib/domain/types";

const roles = Object.keys(ROLE_PERMISSIONS) as Role[];

describe("matrice des permissions", () => {
  it("couvre les cinq rôles demandés", () => {
    expect(roles.sort()).toEqual(["atie_admin", "atie_operator", "org_admin", "org_viewer", "super_admin"]);
  });

  it("n'accorde aucune permission back-office à un rôle client", () => {
    for (const r of ["org_admin", "org_viewer"] as Role[]) {
      for (const p of PERMISSIONS.filter((p) => !p.startsWith("client."))) expect(can(r, p), `${r} ${p}`).toBe(false);
      expect(isAtieRole(r)).toBe(false);
    }
  });

  it("n'accorde aucun accès à l'espace client au personnel ATIE", () => {
    for (const r of ["super_admin", "atie_admin", "atie_operator"] as Role[]) {
      expect(can(r, "client.access")).toBe(false);
      expect(isAtieRole(r)).toBe(true);
    }
  });

  it("est hiérarchique : opérateur ⊂ administrateur ⊂ super administrateur", () => {
    for (const p of ROLE_PERMISSIONS.atie_operator) expect(can("atie_admin", p)).toBe(true);
    for (const p of ROLE_PERMISSIONS.atie_admin) expect(can("super_admin", p)).toBe(true);
    for (const p of ROLE_PERMISSIONS.org_viewer) expect(can("org_admin", p)).toBe(true);
  });

  it("réserve les actions sensibles", () => {
    expect(can("atie_operator", "org.suspend")).toBe(false);
    expect(can("atie_operator", "billing.write")).toBe(false);
    expect(can("atie_admin", "plan.write")).toBe(false);
    // La permission « demo.reset » a disparu avec les données de démonstration ; la gestion
    // des comptes internes (invitations réelles) reste réservée au super administrateur.
    expect(can("atie_admin", "users.manage")).toBe(false);
    expect(can("super_admin", "users.manage")).toBe(true);
    expect((PERMISSIONS as readonly string[]).includes("demo.reset")).toBe(false);
    expect(can("org_viewer", "client.requests.update")).toBe(false);
    expect(can("org_viewer", "client.topup.request")).toBe(false);
  });
});
