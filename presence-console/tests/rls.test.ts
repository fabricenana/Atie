import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { withOrg, rows } from "@/lib/db";
import {
  getAvatar,
  getOrganization,
  getReceptionistForOrg,
  listConversations,
  listInvoices,
  listNotifications,
  listOrganizations,
  listOrgUsers,
  listPlans,
  listReceptionists,
  listSupportRequests,
  listVisitorRequestsForOrg,
  quotaForOrg,
} from "@/lib/repositories";
import { activePlans, clientInteractions } from "@/lib/repositories/client";
import { setupFixture, type Fixture } from "./helpers/fixture";

/**
 * Isolation réelle en base : un client (rôle atie_app + app.current_org_id) ne voit jamais
 * une autre entreprise, même si le code applicatif lui demandait ses données.
 */

let f: Fixture;
beforeAll(async () => {
  f = await setupFixture();
});
afterAll(async () => {
  await f?.close();
});

const sql = (org: string, text: string, params: unknown[] = []) => withOrg(f.id(org), (q) => rows(q, text, params));

describe("RLS client (repositories en portée entreprise)", () => {
  it("ne liste que sa propre entreprise et ses propres données, même sans filtre applicatif", async () => {
    await f.asOrg("org_lumiere", async () => {
      const lumiere = f.id("org_lumiere");
      expect((await listOrganizations()).map((o) => o.id)).toEqual([lumiere]);
      const conv = await listConversations();
      expect(conv.length).toBeGreaterThan(0);
      for (const c of conv) expect(c.organizationId).toBe(lumiere);
      for (const i of await listInvoices()) expect(i.organizationId).toBe(lumiere);
      for (const s of await listSupportRequests()) expect(s.organizationId).toBe(lumiere);
      for (const r of await listReceptionists()) expect(r.organizationId).toBe(lumiere);
      // Notifications internes ATIE (organization_id NULL) invisibles.
      for (const n of await listNotifications(null)) expect(n.organizationId).toBe(lumiere);
    });
  });

  it("renvoie vide ou introuvable pour une autre entreprise demandée explicitement", async () => {
    await f.asOrg("org_lumiere", async () => {
      const chalet = f.id("org_chalet");
      expect(await getOrganization(chalet)).toBeNull();
      expect(await listVisitorRequestsForOrg(chalet)).toEqual([]);
      expect(await listOrgUsers(chalet)).toEqual([]);
      expect(await getReceptionistForOrg(chalet)).toBeNull();
      expect(await clientInteractions(chalet)).toEqual([]);
      const q = await quotaForOrg(chalet);
      expect(q.subscription).toBeNull();
      expect(q.usedSeconds).toBe(0);
    });
  });

  it("masque coûts fournisseurs et identifiants techniques des conversations", async () => {
    await f.asOrg("org_chalet", async () => {
      const conv = await listConversations();
      expect(conv.length).toBeGreaterThan(0);
      for (const c of conv) {
        expect(c.providerCostCents).toBeNull();
        expect(c.backendSessionId).toBe("");
        expect(c.error).toBeNull();
      }
    });
    await expect(sql("org_chalet", "SELECT provider_cost_cents FROM conversations")).rejects.toThrow(/permission denied/);
  });

  it("ne montre que l'avatar de sa réceptionniste et les formules actives", async () => {
    await f.asOrg("org_chalet", async () => {
      const rcp = (await getReceptionistForOrg(f.id("org_chalet")))!;
      expect(rcp.name).toBe("Maya");
      expect(await getAvatar(rcp.avatarId)).not.toBeNull();
      const lea = f.data.avatars.find((a) => a.name === "Léa")!;
      const leaId = (await f.pg.query<{ id: string }>("SELECT id FROM atie.avatars WHERE provider_avatar_id = $1", [lea.providerAvatarId])).rows[0].id;
      expect(await getAvatar(leaId)).toBeNull();
      await f.pg.query("UPDATE atie.plans SET active = false WHERE code = 'business'");
      expect((await activePlans()).map((p) => p.code)).not.toContain("business");
      expect((await listPlans()).map((p) => p.code)).not.toContain("business");
      await f.pg.query("UPDATE atie.plans SET active = true WHERE code = 'business'");
    });
  });

  it("ne voit que les membres de son entreprise, sans identifiant de connexion", async () => {
    const r = await sql("org_lumiere", "SELECT email::text AS email FROM users ORDER BY email");
    expect(r.map((x) => x.email)).toEqual(["direction@lumiere.example", "secretariat@lumiere.example"]);
    await expect(sql("org_lumiere", "SELECT idp_subject FROM users")).rejects.toThrow(/permission denied/);
  });
});

