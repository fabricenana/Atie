import Link from "next/link";
import type { Metadata } from "next";
import { AlertTriangle, Bell, Check, Minus, RotateCcw } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can, PERMISSION_LABELS, PERMISSIONS, ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/auth/permissions";
import {
  getDemoMeta,
  getSettings,
  getUser,
  listAtieUsers,
  listAuditEvents,
  listIncidents,
  listNotifications,
  listOrganizations,
  listProviderStatuses,
  quotaForOrg,
} from "@/lib/repositories";
import {
  inviteUser,
  markNotificationsRead,
  resetDemoData,
  saveAlertSettings,
  saveLanguages,
  savePlatformSettings,
  saveSecuritySettings,
  setUserStatus,
  updateProfile,
} from "@/lib/actions/settings";
import type { Role } from "@/lib/domain/types";
import { LANGS } from "@/lib/domain/types";
import { formatDate, formatDateTime, formatRelative, LANG_LABELS, LANG_SHORT } from "@/lib/format";
import { CONNECTION_STATUS } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { DataTable, type Row } from "@/components/ui/DataTable";
import { Notice, NotConnected } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { FieldError, SelectField, TextField } from "@/components/ui/FormFields";
import { Checkbox } from "@/components/ui/Field";

export const metadata: Metadata = { title: "Paramètres" };

const SECTIONS = [
  { key: "profil", label: "Profil administrateur" },
  { key: "utilisateurs", label: "Utilisateurs internes" },
  { key: "roles", label: "Rôles et permissions" },
  { key: "plateforme", label: "Plateforme" },
  { key: "langues", label: "Langues" },
  { key: "notifications", label: "Notifications" },
  { key: "alertes", label: "Alertes de consommation" },
  { key: "audit", label: "Journal d’audit" },
  { key: "fournisseurs", label: "Fournisseurs techniques" },
  { key: "services", label: "État des services" },
  { key: "securite", label: "Sécurité" },
] as const;
type Section = (typeof SECTIONS)[number]["key"];

const ROLES: Role[] = ["super_admin", "atie_admin", "atie_operator", "org_admin", "org_viewer"];
const ATIE_ROLES = ["super_admin", "atie_admin", "atie_operator"] as const;
const USER_STATUS = {
  active: { label: "Actif", tone: "success" as const },
  invited: { label: "Invité", tone: "info" as const },
  disabled: { label: "Désactivé", tone: "neutral" as const },
};
const SERVICE_LABEL: Record<string, string> = { api: "API ATIE", livekit: "LiveKit", lemonslice: "LemonSlice", inference: "Inference", widget: "Widget" };

