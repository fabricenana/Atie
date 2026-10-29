import { cookies } from "next/headers";
import { decodeSession, resolveViewer, SESSION_COOKIE } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listInvoices, listOrganizations } from "@/lib/repositories";
import { INVOICE_STATUS } from "@/lib/labels";

export const dynamic = "force-dynamic";

const esc = (v: string | number) => {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Export CSV des factures de démonstration (séparateur « ; », encodage UTF-8 avec BOM pour Excel). */
export async function GET() {
  const jar = await cookies();
  const p = decodeSession(jar.get(SESSION_COOKIE)?.value);
  const v = p ? resolveViewer(p.uid, p.exp) : null;
  if (!v || !can(v.role, "billing.read")) {
    return new Response("Accès refusé.", { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const orgs = new Map(listOrganizations().map((o) => [o.id, o.name]));
  const head = ["Numéro", "Type", "Entreprise", "Émise le", "Échéance", "Statut", "Montant CHF", "Mention"];
  const lines = listInvoices().map((i) =>
    [
      i.number,
      i.kind === "credit_note" ? "Avoir" : "Facture",
      orgs.get(i.organizationId) ?? i.organizationId,
      i.issuedAt.slice(0, 10),
      i.dueAt.slice(0, 10),
      INVOICE_STATUS[i.status].label,
      (i.totalCents / 100).toFixed(2),
      "Démonstration - sans valeur comptable",
    ]
      .map(esc)
      .join(";"),
  );
  const body = "﻿" + [head.map(esc).join(";"), ...lines].join("\r\n") + "\r\n";
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="factures-demo.csv"',
      "cache-control": "no-store",
    },
  });
}
