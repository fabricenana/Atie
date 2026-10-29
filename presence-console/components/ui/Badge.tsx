import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/labels";

const tones: Record<Tone, string> = {
  neutral: "bg-surface-3 text-muted",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-info-soft text-info",
  accent: "bg-accent-soft text-accent-ink",
};

export function Badge({ tone = "neutral", children, dot, className }: { tone?: Tone; children: ReactNode; dot?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 font-ui text-[12px] font-medium",
        tones[tone],
        className,
      )}
    >
      {dot ? <span aria-hidden className="size-1.5 rounded-full bg-current" /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: { label: string; tone: Tone } }) {
  return (
    <Badge tone={status.tone} dot>
      {status.label}
    </Badge>
  );
}

/** Marque une estimation : jamais présentée comme une mesure. Une mesure n'a pas de marque. */
export function OriginTag({ origin }: { origin: "estimated" | "measured" | null | undefined }) {
  if (origin !== "estimated") return null;
  return (
    <span
      title="Estimation, pas une mesure fournisseur"
      className="inline-flex h-5 items-center rounded-md border border-dashed border-line-strong px-1.5 font-ui text-[10.5px] font-medium uppercase tracking-[0.06em] text-faint"
    >
      Estimé
    </span>
  );
}
