import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  title,
  description,
  actions,
  breadcrumbs,
  meta,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  meta?: ReactNode;
}) {
  return (
    <header className="mb-6 sm:mb-8">
      {breadcrumbs?.length ? (
        <nav aria-label="Fil d’Ariane" className="mb-3">
          <ol className="flex flex-wrap items-center gap-1 font-ui text-[12.5px] text-faint">
            {breadcrumbs.map((b, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 ? <ChevronRight aria-hidden className="size-3.5" /> : null}
                {b.href ? (
                  <Link href={b.href} className="rounded hover:text-ink">
                    {b.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="text-muted">
                    {b.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-[26px] font-semibold sm:text-[30px]">{title}</h1>
          {description ? <p className="mt-2 text-[14.5px] text-muted">{description}</p> : null}
          {meta ? <div className="mt-3 flex flex-wrap items-center gap-2">{meta}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
