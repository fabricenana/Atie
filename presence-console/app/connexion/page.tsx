import Image from "next/image";
import type { Metadata } from "next";
import { ArrowRight, Building2, FlaskConical, ShieldCheck } from "lucide-react";
import { demoSignIn } from "@/lib/actions/auth";
import { ROLE_LABELS } from "@/lib/auth/permissions";
import { readStore } from "@/lib/demo/store";
import { Notice } from "@/components/ui/Notice";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

export const metadata: Metadata = { title: "Connexion (démo)" };
export const dynamic = "force-dynamic";

export default async function SignIn({ searchParams }: { searchParams: Promise<{ expired?: string; error?: string }> }) {
  const sp = await searchParams;
  const s = readStore();
  const atie = s.users.filter((u) => u.atieRole && u.status === "active");
  const clients = s.organizationUsers
    .map((m) => ({ m, u: s.users.find((u) => u.id === m.userId)!, o: s.organizations.find((o) => o.id === m.organizationId)! }))
    .filter((x) => x.u?.status === "active");

  const Option = ({ uid, title, subtitle, role }: { uid: string; title: string; subtitle: string; role: string }) => (
    <li>
      <form action={demoSignIn}>
        <input type="hidden" name="uid" value={uid} />
        <button
          type="submit"
          className="group flex w-full items-center gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 text-left transition-[border-color,background-color,transform] duration-150 hover:-translate-y-px hover:border-line-strong hover:bg-surface-2"
        >
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-medium">{title}</span>
            <span className="block truncate font-ui text-[12.5px] text-muted">{subtitle} · {role}</span>
          </span>
          <ArrowRight aria-hidden className="size-4 shrink-0 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-red" />
        </button>
      </form>
    </li>
  );

  return (
    <div className="min-h-dvh bg-bg">
      <div className="mx-auto flex max-w-5xl flex-col px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo-atie.png" alt="ATIE" width={40} height={40} className="size-10 rounded-lg object-contain" priority />
            <span className="font-head text-[17px] font-semibold">ATIE Presence</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="mt-12 max-w-2xl">
          <p className="font-ui text-[12px] font-semibold uppercase tracking-[0.22em] text-red">Console</p>
          <h1 className="mt-3 text-[32px] font-semibold leading-[1.08] sm:text-[42px]">Choisir un profil de démonstration</h1>
          <p className="mt-3 text-[15px] text-muted">
            Explorez le back-office ATIE ou l’espace d’une entreprise cliente avec des comptes fictifs.
          </p>
        </div>

        <div className="mt-6 max-w-2xl">
          {sp.expired ? <Notice kind="warning" title="Session expirée">Veuillez choisir à nouveau un profil.</Notice> : null}
          {sp.error ? <Notice kind="danger" title="Profil indisponible">Ce compte de démonstration n’est pas actif.</Notice> : null}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="atie-title">
            <h2 id="atie-title" className="mb-3 flex items-center gap-2 font-ui text-[13px] font-semibold text-muted">
              <ShieldCheck className="size-4" aria-hidden /> Personnel ATIE
            </h2>
            <ul className="flex flex-col gap-2">
              {atie.map((u) => (
                <Option key={u.id} uid={u.id} title={u.fullName} subtitle={u.email} role={ROLE_LABELS[u.atieRole!]} />
              ))}
            </ul>
          </section>
          <section aria-labelledby="client-title">
            <h2 id="client-title" className="mb-3 flex items-center gap-2 font-ui text-[13px] font-semibold text-muted">
              <Building2 className="size-4" aria-hidden /> Entreprises clientes
            </h2>
            <ul className="flex flex-col gap-2">
              {clients.map(({ m, u, o }) => (
                <Option key={m.id} uid={u.id} title={o.name} subtitle={u.fullName} role={ROLE_LABELS[m.role]} />
              ))}
            </ul>
          </section>
        </div>

        <div className="mt-10 max-w-3xl">
          <Notice kind="demo" title="Sélecteur de rôle fictif — pas une authentification">
            Ce choix de profil sert uniquement à la démonstration locale. En production, l’accès passera par une
            authentification forte (identifiants personnels et double facteur). Les droits sont néanmoins vérifiés côté serveur
            à chaque page et à chaque action.
          </Notice>
        </div>
        <p className="mt-6 flex items-center gap-2 font-ui text-[12px] text-faint">
          <FlaskConical className="size-3.5" aria-hidden /> Toutes les entreprises, personnes et chiffres sont fictifs.
        </p>
      </div>
    </div>
  );
}
