import Link from "next/link";
import type { Metadata } from "next";
import { Power, RefreshCw } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listLiveSessions } from "@/lib/repositories";
import { nameIndexes } from "@/lib/repositories/sessions";
import { SESSION_STATUS } from "@/lib/labels";
import { formatDuration, formatTime, LANG_SHORT } from "@/lib/format";
import type { Conversation, SessionStatus } from "@/lib/domain/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Notice, NotConnected } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { Portrait } from "@/components/ui/Portrait";
import { listAvatars } from "@/lib/repositories";

export const metadata: Metadata = { title: "Sessions actives" };
export const dynamic = "force-dynamic";

const STATE_HELP: Record<SessionStatus, string> = {
  pending: "Place demandée, réservation en cours.",
  connecting: "Jeton émis, connexion LiveKit et avatar en cours.",
  active: "Visiteur et réceptionniste en conversation.",
  terminating: "Fin demandée, fermeture de la salle en cours.",
  ended: "Salle fermée, place libérée.",
  failed: "La session n’a pas pu démarrer.",
  close_unconfirmed: "Fin constatée, mais fermeture non confirmée par le fournisseur.",
};

export default async function ActiveSessions() {
  await requireAdmin("session.read_all");
  const [{ orgs, receptionists }, all, avatars] = await Promise.all([nameIndexes(), listLiveSessions(), listAvatars()]);
  const avatarById = new Map(avatars.map((a) => [a.id, a]));
  const live = all.filter((c) => c.status !== "close_unconfirmed").sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  const unconfirmed = all.filter((c) => c.status === "close_unconfirmed");
  const now = Date.now();

  const SessionCard = ({ c }: { c: Conversation }) => {
    const rcp = c.receptionistId ? receptionists.get(c.receptionistId) : undefined;
    const org = orgs.get(c.organizationId);
    const avatar = rcp ? avatarById.get(rcp.avatarId) ?? null : null;
    const elapsed = c.endedAt ? c.durationSeconds : Math.max(0, Math.round((now - new Date(c.startedAt).getTime()) / 1000));
    const max = rcp?.maxConversationSeconds ?? 180;
    return (
      <li className="flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-card">
        <div className="flex items-start gap-3">
          <Portrait src={avatar?.portraitUrl ?? null} name={rcp?.name ?? "Réceptionniste"} className="size-12 shrink-0 rounded-xl" sizes="48px" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">{org?.name ?? c.organizationId}</p>
            <p className="truncate font-ui text-[12.5px] text-faint">
              {rcp?.name ?? "—"} · depuis {formatTime(c.startedAt)}
            </p>
          </div>
          <Badge>{LANG_SHORT[c.lang]}</Badge>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3">
          <div>
            <p className="font-ui text-[11.5px] text-faint">Durée écoulée</p>
            <p className="tabular font-head text-[22px] font-semibold leading-tight">
              {formatDuration(elapsed)}
              <span className="ml-1 font-ui text-[12px] font-normal text-faint">/ {formatDuration(max)}</span>
            </p>
          </div>
          <StatusBadge status={SESSION_STATUS[c.status]} />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <ButtonLink href={`/admin/sessions/${c.id}`} size="sm" variant="ghost">
            Détails
          </ButtonLink>
          <Button size="sm" variant="secondary" disabled title="Relève du backend Python (DELETE /session/{id})" aria-describedby="force-close-help">
            <Power aria-hidden /> Forcer la fermeture
          </Button>
        </div>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="Sessions actives"
        description={`Instantané au ${formatTime(new Date(now).toISOString())}. Les durées sont calculées côté serveur à l’affichage.`}
        breadcrumbs={[{ label: "Conversations", href: "/admin/sessions" }, { label: "Sessions actives" }]}
        actions={
          <Link href="/admin/sessions/actives" className="inline-flex h-10 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 font-ui text-sm font-medium hover:bg-surface-2">
            <RefreshCw className="size-4" aria-hidden /> Actualiser
          </Link>
        }
      />

      <NotConnected what="Suivi en temps réel">
        <span id="force-close-help">
          Cet écran affiche les sessions écrites en base par le backend Python, seule autorité sur les sessions et les baux ; tant qu’il
          n’écrit rien, la liste reste vide. La fermeture forcée passera par l’API (DELETE /session/{"{id}"}) : elle est désactivée ici.
        </span>
      </NotConnected>

      <section aria-labelledby="live-title" className="mt-6">
        <h2 id="live-title" className="mb-3 flex items-center gap-2 font-head text-[16px] font-semibold">
          En cours
          <span className="tabular rounded-full bg-surface-3 px-2 font-ui text-[12px] font-medium text-muted">{live.length}</span>
          {live.length ? <span aria-hidden className="animate-live size-2 rounded-full bg-success" /> : null}
        </h2>
        {live.length === 0 ? (
          <Card>
            <EmptyState title="Aucune session en cours" description="Les nouvelles sessions apparaîtront ici après actualisation." />
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {live.map((c) => (
              <SessionCard key={c.id} c={c} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="unconfirmed-title" className="mt-8">
        <h2 id="unconfirmed-title" className="mb-3 flex items-center gap-2 font-head text-[16px] font-semibold">
          Fermetures non confirmées
          <span className="tabular rounded-full bg-surface-3 px-2 font-ui text-[12px] font-medium text-muted">{unconfirmed.length}</span>
        </h2>
        {unconfirmed.length === 0 ? (
          <Card>
            <EmptyState title="Aucune fermeture en attente" />
          </Card>
        ) : (
          <>
            <Notice kind="warning" className="mb-4">
              Ces sessions sont terminées côté visiteur, mais la fermeture de la salle n’a pas été confirmée. Elles peuvent encore engendrer des
              coûts fournisseur : la réconciliation est assurée par le backend.
            </Notice>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {unconfirmed.map((c) => (
                <SessionCard key={c.id} c={c} />
              ))}
            </ul>
          </>
        )}
      </section>

      <Card className="mt-8">
        <CardHeader title="États d’une session" description="Cycle de vie défini par le backend Python" />
        <CardBody>
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
            {(Object.keys(SESSION_STATUS) as SessionStatus[]).map((s) => (
              <div key={s}>
                <dt>
                  <StatusBadge status={SESSION_STATUS[s]} />
                </dt>
                <dd className="mt-1.5 text-[13px] text-muted">{STATE_HELP[s]}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>
    </>
  );
}
