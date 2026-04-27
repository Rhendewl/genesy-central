"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  format, parseISO,
  subDays, addDays, subMonths, addMonths,
  startOfMonth, endOfMonth, startOfWeek,
  isSameDay, isSameMonth, isWithinInterval, isBefore,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Edit2, Trash2, X, Search, Filter, BarChart2,
  Play, Pause, CheckCircle2, AlertTriangle, Clock, RefreshCw,
  Calendar, ChevronLeft, ChevronRight, ChevronDown,
  ArrowUpDown, ArrowUp, ArrowDown,
} from "lucide-react";
import { useCampanhas, useCampaignMetrics } from "@/hooks/useCampanhas";
import { useAgencyClients } from "@/hooks/useAgencyClients";
import { useMetaIntegrations } from "@/hooks/useMetaIntegrations";
import { cn } from "@/lib/utils";
import type {
  Campaign, NewCampaign, CampaignStatus, CampaignPlatform,
  CampaignObjective, NewCampaignMetric,
} from "@/types";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useModalOpen } from "@/hooks/useModalOpen";

// ── Formatters ────────────────────────────────────────────────────────────────

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtNum = (v: number) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(v);

// ── Config constants ──────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<CampaignPlatform, { label: string; color: string }> = {
  meta:     { label: "Meta Ads",     color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  google:   { label: "Google Ads",   color: "text-red-400 bg-red-400/10 border-red-400/20" },
  tiktok:   { label: "TikTok Ads",   color: "text-pink-400 bg-pink-400/10 border-pink-400/20" },
  linkedin: { label: "LinkedIn Ads", color: "text-[#b4b4b4] bg-[#b4b4b4]/10 border-[#b4b4b4]/20" },
  outro:    { label: "Outro",        color: "text-slate-400 bg-slate-400/10 border-slate-400/20" },
};

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; icon: React.ReactNode }> = {
  ativa:      { label: "Ativa",      color: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", icon: <Play size={11} /> },
  pausada:    { label: "Pausada",    color: "text-amber-400 bg-amber-400/10 border-amber-400/20",       icon: <Pause size={11} /> },
  finalizada: { label: "Finalizada", color: "text-[#b4b4b4] bg-[#b4b4b4]/10 border-[#b4b4b4]/20",     icon: <CheckCircle2 size={11} /> },
  em_revisao: { label: "Em Revisão", color: "text-orange-400 bg-orange-400/10 border-orange-400/20",   icon: <AlertTriangle size={11} /> },
  rascunho:   { label: "Rascunho",   color: "text-slate-400 bg-slate-400/10 border-slate-400/20",      icon: <Clock size={11} /> },
};

const OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  leads: "Leads", conversoes: "Conversões", alcance: "Alcance",
  trafego: "Tráfego", engajamento: "Engajamento", vendas: "Vendas", outro: "Outro",
};

// Sort priority: lower = shown first when sorting "ativas primeiro"
const STATUS_PRIORITY: Record<CampaignStatus, number> = {
  ativa: 0, em_revisao: 1, rascunho: 2, pausada: 3, finalizada: 4,
};

// ── Period Picker: types & helpers ────────────────────────────────────────────

type QuickId =
  | "today" | "yesterday" | "today_yesterday"
  | "last7" | "last14" | "last28" | "last30"
  | "this_week" | "last_week"
  | "this_month" | "last_month" | "max";

const QUICK_OPTIONS: { id: QuickId; label: string }[] = [
  { id: "today",           label: "Hoje" },
  { id: "yesterday",       label: "Ontem" },
  { id: "today_yesterday", label: "Hoje e ontem" },
  { id: "last7",           label: "Últimos 7 dias" },
  { id: "last14",          label: "Últimos 14 dias" },
  { id: "last28",          label: "Últimos 28 dias" },
  { id: "last30",          label: "Últimos 30 dias" },
  { id: "this_week",       label: "Esta semana" },
  { id: "last_week",       label: "Semana passada" },
  { id: "this_month",      label: "Este mês" },
  { id: "last_month",      label: "Mês passado" },
  { id: "max",             label: "Máximo (1 ano)" },
];

