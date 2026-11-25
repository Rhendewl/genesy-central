"use client";

import { FinancialSectionHeader, FinancialMetric, FinancialFilters, FinancialAnalysis } from "./FinancialSection";
import { FinancialActivityChart, FinancialBreakdown } from "./FinancialActivityChart";
import { createPortal } from "react-dom";
import { DateInput } from "@/components/ui/DateInput";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, eachDayOfInterval } from "date-fns";
import { isFullMonth, previousLabel, previousPeriod, type FinancialPeriod } from "@/lib/financeiro/period";
import { ptBR } from "date-fns/locale";
import { Search, X, Edit2, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { useDespesas } from "@/hooks/useDespesas";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { cn } from "@/lib/utils";
import type { Expense, NewExpense, ExpenseCategory, ExpenseType } from "@/types";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";
import { privateFinancialValue, useFinancialPrivacyStore } from "@/store/financial-privacy";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (v: number) =>
  privateFinancialValue(new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v));


// ── Config ────────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<ExpenseCategory, {
  label: string; color: string; hex: string; bg: string;
}> = {
  freelancers:  { label: "Freelancers",     color: "text-purple-400", hex: "#c084fc", bg: "bg-purple-400/10 border-purple-400/20" },
  equipe:       { label: "Equipe Interna",  color: "text-blue-400",   hex: "#60a5fa", bg: "bg-blue-400/10 border-blue-400/20" },
  ferramentas:  { label: "Ferramentas",     color: "text-cyan-400",   hex: "#22d3ee", bg: "bg-cyan-400/10 border-cyan-400/20" },
  impostos:     { label: "Impostos",        color: "text-red-400",    hex: "#f87171", bg: "bg-red-400/10 border-red-400/20" },
  operacional:  { label: "Operacional",     color: "text-[var(--silver)]",  hex: "var(--silver)", bg: "bg-[var(--silver)]/10 border-[var(--silver)]/20" },
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

  const field = "w-full rounded-xl bg-[var(--hover)] text-[var(--text-title)] text-sm px-3 py-2.5 outline-none";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="lc-modal-backdrop absolute inset-0" />
      <motion.div
        role="dialog" aria-modal="true" aria-label={expense ? "Editar Despesa" : "Nova Despesa"}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="lc-modal-panel relative max-h-[calc(100dvh-2rem)] w-full max-w-lg space-y-4 overflow-y-auto overscroll-contain rounded-2xl p-5 sm:p-6"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-[var(--text-title)]">
            {expense ? "Editar Despesa" : "Nova Despesa"}
          </h2>
          <button aria-label="Fechar despesa" onClick={onClose} className="text-[var(--silver)] hover:text-[var(--text-title)] transition-colors">
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
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Categoria</label>
            <select value={form.category ?? "outros"}
              onChange={e => set("category", e.target.value as ExpenseCategory)}
              className={field} style={{ border: "none" }}>
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Tipo</label>
            <select value={form.type ?? "variavel"}
              onChange={e => set("type", e.target.value as ExpenseType)}
              className={field} style={{ border: "none" }}>
              <option value="fixa">Fixa</option>
              <option value="variavel">Variável</option>
            </select>
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Descrição *</label>
            <input value={form.description ?? ""} onChange={e => set("description", e.target.value)}
              placeholder="Ex: Pagamento freelancer design"
              className={`${field} placeholder:text-[var(--silver)]/50`} style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Valor *</label>
            <MoneyInput value={form.amount ?? 0} onChange={v => set("amount", v)} />
          </div>
          <div>
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Data *</label>
            <DateInput type="date" value={form.date ?? ""} onChange={e => set("date", e.target.value)}
              className={field} style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Cliente vinculado</label>
            <select value={form.client_id ?? ""} onChange={e => set("client_id", e.target.value || null)}
              className={field} style={{ border: "none" }}>
              <option value="">Nenhum</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Centro de Custo</label>
            <input value={form.cost_center ?? ""} onChange={e => set("cost_center", e.target.value || null)}
              placeholder="Ex: Operações"
              className={`${field} placeholder:text-[var(--silver)]/50`} style={{ border: "none" }} />
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
            {saving ? "Salvando..." : expense ? "Salvar" : "Criar Despesa"}
          </PrimaryButton>
        </div>
      </motion.div>
    </div>, document.body
  );
}

