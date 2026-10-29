# ATIE Presence — Console (Back-office ATIE + Espace client)

Application web unique, multi-rôles, pour gérer ATIE Presence :

- **ATIE Admin** (`/admin`) : entreprises clientes, réceptionnistes, Knowledge Bases,
  conversations et sessions, abonnements, facturation, intégrations, paramètres.
- **ATIE Client** (`/client`) : tableau de bord, réceptionniste, demandes des visiteurs,
  consommation, abonnement, entreprise, assistance.

> **Démonstration, non connectée.** Données fictives, aucun appel à LiveKit, LemonSlice,
> au backend Python ou à un prestataire de paiement, aucune opération payante.
> Voir [`docs/SIMULATED.md`](docs/SIMULATED.md).

Le dossier est autonome : il ne modifie ni le thème WordPress (`../atie-theme`), ni
le script de publication (`../outils/publier.sh` n'archive que `atie-theme/`).

## Démarrage local

Prérequis : Node.js 20.9 ou plus récent.

```bash
cd presence-console
npm install
npm run dev
```

Ouvrir <http://localhost:3100>, puis choisir un profil de démonstration :

| Profil | Espace | Pour voir |
|---|---|---|
| Direction ATIE (démo) — super administrateur | Admin | tout, dont formules et réinitialisation |
| Camille Admin (démo) — administrateur ATIE | Admin | gestion courante, sans formules |
| Noah Opérateur (démo) — opérateur ATIE | Admin | exploitation, sans suspension ni facturation |
| Hôtel Chalet du Lac — Marc Favre | Client | quota presque épuisé, recharge en attente |
| Cabinet dentaire Lumière — Dr Claire Morel | Client | client actif, demandes visiteurs |
| Cabinet dentaire Lumière — Inès Secrétariat | Client | lecture seule |
| Garage des Alpes — Luca Bonvin | Client | service suspendu, facture échue |
| Régie Horizon — Sophie Rochat | Client | période d'essai |

Version optimisée : `npm run build && npm start`.

Données de démonstration : régénérées automatiquement dans `.demo-data/` (hors Git).
Réinitialisation : `npm run demo:reset`, puis redémarrer.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement (port 3100) |
| `npm run typecheck` | TypeScript strict |
| `npm test` | tests unitaires (Vitest) |
| `npm run build` | build de production |
| `npm run validate` | typecheck + tests + build |
| `npm run test:e2e` | parcours navigateur (serveur lancé ; nécessite Playwright : `npm i -D playwright && npx playwright install chromium`) |
| `npm run demo:reset` | efface les données de démonstration locales |

## Pages construites

**Admin**

| Route | Contenu |
|---|---|
| `/admin` | Tableau de bord : entreprises (actives, essai, suspendues), réceptionnistes, sessions jour / 7 j / 30 j, minutes, sessions actives et pic simultané, revenus mensuels récurrents, recharges, pool fournisseur (non connecté), alertes de quotas, incidents, activité ; graphiques et filtre de période |
| `/admin/entreprises` | Tableau : recherche, filtres, tri, pagination, menu d'actions |
| `/admin/entreprises/nouvelle` | Création validée |
| `/admin/entreprises/[id]?tab=` | Fiche à 8 onglets : général, domaines, réceptionniste, Knowledge Base, abonnement et quotas, sessions, utilisateurs, historique ; suspension / réactivation |
| `/admin/receptionnistes` | Catalogue visuel |
| `/admin/receptionnistes/nouvelle` | Création à partir d'un avatar existant (Léa, Maya) |
| `/admin/receptionnistes/[id]` | Configuration complète + aperçu du widget sans session |
| `/admin/connaissances` | Knowledge Bases par entreprise |
| `/admin/connaissances/[orgId]` | Sources : texte, URL, PDF/DOCX, catégories, statuts d'indexation |
| `/admin/connaissances/[orgId]/[sourceId]` | Consultation, modification versionnée, historique, suppression |
| `/admin/sessions` | Conversations : entreprise, réceptionniste, date, durée, langue, statut, motif, minutes, coût estimé, erreurs |
| `/admin/sessions/[id]` | Détail et chronologie d'une session |
| `/admin/sessions/actives` | Suivi des sessions en cours, fermetures non confirmées, 7 états |
| `/admin/integrations` | Installations du widget |
| `/admin/integrations/[orgId]` | Script d'intégration, WordPress, aperçu mobile / ordinateur, domaines, configuration |
| `/admin/abonnements?tab=` | Formules, abonnements, recharges, concurrence ; quotas clients séparés des minutes fournisseurs |
| `/admin/abonnements/formules/nouvelle`, `/[id]` | Création et modification de formule |
| `/admin/facturation?tab=` | Factures, paiements, avoirs, recharges, paramètres, prestataire ; export CSV |
| `/admin/facturation/[id]` | Détail d'une facture de démonstration |
| `/admin/parametres?section=` | Profil, utilisateurs internes, rôles et permissions, plateforme, langues, notifications, alertes, audit, fournisseurs, état des services, sécurité |

**Client**

| Route | Contenu |
|---|---|
| `/client` | Tableau de bord : réceptionniste, statut, minutes (jauge), sessions, langues, dernières demandes, abonnement, alerte de quota |
| `/client/receptionniste` | Portrait, langues, statut, aperçu du widget, sites, présentation, « Demander une modification » |
| `/client/demandes?tab=` | Demandes des visiteurs, interactions, notifications ; protection des données |
| `/client/consommation` | Minutes incluses / utilisées / restantes, historique quotidien et mensuel, durée moyenne, capacité simultanée |
| `/client/abonnement` | Formule, montant, échéance, options, recharges et changement de formule en mode demande, factures |
| `/client/entreprise` | Coordonnées, responsable, domaines, notifications, facturation, utilisateurs |
| `/client/assistance` | Modification, problème, minutes supplémentaires, contact ; historique |

Captures d'écran : [`docs/captures/`](docs/captures).

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) : architecture, choix techniques, composants partagés, sécurité.
- [`docs/API-CONTRACTS.md`](docs/API-CONTRACTS.md) : contrats avec le backend Python et correspondance des repositories.
- [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) : matrice des rôles et règles d'accès.
- [`docs/SIMULATED.md`](docs/SIMULATED.md) : liste précise de ce qui est simulé.
- [`db/schema.sql`](db/schema.sql) : schéma PostgreSQL cible (22 entités, contraintes, index, RLS multi-tenant).

