"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMarketing } from "@/context/MarketingContext";
import {
  FORMAT_LABELS,
  IDEA_STATUS_LABELS,
  MARKETING_FORMATS,
  MARKETING_IDEA_STATUSES,
  MARKETING_PLATFORMS,
  MARKETING_PRIORITIES,
  PLATFORM_LABELS,
  PRIORITY_LABELS,
  type MarketingIdea,
} from "@/types/marketing";

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2.5 text-sm text-[var(--text-title)] outline-none focus:ring-1 focus:ring-[var(--glass-border)]";

export function MarketingIdeaDialog({ open, onOpenChange, idea = null, onPlan }: { open: boolean; onOpenChange: (open: boolean) => void; idea?: MarketingIdea | null; onPlan?: (idea: MarketingIdea) => void }) {
  const marketing = useMarketing();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "", suggested_platform: "", suggested_format: "", status: "new", priority: "medium", suggested_assignee_id: "", reference_links: "" });

  useEffect(() => {
    if (open) setForm({ title: idea?.title ?? "", description: idea?.description ?? "", category: idea?.category ?? "", suggested_platform: idea?.suggested_platform ?? "", suggested_format: idea?.suggested_format ?? "", status: idea?.status ?? "new", priority: idea?.priority ?? "medium", suggested_assignee_id: idea?.suggested_assignee_id ?? "", reference_links: idea?.reference_links.join("\n") ?? "" });
  }, [idea, open]);

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const canEdit = !idea || idea.can_edit;

  async function save() {
    if (!form.title.trim()) return toast.error("Título é obrigatório");
    setSaving(true);
    const payload = { title: form.title, description: form.description || null, category: form.category || null, suggested_platform: (form.suggested_platform || null) as MarketingIdea["suggested_platform"], suggested_format: (form.suggested_format || null) as MarketingIdea["suggested_format"], status: form.status as MarketingIdea["status"], priority: form.priority as MarketingIdea["priority"], suggested_assignee_id: form.suggested_assignee_id || null, reference_links: form.reference_links.split("\n").map((value) => value.trim()).filter(Boolean) };
    const result = idea ? await marketing.updateIdea(idea.id, payload) : await marketing.createIdea(payload);
    setSaving(false);
    if (result) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-auto sm:max-h-[90dvh] sm:w-[calc(100%-3rem)] sm:max-w-3xl sm:rounded-3xl">
        <DialogHeader className="shrink-0 border-b border-[var(--border)] px-5 py-4 pr-14 sm:px-7 sm:py-5">
          <DialogTitle>{idea ? "Editar ideia" : "Nova ideia"}</DialogTitle>
          <DialogDescription>Capture a ideia agora e complemente os detalhes quando fizer sentido.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 py-4 sm:px-7 sm:py-6">
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <label className="text-xs text-[var(--muted-foreground)] sm:col-span-2">
              Título
              <input autoFocus={canEdit} className={inputClass} value={form.title} onChange={(event) => set("title", event.target.value)} readOnly={!canEdit} />
            </label>
            <label className="text-xs text-[var(--muted-foreground)] sm:col-span-2">
              Descrição
              <textarea className={`${inputClass} min-h-32 resize-y`} value={form.description} onChange={(event) => set("description", event.target.value)} readOnly={!canEdit} />
            </label>
            <label className="text-xs text-[var(--muted-foreground)]">
              Categoria
              <input className={inputClass} value={form.category} onChange={(event) => set("category", event.target.value)} readOnly={!canEdit} />
            </label>
            <Select label="Estado" value={form.status} onChange={(value) => set("status", value)} options={MARKETING_IDEA_STATUSES.map((value) => [value, IDEA_STATUS_LABELS[value]])} disabled={!canEdit} />
            <Select label="Plataforma sugerida" value={form.suggested_platform} onChange={(value) => set("suggested_platform", value)} options={[["", "Não definida"], ...MARKETING_PLATFORMS.map((value) => [value, PLATFORM_LABELS[value]] as [string, string])]} disabled={!canEdit} />
            <Select label="Formato sugerido" value={form.suggested_format} onChange={(value) => set("suggested_format", value)} options={[["", "Não definido"], ...MARKETING_FORMATS.map((value) => [value, FORMAT_LABELS[value]] as [string, string])]} disabled={!canEdit} />
            <Select label="Prioridade" value={form.priority} onChange={(value) => set("priority", value)} options={MARKETING_PRIORITIES.map((value) => [value, PRIORITY_LABELS[value]])} disabled={!canEdit} />
            <Select label="Responsável sugerido" value={form.suggested_assignee_id} onChange={(value) => set("suggested_assignee_id", value)} options={[["", "Sem responsável"], ...marketing.members.map((member) => [member.id, member.full_name] as [string, string])]} disabled={!canEdit} />
            <label className="text-xs text-[var(--muted-foreground)] sm:col-span-2">
              Links de referência
              <textarea className={`${inputClass} min-h-24 resize-y`} value={form.reference_links} onChange={(event) => set("reference_links", event.target.value)} readOnly={!canEdit} placeholder="Um link por linha" />
            </label>
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[var(--border)] px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-4">
          {idea?.can_delete ? <button type="button" onClick={async () => { if (await marketing.archiveIdea(idea.id)) onOpenChange(false); }} className="text-xs text-red-400">Arquivar</button> : <span />}
          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex">
            {idea && idea.status !== "converted" && onPlan && <button type="button" onClick={() => { onOpenChange(false); onPlan(idea); }} className="rounded-xl px-4 py-2.5 text-sm sm:py-2" style={{ background: "var(--hover)" }}>Planejar conteúdo</button>}
            {canEdit && <button type="button" disabled={saving} onClick={() => void save()} className="lc-btn flex items-center justify-center gap-2 px-4 py-2.5 text-sm sm:py-2">{saving && <Loader2 size={14} className="animate-spin" />}Salvar</button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[]; disabled?: boolean }) {
  return (
    <label className="text-xs text-[var(--muted-foreground)]">
      {label}
      <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}
