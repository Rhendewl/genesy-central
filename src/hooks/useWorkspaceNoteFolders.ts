"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseClient } from "@/lib/supabase";
import type { NewWorkspaceNoteFolder, UpdateWorkspaceNoteFolder, WorkspaceNoteFolder } from "@/types/workspace-notes";

// ─────────────────────────────────────────────────────────────────────────────
// useWorkspaceNoteFolders — pastas de notas (mesmo formato de useWorkspaceNotes.ts).
// Busca sempre via GET /api/workspace/notes/folders, nunca um select() direto.
// ─────────────────────────────────────────────────────────────────────────────

export function useWorkspaceNoteFolders(viewAsUserId?: string) {
  const supabase = getSupabaseClient();

  const [folders,   setFolders]   = useState<WorkspaceNoteFolder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const mountedRef = useRef(true);

  const fetchFolders = useCallback(async () => {
    setError(null);
    const qs = viewAsUserId ? `?as_user_id=${viewAsUserId}` : "";
    const res  = await fetch(`/api/workspace/notes/folders${qs}`);
    const json = await res.json() as { folders?: WorkspaceNoteFolder[]; error?: string };

    if (!mountedRef.current) return;
    if (!res.ok || !json.folders) { setError(json.error ?? "Erro ao carregar pastas"); return; }
    setFolders(json.folders);
  }, [viewAsUserId]);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    fetchFolders().finally(() => { if (mountedRef.current) setIsLoading(false); });

    const channel = supabase
      .channel(`workspace-note-folders-realtime-${viewAsUserId ?? "self"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_note_folders" }, () => fetchFolders())
      // Notas mudam de pasta / são criadas-excluídas o tempo todo — a contagem
      // por pasta (note_count) depende disso, então também refaz o fetch aqui.
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_notes" }, () => fetchFolders())
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [fetchFolders, supabase, viewAsUserId]);

  async function createFolder(data: NewWorkspaceNoteFolder): Promise<{ error: string | null; folder: WorkspaceNoteFolder | null }> {
    try {
      const res  = await fetch("/api/workspace/notes/folders", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(viewAsUserId ? { ...data, user_id: viewAsUserId } : data),
      });
      const json = await res.json() as { folder?: WorkspaceNoteFolder; error?: string };
      if (!res.ok || !json.folder) return { error: json.error ?? "Erro ao criar pasta", folder: null };

      setFolders((prev) => [...prev, json.folder!]);
      return { error: null, folder: json.folder };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Erro ao criar pasta", folder: null };
    }
  }

  async function updateFolder(id: string, data: UpdateWorkspaceNoteFolder): Promise<{ error: string | null; folder: WorkspaceNoteFolder | null }> {
    const previous = folders;
    setFolders((prev) => prev.map((f) => f.id === id ? { ...f, ...data } as WorkspaceNoteFolder : f));

    try {
      const res  = await fetch(`/api/workspace/notes/folders/${id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(data),
      });
      const json = await res.json() as { folder?: WorkspaceNoteFolder; error?: string };
      if (!res.ok || !json.folder) {
        setFolders(previous);
        return { error: json.error ?? "Erro ao atualizar pasta", folder: null };
      }
      setFolders((prev) => prev.map((f) => f.id === id ? json.folder! : f));
      return { error: null, folder: json.folder };
    } catch (err) {
      setFolders(previous);
      return { error: err instanceof Error ? err.message : "Erro ao atualizar pasta", folder: null };
    }
  }

  async function deleteFolder(id: string): Promise<{ error: string | null }> {
    const previous = folders;
    setFolders((prev) => prev.filter((f) => f.id !== id));

    try {
      const res = await fetch(`/api/workspace/notes/folders/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        setFolders(previous);
        return { error: json.error ?? "Erro ao excluir pasta" };
      }
      return { error: null };
    } catch (err) {
      setFolders(previous);
      return { error: err instanceof Error ? err.message : "Erro ao excluir pasta" };
    }
  }

  return { folders, isLoading, error, createFolder, updateFolder, deleteFolder, refetch: fetchFolders };
}
