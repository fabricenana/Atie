"use client";

import { useState, type ReactNode } from "react";
import { createSupportRequest } from "@/lib/actions/client";
import type { SupportKind } from "@/lib/domain/types";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { Button } from "@/components/ui/Button";
import { TextAreaField, TextField } from "@/components/ui/FormFields";
import { Modal } from "@/components/ui/Modal";

/**
 * Bouton ouvrant un formulaire de demande adressée à ATIE
 * (ex. « Demander une modification » de la réceptionniste).
 */
export function SupportDialog({
  kind,
  buttonLabel,
  title,
  description,
  defaultSubject,
  placeholder,
  icon,
  variant = "primary",
  disabled,
}: {
  kind: SupportKind;
  buttonLabel: string;
  title: string;
  description?: ReactNode;
  defaultSubject: string;
  placeholder?: string;
  icon?: ReactNode;
  variant?: "primary" | "secondary";
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} onClick={() => setOpen(true)} disabled={disabled}>
        {icon}
        {buttonLabel}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description}>
        <ActionForm action={createSupportRequest} onSuccess={() => setOpen(false)} className="flex flex-col gap-5">
          <input type="hidden" name="kind" value={kind} />
          <TextField label="Objet" name="subject" defaultValue={defaultSubject} required maxLength={120} />
          <TextAreaField label="Votre demande" name="message" required rows={5} maxLength={2000} placeholder={placeholder} hint="L’équipe ATIE effectue la modification pour vous et vous tient informé." />
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => setOpen(false)}>Annuler</Button>
            <SubmitButton>Envoyer la demande</SubmitButton>
          </div>
        </ActionForm>
      </Modal>
    </>
  );
}
