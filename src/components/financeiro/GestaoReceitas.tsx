"use client";

import { FinancialSectionHeader, FinancialMetric, FinancialFilters, FinancialAnalysis } from "./FinancialSection";
import { FinancialActivityChart, FinancialBreakdown } from "./FinancialActivityChart";
import { createPortal } from "react-dom";
import { DateInput } from "@/components/ui/DateInput";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, X, Edit2, Trash2, Check, CheckCircle2, Clock, AlertTriangle, XCircle, Repeat } from "lucide-react";
import { toast } from "sonner";
import { useReceitas } from "@/hooks/useReceitas";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { cn } from "@/lib/utils";
import type { Revenue, NewRevenue, RevenueStatus, RevenueType, PaymentMethod } from "@/types";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";
import { privateFinancialValue, useFinancialPrivacyStore } from "@/store/financial-privacy";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  privateFinancialValue(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v));


// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RevenueStatus, {
  label: string; color: string; icon: React.ReactNode;
}> = {
  pago:      { label: "Pago",      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: <CheckCircle2 size={11} /> },
  pendente:  { label: "Pendente",  color: "text-[var(--silver)] bg-[var(--silver)]/10 border-[var(--silver)]/20",     icon: <Clock size={11} /> },
  atrasado:  { label: "Atrasado",  color: "text-amber-400 bg-amber-400/10 border-amber-400/20",       icon: <AlertTriangle size={11} /> },
  cancelado: { label: "Cancelado", color: "text-red-400 bg-red-400/10 border-red-400/20",             icon: <XCircle size={11} /> },
};

const TYPE_CONFIG: Record<RevenueType, { label: string; hex: string; color: string; bg: string }> = {
  mensalidade: { label: "Mensalidade",  hex: "#22c55e", color: "text-emerald-400", bg: "bg-emerald-400/10 border-emerald-400/20" },
  setup:       { label: "Setup",        hex: "#60a5fa", color: "text-blue-400",    bg: "bg-blue-400/10 border-blue-400/20" },
  extra:       { label: "Extra",        hex: "#f472b6", color: "text-pink-400",    bg: "bg-pink-400/10 border-pink-400/20" },
  consultoria: { label: "Consultoria",  hex: "#a78bfa", color: "text-violet-400",  bg: "bg-violet-400/10 border-violet-400/20" },
  outro:       { label: "Outro",        hex: "#94a3b8", color: "text-slate-400",   bg: "bg-slate-400/10 border-slate-400/20" },
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX", boleto: "Boleto", cartao: "Cartão",
  ted: "TED", dinheiro: "Dinheiro", outro: "Outro",
};

const EMPTY_FORM: Partial<NewRevenue> = {
  type: "mensalidade", status: "pendente", payment_method: "pix",
  is_recurring: false, date: new Date().toISOString().split("T")[0],
};

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  revenue?: Revenue;
  onClose: () => void;
  onSave: (data: NewRevenue) => Promise<{ error: string | null }>;
  clients: Array<{ id: string; name: string }>;
}

