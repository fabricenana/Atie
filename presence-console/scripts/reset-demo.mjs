#!/usr/bin/env node
// Supprime les données de démonstration locales : elles seront régénérées au prochain démarrage.
import { rmSync } from "node:fs";
import path from "node:path";

const dir = process.env.ATIE_DEMO_DATA_DIR ?? path.join(process.cwd(), ".demo-data");
rmSync(dir, { recursive: true, force: true });
console.log(`Données de démonstration supprimées (${dir}). Redémarrez le serveur.`);
