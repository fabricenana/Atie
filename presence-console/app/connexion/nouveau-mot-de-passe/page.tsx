import Link from "next/link";
import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { NewPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Nouveau mot de passe" };
export const dynamic = "force-dynamic";

/**
 * Retour du lien e-mail (réinitialisation ou invitation). Le jeton n'est échangé qu'à
 * l'envoi du formulaire, jamais à l'ouverture de la page (les antivirus de messagerie
 * ouvrent les liens et consommeraient un jeton à usage unique).
 */
export default async function NewPassword({ searchParams }: { searchParams: Promise<{ token_hash?: string; type?: string }> }) {
  const sp = await searchParams;
  const tokenHash = typeof sp.token_hash === "string" && /^[A-Za-z0-9_-]{8,512}$/.test(sp.token_hash) ? sp.token_hash : undefined;
  const type = sp.type === "invite" ? "invite" : "recovery";
  return (
    <AuthLayout
      title="Définir votre mot de passe"
      description="Choisissez le mot de passe de votre compte ATIE Presence."
      footer={
        <Link href="/connexion" className="underline underline-offset-2 hover:text-ink">
          Retour à la connexion
        </Link>
      }
    >
      <NewPasswordForm tokenHash={tokenHash} type={type} />
    </AuthLayout>
  );
}
