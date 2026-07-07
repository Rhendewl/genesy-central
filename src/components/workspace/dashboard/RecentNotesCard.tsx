"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { ArrowUpRight, StickyNote } from "lucide-react";
import { extractPlainText } from "@/lib/tiptap-text";
import type { WorkspaceNote, WorkspaceNoteSummary } from "@/types/workspace-notes";

const MAX_VISIBLE = 3;

interface RecentNotesCardProps {
  notes:  WorkspaceNoteSummary[]; // já ordenado por updated_at desc
  delay?: number;
  /** Quando true, não desenha o próprio card de vidro — usado ao aninhar
   * dentro de outro card (ex: painel resumo do Workspace no Dashboard Geral). */
  bare?:  boolean;
}

export function RecentNotesCard({ notes, delay = 0, bare = false }: RecentNotesCardProps) {
  const recent = notes.slice(0, MAX_VISIBLE);
  const [snippets, setSnippets] = useState<Record<string, string>>({});

  // Busca o conteúdo completo só das 3 notas exibidas — a lista principal de
  // notas (useWorkspaceNotes) mantém a query leve, sem content, de propósito.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        recent.map((n) => fetch(`/api/workspace/notes/${n.id}`).then((r) => r.json()).catch(() => null))
      );
      if (cancelled) return;
      const next: Record<string, string> = {};
      results.forEach((json: { note?: WorkspaceNote } | null, i) => {
        if (json?.note) next[recent[i].id] = extractPlainText(json.note.content, 90);
      });
      setSnippets(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recent.map((n) => n.id).join(",")]);

  return (
    <motion.div
      className={bare ? "" : "lc-card p-6"}
      style={bare ? undefined : { background: "var(--glass-bg-soft)" }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl">
            <StickyNote size={17} style={{ color: "var(--text-title)" }} />
          </div>
          <div>
            <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--silver)" }}>Últimas Notas</p>
            <p className="text-[10px] text-[var(--muted-foreground)]">Criadas ou editadas recentemente</p>
          </div>
        </div>
        <Link href="/workspace/notas" className="text-[var(--muted-foreground)] hover:text-[var(--text-title)]">
          <ArrowUpRight size={15} />
        </Link>
      </div>

      <div className="flex flex-col gap-1">
        {recent.length === 0 && (
          <p className="py-6 text-center text-xs" style={{ color: "var(--muted-foreground)" }}>
            Nenhuma nota ainda
          </p>
        )}
        {recent.map((note) => (
          <Link
            key={note.id}
            href={`/workspace/notas/${note.id}`}
            className="flex flex-col gap-0.5 rounded-lg px-1 py-1.5 transition-colors hover:bg-[var(--hover)]"
          >
            <p className="truncate text-sm font-medium" style={{ color: "var(--text-title)" }}>
              {note.title || "Nota sem título"}
            </p>
            {snippets[note.id] && (
              <p className="truncate text-xs" style={{ color: "var(--muted-foreground)" }}>{snippets[note.id]}</p>
            )}
            <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              Editado {formatDistanceToNow(new Date(note.updated_at), { addSuffix: true, locale: ptBR })}
            </p>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}
