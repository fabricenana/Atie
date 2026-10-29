import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { setDatabase, type Database, type Queryable } from "@/lib/db";
import type { Dataset } from "../fixtures/seed";

/**
 * Base PostgreSQL de test (PGlite, Postgres compilé en WASM, en mémoire).
 *
 * Applique db/migrations/001 (avec db/schema.sql à la place de « \ir ») puis 002, tels
 * quels. Seul ce qui est fourni par Supabase est recréé au préalable : rôles anon et
 * authenticated, schéma « extensions » avec pgcrypto et citext.
 * Le rôle courant de PGlite (« postgres ») est superutilisateur : il joue le rôle
 * propriétaire du personnel ATIE ; SET ROLE atie_app applique réellement la RLS.
 */

const DB_DIR = path.resolve(process.cwd(), "db");
const read = (p: string) => readFileSync(path.join(DB_DIR, p), "utf8");

export function migration001() {
  // Remplacement par fonction : le texte inséré contient des « $$ » (blocs DO).
  return read("migrations/001_atie_schema.sql").replace("\\ir ../schema.sql", () => read("schema.sql"));
}
export const migration002 = () => read("migrations/002_app_role.sql");

export async function createTestDb(): Promise<PGlite> {
  const pg = await PGlite.create({ extensions: { citext, pgcrypto } });
  await pg.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA extensions;
    CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
  `);
  await pg.exec(migration001());
  await pg.exec(migration002());
  return pg;
}

/** Branche l'application sur la base de test (même contrat que node-postgres). */
export function useTestDb(pg: PGlite) {
  const db: Database = {
    transaction: (setup, fn) =>
      pg.transaction(async (tx) => {
        for (const sql of setup) await tx.query(sql);
        return fn(tx as unknown as Queryable);
      }),
  };
  setDatabase(db);
  return db;
}

/** UUID déterministe pour un identifiant de la fixture (org_lumiere → uuid stable). */
export function uuidFor(id: string) {
  const h = createHash("md5").update(`atie-fixture:${id}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Sujet Supabase (auth.users.id) attribué à un utilisateur de la fixture. */
export const subjectFor = (userId: string) => uuidFor(`idp:${userId}`);

type Obj = Record<string, unknown>;

async function insert(pg: PGlite, table: string, list: Obj[]) {
  if (!list.length) return;
  const cols = Object.keys(list[0]);
  const names = cols.join(", ");
  await pg.query(`INSERT INTO atie.${table} (${names}) SELECT ${names} FROM json_populate_recordset(NULL::atie.${table}, $1::json)`, [JSON.stringify(list)]);
}

/**
 * Insère le jeu de données de test. Les formules (migration 001) et les avatars
 * (migration 002) existent déjà : les identifiants de la fixture y sont rattachés par code.
 * Renvoie la fonction de correspondance identifiant fixture → UUID.
 */
export async function loadFixture(pg: PGlite, s: Dataset) {
  const plans = (await pg.query<{ id: string; code: string }>("SELECT id, code FROM atie.plans")).rows;
  const avatars = (await pg.query<{ id: string; ref: string }>("SELECT id, provider_avatar_id AS ref FROM atie.avatars")).rows;
  const known = new Map<string, string>();
  for (const p of plans) known.set(`pln_${p.code}`, p.id);
  for (const a of s.avatars) {
    const row = avatars.find((x) => x.ref === a.providerAvatarId);
    if (row) known.set(a.id, row.id);
  }
  const M = (id: string | null | undefined) => (id == null ? null : known.get(id) ?? uuidFor(id));

  await insert(pg, "users", s.users.map((u) => ({
    id: M(u.id), email: u.email, full_name: u.fullName, atie_role: u.atieRole, status: u.status,
    idp_subject: subjectFor(u.id), last_login_at: u.lastLoginAt, created_at: u.createdAt,
  })));
  await insert(pg, "organizations", s.organizations.map((o) => ({
    id: M(o.id), slug: o.slug, name: o.name, sector: o.sector, contact_name: o.contactName, contact_email: o.contactEmail,
    phone: o.phone, address: o.address, city: o.city, country: o.country, status: o.status, activated_at: o.activatedAt,
    created_at: o.createdAt, updated_at: o.updatedAt, billing_email: o.billingEmail, billing_address: o.billingAddress,
    vat_number: o.vatNumber, notification_prefs: o.notificationPrefs, retention_days: o.retentionDays, transcripts_enabled: o.transcriptsEnabled,
  })));
  await insert(pg, "organization_users", s.organizationUsers.map((m) => ({
    id: M(m.id), organization_id: M(m.organizationId), user_id: M(m.userId), role: m.role, created_at: m.createdAt,
  })));
  await insert(pg, "website_domains", s.websiteDomains.map((d) => ({
    id: M(d.id), organization_id: M(d.organizationId), domain: d.domain, verified: d.verified, verified_at: d.verifiedAt, created_at: d.createdAt,
  })));
  await insert(pg, "receptionists", s.receptionists.map((r) => ({
    id: M(r.id), organization_id: M(r.organizationId), avatar_id: M(r.avatarId), name: r.name, role: r.role, voice: r.voice,
    primary_lang: r.primaryLang, secondary_langs: r.secondaryLangs, tone: r.tone, business_instructions: r.businessInstructions,
    greeting: r.greeting, fallback_reply: r.fallbackReply, after_hours_behavior: r.afterHoursBehavior,
    max_conversation_seconds: r.maxConversationSeconds, allowed_services: r.allowedServices, status: r.status,
    last_activity_at: r.lastActivityAt, created_at: r.createdAt, updated_at: r.updatedAt,
  })));
  await insert(pg, "knowledge_sources", s.knowledgeSources.map((k) => ({
    id: M(k.id), organization_id: M(k.organizationId), kind: k.kind, title: k.title, category: k.category, origin: k.origin,
    index_status: k.indexStatus, current_version: k.currentVersion, created_at: k.createdAt, updated_at: k.updatedAt, updated_by: M(k.updatedBy),
  })));
  await insert(pg, "knowledge_documents", s.knowledgeDocuments.map((d) => ({
    id: M(d.id), source_id: M(d.sourceId), organization_id: M(d.organizationId), version: d.version, content: d.content,
    size_bytes: d.sizeBytes, created_at: d.createdAt, created_by: M(d.createdBy),
  })));
  await insert(pg, "widget_installations", s.widgetInstallations.map((w) => ({
    id: M(w.id), organization_id: M(w.organizationId), receptionist_id: M(w.receptionistId), public_key: w.publicKey,
    position: w.position, accent: w.accent, status: w.status, platform: w.platform, last_seen_at: w.lastSeenAt, created_at: w.createdAt,
  })));
  await insert(pg, "conversations", s.conversations.map((c) => ({
    id: M(c.id), organization_id: M(c.organizationId), receptionist_id: M(c.receptionistId), backend_session_id: c.backendSessionId,
    started_at: c.startedAt, ended_at: c.endedAt, duration_seconds: c.durationSeconds, lang: c.lang, status: c.status,
    end_reason: c.endReason, billable_seconds: c.billableSeconds, provider_cost_cents: c.providerCostCents,
    provider_cost_origin: c.providerCostOrigin, error: c.error, transcript_available: c.transcriptAvailable,
  })));
  await insert(pg, "conversation_events", s.conversationEvents.map((e) => ({
    conversation_id: M(e.conversationId), organization_id: M(e.organizationId), at: e.at, type: e.type, detail: e.detail,
  })));
  await insert(pg, "subscriptions", s.subscriptions.map((x) => ({
    id: M(x.id), organization_id: M(x.organizationId), plan_id: M(x.planId), status: x.status, activated_at: x.activatedAt,
    current_period_start: x.currentPeriodStart, current_period_end: x.currentPeriodEnd, auto_renew: x.autoRenew,
    alert_threshold_pct: x.alertThresholdPct, created_at: x.createdAt, updated_at: x.updatedAt,
  })));
  await insert(pg, "minute_topups", s.minuteTopups.map((t) => ({
    id: M(t.id), organization_id: M(t.organizationId), minutes: t.minutes, price_cents: t.priceCents, status: t.status,
    requested_at: t.requestedAt, applied_at: t.appliedAt, requested_by: M(t.requestedBy),
  })));
  await insert(pg, "concurrency_entitlements", s.concurrencyEntitlements.map((c) => ({
    id: M(c.id), organization_id: M(c.organizationId), extra_sessions: c.extraSessions, monthly_price_cents: c.monthlyPriceCents,
    status: c.status, starts_at: c.startsAt,
  })));
  await insert(pg, "invoices", s.invoices.map((i) => ({
    id: M(i.id), organization_id: M(i.organizationId), number: i.number, kind: i.kind, issued_at: i.issuedAt, due_at: i.dueAt,
    status: i.status, total_cents: i.totalCents,
  })));
  await insert(pg, "invoice_lines", s.invoices.flatMap((i) => i.lines.map((l) => ({
    invoice_id: M(i.id), label: l.label, quantity: l.quantity, unit_price_cents: l.unitPriceCents,
  }))));
  await insert(pg, "payments", s.payments.map((p) => ({
    id: M(p.id), invoice_id: M(p.invoiceId), organization_id: M(p.organizationId), amount_cents: p.amountCents,
    method: p.method, status: p.status, at: p.at,
  })));
  await insert(pg, "visitor_requests", s.visitorRequests.map((v) => ({
    id: M(v.id), organization_id: M(v.organizationId), conversation_id: M(v.conversationId), kind: v.kind, visitor_name: v.visitorName,
    visitor_contact: v.visitorContact, summary: v.summary, lang: v.lang, status: v.status, created_at: v.createdAt,
    expires_at: new Date(new Date(v.createdAt).getTime() + 30 * 86_400_000).toISOString(),
  })));
  await insert(pg, "support_requests", s.supportRequests.map((x) => ({
    id: M(x.id), organization_id: M(x.organizationId), kind: x.kind, subject: x.subject, message: x.message, status: x.status,
    created_by: M(x.createdBy), created_at: x.createdAt, updated_at: x.updatedAt,
  })));
  await insert(pg, "notifications", s.notifications.map((n) => ({
    id: M(n.id), organization_id: M(n.organizationId), level: n.level, title: n.title, body: n.body, created_at: n.createdAt, read_at: n.readAt,
  })));
  await insert(pg, "audit_events", s.auditEvents.map((a) => ({
    organization_id: M(a.organizationId), actor_id: M(a.actorId), action: a.action, target: a.target, detail: a.detail, at: a.at,
  })));
  return M as (id: string) => string;
}
