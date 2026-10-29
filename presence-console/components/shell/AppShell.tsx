"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Bell, LogOut, Menu as MenuIcon, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { NAV_ICONS } from "./icons";
import type { NavGroup } from "./nav";
import { ThemeToggle } from "./ThemeToggle";

export interface ShellUser {
  name: string;
  email: string;
  roleLabel: string;
  orgName?: string;
}

function isActive(pathname: string, href: string, exact?: boolean, all?: string[]) {
  if (exact) return pathname === href;
  if (pathname !== href && !pathname.startsWith(href + "/")) return false;
  // Le lien le plus spécifique l'emporte (ex. /admin/sessions/actives).
  return !(all ?? []).some((h) => h !== href && h.startsWith(href + "/") && (pathname === h || pathname.startsWith(h + "/")));
}

function Nav({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const all = groups.flatMap((g) => g.items.map((i) => i.href));
  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-6">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label ? <p className="mb-2 px-3 font-ui text-[11px] font-semibold uppercase tracking-[0.12em] text-faint">{g.label}</p> : null}
          <ul className="flex flex-col gap-0.5">
            {g.items.map((it) => {
              const Icon = NAV_ICONS[it.icon];
              const active = isActive(pathname, it.href, it.exact, all);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex h-9 items-center gap-3 rounded-lg px-3 font-ui text-[13.5px] font-medium transition-colors",
                      active ? "bg-accent-soft text-ink" : "text-muted hover:bg-surface-3 hover:text-ink",
                    )}
                  >
                    {active ? <span aria-hidden className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-full bg-red" /> : null}
                    <Icon className={cn("size-[17px] shrink-0", active ? "text-red" : "text-faint group-hover:text-ink")} />
                    <span className="truncate">{it.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function AppShell({
  space,
  groups,
  user,
  notificationsHref,
  unread,
  logout,
  children,
}: {
  space: "admin" | "client";
  groups: NavGroup[];
  user: ShellUser;
  notificationsHref: string;
  unread: number;
  logout: () => Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const drawer = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    drawer.current?.querySelector<HTMLElement>("a,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const brand = (
    <Link href={space === "admin" ? "/admin" : "/client"} className="flex items-center gap-3 rounded-lg">
      <Image src="/logo-atie.png" alt="ATIE" width={36} height={36} className="size-9 rounded-lg object-contain dark:brightness-110" priority />
      <span className="leading-tight">
        <span className="block font-head text-[15px] font-semibold">ATIE Presence</span>
        <span className="block font-ui text-[11.5px] text-faint">{space === "admin" ? "Back-office" : "Espace client"}</span>
      </span>
    </Link>
  );

  const footer = (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="min-w-0 px-1">
        <p className="truncate text-[13.5px] font-medium">{user.name}</p>
        <p className="truncate font-ui text-[12px] text-faint">{user.orgName ? `${user.orgName} · ` : ""}{user.roleLabel}</p>
      </div>
      <div className="flex items-center justify-between gap-2">
        <ThemeToggle />
        <form action={logout}>
          <button type="submit" className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 font-ui text-[12.5px] text-muted hover:bg-surface-3 hover:text-ink">
            <LogOut className="size-3.5" aria-hidden /> Quitter
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      <a href="#contenu" className="sr-only z-[70] rounded-lg bg-surface px-4 py-2 focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Aller au contenu
      </a>

      {/* Barre latérale (grand écran) */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 overflow-y-auto border-r border-line bg-sidebar px-5 py-6 lg:flex">
        {brand}
        <div className="flex-1">
          <Nav groups={groups} />
        </div>
        {footer}
      </aside>

      {/* Tiroir (mobile et tablette) */}
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Fermer le menu" className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div ref={drawer} className="animate-fade-in absolute inset-y-0 left-0 flex w-[min(300px,86vw)] flex-col gap-8 overflow-y-auto border-r border-line bg-sidebar px-5 py-6 shadow-pop">
            <div className="flex items-center justify-between">
              {brand}
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer le menu" className="inline-grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-3">
                <X className="size-[18px]" />
              </button>
            </div>
            <div className="flex-1">
              <Nav groups={groups} onNavigate={() => setOpen(false)} />
            </div>
            {footer}
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-bg/85 px-4 backdrop-blur-md sm:px-6 lg:px-10">
          <button type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu" aria-expanded={open} className="-ml-1 inline-grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-3 lg:hidden">
            <MenuIcon className="size-[18px]" />
          </button>
          <span className="truncate font-head text-[14px] font-semibold lg:hidden">ATIE Presence</span>
          <div className="ml-auto flex items-center gap-2">
            {user.orgName ? <span className="hidden max-w-[220px] truncate rounded-full bg-surface-3 px-3 py-1 font-ui text-[12px] text-muted sm:inline">{user.orgName}</span> : null}
            <Link href={notificationsHref} aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`} className="relative inline-grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink">
              <Bell className="size-[18px]" />
              {unread ? <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-red px-1 font-ui text-[10px] font-semibold leading-4 text-white">{unread}</span> : null}
            </Link>
          </div>
        </header>
        <main id="contenu" tabIndex={-1} className="animate-fade-in mx-auto w-full max-w-[1320px] flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
