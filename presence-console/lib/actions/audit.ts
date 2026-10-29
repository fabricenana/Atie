import "server-only";
import type { DemoStore, ID } from "../domain/types";
import { newId } from "../demo/store";

/** Ajoute une entrée au journal d'audit (à appeler dans mutateStore). */
export function audit(s: DemoStore, actorId: ID, organizationId: ID | null, action: string, target: string, detail = "") {
  s.auditEvents.push({ id: newId("aud"), organizationId, actorId, action, target, detail, at: new Date().toISOString() });
}
