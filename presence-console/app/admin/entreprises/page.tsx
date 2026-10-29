import type { Metadata } from "next";
import { Building2, Clock3, FileClock, Layers, Pencil, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listOrganizationRows, listPlans } from "@/lib/repositories";
import { ORG_STATUS } from "@/lib/labels";
import { formatDate, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DataTable, type Column, type Row } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Menu } from "@/components/ui/Menu";
import { Meter } from "@/components/ui/Charts";

export const metadata: Metadata = { title: "Entreprises" };

export default async function OrganizationsPage() {
  const v = await requireAdmin("org.read_all");
  const [rows, plans] = await Promise.all([listOrganizationRows(), listPlans()]);
  const canWrite = can(v.role, "org.write");

  const columns: Column[] = [
    { key: "name", label: "Entreprise", sortable: true, className: "min-w-[190px]" },
    { key: "sector", label: "Secteur", sortable: true, hideBelow: "xl" },
    { key: "contact", label: "Responsable", sortable: true, hideBelow: "2xl" },
    { key: "domain", label: "Domaine", hideBelow: "2xl" },
    { key: "receptionist", label: "Réceptionniste", sortable: true, hideBelow: "md" },
    { key: "plan", label: "Abonnement", sortable: true },
    { key: "minutes", label: "Minutes utilisées", sortable: true, align: "right" },
    { key: "status", label: "État", sortable: true },
    { key: "activated", label: "Activation", sortable: true, hideBelow: "lg" },
    { key: "actions", label: "", className: "w-12" },
  ];

  const data: Row[] = rows.map(({ org, receptionistName, planName, usedMinutes, includedMinutes, domain }) => ({
    id: org.id,
    href: `/admin/entreprises/${org.id}`,
    search: [org.name, org.sector, org.contactName, org.city, domain, receptionistName, planName].filter(Boolean).join(" "),
    filters: { status: org.status, plan: planName ?? "none" },
    sort: {
      name: org.name,
      sector: org.sector,
      contact: org.contactName,
      receptionist: receptionistName ?? "",
      plan: planName ?? "",
      minutes: usedMinutes,
      status: org.status,
      activated: org.activatedAt ?? "",
    },
    cells: {
      name: (
        <span className="flex flex-col">
          <span>{org.name}</span>
          <span className="font-ui text-[12px] font-normal text-faint">{org.city}</span>
        </span>
      ),
      sector: <span className="text-muted">{org.sector}</span>,
      contact: org.contactName,
      domain: domain ? <span className="font-ui text-[12.5px] text-muted">{domain}</span> : <span className="text-faint">—</span>,
      receptionist: receptionistName ?? <span className="text-faint">Non assignée</span>,
      plan: planName ?? <span className="text-faint">Aucun</span>,
      minutes: includedMinutes ? (
        <span className="ml-auto flex w-28 flex-col items-end gap-1.5">
          <span>
            {formatNumber(usedMinutes)} <span className="text-faint">/ {formatNumber(includedMinutes)}</span>
          </span>
          <Meter size="sm" value={usedMinutes} max={includedMinutes} label={`Minutes utilisées par ${org.name}`} />
        </span>
      ) : (
        <span className="text-faint">—</span>
      ),
      status: <StatusBadge status={ORG_STATUS[org.status]} />,
      activated: <span className="text-muted">{formatDate(org.activatedAt)}</span>,
      actions: (
        <Menu
          label={`Actions pour ${org.name}`}
          items={[
            { label: "Ouvrir le dossier", href: `/admin/entreprises/${org.id}`, icon: <Building2 /> },
            { label: "Modifier", href: `/admin/entreprises/${org.id}?tab=general`, icon: <Pencil />, disabled: !canWrite, hint: canWrite ? undefined : "Rôle insuffisant" },
            { label: "Abonnement et quotas", href: `/admin/entreprises/${org.id}?tab=abonnement`, icon: <Layers /> },
            { label: "Sessions", href: `/admin/entreprises/${org.id}?tab=sessions`, icon: <Clock3 /> },
            { label: "Historique", href: `/admin/entreprises/${org.id}?tab=historique`, icon: <FileClock /> },
          ]}
        />
      ),
    },
  }));

  const planNames = [...new Set(plans.map((p) => p.name))];

  return (
    <>
      <PageHeader
        title="Entreprises"
        description="Toutes les entreprises clientes d’ATIE Presence, leur réceptionniste, leur formule et leur consommation sur la période en cours."
        actions={
          canWrite ? (
            <ButtonLink href="/admin/entreprises/nouvelle" variant="primary">
              <Plus aria-hidden /> Nouvelle entreprise
            </ButtonLink>
          ) : null
        }
      />
      <Card>
        <DataTable
          caption="Liste des entreprises clientes"
          columns={columns}
          rows={data}
          searchPlaceholder="Nom, ville, domaine…"
          defaultSort={{ key: "name", dir: "asc" }}
          filters={[
            { key: "status", label: "État", options: Object.entries(ORG_STATUS).map(([value, s]) => ({ value, label: s.label })) },
            { key: "plan", label: "Formule", options: [...planNames.map((p) => ({ value: p, label: p })), { value: "none", label: "Sans formule" }] },
          ]}
          emptyTitle="Aucune entreprise"
          emptyDescription="Créez la première entreprise cliente pour commencer."
        />
      </Card>
    </>
  );
}
