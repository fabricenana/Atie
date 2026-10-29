"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../action-result";
import { fieldErrors } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { mutateStore, newId } from "../demo/store";
import { audit } from "./audit";

const slugRe = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const domainRe = /^(?=.{3,253}$)(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

const orgSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(120),
  slug: z.string().trim().toLowerCase().regex(slugRe, "Minuscules, chiffres et tirets uniquement (ex. cabinet-lumiere)."),
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
    const result = await mutateStore((s) => {
      if (s.organizations.some((o) => o.slug === d.slug)) return { dup: true as const };
      const now = new Date().toISOString();
      const id = newId("org");
      s.organizations.push({
        id,
        slug: d.slug,
        name: d.name,
        sector: d.sector,
        contactName: d.contactName,
        contactEmail: d.contactEmail,
        phone: d.phone,
        address: d.address,
        city: d.city,
        country: "CH",
        status: "onboarding",
        activatedAt: null,
        createdAt: now,
        updatedAt: now,
        billingEmail: d.billingEmail,
        billingAddress: [d.address, d.city].filter(Boolean).join(", "),
        vatNumber: d.vatNumber || null,
        notificationPrefs: { quotaAlerts: true, newRequests: true, monthlyReport: true },
        retentionDays: s.settings.defaultRetentionDays,
        transcriptsEnabled: false,
        demo: true,
      });
      s.widgetInstallations.push({
        id: newId("wdg"),
        organizationId: id,
        receptionistId: null,
        publicKey: `pk_demo_${d.slug}`,
        position: "right",
        accent: "#E31E24",
        status: "not_configured",
        platform: "generic",
        lastSeenAt: null,
        createdAt: now,
      });
      audit(s, v.user.id, id, "organization.create", d.name, "Création de l’entreprise");
      return { id };
    });
    if ("dup" in result) return { ok: false, message: "Cet identifiant est déjà utilisé.", errors: { slug: "Identifiant déjà utilisé par une autre entreprise." } };
    revalidatePath("/admin/entreprises");
    return { ok: true, message: `Entreprise « ${d.name} » créée (démo).`, id: result.id };
  } catch (e) {
    return fail(e);
  }
}

const updateSchema = orgSchema.omit({ slug: true }).extend({
  id: z.string().min(1),
  sector: z.string().trim().min(2, "Indiquez le secteur.").max(120),
  retentionDays: z.coerce.number().int().min(1, "Minimum 1 jour.").max(3650, "Maximum 3650 jours."),
});

export async function updateOrganization(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.write");
    const parsed = updateSchema.safeParse(read(fd, [...ORG_KEYS.filter((k) => k !== "slug"), "id", "retentionDays"]));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const d = parsed.data;
    const ok = await mutateStore((s) => {
      const o = s.organizations.find((x) => x.id === d.id);
      if (!o) return false;
      Object.assign(o, {
        name: d.name,
        sector: d.sector,
        contactName: d.contactName,
        contactEmail: d.contactEmail,
        phone: d.phone,
        address: d.address,
        city: d.city,
        billingEmail: d.billingEmail,
        vatNumber: d.vatNumber || null,
        retentionDays: d.retentionDays,
        updatedAt: new Date().toISOString(),
      });
      audit(s, v.user.id, o.id, "organization.update", o.name, "Informations générales modifiées");
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
    const suspend = payload.suspend === "1";
    const r = await mutateStore((s) => {
      const o = s.organizations.find((x) => x.id === payload.id);
      if (!o) return null;
      if (suspend && o.status === "suspended") return o.name;
      o.status = suspend ? "suspended" : o.activatedAt ? "active" : "onboarding";
      o.updatedAt = new Date().toISOString();
      for (const sub of s.subscriptions.filter((x) => x.organizationId === o.id && x.status !== "canceled")) {
        sub.status = suspend ? "suspended" : "active";
        sub.autoRenew = !suspend;
      }
      for (const r of s.receptionists.filter((x) => x.organizationId === o.id && (suspend ? x.status === "live" : x.status === "paused"))) {
        r.status = suspend ? "paused" : "live";
      }
      audit(s, v.user.id, o.id, suspend ? "organization.suspend" : "organization.reactivate", o.name, suspend ? "Service suspendu" : "Service réactivé");
      return o.name;
    });
    if (!r) return { ok: false, message: "Entreprise introuvable." };
    revalidatePath(`/admin/entreprises/${payload.id}`);
    revalidatePath("/admin/entreprises");
    return { ok: true, message: suspend ? `${r} : service suspendu (démo).` : `${r} : service réactivé (démo).` };
  } catch (e) {
    return fail(e);
  }
}

const domainSchema = z.object({
  organizationId: z.string().min(1),
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
    const r = await mutateStore((s) => {
      const o = s.organizations.find((x) => x.id === organizationId);
      if (!o) return "missing";
      if (s.websiteDomains.some((d) => d.domain === domain)) return "dup";
      s.websiteDomains.push({ id: newId("dom"), organizationId, domain, verified: false, verifiedAt: null, createdAt: new Date().toISOString() });
      audit(s, v.user.id, organizationId, "domain.add", domain, "Domaine autorisé ajouté");
      return "ok";
    });
    if (r === "missing") return { ok: false, message: "Entreprise introuvable." };
    if (r === "dup") return { ok: false, message: "Ce domaine est déjà enregistré.", errors: { domain: "Domaine déjà enregistré." } };
    revalidatePath(`/admin/entreprises/${organizationId}`);
    return { ok: true, message: `Domaine ${domain} ajouté, en attente de vérification.` };
  } catch (e) {
    return fail(e);
  }
}

export async function removeDomain(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.write");
    const r = await mutateStore((s) => {
      const i = s.websiteDomains.findIndex((d) => d.id === payload.id && d.organizationId === payload.organizationId);
      if (i < 0) return null;
      const [d] = s.websiteDomains.splice(i, 1);
      audit(s, v.user.id, d.organizationId, "domain.remove", d.domain, "Domaine retiré");
      return d.domain;
    });
    if (!r) return { ok: false, message: "Domaine introuvable." };
    revalidatePath(`/admin/entreprises/${payload.organizationId}`);
    return { ok: true, message: `Domaine ${r} retiré.` };
  } catch (e) {
    return fail(e);
  }
}

