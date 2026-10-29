/** Résultat standard d'une action serveur, affiché par <ActionForm>. */
export interface ActionResult {
  ok: boolean;
  message: string;
  /** Erreurs par champ (validation). */
  errors?: Record<string, string>;
  /** Marqueur : l’action n’a eu aucun effet externe (service non connecté). */
  simulated?: boolean;
}

export const idle: ActionResult = { ok: false, message: "" };

export function fieldErrors(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? "_");
    out[k] ??= i.message;
  }
  return out;
}
