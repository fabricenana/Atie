"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../action-result";
import { fieldErrors } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { audit, isUuid, one, withStaff, type Queryable } from "../db";
import type { Lang } from "../domain/types";
import { loadPlatformSettings } from "../settings";

const lang = z.enum(["fr", "de", "it", "en"]);
const optionalOrg = z
  .string()
  .default("")
  .refine((x) => x === "" || isUuid(x), "Entreprise inconnue.");

const configSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(60),
  role: z.string().trim().min(2, "Indiquez le rôle affiché.").max(120),
  organizationId: optionalOrg,
  avatarId: z.string().refine(isUuid, "Choisissez un avatar existant."),
  voice: z.string().trim().min(2, "Indiquez la voix.").max(120),
  primaryLang: lang,
  secondaryLangs: z.array(lang).default([]),
  tone: z.string().trim().min(2, "Décrivez le ton.").max(300),
  businessInstructions: z.string().trim().min(10, "Les instructions doivent contenir au moins 10 caractères.").max(4000),
  greeting: z.string().trim().min(5, "La salutation est trop courte.").max(400),
  fallbackReply: z.string().trim().min(5, "La réponse de repli est trop courte.").max(400),
  afterHoursBehavior: z.enum(["message", "inform_hours", "redirect_contact"]),
  maxConversationMinutes: z.coerce.number().min(1, "Minimum 1 minute.").max(15, "Maximum 15 minutes."),
  allowedServices: z.string().default(""),
  status: z.enum(["draft", "configured", "live", "paused"]),
});

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, message: e.message };
  return { ok: false, message: "L’opération n’a pas pu aboutir." };
}

function parse(fd: FormData) {
  return configSchema.safeParse({
    name: fd.get("name") ?? "",
    role: fd.get("role") ?? "",
    organizationId: fd.get("organizationId") ?? "",
    avatarId: fd.get("avatarId") ?? "",
    voice: fd.get("voice") ?? "",
    primaryLang: fd.get("primaryLang") ?? "",
    secondaryLangs: fd.getAll("secondaryLangs").map(String),
    tone: fd.get("tone") ?? "",
    businessInstructions: fd.get("businessInstructions") ?? "",
    greeting: fd.get("greeting") ?? "",
    fallbackReply: fd.get("fallbackReply") ?? "",
    afterHoursBehavior: fd.get("afterHoursBehavior") ?? "",
    maxConversationMinutes: fd.get("maxConversationMinutes") ?? "",
    allowedServices: fd.get("allowedServices") ?? "",
    status: fd.get("status") ?? "draft",
  });
}

function services(raw: string) {
  return raw
    .split(/[\n,]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);
}

/** Contrôles communs : avatar existant, entreprise existante, une seule réceptionniste par entreprise. */
async function check(q: Queryable, avatarId: string, organizationId: string, selfId: string | null) {
  if (!(await one(q, "SELECT 1 FROM avatars WHERE id = $1", [avatarId]))) return "avatar" as const;
  if (organizationId) {
    if (!(await one(q, "SELECT 1 FROM organizations WHERE id = $1", [organizationId]))) return "org" as const;
    const taken = await one(q, "SELECT 1 FROM receptionists WHERE organization_id = $1 AND ($2::uuid IS NULL OR id <> $2::uuid)", [organizationId, selfId]);
    if (taken) return "taken" as const;
  }
  return null;
}

const CHECK_ERRORS = {
  avatar: ["avatarId", "Avatar inconnu."],
  org: ["organizationId", "Entreprise inconnue."],
  taken: ["organizationId", "Une réceptionniste est déjà associée à cette entreprise."],
} as const;

