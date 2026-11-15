"use client";
import { DateRangeCalendar } from "@/components/ui/DateInput";

import { useState, useRef, useEffect } from "react";
import { Calendar, X } from "lucide-react";

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

const RangeCalendar = DateRangeCalendar;

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
              background: active ? "var(--tab-active-bg)" : "var(--hover)",
              color:      active ? "var(--tab-active-text)" : "var(--muted-foreground)",
              border:     `1px solid ${active ? "var(--tab-active-bg)" : "var(--border)"}`,
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
          background: (isCustom || calendarOpen) ? "var(--primary)" : "var(--hover)",
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
            className="ml-0.5 rounded hover:bg-[var(--hover)] p-0.5 leading-none"
          >
            <X size={10} />
          </span>
        )}
      </button>

      {/* Active filter clear (when a preset is active) */}
      {activePreset && (
        <button
          onClick={clearFilter}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-colors hover:bg-[var(--hover)]"
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
