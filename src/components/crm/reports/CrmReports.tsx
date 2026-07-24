"use client";

import { useMemo, useState } from "react";
import { endOfDay, format, startOfDay, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, Download, FileSpreadsheet, Loader2, NotebookPen, RefreshCw, TrendingUp, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import type { CrmActivity, CrmActivityType, CrmReportResponse } from "@/types/crm-reports";
import { usePipelines } from "@/hooks/usePipelines";
import { useUsers } from "@/hooks/useUsers";
import { CrmReportRangePicker } from "./CrmReportRangePicker";
import { Button } from "@/components/ui/button";

type Preset = "today" | "week" | "month" | "custom";

const EVENT_LABELS: Record<CrmActivityType, string> = {
  lead_created: "Lead criado",
  lead_pipeline_copied: "Lead copiado para pipeline",
  lead_deleted: "Lead excluído",
  stage_changed: "Etapa alterada",
  deal_won: "Venda ganha",
  deal_lost: "Negócio perdido",
  assignee_changed: "Responsável alterado",
  note_added: "Nota adicionada",
  note_updated: "Nota atualizada",
  note_deleted: "Nota removida",
  stage_note: "Nota da movimentação",
  tags_changed: "Tags alteradas",
  deal_value_changed: "Valor alterado",
};

const EVENT_COLORS: Partial<Record<CrmActivityType, string>> = {
  deal_won: "#22c55e", deal_lost: "#ef4444", note_added: "#8b5cf6",
  note_updated: "#8b5cf6", stage_note: "#8b5cf6", lead_created: "#3b82f6",
  lead_pipeline_copied: "#14b8a6",
};

function localDate(date: Date) { return format(date, "yyyy-MM-dd"); }
function brl(value: number) { return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value); }
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

function activityDetails(item: CrmActivity) {
  if (item.note_content) return item.note_content;
  if (item.from_stage_name || item.to_stage_name) return `${item.from_stage_name ?? "Sem etapa"} → ${item.to_stage_name ?? "Sem etapa"}`;
  if (item.event_type === "assignee_changed") return `${String(item.metadata.from ?? "Sem responsável")} → ${String(item.metadata.to ?? "Sem responsável")}`;
  if (item.event_type === "deal_value_changed") return `${brl(Number(item.metadata.before ?? 0))} → ${brl(Number(item.metadata.after ?? 0))}`;
  return "—";
}

function downloadBlob(content: string, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = filename; anchor.click();
  URL.revokeObjectURL(url);
}

function SummaryCard({ label, value, icon: Icon, color = "#4a8fd4" }: { label: string; value: string | number; icon: typeof Users; color?: string }) {
  return (
    <div className="lc-card-base rounded-2xl p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>{label}</span>
        <Icon size={16} style={{ color }} />
      </div>
      <p className="text-xl font-semibold" style={{ color: "var(--text-title)" }}>{value}</p>
    </div>
  );
}