export async function updateReceptionist(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("receptionist.write");
    const id = String(fd.get("id") ?? "");
    if (!isUuid(id)) return { ok: false, message: "Réceptionniste introuvable." };
    const parsed = parse(fd);
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const d = parsed.data;
    if (d.status === "live" && !d.organizationId) {
      return { ok: false, message: "Une réceptionniste en service doit être associée à une entreprise.", errors: { status: "Associez d’abord une entreprise." } };
    }
    const r = await withStaff(async (q) => {
      if (!(await one(q, "SELECT 1 FROM receptionists WHERE id = $1 FOR UPDATE", [id]))) return "missing" as const;
      const err = await check(q, d.avatarId, d.organizationId, id);
      if (err) return err;
      await q.query(
        `UPDATE receptionists SET name = $2, role = $3, organization_id = $4, avatar_id = $5, voice = $6, primary_lang = $7::lang,
                secondary_langs = $8::lang[], tone = $9, business_instructions = $10, greeting = $11, fallback_reply = $12,
                after_hours_behavior = $13, max_conversation_seconds = $14, allowed_services = $15::text[],
                status = $16::receptionist_status, updated_at = now()
          WHERE id = $1`,
        [
          id,
          d.name,
          d.role,
          d.organizationId || null,
          d.avatarId,
          d.voice,
          d.primaryLang,
          d.secondaryLangs.filter((l) => l !== d.primaryLang),
          d.tone,
          d.businessInstructions,
          d.greeting,
          d.fallbackReply,
          d.afterHoursBehavior,
          Math.round(d.maxConversationMinutes * 60),
          services(d.allowedServices),
          d.status,
        ],
      );
      await audit(q, v.user.id, d.organizationId || null, "receptionist.update", d.name, "Configuration modifiée");
      return "ok" as const;
    });
    if (r === "missing") return { ok: false, message: "Réceptionniste introuvable." };
    if (r !== "ok") {
      const [k, m] = CHECK_ERRORS[r];
      return { ok: false, message: m, errors: { [k]: m } };
    }
    revalidatePath(`/admin/receptionnistes/${id}`);
    revalidatePath("/admin/receptionnistes");
    return { ok: true, message: "Configuration enregistrée. Elle n’est pas encore transmise automatiquement à l’agent Python." };
  } catch (e) {
    return fail(e);
  }
}

const createSchema = z.object({
  avatarId: z.string().refine(isUuid, "Choisissez un avatar existant."),
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(60),
  role: z.string().trim().min(2, "Indiquez le rôle affiché.").max(120),
  organizationId: optionalOrg,
  primaryLang: lang,
});

/** Crée une réceptionniste à partir d'un avatar EXISTANT (jamais de nouvel avatar). */
export async function createReceptionist(_: ActionResult, fd: FormData): Promise<ActionResult & { id?: string }> {
  try {
    const v = await assertPermission("receptionist.write");
    const parsed = createSchema.safeParse({
      avatarId: fd.get("avatarId") ?? "",
      name: fd.get("name") ?? "",
      role: fd.get("role") ?? "",
      organizationId: fd.get("organizationId") ?? "",
      primaryLang: fd.get("primaryLang") ?? "fr",
    });
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const d = parsed.data;
    const r = await withStaff(async (q) => {
      const err = await check(q, d.avatarId, d.organizationId, null);
      if (err) return { err: err as keyof typeof CHECK_ERRORS };
      const settings = await loadPlatformSettings(q);
      const row = await one<{ id: string }>(
        q,
        `INSERT INTO receptionists (organization_id, avatar_id, name, role, voice, primary_lang, secondary_langs, tone,
                                    business_instructions, greeting, fallback_reply, max_conversation_seconds)
         VALUES ($1, $2, $3, $4, 'À définir', $5::lang, $6::lang[], 'Professionnelle et chaleureuse.', 'À compléter avec l’entreprise.',
                 $7, 'Je n’ai pas cette information. Souhaitez-vous laisser un message à l’équipe ?', $8)
         RETURNING id`,
        [
          d.organizationId || null,
          d.avatarId,
          d.name,
          d.role,
          d.primaryLang,
          (["fr", "de", "it", "en"] as Lang[]).filter((l) => l !== d.primaryLang),
          `Bonjour, je suis ${d.name}. Comment puis-je vous aider ?`,
          Math.min(1800, Math.max(30, settings.defaultMaxConversationSeconds)),
        ],
      );
      await audit(q, v.user.id, d.organizationId || null, "receptionist.create", d.name, "Réceptionniste créée en brouillon");
      return { id: row!.id };
    });
    if (r.err) {
      const [k, m] = CHECK_ERRORS[r.err];
      return { ok: false, message: m, errors: { [k]: m } };
    }
    revalidatePath("/admin/receptionnistes");
    return { ok: true, message: `Réceptionniste « ${d.name} » créée en brouillon.`, id: r.id };
  } catch (e) {
    return fail(e);
  }
}
