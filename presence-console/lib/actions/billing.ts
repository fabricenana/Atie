"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrors, type ActionResult } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { mutateStore, newId } from "../demo/store";
import type { StoreWithBilling } from "../repositories/billing";
import { DEFAULT_BILLING_SETTINGS } from "../repositories/billing";
import { audit } from "./audit";

/**
 * Facturation de DÉMONSTRATION : aucune facture officielle, aucun paiement réel,
 * aucun prestataire appelé. Les actions modifient uniquement les données locales.
 */

const fail = (e: unknown): ActionResult => ({
  ok: false,
  message: e instanceof ForbiddenError ? e.message : "L’opération a échoué. Aucune donnée n’a été modifiée.",
});

export async function markInvoicePaid(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("billing.write");
    const result = await mutateStore<ActionResult>((s) => {
      const inv = s.invoices.find((i) => i.id === payload.id);
      if (!inv) return { ok: false, message: "Facture introuvable." };
      if (inv.kind !== "invoice" || (inv.status !== "open" && inv.status !== "overdue")) {
        return { ok: false, message: "Seule une facture à payer ou échue peut être marquée payée." };
      }
      inv.status = "paid";
      s.payments.push({
        id: newId("pay"),
        invoiceId: inv.id,
        organizationId: inv.organizationId,
        amountCents: inv.totalCents,
        method: "manual",
        status: "recorded",
        at: new Date().toISOString(),
      });
      audit(s, v.user.id, inv.organizationId, "invoice.mark_paid", inv.number, "Règlement manuel (démo)");
      return { ok: true, message: `${inv.number} marquée payée (démo, aucun paiement réel).`, simulated: true };
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
    const result = await mutateStore<ActionResult>((s) => {
      const inv = s.invoices.find((i) => i.id === payload.id);
      if (!inv) return { ok: false, message: "Facture introuvable." };
      if (inv.kind !== "invoice" || inv.status === "void" || inv.status === "credited" || inv.status === "draft") {
        return { ok: false, message: "Un avoir ne peut être émis que sur une facture émise." };
      }
      if (s.invoices.some((i) => i.kind === "credit_note" && i.lines.some((l) => l.label.includes(inv.number)))) {
        return { ok: false, message: "Un avoir existe déjà pour cette facture." };
      }
      const now = new Date();
      const seq = s.invoices.filter((i) => i.kind === "credit_note").length + 1;
      const number = `DEMO-AV-${now.getUTCFullYear()}-${String(seq).padStart(4, "0")}`;
      s.invoices.push({
        id: newId("inv"),
        organizationId: inv.organizationId,
        number,
        issuedAt: now.toISOString(),
        dueAt: now.toISOString(),
        status: "credited",
        kind: "credit_note",
        lines: [{ label: `Avoir sur ${inv.number} (démo)`, quantity: 1, unitPriceCents: -inv.totalCents }],
        totalCents: -inv.totalCents,
      });
      // Une facture non réglée est annulée par l'avoir ; une facture payée reste payée.
      if (inv.status === "open" || inv.status === "overdue") inv.status = "void";
      audit(s, v.user.id, inv.organizationId, "invoice.credit_note", inv.number, `Avoir ${number}`);
      return { ok: true, message: `Avoir ${number} émis (démo, sans valeur comptable).`, simulated: true };
    });
    if (result.ok) revalidatePath("/admin/facturation", "layout");
    return result;
  } catch (e) {
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
    .regex(/^DEMO-[A-Z0-9-]{0,10}$/, "En démonstration, le préfixe doit commencer par DEMO-."),
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
    await mutateStore((st) => {
      const s = st as StoreWithBilling;
      s.billingSettings = {
        ...DEFAULT_BILLING_SETTINGS,
        ...s.billingSettings,
        currency: "CHF",
        paymentTermsDays: p.paymentTermsDays,
        vatRatePermille: Math.round(Number(p.vatRate.replace(",", ".")) * 10),
        vatNumber: p.vatNumber,
        invoicePrefix: p.invoicePrefix,
        footerNote: p.footerNote,
      };
      audit(st, v.user.id, null, "billing.settings", "Paramètres de facturation", `Délai ${p.paymentTermsDays} j, TVA ${p.vatRate} %`);
    });
    revalidatePath("/admin/facturation", "layout");
    return { ok: true, message: "Paramètres de facturation enregistrés (démo)." };
  } catch (e) {
    return fail(e);
  }
}
