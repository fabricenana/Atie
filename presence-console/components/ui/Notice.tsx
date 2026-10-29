import type { ReactNode } from "react";
import { AlertTriangle, FlaskConical, Info, PlugZap, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";

type Kind = "info" | "warning" | "danger" | "demo" | "not_connected" | "privacy";

const styles: Record<Kind, { cls: string; icon: ReactNode }> = {
  info: { cls: "border-info/25 bg-info-soft", icon: <Info className="text-info" /> },
  warning: { cls: "border-warning/30 bg-warning-soft", icon: <AlertTriangle className="text-warning" /> },
  danger: { cls: "border-danger/30 bg-danger-soft", icon: <AlertTriangle className="text-danger" /> },
  demo: { cls: "border-dashed border-line-strong bg-surface-2", icon: <FlaskConical className="text-muted" /> },
  not_connected: { cls: "border-dashed border-line-strong bg-surface-2", icon: <PlugZap className="text-muted" /> },
  privacy: { cls: "border-success/25 bg-success-soft", icon: <ShieldCheck className="text-success" /> },
};

export function Notice({ kind = "info", title, children, className }: { kind?: Kind; title?: ReactNode; children?: ReactNode; className?: string }) {
  const s = styles[kind];
  return (
    <div role={kind === "danger" ? "alert" : "note"} className={cn("flex gap-3 rounded-xl border px-4 py-3 text-[13.5px]", s.cls, className)}>
      <span aria-hidden className="mt-0.5 shrink-0 [&_svg]:size-4">{s.icon}</span>
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={cn("text-muted", Boolean(title) && "mt-0.5")}>{children}</div> : null}
      </div>
    </div>
  );
}

/** Fonction dépendant d'un service non encore branché. */
export function NotConnected({ what, children }: { what: string; children?: ReactNode }) {
  return (
    <Notice kind="not_connected" title={`${what} : non connecté`}>
      {children ?? "Cette fonction nécessite le backend commercial ou un fournisseur externe. Elle est affichée à titre de préparation et n’est pas opérationnelle."}
    </Notice>
  );
}
