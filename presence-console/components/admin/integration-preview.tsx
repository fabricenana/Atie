"use client";

import Image from "next/image";
import { useState } from "react";
import { Laptop, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * Aperçu STATIQUE du widget sur un site : maquette, aucune session, aucun micro, aucune vidéo.
 */
export function IntegrationPreview({
  domain,
  name,
  portrait,
  position,
  accent,
}: {
  domain: string;
  name: string;
  portrait: string | null;
  position: "right" | "left";
  accent: string;
}) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  return (
    <div>
      <div role="radiogroup" aria-label="Appareil de l’aperçu" className="mb-4 inline-flex rounded-lg bg-surface-3 p-0.5">
        {(
          [
            ["desktop", "Ordinateur", Laptop],
            ["mobile", "Mobile", Smartphone],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={device === key}
            onClick={() => setDevice(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-ui text-[12.5px] font-medium transition-colors",
              device === key ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <div className="flex justify-center rounded-xl bg-surface-3 p-4 sm:p-6">
        <div
          className={cn(
            "relative overflow-hidden border border-line-strong bg-white shadow-pop transition-[width] duration-300",
            device === "desktop" ? "aspect-[16/10] w-full max-w-[560px] rounded-lg" : "aspect-[9/17] w-[200px] rounded-[22px]",
          )}
          role="img"
          aria-label={`Maquette du site ${domain} avec la bulle de ${name} en bas à ${position === "right" ? "droite" : "gauche"}`}
        >
          <div className="flex h-6 items-center gap-1.5 border-b border-black/10 bg-[#f4f4f5] px-2.5">
            <span className="size-1.5 rounded-full bg-black/20" />
            <span className="size-1.5 rounded-full bg-black/20" />
            <span className="ml-2 truncate font-ui text-[9px] text-black/45">{domain}</span>
          </div>
          <div className="space-y-2 p-3">
            <div className="h-3 w-2/5 rounded bg-black/10" />
            <div className="h-2 w-4/5 rounded bg-black/[0.06]" />
            <div className="h-2 w-3/5 rounded bg-black/[0.06]" />
            <div className={cn("mt-3 grid gap-2", device === "desktop" ? "grid-cols-3" : "grid-cols-1")}>
              {Array.from({ length: device === "desktop" ? 3 : 2 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-black/[0.05]" />
              ))}
            </div>
          </div>
          <div className={cn("absolute bottom-3 flex items-center gap-2", position === "right" ? "right-3 flex-row-reverse" : "left-3")}>
            <span className="relative block size-11 overflow-hidden rounded-full shadow-lg" style={{ boxShadow: `0 0 0 2px ${accent}` }}>
              {portrait ? <Image src={portrait} alt="" fill sizes="44px" className="object-cover object-[50%_18%]" /> : <span className="block size-full" style={{ background: accent }} />}
            </span>
            <span className="rounded-full bg-white px-2 py-1 font-ui text-[9.5px] font-medium text-black/75 shadow">Parler à {name}</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center font-ui text-[12px] text-faint">Maquette statique : aucune session ni connexion n’est déclenchée.</p>
    </div>
  );
}
