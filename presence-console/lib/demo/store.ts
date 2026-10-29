import "server-only";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { DemoStore } from "../domain/types";
import { buildSeed, SEED_VERSION } from "./seed";

/**
 * Persistance locale des données de démonstration.
 *
 * Un seul fichier JSON hors Git (.demo-data/store.json), recréé à partir de la graine
 * s'il est absent ou d'une autre version. Si l'écriture disque est impossible
 * (environnement en lecture seule), les données restent en mémoire.
 * Ce module n'est jamais importé côté navigateur.
 */

const DIR = process.env.ATIE_DEMO_DATA_DIR ?? path.join(process.cwd(), ".demo-data");
const FILE = path.join(DIR, "store.json");

const g = globalThis as unknown as { __atieDemoStore?: DemoStore; __atieDemoQueue?: Promise<unknown> };

function load(): DemoStore {
  try {
    const data = JSON.parse(readFileSync(FILE, "utf8")) as DemoStore;
    if (data.version === SEED_VERSION) return data;
  } catch {
    // absent ou illisible : on régénère
  }
  const fresh = buildSeed();
  persist(fresh);
  return fresh;
}

function persist(data: DemoStore) {
  try {
    mkdirSync(DIR, { recursive: true });
    const tmp = `${FILE}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 1));
    renameSync(tmp, FILE);
  } catch {
    // lecture seule : mémoire uniquement
  }
}

/** Lecture (copie non partagée inutile : les appelants ne modifient pas). */
export function readStore(): DemoStore {
  if (!g.__atieDemoStore) g.__atieDemoStore = load();
  return g.__atieDemoStore;
}

/**
 * Écriture sérialisée : une mutation à la fois, puis sauvegarde atomique.
 * La fonction reçoit le store et le modifie en place.
 */
export async function mutateStore<T>(fn: (s: DemoStore) => T): Promise<T> {
  const run = async () => {
    const s = readStore();
    const result = fn(s);
    persist(s);
    return result;
  };
  const prev = g.__atieDemoQueue ?? Promise.resolve();
  const next = prev.then(run, run);
  g.__atieDemoQueue = next.catch(() => undefined);
  return next;
}

/** Réinitialise les données de démonstration (action réservée au super administrateur). */
export function resetStore() {
  g.__atieDemoStore = buildSeed();
  persist(g.__atieDemoStore);
}

export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}
