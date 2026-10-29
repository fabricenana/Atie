"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../action-result";
import { fieldErrors } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { audit, isUuid, one, withStaff } from "../db";

const widgetSchema = z.object({
  orgId: z.string().refine(isUuid, "Entreprise inconnue."),
  receptionistId: z.string().refine((x) => x === "" || isUuid(x), "Réceptionniste invalide."),
  position: z.enum(["right", "left"], { message: "Choisissez une position." }),
  accent: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hexadécimale attendue, ex. #E31E24."),
  platform: z.enum(["generic", "wordpress"], { message: "Choisissez un mode d’installation." }),
  status: z.enum(["not_configured", "ready", "installed", "disabled"], { message: "Choisissez un état." }),
});

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, message: e.message };
  return { ok: false, message: "L’opération n’a pas pu être enregistrée." };
}

export async function updateWidget(_: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("integration.write");
    const parsed = widgetSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const { orgId, receptionistId, position, accent, platform, status } = parsed.data;
    const result = await withStaff(async (q) => {
      const org = await one<{ name: string; slug: string }>(q, "SELECT name, slug FROM organizations WHERE id = $1", [orgId]);
      if (!org) return "org" as const;
      // Isolation : la réceptionniste doit appartenir à la même entreprise.
      if (receptionistId && !(await one(q, "SELECT 1 FROM receptionists WHERE id = $1 AND organization_id = $2", [receptionistId, orgId]))) return "rcp" as const;
      if ((status === "ready" || status === "installed") && !receptionistId) return "need_rcp" as const;
      const values = [orgId, receptionistId || null, position, accent.toUpperCase(), platform, status];
      const updated = await one(
        q,
        `UPDATE widget_installations SET receptionist_id = $2, position = $3, accent = $4, platform = $5, status = $6
          WHERE id = (SELECT id FROM widget_installations WHERE organization_id = $1 ORDER BY created_at LIMIT 1) RETURNING id`,
        values,
      );
      if (!updated) {
        await q.query(
          `INSERT INTO widget_installations (organization_id, receptionist_id, position, accent, platform, status, public_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [...values, `pk_${org.slug}`],
        );
      }
      await audit(q, v.user.id, orgId, "widget.update", org.name, `Widget : ${status}, ${platform}, ${position}`);
      return "ok" as const;
    });
    if (result === "org") return { ok: false, message: "Entreprise introuvable." };
    if (result === "rcp") return { ok: false, message: "Réceptionniste invalide.", errors: { receptionistId: "Cette réceptionniste n’appartient pas à l’entreprise." } };
    if (result === "need_rcp") return { ok: false, message: "Réceptionniste requise.", errors: { receptionistId: "Assignez une réceptionniste avant de marquer le widget prêt ou installé." } };
    revalidatePath("/admin/integrations");
    revalidatePath(`/admin/integrations/${orgId}`);
    return { ok: true, message: "Configuration du widget enregistrée. Rien n’est publié automatiquement sur le site du client." };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Contrôle de domaine : la vérification automatique (DNS/HTTP) n'est pas encore branchée.
 * L'action le dit explicitement et trace la demande ; aucune requête réseau n'est faite.
 */
export async function checkDomain(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("integration.write");
    const { orgId, domainId } = payload;
    if (!isUuid(orgId) || !isUuid(domainId)) return { ok: false, message: "Domaine introuvable pour cette entreprise." };
    const domain = await withStaff(async (q) => {
      const d = await one<{ domain: string }>(q, "SELECT domain::text AS domain FROM website_domains WHERE id = $1 AND organization_id = $2", [domainId, orgId]);
      if (!d) return null;
      await audit(q, v.user.id, orgId, "domain.check_requested", d.domain, "Vérification automatique non connectée");
      return d.domain;
    });
    if (!domain) return { ok: false, message: "Domaine introuvable pour cette entreprise." };
    revalidatePath(`/admin/integrations/${orgId}`);
    return {
      ok: false,
      message: `Vérification automatique de ${domain} non disponible : contrôlez l’installation manuellement, puis marquez le domaine comme vérifié dans la fiche entreprise.`,
    };
  } catch (e) {
    return fail(e);
  }
}
