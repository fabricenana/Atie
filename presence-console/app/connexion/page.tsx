import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth/session";
import { isAtieRole } from "@/lib/auth/permissions";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { LoginForm } from "@/components/auth/AuthForms";
import { Notice } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Connexion" };
export const dynamic = "force-dynamic";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ expired?: string; password?: string }> }) {
  const sp = await searchParams;
  const viewer = await getViewer().catch(() => null);
  if (viewer) redirect(isAtieRole(viewer.role) ? "/admin" : "/client");

  return (
    <AuthLayout
      title="Connexion"
      description="Accès réservé au personnel ATIE et aux entreprises clientes."
      footer="Pas encore de compte ? Les accès sont créés par ATIE : contactez votre interlocuteur."
    >
      <div className="flex flex-col gap-4">
        {sp.expired ? <Notice kind="warning" title="Session expirée">Reconnectez-vous pour continuer.</Notice> : null}
        {sp.password ? <Notice kind="info" title="Mot de passe enregistré">Vous pouvez maintenant vous connecter.</Notice> : null}
        <LoginForm />
      </div>
    </AuthLayout>
  );
}
