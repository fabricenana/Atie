import "server-only";

/**
 * Client minimal de l'API Auth de Supabase (GoTrue), côté serveur uniquement, via fetch.
 *
 *  - clé anon : connexion par mot de passe, mot de passe oublié, définition du mot de passe ;
 *  - clé service : invitations (création de comptes par ATIE).
 *
 * Les jetons Supabase ne sont jamais conservés : la console ouvre sa propre session signée
 * (lib/auth/session.ts) et révoque aussitôt la session Supabase obtenue.
 * Aucune clé ni aucun jeton n'est journalisé ni renvoyé au navigateur.
 */

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const g = globalThis as unknown as { __atieAuthFetch?: FetchLike };
const doFetch: FetchLike = (input, init) => (g.__atieAuthFetch ?? fetch)(input, { ...init, signal: AbortSignal.timeout(10_000), cache: "no-store" });

/** Remplace fetch (tests uniquement : API Auth simulée). */
export function setAuthFetch(f: FetchLike | undefined) {
  g.__atieAuthFetch = f;
}

export class AuthUnavailableError extends Error {
  constructor() {
    super("Service d'authentification non configuré.");
  }
}

function endpoint(path: string, key: "anon" | "service") {
  const base = process.env.SUPABASE_URL?.replace(/\/+$/, "");
  const secret = key === "anon" ? process.env.SUPABASE_ANON_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !secret) throw new AuthUnavailableError();
  const headers: Record<string, string> = { apikey: secret, "Content-Type": "application/json" };
  if (key === "service") headers.Authorization = `Bearer ${secret}`;
  return { url: `${base}/auth/v1${path}`, headers };
}

async function json(res: Response): Promise<Record<string, unknown>> {
  try {
    const v = await res.json();
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function subjectOf(body: Record<string, unknown>): string | null {
  const user = (body.user ?? body) as Record<string, unknown>;
  return typeof user?.id === "string" ? user.id : null;
}

export type GrantResult =
  | { ok: true; subject: string; accessToken: string }
  | { ok: false; reason: "invalid" | "unavailable" };

/** POST /auth/v1/token?grant_type=password — identifiants e-mail + mot de passe. */
export async function passwordGrant(email: string, password: string): Promise<GrantResult> {
  try {
    const { url, headers } = endpoint("/token?grant_type=password", "anon");
    const res = await doFetch(url, { method: "POST", headers, body: JSON.stringify({ email, password }) });
    const body = await json(res);
    if (res.ok) {
      const subject = subjectOf(body);
      const accessToken = typeof body.access_token === "string" ? body.access_token : "";
      return subject && accessToken ? { ok: true, subject, accessToken } : { ok: false, reason: "unavailable" };
    }
    // 400 : identifiants invalides ou e-mail non confirmé ; 429 : limitation côté Supabase.
    return { ok: false, reason: res.status === 400 || res.status === 401 || res.status === 422 ? "invalid" : "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** POST /auth/v1/logout — révoque la session Supabase (la console garde la sienne). */
export async function revokeSupabaseSession(accessToken: string) {
  try {
    const { url, headers } = endpoint("/logout", "anon");
    await doFetch(url, { method: "POST", headers: { ...headers, Authorization: `Bearer ${accessToken}` } });
  } catch {
    // sans conséquence : le jeton expire de lui-même
  }
}

/** POST /auth/v1/recover — envoie le lien de réinitialisation (réponse identique que le compte existe ou non). */
export async function sendRecoveryEmail(email: string, redirectTo: string): Promise<boolean> {
  try {
    const { url, headers } = endpoint(`/recover?redirect_to=${encodeURIComponent(redirectTo)}`, "anon");
    const res = await doFetch(url, { method: "POST", headers, body: JSON.stringify({ email }) });
    return res.ok;
  } catch {
    return false;
  }
}

/** POST /auth/v1/verify — échange un token_hash (lien e-mail) contre un jeton d'accès. */
export async function verifyEmailToken(tokenHash: string, type: "recovery" | "invite"): Promise<string | null> {
  try {
    const { url, headers } = endpoint("/verify", "anon");
    const res = await doFetch(url, { method: "POST", headers, body: JSON.stringify({ type, token_hash: tokenHash }) });
    if (!res.ok) return null;
    const body = await json(res);
    return typeof body.access_token === "string" ? body.access_token : null;
  } catch {
    return null;
  }
}

export type PasswordUpdate = { ok: true; subject: string } | { ok: false; reason: "invalid_link" | "weak" | "unavailable" };

/** PUT /auth/v1/user — définit le mot de passe de l'utilisateur porteur du jeton. */
export async function updatePassword(accessToken: string, password: string): Promise<PasswordUpdate> {
  try {
    const { url, headers } = endpoint("/user", "anon");
    const res = await doFetch(url, { method: "PUT", headers: { ...headers, Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ password }) });
    const body = await json(res);
    if (res.ok) {
      const subject = subjectOf(body);
      return subject ? { ok: true, subject } : { ok: false, reason: "unavailable" };
    }
    if (res.status === 401 || res.status === 403) return { ok: false, reason: "invalid_link" };
    if (res.status === 422 || res.status === 400) return { ok: false, reason: "weak" };
    return { ok: false, reason: "unavailable" };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

/** GET /auth/v1/admin/users — recherche d'un compte par e-mail (clé service, pagination). */
export async function findAuthUserByEmail(email: string): Promise<{ id: string; confirmed: boolean } | null> {
  const wanted = email.trim().toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { url, headers } = endpoint(`/admin/users?page=${page}&per_page=200`, "service");
    const res = await doFetch(url, { method: "GET", headers });
    if (!res.ok) throw new AuthUnavailableError();
    const body = await json(res);
    const users = Array.isArray(body.users) ? (body.users as Array<Record<string, unknown>>) : [];
    const hit = users.find((u) => typeof u.email === "string" && u.email.toLowerCase() === wanted);
    if (hit && typeof hit.id === "string") return { id: hit.id, confirmed: Boolean(hit.email_confirmed_at || hit.confirmed_at) };
    if (users.length < 200) return null;
  }
  return null;
}

/**
 * POST /auth/v1/invite (clé service) — crée le compte et envoie l'e-mail d'invitation.
 * Si le compte existe déjà côté Supabase, renvoie son identifiant sans nouvel e-mail.
 */
export async function inviteAuthUser(email: string, fullName: string, redirectTo: string): Promise<{ subject: string; existing: boolean }> {
  const { url, headers } = endpoint(`/invite?redirect_to=${encodeURIComponent(redirectTo)}`, "service");
  const res = await doFetch(url, { method: "POST", headers, body: JSON.stringify({ email, data: { full_name: fullName } }) });
  const body = await json(res);
  if (res.ok) {
    const subject = subjectOf(body);
    if (subject) return { subject, existing: false };
    throw new AuthUnavailableError();
  }
  if (res.status === 422 || res.status === 409 || res.status === 400) {
    const found = await findAuthUserByEmail(email);
    if (found) return { subject: found.id, existing: true };
  }
  throw new AuthUnavailableError();
}
