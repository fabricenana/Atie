import "server-only";
import { headers } from "next/headers";

/** Adresse IP du visiteur (premier saut déclaré par le proxy), pour la limitation des tentatives. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip")?.trim() || "inconnue";
}

/**
 * Adresse publique de la console, pour les liens envoyés par e-mail.
 * ATIE_CONSOLE_URL si définie, sinon déduite de la requête. Supabase n'accepte de
 * rediriger que vers les adresses autorisées dans sa configuration (Redirect URLs).
 */
export async function consoleOrigin(): Promise<string> {
  const env = process.env.ATIE_CONSOLE_URL;
  if (env) return env.replace(/\/+$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3100";
  const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1)(:|$)/.test(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export const PASSWORD_PATH = "/connexion/nouveau-mot-de-passe";
