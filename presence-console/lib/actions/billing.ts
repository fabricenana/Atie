"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors, type ActionResult } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { audit, isUuid, one, pgCode, withStaff } from "../db";
import { loadBillingSettings, saveSettings } from "../settings";

/**
 * Facturation tenue dans la console. Aucun prestataire de paiement n'est connecté :
 * « marquer payée » enregistre un règlement constaté manuellement, rien n'est encaissé.
 */

const fail = (e: unknown): ActionResult => ({
  ok: false,
  message: e instanceof ForbiddenError ? e.message : "L’opération a échoué. Aucune donnée n’a été modifiée.",
});

export async function markInvoicePaid(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("billing.write");
    if (!isUuid(payload.id)) return { ok: false, message: "Facture introuvable." };
    const result = await withStaff<ActionResult>(async (q) => {
      const inv = await one<{ organizationId: string; number: string; kind: string; status: string; totalCents: number }>(
        q,
        `SELECT organization_id AS "organizationId", number, kind, status::text AS status, total_cents AS "totalCents" FROM invoices WHERE id = $1 FOR UPDATE`,
        [payload.id],
      );
      if (!inv) return { ok: false, message: "Facture introuvable." };
      if (inv.kind !== "invoice" || (inv.status !== "open" && inv.status !== "overdue")) {
        return { ok: false, message: "Seule une facture à payer ou échue peut être marquée payée." };
      }
      await q.query("UPDATE invoices SET status = 'paid' WHERE id = $1", [payload.id]);
      await q.query("INSERT INTO payments (invoice_id, organization_id, amount_cents, method, status) VALUES ($1, $2, $3, 'manual', 'recorded')", [
        payload.id,
        inv.organizationId,
        inv.totalCents,
      ]);
      await audit(q, v.user.id, inv.organizationId, "invoice.mark_paid", inv.number, "Règlement constaté manuellement");
      return { ok: true, message: `${inv.number} marquée payée (règlement manuel, aucun encaissement automatique).` };
    });
    if (result.ok) revalidatePath("/admin/facturation", "layout");
    return result;
  } catch (e) {
    return fail(e);
  }
}

export async function issueCreditNote(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("billing.write");
    if (!isUuid(payload.id)) return { ok: false, message: "Facture introuvable." };
    const result = await withStaff<ActionResult>(async (q) => {
      const inv = await one<{ organizationId: string; number: string; kind: string; status: string; totalCents: number }>(
        q,
        `SELECT organization_id AS "organizationId", number, kind, status::text AS status, total_cents AS "totalCents" FROM invoices WHERE id = $1 FOR UPDATE`,
        [payload.id],
      );
      if (!inv) return { ok: false, message: "Facture introuvable." };
      if (inv.kind !== "invoice" || inv.status === "void" || inv.status === "credited" || inv.status === "draft") {
        return { ok: false, message: "Un avoir ne peut être émis que sur une facture émise." };
      }
      if (await one(q, "SELECT 1 FROM invoices WHERE kind = 'credit_note' AND credited_invoice_id = $1", [payload.id])) {
        return { ok: false, message: "Un avoir existe déjà pour cette facture." };
      }
      const settings = await loadBillingSettings(q);
      const year = new Date().getUTCFullYear();
      const seq = await one<{ n: number }>(
        q,
        "SELECT count(*)::int + 1 AS n FROM invoices WHERE kind = 'credit_note' AND extract(year FROM issued_at AT TIME ZONE 'UTC') = $1",
        [year],
      );
      const number = `${settings.invoicePrefix}AV-${year}-${String(seq?.n ?? 1).padStart(4, "0")}`;
      const credit = await one<{ id: string }>(
        q,
        `INSERT INTO invoices (organization_id, number, kind, credited_invoice_id, issued_at, due_at, status, total_cents)
         VALUES ($1, $2, 'credit_note', $3, now(), now(), 'credited', $4) RETURNING id`,
        [inv.organizationId, number, payload.id, -inv.totalCents],
      );
      await q.query("INSERT INTO invoice_lines (invoice_id, label, quantity, unit_price_cents) VALUES ($1, $2, 1, $3)", [
        credit!.id,
        `Avoir sur ${inv.number}`,
        -inv.totalCents,
      ]);
      // Une facture non réglée est annulée par l'avoir ; une facture payée reste payée.
      if (inv.status === "open" || inv.status === "overdue") await q.query("UPDATE invoices SET status = 'void' WHERE id = $1", [payload.id]);
      await audit(q, v.user.id, inv.organizationId, "invoice.credit_note", inv.number, `Avoir ${number}`);
      return { ok: true, message: `Avoir ${number} émis. Aucun remboursement n’est déclenché automatiquement.` };
    });
    if (result.ok) revalidatePath("/admin/facturation", "layout");
    return result;
  } catch (e) {
    if (pgCode(e) === "23505") return { ok: false, message: "Numéro d’avoir déjà attribué : réessayez." };
    return fail(e);
  }
}

const settingsSchema = z.object({
  paymentTermsDays: z.coerce.number().int("Nombre entier.").min(0, "Valeur positive.").max(120, "120 jours au plus."),
  vatRate: z
    .string()
    .trim()
    .regex(/^\d{1,2}([.,]\d)?$/, "Taux en %, par exemple 8.1."),
  vatNumber: z.string().trim().min(3, "Numéro requis.").max(40, "40 caractères au plus."),
  invoicePrefix: z
    .string()
    .trim()
    .regex(/^[A-Z0-9][A-Z0-9-]{0,11}$/, "Majuscules, chiffres et tirets (12 caractères au plus), par exemple ATIE-."),
  footerNote: z.string().trim().max(200, "200 caractères au plus."),
});

export async function saveBillingSettings(_prev: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("billing.write");
    const parsed = settingsSchema.safeParse({
      paymentTermsDays: data.get("paymentTermsDays") ?? "",
      vatRate: data.get("vatRate") ?? "",
      vatNumber: data.get("vatNumber") ?? "",
      invoicePrefix: data.get("invoicePrefix") ?? "",
      footerNote: data.get("footerNote") ?? "",
    });
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const p = parsed.data;
    await withStaff(async (q) => {
      await saveSettings(
        q,
        "billing",
        {
          currency: "CHF",
          paymentTermsDays: p.paymentTermsDays,
          vatRatePermille: Math.round(Number(p.vatRate.replace(",", ".")) * 10),
          vatNumber: p.vatNumber,
          invoicePrefix: p.invoicePrefix,
          footerNote: p.footerNote,
        },
        v.user.id,
      );
      await audit(q, v.user.id, null, "billing.settings", "Paramètres de facturation", `Délai ${p.paymentTermsDays} j, TVA ${p.vatRate} %`);
    });
    revalidatePath("/admin/facturation", "layout");
    return { ok: true, message: "Paramètres de facturation enregistrés." };
  } catch (e) {
    return fail(e);
  }
}
