"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { MoreHorizontal, Trash2, StickyNote, FolderInput } from "lucide-react";
import type { WorkspaceNoteFolder, WorkspaceNoteSummary } from "@/types/workspace-notes";

interface NoteCardProps {
  note:     WorkspaceNoteSummary;
  onDelete: (id: string) => void;
  /** Quando presente (não vazio), habilita "Mover para pasta" no menu. */
  folders?: WorkspaceNoteFolder[];
  onMove?:  (noteId: string, folderId: string) => void;
}

export function NoteCard({ note, onDelete, folders, onMove }: NoteCardProps) {
  const router = useRouter();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => { setMounted(true); }, []);

  function handleToggleMenu(e: React.MouseEvent) {
    e.stopPropagation();
    if (!menuOpen && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.right - 176 });
    }
    setMenuOpen((o) => !o);
    setMoveOpen(false);
  }

  function closeMenu() {
    setMenuOpen(false);
    setMoveOpen(false);
  }

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
        <div className="flex h-28 w-full items-center justify-center" style={{ background: "var(--hover)" }}>
          <StickyNote size={22} style={{ color: note.color ?? "var(--text-empty)" }} />
        </div>
      )}

      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <h3 className="flex-1 truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            {note.title || "Nota sem título"}
          </h3>
          <button
            ref={btnRef}
            onClick={handleToggleMenu}
            className="rounded p-1 opacity-0 transition-opacity hover:bg-[var(--hover)] group-hover:opacity-100"
          >
            <MoreHorizontal size={14} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Editado {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>

      {mounted && createPortal(
        <>
          {menuOpen && (
            <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={(e) => { e.stopPropagation(); closeMenu(); }} />
          )}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.12 }}
                style={{ position: "fixed", top: pos.top, left: pos.left, zIndex: 9999, width: 176 }}
                className="rounded-lg shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ background: "var(--card)", border: "1px solid var(--border)" }} className="rounded-lg py-1">
                  {!moveOpen ? (
                    <>
                      {folders && folders.length > 0 && onMove && (
                        <button
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-[var(--hover)]"
                          style={{ color: "var(--text-title)" }}
                          onClick={() => setMoveOpen(true)}
                        >
                          <FolderInput size={12} />
                          Mover para pasta
                        </button>
                      )}
                      <button
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-red-500/10"
                        style={{ color: "#e05c5c" }}
                        onClick={() => { onDelete(note.id); closeMenu(); }}
                      >
                        <Trash2 size={12} />
                        Excluir
                      </button>
                    </>
                  ) : (
                    <div className="max-h-48 overflow-y-auto">
                      {folders!.map((folder) => (
                        <button
                          key={folder.id}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-[var(--hover)]"
                          style={{ color: "var(--text-title)" }}
                          onClick={() => { onMove!(note.id, folder.id); closeMenu(); }}
                        >
                          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: folder.color ?? "var(--text-empty)" }} />
                          <span className="truncate">{folder.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>,
        document.body
      )}
    </motion.div>
  );
}
