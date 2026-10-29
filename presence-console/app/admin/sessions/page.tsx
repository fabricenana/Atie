import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { listConversations, listOrganizations } from "@/lib/repositories";
import { nameIndexes } from "@/lib/repositories/sessions";
import { END_REASON, SESSION_STATUS } from "@/lib/labels";
import { formatCHF, formatDateTime, formatDuration, formatNumber, LANG_LABELS, LANG_SHORT, toMinutes } from "@/lib/format";
import { LANGS } from "@/lib/domain/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DataTable, type Row } from "@/components/ui/DataTable";
import { Badge, OriginTag, StatusBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Conversations" };

export default async function SessionsPage() {
  await requireAdmin("session.read_all");
  const conv = listConversations();
  const { orgs, receptionists } = nameIndexes();
  const done = conv.filter((c) => c.status === "ended" || c.status === "failed" || c.status === "close_unconfirmed");
  const billable = done.reduce((n, c) => n + c.billableSeconds, 0);
  const cost = done.reduce((n, c) => n + c.providerCostCents, 0);
  const failed = done.filter((c) => c.status === "failed").length;

  const rows: Row[] = conv.map((c) => {
    const org = orgs.get(c.organizationId);
    const rcp = receptionists.get(c.receptionistId);
    return {
      id: c.id,
      href: `/admin/sessions/${c.id}`,
      cells: {
        org: org?.name ?? c.organizationId,
        rcp: rcp?.name ?? "—",
        date: <span className="whitespace-nowrap">{formatDateTime(c.startedAt)}</span>,
        duration: formatDuration(c.durationSeconds),
        lang: <Badge>{LANG_SHORT[c.lang]}</Badge>,
        status: <StatusBadge status={SESSION_STATUS[c.status]} />,
        reason: <span className="whitespace-nowrap text-muted">{c.endReason ? END_REASON[c.endReason] : "—"}</span>,
        billable: formatNumber(toMinutes(c.billableSeconds)),
        cost: (
          <span className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
            {formatCHF(c.providerCostCents)} <OriginTag origin={c.providerCostOrigin} />
          </span>
        ),
        error: c.error ? <span className="block max-w-[200px] truncate text-danger" title={c.error}>{c.error}</span> : <span className="text-faint">—</span>,
      },
      sort: {
        org: org?.name ?? "",
        date: c.startedAt,
        duration: c.durationSeconds,
        billable: c.billableSeconds,
        cost: c.providerCostCents,
      },
      search: `${org?.name ?? ""} ${rcp?.name ?? ""} ${c.id} ${c.backendSessionId} ${c.error ?? ""}`,
      filters: { org: c.organizationId, status: c.status, lang: c.lang },
    };
  });

  return (
    <>
      <PageHeader
        title="Conversations et sessions"
        description="Historique des sessions de toutes les entreprises, tel que transmis par le backend (ici : données de démonstration)."
        actions={<ButtonLink href="/admin/sessions/actives" variant="primary">Sessions actives</ButtonLink>}
      />
      <StatGrid className="mb-6">
        <Stat label="Sessions enregistrées" value={formatNumber(conv.length)} hint="Toutes périodes" />
        <Stat label="Minutes facturables" value={formatNumber(Math.round(billable / 60))} hint="Sessions terminées" />
        <Stat label="Coût fournisseur" origin="estimated" value={formatCHF(cost)} hint="Estimation de démonstration, pas une mesure" />
        <Stat label="Échecs" value={formatNumber(failed)} tone={failed ? "warning" : undefined} hint={`${done.length ? Math.round((failed / done.length) * 1000) / 10 : 0} % des sessions terminées`} />
      </StatGrid>

      <Notice kind="privacy" title="Transcriptions" className="mb-6">
        Les conversations ne sont pas enregistrées par défaut. Aucune transcription n’est générée ni affichée dans cette démonstration ; seules
        les métadonnées de session (durée, langue, statut) sont présentées.
      </Notice>

      <Card>
        <DataTable
          caption="Conversations de toutes les entreprises"
          pageSize={15}
          columns={[
            { key: "org", label: "Entreprise", sortable: true },
            { key: "rcp", label: "Réceptionniste", hideBelow: "md" },
            { key: "date", label: "Date et heure", sortable: true },
            { key: "duration", label: "Durée", sortable: true, align: "right" },
            { key: "lang", label: "Langue", hideBelow: "sm" },
            { key: "status", label: "Statut" },
            { key: "reason", label: "Motif de fin", hideBelow: "lg" },
            { key: "billable", label: "Min. facturables", sortable: true, align: "right", hideBelow: "md" },
            { key: "cost", label: "Coût fournisseur", sortable: true, align: "right", hideBelow: "xl" },
            { key: "error", label: "Erreur", hideBelow: "xl" },
          ]}
          rows={rows}
          defaultSort={{ key: "date", dir: "desc" }}
          searchPlaceholder="Entreprise, réceptionniste, identifiant…"
          filters={[
            { key: "org", label: "Entreprise", options: listOrganizations().map((o) => ({ value: o.id, label: o.name })) },
            { key: "status", label: "Statut", options: Object.entries(SESSION_STATUS).map(([value, s]) => ({ value, label: s.label })) },
            { key: "lang", label: "Langue", options: LANGS.map((l) => ({ value: l, label: LANG_LABELS[l] })) },
          ]}
          emptyTitle="Aucune conversation"
        />
      </Card>
    </>
  );
}
