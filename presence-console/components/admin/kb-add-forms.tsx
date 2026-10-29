"use client";

import { useState } from "react";
import { FileUp, Link2, Type } from "lucide-react";
import { addKnowledgeText, addKnowledgeUrl, importKnowledgeFile } from "@/lib/actions/knowledge";
import { cn } from "@/lib/cn";
import { ActionForm, SubmitButton } from "@/components/ui/ActionForm";
import { FieldError, TextAreaField, TextField } from "@/components/ui/FormFields";

type Mode = "text" | "url" | "file";

/** Ajout de connaissances : texte, URL (référence seule) ou fichier (nom et taille seulement). */
export function KbAddForms({ orgId, categories, canWrite }: { orgId: string; categories: string[]; canWrite: boolean }) {
  const [mode, setMode] = useState<Mode>("text");
  const listId = `kb-categories-${orgId}`;
  const modes: Array<{ key: Mode; label: string; Icon: typeof Type }> = [
    { key: "text", label: "Texte", Icon: Type },
    { key: "url", label: "URL", Icon: Link2 },
    { key: "file", label: "PDF ou DOCX", Icon: FileUp },
  ];

  if (!canWrite) {
    return <p className="text-[13.5px] text-muted">Votre rôle permet la consultation seulement.</p>;
  }

  const category = (
    <>
      <TextField label="Catégorie" name="category" required list={listId} placeholder="ex. Horaires" maxLength={60} />
      <datalist id={listId}>
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </>
  );

  return (
    <div>
      <div role="tablist" aria-label="Type de connaissance" className="mb-5 inline-flex flex-wrap rounded-lg bg-surface-3 p-0.5">
        {modes.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            aria-controls={`kb-panel-${key}`}
            id={`kb-tab-${key}`}
            onClick={() => setMode(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 font-ui text-[12.5px] font-medium transition-colors",
              mode === key ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      {mode === "text" ? (
        <div role="tabpanel" id="kb-panel-text" aria-labelledby="kb-tab-text">
          <ActionForm action={addKnowledgeText} resetOnSuccess className="flex flex-col gap-4">
            <input type="hidden" name="orgId" value={orgId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Titre" name="title" required maxLength={160} placeholder="ex. Horaires d’été" />
              {category}
            </div>
            <TextAreaField label="Contenu" name="content" required rows={6} maxLength={20000} hint="Texte que la réceptionniste pourra utiliser une fois l’indexation branchée." />
            <div className="flex justify-end">
              <SubmitButton>Ajouter le texte</SubmitButton>
            </div>
          </ActionForm>
        </div>
      ) : null}

      {mode === "url" ? (
        <div role="tabpanel" id="kb-panel-url" aria-labelledby="kb-tab-url">
          <ActionForm action={addKnowledgeUrl} resetOnSuccess className="flex flex-col gap-4">
            <input type="hidden" name="orgId" value={orgId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Titre" name="title" required maxLength={160} placeholder="ex. Page Tarifs" />
              {category}
            </div>
            <TextField label="Adresse de la page" name="url" type="url" required placeholder="https://exemple.ch/page" hint="Seule la référence est enregistrée : la page n’est pas téléchargée." />
            <div className="flex justify-end">
              <SubmitButton>Enregistrer l’URL</SubmitButton>
            </div>
          </ActionForm>
        </div>
      ) : null}

      {mode === "file" ? (
        <div role="tabpanel" id="kb-panel-file" aria-labelledby="kb-tab-file">
          <ActionForm action={importKnowledgeFile} resetOnSuccess className="flex flex-col gap-4">
            <input type="hidden" name="orgId" value={orgId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <label htmlFor="file" className="font-ui text-[13px] font-medium">
                  Fichier<span className="text-red" aria-hidden> *</span>
                </label>
                <input
                  id="file"
                  name="file"
                  type="file"
                  required
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="block w-full rounded-lg border border-line-strong bg-surface text-[13px] text-muted file:mr-3 file:h-10 file:cursor-pointer file:border-0 file:bg-surface-3 file:px-3 file:font-ui file:text-[13px] file:font-medium file:text-ink"
                />
                <FieldError name="file" />
                <p className="text-[12.5px] text-faint">PDF ou DOCX, 15 Mo au plus. Indexation du contenu à venir : seuls le nom et la taille sont enregistrés pour l’instant.</p>
              </div>
              {category}
            </div>
            <div className="flex justify-end">
              <SubmitButton>Importer</SubmitButton>
            </div>
          </ActionForm>
        </div>
      ) : null}
    </div>
  );
}
