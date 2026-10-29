import Link from "next/link";
import { cn } from "@/lib/cn";
import { PERIODS, type Period } from "@/lib/metrics";

/** Filtre de période (état dans l'URL). */
export function PeriodFilter({ current, basePath, extra }: { current: Period; basePath: string; extra?: Record<string, string> }) {
  return (
    <div role="group" aria-label="Période" className="inline-flex rounded-lg bg-surface-3 p-0.5">
      {PERIODS.map((p) => {
        const qs = new URLSearchParams({ ...extra, period: p.key }).toString();
        const active = p.key === current;
        return (
          <Link
            key={p.key}
            href={`${basePath}?${qs}`}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className={cn("rounded-md px-3 py-1.5 font-ui text-[12.5px] font-medium transition-colors", active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink")}
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}
