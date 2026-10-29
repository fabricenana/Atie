import Link from "next/link";
import type { Metadata } from "next";
import { Bell, CalendarDays } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listNotifications, listVisitorRequestsForOrg } from "@/lib/repositories";
import { CLIENT_OUTCOME, clientInteractions } from "@/lib/repositories/client";
import { VISITOR_REQUEST_KIND, VISITOR_REQUEST_STATUS } from "@/lib/labels";
import { formatDateTime, formatDuration, formatRelative, LANG_LABELS, LANG_SHORT } from "@/lib/format";
import { markNotificationRead } from "@/lib/actions/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column, type Row } from "@/components/ui/DataTable";
import { Badge, OriginTag, StatusBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { RequestStatusForm } from "@/components/client/RequestStatusForm";
import { InlineAction } from "@/components/client/InlineAction";

export const metadata: Metadata = { title: "Conversations et demandes" };

type Tab = "demandes" | "interactions" | "notifications";

export default async function ClientRequests({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const v = await requireClient();
  const sp = await searchParams;
  const tab: Tab = sp.tab === "interactions" || sp.tab === "notifications" ? sp.tab : "demandes";
  const org = v.organization;
  const requests = listVisitorRequestsForOrg(org.id);
  const interactions = clientInteractions(org.id);
  const notifications = listNotifications(org.id);
  const unread = notifications.filter((n) => !n.readAt).length;
  const canUpdate = can(v.role, "client.requests.update");

  const privacy = (
    <Notice kind="privacy" title="Protection des données de vos visiteurs">
      Les demandes sont conservées {org.retentionDays} jours, puis supprimées. Les conversations ne sont pas enregistrées : seuls
      la date, la durée et la langue sont gardés. Les transcriptions intégrales sont désactivées ; pour les activer, une demande
      doit être faite à ATIE <Link href="/client/assistance?type=contact" className="font-medium text-ink underline underline-offset-2">depuis l’assistance</Link>, avec l’information préalable des visiteurs.
    </Notice>
  );

  return (
    <>
      <PageHeader title="Conversations et demandes" description="Ce que vos visiteurs ont demandé à votre réceptionniste, et l’historique des échanges." meta={<OriginTag origin="demo" />} />
      <Tabs
        label="Rubriques"
        current={tab}
        tabs={[
          { key: "demandes", label: "Demandes reçues", href: "/client/demandes", count: requests.filter((r) => r.status === "new").length },
          { key: "interactions", label: "Historique des conversations", href: "/client/demandes?tab=interactions" },
          { key: "notifications", label: "Notifications", href: "/client/demandes?tab=notifications", count: unread },
        ]}
      />

      {tab === "demandes" ? (
        <div className="flex flex-col gap-6">
          {!canUpdate ? (
            <Notice kind="info" title="Lecture seule">
              Votre compte permet de consulter les demandes. Leur traitement est réservé à l’administrateur de votre entreprise.
            </Notice>
          ) : null}
          <Card>
            <DataTable
              caption="Demandes laissées par les visiteurs"
              searchPlaceholder="Rechercher un visiteur, un message…"
              defaultSort={{ key: "date", dir: "desc" }}
              emptyTitle="Aucune demande"
              emptyDescription="Les messages, demandes de contact et de devis laissés à votre réceptionniste apparaîtront ici."
              filters={[
                { key: "kind", label: "Type", options: Object.entries(VISITOR_REQUEST_KIND).map(([value, label]) => ({ value, label })) },
                { key: "status", label: "Statut", options: Object.entries(VISITOR_REQUEST_STATUS).map(([value, s]) => ({ value, label: s.label })) },
              ]}
              columns={requestColumns}
              rows={requests.map(
                (r): Row => ({
                  id: r.id,
                  search: `${r.visitorName} ${r.summary} ${r.visitorContact} ${VISITOR_REQUEST_KIND[r.kind]}`,
                  filters: { kind: r.kind, status: r.status },
                  sort: { date: r.createdAt, kind: VISITOR_REQUEST_KIND[r.kind], visitor: r.visitorName },
                  cells: {
                    kind: <span className="font-medium">{VISITOR_REQUEST_KIND[r.kind]}</span>,
                    visitor: (
                      <span className="block min-w-0">
                        <span className="block">{r.visitorName}</span>
                        <span className="block font-ui text-[12px] text-faint">{r.visitorContact}</span>
                      </span>
                    ),
                    summary: <span className="line-clamp-2 max-w-md text-muted">{r.summary}</span>,
                    lang: <Badge>{LANG_SHORT[r.lang]}</Badge>,
                    date: <span className="whitespace-nowrap text-muted">{formatDateTime(r.createdAt)}</span>,
                    status: canUpdate ? <RequestStatusForm id={r.id} status={r.status} visitor={r.visitorName} /> : <StatusBadge status={VISITOR_REQUEST_STATUS[r.status]} />,
                  },
                }),
              )}
            />
          </Card>
          <div className="grid gap-4 lg:grid-cols-2">
            {privacy}
            <Notice kind="not_connected" title="Demandes de rendez-vous">
              <span className="inline-flex items-start gap-1.5">
                <CalendarDays aria-hidden className="mt-0.5 size-3.5 shrink-0" />
                La prise de rendez-vous directe sera disponible lorsqu’un module d’agenda compatible sera connecté. En attendant, les souhaits de rendez-vous arrivent ici comme demandes.
              </span>
            </Notice>
          </div>
        </div>
      ) : null}

      {tab === "interactions" ? (
        <div className="flex flex-col gap-6">
          <Card>
            <DataTable
              caption="Historique des conversations"
              searchPlaceholder="Rechercher par langue…"
              defaultSort={{ key: "date", dir: "desc" }}
              emptyTitle="Aucune conversation"
              emptyDescription="Les conversations de vos visiteurs apparaîtront ici."
              filters={[
                { key: "lang", label: "Langue", options: Object.entries(LANG_LABELS).map(([value, label]) => ({ value, label })) },
                { key: "outcome", label: "Statut", options: Object.entries(CLIENT_OUTCOME).map(([value, s]) => ({ value, label: s.label })) },
              ]}
              columns={[
                { key: "date", label: "Date et heure", sortable: true },
                { key: "duration", label: "Durée", sortable: true, align: "right" },
                { key: "lang", label: "Langue", sortable: true },
                { key: "outcome", label: "Statut" },
              ]}
              rows={interactions.map(
                (c): Row => ({
                  id: c.id,
                  search: `${LANG_LABELS[c.lang]} ${CLIENT_OUTCOME[c.outcome].label}`,
                  filters: { lang: c.lang, outcome: c.outcome },
                  sort: { date: c.startedAt, duration: c.durationSeconds, lang: LANG_LABELS[c.lang] },
                  cells: {
                    date: <span className="whitespace-nowrap">{formatDateTime(c.startedAt)}</span>,
                    duration: `${formatDuration(c.durationSeconds)} min`,
                    lang: LANG_LABELS[c.lang],
                    outcome: <StatusBadge status={CLIENT_OUTCOME[c.outcome]} />,
                  },
                }),
              )}
            />
          </Card>
          {privacy}
        </div>
      ) : null}

      {tab === "notifications" ? (
        <Card>
          <CardHeader
            title="Notifications"
            description={unread ? `${unread} non lue(s)` : "Tout est lu"}
            actions={unread ? <InlineAction action={markNotificationRead} payload={{ id: "all" }} variant="secondary">Tout marquer comme lu</InlineAction> : undefined}
          />
          <CardBody className="pt-3">
            {notifications.length === 0 ? (
              <EmptyState icon={<Bell />} title="Aucune notification" description="Vous serez prévenu ici des nouvelles demandes et de l’état de vos minutes." />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {notifications.map((n) => (
                  <li key={n.id} className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
                    <span
                      aria-hidden
                      className={
                        n.readAt
                          ? "mt-1.5 hidden size-2 shrink-0 rounded-full bg-line-strong sm:block"
                          : n.level === "critical"
                            ? "mt-1.5 hidden size-2 shrink-0 rounded-full bg-danger sm:block"
                            : n.level === "warning"
                              ? "mt-1.5 hidden size-2 shrink-0 rounded-full bg-warning sm:block"
                              : "mt-1.5 hidden size-2 shrink-0 rounded-full bg-red sm:block"
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <p className={n.readAt ? "text-[14px] text-muted" : "text-[14px] font-medium"}>
                        {n.title}
                        {!n.readAt ? <span className="sr-only"> (non lue)</span> : null}
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted">{n.body}</p>
                      <p className="mt-1 font-ui text-[12px] text-faint">{formatRelative(n.createdAt)}</p>
                    </div>
                    {!n.readAt ? (
                      <InlineAction action={markNotificationRead} payload={{ id: n.id }} label={`Marquer « ${n.title} » comme lue`}>
                        Marquer comme lue
                      </InlineAction>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      ) : null}
    </>
  );
}

const requestColumns: Column[] = [
  { key: "kind", label: "Type", sortable: true },
  { key: "visitor", label: "Visiteur", sortable: true },
  { key: "summary", label: "Résumé", hideBelow: "md" },
  { key: "lang", label: "Langue", hideBelow: "sm" },
  { key: "date", label: "Date", sortable: true, hideBelow: "lg" },
  { key: "status", label: "Statut" },
];
