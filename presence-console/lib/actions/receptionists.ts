"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../action-result";
import { fieldErrors } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { mutateStore, newId } from "../demo/store";
import type { Lang } from "../domain/types";
import { audit } from "./audit";

const lang = z.enum(["fr", "de", "it", "en"]);

const configSchema = z.object({
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(60),
  role: z.string().trim().min(2, "Indiquez le rôle affiché.").max(120),
  organizationId: z.string().default(""),
  avatarId: z.string().min(1, "Choisissez un avatar existant."),
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

export async function updateReceptionist(_: ActionResult, fd: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("receptionist.write");
    const id = String(fd.get("id") ?? "");
    const parsed = parse(fd);
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const d = parsed.data;
    if (d.status === "live" && !d.organizationId) {
      return { ok: false, message: "Une réceptionniste en service doit être associée à une entreprise.", errors: { status: "Associez d’abord une entreprise." } };
    }
    const r = await mutateStore((s) => {
      const rcp = s.receptionists.find((x) => x.id === id);
      if (!rcp) return "missing";
      if (!s.avatars.some((a) => a.id === d.avatarId)) return "avatar";
      if (d.organizationId && !s.organizations.some((o) => o.id === d.organizationId)) return "org";
      if (d.organizationId && s.receptionists.some((x) => x.id !== id && x.organizationId === d.organizationId)) return "taken";
      Object.assign(rcp, {
        name: d.name,
        role: d.role,
        organizationId: d.organizationId || null,
        avatarId: d.avatarId,
        voice: d.voice,
        primaryLang: d.primaryLang,
        secondaryLangs: d.secondaryLangs.filter((l) => l !== d.primaryLang) as Lang[],
        tone: d.tone,
        businessInstructions: d.businessInstructions,
        greeting: d.greeting,
        fallbackReply: d.fallbackReply,
        afterHoursBehavior: d.afterHoursBehavior,
        maxConversationSeconds: Math.round(d.maxConversationMinutes * 60),
        allowedServices: services(d.allowedServices),
        status: d.status,
        updatedAt: new Date().toISOString(),
      });
      audit(s, v.user.id, rcp.organizationId, "receptionist.update", rcp.name, "Configuration modifiée");
      return "ok";
    });
    if (r === "missing") return { ok: false, message: "Réceptionniste introuvable." };
    if (r === "avatar") return { ok: false, message: "Avatar inconnu.", errors: { avatarId: "Avatar inconnu." } };
    if (r === "org") return { ok: false, message: "Entreprise inconnue.", errors: { organizationId: "Entreprise inconnue." } };
    if (r === "taken") return { ok: false, message: "Cette entreprise a déjà une réceptionniste.", errors: { organizationId: "Une réceptionniste est déjà associée à cette entreprise." } };
    revalidatePath(`/admin/receptionnistes/${id}`);
    revalidatePath("/admin/receptionnistes");
    return { ok: true, message: "Configuration enregistrée (démo, non transmise à l’agent)." };
  } catch (e) {
    return fail(e);
  }
}

const createSchema = z.object({
  avatarId: z.string().min(1, "Choisissez un avatar existant."),
  name: z.string().trim().min(2, "Le nom doit contenir au moins 2 caractères.").max(60),
  role: z.string().trim().min(2, "Indiquez le rôle affiché.").max(120),
  organizationId: z.string().default(""),
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
    const r = await mutateStore((s) => {
      if (!s.avatars.some((a) => a.id === d.avatarId)) return { err: "avatar" as const };
      if (d.organizationId && !s.organizations.some((o) => o.id === d.organizationId)) return { err: "org" as const };
      if (d.organizationId && s.receptionists.some((x) => x.organizationId === d.organizationId)) return { err: "taken" as const };
      const now = new Date().toISOString();
      const id = newId("rcp");
      s.receptionists.push({
        id,
        organizationId: d.organizationId || null,
        avatarId: d.avatarId,
        name: d.name,
        role: d.role,
        voice: "À définir",
        primaryLang: d.primaryLang,
        secondaryLangs: (["fr", "de", "it", "en"] as Lang[]).filter((l) => l !== d.primaryLang),
        tone: "Professionnelle et chaleureuse.",
        businessInstructions: "À compléter avec l’entreprise.",
        greeting: `Bonjour, je suis ${d.name}. Comment puis-je vous aider ?`,
        fallbackReply: "Je n’ai pas cette information. Souhaitez-vous laisser un message à l’équipe ?",
        afterHoursBehavior: "message",
        maxConversationSeconds: s.settings.defaultMaxConversationSeconds,
        allowedServices: [],
        status: "draft",
        lastActivityAt: null,
        createdAt: now,
        updatedAt: now,
      });
      audit(s, v.user.id, d.organizationId || null, "receptionist.create", d.name, "Réceptionniste créée en brouillon");
      return { id };
    });
    if ("err" in r) {
      const map = { avatar: ["avatarId", "Avatar inconnu."], org: ["organizationId", "Entreprise inconnue."], taken: ["organizationId", "Cette entreprise a déjà une réceptionniste."] } as const;
      const [k, m] = map[r.err as keyof typeof map];
      return { ok: false, message: m, errors: { [k]: m } };
    }
    revalidatePath("/admin/receptionnistes");
    return { ok: true, message: `Réceptionniste « ${d.name} » créée en brouillon.`, id: r.id };
  } catch (e) {
    return fail(e);
  }
}