function ReadOnly({ show, children }: { show: boolean; children?: React.ReactNode }) {
  if (!show) return null;
  return (
    <Notice kind="info" className="mb-5">
      {children ?? "Lecture seule : la modification est réservée au super administrateur ATIE. Le contrôle est également effectué côté serveur."}
    </Notice>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const v = await requireAdmin("settings.read");
  const sp = await searchParams;
  const section: Section = SECTIONS.some((s) => s.key === sp.section) ? (sp.section as Section) : "profil";
  const settings = getSettings();
  const canSettings = can(v.role, "settings.write");
  const canUsers = can(v.role, "users.manage");
  const current = SECTIONS.find((s) => s.key === section)!;
  const unread = listNotifications(null).filter((n) => !n.readAt).length;

  return (
    <>
      <PageHeader
        title="Paramètres"
        description="Configuration de la plateforme, accès internes, notifications et sécurité."
        breadcrumbs={[{ label: "Tableau de bord", href: "/admin" }, { label: "Paramètres" }, { label: current.label }]}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Rubriques des paramètres" className="relative -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex min-w-max gap-1 lg:sticky lg:top-20 lg:min-w-0 lg:flex-col">
            {SECTIONS.map((s) => {
              const active = s.key === section;
              return (
                <li key={s.key}>
                  <Link
                    href={`/admin/parametres?section=${s.key}`}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex h-9 items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 font-ui text-[13.5px] font-medium transition-colors",
                      active ? "bg-accent-soft text-ink" : "text-muted hover:bg-surface-3 hover:text-ink",
                    )}
                  >
                    {s.label}
                    {s.key === "notifications" && unread ? <span className="tabular rounded-full bg-red px-1.5 text-[11px] text-white">{unread}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0">
          {section === "profil" ? (
            <Card className="max-w-3xl">
              <CardHeader title="Profil administrateur" description="Votre compte interne ATIE (fictif)." />
              <CardBody className="flex flex-col gap-6">
                <DefinitionList
                  items={[
                    ["Adresse e-mail", v.user.email],
                    ["Rôle", ROLE_LABELS[v.role]],
                    ["Dernière connexion", formatDateTime(v.user.lastLoginAt)],
                    ["Session expire", formatDateTime(new Date(v.expiresAt).toISOString())],
                  ]}
                />
                <ActionForm action={updateProfile} className="flex flex-col gap-5 border-t border-line pt-5 sm:flex-row sm:items-end">
                  <TextField label="Nom affiché" name="fullName" required defaultValue={v.user.fullName} className="flex-1" maxLength={80} />
                  <SubmitButton>Enregistrer</SubmitButton>
                </ActionForm>
                <Notice kind="demo">Profil de démonstration : le mot de passe et la double authentification seront gérés par le fournisseur d’identité en production.</Notice>
              </CardBody>
            </Card>
          ) : null}

          {section === "utilisateurs" ? (
            <div className="flex flex-col gap-6">
              <ReadOnly show={!canUsers}>Lecture seule : la gestion des utilisateurs internes est réservée au super administrateur ATIE.</ReadOnly>
              <Card>
                <CardHeader title="Utilisateurs internes ATIE" description="Personnel ayant accès au back-office." />
                <DataTable
                  caption="Utilisateurs internes"
                  searchPlaceholder="Nom ou e-mail…"
                  filters={[{ key: "role", label: "Rôle", options: ATIE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] })) }]}
                  columns={[
                    { key: "name", label: "Nom", sortable: true },
                    { key: "email", label: "E-mail", hideBelow: "md" },
                    { key: "role", label: "Rôle", sortable: true },
                    { key: "status", label: "Statut" },
                    { key: "login", label: "Dernière connexion", sortable: true, hideBelow: "lg" },
                    { key: "actions", label: "Actions", align: "right" },
                  ]}
                  rows={listAtieUsers().map((u): Row => ({
                    id: u.id,
                    search: `${u.fullName} ${u.email}`,
                    filters: { role: u.atieRole ?? "" },
                    sort: { name: u.fullName, role: u.atieRole ?? "", login: u.lastLoginAt ?? "" },
                    cells: {
                      name: (
                        <span>
                          {u.fullName}
                          {u.id === v.user.id ? <span className="ml-2 font-ui text-[12px] text-faint">(vous)</span> : null}
                        </span>
                      ),
                      email: u.email,
                      role: ROLE_LABELS[u.atieRole!],
                      status: <StatusBadge status={USER_STATUS[u.status]} />,
                      login: u.lastLoginAt ? formatRelative(u.lastLoginAt) : "Jamais",
                      actions:
                        canUsers && u.id !== v.user.id ? (
                          u.status === "disabled" ? (
                            <ConfirmAction action={setUserStatus} payload={{ id: u.id, status: "active" }} label="Réactiver" variant="ghost" confirmVariant="primary" confirmLabel="Réactiver" title={`Réactiver l’accès de ${u.fullName} ?`} />
                          ) : (
                            <ConfirmAction action={setUserStatus} payload={{ id: u.id, status: "disabled" }} label="Désactiver" variant="ghost" confirmLabel="Désactiver l’accès" title={`Désactiver l’accès de ${u.fullName} ?`}>
                              <p className="text-[14px] text-muted">La personne ne pourra plus ouvrir le back-office. L’action est réversible et enregistrée dans le journal d’audit.</p>
                            </ConfirmAction>
                          )
                        ) : (
                          <span className="font-ui text-[12px] text-faint">—</span>
                        ),
                    },
                  }))}
                />
              </Card>
              {canUsers ? (
                <Card>
                  <CardHeader title="Inviter un collaborateur" description="L’invitation est préparée localement ; aucun e-mail n’est envoyé en démonstration." />
                  <CardBody>
                    <ActionForm action={inviteUser} resetOnSuccess className="grid gap-5 md:grid-cols-[repeat(3,minmax(0,1fr))_auto] md:items-end">
                      <TextField label="Nom complet" name="fullName" required maxLength={80} />
                      <TextField label="E-mail" name="email" type="email" required autoComplete="off" />
                      <SelectField label="Rôle" name="role" defaultValue="atie_operator" options={ATIE_ROLES.map((r) => ({ value: r, label: ROLE_LABELS[r] }))} hint="Principe du moindre privilège." />
                      <SubmitButton>Inviter</SubmitButton>
                    </ActionForm>
                  </CardBody>
                </Card>
              ) : null}
            </div>
          ) : null}

          {section === "roles" ? (
            <Card className="min-w-0 overflow-hidden">
              <CardHeader title="Rôles et permissions" description="Matrice appliquée côté serveur à chaque page et à chaque action. Source : lib/auth/permissions.ts." />
              <div className="relative mt-4 overflow-x-auto" role="region" aria-label="Matrice des permissions (défilement horizontal possible)" tabIndex={0}>
                <table className="w-full min-w-[760px] border-collapse text-left text-[13px]">
                  <caption className="sr-only">Permissions par rôle</caption>
                  <thead>
                    <tr className="border-y border-line bg-surface-2">
                      <th scope="col" className="sticky left-0 bg-surface-2 px-5 py-3 font-ui text-[12px] font-medium uppercase tracking-[0.05em] text-faint">Permission</th>
                      {ROLES.map((r) => (
                        <th key={r} scope="col" className="px-3 py-3 text-center font-ui text-[12px] font-medium text-muted">
                          {ROLE_LABELS[r]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {PERMISSIONS.map((p) => (
                      <tr key={p} className={cn("border-b border-line", p === "client.access" && "border-t-2 border-t-line-strong")}>
                        <th scope="row" className="sticky left-0 bg-surface px-5 py-2.5 font-normal">
                          <span className="block">{PERMISSION_LABELS[p]}</span>
                          <span className="font-ui text-[11.5px] text-faint">{p}</span>
                        </th>
                        {ROLES.map((r) =>
                          ROLE_PERMISSIONS[r].has(p) ? (
                            <td key={r} className="px-3 py-2.5 text-center">
                              <Check className="mx-auto size-4 text-success" aria-hidden />
                              <span className="sr-only">Autorisé</span>
                            </td>
                          ) : (
                            <td key={r} className="px-3 py-2.5 text-center">
                              <Minus className="mx-auto size-4 text-line-strong" aria-hidden />
                              <span className="sr-only">Non autorisé</span>
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <CardBody>
                <ul className="flex flex-col gap-2 text-[13px] text-muted">
                  <li>Un client ne voit que sa propre entreprise : l’identifiant vient de la session serveur, jamais de l’URL.</li>
                  <li>Masquer un bouton n’est pas une protection : chaque action revérifie la permission.</li>
                  <li>Les actions administratives importantes sont inscrites au journal d’audit.</li>
                </ul>
              </CardBody>
            </Card>
          ) : null}

          {section === "plateforme" ? (
            <Card className="max-w-3xl">
              <CardHeader title="Paramètres de la plateforme" description="Valeurs par défaut appliquées aux nouvelles réceptionnistes et entreprises." />
              <CardBody>
                <ReadOnly show={!canSettings} />
                <ActionForm action={savePlatformSettings}>
                  <fieldset disabled={!canSettings} className="grid gap-5 sm:grid-cols-2">
                    <legend className="sr-only">Plateforme</legend>
                    <TextField label="Nom de la plateforme" name="platformName" required defaultValue={settings.platformName} maxLength={60} />
                    <SelectField label="Langue par défaut" name="defaultLang" defaultValue={settings.defaultLang} options={LANGS.map((l) => ({ value: l, label: LANG_LABELS[l], disabled: !settings.enabledLangs.includes(l) }))} />
                    <TextField
                      label="Durée maximale d’une conversation (min)"
                      name="maxMinutes"
                      type="number"
                      min={1}
                      max={30}
                      step={0.5}
                      required
                      defaultValue={settings.defaultMaxConversationSeconds / 60}
                      hint="Valeur par défaut ; le backend Python applique la limite effective."
                    />
                    <TextField label="Conservation des demandes (jours)" name="defaultRetentionDays" type="number" min={1} max={3650} required defaultValue={settings.defaultRetentionDays} hint="Durée par défaut, ajustable par entreprise." />
                  </fieldset>
                  {canSettings ? (
                    <div className="mt-6 flex justify-end border-t border-line pt-5">
                      <SubmitButton>Enregistrer</SubmitButton>
                    </div>
                  ) : null}
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          {section === "langues" ? (
            <Card className="max-w-3xl">
              <CardHeader title="Langues" description="Langues proposées aux réceptionnistes et aux visiteurs." />
              <CardBody>
                <ReadOnly show={!canSettings} />
                <ActionForm action={saveLanguages}>
                  <fieldset disabled={!canSettings} className="grid gap-3 sm:grid-cols-2">
                    <legend className="sr-only">Langues activées</legend>
                    {LANGS.map((l) => (
                      <div key={l} className="rounded-xl border border-line px-4 py-3">
                        <Checkbox
                          name="langs"
                          value={l}
                          defaultChecked={settings.enabledLangs.includes(l)}
                          label={
                            <span className="flex items-center gap-2">
                              <Badge>{LANG_SHORT[l]}</Badge> {LANG_LABELS[l]}
                            </span>
                          }
                          description={l === settings.defaultLang ? "Langue par défaut" : undefined}
                        />
                      </div>
                    ))}
                  </fieldset>
                  <div className="mt-2">
                    <FieldError name="langs" />
                  </div>
                  {canSettings ? (
                    <div className="mt-6 flex justify-end border-t border-line pt-5">
                      <SubmitButton>Enregistrer</SubmitButton>
                    </div>
                  ) : null}
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}

          {section === "notifications" ? (
            <Card>
              <CardHeader
                title="Notifications"
                description="Alertes de la plateforme et des entreprises clientes."
                actions={
                  unread ? (
                    <ConfirmAction action={markNotificationsRead} payload={{ id: "all" }} label="Tout marquer comme lu" variant="secondary" confirmVariant="primary" confirmLabel="Tout marquer comme lu" title={`Marquer ${unread} notification(s) comme lues ?`}>
                      <p className="text-[14px] text-muted">Les notifications resteront consultables dans cette liste.</p>
                    </ConfirmAction>
                  ) : null
                }
              />
              <CardBody className="pt-3">
                {(() => {
                  const list = listNotifications(null);
                  const orgs = new Map(listOrganizations().map((o) => [o.id, o.name]));
                  if (list.length === 0) return <EmptyState title="Aucune notification" icon={<Bell />} />;
                  return (
                    <ul className="flex flex-col divide-y divide-line">
                      {list.map((n) => (
                        <li key={n.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
                          <span aria-hidden className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-line-strong" : n.level === "critical" ? "bg-danger" : n.level === "warning" ? "bg-warning" : "bg-info")} />
                          <div className="min-w-0 flex-1">
                            <p className={cn("text-[14px]", !n.readAt && "font-medium")}>{n.title}</p>
                            <p className="mt-0.5 text-[13px] text-muted">{n.body}</p>
                            <p className="mt-1 font-ui text-[12px] text-faint">
                              {n.organizationId ? `${orgs.get(n.organizationId) ?? n.organizationId} · ` : "Interne ATIE · "}
                              {formatRelative(n.createdAt)}
                              {n.readAt ? " · lue" : ""}
                            </p>
                          </div>
                          {!n.readAt ? (
                            <ConfirmAction action={markNotificationsRead} payload={{ id: n.id }} label="Marquer lue" variant="ghost" confirmVariant="primary" confirmLabel="Marquer comme lue" title="Marquer cette notification comme lue ?" />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  );
                })()}
              </CardBody>
            </Card>
          ) : null}

          {section === "alertes" ? (
            <div className="flex max-w-3xl flex-col gap-6">
              <Card>
                <CardHeader title="Alertes de consommation" description="Seuil global appliqué aux nouveaux abonnements ; chaque abonnement peut avoir son propre seuil." />
                <CardBody>
                  <ReadOnly show={!canSettings} />
                  <ActionForm action={saveAlertSettings}>
                    <fieldset disabled={!canSettings} className="grid gap-5 sm:grid-cols-2">
                      <legend className="sr-only">Alertes</legend>
                      <TextField label="Seuil d’alerte (%)" name="quotaAlertPct" type="number" min={50} max={100} required defaultValue={settings.quotaAlertPct} />
                      <TextField label="Destinataire interne" name="notifyEmail" type="email" required defaultValue={settings.notifyEmail} hint="Aucun e-mail n’est envoyé en démonstration." />
                    </fieldset>
                    {canSettings ? (
                      <div className="mt-6 flex justify-end border-t border-line pt-5">
                        <SubmitButton>Enregistrer</SubmitButton>
                      </div>
                    ) : null}
                  </ActionForm>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Entreprises au-dessus de leur seuil" />
                <CardBody className="pt-3">
                  {(() => {
                    const over = listOrganizations()
                      .map((o) => ({ o, q: quotaForOrg(o.id) }))
                      .filter((x) => x.q.alert !== "none");
                    if (!over.length) return <EmptyState title="Aucune entreprise en alerte" />;
                    return (
                      <ul className="flex flex-col divide-y divide-line">
                        {over.map(({ o, q }) => (
                          <li key={o.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                            <Link href={`/admin/entreprises/${o.id}?tab=abonnement`} className="truncate text-[13.5px] font-medium hover:text-accent-ink">
                              {o.name}
                            </Link>
                            <Badge tone={q.alert === "exhausted" ? "danger" : "warning"}>{q.pctUsed} %</Badge>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </CardBody>
              </Card>
            </div>
          ) : null}

          {section === "audit" ? (
            can(v.role, "audit.read") ? (
              <Card>
                <CardHeader title="Journal d’audit" description="Actions administratives enregistrées. Journalisation limitée : aucun contenu de conversation, aucun secret." />
                {(() => {
                  const orgs = new Map(listOrganizations().map((o) => [o.id, o.name]));
                  const events = listAuditEvents();
                  const actions = [...new Set(events.map((e) => e.action.split(".")[0]))];
                  return (
                    <DataTable
                      caption="Journal d’audit"
                      searchPlaceholder="Action, cible, auteur…"
                      pageSize={15}
                      defaultSort={{ key: "at", dir: "desc" }}
                      filters={[
                        { key: "domain", label: "Domaine", options: actions.map((a) => ({ value: a, label: a })) },
                        { key: "org", label: "Entreprise", options: [...orgs].map(([value, label]) => ({ value, label })) },
                      ]}
                      columns={[
                        { key: "at", label: "Date", sortable: true },
                        { key: "action", label: "Action", sortable: true },
                        { key: "target", label: "Cible", sortable: true },
                        { key: "detail", label: "Détail", hideBelow: "lg" },
                        { key: "actor", label: "Auteur", sortable: true, hideBelow: "md" },
                      ]}
                      rows={events.map((e): Row => {
                        const actor = getUser(e.actorId)?.fullName ?? e.actorId;
                        return {
                          id: e.id,
                          search: `${e.action} ${e.target} ${e.detail} ${actor}`,
                          filters: { domain: e.action.split(".")[0], org: e.organizationId ?? "" },
                          sort: { at: e.at, action: e.action, target: e.target, actor },
                          cells: {
                            at: <span className="whitespace-nowrap">{formatDateTime(e.at)}</span>,
                            action: <code className="rounded bg-surface-3 px-1.5 py-0.5 font-ui text-[12px]">{e.action}</code>,
                            target: (
                              <span>
                                {e.target}
                                {e.organizationId ? <span className="block font-ui text-[12px] text-faint">{orgs.get(e.organizationId)}</span> : null}
                              </span>
                            ),
                            detail: <span className="text-muted">{e.detail || "—"}</span>,
                            actor,
                          },
                        };
                      })}
                    />
                  );
                })()}
              </Card>
            ) : (
              <Notice kind="warning" title="Accès restreint">
                Le journal d’audit est réservé aux administrateurs ATIE.
              </Notice>
            )
          ) : null}

          {section === "fournisseurs" ? (
            <div className="flex flex-col gap-6">
              <Notice kind="privacy" title="Aucun secret dans la console">
                Les clés LiveKit, LemonSlice et des autres fournisseurs restent dans l’environnement du backend Python. Seul leur statut de configuration est affiché ; une clé n’est jamais lue, affichée ni journalisée ici.
              </Notice>
              <div className="grid gap-4 md:grid-cols-2">
                {listProviderStatuses().map((p) => (
                  <Card key={p.id}>
                    <CardHeader title={p.label} actions={<StatusBadge status={CONNECTION_STATUS[p.connection]} />} />
                    <CardBody>
                      <DefinitionList
                        items={[
                          ["Configuré", p.configured ? <Badge tone="success">Oui</Badge> : <Badge>Non</Badge>],
                          ["Clé", p.keyHint ? <span className="tabular">••••{p.keyHint}</span> : <span className="text-muted">Non exposée</span>],
                        ]}
                      />
                      <p className="mt-4 text-[13px] text-muted">{p.note}</p>
                    </CardBody>
                  </Card>
                ))}
              </div>
            </div>
          ) : null}

          {section === "services" ? (
            <div className="flex flex-col gap-6">
              <NotConnected what="Supervision en temps réel">Les états ci-dessous sont ceux de la démonstration. La supervision réelle sera fournie par le backend (GET /health) une fois la console connectée.</NotConnected>
              <Card>
                <CardHeader title="État des services" />
                <CardBody className="pt-3">
                  <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {listProviderStatuses().map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3">
                        <span className="min-w-0 truncate text-[13.5px] font-medium">{p.label}</span>
                        <StatusBadge status={CONNECTION_STATUS[p.connection]} />
                      </li>
                    ))}
                  </ul>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Incidents" description="Historique des incidents techniques (démo)" />
                <CardBody className="pt-3">
                  {(() => {
                    const list = listIncidents();
                    if (!list.length) return <EmptyState title="Aucun incident" />;
                    return (
                      <ul className="flex flex-col divide-y divide-line">
                        {list.map((i) => (
                          <li key={i.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                            <AlertTriangle aria-hidden className={cn("mt-0.5 size-4 shrink-0", i.status === "resolved" ? "text-faint" : i.severity === "major" ? "text-danger" : "text-warning")} />
                            <div className="min-w-0 flex-1">
                              <p className="text-[13.5px] font-medium">{i.title}</p>
                              <p className="font-ui text-[12px] text-faint">
                                {SERVICE_LABEL[i.service]} · {i.severity === "major" ? "Majeur" : "Mineur"} · début {formatDateTime(i.startedAt)}
                                {i.resolvedAt ? ` · résolu le ${formatDate(i.resolvedAt)}` : ""}
                              </p>
                            </div>
                            <Badge tone={i.status === "resolved" ? "success" : i.status === "open" ? "danger" : "warning"}>
                              {i.status === "resolved" ? "Résolu" : i.status === "open" ? "Ouvert" : "Surveillance"}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    );
                  })()}
                </CardBody>
              </Card>
            </div>
          ) : null}

          {section === "securite" ? (
            <div className="flex max-w-3xl flex-col gap-6">
              <Card>
                <CardHeader title="Paramètres de sécurité" />
                <CardBody>
                  <ReadOnly show={!canSettings} />
                  <ActionForm action={saveSecuritySettings}>
                    <fieldset disabled={!canSettings} className="flex flex-col gap-5">
                      <legend className="sr-only">Sécurité</legend>
                      <Checkbox
                        name="require2fa"
                        defaultChecked={settings.require2fa}
                        label="Double authentification obligatoire"
                        description="Exigée pour tous les comptes ATIE et clients en production. Non appliquée en démonstration (pas d’authentification réelle)."
                      />
                      <TextField
                        label="Durée d’une session (minutes)"
                        name="sessionTimeoutMinutes"
                        type="number"
                        min={5}
                        max={720}
                        required
                        defaultValue={settings.sessionTimeoutMinutes}
                        hint="Au-delà, l’utilisateur doit se reconnecter. S’applique aux prochaines connexions."
                        className="sm:max-w-xs"
                      />
                    </fieldset>
                    {canSettings ? (
                      <div className="mt-6 flex justify-end border-t border-line pt-5">
                        <SubmitButton>Enregistrer</SubmitButton>
                      </div>
                    ) : null}
                  </ActionForm>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Protection des données" />
                <CardBody className="flex flex-col gap-4 text-[13.5px]">
                  <ul className="flex list-disc flex-col gap-2 pl-5 text-muted">
                    <li>Principes de la loi fédérale sur la protection des données (LPD) : finalité, proportionnalité, transparence, sécurité.</li>
                    <li>Séparation stricte des entreprises : chaque Knowledge Base et chaque demande reste dans son tenant.</li>
                    <li>Conservation des demandes visiteurs configurable ({settings.defaultRetentionDays} jours par défaut), puis suppression.</li>
                    <li>Transcriptions désactivées par défaut ; jamais générées en démonstration.</li>
                    <li>Journalisation limitée : actions administratives seulement, sans contenu de conversation ni secret.</li>
                  </ul>
                  <Notice kind="warning">Cette interface ne constitue pas une garantie de conformité juridique. La conformité doit être évaluée avec un conseil spécialisé.</Notice>
                </CardBody>
              </Card>
              <Card>
                <CardHeader title="Données de démonstration" description={`Générées le ${formatDateTime(getDemoMeta().generatedAt)} · version ${getDemoMeta().version}`} />
                <CardBody>
                  {can(v.role, "demo.reset") ? (
                    <ConfirmAction
                      action={resetDemoData}
                      payload={{}}
                      label="Réinitialiser les données de démonstration"
                      icon={<RotateCcw aria-hidden />}
                      size="md"
                      confirmLabel="Réinitialiser"
                      title="Réinitialiser toutes les données de démonstration ?"
                    >
                      <p className="text-[14px] text-muted">
                        Toutes les modifications locales (formules, abonnements, demandes, journal…) seront remplacées par le jeu de données fictif d’origine. Aucun système externe n’est concerné.
                      </p>
                    </ConfirmAction>
                  ) : (
                    <Notice kind="info">Réservé au super administrateur ATIE.</Notice>
                  )}
                </CardBody>
              </Card>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
