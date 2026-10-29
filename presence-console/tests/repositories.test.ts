import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  getKnowledgeSourceForOrg,
  getOrganization,
  listConversationsForOrg,
  listInvoicesForOrg,
  listKnowledgeForOrg,
  listOrganizationRows,
  listUsageForOrg,
  listVisitorRequestsForOrg,
  quotaForOrg,
} from "@/lib/repositories";
import { setupFixture, type Fixture } from "./helpers/fixture";

let f: Fixture;
beforeAll(async () => {
  f = await setupFixture();
});
afterAll(async () => {
  await f?.close();
});

describe("isolation multi-tenant des repositories (personnel ATIE, PostgreSQL)", () => {
  it("ne renvoie que les données de l'entreprise demandée", async () => {
    await f.staff(async () => {
      for (const org of f.data.organizations) {
        const id = f.id(org.id);
        for (const k of await listKnowledgeForOrg(id)) expect(k.organizationId).toBe(id);
        for (const c of await listConversationsForOrg(id)) expect(c.organizationId).toBe(id);
        for (const i of await listInvoicesForOrg(id)) expect(i.organizationId).toBe(id);
        for (const v of await listVisitorRequestsForOrg(id)) expect(v.organizationId).toBe(id);
      }
    });
  });

  it("refuse d'ouvrir un document d'une autre entreprise, même avec son identifiant", async () => {
    await f.staff(async () => {
      const foreign = f.data.knowledgeSources.find((k) => k.organizationId === "org_chalet")!;
      expect(await getKnowledgeSourceForOrg(f.id("org_lumiere"), f.id(foreign.id))).toBeNull();
      const own = (await getKnowledgeSourceForOrg(f.id("org_chalet"), f.id(foreign.id)))!;
      expect(own.source.id).toBe(f.id(foreign.id));
      for (const v of own.versions) expect(v.organizationId).toBe(f.id("org_chalet"));
    });
  });

  it("traite un identifiant d'URL invalide comme introuvable, sans erreur SQL", async () => {
    await f.staff(async () => {
      expect(await getOrganization("org_lumiere")).toBeNull();
      expect(await getKnowledgeSourceForOrg("x", "y")).toBeNull();
      expect(await listKnowledgeForOrg("'; DROP TABLE atie.users; --")).toEqual([]);
    });
  });

  it("relit les entités avec les types du domaine (dates ISO, nombres, tableaux)", async () => {
    await f.staff(async () => {
      const org = (await getOrganization(f.id("org_lumiere")))!;
      expect(org.name).toBe("Cabinet dentaire Lumière");
      expect(org.notificationPrefs.quotaAlerts).toBe(true);
      expect(org.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      const inv = (await listInvoicesForOrg(f.id("org_lumiere")))[0];
      expect(typeof inv.totalCents).toBe("number");
      expect(Array.isArray(inv.lines)).toBe(true);
    });
  });
});

describe("quotas commerciaux (calculés depuis les conversations en base)", () => {
  it("signale l'Hôtel Chalet du Lac comme proche de l'épuisement", async () => {
    const q = await f.staff(() => quotaForOrg(f.id("org_chalet")));
    expect(q.plan?.code).toBe("premium");
    expect(q.pctUsed).toBeGreaterThanOrEqual(80);
    expect(q.alert).not.toBe("none");
  });

  it("calcule minutes restantes = incluses + recharges − utilisées", async () => {
    const q = await f.staff(() => quotaForOrg(f.id("org_lumiere")));
    expect(q.remainingMinutes).toBeCloseTo(Math.max(0, q.includedMinutes + q.topupMinutes - q.usedMinutes), 1);
  });

  it("n'attribue aucun quota à une entreprise sans abonnement", async () => {
    const q = await f.staff(() => quotaForOrg(f.id("org_moser")));
    expect(q.subscription).toBeNull();
    expect(q.includedMinutes).toBe(0);
    expect(q.alert).toBe("none");
  });

  it("donne le même résultat en lot (tableau des entreprises) qu'à l'unité", async () => {
    await f.staff(async () => {
      const rows = await listOrganizationRows();
      expect(rows).toHaveLength(f.data.organizations.length);
      const chalet = rows.find((r) => r.org.id === f.id("org_chalet"))!;
      const q = await quotaForOrg(f.id("org_chalet"));
      expect(chalet.usedMinutes).toBe(q.usedMinutes);
      expect(chalet.includedMinutes).toBe(q.includedMinutes + q.topupMinutes);
      expect(chalet.receptionistName).toBe("Maya");
    });
  });

  it("dérive les agrégats quotidiens des conversations terminées (une seule source)", async () => {
    await f.staff(async () => {
      const id = f.id("org_lumiere");
      const usage = await listUsageForOrg(id);
      const fromUsage = usage.reduce((n, u) => n + u.billableSeconds, 0);
      const fromConv = f.data.conversations
        .filter((c) => c.organizationId === "org_lumiere" && !["pending", "connecting", "active", "terminating"].includes(c.status))
        .reduce((n, c) => n + c.billableSeconds, 0);
      expect(fromUsage).toBe(fromConv);
      for (const u of usage) expect(u.origin).toBe("measured");
    });
  });
});
