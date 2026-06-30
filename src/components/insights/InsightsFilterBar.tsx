"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, Monitor, Smartphone, Tablet, X } from "lucide-react";

export interface InsightsPeriod {
  since?: string;
  until?: string;
}

export type DeviceFilter = "todos" | "desktop" | "mobile" | "tablet";

interface InsightsFilterBarProps {
  period:        InsightsPeriod;
  device:        DeviceFilter;
  onPeriod:      (v: InsightsPeriod) => void;
  onDevice:      (v: DeviceFilter) => void;
}

// ── Presets ───────────────────────────────────────────────────────────────────

type PresetId = "hoje" | "ontem" | "7d" | "30d" | "90d" | "todos";

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "hoje",   label: "Hoje"     },
  { id: "ontem",  label: "Ontem"    },
  { id: "7d",     label: "7 dias"   },
  { id: "30d",    label: "30 dias"  },
  { id: "90d",    label: "90 dias"  },
  { id: "todos",  label: "Todos"    },
];

const DEVICES: { id: DeviceFilter; label: string; icon?: React.ReactNode }[] = [
  { id: "todos",   label: "Todos dispositivos" },
  { id: "desktop", label: "Desktop", icon: <Monitor  size={12} /> },
  { id: "mobile",  label: "Mobile",  icon: <Smartphone size={12} /> },
  { id: "tablet",  label: "Tablet",  icon: <Tablet   size={12} /> },
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function presetToPeriod(id: PresetId): InsightsPeriod {
  const today = startOfDay(new Date());
  switch (id) {
    case "hoje":
      return { since: today.toISOString(), until: endOfDay(today).toISOString() };
    case "ontem": {
      const y = new Date(today.getTime() - 86_400_000);
      return { since: y.toISOString(), until: endOfDay(y).toISOString() };
    }
    case "7d":
      return { since: new Date(today.getTime() - 6  * 86_400_000).toISOString() };
    case "30d":
      return { since: new Date(today.getTime() - 29 * 86_400_000).toISOString() };
    case "90d":
      return { since: new Date(today.getTime() - 89 * 86_400_000).toISOString() };
    case "todos":
      return {};
  }
}

function matchesPreset(p: InsightsPeriod, id: PresetId): boolean {
  const ref = presetToPeriod(id);
  if (id === "todos") return !p.since && !p.until;
  return p.since === ref.since && (p.until ?? undefined) === (p.until ?? undefined)
    && p.since === ref.since;
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ── Calendar ──────────────────────────────────────────────────────────────────

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth()    === b.getMonth() &&
    a.getDate()     === b.getDate();
}

function RangeCalendar({
  from, to, onApply, onCancel,
}: {
  from: Date | null;
  to: Date | null;
  onApply: (from: Date, to: Date) => void;
  onCancel: () => void;
}) {
  const now = new Date();
  const [viewYear,  setViewYear]  = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [lFrom,     setLFrom]     = useState<Date | null>(from);
  const [lTo,       setLTo]       = useState<Date | null>(to);
  const [phase,     setPhase]     = useState<"from" | "to">("from");
  const [hovered,   setHovered]   = useState<Date | null>(null);

  const prevMonth = () => viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1);

  const handleDay = (day: number) => {
    const d = startOfDay(new Date(viewYear, viewMonth, day));
    if (phase === "from") { setLFrom(d); setLTo(null); setPhase("to"); }
    else {
      if (lFrom && d < lFrom) { setLTo(lFrom); setLFrom(d); }
      else setLTo(d);
      setPhase("from");
    }
  };

  const days  = new Date(viewYear, viewMonth + 1, 0).getDate();
  const off   = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const rEnd  = phase === "to" && hovered && lFrom ? (hovered < lFrom ? lFrom : hovered) : lTo;
  const rStart = phase === "to" && hovered && lFrom && hovered < lFrom ? hovered : lFrom;

  const inRange  = (d: number) => { const dt = new Date(viewYear, viewMonth, d); return rStart && rEnd ? dt > rStart && dt < rEnd : false; };
  const isFrom   = (d: number) => lFrom && isSameDay(new Date(viewYear, viewMonth, d), lFrom);
  const isTo     = (d: number) => lTo   && isSameDay(new Date(viewYear, viewMonth, d), lTo);
  const isToday  = (d: number) => d === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
  const isSel    = (d: number) => isFrom(d) || isTo(d);

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <div className="rounded-xl shadow-xl overflow-hidden" style={{ background: "var(--card)", border: "1px solid var(--border)", minWidth: 280 }}>
      <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
        <button onClick={prevMonth} className="p-1 rounded hover:bg-white/10 transition-colors">
          <ChevronLeft size={13} style={{ color: "var(--muted-foreground)" }} />
        </button>
        <span className="text-xs font-semibold capitalize" style={{ color: "var(--text-title)" }}>{monthLabel}</span>
        <button onClick={nextMonth} className="p-1 rounded hover:bg-white/10 transition-colors">
          <ChevronRight size={13} style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>
      <div className="px-3 pt-2 pb-1">
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((d, i) => (
            <div key={i} className="text-center text-[10px] py-1" style={{ color: "var(--muted-foreground)" }}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: off }).map((_, i) => <div key={`e-${i}`} className="h-8" />)}
          {Array.from({ length: days }, (_, i) => i + 1).map(d => {
            const sel   = isSel(d);
            const range = inRange(d);
            const from_ = isFrom(d);
            const to_   = isTo(d);
            let bg = "transparent", color = "var(--muted-foreground)", br = "6px";
            if (sel)        { bg = "var(--primary)"; color = "#fff"; }
            else if (range) { bg = "rgba(255,255,255,0.07)"; color = "var(--text-title)"; br = "0"; }
            if (from_ && lTo)   br = "6px 0 0 6px";
            if (to_   && lFrom) br = "0 6px 6px 0";
            return (
              <button
                key={d}
                onClick={() => handleDay(d)}
                onMouseEnter={() => phase === "to" && setHovered(new Date(viewYear, viewMonth, d))}
                onMouseLeave={() => setHovered(null)}
                className="relative h-8 flex items-center justify-center text-xs transition-colors"
                style={{ background: bg, color, borderRadius: br, fontWeight: isToday(d) ? 600 : 400 }}
              >
                {d}
                {isToday(d) && !sel && (
                  <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: "var(--primary)" }} />
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="px-4 py-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        {phase === "from" || !lFrom ? "Selecione a data inicial"
          : lTo ? `${fmtShort(lFrom.toISOString())} → ${fmtShort(lTo.toISOString())}`
          : "Selecione a data final"}
      </div>
      <div className="flex items-center justify-end gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border)" }}>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5" style={{ color: "var(--muted-foreground)" }}>
          Cancelar
        </button>
        <button
          disabled={!lFrom || !lTo}
          onClick={() => lFrom && lTo && onApply(lFrom, lTo)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

// ── InsightsFilterBar ─────────────────────────────────────────────────────────

export function InsightsFilterBar({ period, device, onPeriod, onDevice }: InsightsFilterBarProps) {
  const [calOpen, setCalOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setCalOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, []);

  const activePreset = PRESETS.find(p => matchesPreset(period, p.id)) ?? null;
  const isCustom     = !activePreset && (period.since || period.until);

  const handlePreset = (id: PresetId) => {
    onPeriod(presetToPeriod(id));
    setCalOpen(false);
  };

  const handleApply = (from: Date, to: Date) => {
    onPeriod({ since: from.toISOString(), until: endOfDay(to).toISOString() });
    setCalOpen(false);
  };

  return (
    <div ref={ref} className="flex flex-wrap items-center gap-2 relative">
      {/* Period presets */}
      <div className="flex items-center gap-1 flex-wrap">
        {PRESETS.map(p => {
          const active = activePreset?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => handlePreset(p.id)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
              style={{
                background: active ? "var(--primary)" : "rgba(255,255,255,0.05)",
                color:      active ? "#fff" : "var(--muted-foreground)",
                border:     `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
              }}
            >
              {p.label}
            </button>
          );
        })}

        {/* Custom range */}
        <button
          onClick={() => setCalOpen(o => !o)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
          style={{
            background: (isCustom || calOpen) ? "var(--primary)" : "rgba(255,255,255,0.05)",
            color:      (isCustom || calOpen) ? "#fff" : "var(--muted-foreground)",
            border:     `1px solid ${(isCustom || calOpen) ? "var(--primary)" : "var(--border)"}`,
          }}
        >
          <Calendar size={11} />
          {isCustom && period.since
            ? `${fmtShort(period.since)}${period.until ? ` → ${fmtShort(period.until)}` : ""}`
            : "Personalizado"}
          {isCustom && (
            <span
              onClick={e => { e.stopPropagation(); onPeriod({}); }}
              className="ml-0.5 p-0.5 rounded hover:bg-white/20 leading-none"
            >
              <X size={10} />
            </span>
          )}
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 hidden sm:block" style={{ background: "var(--border)" }} />

      {/* Device filter */}
      <div className="flex items-center gap-1">
        {DEVICES.map(d => {
          const active = device === d.id;
          return (
            <button
              key={d.id}
              onClick={() => onDevice(d.id)}
              title={d.label}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
              style={{
                background: active ? "rgba(255,255,255,0.10)" : "transparent",
                color:      active ? "var(--text-title)" : "var(--muted-foreground)",
                border:     `1px solid ${active ? "var(--border)" : "transparent"}`,
              }}
            >
              {d.icon ?? null}
              <span className={d.id === "todos" ? undefined : "hidden sm:inline"}>{d.label}</span>
            </button>
          );
        })}
      </div>

      {/* Calendar dropdown */}
      {calOpen && (
        <div className="absolute top-full left-0 mt-2 z-50">
          <RangeCalendar
            from={period.since ? new Date(period.since) : null}
            to={period.until ? new Date(period.until) : null}
            onApply={handleApply}
            onCancel={() => setCalOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
