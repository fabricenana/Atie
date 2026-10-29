import "server-only";
import { one, type Queryable } from "./db";
import type { PlatformSettings } from "./domain/types";

/**
 * Paramètres de la console, stockés dans atie.settings (clé → jsonb, migration 002).
 * Valeurs par défaut appliquées tant que rien n'a été enregistré.
 */

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  platformName: "ATIE Presence",
  defaultLang: "fr",
  enabledLangs: ["fr", "de", "it", "en"],
  defaultMaxConversationSeconds: 180,
  defaultRetentionDays: 30,
  quotaAlertPct: 80,
  sessionTimeoutMinutes: 30,
  require2fa: true,
  notifyEmail: "",
};

export interface BillingSettings {
  currency: "CHF";
  paymentTermsDays: number;
  /** Taux de TVA en pour mille (81 = 8,1 %) pour rester en entiers. */
  vatRatePermille: number;
  vatNumber: string;
  invoicePrefix: string;
  footerNote: string;
}

export const DEFAULT_BILLING_SETTINGS: BillingSettings = {
  currency: "CHF",
  paymentTermsDays: 30,
  vatRatePermille: 81,
  vatNumber: "",
  invoicePrefix: "ATIE-",
  footerNote: "",
};

type Key = "platform" | "billing";

async function load<T extends object>(q: Queryable, key: Key, defaults: T): Promise<T> {
  const row = await one<{ value: Partial<T> }>(q, "SELECT value FROM settings WHERE key = $1", [key]);
  return { ...defaults, ...(row?.value ?? {}) };
}

export const loadPlatformSettings = (q: Queryable) => load(q, "platform", DEFAULT_PLATFORM_SETTINGS);
export const loadBillingSettings = (q: Queryable) => load(q, "billing", DEFAULT_BILLING_SETTINGS);

/** Fusionne `patch` dans la valeur enregistrée (à appeler dans une transaction personnel ATIE). */
export async function saveSettings(q: Queryable, key: Key, patch: object, actorId: string) {
  await q.query(
    `INSERT INTO settings (key, value, updated_at, updated_by) VALUES ($1, $2::jsonb, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = settings.value || EXCLUDED.value, updated_at = now(), updated_by = EXCLUDED.updated_by`,
    [key, JSON.stringify(patch), actorId],
  );
}
