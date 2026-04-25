"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, CheckCircle2, Clock, AlertTriangle, XCircle, Search, Filter, X, Edit2, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { useReceitas } from "@/hooks/useReceitas";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { cn } from "@/lib/utils";
import type { Revenue, NewRevenue, RevenueStatus, RevenueType, PaymentMethod } from "@/types";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const STATUS_CONFIG: Record<RevenueStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pago: { label: "Pago", color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: <CheckCircle2 size={12} /> },
  pendente: { label: "Pendente", color: "text-[#b4b4b4] bg-[#b4b4b4]/10 border-[#b4b4b4]/20", icon: <Clock size={12} /> },
  atrasado: { label: "Atrasado", color: "text-amber-400 bg-amber-400/10 border-amber-400/20", icon: <AlertTriangle size={12} /> },
  cancelado: { label: "Cancelado", color: "text-red-400 bg-red-400/10 border-red-400/20", icon: <XCircle size={12} /> },
};

const TYPE_LABELS: Record<RevenueType, string> = {
  mensalidade: "Mensalidade", setup: "Setup", extra: "Extra",
  consultoria: "Consultoria", outro: "Outro",
};

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  pix: "PIX", boleto: "Boleto", cartao: "Cartão", ted: "TED", dinheiro: "Dinheiro", outro: "Outro",
};

const EMPTY_FORM: Partial<NewRevenue> = {
  type: "mensalidade", status: "pendente", payment_method: "pix",
  is_recurring: false, date: new Date().toISOString().split("T")[0],
};

interface ModalProps {
  revenue?: Revenue;
  onClose: () => void;
  onSave: (data: NewRevenue) => Promise<{ error: string | null }>;
  clients: Array<{ id: string; name: string }>;
}

