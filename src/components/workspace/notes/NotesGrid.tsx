"use client";

import { StickyNote } from "lucide-react";
import { NoteCard } from "./NoteCard";
import type { WorkspaceNoteSummary } from "@/types/workspace-notes";

interface NotesGridProps {
  notes:     WorkspaceNoteSummary[];
  isLoading: boolean;
  onDelete:  (id: string) => void;
}

export function NotesGrid({ notes, isLoading, onDelete }: NotesGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-52 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
        ))}
      </div>
    );
  }

  if (notes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <StickyNote size={28} style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhuma nota ainda</p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Clique em &quot;Nova Nota&quot; para começar.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onDelete={onDelete} />
      ))}
    </div>
  );
}
