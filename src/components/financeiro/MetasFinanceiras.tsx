"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Edit3, X, TrendingUp, DollarSign, Users, BarChart2, Activity } from "lucide-react";
import { toast } from "sonner";
import { useMetas } from "@/hooks/useMetas";
import { useFinanceiroDashboard } from "@/hooks/useFinanceiroDashboard";
import type { NewFinancialGoal } from "@/types";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

interface ProgressBarProps {
  value: number;
  goal: number;
  color: string;
}

function ProgressBar({ value, goal, color }: ProgressBarProps) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const statusColor = pct >= 100 ? "#22c55e" : pct >= 70 ? color : pct >= 40 ? "#f59e0b" : "#ef4444";
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: statusColor }} className="font-semibold">{pct.toFixed(1)}%</span>
        <span className="text-[#b4b4b4]">{pct >= 100 ? "Meta atingida!" : `Faltam ${fmt(Math.max(0, goal - value))}`}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${statusColor}aa, ${statusColor})` }}
        />
      </div>
    </div>
  );
}

interface GoalCardProps {
  title: string;
  icon: React.ReactNode;
  accent: string;
  current: number;
  goal: number;
  isCurrency?: boolean;
  isPercent?: boolean;
  isCount?: boolean;
  delay?: number;
}

function GoalCard({ title, icon, accent, current, goal, isPercent, isCount, delay = 0 }: GoalCardProps) {
  const fmt2 = (v: number) => {
    if (isPercent) return `${v.toFixed(1)}%`;
    if (isCount) return String(Math.round(v));
    return fmt(v);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="lc-card p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ color: "#ffffff" }}>
            {icon}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "#b4b4b4" }}>{title}</p>
            <p className="text-xl font-bold text-white mt-0.5">{fmt2(current)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#b4b4b4]">Meta</p>
          <p className="text-sm font-semibold text-white/60">{fmt2(goal)}</p>
        </div>
      </div>
      <ProgressBar value={current} goal={goal} color={accent} />
    </motion.div>
  );
}

interface MetaModalProps {
  current: Partial<NewFinancialGoal>;
  onClose: () => void;
  onSave: (data: NewFinancialGoal) => Promise<{ error: string | null }>;
  year: number;
  month: number;
}

function MetaModal({ current, onClose, onSave, year, month }: MetaModalProps) {
  useModalOpen(true);
  const [form, setForm] = useState<Partial<NewFinancialGoal>>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof NewFinancialGoal, v: number) => setForm(f => ({ ...f, [k]: v }));

  const monthName = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const result = await onSave({ ...form, year, month } as NewFinancialGoal);
    if (result.error) {
      setError(result.error);
      setSaving(false);
    }
    // on success parent closes the modal
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/[0.03] backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="lc-modal-panel relative w-full max-w-md rounded-2xl p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-2">
          <div>
            <h2 className="text-lg font-bold text-white">Metas Financeiras</h2>
            <p className="text-xs text-[#b4b4b4] capitalize">{monthName}</p>
          </div>
          <button onClick={onClose} className="text-[#b4b4b4] hover:text-white transition-colors"><X size={20} /></button>
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-xl px-4 py-2">{error}</div>
        )}

        <div className="space-y-3">
          {([
            { key: "revenue_goal", label: "Meta de Faturamento (R$)" },
            { key: "profit_goal", label: "Meta de Lucro (R$)" },
            { key: "mrr_goal", label: "Meta de MRR (R$)" },
          ] as const).map(f => (
            <div key={f.key}>
              <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">{f.label}</label>
              <MoneyInput value={form[f.key] ?? 0} onChange={v => set(f.key, v)} />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Meta de Novos Contratos</label>
              <input type="number" value={form.new_contracts_goal ?? ""}
                onChange={e => set("new_contracts_goal", parseInt(e.target.value) || 0)}
                placeholder="Ex: 3"
                className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none placeholder:text-[#b4b4b4]/50"
                style={{ border: "none" }} />
            </div>
            <div>
              <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Meta de Margem (%)</label>
              <input type="number" value={form.margin_goal ?? ""}
                onChange={e => set("margin_goal", parseFloat(e.target.value) || 0)}
                placeholder="Ex: 40"
                className="w-full rounded-xl bg-white/5 border text-white text-sm px-3 py-2.5 outline-none placeholder:text-[#b4b4b4]/50"
                style={{ border: "none" }} />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl border py-2.5 text-sm font-medium text-[#b4b4b4] hover:text-white"
            style={{ border: "none" }}>
            Cancelar
          </button>
          <PrimaryButton onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm">
            {saving ? "Salvando..." : "Salvar Metas"}
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

export function MetasFinanceiras({ year, month }: Props) {
  const { goal, isLoading, saveGoal } = useMetas(year, month);
  const { data } = useFinanceiroDashboard(year, month);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSaveMeta = useCallback(async (data: NewFinancialGoal): Promise<{ error: string | null }> => {
    const result = await saveGoal(data);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Metas salvas!");
      setModalOpen(false);
    }
    return result;
  }, [saveGoal]);

  const monthName = new Date(year, month - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  const goalData: Partial<NewFinancialGoal> = goal ?? {
    revenue_goal: 0, profit_goal: 0, mrr_goal: 0,
    new_contracts_goal: 0, margin_goal: 0,
  };

  const cards: GoalCardProps[] = [
    {
      title: "Faturamento",
      icon: <DollarSign size={18} />,
      accent: "#10b981",
      current: data?.faturamento ?? 0,
      goal: goalData.revenue_goal ?? 0,
      isCurrency: true,
    },
    {
      title: "Lucro",
      icon: <TrendingUp size={18} />,
      accent: "#b4b4b4",
      current: data?.lucro_liquido ?? 0,
      goal: goalData.profit_goal ?? 0,
      isCurrency: true,
    },
    {
      title: "MRR",
      icon: <Activity size={18} />,
      accent: "#4a8fd4",
      current: data?.mrr ?? 0,
      goal: goalData.mrr_goal ?? 0,
      isCurrency: true,
    },
    {
      title: "Novos Contratos",
      icon: <Users size={18} />,
      accent: "#a78bfa",
      current: data?.novos_contratos ?? 0,
      goal: goalData.new_contracts_goal ?? 0,
      isCount: true,
    },
    {
      title: "Margem da Operação",
      icon: <BarChart2 size={18} />,
      accent: "#f59e0b",
      current: data?.margem_geral ?? 0,
      goal: goalData.margin_goal ?? 0,
      isPercent: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="lc-card p-6 h-36 animate-pulse">
            <div className="w-10 h-10 rounded-xl bg-white/5 mb-4" />
            <div className="h-3 bg-white/5 rounded w-1/2 mb-2" />
            <div className="h-2 bg-white/5 rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-semibold">Metas de {monthName}</h3>
          <p className="text-xs text-[#b4b4b4] mt-0.5">
            {goal ? "Progresso em relação às metas definidas" : "Nenhuma meta definida para este mês"}
          </p>
        </div>
        <PrimaryButton onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2.5 text-sm">
          <Edit3 size={15} />
          {goal ? "Editar Metas" : "Definir Metas"}
        </PrimaryButton>
      </div>

      {!goal ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="lc-card p-16 text-center"
        >
          <Target size={40} className="text-[#b4b4b4]/30 mx-auto mb-4" />
          <p className="text-white font-semibold mb-2">Defina suas metas financeiras</p>
          <p className="text-[#b4b4b4] text-sm mb-6 max-w-xs mx-auto">
            Configure metas mensais para acompanhar o desempenho e tomar decisões estratégicas
          </p>
          <PrimaryButton onClick={() => setModalOpen(true)} className="px-6 py-2.5 text-sm">
            Criar Metas do Mês
          </PrimaryButton>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((c, i) => (
            <GoalCard key={c.title} {...c} delay={i * 0.07} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <MetaModal
            current={goalData}
            onClose={() => setModalOpen(false)}
            onSave={handleSaveMeta}
            year={year}
            month={month}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
