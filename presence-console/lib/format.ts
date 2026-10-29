import type { Cents, Lang } from "./domain/types";

const chf = new Intl.NumberFormat("fr-CH", { style: "currency", currency: "CHF", minimumFractionDigits: 2 });
const num = new Intl.NumberFormat("fr-CH");
const dateFmt = new Intl.DateTimeFormat("fr-CH", { day: "2-digit", month: "short", year: "numeric", timeZone: "Europe/Zurich" });
const dateTimeFmt = new Intl.DateTimeFormat("fr-CH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
const timeFmt = new Intl.DateTimeFormat("fr-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });

export const formatCHF = (cents: Cents) => chf.format(cents / 100);
export const formatNumber = (n: number) => num.format(n);
export const formatDate = (d: string | null | undefined) => (d ? dateFmt.format(new Date(d)) : "—");
export const formatDateTime = (d: string | null | undefined) => (d ? dateTimeFmt.format(new Date(d)) : "—");
export const formatTime = (d: string | null | undefined) => (d ? timeFmt.format(new Date(d)) : "—");

/** 125 → « 2:05 » */
export function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Secondes → minutes facturables (arrondi à la minute supérieure par session côté backend ; ici agrégé). */
export const toMinutes = (seconds: number) => Math.round((seconds / 60) * 10) / 10;

export function formatRelative(d: string | null | undefined, now = Date.now()) {
  if (!d) return "—";
  const diff = Math.round((now - new Date(d).getTime()) / 1000);
  if (diff < 60) return "à l’instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  const days = Math.floor(diff / 86400);
  return days === 1 ? "hier" : `il y a ${days} j`;
}

export const LANG_LABELS: Record<Lang, string> = { fr: "Français", de: "Allemand", it: "Italien", en: "Anglais" };
export const LANG_SHORT: Record<Lang, string> = { fr: "FR", de: "DE", it: "IT", en: "EN" };

export function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}