function ReceitaModal({ revenue, onClose, onSave, clients }: ModalProps) {
  useModalOpen(true);
  const [form, setForm] = useState<Partial<NewRevenue>>(
    revenue
      ? {
          client_id: revenue.client_id, type: revenue.type,
          description: revenue.description, amount: revenue.amount,
          date: revenue.date, due_date: revenue.due_date ?? undefined,
          payment_method: revenue.payment_method, status: revenue.status,
          is_recurring: revenue.is_recurring, notes: revenue.notes ?? undefined,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof NewRevenue, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.date) {
      setError("Descrição, valor e data são obrigatórios");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave(form as NewRevenue);
    if (result.error) { setError(result.error); setSaving(false); }
  };

  const field = "w-full rounded-xl bg-[var(--hover)] text-[var(--text-title)] text-sm px-3 py-2.5 outline-none";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="lc-modal-backdrop absolute inset-0" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={revenue ? "Editar Receita" : "Nova Receita"}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="lc-modal-panel relative max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-4 overflow-y-auto overscroll-contain rounded-2xl p-5 sm:p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-[var(--text-title)]">
            {revenue ? "Editar Receita" : "Nova Receita"}
          </h2>
          <button aria-label="Fechar receita" onClick={onClose} className="text-[var(--silver)] hover:text-[var(--text-title)] transition-colors">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Cliente</label>
            <select value={form.client_id ?? ""} onChange={e => set("client_id", e.target.value || null)}
              className={field} style={{ border: "none" }}>
              <option value="">Sem cliente vinculado</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Descrição *</label>
            <input value={form.description ?? ""} onChange={e => set("description", e.target.value)}
              placeholder="Ex: Mensalidade Janeiro — Imobiliária X"
              className={`${field} placeholder:text-[var(--silver)]/50`} style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Valor *</label>
            <MoneyInput value={form.amount ?? 0} onChange={v => set("amount", v)} />
          </div>
          <div>
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Tipo</label>
            <select value={form.type ?? "mensalidade"} onChange={e => set("type", e.target.value as RevenueType)}
              className={field} style={{ border: "none" }}>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Data *</label>
            <DateInput type="date" value={form.date ?? ""} onChange={e => set("date", e.target.value)}
              className={field} style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Vencimento</label>
            <DateInput type="date" value={form.due_date ?? ""} onChange={e => set("due_date", e.target.value || null)}
              className={field} style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Forma de Pagamento</label>
            <select value={form.payment_method ?? "pix"} onChange={e => set("payment_method", e.target.value as PaymentMethod)}
              className={field} style={{ border: "none" }}>
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Status</label>
            <select value={form.status ?? "pendente"} onChange={e => set("status", e.target.value as RevenueStatus)}
              className={field} style={{ border: "none" }}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div className="col-span-2 flex items-center gap-3">
            <input
              type="checkbox"
              id="is_recurring"
              checked={form.is_recurring ?? false}
              onChange={e => set("is_recurring", e.target.checked)}
              className="w-4 h-4 rounded accent-[#4a8fd4]"
            />
            <label htmlFor="is_recurring" className="text-sm text-[var(--silver)] cursor-pointer">
              Receita recorrente (MRR)
            </label>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Observações</label>
            <textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value || null)}
              rows={2} placeholder="Opcional..."
              className={`${field} resize-none placeholder:text-[var(--silver)]/50`} style={{ border: "none" }} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-[var(--silver)] hover:text-[var(--text-title)] transition-colors"
            style={{ border: "1px solid var(--glass-border)" }}>
            Cancelar
          </button>
          <PrimaryButton onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm">
            {saving ? "Salvando..." : revenue ? "Salvar Alterações" : "Criar Receita"}
          </PrimaryButton>
        </div>
      </motion.div>
    </div>, document.body
  );
}

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export function GestaoReceitas({ year, month }: { year: number; month: number }) {
  const valuesHidden = useFinancialPrivacyStore(state => state.valuesHidden);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd   = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");

  const prevYear  = month === 1 ? year - 1 : year;
  const prevMon   = month === 1 ? 12 : month - 1;
  const prevStart = `${prevYear}-${String(prevMon).padStart(2, "0")}-01`;
  const prevEnd   = format(endOfMonth(new Date(prevYear, prevMon - 1)), "yyyy-MM-dd");

  const { revenues, isLoading, createRevenue, updateRevenue, deleteRevenue, markAsPaid } =
    useReceitas(monthStart, monthEnd);
  const { revenues: prevRevenues } = useReceitas(prevStart, prevEnd);
  const { clients, assignableClients } = useAgencyClients();

  const [search,      setSearch]      = useState("");
  const [filterType,  setFilterType]  = useState<RevenueType | "todos">("todos");
  const [filterStatus,setFilterStatus]= useState<RevenueStatus | "todos">("todos");
  const [filterPay,   setFilterPay]   = useState<PaymentMethod | "todos">("todos");
  const [sort,        setSort]        = useState<SortKey>("date_desc");
  const [modal,       setModal]       = useState<{ open: boolean; revenue?: Revenue }>({ open: false });
  const [deleting,    setDeleting]    = useState<string | null>(null);

  // ── KPI computations ───────────────────────────────────────────────────────

  const active    = useMemo(() => revenues.filter(r => r.status !== "cancelado"), [revenues]);
  const total     = useMemo(() => active.reduce((s, r) => s + r.amount, 0), [active]);
  const prevTotal = useMemo(() =>
    prevRevenues.filter(r => r.status !== "cancelado").reduce((s, r) => s + r.amount, 0),
    [prevRevenues]
  );
  const totalPago     = useMemo(() => revenues.filter(r => r.status === "pago").reduce((s, r) => s + r.amount, 0), [revenues]);
  const totalPendente = useMemo(() => revenues.filter(r => r.status === "pendente").reduce((s, r) => s + r.amount, 0), [revenues]);
  const totalAtrasado = useMemo(() => revenues.filter(r => r.status === "atrasado").reduce((s, r) => s + r.amount, 0), [revenues]);
  const mrr           = useMemo(() => revenues.filter(r => r.is_recurring && r.status !== "cancelado").reduce((s, r) => s + r.amount, 0), [revenues]);

  const uniqueClients = useMemo(() =>
    new Set(revenues.filter(r => r.client_id && r.status === "pago").map(r => r.client_id)).size,
    [revenues]
  );
  const ticketMedio = useMemo(() =>
    uniqueClients > 0 ? totalPago / uniqueClients : 0, [totalPago, uniqueClients]
  );

  const variation = useMemo<number | null>(() => {
    if (prevTotal === 0) return null;
    return ((total - prevTotal) / prevTotal) * 100;
  }, [total, prevTotal]);

  const taxaRecebimento = useMemo(() =>
    total > 0 ? (totalPago / total) * 100 : 0, [totalPago, total]
  );

  // ── By Type (analytics) ───────────────────────────────────────────────────

  const byType = useMemo(() =>
    Object.entries(TYPE_CONFIG).map(([t, conf]) => ({
      type: t as RevenueType,
      label: conf.label,
      hex: conf.hex,
      color: conf.color,
      bg: conf.bg,
      total: active.filter(r => r.type === t).reduce((s, r) => s + r.amount, 0),
    })).filter(x => x.total > 0).sort((a, b) => b.total - a.total),
    [active]
  );

  // ── Top clients ───────────────────────────────────────────────────────────

  const topClients = useMemo(() => {
    const map = new Map<string, { name: string; total: number }>();
    revenues.filter(r => r.client_id && r.status !== "cancelado").forEach(r => {
      const name = (r.client as { name?: string } | undefined)?.name ?? "Sem nome";
      const prev = map.get(r.client_id!) ?? { name, total: 0 };
      map.set(r.client_id!, { name, total: prev.total + r.amount });
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [revenues]);

  // ── Chart data ─────────────────────────────────────────────────────────────

  const dailyChartData = useMemo(() => {
    if (active.length === 0) return [];
    const start = new Date(year, month - 1, 1);
    const end   = parseISO(monthEnd);
    return eachDayOfInterval({ start, end })
      .map(day => {
        const dayStr   = format(day, "yyyy-MM-dd");
        const dayTotal = active.filter(r => r.date === dayStr).reduce((s, r) => s + r.amount, 0);
        return { date: format(day, "dd"), total: dayTotal };
      });
  }, [active, year, month, monthEnd]);


  // ── Insights ───────────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    const list: string[] = [];
    if (topClients[0] && total > 0) {
      const pct = ((topClients[0].total / total) * 100).toFixed(0);
      list.push(`${topClients[0].name} gerou ${privateFinancialValue(`${pct}%`)} da receita (${fmt(topClients[0].total)})`);
      if (Number(pct) > 50)
        list.push(`Alta concentração: mais de 50% da receita em 1 cliente`);
    }
    if (totalAtrasado > 0 && total > 0) {
      const pct = ((totalAtrasado / total) * 100).toFixed(1);
      list.push(`${privateFinancialValue(`${pct}%`)} da receita está em atraso (${fmt(totalAtrasado)})`);
    }
    if (variation !== null && Math.abs(variation) > 5 && list.length < 2) {
      const dir = variation > 0 ? "acima" : "abaixo";
      list.push(`Receita ${privateFinancialValue(`${Math.abs(variation).toFixed(1)}%`)} ${dir} do mês anterior`);
    }
    return list.slice(0, 2);
  }, [topClients, total, totalAtrasado, variation, prevTotal, valuesHidden]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filtered / sorted ─────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let arr = revenues.filter(r => {
      const name = (r.client as { name?: string } | undefined)?.name ?? "";
      const matchSearch  = r.description.toLowerCase().includes(search.toLowerCase()) ||
                           name.toLowerCase().includes(search.toLowerCase());
      const matchType    = filterType   === "todos" || r.type           === filterType;
      const matchStatus  = filterStatus === "todos" || r.status         === filterStatus;
      const matchPay     = filterPay    === "todos" || r.payment_method === filterPay;
      return matchSearch && matchType && matchStatus && matchPay;
    });
    const sortFns: Record<SortKey, (a: Revenue, b: Revenue) => number> = {
      date_desc:   (a, b) => b.date.localeCompare(a.date),
      date_asc:    (a, b) => a.date.localeCompare(b.date),
      amount_desc: (a, b) => b.amount - a.amount,
      amount_asc:  (a, b) => a.amount - b.amount,
    };
    return [...arr].sort(sortFns[sort]);
  }, [revenues, search, filterType, filterStatus, filterPay, sort]);

  const hasFilters = search !== "" || filterType !== "todos" || filterStatus !== "todos" || filterPay !== "todos";
  const filteredTotal = useMemo(() => filtered.filter(r => r.status !== "cancelado").reduce((s, r) => s + r.amount, 0), [filtered]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(async (data: NewRevenue): Promise<{ error: string | null }> => {
    const result = modal.revenue
      ? await updateRevenue(modal.revenue.id, data)
      : await createRevenue(data);
    if (result.error) { toast.error(result.error); }
    else {
      toast.success(modal.revenue ? "Receita atualizada!" : "Receita criada!");
      setModal({ open: false });
    }
    return result;
  }, [modal.revenue, createRevenue, updateRevenue]);

  const handleDelete = useCallback(async (id: string) => {
    if (deleting === id) { await deleteRevenue(id); setDeleting(null); }
    else { setDeleting(id); setTimeout(() => setDeleting(null), 3000); }
  }, [deleting, deleteRevenue]);

  const handleMarkPaid = useCallback(async (id: string) => {
    const result = await markAsPaid(id, new Date().toISOString().split("T")[0]);
    if (result.error) toast.error(result.error);
    else toast.success("Marcado como pago!");
  }, [markAsPaid]);

  const clearFilters = () => {
    setSearch(""); setFilterType("todos"); setFilterStatus("todos"); setFilterPay("todos");
  };

  // ── Loading ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="lc-card p-5 h-28 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-[var(--shimmer-base)] mb-3" />
              <div className="h-3 bg-[var(--shimmer-base)] rounded w-2/3 mb-2" />
              <div className="h-6 bg-[var(--shimmer-base)] rounded w-1/2" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="lc-card p-5 h-64 animate-pulse" />
          <div className="lc-card p-5 h-64 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fin-workspace">
      <FinancialSectionHeader title="Receitas" description="O que entrou, o que falta receber e de onde vem sua receita." createLabel="Nova Receita" onCreate={() => setModal({ open: true })} />
      <div className="fin-overview" aria-label="Resumo das receitas do mês">
        <FinancialMetric label="Total do mês" value={fmt(total)} detail={`${active.length} lançamentos · sem cancelados`} tone="blue" onClick={() => setFilterStatus("todos")} selected={filterStatus === "todos"} />
        <FinancialMetric label="Recebido" value={fmt(totalPago)} detail="Pagamentos confirmados" tone="green" onClick={() => setFilterStatus(filterStatus === "pago" ? "todos" : "pago")} selected={filterStatus === "pago"} />
        <FinancialMetric label="A receber" value={fmt(totalPendente)} detail="Receitas pendentes" tone="amber" onClick={() => setFilterStatus(filterStatus === "pendente" ? "todos" : "pendente")} selected={filterStatus === "pendente"} />
        <FinancialMetric label="Em atraso" value={fmt(totalAtrasado)} detail="Toque para consultar os atrasos" tone="red" onClick={() => setFilterStatus(filterStatus === "atrasado" ? "todos" : "atrasado")} selected={filterStatus === "atrasado"} />
      </div>
      <FinancialAnalysis>
        <div className="fin-chart-grid">
          <FinancialActivityChart title="Evolução das receitas" description="Lançamentos do mês, incluindo valores ainda não recebidos. Cancelados excluídos." data={dailyChartData} />
          <FinancialBreakdown title="Receitas por tipo" description="Selecione um tipo para filtrar os lançamentos." rows={byType.map(t => ({ id: t.type, label: t.label, total: t.total }))} selected={filterType} onSelect={id => setFilterType(filterType === id ? "todos" : id as RevenueType)} />
        </div>
      </FinancialAnalysis>
      <details className="fin-details"><summary>Recorrência, ticket e concentração de clientes</summary>
        <div className="fin-secondary-metrics">
          <FinancialMetric label="MRR" value={fmt(mrr)} detail="Receita recorrente lançada no mês" tone="blue" />
          <FinancialMetric label="Ticket por cliente" value={fmt(ticketMedio)} detail={`${uniqueClients} clientes pagantes`} />
          <FinancialMetric label="Variação mensal" value={variation === null ? "—" : privateFinancialValue(`${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%`)} detail={prevTotal > 0 ? `Mês anterior: ${fmt(prevTotal)}` : "Sem base no mês anterior"} />
          <FinancialMetric label="Recebimento" value={privateFinancialValue(`${taxaRecebimento.toFixed(1)}%`)} detail="Recebido sobre o total lançado" tone="green" />
        </div>
        <FinancialBreakdown title="Principais clientes" description="Participação entre os cinco clientes com maior receita lançada." rows={topClients.map((c, index) => ({ id: String(index), label: c.name, total: c.total }))} />
      </details>
      {insights.length > 0 && <aside className="fin-panel fin-insights"><h3>Leitura do mês</h3>{insights.map(insight => <p key={insight} className="mt-2 text-xs text-[var(--muted-foreground)]">{insight}</p>)}</aside>}

      {/* ── 4. Filter bar ── */}
      <FinancialFilters active={hasFilters}>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--silver)]" />
            <input aria-label="Buscar receitas" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar receita ou cliente..."
              className="lc-filter-control rounded-xl pl-8 pr-3 py-2 text-sm outline-none w-48" />
          </div>

          <select aria-label="Filtrar tipo de receitas" value={filterType} onChange={e => setFilterType(e.target.value as RevenueType | "todos")}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none">
            <option value="todos">Todos os tipos</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select aria-label="Filtrar status da receita" value={filterStatus} onChange={e => setFilterStatus(e.target.value as RevenueStatus | "todos")}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none">
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select aria-label="Filtrar pagamento" value={filterPay} onChange={e => setFilterPay(e.target.value as PaymentMethod | "todos")}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none">
            <option value="todos">Forma de pagamento</option>
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select aria-label="Ordenar receitas" value={sort} onChange={e => setSort(e.target.value as SortKey)}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none">
            <option value="date_desc">Mais recentes</option>
            <option value="date_asc">Mais antigas</option>
            <option value="amount_desc">Maior valor</option>
            <option value="amount_asc">Menor valor</option>
          </select>

          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[var(--silver)] hover:text-[var(--text-title)] transition-colors"
              style={{ border: "1px solid var(--glass-border)" }}>
              <X size={11} /> Limpar filtros
            </button>
          )}
        </div>


      </motion.div>
      </FinancialFilters>

      {/* ── 5. Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.44 }}
        className="fin-ledger lc-card overflow-hidden"
      >
        <div className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold text-[var(--text-title)]">
            Lançamentos
            {filtered.length !== revenues.length && (
              <span className="ml-2 text-xs text-[var(--silver)] font-normal">
                ({filtered.length} de {revenues.length})
              </span>
            )}
          </p>
          <p className="text-sm font-bold text-emerald-400 tabular-nums">{fmt(filteredTotal)}</p>
        </div>

        {filtered.length > 0 && <div className="fin-mobile-ledger">{filtered.map(r => <article key={r.id}>
          <header><div><h3>{r.description}</h3><p>{(r.client as { name?: string } | undefined)?.name ?? "Sem cliente"} · {TYPE_CONFIG[r.type].label} · {PAYMENT_LABELS[r.payment_method]}</p></div><strong>{fmt(r.amount)}</strong></header>
          <div className="fin-entry-meta"><span className={STATUS_CONFIG[r.status].color}>{STATUS_CONFIG[r.status].label}</span><span>Lançado {format(parseISO(r.date), "dd/MM")}{r.paid_date ? ` · Recebido ${format(parseISO(r.paid_date), "dd/MM")}` : r.due_date ? ` · Vence ${format(parseISO(r.due_date), "dd/MM")}` : ""}</span></div>
          <footer>{r.status !== "pago" && r.status !== "cancelado" && <button type="button" onClick={() => void handleMarkPaid(r.id)} aria-label={`Marcar ${r.description} como pago`}><Check size={15} />Receber</button>}<button type="button" onClick={() => setModal({ open: true, revenue: r })} aria-label={`Editar receita ${r.description}`}><Edit2 size={14} />Editar</button><button type="button" className="fin-entry-delete" onClick={() => void handleDelete(r.id)} aria-label={`Excluir receita ${r.description}`}><Trash2 size={14} />{deleting === r.id ? "Confirmar?" : "Excluir"}</button></footer>
        </article>)}</div>}
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            {hasFilters ? (
              <>
                <p className="text-[var(--silver)] text-sm mb-2">Nenhuma receita com esses filtros</p>
                <button onClick={clearFilters} className="text-[#4a8fd4] text-sm hover:underline">
                  Limpar filtros
                </button>
              </>
            ) : (
              <>
                <p className="text-[var(--silver)] text-sm mb-3">Nenhuma receita neste período</p>
                <button onClick={() => setModal({ open: true })}
                  className="text-[#4a8fd4] text-sm hover:underline">
                  Adicionar primeira receita
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Cliente", "Descrição", "Tipo", "Valor", "Vencimento", "Recebido", "Forma", "Status", ""].map(h => (
                    <th key={h}
                      className="text-left text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider px-4 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filtered.map((r, i) => {
                    const sc = STATUS_CONFIG[r.status];
                    const tc = TYPE_CONFIG[r.type];
                    const clientName = (r.client as { name?: string } | undefined)?.name;
                    return (
                      <motion.tr key={r.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ delay: Math.min(i * 0.015, 0.25) }}
                        className="group transition-colors hover:bg-[var(--hover)]"
                        style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {clientName ? (
                            <span className="text-[color:var(--chart-tooltip-entry)] text-xs font-medium max-w-[120px] truncate block">{clientName}</span>
                          ) : (
                            <span className="text-[var(--text-muted)] text-xs italic">—</span>
                          )}
                          {r.is_recurring && (
                            <span className="flex items-center gap-0.5 text-[9px] text-[#60a5fa] mt-0.5">
                              <Repeat size={8} /> recorrente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 max-w-[180px]">
                          <p className="text-[var(--text-title)] truncate">{r.description}</p>
                          {r.notes && (
                            <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{r.notes}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={cn("text-[11px] font-medium px-2 py-0.5 rounded-full border", tc.color, tc.bg)}>
                            {tc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-emerald-400 font-semibold whitespace-nowrap tabular-nums">
                          {fmt(r.amount)}
                        </td>
                        <td className="px-4 py-3.5 text-[var(--silver)] whitespace-nowrap text-xs">
                          {r.due_date ? format(parseISO(r.due_date), "dd MMM yy", { locale: ptBR }) : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-[var(--silver)] whitespace-nowrap text-xs">
                          {r.paid_date ? format(parseISO(r.paid_date), "dd MMM yy", { locale: ptBR }) : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-[var(--silver)] whitespace-nowrap text-xs">
                          {PAYMENT_LABELS[r.payment_method]}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={cn("flex items-center gap-1 w-fit text-[11px] font-medium px-2.5 py-1 rounded-full border", sc.color)}>
                            {sc.icon}{sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {r.status !== "pago" && r.status !== "cancelado" && (
                              <button onClick={() => handleMarkPaid(r.id)}
                                title="Marcar como pago"
                                className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10 transition-colors">
                                <Check size={13} />
                              </button>
                            )}
                            <button onClick={() => setModal({ open: true, revenue: r })}
                              className="p-1.5 rounded-lg text-[var(--silver)] hover:text-[var(--text-title)] hover:bg-[var(--hover)] transition-colors">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => handleDelete(r.id)}
                              className={cn("p-1.5 rounded-lg transition-colors",
                                deleting === r.id
                                  ? "text-red-400 bg-red-400/10"
                                  : "text-[var(--silver)] hover:text-red-400 hover:bg-red-400/10")}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ── Modal ── */}
      <AnimatePresence>
        {modal.open && (
          <ReceitaModal
            revenue={modal.revenue}
            onClose={() => setModal({ open: false })}
            onSave={handleSave}
            clients={modal.revenue
              ? clients.filter((client) => client.status !== "churned" || client.id === modal.revenue?.client_id)
              : assignableClients}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
