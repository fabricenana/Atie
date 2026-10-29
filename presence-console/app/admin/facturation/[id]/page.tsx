import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getOrganization, listInvoices } from "@/lib/repositories";
import { getBillingSettings, getInvoice, listPaymentsForInvoice } from "@/lib/repositories/billing";
import { issueCreditNote, markInvoicePaid } from "@/lib/actions/billing";
import { formatCHF, formatDate } from "@/lib/format";
import { INVOICE_STATUS } from "@/lib/labels";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmAction } from "@/components/ui/ConfirmAction";

export const metadata: Metadata = { title: "Facture" };

const METHOD: Record<string, string> = { bank_transfer: "Virement", card: "Carte", manual: "Saisie manuelle (démo)" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireAdmin("billing.read");
  const { id } = await params;
  const inv = getInvoice(id);
  if (!inv) notFound();
  const org = getOrganization(inv.organizationId);
  const payments = listPaymentsForInvoice(inv.id);
  const settings = getBillingSettings();
  const canWrite = can(v.role, "billing.write");
  const isCredit = inv.kind === "credit_note";
  const payable = !isCredit && (inv.status === "open" || inv.status === "overdue");
  const creditable = !isCredit && inv.status !== "void" && inv.status !== "credited" && inv.status !== "draft";
  const existingCredit = listInvoices().find((i) => i.kind === "credit_note" && i.lines.some((l) => l.label.includes(inv.number)));
  const vat = Math.round((inv.totalCents * settings.vatRatePermille) / (1000 + settings.vatRatePermille));

  return (
    <>
      <PageHeader
        title={inv.number}
        description={`${isCredit ? "Avoir" : "Facture"} · ${org?.name ?? inv.organizationId}`}
        breadcrumbs={[{ label: "Facturation", href: `/admin/facturation?tab=${isCredit ? "avoirs" : "factures"}` }, { label: inv.number }]}
        meta={
          <>
            <StatusBadge status={INVOICE_STATUS[inv.status]} />
            <Badge>Démonstration</Badge>
          </>
        }
        actions={
          canWrite ? (
            <>
              {payable ? (
                <ConfirmAction
                  action={markInvoicePaid}
                  payload={{ id: inv.id }}
                  label="Marquer payée (démo)"
                  variant="primary"
                  confirmVariant="primary"
                  size="md"
                  confirmLabel="Marquer payée"
                  title={`Marquer ${inv.number} comme payée ?`}
                >
                  <p className="text-[14px] text-muted">Enregistre un règlement manuel fictif de {formatCHF(inv.totalCents)}. Aucun paiement réel n’est encaissé.</p>
                </ConfirmAction>
              ) : null}
              {creditable && !existingCredit ? (
                <ConfirmAction
                  action={issueCreditNote}
                  payload={{ id: inv.id }}
                  label="Émettre un avoir (démo)"
                  size="md"
                  confirmLabel="Émettre l’avoir"
                  title={`Émettre un avoir sur ${inv.number} ?`}
                >
                  <p className="text-[14px] text-muted">
                    Un avoir de {formatCHF(-inv.totalCents)} sera créé (numéro DEMO-AV-…). {payable ? "La facture non réglée sera annulée." : "La facture payée reste payée."} Document sans valeur comptable.
                  </p>
                </ConfirmAction>
              ) : null}
            </>
          ) : null
        }
      />

      <Notice kind="demo" title="Document de démonstration — sans valeur comptable" className="mb-6">
        Cette pièce est générée à partir de données fictives. Elle ne constitue ni une facture officielle ni une preuve de paiement.
      </Notice>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Détail" description={`Émise le ${formatDate(inv.issuedAt)}${isCredit ? "" : ` · échéance ${formatDate(inv.dueAt)}`}`} />
          <CardBody>
            <div className="relative overflow-x-auto" role="region" aria-label="Lignes de la facture" tabIndex={0}>
              <table className="w-full min-w-[480px] text-left text-[13.5px]">
                <caption className="sr-only">Lignes de {inv.number}</caption>
                <thead>
                  <tr className="border-b border-line font-ui text-[12px] uppercase tracking-[0.05em] text-faint">
                    <th scope="col" className="py-2.5 pr-4 font-medium">Désignation</th>
                    <th scope="col" className="py-2.5 pr-4 text-right font-medium">Qté</th>
                    <th scope="col" className="py-2.5 pr-4 text-right font-medium">Prix unitaire</th>
                    <th scope="col" className="py-2.5 text-right font-medium">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {inv.lines.map((l, i) => (
                    <tr key={i} className="border-b border-line">
                      <td className="py-3 pr-4">{l.label}</td>
                      <td className="tabular py-3 pr-4 text-right">{l.quantity}</td>
                      <td className="tabular py-3 pr-4 text-right">{formatCHF(l.unitPriceCents)}</td>
                      <td className="tabular py-3 text-right">{formatCHF(l.unitPriceCents * l.quantity)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="pt-4 pr-4 text-right text-muted">Dont TVA {(settings.vatRatePermille / 10).toFixed(1)} % (indicatif)</td>
                    <td className="tabular pt-4 text-right text-muted">{formatCHF(vat)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="pt-2 pr-4 text-right font-medium">Total TTC</td>
                    <td className="tabular pt-2 text-right font-head text-[18px] font-semibold">{formatCHF(inv.totalCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-6 border-t border-line pt-4 font-ui text-[12px] text-faint">{settings.footerNote}</p>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Client" />
            <CardBody>
              <DefinitionList
                className="sm:grid-cols-1"
                items={[
                  [
                    "Entreprise",
                    org ? (
                      <Link href={`/admin/entreprises/${org.id}`} className="hover:text-accent-ink">
                        {org.name}
                      </Link>
                    ) : (
                      inv.organizationId
                    ),
                  ],
                  ["Adresse de facturation", org?.billingAddress],
                  ["E-mail de facturation", org?.billingEmail],
                  ["N° TVA", org?.vatNumber ?? "—"],
                ]}
              />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Règlements" description={isCredit ? "Sans objet pour un avoir" : undefined} />
            <CardBody className="pt-3">
              {payments.length === 0 ? (
                <EmptyState title="Aucun règlement" description={payable ? "Cette facture est en attente de paiement." : undefined} />
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div>
                        <p className="tabular text-[13.5px] font-medium">{formatCHF(p.amountCents)}</p>
                        <p className="font-ui text-[12px] text-faint">
                          {formatDate(p.at)} · {METHOD[p.method]}
                        </p>
                      </div>
                      <Badge tone={p.status === "recorded" ? "success" : "neutral"}>{p.status === "recorded" ? "Enregistré" : p.status === "failed" ? "Échoué" : "Remboursé"}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              {existingCredit ? (
                <p className="mt-4 text-[12.5px] text-muted">
                  Avoir lié :{" "}
                  <Link href={`/admin/facturation/${existingCredit.id}`} className="underline underline-offset-2 hover:text-ink">
                    {existingCredit.number}
                  </Link>
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
