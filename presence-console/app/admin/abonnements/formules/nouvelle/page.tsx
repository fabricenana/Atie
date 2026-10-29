import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody } from "@/components/ui/Card";
import { Notice } from "@/components/ui/Notice";
import { PlanForm } from "@/components/admin/plans-form";

export const metadata: Metadata = { title: "Nouvelle formule" };

export default async function NewPlanPage() {
  const v = await requireAdmin();
  const readOnly = !can(v.role, "plan.write");
  return (
    <>
      <PageHeader
        title="Nouvelle formule"
        description="Les nouvelles formules sont internes tant que leur tarif n’est pas confirmé."
        breadcrumbs={[{ label: "Abonnements", href: "/admin/abonnements?tab=formules" }, { label: "Nouvelle formule" }]}
      />
      {readOnly ? (
        <Notice kind="warning" title="Lecture seule" className="mb-6">
          La création de formules est réservée au super administrateur ATIE. Le contrôle est également effectué côté serveur.
        </Notice>
      ) : null}
      <Card className="max-w-3xl">
        <CardBody>
          <PlanForm readOnly={readOnly} />
        </CardBody>
      </Card>
    </>
  );
}