function ReceitaModal({ revenue, onClose, onSave, clients }: ModalProps) {
  useModalOpen(true);
  const [form, setForm] = useState<Partial<NewRevenue>>(
    revenue ? {
      client_id: revenue.client_id, type: revenue.type, description: revenue.description,
      amount: revenue.amount, date: revenue.date, due_date: revenue.due_date ?? undefined,
      payment_method: revenue.payment_method, status: revenue.status,
      is_recurring: revenue.is_recurring, notes: revenue.notes ?? undefined,
    } : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: keyof NewRevenue, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.description || !form.amount || !form.date) {
      setError("Descrição, valor e data são obrigatórios");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await onSave(form as NewRevenue);
    if (result.error) {
      setError(result.error);
      setSaving(false);
    }
    // on success the parent closes the modal — no setSaving needed
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-lg rounded-2xl border shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        style={{ background: "rgba(0,0,0,0.10)", backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)", border: "none" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-white">{revenue ? "Editar Receita" : "Nova Receita"}</h2>
          <button onClick={onClose} className="text-[#b4b4b4] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Cliente</label>
            <select value={form.client_id ?? ""} onChange={e => set("client_id", e.target.value || null)}
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none transition-colors"
              style={{ border: "none" }}>
              <option value="">Sem cliente vinculado</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Descrição *</label>
            <input value={form.description ?? ""} onChange={e => set("description", e.target.value)}
              placeholder="Ex: Mensalidade Janeiro — Imobiliária X"
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none transition-colors placeholder:text-[#b4b4b4]/50"
              style={{ border: "none" }} />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Valor *</label>
            <MoneyInput value={form.amount ?? 0} onChange={v => set("amount", v)} />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Tipo</label>
            <select value={form.type ?? "mensalidade"} onChange={e => set("type", e.target.value as RevenueType)}
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none transition-colors"
              style={{ border: "none" }}>
              {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Data *</label>
            <input type="date" value={form.date ?? ""} onChange={e => set("date", e.target.value)}
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none transition-colors"
              style={{ border: "none" }} />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Vencimento</label>
            <input type="date" value={form.due_date ?? ""} onChange={e => set("due_date", e.target.value || null)}
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none transition-colors"
              style={{ border: "none" }} />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Forma de Pagamento</label>
            <select value={form.payment_method ?? "pix"} onChange={e => set("payment_method", e.target.value as PaymentMethod)}
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none transition-colors"
              style={{ border: "none" }}>
              {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Status</label>
            <select value={form.status ?? "pendente"} onChange={e => set("status", e.target.value as RevenueStatus)}
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none transition-colors"
              style={{ border: "none" }}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Observações</label>
            <textarea value={form.notes ?? ""} onChange={e => set("notes", e.target.value || null)}
              rows={2} placeholder="Opcional..."
              className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none transition-colors placeholder:text-[#b4b4b4]/50 resize-none"
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
            {saving ? "Salvando..." : revenue ? "Salvar Alterações" : "Criar Receita"}
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

export function GestaoReceitas({ year, month }: Props) {
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
  const { revenues, isLoading, createRevenue, updateRevenue, deleteRevenue, markAsPaid } = useReceitas(
    monthStart, monthEnd
  );
  const { clients } = useAgencyClients();

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<RevenueStatus | "todos">("todos");
  const [modal, setModal] = useState<{ open: boolean; revenue?: Revenue }>({ open: false });
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = revenues.filter(r => {
    const matchSearch = r.description.toLowerCase().includes(search.toLowerCase()) ||
      (r.client as { name?: string } | undefined)?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "todos" || r.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const totalPago = filtered.filter(r => r.status === "pago").reduce((s, r) => s + r.amount, 0);
  const totalPendente = filtered.filter(r => r.status !== "pago" && r.status !== "cancelado").reduce((s, r) => s + r.amount, 0);

  const handleSave = useCallback(async (data: NewRevenue): Promise<{ error: string | null }> => {
    const result = modal.revenue
      ? await updateRevenue(modal.revenue.id, data)
      : await createRevenue(data);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(modal.revenue ? "Receita atualizada!" : "Receita criada!");
      setModal({ open: false });
    }
    return result;
  }, [modal.revenue, createRevenue, updateRevenue]);

  const handleDelete = useCallback(async (id: string) => {
    if (deleting === id) {
      await deleteRevenue(id);
      setDeleting(null);
    } else {
      setDeleting(id);
      setTimeout(() => setDeleting(null), 3000);
    }
  }, [deleting, deleteRevenue]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-72">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b4b4b4]" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar receita ou cliente..."
              className="w-full rounded-xl bg-white/5 border pl-9 pr-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-[#b4b4b4]/50"
              style={{ border: "none" }} />
          </div>
          <div className="relative">
            <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b4b4b4]" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as RevenueStatus | "todos")}
              className="rounded-xl bg-white/5 border pl-8 pr-3 py-2.5 text-sm text-white outline-none appearance-none"
              style={{ border: "none" }}>
              <option value="todos">Todos</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>
        <PrimaryButton onClick={() => setModal({ open: true })} className="flex items-center gap-2 px-4 py-2.5 text-sm shrink-0">
          <Plus size={16} />
          Nova Receita
        </PrimaryButton>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-2 gap-3">
        <div className="lc-card px-5 py-4 flex items-center gap-3">
          <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs text-[#b4b4b4]">Total Recebido</p>
            <p className="text-lg font-bold text-emerald-400">{fmt(totalPago)}</p>
          </div>
        </div>
        <div className="lc-card px-5 py-4 flex items-center gap-3">
          <Clock size={18} className="text-amber-400 shrink-0" />
          <div>
            <p className="text-xs text-[#b4b4b4]">A Receber</p>
            <p className="text-lg font-bold text-amber-400">{fmt(totalPendente)}</p>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="lc-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-[#b4b4b4] text-sm">Carregando receitas...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-[#b4b4b4] text-sm mb-3">Nenhuma receita encontrada</p>
            <button onClick={() => setModal({ open: true })}
              className="text-[#4a8fd4] text-sm hover:underline">
              Adicionar primeira receita
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ border: "none" }}>
                  {["Cliente", "Descrição", "Tipo", "Valor", "Vencimento", "Pagamento", "Status", ""].map(h => (
                    <th key={h} className="text-left text-xs text-[#b4b4b4] font-medium px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {filtered.map((r, i) => {
                    const sc = STATUS_CONFIG[r.status];
                    return (
                      <motion.tr key={r.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b transition-colors hover:bg-white/[0.02]"
                        style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                        <td className="px-4 py-3 text-[#c7e5ff] font-medium whitespace-nowrap max-w-[140px] truncate">
                          {(r.client as { name?: string } | undefined)?.name ?? <span className="text-[#b4b4b4] text-xs italic">Sem cliente</span>}
                        </td>
                        <td className="px-4 py-3 text-white max-w-[180px] truncate">{r.description}</td>
                        <td className="px-4 py-3 text-[#b4b4b4] whitespace-nowrap">{TYPE_LABELS[r.type]}</td>
                        <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{fmt(r.amount)}</td>
                        <td className="px-4 py-3 text-[#b4b4b4] whitespace-nowrap">
                          {r.due_date ? format(parseISO(r.due_date), "dd/MM/yy", { locale: ptBR }) : "—"}
                        </td>
                        <td className="px-4 py-3 text-[#b4b4b4] whitespace-nowrap">{PAYMENT_LABELS[r.payment_method]}</td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={cn("flex items-center gap-1 w-fit text-xs font-medium px-2.5 py-1 rounded-full border", sc.color)}>
                            {sc.icon}{sc.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {r.status !== "pago" && (
                              <button onClick={() => markAsPaid(r.id, new Date().toISOString().split("T")[0])}
                                className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-400/10 transition-colors" title="Marcar como pago">
                                <Check size={14} />
                              </button>
                            )}
                            <button onClick={() => setModal({ open: true, revenue: r })}
                              className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-colors">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDelete(r.id)}
                              className={cn("p-1.5 rounded-lg transition-colors",
                                deleting === r.id ? "text-red-400 bg-red-400/10" : "text-[#b4b4b4] hover:text-red-400 hover:bg-red-400/10")}>
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