describe("RLS client (écritures directes en SQL)", () => {
  it("n'écrit jamais dans une autre entreprise", async () => {
    const foreign = f.data.visitorRequests.find((v) => v.organizationId === "org_chalet")!;
    const updated = await sql("org_lumiere", "UPDATE visitor_requests SET status = 'archived' WHERE id = $1 RETURNING id", [f.id(foreign.id)]);
    expect(updated).toEqual([]);
    const still = await f.pg.query<{ status: string }>("SELECT status FROM atie.visitor_requests WHERE id = $1", [f.id(foreign.id)]);
    expect(still.rows[0].status).toBe(foreign.status);

    await expect(
      sql("org_lumiere", "INSERT INTO support_requests (organization_id, kind, subject, message) VALUES ($1, 'issue', 'x', 'intrusion')", [f.id("org_chalet")]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      sql("org_lumiere", "INSERT INTO audit_events (organization_id, action, target) VALUES ($1, 'x', 'y')", [f.id("org_chalet")]),
    ).rejects.toThrow(/row-level security/);
    await expect(sql("org_lumiere", "UPDATE organizations SET contact_name = 'piraté' WHERE id = $1 RETURNING id", [f.id("org_chalet")])).resolves.toEqual([]);
  });

  it("ne peut ni lire ni modifier ce qui est réservé à ATIE", async () => {
    await expect(sql("org_lumiere", "SELECT * FROM knowledge_sources")).rejects.toThrow(/permission denied/);
    await expect(sql("org_lumiere", "SELECT * FROM audit_events")).rejects.toThrow(/permission denied/);
    await expect(sql("org_lumiere", "SELECT * FROM settings")).rejects.toThrow(/permission denied/);
    await expect(sql("org_lumiere", "UPDATE organizations SET status = 'active' WHERE id = $1", [f.id("org_lumiere")])).rejects.toThrow(/permission denied/);
    await expect(sql("org_lumiere", "UPDATE subscriptions SET plan_id = plan_id")).rejects.toThrow(/permission denied/);
    await expect(sql("org_lumiere", "DELETE FROM visitor_requests")).rejects.toThrow(/permission denied/);
  });

  it("peut adresser une notification interne à ATIE sans pouvoir la relire", async () => {
    const r = await sql("org_lumiere", "INSERT INTO notifications (organization_id, level, title, body) VALUES (NULL, 'info', 'Test RLS', 'corps')");
    expect(r).toEqual([]);
    const mine = await sql("org_lumiere", "SELECT id FROM notifications WHERE title = 'Test RLS'");
    expect(mine).toEqual([]);
    const atie = await f.pg.query("SELECT id FROM atie.notifications WHERE title = 'Test RLS' AND organization_id IS NULL");
    expect(atie.rows).toHaveLength(1);
  });

  it("sans entreprise de session, ne voit rien ; un identifiant non UUID est refusé avant SQL", async () => {
    await expect(withOrg("org_lumiere", async () => 1)).rejects.toThrow(/invalide/);
    const none = await withOrg("00000000-0000-4000-8000-000000000000", (q) => rows(q, "SELECT id FROM organizations"));
    expect(none).toEqual([]);
  });
});
