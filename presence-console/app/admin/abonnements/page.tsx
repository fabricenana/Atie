import Link from "next/link";
import type { Metadata } from "next";
import { Check, Clock, Layers, Plus, Server, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import {
  getUser,
  listConcurrency,
  listOrganizations,
  listPlans,
  listProviderUsage,
  listSubscriptions,
  listTopups,
  quotaForOrg,
} from "@/lib/repositories";
import { activateConcurrency, assignPlan, createTopup, decideTopup } from "@/lib/actions/plans";
import { formatCHF, formatDate, formatNumber } from "@/lib/format";
import { PLAN_APPROVAL, SUBSCRIPTION_STATUS, TOPUP_STATUS } from "@/lib/labels";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs } from "@/components/ui/Tabs";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, OriginTag, StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { DataTable, type Row } from "@/components/ui/DataTable";
import { Meter } from "@/components/ui/Charts";
import { Notice, NotConnected } from "@/components/ui/Notice";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { SelectField, TextField } from "@/components/ui/FormFields";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubscriptionEditButton } from "@/components/admin/plans-subscription-edit";

export const metadata: Metadata = { title: "Abonnements et tarification" };

const TABS = ["formules", "abonnements", "recharges", "concurrence"] as const;
type Tab = (typeof TABS)[number];

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const v = await requireAdmin();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "formules";
  const canPlan = can(v.role, "plan.write");
  const canSub = can(v.role, "subscription.write");

  const plans = listPlans();
  const subs = listSubscriptions();
  const orgs = listOrganizations();
  const orgName = new Map(orgs.map((o) => [o.id, o.name]));
  const topups = [...listTopups()].sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const concurrency = listConcurrency();
  const pendingTopups = topups.filter((t) => t.status === "pending" || t.status === "requested").length;

  const quotas = subs.filter((s) => s.status !== "canceled").map((s) => quotaForOrg(s.organizationId));
  const commercialIncluded = quotas.reduce((n, q) => n + q.includedMinutes + q.topupMinutes, 0);
  const commercialUsed = quotas.reduce((n, q) => n + q.usedMinutes, 0);
  const providers = listProviderUsage();

  const href = (t: Tab) => `/admin/abonnements?tab=${t}`;

  return (
    <>
      <PageHeader
        title="Abonnements et tarification"
        description="Formules, quotas de minutes, recharges et concurrence. Les modifications restent locales : aucune opération financière réelle."
        breadcrumbs={[{ label: "Tableau de bord", href: "/admin" }, { label: "Abonnements" }]}
        actions={
          canPlan ? (
            <ButtonLink href="/admin/abonnements/formules/nouvelle" variant="primary">
              <Plus aria-hidden /> Nouvelle formule
            </ButtonLink>
          ) : null
        }
      />

      {/* Séparation des deux sources de minutes */}
      <div className="mb-8 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Users className="size-4 text-red" aria-hidden /> Quotas commerciaux clients
              </span>
            }
            description="Minutes incluses dans les formules vendues et recharges appliquées, période en cours."
            actions={<OriginTag origin="demo" />}
          />
          <CardBody>
            <div className="flex items-baseline justify-between gap-3">
              <span className="tabular font-head text-[24px] font-semibold">
                {formatNumber(Math.round(commercialUsed))} <span className="text-[15px] font-normal text-muted">/ {formatNumber(commercialIncluded)} min</span>
              </span>
              <span className="font-ui text-[12.5px] text-muted">{quotas.length} abonnements</span>
            </div>
            <Meter className="mt-3" value={commercialUsed} max={commercialIncluded} label="Consommation commerciale totale" />
            <p className="mt-3 text-[12.5px] text-muted">Valeur affichée à titre indicatif : le backend Python fait foi pour les quotas appliqués aux sessions.</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Server className="size-4 text-muted" aria-hidden /> Minutes facturées par les fournisseurs
              </span>
            }
            description="LiveKit, LemonSlice et LiveKit Inference : coûts réels d’ATIE, distincts des quotas clients."
          />
          <CardBody className="flex flex-col gap-3">
            <ul className="grid gap-2 sm:grid-cols-3">
              {providers.map((p) => (
                <li key={p.id} className="rounded-xl border border-dashed border-line-strong px-3 py-2.5">
                  <p className="font-ui text-[12px] text-muted">{p.provider === "livekit" ? "LiveKit" : p.provider === "lemonslice" ? "LemonSlice" : "Inference"}</p>
                  <p className="tabular mt-0.5 font-head text-[18px] font-semibold">{p.minutesUsed === null ? "—" : formatNumber(p.minutesUsed)}</p>
                </li>
              ))}
            </ul>
            <NotConnected what="Consommation fournisseurs">Aucune donnée réelle : les comptes fournisseurs ne sont pas connectés à la console.</NotConnected>
          </CardBody>
        </Card>
      </div>

      <Tabs
        label="Rubriques des abonnements"
        current={tab}
        tabs={[
          { key: "formules", label: "Formules", href: href("formules"), count: plans.length },
          { key: "abonnements", label: "Abonnements", href: href("abonnements"), count: subs.length },
          { key: "recharges", label: "Recharges", href: href("recharges"), count: pendingTopups || undefined },
          { key: "concurrence", label: "Concurrence", href: href("concurrence"), count: concurrency.length },
        ]}
      />

      {tab === "formules" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-4 sm:grid-cols-2">
            {plans.map((p) => (
              <Link
                key={p.id}
                href={`/admin/abonnements/formules/${p.id}`}
                className="group flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition-[border-color,transform] duration-150 hover:-translate-y-px hover:border-line-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-[17px] font-semibold group-hover:text-accent-ink">{p.name}</h2>
                    <p className="font-ui text-[12px] text-faint">{p.code}</p>
                  </div>
                  <StatusBadge status={PLAN_APPROVAL[p.approval]} />
                </div>
                <p className="mt-5 flex items-baseline gap-1">
                  <span className="tabular font-head text-[28px] font-semibold">{formatCHF(p.monthlyPriceCents)}</span>
                  <span className="text-[13px] text-muted">/ mois</span>
                </p>
                <ul className="mt-4 flex flex-col gap-2 text-[13.5px]">
                  <li className="flex items-center gap-2">
                    <Clock className="size-4 text-faint" aria-hidden /> <span className="tabular font-medium">{formatNumber(p.includedMinutes)}</span> minutes incluses
                  </li>
                  <li className="flex items-center gap-2">
                    <Layers className="size-4 text-faint" aria-hidden /> {p.concurrentSessions} conversation{p.concurrentSessions > 1 ? "s" : ""} simultanée{p.concurrentSessions > 1 ? "s" : ""}
                  </li>
                </ul>
                <p className="mt-4 flex-1 text-[13px] text-muted">{p.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 font-ui text-[12px] text-faint">
                  <span>{subs.filter((s) => s.planId === p.id).length} abonnement(s)</span>
                  {p.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
                </div>
              </Link>
            ))}
          </div>
          <Card className="self-start">
            <CardHeader title="Politique commerciale" description="Rappel pour la configuration des formules" />
            <CardBody>
              <ul className="flex flex-col gap-2.5 text-[13.5px]">
                {[
                  "Facturation mensuelle en CHF.",
                  "Aucun frais d’installation.",
                  "ATIE effectue la configuration pour ses clients.",
                  "Les fonctions essentielles sont communes à toutes les formules.",
                  "La distinction principale est le volume de minutes incluses.",
                  "Recharges de minutes supplémentaires possibles.",
                  "Passage à une formule supérieure à tout moment.",
                  "Conversations simultanées supplémentaires : option distincte.",
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                    {t}
                  </li>
                ))}
              </ul>
              <Notice kind="warning" className="mt-5" title="Tarifs non définitifs">
                Seul Starter (CHF 9.90, 15 min) est confirmé. Premium (CHF 79.90, 250 min) est une hypothèse ; les autres formules sont internes et ne doivent pas être publiées.
              </Notice>
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "abonnements" ? (
        <div className="flex flex-col gap-6">
          <Card>
            <DataTable
              caption="Abonnements des entreprises"
              searchPlaceholder="Rechercher une entreprise…"
              defaultSort={{ key: "pct", dir: "desc" }}
              filters={[
                { key: "status", label: "Statut", options: Object.entries(SUBSCRIPTION_STATUS).map(([value, s]) => ({ value, label: s.label })) },
                { key: "plan", label: "Formule", options: plans.map((p) => ({ value: p.id, label: p.name })) },
              ]}
              columns={[
                { key: "org", label: "Entreprise", sortable: true },
                { key: "plan", label: "Formule", sortable: true },
                { key: "status", label: "Statut" },
                { key: "activated", label: "Activation", sortable: true, hideBelow: "lg" },
                { key: "period", label: "Période", hideBelow: "xl" },
                { key: "pct", label: "Minutes", sortable: true },
                { key: "remaining", label: "Restantes", sortable: true, align: "right", hideBelow: "md" },
                { key: "renew", label: "Renouvellement", hideBelow: "lg" },
                { key: "actions", label: "Actions", align: "right" },
              ]}
              rows={subs.map((s): Row => {
                const q = quotaForOrg(s.organizationId);
                const plan = plans.find((p) => p.id === s.planId);
                const total = q.includedMinutes + q.topupMinutes;
                const name = orgName.get(s.organizationId) ?? s.organizationId;
                return {
                  id: s.id,
                  search: `${name} ${plan?.name ?? ""}`,
                  filters: { status: s.status, plan: s.planId },
                  sort: { org: name, plan: plan?.name ?? "", activated: s.activatedAt, pct: q.pctUsed, remaining: q.remainingMinutes },
                  cells: {
                    org: (
                      <Link href={`/admin/entreprises/${s.organizationId}?tab=abonnement`} className="font-medium hover:text-accent-ink">
                        {name}
                      </Link>
                    ),
                    plan: (
                      <span>
                        {plan?.name ?? "—"} <span className="block font-ui text-[12px] text-faint">{plan ? formatCHF(plan.monthlyPriceCents) : ""} / mois</span>
                      </span>
                    ),
                    status: <StatusBadge status={SUBSCRIPTION_STATUS[s.status]} />,
                    activated: formatDate(s.activatedAt),
                    period: (
                      <span className="whitespace-nowrap">
                        {formatDate(s.currentPeriodStart)} → {formatDate(s.currentPeriodEnd)}
                      </span>
                    ),
                    pct: (
                      <div className="min-w-36">
                        <div className="mb-1.5 flex items-center justify-between gap-2 font-ui text-[12px]">
                          <span className="tabular">
                            {formatNumber(q.usedMinutes)} / {formatNumber(total)}
                          </span>
                          {q.alert === "exhausted" ? <Badge tone="danger">Épuisé</Badge> : q.alert === "warning" ? <Badge tone="warning">Alerte {s.alertThresholdPct} %</Badge> : null}
                        </div>
                        <Meter size="sm" value={q.usedMinutes} max={total} label={`Minutes utilisées par ${name}`} />
                      </div>
                    ),
                    remaining: `${formatNumber(q.remainingMinutes)} min`,
                    renew: s.autoRenew ? "Automatique" : "Manuel",
                    actions: canSub ? (
                      <SubscriptionEditButton
                        subscriptionId={s.id}
                        orgName={name}
                        planId={s.planId}
                        alertThresholdPct={s.alertThresholdPct}
                        autoRenew={s.autoRenew}
                        plans={plans.map((p) => ({ value: p.id, label: `${p.name} — ${formatCHF(p.monthlyPriceCents)} / ${p.includedMinutes} min${p.active ? "" : " (inactive)"}`, disabled: !p.active && p.id !== s.planId }))}
                      />
                    ) : (
                      <span className="font-ui text-[12px] text-faint">Lecture seule</span>
                    ),
                  },
                };
              })}
            />
          </Card>

          <Card>
            <CardHeader title="Attribuer une formule" description="Pour une entreprise qui n’a pas encore d’abonnement. Aucune facture n’est émise." />
            <CardBody>
              {(() => {
                const without = orgs.filter((o) => !subs.some((s) => s.organizationId === o.id && s.status !== "canceled"));
                if (!canSub) return <Notice kind="info">Votre rôle permet la consultation seulement.</Notice>;
                if (without.length === 0) return <EmptyState title="Toutes les entreprises ont un abonnement" />;
                return (
                  <ActionForm action={assignPlan} className="grid gap-5 md:grid-cols-[repeat(4,minmax(0,1fr))_auto] md:items-end">
                    <SelectField label="Entreprise" name="organizationId" required options={[{ value: "", label: "Choisir…" }, ...without.map((o) => ({ value: o.id, label: o.name }))]} />
                    <SelectField label="Formule" name="planId" required options={[{ value: "", label: "Choisir…" }, ...plans.filter((p) => p.active).map((p) => ({ value: p.id, label: `${p.name} — ${formatCHF(p.monthlyPriceCents)}` }))]} />
                    <TextField label="Date d’activation" name="activatedAt" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
                    <SelectField label="Statut initial" name="status" options={[{ value: "trialing", label: "Essai" }, { value: "active", label: "Actif" }]} defaultValue="trialing" />
                    <SubmitButton>Attribuer</SubmitButton>
                  </ActionForm>
                );
              })()}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "recharges" ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <Card>
            <DataTable
              caption="Recharges de minutes"
              searchPlaceholder="Rechercher une entreprise…"
              defaultSort={{ key: "requested", dir: "desc" }}
              filters={[{ key: "status", label: "Statut", options: Object.entries(TOPUP_STATUS).map(([value, s]) => ({ value, label: s.label })) }]}
              emptyTitle="Aucune recharge"
              columns={[
                { key: "org", label: "Entreprise", sortable: true },
                { key: "minutes", label: "Minutes", sortable: true, align: "right" },
                { key: "price", label: "Prix", sortable: true, align: "right" },
                { key: "status", label: "Statut" },
                { key: "requested", label: "Demandée", sortable: true, hideBelow: "md" },
                { key: "by", label: "Par", hideBelow: "lg" },
                { key: "actions", label: "Actions", align: "right" },
              ]}
              rows={topups.map((t): Row => {
                const name = orgName.get(t.organizationId) ?? t.organizationId;
                const open = t.status === "pending" || t.status === "requested";
                return {
                  id: t.id,
                  search: name,
                  filters: { status: t.status },
                  sort: { org: name, minutes: t.minutes, price: t.priceCents, requested: t.requestedAt },
                  cells: {
                    org: name,
                    minutes: formatNumber(t.minutes),
                    price: formatCHF(t.priceCents),
                    status: <StatusBadge status={TOPUP_STATUS[t.status]} />,
                    requested: formatDate(t.requestedAt),
                    by: getUser(t.requestedBy)?.fullName ?? "—",
                    actions:
                      open && canSub ? (
                        <div className="flex justify-end gap-1.5">
                          <ConfirmAction
                            action={decideTopup}
                            payload={{ id: t.id, decision: "apply" }}
                            label="Appliquer"
                            variant="primary"
                            confirmVariant="primary"
                            confirmLabel="Appliquer la recharge"
                            title={`Appliquer ${t.minutes} min à ${name} ?`}
                          >
                            <p className="text-[14px] text-muted">
                              Les minutes sont ajoutées au quota de la période en cours (démonstration). Aucun paiement n’est encaissé et aucune facture officielle n’est émise.
                            </p>
                          </ConfirmAction>
                          <ConfirmAction action={decideTopup} payload={{ id: t.id, decision: "reject" }} label="Refuser" variant="ghost" confirmLabel="Refuser" title={`Refuser la recharge de ${name} ?`} />
                        </div>
                      ) : (
                        <span className="font-ui text-[12px] text-faint">{t.appliedAt ? `Appliquée le ${formatDate(t.appliedAt)}` : "—"}</span>
                      ),
                  },
                };
              })}
            />
          </Card>
          <Card className="self-start">
            <CardHeader title="Préparer une recharge" description="Créée en attente, à appliquer ensuite." />
            <CardBody>
              {canSub ? (
                <ActionForm action={createTopup} resetOnSuccess className="flex flex-col gap-5">
                  <SelectField label="Entreprise" name="organizationId" required options={[{ value: "", label: "Choisir…" }, ...orgs.map((o) => ({ value: o.id, label: o.name }))]} />
                  <TextField label="Minutes" name="minutes" type="number" min={10} step={10} required defaultValue={50} />
                  <TextField label="Prix (CHF)" name="price" inputMode="decimal" required defaultValue="15.00" hint="Prix de démonstration, non publié." />
                  <SubmitButton>Préparer la recharge</SubmitButton>
                </ActionForm>
              ) : (
                <Notice kind="info">Votre rôle permet la consultation seulement.</Notice>
              )}
            </CardBody>
          </Card>
        </div>
      ) : null}

      {tab === "concurrence" ? (
        <div className="flex flex-col gap-6">
          <Notice kind="info" title="Option distincte des formules">
            Chaque formule inclut un nombre de conversations simultanées. Une capacité supplémentaire se souscrit séparément ; la limite effective est appliquée par le backend Python lors de la réservation des places.
          </Notice>
          <Card>
            {concurrency.length === 0 ? (
              <EmptyState title="Aucune option de concurrence" />
            ) : (
              <DataTable
                caption="Options de concurrence"
                columns={[
                  { key: "org", label: "Entreprise", sortable: true },
                  { key: "included", label: "Incluses", align: "right" },
                  { key: "extra", label: "Supplémentaires", align: "right" },
                  { key: "price", label: "Prix mensuel", align: "right" },
                  { key: "starts", label: "Début", hideBelow: "md" },
                  { key: "status", label: "Statut" },
                  { key: "actions", label: "Actions", align: "right" },
                ]}
                rows={concurrency.map((c): Row => {
                  const name = orgName.get(c.organizationId) ?? c.organizationId;
                  const q = quotaForOrg(c.organizationId);
                  return {
                    id: c.id,
                    search: name,
                    sort: { org: name },
                    cells: {
                      org: name,
                      included: q.plan?.concurrentSessions ?? "—",
                      extra: `+${c.extraSessions}`,
                      price: formatCHF(c.monthlyPriceCents),
                      starts: formatDate(c.startsAt),
                      status: <Badge tone={c.status === "active" ? "success" : c.status === "requested" ? "info" : "neutral"}>{c.status === "active" ? "Active" : c.status === "requested" ? "Demandée" : "Terminée"}</Badge>,
                      actions:
                        c.status === "requested" && canSub ? (
                          <ConfirmAction
                            action={activateConcurrency}
                            payload={{ id: c.id }}
                            label="Activer"
                            variant="primary"
                            confirmVariant="primary"
                            confirmLabel="Activer l’option"
                            title={`Activer +${c.extraSessions} conversation(s) simultanée(s) pour ${name} ?`}
                          >
                            <p className="text-[14px] text-muted">Activation locale de démonstration, sans facturation ni modification du backend.</p>
                          </ConfirmAction>
                        ) : (
                          <span className="font-ui text-[12px] text-faint">—</span>
                        ),
                    },
                  };
                })}
              />
            )}
          </Card>
        </div>
      ) : null}
    </>
  );
}
