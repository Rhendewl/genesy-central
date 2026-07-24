"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, NotebookPen } from "lucide-react";
import { toast } from "sonner";
import { useWorkspaceNotes } from "@/hooks/useWorkspaceNotes";
import { useWorkspaceNoteFolders } from "@/hooks/useWorkspaceNoteFolders";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { NotesGrid } from "@/components/workspace/notes/NotesGrid";
import { Button } from "@/components/ui/button";

export default function WorkspaceNotesSemPastaPage() {
  const router = useRouter();
  const { viewingMember } = useWorkspaceViewing();
  const asUserId = viewingMember?.auth_user_id ?? undefined;
  const { notes, isLoading, createNote, deleteNote, moveNote } = useWorkspaceNotes(asUserId, "none");
  const { folders } = useWorkspaceNoteFolders(asUserId);

  async function handleCreate() {
    const result = await createNote();
    if (result.error || !result.note) {
      toast.error(result.error ?? "Erro ao criar nota");
      return;
    }
    router.push(`/workspace/notas/${result.note.id}`);
  }

  async function handleDelete(id: string) {
    const result = await deleteNote(id);
    if (result.error) toast.error(result.error);
  }

  async function handleMove(id: string, folderId: string) {
    const result = await moveNote(id, folderId);
    if (result.error) toast.error(result.error);
  }

  return (
    <div className="flex flex-col pb-24">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <button
          onClick={() => router.push("/workspace/notas")}
          className="flex items-center gap-1.5 text-sm"
          style={{ color: "var(--muted-foreground)" }}
        >
          <ArrowLeft size={15} />
          Notas
        </button>
      </div>

      <div className="px-4 pb-4 sm:px-6">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Sem pasta</h1>
          <Button
            onClick={handleCreate}
            icon={<NotebookPen size={16} strokeWidth={2.2} />}
            signature
            size="medium"
          >
            Nova Nota
          </Button>
        </div>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Notas que ainda não foram organizadas em uma pasta.</p>
      </div>

      <div className="flex-1 px-4 sm:px-6">
        <NotesGrid notes={notes} isLoading={isLoading} onDelete={handleDelete} folders={folders} onMove={handleMove} />
      </div>
    </div>
  );
}
