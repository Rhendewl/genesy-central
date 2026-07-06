"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { WorkspaceNote, WorkspaceNoteSummary } from "@/types/workspace-notes";

// ─────────────────────────────────────────────────────────────────────────────
// useWorkspaceNotes — grade de notas (mesmo formato de useWorkspaceTasks.ts).
// Busca sempre via GET /api/workspace/notes, nunca um select() direto sem
// filtro de user_id — ver o comentário equivalente em useWorkspaceTasks.ts.
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkspaceNotes(viewAsUserId?: string) {
  const supabase = getSupabaseClient();

  const [notes,     setNotes]     = useState<WorkspaceNoteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchNotes = useCallback(async () => {
    setError(null);
    const qs = viewAsUserId ? `?as_user_id=${viewAsUserId}` : "";
    const res  = await fetch(`/api/workspace/notes${qs}`);
    const json = await res.json() as { notes?: WorkspaceNoteSummary[]; error?: string };

    if (!mountedRef.current) return;
    if (!res.ok || !json.notes) { setError(json.error ?? "Erro ao carregar notas"); return; }
    setNotes(json.notes);
  }, [viewAsUserId]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    fetchNotes().finally(() => { if (mountedRef.current) setIsLoading(false); });

    const channel = supabase
      .channel(`workspace-notes-realtime-${viewAsUserId ?? "self"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_notes" }, () => fetchNotes())
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchNotes, supabase, viewAsUserId]);

  async function createNote(): Promise<{ error: string | null; note: WorkspaceNote | null }> {
    try {
      const res  = await fetch("/api/workspace/notes", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(viewAsUserId ? { user_id: viewAsUserId } : {}),
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

  return { notes, isLoading, error, createNote, deleteNote, refetch: fetchNotes };
}
