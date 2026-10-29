#!/usr/bin/env node
/**
 * Amorçage du premier super administrateur ATIE.
 *
 *   node scripts/bootstrap-admin.mjs prenom.nom@exemple.ch "Prénom Nom"
 *
 * Variables d'environnement lues (jamais affichées) :
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL
 *   ATIE_CONSOLE_URL (facultative, défaut https://console.atie.ch) : adresse du lien d'invitation
 *   DATABASE_CA_CERT (facultative) : certificat de l'autorité pour vérifier TLS
 *
 * Rejouable :
 *   1. cherche le compte Supabase Auth par e-mail ; s'il n'existe pas, l'invite
 *      (e-mail avec lien vers /connexion/nouveau-mot-de-passe) ;
 *   2. crée ou met à jour la ligne atie.users (rôle super_admin, idp_subject = id Supabase).
 *      Statut « active » si le compte Supabase a déjà confirmé son adresse, sinon « invited »
 *      (activé quand le mot de passe est défini depuis le lien) ;
 *   3. journalise l'opération dans atie.audit_events.
 * Un compte déjà en place n'est pas modifié (hormis le rattachement idp_subject manquant).
 */
import pg from "pg";

const [, , rawEmail, ...nameParts] = process.argv;
const email = (rawEmail ?? "").trim().toLowerCase();
const fullName = nameParts.join(" ").trim() || email.split("@")[0];

function fail(message) {
  console.error(`Échec : ${message}`);
  process.exit(1);
}

if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  fail('usage : node scripts/bootstrap-admin.mjs <e-mail> "<Nom complet>"');
}
const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "DATABASE_URL"].filter((k) => !process.env[k]);
if (missing.length) fail(`variables d'environnement manquantes : ${missing.join(", ")}`);

const base = process.env.SUPABASE_URL.replace(/\/+$/, "");
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const consoleUrl = (process.env.ATIE_CONSOLE_URL || "https://console.atie.ch").replace(/\/+$/, "");
const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" };

async function auth(path, init = {}) {
  const res = await fetch(`${base}/auth/v1${path}`, { ...init, headers, signal: AbortSignal.timeout(15_000) });
  let body = {};
  try {
    body = await res.json();
  } catch {
    // corps vide
  }
  return { status: res.status, ok: res.ok, body };
}

async function findAuthUser() {
  for (let page = 1; page <= 50; page++) {
    const r = await auth(`/admin/users?page=${page}&per_page=200`);
    if (!r.ok) fail(`API Auth (liste des comptes) : HTTP ${r.status}`);
    const users = Array.isArray(r.body.users) ? r.body.users : [];
    const hit = users.find((u) => typeof u.email === "string" && u.email.toLowerCase() === email);
    if (hit) return { id: hit.id, confirmed: Boolean(hit.email_confirmed_at || hit.confirmed_at), invited: false };
    if (users.length < 200) return null;
  }
  return null;
}

async function inviteAuthUser() {
  const redirect = encodeURIComponent(`${consoleUrl}/connexion/nouveau-mot-de-passe`);
  const r = await auth(`/invite?redirect_to=${redirect}`, { method: "POST", body: JSON.stringify({ email, data: { full_name: fullName } }) });
  if (!r.ok || typeof r.body.id !== "string") fail(`API Auth (invitation) : HTTP ${r.status}`);
  return { id: r.body.id, confirmed: false, invited: true };
}

/** Même règle TLS que la console (lib/db/pg.ts). */
function poolConfig(url) {
  const u = new URL(url);
  const sslmode = u.searchParams.get("sslmode");
  for (const k of ["sslmode", "sslrootcert", "sslcert", "sslkey", "uselibpqcompat"]) u.searchParams.delete(k);
  const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(u.hostname);
  const ca = process.env.DATABASE_CA_CERT;
  const ssl = sslmode === "disable" || (local && !sslmode) ? false : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
  return { connectionString: u.toString(), ssl, max: 1, connectionTimeoutMillis: 15_000, application_name: "atie-bootstrap" };
}

const authUser = (await findAuthUser()) ?? (await inviteAuthUser());

const pool = new pg.Pool(poolConfig(process.env.DATABASE_URL));
pool.on("error", () => undefined);
const client = await pool.connect().catch((e) => fail(`connexion à la base impossible (${e.code ?? "erreur réseau"})`));
let outcome;
try {
  await client.query("BEGIN");
  await client.query("SET LOCAL search_path = atie, extensions");
  const existing = (await client.query("SELECT id, atie_role::text AS role, status, idp_subject FROM users WHERE email = $1 FOR UPDATE", [email])).rows[0];
  const status = authUser.confirmed ? "active" : "invited";
  if (!existing) {
    const { rows } = await client.query(
      "INSERT INTO users (email, full_name, atie_role, status, idp_subject) VALUES ($1, $2, 'super_admin', $3, $4) RETURNING id",
      [email, fullName, status, authUser.id],
    );
    await client.query("INSERT INTO audit_events (actor_id, action, target, detail) VALUES ($1, 'user.bootstrap', $2, $3)", [
      rows[0].id,
      fullName,
      "Premier super administrateur (script d'amorçage)",
    ]);
    outcome = `créé (statut ${status})`;
  } else {
    if (existing.idp_subject && existing.idp_subject !== authUser.id) {
      throw new Error("ce compte atie.users est déjà rattaché à un autre compte Supabase : vérification manuelle nécessaire");
    }
    if (!existing.idp_subject) await client.query("UPDATE users SET idp_subject = $2, updated_at = now() WHERE id = $1", [existing.id, authUser.id]);
    // Adresse confirmée entre-temps côté Supabase : l'invitation est considérée comme acceptée.
    const activate = existing.status === "invited" && authUser.confirmed;
    if (activate) await client.query("UPDATE users SET status = 'active', updated_at = now() WHERE id = $1", [existing.id]);
    outcome = `déjà présent (rôle ${existing.role ?? "aucun rôle ATIE"}, statut ${activate ? "active" : existing.status})${activate ? "" : " — inchangé"}`;
    if (existing.role !== "super_admin") outcome += " ; ATTENTION : ce compte n'est pas super administrateur";
  }
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK").catch(() => undefined);
  client.release();
  await pool.end();
  fail(e instanceof Error ? e.message : "erreur inconnue");
}
client.release();
await pool.end();

console.log(`Super administrateur ${email} : ${outcome}.`);
if (authUser.invited) console.log(`Invitation envoyée : le lien mène à ${consoleUrl}/connexion/nouveau-mot-de-passe.`);
else if (!authUser.confirmed) console.log("Compte Supabase existant non confirmé : utilisez « Mot de passe oublié » sur /connexion.");
else console.log("Compte Supabase déjà confirmé : connexion possible avec son mot de passe (sinon « Mot de passe oublié »).");
