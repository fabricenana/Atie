import { randomUUID } from "node:crypto";
import { setAuthFetch } from "@/lib/auth/supabase";

/**
 * API Auth de Supabase simulée (GoTrue) : aucune requête réseau.
 * Couvre les routes utilisées par la console et enregistre chaque appel.
 */

export interface Call {
  method: string;
  path: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export function fakeAuth() {
  const accounts = new Map<string, { id: string; password: string | null; confirmed: boolean }>();
  const tokens = new Map<string, string>();
  const hashes = new Map<string, string>();
  const calls: Call[] = [];
  let down = false;

  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const issue = (subject: string) => {
    const t = `jeton-${randomUUID()}`;
    tokens.set(t, subject);
    return t;
  };

  const handler = async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    const headers = Object.fromEntries(new Headers(init?.headers).entries());
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
    const method = init?.method ?? "GET";
    const path = url.pathname.replace(/^\/auth\/v1/, "");
    calls.push({ method, path: `${path}${url.search}`, headers, body });
    if (down) return json(503, { msg: "indisponible" });
    const bearer = headers.authorization?.replace(/^Bearer /, "") ?? "";

    if (method === "POST" && path === "/token" && url.searchParams.get("grant_type") === "password") {
      const a = accounts.get(String(body.email).toLowerCase());
      if (!a || !a.password || a.password !== body.password) return json(400, { error: "invalid_grant", error_description: "Invalid login credentials" });
      return json(200, { access_token: issue(a.id), token_type: "bearer", user: { id: a.id, email: body.email } });
    }
    if (method === "POST" && path === "/logout") {
      tokens.delete(bearer);
      return new Response(null, { status: 204 });
    }
    if (method === "POST" && path === "/recover") {
      const a = accounts.get(String(body.email).toLowerCase());
      if (a) hashes.set(`hash-${a.id}`, a.id);
      return json(200, {});
    }
    if (method === "POST" && path === "/verify") {
      const subject = hashes.get(String(body.token_hash));
      if (!subject) return json(403, { error_code: "otp_expired" });
      hashes.delete(String(body.token_hash));
      return json(200, { access_token: issue(subject), user: { id: subject } });
    }
    if (method === "PUT" && path === "/user") {
      const subject = tokens.get(bearer);
      if (!subject) return json(401, { msg: "invalid JWT" });
      if (String(body.password).length < 6) return json(422, { error_code: "weak_password" });
      for (const a of accounts.values()) if (a.id === subject) Object.assign(a, { password: body.password, confirmed: true });
      return json(200, { id: subject });
    }
    if (method === "POST" && path === "/invite") {
      const email = String(body.email).toLowerCase();
      if (accounts.has(email)) return json(422, { error_code: "email_exists" });
      const id = randomUUID();
      accounts.set(email, { id, password: null, confirmed: false });
      hashes.set(`invite-${id}`, id);
      return json(200, { id, email });
    }
    if (method === "GET" && path === "/admin/users") {
      const users = [...accounts.entries()].map(([email, a]) => ({ id: a.id, email, email_confirmed_at: a.confirmed ? new Date().toISOString() : null }));
      return json(200, { users });
    }
    return json(404, { msg: "route inconnue" });
  };

  setAuthFetch(handler);
  return {
    calls,
    addAccount: (email: string, id: string, password: string) => accounts.set(email.toLowerCase(), { id, password, confirmed: true }),
    accountId: (email: string) => accounts.get(email.toLowerCase())?.id ?? null,
    activeTokens: () => tokens.size,
    setDown: (v: boolean) => {
      down = v;
    },
    restore: () => setAuthFetch(undefined),
  };
}
