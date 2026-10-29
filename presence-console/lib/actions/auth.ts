"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readStore } from "../demo/store";
import { encodeSession, resolveViewer, SESSION_COOKIE } from "../auth/session";
import { isAtieRole } from "../auth/permissions";

/**
 * Connexion de DÉMONSTRATION : choix d'un utilisateur fictif, sans mot de passe.
 * Ne constitue jamais une authentification de production.
 */
export async function demoSignIn(formData: FormData) {
  const uid = String(formData.get("uid") ?? "");
  const minutes = readStore().settings.sessionTimeoutMinutes;
  const exp = Date.now() + minutes * 60_000;
  const viewer = resolveViewer(uid, exp);
  if (!viewer) redirect("/connexion?error=1");
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession({ uid, exp }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: minutes * 60,
  });
  redirect(isAtieRole(viewer.role) ? "/admin" : "/client");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/connexion");
}
