-- =============================================================================
-- ATIE Presence — schéma PostgreSQL cible (console Admin + Client)
-- PostgreSQL 15+. Non appliqué : préparation pour la connexion future.
--
-- Principes
--  * Isolation multi-tenant : toute table métier porte organization_id, et la
--    sécurité au niveau des lignes (RLS) filtre sur app.current_org_id pour les
--    rôles clients. Le personnel ATIE passe par un rôle dédié (BYPASSRLS interdit :
--    politiques explicites).
--  * Une seule source de vérité :
--      - sessions / durées / minutes : conversations (alimentée par le backend Python)
--      - agrégats : usage_records = vue matérialisée dérivée de conversations
--      - factures : invoices (+ invoice_lines) ; payments ne fait que référencer
--  * Montants en centimes CHF (bigint), durées en secondes (integer).
--  * Aucun secret en base : seuls des indices (4 derniers caractères) et des états.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;

-- ---------------------------------------------------------------------------
-- Types énumérés
-- ---------------------------------------------------------------------------
CREATE TYPE atie_role          AS ENUM ('super_admin', 'atie_admin', 'atie_operator');
CREATE TYPE org_role           AS ENUM ('org_admin', 'org_viewer');
CREATE TYPE org_status         AS ENUM ('onboarding', 'trial', 'active', 'suspended');
CREATE TYPE lang               AS ENUM ('fr', 'de', 'it', 'en');
CREATE TYPE receptionist_status AS ENUM ('draft', 'configured', 'live', 'paused');
CREATE TYPE knowledge_kind     AS ENUM ('text', 'url', 'pdf', 'docx');
CREATE TYPE index_status       AS ENUM ('pending', 'indexing', 'indexed', 'failed');
CREATE TYPE session_status     AS ENUM ('pending', 'connecting', 'active', 'terminating', 'ended', 'failed', 'close_unconfirmed');
CREATE TYPE plan_approval      AS ENUM ('confirmed', 'hypothesis', 'draft');
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'suspended', 'canceled');
CREATE TYPE invoice_status     AS ENUM ('draft', 'open', 'paid', 'overdue', 'void', 'credited');
CREATE TYPE data_origin        AS ENUM ('measured', 'estimated');

-- ---------------------------------------------------------------------------
-- Utilisateurs et entreprises
-- ---------------------------------------------------------------------------
CREATE TABLE users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           citext NOT NULL UNIQUE,
  full_name       text NOT NULL,
  atie_role       atie_role,                         -- NULL pour un utilisateur client
  status          text NOT NULL DEFAULT 'invited' CHECK (status IN ('active', 'invited', 'disabled')),
  idp_subject     text UNIQUE,                       -- identifiant du fournisseur d'identité
  mfa_enabled     boolean NOT NULL DEFAULT false,
  last_login_at   timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE organizations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,64}$'),  -- tenant_id du backend Python
  name                text NOT NULL,
  sector              text NOT NULL DEFAULT '',
  contact_name        text NOT NULL DEFAULT '',
  contact_email       citext,
  phone               text,
  address             text,
  city                text,
  country             char(2) NOT NULL DEFAULT 'CH',
  status              org_status NOT NULL DEFAULT 'onboarding',
  activated_at        timestamptz,
  billing_email       citext,
  billing_address     text,
  vat_number          text,
  notification_prefs  jsonb NOT NULL DEFAULT '{"quotaAlerts":true,"newRequests":true,"monthlyReport":true}',
  retention_days      integer NOT NULL DEFAULT 30 CHECK (retention_days BETWEEN 1 AND 3650),
  transcripts_enabled boolean NOT NULL DEFAULT false,  -- désactivé par défaut (LPD)
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX organizations_status_idx ON organizations (status);

CREATE TABLE organization_users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role            org_role NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX organization_users_user_idx ON organization_users (user_id);

CREATE TABLE website_domains (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  domain          citext NOT NULL,
  verified        boolean NOT NULL DEFAULT false,
  verified_at     timestamptz,
  verification_token text,                            -- valeur publique (enregistrement DNS TXT)
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (domain)                                     -- un domaine n'appartient qu'à une entreprise
);
CREATE INDEX website_domains_org_idx ON website_domains (organization_id);

-- ---------------------------------------------------------------------------
-- Avatars et réceptionnistes
-- ---------------------------------------------------------------------------
CREATE TABLE avatars (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text NOT NULL,
  provider           text NOT NULL DEFAULT 'lemonslice',
  provider_avatar_id text NOT NULL,
  portrait_url       text,                             -- visuel autorisé
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_avatar_id)
);

