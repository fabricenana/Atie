#!/usr/bin/env bash
# Publie une version du thème ATIE sur GitHub (release + archive zip).
# Les sites qui ont un jeton la voient ensuite dans Tableau de bord → Mises à jour.
#
#   bash outils/publier.sh            → contrôle seulement (versions, zip), rien n'est publié
#   bash outils/publier.sh --publier  → crée le tag vX.Y.Z et la release avec atie-theme-X.Y.Z.zip
#
# Notes de version : outils/notes/X.Y.Z.md (obligatoire pour publier).
set -euo pipefail
cd "$(dirname "$0")/.."

style=$(sed -n 's/^Version:[[:space:]]*//p' atie-theme/style.css | tr -d '\r')
php=$(sed -n "s/.*define( 'ATIE_VERSION', '\([^']*\)' );.*/\1/p" atie-theme/functions.php | tr -d '\r')

if [ -z "$style" ] || [ "$style" != "$php" ]; then
	echo "ARRÊT : version de style.css ($style) différente de ATIE_VERSION ($php)." >&2
	exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
	echo "ARRÊT : des modifications ne sont pas commitées." >&2
	git status --short >&2
	exit 1
fi
if git rev-parse -q --verify "refs/tags/v$style" >/dev/null; then
	echo "ARRÊT : le tag v$style existe déjà. Augmentez la version." >&2
	exit 1
fi

mkdir -p dist
zip="dist/atie-theme-$style.zip"
# Archive du dernier commit : seul le dossier atie-theme/ (racine attendue par WordPress).
git archive --format=zip -o "$zip" HEAD atie-theme
echo "version : $style"
echo "archive : $zip ($(du -k "$zip" | cut -f1) Ko, $(unzip -l "$zip" | tail -1 | awk '{print $2}') fichiers)"
if unzip -Z1 "$zip" | grep -v '^atie-theme/'; then
	echo "ARRÊT : fichier hors de atie-theme/." >&2
	exit 1
fi

if [ "${1:-}" != "--publier" ]; then
	echo "Contrôle terminé. Rien n'a été publié (ajoutez --publier)."
	exit 0
fi

notes="outils/notes/$style.md"
if [ ! -s "$notes" ]; then
	echo "ARRÊT : notes de version absentes ($notes)." >&2
	exit 1
fi

git tag -a "v$style" -m "ATIE $style"
git push origin HEAD "v$style"
gh release create "v$style" "$zip" --title "ATIE $style" --notes-file "$notes"
echo "Publié : ATIE $style. Les sites verront la mise à jour à leur prochaine vérification (6 h au plus, ou « Enregistrer et vérifier »)."
