import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/permissions";
import { getAvatar, getOrganization, listAvatars, listReceptionists } from "@/lib/repositories";
import { RECEPTIONIST_STATUS } from "@/lib/labels";
import type { ReceptionistStatus } from "@/lib/domain/types";
import { formatDuration, formatRelative, LANG_SHORT } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageHeader } from "@/components/ui/PageHeader";
import { OriginTag, StatusBadge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Portrait } from "@/components/ui/Portrait";

export const metadata: Metadata = { title: "Réceptionnistes" };

export default async function ReceptionistsPage({ searchParams }: { searchParams: Promise<{ status?: string; avatar?: string }> }) {
  const v = await requireAdmin("org.read_all");
  const sp = await searchParams;
  const all = listReceptionists();
  const avatars = listAvatars();
  const status = Object.keys(RECEPTIONIST_STATUS).includes(sp.status ?? "") ? (sp.status as ReceptionistStatus) : null;
  const avatar = avatars.some((a) => a.id === sp.avatar) ? sp.avatar! : null;
  const list = all.filter((r) => (!status || r.status === status) && (!avatar || r.avatarId === avatar));

  const href = (next: { status?: string | null; avatar?: string | null }) => {
    const p = new URLSearchParams();
    const s = next.status === undefined ? status : next.status;
    const a = next.avatar === undefined ? avatar : next.avatar;
    if (s) p.set("status", s);
    if (a) p.set("avatar", a);
    const qs = p.toString();
    return `/admin/receptionnistes${qs ? `?${qs}` : ""}`;
  };
  const chip = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-ui text-[12.5px] font-medium transition-colors",
      active ? "border-red/40 bg-accent-soft text-ink" : "border-line-strong text-muted hover:text-ink",
    );

  return (
    <>
      <PageHeader
        title="Réceptionnistes numériques"
        description="Personnages animés LemonSlice configurés pour les entreprises clientes. Les avatars existants (Léa, Maya) sont réutilisés, jamais recréés."
        meta={<OriginTag origin="demo" />}
        actions={
          can(v.role, "receptionist.write") ? (
            <ButtonLink href="/admin/receptionnistes/nouvelle" variant="primary">
              <Plus aria-hidden /> Nouvelle réceptionniste
            </ButtonLink>
          ) : null
        }
      />

      <div className="mb-6 flex flex-col gap-3">
        <nav aria-label="Filtrer par statut" className="flex flex-wrap gap-2">
          <Link href={href({ status: null })} className={chip(!status)} aria-current={!status ? "true" : undefined}>
            Tous les statuts <span className="tabular text-faint">{all.length}</span>
          </Link>
          {(Object.keys(RECEPTIONIST_STATUS) as ReceptionistStatus[]).map((s) => (
            <Link key={s} href={href({ status: s })} className={chip(status === s)} aria-current={status === s ? "true" : undefined}>
              {RECEPTIONIST_STATUS[s].label} <span className="tabular text-faint">{all.filter((r) => r.status === s).length}</span>
            </Link>
          ))}
        </nav>
        <nav aria-label="Filtrer par avatar" className="flex flex-wrap gap-2">
          <Link href={href({ avatar: null })} className={chip(!avatar)} aria-current={!avatar ? "true" : undefined}>
            Tous les avatars
          </Link>
          {avatars.map((a) => (
            <Link key={a.id} href={href({ avatar: a.id })} className={chip(avatar === a.id)} aria-current={avatar === a.id ? "true" : undefined}>
              {a.name}
            </Link>
          ))}
        </nav>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState title="Aucune réceptionniste" description="Aucune réceptionniste ne correspond à ces filtres." action={<ButtonLink href="/admin/receptionnistes">Réinitialiser les filtres</ButtonLink>} />
        </Card>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((r) => {
            const av = getAvatar(r.avatarId);
            const org = r.organizationId ? getOrganization(r.organizationId) : null;
            return (
              <li key={r.id}>
                <Link
                  href={`/admin/receptionnistes/${r.id}`}
                  className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong"
                >
                  <div className="relative aspect-[16/11] overflow-hidden">
                    <Portrait src={av?.portraitUrl ?? null} name={r.name} className="absolute inset-0 transition-transform duration-500 group-hover:scale-[1.03]" sizes="(min-width:1280px) 33vw, (min-width:640px) 50vw, 100vw" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent p-4 pt-14 text-white">
                      <ul className="mb-2 flex flex-wrap gap-1" aria-label="Langues">
                        {[r.primaryLang, ...r.secondaryLangs].map((l) => (
                          <li key={l} className="rounded-full bg-white/15 px-2 py-0.5 font-ui text-[10.5px] font-semibold tracking-[0.06em]">
                            {LANG_SHORT[l]}
                          </li>
                        ))}
                      </ul>
                      <p className="font-head text-[22px] font-semibold leading-tight">{r.name}</p>
                      <p className="font-ui text-[12.5px] text-white/75">{r.role}</p>
                    </div>
                    <div className="absolute right-3 top-3">
                      <StatusBadge status={RECEPTIONIST_STATUS[r.status]} />
                    </div>
                  </div>
                  <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 p-4 text-[13px]">
                    <div className="col-span-2 min-w-0">
                      <dt className="font-ui text-[11.5px] uppercase tracking-[0.06em] text-faint">Entreprise</dt>
                      <dd className="truncate font-medium">{org?.name ?? <span className="text-faint">Non associée</span>}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="font-ui text-[11.5px] uppercase tracking-[0.06em] text-faint">Fournisseur</dt>
                      <dd className="truncate font-ui text-[12px] text-muted">{av?.providerAvatarId ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="font-ui text-[11.5px] uppercase tracking-[0.06em] text-faint">Durée max.</dt>
                      <dd className="tabular">{formatDuration(r.maxConversationSeconds)} min</dd>
                    </div>
                    <div className="col-span-2 min-w-0">
                      <dt className="font-ui text-[11.5px] uppercase tracking-[0.06em] text-faint">Configuration</dt>
                      <dd className="line-clamp-2 text-muted">{r.tone} {r.allowedServices.length ? `· ${r.allowedServices.length} services autorisés` : "· aucun service défini"}</dd>
                    </div>
                    <div className="col-span-2 border-t border-line pt-3 font-ui text-[12px] text-faint">Dernière activité : {formatRelative(r.lastActivityAt)}</div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
