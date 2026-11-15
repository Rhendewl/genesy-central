"use client";
import { DateRangeCalendar } from "@/components/ui/DateInput";

import { useState, useRef, useEffect } from "react";
import { Calendar, Monitor, Smartphone, Tablet, X } from "lucide-react";

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

const RangeCalendar = DateRangeCalendar;

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
                background: active ? "var(--tab-active-bg)" : "var(--shimmer-base)",
                color:      active ? "var(--tab-active-text)" : "var(--muted-foreground)",
                border:     `1px solid ${active ? "var(--tab-active-bg)" : "var(--border)"}`,
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
            background: (isCustom || calOpen) ? "var(--primary)" : "var(--shimmer-base)",
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
              className="ml-0.5 p-0.5 rounded hover:bg-[var(--hover)] leading-none"
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
                background: active ? "var(--border-card-drag)" : "transparent",
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
