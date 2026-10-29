"use client";

import { Button } from "@/components/ui/Button";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="grid min-h-[50dvh] place-items-center px-6 text-center">
      <div>
        <p className="font-ui text-[12px] font-semibold uppercase tracking-[0.2em] text-red">Erreur</p>
        <h1 className="mt-3 text-[24px] font-semibold">Un problème est survenu</h1>
        <p className="mt-2 text-muted">La page n’a pas pu être affichée. Aucune donnée n’a été modifiée.</p>
        <div className="mt-6">
          <Button variant="primary" onClick={reset}>Réessayer</Button>
        </div>
      </div>
    </div>
  );
}
