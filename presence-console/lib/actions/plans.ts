"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors, type ActionResult } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { audit, isUuid, one, pgCode, withStaff } from "../db";
import { loadPlatformSettings } from "../settings";

/**
 * Formules, abonnements, recharges et concurrence — écrits en base par ATIE.
 * Aucun prestataire de paiement n'est connecté : aucune opération financière n'est déclenchée.
 * Le backend Python reste l'autorité pour la consommation appliquée aux sessions.
 */

const fail = (e: unknown): ActionResult => ({
  ok: false,
  message: e instanceof ForbiddenError ? e.message : "L’enregistrement a échoué. Aucune donnée n’a été modifiée.",
});

const chfToCents = (v: string) => Math.round(Number(v.replace(",", ".")) * 100);
const uuid = (msg: string) => z.string().refine(isUuid, msg);

const planSchema = z.object({
  id: z.string().refine(isUuid, "Formule introuvable.").optional(),
  name: z.string().trim().min(2, "Nom trop court.").max(40, "40 caractères au plus."),
  code: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{2,30}$/, "Lettres minuscules, chiffres et tirets (2 à 30)."),
  price: z
    .string()
    .trim()
    .regex(/^\d{1,5}([.,]\d{1,2})?$/, "Montant en CHF, par exemple 89.00."),
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
    const cents = chfToCents(p.price);
    const summary = `${(cents / 100).toFixed(2)} CHF / ${p.includedMinutes} min`;
    const result = await withStaff<ActionResult>(async (q) => {
      if (await one(q, "SELECT 1 FROM plans WHERE code = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)", [p.code, p.id ?? null])) {
        return { ok: false, message: "Ce code est déjà utilisé.", errors: { code: "Code déjà utilisé par une autre formule." } };
      }
      const values = [p.name, p.code, cents, p.includedMinutes, p.concurrentSessions, p.approval, p.description, p.active];
      if (p.id) {
        const plan = await one<{ name: string }>(
          q,
          `UPDATE plans SET name = $2, code = $3, monthly_price_cents = $4, included_minutes = $5, concurrent_sessions = $6,
                  approval = $7::plan_approval, description = $8, active = $9, updated_at = now()
            WHERE id = $1 RETURNING name`,
          [p.id, ...values],
        );
        if (!plan) return { ok: false, message: "Formule introuvable." };
        await audit(q, v.user.id, null, "plan.update", plan.name, summary);
        return { ok: true, message: `Formule « ${plan.name} » enregistrée.` };
      }
      await q.query(
        `INSERT INTO plans (name, code, monthly_price_cents, included_minutes, concurrent_sessions, approval, description, active)
         VALUES ($1, $2, $3, $4, $5, $6::plan_approval, $7, $8)`,
        values,
      );
      await audit(q, v.user.id, null, "plan.create", p.name, summary);
      return { ok: true, message: `Formule « ${p.name} » créée.` };
    });
    if (result.ok) revalidatePath("/admin/abonnements", "layout");
    return result;
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, message: "Ce code est déjà utilisé.", errors: { code: "Code déjà utilisé." } };
    return fail(e);
  }
}

const subSchema = z.object({
  subscriptionId: uuid("Abonnement introuvable."),
  planId: uuid("Choisissez une formule."),
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
    const result = await withStaff<ActionResult>(async (q) => {
      const sub = await one<{ organizationId: string; planId: string; orgName: string }>(
        q,
        `SELECT s.organization_id AS "organizationId", s.plan_id AS "planId", o.name AS "orgName"
           FROM subscriptions s JOIN organizations o ON o.id = s.organization_id WHERE s.id = $1 FOR UPDATE OF s`,
        [p.subscriptionId],
      );
      const plan = await one<{ name: string }>(q, "SELECT name FROM plans WHERE id = $1", [p.planId]);
      if (!sub || !plan) return { ok: false, message: "Abonnement ou formule introuvable." };
      await q.query("UPDATE subscriptions SET plan_id = $2, alert_threshold_pct = $3, auto_renew = $4, updated_at = now() WHERE id = $1", [
        p.subscriptionId,
        p.planId,
        p.alertThresholdPct,
        p.autoRenew,
      ]);
      const changed = sub.planId !== p.planId;
      await audit(
        q,
        v.user.id,
        sub.organizationId,
        "subscription.update",
        sub.orgName,
        `${changed ? `Formule ${plan.name}, ` : ""}alerte ${p.alertThresholdPct} %, renouvellement ${p.autoRenew ? "auto" : "manuel"}`,
      );
      return { ok: true, message: `Abonnement de ${sub.orgName} mis à jour (aucune facturation automatique).` };
    });
    if (result.ok) revalidatePath("/admin", "layout");
    return result;
  } catch (e) {
    return fail(e);
  }
}

