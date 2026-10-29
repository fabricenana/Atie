"use client";

import { updateVisitorRequestStatus } from "@/lib/actions/client";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";

const OPTIONS = [
  { value: "new", label: "Nouvelle" },
  { value: "in_progress", label: "En cours" },
  { value: "done", label: "Traitée" },
  { value: "archived", label: "Archivée" },
];

/** Changement de statut d'une demande visiteur (administrateur entreprise). */
export function RequestStatusForm({ id, status, visitor }: { id: string; status: string; visitor: string }) {
  return (
    <ActionForm action={updateVisitorRequestStatus} className="flex items-center gap-1.5">
      <input type="hidden" name="id" value={id} />
      <label className="sr-only" htmlFor={`status-${id}`}>
        Statut de la demande de {visitor}
      </label>
      <select
        id={`status-${id}`}
        name="status"
        defaultValue={status}
        className="h-8 rounded-lg border border-line-strong bg-surface px-2 font-ui text-[12.5px] focus:border-red focus:outline-none focus:ring-3 focus:ring-red/15"
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <SubmitButton size="sm" variant="secondary">
        Appliquer
      </SubmitButton>
    </ActionForm>
  );
}
