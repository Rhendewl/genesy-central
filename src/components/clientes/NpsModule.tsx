"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  Plus, X, Star, TrendingUp, TrendingDown, Users,
  MessageSquare, CheckCircle, AlertTriangle, Zap, Info,
  ChevronUp, ChevronDown, Minus, Search, Edit2, Trash2,
  ThumbsUp, ThumbsDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useNps, classifyNps, npsScoreColor, npsScoreLabel,
  type ClientNpsSummary, type NpsInsight,
} from "@/hooks/useNps";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";
import type { NpsRecord, NewNpsRecord, NpsChannel, AgencyClient } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// NpsModule — Satisfação Mensal de Clientes
// ─────────────────────────────────────────────────────────────────────────────

const CHANNEL_LABELS: Record<NpsChannel, string> = {
  manual:     "Manual",
  formulario: "Formulário",
  whatsapp:   "WhatsApp",
  outro:      "Outro",
};

const INSIGHT_CFG: Record<NpsInsight["type"], { icon: React.ReactNode; border: string; bg: string; color: string }> = {
  positive: { icon: <CheckCircle size={14} />, border: "border-emerald-500/25", bg: "bg-emerald-500/8", color: "text-emerald-400" },
  warning:  { icon: <AlertTriangle size={14} />, border: "border-amber-500/25", bg: "bg-amber-500/8", color: "text-amber-400" },
  critical: { icon: <Zap size={14} />, border: "border-red-500/25", bg: "bg-red-500/8", color: "text-red-400" },
  neutral:  { icon: <Info size={14} />, border: "border-white/10", bg: "bg-white/5", color: "text-[#b4b4b4]" },
};

// ── Score display ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const cls = classifyNps(score);
  const config = {
    promotor:  { text: "text-emerald-400 bg-emerald-400/12 border-emerald-400/25" },
    neutro:    { text: "text-amber-400 bg-amber-400/12 border-amber-400/25" },
    detrator:  { text: "text-red-400 bg-red-400/12 border-red-400/25" },
  };
  return (
    <span className={cn(
      "inline-flex items-center justify-center w-9 h-7 rounded-lg text-sm font-bold border",
      config[cls].text
    )}>
      {score}
    </span>
  );
}

