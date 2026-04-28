"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, ChevronDown, X } from "lucide-react";
import {
  startOfDay, endOfDay,
  subDays, subMonths,
  startOfMonth,
  format,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

// ─── Public types (consumed by KanbanBoard + useLeads) ───────────────────────

export type PeriodPreset =
  | "todos"
  | "hoje"
  | "data_especifica"
  | "ultimos_7"
  | "ultimos_30"
  | "ultimos_3_meses"
  | "este_mes"
  | "personalizado";

export interface DateFilter {
  from:  Date;
  to:    Date;
  // Prepared for future: "updated_at" | "entered_at"
  field: "created_at";
}

// ─── Date range calculator ────────────────────────────────────────────────────

export function getDateRange(
  preset:      PeriodPreset,
  specificDate?: string, // YYYY-MM-DD
  customFrom?:   string, // YYYY-MM-DD
  customTo?:     string, // YYYY-MM-DD
): DateFilter | null {
  const now = new Date();

  switch (preset) {
    case "todos":
      return null;

    case "hoje":
      return { from: startOfDay(now), to: endOfDay(now), field: "created_at" };

    case "data_especifica": {
      if (!specificDate) return null;
      const d = new Date(specificDate + "T00:00:00");
      return { from: startOfDay(d), to: endOfDay(d), field: "created_at" };
    }

    case "ultimos_7":
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now), field: "created_at" };

    case "ultimos_30":
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now), field: "created_at" };

    case "ultimos_3_meses":
      return { from: startOfDay(subMonths(now, 3)), to: endOfDay(now), field: "created_at" };

    case "este_mes":
      return { from: startOfMonth(now), to: endOfDay(now), field: "created_at" };

    case "personalizado": {
      if (!customFrom || !customTo) return null;
      const from = new Date(customFrom + "T00:00:00");
      const to   = new Date(customTo   + "T00:00:00");
      if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return null;
      return { from: startOfDay(from), to: endOfDay(to), field: "created_at" };
    }
  }
}

// ─── Label formatter ──────────────────────────────────────────────────────────

export function presetLabel(
  preset:        PeriodPreset,
  specificDate?: string,
  customFrom?:   string,
  customTo?:     string,
): string {
  switch (preset) {
    case "todos":          return "Todos os períodos";
    case "hoje":           return "Hoje";
    case "ultimos_7":      return "Últimos 7 dias";
    case "ultimos_30":     return "Últimos 30 dias";
    case "ultimos_3_meses":return "Últimos 3 meses";
    case "este_mes":       return "Este mês";
    case "data_especifica":
      if (specificDate) {
        return format(new Date(specificDate + "T00:00:00"), "dd/MM/yyyy", { locale: ptBR });
      }
      return "Data específica";
    case "personalizado":
      if (customFrom && customTo) {
        const f = format(new Date(customFrom + "T00:00:00"), "dd/MM", { locale: ptBR });
        const t = format(new Date(customTo   + "T00:00:00"), "dd/MM", { locale: ptBR });
        return `${f} – ${t}`;
      }
      return "Personalizado";
  }
}

// ─── Session storage helpers ──────────────────────────────────────────────────

const STORAGE_KEY = "crm_period_filter";

interface StoredPeriod {
  preset:        PeriodPreset;
  specificDate?: string;
  customFrom?:   string;
  customTo?:     string;
}

function loadFromSession(): StoredPeriod {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as StoredPeriod;
  } catch {}
  return { preset: "todos" };
}

function saveToSession(state: StoredPeriod) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

// ─── Option list ──────────────────────────────────────────────────────────────

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "todos",           label: "Todos os períodos" },
  { id: "hoje",            label: "Hoje" },
  { id: "data_especifica", label: "Data específica" },
  { id: "ultimos_7",       label: "Últimos 7 dias" },
  { id: "ultimos_30",      label: "Últimos 30 dias" },
  { id: "ultimos_3_meses", label: "Últimos 3 meses" },
  { id: "este_mes",        label: "Este mês" },
  { id: "personalizado",   label: "Personalizado" },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface PeriodFilterProps {
  onChange: (filter: DateFilter | null) => void;
}

