"use client";

import type { ReactNode } from "react";
import { Folder } from "lucide-react";
import { FolderCard } from "./FolderCard";
import type { WorkspaceNoteFolder } from "@/types/workspace-notes";

interface FoldersGridProps {
  folders:    WorkspaceNoteFolder[];
  isLoading:  boolean;
  emptyLabel?: string;
  onEdit:     (folder: WorkspaceNoteFolder) => void;
  onDelete:   (folder: WorkspaceNoteFolder) => void;
  systemFolder?: ReactNode;
}

export function FoldersGrid({ folders, isLoading, emptyLabel, onEdit, onDelete, systemFolder }: FoldersGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(132px,210px))] sm:gap-5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="aspect-square animate-pulse rounded-[20px]" style={{ background: "var(--card)" }} />
        ))}
      </div>
    );
  }

  if (folders.length === 0 && !systemFolder) {
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
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(132px,210px))] sm:gap-5">
      {folders.map((folder) => (
        <FolderCard key={folder.id} folder={folder} onEdit={onEdit} onDelete={onDelete} />
      ))}
      {systemFolder}
    </div>
  );
}
