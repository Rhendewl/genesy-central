"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { useWorkspaceNotes } from "@/hooks/useWorkspaceNotes";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { NotesGrid } from "@/components/workspace/notes/NotesGrid";

export default function WorkspaceNotasPage() {
  const router = useRouter();
  const { viewingMember } = useWorkspaceViewing();
  const { notes, isLoading, createNote, deleteNote } = useWorkspaceNotes(viewingMember?.auth_user_id ?? undefined);

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

  return (
    <div className="flex flex-col pb-24">
      <Header title="Workspace" subtitle="Suas notas e documentos" />

      <div className="flex flex-wrap items-center justify-end gap-3 px-4 pb-4 sm:px-6">
        <motion.button
          onClick={handleCreate}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="lc-btn flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Plus size={16} strokeWidth={2.5} />
          Nova Nota
        </motion.button>
      </div>

      <div className="flex-1 px-4 sm:px-6">
        <NotesGrid notes={notes} isLoading={isLoading} onDelete={handleDelete} />
      </div>
    </div>
  );
}
