import Link from "next/link";
import type { Metadata } from "next";
import { Activity, AlertTriangle, Building2, Clock, Coins, Radio, RefreshCw, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import {
  listAuditEvents,
  listConversations,
  listIncidents,
  listLiveSessions,
  listOrganizations,
  listPlans,
  listProviderUsage,
  listReceptionists,
  listSubscriptions,
  listTopups,
  listUsage,
  getUser,
  listQuotas,
} from "@/lib/repositories";
import { parsePeriod, peakConcurrency, periodStart, sinceMs, startOfToday, usageSeries } from "@/lib/metrics";
import { formatCHF, formatDateTime, formatNumber, formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AreaChart, BarChart, Legend, Meter } from "@/components/ui/Charts";
import { PeriodFilter } from "@/components/ui/PeriodFilter";
import { Badge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Tableau de bord" };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ period?: string; denied?: string }> }) {
  const v = await requireAdmin();
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const [orgs, conv, liveAll, usage, subs, plans, topups, allIncidents, provider, audit, receptionists, quotas] = await Promise.all([
    listOrganizations(),
    listConversations(),
    listLiveSessions(),
    listUsage(),
    listSubscriptions(),
    listPlans(),
    listTopups(),
    listIncidents(),
    listProviderUsage(),
    listAuditEvents(),
    listReceptionists(),
    listQuotas(),
  ]);
  const today = startOfToday();
  const week = sinceMs(7);
  const month = sinceMs(30);
  const done = conv.filter((c) => c.status !== "active" && c.status !== "connecting");
  const live = liveAll.filter((c) => c.status !== "close_unconfirmed");
  const from = new Date(periodStart(period)).toISOString();
  const inPeriod = done.filter((c) => c.startedAt >= from);
  const minutes = inPeriod.reduce((n, c) => n + c.billableSeconds, 0) / 60;
  const series = usageSeries(usage, period);
  const mrr = subs
    .filter((s) => s.status === "active")
    .reduce((n, s) => n + (plans.find((p) => p.id === s.planId)?.monthlyPriceCents ?? 0), 0);
  const topupSold = topups.filter((t) => t.status === "applied").reduce((n, t) => n + t.priceCents, 0);
  const quotaAlerts = orgs
    .flatMap((o) => { const q = quotas.get(o.id); return q ? [{ o, q }] : []; })
    .filter(({ q }) => q.alert !== "none")
    .sort((a, b) => b.q.pctUsed - a.q.pctUsed);
  const incidents = allIncidents.filter((i) => i.status !== "resolved");
  const pool = provider.find((p) => p.provider === "lemonslice");
  const activity = audit.slice(0, 7);
  const actorIds = [...new Set(activity.map((a) => a.actorId).filter((x): x is string => Boolean(x)))];
  const actors = new Map((await Promise.all(actorIds.map((id) => getUser(id)))).filter((u) => u !== null).map((u) => [u.id, u.fullName]));
  const byOrg = orgs
    .map((o) => ({ o, min: inPeriod.filter((c) => c.organizationId === o.id).reduce((n, c) => n + c.billableSeconds, 0) / 60 }))
    .filter((x) => x.min > 0)
    .sort((a, b) => b.min - a.min);
  const maxOrg = Math.max(1, ...byOrg.map((x) => x.min));

  return (
    <>
      <PageHeader
        title={`Bonjour, ${v.user.fullName.split(" ")[0]}`}
        description="Vue d’ensemble du service ATIE Presence : entreprises, conversations, consommation et revenus."
        actions={<PeriodFilter current={period} basePath="/admin" />}
      />
      {sp.denied ? (
        <Notice kind="warning" title="Accès refusé" className="mb-6">
          Votre rôle ne permet pas d’ouvrir cette page. L’accès a été bloqué côté serveur.
        </Notice>
      ) : null}

      <StatGrid>
        <Stat
          label="Entreprises clientes"
          icon={<Building2 />}
          value={orgs.length}
          hint={
            <span className="flex flex-wrap gap-x-3 gap-y-1">
              <span>{orgs.filter((o) => o.status === "active").length} actives</span>
              <span>{orgs.filter((o) => o.status === "trial").length} en essai</span>
              <span>{orgs.filter((o) => o.status === "suspended").length} suspendue</span>
            </span>
          }
        />
        <Stat label="Réceptionnistes déployées" icon={<Users />} value={receptionists.filter((r) => r.status === "live").length} hint={`${receptionists.length} configurées au total`} />
        <Stat
          label="Sessions"
          icon={<Activity />}
          value={formatNumber(done.filter((c) => c.startedAt >= today).length)}
          hint={`Aujourd’hui · ${formatNumber(done.filter((c) => c.startedAt >= week).length)} sur 7 j · ${formatNumber(done.filter((c) => c.startedAt >= month).length)} sur 30 j`}
        />
        <Stat label="Minutes consommées" icon={<Clock />} value={formatNumber(Math.round(minutes))} hint={`Période : ${period}. Minutes facturables clients.`} />
        <Stat
          label="Sessions actives"
          icon={<Radio />}
          value={
            <span className="flex items-center gap-2">
              {live.length}
              {live.length ? <span aria-hidden className="animate-live size-2 rounded-full bg-success" /> : null}
            </span>
          }
          hint={`Pic simultané sur la période : ${peakConcurrency(inPeriod)}`}
        />
        <Stat label="Revenus mensuels récurrents" icon={<Coins />} value={formatCHF(mrr)} hint={`${subs.filter((s) => s.status === "active").length} abonnements actifs, hors essais`} />
        <Stat label="Recharges vendues" icon={<RefreshCw />} value={formatCHF(topupSold)} hint={`${topups.filter((t) => t.status === "pending" || t.status === "requested").length} recharge(s) en attente`} />
        <Stat
          label="Pool fournisseur (LemonSlice)"
          origin={null}
          value={pool?.minutesAvailable === null || !pool ? "—" : formatNumber(pool.minutesAvailable)}
          hint="Aucune donnée : consommation fournisseur non encore collectée par le backend."
        />
      </StatGrid>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Activité" description="Sessions et minutes facturables, toutes entreprises (écrites par le backend Python)" />
          <CardBody>
            <Legend
              series={[
                { label: "Minutes", values: [], color: "accent" },
                { label: "Sessions", values: [], color: "ink" },
              ]}
            />
            <div className="mt-4">
              <AreaChart
                title="Minutes et sessions par période"
                labels={series.map((s) => s.label)}
                series={[
                  { label: "Minutes", values: series.map((s) => s.minutes), color: "accent" },
                  { label: "Sessions", values: series.map((s) => s.sessions), color: "ink" },
                ]}
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Alertes de quotas" description="Seuil d’alerte atteint ou minutes épuisées" />
          <CardBody className="pt-3">
            {quotaAlerts.length === 0 ? (
              <EmptyState title="Aucune alerte" description="Tous les clients sont sous leur seuil d’alerte." />
            ) : (
              <ul className="flex flex-col gap-4">
                {quotaAlerts.map(({ o, q }) => (
                  <li key={o.id}>
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <Link href={`/admin/entreprises/${o.id}?tab=abonnement`} className="truncate text-[14px] font-medium hover:text-accent-ink">
                        {o.name}
                      </Link>
                      <span className="tabular shrink-0 font-ui text-[12.5px] text-muted">
                        {formatNumber(q.usedMinutes)} / {formatNumber(q.includedMinutes + q.topupMinutes)} min
                      </span>
                    </div>
                    <Meter value={q.usedMinutes} max={q.includedMinutes + q.topupMinutes} label={`Consommation ${o.name}`} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Minutes par entreprise" description={`Période : ${period}`} />
          <CardBody className="pt-3">
            {byOrg.length === 0 ? (
              <EmptyState title="Aucune minute sur la période" />
            ) : (
              <ul className="flex flex-col gap-3">
                {byOrg.map(({ o, min }) => (
                  <li key={o.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                    <span className="truncate text-[13.5px]">{o.name}</span>
                    <span className="tabular font-ui text-[12.5px] text-muted">{formatNumber(Math.round(min))} min</span>
                    <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full bg-red/80" style={{ width: `${(min / maxOrg) * 100}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Incidents techniques"
            description="Ouverts ou sous surveillance"
            actions={<ButtonLink href="/admin/parametres?section=services" size="sm" variant="ghost">État des services</ButtonLink>}
          />
          <CardBody className="pt-3">
            {incidents.length === 0 ? (
              <EmptyState title="Aucun incident ouvert" />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {incidents.map((i) => (
                  <li key={i.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    <AlertTriangle aria-hidden className={i.severity === "major" ? "mt-0.5 size-4 shrink-0 text-danger" : "mt-0.5 size-4 shrink-0 text-warning"} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">{i.title}</p>
                      <p className="font-ui text-[12px] text-faint">
                        {i.service.toUpperCase()} · depuis {formatRelative(i.startedAt).replace("il y a ", "")}
                      </p>
                    </div>
                    <Badge tone={i.status === "open" ? "danger" : "warning"}>{i.status === "open" ? "Ouvert" : "Surveillance"}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Dernières activités" description="Journal d’audit" actions={<ButtonLink href="/admin/parametres?section=audit" size="sm" variant="ghost">Tout voir</ButtonLink>} />
          <CardBody className="pt-3">
            {activity.length === 0 ? (
              <EmptyState title="Aucune activité enregistrée" />
            ) : (
            <ol className="flex flex-col gap-3">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-red/70" />
                  <div className="min-w-0">
                    <p className="text-[13.5px]">
                      <span className="font-medium">{a.target}</span> — {a.detail || a.action}
                    </p>
                    <p className="font-ui text-[12px] text-faint">
                      {(a.actorId && actors.get(a.actorId)) ?? "Système"} · {formatDateTime(a.at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Sessions par jour" description="Nombre de sessions terminées" />
        <CardBody>
          <BarChart width={1100} height={220} title="Sessions par période" labels={series.map((s) => s.label)} series={[{ label: "Sessions", values: series.map((s) => s.sessions), color: "accent" }]} />
        </CardBody>
      </Card>
    </>
  );
}
