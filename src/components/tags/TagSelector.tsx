"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Tag as TagIcon, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useTags } from "@/hooks/useTags";
import { cn } from "@/lib/utils";
import { semanticChipStyle } from "@/lib/semantic-chip";

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
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const selectedTags = tags.filter(tag => value.includes(tag.id));
  const filteredTags = tags.filter(tag => tag.name.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

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
    <div ref={root} className={cn("relative space-y-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
          <TagIcon size={11} /> Etiquetas
        </p>
        {!disabled && (
          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-[var(--accent-blue)] transition-colors hover:bg-[var(--hover)]"
          >
            <Plus size={12} /> Adicionar etiqueta <ChevronDown size={11} />
          </button>
        )}
      </div>

      {selectedTags.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {selectedTags.map(tag => <span key={tag.id} className="lc-semantic-chip inline-flex items-center overflow-hidden rounded-full border" style={semanticChipStyle(tag.color)}><span className="px-2.5 py-1 text-[11px] font-medium">{tag.name}</span>{!disabled && <button type="button" onClick={() => toggle(tag.id)} className="border-l px-1.5 opacity-60 hover:opacity-100" style={{ borderColor: "currentColor" }} aria-label={`Remover etiqueta ${tag.name}`}><X size={10} /></button>}</span>)}
        </div>
      ) : (
        <p className="text-xs text-[var(--muted-foreground)]">Nenhuma etiqueta adicionada.</p>
      )}

      {open && !disabled && <div className="lc-modal-panel mt-1.5 max-h-80 overflow-y-auto rounded-xl p-2 shadow-xl">
        <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar etiqueta…" className="mb-2 h-9 w-full rounded-lg border bg-[var(--input)] px-2.5 text-sm outline-none" autoFocus />
        <div className="space-y-0.5">{filteredTags.map(tag => {
          const active = value.includes(tag.id);
          return <div key={tag.id} className="flex items-center rounded-lg hover:bg-[var(--hover)]"><button type="button" onClick={() => toggle(tag.id)} className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ background: tag.color }} /><span className="truncate">{tag.name}</span>{active && <Check size={13} className="ml-auto" />}</button><button type="button" onClick={() => void remove(tag.id, tag.name)} disabled={deletingId === tag.id} className="p-2 text-[var(--muted-foreground)] hover:text-red-400" aria-label={`Apagar etiqueta ${tag.name}`}>{deletingId === tag.id ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />}</button></div>;
        })}</div>
        <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--border)" }}>{!creatorOpen ? <button type="button" onClick={() => setCreatorOpen(true)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-[var(--primary)] hover:bg-[var(--hover)]"><Plus size={13} /> Criar nova etiqueta</button> : <div className="space-y-2"><div className="flex gap-2"><label className="relative flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-lg" style={{ background: color }}><TagIcon size={14} color="#fff" /><input type="color" value={color} onChange={event => setColor(event.target.value)} className="absolute inset-0 opacity-0" aria-label="Cor da etiqueta" /></label><input value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void create(); } }} maxLength={60} placeholder="Nome da etiqueta" className="h-9 min-w-0 flex-1 rounded-lg border bg-[var(--input)] px-2.5 text-sm outline-none" /></div><button type="button" onClick={() => void create()} disabled={creating || !name.trim()} className="lc-btn flex h-9 w-full items-center justify-center gap-1.5 text-xs disabled:opacity-50">{creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Criar e adicionar</button></div>}</div>
      </div>}
      {helperText && <p className="text-[10px] text-[var(--muted-foreground)]">{helperText}</p>}
    </div>
  );
}
