"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../action-result";
import { fieldErrors } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { inviteAccount } from "../auth/invite";
import { audit, isUuid, one, pgCode, withStaff } from "../db";
import { loadPlatformSettings } from "../settings";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const domainRe = /^(?=.{3,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;
const uuid = z.string().refine(isUuid, "Identifiant invalide.");

const orgSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "3 caractères au moins.")
    .max(64, "64 caractères au plus.")
    .regex(slugRe, "Minuscules, chiffres et tirets uniquement (ex. cabinet-lumiere)."),
  sector: z.string().trim().min(2, "Indiquez le secteur.").max(120),
  contactName: z.string().trim().min(2, "Indiquez le responsable.").max(120),
  contactEmail: z.email("Adresse e-mail invalide."),
  phone: z.string().trim().max(40).default(""),
  address: z.string().trim().max(160).default(""),
  city: z.string().trim().min(2, "Indiquez la ville.").max(80),
  billingEmail: z.email("Adresse e-mail de facturation invalide."),
  vatNumber: z.string().trim().max(40).default(""),
});

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, message: e.message };
  return { ok: false, message: "L’opération n’a pas pu aboutir." };
}

function read(fd: FormData, keys: string[]) {
  return Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));
}

const ORG_KEYS = ["name", "slug", "sector", "contactName", "contactEmail", "phone", "address", "city", "billingEmail", "vatNumber"];

