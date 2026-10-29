import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { createOrganization } from "@/lib/actions/organizations";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormGrid } from "@/components/ui/Field";
import { TextField } from "@/components/ui/FormFields";
import { SubmitButton } from "@/components/ui/ActionForm";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { RedirectForm } from "@/components/admin/RedirectForm";

export const metadata: Metadata = { title: "Nouvelle entreprise" };

export default async function NewOrganizationPage() {
  await requireAdmin("org.write");
  return (
    <>
      <PageHeader
        title="Nouvelle entreprise"
        description="L’entreprise est créée en configuration. ATIE assigne ensuite la réceptionniste, les domaines et la formule."
        breadcrumbs={[{ label: "Entreprises", href: "/admin/entreprises" }, { label: "Nouvelle entreprise" }]}
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <RedirectForm action={createOrganization} basePath="/admin/entreprises" className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Identité" description="Informations visibles dans le back-office et l’espace client." />
            <CardBody>
              <FormGrid>
                <TextField label="Nom de l’entreprise" name="name" required autoComplete="organization" />
                <TextField label="Identifiant public" name="slug" required hint="Utilisé par le widget (tenant_id). Ex. cabinet-lumiere" pattern="[a-z0-9-]+" />
                <TextField label="Secteur" name="sector" required placeholder="Ex. Santé — cabinet dentaire" />
                <TextField label="Ville" name="city" required autoComplete="address-level2" />
                <TextField label="Adresse" name="address" autoComplete="street-address" className="sm:col-span-2" />
              </FormGrid>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Contact et facturation" />
            <CardBody>
              <FormGrid>
                <TextField label="Responsable" name="contactName" required autoComplete="name" />
                <TextField label="E-mail du responsable" name="contactEmail" type="email" required autoComplete="email" />
                <TextField label="Téléphone" name="phone" type="tel" autoComplete="tel" />
                <TextField label="E-mail de facturation" name="billingEmail" type="email" required />
                <TextField label="Numéro IDE / TVA" name="vatNumber" placeholder="CHE-000.000.000 TVA" />
              </FormGrid>
            </CardBody>
          </Card>
          <div className="flex flex-wrap justify-end gap-2">
            <ButtonLink href="/admin/entreprises">Annuler</ButtonLink>
            <SubmitButton>Créer l’entreprise</SubmitButton>
          </div>
        </RedirectForm>
        <aside className="flex flex-col gap-4">
          <Notice kind="not_connected" title="Ce que fait la création">
            L’entreprise est enregistrée dans la base de la console. Aucun compte n’est créé chez LiveKit ou LemonSlice et
            le backend Python n’en est pas encore informé automatiquement. Les accès utilisateurs s’ajoutent ensuite par invitation.
          </Notice>
          <Notice kind="info" title="Étapes suivantes">
            Ajoutez les domaines autorisés, assignez une réceptionniste à partir d’un avatar existant, puis attribuez une formule.
          </Notice>
        </aside>
      </div>
    </>
  );
}
