import "server-only";
import type { DemoStore, ID } from "../domain/types";
import { readStore } from "../demo/store";

/**
 * Paramètres de facturation (démo).
 * Stockés à côté des données de démonstration ; en production, ils relèveront
 * du backend commercial (voir docs/API-CONTRACTS.md).
 */
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
  vatNumber: "CHE-000.000.000 TVA (démo)",
  invoicePrefix: "DEMO-",
  footerNote: "Document de démonstration — sans valeur comptable.",
};

export type StoreWithBilling = DemoStore & { billingSettings?: BillingSettings };

export function getBillingSettings(): BillingSettings {
  return { ...DEFAULT_BILLING_SETTINGS, ...((readStore() as StoreWithBilling).billingSettings ?? {}) };
}

export const getInvoice = (id: ID) => readStore().invoices.find((i) => i.id === id) ?? null;
export const listPaymentsForInvoice = (invoiceId: ID) =>
  readStore()
    .payments.filter((p) => p.invoiceId === invoiceId)
    .sort((a, b) => b.at.localeCompare(a.at));

/** Nom d'une entreprise pour l'affichage (back-office uniquement). */
export function orgNameMap(): Map<ID, string> {
  return new Map(readStore().organizations.map((o) => [o.id, o.name]));
}
