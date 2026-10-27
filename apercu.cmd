@echo off
rem Apercu local du theme ATIE. Rien n'est envoye sur le site en ligne :
rem c'est un WordPress jetable qui tourne uniquement sur ce PC.

echo.
echo  Demarrage du site d'essai (2 a 3 minutes la premiere fois)...
echo.
echo    Page ATIE Presence : http://127.0.0.1:9400/atie-presence/
echo    Administration     : http://127.0.0.1:9400/wp-admin
echo.
echo  Fermez cette fenetre pour arreter le site d'essai.
echo  Ce qui y est modifie n'est pas conserve d'un lancement a l'autre.
echo.

npx --yes @wp-playground/cli@3.1.57 server --mount-dir "%~dp0atie-theme" /wordpress/wp-content/themes/atie-theme --blueprint="%~dp0outils\blueprint-apercu.json" --port=9400
