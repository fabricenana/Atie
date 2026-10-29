import { Mic, X } from "lucide-react";
import { Portrait } from "@/components/ui/Portrait";

/**
 * Maquette statique du widget tel qu'il apparaît sur le site du client.
 * Aucune session, aucun micro, aucun appel réseau, aucune vidéo.
 */
export function WidgetPreview({ name, role, portraitUrl, greeting, langs }: { name: string; role: string; portraitUrl: string | null; greeting: string; langs: string[] }) {
  return (
    <div aria-label={`Aperçu statique du widget de ${name}`} role="img" className="relative overflow-hidden rounded-2xl border border-line bg-[linear-gradient(160deg,var(--surface-2),var(--surface-3))] p-4 sm:p-6">
      {/* Fausse page du site client */}
      <div aria-hidden className="mb-24 flex flex-col gap-2 opacity-60 sm:mb-6 sm:max-w-[45%]">
        <div className="h-3 w-24 rounded bg-line-strong" />
        <div className="h-2 w-full rounded bg-line" />
        <div className="h-2 w-5/6 rounded bg-line" />
        <div className="h-2 w-2/3 rounded bg-line" />
      </div>
      {/* Panneau ouvert */}
      <div aria-hidden className="ml-auto w-full max-w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-[#141416] text-white shadow-pop">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-[14px] font-semibold">{name}</p>
            <p className="truncate font-ui text-[11.5px] text-white/60">{role}</p>
          </div>
          <X className="size-4 text-white/50" />
        </div>
        <Portrait src={portraitUrl} name={name} className="aspect-[4/3] w-full" sizes="300px" />
        <div className="flex flex-col gap-3 px-4 py-4">
          <p className="rounded-xl bg-white/8 px-3 py-2 text-[12.5px] leading-snug text-white/85">« {greeting} »</p>
          <div className="flex gap-1">
            {langs.map((l) => (
              <span key={l} className="rounded-full bg-white/12 px-2 py-0.5 font-ui text-[10.5px] font-semibold tracking-wide">
                {l}
              </span>
            ))}
          </div>
          <span className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#e31e24]/45 font-ui text-[13px] font-semibold text-white/70">
            <Mic className="size-3.5" /> Démarrer la conversation
          </span>
        </div>
      </div>
      {/* Bulle */}
      <div aria-hidden className="absolute bottom-4 left-4 flex items-center gap-2 sm:hidden">
        <span className="relative size-12 overflow-hidden rounded-full border-2 border-white shadow-pop">
          <Portrait src={portraitUrl} name={name} className="size-full" sizes="48px" />
        </span>
        <span className="rounded-full bg-surface px-3 py-1 font-ui text-[11.5px] text-muted shadow-card">Bulle sur le site</span>
      </div>
    </div>
  );
}