CREATE TABLE receptionists (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          uuid REFERENCES organizations (id) ON DELETE SET NULL,
  avatar_id                uuid NOT NULL REFERENCES avatars (id),
  name                     text NOT NULL,
  role                     text NOT NULL DEFAULT '',
  voice                    text NOT NULL DEFAULT '',
  primary_lang             lang NOT NULL DEFAULT 'fr',
  secondary_langs          lang[] NOT NULL DEFAULT '{}',
  tone                     text NOT NULL DEFAULT '',
  business_instructions    text NOT NULL DEFAULT '',
  greeting                 text NOT NULL DEFAULT '',
  fallback_reply           text NOT NULL DEFAULT '',
  after_hours_behavior     text NOT NULL DEFAULT 'message' CHECK (after_hours_behavior IN ('message', 'inform_hours', 'redirect_contact')),
  max_conversation_seconds integer NOT NULL DEFAULT 180 CHECK (max_conversation_seconds BETWEEN 30 AND 1800),
  allowed_services         text[] NOT NULL DEFAULT '{}',
  status                   receptionist_status NOT NULL DEFAULT 'draft',
  last_activity_at         timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX receptionists_org_idx ON receptionists (organization_id);
-- Une seule réceptionniste en service par entreprise (évolutif si plusieurs sites).
CREATE UNIQUE INDEX receptionists_one_live_per_org ON receptionists (organization_id) WHERE status = 'live';

-- ---------------------------------------------------------------------------
-- Knowledge Base (isolée par entreprise)
-- ---------------------------------------------------------------------------
CREATE TABLE knowledge_sources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  kind            knowledge_kind NOT NULL,
  title           text NOT NULL,
  category        text NOT NULL DEFAULT 'Général',
  origin          text NOT NULL,                       -- URL, nom de fichier ou « Saisie manuelle »
  index_status    index_status NOT NULL DEFAULT 'pending',
  current_version integer NOT NULL DEFAULT 1,
  storage_key     text,                                -- objet stocké (PDF/DOCX), chiffré au repos
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid REFERENCES users (id)
);
CREATE INDEX knowledge_sources_org_idx ON knowledge_sources (organization_id, category);

CREATE TABLE knowledge_documents (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id       uuid NOT NULL REFERENCES knowledge_sources (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  version         integer NOT NULL,
  content         text NOT NULL,
  size_bytes      integer NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES users (id),
  UNIQUE (source_id, version)
);
CREATE INDEX knowledge_documents_org_idx ON knowledge_documents (organization_id);
-- RAG futur : table knowledge_chunks (embedding vector via pgvector), même organization_id,
-- et toute recherche sémantique filtre d'abord sur organization_id.

-- ---------------------------------------------------------------------------
-- Widget
-- ---------------------------------------------------------------------------
CREATE TABLE widget_installations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  receptionist_id uuid REFERENCES receptionists (id) ON DELETE SET NULL,
  public_key      text NOT NULL UNIQUE,                -- identifiant public, non secret
  position        text NOT NULL DEFAULT 'right' CHECK (position IN ('right', 'left')),
  accent          text NOT NULL DEFAULT '#E31E24' CHECK (accent ~ '^#[0-9A-Fa-f]{6}$'),
  status          text NOT NULL DEFAULT 'not_configured' CHECK (status IN ('not_configured', 'ready', 'installed', 'disabled')),
  platform        text NOT NULL DEFAULT 'generic' CHECK (platform IN ('generic', 'wordpress')),
  last_seen_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX widget_installations_org_idx ON widget_installations (organization_id);

-- ---------------------------------------------------------------------------
-- Conversations (écrites par le backend Python : source de vérité des minutes)
-- ---------------------------------------------------------------------------
CREATE TABLE conversations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  receptionist_id     uuid REFERENCES receptionists (id) ON DELETE SET NULL,
  backend_session_id  text NOT NULL UNIQUE,            -- session_id de l'API Python
  started_at          timestamptz NOT NULL,
  ended_at            timestamptz,
  duration_seconds    integer NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
  lang                lang NOT NULL,
  status              session_status NOT NULL,
  end_reason          text,
  billable_seconds    integer NOT NULL DEFAULT 0 CHECK (billable_seconds >= 0),
  provider_cost_cents bigint,
  provider_cost_origin data_origin,
  error               text,
  transcript_available boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);
CREATE INDEX conversations_org_started_idx ON conversations (organization_id, started_at DESC);
CREATE INDEX conversations_live_idx ON conversations (status) WHERE status IN ('pending', 'connecting', 'active', 'terminating', 'close_unconfirmed');

