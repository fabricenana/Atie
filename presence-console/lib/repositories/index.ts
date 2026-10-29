import "server-only";
import type {
  Avatar,
  ConcurrencyEntitlement,
  Conversation,
  ConversationEvent,
  ID,
  Incident,
  Invoice,
  KnowledgeDocument,
  KnowledgeSource,
  MinuteTopup,
  Notification,
  Organization,
  OrganizationUser,
  Payment,
  Plan,
  PlatformSettings,
  ProviderStatus,
  ProviderUsage,
  Receptionist,
  Subscription,
  SupportRequest,
  UsageRecord,
  User,
  VisitorRequest,
  WebsiteDomain,
  WidgetInstallation,
  AuditEvent,
} from "../domain/types";
import { computeQuota, type QuotaState } from "../domain/quota";
import { isUuid, one, rows, type Queryable } from "../db";
import { read, type Scope } from "../db/scope";
import { DEFAULT_PLATFORM_SETTINGS, loadPlatformSettings } from "../settings";
import { BACKEND_URL } from "../api/backend";
import {
  AUDIT_COLS,
  AVATAR_COLS,
  CONCURRENCY_COLS,
  CONVERSATION_CLIENT_COLS,
  CONVERSATION_COLS,
  DOMAIN_COLS,
  EVENT_COLS,
  INVOICE_COLS,
  KNOWLEDGE_COLS,
  KNOWLEDGE_DOC_COLS,
  MEMBERSHIP_COLS,
  NOTIFICATION_COLS,
  ORG_COLS,
  PAYMENT_COLS,
  PLAN_COLS,
  RECEPTIONIST_COLS,
  SUBSCRIPTION_COLS,
  SUPPORT_COLS,
  TOPUP_COLS,
  USER_COLS,
  VISITOR_REQUEST_COLS,
  WIDGET_COLS,
} from "./sql";

export type { QuotaState } from "../domain/quota";

/**
 * Couche de lecture (repositories) sur PostgreSQL.
 *
 * Toutes les pages passent par ces fonctions (asynchrones). Chaque appel ouvre une
 * transaction dans la portée de l'utilisateur (lib/db/scope.ts) : personnel ATIE en
 * rôle propriétaire, client en rôle atie_app avec RLS sur son entreprise.
 *
 * Isolation multi-tenant : les fonctions « ForOrg » filtrent toujours sur l'organisation
 * reçue ; dans l'espace client, cet identifiant provient exclusivement de la session
 * (requireClient) et la RLS refuse de toute façon les autres entreprises.
 *
 * Un identifiant qui n'est pas un UUID (URL modifiée) donne « introuvable », jamais une erreur SQL.
 */

const none = <T>(): Promise<T[]> => Promise.resolve([]);

// ---------------------------------------------------------------------------
// Entreprises et utilisateurs
// ---------------------------------------------------------------------------

export const listOrganizations = () =>
  read((q) => rows<Organization>(q, `SELECT ${ORG_COLS} FROM organizations o ORDER BY o.name`)).then((xs) =>
    xs.sort((a, b) => a.name.localeCompare(b.name, "fr")),
  );

export const getOrganization = (id: ID) =>
  isUuid(id) ? read((q) => one<Organization>(q, `SELECT ${ORG_COLS} FROM organizations o WHERE o.id = $1`, [id])) : Promise.resolve(null);

export const listDomainsForOrg = (orgId: ID) =>
  isUuid(orgId)
    ? read((q) => rows<WebsiteDomain>(q, `SELECT ${DOMAIN_COLS} FROM website_domains d WHERE d.organization_id = $1 ORDER BY d.created_at`, [orgId]))
    : none<WebsiteDomain>();

/** Tous les domaines (back-office), pour les tableaux multi-entreprises. */
export const listDomains = () => read((q) => rows<WebsiteDomain>(q, `SELECT ${DOMAIN_COLS} FROM website_domains d ORDER BY d.created_at`));

