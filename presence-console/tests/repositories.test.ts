import { describe, expect, it } from "vitest";
import {
  getKnowledgeSourceForOrg,
  listConversationsForOrg,
  listInvoicesForOrg,
  listKnowledgeForOrg,
  listVisitorRequestsForOrg,
  quotaForOrg,
} from "@/lib/repositories";
import { readStore } from "@/lib/demo/store";

describe("isolation multi-tenant des repositories", () => {
  const s = readStore();

  it("ne renvoie que les données de l'entreprise demandée", () => {
    for (const org of s.organizations) {
      for (const k of listKnowledgeForOrg(org.id)) expect(k.organizationId).toBe(org.id);
      for (const c of listConversationsForOrg(org.id)) expect(c.organizationId).toBe(org.id);
      for (const i of listInvoicesForOrg(org.id)) expect(i.organizationId).toBe(org.id);
      for (const v of listVisitorRequestsForOrg(org.id)) expect(v.organizationId).toBe(org.id);
    }
  });

  it("refuse d'ouvrir un document d'une autre entreprise, même avec son identifiant", () => {
    const foreign = s.knowledgeSources.find((k) => k.organizationId === "org_chalet")!;
    expect(getKnowledgeSourceForOrg("org_lumiere", foreign.id)).toBeNull();
    const own = getKnowledgeSourceForOrg("org_chalet", foreign.id)!;
    expect(own.source.id).toBe(foreign.id);
    for (const v of own.versions) expect(v.organizationId).toBe("org_chalet");
  });
});

describe("quotas commerciaux", () => {
  it("signale l'Hôtel Chalet du Lac comme proche de l'épuisement", () => {
    const q = quotaForOrg("org_chalet");
    expect(q.plan?.code).toBe("premium");
    expect(q.pctUsed).toBeGreaterThanOrEqual(80);
    expect(q.alert).not.toBe("none");
  });

  it("calcule minutes restantes = incluses + recharges − utilisées", () => {
    const q = quotaForOrg("org_lumiere");
    expect(q.remainingMinutes).toBeCloseTo(Math.max(0, q.includedMinutes + q.topupMinutes - q.usedMinutes), 1);
  });

  it("n'attribue aucun quota à une entreprise sans abonnement", () => {
    const q = quotaForOrg("org_moser");
    expect(q.subscription).toBeNull();
    expect(q.includedMinutes).toBe(0);
    expect(q.alert).toBe("none");
  });
});
