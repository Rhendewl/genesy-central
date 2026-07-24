"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderPlus, Search } from "lucide-react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { useWorkspaceNoteFolders } from "@/hooks/useWorkspaceNoteFolders";
import { useWorkspaceNotes } from "@/hooks/useWorkspaceNotes";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { FoldersGrid } from "@/components/workspace/notes/FoldersGrid";
import { FolderModal } from "@/components/workspace/notes/FolderModal";
import type { WorkspaceNoteFolder } from "@/types/workspace-notes";
import { GlassFolderIcon } from "@/components/ui/GlassFolderIcon";
import { Button } from "@/components/ui/button";

export default function WorkspaceNotasPage() {
  const { viewingMember } = useWorkspaceViewing();
  const asUserId = viewingMember?.auth_user_id ?? undefined;

  const { folders, isLoading, createFolder, updateFolder, deleteFolder } = useWorkspaceNoteFolders(asUserId);
  const { notes: looseNotes, isLoading: isLoadingLoose } = useWorkspaceNotes(asUserId, "none");
  const [search, setSearch] = useState("");
  const [modalMode, setModalMode] = useState<"closed" | "create" | WorkspaceNoteFolder>("closed");

  const filteredFolders = useMemo(() => {
    return folders.filter((f) => {
      if (search && !f.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [folders, search]);

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

        </div>

        <Button
          onClick={() => setModalMode("create")}
          icon={<FolderPlus size={16} strokeWidth={2.2} />}
          signature
          size="medium"
        >
          Nova Pasta
        </Button>
      </div>

      <div className="flex-1 px-4 sm:px-6">
        <FoldersGrid
          folders={filteredFolders}
          isLoading={isLoading}
          emptyLabel={search ? "Nenhuma pasta encontrada" : "Nenhuma pasta ainda"}
          onEdit={(folder) => setModalMode(folder)}
          onDelete={(folder) => setModalMode(folder)}
          systemFolder={!isLoadingLoose && looseNotes.length > 0 && !search ? (
            <Link
              href="/workspace/notas/sem-pasta"
              className="glass-folder-card group relative flex aspect-square w-full flex-col items-center justify-center gap-1 overflow-hidden rounded-[20px] border p-3 text-center transition-transform hover:-translate-y-1"
              style={{ "--folder-color": "#75828e" } as React.CSSProperties}
            >
              <div className="glass-folder-glow pointer-events-none absolute inset-0 opacity-70" style={{ "--folder-color": "#75828e" } as React.CSSProperties} />
              <span className="absolute right-2.5 top-2.5 rounded-full px-1.5 py-0.5 text-[8px] uppercase tracking-wide backdrop-blur-md" style={{ background: "var(--hover)", color: "var(--muted-foreground)" }}>Sistema</span>
              <GlassFolderIcon color="#75828e" className="relative h-16 w-[4.5rem] sm:h-20 sm:w-24" />
              <p className="relative text-sm font-semibold" style={{ color: "var(--text-title)" }}>Sem pasta</p>
              <p className="relative mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                {looseNotes.length} {looseNotes.length === 1 ? "nota" : "notas"}
              </p>
            </Link>
          ) : undefined}
        />
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
