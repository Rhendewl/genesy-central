"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Plus, Folder, Building2, Pencil, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { useWorkspaceNoteFolders } from "@/hooks/useWorkspaceNoteFolders";
import { useWorkspaceNotes } from "@/hooks/useWorkspaceNotes";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { TagChip } from "@/components/workspace/TagChip";
import { NotesGrid } from "@/components/workspace/notes/NotesGrid";
import { FolderModal } from "@/components/workspace/notes/FolderModal";

export default function WorkspaceFolderPage() {
  const { folderId } = useParams<{ folderId: string }>();
  const router = useRouter();
  const { viewingMember } = useWorkspaceViewing();
  const asUserId = viewingMember?.auth_user_id ?? undefined;

  const { folders, isLoading: isLoadingFolders, updateFolder, deleteFolder } = useWorkspaceNoteFolders(asUserId);
  const { notes, isLoading: isLoadingNotes, createNote, deleteNote } = useWorkspaceNotes(asUserId, folderId);

  const [editOpen, setEditOpen] = useState(false);

  const folder = useMemo(() => folders.find((f) => f.id === folderId), [folders, folderId]);

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

  async function handleDeleteFolder() {
    const result = await deleteFolder(folderId);
    if (result.error) { toast.error(result.error); return; }
    router.push("/workspace/notas");
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

      {isLoadingFolders ? (
        <div className="flex justify-center py-8">
          <Loader2 size={20} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
        </div>
      ) : !folder ? (
        <div className="flex flex-col items-center gap-2 py-16">
          <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Pasta não encontrada</p>
        </div>
      ) : (
        <>
          <div className="px-4 pb-4 sm:px-6">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl shrink-0"
                  style={{ background: `${folder.color ?? "#7c878e"}18`, border: `1px solid ${folder.color ?? "#7c878e"}30` }}
                >
                  <Folder size={16} style={{ color: folder.color ?? "var(--text-empty)" }} />
                </div>
                <div>
                  <h1 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>{folder.name}</h1>
                  {folder.client_name && (
                    <p className="flex items-center gap-1.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
                      <Building2 size={11} />
                      {folder.client_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditOpen(true)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs"
                  style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
                >
                  <Pencil size={12} />
                  Editar pasta
                </button>
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
            </div>

            {folder.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {folder.tags.map((tagId) => <TagChip key={tagId} tagId={tagId} />)}
              </div>
            )}
          </div>

          <div className="flex-1 px-4 sm:px-6">
            <NotesGrid notes={notes} isLoading={isLoadingNotes} onDelete={handleDelete} />
          </div>

          {editOpen && (
            <FolderModal
              folder={folder}
              onClose={() => setEditOpen(false)}
              onSave={async (data) => {
                const result = await updateFolder(folder.id, data);
                return { error: result.error };
              }}
              onDelete={handleDeleteFolder}
            />
          )}
        </>
      )}
    </div>
  );
}
