import { Mic, X } from "lucide-react";
import { Portrait } from "@/components/ui/Portrait";
import type { Lang } from "@/lib/domain/types";
import { LANG_SHORT } from "@/lib/format";

/**
 * Maquette STATIQUE du widget ATIE Presence (bulle + panneau ouvert).
 * Aucun script widget chargé, aucun micro, aucune session : rien n'est facturé.
 */
export function WidgetPreview({
  name,
  role,
  portraitUrl,
  greeting,
  langs,
  accent = "#E31E24",
}: {
  name: string;
  role: string;
  portraitUrl: string | null;
  greeting: string;
  langs: Lang[];
  accent?: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-[linear-gradient(160deg,var(--surface-2),var(--surface-3))] p-4 sm:p-6">
      <p className="mb-4 font-ui text-[11.5px] font-medium uppercase tracking-[0.08em] text-faint">Aperçu statique · non connecté</p>
      <div className="mx-auto w-full max-w-[300px] overflow-hidden rounded-2xl border border-white/10 bg-[#141416] text-white shadow-pop">
        <div className="relative aspect-[4/5]">
          <Portrait src={portraitUrl} name={name} className="absolute inset-0" sizes="300px" />
          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3">
            <span className="rounded-full bg-black/55 px-2.5 py-1 font-ui text-[11px] font-medium backdrop-blur">IA · {name}</span>
            <span aria-hidden className="grid size-7 place-items-center rounded-full bg-black/55 backdrop-blur">
              <X className="size-3.5" />
            </span>
          </div>
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 pt-12">
            <p className="font-head text-[17px] font-semibold">{name}</p>
            <p className="font-ui text-[12px] text-white/70">{role}</p>
            <p className="mt-2 line-clamp-3 text-[12.5px] leading-snug text-white/85">« {greeting} »</p>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 p-3">
          <div className="flex flex-wrap gap-1">
            {langs.map((l) => (
              <span key={l} className="rounded-full bg-white/10 px-2 py-0.5 font-ui text-[10.5px] font-semibold tracking-[0.06em]">
                {LANG_SHORT[l]}
              </span>
            ))}
          </div>
          <button
            type="button"
            disabled
            aria-describedby="widget-preview-note"
            className="inline-flex h-10 cursor-not-allowed items-center justify-center gap-2 rounded-xl font-ui text-[13.5px] font-semibold text-white opacity-60"
            style={{ background: accent }}
          >
            <Mic className="size-4" aria-hidden /> Démarrer la conversation
          </button>
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <span aria-hidden className="relative block size-14 overflow-hidden rounded-full border-2 shadow-pop" style={{ borderColor: accent }}>
          <Portrait src={portraitUrl} name={name} className="absolute inset-0" sizes="56px" />
        </span>
      </div>
      <p id="widget-preview-note" className="mt-3 text-[12.5px] text-muted">
        Bouton désactivé : l’aperçu ne déclenche aucune session LiveKit ni LemonSlice, donc aucun coût.
      </p>
    </div>
  );
}
