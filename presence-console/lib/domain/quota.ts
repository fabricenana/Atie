import type { Plan, Subscription } from "./types";

/**
 * Quota commercial d'une entreprise sur la période en cours (calcul pur).
 * Les secondes facturables viennent des conversations écrites par le backend Python ;
 * la console ne fait qu'afficher : elle ne recalcule jamais un quota faisant foi.
 */

export interface QuotaState {
  subscription: Subscription | null;
  plan: Plan | null;
  includedMinutes: number;
  topupMinutes: number;
  usedSeconds: number;
  usedMinutes: number;
  remainingMinutes: number;
  pctUsed: number;
  sessions: number;
  concurrent: number;
  alert: "none" | "warning" | "exhausted";
}

export interface QuotaInput {
  subscription: Subscription | null;
  plan: Plan | null;
  /** Secondes facturables des conversations de la période. */
  usedSeconds: number;
  /** Conversations de la période hors échecs. */
  sessions: number;
  /** Minutes des recharges appliquées pendant la période. */
  topupMinutes: number;
  /** Sessions simultanées supplémentaires actives. */
  extraConcurrent: number;
}

export function computeQuota(i: QuotaInput): QuotaState {
  const includedMinutes = i.plan?.includedMinutes ?? 0;
  const total = includedMinutes + i.topupMinutes;
  const usedMinutes = Math.round((i.usedSeconds / 60) * 10) / 10;
  const remainingMinutes = Math.max(0, Math.round((total - usedMinutes) * 10) / 10);
  const pctUsed = total ? Math.min(100, Math.round((usedMinutes / total) * 100)) : 0;
  const threshold = i.subscription?.alertThresholdPct ?? 80;
  return {
    subscription: i.subscription,
    plan: i.plan,
    includedMinutes,
    topupMinutes: i.topupMinutes,
    usedSeconds: i.usedSeconds,
    usedMinutes,
    remainingMinutes,
    pctUsed,
    sessions: i.sessions,
    concurrent: (i.plan?.concurrentSessions ?? 0) + i.extraConcurrent,
    alert: total && usedMinutes >= total ? "exhausted" : pctUsed >= threshold ? "warning" : "none",
  };
}