function computeQuickRange(id: QuickId): { since: string; until: string; label: string } {
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  const todayStr = fmt(today);

  switch (id) {
    case "today":
      return { since: todayStr, until: todayStr, label: "Hoje" };
    case "yesterday": {
      const y = fmt(subDays(today, 1));
      return { since: y, until: y, label: "Ontem" };
    }
    case "today_yesterday":
      return { since: fmt(subDays(today, 1)), until: todayStr, label: "Hoje e ontem" };
    case "last7":
      return { since: fmt(subDays(today, 6)),  until: todayStr, label: "Últimos 7 dias" };
    case "last14":
      return { since: fmt(subDays(today, 13)), until: todayStr, label: "Últimos 14 dias" };
    case "last28":
      return { since: fmt(subDays(today, 27)), until: todayStr, label: "Últimos 28 dias" };
    case "last30":
      return { since: fmt(subDays(today, 29)), until: todayStr, label: "Últimos 30 dias" };
    case "this_week":
      return {
        since: fmt(startOfWeek(today, { weekStartsOn: 1 })),
        until: todayStr,
        label: "Esta semana",
      };
    case "last_week": {
      const lw = subDays(startOfWeek(today, { weekStartsOn: 1 }), 7);
      return { since: fmt(lw), until: fmt(addDays(lw, 6)), label: "Semana passada" };
    }
    case "this_month":
      return { since: fmt(startOfMonth(today)), until: todayStr, label: "Este mês" };
    case "last_month": {
      const lm = subMonths(today, 1);
      return { since: fmt(startOfMonth(lm)), until: fmt(endOfMonth(lm)), label: "Mês passado" };
    }
    case "max":
      return { since: fmt(subDays(today, 364)), until: todayStr, label: "Máximo (1 ano)" };
  }
}

// Builds 42-day grid (6 rows × 7 cols) starting on the Sunday before the month
function buildCalendarDays(month: Date): Date[] {
  const days: Date[] = [];
  let d = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  for (let i = 0; i < 42; i++) {
    days.push(d);
    d = addDays(d, 1);
  }
  return days;
}

const LS_SINCE = "gc_period_since";
const LS_UNTIL = "gc_period_until";
const LS_LABEL = "gc_period_label";

const DEFAULT_RANGE = computeQuickRange("last30");

// ── Period Picker Component ───────────────────────────────────────────────────

interface PeriodPickerProps {
  since: string;
  until: string;
  label: string;
  onApply: (since: string, until: string, label: string) => void;
}

