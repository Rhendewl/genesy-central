"use client";

import { useState } from "react";
import { Loader2, Plus, Tag as TagIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTags } from "@/hooks/useTags";
import { cn } from "@/lib/utils";

interface TagSelectorProps {
  value: string[];
  onChange: (tagIds: string[]) => void;
  disabled?: boolean;
  className?: string;
  helperText?: string;
}

export function TagSelector({ value, onChange, disabled = false, className, helperText }: TagSelectorProps) {
  const { tags, createTag, deleteTag } = useTags();
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#4a8fd4");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function toggle(tagId: string) {
    if (disabled) return;
    onChange(value.includes(tagId) ? value.filter((id) => id !== tagId) : [...value, tagId]);
  }

  async function create() {
    const cleanName = name.trim();
    if (!cleanName) return toast.error("Informe o nome da etiqueta");
    setCreating(true);
    const result = await createTag({ name: cleanName.slice(0, 60), color });
    setCreating(false);
    if (result.error || !result.tag) return toast.error(result.error ?? "Não foi possível criar a etiqueta");
    onChange(Array.from(new Set([...value, result.tag.id])));
    setName("");
    setCreatorOpen(false);
    toast.success("Etiqueta criada e selecionada");
  }

  async function remove(tagId: string, tagName: string) {
    if (disabled) return;
    if (!window.confirm(`Apagar a etiqueta “${tagName}”? Ela será removida das opções do CRM, Marketing e Workspace.`)) return;
    setDeletingId(tagId);
    const result = await deleteTag(tagId);
    setDeletingId(null);
    if (result.error) return toast.error(result.error);
    onChange(value.filter((id) => id !== tagId));
    toast.success("Etiqueta apagada");
  }

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          <TagIcon size={11} /> Etiquetas
        </p>
        {!disabled && (
          <button
            type="button"
            onClick={() => setCreatorOpen((current) => !current)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--accent-blue)] transition-colors hover:bg-[var(--hover)]"
          >
            <Plus size={12} /> Nova etiqueta
          </button>
        )}
      </div>

      {creatorOpen && !disabled && (
        <div className="rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] p-3">
          <div className="grid grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto]">
            <label
              className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg"
              style={{ background: color, boxShadow: `0 0 0 1px ${color}55` }}
              title="Escolher cor"
            >
              <TagIcon size={14} color="#fff" />
              <input type="color" value={color} onChange={(event) => setColor(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" aria-label="Cor da etiqueta" />
            </label>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void create(); } }}
              maxLength={60}
              placeholder="Ex.: Social media"
              className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--input)] px-2.5 text-sm text-[var(--text-title)] outline-none"
              autoFocus
            />
            <button type="button" onClick={() => void create()} disabled={creating || !name.trim()} className="lc-btn col-span-2 flex h-9 items-center justify-center gap-1.5 px-3 text-xs disabled:opacity-50 sm:col-span-1">
              {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Criar
            </button>
          </div>
          <p className="mt-2 text-[10px] text-[var(--muted-foreground)]">Clique no bloco colorido para escolher a cor.</p>
        </div>
      )}

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => {
            const active = value.includes(tag.id);
            return (
              <span
                key={tag.id}
                className="inline-flex overflow-hidden rounded-full"
                style={{ background: active ? `${tag.color}30` : "var(--hover)", border: `1px solid ${active ? tag.color + "60" : "var(--glass-border)"}` }}
              >
                <button type="button" onClick={() => toggle(tag.id)} disabled={disabled} className="px-2.5 py-1 text-[11px] font-medium disabled:cursor-default" style={{ color: active ? tag.color : "var(--muted-foreground)" }}>
                  {tag.name}
                </button>
                {!disabled && (
                  <button type="button" onClick={() => void remove(tag.id, tag.name)} disabled={deletingId === tag.id} className="flex items-center border-l px-1.5 opacity-60 transition-opacity hover:opacity-100" style={{ borderColor: active ? `${tag.color}45` : "var(--glass-border)", color: active ? tag.color : "var(--muted-foreground)" }} aria-label={`Apagar etiqueta ${tag.name}`}>
                    {deletingId === tag.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                  </button>
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">Nenhuma etiqueta criada ainda.</p>
      )}
      {helperText && <p className="text-[10px] text-[var(--muted-foreground)]">{helperText}</p>}
    </div>
  );
}
