import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen, Lock } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { listKnowledgeForOrg, listOrganizations } from "@/lib/repositories";
import { INDEX_STATUS, ORG_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import type { IndexStatus } from "@/lib/domain/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Notice, NotConnected } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata: Metadata = { title: "Knowledge Bases" };

export default async function KnowledgeIndex() {
  await requireAdmin("knowledge.read_all");
  const orgList = await listOrganizations();
  const sourcesByOrg = await Promise.all(orgList.map((org) => listKnowledgeForOrg(org.id)));
  const orgs = orgList.map((org, i) => {
    const sources = sourcesByOrg[i];
    const statuses = new Map<IndexStatus, number>();
    for (const s of sources) statuses.set(s.indexStatus, (statuses.get(s.indexStatus) ?? 0) + 1);
    return {
      org,
      sources,
      categories: [...new Set(sources.map((s) => s.category))],
      statuses: [...statuses.entries()],
      lastUpdate: sources[0]?.updatedAt ?? null,
    };
  });

  return (
    <>
      <PageHeader
        title="Knowledge Bases"
        description="Les connaissances que chaque réceptionniste peut utiliser. Une base par entreprise, jamais partagée."
      />
      <div className="mb-6 grid gap-3 lg:grid-cols-2">
        <Notice kind="privacy" title="Isolation stricte par entreprise">
          Chaque base n’est consultable et modifiable que depuis la fiche de son entreprise. Aucune recherche ni aucun document ne traverse
          deux entreprises.
        </Notice>
        <NotConnected what="Indexation et recherche sémantique (RAG)">
          Les documents sont enregistrés en base. Aucun moteur d’indexation n’est branché : les sources restent « en attente d’indexation »,
          aucun statut « Indexé » n’est affiché sans indexation réelle.
        </NotConnected>
      </div>

      {orgs.length === 0 ? (
        <EmptyState title="Aucune entreprise" />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orgs.map(({ org, sources, categories, statuses, lastUpdate }) => (
            <li key={org.id}>
              <Link
                href={`/admin/connaissances/${org.id}`}
                className="group flex h-full flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-line-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-head text-[15px] font-semibold">{org.name}</p>
                    <p className="truncate font-ui text-[12.5px] text-faint">{org.sector}</p>
                  </div>
                  <StatusBadge status={ORG_STATUS[org.status]} />
                </div>
                <dl className="mt-5 grid grid-cols-3 gap-3">
                  <div>
                    <dt className="font-ui text-[11.5px] text-faint">Sources</dt>
                    <dd className="tabular font-head text-[20px] font-semibold">{sources.length}</dd>
                  </div>
                  <div>
                    <dt className="font-ui text-[11.5px] text-faint">Catégories</dt>
                    <dd className="tabular font-head text-[20px] font-semibold">{categories.length}</dd>
                  </div>
                  <div>
                    <dt className="font-ui text-[11.5px] text-faint">Mise à jour</dt>
                    <dd className="mt-1.5 text-[13px]">{formatDate(lastUpdate)}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {statuses.length === 0 ? (
                    <Badge>Aucun document</Badge>
                  ) : (
                    statuses.map(([st, n]) => (
                      <Badge key={st} tone={INDEX_STATUS[st].tone}>
                        {INDEX_STATUS[st].label} · {n}
                      </Badge>
                    ))
                  )}
                </div>
                <div className="mt-auto flex items-center justify-between pt-5 font-ui text-[12.5px] text-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Lock className="size-3.5" aria-hidden /> Base privée
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-ink group-hover:text-accent-ink">
                    <BookOpen className="size-3.5" aria-hidden /> Ouvrir <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
