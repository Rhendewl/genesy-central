"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import type { WorkspaceNote, UpdateWorkspaceNote } from "@/types/workspace-notes";

// ─────────────────────────────────────────────────────────────────────────────
// useWorkspaceNote — hook da página do editor de uma nota.
//
// Autosave: mesmo mecanismo de CreativeCanvas.tsx (setTimeout/clearTimeout,
// debounce de 3s sobre uma flag "dirty") aplicado a title+content. Campos
// discretos (cover_url/color/tags) salvam imediato via saveImmediate().
// flush() força o save pendente antes de navegar para fora da página.
// ─────────────────────────────────────────────────────────────────────────────

const AUTOSAVE_DELAY_MS = 3000;

export function useWorkspaceNote(noteId: string) {
  const [note,      setNote]      = useState<WorkspaceNote | null>(null);
  const [title,     setTitleState]   = useState("");
  const [content,   setContentState] = useState<JSONContent>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving,  setIsSaving]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setIsLoading(true);
    (async () => {
      try {
        const res  = await fetch(`/api/workspace/notes/${noteId}`);
        const json = await res.json() as { note?: WorkspaceNote; error?: string };
        if (!mountedRef.current) return;
        if (!res.ok || !json.note) throw new Error(json.error ?? "Erro ao carregar nota");
        setNote(json.note);
        setTitleState(json.note.title);
        setContentState(json.note.content ?? {});
      } catch (err) {
        if (mountedRef.current) setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        if (mountedRef.current) setIsLoading(false);
      }
    })();
    return () => { mountedRef.current = false; };
  }, [noteId]);

  const persist = useCallback(async (patch: UpdateWorkspaceNote) => {
    setIsSaving(true);
    try {
      const res  = await fetch(`/api/workspace/notes/${noteId}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(patch),
      });
      const json = await res.json() as { note?: WorkspaceNote };
      if (res.ok && json.note && mountedRef.current) setNote(json.note);
    } finally {
      if (mountedRef.current) setIsSaving(false);
      dirtyRef.current = false;
    }
  }, [noteId]);

  // Autosave de title+content, debounce de 3s
  useEffect(() => {
    if (!dirtyRef.current) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void persist({ title, content }); }, AUTOSAVE_DELAY_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  function setTitle(next: string) {
    dirtyRef.current = true;
    setTitleState(next);
  }

  function setContent(next: JSONContent) {
    dirtyRef.current = true;
    setContentState(next);
  }

  // Campos discretos — salvam imediato, sem passar pelo debounce de título/conteúdo
  async function saveImmediate(patch: UpdateWorkspaceNote) {
    await persist(patch);
  }

  // Força o save pendente antes de navegar para fora da página
  async function flush() {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (dirtyRef.current) await persist({ title, content });
  }

  return {
    note, title, content, isLoading, isSaving, error,
    setTitle, setContent, saveImmediate, flush,
  };
}
