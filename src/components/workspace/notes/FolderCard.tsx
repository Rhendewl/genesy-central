"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MoreHorizontal, Trash2, Pencil, Folder } from "lucide-react";
import type { WorkspaceNoteFolder } from "@/types/workspace-notes";

interface FolderCardProps {
  folder:   WorkspaceNoteFolder;
  onEdit:   (folder: WorkspaceNoteFolder) => void;
  onDelete: (folder: WorkspaceNoteFolder) => void;
}

const DEFAULT_COLOR = "#7c878e";

export function FolderCard({ folder, onEdit, onDelete }: FolderCardProps) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const color = folder.color ?? DEFAULT_COLOR;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="group relative flex w-28 cursor-pointer flex-col items-center gap-1.5 rounded-xl p-2 text-center transition-colors hover:bg-[var(--hover)]"
      onClick={() => router.push(`/workspace/notas/pasta/${folder.id}`)}
      title={folder.client_name ? `${folder.name} — ${folder.client_name}` : folder.name}
    >
      <div className="relative">
        <Folder size={64} strokeWidth={1.25} fill={color} style={{ color }} />

        <div className="absolute -right-1 -top-1">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className="flex h-6 w-6 items-center justify-center rounded-full opacity-0 shadow-sm transition-opacity hover:opacity-100 group-hover:opacity-100"
            style={{ background: "var(--card)", border: "1px solid var(--border)" }}
          >
            <MoreHorizontal size={12} style={{ color: "var(--muted-foreground)" }} />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-7 z-20 w-36 rounded-lg border py-1 text-left shadow-lg"
              style={{ background: "var(--card)", borderColor: "var(--border)" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-[var(--hover)]"
                style={{ color: "var(--text-title)" }}
                onClick={() => { onEdit(folder); setMenuOpen(false); }}
              >
                <Pencil size={12} />
                Editar
              </button>
              <button
                className="flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors hover:bg-red-500/10"
                style={{ color: "#e05c5c" }}
                onClick={() => { onDelete(folder); setMenuOpen(false); }}
              >
                <Trash2 size={12} />
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="w-full truncate text-sm font-medium" style={{ color: "var(--text-title)" }}>
        {folder.name}
      </p>
      <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        {folder.note_count ?? 0} {folder.note_count === 1 ? "nota" : "notas"}
      </p>
    </motion.div>
  );
}
