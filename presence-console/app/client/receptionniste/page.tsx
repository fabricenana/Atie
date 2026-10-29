import type { Metadata } from "next";
import { CheckCircle2, Globe, PencilLine } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getAvatar, getReceptionistForOrg, getWidgetForOrg, listDomainsForOrg } from "@/lib/repositories";
import { RECEPTIONIST_STATUS } from "@/lib/labels";
import { formatDuration, LANG_LABELS, LANG_SHORT } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { Portrait } from "@/components/ui/Portrait";
import { Button } from "@/components/ui/Button";
import { SupportDialog } from "@/components/client/SupportDialog";
import { WidgetPreview } from "@/components/client/WidgetPreview";

export const metadata: Metadata = { title: "Ma réceptionniste" };

const AFTER_HOURS: Record<string, string> = {
  message: "Propose de laisser un message",
  inform_hours: "Indique les horaires d’ouverture",
  redirect_contact: "Oriente vers vos coordonnées de contact",
};

export default async function MyReceptionist() {
  const v = await requireClient();
  const org = v.organization;
  const [rcp, domains, widget] = await Promise.all([getReceptionistForOrg(org.id), listDomainsForOrg(org.id), getWidgetForOrg(org.id)]);
  const avatar = rcp ? await getAvatar(rcp.avatarId) : null;
  const canRequest = can(v.role, "client.support.create");

  const changeButton = (
    <SupportDialog
      kind="change_request"
      buttonLabel="Demander une modification"
      icon={<PencilLine aria-hidden />}
      title="Demander une modification"
      description="Salutation, ton, informations, langues : décrivez le changement souhaité, ATIE s’en occupe."
      defaultSubject={`Modification de ${rcp?.name ?? "la réceptionniste"}`}
      placeholder="Exemple : ajouter que le cabinet est accessible en fauteuil roulant."
      disabled={!canRequest}
    />
  );

  if (!rcp) {
    return (
      <>
        <PageHeader title="Ma réceptionniste" description="Votre réceptionniste numérique est en cours de préparation par l’équipe ATIE." />
        <Card>
          <EmptyState
            title="Réceptionniste en préparation"
            description="ATIE configure son apparence, sa voix et ses connaissances. Vous serez prévenu dès qu’elle sera prête."
            action={canRequest ? changeButton : undefined}
          />
        </Card>
      </>
    );
  }

  const langs = [rcp.primaryLang, ...rcp.secondaryLangs.filter((l) => l !== rcp.primaryLang)];

  return (
    <>
      <PageHeader
        title={rcp.name}
        description={rcp.role}
        meta={<StatusBadge status={org.status === "suspended" ? { label: "Service suspendu", tone: "danger" } : RECEPTIONIST_STATUS[rcp.status]} />}
        actions={changeButton}
      />
      {!canRequest ? (
        <Notice kind="info" className="mb-6" title="Lecture seule">
          Seul l’administrateur de votre entreprise peut demander une modification.
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <Portrait src={avatar?.portraitUrl ?? null} name={rcp.name} className="aspect-[3/4] w-full" sizes="(min-width: 1024px) 320px, 100vw" />
          <CardBody>
            <p className="font-head text-[20px] font-semibold">{rcp.name}</p>
            <p className="mt-0.5 text-[13.5px] text-muted">{rcp.role}</p>
            <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Langues parlées">
              {langs.map((l) => (
                <li key={l}>
                  <Badge tone={l === rcp.primaryLang ? "accent" : "neutral"}>
                    {LANG_LABELS[l]}
                    {l === rcp.primaryLang ? <span className="sr-only"> (langue principale)</span> : null}
                  </Badge>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Présentation" description="Ce que votre réceptionniste dit et sait faire" />
            <CardBody>
              <blockquote className="rounded-xl border-l-2 border-red bg-surface-2 px-4 py-3 text-[14.5px] leading-relaxed">« {rcp.greeting} »</blockquote>
              <DefinitionList
                className="mt-6"
                items={[
                  ["Ton", rcp.tone],
                  ["Durée maximale d’une conversation", `${formatDuration(rcp.maxConversationSeconds)} min`],
                  ["En dehors des horaires", AFTER_HOURS[rcp.afterHoursBehavior]],
                  ["Langue principale", LANG_LABELS[rcp.primaryLang]],
                ]}
              />
              <div className="mt-6">
                <p className="font-ui text-[12px] font-medium uppercase tracking-[0.06em] text-faint">Sujets pris en charge</p>
                {rcp.allowedServices.length ? (
                  <ul className="mt-2 grid gap-2 sm:grid-cols-2">
                    {rcp.allowedServices.map((s) => (
                      <li key={s} className="flex items-center gap-2 text-[14px]">
                        <CheckCircle2 aria-hidden className="size-4 shrink-0 text-success" /> {s}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[13.5px] text-muted">En cours de définition avec ATIE.</p>
                )}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Sites où elle apparaît" />
            <CardBody className="pt-3">
              {domains.length === 0 ? (
                <p className="text-[13.5px] text-muted">Aucun site enregistré pour l’instant.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {domains.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                      <span className="flex min-w-0 items-center gap-2 text-[14px]">
                        <Globe aria-hidden className="size-4 shrink-0 text-faint" />
                        <span className="truncate">{d.domain}</span>
                      </span>
                      <Badge tone={d.verified ? "success" : "warning"} dot>
                        {d.verified ? "Vérifié" : "Vérification en cours"}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
              {widget ? (
                <p className="mt-4 text-[12.5px] text-faint">
                  Installation : {widget.status === "installed" ? "effectuée par ATIE" : widget.status === "ready" ? "prête, en attente de mise en ligne" : widget.status === "disabled" ? "désactivée" : "à préparer"}.
                </p>
              ) : null}
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Aperçu du widget" description="Représentation de la bulle et du panneau sur votre site" />
        <CardBody className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,280px)] lg:items-center">
          <WidgetPreview name={rcp.name} role={rcp.role} portraitUrl={avatar?.portraitUrl ?? null} greeting={rcp.greeting} langs={langs.map((l) => LANG_SHORT[l])} />
          <div className="flex flex-col gap-4">
            <Notice kind="info" title="Aperçu statique">
              Cet aperçu ne démarre aucune conversation : pas de micro, pas de connexion, aucune minute décomptée.
            </Notice>
            <Button disabled title="Indisponible dans l’aperçu">
              Démarrer une conversation d’essai
            </Button>
            <p className="text-[12.5px] text-muted">Pour essayer votre réceptionniste en conditions réelles, rendez-vous sur votre site ou demandez un essai accompagné à ATIE.</p>
          </div>
        </CardBody>
      </Card>
    </>
  );
}
