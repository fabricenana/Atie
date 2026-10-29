import Link from "next/link";
import type { Metadata } from "next";
import { Clock, Gauge, MessageSquare, Users } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { listConversationsForOrg, listUsageForOrg, quotaForOrg } from "@/lib/repositories";
import { parsePeriod, periodStart, usageSeries } from "@/lib/metrics";
import { formatDate, formatDuration, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { BarChart, Meter } from "@/components/ui/Charts";
import { PeriodFilter } from "@/components/ui/PeriodFilter";
import { Notice } from "@/components/ui/Notice";
import { ButtonLink } from "@/components/ui/Button";

export const metadata: Metadata = { title: "Consommation" };

export default async function ClientUsage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const v = await requireClient();
  const sp = await searchParams;
  const period = parsePeriod(sp.period);
  const org = v.organization;
  const [q, usage, conversations] = await Promise.all([quotaForOrg(org.id), listUsageForOrg(org.id), listConversationsForOrg(org.id)]);
  const total = q.includedMinutes + q.topupMinutes;
  const series = usageSeries(usage, period);
  const monthly = usageSeries(usage, "12m");
  const from = new Date(periodStart(period)).toISOString();
  const done = conversations.filter((c) => c.startedAt >= from && c.status !== "failed" && c.endedAt);
  const avg = done.length ? done.reduce((n, c) => n + c.durationSeconds, 0) / done.length : 0;
  const periodMinutes = series.reduce((n, s) => n + s.minutes, 0);
  const periodSessions = series.reduce((n, s) => n + s.sessions, 0);

  return (
    <>
      <PageHeader
        title="Consommation"
        description="Les minutes de conversation de votre réceptionniste, mois par mois."
       
        actions={<PeriodFilter current={period} basePath="/client/consommation" />}
      />

      <Card>
        <CardHeader
          title="Minutes du mois en cours"
          description={q.subscription ? `Période du ${formatDate(q.subscription.currentPeriodStart)} au ${formatDate(q.subscription.currentPeriodEnd)}` : "Aucun abonnement actif"}
          actions={q.alert !== "none" ? <ButtonLink href="/client/abonnement#recharges" size="sm" variant="primary">Demander des minutes</ButtonLink> : undefined}
        />
        <CardBody>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <p className="tabular font-head text-[34px] font-semibold leading-none">
              {formatNumber(q.usedMinutes)}
              <span className="ml-1.5 text-[16px] font-normal text-muted">/ {formatNumber(total)} min</span>
            </p>
            <p className="tabular font-ui text-[13px] text-muted">
              {q.pctUsed} % utilisés · {formatNumber(q.remainingMinutes)} min restantes
            </p>
          </div>
          <Meter value={q.usedMinutes} max={total || 1} label="Minutes utilisées sur le mois" size="lg" className="mt-4" />
          <div className="mt-3 flex flex-wrap justify-between gap-2 font-ui text-[12px] text-faint">
            <span>{formatNumber(q.includedMinutes)} min incluses{q.topupMinutes ? ` + ${formatNumber(q.topupMinutes)} min de recharge` : ""}</span>
            <span>Seuil d’alerte : {q.subscription?.alertThresholdPct ?? 80} %</span>
          </div>
          {q.alert === "exhausted" ? (
            <Notice kind="danger" title="Minutes épuisées" className="mt-5">
              Les nouvelles conversations sont bloquées jusqu’au renouvellement ou à l’ajout d’une recharge.
            </Notice>
          ) : q.alert === "warning" ? (
            <Notice kind="warning" title="Seuil d’alerte atteint" className="mt-5">
              Il vous reste {formatNumber(q.remainingMinutes)} minutes. <Link href="/client/abonnement#recharges" className="font-medium text-ink underline underline-offset-2">Voir les recharges</Link>
            </Notice>
          ) : null}
        </CardBody>
      </Card>

      <StatGrid className="mt-6">
        <Stat label="Minutes sur la période" icon={<Clock />} value={formatNumber(Math.round(periodMinutes))} hint={`Période : ${period}`} />
        <Stat label="Conversations" icon={<MessageSquare />} value={formatNumber(periodSessions)} hint="Conversations abouties" />
        <Stat label="Durée moyenne" icon={<Gauge />} value={`${formatDuration(avg)} min`} hint="Par conversation" />
        <Stat label="Capacité simultanée" icon={<Users />} value={q.concurrent || "—"} hint="Conversations en parallèle incluses" origin={null} />
      </StatGrid>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader title={period === "12m" ? "Historique mensuel" : "Historique quotidien"} description="Minutes de conversation" />
          <CardBody>
            <BarChart title="Minutes par période" unit="min" labels={series.map((s) => s.label)} series={[{ label: "Minutes", values: series.map((s) => s.minutes), color: "accent" }]} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Douze derniers mois" description="Minutes et conversations par mois" />
          <CardBody>
            <BarChart
              title="Minutes et conversations par mois"
              labels={monthly.map((s) => s.label)}
              series={[
                { label: "Minutes", values: monthly.map((s) => s.minutes), color: "accent" },
                { label: "Conversations", values: monthly.map((s) => s.sessions), color: "ink" },
              ]}
            />
          </CardBody>
        </Card>
      </div>

      <p className="mt-6 text-[12.5px] text-faint">
        Les minutes sont comptées à partir de la connexion de votre réceptionniste avec le visiteur. Le décompte officiel est établi par le service ATIE Presence.
      </p>
    </>
  );
}
