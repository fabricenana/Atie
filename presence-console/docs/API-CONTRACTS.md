# Contrats de données et d'API — console ↔ backend Python

Ce document décrit comment la console (Next.js) se branche à la base PostgreSQL Supabase
(schéma `atie`, `db/schema.sql` + `db/migrations/`) et se branchera au backend existant
(Phase 2, FastAPI + agent LiveKit).

> **État.** La console lit et écrit PostgreSQL (Supabase) et authentifie par Supabase Auth.
> Aucun appel n'est fait au backend Python, à LiveKit, à LemonSlice ni à un prestataire de
> paiement (voir `docs/NON-CONNECTE.md`).

> **Audit Phase 2 non réalisé.** Le dossier `phase2/` (API FastAPI, 202 tests, `AGENTS.md`,
> `CLAUDE.md`, commit `54442a5`) n'était pas accessible depuis l'environnement de
> développement. Les contrats ci-dessous s'appuient sur les endpoints **réellement appelés
> par le widget** (`atie-theme/assets/presence/atie-presence.js`). Les endpoints `/admin/*`
> sont des **propositions** à confronter au code de `phase2/` avant implémentation.

## 1. Répartition des responsabilités

| Domaine | Autorité | Console |
|---|---|---|
| Sessions, baux atomiques, expiration, fermeture LiveKit/LemonSlice | Backend Python | Lecture ; fermeture forcée déléguée (`POST /admin/sessions/{id}/close`) |
| Quotas, budgets, durées, minutes facturables | Backend Python | Lecture seule (`GET /admin/tenants/{id}/usage`) — jamais recalculés pour faire foi |
| Configuration tenants (`config/tenants.json`) | Backend Python | Source future : table `organizations` + `receptionists` ; synchronisation à définir |
| Entreprises, utilisateurs, rôles, Knowledge Base (contenu), abonnements, factures, support | Console + PostgreSQL | Lecture/écriture via `lib/repositories` |
| Consommation fournisseurs (minutes LiveKit/LemonSlice, coûts) | Backend Python (collecte) | Lecture ; toujours marquée « mesurée » ou « estimée » |
| Secrets (clés LiveKit, LemonSlice, inférence, paiement) | Backend uniquement | **Jamais** lus, affichés ni stockés ; seul un état « configuré / non configuré » |

Une seule source de vérité par donnée :
- **minutes et sessions** → table `conversations` (écrite par le backend) ; `usage_records` est une vue dérivée ;
- **factures** → `invoices` (+ `invoice_lines`) ; `payments` et `minute_topups` y font référence.

## 2. Endpoints existants (constatés dans le widget)

Utilisés par le widget public uniquement. **La console ne les appelle jamais** : chacun
peut ouvrir une session payante.

| Méthode | Chemin | Corps / réponse | Codes |
|---|---|---|---|
| `POST` | `/session` | `{ tenant_id, language }` → `{ session_id, url, token, max_minutes }` | `429` capacité saturée, autre erreur = indisponible |
| `POST` | `/session/{session_id}/heartbeat` | — | `404` bail expiré |
| `DELETE` | `/session/{session_id}` | — | fermeture de la salle et libération de la place |

Le widget s'intègre avec `data-api` (URL de l'API) et `data-tenant` (= `organizations.slug`).

## 3. Endpoints proposés pour la console

Authentification console → backend : jeton de service (`ATIE_API_SERVICE_TOKEN`, variable
d'environnement **serveur**), envoyé en `Authorization: Bearer`. Le navigateur ne parle
jamais directement au backend d'administration.

Schémas de validation zod : `lib/api/backend.ts`.

| Méthode | Chemin | Réponse | Utilisé par |
|---|---|---|---|
| `GET` | `/admin/tenants` | `[{ tenant_id, name, status }]` | synchronisation entreprises |
| `GET` | `/admin/tenants/{tenant_id}/usage` | `TenantUsage` (période en cours, minutes incluses / recharges / utilisées / restantes, `budget_state`) | `quotaForOrg()` |
| `GET` | `/admin/tenants/{tenant_id}/usage/daily?from&to` | `[{ day, sessions, billable_seconds }]` | graphiques consommation |
| `GET` | `/admin/sessions?tenant_id&status&from&to&cursor` | `{ items: Session[], next_cursor }` | `/admin/sessions`, fiche entreprise |
| `GET` | `/admin/sessions/{session_id}` | `Session` + `events[]` | `/admin/sessions/[id]` |
| `GET` | `/admin/sessions/live` | `Session[]` (pending → terminating, close_unconfirmed) | `/admin/sessions/actives` |
| `POST` | `/admin/sessions/{session_id}/close` | `{ closed }` | bouton « Forcer la fermeture » (désactivé en démo) |
| `GET` | `/admin/providers/status` | `[{ provider, configured, key_hint (≤ 4 car.), connection }]` | paramètres › fournisseurs |
| `GET` | `/admin/providers/usage?period` | `[{ provider, minutes_used, minutes_available, cost_cents, origin }]` | tableau de bord (pool fournisseur) |

`Session` :

```ts
{
  session_id: string; tenant_id: string; receptionist_id: string | null;
  status: "pending" | "connecting" | "active" | "terminating" | "ended" | "failed" | "close_unconfirmed";
  language: "fr" | "de" | "it" | "en";
  started_at: string; ended_at: string | null;
  duration_seconds: number; billable_seconds: number;
  end_reason: string | null;          // visitor_end | time_up | quota_exhausted | disconnected | lease_expired | error
  provider_cost_cents: number | null; provider_cost_measured: boolean;
  error: string | null;
}
```

Aucune transcription n'est renvoyée par ces endpoints. Si une entreprise active la
conservation (`organizations.transcripts_enabled`), un endpoint dédié
`GET /admin/sessions/{id}/transcript` sera ajouté, soumis à la durée de conservation.

## 4. Correspondance repositories → sources

La couche `lib/repositories/*` est le seul point d'accès des pages (fonctions asynchrones,
portée personnel ou entreprise déduite de la session). Sources actuelles et cibles :

