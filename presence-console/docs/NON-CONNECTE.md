# Ce qui n'est pas encore connecté

La console fonctionne sur de vraies données : connexion Supabase Auth, PostgreSQL
(schéma `atie`), écritures transactionnelles avec audit, RLS pour l'espace client.

Ce qui suit dépend de services non encore branchés. L'interface l'indique (encadrés
« non connecté », états vides) et **n'invente aucun chiffre**.

## Backend Python (Phase 2 : FastAPI + agent LiveKit)

| Élément | État |
|---|---|
| Conversations, sessions actives, minutes, durées | Lues dans `atie.conversations`, **écrite par le backend**. Tant qu'il n'y écrit rien : listes et graphiques vides, minutes utilisées = 0 |
| Coût fournisseur par session | `provider_cost_cents` renseigné par le backend ; « — » sinon |
| Consommation LiveKit / LemonSlice (pool) | `atie.provider_usage`, vide : « non connecté » |
| Incidents, état des services | Aucune source : liste vide, fournisseurs « non connecté » |
| Configuration des réceptionnistes | Enregistrée en base ; **pas transmise** automatiquement à l'agent Python ni à LemonSlice |
| Suspension d'une entreprise | Change le statut en base ; le backend n'en est pas informé automatiquement |
| « Forcer la fermeture » d'une session | Désactivé : relèvera de `POST /admin/sessions/{id}/close` |
| Synchronisation `config/tenants.json` | À définir (organizations.slug = tenant_id) |
| `ATIE_API_URL`, `ATIE_API_SERVICE_TOKEN` | Préparés (`lib/api/backend.ts`), non utilisés |

## Paiements et facturation

| Élément | État |
|---|---|
| Prestataire de paiement | Non choisi, non connecté |
| Factures | Aucune émission automatique ; seules les factures saisies existent |
| « Marquer payée » | Enregistre un règlement **constaté manuellement** ; rien n'est encaissé |
| Avoirs | Enregistrés en base ; aucun remboursement déclenché |
| Recharges, changement de formule (client) | Mode **demande** : ATIE valide depuis le back-office |

## Autres

| Élément | État |
|---|---|
| Knowledge Base : indexation, recherche, RAG | Sources et versions enregistrées, statut « en attente d'indexation » |
| Knowledge Base : URL | Seule la référence est enregistrée ; la page n'est pas téléchargée |
| Knowledge Base : PDF/DOCX | Seuls le nom et la taille sont conservés ; pas de stockage objet |
| Vérification de domaine | Manuelle (ATIE marque le domaine vérifié) ; aucune requête DNS/HTTP |
| Widget | Script généré ; rien n'est publié ; `data-api` à renseigner |
| E-mails d'alerte et de notification | Préférences enregistrées ; aucun envoi (seuls les e-mails Supabase Auth partent : invitation, mot de passe oublié) |
| Double authentification | Réglage enregistré, **pas encore appliqué** à la connexion |
| Parcours navigateur `scripts/e2e.mjs` | À réécrire pour des comptes de test réels |
