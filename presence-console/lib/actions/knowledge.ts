"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../action-result";
import { fieldErrors } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { mutateStore, newId, readStore } from "../demo/store";
import type { KnowledgeKind } from "../domain/types";
import { audit } from "./audit";

const MAX_TEXT = 20_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;

const textSchema = z.object({
  orgId: z.string().min(1),
  title: z.string().trim().min(2, "Indiquez un titre (2 caractères au moins).").max(160, "160 caractères au plus."),
  category: z.string().trim().min(2, "Indiquez une catégorie.").max(60, "60 caractères au plus."),
  content: z.string().trim().min(10, "Le contenu doit faire au moins 10 caractères.").max(MAX_TEXT, `${MAX_TEXT} caractères au plus.`),
});

const urlSchema = z.object({
  orgId: z.string().min(1),
  title: z.string().trim().min(2, "Indiquez un titre.").max(160),
  category: z.string().trim().min(2, "Indiquez une catégorie.").max(60),
  url: z
    .string()
    .trim()
    .url("Adresse invalide (ex. https://exemple.ch/page).")
    .refine((u) => /^https:\/\//i.test(u), "Seules les adresses https:// sont acceptées."),
});

const editSchema = z.object({
  orgId: z.string().min(1),
  sourceId: z.string().min(1),
  title: z.string().trim().min(2, "Indiquez un titre.").max(160),
  category: z.string().trim().min(2, "Indiquez une catégorie.").max(60),
  content: z.string().trim().min(10, "Le contenu doit faire au moins 10 caractères.").max(MAX_TEXT),
});

function orgExists(orgId: string) {
  return readStore().organizations.some((o) => o.id === orgId);
}

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, message: e.message };
  return { ok: false, message: "L’opération n’a pas pu être enregistrée." };
}

function refresh(orgId: string, sourceId?: string) {
  revalidatePath("/admin/connaissances");
  revalidatePath(`/admin/connaissances/${orgId}`);
  if (sourceId) revalidatePath(`/admin/connaissances/${orgId}/${sourceId}`);
}

function createSource(
  orgId: string,
  actorId: string,
  kind: KnowledgeKind,
  title: string,
  category: string,
  origin: string,
  content: string,
  sizeBytes: number,
) {
  return mutateStore((s) => {
    const now = new Date().toISOString();
    const id = newId("kbs");
    s.knowledgeSources.push({
      id,
      organizationId: orgId,
      kind,
      title,
      category,
      origin,
      indexStatus: "demo_not_indexed",
      currentVersion: 1,
      createdAt: now,
      updatedAt: now,
      updatedBy: actorId,
    });
    s.knowledgeDocuments.push({ id: newId("kbd"), sourceId: id, organizationId: orgId, version: 1, content, sizeBytes, createdAt: now, createdBy: actorId });
    audit(s, actorId, orgId, "knowledge.create", title, `Ajout (${kind.toUpperCase()}) — non indexé, démo`);
    return id;
  });
}

export async function addKnowledgeText(_: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("knowledge.write");
    const parsed = textSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const { orgId, title, category, content } = parsed.data;
    if (!orgExists(orgId)) return { ok: false, message: "Entreprise introuvable." };
    await createSource(orgId, v.user.id, "text", title, category, "Saisie manuelle", content, Buffer.byteLength(content));
    refresh(orgId);
    return { ok: true, message: "Texte ajouté. Statut : démo, non indexé.", simulated: true };
  } catch (e) {
    return fail(e);
  }
}

export async function addKnowledgeUrl(_: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("knowledge.write");
    const parsed = urlSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const { orgId, title, category, url } = parsed.data;
    if (!orgExists(orgId)) return { ok: false, message: "Entreprise introuvable." };
    // Aucune récupération réseau : seule la référence est enregistrée.
    const note = "Référence enregistrée. Le contenu de la page n’a pas été récupéré (démo, non connecté).";
    await createSource(orgId, v.user.id, "url", title, category, url, note, Buffer.byteLength(note));
    refresh(orgId);
    return { ok: true, message: "URL enregistrée. Aucune page n’a été récupérée (démo).", simulated: true };
  } catch (e) {
    return fail(e);
  }
}

