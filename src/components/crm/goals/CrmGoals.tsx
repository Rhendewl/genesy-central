"use client";

import { useCallback, useEffect, useState } from "react";
import { addDays, format } from "date-fns";
import { CalendarDays, Loader2, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { usePipelines } from "@/hooks/usePipelines";
import type { CrmGoal, CrmGoalInput } from "@/types/crm";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const EMPTY_TARGETS = { revenue_target: "", sales_target: "", held_meetings_target: "", scheduled_meetings_target: "" };

export function CrmGoals() {
  const { pipelines } = usePipelines();
  const [goals, setGoals] = useState<CrmGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CrmGoal | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/crm/goals");
    const json = await response.json() as { goals?: CrmGoal[]; error?: string };
    if (!response.ok) toast.error(json.error ?? "Não foi possível carregar as metas");
    setGoals(json.goals ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function remove(goal: CrmGoal) {
    if (!window.confirm(`Excluir a meta “${goal.name}”?`)) return;
    const response = await fetch(`/api/crm/goals/${goal.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Não foi possível excluir a meta");
    toast.success("Meta excluída");
    await load();
  }

  return (
    <div className="px-4 pb-10 pt-6 sm:px-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-title)]">Metas comerciais</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted-foreground)]">Defina o resultado do período. O CRM usará a movimentação das etapas configuradas para calcular vendas, reuniões, comparecimento e o que ainda falta.</p>
        </div>
        <button onClick={() => { setEditing(null); setOpen(true); }} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white">
          <Plus size={15} /> Nova meta
        </button>
      </div>

      {loading ? <div className="grid min-h-48 place-items-center"><Loader2 className="animate-spin text-[var(--primary)]" /></div> : goals.length === 0 ? (
        <div className="grid min-h-64 place-items-center rounded-2xl border border-dashed p-8 text-center">
          <div><Target className="mx-auto text-[var(--muted-foreground)]" /><p className="mt-3 text-sm font-medium">Nenhuma meta cadastrada</p><p className="mt-1 text-xs text-[var(--muted-foreground)]">Crie uma meta de 30 dias ou escolha um período personalizado.</p></div>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {goals.map((goal) => {
            const pipeline = pipelines.find((item) => item.id === goal.pipeline_id);
            const today = format(new Date(), "yyyy-MM-dd");
            const status = !goal.is_active ? "Pausada" : today < goal.starts_at ? "Agendada" : today > goal.ends_at ? "Encerrada" : "Em andamento";
            return <article key={goal.id} className="relative overflow-hidden rounded-2xl border p-5" style={{ background: "var(--glass-bg-soft)" }}>
              <span className="absolute inset-y-0 left-0 w-1 bg-[var(--primary)]" />
              <div className="flex items-start justify-between gap-3">
                <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold">{goal.name}</h3><span className="rounded-full border px-2 py-0.5 text-[9px] font-semibold text-[var(--muted-foreground)]">{status}</span></div><p className="mt-1 text-[11px] text-[var(--muted-foreground)]">{pipeline?.name ?? "Todas as pipelines"} · {format(new Date(`${goal.starts_at}T12:00:00`), "dd/MM/yyyy")} a {format(new Date(`${goal.ends_at}T12:00:00`), "dd/MM/yyyy")}</p></div>
                <div className="flex gap-1"><button onClick={() => { setEditing(goal); setOpen(true); }} className="rounded-lg p-2 hover:bg-[var(--hover)]" title="Editar"><Pencil size={13} /></button><button onClick={() => void remove(goal)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10" title="Excluir"><Trash2 size={13} /></button></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <GoalValue label="Receita" value={goal.revenue_target ? money.format(goal.revenue_target) : "—"} />
                <GoalValue label="Vendas" value={goal.sales_target ?? "Automático"} />
                <GoalValue label="Comparecimentos" value={goal.held_meetings_target ?? "Automático"} />
                <GoalValue label="Agendamentos" value={goal.scheduled_meetings_target ?? "Automático"} />
              </div>
            </article>;
          })}
        </div>
      )}

      <GoalModal open={open} goal={editing} pipelines={pipelines.filter((item) => item.is_active)} onClose={() => setOpen(false)} onSaved={load} />
    </div>
  );
}

function GoalValue({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-[var(--hover)] p-3"><p className="text-sm font-semibold">{value}</p><p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{label}</p></div>;
}

function GoalModal({ open, goal, pipelines, onClose, onSaved }: { open: boolean; goal: CrmGoal | null; pipelines: ReturnType<typeof usePipelines>["pipelines"]; onClose: () => void; onSaved: () => Promise<void> }) {
  const today = format(new Date(), "yyyy-MM-dd");
  const [name, setName] = useState("");
  const [pipelineId, setPipelineId] = useState("");
  const [startsAt, setStartsAt] = useState(today);
  const [endsAt, setEndsAt] = useState(format(addDays(new Date(), 29), "yyyy-MM-dd"));
  const [targets, setTargets] = useState(EMPTY_TARGETS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? "Meta dos próximos 30 dias");
    setPipelineId(goal?.pipeline_id ?? "");
    setStartsAt(goal?.starts_at ?? today);
    setEndsAt(goal?.ends_at ?? format(addDays(new Date(), 29), "yyyy-MM-dd"));
    setTargets({
      revenue_target: goal?.revenue_target?.toString() ?? "",
      sales_target: goal?.sales_target?.toString() ?? "",
      held_meetings_target: goal?.held_meetings_target?.toString() ?? "",
      scheduled_meetings_target: goal?.scheduled_meetings_target?.toString() ?? "",
    });
  }, [goal, open, today]);

  if (!open) return null;
  const setTarget = (key: keyof typeof targets, value: string) => setTargets((current) => ({ ...current, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload: CrmGoalInput = {
      pipeline_id: pipelineId || null, name: name.trim(), starts_at: startsAt, ends_at: endsAt, is_active: goal?.is_active ?? true,
      revenue_target: targets.revenue_target ? Number(targets.revenue_target) : null,
      sales_target: targets.sales_target ? Number(targets.sales_target) : null,
      held_meetings_target: targets.held_meetings_target ? Number(targets.held_meetings_target) : null,
      scheduled_meetings_target: targets.scheduled_meetings_target ? Number(targets.scheduled_meetings_target) : null,
    };
    setSaving(true);
    const response = await fetch(goal ? `/api/crm/goals/${goal.id}` : "/api/crm/goals", { method: goal ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const json = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return toast.error(json.error ?? "Não foi possível salvar a meta");
    toast.success(goal ? "Meta atualizada" : "Meta criada");
    onClose();
    await onSaved();
  }

  return <div className="lc-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form onSubmit={submit} className="lc-modal-panel max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl text-[var(--text-title)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="text-sm font-semibold text-[var(--text-title)]">{goal ? "Editar meta" : "Nova meta"}</h2><p className="text-[11px] text-[var(--muted-foreground)]">Preencha a receita e, se quiser, fixe também metas de volume.</p></div><button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-title)]"><X size={15} /></button></div>
      <div className="space-y-4 p-5">
        <Field label="Nome"><input required value={name} onChange={(e) => setName(e.target.value)} className="lc-form-control rounded-lg px-3 py-2 text-sm" /></Field>
        <Field label="Pipeline"><select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} className="lc-form-control crm-form-select rounded-lg px-3 py-2 text-sm"><option value="">Todas as pipelines</option>{pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Início"><input required type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="lc-form-control rounded-lg px-3 py-2 text-sm" /></Field><Field label="Fim"><input required type="date" min={startsAt} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="lc-form-control rounded-lg px-3 py-2 text-sm" /></Field></div>
        <Field label="Meta de receita (R$)"><input type="number" min="0" step="0.01" value={targets.revenue_target} onChange={(e) => setTarget("revenue_target", e.target.value)} placeholder="Ex: 100000" className="lc-form-control rounded-lg px-3 py-2 text-sm" /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3"><Field label="Vendas"><input type="number" min="0" value={targets.sales_target} onChange={(e) => setTarget("sales_target", e.target.value)} placeholder="Automático" className="lc-form-control rounded-lg px-3 py-2 text-sm" /></Field><Field label="Comparecimentos"><input type="number" min="0" value={targets.held_meetings_target} onChange={(e) => setTarget("held_meetings_target", e.target.value)} placeholder="Automático" className="lc-form-control rounded-lg px-3 py-2 text-sm" /></Field><Field label="Agendamentos"><input type="number" min="0" value={targets.scheduled_meetings_target} onChange={(e) => setTarget("scheduled_meetings_target", e.target.value)} placeholder="Automático" className="lc-form-control rounded-lg px-3 py-2 text-sm" /></Field></div>
        <div className="flex gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-[11px] leading-4 text-blue-700 dark:text-blue-300"><CalendarDays size={14} className="shrink-0" /> Campos em branco serão calculados pelo ticket médio, conversão e comparecimento observados no período.</div>
      </div>
      <div className="flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4"><button type="button" onClick={onClose} className="rounded-lg border border-[var(--border)] px-4 py-2 text-xs text-[var(--muted-foreground)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-title)]">Cancelar</button><button disabled={saving || !name.trim()} className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-xs font-semibold text-[var(--primary-foreground)] disabled:opacity-50">{saving && <Loader2 size={12} className="animate-spin" />} Salvar meta</button></div>
    </form>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="lc-form-label mb-1.5 block text-xs font-medium">{label}</span>{children}</label>; }
