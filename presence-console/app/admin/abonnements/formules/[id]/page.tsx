import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getPlan, listOrganizations, listSubscriptions, quotaForOrg } from "@/lib/repositories";
import { formatDate, formatNumber } from "@/lib/format";
import { PLAN_APPROVAL, SUBSCRIPTION_STATUS } from "@/lib/labels";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlanForm } from "@/components/admin/plans-form";

export const metadata: Metadata = { title: "Formule" };

export default async function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  const v = await requireAdmin();
  const { id } = await params;
  const plan = getPlan(id);
  if (!plan) notFound();
  const readOnly = !can(v.role, "plan.write");
  const orgs = new Map(listOrganizations().map((o) => [o.id, o.name]));
  const subs = listSubscriptions().filter((s) => s.planId === plan.id);
  return (
    <>
      <PageHeader
        title={plan.name}
        description={plan.description}
        breadcrumbs={[{ label: "Abonnements", href: "/admin/abonnements?tab=formules" }, { label: plan.name }]}
        meta={<StatusBadge status={PLAN_APPROVAL[plan.approval]} />}
      />
      {readOnly ? (
        <Notice kind="warning" title="Lecture seule" className="mb-6">
          La modification des formules est réservée au super administrateur ATIE. Le contrôle est également effectué côté serveur.
        </Notice>
      ) : plan.approval !== "confirmed" ? (
        <Notice kind="info" className="mb-6" title="Tarif non confirmé">
          Ce tarif ne doit pas être publié tant qu’il n’est pas validé.
        </Notice>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardBody>
            <PlanForm plan={plan} readOnly={readOnly} />
          </CardBody>
        </Card>
        <Card className="self-start">
          <CardHeader title="Abonnements sur cette formule" description={`${subs.length} entreprise(s)`} />
          <CardBody className="pt-3">
            {subs.length === 0 ? (
              <EmptyState title="Aucun abonnement" />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {subs.map((s) => {
                  const q = quotaForOrg(s.organizationId);
                  return (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-medium">{orgs.get(s.organizationId)}</p>
                        <p className="font-ui text-[12px] text-faint">
                          Depuis le {formatDate(s.activatedAt)} · {formatNumber(q.usedMinutes)} min utilisées
                        </p>
                      </div>
                      <StatusBadge status={SUBSCRIPTION_STATUS[s.status]} />
                    </li>
                  );
                })}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
