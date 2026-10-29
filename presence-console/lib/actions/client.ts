"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { TOPUP_OPTIONS } from "../domain/pricing";
import type { ActionResult } from "../action-result";
import { fieldErrors } from "../action-result";
import { assertPermission, ForbiddenError, type Viewer } from "../auth/session";
import type { Permission } from "../auth/permissions";
import { audit, isUuid, one, rows, withOrg } from "../db";

/**
 * Actions de l'espace client.
 *
 * L'entreprise concernée provient TOUJOURS de la session serveur, jamais du formulaire.
 * Chaque écriture passe par withOrg : rôle atie_app + RLS sur cette entreprise, audit
 * dans la même transaction. Les demandes (recharge, changement de formule) n'entraînent
 * aucun paiement : ATIE les traite depuis le back-office.
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

/** Notification interne pour l'équipe ATIE (organization_id NULL ; le client ne peut pas la relire). */
const NOTIFY_ATIE = "INSERT INTO notifications (organization_id, level, title, body) VALUES (NULL, 'info', $1, $2)";

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
    const d = parsed.data;
    await withOrg(orgId, async (q) => {
      await q.query("INSERT INTO support_requests (organization_id, kind, subject, message, created_by) VALUES ($1, $2, $3, $4, $5)", [
        orgId,
        d.kind,
        d.subject,
        d.message,
        v.user.id,
      ]);
      await q.query(NOTIFY_ATIE, [`Nouvelle demande : ${v.organization.name}`, d.subject]);
      await audit(q, v.user.id, orgId, "support.create", d.subject, d.kind);
    });
    revalidatePath("/client", "layout");
    return { ok: true, message: "Demande envoyée à l’équipe ATIE. Vous la retrouvez dans l’historique." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Demandes laissées par les visiteurs
// ---------------------------------------------------------------------------

const requestStatusSchema = z.object({
  id: z.string().refine(isUuid, "Demande introuvable."),
  status: z.enum(["new", "in_progress", "done", "archived"], { message: "Statut invalide." }),
});

export async function updateVisitorRequestStatus(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await clientViewer("client.requests.update");
    const parsed = requestStatusSchema.safeParse({ id: data.get("id"), status: data.get("status") });
    if (!parsed.success) return { ok: false, message: "Statut invalide.", errors: fieldErrors(parsed.error.issues) };
    const orgId = v.organization.id;
    const found = await withOrg(orgId, async (q) => {
      const r = await one<{ name: string }>(
        q,
        `UPDATE visitor_requests SET status = $3 WHERE id = $1 AND organization_id = $2 RETURNING visitor_name AS name`,
        [parsed.data.id, orgId, parsed.data.status],
      );
      if (!r) return false;
      await audit(q, v.user.id, orgId, "visitor_request.status", r.name, parsed.data.status);
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
    if (!all && !isUuid(payload.id)) return { ok: false, message: "Aucune notification à mettre à jour." };
    const updated = await withOrg(orgId, (q) =>
      rows(
        q,
        "UPDATE notifications SET read_at = now() WHERE organization_id = $1 AND read_at IS NULL AND ($2::uuid IS NULL OR id = $2::uuid) RETURNING id",
        [orgId, all ? null : payload.id],
      ),
    );
    revalidatePath("/client", "layout");
    return updated.length
      ? { ok: true, message: all ? "Toutes les notifications sont marquées comme lues." : "Notification marquée comme lue." }
      : { ok: false, message: "Aucune notification à mettre à jour." };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Recharges et changement de formule (mode demande, aucun paiement)
// ---------------------------------------------------------------------------

const topupSchema = z.object({
  minutes: z.coerce
    .number()
    .int()
    .refine((m) => TOPUP_OPTIONS.some((o) => o.minutes === m), "Choisissez une recharge."),
});

export async function requestTopup(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await clientViewer("client.topup.request");
    const parsed = topupSchema.safeParse({ minutes: data.get("minutes") });
    if (!parsed.success) return { ok: false, message: "Choisissez une recharge.", errors: fieldErrors(parsed.error.issues) };
    const orgId = v.organization.id;
    const option = TOPUP_OPTIONS.find((o) => o.minutes === parsed.data.minutes)!;
    await withOrg(orgId, async (q) => {
      await q.query("INSERT INTO minute_topups (organization_id, minutes, price_cents, status, requested_by) VALUES ($1, $2, $3, 'requested', $4)", [
        orgId,
        option.minutes,
        option.priceCents,
        v.user.id,
      ]);
      await q.query(NOTIFY_ATIE, [`Recharge demandée : ${v.organization.name}`, `${option.minutes} minutes`]);
      await q.query("INSERT INTO notifications (organization_id, level, title, body) VALUES ($1, 'info', $2, $3)", [
        orgId,
        "Demande de recharge envoyée",
        `${option.minutes} minutes — ATIE confirmera l’ajout.`,
      ]);
      await audit(q, v.user.id, orgId, "topup.request", `${option.minutes} minutes`, "Demande client");
    });
    revalidatePath("/client", "layout");
    return { ok: true, message: `Demande de ${option.minutes} minutes envoyée. Aucun paiement n’a été effectué.` };
  } catch (e) {
    return fail(e);
  }
}

const planChangeSchema = z.object({
  planId: z.string().refine(isUuid, "Choisissez une formule."),
  message: z.string().trim().max(1000, "1000 caractères au maximum.").optional(),
});

export async function requestPlanChange(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await clientViewer("client.topup.request");
    const parsed = planChangeSchema.safeParse({ planId: data.get("planId"), message: data.get("message") ?? undefined });
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const orgId = v.organization.id;
    const result = await withOrg(orgId, async (q) => {
      const plan = await one<{ name: string }>(q, "SELECT name FROM plans WHERE id = $1 AND active", [parsed.data.planId]);
      if (!plan) return null;
      await q.query("INSERT INTO support_requests (organization_id, kind, subject, message, created_by) VALUES ($1, 'contact', $2, $3, $4)", [
        orgId,
        `Changement de formule : ${plan.name}`,
        parsed.data.message || `Nous souhaitons passer à la formule ${plan.name}.`,
        v.user.id,
      ]);
      await q.query(NOTIFY_ATIE, [`Changement de formule demandé : ${v.organization.name}`, plan.name]);
      await audit(q, v.user.id, orgId, "subscription.change_request", plan.name, "Demande client");
      return plan.name;
    });
    if (!result) return { ok: false, message: "Formule indisponible.", errors: { planId: "Formule indisponible." } };
    revalidatePath("/client", "layout");
    return { ok: true, message: `Demande de passage à ${result} envoyée. ATIE vous recontactera ; rien n’est facturé pour l’instant.` };
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
    const parsed = orgSchema.safeParse(
      Object.fromEntries(["contactName", "contactEmail", "phone", "address", "city", "billingEmail", "billingAddress", "vatNumber"].map((k) => [k, data.get(k) ?? undefined])),
    );
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const orgId = v.organization.id;
    const d = parsed.data;
    const prefs = {
      quotaAlerts: data.get("quotaAlerts") === "on",
      newRequests: data.get("newRequests") === "on",
      monthlyReport: data.get("monthlyReport") === "on",
    };
    const ok = await withOrg(orgId, async (q) => {
      const o = await one<{ name: string }>(
        q,
        `UPDATE organizations SET contact_name = $2, contact_email = $3, phone = $4, address = $5, city = $6, billing_email = $7,
                billing_address = $8, vat_number = $9, notification_prefs = $10::jsonb, updated_at = now()
          WHERE id = $1 RETURNING name`,
        [orgId, d.contactName, d.contactEmail, d.phone, d.address, d.city, d.billingEmail, d.billingAddress, d.vatNumber || null, JSON.stringify(prefs)],
      );
      if (!o) return false;
      await audit(q, v.user.id, orgId, "organization.update", o.name, "Mise à jour par le client");
      return true;
    });
    if (!ok) return { ok: false, message: "Entreprise introuvable." };
    revalidatePath("/client", "layout");
    return { ok: true, message: "Informations de l’entreprise enregistrées." };
  } catch (e) {
    return fail(e);
  }
}
