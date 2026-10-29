import { getViewer } from "@/lib/auth/session";
import { can, isAtieRole } from "@/lib/auth/permissions";
import { listInvoices, listOrganizations } from "@/lib/repositories";
import { INVOICE_STATUS } from "@/lib/labels";

export const dynamic = "force-dynamic";

const esc = (v: string | number) => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Export CSV des factures (séparateur « ; », encodage UTF-8 avec BOM pour Excel). */
export async function GET() {
  const v = await getViewer();
  if (!v || !isAtieRole(v.role) || !can(v.role, "billing.read")) {
    return new Response("Accès refusé.", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const [orgList, invoices] = await Promise.all([listOrganizations(), listInvoices()]);
  const orgs = new Map(orgList.map((o) => [o.id, o.name]));
  const head = ["Numéro", "Type", "Entreprise", "Émise le", "Échéance", "Statut", "Montant CHF"];
  const lines = invoices.map((i) =>
    [
      i.number,
      i.kind === "credit_note" ? "Avoir" : "Facture",
      orgs.get(i.organizationId) ?? i.organizationId,
      i.issuedAt.slice(0, 10),
      i.dueAt.slice(0, 10),
      INVOICE_STATUS[i.status].label,
      (i.totalCents / 100).toFixed(2),
    ]
      .map(esc)
      .join(";"),
  );
  const body = "﻿" + [head.map(esc).join(";"), ...lines].join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="factures.csv"',
      "cache-control": "no-store",
    },
  });
}
