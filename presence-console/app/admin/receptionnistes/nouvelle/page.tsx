import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { listAvatars, listOrganizations, listReceptionists } from "@/lib/repositories";
import { createReceptionist } from "@/lib/actions/receptionists";
import { LANGS } from "@/lib/domain/types";
import { LANG_LABELS } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { FormGrid } from "@/components/ui/Field";
import { FieldError, SelectField, TextField } from "@/components/ui/FormFields";
import { SubmitButton } from "@/components/ui/ActionForm";
import { ButtonLink } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";
import { Portrait } from "@/components/ui/Portrait";
import { RedirectForm } from "@/components/admin/RedirectForm";

export const metadata: Metadata = { title: "Nouvelle réceptionniste" };

export default async function NewReceptionistPage() {
  await requireAdmin("receptionist.write");
  const avatars = listAvatars();
  const taken = new Set(listReceptionists().map((r) => r.organizationId).filter(Boolean));
  const free = listOrganizations().filter((o) => !taken.has(o.id));

  return (
    <>
      <PageHeader
        title="Nouvelle réceptionniste"
        description="Créée en brouillon à partir d’un personnage existant. La configuration détaillée se fait ensuite sur sa fiche."
        breadcrumbs={[{ label: "Réceptionnistes", href: "/admin/receptionnistes" }, { label: "Nouvelle" }]}
      />
      <RedirectForm action={createReceptionist} basePath="/admin/receptionnistes" className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Personnage" description="Avatars LemonSlice déjà existants. Aucun nouvel avatar n’est créé." />
          <CardBody>
            <fieldset>
              <legend className="sr-only">Choisir un avatar</legend>
              <div className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-4">
                {avatars.map((a, i) => (
                  <label
                    key={a.id}
                    className="group relative block cursor-pointer overflow-hidden rounded-2xl border-2 border-line transition-colors has-[:checked]:border-red has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-red/25"
                  >
                    <input type="radio" name="avatarId" value={a.id} defaultChecked={i === 0} className="sr-only" />
                    <Portrait src={a.portraitUrl} name={a.name} className="aspect-[3/4] w-full" sizes="(min-width:1024px) 25vw, 50vw" />
                    <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10 text-white">
                      <span className="block font-head text-[17px] font-semibold">{a.name}</span>
                      <span className="block truncate font-ui text-[11.5px] text-white/70">{a.providerAvatarId}</span>
                    </span>
                  </label>
                ))}
              </div>
              <FieldError name="avatarId" />
            </fieldset>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Paramètres initiaux" />
          <CardBody>
            <FormGrid>
              <TextField label="Nom affiché" name="name" required defaultValue={avatars[0]?.name} hint="Harmonisé avec le personnage (Léa, Maya)." />
              <TextField label="Rôle affiché" name="role" required placeholder="Ex. Réceptionniste de cabinet médical" />
              <SelectField
                label="Entreprise associée"
                name="organizationId"
                defaultValue=""
                options={[{ value: "", label: "Plus tard (non associée)" }, ...free.map((o) => ({ value: o.id, label: o.name }))]}
                hint="Seules les entreprises sans réceptionniste sont proposées."
              />
              <SelectField label="Langue principale" name="primaryLang" defaultValue="fr" options={LANGS.map((l) => ({ value: l, label: LANG_LABELS[l] }))} />
            </FormGrid>
          </CardBody>
        </Card>
        <Notice kind="demo">Enregistrement dans les données locales de démonstration. Aucun appel à LemonSlice ni à LiveKit.</Notice>
        <div className="flex flex-wrap justify-end gap-2">
          <ButtonLink href="/admin/receptionnistes">Annuler</ButtonLink>
          <SubmitButton>Créer en brouillon</SubmitButton>
        </div>
      </RedirectForm>
    </>
  );
}
