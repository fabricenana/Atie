# Fonctionnalités simulées ou non connectées

La console est **fonctionnelle en démonstration** : navigation, recherche, filtres, tri,
pagination, formulaires validés, confirmations, notifications et contrôles d'accès
fonctionnent réellement. Les écritures sont enregistrées **localement** dans
`.demo-data/store.json` (hors Git) et apparaissent dans le journal d'audit.

Ce qui suit n'est **pas** opérationnel et est signalé comme tel dans l'interface
(bandeau « Mode démonstration », badges `Démo` / `Estimé`, encadrés « non connecté »,
boutons désactivés avec explication).

## Données

| Élément | État |
|---|---|
| Entreprises, personnes, chiffres, demandes visiteurs | Fictifs (domaines `.example`, noms suffixés « (démo) ») |
| Sessions, minutes, statistiques | Générées par `lib/demo/seed.ts` (graine fixe). En production : backend Python |
| Coût fournisseur par session | **Estimation** de démonstration (CHF 0.12/min), badge « Estimé » |
| Pool de minutes LiveKit / LemonSlice | **Aucune donnée** : affiché « — », fournisseur non connecté |
| Factures, avoirs, paiements | Numéros `DEMO-…`, « sans valeur comptable » ; aucune facture officielle |
| Transcriptions | **Aucune** : jamais générées, désactivées par défaut pour toutes les entreprises |

## Actions

| Action | Comportement actuel |
|---|---|
| Connexion | Sélecteur de profils fictifs — **pas une authentification** |
| Suspension / réactivation d'une entreprise | Change le statut local ; n'interrompt aucun service réel |
| Configuration d'une réceptionniste | Enregistrée localement ; rien n'est envoyé à l'agent Python ni à LemonSlice |
| Création de réceptionniste | Uniquement à partir des avatars existants Léa et Maya ; aucun avatar créé |
| Aperçu du widget | Maquette statique ; bouton « Démarrer » désactivé (aucune session payante) |
| Knowledge Base : ajout de texte | Enregistré localement, statut « Démo — non indexé » |
| Knowledge Base : ajout d'URL | Seule la référence est enregistrée ; la page n'est pas téléchargée |
| Knowledge Base : import PDF/DOCX | Seuls le nom et la taille sont conservés ; le contenu n'est ni lu ni stocké |
| Indexation, recherche sémantique, RAG | Non connectés (préparés : statuts, versions, schéma) |
| Vérification de domaine | Simulée : aucune requête DNS/HTTP |
| Invitation d'utilisateur | Crée un compte « invité » local ; aucun e-mail |
| Sessions actives : « Forcer la fermeture » | Désactivé ; relèvera de l'API Python |
| Intégration du widget | Script généré avec `data-api` en placeholder ; rien n'est publié |
| Formules, abonnements, recharges, concurrence | Modifications locales ; aucune opération financière |
| « Marquer payée », « Émettre un avoir » | Libellés « (démo) » ; aucun paiement ni document comptable |
| Prestataire de paiement | Non choisi, non connecté |
| Demandes client (modification, minutes, changement de formule) | Mode **demande** : crée une demande de support et une notification |
| Notifications e-mail | Aucune n'est envoyée |
| État des fournisseurs | « Non configuré / non connecté » ; aucune clé n'est lue ni affichée |
| Module rendez-vous | « Disponible lorsqu'un module compatible sera connecté » |

## Réinitialiser la démonstration

- Depuis l'interface : *Paramètres › Sécurité › Réinitialiser les données de démonstration* (super administrateur).
- En ligne de commande : `npm run demo:reset`, puis redémarrer le serveur.
