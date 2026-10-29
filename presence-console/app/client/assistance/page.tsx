import Link from "next/link";
import type { Metadata } from "next";
import { AlertOctagon, Clock, Mail, PencilLine } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listSupportForOrg } from "@/lib/repositories";
import { SUPPORT_KIND, SUPPORT_STATUS } from "@/lib/labels";
import type { SupportKind } from "@/lib/domain/types";
import { formatDate, formatRelative } from "@/lib/format";
import { createSupportRequest } from "@/lib/actions/client";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { SelectField, TextAreaField, TextField } from "@/components/ui/FormFields";

export const metadata: Metadata = { title: "Assistance ATIE" };

const ENTRIES: Array<{ kind: SupportKind; title: string; text: string; subject: string; placeholder: string; Icon: typeof Mail }> = [
  { kind: "change_request", title: "Demander une modification", text: "Salutation, informations, langues, ton de votre réceptionniste.", subject: "Modification de ma réceptionniste", placeholder: "Décrivez le changement souhaité…", Icon: PencilLine },
  { kind: "issue", title: "Signaler un problème", text: "Affichage, réponse inexacte, bulle mal placée sur votre site.", subject: "Problème constaté", placeholder: "Où et quand le problème apparaît-il ? Sur quel appareil ?", Icon: AlertOctagon },
  { kind: "minutes", title: "Demander des minutes", text: "Ajouter des minutes ou augmenter votre volume mensuel.", subject: "Minutes supplémentaires", placeholder: "Combien de minutes, et pour quelle période ?", Icon: Clock },
  { kind: "contact", title: "Contacter ATIE", text: "Une question sur votre service, votre abonnement ou vos données.", subject: "Question à ATIE", placeholder: "Votre message…", Icon: Mail },
];

export default async function ClientSupport({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const v = await requireClient();
  const sp = await searchParams;
  const entry = ENTRIES.find((e) => e.kind === sp.type) ?? ENTRIES[0];
  const canCreate = can(v.role, "client.support.create");
  const history = listSupportForOrg(v.organization.id);

  return (
    <>
      <PageHeader title="Assistance ATIE" description="Une équipe à Genève qui configure et fait évoluer votre réceptionniste pour vous." />

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {ENTRIES.map(({ kind, title, text, Icon }) => {
          const active = kind === entry.kind;
          return (
            <li key={kind}>
              <Link
                href={`/client/assistance?type=${kind}#formulaire`}
                scroll={false}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-full flex-col gap-3 rounded-2xl border bg-surface p-5 shadow-card transition-[border-color,transform] duration-150 hover:-translate-y-px",
                  active ? "border-red" : "border-line hover:border-line-strong",
                )}
              >
                <span className={cn("grid size-10 place-items-center rounded-xl", active ? "bg-red text-white" : "bg-accent-soft text-red")}>
                  <Icon aria-hidden className="size-[18px]" />
                </span>
                <span className="font-head text-[15px] font-semibold">{title}</span>
                <span className="text-[13px] text-muted">{text}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card id="formulaire" className="scroll-mt-24">
          <CardHeader title={entry.title} description="Réponse habituelle sous un jour ouvrable (démonstration : aucun message n’est envoyé)." />
          <CardBody>
            {canCreate ? (
              <ActionForm key={entry.kind} action={createSupportRequest} resetOnSuccess className="flex flex-col gap-5">
                <SelectField label="Type de demande" name="kind" defaultValue={entry.kind} required options={Object.entries(SUPPORT_KIND).map(([value, label]) => ({ value, label }))} />
                <TextField label="Objet" name="subject" defaultValue={entry.subject} required maxLength={120} />
                <TextAreaField label="Message" name="message" required rows={6} maxLength={2000} placeholder={entry.placeholder} />
                <div className="flex justify-end">
                  <SubmitButton>Envoyer à ATIE</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <Notice kind="info" title="Lecture seule">
                Votre compte ne permet pas de créer une demande. Adressez-vous à l’administrateur de votre entreprise.
              </Notice>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Historique des demandes" description={`${history.length} demande(s)`} />
          <CardBody className="pt-3">
            {history.length === 0 ? (
              <EmptyState title="Aucune demande" description="Vos demandes à ATIE et leur suivi apparaîtront ici." />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {history.map((h) => (
                  <li key={h.id} className="flex flex-col gap-1.5 py-3.5 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 text-[14px] font-medium">{h.subject}</p>
                      <StatusBadge status={SUPPORT_STATUS[h.status]} />
                    </div>
                    <p className="line-clamp-2 text-[13px] text-muted">{h.message}</p>
                    <p className="font-ui text-[12px] text-faint">
                      {SUPPORT_KIND[h.kind]} · envoyée le {formatDate(h.createdAt)} · mise à jour {formatRelative(h.updatedAt)}
                    </p>
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
