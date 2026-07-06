"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { WorkspaceNote, WorkspaceNoteSummary } from "@/types/workspace-notes";

// ─────────────────────────────────────────────────────────────────────────────
// useWorkspaceNotes — grade de notas (mesmo formato de useWorkspaceTasks.ts)
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkspaceNotes() {
  const supabase = getSupabaseClient();

  const [notes,     setNotes]     = useState<WorkspaceNoteSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchNotes = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase
      .from("workspace_notes")
      .select("id,title,cover_url,color,tags,created_at,updated_at")
      .order("updated_at", { ascending: false });

    if (!mountedRef.current) return;
    if (err) { setError(err.message); return; }
    setNotes((data as WorkspaceNoteSummary[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    fetchNotes().finally(() => { if (mountedRef.current) setIsLoading(false); });

    const channel = supabase
      .channel("workspace-notes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_notes" }, () => fetchNotes())
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchNotes, supabase]);

  async function createNote(): Promise<{ error: string | null; note: WorkspaceNote | null }> {
    try {
      const res  = await fetch("/api/workspace/notes", { method: "POST" });
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
