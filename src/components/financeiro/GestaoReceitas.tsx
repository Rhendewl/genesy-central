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
  Plus, Search, X, Edit2, Trash2, Check,
  CheckCircle2, Clock, AlertTriangle, XCircle,
  TrendingUp, TrendingDown, DollarSign, RefreshCw,
  Users, Repeat, Lightbulb, ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { useReceitas } from "@/hooks/useReceitas";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { cn } from "@/lib/utils";
import type { Revenue, NewRevenue, RevenueStatus, RevenueType, PaymentMethod } from "@/types";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtK = (v: number) => {
  if (Math.abs(v) >= 1000) return `R$${(v / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL", maximumFractionDigits: 0,
  }).format(v);
};

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RevenueStatus, {
  label: string; color: string; icon: React.ReactNode;
}> = {
  pago:      { label: "Pago",      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: <CheckCircle2 size={11} /> },
  pendente:  { label: "Pendente",  color: "text-[#b4b4b4] bg-[#b4b4b4]/10 border-[#b4b4b4]/20",     icon: <Clock size={11} /> },
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

  const field = "w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/[0.03] backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="lc-modal-panel relative w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">
            {revenue ? "Editar Receita" : "Nova Receita"}
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
          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Cliente</label>
            <select value={form.client_id ?? ""} onChange={e => set("client_id", e.target.value || null)}
              className={field} style={{ border: "none" }}>
              <option value="">Sem cliente vinculado</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Descrição *</label>
            <input value={form.description ?? ""} onChange={e => set("description", e.target.value)}
              placeholder="Ex: Mensalidade Janeiro — Imobiliária X"
              className={`${field} placeholder:text-[#b4b4b4]/50`} style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Valor *</label>
            <MoneyInput value={form.amount ?? 0} onChange={v => set("amount", v)} />
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Tipo</label>
            <select value={form.type ?? "mensalidade"} onChange={e => set("type", e.target.value as RevenueType)}
              className={field} style={{ border: "none" }}>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Data *</label>
            <input type="date" value={form.date ?? ""} onChange={e => set("date", e.target.value)}
              className={field} style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Vencimento</label>
            <input type="date" value={form.due_date ?? ""} onChange={e => set("due_date", e.target.value || null)}
              className={field} style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Forma de Pagamento</label>
            <select value={form.payment_method ?? "pix"} onChange={e => set("payment_method", e.target.value as PaymentMethod)}
              className={field} style={{ border: "none" }}>
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Status</label>
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
            <label htmlFor="is_recurring" className="text-sm text-[#b4b4b4] cursor-pointer">
              Receita recorrente (MRR)
            </label>
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
            {saving ? "Salvando..." : revenue ? "Salvar Alterações" : "Criar Receita"}
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
  trend?: { pct: number; positive?: boolean } | null;
  delay?: number;
}) {
  const trendUp = trend ? (trend.positive !== false ? trend.pct >= 0 : trend.pct < 0) : false;
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
            trendUp ? "text-emerald-400 bg-emerald-400/10" : "text-red-400 bg-red-400/10"
          )}>
            {trendUp ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
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

function ChartTooltip({ active, payload, label }: {
  active?: boolean; payload?: Array<{ value: number }>; label?: string;
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
type ChartView = "day" | "type";

export function GestaoReceitas({ year, month }: Props) {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd   = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");

  const prevYear  = month === 1 ? year - 1 : year;
  const prevMon   = month === 1 ? 12 : month - 1;
  const prevStart = `${prevYear}-${String(prevMon).padStart(2, "0")}-01`;
  const prevEnd   = format(endOfMonth(new Date(prevYear, prevMon - 1)), "yyyy-MM-dd");

  const { revenues, isLoading, createRevenue, updateRevenue, deleteRevenue, markAsPaid } =
    useReceitas(monthStart, monthEnd);
  const { revenues: prevRevenues } = useReceitas(prevStart, prevEnd);
  const { clients } = useAgencyClients();

  const [search,      setSearch]      = useState("");
  const [filterType,  setFilterType]  = useState<RevenueType | "todos">("todos");
  const [filterStatus,setFilterStatus]= useState<RevenueStatus | "todos">("todos");
  const [filterPay,   setFilterPay]   = useState<PaymentMethod | "todos">("todos");
  const [sort,        setSort]        = useState<SortKey>("date_desc");
  const [chartView,   setChartView]   = useState<ChartView>("day");
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
      })
      .filter(d => d.total > 0);
  }, [active, year, month, monthEnd]);

  const typeChartData = useMemo(() =>
    byType.map(t => ({ name: t.label, total: t.total, hex: t.hex })),
    [byType]
  );

  // ── Insights ───────────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    const list: string[] = [];
    if (topClients[0] && total > 0) {
      const pct = ((topClients[0].total / total) * 100).toFixed(0);
      list.push(`${topClients[0].name} gerou ${pct}% da receita (${fmt(topClients[0].total)})`);
      if (Number(pct) > 50)
        list.push(`Alta concentração: mais de 50% da receita em 1 cliente`);
    }
    if (totalAtrasado > 0 && total > 0) {
      const pct = ((totalAtrasado / total) * 100).toFixed(1);
      list.push(`${pct}% da receita está em atraso (${fmt(totalAtrasado)})`);
    }
    if (variation !== null && Math.abs(variation) > 5 && list.length < 2) {
      const dir = variation > 0 ? "acima" : "abaixo";
      list.push(`Receita ${Math.abs(variation).toFixed(1)}% ${dir} do mês anterior`);
    }
    return list.slice(0, 2);
  }, [topClients, total, totalAtrasado, variation, prevTotal]); // eslint-disable-line react-hooks/exhaustive-deps

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
              <div className="w-9 h-9 rounded-xl bg-white/5 mb-3" />
              <div className="h-3 bg-white/5 rounded w-2/3 mb-2" />
              <div className="h-6 bg-white/5 rounded w-1/2" />
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
    <div className="space-y-5">

      {/* ── 1. KPI Row (8 cards, 2×4) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Receita Total"
          value={fmt(total)}
          sub={`${active.length} lançamentos`}
          icon={<DollarSign size={16} />}
          accent="#22c55e"
          trend={variation !== null ? { pct: variation, positive: true } : null}
          delay={0}
        />
        <KpiCard
          label="Recebido"
          value={fmt(totalPago)}
          sub={`${revenues.filter(r => r.status === "pago").length} pagamentos`}
          icon={<CheckCircle2 size={16} />}
          accent="#10b981"
          delay={0.04}
        />
        <KpiCard
          label="A Receber"
          value={fmt(totalPendente)}
          sub={`${revenues.filter(r => r.status === "pendente").length} pendentes`}
          icon={<Clock size={16} />}
          accent="#fbbf24"
          delay={0.08}
        />
        <KpiCard
          label="Inadimplência"
          value={fmt(totalAtrasado)}
          sub={`${revenues.filter(r => r.status === "atrasado").length} em atraso`}
          icon={<AlertTriangle size={16} />}
          accent={totalAtrasado > 0 ? "#f87171" : "#b4b4b4"}
          delay={0.12}
        />
        <KpiCard
          label="MRR"
          value={fmt(mrr)}
          sub={`${revenues.filter(r => r.is_recurring).length} recorrentes`}
          icon={<Repeat size={16} />}
          accent="#60a5fa"
          delay={0.16}
        />
        <KpiCard
          label="Ticket Médio / Cliente"
          value={fmt(ticketMedio)}
          sub={`${uniqueClients} cliente${uniqueClients !== 1 ? "s" : ""} pagantes`}
          icon={<Users size={16} />}
          accent="#a78bfa"
          delay={0.20}
        />
        <KpiCard
          label="Crescimento"
          value={variation !== null ? `${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%` : "—"}
          sub={prevTotal > 0 ? `Anterior: ${fmt(prevTotal)}` : "Sem dados anteriores"}
          icon={variation !== null && variation >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
          accent={variation !== null && variation >= 0 ? "#22c55e" : "#ef4444"}
          delay={0.24}
        />
        <KpiCard
          label="Taxa de Recebimento"
          value={`${taxaRecebimento.toFixed(1)}%`}
          sub={total > 0 ? `${fmt(totalPago)} de ${fmt(total)}` : "Sem receitas"}
          icon={<RefreshCw size={16} />}
          accent={taxaRecebimento >= 80 ? "#22c55e" : taxaRecebimento >= 50 ? "#fbbf24" : "#ef4444"}
          delay={0.28}
        />
      </div>

      {/* ── 2. Analytics Row ── */}
      {(byType.length > 0 || topClients.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* By type + chart stacked */}
          <div className="flex flex-col gap-5">
            {byType.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="lc-card p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Origem da Receita</h3>
                    <p className="text-xs text-[#b4b4b4] mt-0.5">Clique para filtrar a tabela</p>
                  </div>
                  {filterType !== "todos" && (
                    <button onClick={() => setFilterType("todos")}
                      className="flex items-center gap-1 text-xs text-[#4a8fd4] hover:underline">
                      <X size={10} /> Limpar
                    </button>
                  )}
                </div>
                <div className="space-y-3">
                  {byType.map(t => {
                    const pct      = total > 0 ? (t.total / total) * 100 : 0;
                    const isActive = filterType === t.type;
                    return (
                      <button key={t.type} onClick={() => setFilterType(isActive ? "todos" : t.type)}
                        className="w-full text-left group">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: t.hex }} />
                            <span className={cn("text-xs font-medium transition-colors",
                              isActive ? t.color : "text-[#b4b4b4] group-hover:text-white")}>
                              {t.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] text-[#5a5a5a]">{pct.toFixed(1)}%</span>
                            <span className={cn("text-xs font-semibold tabular-nums transition-colors",
                              isActive ? "text-white" : "text-[#b4b4b4] group-hover:text-white")}>
                              {fmt(t.total)}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.6, ease: "easeOut", delay: 0.35 }}
                            className="h-full rounded-full"
                            style={{ background: t.hex, opacity: isActive ? 1 : 0.55 }}
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
              transition={{ delay: 0.35 }}
              className="lc-card p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Evolução</h3>
                  <p className="text-xs text-[#b4b4b4] mt-0.5">Receitas no período</p>
                </div>
                <div className="flex gap-0.5 p-0.5 rounded-lg"
                  style={{ background: "rgba(0,0,0,0.30)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {(["day", "type"] as ChartView[]).map(v => (
                    <button key={v} onClick={() => setChartView(v)}
                      className={cn("px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
                        chartView === v ? "text-white" : "text-[#b4b4b4] hover:text-white")}
                      style={chartView === v ? { background: "rgba(255,255,255,0.14)" } : {}}>
                      {v === "day" ? "Por Dia" : "Por Tipo"}
                    </button>
                  ))}
                </div>
              </div>
              {(chartView === "day" ? dailyChartData : typeChartData).length === 0 ? (
                <div className="h-[160px] flex items-center justify-center text-[#5a5a5a] text-xs">
                  Sem dados suficientes
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={(chartView === "day" ? dailyChartData : typeChartData) as Record<string, unknown>[]}
                    margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                    <XAxis dataKey={chartView === "day" ? "date" : "name"}
                      tick={{ fill: "#b4b4b4", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#b4b4b4", fontSize: 10 }} axisLine={false} tickLine={false}
                      tickFormatter={fmtK} />
                    <RechartsTooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip />} />
                    {chartView === "day" ? (
                      <Bar dataKey="total" fill="#22c55e" fillOpacity={0.75} radius={[4, 4, 0, 0]} maxBarSize={32} />
                    ) : (
                      <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
                        {typeChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.hex} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    )}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </motion.div>
          </div>

          {/* Top clients */}
          {topClients.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32 }}
              className="lc-card p-5"
            >
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-white">Top Clientes</h3>
                <p className="text-xs text-[#b4b4b4] mt-0.5">Por receita no período</p>
              </div>
              <div className="space-y-4">
                {topClients.map((c, i) => {
                  const pct = total > 0 ? (c.total / total) * 100 : 0;
                  const colors = ["#22c55e", "#60a5fa", "#a78bfa", "#f472b6", "#fbbf24"];
                  const hex = colors[i % colors.length];
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                            style={{ background: `${hex}22`, color: hex }}>
                            {i + 1}
                          </div>
                          <span className="text-xs font-medium text-white truncate max-w-[140px]">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-[10px] text-[#5a5a5a]">{pct.toFixed(1)}%</span>
                          <span className="text-xs font-semibold tabular-nums text-white">{fmt(c.total)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut", delay: 0.4 + i * 0.06 }}
                          className="h-full rounded-full"
                          style={{ background: hex, opacity: 0.7 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Concentration warning */}
              {topClients[0] && total > 0 && (topClients[0].total / total) > 0.5 && (
                <div className="mt-4 px-3 py-2 rounded-xl text-xs"
                  style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.18)" }}>
                  <span className="text-amber-400 font-medium">Atenção: </span>
                  <span className="text-[#b4b4b4]">
                    {((topClients[0].total / total) * 100).toFixed(0)}% da receita concentrada em 1 cliente
                  </span>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}

      {/* ── 3. Insights ── */}
      {insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          className="lc-card p-4 flex items-start gap-3"
          style={{ borderColor: "rgba(34,197,94,0.18)" }}
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
            <Lightbulb size={14} />
          </div>
          <div className="flex flex-col gap-1">
            {insights.map((ins, i) => (
              <p key={i} className="text-xs text-[#b4b4b4]">
                <span className="text-emerald-400 font-medium">Insight · </span>{ins}
              </p>
            ))}
          </div>
        </motion.div>
      )}

      {/* ── 4. Filter bar ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b4b4b4]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar receita ou cliente..."
              className="lc-filter-control rounded-xl pl-8 pr-3 py-2 text-sm outline-none w-48" />
          </div>

          <select value={filterType} onChange={e => setFilterType(e.target.value as RevenueType | "todos")}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none">
            <option value="todos">Todos os tipos</option>
            {Object.entries(TYPE_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as RevenueStatus | "todos")}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none">
            <option value="todos">Todos os status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select value={filterPay} onChange={e => setFilterPay(e.target.value as PaymentMethod | "todos")}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none">
            <option value="todos">Forma de pagamento</option>
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none">
            <option value="date_desc">Mais recentes</option>
            <option value="date_asc">Mais antigas</option>
            <option value="amount_desc">Maior valor</option>
            <option value="amount_asc">Menor valor</option>
          </select>

          {hasFilters && (
            <button onClick={clearFilters}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[#b4b4b4] hover:text-white transition-colors"
              style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              <X size={11} /> Limpar filtros
            </button>
          )}
        </div>

        <PrimaryButton onClick={() => setModal({ open: true })}
          className="flex items-center gap-2 px-4 py-2 text-sm shrink-0">
          <Plus size={15} />
          Nova Receita
        </PrimaryButton>
      </motion.div>

      {/* ── 5. Table ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.44 }}
        className="lc-card overflow-hidden"
      >
        <div className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <p className="text-sm font-semibold text-white">
            Lançamentos
            {filtered.length !== revenues.length && (
              <span className="ml-2 text-xs text-[#b4b4b4] font-normal">
                ({filtered.length} de {revenues.length})
              </span>
            )}
          </p>
          <p className="text-sm font-bold text-emerald-400 tabular-nums">{fmt(filteredTotal)}</p>
        </div>

        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            {hasFilters ? (
              <>
                <p className="text-[#b4b4b4] text-sm mb-2">Nenhuma receita com esses filtros</p>
                <button onClick={clearFilters} className="text-[#4a8fd4] text-sm hover:underline">
                  Limpar filtros
                </button>
              </>
            ) : (
              <>
                <p className="text-[#b4b4b4] text-sm mb-3">Nenhuma receita neste período</p>
                <button onClick={() => setModal({ open: true })}
                  className="text-[#4a8fd4] text-sm hover:underline">
                  Adicionar primeira receita
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Cliente", "Descrição", "Tipo", "Valor", "Vencimento", "Recebido", "Forma", "Status", ""].map(h => (
                    <th key={h}
                      className="text-left text-[10px] text-[#5a5a5a] font-semibold uppercase tracking-wider px-4 py-3 whitespace-nowrap">
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
                        className="group transition-colors hover:bg-white/[0.025]"
                        style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          {clientName ? (
                            <span className="text-[#c7e5ff] text-xs font-medium max-w-[120px] truncate block">{clientName}</span>
                          ) : (
                            <span className="text-[#5a5a5a] text-xs italic">—</span>
                          )}
                          {r.is_recurring && (
                            <span className="flex items-center gap-0.5 text-[9px] text-[#60a5fa] mt-0.5">
                              <Repeat size={8} /> recorrente
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 max-w-[180px]">
                          <p className="text-white truncate">{r.description}</p>
                          {r.notes && (
                            <p className="text-[10px] text-[#5a5a5a] truncate mt-0.5">{r.notes}</p>
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
                        <td className="px-4 py-3.5 text-[#b4b4b4] whitespace-nowrap text-xs">
                          {r.due_date ? format(parseISO(r.due_date), "dd MMM yy", { locale: ptBR }) : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-[#b4b4b4] whitespace-nowrap text-xs">
                          {r.paid_date ? format(parseISO(r.paid_date), "dd MMM yy", { locale: ptBR }) : "—"}
                        </td>
                        <td className="px-4 py-3.5 text-[#b4b4b4] whitespace-nowrap text-xs">
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
                              className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-colors">
                              <Edit2 size={13} />
                            </button>
                            <button onClick={() => handleDelete(r.id)}
                              className={cn("p-1.5 rounded-lg transition-colors",
                                deleting === r.id
                                  ? "text-red-400 bg-red-400/10"
                                  : "text-[#b4b4b4] hover:text-red-400 hover:bg-red-400/10")}>
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
            clients={clients}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
