import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Circle, KeyRound, Lock, PlugZap, Radio, Unplug } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { getConversation } from "@/lib/repositories/sessions";
import { END_REASON, SESSION_STATUS } from "@/lib/labels";
import { formatCHF, formatDateTime, formatDuration, formatNumber, formatTime, LANG_LABELS, toMinutes } from "@/lib/format";
import type { ConversationEvent } from "@/lib/domain/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/Card";
import { OriginTag, StatusBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { ButtonLink } from "@/components/ui/Button";

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  return { title: `Session ${id}` };
}

const EVENT_LABEL: Record<ConversationEvent["type"], { label: string; Icon: typeof Circle; cls: string }> = {
  reserved: { label: "Place réservée", Icon: Lock, cls: "text-muted" },
  token_issued: { label: "Jeton émis", Icon: KeyRound, cls: "text-muted" },
  connected: { label: "Connexion établie", Icon: PlugZap, cls: "text-success" },
  heartbeat_lost: { label: "Signal perdu", Icon: Unplug, cls: "text-warning" },
  ended: { label: "Fin de conversation", Icon: Radio, cls: "text-muted" },
  room_closed: { label: "Salle fermée", Icon: CheckCircle2, cls: "text-success" },
  error: { label: "Erreur", Icon: AlertTriangle, cls: "text-danger" },
};

export default async function SessionDetail({ params }: Params) {
  await requireAdmin("session.read_all");
  const { id } = await params;
  const found = await getConversation(id);
  if (!found) notFound();
  const { conversation: c, organization: org, receptionist: rcp, events } = found;
  const showTranscript = Boolean(org?.transcriptsEnabled) && c.transcriptAvailable;

  return (
    <>
      <PageHeader
        title={`Session ${c.id}`}
        description={`${org?.name ?? c.organizationId} · ${rcp?.name ?? "Réceptionniste inconnue"}`}
        breadcrumbs={[{ label: "Conversations", href: "/admin/sessions" }, { label: c.id }]}
        meta={
          <>
            <StatusBadge status={SESSION_STATUS[c.status]} />
          </>
        }
        actions={org ? <ButtonLink href={`/admin/entreprises/${org.id}?tab=sessions`}>Sessions de l’entreprise</ButtonLink> : null}
      />

      {c.status === "close_unconfirmed" ? (
        <Notice kind="warning" title="Fermeture non confirmée" className="mb-6">
          Le fournisseur n’a pas confirmé la fermeture de la salle. La réconciliation relève du backend Python (fermeture contrôlée
          LiveKit/LemonSlice) ; la console ne peut pas la forcer.
        </Notice>
      ) : null}
      {c.error ? (
        <Notice kind="danger" title="Erreur signalée" className="mb-6">
          {c.error}
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Détails" />
          <CardBody>
            <DefinitionList
              items={[
                ["Entreprise", org?.name ?? c.organizationId],
                ["Réceptionniste", rcp?.name ?? "—"],
                ["Début", formatDateTime(c.startedAt)],
                ["Fin", c.endedAt ? formatDateTime(c.endedAt) : "En cours"],
                ["Durée", formatDuration(c.durationSeconds)],
                ["Langue", LANG_LABELS[c.lang]],
                ["Motif de fin", c.endReason ? (END_REASON[c.endReason] ?? c.endReason) : "—"],
                ["Minutes facturables", formatNumber(toMinutes(c.billableSeconds))],
                [
                  "Coût fournisseur",
                  c.providerCostCents === null ? (
                    "— (non transmis par le backend)"
                  ) : (
                    <span key="c" className="inline-flex items-center gap-2">
                      {formatCHF(c.providerCostCents)} <OriginTag origin={c.providerCostOrigin} />
                    </span>
                  ),
                ],
                ["Identifiant backend", <code key="b" className="break-all font-mono text-[12.5px]">{c.backendSessionId}</code>],
              ]}
            />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Chronologie" description="Événements transmis par le backend" />
          <CardBody className="pt-3">
            {events.length === 0 ? (
              <EmptyState title="Aucun événement" />
            ) : (
              <ol className="relative flex flex-col gap-5 before:absolute before:bottom-2 before:left-[13px] before:top-2 before:w-px before:bg-line">
                {events.map((e) => {
                  const meta = EVENT_LABEL[e.type] ?? { label: e.type, Icon: Circle, cls: "text-muted" };
                  return (
                    <li key={e.id} className="relative flex gap-3">
                      <span aria-hidden className={`relative grid size-7 shrink-0 place-items-center rounded-full border border-line bg-surface ${meta.cls}`}>
                        <meta.Icon className="size-3.5" />
                      </span>
                      <div className="min-w-0 pt-0.5">
                        <p className="text-[13.5px] font-medium">{meta.label}</p>
                        <p className="text-[13px] text-muted">{e.detail}</p>
                        <p className="tabular font-ui text-[12px] text-faint">{formatTime(e.at)}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Transcription" />
        <CardBody>
          {showTranscript ? (
            <Notice kind="info">La transcription sera chargée depuis le backend lorsque la conservation est activée pour cette entreprise.</Notice>
          ) : (
            <EmptyState
              icon={<Lock />}
              title="Aucune transcription conservée"
              description={
                org?.transcriptsEnabled
                  ? "La conservation est activée pour cette entreprise, mais aucune transcription n’existe pour cette session."
                  : "La conservation des transcriptions est désactivée pour cette entreprise (réglage par défaut). Rien n’est enregistré ni affiché."
              }
            />
          )}
        </CardBody>
      </Card>
    </>
  );
}
