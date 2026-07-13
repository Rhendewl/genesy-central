"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { WorkspaceNote, WorkspaceNoteSummary } from "@/types/workspace-notes";

// ─────────────────────────────────────────────────────────────────────────────
// useWorkspaceNotes — grade de notas (mesmo formato de useWorkspaceTasks.ts).
// Busca sempre via GET /api/workspace/notes, nunca um select() direto sem
// filtro de user_id — ver o comentário equivalente em useWorkspaceTasks.ts.
// ─────────────────────────────────────────────────────────────────────────────

// folderId: undefined = todas as notas; "none" = só notas sem pasta; um uuid = notas daquela pasta.
export function useWorkspaceNotes(viewAsUserId?: string, folderId?: string) {
  const supabase = getSupabaseClient();

  const [notes,     setNotes]     = useState<WorkspaceNoteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchNotes = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (viewAsUserId) params.set("as_user_id", viewAsUserId);
    if (folderId)     params.set("folder_id", folderId);
    const qs = params.toString() ? `?${params.toString()}` : "";
    const res  = await fetch(`/api/workspace/notes${qs}`);
    const json = await res.json() as { notes?: WorkspaceNoteSummary[]; error?: string };

    if (!mountedRef.current) return;
    if (!res.ok || !json.notes) { setError(json.error ?? "Erro ao carregar notas"); return; }
    setNotes(json.notes);
  }, [viewAsUserId, folderId]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    fetchNotes().finally(() => { if (mountedRef.current) setIsLoading(false); });

    const channel = supabase
      .channel(`workspace-notes-realtime-${viewAsUserId ?? "self"}-${folderId ?? "all"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_notes" }, () => fetchNotes())
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchNotes, supabase, viewAsUserId, folderId]);

  async function createNote(): Promise<{ error: string | null; note: WorkspaceNote | null }> {
    try {
      const res  = await fetch("/api/workspace/notes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          ...(viewAsUserId ? { user_id: viewAsUserId } : {}),
          ...(folderId && folderId !== "none" ? { folder_id: folderId } : {}),
        }),
      });
      const json = await res.json() as { note?: WorkspaceNote; error?: string };
      if (!res.ok || !json.note) return { error: json.error ?? "Erro ao criar nota", note: null };

      setNotes((prev) => [json.note!, ...prev]);
      return { error: null, note: json.note };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Erro ao criar nota", note: null };
    }
  }

  async function deleteNote(id: string): Promise<{ error: string | null }> {
    const previous = notes.find((n) => n.id === id);
    setNotes((prev) => prev.filter((n) => n.id !== id));

    try {
      const res = await fetch(`/api/workspace/notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        if (previous) setNotes((prev) => [...prev, previous]);
        return { error: json.error ?? "Erro ao excluir nota" };
      }
      return { error: null };
    } catch (err) {
      if (previous) setNotes((prev) => [...prev, previous]);
      return { error: err instanceof Error ? err.message : "Erro ao excluir nota" };
    }
  }

  // Move a nota para outra pasta (ou "none" pra tirar de qualquer pasta).
  // Sempre remove otimisticamente da lista local: em ambas as telas que usam
  // este hook (pasta específica ou "sem pasta"), mover pra uma pasta diferente
  // da atual sempre tira a nota do filtro corrente.
  async function moveNote(id: string, targetFolderId: string): Promise<{ error: string | null }> {
    const previous = notes.find((n) => n.id === id);
    setNotes((prev) => prev.filter((n) => n.id !== id));

    try {
      const res = await fetch(`/api/workspace/notes/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ folder_id: targetFolderId === "none" ? null : targetFolderId }),
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        if (previous) setNotes((prev) => [...prev, previous]);
        return { error: json.error ?? "Erro ao mover nota" };
      }
      return { error: null };
    } catch (err) {
      if (previous) setNotes((prev) => [...prev, previous]);
      return { error: err instanceof Error ? err.message : "Erro ao mover nota" };
    }
  }

  return { notes, isLoading, error, createNote, deleteNote, moveNote, refetch: fetchNotes };
}
