"use client";

import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";

export interface PeriodFilter {
  since?: string;
  until?: string;
}

interface FilterBarProps {
  value: PeriodFilter;
  onChange: (v: PeriodFilter) => void;
}

type PresetId = "today" | "yesterday" | "7d" | "30d" | "month";

const PRESETS: { id: PresetId; label: string }[] = [
  { id: "today",     label: "Hoje" },
  { id: "yesterday", label: "Ontem" },
  { id: "7d",        label: "Últimos 7 dias" },
  { id: "30d",       label: "Últimos 30 dias" },
  { id: "month",     label: "Este mês" },
];

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function presetToFilter(id: PresetId): PeriodFilter {
  const today = startOfDay(new Date());
  switch (id) {
    case "today":
      return { since: today.toISOString(), until: endOfDay(today).toISOString() };
    case "yesterday": {
      const y = new Date(today.getTime() - 86_400_000);
      return { since: y.toISOString(), until: endOfDay(y).toISOString() };
    }
    case "7d":
      return { since: new Date(today.getTime() - 6 * 86_400_000).toISOString() };
    case "30d":
      return { since: new Date(today.getTime() - 29 * 86_400_000).toISOString() };
    case "month":
      return { since: new Date(today.getFullYear(), today.getMonth(), 1).toISOString() };
  }
}

