import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/session";
import { listDomains, listOrganizations, listReceptionists, listWidgets } from "@/lib/repositories";
import { WIDGET_STATUS } from "@/lib/labels";
import { formatRelative } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { DataTable, type Row } from "@/components/ui/DataTable";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";

export const metadata: Metadata = { title: "Intégrations" };

export default async function IntegrationsPage() {
  await requireAdmin("admin.access");
  const [widgets, orgs, receptionists, allDomains] = await Promise.all([listWidgets(), listOrganizations(), listReceptionists(), listDomains()]);
  const rcpById = new Map(receptionists.map((r) => [r.id, r]));
  const domainsByOrg = new Map<string, typeof allDomains>();
  for (const d of allDomains) domainsByOrg.set(d.organizationId, [...(domainsByOrg.get(d.organizationId) ?? []), d]);
  const rows: Row[] = orgs.map((org) => {
    const w = widgets.find((x) => x.organizationId === org.id) ?? null;
    const domains = domainsByOrg.get(org.id) ?? [];
    const rcp = w?.receptionistId ? rcpById.get(w.receptionistId) ?? null : null;
    const status = w?.status ?? "not_configured";
    return {
      id: org.id,
      href: `/admin/integrations/${org.id}`,
      cells: {
        org: org.name,
        rcp: rcp?.name ?? <span className="text-faint">—</span>,
        domains: domains.length ? (
          <span className="flex flex-wrap gap-1">
            {domains.map((d) => (
              <Badge key={d.id} tone={d.verified ? "success" : "neutral"}>
                {d.domain}
              </Badge>
            ))}
          </span>
        ) : (
          <span className="text-faint">Aucun domaine</span>
        ),
        key: w ? <code className="font-mono text-[12.5px]">{w.publicKey}</code> : <span className="text-faint">—</span>,
        platform: w ? (w.platform === "wordpress" ? "WordPress" : "Générique") : "—",
        status: <StatusBadge status={WIDGET_STATUS[status]} />,
        seen: w?.lastSeenAt ? formatRelative(w.lastSeenAt) : <span className="text-faint">Jamais</span>,
      },
      sort: { org: org.name, status, seen: w?.lastSeenAt ?? "" },
      search: `${org.name} ${domains.map((d) => d.domain).join(" ")} ${w?.publicKey ?? ""}`,
      filters: { status, platform: w?.platform ?? "" },
    };
  });

  return (
    <>
      <PageHeader
        title="Intégrations et déploiement"
        description="Préparation de l’installation du widget ATIE Presence sur les sites des clients."
      />
      <Notice kind="info" title="Aucune publication depuis la console" className="mb-6">
        Cet écran prépare les scripts et vérifie la configuration. Aucun widget n’est publié et aucun site client n’est modifié depuis la console.
        Le « dernier signal » sera renseigné par le backend lorsqu’il sera connecté.
      </Notice>
      <Card>
        <DataTable
          caption="Installations du widget par entreprise"
          columns={[
            { key: "org", label: "Entreprise", sortable: true },
            { key: "rcp", label: "Réceptionniste", hideBelow: "md" },
            { key: "domains", label: "Domaines autorisés", hideBelow: "lg" },
            { key: "key", label: "Identifiant public", hideBelow: "xl" },
            { key: "platform", label: "Mode", hideBelow: "md" },
            { key: "status", label: "État", sortable: true },
            { key: "seen", label: "Dernier signal", sortable: true, hideBelow: "sm" },
          ]}
          rows={rows}
          defaultSort={{ key: "org", dir: "asc" }}
          searchPlaceholder="Entreprise, domaine, identifiant…"
          filters={[
            { key: "status", label: "État", options: Object.entries(WIDGET_STATUS).map(([value, s]) => ({ value, label: s.label })) },
            { key: "platform", label: "Mode", options: [{ value: "generic", label: "Générique" }, { value: "wordpress", label: "WordPress" }] },
          ]}
        />
      </Card>
    </>
  );
}