CREATE TABLE conversation_events (
  id              bigserial PRIMARY KEY,
  conversation_id uuid NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  at              timestamptz NOT NULL DEFAULT now(),
  type            text NOT NULL,
  detail          text NOT NULL DEFAULT ''             -- jamais de contenu de conversation
);
CREATE INDEX conversation_events_conv_idx ON conversation_events (conversation_id, at);

-- Transcriptions : uniquement si organizations.transcripts_enabled, durée bornée par retention_days.
CREATE TABLE conversation_transcripts (
  conversation_id uuid PRIMARY KEY REFERENCES conversations (id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  content         text NOT NULL,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX conversation_transcripts_expiry_idx ON conversation_transcripts (expires_at);

-- Agrégats quotidiens : DÉRIVÉS des conversations (pas une seconde source de vérité).
CREATE MATERIALIZED VIEW usage_records AS
SELECT
  organization_id,
  (started_at AT TIME ZONE 'Europe/Zurich')::date AS day,
  count(*) FILTER (WHERE status <> 'failed')       AS sessions,
  coalesce(sum(billable_seconds), 0)::bigint       AS billable_seconds
FROM conversations
WHERE status NOT IN ('pending', 'connecting', 'active', 'terminating')
GROUP BY organization_id, day;
CREATE UNIQUE INDEX usage_records_pk ON usage_records (organization_id, day);

-- Consommation constatée chez les fournisseurs (distincte des quotas commerciaux).
CREATE TABLE provider_usage (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider          text NOT NULL CHECK (provider IN ('livekit', 'lemonslice', 'livekit_inference')),
  period_start      timestamptz NOT NULL,
  period_end        timestamptz NOT NULL,
  minutes_used      numeric(12, 2),
  minutes_available numeric(12, 2),
  cost_cents        bigint,
  origin            data_origin NOT NULL,
  fetched_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, period_start)
);

-- ---------------------------------------------------------------------------
-- Offres, abonnements, quotas
-- ---------------------------------------------------------------------------
CREATE TABLE plans (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                text NOT NULL UNIQUE,
  name                text NOT NULL,
  monthly_price_cents bigint NOT NULL CHECK (monthly_price_cents >= 0),
  currency            char(3) NOT NULL DEFAULT 'CHF' CHECK (currency = 'CHF'),
  included_minutes    integer NOT NULL CHECK (included_minutes >= 0),
  concurrent_sessions integer NOT NULL DEFAULT 1 CHECK (concurrent_sessions >= 1),
  approval            plan_approval NOT NULL DEFAULT 'draft',
  active              boolean NOT NULL DEFAULT true,
  description         text NOT NULL DEFAULT '',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  plan_id              uuid NOT NULL REFERENCES plans (id),
  status               subscription_status NOT NULL,
  activated_at         timestamptz NOT NULL,
  current_period_start timestamptz NOT NULL,
  current_period_end   timestamptz NOT NULL,
  auto_renew           boolean NOT NULL DEFAULT true,
  alert_threshold_pct  smallint NOT NULL DEFAULT 80 CHECK (alert_threshold_pct BETWEEN 1 AND 100),
  provider_ref         text,                            -- futur prestataire de paiement
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (current_period_end > current_period_start)
);
-- Un seul abonnement non résilié par entreprise.
CREATE UNIQUE INDEX subscriptions_one_open_per_org ON subscriptions (organization_id) WHERE status <> 'canceled';

CREATE TABLE minute_topups (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  minutes         integer NOT NULL CHECK (minutes > 0),
  price_cents     bigint NOT NULL CHECK (price_cents >= 0),
  status          text NOT NULL CHECK (status IN ('requested', 'pending', 'applied', 'rejected')),
  requested_at    timestamptz NOT NULL DEFAULT now(),
  applied_at      timestamptz,
  requested_by    uuid REFERENCES users (id),
  invoice_id      uuid                                   -- FK ajoutée après invoices
);
CREATE INDEX minute_topups_org_idx ON minute_topups (organization_id, status);

CREATE TABLE concurrency_entitlements (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  extra_sessions      integer NOT NULL CHECK (extra_sessions > 0),
  monthly_price_cents bigint NOT NULL CHECK (monthly_price_cents >= 0),
  status              text NOT NULL CHECK (status IN ('requested', 'active', 'ended')),
  starts_at           timestamptz NOT NULL,
  ends_at             timestamptz
);
CREATE INDEX concurrency_entitlements_org_idx ON concurrency_entitlements (organization_id);

-- ---------------------------------------------------------------------------
-- Facturation (source unique : invoices)
-- ---------------------------------------------------------------------------
CREATE TABLE invoices (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  number          text NOT NULL UNIQUE,                 -- séquence officielle attribuée à l'émission
  kind            text NOT NULL DEFAULT 'invoice' CHECK (kind IN ('invoice', 'credit_note')),
  credited_invoice_id uuid REFERENCES invoices (id),
  issued_at       timestamptz NOT NULL,
  due_at          timestamptz NOT NULL,
  status          invoice_status NOT NULL DEFAULT 'draft',
  currency        char(3) NOT NULL DEFAULT 'CHF' CHECK (currency = 'CHF'),
  total_cents     bigint NOT NULL,
  provider_ref    text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX invoices_org_issued_idx ON invoices (organization_id, issued_at DESC);
CREATE INDEX invoices_status_idx ON invoices (status) WHERE status IN ('open', 'overdue');

CREATE TABLE invoice_lines (
  id               bigserial PRIMARY KEY,
  invoice_id       uuid NOT NULL REFERENCES invoices (id) ON DELETE CASCADE,
  label            text NOT NULL,
  quantity         numeric(10, 2) NOT NULL DEFAULT 1,
  unit_price_cents bigint NOT NULL
);

ALTER TABLE minute_topups ADD CONSTRAINT minute_topups_invoice_fk FOREIGN KEY (invoice_id) REFERENCES invoices (id);

CREATE TABLE payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      uuid NOT NULL REFERENCES invoices (id) ON DELETE RESTRICT,
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
  amount_cents    bigint NOT NULL,
  method          text NOT NULL CHECK (method IN ('bank_transfer', 'card', 'manual')),
  status          text NOT NULL CHECK (status IN ('recorded', 'failed', 'refunded')),
  provider_ref    text UNIQUE,                           -- idempotence des webhooks
  at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payments_invoice_idx ON payments (invoice_id);

-- ---------------------------------------------------------------------------
-- Demandes visiteurs, support, notifications, audit
-- ---------------------------------------------------------------------------
CREATE TABLE visitor_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations (id) ON DELETE SET NULL,
  kind            text NOT NULL CHECK (kind IN ('message', 'contact', 'quote', 'appointment')),
  visitor_name    text NOT NULL,
  visitor_contact text NOT NULL,
  summary         text NOT NULL,
  lang            lang NOT NULL,
  status          text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'done', 'archived')),
  expires_at      timestamptz NOT NULL,                  -- created_at + organizations.retention_days
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX visitor_requests_org_idx ON visitor_requests (organization_id, created_at DESC);
CREATE INDEX visitor_requests_expiry_idx ON visitor_requests (expires_at);