type SortKey = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export function GestaoDespesas({ period }: { period: FinancialPeriod }) {
  const valuesHidden = useFinancialPrivacyStore(state => state.valuesHidden);
  const monthStart = period.start;
  const monthEnd   = period.end;
  const { start: prevStart, end: prevEnd } = previousPeriod(period);
  const mensal = isFullMonth(period);
  const anterior = previousLabel(period);

  const { expenses, isLoading, createExpense, updateExpense, deleteExpense } =
    useDespesas(monthStart, monthEnd);
  const { expenses: prevExpenses } = useDespesas(prevStart, prevEnd);
  const { clients, assignableClients } = useAgencyClients();

  const [search,     setSearch]     = useState("");
  const [filterCat,  setFilterCat]  = useState<ExpenseCategory | "todos">("todos");
  const [filterType, setFilterType] = useState<ExpenseType | "todos">("todos");
  const [sort,       setSort]       = useState<SortKey>("date_desc");
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
    const start = parseISO(monthStart);
    const end   = parseISO(monthEnd);
    const variosMeses = monthStart.slice(0, 7) !== monthEnd.slice(0, 7);
    return eachDayOfInterval({ start, end })
      .map(day => {
        const dayStr = format(day, "yyyy-MM-dd");
        const dayTotal = expenses
          .filter(e => e.date === dayStr)
          .reduce((s, e) => s + e.amount, 0);
        return { date: format(day, variosMeses ? "dd/MM" : "dd"), total: dayTotal };
      });
  }, [expenses, monthStart, monthEnd]);


  // ── Insights ───────────────────────────────────────────────────────────────

  const insights = useMemo(() => {
    void valuesHidden;
    const list: string[] = [];
    if (total > 0 && topCategory) {
      const pct = ((topCategory.total / total) * 100).toFixed(0);
      list.push(`${topCategory.label} é a maior categoria: ${privateFinancialValue(`${pct}%`)} do total (${fmt(topCategory.total)})`);
    }
    if (variation !== null && Math.abs(variation) > 5) {
      const dir = variation > 0 ? "acima" : "abaixo";
      list.push(`Despesas ${privateFinancialValue(`${Math.abs(variation).toFixed(1)}%`)} ${dir} do ${anterior} (${fmt(prevTotal)})`);
    }
    if (list.length < 2) {
      const largest = [...expenses].sort((a, b) => b.amount - a.amount)[0];
      if (largest) {
        list.push(`Maior lançamento: "${largest.description}" — ${fmt(largest.amount)}`);
      }
    }
    return list.slice(0, 2);
  }, [expenses, topCategory, total, variation, prevTotal, valuesHidden]);

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
              <div className="w-9 h-9 rounded-xl bg-[var(--shimmer-base)] mb-3" />
              <div className="h-3 bg-[var(--shimmer-base)] rounded w-2/3 mb-2" />
              <div className="h-6 bg-[var(--shimmer-base)] rounded w-1/2" />
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
    <div className="fin-workspace">
      <FinancialSectionHeader title="Despesas" description="Custos fixos, variáveis e lançamentos da operação." createLabel="Nova Despesa" onCreate={() => setModal({ open: true })} />
      <div className="fin-overview" aria-label={mensal ? "Resumo das despesas do mês" : "Resumo das despesas do período"}>
        <FinancialMetric label={mensal ? "Total do mês" : "Total do período"} value={fmt(total)} detail={`${expenses.length} lançamentos`} tone="amber" onClick={() => setFilterType("todos")} selected={filterType === "todos"} />
        <FinancialMetric label="Custos fixos" value={fmt(totalFixa)} detail="Toque para consultar os fixos" tone="blue" onClick={() => setFilterType(filterType === "fixa" ? "todos" : "fixa")} selected={filterType === "fixa"} />
        <FinancialMetric label="Custos variáveis" value={fmt(totalVar)} detail="Toque para consultar os variáveis" onClick={() => setFilterType(filterType === "variavel" ? "todos" : "variavel")} selected={filterType === "variavel"} />
        <FinancialMetric label={mensal ? "Variação mensal" : "Variação"} value={variation === null ? "—" : privateFinancialValue(`${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%`)} detail={prevTotal > 0 ? `${anterior[0].toUpperCase()}${anterior.slice(1)}: ${fmt(prevTotal)}` : `Sem base no ${anterior}`} tone={variation !== null && variation > 0 ? "red" : "green"} />
      </div>
      <FinancialAnalysis>
        <div className="fin-chart-grid">
          <FinancialActivityChart title="Evolução das despesas" description={mensal ? "Custos lançados em cada dia do mês." : "Custos lançados em cada dia do período."} data={dailyChartData} color="#fbbf24" />
          <FinancialBreakdown title="Onde estão os custos" description="Selecione uma categoria para filtrar os lançamentos." rows={byCategory.map(c => ({ id: c.category, label: c.label, total: c.total }))} selected={filterCat} onSelect={id => setFilterCat(filterCat === id ? "todos" : id as ExpenseCategory)} />
        </div>
      </FinancialAnalysis>
      <details className="fin-details"><summary>Indicadores de custo</summary><div className="fin-secondary-metrics">
        <FinancialMetric label="Valor médio" value={fmt(ticketMedio)} detail="Por lançamento" />
        <FinancialMetric label="Maior categoria" value={topCategory ? fmt(topCategory.total) : "—"} detail={topCategory?.label ?? "Sem lançamentos no período"} tone="amber" />
      </div></details>
      {insights.length > 0 && <aside className="fin-panel fin-insights"><h3>{mensal ? "Leitura do mês" : "Leitura do período"}</h3>{insights.map(insight => <p key={insight} className="mt-2 text-xs text-[var(--muted-foreground)]">{insight}</p>)}</aside>}

      {/* ── 4. Filter bar ── */}
      <FinancialFilters active={hasFilters}>
      <motion.div
        initial={{ y: 8 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.38 }}
        className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--silver)]" />
            <input
              aria-label="Buscar despesas" value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar despesa..."
              className="lc-filter-control rounded-xl pl-8 pr-3 py-2 text-sm outline-none w-44"
            />
          </div>

          <select
            aria-label="Filtrar categoria" value={filterCat}
            onChange={e => setFilterCat(e.target.value as ExpenseCategory | "todos")}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none"
          >
            <option value="todos">Todas categorias</option>
            {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>

          <select
            aria-label="Filtrar tipo de despesas" value={filterType}
            onChange={e => setFilterType(e.target.value as ExpenseType | "todos")}
            className="lc-filter-control rounded-xl px-3 py-2 text-sm outline-none appearance-none"
          >
            <option value="todos">Fixas + Variáveis</option>
            <option value="fixa">Apenas Fixas</option>
            <option value="variavel">Apenas Variáveis</option>
          </select>

          <select
            aria-label="Ordenar despesas" value={sort}
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs text-[var(--silver)] hover:text-[var(--text-title)] transition-colors"
              style={{ border: "1px solid var(--glass-border)" }}
            >
              <X size={11} /> Limpar filtros
            </button>
          )}
        </div>


      </motion.div>
      </FinancialFilters>

      {/* ── 5. Table ── */}
      <motion.div
        initial={{ y: 8 }}
        animate={{ y: 0 }}
        transition={{ delay: 0.42 }}
        className="fin-ledger lc-card overflow-hidden"
      >
        <div
          className="px-5 py-3.5 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold text-[var(--text-title)]">
            Lançamentos
            {filtered.length !== expenses.length && (
              <span className="ml-2 text-xs text-[var(--silver)] font-normal">
                ({filtered.length} de {expenses.length})
              </span>
            )}
          </p>
          <p className="text-sm font-bold text-red-400 tabular-nums">
            {fmt(filteredTotal)}
          </p>
        </div>

        {filtered.length > 0 && <div className="fin-mobile-ledger">{filtered.map(e => <article key={e.id}>
          <header><div><h3>{e.description}</h3><p>{CATEGORY_CONFIG[e.category].label} · {e.type === "fixa" ? "Fixa" : "Variável"}{e.auto_imported ? " · Importada" : ""}</p></div><strong>{fmt(e.amount)}</strong></header>
          <div className="fin-entry-meta"><span>{format(parseISO(e.date), "dd/MM/yyyy")}</span><span>{(e.client as { name?: string } | undefined)?.name ?? "Operação"}</span></div>
          <footer>{!e.auto_imported && <button type="button" onClick={() => setModal({ open: true, expense: e })} aria-label={`Editar despesa ${e.description}`}><Edit2 size={14} />Editar</button>}<button type="button" className="fin-entry-delete" onClick={() => void handleDelete(e.id)} aria-label={`Excluir despesa ${e.description}`}><Trash2 size={14} />{deleting === e.id ? "Confirmar?" : "Excluir"}</button></footer>
        </article>)}</div>}
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            {hasFilters ? (
              <>
                <p className="text-[var(--silver)] text-sm mb-2">
                  Nenhuma despesa encontrada com esses filtros
                </p>
                <button onClick={clearFilters} className="text-[#4a8fd4] text-sm hover:underline">
                  Limpar filtros
                </button>
              </>
            ) : (
              <>
                <p className="text-[var(--silver)] text-sm mb-3">Nenhuma despesa neste período</p>
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
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Categoria", "Descrição", "Valor", "Data", "Tipo", "Cliente", "Centro de Custo", ""].map(h => (
                    <th
                      key={h}
                      className="text-left text-[10px] text-[var(--text-muted)] font-semibold uppercase tracking-wider px-4 py-3 whitespace-nowrap"
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
                        className="group transition-colors hover:bg-[var(--hover)]"
                        style={{ borderBottom: "1px solid var(--border)" }}
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
                          <p className="text-[var(--text-title)] truncate">{e.description}</p>
                          {e.notes && (
                            <p className="text-[10px] text-[var(--text-muted)] truncate mt-0.5">{e.notes}</p>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-red-400 font-semibold whitespace-nowrap tabular-nums">
                          {fmt(e.amount)}
                        </td>
                        <td className="px-4 py-3.5 text-[var(--silver)] whitespace-nowrap text-xs">
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
                        <td className="px-4 py-3.5 text-[var(--silver)] whitespace-nowrap text-xs max-w-[120px] truncate">
                          {(e.client as { name?: string } | undefined)?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3.5 text-[var(--silver)] whitespace-nowrap text-xs">
                          {e.cost_center ?? "—"}
                        </td>
                        <td className="px-4 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {!e.auto_imported && (
                              <button
                                onClick={() => setModal({ open: true, expense: e })}
                                className="p-1.5 rounded-lg text-[var(--silver)] hover:text-[var(--text-title)] hover:bg-[var(--hover)] transition-colors"
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
                                  : "text-[var(--silver)] hover:text-red-400 hover:bg-red-400/10"
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
            clients={modal.expense
              ? clients.filter((client) => client.status !== "churned" || client.id === modal.expense?.client_id)
              : assignableClients}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
