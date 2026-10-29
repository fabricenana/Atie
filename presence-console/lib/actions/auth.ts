"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { encodeSession, SESSION_COOKIE, sessionCookieOptions } from "../auth/session";
import { authenticate, AUTH_UNAVAILABLE, defineNewPassword, recoveryLimiter } from "../auth/login";
import { clientIp, consoleOrigin, PASSWORD_PATH } from "../auth/request";
import { sendRecoveryEmail } from "../auth/supabase";

/**
 * Connexion par e-mail et mot de passe (Supabase Auth), mot de passe oublié,
 * définition du mot de passe, déconnexion. Il n'existe pas d'inscription publique :
 * les comptes sont créés par ATIE (invitation).
 */

export interface AuthFormState {
  error?: string;
  message?: string;
  email?: string;
}

const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(254),
  password: z.string().min(1, "Indiquez votre mot de passe.").max(200),
});

export async function signIn(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const parsed = signInSchema.safeParse({ email: fd.get("email") ?? "", password: fd.get("password") ?? "" });
  const email = String(fd.get("email") ?? "").slice(0, 254);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vérifiez les champs.", email };
  let result;
  try {
    result = await authenticate(parsed.data.email, parsed.data.password, await clientIp());
  } catch {
    return { error: AUTH_UNAVAILABLE, email };
  }
  if (!result.ok) return { error: result.error, email };
  const exp = Date.now() + result.sessionMinutes * 60_000;
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession({ uid: result.userId, exp }), sessionCookieOptions(result.sessionMinutes * 60));
  redirect(result.atie ? "/admin" : "/client");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/connexion");
}

const SENT = "Si un compte correspond à cette adresse, un e-mail contenant un lien de réinitialisation vient d’être envoyé.";

export async function requestPasswordReset(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const parsed = z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(254).safeParse(fd.get("email") ?? "");
  if (!parsed.success) return { error: "Adresse e-mail invalide.", email: String(fd.get("email") ?? "").slice(0, 254) };
  const gate = recoveryLimiter.hit(`${await clientIp()}|${parsed.data}`);
  // Au-delà de la limite, même réponse : rien n'est envoyé, rien n'est révélé.
  if (gate.allowed) await sendRecoveryEmail(parsed.data, `${await consoleOrigin()}${PASSWORD_PATH}`);
  return { message: SENT };
}

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(10, "10 caractères au moins.")
      .max(200, "200 caractères au plus.")
      .regex(/[A-Za-zÀ-ÿ]/, "Au moins une lettre.")
      .regex(/\d/, "Au moins un chiffre."),
    confirm: z.string(),
    tokenHash: z.string().max(512).optional(),
    type: z.enum(["recovery", "invite"]).optional(),
    accessToken: z.string().max(4096).optional(),
  })
  .refine((v) => v.password === v.confirm, { message: "Les deux mots de passe ne correspondent pas.", path: ["confirm"] });

export async function setNewPassword(_prev: AuthFormState, fd: FormData): Promise<AuthFormState> {
  const opt = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v ? v : undefined;
  };
  const parsed = passwordSchema.safeParse({
    password: fd.get("password") ?? "",
    confirm: fd.get("confirm") ?? "",
    tokenHash: opt("tokenHash"),
    type: opt("type") === "invite" ? "invite" : opt("type") ? "recovery" : undefined,
    accessToken: opt("accessToken"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Vérifiez les champs." };
  if (!parsed.data.tokenHash && !parsed.data.accessToken) return { error: "Lien incomplet. Ouvrez à nouveau le lien reçu par e-mail." };
  let r;
  try {
    r = await defineNewPassword(parsed.data);
  } catch {
    return { error: AUTH_UNAVAILABLE };
  }
  if (!r.ok) return { error: r.error };
  redirect("/connexion?password=1");
}
