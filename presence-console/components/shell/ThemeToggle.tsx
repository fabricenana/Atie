"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";

type Mode = "system" | "light" | "dark";

export function applyTheme(mode: Mode) {
  const el = document.documentElement;
  if (mode === "system") delete el.dataset.theme;
  else el.dataset.theme = mode;
  try {
    if (mode === "system") localStorage.removeItem("atie-theme");
    else localStorage.setItem("atie-theme", mode);
  } catch {}
}

export function useThemeMode(): [Mode, (m: Mode) => void] {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    const t = document.documentElement.dataset.theme;
    setMode(t === "light" || t === "dark" ? t : "system");
  }, []);
  return [mode, (m) => { applyTheme(m); setMode(m); }];
}

/** Sélecteur clair / sombre / système (segmenté, radio accessible). */
export function ThemeToggle({ className }: { className?: string }) {
  const [mode, setMode] = useThemeMode();
  const opts: Array<{ v: Mode; label: string; Icon: typeof Sun }> = [
    { v: "light", label: "Thème clair", Icon: Sun },
    { v: "system", label: "Thème du système", Icon: Monitor },
    { v: "dark", label: "Thème sombre", Icon: Moon },
  ];
  return (
    <div role="radiogroup" aria-label="Thème" className={cn("inline-flex rounded-lg bg-surface-3 p-0.5", className)}>
      {opts.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={mode === v}
          aria-label={label}
          title={label}
          onClick={() => setMode(v)}
          className={cn("inline-grid size-7 place-items-center rounded-md transition-colors", mode === v ? "bg-surface text-ink shadow-card" : "text-faint hover:text-ink")}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}
