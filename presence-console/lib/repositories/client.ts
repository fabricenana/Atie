import "server-only";
import type { ID, Lang } from "../domain/types";
import { readStore } from "../demo/store";

/**
 * Lectures propres à l'espace client. Toujours filtrées par l'organisation
 * de la session (fournie par requireClient), jamais par un paramètre d'URL.
 */

/** Recharges proposées en démonstration : prix indicatifs, non approuvés. */
export const TOPUP_OPTIONS = [
  { minutes: 50, priceCents: 1500 },
  { minutes: 100, priceCents: 2900 },
] as const;

/** Répartition des langues des visiteurs (conversations abouties). */
export function visitorLanguagesForOrg(orgId: ID, sinceIso?: string) {
  const counts = new Map<Lang, number>();
  let total = 0;
  for (const c of readStore().conversations) {
    if (c.organizationId !== orgId || c.status === "failed") continue;
    if (sinceIso && c.startedAt < sinceIso) continue;
    counts.set(c.lang, (counts.get(c.lang) ?? 0) + 1);
    total++;
  }
  return {
    total,
    items: [...counts.entries()].map(([lang, n]) => ({ lang, n, pct: total ? Math.round((n / total) * 100) : 0 })).sort((a, b) => b.n - a.n),
  };
}

/**
 * Conversations présentées au client : uniquement les champs autorisés
 * (date, durée, langue, statut). Ni coût fournisseur, ni identifiant technique,
 * ni transcription.
 */
export function clientInteractions(orgId: ID) {
  return readStore()
    .conversations.filter((c) => c.organizationId === orgId)
    .map((c) => ({
      id: c.id,
      startedAt: c.startedAt,
      durationSeconds: c.durationSeconds,
      lang: c.lang,
      outcome: clientOutcome(c.status),
    }));
}

export type ClientOutcome = "in_progress" | "completed" | "interrupted";

function clientOutcome(status: string): ClientOutcome {
  if (status === "pending" || status === "connecting" || status === "active" || status === "terminating") return "in_progress";
  if (status === "ended") return "completed";
  return "interrupted";
}

export const CLIENT_OUTCOME = {
  in_progress: { label: "En cours", tone: "success" },
  completed: { label: "Terminée", tone: "neutral" },
  interrupted: { label: "Interrompue", tone: "warning" },
} as const;

/** Offres affichables au client (actives uniquement). */
export function activePlans() {
  return readStore().plans.filter((p) => p.active);
}
