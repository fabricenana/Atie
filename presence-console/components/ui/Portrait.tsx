import Image from "next/image";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/cn";

/** Portrait autorisé (visuels du site ATIE) — jamais de vidéo ni de session dans la console. */
export function Portrait({ src, name, className, sizes = "160px" }: { src: string | null; name: string; className?: string; sizes?: string }) {
  return (
    <div className={cn(/\b(absolute|fixed)\b/.test(className ?? "") ? "" : "relative", "overflow-hidden bg-surface-3", className)}>
      {src ? (
        <Image src={src} alt={`Portrait de ${name}`} fill sizes={sizes} className="object-cover object-[50%_18%]" />
      ) : (
        <div className="grid size-full place-items-center text-faint">
          <UserRound className="size-1/3" aria-hidden />
          <span className="sr-only">Aucun portrait pour {name}</span>
        </div>
      )}
    </div>
  );
}
