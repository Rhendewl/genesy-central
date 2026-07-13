"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Search, ArrowRight, StickyNote } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { useWorkspaceNoteFolders } from "@/hooks/useWorkspaceNoteFolders";
import { useWorkspaceNotes } from "@/hooks/useWorkspaceNotes";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { useTags } from "@/hooks/useTags";
import { FoldersGrid } from "@/components/workspace/notes/FoldersGrid";
import { FolderModal } from "@/components/workspace/notes/FolderModal";
import type { WorkspaceNoteFolder } from "@/types/workspace-notes";

export default function WorkspaceNotasPage() {
  const { viewingMember } = useWorkspaceViewing();
  const asUserId = viewingMember?.auth_user_id ?? undefined;

  const { folders, isLoading, createFolder, updateFolder, deleteFolder } = useWorkspaceNoteFolders(asUserId);
  const { notes: looseNotes, isLoading: isLoadingLoose } = useWorkspaceNotes(asUserId, "none");
  const { tags } = useTags();

  const [search, setSearch] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [modalMode, setModalMode] = useState<"closed" | "create" | WorkspaceNoteFolder>("closed");

  function toggleTagFilter(tagId: string) {
    setActiveTags((prev) => prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]);
  }

  const filteredFolders = useMemo(() => {
    return folders.filter((f) => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      if (activeTags.length > 0 && !activeTags.every((t) => f.tags.includes(t))) return false;
      return true;
    });
  }, [folders, search, activeTags]);

  async function handleSave(data: Parameters<typeof createFolder>[0]) {
    if (modalMode !== "closed" && modalMode !== "create") {
      const result = await updateFolder(modalMode.id, data);
      return { error: result.error };
    }
    const result = await createFolder(data);
    return { error: result.error };
  }

  async function handleDeleteFolder() {
    if (modalMode === "closed" || modalMode === "create") return;
    const result = await deleteFolder(modalMode.id);
    if (result.error) { toast.error(result.error); return; }
    setModalMode("closed");
  }

  return (
    <div className="flex flex-col pb-24">
      <Header title="Workspace" subtitle="Suas notas organizadas em pastas" />

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pb-4 sm:px-6">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted-foreground)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar pasta por nome..."
              className="w-full rounded-lg py-2 pl-8 pr-3 text-sm outline-none"
              style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
            />
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = activeTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTagFilter(tag.id)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                    style={{
                      background: active ? `${tag.color}30` : "var(--hover)",
                      color:      active ? tag.color : "var(--muted-foreground)",
                      border:     `1px solid ${active ? tag.color + "50" : "var(--glass-border)"}`,
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <motion.button
          onClick={() => setModalMode("create")}
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          className="lc-btn flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Plus size={16} strokeWidth={2.5} />
          Nova Pasta
        </motion.button>
      </div>

      <div className="flex-1 px-4 sm:px-6">
        <FoldersGrid
          folders={filteredFolders}
          isLoading={isLoading}
          emptyLabel={search || activeTags.length > 0 ? "Nenhuma pasta encontrada" : "Nenhuma pasta ainda"}
          onEdit={(folder) => setModalMode(folder)}
          onDelete={(folder) => setModalMode(folder)}
        />

        {!isLoadingLoose && (
          <Link
            href="/workspace/notas/sem-pasta"
            className="lc-card mt-4 flex items-center justify-between p-4 transition-colors hover:bg-[var(--hover)]"
          >
            <div className="flex items-center gap-2.5">
              <StickyNote size={16} style={{ color: "var(--muted-foreground)" }} />
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>Sem pasta</p>
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  {looseNotes.length} {looseNotes.length === 1 ? "nota" : "notas"} fora de pastas
                </p>
              </div>
            </div>
            <ArrowRight size={15} style={{ color: "var(--muted-foreground)" }} />
          </Link>
        )}
      </div>

      {modalMode !== "closed" && (
        <FolderModal
          folder={modalMode === "create" ? null : modalMode}
          onClose={() => setModalMode("closed")}
          onSave={handleSave}
          onDelete={modalMode === "create" ? undefined : handleDeleteFolder}
        />
      )}
    </div>
  );
}
