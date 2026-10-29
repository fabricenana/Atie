import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BookOpen, CheckCircle2, ExternalLink, Pause, Play, Trash2, UserPlus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  getAvatar,
  getOrganization,
  getReceptionistForOrg,
  getUser,
  getWidgetForOrg,
  listAuditEvents,
  listConcurrencyForOrg,
  listConversationsForOrg,
  listDomainsForOrg,
  listKnowledgeForOrg,
  listOrgUsers,
  listTopupsForOrg,
  quotaForOrg,
} from "@/lib/repositories";
import {
  addDomain,
  inviteOrgUser,
  markDomainVerified,
  removeDomain,
  removeOrgUser,
  setOrganizationSuspended,
  updateOrganization,
} from "@/lib/actions/organizations";
import { END_REASON, INDEX_STATUS, KNOWLEDGE_KIND, ORG_STATUS, PLAN_APPROVAL, RECEPTIONIST_STATUS, SESSION_STATUS, SUBSCRIPTION_STATUS, TOPUP_STATUS, WIDGET_STATUS } from "@/lib/labels";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { formatCHF, formatDate, formatDateTime, formatDuration, formatNumber, formatRelative, LANG_SHORT, toMinutes } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import type { Organization, WebsiteDomain } from "@/lib/domain/types";
import { ButtonLink } from "@/components/ui/Button";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { SelectField, TextField } from "@/components/ui/FormFields";
import { FormGrid } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { DataTable, type Row } from "@/components/ui/DataTable";
import { Meter } from "@/components/ui/Charts";
import { Stat, StatGrid } from "@/components/ui/Stat";
import { Portrait } from "@/components/ui/Portrait";

export const metadata: Metadata = { title: "Dossier entreprise" };

const TABS = [
  ["general", "Informations générales"],
  ["domaines", "Sites et domaines"],
  ["receptionniste", "Réceptionniste"],
  ["connaissances", "Knowledge Base"],
  ["abonnement", "Abonnement et quotas"],
  ["sessions", "Sessions"],
  ["utilisateurs", "Utilisateurs"],
  ["historique", "Historique"],
] as const;
type TabKey = (typeof TABS)[number][0];

