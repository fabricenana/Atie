"use client";

import { useTransition, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/** Bouton déclenchant directement une action serveur non destructive. */
export function InlineAction({
  action,
  payload,
  children,
  variant = "ghost",
  size = "sm",
  label,
}: {
  action: (payload: Record<string, string>) => Promise<ActionResult>;
  payload: Record<string, string>;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "subtle";
  size?: "sm" | "md";
  label?: string;
}) {
  const [pending, start] = useTransition();
  const { notify } = useToast();
  return (
    <Button
      variant={variant}
      size={size}
      aria-label={label}
      disabled={pending}
      aria-busy={pending || undefined}
      onClick={() =>
        start(async () => {
          try {
            const r = await action(payload);
            notify(r.message, r.ok ? "success" : "error");
          } catch {
            notify("L’action n’a pas pu aboutir. Réessayez.", "error");
          }
        })
      }
    >
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
