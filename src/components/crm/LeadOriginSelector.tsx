"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useLeadOrigins } from "@/hooks/useLeadOrigins";
import type { LeadOrigin } from "@/types";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (originId: string | null, origin: LeadOrigin | null) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function LeadOriginSelector({ value, onChange, disabled, className, placeholder = "Selecionar origem" }: Props) {
  const { origins, isLoading, createOrigin, deleteOrigin } = useLeadOrigins();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#64748b");
  const root = useRef<HTMLDivElement>(null);
  const selected = origins.find(origin => origin.id === value) ?? null;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => { if (root.current && !root.current.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    const result = await createOrigin({ name, color });
    setSaving(false);
    if (result.error || !result.origin) return toast.error(result.error ?? "Não foi possível criar a origem");
    onChange(result.origin.id, result.origin);
    setName(""); setCreating(false); setOpen(false);
    toast.success("Origem criada e selecionada");
  }

  async function remove(origin: LeadOrigin) {
    if (!window.confirm(`Apagar a origem “${origin.name}”? Leads existentes manterão o texto histórico da origem.`)) return;
    setDeletingId(origin.id);
    const result = await deleteOrigin(origin.id);
    setDeletingId(null);
    if (result.error) return toast.error(result.error);
    if (value === origin.id) onChange(null, null);
    toast.success("Origem removida");
  }

  return (
    <div ref={root} className={cn("relative", className)}>
      <button type="button" disabled={disabled || isLoading} onClick={() => setOpen(current => !current)} className="flex min-h-10 w-full items-center gap-2 rounded-xl border bg-transparent px-3 py-2 text-left text-sm disabled:opacity-50">
        {selected ? <span className="h-2.5 w-2.5 rounded-full" style={{ background: selected.color }} /> : null}
        <span className="min-w-0 flex-1 truncate">{selected?.name ?? placeholder}</span>
        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <ChevronDown size={14} />}
      </button>
      {open && !disabled && (
        <div className="lc-modal-panel mt-1.5 max-h-72 overflow-y-auto rounded-xl p-1.5 shadow-xl">
          {origins.map(origin => (
            <div key={origin.id} className="flex items-center rounded-lg hover:bg-[var(--hover)]">
              <button type="button" onClick={() => { onChange(origin.id, origin); setOpen(false); }} className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: origin.color }} />
                <span className="truncate">{origin.name}</span>{value === origin.id && <Check size={13} className="ml-auto" />}
              </button>
              {!origin.is_default && <button type="button" onClick={() => void remove(origin)} className="p-2 text-[var(--muted-foreground)] hover:text-red-400" aria-label={`Apagar origem ${origin.name}`}>{deletingId === origin.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}</button>}
            </div>
          ))}
          <div className="mt-1 border-t pt-1" style={{ borderColor: "var(--border)" }}>
            {!creating ? <button type="button" onClick={() => setCreating(true)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--primary)] hover:bg-[var(--hover)]"><Plus size={14} /> Criar nova origem</button> : (
              <div className="space-y-2 p-2">
                <div className="flex gap-2"><input type="color" value={color} onChange={event => setColor(event.target.value)} className="h-9 w-9 rounded-lg" aria-label="Cor da origem" /><input value={name} onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); void create(); } }} placeholder="Ex.: YouTube" maxLength={60} className="h-9 min-w-0 flex-1 rounded-lg border bg-[var(--input)] px-2.5 text-sm outline-none" autoFocus /></div>
                <button type="button" onClick={() => void create()} disabled={saving || !name.trim()} className="lc-btn flex h-9 w-full items-center justify-center gap-1.5 text-xs disabled:opacity-50">{saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />} Criar origem</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