export async function listOrgUsers(orgId: ID): Promise<Array<{ membership: OrganizationUser; user: User }>> {
  if (!isUuid(orgId)) return [];
  const list = await read((q) =>
    rows<OrganizationUser & { user: User }>(
      q,
      `SELECT ${MEMBERSHIP_COLS}, json_build_object('id', u.id, 'email', u.email::text, 'fullName', u.full_name,
              'atieRole', u.atie_role::text, 'status', u.status, 'lastLoginAt', u.last_login_at, 'createdAt', u.created_at) AS "user"
         FROM organization_users m JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = $1
        ORDER BY m.created_at`,
      [orgId],
    ),
  );
  return list.map(({ user, ...membership }) => ({ membership, user }));
}

export const listAtieUsers = () =>
  read((q) => rows<User>(q, `SELECT ${USER_COLS} FROM users u WHERE u.atie_role IS NOT NULL ORDER BY u.full_name`));

export const getUser = (id: ID | null) =>
  isUuid(id) ? read((q) => one<User>(q, `SELECT ${USER_COLS} FROM users u WHERE u.id = $1`, [id])) : Promise.resolve(null);

// ---------------------------------------------------------------------------
// Réceptionnistes et avatars
// ---------------------------------------------------------------------------

export const listAvatars = () => read((q) => rows<Avatar>(q, `SELECT ${AVATAR_COLS} FROM avatars a ORDER BY a.name`));
export const getAvatar = (id: ID | null) =>
  isUuid(id) ? read((q) => one<Avatar>(q, `SELECT ${AVATAR_COLS} FROM avatars a WHERE a.id = $1`, [id])) : Promise.resolve(null);
export const listReceptionists = () =>
  read((q) => rows<Receptionist>(q, `SELECT ${RECEPTIONIST_COLS} FROM receptionists r ORDER BY r.name, r.created_at`));
export const getReceptionist = (id: ID | null) =>
  isUuid(id) ? read((q) => one<Receptionist>(q, `SELECT ${RECEPTIONIST_COLS} FROM receptionists r WHERE r.id = $1`, [id])) : Promise.resolve(null);
export const getReceptionistForOrg = (orgId: ID) =>
  isUuid(orgId)
    ? read((q) =>
        one<Receptionist>(
          q,
          `SELECT ${RECEPTIONIST_COLS} FROM receptionists r WHERE r.organization_id = $1 ORDER BY (r.status = 'live') DESC, r.created_at LIMIT 1`,
          [orgId],
        ),
      )
    : Promise.resolve(null);

// ---------------------------------------------------------------------------
// Knowledge Base
// ---------------------------------------------------------------------------

export const listKnowledgeForOrg = (orgId: ID) =>
  isUuid(orgId)
    ? read((q) => rows<KnowledgeSource>(q, `SELECT ${KNOWLEDGE_COLS} FROM knowledge_sources k WHERE k.organization_id = $1 ORDER BY k.updated_at DESC`, [orgId]))
    : none<KnowledgeSource>();