## Validation

Au moment de la livraison :

- `npm run typecheck` : aucune erreur.
- `npm test` : 25 tests unitaires réussis (matrice des rôles, session signée et expiration, isolation multi-tenant, quotas, invariants des données de démonstration, absence de secrets).
- `npm run build` : 31 routes compilées.
- `scripts/e2e.mjs` (Chromium) : 374/374 vérifications — 49 routes admin et 11 routes client sans erreur JavaScript, redirections anonymes, cloisonnement admin/client, isolation entre entreprises par URL, export CSV protégé, recherche et validation de formulaire, persistance du thème, absence de débordement horizontal sur 14 pages aux largeurs 320, 360, 390, 430, 768, 1024, 1440 et 1920 px.
- `db/schema.sql` appliqué sans erreur sur PostgreSQL 16 (24 tables, 15 politiques RLS).

Non vérifié dans cette livraison : la suite Phase 2 (202 tests) et le Development Harness
— le dossier `phase2/` n'était pas accessible depuis l'environnement de développement ;
lecteurs d'écran réels (seuls les attributs ARIA et la navigation clavier de base ont été contrôlés) ;
navigateurs autres que Chromium.

## Prochaines étapes d'intégration

1. **Confronter les contrats à `phase2/`** : vérifier les endpoints `/admin/*` proposés dans `docs/API-CONTRACTS.md` avec l'API FastAPI réelle, AGENTS.md et CLAUDE.md, puis lancer la suite des 202 tests.
2. **Authentification** : brancher `lib/auth/session.ts` sur un fournisseur d'identité (double facteur pour ATIE) ; supprimer `/connexion` démo.
3. **Base de données** : appliquer `db/schema.sql`, réimplémenter `lib/repositories/*` et `lib/actions/*` sur PostgreSQL (transactions, `SET LOCAL app.current_org_id`).
4. **Backend Python** : définir `ATIE_API_URL` et `ATIE_API_SERVICE_TOKEN` (serveur), brancher `quotaForOrg`, sessions et sessions actives sur `lib/api/backend.ts`.
5. **Synchronisation tenants** : relier `organizations` / `receptionists` à `config/tenants.json` (ou à son remplaçant).
6. **Knowledge Base** : stockage objet des fichiers, extraction, indexation vectorielle (pgvector) filtrée par entreprise.
7. **Paiement** : choisir un prestataire, webhooks idempotents vers `payments` ; numérotation officielle des factures.
8. **Widget** : publier le script sur un CDN, renseigner `data-api`, activer le contrôle réel des domaines.
