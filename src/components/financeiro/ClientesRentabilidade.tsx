"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Plus, TrendingUp, TrendingDown, Users, DollarSign,
  X, Edit2, Trash2, ChevronDown, ChevronUp, Building2,
  AlertTriangle, Percent,
} from "lucide-react";
import { toast } from "sonner";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { useFinanceiroDashboard } from "@/hooks/useFinanceiroDashboard";
import { useClientCostShares, type CostShareDraft } from "@/hooks/useClientCostShares";
import { cn } from "@/lib/utils";
import type { AgencyClient, NewAgencyClient, UpdateAgencyClient, ClientStatus, CompanyType } from "@/types";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const STATUS_CONFIG: Record<ClientStatus, { label: string; color: string }> = {
  ativo:    { label: "Ativo",    color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20" },
  inativo:  { label: "Inativo",  color: "text-[#b4b4b4] bg-[#b4b4b4]/10 border-[#b4b4b4]/20" },
  churned:  { label: "Churned",  color: "text-red-400 bg-red-400/10 border-red-400/20" },
};

const COMPANY_LABELS: Record<CompanyType, string> = {
  imobiliaria: "Imobiliária", construtora: "Construtora",
  corretor: "Corretor", outro: "Outro",
};

const EMPTY_FORM: Partial<NewAgencyClient> = {
  company_type: "imobiliaria", status: "ativo",
  monthly_fee: 0, payment_day: 10,
};

// ── ClienteModal ──────────────────────────────────────────────────────────────

interface ClientModalProps {
  client?: AgencyClient;
  onClose: () => void;
  onSave: (data: NewAgencyClient | UpdateAgencyClient, shares: CostShareDraft[]) => Promise<{ error: string | null }>;
  onDelete?: () => Promise<void>;
}

function ClienteModal({ client, onClose, onSave, onDelete }: ClientModalProps) {
  useModalOpen(true);

  const { getByClientId } = useClientCostShares();

  const [form, setForm] = useState<Partial<NewAgencyClient>>(
    client ? {
      name: client.name, company_type: client.company_type, status: client.status,
      monthly_fee: client.monthly_fee, contract_start: client.contract_start ?? undefined,
      contract_end: client.contract_end ?? undefined, payment_day: client.payment_day,
      contact_name: client.contact_name ?? undefined, contact_email: client.contact_email ?? undefined,
      contact_phone: client.contact_phone ?? undefined, notes: client.notes ?? undefined,
    } : EMPTY_FORM
  );

  const [shares, setShares] = useState<CostShareDraft[]>([]);
  const [saving, setSaving]   = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // Load existing shares when editing
  useEffect(() => {
    if (client) {
      getByClientId(client.id).then(data =>
        setShares(data.map(s => ({ name: s.name, percentage: s.percentage })))
      );
    }
  }, [client?.id, getByClientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k: keyof NewAgencyClient, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  // Share list helpers
  const addShare    = () => setShares(prev => [...prev, { name: "", percentage: 0 }]);
  const removeShare = (i: number) => setShares(prev => prev.filter((_, idx) => idx !== i));
  const setShare    = (i: number, key: keyof CostShareDraft, value: string | number) =>
    setShares(prev => prev.map((s, idx) => idx === i ? { ...s, [key]: value } : s));

  // Real-time preview calculations
  const fee             = Number(form.monthly_fee ?? 0);
  const totalSharesAmt  = shares.reduce((s, sh) => s + (fee * sh.percentage / 100), 0);
  const totalPct        = shares.reduce((s, sh) => s + sh.percentage, 0);
  const previewLucro    = fee - totalSharesAmt;
  const previewMargem   = fee > 0 ? (previewLucro / fee) * 100 : 0;

  const handleSave = async () => {
    if (!form.name) { setError("Nome do cliente é obrigatório"); return; }
    const invalidPct = shares.some(s => s.percentage < 0 || s.percentage > 100);
    if (invalidPct) { setError("Cada percentual deve estar entre 0% e 100%"); return; }
    setSaving(true);
    setError(null);
    const result = await onSave(form as NewAgencyClient, shares.filter(s => s.name.trim() !== ""));
    if (result.error) {
      setError(result.error);
      setSaving(false);
    }
  };

  const inputCls = "w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none placeholder:text-[#b4b4b4]/50 focus:bg-white/[0.07] transition-colors";
  const selectCls = "w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none focus:bg-white/[0.07] transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-2xl rounded-2xl shadow-2xl p-6 max-h-[92vh] overflow-y-auto"
        style={{
          background: "rgba(10,14,20,0.97)",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">{client ? "Editar Cliente" : "Novo Cliente"}</h2>
            <p className="text-xs text-[#5a5a5a] mt-0.5">Preencha os dados do cliente e os custos vinculados</p>
          </div>
          <button onClick={onClose} className="text-[#b4b4b4] hover:text-white transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2.5 mb-4">
            <AlertTriangle size={14} className="shrink-0" />
            {error}
          </div>
        )}

        {/* ── Basic info ─────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Nome da Empresa *</label>
            <input
              value={form.name ?? ""} onChange={e => set("name", e.target.value)}
              placeholder="Ex: Imobiliária Premium SP"
              className={inputCls}
              style={{ border: "none" }}
            />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Tipo</label>
            <select
              value={form.company_type ?? "imobiliaria"} onChange={e => set("company_type", e.target.value as CompanyType)}
              className={selectCls} style={{ border: "none" }}>
              {Object.entries(COMPANY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Status</label>
            <select
              value={form.status ?? "ativo"} onChange={e => set("status", e.target.value as ClientStatus)}
              className={selectCls} style={{ border: "none" }}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Mensalidade (R$)</label>
            <MoneyInput value={form.monthly_fee ?? 0} onChange={v => set("monthly_fee", v)} />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Dia de Vencimento</label>
            <input
              type="number" min={1} max={31} value={form.payment_day ?? 10}
              onChange={e => set("payment_day", parseInt(e.target.value))}
              className={inputCls} style={{ border: "none" }}
            />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Início do Contrato</label>
            <input
              type="date" value={form.contract_start ?? ""}
              onChange={e => set("contract_start", e.target.value || null)}
              className={inputCls} style={{ border: "none" }}
            />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Fim do Contrato</label>
            <input
              type="date" value={form.contract_end ?? ""}
              onChange={e => set("contract_end", e.target.value || null)}
              className={inputCls} style={{ border: "none" }}
            />
          </div>

          {/* Contact */}
          <div className="col-span-2 mt-1">
            <p className="text-xs text-[#b4b4b4] font-medium uppercase tracking-wider mb-3">Contato</p>
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Nome do Contato</label>
            <input
              value={form.contact_name ?? ""} onChange={e => set("contact_name", e.target.value || null)}
              placeholder="Ex: João Silva"
              className={inputCls} style={{ border: "none" }}
            />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">WhatsApp</label>
            <input
              value={form.contact_phone ?? ""} onChange={e => set("contact_phone", e.target.value || null)}
              placeholder="(11) 99999-9999"
              className={inputCls} style={{ border: "none" }}
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">E-mail</label>
            <input
              value={form.contact_email ?? ""} onChange={e => set("contact_email", e.target.value || null)}
              placeholder="contato@empresa.com"
              className={inputCls} style={{ border: "none" }}
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Observações</label>
            <textarea
              value={form.notes ?? ""} onChange={e => set("notes", e.target.value || null)}
              rows={2} placeholder="Notas internas..."
              className={cn(inputCls, "resize-none")} style={{ border: "none" }}
            />
          </div>
        </div>

        {/* ── Custos Variáveis / Parceiros ───────────────────────────────────── */}
        <div className="mt-5 pt-5" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.25)" }}>
              <Percent size={12} style={{ color: "#a78bfa" }} />
            </div>
            <p className="text-sm font-semibold text-white">Custos Variáveis / Parceiros</p>
          </div>
          <p className="text-[11px] text-[#5a5a5a] mb-4 ml-8">
            Defina percentuais da mensalidade destinados a parceiros ou comissões.
          </p>

          {/* Share rows */}
          <AnimatePresence initial={false}>
            {shares.map((share, i) => {
              const calc = (fee * share.percentage) / 100;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-2 mb-2"
                >
                  <input
                    value={share.name}
                    onChange={e => setShare(i, "name", e.target.value)}
                    placeholder="Ex: Sócio, Gestora de Performance..."
                    className="flex-1 rounded-xl bg-white/5 text-white text-sm px-3 py-2 outline-none placeholder:text-[#b4b4b4]/40 focus:bg-white/[0.07] transition-colors"
                    style={{ border: "none" }}
                  />
                  {/* Percentage input */}
                  <div className="relative w-24 shrink-0">
                    <input
                      type="number" min={0} max={100} step={0.5}
                      value={share.percentage}
                      onChange={e => setShare(i, "percentage", Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                      className="w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2 outline-none pr-7 focus:bg-white/[0.07] transition-colors"
                      style={{ border: "none" }}
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#b4b4b4] text-xs pointer-events-none">%</span>
                  </div>
                  {/* Calculated value */}
                  <div className="w-24 shrink-0 text-right">
                    <span className={cn(
                      "text-sm font-semibold",
                      fee > 0 && share.percentage > 0 ? "text-amber-400" : "text-[#5a5a5a]"
                    )}>
                      {fmt(calc)}
                    </span>
                  </div>
                  <button
                    onClick={() => removeShare(i)}
                    className="p-1.5 rounded-lg text-[#5a5a5a] hover:text-red-400 transition-colors shrink-0"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {/* Warning if total > 100% */}
          <AnimatePresence>
            {totalPct > 100 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                className="flex items-center gap-2 text-amber-400 text-xs bg-amber-400/10 border border-amber-400/20 rounded-xl px-3 py-2 mb-3"
              >
                <AlertTriangle size={12} />
                Soma dos percentuais ({totalPct.toFixed(1)}%) ultrapassa 100%
              </motion.div>
            )}
          </AnimatePresence>

          {/* Add partner button */}
          <button
            onClick={addShare}
            className="flex items-center gap-1.5 text-sm text-[#4a8fd4] hover:text-white transition-colors py-1 mt-1"
          >
            <Plus size={14} />
            Adicionar parceiro
          </button>
        </div>

        {/* ── Financial preview ──────────────────────────────────────────────── */}
        <AnimatePresence>
          {fee > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-4 rounded-xl p-4"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-[10px] text-[#5a5a5a] font-medium uppercase tracking-wider mb-3">Prévia financeira</p>
              <div className="grid grid-cols-4 gap-3 text-center">
                <div>
                  <p className="text-[10px] text-[#5a5a5a] mb-1">Receita</p>
                  <p className="text-sm font-bold text-white">{fmt(fee)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#5a5a5a] mb-1">Custos</p>
                  <p className={cn("text-sm font-bold", totalSharesAmt > 0 ? "text-red-400" : "text-[#b4b4b4]")}>
                    {fmt(totalSharesAmt)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#5a5a5a] mb-1">Lucro</p>
                  <p className={cn("text-sm font-bold", previewLucro >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {fmt(previewLucro)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-[#5a5a5a] mb-1">Margem</p>
                  <p className={cn("text-sm font-bold",
                    previewMargem >= 30 ? "text-emerald-400" : previewMargem >= 0 ? "text-amber-400" : "text-red-400"
                  )}>
                    {previewMargem.toFixed(1)}%
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer buttons */}
        <div className="flex gap-3 pt-5 mt-2">
          {client && onDelete && (
            <button
              onClick={confirmDelete ? onDelete : () => setConfirmDelete(true)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
                confirmDelete
                  ? "text-red-400 bg-red-400/10 border-red-400/30"
                  : "text-[#b4b4b4] border-white/10 hover:border-red-400/30 hover:text-red-400"
              )}
            >
              {confirmDelete ? "Confirmar Exclusão" : "Excluir"}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-[#b4b4b4] hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            Cancelar
          </button>
          <PrimaryButton onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm">
            {saving ? "Salvando..." : client ? "Salvar" : "Criar Cliente"}
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
}

// ── ClientesRentabilidade ─────────────────────────────────────────────────────

type SortKey = "lucro" | "margem" | "mensalidade" | "custo_total" | "tempo_contrato_meses";

interface Props {
  year: number;
  month: number;
}

export function ClientesRentabilidade({ year, month }: Props) {
  const { clients, createClient, updateClient, deleteClient } = useAgencyClients();
  const { data, clientProfitability, isLoading, refetch: refetchDashboard } = useFinanceiroDashboard(year, month);
  const { saveShares } = useClientCostShares();
  const [modal, setModal]   = useState<{ open: boolean; client?: AgencyClient }>({ open: false });
  const [sortKey, setSortKey] = useState<SortKey>("lucro");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const mrr            = data?.mrr ?? 0;
  const clientesAtivos = data?.clientes_ativos ?? 0;

  // Lucro e margem derivados de clientProfitability (base: monthly_fee) para consistência com a tabela
  const lucroTotal  = clientProfitability.reduce((s, p) => s + p.lucro, 0);
  const margemGeral = mrr > 0 ? (lucroTotal / mrr) * 100 : 0;

  const sorted = [...clientProfitability].sort((a, b) =>
    sortDir === "desc" ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]
  );

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? (sortDir === "desc" ? <ChevronDown size={12} /> : <ChevronUp size={12} />) : null;

  const handleSave = useCallback(async (
    clientData: NewAgencyClient | UpdateAgencyClient,
    shares: CostShareDraft[],
  ): Promise<{ error: string | null }> => {
    if (modal.client) {
      // Edit flow
      const result = await updateClient(modal.client.id, clientData as UpdateAgencyClient);
      if (result.error) { toast.error(result.error); return result; }
      const sharesResult = await saveShares(modal.client.id, shares);
      if (sharesResult.error) { toast.error(`Erro ao salvar parceiros: ${sharesResult.error}`); return sharesResult; }
    } else {
      // Create flow — need the new id to save shares
      const result = await createClient(clientData as NewAgencyClient);
      if (result.error) { toast.error(result.error); return result; }
      if (result.id) {
        const sharesResult = await saveShares(result.id, shares);
        if (sharesResult.error) { toast.error(`Cliente criado, mas erro ao salvar parceiros: ${sharesResult.error}`); }
      }
    }
    toast.success(modal.client ? "Cliente atualizado!" : "Cliente criado!");
    setModal({ open: false });
    refetchDashboard();
    return { error: null };
  }, [modal.client, createClient, updateClient, saveShares, refetchDashboard]);

  const handleDelete = useCallback(async () => {
    if (modal.client) {
      await deleteClient(modal.client.id);
      setModal({ open: false });
      refetchDashboard();
    }
  }, [modal.client, deleteClient, refetchDashboard]);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Clientes Ativos",  value: String(clientesAtivos),         icon: <Users size={18} />,        accent: "#4a8fd4" },
          { label: "MRR Total",        value: fmt(mrr),                       icon: <DollarSign size={18} />,   accent: "#10b981" },
          { label: "Lucro Total",      value: fmt(lucroTotal),                icon: <TrendingUp size={18} />,   accent: lucroTotal >= 0 ? "#10b981" : "#ef4444" },
          { label: "Margem Geral",     value: `${margemGeral.toFixed(1)}%`,   icon: <TrendingDown size={18} />, accent: margemGeral >= 30 ? "#10b981" : margemGeral >= 0 ? "#f59e0b" : "#ef4444" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="lc-card px-5 py-4 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${s.accent}22`, border: `1px solid ${s.accent}44`, color: s.accent }}>
              {s.icon}
            </div>
            <div>
              <p className="text-xs text-[#b4b4b4]">{s.label}</p>
              <p className="text-lg font-bold text-white">{s.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="flex justify-between items-center">
        <p className="text-sm text-[#b4b4b4]">{clients.length} clientes cadastrados</p>
        <PrimaryButton onClick={() => setModal({ open: true })} className="flex items-center gap-2 px-4 py-2.5 text-sm">
          <Plus size={16} />
          Novo Cliente
        </PrimaryButton>
      </div>

      {/* Profitability table */}
      <div className="lc-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-[#b4b4b4] text-sm">Carregando...</div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center">
            <Building2 size={40} className="text-[#b4b4b4]/30 mx-auto mb-3" />
            <p className="text-[#b4b4b4] text-sm mb-3">Nenhum cliente ativo este mês</p>
            <button onClick={() => setModal({ open: true })} className="text-[#4a8fd4] text-sm hover:underline">
              Cadastrar primeiro cliente
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <th className="text-left text-xs text-[#b4b4b4] font-medium px-4 py-3">Cliente</th>
                  {([
                    ["mensalidade",         "Mensalidade"],
                    ["custo_total",         "Custos"],
                    ["lucro",               "Lucro"],
                    ["margem",              "Margem"],
                    ["tempo_contrato_meses","Meses"],
                  ] as [SortKey, string][]).map(([k, label]) => (
                    <th key={k}
                      className="text-left text-xs text-[#b4b4b4] font-medium px-4 py-3 whitespace-nowrap cursor-pointer hover:text-white transition-colors select-none"
                      onClick={() => handleSort(k)}>
                      <span className="flex items-center gap-1">{label} <SortIcon k={k} /></span>
                    </th>
                  ))}
                  <th className="text-left text-xs text-[#b4b4b4] font-medium px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p, i) => {
                  const sc = STATUS_CONFIG[p.client.status];
                  const profitColor  = p.lucro > 0 ? "text-emerald-400" : p.lucro < 0 ? "text-red-400" : "text-[#b4b4b4]";
                  const marginColor  = p.margem >= 30 ? "text-emerald-400" : p.margem >= 0 ? "text-amber-400" : "text-red-400";
                  return (
                    <motion.tr key={p.client.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="hover:bg-white/[0.02] transition-colors"
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-white font-medium">{p.client.name}</p>
                          <p className="text-xs text-[#b4b4b4]">{COMPANY_LABELS[p.client.company_type]}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-white font-semibold whitespace-nowrap">{fmt(p.mensalidade)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div>
                          <p className="text-red-400 font-semibold">{fmt(p.custo_total)}</p>
                          {p.custo_parceiros > 0 && (
                            <p className="text-[10px] text-[#5a5a5a]">
                              {fmt(p.custo_parceiros)} parceiros
                            </p>
                          )}
                        </div>
                      </td>
                      <td className={cn("px-4 py-3 font-bold whitespace-nowrap", profitColor)}>{fmt(p.lucro)}</td>
                      <td className={cn("px-4 py-3 font-semibold whitespace-nowrap", marginColor)}>
                        {p.margem.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-[#b4b4b4] whitespace-nowrap">
                        {p.client.contract_start ? `${p.tempo_contrato_meses}m` : "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full border", sc.color)}>
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => setModal({ open: true, client: p.client })}
                          className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-colors">
                          <Edit2 size={14} />
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Non-active clients */}
      {clients.filter(c => c.status !== "ativo").length > 0 && (
        <div className="lc-card p-5">
          <p className="text-xs text-[#b4b4b4] font-medium mb-3 uppercase tracking-wider">Outros Clientes</p>
          <div className="flex flex-wrap gap-2">
            {clients.filter(c => c.status !== "ativo").map(c => {
              const sc = STATUS_CONFIG[c.status];
              return (
                <button key={c.id} onClick={() => setModal({ open: true, client: c })}
                  className={cn("flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full border transition-opacity hover:opacity-80", sc.color)}>
                  {c.name} · {sc.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <AnimatePresence>
        {modal.open && (
          <ClienteModal
            client={modal.client}
            onClose={() => setModal({ open: false })}
            onSave={handleSave}
            onDelete={modal.client ? handleDelete : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
