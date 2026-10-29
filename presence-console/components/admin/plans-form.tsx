"use client";

import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/domain/types";
import { savePlan } from "@/lib/actions/plans";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { ButtonLink } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { SelectField, TextAreaField, TextField } from "@/components/ui/FormFields";

/** Formulaire de formule (création ou modification). En lecture seule sans la permission plan.write. */
export function PlanForm({ plan, readOnly }: { plan?: Plan; readOnly: boolean }) {
  const router = useRouter();
  return (
    <ActionForm action={savePlan} onSuccess={() => !plan && router.push("/admin/abonnements?tab=formules")}>
      {plan ? <input type="hidden" name="id" value={plan.id} /> : null}
      <fieldset disabled={readOnly} className="grid gap-5 sm:grid-cols-2">
        <legend className="sr-only">Paramètres de la formule</legend>
        <TextField label="Nom" name="name" required defaultValue={plan?.name} maxLength={40} />
        <TextField label="Code" name="code" required defaultValue={plan?.code} hint="Identifiant unique : minuscules, chiffres, tirets." maxLength={30} />
        <TextField
          label="Prix mensuel (CHF)"
          name="price"
          required
          inputMode="decimal"
          defaultValue={plan ? (plan.monthlyPriceCents / 100).toFixed(2) : ""}
          placeholder="89.00"
          hint="Facturation mensuelle, sans frais d’installation."
        />
        <TextField label="Minutes incluses" name="includedMinutes" type="number" min={0} required defaultValue={plan?.includedMinutes} />
        <TextField label="Conversations simultanées incluses" name="concurrentSessions" type="number" min={1} max={50} required defaultValue={plan?.concurrentSessions ?? 1} />
        <SelectField
          label="Statut d’approbation"
          name="approval"
          defaultValue={plan?.approval ?? "draft"}
          options={[
            { value: "confirmed", label: "Tarif confirmé" },
            { value: "hypothesis", label: "Hypothèse à valider" },
            { value: "draft", label: "Interne — non publié" },
          ]}
          hint="Seuls les tarifs confirmés peuvent être communiqués."
        />
        <TextAreaField label="Description interne" name="description" defaultValue={plan?.description} maxLength={200} className="sm:col-span-2" />
        <Checkbox name="active" label="Formule active" description="Une formule inactive ne peut plus être attribuée ; les abonnements existants sont conservés." defaultChecked={plan?.active ?? true} />
      </fieldset>
      <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-line pt-5">
        <ButtonLink href="/admin/abonnements?tab=formules">{readOnly ? "Retour" : "Annuler"}</ButtonLink>
        {readOnly ? null : <SubmitButton>{plan ? "Enregistrer la formule" : "Créer la formule"}</SubmitButton>}
      </div>
    </ActionForm>
  );
}
