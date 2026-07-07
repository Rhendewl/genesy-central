"use client";

import { formatDayStripLabel } from "@/lib/booking-widget/format";

// ─────────────────────────────────────────────────────────────────────────────
// Faixa de dias do widget de agendamento — substitui a grade de mês por até 5
// cartões (próximos dias disponíveis a partir de hoje, sem navegação),
// compartilhada entre /agendar/[slug] e o bloco Calendário do formulário.
//
// Cores de fundo/texto vêm de fora (cada consumidor segue seu próprio tema —
// tema do formulário no bloco embutido, estilo da própria página no
// /agendar/[slug]); só a cor de destaque (seleção) é a "color" configurada.
// ─────────────────────────────────────────────────────────────────────────────

export interface BookingDayStripProps {
  visibleDays:  string[];
  selectedDate: string | null;
  today:        string;
  color:        string;
  cardBg:       string;
  borderC:      string;
  textColor:    string;
  muted:        string;
  onSelectDate: (dateStr: string) => void;
}

export function BookingDayStrip({
  visibleDays, selectedDate, today, color, cardBg, borderC, textColor, muted, onSelectDate,
}: BookingDayStripProps) {
  if (visibleDays.length === 0) {
    return (
      <p className="text-xs text-center py-4" style={{ color: muted }}>
        Nenhum horário disponível nos próximos dias.
      </p>
    );
  }

  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))` }}>
      {visibleDays.map(dateStr => {
        const { weekday, day } = formatDayStripLabel(dateStr);
        const selected = dateStr === selectedDate;
        const isToday  = dateStr === today;
        return (
          <button
            key={dateStr}
            type="button"
            onClick={() => onSelectDate(dateStr)}
            className="aspect-square flex flex-col items-center justify-center gap-0.5 rounded-xl transition-all"
            style={{
              background: selected ? `${color}18` : cardBg,
              border: `1.5px solid ${selected ? color : borderC}`,
            }}
          >
            <span
              className="text-[10px] sm:text-[11px] font-medium tracking-wide"
              style={{ color: selected ? color : muted }}
            >
              {weekday}
            </span>
            <span
              className="text-base sm:text-xl font-bold"
              style={{ color: selected ? color : isToday ? textColor : muted }}
            >
              {day}
            </span>
          </button>
        );
      })}
    </div>
  );
}
