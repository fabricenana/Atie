import "server-only";
import type { ID, Lang, Plan } from "../domain/types";
import { isUuid, rows } from "../db";
import { read } from "../db/scope";
import { PLAN_COLS } from "./sql";

/**
 * Lectures propres à l'espace client. Toujours filtrées par l'organisation
 * de la session (fournie par requireClient), jamais par un paramètre d'URL ;
 * la RLS (rôle atie_app) l'impose de toute façon.
 */

/** Recharges proposées : grille validée (lib/domain/pricing.ts). */
export { TOPUP_OPTIONS } from "../domain/pricing";

/** Répartition des langues des visiteurs (conversations abouties). */
export async function visitorLanguagesForOrg(orgId: ID, sinceIso?: string) {
  if (!isUuid(orgId)) return { total: 0, items: [] as Array<{ lang: Lang; n: number; pct: number }> };
  const list = await read((q) =>
    rows<{ lang: Lang; n: number }>(
      q,
      `SELECT c.lang::text AS lang, count(*)::int AS n
         FROM conversations c
        WHERE c.organization_id = $1 AND c.status <> 'failed' AND ($2::timestamptz IS NULL OR c.started_at >= $2::timestamptz)
        GROUP BY 1`,
      [orgId, sinceIso ?? null],
    ),
  );
  const total = list.reduce((s, x) => s + x.n, 0);
  return {
    total,
    items: list.map(({ lang, n }) => ({ lang, n, pct: total ? Math.round((n / total) * 100) : 0 })).sort((a, b) => b.n - a.n),
  };
}

export type ClientOutcome = "in_progress" | "completed" | "interrupted";

function clientOutcome(status: string): ClientOutcome {
  if (status === "pending" || status === "connecting" || status === "active" || status === "terminating") return "in_progress";
  if (status === "ended") return "completed";
  return "interrupted";
}

/**
 * Conversations présentées au client : uniquement les champs autorisés
 * (date, durée, langue, statut). Ni coût fournisseur, ni identifiant technique,
 * ni transcription.
 */
export async function clientInteractions(orgId: ID) {
  if (!isUuid(orgId)) return [];
  const list = await read((q) =>
    rows<{ id: ID; startedAt: string; durationSeconds: number; lang: Lang; status: string }>(
      q,
      `SELECT c.id, c.started_at AS "startedAt", c.duration_seconds AS "durationSeconds", c.lang::text AS lang, c.status::text AS status
         FROM conversations c WHERE c.organization_id = $1 ORDER BY c.started_at DESC LIMIT 1000`,
      [orgId],
    ),
  );
  return list.map(({ status, ...c }) => ({ ...c, outcome: clientOutcome(status) }));
}

export const CLIENT_OUTCOME = {
  in_progress: { label: "En cours", tone: "success" },
  completed: { label: "Terminée", tone: "neutral" },
  interrupted: { label: "Interrompue", tone: "warning" },
} as const;

/** Offres affichables au client (actives uniquement). */
export const activePlans = () =>
  read((q) => rows<Plan>(q, `SELECT ${PLAN_COLS} FROM plans p WHERE p.active ORDER BY p.monthly_price_cents, p.name`));
