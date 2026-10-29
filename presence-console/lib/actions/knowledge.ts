"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionResult } from "../action-result";
import { fieldErrors } from "../action-result";
import { assertPermission, ForbiddenError } from "../auth/session";
import { audit, isUuid, one, withStaff } from "../db";
import type { KnowledgeKind } from "../domain/types";

/**
 * Knowledge Base : enregistrement des sources et de leurs versions en base.
 * Aucun moteur d'indexation n'est branché : chaque source reste « en attente d'indexation ».
 * Aucun téléchargement d'URL, aucun stockage de fichier (seuls nom et taille sont conservés).
 */

const MAX_TEXT = 20_000;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const orgId = z.string().refine(isUuid, "Entreprise inconnue.");

const textSchema = z.object({
  orgId,
  title: z.string().trim().min(2, "Indiquez un titre (2 caractères au moins).").max(160, "160 caractères au plus."),
  category: z.string().trim().min(2, "Indiquez une catégorie.").max(60, "60 caractères au plus."),
  content: z.string().trim().min(10, "Le contenu doit faire au moins 10 caractères.").max(MAX_TEXT, `${MAX_TEXT} caractères au plus.`),
});

const urlSchema = z.object({
  orgId,
  title: z.string().trim().min(2, "Indiquez un titre.").max(160),
  category: z.string().trim().min(2, "Indiquez une catégorie.").max(60),
  url: z
    .string()
    .trim()
    .url("Adresse invalide (ex. https://exemple.ch/page).")
    .refine((u) => /^https:\/\//i.test(u), "Seules les adresses https:// sont acceptées."),
});

const editSchema = z.object({
  orgId,
  sourceId: z.string().refine(isUuid, "Document introuvable."),
  title: z.string().trim().min(2, "Indiquez un titre.").max(160),
  category: z.string().trim().min(2, "Indiquez une catégorie.").max(60),
  content: z.string().trim().min(10, "Le contenu doit faire au moins 10 caractères.").max(MAX_TEXT),
});

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, message: e.message };
  return { ok: false, message: "L’opération n’a pas pu être enregistrée." };
}

function refresh(org: string, sourceId?: string) {
  revalidatePath("/admin/connaissances");
  revalidatePath(`/admin/connaissances/${org}`);
  if (sourceId) revalidatePath(`/admin/connaissances/${org}/${sourceId}`);
}

/** Crée la source et sa version 1 ; null si l'entreprise n'existe pas. */
function createSource(org: string, actorId: string, kind: KnowledgeKind, title: string, category: string, origin: string, content: string, sizeBytes: number) {
  return withStaff(async (q) => {
    if (!(await one(q, "SELECT 1 FROM organizations WHERE id = $1", [org]))) return null;
    const src = await one<{ id: string }>(
      q,
      `INSERT INTO knowledge_sources (organization_id, kind, title, category, origin, updated_by)
       VALUES ($1, $2::knowledge_kind, $3, $4, $5, $6) RETURNING id`,
      [org, kind, title, category, origin, actorId],
    );
    await q.query(
      "INSERT INTO knowledge_documents (source_id, organization_id, version, content, size_bytes, created_by) VALUES ($1, $2, 1, $3, $4, $5)",
      [src!.id, org, content, sizeBytes, actorId],
    );
    await audit(q, actorId, org, "knowledge.create", title, `Ajout (${kind.toUpperCase()}) — en attente d’indexation`);
    return src!.id;
  });
}

export async function addKnowledgeText(_: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("knowledge.write");
    const parsed = textSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const { orgId: org, title, category, content } = parsed.data;
    const id = await createSource(org, v.user.id, "text", title, category, "Saisie manuelle", content, Buffer.byteLength(content));
    if (!id) return { ok: false, message: "Entreprise introuvable." };
    refresh(org);
    return { ok: true, message: "Texte ajouté. Il sera indexé lorsque le moteur de recherche sera connecté." };
  } catch (e) {
    return fail(e);
  }
}

