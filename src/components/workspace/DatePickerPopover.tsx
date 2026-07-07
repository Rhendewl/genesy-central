"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

interface DatePickerPopoverProps {
  value:      string | null; // "yyyy-MM-dd"
  onChange:   (date: string | null) => void;
  placeholder?: string;
  className?: string;
}

function parseISODate(value: string | null): Date | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function DatePickerPopover({ value, onChange, placeholder = "Selecionar data", className }: DatePickerPopoverProps) {
  const selected = parseISODate(value);
  const today = new Date();

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState((selected ?? today).getFullYear());
  const [viewMonth, setViewMonth] = useState((selected ?? today).getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [open]);

  const prevMonth = () => (viewMonth === 0 ? (setViewYear((y) => y - 1), setViewMonth(11)) : setViewMonth((m) => m - 1));
  const nextMonth = () => (viewMonth === 11 ? (setViewYear((y) => y + 1), setViewMonth(0)) : setViewMonth((m) => m + 1));

  const handlePick = (day: number) => {
    onChange(toISODate(new Date(viewYear, viewMonth, day)));
    setOpen(false);
  };

  const handleToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    onChange(toISODate(today));
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setOpen(false);
  };

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();

  const label = selected
    ? selected.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
    : placeholder;

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="lc-filter-control flex h-8 w-full items-center gap-2 rounded-lg px-2.5 text-xs transition-all"
        style={{ color: selected ? "var(--text-title)" : "var(--text-placeholder)" }}
      >
        <Calendar size={13} style={{ color: "var(--icon)", flexShrink: 0 }} />
        <span className="truncate">{label}</span>
      </button>

      {open && (
        <div
          className="lc-modal-panel absolute left-0 top-full z-50 mt-2 overflow-hidden rounded-2xl"
          style={{ width: 260 }}
        >
          <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: "1px solid var(--glass-border)" }}>
            <button onClick={prevMonth} className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-[var(--hover)]">
              <ChevronLeft size={13} style={{ color: "var(--icon)" }} />
            </button>
            <span className="text-xs font-semibold" style={{ color: "var(--text-title)" }}>
              {MONTH_NAMES[viewMonth]} {viewYear}
            </span>
            <button onClick={nextMonth} className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors hover:bg-[var(--hover)]">
              <ChevronRight size={13} style={{ color: "var(--icon)" }} />
            </button>
          </div>

          <div className="px-3 pb-1 pt-2.5">
            <div className="mb-1 grid grid-cols-7">
              {WEEKDAYS.map((d, i) => (
                <div key={i} className="text-center text-[10px] font-medium" style={{ color: "var(--text-placeholder)" }}>
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`e-${i}`} className="h-8" />
              ))}
              {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
                const date = new Date(viewYear, viewMonth, day);
                const isSelected = selected && isSameDay(date, selected);
                const isToday = isSameDay(date, today);
                return (
                  <button
                    key={day}
                    onClick={() => handlePick(day)}
                    className="relative flex h-8 items-center justify-center rounded-lg text-xs transition-colors"
                    style={{
                      background: isSelected ? "var(--tab-active-bg)" : "transparent",
                      color:      isSelected ? "var(--tab-active-text)" : "var(--text-body)",
                      fontWeight: isToday ? 700 : 400,
                    }}
                    onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "var(--hover)"; }}
                    onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                  >
                    {day}
                    {isToday && !isSelected && (
                      <span
                        className="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
                        style={{ background: "var(--accent-blue)" }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between px-3 py-2.5" style={{ borderTop: "1px solid var(--glass-border)" }}>
            <button
              onClick={handleClear}
              className="rounded-lg px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--hover)]"
              style={{ color: "var(--text-body)" }}
            >
              Limpar
            </button>
            <button
              onClick={handleToday}
              className="rounded-lg px-2 py-1 text-[11px] font-medium transition-colors hover:bg-[var(--hover)]"
              style={{ color: "var(--accent-blue)" }}
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
