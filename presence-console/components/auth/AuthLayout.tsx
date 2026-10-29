import Image from "next/image";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/shell/ThemeToggle";

/** Mise en page commune des écrans de connexion. */
export function AuthLayout({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
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

        <main className="mx-auto mt-12 w-full max-w-[420px] sm:mt-16">
          <p className="font-ui text-[12px] font-semibold uppercase tracking-[0.22em] text-red">Console</p>
          <h1 className="mt-3 text-[30px] font-semibold leading-[1.1] sm:text-[36px]">{title}</h1>
          {description ? <p className="mt-3 text-[15px] text-muted">{description}</p> : null}
          <div className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">{children}</div>
          {footer ? <div className="mt-6 font-ui text-[12.5px] text-faint">{footer}</div> : null}
        </main>
      </div>
    </div>
  );
}
