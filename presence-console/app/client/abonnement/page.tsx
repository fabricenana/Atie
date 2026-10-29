import Link from "next/link";
import type { Metadata } from "next";
import { Check, Users, Zap } from "lucide-react";
import { requireClient } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { listConcurrencyForOrg, listInvoicesForOrg, listTopupsForOrg, quotaForOrg } from "@/lib/repositories";
import { activePlans, TOPUP_OPTIONS } from "@/lib/repositories/client";
import { INVOICE_STATUS, PLAN_APPROVAL, SUBSCRIPTION_STATUS, TOPUP_STATUS } from "@/lib/labels";
import { formatCHF, formatDate, formatNumber } from "@/lib/format";
import { requestPlanChange, requestTopup } from "@/lib/actions/client";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/Card";
import { Badge, OriginTag, StatusBadge } from "@/components/ui/Badge";
import { Notice } from "@/components/ui/Notice";
import { EmptyState } from "@/components/ui/EmptyState";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { SelectField, TextAreaField, FieldError } from "@/components/ui/FormFields";
import { DataTable, type Row } from "@/components/ui/DataTable";

export const metadata: Metadata = { title: "Mon abonnement" };

export default async function ClientSubscription() {
  const v = await requireClient();
  const org = v.organization;
  const q = quotaForOrg(org.id);
  const canRequest = can(v.role, "client.topup.request");
  const topups = listTopupsForOrg(org.id).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  const concurrency = listConcurrencyForOrg(org.id);
  const invoices = listInvoicesForOrg(org.id);
  const plans = activePlans().filter((p) => p.approval !== "draft" || p.id === q.plan?.id);

  return (
    <>
      <PageHeader title="Mon abonnement" description="Votre formule, vos options et vos factures. ATIE s’occupe de la configuration, sans frais d’installation." meta={<OriginTag origin="demo" />} />

      <Notice kind="demo" title="Mode demande" className="mb-6">
        Les recharges et changements de formule sont envoyés à ATIE sous forme de demande. Aucun paiement n’est effectué depuis cet espace.
      </Notice>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Formule actuelle" actions={q.subscription ? <StatusBadge status={SUBSCRIPTION_STATUS[q.subscription.status]} /> : undefined} />
          <CardBody>
            {q.plan && q.subscription ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <p className="font-head text-[28px] font-semibold leading-none">{q.plan.name}</p>
                    <p className="mt-2 text-[13.5px] text-muted">{q.plan.description}</p>
                  </div>
                  <p className="tabular font-head text-[24px] font-semibold">
                    {formatCHF(q.plan.monthlyPriceCents)}
                    <span className="ml-1 text-[13px] font-normal text-muted">/ mois</span>
                  </p>
                </div>
                <DefinitionList
                  className="mt-6"
                  items={[
                    ["Minutes incluses", `${formatNumber(q.plan.includedMinutes)} min / mois`],
                    ["Conversations simultanées", formatNumber(q.concurrent)],
                    ["Prochaine échéance", formatDate(q.subscription.currentPeriodEnd)],
                    ["Renouvellement", q.subscription.autoRenew ? "Automatique, chaque mois" : "Non renouvelé"],
                    ["Client depuis", formatDate(q.subscription.activatedAt)],
                    ["Tarif", q.plan.approval === "confirmed" ? "Tarif en vigueur" : PLAN_APPROVAL[q.plan.approval].label],
                  ]}
                />
                <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                  {["Configuration par ATIE incluse", "Quatre langues : FR, DE, IT, EN", "Demandes des visiteurs centralisées", "Assistance ATIE"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[13.5px]">
                      <Check aria-hidden className="size-4 shrink-0 text-success" /> {f}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState title="Aucune formule active" description="ATIE vous proposera une formule à la fin de la configuration." />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Changer de formule" description="La principale différence entre formules est le volume de minutes incluses." />
          <CardBody>
            {canRequest ? (
              <ActionForm action={requestPlanChange} className="flex flex-col gap-5">
                <SelectField
                  label="Formule souhaitée"
                  name="planId"
                  required
                  defaultValue=""
                  options={[
                    { value: "", label: "Choisir une formule…", disabled: true },
                    ...plans.map((p) => ({
                      value: p.id,
                      label: `${p.name} — ${formatCHF(p.monthlyPriceCents)} / mois, ${formatNumber(p.includedMinutes)} min${p.id === q.plan?.id ? " (actuelle)" : ""}${p.approval !== "confirmed" ? " · tarif indicatif" : ""}`,
                      disabled: p.id === q.plan?.id,
                    })),
                  ]}
                />
                <TextAreaField label="Message (facultatif)" name="message" rows={3} maxLength={1000} placeholder="Précisez vos besoins : volume, langues, date souhaitée…" />
                <div className="flex justify-end">
                  <SubmitButton>Envoyer la demande</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <p className="text-[13.5px] text-muted">Seul l’administrateur de votre entreprise peut demander un changement de formule.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card id="recharges" className="scroll-mt-24">
          <CardHeader title="Recharges de minutes" description="Des minutes supplémentaires, valables sur la période en cours" actions={<OriginTag origin="demo" />} />
          <CardBody>
            {canRequest ? (
              <ActionForm action={requestTopup} className="flex flex-col gap-4">
                <fieldset>
                  <legend className="mb-3 font-ui text-[13px] font-medium">Choisir une recharge</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {TOPUP_OPTIONS.map((o, i) => (
                      <label key={o.minutes} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line-strong p-4 transition-colors hover:border-faint has-[:checked]:border-red has-[:checked]:bg-accent-soft">
                        <input type="radio" name="minutes" value={o.minutes} defaultChecked={i === 0} className="size-4 accent-[#e31e24]" />
                        <span>
                          <span className="flex items-center gap-1.5 font-head text-[17px] font-semibold"><Zap aria-hidden className="size-4 text-red" /> {o.minutes} minutes</span>
                          <span className="font-ui text-[12.5px] text-muted">{formatCHF(o.priceCents)} · prix indicatif</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <FieldError name="minutes" />
                </fieldset>
                <div className="flex justify-end">
                  <SubmitButton>Demander la recharge</SubmitButton>
                </div>
              </ActionForm>
            ) : (
              <p className="text-[13.5px] text-muted">Seul l’administrateur de votre entreprise peut demander une recharge.</p>
            )}
            {topups.length ? (
              <ul className="mt-6 flex flex-col divide-y divide-line border-t border-line pt-2">
                {topups.map((t) => (
                  <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <span className="text-[13.5px]">
                      {t.minutes} minutes <span className="text-muted">· demandée le {formatDate(t.requestedAt)}</span>
                    </span>
                    <StatusBadge status={TOPUP_STATUS[t.status]} />
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Options" description="Capacité de conversations en parallèle" />
          <CardBody>
            <div className="flex items-start gap-4 rounded-xl bg-surface-2 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-red"><Users aria-hidden className="size-5" /></span>
              <div className="min-w-0">
                <p className="text-[14px] font-medium">Conversations simultanées supplémentaires</p>
                <p className="mt-1 text-[13px] text-muted">
                  Votre formule permet {formatNumber(q.plan?.concurrentSessions ?? 0)} conversation(s) en même temps. Une capacité supplémentaire peut être ajoutée en option distincte.
                </p>
              </div>
            </div>
            {concurrency.length ? (
              <ul className="mt-4 flex flex-col gap-2">
                {concurrency.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
                    <span>
                      +{c.extraSessions} conversation(s) · {formatCHF(c.monthlyPriceCents)} / mois <span className="text-muted">· dès le {formatDate(c.startsAt)}</span>
                    </span>
                    <Badge tone={c.status === "active" ? "success" : c.status === "requested" ? "info" : "neutral"} dot>
                      {c.status === "active" ? "Active" : c.status === "requested" ? "Demandée" : "Terminée"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-[13px] text-muted">
                Pour ajouter cette option, faites une demande depuis l’<Link href="/client/assistance?type=contact" className="font-medium text-ink underline underline-offset-2">assistance ATIE</Link>.
              </p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Historique des factures" description="Documents de démonstration, sans valeur comptable" actions={<OriginTag origin="demo" />} />
        <DataTable
          caption="Historique des factures"
          searchPlaceholder="Rechercher un numéro…"
          defaultSort={{ key: "date", dir: "desc" }}
          emptyTitle="Aucune facture"
          emptyDescription="Vos factures apparaîtront ici après votre première échéance."
          filters={[{ key: "status", label: "Statut", options: Object.entries(INVOICE_STATUS).map(([value, s]) => ({ value, label: s.label })) }]}
          columns={[
            { key: "number", label: "Numéro", sortable: true },
            { key: "label", label: "Libellé", hideBelow: "md" },
            { key: "date", label: "Émise le", sortable: true },
            { key: "due", label: "Échéance", hideBelow: "sm" },
            { key: "amount", label: "Montant", align: "right", sortable: true },
            { key: "status", label: "Statut" },
          ]}
          rows={invoices.map(
            (i): Row => ({
              id: i.id,
              search: `${i.number} ${i.lines.map((l) => l.label).join(" ")}`,
              filters: { status: i.status },
              sort: { number: i.number, date: i.issuedAt, amount: i.totalCents },
              cells: {
                number: <span className="font-ui font-medium">{i.number}</span>,
                label: <span className="text-muted">{i.lines[0]?.label}</span>,
                date: formatDate(i.issuedAt),
                due: formatDate(i.dueAt),
                amount: formatCHF(i.totalCents),
                status: <StatusBadge status={INVOICE_STATUS[i.status]} />,
              },
            }),
          )}
        />
      </Card>
    </>
  );
}
