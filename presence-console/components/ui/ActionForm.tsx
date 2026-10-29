"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import type { ActionResult } from "@/lib/action-result";
import { idle } from "@/lib/action-result";
import { Button } from "./Button";
import { useToast } from "./Toast";

const ErrorsCtx = createContext<Record<string, string>>({});
/** Erreur de validation d'un champ, renvoyée par l'action serveur. */
export function useFieldError(name: string) {
  return useContext(ErrorsCtx)[name];
}

/**
 * Formulaire relié à une action serveur : état de chargement, erreurs par champ,
 * notification de succès ou d'échec.
 */
export function ActionForm({
  action,
  children,
  onSuccess,
  resetOnSuccess,
  className,
}: {
  action: (prev: ActionResult, data: FormData) => Promise<ActionResult>;
  children: ReactNode;
  onSuccess?: (r: ActionResult) => void;
  resetOnSuccess?: boolean;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, idle);
  const { notify } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const last = useRef<ActionResult>(idle);
  useEffect(() => {
    if (state === last.current || !state.message) return;
    last.current = state;
    notify(state.message, state.ok ? "success" : "error");
    if (state.ok) {
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.(state);
    }
  }, [state, notify, onSuccess, resetOnSuccess]);
  return (
    <ErrorsCtx.Provider value={state.errors ?? {}}>
      <form ref={formRef} action={formAction} className={className} noValidate>
        {children}
      </form>
    </ErrorsCtx.Provider>
  );
}

export function SubmitButton({ children, variant = "primary", size, className, disabled }: { children: ReactNode; variant?: "primary" | "secondary" | "danger"; size?: "sm" | "md"; className?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size={size} className={className} disabled={pending || disabled} aria-busy={pending || undefined}>
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
      {children}
    </Button>
  );
}
