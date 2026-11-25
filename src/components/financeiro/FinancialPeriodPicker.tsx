"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays } from "lucide-react";
import { DateCalendar, DateRangeCalendar, localDate } from "@/components/ui/DateInput";
import { useSegmentIndicator } from "@/components/ui/useSegmentIndicator";
import { customPeriod, isFullMonth, monthPeriod, parseDay, periodLabel, presetPeriod, type FinancialPeriod } from "@/lib/financeiro/period";

const PRESETS = [
  { id: "mes", label: "Este mês" },
  { id: "7d", label: "7 dias" },
  { id: "15d", label: "15 dias" },
] as const;

/** Este mês · 7 dias · 15 dias · calendário (mês inteiro ou dias escolhidos), com fundo deslizante. */
export function FinancialPeriodPicker({ value, onChange }: { value: FinancialPeriod; onChange: (period: FinancialPeriod) => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"mes" | "dias">("mes");
  const seg = useSegmentIndicator({ background: "var(--segment-active-bg)", boxShadow: "var(--segment-active-shadow)" }, { activeSelector: '[aria-pressed="true"]' });
  const modeSeg = useSegmentIndicator({ background: "var(--segment-active-bg)", boxShadow: "var(--segment-active-shadow)" }, { activeSelector: '[aria-pressed="true"]' });
  const custom = value.preset === "custom";
  const today = localDate(new Date());

  function openChange(next: boolean) {
    if (next) setMode(custom && !isFullMonth(value) ? "dias" : "mes");
    setOpen(next);
  }
  function pick(period: FinancialPeriod) { onChange(period); setOpen(false); }

  return (
    <div ref={seg.trackRef} className="fin-period-switch" role="group" aria-label="Período">
      {seg.indicator}
      {PRESETS.map((preset) => (
        <button key={preset.id} type="button" aria-pressed={value.preset === preset.id} onClick={() => onChange(presetPeriod(preset.id))}>
          {preset.label}
        </button>
      ))}
      <Popover.Root open={open} onOpenChange={openChange}>
        <Popover.Trigger aria-pressed={custom} aria-label={custom ? `Período personalizado: ${periodLabel(value)}` : "Escolher mês ou período personalizado"} title="Escolher mês ou período" className="fin-period-custom">
          <CalendarDays size={15} aria-hidden="true" />
          {custom && <span>{periodLabel(value)}</span>}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner sideOffset={10} align="end" className="app-date-positioner">
            <Popover.Popup className="fin-period-popup" aria-label="Escolher período">
              <div ref={modeSeg.trackRef} className="fin-period-mode" role="group" aria-label="Tipo de período">
                {modeSeg.indicator}
                <button type="button" aria-pressed={mode === "mes"} onClick={() => setMode("mes")}>Mês inteiro</button>
                <button type="button" aria-pressed={mode === "dias"} onClick={() => setMode("dias")}>Escolher dias</button>
              </div>
              {mode === "mes" ? (
                <DateCalendar
                  monthOnly
                  value={isFullMonth(value) ? value.start.slice(0, 7) : ""}
                  max={today.slice(0, 7)}
                  onChange={(month) => pick(monthPeriod(Number(month.slice(0, 4)), Number(month.slice(5, 7))))}
                />
              ) : (
                <>
                  <DateRangeCalendar
                    immediate
                    from={custom ? parseDay(value.start) : null}
                    to={custom ? parseDay(value.end) : null}
                    onApply={(from, to) => pick(customPeriod(localDate(from), localDate(to)))}
                  />
                  <p className="fin-period-help">Clique no primeiro e no último dia. Todos os dias entre eles entram no período.</p>
                </>
              )}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
