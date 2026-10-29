"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { requestPasswordReset, setNewPassword, signIn, type AuthFormState } from "@/lib/actions/auth";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Notice } from "@/components/ui/Notice";

/** Formulaires de connexion : aucun jeton ni secret ne transite par le navigateur, hormis le lien e-mail. */

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" className="w-full" disabled={pending} aria-busy={pending || undefined}>
      {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
      {children}
    </Button>
  );
}

const initial: AuthFormState = {};

export function LoginForm() {
  const [state, action] = useActionState(signIn, initial);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Notice kind="danger">{state.error}</Notice> : null}
      <Field label="Adresse e-mail" name="email">
        <Input name="email" type="email" autoComplete="username" required defaultValue={state.email} autoFocus />
      </Field>
      <Field label="Mot de passe" name="password">
        <Input name="password" type="password" autoComplete="current-password" required />
      </Field>
      <Submit>Se connecter</Submit>
      <Link href="/connexion/mot-de-passe-oublie" className="self-center font-ui text-[13px] text-muted underline underline-offset-2 hover:text-ink">
        Mot de passe oublié ?
      </Link>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, initial);
  if (state.message) return <Notice kind="info" title="Demande enregistrée">{state.message}</Notice>;
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Notice kind="danger">{state.error}</Notice> : null}
      <Field label="Adresse e-mail" name="email">
        <Input name="email" type="email" autoComplete="username" required defaultValue={state.email} autoFocus />
      </Field>
      <Submit>Recevoir un lien</Submit>
    </form>
  );
}

/**
 * Définition du mot de passe au retour du lien e-mail.
 * Lien avec ?token_hash=… : échangé côté serveur. Lien Supabase par défaut : le jeton
 * arrive dans le fragment (#access_token=…), lu ici puis effacé de la barre d'adresse.
 */
export function NewPasswordForm({ tokenHash, type }: { tokenHash?: string; type?: string }) {
  const [state, action] = useActionState(setNewPassword, initial);
  const [fragment, setFragment] = useState<{ accessToken?: string; type?: string; error?: string } | null>(null);

  useEffect(() => {
    const p = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = p.get("access_token") ?? undefined;
    const error = p.get("error_description") ?? undefined;
    // Lecture du fragment au premier rendu côté navigateur (il n'existe pas côté serveur).
    setFragment({ accessToken, type: p.get("type") ?? undefined, error });
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  if (!tokenHash && fragment && !fragment.accessToken) {
    return (
      <Notice kind="warning" title="Lien invalide ou expiré">
        {fragment.error ? `${fragment.error}. ` : ""}Demandez un nouveau lien depuis{" "}
        <Link href="/connexion/mot-de-passe-oublie" className="underline underline-offset-2">« Mot de passe oublié »</Link>.
      </Notice>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error ? <Notice kind="danger">{state.error}</Notice> : null}
      {tokenHash ? <input type="hidden" name="tokenHash" value={tokenHash} /> : null}
      {tokenHash && type ? <input type="hidden" name="type" value={type} /> : null}
      {fragment?.accessToken ? <input type="hidden" name="accessToken" value={fragment.accessToken} /> : null}
      <Field label="Nouveau mot de passe" name="password" hint="10 caractères au moins, avec au moins une lettre et un chiffre.">
        <Input name="password" type="password" autoComplete="new-password" required minLength={10} autoFocus />
      </Field>
      <Field label="Confirmer le mot de passe" name="confirm">
        <Input name="confirm" type="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <Submit>Enregistrer le mot de passe</Submit>
    </form>
  );
}