export function PeriodFilter({ onChange }: PeriodFilterProps) {
  const saved = loadFromSession();

  const [preset,       setPreset]       = useState<PeriodPreset>(saved.preset);
  const [specificDate, setSpecificDate] = useState(saved.specificDate ?? "");
  const [customFrom,   setCustomFrom]   = useState(saved.customFrom  ?? "");
  const [customTo,     setCustomTo]     = useState(saved.customTo    ?? "");
  const [open, setOpen]                 = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const today = format(new Date(), "yyyy-MM-dd");

  // ── Notify parent whenever the effective filter changes ──────────────────────
  useEffect(() => {
    const filter = getDateRange(preset, specificDate, customFrom, customTo);
    onChange(filter);
    saveToSession({ preset, specificDate, customFrom, customTo });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, specificDate, customFrom, customTo]);

  // ── Close on outside click ───────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const selectPreset = useCallback((p: PeriodPreset) => {
    setPreset(p);
    // Close immediately for simple presets that need no date input
    if (p !== "data_especifica" && p !== "personalizado") {
      setOpen(false);
    }
  }, []);

  const isActive = preset !== "todos";
  const label    = presetLabel(preset, specificDate || undefined, customFrom || undefined, customTo || undefined);

  const needsSpecificDate = preset === "data_especifica";
  const needsCustomRange  = preset === "personalizado";
  const showDateInputs    = open && (needsSpecificDate || needsCustomRange);

  return (
    <div ref={containerRef} className="relative">
      {/* ── Trigger button ────────────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-95 select-none",
          isActive
            ? "text-white"
            : "text-[#b4b4b4] hover:text-white",
        )}
        style={{
          background: isActive
            ? "rgba(99,102,241,0.15)"
            : "rgba(255,255,255,0.05)",
          border: isActive
            ? "1px solid rgba(99,102,241,0.35)"
            : "1px solid rgba(255,255,255,0.10)",
        }}
      >
        <Calendar size={13} className={isActive ? "text-indigo-400" : ""} />
        <span className="hidden sm:inline max-w-[130px] truncate">{label}</span>
        <ChevronDown
          size={12}
          className={cn("transition-transform duration-200", open && "rotate-180")}
        />
        {isActive && (
          <span
            onClick={e => {
              e.stopPropagation();
              setPreset("todos");
              setSpecificDate("");
              setCustomFrom("");
              setCustomTo("");
              setOpen(false);
            }}
            className="ml-0.5 rounded-full p-0.5 text-indigo-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={10} />
          </span>
        )}
      </button>

      {/* ── Dropdown panel ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 z-40 min-w-[220px] rounded-2xl overflow-hidden"
            style={{
              background: "rgba(8,8,12,0.92)",
              backdropFilter: "blur(24px) saturate(160%)",
              WebkitBackdropFilter: "blur(24px) saturate(160%)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.60), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* Options */}
            <div className="p-1.5">
              {PRESETS.map(opt => {
                const isSelected = preset === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => selectPreset(opt.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-xl text-sm transition-all flex items-center justify-between gap-2",
                      isSelected
                        ? "text-white font-medium"
                        : "text-[#b4b4b4] hover:text-white hover:bg-white/[0.06]",
                    )}
                    style={isSelected ? {
                      background: "rgba(99,102,241,0.18)",
                    } : {}}
                  >
                    {opt.label}
                    {isSelected && (
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Date inputs — shown inline when a date-based preset is active */}
            {showDateInputs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div
                  className="px-3 pb-3 pt-2 space-y-2"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
                >
                  {needsSpecificDate && (
                    <div>
                      <label className="block text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-widest mb-1.5">
                        Data
                      </label>
                      <input
                        type="date"
                        max={today}
                        value={specificDate}
                        onChange={e => setSpecificDate(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none lc-filter-control"
                        style={{ colorScheme: "dark" }}
                      />
                    </div>
                  )}

                  {needsCustomRange && (
                    <>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-widest mb-1.5">
                          De
                        </label>
                        <input
                          type="date"
                          max={customTo || today}
                          value={customFrom}
                          onChange={e => setCustomFrom(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none lc-filter-control"
                          style={{ colorScheme: "dark" }}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-[#5a5a5a] uppercase tracking-widest mb-1.5">
                          Até
                        </label>
                        <input
                          type="date"
                          min={customFrom || undefined}
                          max={today}
                          value={customTo}
                          onChange={e => setCustomTo(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none lc-filter-control"
                          style={{ colorScheme: "dark" }}
                        />
                      </div>
                      {customFrom && customTo && (
                        <button
                          onClick={() => setOpen(false)}
                          className="w-full py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                          style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.35)" }}
                        >
                          Aplicar período
                        </button>
                      )}
                    </>
                  )}

                  {needsSpecificDate && specificDate && (
                    <button
                      onClick={() => setOpen(false)}
                      className="w-full py-2 rounded-xl text-xs font-semibold text-white transition-all hover:opacity-90"
                      style={{ background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.35)" }}
                    >
                      Aplicar data
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
