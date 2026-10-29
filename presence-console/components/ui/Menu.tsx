"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export interface MenuItem {
  label: string;
  href?: string;
  onSelect?: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  hint?: string;
}

/** Menu contextuel accessible (flèches, Échap, clic extérieur). */
export function Menu({ items, label = "Actions", trigger, align = "end" }: { items: MenuItem[]; label?: string; trigger?: ReactNode; align?: "start" | "end" }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    root.current?.querySelector<HTMLElement>("[role=menuitem]:not([aria-disabled=true])")?.focus();
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const onKey = (e: React.KeyboardEvent) => {
    const els = [...(root.current?.querySelectorAll<HTMLElement>("[role=menuitem]:not([aria-disabled=true])") ?? [])];
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === "Escape") {
      setOpen(false);
      btn.current?.focus();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      els[(i + 1) % els.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      els[(i - 1 + els.length) % els.length]?.focus();
    } else if (e.key === "Tab") setOpen(false);
  };
  const itemCls = (it: MenuItem) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] outline-none [&_svg]:size-4 [&_svg]:text-faint",
      it.disabled ? "cursor-not-allowed opacity-45" : "hover:bg-surface-3 focus:bg-surface-3",
      it.danger && !it.disabled && "text-danger [&_svg]:text-danger",
    );
  return (
    <div ref={root} className="relative inline-block" onKeyDown={onKey}>
      <button
        ref={btn}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={trigger ? undefined : label}
        onClick={() => setOpen((o) => !o)}
        className={cn(!trigger && "inline-grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink")}
      >
        {trigger ?? <MoreHorizontal className="size-4" />}
      </button>
      {open ? (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className={cn(
            "animate-pop absolute z-40 mt-1 min-w-52 rounded-xl border border-line bg-surface p-1 shadow-pop",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {items.map((it, i) =>
            it.href && !it.disabled ? (
              <Link key={i} role="menuitem" href={it.href} className={itemCls(it)} onClick={() => setOpen(false)}>
                {it.icon}
                {it.label}
              </Link>
            ) : (
              <button
                key={i}
                type="button"
                role="menuitem"
                aria-disabled={it.disabled || undefined}
                title={it.hint}
                className={itemCls(it)}
                onClick={() => {
                  if (it.disabled) return;
                  setOpen(false);
                  it.onSelect?.();
                }}
              >
                {it.icon}
                <span className="min-w-0 flex-1">{it.label}</span>
              </button>
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
