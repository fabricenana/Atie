import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, CalendarClock, Clock, Globe2, MessageSquare, PlusCircle } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import {
  getAvatar,
  getReceptionistForOrg,
  listVisitorRequestsForOrg,
  quotaForOrg,
} from "@/lib/repositories";
import { visitorLanguagesForOrg } from "@/lib/repositories/client";
import { ORG_STATUS, RECEPTIONIST_STATUS, SUBSCRIPTION_STATUS, VISITOR_REQUEST_KIND, VISITOR_REQUEST_STATUS } from "@/lib/labels";
import { formatCHF, formatDate, formatNumber, formatRelative, LANG_LABELS } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { RingGauge } from "@/components/ui/Charts";
import { StatusBadge, OriginTag } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";
import { Portrait } from "@/components/ui/Portrait";

export const metadata: Metadata = { title: "Mon tableau de bord" };

export default async function ClientDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const v = await requireClient();
  const sp = await searchParams;
  const org = v.organization;
  const q = quotaForOrg(org.id);
  const rcp = getReceptionistForOrg(org.id);
  const avatar = rcp ? getAvatar(rcp.avatarId) : null;
  const total = q.includedMinutes + q.topupMinutes;
  const langs = visitorLanguagesForOrg(org.id, q.subscription?.currentPeriodStart);
  const requests = listVisitorRequestsForOrg(org.id).slice(0, 5);
  const newCount = listVisitorRequestsForOrg(org.id).filter((r) => r.status === "new").length;
  const serviceStatus =
    org.status === "suspended"
      ? { label: "Service suspendu", tone: "danger" as const }
      : rcp?.status === "live"
        ? { label: "En service sur votre site", tone: "success" as const }
        : rcp
          ? RECEPTIONIST_STATUS[rcp.status]
          : { label: "En préparation par ATIE", tone: "warning" as const };

  return (
    <>
      <PageHeader
        title={org.name}
        description="Votre réceptionniste numérique, sa consommation et les demandes de vos visiteurs."
        meta={
          <>
            <StatusBadge status={ORG_STATUS[org.status]} />
            <OriginTag origin="demo" />
          </>
        }
      />

      {sp.denied ? (
        <Notice kind="warning" title="Action réservée" className="mb-6">
          Votre compte ne permet pas d’ouvrir cette page ou d’effectuer cette action. Demandez à l’administrateur de votre entreprise.
        </Notice>
      ) : null}

      {q.alert === "exhausted" ? (
        <Notice kind="danger" title="Minutes épuisées" className="mb-6">
          Vos {formatNumber(total)} minutes du mois sont utilisées : votre réceptionniste ne peut plus démarrer de conversation jusqu’au renouvellement.{" "}
          <Link href="/client/abonnement#recharges" className="font-medium text-ink underline underline-offset-2">Demander une recharge</Link>
        </Notice>
      ) : q.alert === "warning" ? (
        <Notice kind="warning" title={`Vous avez utilisé ${q.pctUsed} % de vos minutes`} className="mb-6">
          Il vous reste {formatNumber(q.remainingMinutes)} minutes jusqu’au {formatDate(q.subscription?.currentPeriodEnd)}. Pensez à demander une recharge pour ne pas interrompre l’accueil de vos visiteurs.{" "}
          <Link href="/client/abonnement#recharges" className="font-medium text-ink underline underline-offset-2">Demander des minutes</Link>
        </Notice>
      ) : null}

      {org.status === "suspended" ? (
        <Notice kind="danger" title="Service suspendu" className="mb-6">
          Votre réceptionniste n’apparaît plus sur votre site. <Link href="/client/assistance?type=contact" className="font-medium text-ink underline underline-offset-2">Contacter ATIE</Link> pour rétablir le service.
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <div className="grid sm:grid-cols-[200px_minmax(0,1fr)]">
            <Portrait src={avatar?.portraitUrl ?? null} name={rcp?.name ?? "Réceptionniste"} className="aspect-[4/3] sm:aspect-auto sm:min-h-full" sizes="(min-width: 640px) 200px, 100vw" />
            <div className="flex flex-col p-5 sm:p-6">
              <p className="font-ui text-[12px] font-semibold uppercase tracking-[0.14em] text-red">Votre réceptionniste</p>
              <h2 className="mt-2 text-[24px] font-semibold">{rcp?.name ?? "En préparation"}</h2>
              <p className="mt-1 text-[13.5px] text-muted">{rcp?.role ?? "ATIE configure votre réceptionniste."}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <StatusBadge status={serviceStatus} />
              </div>
              {rcp ? (
                <p className="mt-4 line-clamp-3 text-[13.5px] text-muted">« {rcp.greeting} »</p>
              ) : null}
              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <ButtonLink href="/client/receptionniste" size="sm">
                  Voir ma réceptionniste <ArrowRight aria-hidden />
                </ButtonLink>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Minutes du mois"
            description={q.subscription ? `Du ${formatDate(q.subscription.currentPeriodStart)} au ${formatDate(q.subscription.currentPeriodEnd)}` : "Aucun abonnement actif"}
            actions={<OriginTag origin="demo" />}
          />
          <CardBody className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-around">
            <RingGauge value={q.usedMinutes} max={total || 1} label="Part des minutes utilisées" sublabel="utilisées" />
            <dl className="grid w-full max-w-[220px] grid-cols-2 gap-4 sm:grid-cols-1">
              <div>
                <dt className="font-ui text-[12px] text-muted">Utilisées</dt>
                <dd className="tabular font-head text-[22px] font-semibold">{formatNumber(q.usedMinutes)} <span className="text-[13px] font-normal text-muted">min</span></dd>
              </div>
              <div>
                <dt className="font-ui text-[12px] text-muted">Restantes</dt>
                <dd className="tabular font-head text-[22px] font-semibold">{formatNumber(q.remainingMinutes)} <span className="text-[13px] font-normal text-muted">min</span></dd>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <dt className="font-ui text-[12px] text-muted">Incluses</dt>
                <dd className="tabular text-[14px]">
                  {formatNumber(q.includedMinutes)} min{q.topupMinutes ? ` + ${formatNumber(q.topupMinutes)} min de recharge` : ""}
                </dd>
              </div>
            </dl>
          </CardBody>
        </Card>
      </div>

      <StatGrid className="mt-6">
        <Stat label="Conversations ce mois-ci" icon={<MessageSquare />} value={formatNumber(q.sessions)} hint="Conversations abouties sur la période" />
        <Stat label="Demandes à traiter" icon={<PlusCircle />} value={formatNumber(newCount)} hint={<Link href="/client/demandes" className="underline underline-offset-2 hover:text-ink">Voir les demandes</Link>} />
        <Stat
          label="Abonnement"
          icon={<CalendarClock />}
          value={q.plan?.name ?? "—"}
          hint={q.plan ? `${formatCHF(q.plan.monthlyPriceCents)} / mois · ${q.subscription ? SUBSCRIPTION_STATUS[q.subscription.status].label : ""}` : "Aucune formule attribuée"}
        />
        <Stat label="Conversations simultanées" icon={<Clock />} value={q.concurrent || "—"} hint="Capacité incluse dans votre formule" />
      </StatGrid>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Dernières demandes" description="Messages et demandes laissés par vos visiteurs" actions={<ButtonLink href="/client/demandes" size="sm" variant="ghost">Tout voir</ButtonLink>} />
          <CardBody className="pt-3">
            {requests.length === 0 ? (
              <EmptyState title="Aucune demande pour l’instant" description="Les messages laissés à votre réceptionniste apparaîtront ici." />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {requests.map((r) => (
                  <li key={r.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">
                        {VISITOR_REQUEST_KIND[r.kind]} <span className="font-normal text-muted">· {r.visitorName}</span>
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{r.summary}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-ui text-[12px] text-faint">{formatRelative(r.createdAt)}</span>
                      <StatusBadge status={VISITOR_REQUEST_STATUS[r.status]} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Langues des visiteurs" description="Conversations de la période en cours" actions={<OriginTag origin="demo" />} />
          <CardBody className="pt-3">
            {langs.total === 0 ? (
              <EmptyState icon={<Globe2 />} title="Pas encore de conversation" description="La répartition apparaîtra dès les premières conversations du mois." />
            ) : (
              <ul className="flex flex-col gap-3.5">
                {langs.items.map((l) => (
                  <li key={l.lang} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                    <span className="text-[13.5px]">{LANG_LABELS[l.lang]}</span>
                    <span className="tabular font-ui text-[12.5px] text-muted">
                      {l.pct} % · {formatNumber(l.n)}
                    </span>
                    <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                      <span className="block h-full rounded-full bg-red/80" style={{ width: `${l.pct}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
