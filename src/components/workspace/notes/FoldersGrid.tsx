"use client";

import { Folder } from "lucide-react";
import { FolderCard } from "./FolderCard";
import type { WorkspaceNoteFolder } from "@/types/workspace-notes";

interface FoldersGridProps {
  folders:    WorkspaceNoteFolder[];
  isLoading:  boolean;
  emptyLabel?: string;
  onEdit:     (folder: WorkspaceNoteFolder) => void;
  onDelete:   (folder: WorkspaceNoteFolder) => void;
}

export function FoldersGrid({ folders, isLoading, emptyLabel, onEdit, onDelete }: FoldersGridProps) {
  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 w-28 animate-pulse rounded-xl" style={{ background: "var(--card)" }} />
        ))}
      </div>
    );
  }

  if (folders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16">
        <Folder size={28} style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {emptyLabel ?? "Nenhuma pasta ainda"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-3">
      {folders.map((folder) => (
        <FolderCard key={folder.id} folder={folder} onEdit={onEdit} onDelete={onDelete} />
      ))}
    </div>
  );
}