export async function addKnowledgeUrl(_: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("knowledge.write");
    const parsed = urlSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const { orgId: org, title, category, url } = parsed.data;
    // Aucune récupération réseau : seule la référence est enregistrée.
    const note = "Référence enregistrée. Le contenu de la page n’a pas été récupéré (récupération automatique non connectée).";
    const id = await createSource(org, v.user.id, "url", title, category, url, note, Buffer.byteLength(note));
    if (!id) return { ok: false, message: "Entreprise introuvable." };
    refresh(org);
    return { ok: true, message: "URL enregistrée. La page n’a pas été récupérée." };
  } catch (e) {
    return fail(e);
  }
}

export async function importKnowledgeFile(_: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("knowledge.write");
    const org = String(data.get("orgId") ?? "");
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
    if (!isUuid(org)) return { ok: false, message: "Entreprise introuvable." };
    // Seuls le nom et la taille sont conservés : le binaire n'est ni lu ni stocké.
    const note = `Seuls le nom (${name}) et la taille sont enregistrés. Stockage et extraction du contenu non connectés.`;
    const id = await createSource(org, v.user.id, ext, name, category.slice(0, 60), name, note, f.size);
    if (!id) return { ok: false, message: "Entreprise introuvable." };
    refresh(org);
    return { ok: true, message: `« ${name} » référencé. Le contenu n’a pas été stocké ni extrait (stockage non connecté).` };
  } catch (e) {
    return fail(e);
  }
}

export async function updateKnowledgeSource(_: ActionResult, data: FormData): Promise<ActionResult> {
  try {
    const v = await assertPermission("knowledge.write");
    const parsed = editSchema.safeParse(Object.fromEntries(data));
    if (!parsed.success) return { ok: false, message: "Vérifiez les champs signalés.", errors: fieldErrors(parsed.error.issues) };
    const { orgId: org, sourceId, title, category, content } = parsed.data;
    const version = await withStaff(async (q) => {
      const src = await one<{ v: number }>(
        q,
        `UPDATE knowledge_sources SET title = $3, category = $4, current_version = current_version + 1, index_status = 'pending',
                updated_at = now(), updated_by = $5
          WHERE id = $1 AND organization_id = $2 RETURNING current_version AS v`,
        [sourceId, org, title, category, v.user.id],
      );
      if (!src) return null;
      await q.query(
        "INSERT INTO knowledge_documents (source_id, organization_id, version, content, size_bytes, created_by) VALUES ($1, $2, $3, $4, $5, $6)",
        [sourceId, org, src.v, content, Buffer.byteLength(content), v.user.id],
      );
      await audit(q, v.user.id, org, "knowledge.update", title, `Version ${src.v}`);
      return src.v;
    });
    if (!version) return { ok: false, message: "Document introuvable pour cette entreprise." };
    refresh(org, sourceId);
    return { ok: true, message: `Version ${version} enregistrée, en attente d’indexation.` };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteKnowledgeSource(payload: Record<string, string>): Promise<ActionResult> {
  try {
    const v = await assertPermission("knowledge.write");
    const { orgId: org, sourceId } = payload;
    if (!isUuid(org) || !isUuid(sourceId)) return { ok: false, message: "Document introuvable pour cette entreprise." };
    const title = await withStaff(async (q) => {
      // Les versions (knowledge_documents) sont supprimées en cascade.
      const src = await one<{ title: string }>(q, "DELETE FROM knowledge_sources WHERE id = $1 AND organization_id = $2 RETURNING title", [sourceId, org]);
      if (!src) return null;
      await audit(q, v.user.id, org, "knowledge.delete", src.title, "Suppression de la source et de ses versions");
      return src.title;
    });
    if (!title) return { ok: false, message: "Document introuvable pour cette entreprise." };
    refresh(org);
    return { ok: true, message: `« ${title} » supprimé.` };
  } catch (e) {
    return fail(e);
  }
}
