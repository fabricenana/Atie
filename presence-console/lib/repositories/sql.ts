/**
 * Listes de colonnes SQL → objets du domaine (lib/domain/types.ts).
 * Alias entre guillemets pour obtenir directement les noms camelCase ; enums et citext
 * convertis en texte ; numeric convertis en float8.
 * Chaque liste suppose l'alias de table indiqué en commentaire.
 */

/** users u — jamais idp_subject ni mfa_enabled. */
export const USER_COLS = `u.id, u.email::text AS email, u.full_name AS "fullName", u.atie_role::text AS "atieRole",
  u.status, u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt"`;

/** organizations o */
export const ORG_COLS = `o.id, o.slug, o.name, o.sector, o.contact_name AS "contactName",
  coalesce(o.contact_email::text, '') AS "contactEmail", coalesce(o.phone, '') AS phone,
  coalesce(o.address, '') AS address, coalesce(o.city, '') AS city, o.country::text AS country,
  o.status::text AS status, o.activated_at AS "activatedAt", o.created_at AS "createdAt", o.updated_at AS "updatedAt",
  coalesce(o.billing_email::text, '') AS "billingEmail", coalesce(o.billing_address, '') AS "billingAddress",
  o.vat_number AS "vatNumber", o.notification_prefs AS "notificationPrefs", o.retention_days AS "retentionDays",
  o.transcripts_enabled AS "transcriptsEnabled"`;

/** organization_users m */
export const MEMBERSHIP_COLS = `m.id, m.organization_id AS "organizationId", m.user_id AS "userId", m.role::text AS role, m.created_at AS "createdAt"`;

/** website_domains d */
export const DOMAIN_COLS = `d.id, d.organization_id AS "organizationId", d.domain::text AS domain, d.verified,
  d.verified_at AS "verifiedAt", d.created_at AS "createdAt"`;

/** avatars a */
export const AVATAR_COLS = `a.id, a.name, a.provider, a.provider_avatar_id AS "providerAvatarId",
  a.portrait_url AS "portraitUrl", a.created_at AS "createdAt"`;

/** receptionists r */
export const RECEPTIONIST_COLS = `r.id, r.organization_id AS "organizationId", r.avatar_id AS "avatarId", r.name, r.role,
  r.voice, r.primary_lang::text AS "primaryLang", r.secondary_langs::text[] AS "secondaryLangs", r.tone,
  r.business_instructions AS "businessInstructions", r.greeting, r.fallback_reply AS "fallbackReply",
  r.after_hours_behavior AS "afterHoursBehavior", r.max_conversation_seconds AS "maxConversationSeconds",
  r.allowed_services AS "allowedServices", r.status::text AS status, r.last_activity_at AS "lastActivityAt",
  r.created_at AS "createdAt", r.updated_at AS "updatedAt"`;

/** knowledge_sources k */
export const KNOWLEDGE_COLS = `k.id, k.organization_id AS "organizationId", k.kind::text AS kind, k.title, k.category,
  k.origin, k.index_status::text AS "indexStatus", k.current_version AS "currentVersion",
  k.created_at AS "createdAt", k.updated_at AS "updatedAt", k.updated_by AS "updatedBy"`;

/** knowledge_documents kd */
export const KNOWLEDGE_DOC_COLS = `kd.id, kd.source_id AS "sourceId", kd.organization_id AS "organizationId", kd.version,
  kd.content, kd.size_bytes AS "sizeBytes", kd.created_at AS "createdAt", kd.created_by AS "createdBy"`;

/** widget_installations w */
export const WIDGET_COLS = `w.id, w.organization_id AS "organizationId", w.receptionist_id AS "receptionistId",
  w.public_key AS "publicKey", w.position, w.accent, w.status, w.platform, w.last_seen_at AS "lastSeenAt",
  w.created_at AS "createdAt"`;

/** conversations c — personnel ATIE (coûts et identifiants techniques compris). */
export const CONVERSATION_COLS = `c.id, c.organization_id AS "organizationId", c.receptionist_id AS "receptionistId",
  c.backend_session_id AS "backendSessionId", c.started_at AS "startedAt", c.ended_at AS "endedAt",
  c.duration_seconds AS "durationSeconds", c.lang::text AS lang, c.status::text AS status, c.end_reason AS "endReason",
  c.billable_seconds AS "billableSeconds", c.provider_cost_cents AS "providerCostCents",
  c.provider_cost_origin::text AS "providerCostOrigin", c.error, c.transcript_available AS "transcriptAvailable"`;

