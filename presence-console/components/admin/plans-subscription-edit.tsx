"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { updateSubscription } from "@/lib/actions/plans";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Field";
import { SelectField, TextField } from "@/components/ui/FormFields";
import { Modal } from "@/components/ui/Modal";

/** Modification d'un abonnement (formule, seuil d'alerte, renouvellement) — démo locale. */
export function SubscriptionEditButton({
  subscriptionId,
  orgName,
  planId,
  alertThresholdPct,
  autoRenew,
  plans,
}: {
  subscriptionId: string;
  orgName: string;
  planId: string;
  alertThresholdPct: number;
  autoRenew: boolean;
  plans: Array<{ value: string; label: string; disabled?: boolean }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`Modifier l’abonnement de ${orgName}`}>
        <Pencil aria-hidden /> Modifier
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Modifier l’abonnement" description={orgName}>
        <ActionForm action={updateSubscription} onSuccess={() => setOpen(false)} className="flex flex-col gap-5">
          <input type="hidden" name="subscriptionId" value={subscriptionId} />
          <SelectField label="Formule" name="planId" defaultValue={planId} options={plans} required hint="Le changement est appliqué localement, sans facturation." />
          <TextField label="Seuil d’alerte (%)" name="alertThresholdPct" type="number" min={50} max={100} defaultValue={alertThresholdPct} required />
          <Checkbox name="autoRenew" label="Renouvellement automatique" description="Reconduction mensuelle à l’échéance." defaultChecked={autoRenew} />
          <div className="flex justify-end gap-2 border-t border-line pt-4">
            <Button onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton>Enregistrer</SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
