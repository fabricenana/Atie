"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors, type ActionResult } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { mutateStore, newId } from "../demo/store";
import { audit } from "./audit";

/**
 * Formules, abonnements, recharges et concurrence — modifications locales de démonstration.
 * En production, ces écritures passeront par le backend commercial ; le backend Python
 * reste l'autorité pour la consommation et les quotas appliqués aux sessions.
 */

const fail = (e: unknown): ActionResult => ({
  ok: false,
  message: e instanceof ForbiddenError ? e.message : "L’enregistrement a échoué. Aucune donnée n’a été modifiée.",
});

const chfToCents = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);

const planSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(2, "Nom trop court.").max(40, "40 caractères au plus."),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,30}$/, "Lettres minuscules, chiffres et tirets (2 à 30)."),
  price: z
    .string()
    .trim()
    .regex(/^\d{1,5}([.,]\d{1,2})?$/, "Montant en CHF, par exemple 79.90."),
  includedMinutes: z.coerce.number().int("Nombre entier.").min(0, "Valeur positive.").max(100000, "Valeur trop élevée."),
  concurrentSessions: z.coerce.number().int("Nombre entier.").min(1, "Au moins 1.").max(50, "50 au plus."),
  approval: z.enum(["confirmed", "hypothesis", "draft"], { message: "Statut invalide." }),
  description: z.string().trim().max(200, "200 caractères au plus.").default(""),
  active: z.boolean(),
});

export async function savePlan(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("plan.write");
    const parsed = planSchema.safeParse({
      id: (data.get("id") as string) || undefined,
      name: data.get("name") ?? "",
      code: data.get("code") ?? "",
      price: data.get("price") ?? "",
      includedMinutes: data.get("includedMinutes") ?? "",
      concurrentSessions: data.get("concurrentSessions") ?? "",
      approval: data.get("approval") ?? "",
      description: data.get("description") ?? "",
      active: data.get("active") === "on",
    });
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const p = parsed.data;
    const result = await mutateStore<ActionResult>((s) => {
      if (s.plans.some((x) => x.code === p.code && x.id !== p.id)) {
        return { ok: false, message: "Ce code est déjà utilisé.", errors: { code: "Code déjà utilisé par une autre formule." } };
      }
      const now = new Date().toISOString();
      const values = {
        name: p.name,
        code: p.code,
        monthlyPriceCents: chfToCents(p.price),
        includedMinutes: p.includedMinutes,
        concurrentSessions: p.concurrentSessions,
        approval: p.approval,
        description: p.description,
        active: p.active,
      };
      if (p.id) {
        const plan = s.plans.find((x) => x.id === p.id);
        if (!plan) return { ok: false, message: "Formule introuvable." };
        Object.assign(plan, values, { updatedAt: now });
        audit(s, v.user.id, null, "plan.update", plan.name, `${(values.monthlyPriceCents / 100).toFixed(2)} CHF / ${values.includedMinutes} min`);
        return { ok: true, message: `Formule « ${plan.name} » enregistrée (démo).` };
      }
      s.plans.push({ id: newId("pln"), ...values, createdAt: now, updatedAt: now });
      audit(s, v.user.id, null, "plan.create", p.name, `${(values.monthlyPriceCents / 100).toFixed(2)} CHF / ${values.includedMinutes} min`);
      return { ok: true, message: `Formule « ${p.name} » créée (démo).` };
    });
    if (result.ok) revalidatePath("/admin/abonnements", "layout");
    return result;
  } catch (e) {
    return fail(e);
  }
}

const subSchema = z.object({
  subscriptionId: z.string().min(1),
  planId: z.string().min(1, "Choisissez une formule."),
  alertThresholdPct: z.coerce.number().int("Nombre entier.").min(50, "Entre 50 et 100 %.").max(100, "Entre 50 et 100 %."),
  autoRenew: z.boolean(),
});

export async function updateSubscription(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("subscription.write");
    const parsed = subSchema.safeParse({
      subscriptionId: data.get("subscriptionId") ?? "",
      planId: data.get("planId") ?? "",
      alertThresholdPct: data.get("alertThresholdPct") ?? "",
      autoRenew: data.get("autoRenew") === "on",
    });
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const p = parsed.data;
    const result = await mutateStore<ActionResult>((s) => {
      const sub = s.subscriptions.find((x) => x.id === p.subscriptionId);
      const plan = s.plans.find((x) => x.id === p.planId);
      if (!sub || !plan) return { ok: false, message: "Abonnement ou formule introuvable." };
      const org = s.organizations.find((o) => o.id === sub.organizationId);
      const changed = sub.planId !== plan.id;
      sub.planId = plan.id;
      sub.alertThresholdPct = p.alertThresholdPct;
      sub.autoRenew = p.autoRenew;
      sub.updatedAt = new Date().toISOString();
      audit(
        s,
        v.user.id,
        sub.organizationId,
        "subscription.update",
        org?.name ?? sub.organizationId,
        `${changed ? `Formule ${plan.name}, ` : ""}alerte ${p.alertThresholdPct} %, renouvellement ${p.autoRenew ? "auto" : "manuel"}`,
      );
      return { ok: true, message: `Abonnement de ${org?.name ?? "l’entreprise"} mis à jour (démo, aucune facturation).` };
    });
    if (result.ok) revalidatePath("/admin", "layout");
    return result;
  } catch (e) {
    return fail(e);
  }
}

const assignSchema = z.object({
  organizationId: z.string().min(1, "Choisissez une entreprise."),
  planId: z.string().min(1, "Choisissez une formule."),
  activatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide."),
  status: z.enum(["trialing", "active"], { message: "Statut invalide." }),
});

