import Link from "next/link";
import type { Metadata } from "next";
import { Download, FileText } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listInvoices, listOrganizations, listPayments, listProviderStatuses, listTopups } from "@/lib/repositories";
import { getBillingSettings } from "@/lib/repositories/billing";
import { markInvoicePaid, saveBillingSettings } from "@/lib/actions/billing";
import { formatCHF, formatDate, formatNumber } from "@/lib/format";
import { CONNECTION_STATUS, INVOICE_STATUS, TOPUP_STATUS } from "@/lib/labels";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { buttonClass } from "@/components/ui/Button";
import { DataTable, type Row } from "@/components/ui/DataTable";
import { Notice, NotConnected } from "@/components/ui/Notice";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { TextAreaField, TextField } from "@/components/ui/FormFields";
import { Field, Input } from "@/components/ui/Field";

export const metadata: Metadata = { title: "Facturation" };

const TABS = ["factures", "paiements", "avoirs", "recharges", "parametres", "prestataire"] as const;
type Tab = (typeof TABS)[number];

const METHOD: Record<string, string> = { bank_transfer: "Virement", card: "Carte", manual: "Saisie manuelle (démo)" };

export default async function BillingPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const v = await requireAdmin("billing.read");
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "factures";
  const canWrite = can(v.role, "billing.write");

  const orgs = listOrganizations();
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const all = listInvoices();
  const invoices = all.filter((i) => i.kind === "invoice");
  const credits = all.filter((i) => i.kind === "credit_note");
  const payments = listPayments();
  const topupInvoices = invoices.filter((i) => i.lines.some((l) => l.label.toLowerCase().startsWith("recharge")));
  const settings = getBillingSettings();
  const provider = listProviderStatuses().find((p) => p.provider === "payment");
  const invNumber = new Map(all.map((i) => [i.id, i.number]));

  const open = invoices.filter((i) => i.status === "open");
  const overdue = invoices.filter((i) => i.status === "overdue");
  const paidTotal = payments.filter((p) => p.status === "recorded").reduce((n, p) => n + p.amountCents, 0);
  const href = (t: Tab) => `/admin/facturation?tab=${t}`;

  const invoiceRows = (list: typeof all): Row[] =>
    list.map((i) => {
      const name = orgName.get(i.organizationId) ?? i.organizationId;
      const payable = i.kind === "invoice" && (i.status === "open" || i.status === "overdue");
      return {
        id: i.id,
        href: `/admin/facturation/${i.id}`,
        search: `${i.number} ${name}`,
        filters: { status: i.status, org: i.organizationId },
        sort: { number: i.number, org: name, issued: i.issuedAt, due: i.dueAt, total: i.totalCents },
        cells: {
          number: <span className="tabular">{i.number}</span>,
          org: name,
          issued: formatDate(i.issuedAt),
          due: formatDate(i.dueAt),
          status: <StatusBadge status={INVOICE_STATUS[i.status]} />,
          total: formatCHF(i.totalCents),
          actions:
            payable && canWrite ? (
              <ConfirmAction
                action={markInvoicePaid}
                payload={{ id: i.id }}
                label="Marquer payée (démo)"
                variant="ghost"
                confirmVariant="primary"
                confirmLabel="Marquer payée"
                title={`Marquer ${i.number} comme payée ?`}
              >
                <p className="text-[14px] text-muted">
                  Enregistre un règlement manuel fictif de {formatCHF(i.totalCents)}. Aucun paiement réel n’est encaissé et aucun prestataire n’est contacté.
                </p>
              </ConfirmAction>
            ) : (
              <span className="font-ui text-[12px] text-faint">—</span>
            ),
        },
      };
    });

  const invoiceColumns = [
    { key: "number", label: "Numéro", sortable: true },
    { key: "org", label: "Entreprise", sortable: true },
    { key: "issued", label: "Émise le", sortable: true, hideBelow: "md" as const },
    { key: "due", label: "Échéance", sortable: true, hideBelow: "lg" as const },
    { key: "status", label: "Statut" },
    { key: "total", label: "Montant", sortable: true, align: "right" as const },
    { key: "actions", label: "Actions", align: "right" as const },
  ];

  return (
    <>
      <PageHeader
        title="Facturation"
        description="Factures, règlements, avoirs et recharges, en CHF."
        breadcrumbs={[{ label: "Tableau de bord", href: "/admin" }, { label: "Facturation" }]}
        actions={
          <a href="/admin/facturation/export" download className={buttonClass("secondary")}>
            <Download aria-hidden /> Exporter (CSV)
          </a>
        }
      />
      <Notice kind="demo" title="Facturation de démonstration" className="mb-6">
        Aucune facture officielle et aucun paiement réel : les numéros commencent par DEMO- et les documents n’ont pas de valeur comptable. Les paiements en ligne restent désactivés tant qu’aucun prestataire n’est autorisé.
      </Notice>

      <StatGrid className="mb-8">
        <Stat label="Factures à payer" value={open.length} hint={formatCHF(open.reduce((n, i) => n + i.totalCents, 0))} />
        <Stat label="Factures échues" value={overdue.length} tone={overdue.length ? "danger" : undefined} hint={formatCHF(overdue.reduce((n, i) => n + i.totalCents, 0))} />
        <Stat label="Règlements enregistrés" value={formatCHF(paidTotal)} hint={`${payments.length} paiement(s)`} />
        <Stat label="Avoirs émis" value={credits.length} hint={formatCHF(credits.reduce((n, i) => n + i.totalCents, 0))} />
      </StatGrid>

      <Tabs
        label="Rubriques de la facturation"
        current={tab}
        tabs={[
          { key: "factures", label: "Factures", href: href("factures"), count: invoices.length },
          { key: "paiements", label: "Paiements", href: href("paiements"), count: payments.length },
          { key: "avoirs", label: "Avoirs", href: href("avoirs"), count: credits.length },
          { key: "recharges", label: "Recharges", href: href("recharges"), count: topupInvoices.length },
          { key: "parametres", label: "Paramètres", href: href("parametres") },
          { key: "prestataire", label: "Prestataire de paiement", href: href("prestataire") },
        ]}
      />

      {tab === "factures" ? (
        <Card>
          <DataTable
            caption="Factures"
            searchPlaceholder="Numéro ou entreprise…"
            defaultSort={{ key: "issued", dir: "desc" }}
            filters={[
              { key: "status", label: "Statut", options: (["open", "overdue", "paid", "void"] as const).map((s) => ({ value: s, label: INVOICE_STATUS[s].label })) },
              { key: "org", label: "Entreprise", options: orgs.map((o) => ({ value: o.id, label: o.name })) },
            ]}
            emptyTitle="Aucune facture"
            columns={invoiceColumns}
            rows={invoiceRows(invoices)}
          />
        </Card>
      ) : null}

      {tab === "paiements" ? (
        <Card>
          <DataTable
            caption="Historique des règlements"
            searchPlaceholder="Facture ou entreprise…"
            defaultSort={{ key: "at", dir: "desc" }}
            emptyTitle="Aucun règlement"
            filters={[{ key: "method", label: "Mode", options: Object.entries(METHOD).map(([value, label]) => ({ value, label })) }]}
            columns={[
              { key: "at", label: "Date", sortable: true },
              { key: "invoice", label: "Facture", sortable: true },
              { key: "org", label: "Entreprise", sortable: true, hideBelow: "sm" },
              { key: "method", label: "Mode", hideBelow: "md" },
              { key: "status", label: "Statut" },
              { key: "amount", label: "Montant", sortable: true, align: "right" },
            ]}
            rows={payments.map((p): Row => {
              const name = orgName.get(p.organizationId) ?? p.organizationId;
              const number = invNumber.get(p.invoiceId) ?? p.invoiceId;
              return {
                id: p.id,
                search: `${number} ${name}`,
                filters: { method: p.method },
                sort: { at: p.at, invoice: number, org: name, amount: p.amountCents },
                cells: {
                  at: formatDate(p.at),
                  invoice: (
                    <Link href={`/admin/facturation/${p.invoiceId}`} className="tabular hover:text-accent-ink">
                      {number}
                    </Link>
                  ),
                  org: name,
                  method: METHOD[p.method],
                  status: <Badge tone={p.status === "recorded" ? "success" : p.status === "failed" ? "danger" : "neutral"}>{p.status === "recorded" ? "Enregistré" : p.status === "failed" ? "Échoué" : "Remboursé"}</Badge>,
                  amount: formatCHF(p.amountCents),
                },
              };
            })}
          />
        </Card>
      ) : null}

      {tab === "avoirs" ? (
        <div className="flex flex-col gap-4">
          <Notice kind="info">Pour émettre un avoir, ouvrez la facture concernée et choisissez « Émettre un avoir (démo) ».</Notice>
          <Card>
            <DataTable caption="Avoirs" emptyTitle="Aucun avoir" defaultSort={{ key: "issued", dir: "desc" }} columns={invoiceColumns.filter((c) => c.key !== "due" && c.key !== "actions")} rows={invoiceRows(credits)} />
          </Card>
        </div>
      ) : null}

      {tab === "recharges" ? (
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader title="Recharges facturées" description="Factures de recharges de minutes" />
            <DataTable caption="Factures de recharges" emptyTitle="Aucune recharge facturée" columns={invoiceColumns.filter((c) => c.key !== "due")} rows={invoiceRows(topupInvoices)} />
          </Card>
          <Card>
            <CardHeader title="Recharges en cours" description="À facturer après application" />
            <CardBody className="pt-3">
              <ul className="flex flex-col divide-y divide-line">
                {listTopups().map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate text-[13.5px] font-medium">{orgName.get(t.organizationId)}</p>
                      <p className="tabular font-ui text-[12px] text-faint">
                        {formatNumber(t.minutes)} min · {formatCHF(t.priceCents)} · {formatDate(t.requestedAt)}
                      </p>
                    </div>
                    <StatusBadge status={TOPUP_STATUS[t.status]} />
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12.5px] text-muted">
                Les recharges s’appliquent depuis <Link href="/admin/abonnements?tab=recharges" className="underline underline-offset-2 hover:text-ink">Abonnements → Recharges</Link>.
              </p>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "parametres" ? (
        <Card className="max-w-3xl">
          <CardHeader title="Paramètres de facturation" description="Valeurs utilisées pour préparer les factures de démonstration." />
          <CardBody>
            {!canWrite ? (
              <Notice kind="info" className="mb-5">
                Lecture seule : la modification est réservée aux administrateurs ATIE.
              </Notice>
            ) : null}
            <ActionForm action={saveBillingSettings}>
              <fieldset disabled={!canWrite} className="grid gap-5 sm:grid-cols-2">
                <legend className="sr-only">Paramètres de facturation</legend>
                <Field label="Devise" name="currency" hint="Facturation exclusivement en francs suisses.">
                  <Input name="currency" value="CHF" readOnly disabled />
                </Field>
                <TextField label="Délai de paiement (jours)" name="paymentTermsDays" type="number" min={0} max={120} required defaultValue={settings.paymentTermsDays} />
                <TextField label="Taux de TVA (%)" name="vatRate" inputMode="decimal" required defaultValue={(settings.vatRatePermille / 10).toFixed(1)} hint="À confirmer avec la fiduciaire." />
                <TextField label="Numéro de TVA ATIE" name="vatNumber" required defaultValue={settings.vatNumber} />
                <TextField label="Préfixe des numéros" name="invoicePrefix" required defaultValue={settings.invoicePrefix} hint="Doit commencer par DEMO- en démonstration." />
                <TextAreaField label="Mention de bas de page" name="footerNote" defaultValue={settings.footerNote} className="sm:col-span-2" />
              </fieldset>
              {canWrite ? (
                <div className="mt-6 flex justify-end border-t border-line pt-5">
                  <SubmitButton>Enregistrer</SubmitButton>
                </div>
              ) : null}
            </ActionForm>
          </CardBody>
        </Card>
      ) : null}

      {tab === "prestataire" ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title="Prestataire de paiement" description="Encaissement des abonnements et recharges" actions={provider ? <StatusBadge status={CONNECTION_STATUS[provider.connection]} /> : null} />
            <CardBody className="flex flex-col gap-5">
              <DefinitionList
                items={[
                  ["Prestataire", provider?.label ?? "—"],
                  ["Configuré", provider?.configured ? "Oui" : "Non"],
                  ["Clé", provider?.keyHint ? `…${provider.keyHint}` : "Aucune clé dans la console"],
                  ["Remarque", provider?.note ?? "—"],
                ]}
              />
              <NotConnected what="Paiement en ligne">Aucun prestataire n’est choisi ni autorisé. Aucune carte, aucun prélèvement, aucun webhook n’est traité.</NotConnected>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Architecture prévue" description="Pour un branchement futur, après autorisation" />
            <CardBody>
              <ol className="flex flex-col gap-3 text-[13.5px]">
                {[
                  "Le backend commercial crée le client et l’abonnement chez le prestataire ; la console n’appelle jamais le prestataire directement.",
                  "Les secrets restent côté serveur (variables d’environnement), jamais dans le navigateur.",
                  "Les événements du prestataire (paiement réussi, échoué, remboursé) arrivent par webhook signé et mettent à jour invoices et payments.",
                  "La console lit l’état via l’API (GET /billing/invoices) et n’écrit plus de statut de paiement elle-même.",
                ].map((t, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="tabular grid size-6 shrink-0 place-items-center rounded-full bg-surface-3 font-ui text-[12px] font-semibold text-muted">{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-5 flex items-center gap-2 font-ui text-[12px] text-faint">
                <FileText className="size-3.5" aria-hidden /> Détail : docs/API-CONTRACTS.md
              </p>
            </CardBody>
          </Card>
        </div>
      ) : null}

    </>
  );
}

