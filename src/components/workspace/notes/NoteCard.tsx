"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { MoreHorizontal, Trash2, StickyNote } from "lucide-react";
import { TagChip } from "@/components/workspace/TagChip";
import type { WorkspaceNoteSummary } from "@/types/workspace-notes";

interface NoteCardProps {
  note:     WorkspaceNoteSummary;
  onDelete: (id: string) => void;
}

export function NoteCard({ note, onDelete }: NoteCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative cursor-pointer overflow-hidden lc-card"
      onClick={() => router.push(`/workspace/notas/${note.id}`)}
      style={note.color ? { borderTop: `2px solid ${note.color}` } : undefined}
    >
      {note.cover_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={note.cover_url} alt="" className="h-28 w-full object-cover" />
      ) : (
        <div className="flex h-28 w-full items-center justify-center" style={{ background: "rgba(255,255,255,0.03)" }}>
          <StickyNote size={22} style={{ color: note.color ?? "rgba(255,255,255,0.15)" }} />
        </div>
      )}

      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="flex-1 truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            {note.title || "Nota sem título"}
          </h3>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
              className="rounded p-1 opacity-0 transition-opacity hover:bg-white/10 group-hover:opacity-100"
            >
              <MoreHorizontal size={14} style={{ color: "var(--muted-foreground)" }} />
            </button>
            {menuOpen && (
              <div
                className="absolute right-0 top-6 z-20 w-36 rounded-lg border py-1 shadow-lg"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-red-500/10"
                  style={{ color: "#e05c5c" }}
                  onClick={() => { onDelete(note.id); setMenuOpen(false); }}
                >
                  <Trash2 size={12} />
                  Excluir
                </button>
              </div>
            )}
          </div>
        </div>

        {note.tags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {note.tags.slice(0, 3).map((tagId) => <TagChip key={tagId} tagId={tagId} />)}
          </div>
        )}

        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Editado {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>
    </motion.div>
  );
}
