import "server-only";
import { audit, one, withStaff } from "../db";
import { loadPlatformSettings } from "../settings";
import type { ID, Role } from "../domain/types";
import { createLimiter } from "./rate-limit";
import { fingerprint } from "./session";
import { passwordGrant, revokeSupabaseSession, updatePassword, verifyEmailToken } from "./supabase";

/**
 * Logique de connexion, indépendante de Next (testable) :
 * Supabase Auth vérifie l'identité, atie.users décide de l'accès.
 *
 * Messages volontairement génériques : rien ne permet de savoir si un compte existe,
 * s'il est désactivé ou s'il n'a pas d'accès à la console.
 */

export const LOGIN_FAILED = "E-mail ou mot de passe incorrect.";
export const AUTH_UNAVAILABLE = "Connexion momentanément indisponible. Réessayez dans un instant.";

/** 5 tentatives par quart d'heure pour un couple IP + e-mail. */
export const loginLimiter = createLimiter({ max: 5, windowMs: 15 * 60_000 });
/** Demandes de réinitialisation : 3 par heure et par IP + e-mail. */
export const recoveryLimiter = createLimiter({ max: 3, windowMs: 60 * 60_000 });

export type LoginResult =
  | { ok: true; userId: ID; role: Role | null; atie: boolean; sessionMinutes: number }
  | { ok: false; error: string };

export async function authenticate(email: string, password: string, ip: string): Promise<LoginResult> {
  const key = `${ip}|${email.trim().toLowerCase()}`;
  const gate = loginLimiter.hit(key);
  if (!gate.allowed) {
    const minutes = Math.max(1, Math.ceil(gate.retryAfterMs / 60_000));
    return { ok: false, error: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.` };
  }

  const grant = await passwordGrant(email.trim(), password);
  if (!grant.ok) return { ok: false, error: grant.reason === "invalid" ? LOGIN_FAILED : AUTH_UNAVAILABLE };
  // La console ouvre sa propre session : la session Supabase n'est pas conservée.
  await revokeSupabaseSession(grant.accessToken);

  const found = await withStaff(async (q) => {
    const user = await one<{ id: ID; atieRole: Role | null; orgRole: Role | null }>(
      q,
      `SELECT u.id, u.atie_role::text AS "atieRole",
              (SELECT m.role::text FROM organization_users m WHERE m.user_id = u.id ORDER BY m.created_at LIMIT 1) AS "orgRole"
         FROM users u
        WHERE u.idp_subject = $1 AND u.status = 'active'`,
      [grant.subject],
    );
    if (!user || (!user.atieRole && !user.orgRole)) return null;
    await q.query("UPDATE users SET last_login_at = now() WHERE id = $1", [user.id]);
    const orgId = user.atieRole
      ? null
      : (await one<{ id: ID }>(q, "SELECT organization_id AS id FROM organization_users WHERE user_id = $1 ORDER BY created_at LIMIT 1", [user.id]))?.id ?? null;
    await audit(q, user.id, orgId, "auth.login", "Console", `Connexion (${fingerprint(ip)})`);
    const settings = await loadPlatformSettings(q);
    return { ...user, sessionMinutes: settings.sessionTimeoutMinutes };
  });
  if (!found) return { ok: false, error: LOGIN_FAILED };

  loginLimiter.reset(key);
  const role = found.atieRole ?? found.orgRole;
  return { ok: true, userId: found.id, role, atie: Boolean(found.atieRole), sessionMinutes: found.sessionMinutes };
}

export type NewPasswordResult = { ok: true } | { ok: false; error: string };

/**
 * Définition du mot de passe au retour d'un lien e-mail (réinitialisation ou invitation).
 * Le lien porte soit un token_hash (échangé ici via /auth/v1/verify), soit un jeton
 * d'accès déjà émis par Supabase (fragment #access_token du lien par défaut).
 * Une invitation acceptée active le compte atie.users correspondant.
 */
export async function defineNewPassword(input: {
  password: string;
  tokenHash?: string;
  type?: "recovery" | "invite";
  accessToken?: string;
}): Promise<NewPasswordResult> {
  const invalidLink = "Ce lien n’est plus valide. Demandez un nouveau lien depuis « Mot de passe oublié ».";
  const token = input.tokenHash ? await verifyEmailToken(input.tokenHash, input.type ?? "recovery") : input.accessToken || null;
  if (!token) return { ok: false, error: invalidLink };
  const r = await updatePassword(token, input.password);
  if (!r.ok) {
    if (r.reason === "invalid_link") return { ok: false, error: invalidLink };
    if (r.reason === "weak") return { ok: false, error: "Mot de passe refusé : choisissez-en un plus long ou différent de l’ancien." };
    return { ok: false, error: AUTH_UNAVAILABLE };
  }
  await revokeSupabaseSession(token);
  await withStaff(async (q) => {
    const activated = await one<{ id: ID }>(
      q,
      "UPDATE users SET status = 'active', updated_at = now() WHERE idp_subject = $1 AND status = 'invited' RETURNING id",
      [r.subject],
    );
    if (activated) await audit(q, activated.id, null, "user.activate", "Console", "Invitation acceptée, mot de passe défini");
  });
  return { ok: true };
}
