"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../action-result";
import { fieldErrors } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { mutateStore, newId } from "../demo/store";
import { audit } from "./audit";

const widgetSchema = z.object({
  orgId: z.string().min(1),
  receptionistId: z.string(),
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
    const result = await mutateStore((s) => {
      const org = s.organizations.find((o) => o.id === orgId);
      if (!org) return "org";
      // Isolation : la réceptionniste doit appartenir à la même entreprise.
      if (receptionistId && !s.receptionists.some((r) => r.id === receptionistId && r.organizationId === orgId)) return "rcp";
      if ((status === "ready" || status === "installed") && !receptionistId) return "need_rcp";
      let w = s.widgetInstallations.find((x) => x.organizationId === orgId);
      if (!w) {
        w = {
          id: newId("wdg"),
          organizationId: orgId,
          receptionistId: null,
          publicKey: `pk_demo_${org.slug.replace(/[^a-z0-9]/g, "")}`,
          position: "right",
          accent: "#E31E24",
          status: "not_configured",
          platform: "generic",
          lastSeenAt: null,
          createdAt: new Date().toISOString(),
        };
        s.widgetInstallations.push(w);
      }
      Object.assign(w, { receptionistId: receptionistId || null, position, accent: accent.toUpperCase(), platform, status });
      audit(s, v.user.id, orgId, "widget.update", org.name, `Widget : ${status}, ${platform}, ${position} (démo, rien n’est publié)`);
      return "ok";
    });
    if (result === "org") return { ok: false, message: "Entreprise introuvable." };
    if (result === "rcp") return { ok: false, message: "Réceptionniste invalide.", errors: { receptionistId: "Cette réceptionniste n’appartient pas à l’entreprise." } };
    if (result === "need_rcp") return { ok: false, message: "Réceptionniste requise.", errors: { receptionistId: "Assignez une réceptionniste avant de marquer le widget prêt ou installé." } };
    revalidatePath("/admin/integrations");
    revalidatePath(`/admin/integrations/${orgId}`);
    return { ok: true, message: "Configuration enregistrée (démo). Aucun widget n’a été publié.", simulated: true };
  } catch (e) {
    return fail(e);
  }
}

/** Contrôle de domaine SIMULÉ : aucune requête DNS ni HTTP n'est effectuée. */
export async function simulateDomainCheck(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("integration.write");
    const { orgId, domainId } = payload;
    const domain = await mutateStore((s) => {
      const d = s.websiteDomains.find((x) => x.id === domainId && x.organizationId === orgId);
      if (!d) return null;
      audit(s, v.user.id, orgId, "domain.check_simulated", d.domain, "Contrôle simulé, aucun appel réseau");
      return d.domain;
    });
    if (!domain) return { ok: false, message: "Domaine introuvable pour cette entreprise." };
    revalidatePath(`/admin/integrations/${orgId}`);
    return {
      ok: true,
      message: `Contrôle simulé pour ${domain} : aucune requête n’a été envoyée. La vérification réelle relèvera du backend.`,
      simulated: true,
    };
  } catch (e) {
    return fail(e);
  }
}
