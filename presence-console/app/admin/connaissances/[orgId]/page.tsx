import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getOrganization, listKnowledgeForOrg } from "@/lib/repositories";
import { INDEX_STATUS, KNOWLEDGE_KIND } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { DataTable, type Row } from "@/components/ui/DataTable";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Notice, NotConnected } from "@/components/ui/Notice";
import { ButtonLink } from "@/components/ui/Button";
import { KbAddForms } from "@/components/admin/kb-add-forms";

export async function generateMetadata({ params }: { params: Promise<{ orgId: string }> }): Promise<Metadata> {
  const { orgId } = await params;
  return { title: `Knowledge Base — ${(await getOrganization(orgId))?.name ?? "Entreprise"}` };
}

export default async function OrgKnowledge({ params }: { params: Promise<{ orgId: string }> }) {
  const v = await requireAdmin("knowledge.read_all");
  const { orgId } = await params;
  const org = await getOrganization(orgId);
  if (!org) notFound();
  const sources = await listKnowledgeForOrg(org.id);
  const categories = [...new Set(sources.map((s) => s.category))].sort((a, b) => a.localeCompare(b, "fr"));

  const rows: Row[] = sources.map((s) => ({
    id: s.id,
    href: `/admin/connaissances/${org.id}/${s.id}`,
    cells: {
      title: s.title,
      kind: <Badge>{KNOWLEDGE_KIND[s.kind]}</Badge>,
      category: s.category,
      origin: <span className="block max-w-[220px] truncate text-muted" title={s.origin}>{s.origin}</span>,
      status: <StatusBadge status={INDEX_STATUS[s.indexStatus]} />,
      version: `v${s.currentVersion}`,
      updated: formatDate(s.updatedAt),
    },
    sort: { title: s.title, category: s.category, version: s.currentVersion, updated: s.updatedAt },
    search: `${s.title} ${s.category} ${s.origin}`,
    filters: { kind: s.kind, category: s.category, status: s.indexStatus },
  }));

  return (
    <>
      <PageHeader
        title={`Knowledge Base — ${org.name}`}
        description="Documents que la réceptionniste de cette entreprise pourra consulter."
        breadcrumbs={[{ label: "Knowledge Bases", href: "/admin/connaissances" }, { label: org.name }]}
        actions={<ButtonLink href={`/admin/entreprises/${org.id}`} variant="secondary">Fiche entreprise</ButtonLink>}
      />

      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <Notice kind="privacy" title="Base réservée à cette entreprise">
          Ces documents ne sont visibles que dans cet espace. Chaque lecture et écriture vérifie l’appartenance à {org.name}.
        </Notice>
        <NotConnected what="Indexation, recherche sémantique et RAG">
          Les ajouts sont enregistrés avec le statut « En attente d’indexation ». Les URL ne sont pas récupérées et le contenu des fichiers n’est ni
          extrait ni stocké. Le schéma prévoit les versions et la source de chaque connaissance pour le futur pipeline d’indexation.
        </NotConnected>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Sources" description={`${sources.length} source${sources.length > 1 ? "s" : ""}, ${categories.length} catégorie${categories.length > 1 ? "s" : ""}`} />
          <div className="mt-4">
            <DataTable
              caption={`Sources de connaissances de ${org.name}`}
              columns={[
                { key: "title", label: "Titre", sortable: true },
                { key: "kind", label: "Type" },
                { key: "category", label: "Catégorie", sortable: true, hideBelow: "md" },
                { key: "origin", label: "Source", hideBelow: "lg" },
                { key: "status", label: "Indexation" },
                { key: "version", label: "Version", sortable: true, align: "right", hideBelow: "sm" },
                { key: "updated", label: "Mise à jour", sortable: true, hideBelow: "md" },
              ]}
              rows={rows}
              defaultSort={{ key: "updated", dir: "desc" }}
              searchPlaceholder="Rechercher un document…"
              filters={[
                { key: "kind", label: "Type", options: Object.entries(KNOWLEDGE_KIND).map(([value, label]) => ({ value, label })) },
                { key: "category", label: "Catégorie", options: categories.map((c) => ({ value: c, label: c })) },
                { key: "status", label: "Indexation", options: Object.entries(INDEX_STATUS).map(([value, s]) => ({ value, label: s.label })) },
              ]}
              emptyTitle="Aucune connaissance"
              emptyDescription="Ajoutez un premier texte, une URL ou un document."
            />
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader title="Ajouter une connaissance" description="Texte saisi, référence d’URL ou document." />
          <CardBody>
            <KbAddForms orgId={org.id} categories={categories} canWrite={can(v.role, "knowledge.write")} />
          </CardBody>
        </Card>
      </div>
    </>
  );
}
