"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../action-result";
import { fieldErrors } from "../action-result";
import { assertPermission, ForbiddenError, type Viewer } from "../auth/session";
import type { Permission } from "../auth/permissions";
import { mutateStore, newId } from "../demo/store";
import { audit } from "./audit";

/**
 * Actions de l'espace client.
 *
 * L'entreprise concernée provient TOUJOURS de la session serveur, jamais du formulaire.
 * Chaque objet modifié est recherché dans cette entreprise uniquement.
 * Aucune action n'a d'effet hors des données de démonstration locales.
 */

async function clientViewer(permission: Permission): Promise<Viewer & { organization: NonNullable<Viewer["organization"]> }> {
  const v = await assertPermission(permission);
  if (!v.organization) throw new ForbiddenError("Espace client réservé aux comptes entreprise.");
  return v as Viewer & { organization: NonNullable<Viewer["organization"]> };
}

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, message: e.message };
  return { ok: false, message: "L’action n’a pas pu aboutir. Réessayez dans un instant." };
}

const now = () => new Date().toISOString();

// ---------------------------------------------------------------------------
// Assistance et demandes de modification
// ---------------------------------------------------------------------------

const supportSchema = z.object({
  kind: z.enum(["change_request", "issue", "minutes", "contact"], { message: "Choisissez un type de demande." }),
  subject: z.string().trim().min(3, "Indiquez un objet (3 caractères au moins).").max(120, "120 caractères au maximum."),
  message: z.string().trim().min(10, "Décrivez votre demande (10 caractères au moins).").max(2000, "2000 caractères au maximum."),
});

export async function createSupportRequest(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await clientViewer("client.support.create");
    const parsed = supportSchema.safeParse({ kind: data.get("kind"), subject: data.get("subject"), message: data.get("message") });
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const orgId = v.organization.id;
    await mutateStore((s) => {
      const t = now();
      s.supportRequests.push({ id: newId("sup"), organizationId: orgId, ...parsed.data, status: "open", createdAt: t, updatedAt: t, createdBy: v.user.id });
      s.notifications.push({ id: newId("ntf"), organizationId: null, level: "info", title: `Nouvelle demande : ${v.organization.name}`, body: parsed.data.subject, createdAt: t, readAt: null });
      audit(s, v.user.id, orgId, "support.create", parsed.data.subject, parsed.data.kind);
    });
    revalidatePath("/client", "layout");
    return { ok: true, message: "Demande envoyée à l’équipe ATIE. Vous la retrouvez dans l’historique.", simulated: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Demandes laissées par les visiteurs
// ---------------------------------------------------------------------------

const requestStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["new", "in_progress", "done", "archived"], { message: "Statut invalide." }),
});