/** Vérification SIMULÉE : aucune requête DNS ni HTTP n'est effectuée. */
export async function markDomainVerified(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.write");
    const r = await mutateStore((s) => {
      const d = s.websiteDomains.find((x) => x.id === payload.id && x.organizationId === payload.organizationId);
      if (!d) return null;
      d.verified = true;
      d.verifiedAt = new Date().toISOString();
      audit(s, v.user.id, d.organizationId, "domain.verify_simulated", d.domain, "Vérification simulée (démo)");
      return d.domain;
    });
    if (!r) return { ok: false, message: "Domaine introuvable." };
    revalidatePath(`/admin/entreprises/${payload.organizationId}`);
    return { ok: true, simulated: true, message: `${r} marqué comme vérifié — simulation, aucun contrôle réel.` };
  } catch (e) {
    return fail(e);
  }
}

const inviteSchema = z.object({
  organizationId: z.string().min(1),
  fullName: z.string().trim().min(2, "Indiquez le nom complet.").max(120),
  email: z.email("Adresse e-mail invalide."),
  role: z.enum(["org_admin", "org_viewer"], { message: "Choisissez un rôle." }),
});

/** Invitation SIMULÉE : aucun e-mail n'est envoyé. */
export async function inviteOrgUser(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.write");
    const parsed = inviteSchema.safeParse(read(fd, ["organizationId", "fullName", "email", "role"]));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const d = parsed.data;
    const r = await mutateStore((s) => {
      if (!s.organizations.some((o) => o.id === d.organizationId)) return "missing";
      if (s.users.some((u) => u.email.toLowerCase() === d.email.toLowerCase())) return "dup";
      const now = new Date().toISOString();
      const uid = newId("usr");
      s.users.push({ id: uid, email: d.email, fullName: d.fullName, atieRole: null, status: "invited", lastLoginAt: null, createdAt: now, demo: true });
      s.organizationUsers.push({ id: newId("oru"), organizationId: d.organizationId, userId: uid, role: d.role, createdAt: now });
      audit(s, v.user.id, d.organizationId, "user.invite_simulated", d.email, "Invitation simulée (aucun e-mail envoyé)");
      return "ok";
    });
    if (r === "missing") return { ok: false, message: "Entreprise introuvable." };
    if (r === "dup") return { ok: false, message: "Cette adresse est déjà utilisée.", errors: { email: "Adresse déjà utilisée." } };
    revalidatePath(`/admin/entreprises/${d.organizationId}`);
    return { ok: true, simulated: true, message: `Invitation enregistrée pour ${d.email} — aucun e-mail envoyé (démo).` };
  } catch (e) {
    return fail(e);
  }
}

export async function removeOrgUser(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("org.write");
    const r = await mutateStore((s) => {
      const i = s.organizationUsers.findIndex((m) => m.id === payload.membershipId && m.organizationId === payload.organizationId);
      if (i < 0) return null;
      const [m] = s.organizationUsers.splice(i, 1);
      const u = s.users.find((x) => x.id === m.userId);
      if (u && !s.organizationUsers.some((x) => x.userId === u.id)) u.status = "disabled";
      audit(s, v.user.id, m.organizationId, "user.remove", u?.email ?? m.userId, "Accès retiré");
      return u?.fullName ?? "Utilisateur";
    });
    if (!r) return { ok: false, message: "Utilisateur introuvable." };
    revalidatePath(`/admin/entreprises/${payload.organizationId}`);
    return { ok: true, message: `Accès de ${r} retiré.` };
  } catch (e) {
    return fail(e);
  }
}
