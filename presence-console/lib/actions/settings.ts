"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors, type ActionResult } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { inviteAccount } from "../auth/invite";
import { audit, isUuid, one, pgCode, rows, withStaff } from "../db";
import { LANGS, type Lang } from "../domain/types";
import { loadPlatformSettings, saveSettings } from "../settings";

/** Paramètres de la plateforme, utilisateurs internes, notifications (atie.settings, atie.users). */

const fail = (e: unknown): ActionResult => ({
  ok: false,
  message: e instanceof ForbiddenError ? e.message : "L’enregistrement a échoué. Aucune donnée n’a été modifiée.",
});
const invalid = (issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): ActionResult => ({
  ok: false,
  message: "Vérifiez les champs signalés.",
  errors: fieldErrors(issues),
});
const done = (message: string): ActionResult => {
  revalidatePath("/admin", "layout");
  return { ok: true, message };
};

const langSchema = z.enum(LANGS as [Lang, ...Lang[]], { message: "Langue invalide." });

export async function updateProfile(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("admin.access");
    const parsed = z
      .object({ fullName: z.string().trim().min(2, "Nom trop court.").max(80, "80 caractères au plus.") })
      .safeParse({ fullName: data.get("fullName") ?? "" });
    if (!parsed.success) return invalid(parsed.error.issues);
    await withStaff(async (q) => {
      await q.query("UPDATE users SET full_name = $2, updated_at = now() WHERE id = $1", [v.user.id, parsed.data.fullName]);
      await audit(q, v.user.id, null, "user.profile", parsed.data.fullName, "Profil mis à jour");
    });
    return done("Profil enregistré.");
  } catch (e) {
    return fail(e);
  }
}

export async function savePlatformSettings(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("settings.write");
    const parsed = z
      .object({
        platformName: z.string().trim().min(2, "Nom trop court.").max(60, "60 caractères au plus."),
        defaultLang: langSchema,
        maxMinutes: z.coerce.number().min(1, "Au moins 1 minute.").max(30, "30 minutes au plus."),
        defaultRetentionDays: z.coerce.number().int("Nombre entier.").min(1, "Au moins 1 jour.").max(3650, "10 ans au plus."),
      })
      .safeParse({
        platformName: data.get("platformName") ?? "",
        defaultLang: data.get("defaultLang") ?? "",
        maxMinutes: data.get("maxMinutes") ?? "",
        defaultRetentionDays: data.get("defaultRetentionDays") ?? "",
      });
    if (!parsed.success) return invalid(parsed.error.issues);
    const p = parsed.data;
    const r = await withStaff<ActionResult | null>(async (q) => {
      const s = await loadPlatformSettings(q);
      if (!s.enabledLangs.includes(p.defaultLang)) {
        return { ok: false, message: "La langue par défaut doit être activée.", errors: { defaultLang: "Activez d’abord cette langue." } };
      }
      await saveSettings(
        q,
        "platform",
        { platformName: p.platformName, defaultLang: p.defaultLang, defaultMaxConversationSeconds: Math.round(p.maxMinutes * 60), defaultRetentionDays: p.defaultRetentionDays },
        v.user.id,
      );
      await audit(q, v.user.id, null, "settings.platform", "Paramètres de la plateforme", `Durée max ${p.maxMinutes} min, conservation ${p.defaultRetentionDays} j`);
      return null;
    });
    return r ?? done("Paramètres de la plateforme enregistrés.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveLanguages(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("settings.write");
    const langs = data.getAll("langs").map(String).filter((l): l is Lang => (LANGS as string[]).includes(l));
    if (langs.length === 0) return { ok: false, message: "Activez au moins une langue.", errors: { langs: "Au moins une langue." } };
    const r = await withStaff<ActionResult | null>(async (q) => {
      const s = await loadPlatformSettings(q);
      if (!langs.includes(s.defaultLang)) {
        return { ok: false, message: "La langue par défaut ne peut pas être désactivée.", errors: { langs: "Changez d’abord la langue par défaut." } };
      }
      const enabledLangs = LANGS.filter((l) => langs.includes(l));
      await saveSettings(q, "platform", { enabledLangs }, v.user.id);
      await audit(q, v.user.id, null, "settings.languages", "Langues", enabledLangs.join(", ").toUpperCase());
      return null;
    });
    return r ?? done("Langues enregistrées.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveAlertSettings(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("settings.write");
    const parsed = z
      .object({
        quotaAlertPct: z.coerce.number().int("Nombre entier.").min(50, "Entre 50 et 100 %.").max(100, "Entre 50 et 100 %."),
        notifyEmail: z.string().trim().email("Adresse e-mail invalide."),
      })
      .safeParse({ quotaAlertPct: data.get("quotaAlertPct") ?? "", notifyEmail: data.get("notifyEmail") ?? "" });
    if (!parsed.success) return invalid(parsed.error.issues);
    await withStaff(async (q) => {
      await saveSettings(q, "platform", { quotaAlertPct: parsed.data.quotaAlertPct, notifyEmail: parsed.data.notifyEmail }, v.user.id);
      await audit(q, v.user.id, null, "settings.alerts", "Alertes de consommation", `Seuil ${parsed.data.quotaAlertPct} %`);
    });
    return done("Alertes de consommation enregistrées. L’envoi d’e-mails d’alerte n’est pas encore connecté.");
  } catch (e) {
    return fail(e);
  }
}

export async function saveSecuritySettings(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("settings.write");
    const parsed = z
      .object({
        sessionTimeoutMinutes: z.coerce.number().int("Nombre entier.").min(5, "5 minutes au moins.").max(720, "12 heures au plus."),
        require2fa: z.boolean(),
      })
      .safeParse({ sessionTimeoutMinutes: data.get("sessionTimeoutMinutes") ?? "", require2fa: data.get("require2fa") === "on" });
    if (!parsed.success) return invalid(parsed.error.issues);
    await withStaff(async (q) => {
      await saveSettings(q, "platform", parsed.data, v.user.id);
      await audit(
        q,
        v.user.id,
        null,
        "settings.security",
        "Sécurité",
        `Session ${parsed.data.sessionTimeoutMinutes} min, 2FA ${parsed.data.require2fa ? "requise" : "facultative"}`,
      );
    });
    return done("Paramètres de sécurité enregistrés. La durée s’applique aux prochaines connexions.");
  } catch (e) {
    return fail(e);
  }
}

