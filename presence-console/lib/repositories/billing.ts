import "server-only";
import type { ID, Invoice, Payment } from "../domain/types";
import { isUuid, one, rows } from "../db";
import { read } from "../db/scope";
import { DEFAULT_BILLING_SETTINGS, loadBillingSettings, type BillingSettings } from "../settings";
import { INVOICE_COLS, PAYMENT_COLS } from "./sql";

/**
 * Facturation (back-office). Aucun prestataire de paiement n'est connecté :
 * les factures et paiements n'existent que s'ils ont été saisis dans la console.
 */

export { DEFAULT_BILLING_SETTINGS, type BillingSettings } from "../settings";

export const getBillingSettings = (): Promise<BillingSettings> =>
  read((q, scope) => (scope.kind === "staff" ? loadBillingSettings(q) : Promise.resolve({ ...DEFAULT_BILLING_SETTINGS })));

export const getInvoice = (id: ID) =>
  isUuid(id) ? read((q) => one<Invoice>(q, `SELECT ${INVOICE_COLS} FROM invoices i WHERE i.id = $1`, [id])) : Promise.resolve(null);

export const listPaymentsForInvoice = (invoiceId: ID) =>
  isUuid(invoiceId)
    ? read((q) => rows<Payment>(q, `SELECT ${PAYMENT_COLS} FROM payments pa WHERE pa.invoice_id = $1 ORDER BY pa.at DESC`, [invoiceId]))
    : Promise.resolve([] as Payment[]);

/** Nom d'une entreprise pour l'affichage (back-office uniquement). */
export async function orgNameMap(): Promise<Map<ID, string>> {
  const list = await read((q) => rows<{ id: ID; name: string }>(q, "SELECT o.id, o.name FROM organizations o"));
  return new Map(list.map((o) => [o.id, o.name]));
}
