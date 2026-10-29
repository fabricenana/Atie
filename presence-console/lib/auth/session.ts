import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ID, Organization, Role, User } from "../domain/types";
import { readStore } from "../demo/store";
import { can, isAtieRole, type Permission } from "./permissions";

/**
 * Session de DÉMONSTRATION.
 *
 * Le sélecteur de rôle de /connexion n'est PAS une authentification : il ouvre une
 * session signée pour un utilisateur fictif. En production, ce module sera remplacé
 * par un fournisseur d'identité (mot de passe + 2FA ou SSO), mais les contrôles
 * `requireSession` / `requirePermission` / `requireClientOrg` restent identiques.
 */

export const SESSION_COOKIE = "atie_demo_session";
const g = globalThis as unknown as { __atieSessionKey?: Buffer };

function key(): Buffer {
  const env = process.env.ATIE_SESSION_SECRET;
  if (env && env.length >= 32) return Buffer.from(env);
  // Clé éphémère : les sessions de démo expirent au redémarrage du serveur.
  g.__atieSessionKey ??= randomBytes(32);
  return g.__atieSessionKey;
}

function sign(payload: string) {
  return createHmac("sha256", key()).update(payload).digest("base64url");
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

export interface Viewer {
  user: User;
  role: Role;
  /** Entreprise du client, résolue côté serveur depuis l'appartenance — jamais depuis l'URL. */
  organization: Organization | null;
  expiresAt: number;
}

/** Résout le rôle et l'entreprise d'un utilisateur à partir des données serveur. */
export function resolveViewer(uid: ID, exp: number): Viewer | null {
  const s = readStore();
  const user = s.users.find((u) => u.id === uid && u.status === "active");
  if (!user) return null;
  if (user.atieRole) return { user, role: user.atieRole, organization: null, expiresAt: exp };
  const membership = s.organizationUsers.find((m) => m.userId === uid);
  if (!membership) return null;
  const organization = s.organizations.find((o) => o.id === membership.organizationId) ?? null;
  if (!organization) return null;
  return { user, role: membership.role, organization, expiresAt: exp };
}

export async function getViewer(): Promise<Viewer | null> {
  const jar = await cookies();
  const p = decodeSession(jar.get(SESSION_COOKIE)?.value);
  return p ? resolveViewer(p.uid, p.exp) : null;
}

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
