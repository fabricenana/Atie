# Rôles et permissions

Source unique : `lib/auth/permissions.ts`. Ce tableau est généré à partir de ce fichier.

## Matrice

| Permission | Super administrateur ATIE | Administrateur ATIE | Opérateur ATIE | Administrateur entreprise | Utilisateur entreprise (lecture seule) |
|---|:-:|:-:|:-:|:-:|:-:|
| Accéder au back-office (`admin.access`) | ✓ | ✓ | ✓ |  |  |
| Consulter toutes les entreprises (`org.read_all`) | ✓ | ✓ | ✓ |  |  |
| Créer et modifier les entreprises (`org.write`) | ✓ | ✓ |  |  |  |
| Suspendre et réactiver (`org.suspend`) | ✓ | ✓ |  |  |  |
| Configurer les réceptionnistes (`receptionist.write`) | ✓ | ✓ | ✓ |  |  |
| Consulter les Knowledge Bases (`knowledge.read_all`) | ✓ | ✓ | ✓ |  |  |
| Modifier les Knowledge Bases (`knowledge.write`) | ✓ | ✓ | ✓ |  |  |
| Consulter les sessions (`session.read_all`) | ✓ | ✓ | ✓ |  |  |
| Gérer les formules (`plan.write`) | ✓ |  |  |  |  |
| Gérer les abonnements (`subscription.write`) | ✓ | ✓ |  |  |  |
| Consulter la facturation (`billing.read`) | ✓ | ✓ | ✓ |  |  |
| Gérer la facturation (`billing.write`) | ✓ | ✓ |  |  |  |
| Préparer les intégrations (`integration.write`) | ✓ | ✓ | ✓ |  |  |
| Consulter les paramètres (`settings.read`) | ✓ | ✓ | ✓ |  |  |
| Modifier les paramètres plateforme (`settings.write`) | ✓ |  |  |  |  |
| Gérer les utilisateurs internes (`users.manage`) | ✓ |  |  |  |  |
| Consulter le journal d’audit (`audit.read`) | ✓ | ✓ |  |  |  |
| Réinitialiser la démonstration (`demo.reset`) | ✓ |  |  |  |  |
| Accéder à l’espace client (`client.access`) |  |  |  | ✓ | ✓ |
| Traiter les demandes visiteurs (`client.requests.update`) |  |  |  | ✓ |  |
| Modifier les informations de l’entreprise (`client.org.write`) |  |  |  | ✓ |  |
| Créer une demande d’assistance (`client.support.create`) |  |  |  | ✓ |  |
| Demander des minutes ou un changement de formule (`client.topup.request`) |  |  |  | ✓ |  |

## Règles appliquées

- **Vérification côté serveur.** Chaque page appelle `requireAdmin(permission)` ou `requireClient(permission)` avant toute lecture. Chaque action serveur appelle `assertPermission(permission)`. Masquer un bouton n'est jamais la protection.
- **Séparation des espaces.** Un rôle ATIE est redirigé hors de `/client`, un rôle entreprise hors de `/admin`. Les deux ensembles de permissions sont disjoints (vérifié par `tests/permissions.test.ts`).
- **Pas de changement de tenant.** L'espace client ne reçoit aucun identifiant d'entreprise par l'URL ni par les formulaires : l'entreprise est déduite de l'appartenance de l'utilisateur (`organization_users`). Les actions client vérifient en plus que l'objet modifié appartient à cette entreprise.
- **Accès par URL.** Les objets enfants sont toujours lus « dans » leur entreprise (`getKnowledgeSourceForOrg(orgId, id)`) : modifier un identifiant dans l'URL renvoie une 404.
- **Expiration.** La session est signée (HMAC-SHA256) et porte une date d'expiration (`PlatformSettings.sessionTimeoutMinutes`, 30 min par défaut). Cookie `httpOnly`, `SameSite=Lax`, `Secure` en production.
- **Audit.** Les actions administratives (création, modification, suspension, changement de formule, recharges, avoirs, réinitialisation…) ajoutent une entrée au journal d'audit, sans secret ni contenu sensible.

## Mode démonstration

`/connexion` propose un **sélecteur de profils fictifs**. Ce n'est **pas** une authentification : il n'y a pas de mot de passe. En production, `lib/auth/session.ts` sera branché sur un fournisseur d'identité (identifiants personnels, double facteur obligatoire pour le personnel ATIE, SSO éventuel). Les fonctions `requireAdmin`, `requireClient` et `assertPermission` ne changent pas.
