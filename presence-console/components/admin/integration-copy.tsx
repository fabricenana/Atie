"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

/** Bloc de code avec bouton « Copier ». */
export function IntegrationCode({ code, label }: { code: string; label: string }) {
  const [done, setDone] = useState(false);
  const { notify } = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setDone(true);
      notify("Code copié dans le presse-papiers.");
      setTimeout(() => setDone(false), 2000);
    } catch {
      notify("Copie impossible : sélectionnez le code manuellement.", "error");
    }
  };
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-2">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2">
        <span className="font-ui text-[12px] font-medium text-muted">{label}</span>
        <Button size="sm" variant="ghost" onClick={copy} aria-label={`Copier : ${label}`}>
          {done ? <Check aria-hidden /> : <Copy aria-hidden />}
          {done ? "Copié" : "Copier"}
        </Button>
      </div>
      <pre className="relative overflow-x-auto px-4 py-3 font-mono text-[12.5px] leading-relaxed text-ink" tabIndex={0} aria-label={label}>
        <code>{code}</code>
      </pre>
    </div>
  );
}
