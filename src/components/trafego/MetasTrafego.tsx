"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Plus, Edit3, Trash2, X, Users, DollarSign,
  MousePointer, TrendingUp, Zap, BarChart2, CheckCircle2,
} from "lucide-react";
import { useTrafegoMetas } from "@/hooks/useTrafegoMetas";
import { useTrafegoMetrics } from "@/hooks/useTrafegoMetrics";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import type { TrafficMonthlyGoal, NewTrafficMonthlyGoal } from "@/types";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

// ── Progress Bar ──────────────────────────────────────────────────────────────

function ProgressBar({ value, goal, delay = 0 }: { value: number; goal: number; delay?: number }) {
  const pct = goal > 0 ? Math.min(100, (value / goal) * 100) : 0;
  const color =
    pct >= 100 ? "#22c55e" :
    pct >= 70  ? "#4a8fd4" :
    pct >= 40  ? "#f59e0b" :
    "#ef4444";

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <span style={{ color }} className="font-semibold">{fmtPct(pct)}</span>
        <span className="text-[#5d7d9a]">
          {pct >= 100 ? "Meta atingida!" : `Faltam ${goal - value > 0 ? fmtNum(Math.ceil(goal - value)) : 0}`}
        </span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut", delay }}
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}88, ${color})` }}
        />
      </div>
    </div>
  );
}

// ── Goal Modal ────────────────────────────────────────────────────────────────

interface GoalModalProps {
  goal: TrafficMonthlyGoal | null;
  clients: { id: string; name: string }[];
  onSave: (data: NewTrafficMonthlyGoal) => Promise<{ error: string | null }>;
  onClose: () => void;
  year: number;
  month: number;
}

function GoalModal({ goal, clients, onSave, onClose, year, month }: GoalModalProps) {
  useModalOpen(true);
  const [form, setForm] = useState<NewTrafficMonthlyGoal>({
    client_id: goal?.client_id ?? null,
    year,
    month,
    target_leads: goal?.target_leads ?? 0,
    max_cpl: goal?.max_cpl ?? 0,
    target_conversions: goal?.target_conversions ?? 0,
    min_ctr: goal?.min_ctr ?? 0,
    target_roas: goal?.target_roas ?? 0,
    monthly_budget: goal?.monthly_budget ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (key: keyof NewTrafficMonthlyGoal, val: unknown) =>
    setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { error } = await onSave(form);
    setSaving(false);
    if (error) { setErr(error); return; }
    onClose();
  };

  const inputClass = "w-full rounded-lg px-3 py-2 text-sm text-[#d0e8ff] outline-none placeholder-[#3d5a70]";
  const inputStyle = { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(42,82,128,0.4)" };
  const labelClass = "block text-xs font-medium text-[#b4b4b4] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl p-6 z-10"
        style={{ background: "#0d1f33", border: "1px solid rgba(42,82,128,0.55)" }}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-[#4a8fd4]" />
            <h3 className="text-base font-semibold text-[#d0e8ff]">
              {goal ? "Editar Meta" : "Nova Meta de Tráfego"}
            </h3>
          </div>
          <button onClick={onClose} className="text-[#5d7d9a] hover:text-[#aac4d4] transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Cliente</label>
            <select
              className={inputClass}
              style={inputStyle}
              value={form.client_id ?? ""}
              onChange={e => set("client_id", e.target.value || null)}
            >
              <option value="">Meta geral (todos)</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Meta de Leads</label>
              <input
                type="number" min={0} className={inputClass} style={inputStyle}
                value={form.target_leads || ""}
                onChange={e => set("target_leads", Number(e.target.value))}
                placeholder="ex: 50"
              />
            </div>
            <div>
              <label className={labelClass}>CPL Máximo (R$)</label>
              <MoneyInput value={form.max_cpl ?? 0} onChange={v => set("max_cpl", v)} />
            </div>
            <div>
              <label className={labelClass}>Meta de Conversões</label>
              <input
                type="number" min={0} className={inputClass} style={inputStyle}
                value={form.target_conversions || ""}
                onChange={e => set("target_conversions", Number(e.target.value))}
                placeholder="ex: 10"
              />
            </div>
            <div>
              <label className={labelClass}>CTR Mínimo (%)</label>
              <input
                type="number" min={0} step={0.01} className={inputClass} style={inputStyle}
                value={form.min_ctr || ""}
                onChange={e => set("min_ctr", Number(e.target.value))}
                placeholder="ex: 1.5"
              />
            </div>
            <div>
              <label className={labelClass}>Orçamento Mensal (R$)</label>
              <MoneyInput value={form.monthly_budget ?? 0} onChange={v => set("monthly_budget", v)} />
            </div>
            <div>
              <label className={labelClass}>ROAS Alvo</label>
              <input
                type="number" min={0} step={0.1} className={inputClass} style={inputStyle}
                value={form.target_roas || ""}
                onChange={e => set("target_roas", Number(e.target.value))}
                placeholder="ex: 3.5"
              />
            </div>
          </div>

          {err && (
            <p className="text-xs text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{err}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 py-2 rounded-xl text-sm font-medium text-[#b4b4b4] transition-colors"
              style={{ background: "rgba(255,255,255,0.05)", border: "none" }}
            >
              Cancelar
            </button>
            <PrimaryButton type="submit" disabled={saving} className="flex-1 py-2 text-sm">
              {saving ? "Salvando..." : "Salvar Meta"}
            </PrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

// ── Goal Card ─────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: TrafficMonthlyGoal;
  clientName: string;
  actual: {
    leads: number;
    cpl: number;
    conversoes: number;
    ctr: number;
    investimento: number;
  } | null;
  onEdit: () => void;
  onDelete: () => void;
  delay?: number;
}

function GoalCard({ goal, clientName, actual, onEdit, onDelete, delay = 0 }: GoalCardProps) {
  const rows = [
    {
      label: "Leads",
      icon: <Users size={13} />,
      accent: "#22c55e",
      value: actual?.leads ?? 0,
      goal: goal.target_leads,
      fmtVal: fmtNum,
      fmtGoal: fmtNum,
    },
    {
      label: "Orçamento",
      icon: <DollarSign size={13} />,
      accent: "#4a8fd4",
      value: actual?.investimento ?? 0,
      goal: goal.monthly_budget,
      fmtVal: fmtBRL,
      fmtGoal: fmtBRL,
    },
    {
      label: "Conversões",
      icon: <Zap size={13} />,
      accent: "#34d399",
      value: actual?.conversoes ?? 0,
      goal: goal.target_conversions,
      fmtVal: fmtNum,
      fmtGoal: fmtNum,
    },
    {
      label: "CTR",
      icon: <MousePointer size={13} />,
      accent: "#f59e0b",
      value: actual?.ctr ?? 0,
      goal: goal.min_ctr,
      fmtVal: fmtPct,
      fmtGoal: fmtPct,
    },
  ].filter(r => r.goal > 0);

  const cplOk = goal.max_cpl > 0 && actual?.cpl !== undefined
    ? actual.cpl <= goal.max_cpl
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="lc-card rounded-xl p-4"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
            style={{ background: "linear-gradient(135deg, #1a3a5c, #2a5280)" }}
          >
            {clientName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-semibold text-[#d0e8ff]">{clientName}</div>
            {goal.monthly_budget > 0 && (
              <div className="text-[11px] text-[#5d7d9a]">
                Orçamento: {fmtBRL(goal.monthly_budget)}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-[#4a8fd4] transition-colors"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <Edit3 size={13} />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-red-400 transition-colors"
            style={{ background: "rgba(239,68,68,0.08)" }}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* CPL status badge */}
      {cplOk !== null && (
        <div className="mb-3 flex items-center gap-2">
          <span
            className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
            style={cplOk
              ? { background: "rgba(34,197,94,0.15)", color: "#22c55e" }
              : { background: "rgba(239,68,68,0.12)", color: "#ef4444" }
            }
          >
            CPL {actual?.cpl !== undefined ? fmtBRL(actual.cpl) : "—"}
            {" "}/ máx {fmtBRL(goal.max_cpl)}
          </span>
          {cplOk
            ? <CheckCircle2 size={12} className="text-emerald-400" />
            : <TrendingUp size={12} className="text-red-400" />
          }
        </div>
      )}

      {/* Progress bars */}
      <div className="space-y-3">
        {rows.length === 0 && (
          <p className="text-xs text-[#3d5a70] text-center py-2">Sem metas configuradas</p>
        )}
        {rows.map((r, i) => (
          <div key={r.label} className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1" style={{ color: r.accent }}>
                {r.icon} {r.label}
              </span>
              <span className="text-[#b4b4b4]">
                {r.fmtVal(r.value)} / {r.fmtGoal(r.goal)}
              </span>
            </div>
            <ProgressBar value={r.value} goal={r.goal} delay={delay + i * 0.08} />
          </div>
        ))}
      </div>

      {/* ROAS */}
      {goal.target_roas > 0 && (
        <div className="mt-3 flex items-center justify-between text-[11px]">
          <span className="flex items-center gap-1 text-[#a78bfa]">
            <BarChart2 size={12} /> ROAS Alvo
          </span>
          <span className="text-[#b4b4b4]">{goal.target_roas.toFixed(1)}x</span>
        </div>
      )}
    </motion.div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface MetasTrafegoProps {
  year: number;
  month: number;
}

export function MetasTrafego({ year, month }: MetasTrafegoProps) {
  const { goals, isLoading, upsertGoal, deleteGoal } = useTrafegoMetas(year, month);
  const { clientPerformance } = useTrafegoMetrics(year, month);
  const { clients } = useAgencyClients();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TrafficMonthlyGoal | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (g: TrafficMonthlyGoal) => { setEditing(g); setModalOpen(true); };
  const closeModal = () => { setEditing(null); setModalOpen(false); };

  const handleDelete = async (id: string) => {
    await deleteGoal(id);
    setConfirmDelete(null);
  };

  const getActual = (clientId: string | null) => {
    if (!clientId) return null;
    const perf = clientPerformance.find(p => p.client.id === clientId);
    if (!perf) return null;
    return {
      leads: perf.leads,
      cpl: perf.cpl,
      conversoes: perf.conversoes,
      ctr: perf.ctr,
      investimento: perf.investimento,
    };
  };

  const getClientName = (clientId: string | null) => {
    if (!clientId) return "Geral (todos os clientes)";
    return clients.find(c => c.id === clientId)?.name ?? "Cliente";
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="lc-card rounded-xl h-52 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target size={18} className="text-[#4a8fd4]" />
            <h2 className="text-base font-semibold text-[#d0e8ff]">Metas de Tráfego</h2>
            <span
              className="text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.06)", color: "#4a8fd4" }}
            >
              {goals.length} definida{goals.length !== 1 ? "s" : ""}
            </span>
          </div>
          <PrimaryButton onClick={openNew} className="flex items-center gap-2 text-sm px-4 py-2">
            <Plus size={15} /> Nova Meta
          </PrimaryButton>
        </div>

        {/* Cards grid */}
        {goals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.05)", border: "none" }}
            >
              <Target size={28} className="text-[#4a8fd4]" />
            </div>
            <p className="text-[#5d7d9a] text-sm text-center">
              Nenhuma meta definida para este período.
            </p>
            <PrimaryButton onClick={openNew} className="text-sm px-5 py-2">
              Definir primeira meta
            </PrimaryButton>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {goals.map((g, i) => (
              <GoalCard
                key={g.id}
                goal={g}
                clientName={getClientName(g.client_id)}
                actual={getActual(g.client_id)}
                onEdit={() => openEdit(g)}
                onDelete={() => setConfirmDelete(g.id)}
                delay={i * 0.04}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modalOpen && (
          <GoalModal
            key="goal-modal"
            goal={editing}
            clients={clients.filter(c => c.status === "ativo")}
            onSave={upsertGoal}
            onClose={closeModal}
            year={year}
            month={month}
          />
        )}

        {confirmDelete && (
          <div key="confirm-delete" className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              className="relative rounded-2xl p-6 w-full max-w-sm z-10 text-center"
              style={{ background: "#0d1f33", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              <Trash2 size={28} className="text-red-400 mx-auto mb-3" />
              <p className="text-[#d0e8ff] font-medium mb-1">Excluir meta?</p>
              <p className="text-sm text-[#5d7d9a] mb-5">Esta ação não pode ser desfeita.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2 rounded-xl text-sm text-[#b4b4b4]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "none" }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete)}
                  className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
                  style={{ background: "linear-gradient(135deg, #7f1d1d, #b91c1c)" }}
                >
                  Excluir
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
