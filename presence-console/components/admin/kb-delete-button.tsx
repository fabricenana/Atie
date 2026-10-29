"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteKnowledgeSource } from "@/lib/actions/knowledge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";

/** Suppression d'une source après confirmation, puis retour à la liste. */
export function KbDeleteButton({ orgId, sourceId, title, versions }: { orgId: string; sourceId: string; title: string; versions: number }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { notify } = useToast();
  const router = useRouter();
  const run = () =>
    start(async () => {
      const r = await deleteKnowledgeSource({ orgId, sourceId });
      notify(r.message, r.ok ? "success" : "error");
      if (r.ok) {
        setOpen(false);
        router.push(`/admin/connaissances/${orgId}`);
      }
    });
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden /> Supprimer
      </Button>
      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title="Supprimer cette source ?"
        size="sm"
        footer={
          <>
            <Button onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <Button variant="danger" onClick={run} disabled={pending} aria-busy={pending || undefined}>
              {pending ? <Loader2 aria-hidden className="animate-spin" /> : null}
              Supprimer définitivement
            </Button>
          </>
        }
      >
        <p className="text-[14px] text-muted">
          « {title} » et ses {versions} version{versions > 1 ? "s" : ""} seront supprimés de la Knowledge Base de cette entreprise. Cette action est inscrite au
          journal d’audit.
        </p>
      </Modal>
    </>
  );
}
