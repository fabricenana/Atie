import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ID, Organization, Role, User } from "../domain/types";
import { isUuid, one, withStaff } from "../db";
import { ORG_COLS, USER_COLS } from "../repositories/sql";
import { can, isAtieRole, type Permission } from "./permissions";

/**
 * Session de la console.
 *
 * L'identité est vérifiée par Supabase Auth (lib/auth/login.ts) ; la console ouvre ensuite
 * sa propre session : jeton signé HMAC-SHA256 (identifiant atie.users + expiration) dans un
 * cookie httpOnly. À chaque requête, l'utilisateur est relu en base : un compte désactivé
 * perd l'accès immédiatement.
 */

export const SESSION_COOKIE = "atie_session";
const g = globalThis as unknown as { __atieSessionKey?: Buffer };

function key(): Buffer {
  const env = process.env.ATIE_SESSION_SECRET;
  if (env && env.length >= 32) return Buffer.from(env);
  if (process.env.NODE_ENV === "production") throw new Error("ATIE_SESSION_SECRET absente ou trop courte (32 caractères au moins).");
  // Développement local : clé éphémère, les sessions expirent au redémarrage du serveur.
  g.__atieSessionKey ??= randomBytes(32);
  return g.__atieSessionKey;
}

function sign(payload: string) {
  return createHmac("sha256", key()).update(payload).digest("base64url");
}

/** Empreinte non réversible d'une valeur (adresse IP du journal d'audit). */
export function fingerprint(value: string) {
  return createHmac("sha256", key()).update(`ip:${value}`).digest("base64url").slice(0, 16);
}

export interface SessionPayload {
  uid: ID;
  exp: number;
}

export function encodeSession(p: SessionPayload) {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function decodeSession(token: string | undefined, now = Date.now()): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(sign(body));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (typeof p.uid !== "string" || typeof p.exp !== "number" || p.exp < now) return null;
    return p;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = (maxAgeSeconds: number) => ({
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: maxAgeSeconds,
});

export interface Viewer {
  user: User;
  role: Role;
  /** Entreprise du client, résolue côté serveur depuis l'appartenance — jamais depuis l'URL. */
  organization: Organization | null;
  expiresAt: number;
}

type ViewerRow = User & { orgRole: "org_admin" | "org_viewer" | null; orgId: ID | null };

/** Résout le rôle et l'entreprise d'un utilisateur actif (lecture en base, rôle propriétaire). */
export async function resolveViewer(uid: ID, exp: number): Promise<Viewer | null> {
  if (!isUuid(uid)) return null;
  return withStaff(async (q) => {
    const row = await one<ViewerRow>(
      q,
      `SELECT ${USER_COLS}, m.role::text AS "orgRole", m.organization_id AS "orgId"
         FROM users u
         LEFT JOIN organization_users m ON m.user_id = u.id
        WHERE u.id = $1 AND u.status = 'active'
        ORDER BY m.created_at NULLS FIRST
        LIMIT 1`,
      [uid],
    );
    if (!row) return null;
    const { orgRole, orgId, ...user } = row;
    if (user.atieRole) return { user, role: user.atieRole, organization: null, expiresAt: exp };
    if (!orgRole || !orgId) return null;
    const organization = await one<Organization>(q, `SELECT ${ORG_COLS} FROM organizations o WHERE o.id = $1`, [orgId]);
    return organization ? { user, role: orgRole, organization, expiresAt: exp } : null;
  });
}

/** Utilisateur de la requête en cours (mémorisé le temps du rendu). */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const jar = await cookies();
  const p = decodeSession(jar.get(SESSION_COOKIE)?.value);
  return p ? resolveViewer(p.uid, p.exp) : null;
});

export async function requireSession(): Promise<Viewer> {
  const v = await getViewer();
  if (!v) redirect("/connexion?expired=1");
  return v;
}

/** Back-office : rôle ATIE obligatoire, plus la permission demandée. */
export async function requireAdmin(permission: Permission = "admin.access"): Promise<Viewer> {
  const v = await requireSession();
  if (!isAtieRole(v.role)) redirect("/client");
  if (!can(v.role, permission)) redirect("/admin?denied=1");
  return v;
}

/** Espace client : l'entreprise vient toujours de la session. */
export async function requireClient(permission: Permission = "client.access"): Promise<Viewer & { organization: Organization }> {
  const v = await requireSession();
  if (isAtieRole(v.role)) redirect("/admin");
  if (!v.organization || !can(v.role, permission)) redirect("/client?denied=1");
  return v as Viewer & { organization: Organization };
}

/** Pour les actions serveur : renvoie une erreur au lieu de rediriger. */
export class ForbiddenError extends Error {
  constructor(message = "Action non autorisée pour ce rôle.") {
    super(message);
  }
}

export async function assertPermission(permission: Permission): Promise<Viewer> {
  const v = await getViewer();
  if (!v) throw new ForbiddenError("Session expirée. Reconnectez-vous.");
  if (!can(v.role, permission)) throw new ForbiddenError();
  return v;
}
