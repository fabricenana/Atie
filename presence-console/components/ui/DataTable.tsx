"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "./EmptyState";

export interface Column {
  key: string;
  label: string;
  sortable?: boolean;
  align?: "left" | "right";
  /** Masque la colonne sous ce point de rupture (le contenu reste dans la fiche détaillée). */
  hideBelow?: "sm" | "md" | "lg" | "xl" | "2xl";
  className?: string;
}

export interface Row {
  id: string;
  /** Ligne cliquable : ouvre ce lien (le premier lien de la ligne reste accessible au clavier). */
  href?: string;
  cells: Record<string, ReactNode>;
  sort?: Record<string, string | number>;
  /** Texte indexé par la recherche. */
  search?: string;
  filters?: Record<string, string>;
}

export interface Filter {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

const hide: Record<NonNullable<Column["hideBelow"]>, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
  "2xl": "hidden 2xl:table-cell",
};

/**
 * Tableau : recherche, filtres, tri, pagination, défilement horizontal maîtrisé.
 * Les cellules sont rendues côté serveur ; seule l'organisation est gérée ici.
 */
export function DataTable({
  columns,
  rows,
  filters = [],
  searchPlaceholder = "Rechercher…",
  pageSize = 10,
  defaultSort,
  emptyTitle = "Aucun résultat",
  emptyDescription,
  toolbar,
  caption,
}: {
  columns: Column[];
  rows: Row[];
  filters?: Filter[];
  searchPlaceholder?: string;
  pageSize?: number;
  defaultSort?: { key: string; dir: "asc" | "desc" };
  emptyTitle?: string;
  emptyDescription?: ReactNode;
  toolbar?: ReactNode;
  caption: string;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(defaultSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLocaleLowerCase("fr");
    let out = rows.filter(
      (r) =>
        (!needle || (r.search ?? "").toLocaleLowerCase("fr").includes(needle)) &&
        Object.entries(active).every(([k, v]) => !v || r.filters?.[k] === v),
    );
    if (sort) {
      const dir = sort.dir === "asc" ? 1 : -1;
      out = [...out].sort((a, b) => {
        const x = a.sort?.[sort.key] ?? "";
        const y = b.sort?.[sort.key] ?? "";
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y), "fr")) * dir;
      });
    }
    return out;
  }, [rows, q, active, sort]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);
  const hasFilters = q || Object.values(active).some(Boolean);

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  };

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:px-5">
        <label className="relative min-w-0 flex-1 sm:max-w-xs">
          <span className="sr-only">Rechercher</span>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder={searchPlaceholder}
            className="h-9 w-full rounded-lg border border-line-strong bg-surface pl-9 pr-3 text-[13.5px] placeholder:text-faint focus:border-red focus:outline-none focus:ring-3 focus:ring-red/15"
          />
        </label>
        {filters.length ? (
          <div className="flex flex-wrap items-center gap-2">
            {filters.map((f) => (
              <label key={f.key} className="relative">
                <span className="sr-only">{f.label}</span>
                <select
                  value={active[f.key] ?? ""}
                  onChange={(e) => {
                    setActive((a) => ({ ...a, [f.key]: e.target.value }));
                    setPage(0);
                  }}
                  className={cn(
                    "h-9 rounded-lg border bg-surface px-3 pr-8 font-ui text-[13px] focus:border-red focus:outline-none focus:ring-3 focus:ring-red/15",
                    active[f.key] ? "border-red/50 text-ink" : "border-line-strong text-muted",
                  )}
                >
                  <option value="">{f.label} : tous</option>
                  {f.options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setQ("");
                  setActive({});
                  setPage(0);
                }}
                className="inline-flex h-9 items-center gap-1 rounded-lg px-2.5 font-ui text-[13px] text-muted hover:bg-surface-3 hover:text-ink"
              >
                <X className="size-3.5" aria-hidden /> Réinitialiser
              </button>
            ) : null}
          </div>
        ) : null}
        {toolbar ? <div className="flex items-center gap-2 sm:ml-auto">{toolbar}</div> : null}
      </div>

      {visible.length === 0 ? (
        <EmptyState title={emptyTitle} description={hasFilters ? "Aucun élément ne correspond à la recherche ou aux filtres." : emptyDescription} />
      ) : (
        <div className="relative overflow-x-auto" tabIndex={0} role="region" aria-label={`${caption} (défilement horizontal possible)`}>
          <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-line">
                {columns.map((c) => {
                  const sorted = sort?.key === c.key ? sort.dir : null;
                  return (
                    <th
                      key={c.key}
                      scope="col"
                      aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}
                      className={cn(
                        "whitespace-nowrap px-4 py-2.5 font-ui text-[12px] font-medium uppercase tracking-[0.05em] text-faint first:pl-5 last:pr-5",
                        c.align === "right" && "text-right",
                        c.hideBelow && hide[c.hideBelow],
                        c.className,
                      )}
                    >
                      {c.sortable ? (
                        <button type="button" onClick={() => toggleSort(c.key)} className={cn("-mx-1 inline-flex items-center gap-1 rounded px-1 hover:text-ink", sorted && "text-ink")}>
                          {c.label}
                          {sorted === "asc" ? <ArrowUp className="size-3" aria-hidden /> : sorted === "desc" ? <ArrowDown className="size-3" aria-hidden /> : <ChevronsUpDown className="size-3 opacity-50" aria-hidden />}
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr
                  key={r.id}
                  onClick={(e) => {
                    if (!r.href) return;
                    if ((e.target as HTMLElement).closest("a,button,input,select,[role=menu]")) return;
                    router.push(r.href);
                  }}
                  className={cn("border-b border-line transition-colors last:border-0", r.href && "cursor-pointer hover:bg-surface-2")}
                >
                  {columns.map((c, i) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-4 py-3 align-middle first:pl-5 last:pr-5",
                        c.align === "right" && "tabular text-right",
                        c.hideBelow && hide[c.hideBelow],
                        c.className,
                      )}
                    >
                      {i === 0 && r.href ? (
                        <Link href={r.href} className="font-medium text-ink hover:text-accent-ink">
                          {r.cells[c.key]}
                        </Link>
                      ) : (
                        r.cells[c.key]
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-3 font-ui text-[12.5px] text-muted sm:px-5">
        <span className="tabular" aria-live="polite">
          {filtered.length === 0
            ? "0 élément"
            : `${current * pageSize + 1}–${Math.min(filtered.length, (current + 1) * pageSize)} sur ${filtered.length}`}
        </span>
        {pages > 1 ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage(current - 1)}
              disabled={current === 0}
              aria-label="Page précédente"
              className="inline-grid size-8 place-items-center rounded-lg hover:bg-surface-3 disabled:opacity-35"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="tabular px-2">
              Page {current + 1} / {pages}
            </span>
            <button
              type="button"
              onClick={() => setPage(current + 1)}
              disabled={current >= pages - 1}
              aria-label="Page suivante"
              className="inline-grid size-8 place-items-center rounded-lg hover:bg-surface-3 disabled:opacity-35"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
