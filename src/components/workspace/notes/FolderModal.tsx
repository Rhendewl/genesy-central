"use client";

import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import { useTags } from "@/hooks/useTags";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import type { NewWorkspaceNoteFolder, WorkspaceNoteFolder } from "@/types/workspace-notes";

const COLOR_SWATCHES = ["#4a8fd4", "#6b9b6f", "#e0a344", "#e05c5c", "#9b7fe0", "#7c878e"];

interface FolderModalProps {
  folder?:  WorkspaceNoteFolder | null;
  onClose:  () => void;
  onSave:   (data: NewWorkspaceNoteFolder) => Promise<{ error: string | null }>;
  onDelete?: () => Promise<void>;
}

export function FolderModal({ folder, onClose, onSave, onDelete }: FolderModalProps) {
  const { tags } = useTags();
  const { clients } = useAgencyClients();

  const [name,     setName]     = useState(folder?.name ?? "");
  const [color,    setColor]    = useState<string | null>(folder?.color ?? null);
  const [clientId, setClientId] = useState<string | null>(folder?.client_id ?? null);
  const [selectedTags, setSelectedTags] = useState<string[]>(folder?.tags ?? []);
  const [isSaving,      setIsSaving]      = useState(false);
  const [isDeleting,    setIsDeleting]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleTag(tagId: string) {
    setSelectedTags((prev) => prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]);
  }

  async function handleSave() {
    if (!name.trim()) { setError("Nome é obrigatório"); return; }
    setIsSaving(true);
    setError(null);
    const result = await onSave({ name: name.trim(), color, client_id: clientId, tags: selectedTags });
    setIsSaving(false);
    if (result.error) { setError(result.error); return; }
    onClose();
  }

  async function handleDelete() {
    if (!onDelete) return;
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 lc-scrim"
      style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl"
        style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            {folder ? "Editar pasta" : "Nova pasta"}
          </p>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--hover)]">
            <X size={16} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Nome</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Reuniões, Ideias, Cliente X..."
              autoFocus
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Cor</label>
            <div className="flex items-center gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(color === c ? null : c)}
                  className="h-5 w-5 rounded-full transition-transform"
                  style={{
                    background: c,
                    transform:  color === c ? "scale(1.2)" : "scale(1)",
                    boxShadow:  color === c ? `0 0 0 2px var(--bg-modal), 0 0 0 3px ${c}` : undefined,
                  }}
                />
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Cliente vinculado (opcional)</label>
            <select
              value={clientId ?? ""}
              onChange={(e) => setClientId(e.target.value || null)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
            >
              <option value="">Nenhum cliente</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {tags.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Tags</label>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const active = selectedTags.includes(tag.id);
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
            </div>
          )}

          {error && <p className="text-xs" style={{ color: "#e05c5c" }}>{error}</p>}

          {confirmDelete && folder && (folder.note_count ?? 0) > 0 && (
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              As {folder.note_count} nota{folder.note_count === 1 ? "" : "s"} desta pasta vão para &quot;Sem pasta&quot; — nenhuma nota é excluída.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
          {folder && onDelete ? (
            <button
              onClick={confirmDelete ? handleDelete : () => setConfirmDelete(true)}
              disabled={isDeleting}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs disabled:opacity-40"
              style={{
                background: confirmDelete ? "#e05c5c" : "transparent",
                color:      confirmDelete ? "#fff" : "#e05c5c",
                border:     confirmDelete ? "none" : "1px solid #e05c5c50",
              }}
            >
              {isDeleting && <Loader2 size={12} className="animate-spin" />}
              {confirmDelete ? "Confirmar exclusão" : "Excluir pasta"}
            </button>
          ) : <span />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-4 py-1.5 text-xs"
              style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="lc-btn flex items-center gap-1.5 px-4 py-1.5 text-xs disabled:opacity-40"
            >
              {isSaving && <Loader2 size={12} className="animate-spin" />}
              {folder ? "Salvar" : "Criar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
