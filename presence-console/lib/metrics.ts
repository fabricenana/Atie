import "server-only";
import type { Conversation, UsageRecord } from "./domain/types";

/** Agrégats temporels pour les graphiques (à partir des agrégats quotidiens du backend). */

export type Period = "7j" | "30j" | "90j" | "12m";
export const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "7j", label: "7 jours" },
  { key: "30j", label: "30 jours" },
  { key: "90j", label: "90 jours" },
  { key: "12m", label: "12 mois" },
];

export function parsePeriod(v: string | undefined, fallback: Period = "30j"): Period {
  return PERIODS.some((p) => p.key === v) ? (v as Period) : fallback;
}

const DAY = 86_400_000;
const dayLabel = new Intl.DateTimeFormat("fr-CH", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
const monthLabel = new Intl.DateTimeFormat("fr-CH", { month: "short", timeZone: "UTC" });

export function periodStart(period: Period, now = Date.now()) {
  if (period === "12m") {
    const d = new Date(now);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 11, 1);
  }
  const days = period === "7j" ? 7 : period === "30j" ? 30 : 90;
  const d = new Date(now - (days - 1) * DAY);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Série temporelle (jours, ou mois pour 12m) : sessions et minutes. */
export function usageSeries(records: UsageRecord[], period: Period, now = Date.now()) {
  const start = periodStart(period, now);
  const buckets: Array<{ key: string; label: string; sessions: number; minutes: number }> = [];
  if (period === "12m") {
    const d = new Date(start);
    for (let i = 0; i < 12; i++) {
      const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + i, 1));
      buckets.push({ key: m.toISOString().slice(0, 7), label: monthLabel.format(m).replace(".", ""), sessions: 0, minutes: 0 });
    }
  } else {
    for (let t = start; t <= now; t += DAY) {
      const k = new Date(t).toISOString().slice(0, 10);
      buckets.push({ key: k, label: dayLabel.format(new Date(t)), sessions: 0, minutes: 0 });
    }
  }
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  for (const r of records) {
    const k = period === "12m" ? r.day.slice(0, 7) : r.day;
    const i = index.get(k);
    if (i === undefined) continue;
    buckets[i].sessions += r.sessions;
    buckets[i].minutes += r.billableSeconds / 60;
  }
  for (const b of buckets) b.minutes = Math.round(b.minutes * 10) / 10;
  return buckets;
}

/** Pic de conversations simultanées sur un ensemble de sessions (balayage). */
export function peakConcurrency(conversations: Conversation[]) {
  const edges: Array<[number, number]> = [];
  for (const c of conversations) {
    if (c.status === "failed") continue;
    const s = new Date(c.startedAt).getTime();
    const e = c.endedAt ? new Date(c.endedAt).getTime() : Date.now();
    edges.push([s, 1], [e, -1]);
  }
  edges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let cur = 0;
  let peak = 0;
  for (const [, d] of edges) {
    cur += d;
    peak = Math.max(peak, cur);
  }
  return peak;
}

export function sinceMs(days: number, now = Date.now()) {
  return new Date(now - days * DAY).toISOString();
}

export function startOfToday(now = Date.now()) {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}