export async function createOrganization(_: ActionResult, fd: FormData): Promise<ActionResult & { id?: string }> {
  try {
    const v = await assertPermission("org.write");
    const parsed = orgSchema.safeParse(read(fd, ORG_KEYS));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const d = parsed.data;
    const id = await withStaff(async (q) => {
      if (await one(q, "SELECT 1 FROM organizations WHERE slug = $1", [d.slug])) return null;
      const settings = await loadPlatformSettings(q);
      const org = await one<{ id: string }>(
        q,
        `INSERT INTO organizations (slug, name, sector, contact_name, contact_email, phone, address, city, billing_email, billing_address, vat_number, retention_days)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
        [d.slug, d.name, d.sector, d.contactName, d.contactEmail, d.phone || null, d.address || null, d.city, d.billingEmail,
          [d.address, d.city].filter(Boolean).join(", "), d.vatNumber || null, settings.defaultRetentionDays],
      );
      // Identifiant public du widget (non secret), inscrit dans le script d'intégration.
      await q.query("INSERT INTO widget_installations (organization_id, public_key) VALUES ($1, $2)", [org!.id, `pk_${d.slug}`]);
      await audit(q, v.user.id, org!.id, "organization.create", d.name, "Création de l’entreprise");
      return org!.id;
    });
    if (!id) return { ok: false, message: "Cet identifiant est déjà utilisé.", errors: { slug: "Identifiant déjà utilisé par une autre entreprise." } };
    revalidatePath("/admin/entreprises");
    return { ok: true, message: `Entreprise « ${d.name} » créée.`, id };
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, message: "Cet identifiant est déjà utilisé.", errors: { slug: "Identifiant déjà utilisé." } };
    return fail(e);
  }
}

const updateSchema = orgSchema.omit({ slug: true }).extend({
  id: uuid,
  sector: z.string().trim().min(2, "Indiquez le secteur.").max(120),
  retentionDays: z.coerce.number().int().min(1, "Minimum 1 jour.").max(3650, "Maximum 3650 jours."),
});

export async function updateOrganization(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.write");
    const parsed = updateSchema.safeParse(read(fd, [...ORG_KEYS.filter((k) => k !== "slug"), "id", "retentionDays"]));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const d = parsed.data;
    const ok = await withStaff(async (q) => {
      const o = await one<{ name: string }>(
        q,
        `UPDATE organizations SET name = $2, sector = $3, contact_name = $4, contact_email = $5, phone = $6, address = $7, city = $8,
                billing_email = $9, vat_number = $10, retention_days = $11, updated_at = now()
          WHERE id = $1 RETURNING name`,
        [d.id, d.name, d.sector, d.contactName, d.contactEmail, d.phone || null, d.address || null, d.city, d.billingEmail, d.vatNumber || null, d.retentionDays],
      );
      if (!o) return false;
      await audit(q, v.user.id, d.id, "organization.update", o.name, "Informations générales modifiées");
      return true;
    });
    if (!ok) return { ok: false, message: "Entreprise introuvable." };
    revalidatePath(`/admin/entreprises/${d.id}`);
    revalidatePath("/admin/entreprises");
    return { ok: true, message: "Informations enregistrées." };
  } catch (e) {
    return fail(e);
  }
}

export async function setOrganizationSuspended(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.suspend");
    if (!isUuid(payload.id)) return { ok: false, message: "Entreprise introuvable." };
    const suspend = payload.suspend === "1";
    const name = await withStaff(async (q) => {
      const o = await one<{ name: string; status: string; activatedAt: string | null }>(
        q,
        `SELECT name, status::text AS status, activated_at AS "activatedAt" FROM organizations WHERE id = $1 FOR UPDATE`,
        [payload.id],
      );
      if (!o) return null;
      if (suspend && o.status === "suspended") return o.name;
      const status = suspend ? "suspended" : o.activatedAt ? "active" : "onboarding";
      await q.query("UPDATE organizations SET status = $2::org_status, updated_at = now() WHERE id = $1", [payload.id, status]);
      await q.query(
        "UPDATE subscriptions SET status = $2::subscription_status, auto_renew = $3, updated_at = now() WHERE organization_id = $1 AND status <> 'canceled'",
        [payload.id, suspend ? "suspended" : "active", !suspend],
      );
      await q.query(
        "UPDATE receptionists SET status = $2::receptionist_status, updated_at = now() WHERE organization_id = $1 AND status = $3::receptionist_status",
        [payload.id, suspend ? "paused" : "live", suspend ? "live" : "paused"],
      );
      await audit(q, v.user.id, payload.id, suspend ? "organization.suspend" : "organization.reactivate", o.name, suspend ? "Service suspendu" : "Service réactivé");
      return o.name;
    });
    if (!name) return { ok: false, message: "Entreprise introuvable." };
    revalidatePath(`/admin/entreprises/${payload.id}`);
    revalidatePath("/admin/entreprises");
    return {
      ok: true,
      message: suspend
        ? `${name} : service suspendu dans la console. Le backend Python n’est pas encore informé automatiquement.`
        : `${name} : service réactivé dans la console.`,
    };
  } catch (e) {
    return fail(e);
  }
}

const domainSchema = z.object({
  organizationId: uuid,
  domain: z
    .string()
    .trim()
    .toLowerCase()
    .transform((x) => x.replace(/^https?:\/\//, "").replace(/\/.*$/, ""))
    .pipe(z.string().regex(domainRe, "Nom de domaine invalide (ex. www.exemple.ch).")),
});

export async function addDomain(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.write");
    const parsed = domainSchema.safeParse(read(fd, ["organizationId", "domain"]));
    if (!parsed.success) return { ok: false, message: "Domaine invalide.", errors: fieldErrors(parsed.error.issues) };
    const { organizationId, domain } = parsed.data;
    const r = await withStaff(async (q) => {
      if (!(await one(q, "SELECT 1 FROM organizations WHERE id = $1", [organizationId]))) return "missing";
      if (await one(q, "SELECT 1 FROM website_domains WHERE domain = $1", [domain])) return "dup";
      await q.query("INSERT INTO website_domains (organization_id, domain) VALUES ($1, $2)", [organizationId, domain]);
      await audit(q, v.user.id, organizationId, "domain.add", domain, "Domaine autorisé ajouté");
      return "ok";
    });
    if (r === "missing") return { ok: false, message: "Entreprise introuvable." };
    if (r === "dup") return { ok: false, message: "Ce domaine est déjà enregistré.", errors: { domain: "Domaine déjà enregistré." } };
    revalidatePath(`/admin/entreprises/${organizationId}`);
    return { ok: true, message: `Domaine ${domain} ajouté, en attente de vérification.` };
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, message: "Ce domaine est déjà enregistré.", errors: { domain: "Domaine déjà enregistré." } };
    return fail(e);
  }
}

export async function removeDomain(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.write");
    if (!isUuid(payload.id) || !isUuid(payload.organizationId)) return { ok: false, message: "Domaine introuvable." };
    const r = await withStaff(async (q) => {
      const d = await one<{ domain: string }>(q, "DELETE FROM website_domains WHERE id = $1 AND organization_id = $2 RETURNING domain::text AS domain", [
        payload.id,
        payload.organizationId,
      ]);
      if (!d) return null;
      await audit(q, v.user.id, payload.organizationId, "domain.remove", d.domain, "Domaine retiré");
      return d.domain;
    });
    if (!r) return { ok: false, message: "Domaine introuvable." };
    revalidatePath(`/admin/entreprises/${payload.organizationId}`);
    return { ok: true, message: `Domaine ${r} retiré.` };
  } catch (e) {
    return fail(e);
  }
}

/** Vérification MANUELLE : ATIE atteste avoir contrôlé le domaine (aucune requête DNS ni HTTP automatique). */
export async function markDomainVerified(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.write");
    if (!isUuid(payload.id) || !isUuid(payload.organizationId)) return { ok: false, message: "Domaine introuvable." };
    const r = await withStaff(async (q) => {
      const d = await one<{ domain: string }>(
        q,
        "UPDATE website_domains SET verified = true, verified_at = now() WHERE id = $1 AND organization_id = $2 RETURNING domain::text AS domain",
        [payload.id, payload.organizationId],
      );
      if (!d) return null;
      await audit(q, v.user.id, payload.organizationId, "domain.verify_manual", d.domain, "Vérification manuelle par ATIE");
      return d.domain;
    });
    if (!r) return { ok: false, message: "Domaine introuvable." };
    revalidatePath(`/admin/entreprises/${payload.organizationId}`);
    return { ok: true, message: `${r} marqué comme vérifié (contrôle manuel).` };
  } catch (e) {
    return fail(e);
  }
}

const inviteSchema = z.object({
  organizationId: uuid,
  fullName: z.string().trim().min(2, "Indiquez le nom complet.").max(120),
  email: z.email("Adresse e-mail invalide.").transform((x) => x.trim().toLowerCase()),
  role: z.enum(["org_admin", "org_viewer"], { message: "Choisissez un rôle." }),
});

/** Invitation d'un utilisateur client : compte Supabase (e-mail d'invitation) + atie.users + appartenance. */
export async function inviteOrgUser(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.write");
    const parsed = inviteSchema.safeParse(read(fd, ["organizationId", "fullName", "email", "role"]));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const d = parsed.data;
    const pre = await withStaff(async (q) => {
      if (!(await one(q, "SELECT 1 FROM organizations WHERE id = $1", [d.organizationId]))) return "missing";
      if (await one(q, "SELECT 1 FROM users WHERE email = $1", [d.email])) return "dup";
      return "ok";
    });
    if (pre === "missing") return { ok: false, message: "Entreprise introuvable." };
    if (pre === "dup") return { ok: false, message: "Cette adresse est déjà utilisée.", errors: { email: "Adresse déjà utilisée." } };
    let account;
    try {
      account = await inviteAccount(d.email, d.fullName);
    } catch {
      return { ok: false, message: "Invitation impossible : le service d’authentification ne répond pas. Rien n’a été enregistré." };
    }
    await withStaff(async (q) => {
      const u = await one<{ id: string }>(
        q,
        "INSERT INTO users (email, full_name, status, idp_subject) VALUES ($1, $2, 'invited', $3) RETURNING id",
        [d.email, d.fullName, account.subject],
      );
      await q.query("INSERT INTO organization_users (organization_id, user_id, role) VALUES ($1, $2, $3::org_role)", [d.organizationId, u!.id, d.role]);
      await audit(q, v.user.id, d.organizationId, "user.invite", d.email, account.existing ? "Compte d’authentification existant" : "Invitation envoyée par e-mail");
    });
    revalidatePath(`/admin/entreprises/${d.organizationId}`);
    return {
      ok: true,
      message: account.existing
        ? `${d.email} ajouté. Ce compte existait déjà : l’utilisateur peut utiliser « Mot de passe oublié ».`
        : `Invitation envoyée à ${d.email}.`,
    };
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, message: "Cette adresse est déjà utilisée.", errors: { email: "Adresse déjà utilisée." } };
    return fail(e);
  }
}

export async function removeOrgUser(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.write");
    if (!isUuid(payload.membershipId) || !isUuid(payload.organizationId)) return { ok: false, message: "Utilisateur introuvable." };
    const r = await withStaff(async (q) => {
      const m = await one<{ userId: string }>(q, `DELETE FROM organization_users WHERE id = $1 AND organization_id = $2 RETURNING user_id AS "userId"`, [
        payload.membershipId,
        payload.organizationId,
      ]);
      if (!m) return null;
      const u = await one<{ email: string; fullName: string }>(q, `SELECT email::text AS email, full_name AS "fullName" FROM users WHERE id = $1`, [m.userId]);
      // Plus aucune appartenance : le compte est désactivé (la connexion est refusée).
      await q.query(
        "UPDATE users SET status = 'disabled', updated_at = now() WHERE id = $1 AND atie_role IS NULL AND NOT EXISTS (SELECT 1 FROM organization_users WHERE user_id = $1)",
        [m.userId],
      );
      await audit(q, v.user.id, payload.organizationId, "user.remove", u?.email ?? m.userId, "Accès retiré");
      return u?.fullName ?? "Utilisateur";
    });
    if (!r) return { ok: false, message: "Utilisateur introuvable." };
    revalidatePath(`/admin/entreprises/${payload.organizationId}`);
    return { ok: true, message: `Accès de ${r} retiré.` };
  } catch (e) {
    return fail(e);
  }
}