export function CrmReports() {
  const { pipelines } = usePipelines();
  const { profiles } = useUsers();
  const today = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<Preset>("month");
  const [customFrom, setCustomFrom] = useState(localDate(startOfMonth(today)));
  const [customTo, setCustomTo] = useState(localDate(today));
  const [pipelineId, setPipelineId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [includeNotes, setIncludeNotes] = useState(true);
  const [report, setReport] = useState<CrmReportResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const range = useMemo(() => {
    if (preset === "today") return { from: startOfDay(today), to: endOfDay(today) };
    if (preset === "week") return { from: startOfWeek(today, { weekStartsOn: 1 }), to: endOfDay(today) };
    if (preset === "month") return { from: startOfMonth(today), to: endOfDay(today) };
    return { from: startOfDay(new Date(`${customFrom}T00:00:00`)), to: endOfDay(new Date(`${customTo}T00:00:00`)) };
  }, [preset, customFrom, customTo, today]);

  async function generate() {
    if (Number.isNaN(range.from.getTime()) || Number.isNaN(range.to.getTime()) || range.from > range.to) {
      toast.error("Selecione um período válido"); return;
    }
    setLoading(true);
    const params = new URLSearchParams({ from: range.from.toISOString(), to: range.to.toISOString() });
    if (pipelineId) params.set("pipeline_id", pipelineId);
    if (assigneeId) params.set("assignee_id", assigneeId);
    try {
      const response = await fetch(`/api/crm/reports?${params}`);
      const json = await response.json() as CrmReportResponse & { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Erro ao gerar relatório");
      setReport(json);
      toast.success("Relatório atualizado");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao gerar relatório");
    } finally { setLoading(false); }
  }

  function exportCsv() {
    if (!report) return;
    const header = ["Data e hora", "Colaborador", "Responsável", "Lead", "Contato", "Pipeline", "Ação", "Detalhes", "Valor"];
    const lines = report.activities.map(item => [
      format(new Date(item.occurred_at), "dd/MM/yyyy HH:mm"), item.actor_name, item.assignee_name,
      item.lead_name, item.lead_contact, item.pipeline_name, EVENT_LABELS[item.event_type],
      includeNotes ? activityDetails(item) : (item.note_content ? "Nota ocultada" : activityDetails(item)), brl(item.deal_value),
    ].map(csvCell).join(";"));
    downloadBlob(`\uFEFF${header.map(csvCell).join(";")}\n${lines.join("\n")}`, "text/csv;charset=utf-8", `relatorio-crm-${localDate(new Date())}.csv`);
  }

  async function exportPdf() {
    if (!report) return;
    const { saveCrmReportPdf } = await import("@/lib/crm-report-pdf");
    const pipelineLabel = pipelineId ? `Pipeline: ${report.options.pipelines.find(item => item.id === pipelineId)?.name ?? "selecionada"}` : "Todas as pipelines";
    const assigneeLabel = assigneeId ? `Responsável: ${report.options.assignees.find(item => item.id === assigneeId)?.name ?? "selecionado"}` : "Todos os responsáveis";
    saveCrmReportPdf({ report, from: range.from, to: range.to, includeNotes, pipelineLabel, assigneeLabel }, `relatorio-crm-${localDate(new Date())}.pdf`);
  }

  const maxStage = Math.max(1, ...(report?.byStage.map(item => item.activities) ?? [1]));
  return (
    <div className="px-4 pb-10 sm:px-6">
      <section className="lc-card-base relative z-50 mb-5 overflow-visible rounded-3xl p-4 sm:p-5">
        <div className="mb-4 flex flex-col gap-1">
          <h2 className="text-base font-semibold" style={{ color: "var(--text-title)" }}>Gerar relatório comercial</h2>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Selecione o período e os filtros. O relatório usa o histórico permanente das atividades do CRM.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([['today','Diário'], ['week','Semanal'], ['month','Mensal']] as [Preset,string][]).map(([id, label]) => (
            <button key={id} onClick={() => setPreset(id)} className="rounded-xl px-3 py-2 text-xs font-medium"
              style={{ background: preset === id ? "var(--border-card-hover)" : "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}>{label}</button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <CrmReportRangePicker
            from={range.from}
            to={range.to}
            isCustom={preset === "custom"}
            onChange={(from, to) => {
              setCustomFrom(localDate(from));
              setCustomTo(localDate(to));
              setPreset("custom");
            }}
          />
          <select value={pipelineId} onChange={e => setPipelineId(e.target.value)} className="lc-filter-control rounded-xl px-3 py-2 text-sm">
            <option value="">Todas as pipelines</option>{(report?.options.pipelines ?? pipelines).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} className="lc-filter-control rounded-xl px-3 py-2 text-sm">
            <option value="">Todos os responsáveis</option>{(report?.options.assignees ?? profiles.map(item => ({ id: item.id, name: item.full_name }))).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <Button
            onClick={generate}
            disabled={loading}
            loading={loading}
            icon={report ? <RefreshCw size={15} /> : <BarChart3 size={15} />}
            signature
            size="medium"
          >
            {report ? "Atualizar relatório" : "Gerar relatório"}
          </Button>
        </div>
      </section>

      {!report && <div className="lc-card-base flex min-h-56 flex-col items-center justify-center rounded-3xl p-8 text-center"><BarChart3 size={30} style={{ color: "var(--icon)" }} /><p className="mt-3 text-sm font-medium" style={{ color: "var(--text-title)" }}>Seu relatório aparecerá aqui</p><p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>Escolha o período e clique em Gerar relatório.</p></div>}

      {report && <div className="relative z-0 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-lg font-semibold" style={{ color: "var(--text-title)" }}>Relatório do período</h2><p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{format(range.from, "dd 'de' MMMM", { locale: ptBR })} a {format(range.to, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}</p></div>
          <div className="flex flex-wrap items-center gap-2"><label className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ background: "var(--hover)", color: "var(--text-body)" }}><input type="checkbox" checked={includeNotes} onChange={e => setIncludeNotes(e.target.checked)} /> Incluir notas</label><button onClick={exportCsv} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ border: "1px solid var(--glass-border)", color: "var(--text-title)" }}><FileSpreadsheet size={14} /> CSV</button><button onClick={exportPdf} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs" style={{ border: "1px solid var(--glass-border)", color: "var(--text-title)" }}><Download size={14} /> PDF</button></div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-8">
          <SummaryCard label="Leads recebidos" value={report.summary.leadsCreated} icon={Users} />
          <SummaryCard label="Leads trabalhados" value={report.summary.leadsWorked} icon={TrendingUp} />
          <SummaryCard label="Movimentações" value={report.summary.stageMovements} icon={RefreshCw} />
          <SummaryCard label="Vendas" value={report.summary.dealsWon} icon={Trophy} color="#22c55e" />
          <SummaryCard label="Perdidos" value={report.summary.dealsLost} icon={TrendingUp} color="#ef4444" />
          <SummaryCard label="Valor vendido" value={brl(report.summary.wonValue)} icon={Trophy} color="#22c55e" />
          <SummaryCard label="Conversão" value={`${report.summary.conversionRate.toFixed(1)}%`} icon={BarChart3} />
          <SummaryCard label="Notas" value={report.summary.notesAdded} icon={NotebookPen} color="#8b5cf6" />
        </div>
        <section className="lc-card-base rounded-3xl p-5">
          <h3 className="mb-2 text-sm font-semibold" style={{ color: "var(--text-title)" }}>Resumo executivo</h3>
          <p className="text-sm leading-6" style={{ color: "var(--text-body)" }}>
            No período foram recebidos <strong>{report.summary.leadsCreated} leads</strong> e trabalhados <strong>{report.summary.leadsWorked}</strong>.
            A equipe realizou <strong>{report.summary.stageMovements} movimentações</strong>, concluiu <strong>{report.summary.dealsWon} vendas</strong> no valor de <strong>{brl(report.summary.wonValue)}</strong>
            {report.bySource[0] ? <>. A origem com maior volume de atividades foi <strong>{report.bySource[0].label}</strong></> : null}
            {report.byAssignee[0] ? <> e o responsável com maior atividade foi <strong>{report.byAssignee[0].label}</strong></> : null}.
          </p>
        </section>
        <div className="grid gap-5 xl:grid-cols-2">
          <section className="lc-card-base rounded-3xl p-5"><h3 className="mb-4 text-sm font-semibold" style={{ color: "var(--text-title)" }}>Atividades por etapa</h3><div className="space-y-3">{report.byStage.length === 0 ? <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Nenhuma movimentação no período.</p> : report.byStage.slice(0, 12).map(item => <div key={item.id}><div className="mb-1 flex justify-between text-xs"><span style={{ color: "var(--text-body)" }}>{item.label}</span><strong style={{ color: "var(--text-title)" }}>{item.activities}</strong></div><div className="h-2 overflow-hidden rounded-full" style={{ background: "var(--hover)" }}><div className="h-full rounded-full" style={{ width: `${item.activities / maxStage * 100}%`, background: "linear-gradient(90deg,#4a8fd4,#22c55e)" }} /></div></div>)}</div></section>
          <section className="lc-card-base overflow-hidden rounded-3xl"><div className="border-b p-5" style={{ borderColor: "var(--border)" }}><h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Desempenho por responsável</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead><tr style={{ color: "var(--muted-foreground)" }}><th className="p-4">Responsável</th><th>Ações</th><th>Leads</th><th>Vendas</th><th className="pr-4">Valor</th></tr></thead><tbody>{report.byAssignee.map(item => <tr key={item.id} className="border-t" style={{ borderColor: "var(--border)", color: "var(--text-body)" }}><td className="p-4 font-medium" style={{ color: "var(--text-title)" }}>{item.label}</td><td>{item.activities}</td><td>{item.leads}</td><td>{item.wins}</td><td className="pr-4">{brl(item.value)}</td></tr>)}</tbody></table></div></section>
        </div>
        <section className="lc-card-base overflow-hidden rounded-3xl"><div className="border-b p-5" style={{ borderColor: "var(--border)" }}><h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Resultados por origem</h3></div><div className="overflow-x-auto"><table className="w-full min-w-[520px] text-left text-xs"><thead><tr style={{ color: "var(--muted-foreground)" }}><th className="p-4">Origem</th><th>Ações</th><th>Leads</th><th>Vendas</th><th className="pr-4">Valor vendido</th></tr></thead><tbody>{report.bySource.map(item => <tr key={item.id} className="border-t" style={{ borderColor: "var(--border)", color: "var(--text-body)" }}><td className="p-4 font-medium" style={{ color: "var(--text-title)" }}>{item.label}</td><td>{item.activities}</td><td>{item.leads}</td><td>{item.wins}</td><td className="pr-4">{brl(item.value)}</td></tr>)}</tbody></table></div></section>
        <section className="lc-card-base overflow-hidden rounded-3xl"><div className="border-b p-5" style={{ borderColor: "var(--border)" }}><h3 className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Ações realizadas</h3><p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>{report.activities.length} atividades registradas</p></div><div className="max-h-[640px] overflow-auto"><table className="w-full min-w-[860px] text-left text-xs"><thead className="sticky top-0 z-10" style={{ background: "var(--bg-modal)", color: "var(--muted-foreground)" }}><tr><th className="p-4">Data</th><th>Colaborador</th><th>Lead</th><th>Ação</th><th>Detalhes</th><th className="pr-4">Responsável</th></tr></thead><tbody>{report.activities.map(item => <tr key={item.id} className="border-t align-top" style={{ borderColor: "var(--border)" }}><td className="whitespace-nowrap p-4" style={{ color: "var(--muted-foreground)" }}>{format(new Date(item.occurred_at), "dd/MM HH:mm")}</td><td style={{ color: "var(--text-body)" }}>{item.actor_name}</td><td><p className="font-medium" style={{ color: "var(--text-title)" }}>{item.lead_name}</p><p style={{ color: "var(--muted-foreground)" }}>{item.lead_contact}</p></td><td><span className="rounded-full px-2 py-1 font-medium" style={{ color: EVENT_COLORS[item.event_type] ?? "var(--text-body)", background: `${EVENT_COLORS[item.event_type] ?? "#7c878e"}18` }}>{EVENT_LABELS[item.event_type]}</span></td><td className="max-w-md whitespace-pre-wrap pr-4" style={{ color: "var(--text-body)" }}>{!includeNotes && item.note_content ? "Conteúdo da nota ocultado" : activityDetails(item)}</td><td className="pr-4" style={{ color: "var(--text-body)" }}>{item.assignee_name}</td></tr>)}</tbody></table></div></section>
      </div>}
    </div>
  );
}
