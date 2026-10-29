import { describe, expect, it } from "vitest";
import { buildSeed } from "./fixtures/seed";
import { PROVIDER_COST_CENTS_PER_MIN, TOPUP_OPTIONS } from "@/lib/domain/pricing";

const now = new Date("2026-10-29T10:00:00Z");
const s = buildSeed(now);

describe("jeu de données de test (fixture)", () => {
  it("sont déterministes", () => {
    expect(JSON.stringify(buildSeed(now))).toBe(JSON.stringify(s));
  });

  it("contiennent les références Léa / Cabinet dentaire Lumière et Maya / Hôtel Chalet du Lac", () => {
    const lea = s.receptionists.find((r) => r.organizationId === "org_lumiere")!;
    const maya = s.receptionists.find((r) => r.organizationId === "org_chalet")!;
    expect(lea.name).toBe("Léa");
    expect(maya.name).toBe("Maya");
    expect(s.organizations.find((o) => o.id === "org_lumiere")!.name).toBe("Cabinet dentaire Lumière");
    expect(s.organizations.find((o) => o.id === "org_chalet")!.name).toBe("Hôtel Chalet du Lac");
  });

  it("réutilisent uniquement les deux avatars existants", () => {
    expect(s.avatars.map((a) => a.providerAvatarId).sort()).toEqual(["agent_ee494dab89f98682", "agent_fd6544c9c1935c9e"]);
    for (const r of s.receptionists) expect(s.avatars.some((a) => a.id === r.avatarId)).toBe(true);
  });

  it("couvrent les cas réalistes demandés", () => {
    expect(s.organizations.some((o) => o.status === "active")).toBe(true);
    expect(s.organizations.some((o) => o.status === "trial")).toBe(true);
    expect(s.organizations.some((o) => o.status === "suspended")).toBe(true);
    expect(s.conversations.some((c) => c.endReason === "disconnected")).toBe(true); // session interrompue
    expect(s.conversations.some((c) => c.status === "close_unconfirmed")).toBe(true);
    expect(s.conversations.some((c) => c.status === "active")).toBe(true);
    expect(s.invoices.some((i) => i.status === "overdue")).toBe(true); // facture impayée fictive
    expect(s.supportRequests.length).toBeGreaterThan(0);
    expect(s.minuteTopups.some((t) => t.status === "pending")).toBe(true);
  });

  it("sont toutes identifiées comme fictives", () => {
    // Le champ `demo` n'existe plus dans le domaine : les entreprises de test se reconnaissent
    // à leurs adresses en .example (jamais livrées : la fixture n'est chargée que par les tests).
    for (const o of s.organizations) expect(o.contactEmail.endsWith(".example")).toBe(true);
    for (const u of s.users) expect(u.email.endsWith(".example")).toBe(true);
    for (const i of s.invoices) expect(i.number.startsWith("DEMO-")).toBe(true);
    for (const w of s.widgetInstallations) expect(w.publicKey.startsWith("pk_demo_")).toBe(true);
  });

  it("n'inventent ni transcription, ni mesure fournisseur, ni indexation terminée", () => {
    for (const c of s.conversations) {
      expect(c.transcriptAvailable).toBe(false);
      expect(c.providerCostOrigin).not.toBe("measured");
    }
    for (const p of s.providerUsage) {
      expect(p.minutesUsed).toBeNull();
      expect(p.minutesAvailable).toBeNull();
    }
    for (const k of s.knowledgeSources) expect(k.indexStatus).not.toBe("indexed");
    for (const o of s.organizations) expect(o.transcriptsEnabled).toBe(false);
  });

  it("respectent la grille tarifaire validée le 29 oct. 2026", () => {
    const grid = Object.fromEntries(s.plans.map((p) => [p.code, [p.monthlyPriceCents, p.includedMinutes, p.approval, p.active]]));
    expect(grid).toEqual({
      starter: [1200, 15, "confirmed", true],
      essentiel: [2990, 50, "confirmed", true],
      premium: [8900, 150, "confirmed", true],
      business: [24900, 450, "confirmed", true],
    });
  });

  it("vendent chaque minute au moins deux fois son coût fournisseur estimé", () => {
    for (const p of s.plans) expect(p.monthlyPriceCents / p.includedMinutes).toBeGreaterThanOrEqual(2 * PROVIDER_COST_CENTS_PER_MIN);
    for (const o of TOPUP_OPTIONS) expect(o.priceCents / o.minutes).toBeGreaterThanOrEqual(2 * PROVIDER_COST_CENTS_PER_MIN);
  });

  it("dérivent les agrégats quotidiens des conversations (une seule source)", () => {
    const fromConv = s.conversations
      .filter((c) => c.status !== "active" && c.status !== "connecting")
      .reduce((n, c) => n + c.billableSeconds, 0);
    const fromUsage = s.usageRecords.reduce((n, u) => n + u.billableSeconds, 0);
    expect(fromUsage).toBe(fromConv);
  });

  it("ne contiennent aucun secret", () => {
    const json = JSON.stringify(s).toLowerCase();
    for (const marker of [/api_?key/, /\bsecret\b/, /sk_(live|test)/, /lk_api/, /bearer /]) expect(marker.test(json), String(marker)).toBe(false);
    for (const p of s.providerStatuses) expect(p.keyHint).toBeNull();
  });
});
