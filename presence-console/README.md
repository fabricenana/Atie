# ATIE Presence — Console (Back-office ATIE + Espace client)

Application web unique, multi-rôles, pour gérer ATIE Presence :

- **ATIE Admin** (`/admin`) : entreprises clientes, réceptionnistes, Knowledge Bases,
  conversations et sessions, abonnements, facturation, intégrations, paramètres.
- **ATIE Client** (`/client`) : tableau de bord, réceptionniste, demandes des visiteurs,
  consommation, abonnement, entreprise, assistance.

Connexion réelle (Supabase Auth, e-mail + mot de passe) et données réelles (PostgreSQL
Supabase, schéma `atie`). Ce qui n'est pas encore branché (backend Python, paiements…)
est listé dans [`docs/NON-CONNECTE.md`](docs/NON-CONNECTE.md) : la console affiche alors
des états vides, jamais de chiffres inventés.

Le dossier est autonome : il ne modifie ni le thème WordPress (`../atie-theme`), ni
le script de publication (`../outils/publier.sh` n'archive que `atie-theme/`).

## Configuration (serveur uniquement)

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | PostgreSQL Supabase, pooler **de session** (port 5432), utilisateur `postgres` |
| `SUPABASE_URL` | URL du projet Supabase (API Auth) |
| `SUPABASE_ANON_KEY` | clé publique : connexion, mot de passe oublié, définition du mot de passe |
| `SUPABASE_SERVICE_ROLE_KEY` | clé de service : invitations (création de comptes par ATIE) |
| `ATIE_SESSION_SECRET` | clé de signature des sessions (32 caractères au moins ; obligatoire en production) |
| `ATIE_CONSOLE_URL` | facultative : adresse publique de la console pour les liens e-mail (sinon déduite de la requête) |
| `DATABASE_CA_CERT` | facultative : certificat (PEM) de l'autorité Supabase, pour vérifier TLS ; sans elle la connexion est chiffrée sans vérification de l'autorité |
| `DATABASE_POOL_MAX` | facultative : taille du pool (5 par défaut) |

Aucune n'est préfixée `NEXT_PUBLIC_` ; aucune n'est journalisée ni envoyée au navigateur.

Côté Supabase (tableau de bord › Authentication › URL Configuration), ajouter
`https://<console>/connexion/nouveau-mot-de-passe` aux **Redirect URLs** : c'est la page
de retour des liens « mot de passe oublié » et d'invitation.

## Mise en service

1. Base : `db/migrations/001_atie_schema.sql` (déjà appliquée), puis
   `psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1 -f db/migrations/002_app_role.sql`
   (rôle `atie_app` pour la RLS client, table `settings`, avatars Léa et Maya).
2. Premier super administrateur (variables d'environnement ci-dessus définies) :

   ```bash
   node scripts/bootstrap-admin.mjs fabricendongo1986@gmail.com "Fabrice Ndongo"
   ```

   Le script est rejouable : il invite le compte dans Supabase Auth s'il n'existe pas
   (e-mail avec lien de définition du mot de passe) et crée la ligne `atie.users`
   (`super_admin`, `idp_subject` = identifiant Supabase). Aucun secret n'est affiché.
3. Ouvrir le lien reçu, définir le mot de passe, se connecter sur `/connexion`.
   Les autres comptes (personnel ATIE, utilisateurs clients) se créent ensuite depuis la
   console (Paramètres › Utilisateurs, fiche entreprise › Utilisateurs). Il n'y a pas
   d'inscription publique.

## Démarrage local

Prérequis : Node.js 20.9 ou plus récent, et les variables ci-dessus (base de développement).

```bash
cd presence-console
npm install
npm run dev        # http://localhost:3100
```

Version optimisée : `npm run build && npm start`.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | serveur de développement (port 3100) |
| `npm run typecheck` | TypeScript strict |
| `npm test` | tests (Vitest) sur PostgreSQL en mémoire (PGlite) : migrations, repositories, RLS, connexion, actions |
| `npm run build` | build de production |
| `npm run validate` | typecheck + tests + build |
| `npm run bootstrap:admin -- <e-mail> "<Nom>"` | amorçage du premier super administrateur |
| `npm run test:e2e` | parcours navigateur — **hors service**, à réécrire pour la connexion réelle (voir `scripts/e2e.mjs`) |

## Fonctionnement

- **Connexion** (`/connexion`) : la console envoie e-mail et mot de passe à l'API Auth de
  Supabase (côté serveur, clé anon), retrouve `atie.users` par `idp_subject` (statut
  `active`), puis ouvre sa propre session signée (cookie httpOnly, `Secure` en production,
  durée réglable dans Paramètres › Sécurité). La session Supabase est révoquée aussitôt.
  Messages d'erreur génériques ; 5 tentatives par quart d'heure et par couple IP + e-mail.
- **Mot de passe oublié** (`/connexion/mot-de-passe-oublie`) et **définition du mot de
  passe** (`/connexion/nouveau-mot-de-passe`) : lien e-mail Supabase ; une invitation
  acceptée active le compte.
- **Données** : `lib/db` (node-postgres). Personnel ATIE : transaction en rôle propriétaire,
  droits vérifiés dans le code. Client : `SET LOCAL ROLE atie_app` +
  `app.current_org_id` = entreprise de la session : la RLS filtre réellement. Chaque action
  écrit son entrée d'audit dans la même transaction.

## Pages

**Admin** : `/admin` (tableau de bord), `/admin/entreprises` (+ `nouvelle`, `[id]` à 8 onglets),
`/admin/receptionnistes` (+ `nouvelle`, `[id]`), `/admin/connaissances` (+ `[orgId]`, `[orgId]/[sourceId]`),
`/admin/sessions` (+ `[id]`, `actives`), `/admin/integrations` (+ `[orgId]`),
`/admin/abonnements` (+ `formules/nouvelle`, `formules/[id]`), `/admin/facturation` (+ `[id]`, export CSV),
`/admin/parametres`.

**Client** : `/client`, `/client/receptionniste`, `/client/demandes`, `/client/consommation`,
`/client/abonnement`, `/client/entreprise`, `/client/assistance`.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) : architecture, choix techniques, sécurité.
- [`docs/API-CONTRACTS.md`](docs/API-CONTRACTS.md) : contrats avec le backend Python et correspondance des repositories.
- [`docs/PERMISSIONS.md`](docs/PERMISSIONS.md) : matrice des rôles, règles d'accès, RLS.
- [`docs/NON-CONNECTE.md`](docs/NON-CONNECTE.md) : ce qui n'est pas encore branché.
- [`db/schema.sql`](db/schema.sql), [`db/migrations/`](db/migrations) : schéma PostgreSQL et migrations.

## Validation

- `npm run validate` : typecheck sans erreur, 71 tests réussis (9 fichiers), build de 33 routes.
- Les tests appliquent les vraies migrations 001 et 002 sur PGlite (PostgreSQL 17 en WASM) ;
  seuls les éléments fournis par Supabase sont recréés (rôles `anon` / `authenticated`,
  schéma `extensions`). L'API Auth est simulée (faux `fetch`) : aucun appel réseau.

Non vérifié : la connexion au vrai projet Supabase (base et API Auth), l'envoi effectif des
e-mails, le script d'amorçage contre une vraie base, le parcours navigateur (`scripts/e2e.mjs`).
