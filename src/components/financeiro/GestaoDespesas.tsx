"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Search, Filter, X, Edit2, Trash2, Zap, Tag } from "lucide-react";
import { toast } from "sonner";
import { useDespesas } from "@/hooks/useDespesas";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { cn } from "@/lib/utils";
import type { Expense, NewExpense, ExpenseCategory, ExpenseType } from "@/types";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; color: string }> = {
  freelancers: { label: "Freelancers", color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  equipe: { label: "Equipe Interna", color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  ferramentas: { label: "Ferramentas", color: "text-cyan-400 bg-cyan-400/10 border-cyan-400/20" },
  impostos: { label: "Impostos", color: "text-red-400 bg-red-400/10 border-red-400/20" },
  operacional: { label: "Operacional", color: "text-[#b4b4b4] bg-[#b4b4b4]/10 border-[#b4b4b4]/20" },
  marketing: { label: "Marketing", color: "text-pink-400 bg-pink-400/10 border-pink-400/20" },
  trafego_pago: { label: "Tráfego Pago", color: "text-amber-400 bg-amber-400/10 border-amber-400/20" },
  outros: { label: "Outros", color: "text-slate-400 bg-slate-400/10 border-slate-400/20" },
};

const EMPTY_FORM: Partial<NewExpense> = {
  category: "outros", type: "variavel", auto_imported: false,
  date: new Date().toISOString().split("T")[0],
};

interface ModalProps {
  expense?: Expense;
  onClose: () => void;
  onSave: (data: NewExpense) => Promise<{ error: string | null }>;
  clients: Array<{ id: string; name: string }>;
}

function DespesaModal({ expense, onClose, onSave, clients }: ModalProps) {
  useModalOpen(true);
  const [form, setForm] = useState<Partial<NewExpense>>(
    expense ? {
      client_id: expense.client_id, category: expense.category,
      description: expense.description, amount: expense.amount,
      date: expense.date, type: expense.type,
      cost_center: expense.cost_center ?? undefined, notes: expense.notes ?? undefined,
      auto_imported: expense.auto_imported,
    } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof NewExpense, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.date) {
      setError("Descrição, valor e data são obrigatórios");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave(form as NewExpense);
    if (result.error) {
      setError(result.error);
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg rounded-2xl border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "rgba(0,0,0,0.10)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "none" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">{expense ? "Editar Despesa" : "Nova Despesa"}</h2>
          <button onClick={onClose} className="text-[#b4b4b4] hover:text-white transition-colors"><X size={20} /></button>
        </div>

        {error && <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Categoria</label>
            <select value={form.category ?? "outros"} onChange={e => set("category", e.target.value as ExpenseCategory)}
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none"
              style={{ border: "none" }}>
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Tipo</label>
            <select value={form.type ?? "variavel"} onChange={e => set("type", e.target.value as ExpenseType)}
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none"
              style={{ border: "none" }}>
              <option value="fixa">Fixa</option>
              <option value="variavel">Variável</option>
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Descrição *</label>
            <input value={form.description ?? ""} onChange={e => set("description", e.target.value)}
              placeholder="Ex: Pagamento freelancer design"
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none placeholder:text-[#b4b4b4]/50"
              style={{ border: "none" }} />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Valor *</label>
            <MoneyInput value={form.amount ?? 0} onChange={v => set("amount", v)} />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Data *</label>
            <input type="date" value={form.date ?? ""} onChange={e => set("date", e.target.value)}
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none"
              style={{ border: "none" }} />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Cliente vinculado</label>
            <select value={form.client_id ?? ""} onChange={e => set("client_id", e.target.value || null)}
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none"
              style={{ border: "none" }}>
              <option value="">Nenhum</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Centro de Custo</label>
            <input value={form.cost_center ?? ""} onChange={e => set("cost_center", e.target.value || null)}
              placeholder="Ex: Operações"
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none placeholder:text-[#b4b4b4]/50"
              style={{ border: "none" }} />
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Observações</label>
            <textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value || null)}
              rows={2} placeholder="Opcional..."
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none resize-none placeholder:text-[#b4b4b4]/50"
              style={{ border: "none" }} />
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-[#b4b4b4] hover:text-white transition-colors"
            style={{ border: "none" }}>
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

interface Props {
  year: number;
  month: number;
}

export function GestaoDespesas({ year, month }: Props) {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
  const { expenses, isLoading, createExpense, updateExpense, deleteExpense } = useDespesas(
    monthStart, monthEnd
  );
  const { clients } = useAgencyClients();

  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<ExpenseCategory | "todos">("todos");
  const [modal, setModal] = useState<{ open: boolean; expense?: Expense }>({ open: false });
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = expenses.filter(e => {
    const matchSearch = e.description.toLowerCase().includes(search.toLowerCase()) ||
      (e.client as { name?: string } | undefined)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "todos" || e.category === filterCat;
    return matchSearch && matchCat;
  });

  const totalFixa = filtered.filter(e => e.type === "fixa").reduce((s, e) => s + e.amount, 0);
  const totalVariavel = filtered.filter(e => e.type === "variavel").reduce((s, e) => s + e.amount, 0);

  // Totals by category
  const byCategory = Object.entries(CATEGORY_CONFIG).map(([cat, conf]) => ({
    category: cat as ExpenseCategory,
    label: conf.label,
    color: conf.color,
    total: filtered.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total);

  const handleSave = useCallback(async (data: NewExpense): Promise<{ error: string | null }> => {
    const result = modal.expense
      ? await updateExpense(modal.expense.id, data)
      : await createExpense(data);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(modal.expense ? "Despesa atualizada!" : "Despesa criada!");
      setModal({ open: false });
    }
    return result;
  }, [modal.expense, createExpense, updateExpense]);

  const handleDelete = useCallback(async (id: string) => {
    if (deleting === id) { await deleteExpense(id); setDeleting(null); }
    else { setDeleting(id); setTimeout(() => setDeleting(null), 3000); }
  }, [deleting, deleteExpense]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b4b4b4]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar despesa..."
              className="w-full rounded-xl bg-white/5 pl-9 pr-4 py-2.5 text-sm text-white outline-none placeholder:text-[#b4b4b4]/50"
              style={{ border: "none" }} />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b4b4b4]" />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value as ExpenseCategory | "todos")}
              className="rounded-xl bg-white/5 pl-8 pr-3 py-2.5 text-sm text-white outline-none appearance-none"
              style={{ border: "none" }}>
              <option value="todos">Todas</option>
              {Object.entries(CATEGORY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <PrimaryButton onClick={() => setModal({ open: true })} className="flex items-center gap-2 px-4 py-2.5 text-sm shrink-0">
          <Plus size={16} />
          Nova Despesa
        </PrimaryButton>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="lc-card px-5 py-4 flex items-center gap-3">
          <Tag size={18} className="text-[#b4b4b4] shrink-0" />
          <div>
            <p className="text-xs text-[#b4b4b4]">Despesas Fixas</p>
            <p className="text-lg font-bold text-white">{fmt(totalFixa)}</p>
          </div>
        </div>
        <div className="lc-card px-5 py-4 flex items-center gap-3">
          <Zap size={18} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-xs text-[#b4b4b4]">Despesas Variáveis</p>
            <p className="text-lg font-bold text-white">{fmt(totalVariavel)}</p>
          </div>
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="lc-card p-5">
          <p className="text-xs text-[#b4b4b4] font-medium mb-3 uppercase tracking-wider">Por Categoria</p>
          <div className="flex flex-wrap gap-2">
            {byCategory.map(c => (
              <span key={c.category}
                className={cn("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border", c.color)}>
                {c.label} · {fmt(c.total)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="lc-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-[#b4b4b4] text-sm">Carregando despesas...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[#b4b4b4] text-sm mb-3">Nenhuma despesa encontrada</p>
            <button onClick={() => setModal({ open: true })} className="text-[#4a8fd4] text-sm hover:underline">
              Adicionar primeira despesa
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ border: "none" }}>
                  {["Categoria", "Descrição", "Valor", "Data", "Tipo", "Cliente", "Centro de Custo", ""].map(h => (
                    <th key={h} className="text-left text-xs text-[#b4b4b4] font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filtered.map((e, i) => {
                    const cc = CATEGORY_CONFIG[e.category];
                    return (
                      <motion.tr key={e.id}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b transition-colors hover:bg-white/[0.02]"
                        style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn("flex items-center gap-1 w-fit text-xs font-medium px-2.5 py-1 rounded-full border", cc.color)}>
                            {e.auto_imported && <Zap size={10} />}
                            {cc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white max-w-[180px] truncate">{e.description}</td>
                        <td className="px-4 py-3 text-red-400 font-semibold whitespace-nowrap">{fmt(e.amount)}</td>
                        <td className="px-4 py-3 text-[#b4b4b4] whitespace-nowrap">
                          {format(parseISO(e.date), "dd/MM/yy", { locale: ptBR })}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full",
                            e.type === "fixa" ? "text-blue-400 bg-blue-400/10" : "text-amber-400 bg-amber-400/10")}>
                            {e.type === "fixa" ? "Fixa" : "Variável"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[#b4b4b4] whitespace-nowrap max-w-[120px] truncate">
                          {(e.client as { name?: string } | undefined)?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-[#b4b4b4] whitespace-nowrap">{e.cost_center ?? "—"}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {!e.auto_imported && (
                              <button onClick={() => setModal({ open: true, expense: e })}
                                className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-colors">
                                <Edit2 size={14} />
                              </button>
                            )}
                            <button onClick={() => handleDelete(e.id)}
                              className={cn("p-1.5 rounded-lg transition-colors",
                                deleting === e.id ? "text-red-400 bg-red-400/10" : "text-[#b4b4b4] hover:text-red-400 hover:bg-red-400/10")}>
                              <Trash2 size={14} />
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
      </div>

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
