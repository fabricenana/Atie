-- =============================================================================
-- ATIE Presence — migration 002 : rôle applicatif « atie_app » (RLS client),
-- paramètres de la console, avatars existants.
-- Appliquer depuis db/ (après 001) :
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/002_app_role.sql
--
-- Modèle d'accès de la console (connexion unique en « postgres », côté serveur) :
--  * personnel ATIE : transactions en « postgres », propriétaire des tables (la RLS ne
--    s'applique pas au propriétaire) ; les droits sont vérifiés dans le code
--    (assertPermission / requireAdmin) ;
--  * client : chaque transaction exécute
--        SET LOCAL ROLE atie_app;
--        SELECT set_config('app.current_org_id', '<organisation de la session>', true);
--    « atie_app » n'est ni propriétaire ni BYPASSRLS : la RLS s'applique réellement.
--
-- Rejouable : rôle et table créés s'ils manquent, politiques supprimées puis recréées,
-- GRANT / ENABLE RLS idempotents, avatars insérés ON CONFLICT DO NOTHING.
-- =============================================================================

BEGIN;

SET LOCAL search_path = atie, extensions;

-- ---------------------------------------------------------------------------
-- Rôle applicatif (sans connexion, sans contournement de la RLS)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atie_app') THEN
    CREATE ROLE atie_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;

-- Sur Supabase, « postgres » n'est pas superutilisateur : il doit être membre du rôle
-- pour pouvoir exécuter SET ROLE atie_app.
GRANT atie_app TO postgres;

-- ---------------------------------------------------------------------------
-- Paramètres de la console (plateforme, facturation) — personnel ATIE uniquement
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY CHECK (key IN ('platform', 'billing')),
  value      jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES users (id) ON DELETE SET NULL
);
REVOKE ALL ON settings FROM PUBLIC, anon, authenticated;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;   -- aucune politique : invisible pour atie_app

-- ---------------------------------------------------------------------------
-- Droits minimum de atie_app (espace client)
-- Aucune table n'est lisible sans politique RLS correspondante ci-dessous ou en 001.
-- Non accordés : knowledge_*, conversation_events, conversation_transcripts, payments,
-- provider_usage, usage_records (vue matérialisée : pas de RLS possible), settings.
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA atie TO atie_app;
GRANT USAGE ON SCHEMA extensions TO atie_app;    -- type citext

GRANT SELECT ON
  organizations, organization_users, website_domains, avatars, receptionists,
  widget_installations, plans, subscriptions, minute_topups,
  concurrency_entitlements, invoices, invoice_lines, visitor_requests,
  support_requests, notifications
TO atie_app;
-- Utilisateurs : jamais idp_subject ni mfa_enabled.
GRANT SELECT (id, email, full_name, atie_role, status, last_login_at, created_at) ON users TO atie_app;
-- Conversations : ni coût fournisseur, ni identifiant de session du backend, ni erreur technique.
GRANT SELECT (id, organization_id, receptionist_id, started_at, ended_at, duration_seconds, lang, status,
              end_reason, billable_seconds, created_at) ON conversations TO atie_app;

-- Écritures client : coordonnées de l'entreprise, statut des demandes visiteurs,
-- demandes d'assistance, demandes de recharge, notifications, journal d'audit.
GRANT UPDATE (contact_name, contact_email, phone, address, city, billing_email, billing_address,
              vat_number, notification_prefs, updated_at) ON organizations TO atie_app;
GRANT UPDATE (status) ON visitor_requests TO atie_app;
GRANT INSERT ON support_requests, minute_topups, notifications TO atie_app;
GRANT UPDATE (read_at) ON notifications TO atie_app;
GRANT INSERT ON audit_events TO atie_app;
GRANT USAGE ON SEQUENCE audit_events_id_seq TO atie_app;

