"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors, type ActionResult } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { mutateStore, newId, resetStore } from "../demo/store";
import { LANGS, type Lang } from "../domain/types";
import { audit } from "./audit";

/** Paramètres de la plateforme, utilisateurs internes, notifications (démo locale). */

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
    await mutateStore((s) => {
      const u = s.users.find((x) => x.id === v.user.id);
      if (u) u.fullName = parsed.data.fullName;
      audit(s, v.user.id, null, "user.profile", parsed.data.fullName, "Profil mis à jour");
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
    const r = await mutateStore<ActionResult | null>((s) => {
      if (!s.settings.enabledLangs.includes(p.defaultLang)) {
        return { ok: false, message: "La langue par défaut doit être activée.", errors: { defaultLang: "Activez d’abord cette langue." } };
      }
      s.settings.platformName = p.platformName;
      s.settings.defaultLang = p.defaultLang;
      s.settings.defaultMaxConversationSeconds = Math.round(p.maxMinutes * 60);
      s.settings.defaultRetentionDays = p.defaultRetentionDays;
      audit(s, v.user.id, null, "settings.platform", "Paramètres de la plateforme", `Durée max ${p.maxMinutes} min, conservation ${p.defaultRetentionDays} j`);
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
    const r = await mutateStore<ActionResult | null>((s) => {
      if (!langs.includes(s.settings.defaultLang)) {
        return { ok: false, message: "La langue par défaut ne peut pas être désactivée.", errors: { langs: "Changez d’abord la langue par défaut." } };
      }
      s.settings.enabledLangs = LANGS.filter((l) => langs.includes(l));
      audit(s, v.user.id, null, "settings.languages", "Langues", s.settings.enabledLangs.join(", ").toUpperCase());
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
    await mutateStore((s) => {
      s.settings.quotaAlertPct = parsed.data.quotaAlertPct;
      s.settings.notifyEmail = parsed.data.notifyEmail;
      audit(s, v.user.id, null, "settings.alerts", "Alertes de consommation", `Seuil ${parsed.data.quotaAlertPct} %`);
    });
    return done("Alertes de consommation enregistrées. Aucun e-mail n’est envoyé en démonstration.");
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
    await mutateStore((s) => {
      s.settings.sessionTimeoutMinutes = parsed.data.sessionTimeoutMinutes;
      s.settings.require2fa = parsed.data.require2fa;
      audit(s, v.user.id, null, "settings.security", "Sécurité", `Session ${parsed.data.sessionTimeoutMinutes} min, 2FA ${parsed.data.require2fa ? "requise" : "facultative"}`);
    });
    return done("Paramètres de sécurité enregistrés. La durée s’applique aux prochaines connexions.");
  } catch (e) {
    return fail(e);
  }
}

export async function markNotificationsRead(payload: Record<string, string>): Promise<ActionResult> {
  try {
    await assertPermission("admin.access");
    const count = await mutateStore((s) => {
      const now = new Date().toISOString();
      let n = 0;
      for (const x of s.notifications) {
        if (x.readAt) continue;
        if (payload.id === "all" || x.id === payload.id) {
          x.readAt = now;
          n++;
        }
      }
      return n;
    });
    return done(count > 1 ? `${count} notifications marquées comme lues.` : "Notification marquée comme lue.");
  } catch (e) {
    return fail(e);
  }
}

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
    const r = await mutateStore<ActionResult | null>((s) => {
      if (s.users.some((u) => u.email === p.email)) return { ok: false, message: "Cette adresse est déjà utilisée.", errors: { email: "Adresse déjà utilisée." } };
      const now = new Date().toISOString();
      s.users.push({ id: newId("usr"), email: p.email, fullName: p.fullName, atieRole: p.role, status: "invited", lastLoginAt: null, createdAt: now, demo: true });
      audit(s, v.user.id, null, "user.invite", p.fullName, p.role);
      return null;
    });
    return r ?? done(`Invitation préparée pour ${p.fullName}. Aucun e-mail n’est envoyé en démonstration.`);
  } catch (e) {
    return fail(e);
  }
}

export async function setUserStatus(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("users.manage");
    const status = payload.status === "disabled" ? "disabled" : payload.status === "active" ? "active" : null;
    if (!status) return { ok: false, message: "Statut invalide." };
    if (payload.id === v.user.id) return { ok: false, message: "Vous ne pouvez pas modifier votre propre accès." };
    const r = await mutateStore<ActionResult>((s) => {
      const u = s.users.find((x) => x.id === payload.id && x.atieRole);
      if (!u) return { ok: false, message: "Utilisateur introuvable." };
      if (status === "disabled" && u.atieRole === "super_admin" && s.users.filter((x) => x.atieRole === "super_admin" && x.status === "active").length <= 1) {
        return { ok: false, message: "Au moins un super administrateur doit rester actif." };
      }
      u.status = status;
      audit(s, v.user.id, null, status === "disabled" ? "user.disable" : "user.enable", u.fullName, "");
      return { ok: true, message: status === "disabled" ? `Accès de ${u.fullName} désactivé.` : `Accès de ${u.fullName} réactivé.` };
    });
    if (r.ok) revalidatePath("/admin", "layout");
    return r;
  } catch (e) {
    return fail(e);
  }
}

export async function resetDemoData(_payload: Record<string, string>): Promise<ActionResult> {
  try {
    await assertPermission("demo.reset");
    await mutateStore(() => undefined);
    resetStore();
    revalidatePath("/", "layout");
    return { ok: true, message: "Données de démonstration réinitialisées." };
  } catch (e) {
    return fail(e);
  }
}
