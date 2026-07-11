"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import {
  X, Star, TrendingUp, TrendingDown, Users,
  MessageSquare, CheckCircle, AlertTriangle, Zap, Info,
  ChevronUp, ChevronDown, Minus, Search,
  ThumbsUp, ThumbsDown, Link2, Copy, Check, ExternalLink,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  useNps, classifyNps, avgScoreColor, avgScoreLabel,
  type ClientNpsSummary, type NpsInsight,
} from "@/hooks/useNps";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";
import type { NpsChannel, AgencyClient } from "@/types";

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
  warning:  { icon: <AlertTriangle size={14} />, border: "border-[color-mix(in_srgb,var(--nps-warning)_25%,transparent)]", bg: "bg-[color-mix(in_srgb,var(--nps-warning)_8%,transparent)]", color: "text-[var(--nps-warning)]" },
  critical: { icon: <Zap size={14} />, border: "border-red-500/25", bg: "bg-red-500/8", color: "text-red-400" },
  neutral:  { icon: <Info size={14} />, border: "border-[color-mix(in_srgb,var(--text-title)_10%,transparent)]", bg: "bg-[color-mix(in_srgb,var(--text-title)_5%,transparent)]", color: "text-[var(--silver)]" },
};

// ── Score display ─────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const cls = classifyNps(score);
  const config = {
    promotor:  { text: "text-emerald-400 bg-emerald-400/12 border-emerald-400/25" },
    neutro:    { text: "text-[var(--nps-warning)] bg-[color-mix(in_srgb,var(--nps-warning)_12%,transparent)] border-[color-mix(in_srgb,var(--nps-warning)_25%,transparent)]" },
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
  if (!cls) return <span className="text-[var(--text-muted)] text-xs">—</span>;
  const cfg = {
    promotor: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    neutro:   "text-[var(--nps-warning)] bg-[color-mix(in_srgb,var(--nps-warning)_10%,transparent)] border-[color-mix(in_srgb,var(--nps-warning)_20%,transparent)]",
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
      style={{ background: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)" }}>
      <p className="text-[var(--silver)] mb-2 font-medium capitalize">{label}</p>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-[color:var(--chart-tooltip-entry)]">{p.name}:</span>
          <span className="text-[var(--text-title)] font-semibold">
            {typeof p.value === "number"
              ? p.name === "NPS" ? p.value.toFixed(0) : `${p.value.toFixed(1)}%`
              : p.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Formulário de NPS (link público) ──────────────────────────────────────────

interface NpsFormState {
  integrationId:    string;
  formId:           string;
  slug:             string;
  name:             string;
  status:           string;
  notifyOnResponse: boolean;
}

function NpsFormModal({ client, otherClients, onClose }: { client: AgencyClient; otherClients: AgencyClient[]; onClose: () => void }) {
  useModalOpen(true);

  const [npsForm, setNpsForm]   = useState<NpsFormState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isToggling, setIsToggling] = useState(false);
  const [copied, setCopied] = useState(false);

  const [showDuplicate, setShowDuplicate] = useState(false);
  const [sourceClientId, setSourceClientId] = useState("");
  const [dupSlug, setDupSlug] = useState("");
  const [isDuplicating, setIsDuplicating] = useState(false);

  // Portal pro <body>: sem isso, o "fixed inset-0" fica preso no containing
  // block criado pelo transform inline que o motion.div da troca de aba deixa
  // no DOM (mesmo em repouso, y:0 vira translateY(0px) — ainda cria um novo
  // containing block), e o modal centraliza relativo à aba, não à tela toda.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/clientes/${client.id}/nps-form`);
        const json = await res.json().catch(() => ({}));
        if (active) setNpsForm(json.npsForm ?? null);
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [client.id]);

  async function handleCreate() {
    setIsCreating(true);
    try {
      const res = await fetch(`/api/clientes/${client.id}/nps-form`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify_on_response: true }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao criar formulário de NPS");
        return;
      }
      // POST não retorna o integrationId — refetch garante estado consistente.
      const refetch = await fetch(`/api/clientes/${client.id}/nps-form`);
      const refetchJson = await refetch.json().catch(() => ({}));
      setNpsForm(refetchJson.npsForm ?? null);
      toast.success("Formulário de NPS criado!");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDuplicate() {
    if (!sourceClientId) { toast.error("Selecione o cliente de origem"); return; }
    setIsDuplicating(true);
    try {
      const res = await fetch(`/api/clientes/${client.id}/nps-form/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_client_id: sourceClientId, slug: dupSlug || undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? "Erro ao duplicar formulário de NPS");
        return;
      }
      const refetch = await fetch(`/api/clientes/${client.id}/nps-form`);
      const refetchJson = await refetch.json().catch(() => ({}));
      setNpsForm(refetchJson.npsForm ?? null);
      setShowDuplicate(false);
      toast.success("Formulário duplicado!");
    } finally {
      setIsDuplicating(false);
    }
  }

  async function handleToggleNotify(next: boolean) {
    if (!npsForm) return;
    setIsToggling(true);
    const previous = npsForm.notifyOnResponse;
    setNpsForm({ ...npsForm, notifyOnResponse: next });
    try {
      const res = await fetch(`/api/clientes/${client.id}/nps-form`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notify_on_response: next }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        toast.error(json.error ?? "Erro ao atualizar notificação");
        setNpsForm((prev) => prev ? { ...prev, notifyOnResponse: previous } : prev);
      }
    } finally {
      setIsToggling(false);
    }
  }

  const publicUrl = npsForm && typeof window !== "undefined"
    ? `${window.location.origin}/form/${npsForm.slug}`
    : "";

  function handleCopy() {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-md rounded-2xl shadow-2xl p-6"
        style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--text-title)]">Formulário de NPS</h2>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">{client.name}</p>
          </div>
          <button onClick={onClose} className="text-[var(--silver)] hover:text-[var(--text-title)] transition-colors p-1">
            <X size={20} />
          </button>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-[var(--text-muted)]">Carregando...</div>
        ) : npsForm ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Link público</label>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--text-title) 8%, transparent)" }}>
                <span className="flex-1 truncate text-xs font-mono text-[var(--text-title)]">{publicUrl}</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 text-xs font-medium text-[#4a8fd4] hover:text-[#6ba7e0] transition-colors shrink-0"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Copiado" : "Copiar"}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--text-muted)]">
                Envie este link para o cliente responder. As respostas entram automaticamente aqui na aba NPS.
              </p>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 cursor-pointer" style={{ background: "color-mix(in srgb, var(--text-title) 8%, transparent)" }}>
              <span className="text-sm text-[var(--text-title)]">Notificar quando o cliente responder</span>
              <input
                type="checkbox"
                checked={npsForm.notifyOnResponse}
                disabled={isToggling}
                onChange={e => void handleToggleNotify(e.target.checked)}
                className="h-4 w-4 accent-[#4a8fd4]"
              />
            </label>

            <a
              href={`/formularios/${npsForm.formId}/editor`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-medium text-[var(--text-title)] hover:bg-[var(--hover)] transition-colors"
              style={{ border: "1px solid var(--border)" }}
            >
              Editar perguntas <ExternalLink size={12} />
            </a>
          </div>
        ) : showDuplicate ? (
          <div className="space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Copia perguntas, tema e configurações de um formulário de NPS já existente para {client.name}.
            </p>
            <div>
              <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Duplicar formulário de</label>
              <select
                value={sourceClientId}
                onChange={e => setSourceClientId(e.target.value)}
                className="w-full rounded-xl bg-[color-mix(in_srgb,var(--text-title)_15%,transparent)] text-[var(--text-title)] text-sm px-3 py-2.5 outline-none border-none"
              >
                <option value="">Selecionar cliente...</option>
                {otherClients.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--silver)] mb-1.5 font-medium">Slug do link (opcional)</label>
              <input
                value={dupSlug}
                onChange={e => setDupSlug(e.target.value)}
                placeholder={`nps-${client.name.toLowerCase()}`}
                className="w-full rounded-xl bg-[color-mix(in_srgb,var(--text-title)_15%,transparent)] text-[var(--text-title)] text-sm px-3 py-2.5 outline-none placeholder:text-[var(--silver)]/50 border-none"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowDuplicate(false)}
                className="flex-1 rounded-xl py-2.5 text-sm font-medium text-[var(--silver)] hover:text-[var(--text-title)] transition-colors"
                style={{ background: "var(--border)", border: "1px solid var(--border)" }}
              >
                Cancelar
              </button>
              <PrimaryButton onClick={() => void handleDuplicate()} disabled={isDuplicating} className="flex-1 py-2.5 text-sm">
                {isDuplicating ? "Duplicando..." : "Duplicar"}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="py-2 text-center space-y-3">
            <p className="text-sm text-[var(--text-muted)]">
              Este cliente ainda não tem um formulário de NPS. Crie um para gerar o link público de resposta.
            </p>
            <PrimaryButton onClick={() => void handleCreate()} disabled={isCreating} className="w-full py-2.5 text-sm">
              {isCreating ? "Criando..." : "Criar formulário de NPS"}
            </PrimaryButton>
            {otherClients.length > 0 && (
              <button
                onClick={() => setShowDuplicate(true)}
                className="text-xs font-medium text-[#4a8fd4] hover:text-[#6ba7e0] transition-colors"
              >
                ou duplicar de outro cliente
              </button>
            )}
          </div>
        )}
      </motion.div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props { year: number; month: number }

export function NpsModule({ year, month }: Props) {
  const { clients, isLoading, metrics } = useNps(year, month);
  const [npsFormClient, setNpsFormClient] = useState<AgencyClient | null>(null);
  const [search, setSearch] = useState("");

  const filteredSummaries = metrics.clientSummaries.filter(cs =>
    cs.client.name.toLowerCase().includes(search.toLowerCase())
  );

  const npsColor = avgScoreColor(metrics.avgScore);

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
    <div className="nps-module space-y-5">

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
              {metrics.avgScore.toFixed(1)}
            </p>
            <p className="text-[10px] font-medium mt-0.5" style={{ color: npsColor }}>/ 10</p>
          </div>
          <div>
            <p className="text-xs text-[var(--silver)] mb-0.5">NPS Geral</p>
            <p className="text-xl font-bold text-[var(--text-title)]">{avgScoreLabel(metrics.avgScore)}</p>
            <p className="text-xs text-[var(--text-muted)] mt-1">
              {metrics.respondedCount} de {metrics.respondedCount + metrics.notRespondedCount} clientes responderam
            </p>
            <div className="flex gap-3 mt-2">
              <span className="text-xs text-emerald-400">{metrics.pctPromoters.toFixed(0)}% Promotores</span>
              <span className="text-xs text-[var(--nps-warning)]">{metrics.pctNeutrals.toFixed(0)}% Neutros</span>
              <span className="text-xs text-red-400">{metrics.pctDetractors.toFixed(0)}% Detratores</span>
            </div>
          </div>
        </motion.div>

        {[
          { label: "Promotores", value: `${metrics.pctPromoters.toFixed(0)}%`, sub: `${metrics.periodRecords.filter(r => classifyNps(r.score) === "promotor").length} clientes`, color: "#10b981", icon: <ThumbsUp size={16} /> },
          { label: "Neutros", value: `${metrics.pctNeutrals.toFixed(0)}%`, sub: `${metrics.periodRecords.filter(r => classifyNps(r.score) === "neutro").length} clientes`, color: "var(--nps-warning)", icon: <Minus size={16} /> },
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
              style={{
                background: `color-mix(in srgb, ${card.color} 13%, transparent)`,
                border: `1px solid color-mix(in srgb, ${card.color} 27%, transparent)`,
                color: card.color,
              }}>
              {card.icon}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[var(--silver)]">{card.label}</p>
              <p className="text-lg font-bold text-[var(--text-title)] leading-tight">{card.value}</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">{card.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── 1.5. Formulários de NPS ──────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="lc-card p-5"
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: "rgba(74,143,212,0.15)", border: "1px solid rgba(74,143,212,0.25)" }}>
            <Link2 size={13} style={{ color: "#4a8fd4" }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-title)]">Formulários de NPS</p>
            <p className="text-[11px] text-[var(--text-muted)]">Link público para o cliente responder — a nota entra automaticamente aqui</p>
          </div>
        </div>

        <div className="space-y-2">
          {clients.filter(c => c.status === "ativo").length === 0 ? (
            <p className="text-sm text-[var(--text-muted)] text-center py-6">Nenhum cliente ativo cadastrado ainda.</p>
          ) : (
            clients.filter(c => c.status === "ativo").map(client => (
              <div
                key={client.id}
                className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                style={{ background: "var(--hover)", border: "1px solid var(--border)" }}
              >
                <p className="text-sm font-medium text-[var(--text-title)] truncate">{client.name}</p>
                <button
                  onClick={() => setNpsFormClient(client)}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium shrink-0 transition-colors hover:opacity-80"
                  style={{ background: "rgba(74,143,212,0.12)", color: "#4a8fd4", border: "1px solid rgba(74,143,212,0.25)" }}
                >
                  <Link2 size={12} />
                  Gerenciar formulário
                </button>
              </div>
            ))
          )}
        </div>
      </motion.div>

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
              <p className="text-sm font-semibold text-[var(--text-title)]">Inteligência NPS</p>
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
                        <p className="text-xs text-[var(--silver)] leading-relaxed">{insight.message}</p>
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
              <p className="text-sm font-semibold text-[var(--text-title)]">NPS por Mês</p>
              <p className="text-[11px] text-[var(--text-muted)]">Score geral — últimos 6 meses</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={metrics.monthlyEvolution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gNpsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#4a8fd4" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#4a8fd4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[-100, 100]} />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="nps"
                name="NPS"
                fill="url(#gNpsArea)"
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
              <p className="text-sm font-semibold text-[var(--text-title)]">Distribuição por Mês</p>
              <p className="text-[11px] text-[var(--text-muted)]">Promotores × Neutros × Detratores</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={metrics.monthlyEvolution} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="mes" tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "var(--text-muted)", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0, 100]} />
              <Tooltip content={<ChartTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                formatter={(v) => <span style={{ color: "var(--silver)" }}>{v}</span>}
              />
              <Bar dataKey="promotores" name="Promotores %" fill="#10b981" stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="neutros"    name="Neutros %"    fill="var(--nps-warning)" stackId="a" />
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
              <p className="text-sm font-semibold text-[var(--text-title)]">Histórico por Cliente</p>
              <p className="text-[11px] text-[var(--text-muted)]">{clients.filter(c => c.status === "ativo").length} clientes ativos</p>
            </div>
          </div>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar cliente..."
              className="pl-8 pr-3 py-2 rounded-xl bg-[color-mix(in_srgb,var(--text-title)_5%,transparent)] text-[var(--text-title)] text-sm outline-none placeholder:text-[var(--text-muted)] focus:bg-[color-mix(in_srgb,var(--text-title)_7%,transparent)] transition-colors w-44"
            />
          </div>
        </div>

        {filteredSummaries.length === 0 ? (
          <div className="p-12 text-center">
            <Star size={36} className="text-[var(--silver)]/25 mx-auto mb-3" />
            <p className="text-[var(--silver)] text-sm">Nenhum cliente encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Cliente", "Última Nota", "Média Histórica", "Tendência", "Última Atualização", "Classificação", ""].map(h => (
                    <th key={h} className="text-left text-xs text-[var(--silver)] font-medium px-5 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredSummaries.map((cs, i) => {
                  return (
                    <motion.tr
                      key={cs.client.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      style={{ borderBottom: "1px solid var(--border)" }}
                      className="hover:bg-[var(--hover)] transition-colors"
                    >
                      <td className="px-5 py-3">
                        <p className="text-[var(--text-title)] font-medium">{cs.client.name}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{cs.client.contact_name ?? "—"}</p>
                      </td>
                      <td className="px-5 py-3">
                        {cs.lastScore !== null
                          ? <ScoreBadge score={cs.lastScore} />
                          : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {cs.records.length > 0
                          ? <span className="text-[var(--text-title)] font-semibold">{cs.avgScore.toFixed(1)}</span>
                          : <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        {cs.trend === "up" && <span className="text-emerald-400 flex items-center gap-1 text-xs"><ChevronUp size={14} />Subiu</span>}
                        {cs.trend === "down" && <span className="text-red-400 flex items-center gap-1 text-xs"><ChevronDown size={14} />Caiu</span>}
                        {cs.trend === "stable" && <span className="text-[var(--silver)] flex items-center gap-1 text-xs"><Minus size={14} />Estável</span>}
                        {!cs.trend && <span className="text-[var(--text-muted)]">—</span>}
                      </td>
                      <td className="px-5 py-3 text-[var(--silver)] whitespace-nowrap text-xs">
                        {cs.lastMonth
                          ? format(new Date(cs.lastMonth + "-01"), "MMM/yy", { locale: ptBR })
                          : "—"}
                      </td>
                      <td className="px-5 py-3">
                        <ClassificationBadge cls={cs.classification} />
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setNpsFormClient(cs.client)}
                          className="p-1.5 rounded-lg text-[var(--silver)] hover:text-[var(--text-title)] hover:bg-[var(--hover)] transition-colors"
                          title="Formulário de NPS (link público)"
                        >
                          <Link2 size={13} />
                        </button>
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
            <p className="text-sm font-semibold text-[var(--text-title)]">Registros do Período</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.periodRecords.map((rec, i) => {
              const cls = classifyNps(rec.score);
              const clsColor = cls === "promotor" ? "#10b981" : cls === "neutro" ? "var(--nps-warning)" : "#ef4444";
              return (
                <motion.div
                  key={rec.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="rounded-xl p-4"
                  style={{
                    background: `color-mix(in srgb, ${clsColor} 4%, transparent)`,
                    border: `1px solid color-mix(in srgb, ${clsColor} 15%, transparent)`,
                  }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-[var(--text-title)] font-medium text-sm">{rec.client?.name ?? "—"}</p>
                      <p className="text-[11px] text-[var(--text-muted)]">{CHANNEL_LABELS[rec.channel]}</p>
                    </div>
                    <ScoreBadge score={rec.score} />
                  </div>
                  {rec.comment && (
                    <p className="text-xs text-[var(--silver)] italic line-clamp-2">&ldquo;{rec.comment}&rdquo;</p>
                  )}
                  <div className="mt-2.5">
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {rec.responsible ?? "—"}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Modal ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {npsFormClient && (
          <NpsFormModal
            client={npsFormClient}
            otherClients={clients.filter(c => c.status === "ativo" && c.id !== npsFormClient.id)}
            onClose={() => setNpsFormClient(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
