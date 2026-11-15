"use client";

import { useRef, useState } from "react";
import { ArrowRightLeft, Check, ChevronDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { CrmStage } from "@/types/crm";

type MoveResult = { ok: boolean; requireNote: boolean; error: string | null };
export function LeadStageMover({ stages, currentStageId, onMove }: { stages: CrmStage[]; currentStageId: string | null; onMove: (stageId: string, note?: string) => Promise<MoveResult> }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<CrmStage | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const current = stages.find((stage) => stage.id === currentStageId);
  async function move(stage: CrmStage, description?: string) {
    if (lock.current || stage.id === currentStageId) return;
    if (stage.require_note && !description?.trim()) { setPending(stage); setNote(""); setError(""); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await onMove(stage.id, description?.trim());
      if (!result.ok) {
        if (result.requireNote) { setPending(stage); setError("Adicione uma observação para mover para esta etapa."); }
        else setError(result.error || "Não foi possível mover o lead.");
        return;
      }
      setOpen(false); setPending(null); setNote(""); toast.success(`Lead movido para ${stage.name}.`);
    } catch { setError("Não foi possível mover o lead. Tente novamente."); }
    finally { lock.current = false; setBusy(false); }
  }
  return <div className="rounded-2xl border border-sky-500/30 bg-sky-500/10 p-3">
    <button type="button" disabled={busy} aria-expanded={open} aria-controls="lead-stage-options" onClick={() => { setOpen(!open); setPending(null); setError(""); }} className="flex min-h-11 w-full items-center gap-3 text-left text-sky-600 dark:text-sky-400">
      {busy ? <Loader2 size={19} className="animate-spin" /> : <ArrowRightLeft size={19} />}
      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Mover lead</span><span className="block truncate text-xs text-[var(--muted-foreground)]">{current?.name || "Escolha uma etapa da pipeline atual"}</span></span><ChevronDown size={17} className={open ? "rotate-180" : ""} />
    </button>
    {open && <div id="lead-stage-options" className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--bg-modal)] p-1">
      {pending ? <div className="space-y-3 p-2"><p className="text-sm font-medium">Mover para {pending.name}</p><label className="block text-xs">Observação obrigatória<textarea autoFocus aria-label="Observação da movimentação" value={note} disabled={busy} onChange={(event) => setNote(event.target.value)} className="mt-2 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] p-3 text-sm" rows={3} /></label><div className="flex gap-2"><button type="button" disabled={busy} onClick={() => { setPending(null); setError(""); }} className="min-h-11 rounded-lg px-3 text-xs">Voltar</button><button type="button" disabled={busy || !note.trim()} onClick={() => void move(pending, note)} className="min-h-11 rounded-lg bg-sky-600 px-3 text-xs font-semibold text-white disabled:opacity-50">{busy ? "Movendo…" : "Confirmar movimentação"}</button></div></div> : <div className="max-h-48 overflow-y-auto overscroll-contain" aria-label="Etapas da pipeline atual">
        {!stages.length && <p className="p-3 text-xs">Nenhuma etapa ativa disponível.</p>}
        {stages.map((stage) => <button type="button" key={stage.id} disabled={busy || stage.id === currentStageId} onClick={() => void move(stage)} className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--hover)] disabled:opacity-50"><span className="h-2 w-2 shrink-0 rounded-full" style={{ background: stage.color || "#38bdf8" }} /><span className="min-w-0 flex-1 break-words">{stage.name}</span>{stage.id === currentStageId && <Check size={15} />}</button>)}
      </div>}
    </div>}
    {error && <p role="alert" className="mt-2 text-xs text-red-500">{error}</p>}
  </div>;
}
