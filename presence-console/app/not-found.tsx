import { ButtonLink } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-6 text-center">
      <div>
        <p className="font-ui text-[12px] font-semibold uppercase tracking-[0.2em] text-red">Erreur 404</p>
        <h1 className="mt-3 text-[28px] font-semibold">Page introuvable</h1>
        <p className="mt-2 text-muted">Cette page n’existe pas, ou vous n’y avez pas accès.</p>
        <div className="mt-6">
          <ButtonLink href="/" variant="primary">Revenir à l’accueil</ButtonLink>
        </div>
      </div>
    </div>
  );
}
