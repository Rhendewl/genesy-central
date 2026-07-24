"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { addMonths, format, isSameDay, startOfDay, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { normalizeSelectedRange } from "./crm-report-range";

const WEEKDAYS = ["S", "T", "Q", "Q", "S", "S", "D"];

interface CrmReportRangePickerProps {
  from: Date;
  to: Date;
  isCustom: boolean;
  onChange: (from: Date, to: Date) => void;
}

export function CrmReportRangePicker({ from, to, isCustom, onChange }: CrmReportRangePickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(startOfMonth(from));
  const [draftFrom, setDraftFrom] = useState<Date | null>(from);
  const [draftTo, setDraftTo] = useState<Date | null>(to);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const [hoveredDay, setHoveredDay] = useState<Date | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const openCalendar = () => {
    setVisibleMonth(startOfMonth(from));
    setDraftFrom(from);
    setDraftTo(to);
    setSelectingEnd(false);
    setHoveredDay(null);
    setOpen(current => !current);
  };

  const selectDay = (day: Date) => {
    if (!selectingEnd || !draftFrom) {
      setDraftFrom(startOfDay(day));
      setDraftTo(null);
      setSelectingEnd(true);
      return;
    }

    const selected = normalizeSelectedRange(draftFrom, day);
    setDraftFrom(selected.from);
    setDraftTo(selected.to);
    setSelectingEnd(false);
    setHoveredDay(null);
    onChange(selected.from, selected.to);
    setOpen(false);
  };

  const days = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const mondayOffset = firstWeekday === 0 ? 6 : firstWeekday - 1;
    const totalDays = new Date(year, month + 1, 0).getDate();
    return [
      ...Array.from({ length: mondayOffset }, () => null),
      ...Array.from({ length: totalDays }, (_, index) => new Date(year, month, index + 1)),
    ];
  }, [visibleMonth]);

  const preview = useMemo(() => {
    if (!draftFrom) return { from: null, to: null };
    if (selectingEnd && hoveredDay) return normalizeSelectedRange(draftFrom, hoveredDay);
    return { from: draftFrom, to: draftTo };
  }, [draftFrom, draftTo, hoveredDay, selectingEnd]);

  const label = `${format(from, "dd/MM/yyyy")} - ${format(to, "dd/MM/yyyy")}`;

  return (
    <div ref={rootRef} className="relative z-[60] min-w-0">
      <button
        type="button"
        onClick={openCalendar}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="lc-filter-control flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors"
        style={{ borderColor: open || isCustom ? "var(--border-card-hover)" : undefined }}
      >
        <CalendarDays size={15} className="shrink-0" style={{ color: "var(--icon)" }} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        <span className="hidden text-[10px] sm:inline" style={{ color: "var(--muted-foreground)" }}>
          {isCustom ? "Personalizado" : "Alterar"}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Selecionar período do relatório"
          className="lc-modal-panel absolute left-0 top-full z-[80] mt-2 w-[min(320px,calc(100vw-2rem))] overflow-hidden rounded-2xl"
        >
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border-card)" }}>
            <button
              type="button"
              onClick={() => setVisibleMonth(month => addMonths(month, -1))}
              aria-label="Mês anterior"
              className="rounded-lg p-2 transition-colors hover:bg-[var(--hover)]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-center">
              <p className="text-sm font-semibold capitalize" style={{ color: "var(--text-title)" }}>
                {format(visibleMonth, "MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                {selectingEnd ? "Agora selecione a data final" : "Selecione a data inicial"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setVisibleMonth(month => addMonths(month, 1))}
              aria-label="Próximo mês"
              className="rounded-lg p-2 transition-colors hover:bg-[var(--hover)]"
              style={{ color: "var(--muted-foreground)" }}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="p-3">
            <div className="mb-1 grid grid-cols-7">
              {WEEKDAYS.map((weekday, index) => (
                <span key={`${weekday}-${index}`} className="py-1 text-center text-[10px] font-semibold" style={{ color: "var(--muted-foreground)" }}>
                  {weekday}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-1">
              {days.map((day, index) => {
                if (!day) return <span key={`empty-${index}`} className="h-9" />;
                const isStart = !!preview.from && isSameDay(day, preview.from);
                const isEnd = !!preview.to && isSameDay(day, preview.to);
                const inRange = !!preview.from && !!preview.to && day > preview.from && day < preview.to;
                const endpoint = isStart || isEnd;
                const today = isSameDay(day, new Date());
                const hasRange = !!preview.from && !!preview.to && !isSameDay(preview.from, preview.to);
                const rangeColor = "color-mix(in srgb, var(--primary) 18%, transparent)";
                const rangeBackground = inRange
                  ? rangeColor
                  : isStart && hasRange
                    ? `linear-gradient(to right, transparent 50%, ${rangeColor} 50%)`
                    : isEnd && hasRange
                      ? `linear-gradient(to right, ${rangeColor} 50%, transparent 50%)`
                      : "transparent";

                return (
                  <button
                    type="button"
                    key={day.toISOString()}
                    onClick={() => selectDay(day)}
                    onMouseEnter={() => selectingEnd && setHoveredDay(day)}
                    onFocus={() => selectingEnd && setHoveredDay(day)}
                    aria-label={format(day, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    aria-pressed={endpoint || inRange}
                    className="relative flex h-9 items-center justify-center text-xs transition-colors focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)]"
                    style={{
                      color: endpoint ? "var(--primary-foreground)" : "var(--text-title)",
                      background: rangeBackground,
                    }}
                  >
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg"
                      style={{
                        background: endpoint ? "var(--primary)" : undefined,
                        boxShadow: today && !endpoint ? "inset 0 0 0 1px var(--border-card-hover)" : undefined,
                        fontWeight: endpoint || today ? 600 : 400,
                      }}
                    >
                      {day.getDate()}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: "1px solid var(--border-card)", background: "var(--hover)" }}>
            <CalendarDays size={13} style={{ color: "var(--icon)" }} />
            <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
              {selectingEnd && draftFrom
                ? `Início: ${format(draftFrom, "dd/MM/yyyy")} · escolha o fim`
                : "Clique em duas datas para definir o período"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