CREATE TABLE support_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('change_request', 'issue', 'minutes', 'contact')),
  subject         text NOT NULL,
  message         text NOT NULL,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  created_by      uuid REFERENCES users (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_requests_org_idx ON support_requests (organization_id, created_at DESC);

CREATE TABLE notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations (id) ON DELETE CASCADE,  -- NULL : interne ATIE
  level           text NOT NULL CHECK (level IN ('info', 'warning', 'critical')),
  title           text NOT NULL,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  read_at         timestamptz
);
CREATE INDEX notifications_org_idx ON notifications (organization_id, created_at DESC);

-- Journal d'audit : append-only (pas d'UPDATE/DELETE pour le rôle applicatif).
CREATE TABLE audit_events (
  id              bigserial PRIMARY KEY,
  organization_id uuid REFERENCES organizations (id) ON DELETE SET NULL,
  actor_id        uuid REFERENCES users (id) ON DELETE SET NULL,
  action          text NOT NULL,
  target          text NOT NULL,
  detail          text NOT NULL DEFAULT '',              -- jamais de secret ni de donnée sensible
  ip_hash         text,
  at              timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_org_at_idx ON audit_events (organization_id, at DESC);
CREATE INDEX audit_events_at_idx ON audit_events (at DESC);

-- ---------------------------------------------------------------------------
-- Isolation multi-tenant (RLS) pour le rôle applicatif « client »
-- L'application exécute : SET LOCAL app.current_org_id = '<uuid>' par requête,
-- valeur dérivée de la session serveur (jamais d'un paramètre client).
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'website_domains', 'knowledge_sources', 'knowledge_documents', 'widget_installations',
    'conversations', 'conversation_events', 'conversation_transcripts', 'subscriptions',
    'minute_topups', 'concurrency_entitlements', 'invoices', 'payments',
    'visitor_requests', 'support_requests', 'notifications'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON %I USING (organization_id = current_setting(''app.current_org_id'', true)::uuid)',
      t || '_tenant_isolation', t
    );
  END LOOP;
END $$;