export async function importKnowledgeFile(_: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("knowledge.write");
    const orgId = String(data.get("orgId") ?? "");
    const category = String(data.get("category") ?? "").trim();
    const file = data.get("file");
    const errors: Record<string, string> = {};
    if (category.length < 2) errors.category = "Indiquez une catégorie.";
    if (!(file instanceof File) || file.size === 0) errors.file = "Choisissez un fichier PDF ou DOCX.";
    if (Object.keys(errors).length) return { ok: false, message: "Vérifiez les champs signalés.", errors };
    const f = file as File;
    const name = f.name.slice(0, 160);
    const ext = name.toLowerCase().split(".").pop();
    if (ext !== "pdf" && ext !== "docx") return { ok: false, message: "Format non pris en charge.", errors: { file: "Seuls les fichiers .pdf et .docx sont acceptés." } };
    if (f.size > MAX_FILE_BYTES) return { ok: false, message: "Fichier trop volumineux.", errors: { file: "15 Mo au plus." } };
    if (!orgExists(orgId)) return { ok: false, message: "Entreprise introuvable." };
    // Seuls le nom et la taille sont conservés : le binaire n'est ni lu ni stocké.
    const note = `Fichier de démonstration : seul le nom (${name}) et la taille sont enregistrés. Contenu non extrait, non indexé.`;
    await createSource(orgId, v.user.id, ext, name, category, name, note, f.size);
    refresh(orgId);
    return { ok: true, message: `« ${name} » référencé. Le contenu n’a pas été stocké ni extrait (démo).`, simulated: true };
  } catch (e) {
    return fail(e);
  }
}

export async function updateKnowledgeSource(_: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("knowledge.write");
    const parsed = editSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const { orgId, sourceId, title, category, content } = parsed.data;
    const res = await mutateStore((s) => {
      const src = s.knowledgeSources.find((k) => k.id === sourceId && k.organizationId === orgId);
      if (!src) return false;
      const now = new Date().toISOString();
      const version = src.currentVersion + 1;
      s.knowledgeDocuments.push({ id: newId("kbd"), sourceId, organizationId: orgId, version, content, sizeBytes: Buffer.byteLength(content), createdAt: now, createdBy: v.user.id });
      Object.assign(src, { title, category, currentVersion: version, updatedAt: now, updatedBy: v.user.id, indexStatus: "demo_not_indexed" as const });
      audit(s, v.user.id, orgId, "knowledge.update", title, `Version ${version}`);
      return true;
    });
    if (!res) return { ok: false, message: "Document introuvable pour cette entreprise." };
    refresh(orgId, sourceId);
    return { ok: true, message: "Nouvelle version enregistrée. Statut : démo, non indexé.", simulated: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteKnowledgeSource(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("knowledge.write");
    const { orgId, sourceId } = payload;
    const title = await mutateStore((s) => {
      const src = s.knowledgeSources.find((k) => k.id === sourceId && k.organizationId === orgId);
      if (!src) return null;
      s.knowledgeSources = s.knowledgeSources.filter((k) => k.id !== src.id);
      s.knowledgeDocuments = s.knowledgeDocuments.filter((d) => !(d.sourceId === src.id && d.organizationId === orgId));
      audit(s, v.user.id, orgId, "knowledge.delete", src.title, "Suppression de la source et de ses versions");
      return src.title;
    });
    if (!title) return { ok: false, message: "Document introuvable pour cette entreprise." };
    refresh(orgId);
    return { ok: true, message: `« ${title} » supprimé.` };
  } catch (e) {
    return fail(e);
  }
}