function filterMatchesPreset(f: PeriodFilter, id: PresetId): boolean {
  const p = presetToFilter(id);
  return f.since === p.since && (f.until ?? undefined) === (p.until ?? undefined);
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ── Calendar ──────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function RangeCalendar({
  from, to, onApply, onCancel,
}: {
  from: Date | null;
  to: Date | null;
  onApply: (from: Date, to: Date) => void;
  onCancel: () => void;
}) {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [localFrom, setLocalFrom] = useState<Date | null>(from);
  const [localTo,   setLocalTo]   = useState<Date | null>(to);
  const [picking,   setPicking]   = useState<"from" | "to">("from");
  const [hovered,   setHovered]   = useState<Date | null>(null);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const handleDay = (day: number) => {
    const d = startOfDay(new Date(viewYear, viewMonth, day));
    if (picking === "from" || !localFrom) {
      setLocalFrom(d);
      setLocalTo(null);
      setPicking("to");
    } else {
      if (d < localFrom) {
        setLocalFrom(d);
        setLocalTo(localFrom);
      } else {
        setLocalTo(d);
      }
      setPicking("from");
    }
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const offset      = (firstDow === 0 ? 6 : firstDow - 1); // Mon=0

  const rangeEnd = picking === "to" && hovered && localFrom
    ? (hovered < localFrom ? localFrom : hovered)
    : localTo;
  const rangeStart = picking === "to" && hovered && localFrom && hovered < localFrom
    ? hovered : localFrom;

  const isInRange = (day: number): boolean => {
    const d = new Date(viewYear, viewMonth, day);
    if (!rangeStart || !rangeEnd) return false;
    return d > rangeStart && d < rangeEnd;
  };
  const isFrom = (day: number) => localFrom && isSameDay(new Date(viewYear, viewMonth, day), localFrom);
  const isTo   = (day: number) => localTo   && isSameDay(new Date(viewYear, viewMonth, day), localTo);
  const isSelected = (day: number) => isFrom(day) || isTo(day);
  const isToday = (day: number) =>
    day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("pt-BR", {
    month: "long", year: "numeric",
  });

  const canApply = localFrom !== null && localTo !== null;

  return (
    <div
      className="rounded-xl shadow-xl overflow-hidden"
      style={{ background: "var(--card)", border: "1px solid var(--border)", minWidth: 288 }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <button
          onClick={prevMonth}
          className="p-1 rounded-lg transition-colors hover:bg-white/10"
        >
          <ChevronLeft size={14} style={{ color: "var(--muted-foreground)" }} />
        </button>
        <span className="text-xs font-semibold capitalize" style={{ color: "var(--text-title)" }}>
          {monthLabel}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 rounded-lg transition-colors hover:bg-white/10"
        >
          <ChevronRight size={14} style={{ color: "var(--muted-foreground)" }} />
        </button>
      </div>

      {/* Grid */}
      <div className="px-3 pt-2 pb-1">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[10px] py-1 font-medium" style={{ color: "var(--muted-foreground)" }}>
              {d.slice(0, 1)}
            </div>
          ))}
        </div>

        {/* Days */}
        <div className="grid grid-cols-7">
          {Array.from({ length: offset }).map((_, i) => <div key={`e-${i}`} className="h-8" />)}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
            const sel   = isSelected(day);
            const range = isInRange(day);
            const from_ = isFrom(day);
            const to_   = isTo(day);

            let bg = "transparent";
            let color = "var(--muted-foreground)";
            let br = "6px";

            if (sel) {
              bg = "var(--primary)";
              color = "#fff";
            } else if (range) {
              bg = "rgba(var(--primary-rgb, 99,102,241),0.12)";
              color = "var(--text-title)";
              br = from_ ? "6px 0 0 6px" : to_ ? "0 6px 6px 0" : "0";
            }

            if (from_ && localTo) br = "6px 0 0 6px";
            if (to_   && localFrom) br = "0 6px 6px 0";

            return (
              <button
                key={day}
                onClick={() => handleDay(day)}
                onMouseEnter={() => picking === "to" && setHovered(new Date(viewYear, viewMonth, day))}
                onMouseLeave={() => setHovered(null)}
                className="relative h-8 flex items-center justify-center text-xs transition-colors"
                style={{ background: bg, color, borderRadius: br, fontWeight: isToday(day) ? 600 : 400 }}
              >
                {day}
                {isToday(day) && !sel && (
                  <span
                    className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
                    style={{ background: "var(--primary)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Hint */}
      <div className="px-4 py-2 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
        {picking === "from" || !localFrom
          ? "Selecione a data inicial"
          : localTo
          ? `${fmtShort(localFrom.toISOString())} → ${fmtShort(localTo.toISOString())}`
          : "Selecione a data final"}
      </div>

      {/* Actions */}
      <div
        className="flex items-center justify-end gap-2 px-4 py-3"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <button
          onClick={onCancel}
          className="px-3 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5"
          style={{ color: "var(--muted-foreground)" }}
        >
          Cancelar
        </button>
        <button
          disabled={!canApply}
          onClick={() => canApply && onApply(localFrom!, localTo!)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 disabled:opacity-40"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}

// ── FilterBar ─────────────────────────────────────────────────────────────────

export function FilterBar({ value, onChange }: FilterBarProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const activePreset = PRESETS.find(p => filterMatchesPreset(value, p.id)) ?? null;
  const isCustom = !activePreset && (value.since || value.until);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setCalendarOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handlePreset = (id: PresetId) => {
    if (activePreset?.id === id) {
      onChange({});
    } else {
      onChange(presetToFilter(id));
    }
    setCalendarOpen(false);
  };

  const handleApply = (from: Date, to: Date) => {
    onChange({ since: from.toISOString(), until: endOfDay(to).toISOString() });
    setCalendarOpen(false);
  };

  const clearFilter = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange({});
    setCalendarOpen(false);
  };

  return (
    <div ref={ref} className="relative flex items-center gap-1.5 flex-wrap">
      {/* Preset pills */}
      {PRESETS.map(preset => {
        const active = activePreset?.id === preset.id;
        return (
          <button
            key={preset.id}
            onClick={() => handlePreset(preset.id)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
            style={{
              background: active ? "var(--primary)" : "rgba(255,255,255,0.05)",
              color:      active ? "#fff" : "var(--muted-foreground)",
              border:     `1px solid ${active ? "var(--primary)" : "var(--border)"}`,
            }}
          >
            {preset.label}
          </button>
        );
      })}

      {/* Custom range pill / button */}
      <button
        onClick={() => setCalendarOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors"
        style={{
          background: (isCustom || calendarOpen) ? "var(--primary)" : "rgba(255,255,255,0.05)",
          color:      (isCustom || calendarOpen) ? "#fff" : "var(--muted-foreground)",
          border:     `1px solid ${(isCustom || calendarOpen) ? "var(--primary)" : "var(--border)"}`,
        }}
      >
        <Calendar size={12} />
        {isCustom && value.since
          ? `${fmtShort(value.since)}${value.until ? ` → ${fmtShort(value.until)}` : ""}`
          : "Personalizado"}
        {isCustom && (
          <span
            onClick={clearFilter}
            className="ml-0.5 rounded hover:bg-white/20 p-0.5 leading-none"
          >
            <X size={10} />
          </span>
        )}
      </button>

      {/* Active filter clear (when a preset is active) */}
      {activePreset && (
        <button
          onClick={clearFilter}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-white/5"
          style={{ color: "var(--muted-foreground)" }}
        >
          <X size={11} />
          Limpar
        </button>
      )}

      {/* Calendar dropdown */}
      {calendarOpen && (
        <div className="absolute top-full left-0 mt-2 z-50">
          <RangeCalendar
            from={value.since ? new Date(value.since) : null}
            to={value.until ? new Date(value.until) : null}
            onApply={handleApply}
            onCancel={() => setCalendarOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
