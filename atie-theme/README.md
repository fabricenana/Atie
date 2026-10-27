# Thème ATIE (WordPress)

Thème classique, natif, **sans Divi**, pour le site d'ATIE.
Responsive · français · compatible WooCommerce, Forminator, Rank Math, Site Kit.
Testé pour PHP 8.x / WordPress 7.0 (hébergement mutualisé Infomaniak).

---

## 1. Installation

1. Compresser le dossier `atie-theme/` en `.zip` (ou utiliser le zip fourni).
2. WordPress → **Apparence → Thèmes → Ajouter → Téléverser un thème** → choisir le `.zip` → **Installer** → **Activer**.
3. À l'activation, les permaliens des nouveaux contenus sont automatiquement régénérés.
   En cas de page 404 sur une réalisation/un service, aller dans **Réglages → Permaliens** et cliquer **Enregistrer** (sans rien changer).

## 2. Suppression de Divi

- Le thème **ré-enregistre** le type de contenu `project` et la taxonomie `project_category`
  (auparavant fournis par Divi) : **vos réalisations existantes restent accessibles** après désactivation de Divi.
- Aucune dépendance ni shortcode `[et_pb_*]`. Si d'anciens contenus contiennent des shortcodes Divi,
  les nettoyer page par page (ils s'afficheront sinon en texte brut).

## 3. Structure des contenus

| Élément du site | Source WordPress |
|---|---|
| Accueil | `front-page.php` (définir une page d'accueil statique dans **Réglages → Lecture**, ou laisser la page d'accueil par défaut) |
| Portfolio | Archive du CPT **Réalisations** (`/realisations/`) |
| Réalisation (détail) | CPT **Réalisations** → champ *Lien du site* + *Année* (encadré latéral) |
| Catégories du portfolio | Taxonomie **project_category** (onglets de filtrage automatiques) |
| Services | Archive du CPT **Services** (`/services/`) |
| Service (détail) | CPT **Services** → *Icône* + *Prestations incluses* (une par ligne) |
| Contact | Page avec le modèle **Contact** |

### Menu
**Apparence → Menus** → créer un menu, l'assigner à l'emplacement **« Menu principal »**.
Liens suggérés : Accueil · Portfolio (archive Réalisations) · Services (archive Services) · Contact.
Sans menu assigné, un menu de secours s'affiche automatiquement.

### Page de contact
1. Créer une page **Contact** (slug `contact`).
2. Lui attribuer le modèle **Contact** (encadré *Attributs de page → Modèle*).
3. Insérer le formulaire **Forminator** :
   - soit en collant le bloc/shortcode Forminator dans le contenu de la page,
   - soit en renseignant l'ID du formulaire dans **Apparence → Personnaliser → Options ATIE**.

## 4. Réglages du thème (Personnaliser)

**Apparence → Personnaliser → Options ATIE** :
- Titre d'accueil (hero) — défaut : *De la pensée au pixel.*
- E-mail de contact — défaut : *contact@atie.ch*
- Adresse (carte Google Maps) — défaut : *Route des Jeunes 23, 1227 Carouge*
- ID du formulaire Forminator

Logo : **Personnaliser → Identité du site → Logo** (sinon le logo ATIE fourni est utilisé).

## 5. Polices

Archivo (titres), Work Sans (texte), Roboto (UI) — chargées via Google Fonts.

## 6. Compatibilité plugins

- **WooCommerce** : supports déclarés (gallery zoom/lightbox/slider). Les templates WooCommerce
  par défaut s'appliquent ; surcharger via `woocommerce/` dans le thème si besoin.
- **Forminator / Rank Math / Site Kit** : aucun conflit, aucune sortie en double `<head>`/`<title>`
  (le thème utilise `title-tag`).

## 7. Arborescence

```
atie-theme/
├── style.css              en-tête du thème
├── functions.php          bootstrap
├── header.php  footer.php
├── front-page.php         Accueil (hero + ticker)
├── archive-project.php    Portfolio (+ filtres)
├── single-project.php     Réalisation (détail)
├── archive-service.php    Services (grille)
├── single-service.php     Service (détail)
├── templates/
│   └── template-contact.php   modèle Contact (Forminator + Maps)
├── index.php  page.php  single.php  404.php  searchform.php
├── inc/
│   ├── theme-setup.php    supports, menus, i18n, widgets
│   ├── enqueue.php        polices + CSS/JS
│   ├── post-types.php     CPT project + service, taxo project_category
│   ├── meta-boxes.php     champs réalisation/service
│   ├── customizer.php     options ATIE
│   └── template-tags.php  helpers
├── template-parts/
│   ├── card-project.php
│   └── card-service.php
└── assets/
    ├── css/main.css
    ├── js/theme.js  js/portfolio.js
    └── img/  (logo, fond, penseur)
```

---

© ATIE — thème sur-mesure.

## 8. Page ATIE Presence

1. **Pages → Ajouter** : titre au choix (affiché en grand, en rouge), par exemple *Une réceptionniste IA pour votre site*.
2. **Attributs de page → Modèle** : **ATIE Presence**. Le slug conseillé est `atie-presence`.
3. Le contenu de l'éditeur, s'il n'est pas vide, s'affiche sous l'en-tête. Le reste de la page est fourni par le gabarit.
4. Le widget de la réceptionniste n'est chargé que sur cette page, en **démonstration simulée** : aucun micro, aucun appel réseau.
   « Laisser un message » mène à la page `contact`.

## 9. Mises à jour du thème

Le code source est sur GitHub (`fabricenana/Atie`). Chaque version publiée y devient une *release* avec l'archive
`atie-theme-x.y.z.zip`. WordPress la voit et propose la mise à jour comme pour n'importe quel thème :
**Tableau de bord → Mises à jour**. **Apparence → Mises à jour ATIE** affiche la version installée et la dernière publiée,
et relance la vérification (sinon toutes les 6 h).

- Dépôt **public** : rien à configurer.
- Dépôt **privé** : saisir dans **Apparence → Mises à jour ATIE** un jeton GitHub *fine-grained* limité au dépôt,
  permission *Contents* en lecture seule (ou la constante `ATIE_GITHUB_TOKEN` dans `wp-config.php`).

Publier une version (depuis la racine du dépôt) :

```bash
# 1. Augmenter la version dans atie-theme/style.css ET atie-theme/functions.php (ATIE_VERSION)
# 2. Écrire les notes dans outils/notes/X.Y.Z.md, puis commiter
bash outils/publier.sh             # contrôle : versions identiques, zip correct, rien n'est publié
bash outils/publier.sh --publier   # tag vX.Y.Z + release GitHub avec le zip
```

Essayer avant de publier : `apercu.cmd` lance un WordPress jetable sur ce PC (http://127.0.0.1:9400), thème activé et
page ATIE Presence créée. Rien n'est envoyé sur le site en ligne.