function ClassificationBadge({ cls }: { cls: "promotor" | "neutro" | "detrator" | null }) {
  if (!cls) return <span className="text-[#5a5a5a] text-xs">—</span>;
  const cfg = {
    promotor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    neutro:   "text-amber-400 bg-amber-400/10 border-amber-400/20",
    detrator: "text-red-400 bg-red-400/10 border-red-400/20",
  };
  const labels = { promotor: "Promotor", neutro: "Neutro", detrator: "Detrator" };
  return (
    <span className={cn("text-xs font-medium px-2.5 py-0.5 rounded-full border", cfg[cls])}>
      {labels[cls]}
    </span>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-4 py-3 shadow-xl text-xs"
      style={{ background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-[#b4b4b4] mb-2 font-medium capitalize">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[#c7e5ff]">{p.name}:</span>
          <span className="text-white font-semibold">
            {typeof p.value === "number"
              ? p.name === "NPS" ? p.value.toFixed(0) : `${p.value.toFixed(1)}%`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── NPS Modal ─────────────────────────────────────────────────────────────────

interface NpsModalProps {
  clients: AgencyClient[];
  record?: NpsRecord;
  defaultMonth: string; // YYYY-MM
  onClose: () => void;
  onSave: (data: NewNpsRecord) => Promise<{ error: string | null }>;
  onDelete?: () => Promise<void>;
}

function NpsModal({ clients, record, defaultMonth, onClose, onSave, onDelete }: NpsModalProps) {
  useModalOpen(true);

  const [form, setForm] = useState<Partial<NewNpsRecord>>(
    record ? {
      client_id: record.client_id,
      reference_month: record.reference_month,
      score: record.score,
      comment: record.comment ?? undefined,
      channel: record.channel,
      responsible: record.responsible ?? undefined,
    } : {
      reference_month: defaultMonth,
      score: 8,
      channel: "manual",
    }
  );
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof NewNpsRecord>(k: K, v: NewNpsRecord[K]) =>
    setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.client_id) { setError("Selecione um cliente"); return; }
    if (!form.reference_month) { setError("Informe o mês de referência"); return; }
    if (form.score === undefined || form.score === null) { setError("Informe a nota"); return; }
    setSaving(true);
    setError(null);
    const result = await onSave(form as NewNpsRecord);
    if (result.error) { setError(result.error); setSaving(false); }
  };

  const scoreValue = form.score ?? 8;
  const cls = classifyNps(scoreValue);

  const inputCls = "w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none placeholder:text-[#b4b4b4]/50 focus:bg-white/[0.07] transition-colors border-none";
  const selectCls = "w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none focus:bg-white/[0.07] transition-colors border-none";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-lg rounded-2xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{ background: "rgba(10,14,20,0.97)", border: "1px solid rgba(255,255,255,0.08)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-white">{record ? "Editar NPS" : "Registrar NPS"}</h2>
            <p className="text-xs text-[#5a5a5a] mt-0.5">Satisfação mensal do cliente</p>
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

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Cliente *</label>
            <select
              value={form.client_id ?? ""}
              onChange={e => set("client_id", e.target.value)}
              className={selectCls}
            >
              <option value="">Selecionar cliente...</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Mês de referência *</label>
            <input
              type="month"
              value={form.reference_month ?? ""}
              onChange={e => set("reference_month", e.target.value)}
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Canal</label>
            <select
              value={form.channel ?? "manual"}
              onChange={e => set("channel", e.target.value as NpsChannel)}
              className={selectCls}
            >
              {Object.entries(CHANNEL_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Score slider */}
          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-3 font-medium">
              Nota NPS *
              <span className={cn(
                "ml-2 text-sm font-bold",
                cls === "promotor" ? "text-emerald-400" :
                cls === "neutro"   ? "text-amber-400" : "text-red-400"
              )}>
                {scoreValue} — {cls === "promotor" ? "Promotor" : cls === "neutro" ? "Neutro" : "Detrator"}
              </span>
            </label>
            {/* Score buttons 0–10 */}
            <div className="flex gap-1.5 flex-wrap">
              {Array.from({ length: 11 }, (_, i) => {
                const c = classifyNps(i);
                const selected = scoreValue === i;
                return (
                  <button
                    key={i}
                    onClick={() => set("score", i)}
                    className={cn(
                      "w-9 h-9 rounded-xl text-sm font-bold border transition-all",
                      selected
                        ? c === "promotor"
                          ? "bg-emerald-400/20 border-emerald-400/50 text-emerald-400"
                          : c === "neutro"
                          ? "bg-amber-400/20 border-amber-400/50 text-amber-400"
                          : "bg-red-400/20 border-red-400/50 text-red-400"
                        : "bg-white/5 border-white/10 text-[#b4b4b4] hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {i}
                  </button>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-[#5a5a5a] mt-1.5">
              <span>0 — Pior</span>
              <span className="text-red-400/70">Detratores</span>
              <span className="text-amber-400/70">Neutros</span>
              <span className="text-emerald-400/70">Promotores</span>
              <span>10 — Melhor</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Responsável</label>
            <input
              value={form.responsible ?? ""}
              onChange={e => set("responsible", e.target.value || null as unknown as string)}
              placeholder="Nome do responsável"
              className={inputCls}
            />
          </div>

          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Comentário</label>
            <textarea
              value={form.comment ?? ""}
              onChange={e => set("comment", e.target.value || null as unknown as string)}
              rows={2}
              placeholder="Feedback do cliente..."
              className={cn(inputCls, "resize-none")}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-5 mt-2">
          {record && onDelete && (
            <button
              onClick={confirmDelete ? onDelete : () => setConfirmDelete(true)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-sm font-medium transition-all border",
                confirmDelete
                  ? "text-red-400 bg-red-400/10 border-red-400/30"
                  : "text-[#b4b4b4] border-white/10 hover:border-red-400/30 hover:text-red-400"
              )}
            >
              {confirmDelete ? "Confirmar" : "Excluir"}
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
            {saving ? "Salvando..." : record ? "Salvar" : "Registrar"}
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props { year: number; month: number }

export function NpsModule({ year, month }: Props) {
  const { records, clients, isLoading, metrics, createRecord, updateRecord, deleteRecord } = useNps(year, month);
  const [modal, setModal] = useState<{ open: boolean; record?: NpsRecord }>({ open: false });
  const [search, setSearch] = useState("");

  const defaultMonth = `${year}-${String(month).padStart(2, "0")}`;

  const handleSave = useCallback(async (data: NewNpsRecord) => {
    const result = modal.record
      ? await updateRecord(modal.record.id, data)
      : await createRecord(data);
    if (!result.error) {
      toast.success(modal.record ? "NPS atualizado!" : "NPS registrado!");
      setModal({ open: false });
    }
    return result;
  }, [modal.record, createRecord, updateRecord]);

  const handleDelete = useCallback(async () => {
    if (!modal.record) return;
    await deleteRecord(modal.record.id);
    toast.success("Registro removido");
    setModal({ open: false });
  }, [modal.record, deleteRecord]);

  const filteredSummaries = metrics.clientSummaries.filter(cs =>
    cs.client.name.toLowerCase().includes(search.toLowerCase())
  );

  const npsColor = npsScoreColor(metrics.npsScore);

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="lc-card h-24" />)}
        </div>
        <div className="lc-card h-56" />
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* ── 1. KPI Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* NPS Geral — large card */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="lc-card p-5 col-span-2 flex items-center gap-5"
        >
          <div
            className="w-20 h-20 rounded-2xl flex flex-col items-center justify-center shrink-0"
            style={{ background: `${npsColor}18`, border: `2px solid ${npsColor}44` }}
          >
            <p className="text-3xl font-black leading-none" style={{ color: npsColor }}>
              {metrics.npsScore.toFixed(0)}
            </p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: npsColor }}>NPS</p>
          </div>
          <div>
            <p className="text-xs text-[#b4b4b4] mb-0.5">NPS Geral</p>
            <p className="text-xl font-bold text-white">{metrics.npsLabel}</p>
            <p className="text-xs text-[#5a5a5a] mt-1">
              {metrics.respondedCount} de {metrics.respondedCount + metrics.notRespondedCount} clientes responderam
            </p>
            <div className="flex gap-3 mt-2">
              <span className="text-xs text-emerald-400">{metrics.pctPromoters.toFixed(0)}% Promotores</span>
              <span className="text-xs text-amber-400">{metrics.pctNeutrals.toFixed(0)}% Neutros</span>
              <span className="text-xs text-red-400">{metrics.pctDetractors.toFixed(0)}% Detratores</span>
            </div>
          </div>
        </motion.div>

        {[
          { label: "Promotores", value: `${metrics.pctPromoters.toFixed(0)}%`, sub: `${metrics.periodRecords.filter(r => classifyNps(r.score) === "promotor").length} clientes`, color: "#10b981", icon: <ThumbsUp size={16} /> },
          { label: "Neutros", value: `${metrics.pctNeutrals.toFixed(0)}%`, sub: `${metrics.periodRecords.filter(r => classifyNps(r.score) === "neutro").length} clientes`, color: "#f59e0b", icon: <Minus size={16} /> },
          { label: "Detratores", value: `${metrics.pctDetractors.toFixed(0)}%`, sub: `${metrics.periodRecords.filter(r => classifyNps(r.score) === "detrator").length} clientes`, color: "#ef4444", icon: <ThumbsDown size={16} /> },
          { label: "Respondidos", value: String(metrics.respondedCount), sub: `${metrics.notRespondedCount} sem resposta`, color: "#4a8fd4", icon: <CheckCircle size={16} /> },
          {
            label: "Maior Alta",
            value: metrics.biggestRise ? `+${metrics.biggestRise.delta}` : "—",
            sub: metrics.biggestRise?.client.name ?? "sem dados",
            color: "#10b981",
            icon: <TrendingUp size={16} />,
          },
          {
            label: "Maior Queda",
            value: metrics.biggestFall ? String(metrics.biggestFall.delta) : "—",
            sub: metrics.biggestFall?.client.name ?? "sem dados",
            color: "#ef4444",
            icon: <TrendingDown size={16} />,
          },
        ].map((card, i) => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (i + 1) * 0.05 }}
            className="lc-card p-4 flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: `${card.color}22`, border: `1px solid ${card.color}44`, color: card.color }}>
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#b4b4b4]">{card.label}</p>
              <p className="text-lg font-bold text-white leading-tight">{card.value}</p>
              <p className="text-[10px] text-[#5a5a5a] truncate">{card.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── 2. Insights ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {metrics.insights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lc-card p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "rgba(74,143,212,0.15)", border: "1px solid rgba(74,143,212,0.25)" }}>
                <Zap size={13} style={{ color: "#4a8fd4" }} />
              </div>
              <p className="text-sm font-semibold text-white">Inteligência NPS</p>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {metrics.insights.map((insight, i) => {
                const cfg = INSIGHT_CFG[insight.type];
                return (
                  <motion.div
                    key={insight.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn("rounded-xl p-3.5 border", cfg.bg, cfg.border)}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={cn("mt-0.5 shrink-0", cfg.color)}>{cfg.icon}</span>
                      <div>
                        <p className={cn("text-sm font-semibold mb-0.5", cfg.color)}>{insight.title}</p>
                        <p className="text-xs text-[#b4b4b4] leading-relaxed">{insight.message}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. Gráficos ────────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-5">

        {/* NPS mensal */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="lc-card p-5"
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(74,143,212,0.15)", border: "1px solid rgba(74,143,212,0.25)" }}>
              <TrendingUp size={13} style={{ color: "#4a8fd4" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">NPS por Mês</p>
              <p className="text-[11px] text-[#5a5a5a]">Score geral — últimos 6 meses</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={metrics.monthlyEvolution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="mes" tick={{ fill: "#5a5a5a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#5a5a5a", fontSize: 11 }} axisLine={false} tickLine={false} domain={[-100, 100]} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="nps"
                name="NPS"
                fill="rgba(74,143,212,0.12)"
                stroke="#4a8fd4"
                strokeWidth={2.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Promotores x Neutros x Detratores */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.18 }}
          className="lc-card p-5"
        >
          <div className="flex items-center gap-2 mb-5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.25)" }}>
              <Users size={13} style={{ color: "#10b981" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Distribuição por Mês</p>
              <p className="text-[11px] text-[#5a5a5a]">Promotores × Neutros × Detratores</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={metrics.monthlyEvolution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="mes" tick={{ fill: "#5a5a5a", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#5a5a5a", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                formatter={(v) => <span style={{ color: "#b4b4b4" }}>{v}</span>}
              />
              <Bar dataKey="promotores" name="Promotores %" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="neutros"    name="Neutros %"    fill="#f59e0b" stackId="a" />
              <Bar dataKey="detratores" name="Detratores %" fill="#ef4444" stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      {/* ── 4. Histórico por cliente ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.20 }}
        className="lc-card overflow-hidden"
      >
        <div className="p-5 pb-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.25)" }}>
              <MessageSquare size={13} style={{ color: "#a78bfa" }} />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Histórico por Cliente</p>
              <p className="text-[11px] text-[#5a5a5a]">{clients.filter(c => c.status === "ativo").length} clientes ativos</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5a5a5a] pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar cliente..."
                className="pl-8 pr-3 py-2 rounded-xl bg-white/5 text-white text-sm outline-none placeholder:text-[#5a5a5a] focus:bg-white/[0.07] transition-colors w-44"
              />
            </div>
            <PrimaryButton
              onClick={() => setModal({ open: true })}
              className="flex items-center gap-2 px-4 py-2 text-sm whitespace-nowrap"
            >
              <Plus size={14} />
              Registrar NPS
            </PrimaryButton>
          </div>
        </div>

        {filteredSummaries.length === 0 ? (
          <div className="p-12 text-center">
            <Star size={36} className="text-[#b4b4b4]/25 mx-auto mb-3" />
            <p className="text-[#b4b4b4] text-sm">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  {["Cliente", "Última Nota", "Média Histórica", "Tendência", "Última Atualização", "Classificação", ""].map(h => (
                    <th key={h} className="text-left text-xs text-[#b4b4b4] font-medium px-5 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.map((cs, i) => {
                  const lastRecord = cs.records[0];
                  return (
                    <motion.tr
                      key={cs.client.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
                      className="hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <p className="text-white font-medium">{cs.client.name}</p>
                        <p className="text-[11px] text-[#5a5a5a]">{cs.client.contact_name ?? "—"}</p>
                      </td>
                      <td className="px-5 py-3">
                        {cs.lastScore !== null
                          ? <ScoreBadge score={cs.lastScore} />
                          : <span className="text-[#5a5a5a]">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {cs.records.length > 0
                          ? <span className="text-white font-semibold">{cs.avgScore.toFixed(1)}</span>
                          : <span className="text-[#5a5a5a]">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {cs.trend === "up" && <span className="text-emerald-400 flex items-center gap-1 text-xs"><ChevronUp size={14} />Subiu</span>}
                        {cs.trend === "down" && <span className="text-red-400 flex items-center gap-1 text-xs"><ChevronDown size={14} />Caiu</span>}
                        {cs.trend === "stable" && <span className="text-[#b4b4b4] flex items-center gap-1 text-xs"><Minus size={14} />Estável</span>}
                        {!cs.trend && <span className="text-[#5a5a5a]">—</span>}
                      </td>
                      <td className="px-5 py-3 text-[#b4b4b4] whitespace-nowrap text-xs">
                        {cs.lastMonth
                          ? format(new Date(cs.lastMonth + "-01"), "MMM/yy", { locale: ptBR })
                          : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <ClassificationBadge cls={cs.classification} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setModal({ open: true, record: lastRecord })}
                            className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-colors"
                          >
                            {lastRecord ? <Edit2 size={13} /> : <Plus size={13} />}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* ── 5. Registros do período ──────────────────────────────────── */}
      {metrics.periodRecords.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="lc-card p-5"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: "rgba(74,143,212,0.15)", border: "1px solid rgba(74,143,212,0.25)" }}>
              <Star size={13} style={{ color: "#4a8fd4" }} />
            </div>
            <p className="text-sm font-semibold text-white">Registros do Período</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.periodRecords.map((rec, i) => {
              const cls = classifyNps(rec.score);
              const clsColor = cls === "promotor" ? "#10b981" : cls === "neutro" ? "#f59e0b" : "#ef4444";
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl p-4"
                  style={{ background: `${clsColor}0a`, border: `1px solid ${clsColor}25` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-white font-medium text-sm">{rec.client?.name ?? "—"}</p>
                      <p className="text-[11px] text-[#5a5a5a]">{CHANNEL_LABELS[rec.channel]}</p>
                    </div>
                    <ScoreBadge score={rec.score} />
                  </div>
                  {rec.comment && (
                    <p className="text-xs text-[#b4b4b4] italic line-clamp-2">"{rec.comment}"</p>
                  )}
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-[10px] text-[#5a5a5a]">
                      {rec.responsible ?? "—"}
                    </span>
                    <button
                      onClick={() => setModal({ open: true, record: rec })}
                      className="p-1 rounded-lg text-[#5a5a5a] hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <Edit2 size={11} />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {modal.open && (
          <NpsModal
            clients={clients.filter(c => c.status === "ativo")}
            record={modal.record}
            defaultMonth={defaultMonth}
            onClose={() => setModal({ open: false })}
            onSave={handleSave}
            onDelete={modal.record ? handleDelete : undefined}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