/**
 * conversations c — espace client : uniquement les colonnes accordées à atie_app
 * (ni coût fournisseur, ni identifiant de session, ni erreur technique).
 */
export const CONVERSATION_CLIENT_COLS = `c.id, c.organization_id AS "organizationId", c.receptionist_id AS "receptionistId",
  '' AS "backendSessionId", c.started_at AS "startedAt", c.ended_at AS "endedAt",
  c.duration_seconds AS "durationSeconds", c.lang::text AS lang, c.status::text AS status, c.end_reason AS "endReason",
  c.billable_seconds AS "billableSeconds", NULL::bigint AS "providerCostCents", NULL::text AS "providerCostOrigin",
  NULL::text AS error, false AS "transcriptAvailable"`;

/** conversation_events e */
export const EVENT_COLS = `e.id::text AS id, e.conversation_id AS "conversationId", e.organization_id AS "organizationId",
  e.at, e.type, e.detail`;

/** plans p */
export const PLAN_COLS = `p.id, p.code, p.name, p.monthly_price_cents AS "monthlyPriceCents", p.included_minutes AS "includedMinutes",
  p.concurrent_sessions AS "concurrentSessions", p.approval::text AS approval, p.active, p.description,
  p.created_at AS "createdAt", p.updated_at AS "updatedAt"`;

/** subscriptions s */
export const SUBSCRIPTION_COLS = `s.id, s.organization_id AS "organizationId", s.plan_id AS "planId", s.status::text AS status,
  s.activated_at AS "activatedAt", s.current_period_start AS "currentPeriodStart", s.current_period_end AS "currentPeriodEnd",
  s.auto_renew AS "autoRenew", s.alert_threshold_pct AS "alertThresholdPct", s.created_at AS "createdAt", s.updated_at AS "updatedAt"`;

/** minute_topups t */
export const TOPUP_COLS = `t.id, t.organization_id AS "organizationId", t.minutes, t.price_cents AS "priceCents", t.status,
  t.requested_at AS "requestedAt", t.applied_at AS "appliedAt", t.requested_by AS "requestedBy"`;

/** concurrency_entitlements ce */
export const CONCURRENCY_COLS = `ce.id, ce.organization_id AS "organizationId", ce.extra_sessions AS "extraSessions",
  ce.monthly_price_cents AS "monthlyPriceCents", ce.status, ce.starts_at AS "startsAt"`;

/** invoices i — lignes agrégées en JSON (quantités en nombres). */
export const INVOICE_COLS = `i.id, i.organization_id AS "organizationId", i.number, i.issued_at AS "issuedAt", i.due_at AS "dueAt",
  i.status::text AS status, i.total_cents AS "totalCents", i.kind, i.credited_invoice_id AS "creditedInvoiceId",
  coalesce((SELECT json_agg(json_build_object('label', l.label, 'quantity', l.quantity::float8, 'unitPriceCents', l.unit_price_cents) ORDER BY l.id)
            FROM invoice_lines l WHERE l.invoice_id = i.id), '[]'::json) AS lines`;

/** payments pa */
export const PAYMENT_COLS = `pa.id, pa.invoice_id AS "invoiceId", pa.organization_id AS "organizationId", pa.amount_cents AS "amountCents",
  pa.method, pa.status, pa.at`;

/** visitor_requests v */
export const VISITOR_REQUEST_COLS = `v.id, v.organization_id AS "organizationId", v.conversation_id AS "conversationId", v.kind,
  v.visitor_name AS "visitorName", v.visitor_contact AS "visitorContact", v.summary, v.lang::text AS lang, v.status,
  v.created_at AS "createdAt"`;

/** support_requests sr */
export const SUPPORT_COLS = `sr.id, sr.organization_id AS "organizationId", sr.kind, sr.subject, sr.message, sr.status,
  sr.created_at AS "createdAt", sr.updated_at AS "updatedAt", sr.created_by AS "createdBy"`;

/** notifications n */
export const NOTIFICATION_COLS = `n.id, n.organization_id AS "organizationId", n.level, n.title, n.body,
  n.created_at AS "createdAt", n.read_at AS "readAt"`;

/** audit_events ae */
export const AUDIT_COLS = `ae.id::text AS id, ae.organization_id AS "organizationId", ae.actor_id AS "actorId", ae.action,
  ae.target, ae.detail, ae.at`;