/** Un document n'est rendu que si la source appartient à l'organisation demandée. */
export async function getKnowledgeSourceForOrg(orgId: ID, sourceId: ID) {
  if (!isUuid(orgId) || !isUuid(sourceId)) return null;
  return read(async (q) => {
    const source = await one<KnowledgeSource>(q, `SELECT ${KNOWLEDGE_COLS} FROM knowledge_sources k WHERE k.id = $1 AND k.organization_id = $2`, [sourceId, orgId]);
    if (!source) return null;
    const versions = await rows<KnowledgeDocument>(
      q,
      `SELECT ${KNOWLEDGE_DOC_COLS} FROM knowledge_documents kd WHERE kd.source_id = $1 AND kd.organization_id = $2 ORDER BY kd.version DESC`,
      [sourceId, orgId],
    );
    return { source, versions };
  });
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export const listWidgets = () => read((q) => rows<WidgetInstallation>(q, `SELECT ${WIDGET_COLS} FROM widget_installations w ORDER BY w.created_at`));
export const getWidgetForOrg = (orgId: ID) =>
  isUuid(orgId)
    ? read((q) => one<WidgetInstallation>(q, `SELECT ${WIDGET_COLS} FROM widget_installations w WHERE w.organization_id = $1 ORDER BY w.created_at LIMIT 1`, [orgId]))
    : Promise.resolve(null);

// ---------------------------------------------------------------------------
// Sessions et consommation (écrites par le backend Python ; vides tant qu'il n'écrit rien)
// ---------------------------------------------------------------------------

const convCols = (scope: Scope) => (scope.kind === "staff" ? CONVERSATION_COLS : CONVERSATION_CLIENT_COLS);
const CONVERSATION_LIMIT = 5000;

export const listConversations = () =>
  read((q, scope) => rows<Conversation>(q, `SELECT ${convCols(scope)} FROM conversations c ORDER BY c.started_at DESC LIMIT ${CONVERSATION_LIMIT}`));

export const listConversationsForOrg = (orgId: ID) =>
  isUuid(orgId)
    ? read((q, scope) =>
        rows<Conversation>(q, `SELECT ${convCols(scope)} FROM conversations c WHERE c.organization_id = $1 ORDER BY c.started_at DESC LIMIT ${CONVERSATION_LIMIT}`, [orgId]),
      )
    : none<Conversation>();

export const listConversationEvents = (conversationId: ID) =>
  isUuid(conversationId)
    ? read((q) => rows<ConversationEvent>(q, `SELECT ${EVENT_COLS} FROM conversation_events e WHERE e.conversation_id = $1 ORDER BY e.at`, [conversationId]))
    : none<ConversationEvent>();

export const LIVE_STATUSES = ["pending", "connecting", "active", "terminating"] as const;

export const listLiveSessions = () =>
  read((q, scope) =>
    rows<Conversation>(
      q,
      `SELECT ${convCols(scope)} FROM conversations c
        WHERE c.status IN ('pending', 'connecting', 'active', 'terminating', 'close_unconfirmed')
        ORDER BY c.started_at DESC`,
    ),
  );

/** Agrégats quotidiens dérivés des conversations terminées (même règle que la vue usage_records). */
async function usage(q: Queryable, orgId: ID | null): Promise<UsageRecord[]> {
  const list = await rows<Omit<UsageRecord, "id" | "origin">>(
    q,
    `SELECT c.organization_id AS "organizationId",
            to_char((c.started_at AT TIME ZONE 'Europe/Zurich')::date, 'YYYY-MM-DD') AS day,
            (count(*) FILTER (WHERE c.status <> 'failed'))::int AS sessions,
            coalesce(sum(c.billable_seconds), 0)::bigint AS "billableSeconds"
       FROM conversations c
      WHERE c.status NOT IN ('pending', 'connecting', 'active', 'terminating')
        AND ($1::uuid IS NULL OR c.organization_id = $1::uuid)
      GROUP BY 1, 2
      ORDER BY 2`,
    [orgId],
  );
  return list.map((u) => ({ ...u, id: `${u.organizationId}:${u.day}`, origin: "measured" as const }));
}

export const listUsageForOrg = (orgId: ID) => (isUuid(orgId) ? read((q) => usage(q, orgId)) : none<UsageRecord>());
export const listUsage = () => read((q) => usage(q, null));

/** Consommation relevée chez les fournisseurs (vide tant que le backend ne la collecte pas). */
export const listProviderUsage = () =>
  read((q) =>
    rows<ProviderUsage>(
      q,
      `SELECT pu.id, pu.provider, pu.period_start AS "periodStart", pu.period_end AS "periodEnd",
              pu.minutes_used::float8 AS "minutesUsed", pu.minutes_available::float8 AS "minutesAvailable",
              pu.cost_cents AS "costCents", pu.origin::text AS origin
         FROM provider_usage pu ORDER BY pu.period_start DESC, pu.provider`,
    ),
  );

// ---------------------------------------------------------------------------
// Offres, abonnements, quotas
// ---------------------------------------------------------------------------

export const listPlans = () => read((q) => rows<Plan>(q, `SELECT ${PLAN_COLS} FROM plans p ORDER BY p.monthly_price_cents, p.name`));
export const getPlan = (id: ID) =>
  isUuid(id) ? read((q) => one<Plan>(q, `SELECT ${PLAN_COLS} FROM plans p WHERE p.id = $1`, [id])) : Promise.resolve(null);
export const listSubscriptions = () =>
  read((q) => rows<Subscription>(q, `SELECT ${SUBSCRIPTION_COLS} FROM subscriptions s ORDER BY s.created_at DESC`));
export const getSubscriptionForOrg = (orgId: ID) =>
  isUuid(orgId)
    ? read((q) => one<Subscription>(q, `SELECT ${SUBSCRIPTION_COLS} FROM subscriptions s WHERE s.organization_id = $1 AND s.status <> 'canceled' LIMIT 1`, [orgId]))
    : Promise.resolve(null);
export const listTopups = () => read((q) => rows<MinuteTopup>(q, `SELECT ${TOPUP_COLS} FROM minute_topups t ORDER BY t.requested_at DESC`));
export const listTopupsForOrg = (orgId: ID) =>
  isUuid(orgId)
    ? read((q) => rows<MinuteTopup>(q, `SELECT ${TOPUP_COLS} FROM minute_topups t WHERE t.organization_id = $1 ORDER BY t.requested_at DESC`, [orgId]))
    : none<MinuteTopup>();
export const listConcurrencyForOrg = (orgId: ID) =>
  isUuid(orgId)
    ? read((q) => rows<ConcurrencyEntitlement>(q, `SELECT ${CONCURRENCY_COLS} FROM concurrency_entitlements ce WHERE ce.organization_id = $1 ORDER BY ce.starts_at DESC`, [orgId]))
    : none<ConcurrencyEntitlement>();
export const listConcurrency = () =>
  read((q) => rows<ConcurrencyEntitlement>(q, `SELECT ${CONCURRENCY_COLS} FROM concurrency_entitlements ce ORDER BY ce.starts_at DESC`));

/**
 * Quotas de plusieurs entreprises (ou de toutes si `orgIds` est null), en quatre requêtes.
 * Minutes utilisées = secondes facturables des conversations de la période en cours.
 */
export async function loadQuotas(q: Queryable, orgIds: ID[] | null): Promise<Map<ID, QuotaState>> {
  const filter = orgIds ? "AND s.organization_id = ANY($1::uuid[])" : "AND $1::uuid[] IS NULL";
  const params = [orgIds];
  const subs = await rows<Subscription>(q, `SELECT ${SUBSCRIPTION_COLS} FROM subscriptions s WHERE s.status <> 'canceled' ${filter}`, params);
  const plans = await rows<Plan>(q, `SELECT ${PLAN_COLS} FROM plans p WHERE p.id = ANY($1::uuid[])`, [[...new Set(subs.map((s) => s.planId))]]);
  const used = await rows<{ org: ID; seconds: number; sessions: number }>(
    q,
    `SELECT s.organization_id AS org, coalesce(sum(c.billable_seconds), 0)::bigint AS seconds,
            (count(c.id) FILTER (WHERE c.status <> 'failed'))::int AS sessions
       FROM subscriptions s
       JOIN conversations c ON c.organization_id = s.organization_id
                           AND c.started_at >= s.current_period_start AND c.started_at < s.current_period_end
      WHERE s.status <> 'canceled' ${filter}
      GROUP BY 1`,
    params,
  );
  const topups = await rows<{ org: ID; minutes: number }>(
    q,
    `SELECT s.organization_id AS org, coalesce(sum(t.minutes), 0)::int AS minutes
       FROM subscriptions s
       JOIN minute_topups t ON t.organization_id = s.organization_id AND t.status = 'applied'
                           AND t.applied_at >= s.current_period_start AND t.applied_at < s.current_period_end
      WHERE s.status <> 'canceled' ${filter}
      GROUP BY 1`,
    params,
  );
  const extra = await rows<{ org: ID; extra: number }>(
    q,
    `SELECT ce.organization_id AS org, sum(ce.extra_sessions)::int AS extra
       FROM concurrency_entitlements ce
      WHERE ce.status = 'active' AND ($1::uuid[] IS NULL OR ce.organization_id = ANY($1::uuid[]))
      GROUP BY 1`,
    params,
  );
  const planById = new Map(plans.map((p) => [p.id, p]));
  const subByOrg = new Map(subs.map((s) => [s.organizationId, s]));
  const usedByOrg = new Map(used.map((u) => [u.org, u]));
  const topupByOrg = new Map(topups.map((t) => [t.org, t.minutes]));
  const extraByOrg = new Map(extra.map((e) => [e.org, e.extra]));
  const ids = orgIds ?? [...new Set([...subByOrg.keys(), ...extraByOrg.keys()])];
  const out = new Map<ID, QuotaState>();
  for (const id of ids) {
    const subscription = subByOrg.get(id) ?? null;
    out.set(
      id,
      computeQuota({
        subscription,
        plan: subscription ? planById.get(subscription.planId) ?? null : null,
        usedSeconds: usedByOrg.get(id)?.seconds ?? 0,
        sessions: usedByOrg.get(id)?.sessions ?? 0,
        topupMinutes: topupByOrg.get(id) ?? 0,
        extraConcurrent: extraByOrg.get(id) ?? 0,
      }),
    );
  }
  return out;
}

const EMPTY_QUOTA = computeQuota({ subscription: null, plan: null, usedSeconds: 0, sessions: 0, topupMinutes: 0, extraConcurrent: 0 });

/**
 * Quota commercial du client sur la période en cours.
 * Calculé à partir des conversations écrites par le backend Python (source de vérité des minutes).
 */
export async function quotaForOrg(orgId: ID): Promise<QuotaState> {
  if (!isUuid(orgId)) return EMPTY_QUOTA;
  const m = await read((q) => loadQuotas(q, [orgId]));
  return m.get(orgId) ?? EMPTY_QUOTA;
}

/** Quotas de toutes les entreprises ayant un abonnement ou une option, en une seule transaction. */
export const listQuotas = () => read((q) => loadQuotas(q, null));

// ---------------------------------------------------------------------------
// Facturation
// ---------------------------------------------------------------------------

export const listInvoices = () => read((q) => rows<Invoice>(q, `SELECT ${INVOICE_COLS} FROM invoices i ORDER BY i.issued_at DESC`));
export const listInvoicesForOrg = (orgId: ID) =>
  isUuid(orgId)
    ? read((q) => rows<Invoice>(q, `SELECT ${INVOICE_COLS} FROM invoices i WHERE i.organization_id = $1 ORDER BY i.issued_at DESC`, [orgId]))
    : none<Invoice>();
export const listPayments = () => read((q) => rows<Payment>(q, `SELECT ${PAYMENT_COLS} FROM payments pa ORDER BY pa.at DESC`));

// ---------------------------------------------------------------------------
// Demandes, support, notifications, audit, incidents, paramètres
// ---------------------------------------------------------------------------

export const listVisitorRequestsForOrg = (orgId: ID) =>
  isUuid(orgId)
    ? read((q) => rows<VisitorRequest>(q, `SELECT ${VISITOR_REQUEST_COLS} FROM visitor_requests v WHERE v.organization_id = $1 ORDER BY v.created_at DESC`, [orgId]))
    : none<VisitorRequest>();
export const listSupportRequests = () =>
  read((q) => rows<SupportRequest>(q, `SELECT ${SUPPORT_COLS} FROM support_requests sr ORDER BY sr.created_at DESC`));
export const listSupportForOrg = (orgId: ID) =>
  isUuid(orgId)
    ? read((q) => rows<SupportRequest>(q, `SELECT ${SUPPORT_COLS} FROM support_requests sr WHERE sr.organization_id = $1 ORDER BY sr.created_at DESC`, [orgId]))
    : none<SupportRequest>();

/** orgId null : toutes les notifications (back-office) ; sinon celles de l'entreprise. */
export const listNotifications = (orgId: ID | null) =>
  orgId !== null && !isUuid(orgId)
    ? none<Notification>()
    : read((q) =>
        rows<Notification>(
          q,
          `SELECT ${NOTIFICATION_COLS} FROM notifications n WHERE ($1::uuid IS NULL OR n.organization_id = $1::uuid) ORDER BY n.created_at DESC LIMIT 500`,
          [orgId],
        ),
      );

export const listAuditEvents = (orgId?: ID) =>
  orgId !== undefined && !isUuid(orgId)
    ? none<AuditEvent>()
    : read((q) =>
        rows<AuditEvent>(
          q,
          `SELECT ${AUDIT_COLS} FROM audit_events ae WHERE ($1::uuid IS NULL OR ae.organization_id = $1::uuid) ORDER BY ae.at DESC, ae.id DESC LIMIT 500`,
          [orgId ?? null],
        ),
      );

/** Incidents : alimentés par la supervision du backend (non connectée) — aucune donnée inventée. */
export const listIncidents = async (): Promise<Incident[]> => [];

/** État des services : seulement « configuré / non connecté », jamais une clé. */
export async function listProviderStatuses(): Promise<ProviderStatus[]> {
  const backend = Boolean(BACKEND_URL);
  return [
    {
      id: "prv_api",
      provider: "atie_api",
      label: "API ATIE Presence (Python)",
      configured: backend,
      keyHint: null,
      connection: "not_connected",
      note: backend ? "Adresse définie ; la console ne lit pas encore les données du backend." : "Non connectée : définir ATIE_API_URL côté serveur.",
    },
    { id: "prv_livekit", provider: "livekit", label: "LiveKit Cloud", configured: false, keyHint: null, connection: "not_connected", note: "Géré par le backend Python. Aucune clé dans la console." },
    { id: "prv_lemonslice", provider: "lemonslice", label: "LemonSlice", configured: false, keyHint: null, connection: "not_connected", note: "Géré par le backend Python. Aucune clé dans la console." },
    { id: "prv_inference", provider: "livekit_inference", label: "LiveKit Inference (STT, LLM, TTS)", configured: false, keyHint: null, connection: "not_connected", note: "Géré par l’agent Python." },
    { id: "prv_payment", provider: "payment", label: "Prestataire de paiement", configured: false, keyHint: null, connection: "not_connected", note: "Aucun prestataire choisi. Paiements désactivés." },
  ];
}

/** Paramètres de la plateforme (personnel ATIE ; valeurs par défaut côté client). */
export const getSettings = (): Promise<PlatformSettings> =>
  read((q, scope) => (scope.kind === "staff" ? loadPlatformSettings(q) : Promise.resolve({ ...DEFAULT_PLATFORM_SETTINGS })));

// ---------------------------------------------------------------------------
// Vue enrichie pour les tableaux d'entreprises
// ---------------------------------------------------------------------------

export interface OrganizationRow {
  org: Organization;
  receptionistName: string | null;
  planName: string | null;
  usedMinutes: number;
  includedMinutes: number;
  domain: string | null;
}

export async function listOrganizationRows(): Promise<OrganizationRow[]> {
  return read(async (q) => {
    const orgs = await rows<Organization & { receptionistName: string | null; domain: string | null }>(
      q,
      `SELECT ${ORG_COLS},
              (SELECT r.name FROM receptionists r WHERE r.organization_id = o.id ORDER BY (r.status = 'live') DESC, r.created_at LIMIT 1) AS "receptionistName",
              (SELECT d.domain::text FROM website_domains d WHERE d.organization_id = o.id ORDER BY d.created_at LIMIT 1) AS domain
         FROM organizations o`,
    );
    const quotas = await loadQuotas(q, orgs.map((o) => o.id));
    return orgs
      .sort((a, b) => a.name.localeCompare(b.name, "fr"))
      .map(({ receptionistName, domain, ...org }) => {
        const qt = quotas.get(org.id) ?? EMPTY_QUOTA;
        return {
          org,
          receptionistName,
          planName: qt.plan?.name ?? null,
          usedMinutes: qt.usedMinutes,
          includedMinutes: qt.includedMinutes + qt.topupMinutes,
          domain,
        };
      });
  });
}
