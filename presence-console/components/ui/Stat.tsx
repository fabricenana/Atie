import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { OriginTag } from "./Badge";

export function Stat({
  label,
  value,
  hint,
  icon,
  origin = "demo",
  tone,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  origin?: "demo" | "estimated" | "measured" | null;
  tone?: "warning" | "danger";
  className?: string;
}) {
  return (
    <div className={cn("relative flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-5 shadow-card", className)}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-ui text-[12.5px] font-medium text-muted">{label}</span>
        <span className="flex items-center gap-2">
          {origin ? <OriginTag origin={origin} /> : null}
          {icon ? <span className="text-faint [&_svg]:size-4">{icon}</span> : null}
        </span>
      </div>
      <div
        className={cn(
          "tabular mt-3 font-head text-[26px] font-semibold leading-none tracking-tight",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-2 text-[12.5px] text-muted">{hint}</div> : null}
    </div>
  );
}

export function StatGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}