| Fonction | Source cible |
|---|---|
| `listOrganizations`, `getOrganization`, `listDomainsForOrg`, `listOrgUsers` | PostgreSQL |
| `listReceptionists`, `getReceptionist`, `listAvatars` | PostgreSQL (synchronisé vers `config/tenants.json` ou API Python) |
| `listKnowledgeForOrg`, `getKnowledgeSourceForOrg` | PostgreSQL (+ stockage objet pour PDF/DOCX, index vectoriel futur) |
| `listConversations*`, `listLiveSessions`, `listConversationEvents` | PostgreSQL `conversations` / `conversation_events`, **écrites par le backend Python** (vides tant qu'il n'écrit rien) |
| `listUsage*`, `quotaForOrg`, `listQuotas` | Dérivés en SQL de `conversations` (période de l'abonnement) ; à terme confrontés à `/admin/tenants/{id}/usage*` |
| `listProviderUsage`, `listProviderStatuses` | `provider_usage` (vide) ; état « non connecté » ; à terme API Python `/admin/providers/*` |
| `listPlans`, `listSubscriptions`, `listTopups`, `listInvoices*`, `listPayments` | PostgreSQL (+ futur prestataire de paiement via webhooks idempotents) |
| `listVisitorRequestsForOrg`, `listSupportRequests`, `listNotifications`, `listAuditEvents` | PostgreSQL |

Les actions serveur (`lib/actions/*.ts`) écrivent dans PostgreSQL, dans une transaction qui
contient aussi l'entrée d'audit : `withStaff` pour le personnel ATIE (permission vérifiée
avant), `withOrg` pour un client (`SET LOCAL ROLE atie_app` + `app.current_org_id`, RLS).

## 5. Isolation multi-tenant

1. Espace client : l'organisation est résolue **côté serveur** depuis l'appartenance de
   l'utilisateur (`requireClient()` → `viewer.organization.id`). Aucune route client
   n'accepte d'identifiant d'entreprise.
2. Back-office : les routes portent un identifiant d'entreprise, mais chaque lecture
   d'objet enfant vérifie qu'il appartient bien à cette entreprise (ex.
   `getKnowledgeSourceForOrg(orgId, sourceId)` → 404 sinon).
3. Base : RLS sur les tables métier (`db/schema.sql`) et sur les tables lues par un client sans
   `organization_id` direct (`db/migrations/002_app_role.sql`), appliquée réellement par le rôle `atie_app`.

## 6. Variables d'environnement prévues (serveur uniquement)

| Variable | Rôle |
|---|---|
| `ATIE_API_URL` | URL du backend Python (non utilisée pour l'instant) |
| `ATIE_API_SERVICE_TOKEN` | jeton de service console → backend |
| `ATIE_SESSION_SECRET` | clé de signature des sessions (≥ 32 caractères) |
| `DATABASE_URL` | PostgreSQL Supabase (pooler de session), utilisateur `postgres` |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | API Auth : connexion, mot de passe oublié |
| `SUPABASE_SERVICE_ROLE_KEY` | API Auth admin : invitations |
| `ATIE_CONSOLE_URL` | facultative : adresse publique pour les liens e-mail |
| `DATABASE_CA_CERT` | facultative : vérification TLS de la base |

Aucune de ces variables n'est préfixée `NEXT_PUBLIC_` : elles ne peuvent pas atteindre le navigateur.