export async function updateVisitorRequestStatus(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await clientViewer("client.requests.update");
    const parsed = requestStatusSchema.safeParse({ id: data.get("id"), status: data.get("status") });
    if (!parsed.success) return { ok: false, message: "Statut invalide.", errors: fieldErrors(parsed.error.issues) };
    const orgId = v.organization.id;
    const found = await mutateStore((s) => {
      const r = s.visitorRequests.find((x) => x.id === parsed.data.id && x.organizationId === orgId);
      if (!r) return false;
      r.status = parsed.data.status;
      audit(s, v.user.id, orgId, "visitor_request.status", r.visitorName, parsed.data.status);
      return true;
    });
    if (!found) return { ok: false, message: "Demande introuvable." };
    revalidatePath("/client", "layout");
    return { ok: true, message: "Statut de la demande mis à jour." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function markNotificationRead(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await clientViewer("client.access");
    const orgId = v.organization.id;
    const all = payload.id === "all";
    const count = await mutateStore((s) => {
      let n = 0;
      for (const x of s.notifications) {
        if (x.organizationId !== orgId || x.readAt) continue;
        if (all || x.id === payload.id) {
          x.readAt = now();
          n++;
        }
      }
      return n;
    });
    revalidatePath("/client", "layout");
    return count ? { ok: true, message: all ? "Toutes les notifications sont marquées comme lues." : "Notification marquée comme lue." } : { ok: false, message: "Aucune notification à mettre à jour." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Recharges et changement de formule (mode demande, aucun paiement)
// ---------------------------------------------------------------------------

/** Recharges proposées en démonstration : prix indicatifs, non approuvés. */
const TOPUP_OPTIONS_SERVER = { "50": 1500, "100": 2900 } as const;

const topupSchema = z.object({ minutes: z.enum(["50", "100"], { message: "Choisissez une recharge." }) });

export async function requestTopup(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await clientViewer("client.topup.request");
    const parsed = topupSchema.safeParse({ minutes: data.get("minutes") });
    if (!parsed.success) return { ok: false, message: "Choisissez une recharge.", errors: fieldErrors(parsed.error.issues) };
    const orgId = v.organization.id;
    const minutes = Number(parsed.data.minutes);
    await mutateStore((s) => {
      const t = now();
      s.minuteTopups.push({ id: newId("top"), organizationId: orgId, minutes, priceCents: TOPUP_OPTIONS_SERVER[parsed.data.minutes], status: "requested", requestedAt: t, appliedAt: null, requestedBy: v.user.id });
      s.notifications.push({ id: newId("ntf"), organizationId: null, level: "info", title: `Recharge demandée : ${v.organization.name}`, body: `${minutes} minutes`, createdAt: t, readAt: null });
      s.notifications.push({ id: newId("ntf"), organizationId: orgId, level: "info", title: "Demande de recharge envoyée", body: `${minutes} minutes — ATIE confirmera l’ajout.`, createdAt: t, readAt: null });
      audit(s, v.user.id, orgId, "topup.request", `${minutes} minutes`, "Demande client (démo)");
    });
    revalidatePath("/client", "layout");
    return { ok: true, message: `Demande de ${minutes} minutes envoyée. Aucun paiement n’a été effectué.`, simulated: true };
  } catch (e) {
    return fail(e);
  }
}

const planChangeSchema = z.object({
  planId: z.string().min(1, "Choisissez une formule."),
  message: z.string().trim().max(1000, "1000 caractères au maximum.").optional(),
});

export async function requestPlanChange(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await clientViewer("client.topup.request");
    const parsed = planChangeSchema.safeParse({ planId: data.get("planId"), message: data.get("message") ?? undefined });
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const orgId = v.organization.id;
    const result = await mutateStore((s) => {
      const plan = s.plans.find((p) => p.id === parsed.data.planId && p.active);
      if (!plan) return null;
      const t = now();
      s.supportRequests.push({
        id: newId("sup"), organizationId: orgId, kind: "contact", subject: `Changement de formule : ${plan.name}`,
        message: parsed.data.message || `Nous souhaitons passer à la formule ${plan.name}.`, status: "open", createdAt: t, updatedAt: t, createdBy: v.user.id,
      });
      audit(s, v.user.id, orgId, "subscription.change_request", plan.name, "Demande client (démo)");
      return plan.name;
    });
    if (!result) return { ok: false, message: "Formule indisponible.", errors: { planId: "Formule indisponible." } };
    revalidatePath("/client", "layout");
    return { ok: true, message: `Demande de passage à ${result} envoyée. ATIE vous recontactera ; rien n’est facturé pour l’instant.`, simulated: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Informations de l'entreprise
// ---------------------------------------------------------------------------

const orgSchema = z.object({
  contactName: z.string().trim().min(2, "Indiquez le nom du responsable.").max(120),
  contactEmail: z.string().trim().email("Adresse e-mail invalide."),
  phone: z.string().trim().min(6, "Numéro de téléphone invalide.").max(40),
  address: z.string().trim().min(3, "Indiquez l’adresse.").max(200),
  city: z.string().trim().min(2, "Indiquez la localité.").max(80),
  billingEmail: z.string().trim().email("Adresse e-mail invalide."),
  billingAddress: z.string().trim().min(5, "Indiquez l’adresse de facturation.").max(300),
  vatNumber: z.string().trim().max(40).optional(),
});

export async function updateClientOrganization(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await clientViewer("client.org.write");
    const parsed = orgSchema.safeParse(Object.fromEntries(["contactName", "contactEmail", "phone", "address", "city", "billingEmail", "billingAddress", "vatNumber"].map((k) => [k, data.get(k) ?? undefined])));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const orgId = v.organization.id;
    await mutateStore((s) => {
      const o = s.organizations.find((x) => x.id === orgId);
      if (!o) return;
      const { vatNumber, ...rest } = parsed.data;
      Object.assign(o, rest, { vatNumber: vatNumber ? vatNumber : null, updatedAt: now() });
      o.notificationPrefs = {
        quotaAlerts: data.get("quotaAlerts") === "on",
        newRequests: data.get("newRequests") === "on",
        monthlyReport: data.get("monthlyReport") === "on",
      };
      audit(s, v.user.id, orgId, "organization.update", o.name, "Mise à jour par le client");
    });
    revalidatePath("/client", "layout");
    return { ok: true, message: "Informations de l’entreprise enregistrées." };
  } catch (e) {
    return fail(e);
  }
}