const assignSchema = z.object({
  organizationId: uuid("Choisissez une entreprise."),
  planId: uuid("Choisissez une formule."),
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
    const start = new Date(`${p.activatedAt}T00:00:00Z`);
    if (Number.isNaN(start.getTime())) return { ok: false, message: "Date invalide.", errors: { activatedAt: "Date invalide." } };
    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate()));
    const result = await withStaff<ActionResult>(async (q) => {
      const org = await one<{ name: string; status: string }>(q, "SELECT name, status::text AS status FROM organizations WHERE id = $1 FOR UPDATE", [p.organizationId]);
      const plan = await one<{ name: string }>(q, "SELECT name FROM plans WHERE id = $1", [p.planId]);
      if (!org || !plan) return { ok: false, message: "Entreprise ou formule introuvable." };
      if (await one(q, "SELECT 1 FROM subscriptions WHERE organization_id = $1 AND status <> 'canceled'", [p.organizationId])) {
        return { ok: false, message: "Cette entreprise a déjà un abonnement. Modifiez-le plutôt.", errors: { organizationId: "Abonnement existant." } };
      }
      const settings = await loadPlatformSettings(q);
      await q.query(
        `INSERT INTO subscriptions (organization_id, plan_id, status, activated_at, current_period_start, current_period_end, alert_threshold_pct)
         VALUES ($1, $2, $3::subscription_status, $4, $4, $5, $6)`,
        [p.organizationId, p.planId, p.status, start.toISOString(), end.toISOString(), settings.quotaAlertPct],
      );
      // Première activation : l'entreprise passe en essai ou en service.
      if (org.status === "onboarding") {
        await q.query("UPDATE organizations SET status = $2::org_status, activated_at = coalesce(activated_at, $3), updated_at = now() WHERE id = $1", [
          p.organizationId,
          p.status === "trialing" ? "trial" : "active",
          start.toISOString(),
        ]);
      }
      await audit(q, v.user.id, p.organizationId, "subscription.create", org.name, `Formule ${plan.name} dès le ${p.activatedAt}`);
      return { ok: true, message: `Formule ${plan.name} attribuée à ${org.name} (aucune facturation automatique).` };
    });
    if (result.ok) revalidatePath("/admin", "layout");
    return result;
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, message: "Cette entreprise a déjà un abonnement.", errors: { organizationId: "Abonnement existant." } };
    return fail(e);
  }
}

const topupSchema = z.object({
  organizationId: uuid("Choisissez une entreprise."),
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
    const result = await withStaff<ActionResult>(async (q) => {
      const org = await one<{ name: string }>(q, "SELECT name FROM organizations WHERE id = $1", [p.organizationId]);
      if (!org) return { ok: false, message: "Entreprise introuvable." };
      await q.query("INSERT INTO minute_topups (organization_id, minutes, price_cents, status, requested_by) VALUES ($1, $2, $3, 'pending', $4)", [
        p.organizationId,
        p.minutes,
        chfToCents(p.price),
        v.user.id,
      ]);
      await audit(q, v.user.id, p.organizationId, "topup.create", org.name, `${p.minutes} min`);
      return { ok: true, message: `Recharge de ${p.minutes} min préparée pour ${org.name} (en attente).` };
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
    if (!isUuid(payload.id)) return { ok: false, message: "Recharge introuvable." };
    const result = await withStaff<ActionResult>(async (q) => {
      const t = await one<{ organizationId: string; minutes: number; status: string; orgName: string }>(
        q,
        `SELECT t.organization_id AS "organizationId", t.minutes, t.status, o.name AS "orgName"
           FROM minute_topups t JOIN organizations o ON o.id = t.organization_id WHERE t.id = $1 FOR UPDATE OF t`,
        [payload.id],
      );
      if (!t) return { ok: false, message: "Recharge introuvable." };
      if (t.status !== "pending" && t.status !== "requested") return { ok: false, message: "Cette recharge a déjà été traitée." };
      await q.query("UPDATE minute_topups SET status = $2, applied_at = CASE WHEN $2 = 'applied' THEN now() ELSE NULL END WHERE id = $1", [payload.id, decision]);
      await audit(q, v.user.id, t.organizationId, `topup.${decision === "applied" ? "apply" : "reject"}`, t.orgName, `${t.minutes} min`);
      return {
        ok: true,
        message: decision === "applied" ? `${t.minutes} min ajoutées au quota de ${t.orgName} (aucun paiement encaissé).` : `Recharge refusée pour ${t.orgName}.`,
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
    if (!isUuid(payload.id)) return { ok: false, message: "Option introuvable." };
    const result = await withStaff<ActionResult>(async (q) => {
      const c = await one<{ organizationId: string; extraSessions: number; status: string; orgName: string }>(
        q,
        `SELECT ce.organization_id AS "organizationId", ce.extra_sessions AS "extraSessions", ce.status, o.name AS "orgName"
           FROM concurrency_entitlements ce JOIN organizations o ON o.id = ce.organization_id WHERE ce.id = $1 FOR UPDATE OF ce`,
        [payload.id],
      );
      if (!c) return { ok: false, message: "Option introuvable." };
      if (c.status !== "requested") return { ok: false, message: "Cette option n’est pas en attente." };
      await q.query("UPDATE concurrency_entitlements SET status = 'active' WHERE id = $1", [payload.id]);
      await audit(q, v.user.id, c.organizationId, "concurrency.activate", c.orgName, `+${c.extraSessions} session(s) simultanée(s)`);
      return { ok: true, message: `Concurrence supplémentaire activée pour ${c.orgName}.` };
    });
    if (result.ok) revalidatePath("/admin", "layout");
    return result;
  } catch (e) {
    return fail(e);
  }
}
