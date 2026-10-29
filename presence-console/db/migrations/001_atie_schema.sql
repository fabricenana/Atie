-- =============================================================================
-- ATIE Presence — migration 001 : schéma de la console sur Supabase
-- Projet Supabase dédié ATIE (abhtqnhmtxfqpbrytixq). Appliquer depuis db/ :
--   psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f migrations/001_atie_schema.sql
--
-- Les tables vont dans le schéma « atie », jamais dans « public » : l'API REST de
-- Supabase expose « public » avec la clé anon (publique). Aucun droit pour
-- PUBLIC, anon ni authenticated : seule la console (côté serveur) y accède.
-- Les utilisateurs se connectent par Supabase Auth ; users.idp_subject = auth.users.id.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA extensions;
CREATE SCHEMA atie;
REVOKE ALL ON SCHEMA atie FROM PUBLIC, anon, authenticated;

SET LOCAL search_path = atie, extensions;
\ir ../schema.sql

REVOKE ALL ON ALL TABLES IN SCHEMA atie FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA atie FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA atie FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA atie REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA atie REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA atie REVOKE ALL ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- Grille validée le 29 oct. 2026 (même source que lib/domain/pricing.ts).
INSERT INTO plans (code, name, monthly_price_cents, included_minutes, concurrent_sessions, approval, active, description) VALUES
  ('starter',   'Starter',    1200,  15, 1, 'confirmed', true, 'Pour un petit site : quelques échanges par mois.'),
  ('essentiel', 'Essentiel',  2990,  50, 1, 'confirmed', true, 'Pour un accueil régulier sur un site actif.'),
  ('premium',   'Premium',    8900, 150, 2, 'confirmed', true, 'Pour les entreprises qui reçoivent beaucoup de visiteurs.'),
  ('business',  'Business',  24900, 450, 4, 'confirmed', true, 'Grands volumes et plusieurs conversations en même temps.');

COMMIT;
