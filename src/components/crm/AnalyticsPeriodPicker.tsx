"use client";
import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarDays, ChevronDown, Check } from "lucide-react";
import { DateRangeCalendar, localDate } from "@/components/ui/DateInput";
import { crmDate } from "@/lib/crm/operation-analytics";

export function AnalyticsPeriodPicker({ start, end, onChange }: {
  start: string; end: string; onChange: (start: string, end: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = crmDate(new Date().toISOString());
  const day = (value: string) => new Date(`${value}T12:00:00`);
  const before = (days: number) => { const date = day(today); date.setDate(date.getDate() - days); return localDate(date); };
  const presets = [
    { label: "Hoje", start: today, end: today },
    { label: "Últimos 7 dias", start: before(6), end: today },
    { label: "Últimos 30 dias", start: before(29), end: today },
    { label: "Este mês", start: `${today.slice(0, 7)}-01`, end: today },
    { label: "Todo o histórico", start: "", end: "" },
  ];
  const selected = presets.find(p => p.start === start && p.end === end);
  const formatted = (value: string) => day(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
  const label = !start && !end ? "Todo o histórico" : `${formatted(start)} — ${formatted(end)} ${end.slice(0, 4)}`;
  const apply = (from: string, to: string) => { onChange(from, to); setOpen(false); };
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger aria-label={`Período de chegada: ${label}`} className="crm-analysis-filter">
      <CalendarDays size={17} className="text-[var(--muted-foreground)]"/>
      <span className="min-w-0 flex-1 text-left"><span className="crm-analysis-filter-label">Período de chegada</span><span className="block truncate text-sm font-medium">{selected?.label ?? label}</span></span>
      <span className="hidden text-xs text-[var(--muted-foreground)] 2xl:inline">{selected?.start && label}</span><ChevronDown size={14}/>
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner sideOffset={10} className="app-date-positioner"><Popover.Popup className="crm-analysis-period-popup">
      <div className="crm-analysis-period-presets"><p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">Período</p>{presets.map(p => <button key={p.label} type="button" aria-pressed={selected?.label === p.label} onClick={() => apply(p.start, p.end)} className="crm-analysis-preset">{p.label}{selected?.label === p.label && <Check size={14}/>}</button>)}<p className="mt-3 hidden px-3 text-xs leading-relaxed text-[var(--muted-foreground)] sm:block">Ou marque o início e o fim no calendário. Todos os dias entre eles serão incluídos.</p></div>
      <DateRangeCalendar immediate from={start ? day(start) : day(today)} to={end ? day(end) : null} onApply={(from, to) => apply(localDate(from), localDate(to))}/>
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}
