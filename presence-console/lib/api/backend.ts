import "server-only";
import { z } from "zod";

/**
 * Client du backend Python Phase 2 (FastAPI) — PRÉPARÉ, NON CONNECTÉ.
 *
 * Le backend reste l'autorité pour les sessions, les quotas, les durées et la
 * consommation. La console ne duplique aucun contrôle métier : elle lit des
 * agrégats et délègue les actions (ex. fermeture forcée d'une session).
 *
 * Endpoints CONSTATÉS dans le widget existant (atie-theme/assets/presence/atie-presence.js) :
 *   POST   /session                 { tenant_id, language } → { session_id, url, token, max_minutes }
 *                                   429 = capacité saturée ; autre erreur = indisponible
 *   POST   /session/{id}/heartbeat  404 = bail expiré
 *   DELETE /session/{id}            fermeture salle LiveKit + libération de la place
 * Ces endpoints publics servent au widget ; la console ne les appelle jamais
 * (ils déclencheraient des sessions payantes).
 *
 * Endpoints PROPOSÉS pour la console (à implémenter côté Python, lecture seule
 * sauf mention) — voir docs/API-CONTRACTS.md :
 *   GET    /admin/tenants                         liste des tenants (config/tenants.json)
 *   GET    /admin/tenants/{tenant_id}/usage       quota de la période en cours
 *   GET    /admin/tenants/{tenant_id}/usage/daily?from&to
 *   GET    /admin/sessions?tenant_id&status&from&to&cursor
 *   GET    /admin/sessions/{session_id}           détail + événements
 *   GET    /admin/sessions/live                   sessions en cours
 *   POST   /admin/sessions/{session_id}/close     fermeture contrôlée (action privilégiée)
 *   GET    /admin/providers/status                état de configuration (jamais de secret)
 *   GET    /admin/providers/usage                 consommation fournisseurs constatée
 */

export const BACKEND_URL = process.env.ATIE_API_URL ?? null;
/** Jeton de service console → backend. Lu côté serveur uniquement, jamais exposé au navigateur. */
const SERVICE_TOKEN = process.env.ATIE_API_SERVICE_TOKEN ?? null;

export const isBackendConnected = () => Boolean(BACKEND_URL && SERVICE_TOKEN);

// ---------------------------------------------------------------------------
// Schémas des réponses attendues (validation à la frontière)
// ---------------------------------------------------------------------------

export const SessionStatusSchema = z.enum(["pending", "connecting", "active", "terminating", "ended", "failed", "close_unconfirmed"]);

export const TenantUsageSchema = z.object({
  tenant_id: z.string(),
  period_start: z.string(),
  period_end: z.string(),
  included_minutes: z.number(),
  topup_minutes: z.number(),
  used_seconds: z.number().int().nonnegative(),
  remaining_seconds: z.number().int(),
  sessions: z.number().int().nonnegative(),
  max_concurrent: z.number().int().positive(),
  budget_state: z.enum(["ok", "warning", "exhausted", "blocked"]),
});
export type TenantUsage = z.infer<typeof TenantUsageSchema>;

export const DailyUsageSchema = z.array(
  z.object({ day: z.string(), sessions: z.number().int(), billable_seconds: z.number().int() }),
);

export const SessionSchema = z.object({
  session_id: z.string(),
  tenant_id: z.string(),
  receptionist_id: z.string().nullable(),
  status: SessionStatusSchema,
  language: z.enum(["fr", "de", "it", "en"]),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  duration_seconds: z.number().int(),
  billable_seconds: z.number().int(),
  end_reason: z.string().nullable(),
  provider_cost_cents: z.number().int().nullable(),
  provider_cost_measured: z.boolean(),
  error: z.string().nullable(),
});
export type BackendSession = z.infer<typeof SessionSchema>;

export const SessionPageSchema = z.object({ items: z.array(SessionSchema), next_cursor: z.string().nullable() });

export const ProviderStatusSchema = z.array(
  z.object({
    provider: z.string(),
    configured: z.boolean(),
    key_hint: z.string().max(8).nullable(),
    connection: z.enum(["ok", "degraded", "down", "not_connected"]),
  }),
);

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class BackendNotConnectedError extends Error {
  constructor() {
    super("Backend ATIE non connecté (ATIE_API_URL / ATIE_API_SERVICE_TOKEN absents).");
  }
}

async function call<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  if (!isBackendConnected()) throw new BackendNotConnectedError();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    cache: "no-store",
    headers: { ...(init?.headers ?? {}), authorization: `Bearer ${SERVICE_TOKEN}`, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Backend ${res.status} sur ${path}`);
  return schema.parse(await res.json());
}

export const backend = {
  tenantUsage: (tenantId: string) => call(`/admin/tenants/${encodeURIComponent(tenantId)}/usage`, TenantUsageSchema),
  dailyUsage: (tenantId: string, from: string, to: string) =>
    call(`/admin/tenants/${encodeURIComponent(tenantId)}/usage/daily?from=${from}&to=${to}`, DailyUsageSchema),
  sessions: (q: { tenantId?: string; status?: string; cursor?: string }) => {
    const p = new URLSearchParams();
    if (q.tenantId) p.set("tenant_id", q.tenantId);
    if (q.status) p.set("status", q.status);
    if (q.cursor) p.set("cursor", q.cursor);
    return call(`/admin/sessions?${p}`, SessionPageSchema);
  },
  liveSessions: () => call(`/admin/sessions/live`, z.array(SessionSchema)),
  providerStatus: () => call(`/admin/providers/status`, ProviderStatusSchema),
  /** Action privilégiée : uniquement depuis une action serveur après assertPermission. */
  closeSession: (sessionId: string) =>
    call(`/admin/sessions/${encodeURIComponent(sessionId)}/close`, z.object({ closed: z.boolean() }), { method: "POST" }),
};
