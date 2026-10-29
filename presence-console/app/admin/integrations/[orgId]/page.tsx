import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, Globe, ShieldCheck, XCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getAvatar, getOrganization, getWidgetForOrg, listDomainsForOrg, listProviderStatuses, listReceptionists } from "@/lib/repositories";
import { checkDomain, updateWidget } from "@/lib/actions/integrations";
import { CONNECTION_STATUS, WIDGET_STATUS } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardBody, CardHeader, DefinitionList } from "@/components/ui/Card";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Notice, NotConnected } from "@/components/ui/Notice";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { SelectField, TextField } from "@/components/ui/FormFields";
import { ConfirmAction } from "@/components/ui/ConfirmAction";
import { ButtonLink } from "@/components/ui/Button";
import { IntegrationCode } from "@/components/admin/integration-copy";
import { IntegrationPreview } from "@/components/admin/integration-preview";

type Params = { params: Promise<{ orgId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { orgId } = await params;
  return { title: `Intégration — ${(await getOrganization(orgId))?.name ?? "Entreprise"}` };
}

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

export default async function IntegrationDetail({ params }: Params) {
  const v = await requireAdmin("admin.access");
  const { orgId } = await params;
  const org = await getOrganization(orgId);
  if (!org) notFound();
  const [widget, domains, allReceptionists, statuses] = await Promise.all([
    getWidgetForOrg(org.id),
    listDomainsForOrg(org.id),
    listReceptionists(),
    listProviderStatuses(),
  ]);
  const receptionists = allReceptionists.filter((r) => r.organizationId === org.id);
  const rcp = receptionists.find((r) => r.id === widget?.receptionistId) ?? null;
  const avatar = rcp ? await getAvatar(rcp.avatarId) : null;
  const api = statuses.find((p) => p.provider === "atie_api");
  const canWrite = can(v.role, "integration.write");
  const status = widget?.status ?? "not_configured";
  const position = widget?.position ?? "right";
  const accent = widget?.accent ?? "#E31E24";
  const mainDomain = domains.find((d) => d.verified)?.domain ?? domains[0]?.domain ?? "site-client.example";

  const attrs = [
    `  src="https://cdn.atie.example/presence/atie-presence.js"`,
    `  defer`,
    `  data-api="https://api.atie.example"`,
    `  data-tenant="${escapeAttr(org.slug)}"`,
    `  data-avatar-name="${escapeAttr(rcp?.name ?? "Léa")}"`,
    ...(avatar?.portraitUrl ? [`  data-avatar-image="https://cdn.atie.example/presence${escapeAttr(avatar.portraitUrl.replace("/presence", ""))}"`] : []),
    `  data-lang="${rcp?.primaryLang ?? "fr"}"`,
    `  data-position="${position}"`,
    `  data-accent="${accent}"`,
  ];
  const script = `<!-- ATIE Presence — ${org.name} (identifiant public : ${widget?.publicKey ?? "à générer"}) -->
<!-- data-api : URL de l’API ATIE, à définir avant toute mise en ligne. -->
<!-- Aucun secret : le jeton de session est émis à la demande par l’API ATIE. -->
<script
${attrs.join("\n")}
></script>`;

  const wordpress = `<?php
// ATIE Presence — ${org.name}
// À placer dans une extension ou dans functions.php du thème enfant.
add_action( 'wp_enqueue_scripts', function () {
\twp_enqueue_script( 'atie-presence', 'https://cdn.atie.example/presence/atie-presence.js', array(), null, array( 'strategy' => 'defer', 'in_footer' => true ) );
} );
add_filter( 'script_loader_tag', function ( $tag, $handle ) {
\tif ( 'atie-presence' !== $handle ) {
\t\treturn $tag;
\t}
\t$attrs = ' data-api="https://api.atie.example"' // à définir
\t\t. ' data-tenant="${escapeAttr(org.slug)}"'
\t\t. ' data-avatar-name="${escapeAttr(rcp?.name ?? "Léa")}"'
\t\t. ' data-lang="${rcp?.primaryLang ?? "fr"}"'
\t\t. ' data-position="${position}"'
\t\t. ' data-accent="${accent}"';
\treturn str_replace( ' src=', $attrs . ' src=', $tag );
}, 10, 2 );`;

  const checks: Array<[string, boolean, string]> = [
    ["Réceptionniste assignée", Boolean(rcp), rcp ? `${rcp.name} — ${rcp.role}` : "Aucune réceptionniste assignée"],
    ["Domaine vérifié", domains.some((d) => d.verified), domains.some((d) => d.verified) ? "Au moins un domaine autorisé est vérifié" : "Aucun domaine vérifié"],
    ["Identifiant public", Boolean(widget), widget ? widget.publicKey : "Sera généré à l’enregistrement"],
    ["API ATIE connectée", api?.connection === "ok", "Console non connectée : data-api reste à définir"],
  ];

  return (
    <>
      <PageHeader
        title={`Intégration — ${org.name}`}
        description="Préparer l’installation du widget sur le site de l’entreprise."
        breadcrumbs={[{ label: "Intégrations", href: "/admin/integrations" }, { label: org.name }]}
        meta={<StatusBadge status={WIDGET_STATUS[status]} />}
        actions={<ButtonLink href={`/admin/entreprises/${org.id}?tab=domaines`}>Domaines de l’entreprise</ButtonLink>}
      />

      <Notice kind="info" title="Préparation uniquement" className="mb-6">
        Aucun widget n’est publié en production depuis cette page et aucune clé secrète n’apparaît dans le code d’intégration. Le statut
        « Installé » est déclaré par ATIE : il n’est pas encore confirmé automatiquement par le backend.
      </Notice>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="État de configuration" />
            <CardBody className="pt-3">
              <ul className="flex flex-col divide-y divide-line">
                {checks.map(([label, ok, detail]) => (
                  <li key={label} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                    {ok ? <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-success" /> : <XCircle aria-hidden className="mt-0.5 size-4 shrink-0 text-faint" />}
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium">
                        {label} <span className="sr-only">{ok ? "(conforme)" : "(à compléter)"}</span>
                      </p>
                      <p className="break-words text-[13px] text-muted">{detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Script d’intégration" description="Mode générique : à coller avant la balise </body> du site." />
            <CardBody className="flex flex-col gap-4">
              <IntegrationCode label="HTML — mode générique" code={script} />
              <p className="text-[13px] text-muted">
                Attributs du widget existant : <code className="font-mono text-[12.5px]">data-tenant</code> identifie l’entreprise (
                <code className="font-mono text-[12.5px]">{org.slug}</code>) ; sans <code className="font-mono text-[12.5px]">data-api</code>, le widget
                reste en mode simulé, sans micro ni appel réseau.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Préparation WordPress" description="Chargement du script via wp_enqueue_script." />
            <CardBody className="flex flex-col gap-4">
              <IntegrationCode label="PHP — WordPress" code={wordpress} />
              <p className="text-[13px] text-muted">Une extension ATIE Presence dédiée pourra remplacer ce fragment ; elle n’est pas encore publiée.</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Aperçu" description="Rendu indicatif sur ordinateur et mobile." />
            <CardBody>
              <IntegrationPreview domain={mainDomain} name={rcp?.name ?? "Léa"} portrait={avatar?.portraitUrl ?? null} position={position} accent={accent} />
            </CardBody>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <CardHeader title="Informations" />
            <CardBody>
              <DefinitionList
                className="sm:grid-cols-1!"
                items={[
                  ["Entreprise", org.name],
                  ["Identifiant tenant", <code key="t" className="font-mono text-[12.5px]">{org.slug}</code>],
                  ["Identifiant public du widget", widget ? <code key="k" className="font-mono text-[12.5px]">{widget.publicKey}</code> : "Non généré"],
                  ["Mode d’installation", widget?.platform === "wordpress" ? "WordPress" : "Générique"],
                  ["Créé le", formatDate(widget?.createdAt)],
                ]}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Domaines autorisés" description="Le widget ne fonctionnera que sur ces domaines." />
            <CardBody className="pt-3">
              {domains.length === 0 ? (
                <p className="text-[13.5px] text-muted">Aucun domaine. Ajoutez-en depuis la fiche entreprise.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {domains.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <Globe aria-hidden className="size-4 shrink-0 text-faint" />
                      <div className="min-w-0 flex-1">
                        <p className="break-all text-[13.5px] font-medium">{d.domain}</p>
                        <p className="font-ui text-[12px] text-faint">{d.verified ? `Vérifié le ${formatDate(d.verifiedAt)}` : "Non vérifié"}</p>
                      </div>
                      {d.verified ? <Badge tone="success">Vérifié</Badge> : <Badge>Non vérifié</Badge>}
                      {canWrite ? (
                        <ConfirmAction
                          action={checkDomain}
                          payload={{ orgId: org.id, domainId: d.id }}
                          label="Vérification"
                          variant="ghost"
                          confirmVariant="primary"
                          icon={<ShieldCheck aria-hidden />}
                          title={`Vérifier ${d.domain}`}
                          confirmLabel="Demander la vérification"
                        >
                          <p className="text-[14px] text-muted">
                            La vérification automatique (enregistrement DNS ou fichier) n’est pas encore connectée : aucune requête n’est envoyée et le
                            statut du domaine n’est pas modifié. Après un contrôle manuel, marquez le domaine comme vérifié dans la fiche entreprise.
                          </p>
                        </ConfirmAction>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Connexion du service" />
            <CardBody className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[13.5px]">{api?.label ?? "API ATIE Presence"}</span>
                <StatusBadge status={CONNECTION_STATUS[api?.connection ?? "not_connected"]} />
              </div>
              <NotConnected what="API ATIE">{api?.note ?? "Définir l’URL de l’API côté serveur."}</NotConnected>
            </CardBody>
          </Card>

          {canWrite ? (
            <Card>
              <CardHeader title="Configuration du widget" description="Enregistrée dans la console ; rien n’est publié automatiquement." />
              <CardBody>
                <ActionForm action={updateWidget} className="flex flex-col gap-4">
                  <input type="hidden" name="orgId" value={org.id} />
                  <SelectField
                    label="Réceptionniste"
                    name="receptionistId"
                    defaultValue={widget?.receptionistId ?? ""}
                    options={[{ value: "", label: "Aucune" }, ...receptionists.map((r) => ({ value: r.id, label: `${r.name} — ${r.role}` }))]}
                  />
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <SelectField
                      label="Position de la bulle"
                      name="position"
                      defaultValue={position}
                      options={[
                        { value: "right", label: "En bas à droite" },
                        { value: "left", label: "En bas à gauche" },
                      ]}
                    />
                    <TextField label="Couleur d’action" name="accent" defaultValue={accent} required pattern="#[0-9a-fA-F]{6}" hint="Format #RRGGBB" />
                  </div>
                  <SelectField
                    label="Mode d’installation"
                    name="platform"
                    defaultValue={widget?.platform ?? "generic"}
                    options={[
                      { value: "generic", label: "Générique (HTML)" },
                      { value: "wordpress", label: "WordPress" },
                    ]}
                  />
                  <SelectField
                    label="État"
                    name="status"
                    defaultValue={status}
                    hint="« Installé » reste indicatif : rien n’est publié depuis la console."
                    options={Object.entries(WIDGET_STATUS).map(([value, s]) => ({ value, label: s.label }))}
                  />
                  <div className="flex justify-end">
                    <SubmitButton>Enregistrer</SubmitButton>
                  </div>
                </ActionForm>
              </CardBody>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