-- ---------------------------------------------------------------------------
-- Politiques RLS manquantes (tables lues par un client sans organization_id direct,
-- ou avec organization_id mais absentes de la liste de 001)
-- ---------------------------------------------------------------------------

-- Entreprise : uniquement la sienne.
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_own ON organizations;
CREATE POLICY organizations_own ON organizations TO atie_app
  USING (id = current_setting('app.current_org_id', true)::uuid)
  WITH CHECK (id = current_setting('app.current_org_id', true)::uuid);

-- Appartenances : celles de son entreprise.
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organization_users_tenant_isolation ON organization_users;
CREATE POLICY organization_users_tenant_isolation ON organization_users TO atie_app
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);

-- Utilisateurs : les membres de son entreprise, en lecture seule.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_same_org ON users;
CREATE POLICY users_same_org ON users FOR SELECT TO atie_app
  USING (EXISTS (
    SELECT 1 FROM organization_users m
    WHERE m.user_id = users.id
      AND m.organization_id = current_setting('app.current_org_id', true)::uuid
  ));

-- Formules : les formules actives, plus celle de son propre abonnement.
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plans_client_read ON plans;
CREATE POLICY plans_client_read ON plans FOR SELECT TO atie_app
  USING (active OR EXISTS (
    SELECT 1 FROM subscriptions s
    WHERE s.plan_id = plans.id
      AND s.organization_id = current_setting('app.current_org_id', true)::uuid
  ));

-- Réceptionnistes : celles de son entreprise (organization_id peut être NULL : jamais visible).
ALTER TABLE receptionists ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receptionists_tenant_isolation ON receptionists;
CREATE POLICY receptionists_tenant_isolation ON receptionists FOR SELECT TO atie_app
  USING (organization_id = current_setting('app.current_org_id', true)::uuid);

-- Avatars : uniquement ceux de ses réceptionnistes.
ALTER TABLE avatars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avatars_client_read ON avatars;
CREATE POLICY avatars_client_read ON avatars FOR SELECT TO atie_app
  USING (EXISTS (
    SELECT 1 FROM receptionists r
    WHERE r.avatar_id = avatars.id
      AND r.organization_id = current_setting('app.current_org_id', true)::uuid
  ));

-- Lignes de facture : celles des factures de son entreprise.
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_lines_tenant_isolation ON invoice_lines;
CREATE POLICY invoice_lines_tenant_isolation ON invoice_lines FOR SELECT TO atie_app
  USING (EXISTS (
    SELECT 1 FROM invoices i
    WHERE i.id = invoice_lines.invoice_id
      AND i.organization_id = current_setting('app.current_org_id', true)::uuid
  ));

-- Notifications : un client peut adresser une notification interne à ATIE
-- (organization_id NULL) sans pouvoir la relire ; la politique de 001 couvre les siennes.
DROP POLICY IF EXISTS notifications_client_to_atie ON notifications;
CREATE POLICY notifications_client_to_atie ON notifications FOR INSERT TO atie_app
  WITH CHECK (organization_id IS NULL);

-- Journal d'audit : append-only, uniquement pour sa propre entreprise ; aucune lecture.
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_events_client_insert ON audit_events;
CREATE POLICY audit_events_client_insert ON audit_events FOR INSERT TO atie_app
  WITH CHECK (organization_id = current_setting('app.current_org_id', true)::uuid);

-- ---------------------------------------------------------------------------
-- Avatars LemonSlice existants (Léa, Maya) : catalogue réel, pas de données clients.
-- ---------------------------------------------------------------------------
INSERT INTO avatars (name, provider, provider_avatar_id, portrait_url) VALUES
  ('Léa',  'lemonslice', 'agent_ee494dab89f98682', '/presence/lea.jpg'),
  ('Maya', 'lemonslice', 'agent_fd6544c9c1935c9e', '/presence/maya.jpg')
ON CONFLICT (provider, provider_avatar_id) DO NOTHING;

COMMIT;
