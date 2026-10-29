# Architecture

Une seule application Next.js (App Router, TypeScript strict) sert les deux espaces :
`/admin` (personnel ATIE) et `/client` (entreprises), avec un socle commun de
composants, un système de rôles et une couche de données isolée.

```
Navigateur ──► /connexion ─► lib/actions/auth ─► Supabase Auth (API REST, fetch serveur)
          │                                  └─► atie.users (idp_subject) ─► cookie de session signé
          ├──► Server Components (pages) ─► lib/repositories ─► lib/db/scope ─┬─ personnel : withStaff
          └──► Server Actions (lib/actions/*.ts) ─► withStaff / withOrg       └─ client : withOrg (RLS)
                  │ assertPermission()                     │
                  └─ requireAdmin()/requireClient()        └─► PostgreSQL Supabase (schéma atie, pooler de session)
```

- `lib/db/index.ts` : pool node-postgres (`lib/db/pg.ts`), `withStaff` (rôle propriétaire,
  permissions vérifiées dans le code) et `withOrg` (`SET LOCAL ROLE atie_app` +
  `app.current_org_id`), `rows` / `one` (dates ISO, nombres), `audit` (même transaction).
- `lib/db/scope.ts` : portée des lectures déduite de la session (personnel ou entreprise).
- `lib/auth/` : `supabase.ts` (client API Auth), `login.ts` (connexion, définition du mot de
  passe), `rate-limit.ts`, `session.ts` (jeton signé, `requireAdmin` / `requireClient`),
  `invite.ts` (création de comptes).

## Choix

| Sujet | Choix | Pourquoi |
|---|---|---|
| Framework | Next.js 16, React 19, App Router | Recommandé dans la mission ; rendu serveur, actions serveur, une seule application multi-rôles |
| Styles | Tailwind CSS 4, jetons CSS sur `:root` | Thème clair/sombre/système cohérent, reprise de l'identité ATIE |
| Icônes | lucide-react | SVG cohérents, importés à l'unité |
| Validation | zod | Schémas partagés pour les formulaires et la frontière API |
| Graphiques | SVG maison (`components/ui/Charts.tsx`) | Aucune dépendance lourde, rendu serveur, tableau accessible associé |
| Données | PostgreSQL Supabase (node-postgres) derrière `lib/repositories` | Transactions, RLS pour l'espace client, audit dans la même transaction |
| Authentification | Supabase Auth via son API REST (fetch serveur), session signée propre à la console | Pas de SDK ni de jeton Supabase dans le navigateur |
| Tests | Vitest + PGlite (PostgreSQL en WASM) ; API Auth simulée | Migrations réelles, RLS, repositories, actions, connexion, sans base distante |

Dépendances d'exécution : `next`, `react`, `react-dom`, `lucide-react`, `zod`, `server-only`, `pg`.
Dépendance de test : `@electric-sql/pglite`.

## Identité visuelle

Reprise du thème `atie-theme` : rouge `#E31E24`, encre `#141414`, Archivo (titres),
Work Sans (texte), Roboto (interface) ; le mode sombre reprend la « vitrine sombre » de
la page ATIE Presence (`#0e0e0f`, panneaux `#161618`). Portraits de Léa et Maya
copiés depuis `atie-theme/assets/img/presence/` (aucun média téléchargé depuis les
comptes fournisseurs, aucune vidéo dans la console).

## Composants partagés (`components/ui`)

| Composant | Rôle |
|---|---|
| `Button`, `ButtonLink`, `IconButton` | Boutons et liens (primaire, secondaire, fantôme, danger) |
| `Card`, `CardHeader`, `CardBody`, `DefinitionList` | Cartes et listes libellé / valeur |
| `Badge`, `StatusBadge`, `OriginTag` | États ; marquage « Estimé » des valeurs non mesurées |
| `PageHeader` | Titre, description, fil d'Ariane, actions |
| `Stat`, `StatGrid` | Indicateurs chiffrés |
| `DataTable` | Tableau : recherche, filtres, tri, pagination, défilement horizontal maîtrisé, colonnes masquables, lignes cliquables |
| `Tabs` | Onglets en liens (état dans l'URL) |
| `PeriodFilter` | Filtre de période (7 j, 30 j, 90 j, 12 mois) |
| `AreaChart`, `BarChart`, `Meter`, `RingGauge`, `Legend` | Visualisation |
| `Modal`, `ConfirmAction` | Fenêtres `<dialog>` accessibles ; confirmation avant action sensible |
| `ActionForm`, `SubmitButton`, `TextField`, `SelectField`, `TextAreaField`, `Field`, `Checkbox` | Formulaires reliés aux actions serveur, erreurs par champ, état de chargement |
| `Menu` | Menu contextuel (clavier : flèches, Échap) |
| `Toast` | Notifications de succès / d'erreur |
| `Notice`, `NotConnected` | Encadrés d'information, d'alerte, de service non connecté, de confidentialité |
| `EmptyState` | États vides |
| `Portrait` | Portrait autorisé d'une réceptionniste |

Coque (`components/shell`) : `AppShell` (barre latérale, tiroir mobile, lien d'évitement), `ThemeToggle` (clair / système / sombre, mémorisé), navigation
(`nav.ts`).

Composants propres à un espace : `components/admin/*` (aperçu widget, formulaires KB,
copie du script, aperçu d'intégration, formulaires de formules et d'abonnement) et
`components/client/*` (dialogue d'assistance, statut des demandes, aperçu widget).

## États d'interface

- Chargement : `app/admin/loading.tsx`, `app/client/loading.tsx` (squelettes), boutons `aria-busy`.
- Erreur : `app/error.tsx` ; erreurs de validation par champ ; notifications d'échec.
- Introuvable : `app/not-found.tsx` (aussi pour un objet hors de son entreprise).
- Vide : `EmptyState` dans les tableaux, listes et graphiques.

Note : les pages étant diffusées en streaming (squelette de chargement), une page
« introuvable » renvoie le contenu 404 avec un statut HTTP 200 — comportement standard
de Next.js ; les pages sont de toute façon `noindex`.

## Sécurité

- Pages : `requireAdmin(permission)` / `requireClient(permission)` en tête de chaque page.
- Actions : `assertPermission(permission)` en tête de chaque action ; l'entreprise du client vient de la session.
- Identité vérifiée par Supabase Auth ; accès décidé par `atie.users` (statut `active`, rôle). Messages
  d'erreur génériques, limitation des tentatives (IP + e-mail), session Supabase révoquée aussitôt.
- Session signée HMAC-SHA256 (`ATIE_SESSION_SECRET`, obligatoire en production), expirante, relue en base
  à chaque requête ; cookie `httpOnly` / `SameSite=Lax` / `Secure` en production.
- Base : schéma `atie` non exposé par l'API REST Supabase ; aucun droit pour `anon` / `authenticated`.
  Espace client en rôle `atie_app` (ni propriétaire, ni BYPASSRLS) : la RLS est la défense en profondeur.
- En-têtes : `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (micro, caméra, géolocalisation désactivés).
- Aucun secret côté navigateur : aucune variable `NEXT_PUBLIC_*` ; `lib/db`, `lib/auth/*` et `lib/api/backend.ts` sont `server-only`.
- Journal d'audit pour les actions administratives ; pas de contenu de conversation journalisé.

L'interface n'est pas une garantie de conformité juridique (LPD) : elle prépare les
réglages (conservation, transcriptions désactivées, isolation) qui devront être
validés avec l'architecture de production.