const CAL_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function PeriodPicker({ since, until, label, onApply }: PeriodPickerProps) {
  const [open, setOpen] = useState(false);
  useModalOpen(open);

  // Draft state — only committed on "Aplicar"
  const [tempSince, setTempSince] = useState(since);
  const [tempUntil, setTempUntil] = useState(until);
  const [tempLabel, setTempLabel] = useState(label);
  const [activeQuick, setActiveQuick] = useState<QuickId | null>(null);
  const [calMonth, setCalMonth] = useState(() => startOfMonth(new Date()));
  const [step, setStep] = useState<"start" | "end">("start");
  const [hovered, setHovered] = useState<string | null>(null);

  const openPicker = () => {
    setTempSince(since);
    setTempUntil(until);
    setTempLabel(label);
    setActiveQuick(null);
    setStep("start");
    setHovered(null);
    try { setCalMonth(startOfMonth(parseISO(until))); }
    catch { setCalMonth(startOfMonth(new Date())); }
    setOpen(true);
  };

  const handleQuick = (id: QuickId) => {
    const r = computeQuickRange(id);
    setTempSince(r.since);
    setTempUntil(r.until);
    setTempLabel(r.label);
    setActiveQuick(id);
    setStep("start");
    setHovered(null);
    try { setCalMonth(startOfMonth(parseISO(r.until))); }
    catch { /* noop */ }
  };

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const handleDayClick = (day: Date) => {
    const dayStr = format(day, "yyyy-MM-dd");
    if (dayStr > todayStr) return; // no future dates

    if (step === "start") {
      setTempSince(dayStr);
      setTempUntil(dayStr);
      setStep("end");
      setActiveQuick(null);
    } else {
      let newSince = tempSince;
      let newUntil = dayStr;
      if (isBefore(day, parseISO(tempSince))) {
        newSince = dayStr;
        newUntil = tempSince;
      }
      setTempSince(newSince);
      setTempUntil(newUntil);
      setStep("start");
      setActiveQuick(null);
      try {
        const s = parseISO(newSince);
        const u = parseISO(newUntil);
        setTempLabel(
          isSameDay(s, u)
            ? format(s, "dd/MM/yyyy")
            : `${format(s, "dd/MM/yyyy")} → ${format(u, "dd/MM/yyyy")}`
        );
      } catch { /* noop */ }
    }
  };

  const handleApply = () => {
    onApply(tempSince, tempUntil, tempLabel);
    setOpen(false);
  };

  // Effective display range (considering hover preview)
  const { displaySince, displayUntil } = useMemo(() => {
    if (step === "end" && hovered) {
      return {
        displaySince: hovered < tempSince ? hovered : tempSince,
        displayUntil: hovered > tempSince ? hovered : tempSince,
      };
    }
    return { displaySince: tempSince, displayUntil: tempUntil };
  }, [step, hovered, tempSince, tempUntil]);

  const hasRange = displaySince !== displayUntil;
  const calDays = buildCalendarDays(calMonth);
  const maxCalMonth = startOfMonth(new Date());

  return (
    <>
      {/* Trigger */}
      <button
        onClick={openPicker}
        className="lc-card flex items-center gap-2 px-3.5 py-2 text-sm transition-all hover:bg-white/[0.03]"
      >
        <Calendar size={13} className="text-white/40 shrink-0" />
        <span className="text-white font-medium truncate max-w-[200px]">{label}</span>
        <ChevronDown
          size={12}
          className="text-[#b4b4b4] shrink-0 transition-transform"
          style={open ? { transform: "rotate(180deg)" } : {}}
        />
      </button>

      {/* Modal overlay */}
      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Transparent click catcher — no overlay, no dimming */}
            <div className="absolute inset-0" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ duration: 0.18 }}
              className="relative w-full max-w-[520px] rounded-2xl overflow-hidden"
              style={{
                background: "rgba(0,0,0,0.07)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
              }}
            >
              {/* Header */}
              <div
                className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: "rgba(255,255,255,0.07)" }}
              >
                <div className="flex items-center gap-2">
                  <Calendar size={13} className="text-white/40" />
                  <span className="text-sm font-medium text-white/80">Selecionar Período</span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-[#b4b4b4] hover:text-white transition-colors p-1"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Body */}
              <div className="flex flex-col sm:flex-row">

                {/* Quick options */}
                <div
                  className="sm:w-44 shrink-0 border-b sm:border-b-0 sm:border-r"
                  style={{ borderColor: "rgba(255,255,255,0.07)" }}
                >
                  <div className="p-2.5 space-y-0.5">
                    {QUICK_OPTIONS.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => handleQuick(opt.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-all",
                          activeQuick === opt.id
                            ? "text-white font-medium"
                            : "text-[#6a6a6a] hover:bg-white/5 hover:text-white/80"
                        )}
                        style={activeQuick === opt.id ? {
                          background: "rgba(255,255,255,0.08)",
                          border: "1px solid rgba(255,255,255,0.10)",
                        } : { border: "1px solid transparent" }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calendar */}
                <div className="flex-1 p-3">
                  {/* Month nav */}
                  <div className="flex items-center justify-between mb-2.5">
                    <button
                      onClick={() => setCalMonth(m => subMonths(m, 1))}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <span className="text-sm font-semibold text-white capitalize">
                      {format(calMonth, "MMMM yyyy", { locale: ptBR })}
                    </span>
                    <button
                      onClick={() => setCalMonth(m => addMonths(m, 1))}
                      disabled={!isBefore(calMonth, maxCalMonth)}
                      className="w-7 h-7 flex items-center justify-center rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 mb-1">
                    {CAL_HEADERS.map(h => (
                      <div key={h} className="text-center text-[10px] text-[#5a5a5a] font-medium py-1">
                        {h}
                      </div>
                    ))}
                  </div>

                  {/* Day grid */}
                  <div
                    className="grid grid-cols-7"
                    onMouseLeave={() => setHovered(null)}
                  >
                    {calDays.map((day, idx) => {
                      const dayStr = format(day, "yyyy-MM-dd");
                      const isOutside = !isSameMonth(day, calMonth);
                      const isFuture = dayStr > todayStr;
                      const isToday = dayStr === todayStr;
                      const isStart = dayStr === displaySince;
                      const isEnd   = dayStr === displayUntil;
                      const isPreview = step === "end" && hovered !== null;
                      const isInRange = !isStart && !isEnd && (() => {
                        try {
                          return isWithinInterval(day, {
                            start: parseISO(displaySince),
                            end:   parseISO(displayUntil),
                          });
                        } catch { return false; }
                      })();

                      return (
                        <div
                          key={idx}
                          className="relative h-8 flex items-center justify-center"
                          onMouseEnter={() => !isFuture && setHovered(dayStr)}
                          onClick={() => !isFuture && handleDayClick(day)}
                        >
                          {/* Range strip */}
                          {isInRange && (
                            <div
                              className="absolute inset-y-1 inset-x-0"
                              style={{
                                background: isPreview
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(255,255,255,0.10)",
                              }}
                            />
                          )}
                          {/* Start half-strip (right side) */}
                          {isStart && hasRange && (
                            <div
                              className="absolute inset-y-1 left-1/2 right-0"
                              style={{
                                background: isPreview
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(255,255,255,0.10)",
                              }}
                            />
                          )}
                          {/* End half-strip (left side) */}
                          {isEnd && hasRange && (
                            <div
                              className="absolute inset-y-1 left-0 right-1/2"
                              style={{
                                background: isPreview
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(255,255,255,0.10)",
                              }}
                            />
                          )}

                          {/* Day number */}
                          <span
                            className={cn(
                              "relative z-10 w-7 h-7 flex items-center justify-center rounded-full text-xs transition-all select-none",
                              isFuture && "opacity-20 cursor-not-allowed",
                              !isFuture && (isOutside ? "cursor-pointer text-[#3a3a3a]" : "cursor-pointer"),
                              !isStart && !isEnd && !isOutside && !isFuture && "text-[#8a8a8a]",
                              !isStart && !isEnd && isInRange && "!text-white/75",
                              isToday && !isStart && !isEnd && "border border-white/20",
                              !isStart && !isEnd && !isFuture && !isOutside && "hover:bg-white/[0.10]",
                            )}
                            style={(isStart || isEnd) ? {
                              background: "linear-gradient(145deg, #c4c4c4 0%, #ffffff 50%, #c4c4c4 100%)",
                              color: "#000000",
                              fontWeight: 600,
                              boxShadow: "0 2px 10px rgba(255,255,255,0.18), 0 0 0 1px rgba(255,255,255,0.15)",
                            } : {}}
                          >
                            {format(day, "d")}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Selection hint */}
                  <p className="mt-2 text-[10px] text-center" style={{ color: "#3a4a5a" }}>
                    {step === "start"
                      ? "Clique para iniciar · duplo clique para mesmo dia"
                      : "Clique na data final do período"}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div
                className="flex items-center justify-between px-4 py-2.5 border-t"
                style={{ borderColor: "rgba(255,255,255,0.07)" }}
              >
                <div className="text-xs">
                  {tempSince && tempUntil ? (
                    <span className="text-white/50">
                      <span className="text-white/80 font-medium tabular-nums">
                        {format(parseISO(tempSince), "dd/MM/yyyy")}
                      </span>
                      {tempSince !== tempUntil && (
                        <>
                          <span className="mx-1 text-white/25">→</span>
                          <span className="text-white/80 font-medium tabular-nums">
                            {format(parseISO(tempUntil), "dd/MM/yyyy")}
                          </span>
                        </>
                      )}
                    </span>
                  ) : (
                    <span className="text-white/20">Selecione o período</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="px-3.5 py-1.5 rounded-lg text-xs text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
                  >
                    Cancelar
                  </button>
                  <PrimaryButton
                    onClick={handleApply}
                    disabled={!tempSince || !tempUntil}
                    className="px-4 py-1.5 text-xs"
                  >
                    Aplicar
                  </PrimaryButton>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

// ── Campaign Modal ────────────────────────────────────────────────────────────

interface CampaignModalProps {
  campaign?: Campaign;
  clients: Array<{ id: string; name: string }>;
  onClose: () => void;
  onSave: (data: NewCampaign) => Promise<void>;
}

function CampaignModal({ campaign, clients, onClose, onSave }: CampaignModalProps) {
  useModalOpen(true);
  const [form, setForm] = useState<Partial<NewCampaign>>(
    campaign ? {
      client_id: campaign.client_id, name: campaign.name, platform: campaign.platform,
      objective: campaign.objective, status: campaign.status,
      daily_budget: campaign.daily_budget, total_budget: campaign.total_budget,
      start_date: campaign.start_date, end_date: campaign.end_date ?? undefined,
      external_id: campaign.external_id ?? undefined, notes: campaign.notes ?? undefined,
    } : {
      platform: "meta", objective: "leads", status: "ativa",
      daily_budget: 0, total_budget: 0,
      start_date: new Date().toISOString().split("T")[0],
    }
  );
  const [saving, setSaving] = useState(false);
  const set = (k: keyof NewCampaign, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.start_date) return;
    setSaving(true);
    await onSave(form as NewCampaign);
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="lc-modal-panel relative w-full max-w-lg rounded-2xl p-6 space-y-3 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold text-white">{campaign ? "Editar Campanha" : "Nova Campanha"}</h2>
          <button onClick={onClose} className="text-[#b4b4b4] hover:text-white transition-colors"><X size={20} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Nome da Campanha *</label>
            <input value={form.name ?? ""} onChange={e => set("name", e.target.value)}
              placeholder="Ex: Leads Imobiliária X — Maio"
              className="w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none placeholder:text-[#b4b4b4]/50"
              style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Cliente</label>
            <select value={form.client_id ?? ""} onChange={e => set("client_id", e.target.value || null)}
              className="w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none"
              style={{ border: "none" }}>
              <option value="">Sem cliente</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Plataforma</label>
            <select value={form.platform ?? "meta"} onChange={e => set("platform", e.target.value as CampaignPlatform)}
              className="w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none"
              style={{ border: "none" }}>
              {Object.entries(PLATFORM_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Objetivo</label>
            <select value={form.objective ?? "leads"} onChange={e => set("objective", e.target.value as CampaignObjective)}
              className="w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none"
              style={{ border: "none" }}>
              {Object.entries(OBJECTIVE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Status</label>
            <select value={form.status ?? "ativa"} onChange={e => set("status", e.target.value as CampaignStatus)}
              className="w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none"
              style={{ border: "none" }}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Budget Diário (R$)</label>
            <MoneyInput value={form.daily_budget ?? 0} onChange={v => set("daily_budget", v)} />
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Budget Total (R$)</label>
            <MoneyInput value={form.total_budget ?? 0} onChange={v => set("total_budget", v)} />
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Data de Início *</label>
            <input type="date" value={form.start_date ?? ""} onChange={e => set("start_date", e.target.value)}
              className="w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none"
              style={{ border: "none" }} />
          </div>
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Data de Fim</label>
            <input type="date" value={form.end_date ?? ""} onChange={e => set("end_date", e.target.value || null)}
              className="w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none"
              style={{ border: "none" }} />
          </div>
          <div className="col-span-2">
            <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">ID Externo (plataforma)</label>
            <input value={form.external_id ?? ""} onChange={e => set("external_id", e.target.value || null)}
              placeholder="ID da campanha no Meta/Google..."
              className="w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none placeholder:text-[#b4b4b4]/50"
              style={{ border: "none" }} />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-[#b4b4b4] hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
            Cancelar
          </button>
          <PrimaryButton onClick={handleSave} disabled={saving || !form.name} className="flex-1 py-2.5 text-sm">
            {saving ? "Salvando..." : campaign ? "Salvar" : "Criar Campanha"}
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
}

// ── Metrics Entry Modal ───────────────────────────────────────────────────────

interface MetricsModalProps {
  campaign: Campaign;
  onClose: () => void;
  onSave: (data: NewCampaignMetric) => Promise<void>;
}

function MetricsModal({ campaign, onClose, onSave }: MetricsModalProps) {
  useModalOpen(true);
  const [form, setForm] = useState<Partial<NewCampaignMetric>>({
    campaign_id: campaign.id,
    client_id: campaign.client_id,
    date: new Date().toISOString().split("T")[0],
    impressions: 0, clicks: 0, spend: 0, leads: 0,
    conversions: 0, reach: 0, frequency: 0, video_views: 0,
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof NewCampaignMetric, v: unknown) => setForm(f => ({ ...f, [k]: v }));

  const cpl = form.leads && form.leads > 0 && form.spend ? form.spend / form.leads : 0;
  const ctr = form.impressions && form.impressions > 0 && form.clicks
    ? (form.clicks / form.impressions) * 100 : 0;

  const handleSave = async () => {
    if (!form.date) return;
    setSaving(true);
    await onSave(form as NewCampaignMetric);
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="lc-modal-panel relative w-full max-w-lg rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Lançar Métricas</h2>
            <p className="text-xs text-[#b4b4b4] mt-0.5">{campaign.name}</p>
          </div>
          <button onClick={onClose} className="text-[#b4b4b4] hover:text-white"><X size={20} /></button>
        </div>
        <div>
          <label className="block text-xs text-[#b4b4b4] mb-1.5 font-medium">Data *</label>
          <input type="date" value={form.date ?? ""} onChange={e => set("date", e.target.value)}
            className="w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none"
            style={{ border: "none" }} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { k: "impressions", label: "Impressões" },
            { k: "clicks", label: "Cliques" },
            { k: "leads", label: "Leads" },
            { k: "conversions", label: "Conversões" },
            { k: "reach", label: "Alcance" },
            { k: "frequency", label: "Frequência", step: "0.01" },
            { k: "video_views", label: "Visualizações de Vídeo" },
          ].map(({ k, label, step }) => (
            <div key={k}>
              <label className="block text-xs text-[#b4b4b4] mb-1.5">{label}</label>
              <input type="number" step={step ?? "1"}
                value={(form as Record<string, number | undefined>)[k] ?? 0}
                onChange={e => set(k as keyof NewCampaignMetric, parseFloat(e.target.value) || 0)}
                className="w-full rounded-xl bg-white/5 text-white text-sm px-3 py-2.5 outline-none"
                style={{ border: "none" }} />
            </div>
          ))}
          <div>
            <label className="block text-xs text-[#b4b4b4] mb-1.5">Investimento (R$)</label>
            <MoneyInput value={form.spend ?? 0} onChange={v => set("spend", v)} />
          </div>
        </div>
        {(cpl > 0 || ctr > 0) && (
          <div className="flex gap-3 p-3 rounded-xl bg-white/5">
            {cpl > 0 && <div className="text-center flex-1"><p className="text-xs text-[#b4b4b4]">CPL</p><p className="text-emerald-400 font-bold">{fmtBRL(cpl)}</p></div>}
            {ctr > 0 && <div className="text-center flex-1"><p className="text-xs text-[#b4b4b4]">CTR</p><p className="text-[#4a8fd4] font-bold">{ctr.toFixed(2)}%</p></div>}
          </div>
        )}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 rounded-xl py-2.5 text-sm font-medium text-[#b4b4b4] hover:text-white bg-white/5 hover:bg-white/10 transition-colors">
            Cancelar
          </button>
          <PrimaryButton onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm">
            {saving ? "Salvando..." : "Lançar Métricas"}
          </PrimaryButton>
        </div>
      </motion.div>
    </div>
  );
}

// ── Status sort icon ──────────────────────────────────────────────────────────

type StatusSortDir = "asc" | "desc" | null;

function StatusSortIcon({ dir }: { dir: StatusSortDir }) {
  if (dir === "asc")  return <ArrowUp   size={11} className="text-[#4a8fd4]" />;
  if (dir === "desc") return <ArrowDown size={11} className="text-[#4a8fd4]" />;
  return <ArrowUpDown size={11} className="text-[#5a5a5a]" />;
}

// ── Main Component ────────────────────────────────────────────────────────────

interface Props {
  year?: number;
  month?: number;
  platformAccountId?: string | null;
}

export function GestaoCampanhas({ platformAccountId }: Props) {
  // ── Period state (internal, persisted to localStorage) ───────────────────────
  const [since, setSince] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_RANGE.since;
    return localStorage.getItem(LS_SINCE) ?? DEFAULT_RANGE.since;
  });
  const [until, setUntil] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_RANGE.until;
    return localStorage.getItem(LS_UNTIL) ?? DEFAULT_RANGE.until;
  });
  const [periodLabel, setPeriodLabel] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_RANGE.label;
    return localStorage.getItem(LS_LABEL) ?? DEFAULT_RANGE.label;
  });

  useEffect(() => {
    localStorage.setItem(LS_SINCE, since);
    localStorage.setItem(LS_UNTIL, until);
    localStorage.setItem(LS_LABEL, periodLabel);
  }, [since, until, periodLabel]);

  const handlePeriodApply = useCallback((s: string, u: string, l: string) => {
    setSince(s);
    setUntil(u);
    setPeriodLabel(l);
  }, []);

  // ── Data hooks ───────────────────────────────────────────────────────────────

  const { campaigns, isLoading, createCampaign, updateCampaign, deleteCampaign } =
    useCampanhas(undefined, platformAccountId);

  const { metrics, upsertMetric, refetch: refetchMetrics } =
    useCampaignMetrics(undefined, since, until);

  const { clients } = useAgencyClients();
  const { connections, syncAccount } = useMetaIntegrations();

  // ── Filter & sort state ───────────────────────────────────────────────────────

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus]   = useState<CampaignStatus | "todos">("todos");
  const [filterPlatform, setFilterPlatform] = useState<CampaignPlatform | "todos">("todos");
  const [statusSort, setStatusSort] = useState<StatusSortDir>("asc"); // default: ativas primeiro

  const cycleStatusSort = () => {
    setStatusSort(d => d === "asc" ? "desc" : d === "desc" ? null : "asc");
  };

  // ── Modals ───────────────────────────────────────────────────────────────────

  const [campaignModal, setCampaignModal] = useState<{ open: boolean; campaign?: Campaign }>({ open: false });
  const [metricsModal, setMetricsModal]   = useState<{ open: boolean; campaign?: Campaign }>({ open: false });
  const [deleting, setDeleting] = useState<string | null>(null);

  // ── Sync ──────────────────────────────────────────────────────────────────────

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const connectedMeta = connections.filter(c => c.status === "connected");

  const handleMetaSync = useCallback(async () => {
    if (!connectedMeta.length || syncing) return;
    setSyncing(true);
    setSyncResult(null);

    const errors: string[] = [];
    for (const acc of connectedMeta) {
      const { error } = await syncAccount(acc.id, since, until);
      if (error) errors.push(error);
    }

    await refetchMetrics();
    setSyncing(false);
    setSyncResult(
      errors.length > 0
        ? { ok: false, msg: errors[0] }
        : { ok: true, msg: `Sincronizado: ${since} → ${until}` }
    );
    setTimeout(() => setSyncResult(null), 5000);
  }, [connectedMeta, syncing, since, until, syncAccount, refetchMetrics]);

  // ── Filtered + sorted campaigns ───────────────────────────────────────────────

  const displayCampaigns = useMemo(() => {
    const filtered = campaigns.filter(c => {
      const matchSearch =
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.client as { name?: string } | undefined)?.name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus   = filterStatus   === "todos" || c.status   === filterStatus;
      const matchPlatform = filterPlatform === "todos" || c.platform === filterPlatform;
      return matchSearch && matchStatus && matchPlatform;
    });

    if (!statusSort) return filtered;

    return [...filtered].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status];
      const pb = STATUS_PRIORITY[b.status];
      return statusSort === "asc" ? pa - pb : pb - pa;
    });
  }, [campaigns, search, filterStatus, filterPlatform, statusSort]);

  // ── Metric aggregator per campaign ───────────────────────────────────────────

  const getMetrics = useCallback((campaignId: string) => {
    const m = metrics.filter(x => x.campaign_id === campaignId);
    if (!m.length) return null;

    const spend       = m.reduce((s, x) => s + Number(x.spend), 0);
    const leads       = m.reduce((s, x) => s + x.leads, 0);
    const conversions = m.reduce((s, x) => s + x.conversions, 0);
    const impressions = m.reduce((s, x) => s + x.impressions, 0);
    const linkClicks  = m.reduce((s, x) => {
      const lc = x.link_clicks ?? 0;
      return s + (lc > 0 ? lc : x.clicks);
    }, 0);

    const hasUniqueCtr = m.some(x => (x.unique_ctr ?? 0) > 0);
    const ctr = hasUniqueCtr
      ? (() => {
          const sumW = m.reduce((s, x) => s + (x.unique_ctr ?? 0) * x.impressions, 0);
          return impressions > 0 ? sumW / impressions : 0;
        })()
      : impressions > 0 ? (linkClicks / impressions) * 100 : 0;

    return {
      spend, leads, conversions, impressions,
      clicks: linkClicks,
      cpl: leads > 0 ? spend / leads : 0,
      ctr,
      ctrIsUnique: hasUniqueCtr,
    };
  }, [metrics]);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleCampaignSave = useCallback(async (data: NewCampaign) => {
    if (campaignModal.campaign) await updateCampaign(campaignModal.campaign.id, data);
    else await createCampaign(data);
    setCampaignModal({ open: false });
  }, [campaignModal.campaign, createCampaign, updateCampaign]);

  const handleMetricsSave = useCallback(async (data: NewCampaignMetric) => {
    await upsertMetric(data);
    setMetricsModal({ open: false });
  }, [upsertMetric]);

  const handleDelete = useCallback(async (id: string) => {
    if (deleting === id) { await deleteCampaign(id); setDeleting(null); }
    else { setDeleting(id); setTimeout(() => setDeleting(null), 3000); }
  }, [deleting, deleteCampaign]);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Sync result toast */}
      <AnimatePresence>
        {syncResult && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border",
              syncResult.ok
                ? "bg-emerald-400/10 border-emerald-400/20 text-emerald-400"
                : "bg-red-400/10 border-red-400/20 text-red-400"
            )}
          >
            {syncResult.ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
            {syncResult.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          {/* Period picker */}
          <PeriodPicker
            since={since}
            until={until}
            label={periodLabel}
            onApply={handlePeriodApply}
          />

          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b4b4b4]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar campanha..."
              className="lc-filter-control rounded-xl pl-8 pr-3 py-2 text-sm outline-none w-52"
            />
          </div>

          {/* Status filter */}
          <div className="relative">
            <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b4b4b4]" />
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as CampaignStatus | "todos")}
              className="lc-filter-control rounded-xl pl-8 pr-3 py-2 text-sm outline-none appearance-none"
            >
              <option value="todos">Status</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>

          {/* Platform filter */}
          <div className="relative">
            <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#b4b4b4]" />
            <select
              value={filterPlatform}
              onChange={e => setFilterPlatform(e.target.value as CampaignPlatform | "todos")}
              className="lc-filter-control rounded-xl pl-8 pr-3 py-2 text-sm outline-none appearance-none"
            >
              <option value="todos">Plataforma</option>
              {Object.entries(PLATFORM_CONFIG).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {connectedMeta.length > 0 && (
            <button
              onClick={handleMetaSync}
              disabled={syncing}
              title={`Sincronizar ${since} → ${until}`}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all",
                syncing ? "text-[#4a8fd4] opacity-60 cursor-not-allowed" : "text-[#4a8fd4] hover:bg-[#4a8fd4]/10"
              )}
              style={{ background: "rgba(74,143,212,0.07)", border: "1px solid rgba(74,143,212,0.20)" }}
            >
              <RefreshCw size={13} className={cn(syncing && "animate-spin")} />
              {syncing ? "Sincronizando…" : "Sync Meta"}
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="lc-card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-[#b4b4b4] text-sm">Carregando campanhas...</div>
        ) : displayCampaigns.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart2 size={40} className="text-[#b4b4b4]/30 mx-auto mb-3" />
            <p className="text-[#b4b4b4] text-sm mb-3">Nenhuma campanha encontrada</p>
            <button
              onClick={() => setCampaignModal({ open: true })}
              className="text-[#4a8fd4] text-sm hover:underline"
            >
              Criar primeira campanha
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  {/* Campanha */}
                  <th className="text-left text-xs text-[#b4b4b4] font-medium px-3 py-3 whitespace-nowrap">
                    Campanha
                  </th>
                  {/* Cliente */}
                  <th className="text-left text-xs text-[#b4b4b4] font-medium px-3 py-3 whitespace-nowrap">
                    Cliente
                  </th>
                  {/* Plataforma */}
                  <th className="text-left text-xs text-[#b4b4b4] font-medium px-3 py-3 whitespace-nowrap">
                    Plataforma
                  </th>
                  {/* Objetivo */}
                  <th className="text-left text-xs text-[#b4b4b4] font-medium px-3 py-3 whitespace-nowrap">
                    Objetivo
                  </th>
                  {/* Status — clicável */}
                  <th className="text-left text-xs font-medium px-3 py-3 whitespace-nowrap">
                    <button
                      onClick={cycleStatusSort}
                      className={cn(
                        "flex items-center gap-1.5 transition-colors group",
                        statusSort
                          ? "text-[#4a8fd4]"
                          : "text-[#b4b4b4] hover:text-white"
                      )}
                      title={
                        statusSort === "asc"  ? "Ativas primeiro — clique para inverter" :
                        statusSort === "desc" ? "Inativas primeiro — clique para resetar" :
                        "Clique para ordenar por status"
                      }
                    >
                      Status
                      <StatusSortIcon dir={statusSort} />
                    </button>
                  </th>
                  {/* Remaining headers */}
                  {[
                    "Orçamento", "Investido", "Impressões", "Cliques (Link)",
                    "CTR Único", "Leads", "CPL", "Resultados", "Início", "",
                  ].map(h => (
                    <th key={h} className="text-left text-xs text-[#b4b4b4] font-medium px-3 py-3 whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <AnimatePresence mode="popLayout">
                  {displayCampaigns.map((c, i) => {
                    const sc = STATUS_CONFIG[c.status];
                    const pc = PLATFORM_CONFIG[c.platform];
                    const m  = getMetrics(c.id);
                    return (
                      <motion.tr
                        key={c.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.02 }}
                        className="border-b hover:bg-white/[0.02] transition-colors"
                        style={{ borderColor: "rgba(255,255,255,0.06)" }}
                      >
                        <td className="px-3 py-3 max-w-[180px]">
                          <p className="text-white font-medium truncate">{c.name}</p>
                        </td>
                        <td className="px-3 py-3 text-[#c7e5ff] whitespace-nowrap max-w-[120px] truncate">
                          {(c.client as { name?: string } | undefined)?.name ?? "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", pc.color)}>
                            {pc.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[#b4b4b4] whitespace-nowrap">
                          {OBJECTIVE_LABELS[c.objective]}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={cn("flex items-center gap-1 w-fit text-xs font-medium px-2 py-0.5 rounded-full border", sc.color)}>
                            {sc.icon}{sc.label}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-[#b4b4b4] whitespace-nowrap">
                          {c.total_budget > 0 ? fmtBRL(c.total_budget) : `${fmtBRL(c.daily_budget)}/d`}
                        </td>
                        <td className="px-3 py-3 font-semibold whitespace-nowrap text-white">
                          {m ? fmtBRL(m.spend) : "—"}
                        </td>
                        <td className="px-3 py-3 text-[#b4b4b4] whitespace-nowrap">
                          {m ? fmtNum(m.impressions) : "—"}
                        </td>
                        <td className="px-3 py-3 text-[#b4b4b4] whitespace-nowrap">
                          {m ? fmtNum(m.clicks) : "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {m ? (
                            <span
                              className={cn(
                                "font-semibold",
                                m.ctr >= 1 ? "text-emerald-400" : m.ctr >= 0.5 ? "text-amber-400" : "text-red-400"
                              )}
                              title={m.ctrIsUnique ? "CTR Único (Meta Ads Manager)" : "Link CTR (link clicks / impressões)"}
                            >
                              {m.ctr.toFixed(2)}%
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-3 text-[#4a8fd4] font-semibold whitespace-nowrap">
                          {m ? fmtNum(m.leads) : "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {m && m.cpl > 0
                            ? <span className="text-white font-semibold">{fmtBRL(m.cpl)}</span>
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-emerald-400 font-semibold whitespace-nowrap">
                          {m
                            ? m.conversions > 0
                              ? fmtNum(m.conversions)
                              : <span className="text-[#5a5a5a] font-normal">—</span>
                            : "—"}
                        </td>
                        <td className="px-3 py-3 text-[#b4b4b4] whitespace-nowrap">
                          {format(parseISO(c.start_date), "dd/MM/yy", { locale: ptBR })}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setMetricsModal({ open: true, campaign: c })}
                              className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-[#4a8fd4] hover:bg-[#4a8fd4]/10 transition-colors"
                              title="Lançar métricas"
                            >
                              <BarChart2 size={13} />
                            </button>
                            <button
                              onClick={() => setCampaignModal({ open: true, campaign: c })}
                              className="p-1.5 rounded-lg text-[#b4b4b4] hover:text-white hover:bg-white/5 transition-colors"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDelete(c.id)}
                              className={cn(
                                "p-1.5 rounded-lg transition-colors",
                                deleting === c.id
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
      </div>

      {/* Modals */}
      <AnimatePresence>
        {campaignModal.open && (
          <CampaignModal
            campaign={campaignModal.campaign}
            clients={clients}
            onClose={() => setCampaignModal({ open: false })}
            onSave={handleCampaignSave}
          />
        )}
        {metricsModal.open && metricsModal.campaign && (
          <MetricsModal
            campaign={metricsModal.campaign}
            onClose={() => setMetricsModal({ open: false })}
            onSave={handleMetricsSave}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
