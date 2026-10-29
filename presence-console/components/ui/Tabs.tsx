import Link from "next/link";
import { cn } from "@/lib/cn";

/** Onglets en liens (état dans l'URL : partageable, navigable au clavier, sans JS). */
export function Tabs({ tabs, current, label }: { tabs: Array<{ key: string; label: string; href: string; count?: number }>; current: string; label: string }) {
  return (
    <nav aria-label={label} className="relative -mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1 border-b border-line">
        {tabs.map((t) => {
          const active = t.key === current;
          return (
            <li key={t.key}>
              <Link
                href={t.href}
                scroll={false}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-10 items-center gap-2 rounded-t-md px-3 font-ui text-[13.5px] font-medium transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {t.label}
                {t.count !== undefined ? (
                  <span className={cn("tabular rounded-full px-1.5 text-[11px]", active ? "bg-accent-soft text-accent-ink" : "bg-surface-3 text-faint")}>{t.count}</span>
                ) : null}
                {active ? <span aria-hidden className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-red" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
