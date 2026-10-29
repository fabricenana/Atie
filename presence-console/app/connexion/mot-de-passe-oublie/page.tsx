import Link from "next/link";
import type { Metadata } from "next";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { ForgotPasswordForm } from "@/components/auth/AuthForms";

export const metadata: Metadata = { title: "Mot de passe oublié" };
export const dynamic = "force-dynamic";

export default function ForgotPassword() {
  return (
    <AuthLayout
      title="Mot de passe oublié"
      description="Indiquez l’adresse e-mail de votre compte : vous recevrez un lien pour définir un nouveau mot de passe."
      footer={
        <Link href="/connexion" className="underline underline-offset-2 hover:text-ink">
          Retour à la connexion
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
