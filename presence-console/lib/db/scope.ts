import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { ForbiddenError, getViewer } from "../auth/session";
import { isAtieRole } from "../auth/permissions";
import { withOrg, withStaff, type Queryable } from "./index";

/**
 * Portée des lectures des repositories, déduite de la session :
 *  - personnel ATIE → transaction propriétaire (withStaff) ;
 *  - client → transaction atie_app + RLS sur l'entreprise de la session (withOrg).
 * Les tests fixent la portée explicitement avec runInScope.
 */

export type Scope = { kind: "staff" } | { kind: "org"; orgId: string };

const als = new AsyncLocalStorage<Scope>();

export function runInScope<T>(scope: Scope, fn: () => Promise<T>): Promise<T> {
  return als.run(scope, fn);
}

export async function currentScope(): Promise<Scope> {
  const fixed = als.getStore();
  if (fixed) return fixed;
  const v = await getViewer();
  if (!v) throw new ForbiddenError("Session expirée. Reconnectez-vous.");
  if (isAtieRole(v.role)) return { kind: "staff" };
  if (!v.organization) throw new ForbiddenError();
  return { kind: "org", orgId: v.organization.id };
}

/** Exécute une lecture dans la portée de l'utilisateur courant. */
export async function read<T>(fn: (q: Queryable, scope: Scope) => Promise<T>): Promise<T> {
  const scope = await currentScope();
  return scope.kind === "staff" ? withStaff((q) => fn(q, scope)) : withOrg(scope.orgId, (q) => fn(q, scope));
}
