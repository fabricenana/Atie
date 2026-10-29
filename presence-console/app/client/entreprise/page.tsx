import type { Metadata } from "next";
import { Globe } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { can, ROLE_LABELS } from "@/lib/auth/permissions";
import { listDomainsForOrg, listOrgUsers } from "@/lib/repositories";
import { formatDate, formatRelative } from "@/lib/format";
import { updateClientOrganization } from "@/lib/actions/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/Card";
import { Badge, OriginTag } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { TextField, TextAreaField } from "@/components/ui/FormFields";
import { Checkbox, FormGrid } from "@/components/ui/Field";
import { SupportDialog } from "@/components/client/SupportDialog";

export const metadata: Metadata = { title: "Mon entreprise" };

export default async function ClientOrganization() {
  const v = await requireClient();
  const org = v.organization;
  const canEdit = can(v.role, "client.org.write");
  const domains = listDomainsForOrg(org.id);
  const users = listOrgUsers(org.id);
  const prefs = org.notificationPrefs;

  return (
    <>
      <PageHeader title="Mon entreprise" description="Coordonnées, facturation et préférences de votre compte ATIE Presence." meta={<OriginTag origin="demo" />} />

      {!canEdit ? (
        <Notice kind="info" title="Lecture seule" className="mb-6">
          Votre compte permet de consulter ces informations. Leur modification est réservée à l’administrateur de votre entreprise.
        </Notice>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        {canEdit ? (
          <Card>
            <CardHeader title="Informations de l’entreprise" description={`${org.name} · ${org.sector}`} />
            <CardBody>
              <ActionForm action={updateClientOrganization} className="flex flex-col gap-8">
                <section aria-labelledby="coord" className="flex flex-col gap-5">
                  <h3 id="coord" className="font-ui text-[13px] font-semibold text-muted">Coordonnées</h3>
                  <FormGrid>
                    <TextField label="Responsable" name="contactName" defaultValue={org.contactName} required autoComplete="name" />
                    <TextField label="E-mail du responsable" name="contactEmail" type="email" defaultValue={org.contactEmail} required autoComplete="email" />
                    <TextField label="Téléphone" name="phone" type="tel" defaultValue={org.phone} required autoComplete="tel" />
                    <TextField label="Localité" name="city" defaultValue={org.city} required autoComplete="address-level2" />
                    <TextField label="Adresse" name="address" defaultValue={org.address} required autoComplete="street-address" className="sm:col-span-2" />
                  </FormGrid>
                </section>
                <section aria-labelledby="fact" className="flex flex-col gap-5">
                  <h3 id="fact" className="font-ui text-[13px] font-semibold text-muted">Facturation</h3>
                  <FormGrid>
                    <TextField label="E-mail de facturation" name="billingEmail" type="email" defaultValue={org.billingEmail} required />
                    <TextField label="Numéro de TVA (IDE)" name="vatNumber" defaultValue={org.vatNumber ?? ""} placeholder="CHE-000.000.000 TVA" hint="Facultatif" />
                    <TextAreaField label="Adresse de facturation" name="billingAddress" defaultValue={org.billingAddress} required rows={2} className="sm:col-span-2" />
                  </FormGrid>
                </section>
                <fieldset className="flex flex-col gap-2">
                  <legend className="mb-2 font-ui text-[13px] font-semibold text-muted">Notifications par e-mail</legend>
                  <Checkbox name="quotaAlerts" label="Alertes de minutes" description="Lorsque le seuil d’alerte est atteint ou que les minutes sont épuisées." defaultChecked={prefs.quotaAlerts} />
                  <Checkbox name="newRequests" label="Nouvelles demandes des visiteurs" description="Un e-mail à chaque message, devis ou demande de contact." defaultChecked={prefs.newRequests} />
                  <Checkbox name="monthlyReport" label="Bilan mensuel" description="Un résumé de l’activité de votre réceptionniste en début de mois." defaultChecked={prefs.monthlyReport} />
                  <p className="mt-1 text-[12.5px] text-faint">Démonstration : aucun e-mail n’est réellement envoyé.</p>
                </fieldset>
                <div className="flex justify-end border-t border-line pt-5">
                  <SubmitButton>Enregistrer les modifications</SubmitButton>
                </div>
              </ActionForm>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Informations de l’entreprise" description={`${org.name} · ${org.sector}`} />
            <CardBody>
              <DefinitionList
                items={[
                  ["Responsable", org.contactName],
                  ["E-mail", org.contactEmail],
                  ["Téléphone", org.phone],
                  ["Adresse", `${org.address}, ${org.city}`],
                  ["E-mail de facturation", org.billingEmail],
                  ["Adresse de facturation", org.billingAddress],
                  ["Numéro de TVA", org.vatNumber ?? "—"],
                  [
                    "Notifications",
                    [prefs.quotaAlerts && "Alertes de minutes", prefs.newRequests && "Nouvelles demandes", prefs.monthlyReport && "Bilan mensuel"].filter(Boolean).join(", ") || "Aucune",
                  ],
                ]}
              />
            </CardBody>
          </Card>
        )}

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Domaine internet" description="Sites autorisés à afficher votre réceptionniste" />
            <CardBody className="pt-3">
              {domains.length ? (
                <ul className="flex flex-col divide-y divide-line">
                  {domains.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 first:pt-0 last:pb-0">
                      <span className="flex min-w-0 items-center gap-2 text-[14px]">
                        <Globe aria-hidden className="size-4 shrink-0 text-faint" />
                        <span className="truncate">{d.domain}</span>
                      </span>
                      <Badge tone={d.verified ? "success" : "warning"} dot>{d.verified ? "Vérifié" : "En cours"}</Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13.5px] text-muted">Aucun domaine enregistré.</p>
              )}
              {canEdit ? (
                <div className="mt-5">
                  <SupportDialog
                    kind="change_request"
                    variant="secondary"
                    buttonLabel="Ajouter ou modifier un domaine"
                    title="Domaine internet"
                    description="Pour des raisons de sécurité, ATIE vérifie chaque nouveau domaine avant d’y autoriser votre réceptionniste."
                    defaultSubject="Ajout d’un domaine"
                    placeholder="Exemple : merci d’autoriser www.mon-site.ch"
                  />
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Utilisateurs du compte" description="Personnes ayant accès à cet espace" />
            <CardBody className="pt-3">
              <ul className="flex flex-col divide-y divide-line">
                {users.map(({ membership, user }) => (
                  <li key={membership.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[14px] font-medium">
                        {user.fullName}
                        {user.id === v.user.id ? <span className="ml-1.5 font-ui text-[12px] font-normal text-faint">(vous)</span> : null}
                      </span>
                      <Badge tone={membership.role === "org_admin" ? "accent" : "neutral"}>{ROLE_LABELS[membership.role]}</Badge>
                    </div>
                    <span className="font-ui text-[12.5px] text-muted">
                      {user.email} · {user.status === "invited" ? "invitation envoyée" : user.lastLoginAt ? `dernière connexion ${formatRelative(user.lastLoginAt)}` : `depuis le ${formatDate(user.createdAt)}`}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12.5px] text-faint">Pour ajouter ou retirer un utilisateur, adressez une demande à ATIE depuis l’assistance.</p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
