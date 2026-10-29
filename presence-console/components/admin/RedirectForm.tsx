"use client";

import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import type { ActionResult } from "@/lib/action-result";
import { ActionForm } from "@/components/ui/ActionForm";

/** Formulaire de création : redirige vers la fiche créée (`${basePath}/${id}`) en cas de succès. */
export function RedirectForm({
  action,
  basePath,
  children,
  className,
}: {
  action: (prev: ActionResult, data: FormData) => Promise<ActionResult & { id?: string }>;
  basePath: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <ActionForm
      action={action}
      className={className}
      onSuccess={(r) => {
        const id = (r as ActionResult & { id?: string }).id;
        if (id) router.push(`${basePath}/${id}`);
      }}
    >
      {children}
    </ActionForm>
  );
}
