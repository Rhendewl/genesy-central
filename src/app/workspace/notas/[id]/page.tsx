"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Trash2, Loader2 } from "lucide-react";
import { useWorkspaceNote } from "@/hooks/useWorkspaceNote";
import { useTags } from "@/hooks/useTags";
import { NoteEditor } from "@/components/workspace/notes/NoteEditor";
import { NoteCoverUpload } from "@/components/workspace/notes/NoteCoverUpload";

const COLOR_SWATCHES = ["#4a8fd4", "#6b9b6f", "#e0a344", "#e05c5c", "#9b7fe0", "#7c878e"];

export default function WorkspaceNoteEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { tags } = useTags();
  const {
    note, title, content, isLoading, isSaving, error,
    setTitle, setContent, saveImmediate, flush,
  } = useWorkspaceNote(id);

  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Flush pendente ao fechar a aba/navegador
  useEffect(() => {
    function handleBeforeUnload() { void flush(); }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      void flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleBack() {
    await flush();
    router.push("/workspace/notas");
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/workspace/notes/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        toast.error(json.error ?? "Erro ao excluir nota");
        return;
      }
      router.push("/workspace/notas");
    } finally {
      setIsDeleting(false);
    }
  }

  function toggleTag(tagId: string) {
    if (!note) return;
    const next = note.tags.includes(tagId) ? note.tags.filter((t) => t !== tagId) : [...note.tags, tagId];
    void saveImmediate({ tags: next });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 size={24} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
      </div>
    );
  }

  if (error || !note) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-red-400">{error ?? "Nota não encontrada"}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col pb-24">
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <button onClick={handleBack} className="flex items-center gap-1.5 text-sm" style={{ color: "var(--muted-foreground)" }}>
          <ArrowLeft size={15} />
          Notas
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
            {isSaving ? "Salvando…" : "Salvo"}
          </span>
          <button onClick={() => setConfirmDelete(true)} aria-label="Excluir nota">
            <Trash2 size={16} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 sm:px-6">
        <NoteCoverUpload
          noteId={id}
          coverUrl={note.cover_url}
          onUpload={(url) => void saveImmediate({ cover_url: url })}
          onRemove={() => void saveImmediate({ cover_url: null })}
        />

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Nota sem título"
          className="bg-transparent text-2xl font-bold outline-none placeholder:text-[var(--muted-foreground)]"
          style={{ color: "var(--text-title)" }}
        />

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            {COLOR_SWATCHES.map((c) => (
              <button
                key={c}
                onClick={() => void saveImmediate({ color: note.color === c ? null : c })}
                className="h-5 w-5 rounded-full transition-transform"
                style={{
                  background: c,
                  transform:  note.color === c ? "scale(1.2)" : "scale(1)",
                  boxShadow:  note.color === c ? `0 0 0 2px var(--background), 0 0 0 3px ${c}` : undefined,
                }}
              />
            ))}
          </div>

          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => {
                const active = note.tags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                    style={{
                      background: active ? `${tag.color}30` : "var(--hover)",
                      color:      active ? tag.color : "var(--muted-foreground)",
                      border:     `1px solid ${active ? tag.color + "50" : "var(--glass-border)"}`,
                    }}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <NoteEditor noteId={id} content={content} onChange={setContent} />
      </div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 lc-scrim"
          style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl"
            style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
          >
            <div className="flex flex-col gap-2 px-5 pb-4 pt-5">
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Excluir nota</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Esta ação não pode ser desfeita.</p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isDeleting}
                className="rounded-full px-4 py-1.5 text-xs disabled:opacity-40"
                style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs disabled:opacity-40"
                style={{ background: "#e05c5c", color: "#fff" }}
              >
                {isDeleting && <Loader2 size={12} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
