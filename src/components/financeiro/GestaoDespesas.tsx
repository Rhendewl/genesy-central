"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from "recharts";
import { format, parseISO, endOfMonth, eachDayOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, Search, X, Edit2, Trash2, Zap,
  TrendingDown, TrendingUp, Tag, Layers, Lightbulb, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { useDespesas } from "@/hooks/useDespesas";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { cn } from "@/lib/utils";
import type { Expense, NewExpense, ExpenseCategory, ExpenseType } from "@/types";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtK = (v: number) => {
  if (Math.abs(v) >= 1000)
    return `R$${(v / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  }).format(v);
};

// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ExpenseCategory, {
  label: string; color: string; hex: string; bg: string;
}> = {
  freelancers:  { label: "Freelancers",     color: "text-purple-400", hex: "#c084fc", bg: "bg-purple-400/10 border-purple-400/20" },
  equipe:       { label: "Equipe Interna",  color: "text-blue-400",   hex: "#60a5fa", bg: "bg-blue-400/10 border-blue-400/20" },
  ferramentas:  { label: "Ferramentas",     color: "text-cyan-400",   hex: "#22d3ee", bg: "bg-cyan-400/10 border-cyan-400/20" },
  impostos:     { label: "Impostos",        color: "text-red-400",    hex: "#f87171", bg: "bg-red-400/10 border-red-400/20" },
  operacional:  { label: "Operacional",     color: "text-[#b4b4b4]",  hex: "#b4b4b4", bg: "bg-[#b4b4b4]/10 border-[#b4b4b4]/20" },
  marketing:    { label: "Marketing",       color: "text-pink-400",   hex: "#f472b6", bg: "bg-pink-400/10 border-pink-400/20" },
  trafego_pago: { label: "Tráfego Pago",   color: "text-amber-400",  hex: "#fbbf24", bg: "bg-amber-400/10 border-amber-400/20" },
  outros:       { label: "Outros",          color: "text-slate-400",  hex: "#94a3b8", bg: "bg-slate-400/10 border-slate-400/20" },
};

const EMPTY_FORM: Partial<NewExpense> = {
  category: "outros", type: "variavel", auto_imported: false,
  date: new Date().toISOString().split("T")[0],
};

// ── Modal ─────────────────────────────────────────────────────────────────────

interface ModalProps {
  expense?: Expense;
  onClose: () => void;
  onSave: (data: NewExpense) => Promise<{ error: string | null }>;
  clients: Array<{ id: string; name: string }>;
}

function DespesaModal({ expense, onClose, onSave, clients }: ModalProps) {
  useModalOpen(true);
  const [form, setForm] = useState<Partial<NewExpense>>(
    expense
      ? {
          client_id: expense.client_id, category: expense.category,
          description: expense.description, amount: expense.amount,
          date: expense.date, type: expense.type,
          cost_center: expense.cost_center ?? undefined,
          notes: expense.notes ?? undefined,
          auto_imported: expense.auto_imported,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof NewExpense, v: unknown) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.date) {
      setError("Descrição, valor e data são obrigatórios");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave(form as NewExpense);
    if (result.error) { setError(result.error); setSaving(false); }
  };

  const field = "w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/[0.03] backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="lc-modal-panel relative w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">
            {expense ? "Editar Despesa" : "Nova Despesa"}
          </h2>
          <button onClick={onClose} className="text-[#b4b4b4] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Categoria</label>
            <select value={form.category ?? "outros"}
              onChange={e => set("category", e.target.value as ExpenseCategory)}
              className={field} style={{ border: "none" }}>
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Tipo</label>
            <select value={form.type ?? "variavel"}
              onChange={e => set("type", e.target.value as ExpenseType)}
              className={field} style={{ border: "none" }}>
              <option value="fixa">Fixa</option>
              <option value="variavel">Variável</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Descrição *</label>
            <input value={form.description ?? ""} onChange={e => set("description", e.target.value)}
              placeholder="Ex: Pagamento freelancer design"
              className={`${field} placeholder:text-[#b4b4b4]/50`} style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Valor *</label>
            <MoneyInput value={form.amount ?? 0} onChange={v => set("amount", v)} />
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Data *</label>
            <input type="date" value={form.date ?? ""} onChange={e => set("date", e.target.value)}
              className={field} style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Cliente vinculado</label>
            <select value={form.client_id ?? ""} onChange={e => set("client_id", e.target.value || null)}
              className={field} style={{ border: "none" }}>
              <option value="">Nenhum</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Centro de Custo</label>
            <input value={form.cost_center ?? ""} onChange={e => set("cost_center", e.target.value || null)}
              placeholder="Ex: Operações"
              className={`${field} placeholder:text-[#b4b4b4]/50`} style={{ border: "none" }} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Observações</label>
            <textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value || null)}
              rows={2} placeholder="Opcional..."
              className={`${field} resize-none placeholder:text-[#b4b4b4]/50`} style={{ border: "none" }} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-[#b4b4b4] hover:text-white transition-colors"
            style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            Cancelar
          </button>
          <PrimaryButton onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm">
            {saving ? "Salvando..." : expense ? "Salvar" : "Criar Despesa"}
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, accent, trend, delay = 0,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
  trend?: { pct: number } | null;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="lc-card p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: `${accent}1a`, color: accent }}>
          {icon}
        </div>
        {trend != null && (
          <span className={cn(
            "flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full",
            trend.pct >= 0
              ? "text-red-400 bg-red-400/10"
              : "text-emerald-400 bg-emerald-400/10"
          )}>
            {trend.pct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend.pct).toFixed(1)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-bold text-white leading-none mb-1">{value}</p>
        <p className="text-xs text-[#b4b4b4]">{label}</p>
        {sub && <p className="text-[10px] text-[#5a5a5a] mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Chart Tooltip ─────────────────────────────────────────────────────────────

function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-xl"
      style={{ background: "rgba(0,0,0,0.82)", border: "1px solid rgba(255,255,255,0.09)" }}>
      <p className="text-[#b4b4b4] mb-1">{label}</p>
      <p className="text-white font-semibold">{fmt(payload[0].value)}</p>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface Props { year: number; month: number; }

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";
type ChartView = "day" | "category";

export function GestaoDespesas({ year, month }: Props) {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd   = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");

  const prevYear  = month === 1 ? year - 1 : year;
  const prevMon   = month === 1 ? 12 : month - 1;
  const prevStart = `${prevYear}-${String(prevMon).padStart(2, "0")}-01`;
  const prevEnd   = format(endOfMonth(new Date(prevYear, prevMon - 1)), "yyyy-MM-dd");

  const { expenses, isLoading, createExpense, updateExpense, deleteExpense } =
    useDespesas(monthStart, monthEnd);
  const { expenses: prevExpenses } = useDespesas(prevStart, prevEnd);
  const { clients } = useAgencyClients();

  const [search,     setSearch]     = useState("");
  const [filterCat,  setFilterCat]  = useState<ExpenseCategory | "todos">("todos");
  const [filterType, setFilterType] = useState<ExpenseType | "todos">("todos");
  const [sort,       setSort]       = useState<SortKey>("date_desc");
  const [chartView,  setChartView]  = useState<ChartView>("day");
  const [modal,      setModal]      = useState<{ open: boolean; expense?: Expense }>({ open: false });
  const [deleting,   setDeleting]   = useState<string | null>(null);

  // ── KPI computations ───────────────────────────────────────────────────────

  const total       = useMemo(() => expenses.reduce((s, e) => s + e.amount, 0), [expenses]);
  const prevTotal   = useMemo(() => prevExpenses.reduce((s, e) => s + e.amount, 0), [prevExpenses]);
  const totalFixa   = useMemo(() => expenses.filter(e => e.type === "fixa").reduce((s, e) => s + e.amount, 0), [expenses]);
  const totalVar    = useMemo(() => expenses.filter(e => e.type === "variavel").reduce((s, e) => s + e.amount, 0), [expenses]);
  const ticketMedio = useMemo(() => expenses.length > 0 ? total / expenses.length : 0, [total, expenses.length]);

  const variation = useMemo<number | null>(() => {
    if (prevTotal === 0) return null;
    return ((total - prevTotal) / prevTotal) * 100;
  }, [total, prevTotal]);

  const byCategory = useMemo(() =>
    Object.entries(CATEGORY_CONFIG)
      .map(([cat, conf]) => ({
        category: cat as ExpenseCategory,
        label: conf.label,
        hex: conf.hex,
        color: conf.color,
        bg: conf.bg,
        total: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
      }))
      .filter(c => c.total > 0)
      .sort((a, b) => b.total - a.total),
    [expenses]
  );

  const topCategory = byCategory[0] ?? null;

  // ── Chart data ─────────────────────────────────────────────────────────────

  const dailyChartData = useMemo(() => {
    if (expenses.length === 0) return [];
    const start = new Date(year, month - 1, 1);
    const end   = parseISO(monthEnd);
    return eachDayOfInterval({ start, end })
      .map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayTotal = expenses
          .filter(e => e.date === dayStr)
          .reduce((s, e) => s + e.amount, 0);
        return { date: format(day, "dd"), total: dayTotal };
      })
      .filter(d => d.total > 0);
  }, [expenses, year, month, monthEnd]);

  const categoryChartData = useMemo(() =>
    byCategory.map(c => ({ name: c.label, total: c.total, hex: c.hex })),
    [byCategory]
  );

  // ── Insights ───────────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    const list: string[] = [];
    if (total > 0 && topCategory) {
      const pct = ((topCategory.total / total) * 100).toFixed(0);
      list.push(`${topCategory.label} é a maior categoria: ${pct}% do total (${fmt(topCategory.total)})`);
    }
    if (variation !== null && Math.abs(variation) > 5) {
      const dir = variation > 0 ? "acima" : "abaixo";
      list.push(`Despesas ${Math.abs(variation).toFixed(1)}% ${dir} do mês anterior (${fmt(prevTotal)})`);
    }
    if (list.length < 2) {
      const largest = [...expenses].sort((a, b) => b.amount - a.amount)[0];
      if (largest) {
        list.push(`Maior lançamento: "${largest.description}" — ${fmt(largest.amount)}`);
      }
    }
    return list.slice(0, 2);
  }, [expenses, topCategory, total, variation, prevTotal]);

  // ── Filtered / sorted list ─────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let arr = expenses.filter(e => {
      const matchSearch =
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        (e.client as { name?: string } | undefined)
          ?.name?.toLowerCase().includes(search.toLowerCase());
      const matchCat  = filterCat  === "todos" || e.category === filterCat;
      const matchType = filterType === "todos" || e.type     === filterType;
      return matchSearch && matchCat && matchType;
    });
    const sortFns: Record<SortKey, (a: Expense, b: Expense) => number> = {
      date_desc:   (a, b) => b.date.localeCompare(a.date),
      date_asc:    (a, b) => a.date.localeCompare(b.date),
      amount_desc: (a, b) => b.amount - a.amount,
      amount_asc:  (a, b) => a.amount - b.amount,
    };
    return [...arr].sort(sortFns[sort]);
  }, [expenses, search, filterCat, filterType, sort]);

  const hasFilters = search !== "" || filterCat !== "todos" || filterType !== "todos";
  const filteredTotal = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleSave = useCallback(async (data: NewExpense): Promise<{ error: string | null }> => {
    const result = modal.expense
      ? await updateExpense(modal.expense.id, data)
      : await createExpense(data);
    if (result.error) { toast.error(result.error); }
    else {
      toast.success(modal.expense ? "Despesa atualizada!" : "Despesa criada!");
      setModal({ open: false });
    }
    return result;
  }, [modal.expense, createExpense, updateExpense]);

  const handleDelete = useCallback(async (id: string) => {
    if (deleting === id) { await deleteExpense(id); setDeleting(null); }
    else { setDeleting(id); setTimeout(() => setDeleting(null), 3000); }
  }, [deleting, deleteExpense]);

  const clearFilters = () => { setSearch(""); setFilterCat("todos"); setFilterType("todos"); };

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="lc-card p-5 h-28 animate-pulse">
              <div className="w-9 h-9 rounded-xl bg-white/5 mb-3" />
              <div className="h-3 bg-white/5 rounded w-2/3 mb-2" />
              <div className="h-6 bg-white/5 rounded w-1/2" />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="lc-card p-5 h-60 animate-pulse" />
          <div className="lc-card p-5 h-60 animate-pulse" />
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* ── 1. KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Despesa Total"
          value={fmt(total)}
          sub={`${expenses.length} lançamento${expenses.length !== 1 ? "s" : ""}`}
          icon={<TrendingDown size={16} />}
          accent="#ef4444"
          trend={variation !== null ? { pct: variation } : null}
          delay={0}
        />
        <KpiCard
          label="Despesas Fixas"
          value={fmt(totalFixa)}
          sub={`${expenses.filter(e => e.type === "fixa").length} itens`}
          icon={<Tag size={16} />}
          accent="#60a5fa"
          delay={0.04}
        />
        <KpiCard
          label="Despesas Variáveis"
          value={fmt(totalVar)}
          sub={`${expenses.filter(e => e.type === "variavel").length} itens`}
          icon={<Zap size={16} />}
          accent="#fbbf24"
          delay={0.08}
        />
        <KpiCard
          label="Ticket Médio"
          value={fmt(ticketMedio)}
          sub="por lançamento"
          icon={<ArrowUpDown size={16} />}
          accent="#a78bfa"
          delay={0.12}
        />
        <KpiCard
          label="Maior Categoria"
          value={topCategory ? fmt(topCategory.total) : "—"}
          sub={topCategory?.label ?? "Sem dados"}
          icon={<Layers size={16} />}
          accent="#f472b6"
          delay={0.16}
        />
        <KpiCard
          label="Variação vs Anterior"
          value={
            variation !== null
              ? `${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%`
              : "—"
          }
          sub={prevTotal > 0 ? `Anterior: ${fmt(prevTotal)}` : "Sem dados anteriores"}
          icon={variation !== null && variation < 0
            ? <TrendingDown size={16} />
            : <TrendingUp size={16} />
          }
          accent={variation !== null && variation < 0 ? "#10b981" : "#ef4444"}
          delay={0.20}
        />
      </div>

      {/* ── 2. Analytics Row ── */}
      {(byCategory.length > 0 || dailyChartData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Category breakdown */}
          {byCategory.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="lc-card p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Por Categoria</h3>
                  <p className="text-xs text-[#b4b4b4] mt-0.5">Clique para filtrar a tabela</p>
                </div>
                {filterCat !== "todos" && (
                  <button
                    onClick={() => setFilterCat("todos")}
                    className="flex items-center gap-1 text-xs text-[#4a8fd4] hover:underline"
                  >
                    <X size={10} /> Limpar
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {byCategory.map(c => {
                  const pct     = total > 0 ? (c.total / total) * 100 : 0;
                  const isActive = filterCat === c.category;
                  return (
                    <button
                      key={c.category}
                      onClick={() => setFilterCat(isActive ? "todos" : c.category)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: c.hex }} />
                          <span className={cn(
                            "text-xs font-medium transition-colors",
                            isActive ? c.color : "text-[#b4b4b4] group-hover:text-white"
                          )}>
                            {c.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-[#5a5a5a]">{pct.toFixed(1)}%</span>
                          <span className={cn(
                            "text-xs font-semibold tabular-nums transition-colors",
                            isActive ? "text-white" : "text-[#b4b4b4] group-hover:text-white"
                          )}>
                            {fmt(c.total)}
                          </span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden"
                        style={{ background: "rgba(255,255,255,0.06)" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut", delay: 0.3 }}
                          className="h-full rounded-full"
                          style={{ background: c.hex, opacity: isActive ? 1 : 0.55 }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lc-card p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Evolução</h3>
                <p className="text-xs text-[#b4b4b4] mt-0.5">Despesas no período</p>
              </div>
              <div
                className="flex gap-0.5 p-0.5 rounded-lg"
                style={{
                  background: "rgba(0,0,0,0.30)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                {(["day", "category"] as ChartView[]).map(v => (
                  <button
                    key={v}
                    onClick={() => setChartView(v)}
                    className={cn(
                      "px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
                      chartView === v
                        ? "text-white"
                        : "text-[#b4b4b4] hover:text-white"
                    )}
                    style={chartView === v
                      ? { background: "rgba(255,255,255,0.14)" }
                      : {}
                    }
                  >
                    {v === "day" ? "Por Dia" : "Categoria"}
                  </button>
                ))}
              </div>
            </div>

            {(chartView === "day" ? dailyChartData : categoryChartData).length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-[#5a5a5a] text-xs">
                Sem dados suficientes
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={(chartView === "day" ? dailyChartData : categoryChartData) as Record<string, unknown>[]}
                  margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(255,255,255,0.05)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey={chartView === "day" ? "date" : "name"}
                    tick={{ fill: "#b4b4b4", fontSize: 10 }}
                    axisLine={false} tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#b4b4b4", fontSize: 10 }}
                    axisLine={false} tickLine={false}
                    tickFormatter={fmtK}
                  />
                  <RechartsTooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    content={<ChartTooltip />}
                  />
                  {chartView === "day" ? (
                    <Bar
                      dataKey="total"
                      fill="#ef4444"
                      fillOpacity={0.75}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={32}
                    />
                  ) : (
                    <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {categoryChartData.map((entry, i) => (
                        <Cell key={i} fill={entry.hex} fillOpacity={0.8} />
                      ))}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
            )}
          </motion.div>
        </div>
      )}

      {/* ── 3. Insights ── */}
      {insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="lc-card p-4 flex items-start gap-3"
          style={{ borderColor: "rgba(251,191,36,0.18)" }}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "rgba(251,191,36,0.12)", color: "#fbbf24" }}
          >
            <Lightbulb size={14} />
          </div>
          <div className="flex flex-col gap-1">
            {insights.map((ins, i) => (
              <p key={i} className="text-xs text-[#b4b4b4]">
                <span className="text-[#fbbf24] font-medium">Insight · </span>{ins}
              </p>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── 4. Filter bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
        className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b4b4b4]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar despesa..."
              className="lc-filter-control rounded-xl pl-8 pr-3 py-2 text-sm outline-none w-44"
            />
          </div>

          <select
            value={filterCat}
            onChange={e => setFilterCat(e.target.value as ExpenseCategory | "todos")}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none"
          >
            <option value="todos">Todas categorias</option>
            {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as ExpenseType | "todos")}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none"
          >
            <option value="todos">Fixas + Variáveis</option>
            <option value="fixa">Apenas Fixas</option>
            <option value="variavel">Apenas Variáveis</option>
          </select>

          <select
            value={sort}
            onChange={e => setSort(e.target.value as SortKey)}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none"
          >
            <option value="date_desc">Mais recentes</option>
            <option value="date_asc">Mais antigas</option>
            <option value="amount_desc">Maior valor</option>
            <option value="amount_asc">Menor valor</option>
          </select>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[#b4b4b4] hover:text-white transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <X size={11} /> Limpar filtros
            </button>
          )}
        </div>

        <PrimaryButton
          onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 px-4 py-2 text-sm shrink-0"
        >
          <Plus size={15} />
          Nova Despesa
        </PrimaryButton>
      </motion.div>

      {/* ── 5. Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42 }}
        className="lc-card overflow-hidden"
      >
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-sm font-semibold text-white">
            Lançamentos
            {filtered.length !== expenses.length && (
              <span className="ml-2 text-xs text-[#b4b4b4] font-normal">
                ({filtered.length} de {expenses.length})
              </span>
            )}
          </p>
          <p className="text-sm font-bold text-red-400 tabular-nums">
            {fmt(filteredTotal)}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            {hasFilters ? (
              <>
                <p className="text-[#b4b4b4] text-sm mb-2">
                  Nenhuma despesa encontrada com esses filtros
                </p>
                <button onClick={clearFilters} className="text-[#4a8fd4] text-sm hover:underline">
                  Limpar filtros
                </button>
              </>
            ) : (
              <>
                <p className="text-[#b4b4b4] text-sm mb-3">Nenhuma despesa neste período</p>
                <button
                  onClick={() => setModal({ open: true })}
                  className="text-[#4a8fd4] text-sm hover:underline"
                >
                  Adicionar primeira despesa
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Categoria", "Descrição", "Valor", "Data", "Tipo", "Cliente", "Centro de Custo", ""].map(h => (
                    <th
                      key={h}
                      className="text-left text-[10px] text-[#5a5a5a] font-semibold uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filtered.map((e, i) => {
                    const cc = CATEGORY_CONFIG[e.category];
                    return (
                      <motion.tr
                        key={e.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: Math.min(i * 0.015, 0.25) }}
                        className="group transition-colors hover:bg-white/[0.025]"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      >
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={cn(
                            "flex items-center gap-1.5 w-fit text-[11px] font-medium px-2.5 py-1 rounded-full border",
                            cc.color, cc.bg
                          )}>
                            {e.auto_imported && <Zap size={9} />}
                            {cc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 max-w-[200px]">
                          <p className="text-white truncate">{e.description}</p>
                          {e.notes && (
                            <p className="text-[10px] text-[#5a5a5a] truncate mt-0.5">{e.notes}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-red-400 font-semibold whitespace-nowrap tabular-nums">
                          {fmt(e.amount)}
                        </td>
                        <td className="px-4 py-3.5 text-[#b4b4b4] whitespace-nowrap text-xs">
                          {format(parseISO(e.date), "dd MMM yyyy", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <span className={cn(
                            "text-[11px] px-2 py-0.5 rounded-full font-medium",
                            e.type === "fixa"
                              ? "text-blue-400 bg-blue-400/10"
                              : "text-amber-400 bg-amber-400/10"
                          )}>
                            {e.type === "fixa" ? "Fixa" : "Variável"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-[#b4b4b4] whitespace-nowrap text-xs max-w-[120px] truncate">
                          {(e.client as { name?: string } | undefined)?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3.5 text-[#b4b4b4] whitespace-nowrap text-xs">
                          {e.cost_center ?? "—"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!e.auto_imported && (
                              <button
                                onClick={() => setModal({ open: true, expense: e })}
                                className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-colors"
                              >
                                <Edit2 size={13} />
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(e.id)}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                deleting === e.id
                                  ? "text-red-400 bg-red-400/10"
                                  : "text-[#b4b4b4] hover:text-red-400 hover:bg-red-400/10"
                              )}
                            >
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
          <DespesaModal
            expense={modal.expense}
            onClose={() => setModal({ open: false })}
            onSave={handleSave}
            clients={clients}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
