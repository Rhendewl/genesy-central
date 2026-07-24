"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { MoreHorizontal, Trash2, Pencil } from "lucide-react";
import type { WorkspaceNoteFolder } from "@/types/workspace-notes";
import { GlassFolderIcon } from "@/components/ui/GlassFolderIcon";

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
      whileHover={{ y: -5 }}
      transition={{ duration: 0.2 }}
      className="glass-folder-card group relative flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-[20px] border p-3 text-center transition-all"
      style={{ "--folder-color": color } as React.CSSProperties}
      onClick={() => router.push(`/workspace/notas/pasta/${folder.id}`)}
      title={folder.client_name ? `${folder.name} — ${folder.client_name}` : folder.name}
    >
      <div className="glass-folder-glow pointer-events-none absolute inset-0 opacity-70" style={{ "--folder-color": color } as React.CSSProperties} />
      <div className="relative">
        <GlassFolderIcon color={color} className="h-16 w-[4.5rem] sm:h-20 sm:w-24" />
      </div>

      <button type="button" onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); }}
        className="absolute right-2.5 top-2.5 z-20 flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-xl hover:bg-[var(--hover)]"
        style={{ background: "color-mix(in srgb, var(--card) 68%, transparent)", borderColor: "var(--border)", color: "var(--muted-foreground)" }}
        aria-label={`Opções da pasta ${folder.name}`} aria-expanded={menuOpen}>
        <MoreHorizontal size={13} />
      </button>
      {menuOpen && (
        <div className="absolute right-2.5 top-11 z-30 w-32 overflow-hidden rounded-xl border py-1 text-left shadow-2xl backdrop-blur-xl"
          style={{ background: "color-mix(in srgb, var(--card) 92%, transparent)", borderColor: "var(--border)" }}
          onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => { setMenuOpen(false); onEdit(folder); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-[var(--hover)]" style={{ color: "var(--text-title)" }}>
            <Pencil size={12} /> Editar
          </button>
          <button type="button" onClick={() => { setMenuOpen(false); onDelete(folder); }}
            className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-red-500/10" style={{ color: "#e05c5c" }}>
            <Trash2 size={12} /> Excluir
          </button>
        </div>
      )}

      <p className="relative w-full truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>
        {folder.name}
      </p>
      <p className="relative text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        {folder.note_count ?? 0} {folder.note_count === 1 ? "nota" : "notas"}
      </p>
    </motion.div>
  );
}