export async function markNotificationsRead(payload: Record<string, string>): Promise<ActionResult> {
  try {
    await assertPermission("admin.access");
    const all = payload.id === "all";
    if (!all && !isUuid(payload.id)) return { ok: false, message: "Notification introuvable." };
    const updated = await withStaff((q) =>
      rows(q, "UPDATE notifications SET read_at = now() WHERE read_at IS NULL AND ($1::uuid IS NULL OR id = $1::uuid) RETURNING id", [all ? null : payload.id]),
    );
    const count = updated.length;
    return done(count > 1 ? `${count} notifications marquées comme lues.` : count ? "Notification marquée comme lue." : "Aucune notification à mettre à jour.");
  } catch (e) {
    return fail(e);
  }
}

/** Invitation d'un membre du personnel ATIE : compte Supabase (e-mail) + atie.users avec rôle interne. */
export async function inviteUser(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("users.manage");
    const parsed = z
      .object({
        fullName: z.string().trim().min(2, "Nom trop court.").max(80, "80 caractères au plus."),
        email: z.string().trim().toLowerCase().email("Adresse e-mail invalide."),
        role: z.enum(["super_admin", "atie_admin", "atie_operator"], { message: "Rôle invalide." }),
      })
      .safeParse({ fullName: data.get("fullName") ?? "", email: data.get("email") ?? "", role: data.get("role") ?? "" });
    if (!parsed.success) return invalid(parsed.error.issues);
    const p = parsed.data;
    const dup = await withStaff((q) => one(q, "SELECT 1 FROM users WHERE email = $1", [p.email]));
    if (dup) return { ok: false, message: "Cette adresse est déjà utilisée.", errors: { email: "Adresse déjà utilisée." } };
    let account;
    try {
      account = await inviteAccount(p.email, p.fullName);
    } catch {
      return { ok: false, message: "Invitation impossible : le service d’authentification ne répond pas. Rien n’a été enregistré." };
    }
    await withStaff(async (q) => {
      await q.query("INSERT INTO users (email, full_name, atie_role, status, idp_subject) VALUES ($1, $2, $3::atie_role, 'invited', $4)", [
        p.email,
        p.fullName,
        p.role,
        account.subject,
      ]);
      await audit(q, v.user.id, null, "user.invite", p.fullName, p.role);
    });
    return done(
      account.existing
        ? `${p.fullName} ajouté. Ce compte existait déjà : il peut utiliser « Mot de passe oublié ».`
        : `Invitation envoyée à ${p.email}.`,
    );
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, message: "Cette adresse est déjà utilisée.", errors: { email: "Adresse déjà utilisée." } };
    return fail(e);
  }
}

export async function setUserStatus(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("users.manage");
    const status = payload.status === "disabled" ? "disabled" : payload.status === "active" ? "active" : null;
    if (!status) return { ok: false, message: "Statut invalide." };
    if (payload.id === v.user.id) return { ok: false, message: "Vous ne pouvez pas modifier votre propre accès." };
    if (!isUuid(payload.id)) return { ok: false, message: "Utilisateur introuvable." };
    const r = await withStaff<ActionResult>(async (q) => {
      const u = await one<{ fullName: string; atieRole: string; status: string }>(
        q,
        `SELECT full_name AS "fullName", atie_role::text AS "atieRole", status FROM users WHERE id = $1 AND atie_role IS NOT NULL FOR UPDATE`,
        [payload.id],
      );
      if (!u) return { ok: false, message: "Utilisateur introuvable." };
      if (status === "active" && u.status === "invited") return { ok: false, message: "Ce compte n’a pas encore accepté son invitation." };
      if (status === "disabled" && u.atieRole === "super_admin") {
        const left = await one<{ n: number }>(q, "SELECT count(*)::int AS n FROM users WHERE atie_role = 'super_admin' AND status = 'active' AND id <> $1", [payload.id]);
        if (!left?.n) return { ok: false, message: "Au moins un super administrateur doit rester actif." };
      }
      await q.query("UPDATE users SET status = $2, updated_at = now() WHERE id = $1", [payload.id, status]);
      await audit(q, v.user.id, null, status === "disabled" ? "user.disable" : "user.enable", u.fullName, "");
      return { ok: true, message: status === "disabled" ? `Accès de ${u.fullName} désactivé.` : `Accès de ${u.fullName} réactivé.` };
    });
    if (r.ok) revalidatePath("/admin", "layout");
    return r;
  } catch (e) {
    return fail(e);
  }
}
