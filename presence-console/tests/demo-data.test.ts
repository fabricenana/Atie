import { describe, expect, it } from "vitest";
import { buildSeed } from "@/lib/demo/seed";

const now = new Date("2026-10-29T10:00:00Z");
const s = buildSeed(now);

describe("données de démonstration", () => {
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
    for (const o of s.organizations) expect(o.demo).toBe(true);
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

  it("respectent la grille tarifaire : Starter confirmé, Premium hypothèse", () => {
    const starter = s.plans.find((p) => p.code === "starter")!;
    const premium = s.plans.find((p) => p.code === "premium")!;
    expect([starter.monthlyPriceCents, starter.includedMinutes, starter.approval]).toEqual([990, 15, "confirmed"]);
    expect([premium.monthlyPriceCents, premium.includedMinutes, premium.approval]).toEqual([7990, 250, "hypothesis"]);
    expect(s.plans.filter((p) => p.approval === "confirmed")).toHaveLength(1);
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
