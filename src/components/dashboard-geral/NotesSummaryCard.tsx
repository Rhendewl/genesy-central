"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { ArrowUpRight, StickyNote } from "lucide-react";
import { useWorkspaceNotes } from "@/hooks/useWorkspaceNotes";

interface NotesSummaryCardProps {
  height: number;
  delay?: number;
}

export function NotesSummaryCard({ height, delay = 0 }: NotesSummaryCardProps) {
  const { notes, isLoading } = useWorkspaceNotes();

  const recentNotes = [...notes]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 4);

  return (
    <motion.a
      href="/workspace/notas"
      className="lc-card group flex flex-col cursor-pointer overflow-hidden p-6"
      style={{ background: "rgba(0,0,0,0.31)", height }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <div className="mb-4 flex flex-shrink-0 items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl">
            <StickyNote size={17} style={{ color: "#ffffff" }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight" style={{ color: "#b4b4b4" }}>Notas</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">Últimas criadas</p>
          </div>
        </div>
        <ArrowUpRight
          size={15}
          className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          style={{ color: "#ffffff" }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-[51px] animate-pulse rounded-xl" style={{ background: "var(--shimmer-base)" }} />)}
          </div>
        ) : recentNotes.length === 0 ? (
          <p className="py-6 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
            Nenhuma nota ainda
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {recentNotes.map((note) => (
              <Link
                key={note.id}
                href={`/workspace/notas/${note.id}`}
                onClick={(e) => e.stopPropagation()}
                className="rounded-xl p-3 transition-colors hover:bg-white/[0.04]"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
              >
                <p className="truncate text-[12px] font-semibold" style={{ color: "var(--text-title)" }}>
                  {note.title || "Nota sem título"}
                </p>
                <p className="mt-1 truncate text-[9px]" style={{ color: "var(--muted-foreground)" }}>
                  Criada {formatDistanceToNow(new Date(note.created_at), { addSuffix: true, locale: ptBR })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </motion.a>
  );
}
