import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { History } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getKnowledgeSourceForOrg, getOrganization, getUser } from "@/lib/repositories";
import { updateKnowledgeSource } from "@/lib/actions/knowledge";
import { INDEX_STATUS, KNOWLEDGE_KIND } from "@/lib/labels";
import { formatDateTime, formatNumber } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { NotConnected } from "@/components/ui/Notice";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { TextAreaField, TextField } from "@/components/ui/FormFields";
import { KbDeleteButton } from "@/components/admin/kb-delete-button";

type Params = { params: Promise<{ orgId: string; sourceId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { orgId, sourceId } = await params;
  return { title: (await getKnowledgeSourceForOrg(orgId, sourceId))?.source.title ?? "Document" };
}

function bytes(n: number) {
  if (n < 1024) return `${formatNumber(n)} o`;
  if (n < 1024 * 1024) return `${formatNumber(Math.round(n / 102.4) / 10)} Ko`;
  return `${formatNumber(Math.round(n / 104857.6) / 10)} Mo`;
}

export default async function KnowledgeSourcePage({ params }: Params) {
  const v = await requireAdmin("knowledge.read_all");
  const { orgId, sourceId } = await params;
  const org = await getOrganization(orgId);
  // Isolation : la source n'est trouvée que si elle appartient à cette entreprise.
  const found = org ? await getKnowledgeSourceForOrg(org.id, sourceId) : null;
  if (!org || !found) notFound();
  const { source, versions } = found;
  // Auteurs des versions, préchargés.
  const authorIds = [...new Set([source.updatedBy, ...versions.map((d) => d.createdBy)].filter((x): x is string => Boolean(x)))];
  const authors = new Map((await Promise.all(authorIds.map((id) => getUser(id)))).filter((u) => u !== null).map((u) => [u.id, u.fullName]));
  const authorName = (id: string | null) => (id && authors.get(id)) || "—";
  const current = versions[0];
  const canWrite = can(v.role, "knowledge.write");

  return (
    <>
      <PageHeader
        title={source.title}
        breadcrumbs={[
          { label: "Knowledge Bases", href: "/admin/connaissances" },
          { label: org.name, href: `/admin/connaissances/${org.id}` },
          { label: source.title },
        ]}
        meta={
          <>
            <Badge>{KNOWLEDGE_KIND[source.kind]}</Badge>
            <StatusBadge status={INDEX_STATUS[source.indexStatus]} />
          </>
        }
        actions={canWrite ? <KbDeleteButton orgId={org.id} sourceId={source.id} title={source.title} versions={versions.length} /> : null}
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Contenu actuel" description={`Version ${source.currentVersion}`} />
            <CardBody>
              <div className="whitespace-pre-wrap rounded-xl border border-line bg-surface-2 px-4 py-3 text-[14px] leading-relaxed">{current?.content ?? "—"}</div>
            </CardBody>
          </Card>

          {canWrite ? (
            <Card>
              <CardHeader title="Modifier" description="Chaque enregistrement crée une nouvelle version ; les précédentes restent consultables." />
              <CardBody>
                <ActionForm action={updateKnowledgeSource} className="flex flex-col gap-4">
                  <input type="hidden" name="orgId" value={org.id} />
                  <input type="hidden" name="sourceId" value={source.id} />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField label="Titre" name="title" required defaultValue={source.title} maxLength={160} />
                    <TextField label="Catégorie" name="category" required defaultValue={source.category} maxLength={60} />
                  </div>
                  <TextAreaField label="Contenu" name="content" required rows={8} defaultValue={current?.content ?? ""} maxLength={20000} />
                  <div className="flex justify-end">
                    <SubmitButton>Enregistrer une nouvelle version</SubmitButton>
                  </div>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader title="Informations" />
            <CardBody>
              <DefinitionList
                className="sm:grid-cols-1!"
                items={[
                  ["Entreprise", org.name],
                  ["Catégorie", source.category],
                  ["Source des connaissances", <span key="o" className="break-all">{source.origin}</span>],
                  ["Créée le", formatDateTime(source.createdAt)],
                  ["Dernière mise à jour", `${formatDateTime(source.updatedAt)} · ${authorName(source.updatedBy)}`],
                ]}
              />
            </CardBody>
          </Card>
          <NotConnected what="Indexation">Le statut d’indexation sera fourni par le pipeline d’indexation lorsqu’il sera branché.</NotConnected>
          <Card>
            <CardHeader title="Historique des versions" description={`${versions.length} version${versions.length > 1 ? "s" : ""}`} />
            <CardBody className="pt-3">
              <ol className="flex flex-col gap-4">
                {versions.map((d) => (
                  <li key={d.id} className="flex gap-3">
                    <span aria-hidden className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-surface-3 text-faint">
                      <History className="size-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium">
                        Version {d.version}
                        {d.version === source.currentVersion ? <Badge tone="accent">Actuelle</Badge> : null}
                      </p>
                      <p className="font-ui text-[12px] text-faint">
                        {formatDateTime(d.createdAt)} · {authorName(d.createdBy)} · {bytes(d.sizeBytes)}
                      </p>
                      {d.version !== source.currentVersion ? (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer font-ui text-[12.5px] text-muted hover:text-ink">Afficher le contenu</summary>
                          <p className="mt-2 whitespace-pre-wrap rounded-lg bg-surface-2 px-3 py-2 text-[13px] text-muted">{d.content}</p>
                        </details>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