export default async function OrganizationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const v = await requireAdmin("org.read_all");
  const { id } = await params;
  const sp = await searchParams;
  const org = await getOrganization(id);
  if (!org) notFound();
  const tab: TabKey = (TABS.find(([k]) => k === sp.tab)?.[0] ?? "general") as TabKey;
  const canWrite = can(v.role, "org.write");
  const canSuspend = can(v.role, "org.suspend");

  const [domains, rcp, kb, conversations, users, history, widget] = await Promise.all([
    listDomainsForOrg(org.id),
    getReceptionistForOrg(org.id),
    listKnowledgeForOrg(org.id),
    listConversationsForOrg(org.id),
    listOrgUsers(org.id),
    listAuditEvents(org.id),
    getWidgetForOrg(org.id),
  ]);
  const avatar = rcp ? await getAvatar(rcp.avatarId) : null;
  const actorIds = [...new Set(history.map((a) => a.actorId).filter((x): x is string => Boolean(x)))];
  const actors = new Map((await Promise.all(actorIds.map((uid) => getUser(uid)))).filter((u) => u !== null).map((u) => [u.id, u.fullName]));

  const tabs = TABS.map(([key, label]) => ({
    key,
    label,
    href: `/admin/entreprises/${org.id}?tab=${key}`,
    count: key === "domaines" ? domains.length : key === "connaissances" ? kb.length : key === "utilisateurs" ? users.length : key === "sessions" ? conversations.length : undefined,
  }));

  const suspended = org.status === "suspended";

  return (
    <>
      <PageHeader
        title={org.name}
        description={`${org.sector} · ${org.city}`}
        breadcrumbs={[{ label: "Entreprises", href: "/admin/entreprises" }, { label: org.name }]}
        meta={
          <>
            <StatusBadge status={ORG_STATUS[org.status]} />
            <Badge>{org.slug}</Badge>
          </>
        }
        actions={
          canSuspend ? (
            suspended ? (
              <ConfirmAction
                action={setOrganizationSuspended}
                payload={{ id: org.id, suspend: "0" }}
                label="Réactiver le service"
                icon={<Play aria-hidden />}
                variant="primary"
                confirmVariant="primary"
                size="md"
                title={`Réactiver ${org.name} ?`}
                confirmLabel="Réactiver"
              >
                <p className="text-[14px] text-muted">
                  L’abonnement et la réceptionniste repassent en service dans la console. Le backend Python reste l’autorité des quotas et n’en est pas encore informé automatiquement.
                </p>
              </ConfirmAction>
            ) : (
              <ConfirmAction
                action={setOrganizationSuspended}
                payload={{ id: org.id, suspend: "1" }}
                label="Suspendre"
                icon={<Pause aria-hidden />}
                variant="danger"
                size="md"
                title={`Suspendre ${org.name} ?`}
                confirmLabel="Suspendre le service"
              >
                <p className="text-[14px] text-muted">
                  La réceptionniste est mise en pause et l’abonnement suspendu. Les visiteurs ne pourront plus démarrer de conversation. L’action est enregistrée dans le journal d’audit.
                </p>
              </ConfirmAction>
            )
          ) : null
        }
      />
      {suspended ? (
        <Notice kind="danger" title="Service suspendu" className="mb-6">
          Cette entreprise ne peut plus recevoir de conversations. Réactivez le service une fois la situation régularisée.
        </Notice>
      ) : null}

      <Tabs tabs={tabs} current={tab} label="Sections du dossier" />

      {tab === "general" && <GeneralTab org={org} canWrite={canWrite} />}
      {tab === "domaines" && <DomainsTab orgId={org.id} domains={domains} canWrite={canWrite} />}
      {tab === "receptionniste" && (
        <Card>
          <CardHeader
            title="Réceptionniste assignée"
            actions={rcp ? <ButtonLink href={`/admin/receptionnistes/${rcp.id}`} size="sm">Configurer</ButtonLink> : <ButtonLink href="/admin/receptionnistes/nouvelle" size="sm" variant="primary">Assigner une réceptionniste</ButtonLink>}
          />
          <CardBody>
            {rcp ? (
              <div className="flex flex-col gap-6 sm:flex-row">
                <Portrait src={avatar?.portraitUrl ?? null} name={rcp.name} className="aspect-[3/4] w-full max-w-[180px] shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="mb-4 flex flex-wrap items-center gap-2">
                    <h3 className="text-[20px] font-semibold">{rcp.name}</h3>
                    <StatusBadge status={RECEPTIONIST_STATUS[rcp.status]} />
                  </div>
                  <DefinitionList
                    items={[
                      ["Rôle", rcp.role],
                      ["Langues", [rcp.primaryLang, ...rcp.secondaryLangs].map((l) => LANG_SHORT[l]).join(" · ")],
                      ["Avatar LemonSlice", <code key="a" className="font-ui text-[12.5px]">{avatar?.providerAvatarId ?? "—"}</code>],
                      ["Durée maximale", `${formatDuration(rcp.maxConversationSeconds)} min`],
                      ["Widget", <StatusBadge key="w" status={WIDGET_STATUS[widget?.status ?? "not_configured"]} />],
                      ["Dernière activité", formatRelative(rcp.lastActivityAt)],
                    ]}
                  />
                  <p className="mt-5 rounded-xl bg-surface-2 p-4 text-[13.5px] text-muted">« {rcp.greeting} »</p>
                </div>
              </div>
            ) : (
              <EmptyState title="Aucune réceptionniste" description="Créez une réceptionniste à partir d’un avatar existant (Léa ou Maya) et associez-la à cette entreprise." />
            )}
          </CardBody>
        </Card>
      )}
      {tab === "connaissances" && (
        <Card>
          <CardHeader
            title="Knowledge Base"
            description="Connaissances propres à cette entreprise, jamais partagées avec une autre."
            actions={<ButtonLink href={`/admin/connaissances/${org.id}`} size="sm"><BookOpen aria-hidden /> Gérer les documents</ButtonLink>}
          />
          <CardBody className="pt-3">
            {kb.length === 0 ? (
              <EmptyState title="Aucune source" description="Ajoutez des textes, URL ou documents depuis la Knowledge Base." />
            ) : (
              <ul className="divide-y divide-line">
                {kb.map((k) => (
                  <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-medium">{k.title}</p>
                      <p className="font-ui text-[12px] text-faint">
                        {KNOWLEDGE_KIND[k.kind]} · {k.category} · v{k.currentVersion} · mis à jour {formatDate(k.updatedAt)}
                      </p>
                    </div>
                    <StatusBadge status={INDEX_STATUS[k.indexStatus]} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
      {tab === "abonnement" && <SubscriptionTab orgId={org.id} />}
      {tab === "sessions" && (
        <Card>
          <CardHeader title="Sessions et conversations" description="Écrites par le backend Python. Aucune transcription n’est conservée par défaut." />
          <DataTable
            caption={`Sessions de ${org.name}`}
            columns={[
              { key: "date", label: "Date", sortable: true },
              { key: "duration", label: "Durée", sortable: true, align: "right" },
              { key: "lang", label: "Langue", sortable: true, hideBelow: "sm" },
              { key: "status", label: "Statut", sortable: true },
              { key: "reason", label: "Motif de fin", hideBelow: "md" },
              { key: "billable", label: "Min. facturables", sortable: true, align: "right", hideBelow: "lg" },
            ]}
            rows={conversations.map<Row>((c) => ({
              id: c.id,
              href: `/admin/sessions/${c.id}`,
              search: `${c.id} ${c.lang} ${SESSION_STATUS[c.status].label} ${c.error ?? ""}`,
              filters: { status: c.status },
              sort: { date: c.startedAt, duration: c.durationSeconds, lang: c.lang, status: c.status, billable: c.billableSeconds },
              cells: {
                date: formatDateTime(c.startedAt),
                duration: formatDuration(c.durationSeconds),
                lang: LANG_SHORT[c.lang],
                status: <StatusBadge status={SESSION_STATUS[c.status]} />,
                reason: <span className="text-muted">{c.endReason ? END_REASON[c.endReason] : "—"}</span>,
                billable: formatNumber(toMinutes(c.billableSeconds)),
              },
            }))}
            filters={[{ key: "status", label: "Statut", options: Object.entries(SESSION_STATUS).map(([value, s]) => ({ value, label: s.label })) }]}
            defaultSort={{ key: "date", dir: "desc" }}
            emptyTitle="Aucune session"
            emptyDescription="Aucune conversation enregistrée pour cette entreprise : le backend Python n’a encore rien transmis."
          />
        </Card>
      )}
      {tab === "utilisateurs" && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <Card>
            <CardHeader title="Utilisateurs autorisés" description="Personnes ayant accès à l’espace client de cette entreprise." />
            <CardBody className="pt-3">
              {users.length === 0 ? (
                <EmptyState title="Aucun utilisateur" />
              ) : (
                <ul className="divide-y divide-line">
                  {users.map(({ membership, user }) => (
                    <li key={membership.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium">{user.fullName}</p>
                        <p className="truncate font-ui text-[12px] text-faint">
                          {user.email} · {ROLE_LABELS[membership.role]}
                        </p>
                      </div>
                      <Badge tone={user.status === "active" ? "success" : user.status === "invited" ? "info" : "neutral"} dot>
                        {user.status === "active" ? "Actif" : user.status === "invited" ? "Invité" : "Désactivé"}
                      </Badge>
                      {canWrite ? (
                        <ConfirmAction
                          action={removeOrgUser}
                          payload={{ membershipId: membership.id, organizationId: org.id }}
                          label="Retirer"
                          icon={<Trash2 aria-hidden />}
                          variant="ghost"
                          title={`Retirer l’accès de ${user.fullName} ?`}
                          confirmLabel="Retirer l’accès"
                        />
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          {canWrite ? (
            <Card>
              <CardHeader title="Inviter un utilisateur" description="Un e-mail d’invitation est envoyé pour définir le mot de passe." />
              <CardBody>
                <ActionForm action={inviteOrgUser} resetOnSuccess className="flex flex-col gap-4">
                  <input type="hidden" name="organizationId" value={org.id} />
                  <TextField label="Nom complet" name="fullName" required autoComplete="off" />
                  <TextField label="E-mail" name="email" type="email" required autoComplete="off" />
                  <SelectField
                    label="Rôle"
                    name="role"
                    defaultValue="org_viewer"
                    options={[
                      { value: "org_admin", label: ROLE_LABELS.org_admin },
                      { value: "org_viewer", label: ROLE_LABELS.org_viewer },
                    ]}
                  />
                  <SubmitButton className="self-start">
                    <UserPlus aria-hidden /> Inviter
                  </SubmitButton>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
        </div>
      )}
      {tab === "historique" && (
        <Card>
          <CardHeader title="Historique des modifications" description="Journal d’audit de cette entreprise." />
          <CardBody className="pt-3">
            {history.length === 0 ? (
              <EmptyState title="Aucune modification enregistrée" />
            ) : (
              <ol className="relative flex flex-col gap-5 border-l border-line pl-5">
                {history.map((a) => (
                  <li key={a.id} className="relative">
                    <span aria-hidden className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-surface bg-red" />
                    <p className="text-[14px]">
                      <span className="font-medium">{a.target}</span> — {a.detail || a.action}
                    </p>
                    <p className="font-ui text-[12px] text-faint">
                      <code>{a.action}</code> · {(a.actorId && actors.get(a.actorId)) ?? "Système"} · {formatDateTime(a.at)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}

function GeneralTab({ org, canWrite }: { org: Organization; canWrite: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader title="Informations générales" description={canWrite ? "Modifiez les informations puis enregistrez." : "Lecture seule pour votre rôle."} />
        <CardBody>
          <ActionForm action={updateOrganization} className="flex flex-col gap-6">
            <input type="hidden" name="id" value={org.id} />
            <fieldset disabled={!canWrite} className="contents">
              <FormGrid>
                <TextField label="Nom" name="name" defaultValue={org.name} required />
                <TextField label="Secteur" name="sector" defaultValue={org.sector} required />
                <TextField label="Responsable" name="contactName" defaultValue={org.contactName} required />
                <TextField label="E-mail du responsable" name="contactEmail" type="email" defaultValue={org.contactEmail} required />
                <TextField label="Téléphone" name="phone" type="tel" defaultValue={org.phone} />
                <TextField label="Ville" name="city" defaultValue={org.city} required />
                <TextField label="Adresse" name="address" defaultValue={org.address} className="sm:col-span-2" />
                <TextField label="E-mail de facturation" name="billingEmail" type="email" defaultValue={org.billingEmail} required />
                <TextField label="Numéro IDE / TVA" name="vatNumber" defaultValue={org.vatNumber ?? ""} />
                <TextField label="Conservation des demandes (jours)" name="retentionDays" type="number" min={1} max={3650} defaultValue={org.retentionDays} required hint="Durée après laquelle les demandes visiteurs sont supprimées." />
              </FormGrid>
            </fieldset>
            {canWrite ? (
              <div className="flex justify-end">
                <SubmitButton>Enregistrer</SubmitButton>
              </div>
            ) : null}
          </ActionForm>
        </CardBody>
      </Card>
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader title="Dossier" />
          <CardBody>
            <DefinitionList
              className="sm:grid-cols-1"
              items={[
                ["Identifiant public", <code key="s" className="font-ui text-[13px]">{org.slug}</code>],
                ["Créée le", formatDate(org.createdAt)],
                ["Activation", formatDate(org.activatedAt)],
                ["Dernière modification", formatDateTime(org.updatedAt)],
                ["Transcriptions", org.transcriptsEnabled ? "Conservées" : "Non conservées (par défaut)"],
              ]}
            />
          </CardBody>
        </Card>
        <Notice kind="privacy" title="Protection des données">
          Les données de cette entreprise ne sont visibles que par ATIE et par ses propres utilisateurs. Cette interface ne garantit pas à elle seule la conformité LPD.
        </Notice>
      </div>
    </div>
  );
}

function DomainsTab({ orgId, domains, canWrite }: { orgId: string; domains: WebsiteDomain[]; canWrite: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader title="Sites et domaines autorisés" description="Le widget ne s’ouvre que sur ces domaines (contrôle effectué par le backend)." />
        <CardBody className="pt-3">
          {domains.length === 0 ? (
            <EmptyState title="Aucun domaine" description="Ajoutez le domaine du site sur lequel la réceptionniste apparaîtra." />
          ) : (
            <ul className="divide-y divide-line">
              {domains.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-ui text-[14px] font-medium">{d.domain}</p>
                    <p className="font-ui text-[12px] text-faint">Ajouté le {formatDate(d.createdAt)}{d.verifiedAt ? ` · vérifié le ${formatDate(d.verifiedAt)}` : ""}</p>
                  </div>
                  {d.verified ? <Badge tone="success" dot>Vérifié</Badge> : <Badge tone="warning" dot>Non vérifié</Badge>}
                  {canWrite && !d.verified ? (
                    <ConfirmAction
                      action={markDomainVerified}
                      payload={{ id: d.id, organizationId: orgId }}
                      label="Marquer vérifié"
                      icon={<CheckCircle2 aria-hidden />}
                      variant="ghost"
                      confirmVariant="primary"
                      title="Vérification manuelle"
                      confirmLabel="Marquer comme vérifié"
                    >
                      <p className="text-[14px] text-muted">
                        Aucune vérification DNS ou HTTP automatique n’est effectuée. Confirmez seulement si vous avez contrôlé vous-même que ce domaine appartient bien à l’entreprise.
                      </p>
                    </ConfirmAction>
                  ) : null}
                  {canWrite ? (
                    <ConfirmAction
                      action={removeDomain}
                      payload={{ id: d.id, organizationId: orgId }}
                      label="Retirer"
                      icon={<Trash2 aria-hidden />}
                      variant="ghost"
                      title={`Retirer ${d.domain} ?`}
                      confirmLabel="Retirer le domaine"
                    >
                      <p className="text-[14px] text-muted">Le widget ne pourra plus s’ouvrir sur ce domaine.</p>
                    </ConfirmAction>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <div className="flex flex-col gap-6">
        {canWrite ? (
          <Card>
            <CardHeader title="Ajouter un domaine" />
            <CardBody>
              <ActionForm action={addDomain} resetOnSuccess className="flex flex-col gap-4">
                <input type="hidden" name="organizationId" value={orgId} />
                <TextField label="Domaine" name="domain" required placeholder="www.exemple.ch" hint="Sans https:// ni chemin." autoComplete="off" />
                <SubmitButton className="self-start">Ajouter</SubmitButton>
              </ActionForm>
            </CardBody>
          </Card>
        ) : null}
        <ButtonLink href="/admin/integrations" variant="ghost" className="self-start">
          <ExternalLink aria-hidden /> Préparer l’intégration du widget
        </ButtonLink>
      </div>
    </div>
  );
}

async function SubscriptionTab({ orgId }: { orgId: string }) {
  const [q, topups, conc] = await Promise.all([quotaForOrg(orgId), listTopupsForOrg(orgId), listConcurrencyForOrg(orgId)]);
  const total = q.includedMinutes + q.topupMinutes;
  if (!q.subscription || !q.plan) {
    return (
      <Card>
        <EmptyState
          title="Aucun abonnement"
          description="Attribuez une formule à cette entreprise depuis la gestion des abonnements."
          action={<ButtonLink href="/admin/abonnements" variant="primary">Gérer les abonnements</ButtonLink>}
        />
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-6">
      {q.alert === "exhausted" ? (
        <Notice kind="danger" title="Minutes épuisées">Les nouvelles conversations seront refusées par le backend jusqu’à une recharge ou un changement de formule.</Notice>
      ) : q.alert === "warning" ? (
        <Notice kind="warning" title={`Seuil d’alerte atteint (${q.pctUsed} %)`}>Proposez une recharge ou une formule supérieure.</Notice>
      ) : null}
      <StatGrid>
        <Stat label="Formule" origin={null} value={q.plan.name} hint={`${formatCHF(q.plan.monthlyPriceCents)} / mois`} />
        <Stat label="Minutes utilisées" value={formatNumber(q.usedMinutes)} hint={`sur ${formatNumber(total)} min (dont ${formatNumber(q.topupMinutes)} rechargées)`} tone={q.alert === "exhausted" ? "danger" : q.alert === "warning" ? "warning" : undefined} />
        <Stat label="Minutes restantes" value={formatNumber(q.remainingMinutes)} hint={`${q.sessions} sessions sur la période`} />
        <Stat label="Conversations simultanées" origin={null} value={q.concurrent} hint={conc.length ? `${conc.length} option(s) de concurrence` : "Incluses dans la formule"} />
      </StatGrid>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Période en cours" actions={<ButtonLink href="/admin/abonnements" size="sm">Modifier l’abonnement</ButtonLink>} />
          <CardBody>
            <Meter size="lg" value={q.usedMinutes} max={total} label="Consommation de la période" />
            <p className="tabular mt-2 font-ui text-[12.5px] text-muted">{q.pctUsed} % utilisés · seuil d’alerte {q.subscription.alertThresholdPct} %</p>
            <DefinitionList
              className="mt-6"
              items={[
                ["Statut", <StatusBadge key="s" status={SUBSCRIPTION_STATUS[q.subscription.status]} />],
                ["Tarif", <StatusBadge key="a" status={PLAN_APPROVAL[q.plan.approval]} />],
                ["Activation", formatDate(q.subscription.activatedAt)],
                ["Période", `${formatDate(q.subscription.currentPeriodStart)} → ${formatDate(q.subscription.currentPeriodEnd)}`],
                ["Renouvellement", q.subscription.autoRenew ? "Automatique" : "Désactivé"],
              ]}
            />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recharges de minutes" />
          <CardBody className="pt-3">
            {topups.length === 0 ? (
              <EmptyState title="Aucune recharge" />
            ) : (
              <ul className="divide-y divide-line">
                {topups.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-[14px] font-medium">{t.minutes} minutes · {formatCHF(t.priceCents)}</p>
                      <p className="font-ui text-[12px] text-faint">Demandée le {formatDate(t.requestedAt)}{t.appliedAt ? ` · appliquée le ${formatDate(t.appliedAt)}` : ""}</p>
                    </div>
                    <StatusBadge status={TOPUP_STATUS[t.status]} />
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-[12.5px] text-muted">
              Quotas commerciaux du client, distincts des minutes facturées par les fournisseurs. <Link href="/admin/abonnements" className="text-ink underline underline-offset-2">Gérer les recharges</Link>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
