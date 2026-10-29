import "server-only";
import { consoleOrigin, PASSWORD_PATH } from "./request";
import { inviteAuthUser } from "./supabase";

/**
 * Création d'un compte par ATIE : invitation Supabase (e-mail avec lien vers
 * /connexion/nouveau-mot-de-passe). Renvoie l'identifiant Supabase à inscrire dans
 * atie.users.idp_subject. Si le compte existe déjà côté Supabase, aucun e-mail n'est
 * renvoyé : l'utilisateur passe par « Mot de passe oublié ».
 */
export async function inviteAccount(email: string, fullName: string) {
  return inviteAuthUser(email, fullName, `${await consoleOrigin()}${PASSWORD_PATH}`);
}
