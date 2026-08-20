"use client";

import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Loader2, Pencil, Plus, Target, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { usePipelines } from "@/hooks/usePipelines";
import type { CrmGoal, CrmGoalInput } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { ConfirmActionModal } from "@/components/ui/ConfirmActionModal";
import { calculateGoalTargets, CRM_GOAL_BENCHMARKS } from "@/lib/crm/goal-calculator";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const monthGoalName = () => {
  const month = format(new Date(), "MMMM", { locale: ptBR });
  return `Meta de ${month.charAt(0).toUpperCase()}${month.slice(1)}`;
};

export function CrmGoals() {
  const { pipelines } = usePipelines();
  const [goals, setGoals] = useState<CrmGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<CrmGoal | null>(null);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<CrmGoal | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

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
    setDeleteLoading(true);
    const response = await fetch(`/api/crm/goals/${goal.id}`, { method: "DELETE" });
    setDeleteLoading(false);
    if (!response.ok) { toast.error("Não foi possível excluir a meta"); return; }
    toast.success("Meta excluída");
    setDeleting(null);
    await load();
  }

  return (
    <div className="px-4 pb-10 pt-6 sm:px-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--text-title)]">Metas comerciais</h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-[var(--muted-foreground)]">Defina o resultado do período. O CRM usará a movimentação das etapas configuradas para calcular vendas, reuniões, comparecimento e o que ainda falta.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} icon={<Plus />} size="medium" signature>Nova meta</Button>
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
                <div className="flex gap-1"><button onClick={() => { setEditing(goal); setOpen(true); }} className="rounded-lg p-2 hover:bg-[var(--hover)]" title="Editar"><Pencil size={13} /></button><button onClick={() => setDeleting(goal)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-500/10" title="Excluir"><Trash2 size={13} /></button></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <GoalValue label="Receita" value={goal.revenue_target ? money.format(goal.revenue_target) : "—"} />
                <GoalValue label="Vendas" value={goal.sales_target ?? "—"} />
                <GoalValue label="Comparecimentos" value={goal.held_meetings_target ?? "—"} />
                <GoalValue label="Agendamentos" value={goal.scheduled_meetings_target ?? "—"} />
              </div>
            </article>;
          })}
        </div>
      )}

      <GoalModal open={open} goal={editing} pipelines={pipelines.filter((item) => item.is_active)} onClose={() => setOpen(false)} onSaved={load} />
      <ConfirmActionModal open={Boolean(deleting)} title="Excluir meta?" description={`A meta “${deleting?.name ?? ""}” será removida permanentemente. Os dados e movimentações do CRM não serão alterados.`} confirmLabel="Excluir meta" loading={deleteLoading} onCancel={() => setDeleting(null)} onConfirm={() => deleting ? remove(deleting) : undefined} />
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
  const [revenueTarget, setRevenueTarget] = useState("");
  const [averageTicket, setAverageTicket] = useState("");
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [salesSample, setSalesSample] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(goal?.name ?? monthGoalName());
    setPipelineId(goal?.pipeline_id ?? "");
    setStartsAt(goal?.starts_at ?? today);
    setEndsAt(goal?.ends_at ?? format(addDays(new Date(), 29), "yyyy-MM-dd"));
    setRevenueTarget(goal?.revenue_target?.toString() ?? "");
    setAverageTicket(goal?.revenue_target && goal.sales_target ? Math.round(goal.revenue_target / goal.sales_target).toString() : "");
  }, [goal, open, today]);

  useEffect(() => {
    if (!open || goal) return;
    const controller = new AbortController();
    setRecommendationLoading(true);
    setAverageTicket("");
    setSalesSample(0);
    const params = pipelineId ? `?pipeline_id=${pipelineId}` : "";
    fetch(`/api/crm/goals/recommendations${params}`, { signal: controller.signal })
      .then(async (response) => {
        const json = await response.json() as { averageTicket?: number | null; salesSample?: number; error?: string };
        if (!response.ok) throw new Error(json.error ?? "Não foi possível calcular o ticket médio");
        if (json.averageTicket) setAverageTicket(String(json.averageTicket));
        setSalesSample(json.salesSample ?? 0);
      })
      .catch((error) => { if (error instanceof Error && error.name !== "AbortError") toast.error(error.message); })
      .finally(() => setRecommendationLoading(false));
    return () => controller.abort();
  }, [goal, open, pipelineId]);

  if (!open) return null;
  const calculated = calculateGoalTargets(Number(revenueTarget), Number(averageTicket));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const payload: CrmGoalInput = {
      pipeline_id: pipelineId || null, name: name.trim(), starts_at: startsAt, ends_at: endsAt, is_active: goal?.is_active ?? true,
      revenue_target: revenueTarget ? Number(revenueTarget) : null,
      sales_target: calculated?.salesTarget ?? null,
      held_meetings_target: calculated?.heldMeetingsTarget ?? null,
      scheduled_meetings_target: calculated?.scheduledMeetingsTarget ?? null,
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

  return createPortal(<div className="lc-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <form onSubmit={submit} className="lc-modal-panel flex h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl text-[var(--text-title)] sm:h-[min(90dvh,800px)]">
      <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)] px-5 py-4"><div><h2 className="text-sm font-semibold text-[var(--text-title)]">{goal ? "Editar meta" : "Nova meta"}</h2><p className="text-[11px] text-[var(--muted-foreground)]">Preencha a receita e, se quiser, fixe também metas de volume.</p></div><button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-title)]"><X size={15} /></button></div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
        <Field label="Nome"><input required value={name} onChange={(e) => setName(e.target.value)} className="lc-form-control rounded-lg px-3 py-2 text-sm" /></Field>
        <Field label="Pipeline"><select value={pipelineId} onChange={(e) => setPipelineId(e.target.value)} className="lc-form-control crm-form-select rounded-lg px-3 py-2 text-sm"><option value="">Todas as pipelines</option>{pipelines.map((pipeline) => <option key={pipeline.id} value={pipeline.id}>{pipeline.name}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Início"><input required type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="lc-form-control rounded-lg px-3 py-2 text-sm" /></Field><Field label="Fim"><input required type="date" min={startsAt} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="lc-form-control rounded-lg px-3 py-2 text-sm" /></Field></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Meta de receita (R$)"><input required type="number" min="0.01" step="0.01" value={revenueTarget} onChange={(e) => setRevenueTarget(e.target.value)} placeholder="Ex: 100000" className="lc-form-control rounded-lg px-3 py-2 text-sm" /></Field>
          <Field label="Ticket médio previsto (R$)"><div className="relative"><input required type="number" min="0.01" step="0.01" value={averageTicket} onChange={(e) => setAverageTicket(e.target.value)} placeholder={recommendationLoading ? "Calculando pelo histórico..." : "Informe o ticket médio"} className="lc-form-control rounded-lg px-3 py-2 pr-9 text-sm" />{recommendationLoading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-[var(--muted-foreground)]" />}</div></Field>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <CalculatedTarget label="Vendas necessárias" value={calculated?.salesTarget} />
          <CalculatedTarget label="Comparecimentos" value={calculated?.heldMeetingsTarget} />
          <CalculatedTarget label="Agendamentos" value={calculated?.scheduledMeetingsTarget} />
        </div>
        <div className="flex gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 p-3 text-[11px] leading-4 text-blue-700 dark:text-blue-300"><CalendarDays size={14} className="mt-0.5 shrink-0" /><span>O cálculo usa as referências ideais do funil: <strong>{CRM_GOAL_BENCHMARKS.closingRate}%</strong> de conversão de reuniões em vendas e <strong>{CRM_GOAL_BENCHMARKS.attendanceRate}%</strong> de comparecimento.{salesSample > 0 ? ` O ticket sugerido considera ${salesSample} venda${salesSample === 1 ? "" : "s"} do histórico selecionado.` : " Ajuste o ticket previsto para este objetivo."}</span></div>
      </div>
      <div className="shrink-0 flex justify-end gap-2 border-t border-[var(--border)] px-5 py-4"><Button type="button" variant="outline" size="sm" onClick={onClose}>Cancelar</Button><Button type="submit" size="sm" disabled={saving || !name.trim() || !calculated} loading={saving}>Salvar meta</Button></div>
    </form>
  </div>, document.body);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block"><span className="lc-form-label mb-1.5 block text-xs font-medium">{label}</span>{children}</label>; }
function CalculatedTarget({ label, value }: { label: string; value?: number }) { return <div className="rounded-xl border border-[var(--border)] bg-[var(--hover)] p-3"><p className="text-lg font-semibold text-[var(--text-title)]">{value ?? "—"}</p><p className="mt-0.5 text-[10px] text-[var(--muted-foreground)]">{label}</p></div>; }