export async function assignPlan(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("subscription.write");
    const parsed = assignSchema.safeParse({
      organizationId: data.get("organizationId") ?? "",
      planId: data.get("planId") ?? "",
      activatedAt: data.get("activatedAt") ?? "",
      status: data.get("status") ?? "",
    });
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const p = parsed.data;
    const result = await mutateStore<ActionResult>((s) => {
      const org = s.organizations.find((o) => o.id === p.organizationId);
      const plan = s.plans.find((x) => x.id === p.planId);
      if (!org || !plan) return { ok: false, message: "Entreprise ou formule introuvable." };
      if (s.subscriptions.some((x) => x.organizationId === org.id && x.status !== "canceled")) {
        return { ok: false, message: "Cette entreprise a déjà un abonnement. Modifiez-le plutôt.", errors: { organizationId: "Abonnement existant." } };
      }
      const start = new Date(`${p.activatedAt}T00:00:00Z`);
      const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()));
      const now = new Date().toISOString();
      s.subscriptions.push({
        id: newId("sub"),
        organizationId: org.id,
        planId: plan.id,
        status: p.status,
        activatedAt: start.toISOString(),
        currentPeriodStart: start.toISOString(),
        currentPeriodEnd: end.toISOString(),
        autoRenew: true,
        alertThresholdPct: s.settings.quotaAlertPct,
        createdAt: now,
        updatedAt: now,
      });
      audit(s, v.user.id, org.id, "subscription.create", org.name, `Formule ${plan.name} dès le ${p.activatedAt}`);
      return { ok: true, message: `Formule ${plan.name} attribuée à ${org.name} (démo, aucune facturation).` };
    });
    if (result.ok) revalidatePath("/admin", "layout");
    return result;
  } catch (e) {
    return fail(e);
  }
}

const topupSchema = z.object({
  organizationId: z.string().min(1, "Choisissez une entreprise."),
  minutes: z.coerce.number().int("Nombre entier.").min(10, "10 minutes au moins.").max(5000, "5000 minutes au plus."),
  price: z
    .string()
    .trim()
    .regex(/^\d{1,5}([.,]\d{1,2})?$/, "Montant en CHF, par exemple 29.00."),
});

export async function createTopup(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("subscription.write");
    const parsed = topupSchema.safeParse({ organizationId: data.get("organizationId") ?? "", minutes: data.get("minutes") ?? "", price: data.get("price") ?? "" });
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const p = parsed.data;
    const result = await mutateStore<ActionResult>((s) => {
      const org = s.organizations.find((o) => o.id === p.organizationId);
      if (!org) return { ok: false, message: "Entreprise introuvable." };
      s.minuteTopups.push({
        id: newId("top"),
        organizationId: org.id,
        minutes: p.minutes,
        priceCents: chfToCents(p.price),
        status: "pending",
        requestedAt: new Date().toISOString(),
        appliedAt: null,
        requestedBy: v.user.id,
      });
      audit(s, v.user.id, org.id, "topup.create", org.name, `${p.minutes} min`);
      return { ok: true, message: `Recharge de ${p.minutes} min préparée pour ${org.name} (en attente, démo).` };
    });
    if (result.ok) revalidatePath("/admin", "layout");
    return result;
  } catch (e) {
    return fail(e);
  }
}

export async function decideTopup(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("subscription.write");
    const decision = payload.decision === "apply" ? "applied" : payload.decision === "reject" ? "rejected" : null;
    if (!decision) return { ok: false, message: "Décision invalide." };
    const result = await mutateStore<ActionResult>((s) => {
      const t = s.minuteTopups.find((x) => x.id === payload.id);
      if (!t) return { ok: false, message: "Recharge introuvable." };
      if (t.status !== "pending" && t.status !== "requested") return { ok: false, message: "Cette recharge a déjà été traitée." };
      const org = s.organizations.find((o) => o.id === t.organizationId);
      t.status = decision;
      t.appliedAt = decision === "applied" ? new Date().toISOString() : null;
      audit(s, v.user.id, t.organizationId, `topup.${decision === "applied" ? "apply" : "reject"}`, org?.name ?? t.organizationId, `${t.minutes} min`);
      return {
        ok: true,
        message:
          decision === "applied"
            ? `${t.minutes} min ajoutées au quota de ${org?.name ?? "l’entreprise"} (démo, aucun paiement).`
            : `Recharge refusée pour ${org?.name ?? "l’entreprise"}.`,
      };
    });
    if (result.ok) revalidatePath("/admin", "layout");
    return result;
  } catch (e) {
    return fail(e);
  }
}

export async function activateConcurrency(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("subscription.write");
    const result = await mutateStore<ActionResult>((s) => {
      const c = s.concurrencyEntitlements.find((x) => x.id === payload.id);
      if (!c) return { ok: false, message: "Option introuvable." };
      if (c.status !== "requested") return { ok: false, message: "Cette option n’est pas en attente." };
      const org = s.organizations.find((o) => o.id === c.organizationId);
      c.status = "active";
      audit(s, v.user.id, c.organizationId, "concurrency.activate", org?.name ?? c.organizationId, `+${c.extraSessions} session(s) simultanée(s)`);
      return { ok: true, message: `Concurrence supplémentaire activée pour ${org?.name ?? "l’entreprise"} (démo).` };
    });
    if (result.ok) revalidatePath("/admin", "layout");
    return result;
  } catch (e) {
    return fail(e);
  }
}
