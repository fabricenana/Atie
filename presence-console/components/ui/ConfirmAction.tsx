"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "./Button";
import { Modal } from "./Modal";
import { useToast } from "./Toast";

/**
 * Bouton déclenchant une action serveur après confirmation explicite.
 * `payload` est transmis tel quel ; l'action revérifie toujours les droits.
 */
export function ConfirmAction({
  action,
  payload,
  label,
  title,
  description,
  confirmLabel = "Confirmer",
  variant = "secondary",
  confirmVariant = "danger",
  size = "sm",
  icon,
  disabled,
  children,
}: {
  action: (payload: Record<string, string>) => Promise<ActionResult>;
  payload: Record<string, string>;
  label: ReactNode;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger" | "subtle";
  confirmVariant?: "primary" | "danger";
  size?: "sm" | "md";
  icon?: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { notify } = useToast();
  const run = () =>
    start(async () => {
      try {
        const r = await action(payload);
        notify(r.message, r.ok ? "success" : "error");
        if (r.ok) setOpen(false);
      } catch {
        notify("L’action n’a pas pu aboutir. Réessayez.", "error");
      }
    });
  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)} disabled={disabled}>
        {icon}
        {label}
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={title}
        description={description}
        size="sm"
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button variant={confirmVariant} onClick={run} disabled={pending} aria-busy={pending || undefined}>
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              {confirmLabel}
            </Button>
          </>
        }
      >
        {children ?? <p className="text-[14px] text-muted">Cette action sera enregistrée dans le journal d’audit.</p>}
      </Modal>
    </>
  );
}
