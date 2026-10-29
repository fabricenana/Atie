import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getAvatar, getOrganization, listAvatars, listOrganizations, listReceptionists } from "@/lib/repositories";
import { updateReceptionist } from "@/lib/actions/receptionists";
import { RECEPTIONIST_STATUS } from "@/lib/labels";
import { LANGS } from "@/lib/domain/types";
import { formatDateTime, formatRelative, LANG_LABELS } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/Card";
import { OriginTag, StatusBadge } from "@/components/ui/Badge";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { FieldError, SelectField, TextAreaField, TextField } from "@/components/ui/FormFields";
import { Checkbox, FormGrid } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { ButtonLink } from "@/components/ui/Button";
import { WidgetPreview } from "@/components/admin/WidgetPreview";

export const metadata: Metadata = { title: "Configuration de la réceptionniste" };

export default async function ReceptionistPage({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireAdmin("org.read_all");
  const { id } = await params;
  const r = listReceptionists().find((x) => x.id === id);
  if (!r) notFound();
  const canWrite = can(v.role, "receptionist.write");
  const avatar = getAvatar(r.avatarId);
  const org = r.organizationId ? getOrganization(r.organizationId) : null;
  const taken = new Set(listReceptionists().filter((x) => x.id !== r.id && x.organizationId).map((x) => x.organizationId));
  const orgOptions = [
    { value: "", label: "Aucune entreprise (non associée)" },
    ...listOrganizations().map((o) => ({ value: o.id, label: taken.has(o.id) ? `${o.name} — déjà équipée` : o.name, disabled: taken.has(o.id) })),
  ];

  return (
    <>
      <PageHeader
        title={r.name}
        description={r.role}
        breadcrumbs={[{ label: "Réceptionnistes", href: "/admin/receptionnistes" }, { label: r.name }]}
        meta={
          <>
            <StatusBadge status={RECEPTIONIST_STATUS[r.status]} />
            <OriginTag origin="demo" />
          </>
        }
        actions={org ? <ButtonLink href={`/admin/entreprises/${org.id}?tab=receptionniste`}>Dossier {org.name}</ButtonLink> : null}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <ActionForm action={updateReceptionist} className="flex min-w-0 flex-col gap-6">
          <input type="hidden" name="id" value={r.id} />
          <fieldset disabled={!canWrite} className="contents">
            <Card>
              <CardHeader title="Identité" description="Nom affiché, entreprise associée et avatar existant." />
              <CardBody>
                <FormGrid>
                  <TextField label="Nom de la réceptionniste" name="name" defaultValue={r.name} required />
                  <TextField label="Rôle affiché" name="role" defaultValue={r.role} required />
                  <SelectField label="Entreprise associée" name="organizationId" defaultValue={r.organizationId ?? ""} options={orgOptions} hint="Une entreprise ne peut avoir qu’une réceptionniste." />
                  <SelectField
                    label="Avatar LemonSlice"
                    name="avatarId"
                    defaultValue={r.avatarId}
                    options={listAvatars().map((a) => ({ value: a.id, label: `${a.name} — ${a.providerAvatarId}` }))}
                    hint="Choix parmi les avatars existants uniquement. Aucun avatar n’est créé ni modifié chez le fournisseur."
                  />
                  <TextField label="Identifiant fournisseur (lecture seule)" name="providerAvatarId" defaultValue={avatar?.providerAvatarId ?? ""} readOnly aria-readonly className="sm:col-span-2" />
                  <SelectField
                    label="Statut"
                    name="status"
                    defaultValue={r.status}
                    options={Object.entries(RECEPTIONIST_STATUS).map(([value, s]) => ({ value, label: s.label }))}
                    hint="« En service » est indicatif : la mise en production réelle dépend du backend."
                  />
                </FormGrid>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Voix et langues" />
              <CardBody>
                <FormGrid>
                  <TextField label="Voix" name="voice" defaultValue={r.voice} required hint="Référence de voix TTS, utilisée par l’agent Python." />
                  <SelectField label="Langue principale" name="primaryLang" defaultValue={r.primaryLang} options={LANGS.map((l) => ({ value: l, label: LANG_LABELS[l] }))} />
                </FormGrid>
                <fieldset className="mt-5">
                  <legend className="font-ui text-[13px] font-medium">Langues secondaires</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {LANGS.map((l) => (
                      <Checkbox key={l} name="secondaryLangs" value={l} label={LANG_LABELS[l]} defaultChecked={r.secondaryLangs.includes(l)} />
                    ))}
                  </div>
                  <p className="mt-1 text-[12.5px] text-faint">La langue principale est automatiquement exclue des langues secondaires.</p>
                  <FieldError name="secondaryLangs" />
                </fieldset>
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Comportement conversationnel" description="Instructions transmises à l’agent LiveKit lors de la connexion au backend." />
              <CardBody>
                <div className="flex flex-col gap-5">
                  <TextField label="Ton et personnalité" name="tone" defaultValue={r.tone} required />
                  <TextAreaField label="Instructions métier" name="businessInstructions" defaultValue={r.businessInstructions} required rows={5} />
                  <FormGrid>
                    <TextAreaField label="Salutation" name="greeting" defaultValue={r.greeting} required rows={3} />
                    <TextAreaField label="Réponse de repli" name="fallbackReply" defaultValue={r.fallbackReply} required rows={3} hint="Utilisée quand l’information n’est pas dans la Knowledge Base." />
                    <SelectField
                      label="En dehors des horaires"
                      name="afterHoursBehavior"
                      defaultValue={r.afterHoursBehavior}
                      options={[
                        { value: "message", label: "Proposer de laisser un message" },
                        { value: "inform_hours", label: "Indiquer les horaires d’ouverture" },
                        { value: "redirect_contact", label: "Rediriger vers la page contact" },
                      ]}
                    />
                    <TextField
                      label="Durée maximale d’une conversation (min)"
                      name="maxConversationMinutes"
                      type="number"
                      min={1}
                      max={15}
                      step={0.5}
                      defaultValue={r.maxConversationSeconds / 60}
                      required
                      hint="Plafond appliqué par le backend (bail de session)."
                    />
                  </FormGrid>
                  <TextAreaField
                    label="Services métier autorisés"
                    name="allowedServices"
                    defaultValue={r.allowedServices.join("\n")}
                    rows={4}
                    hint="Un service par ligne (ou séparés par des virgules)."
                  />
                </div>
              </CardBody>
            </Card>
          </fieldset>
          {canWrite ? (
            <div className="flex flex-wrap items-center justify-end gap-3">
              <p className="text-[12.5px] text-muted">Enregistrement local uniquement : rien n’est envoyé à l’agent ni à LemonSlice.</p>
              <SubmitButton>Enregistrer la configuration</SubmitButton>
            </div>
          ) : (
            <Notice kind="info">Lecture seule pour votre rôle.</Notice>
          )}
        </ActionForm>

        <aside className="flex flex-col gap-6 xl:sticky xl:top-20 xl:self-start">
          <WidgetPreview name={r.name} role={r.role} portraitUrl={avatar?.portraitUrl ?? null} greeting={r.greeting} langs={[r.primaryLang, ...r.secondaryLangs]} />
          <Card>
            <CardHeader title="Suivi" />
            <CardBody>
              <DefinitionList
                className="sm:grid-cols-1"
                items={[
                  ["Entreprise", org?.name ?? "Non associée"],
                  ["Dernière activité", formatRelative(r.lastActivityAt)],
                  ["Créée le", formatDateTime(r.createdAt)],
                  ["Modifiée le", formatDateTime(r.updatedAt)],
                ]}
              />
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  );
}
