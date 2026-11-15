"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FinancialPrivacyButton } from "@/components/ui/FinancialPrivacyButton";
import { DateInput } from "@/components/ui/DateInput";
import "./financial-workspace.css";

export function ManagementModuleNavigation<T extends string>({ label, tabs, value, onChange, year, month, onPeriodChange, hidePeriod = false }: {
  label: string; tabs: { id: T; label: string; icon: ReactNode }[]; value: T; onChange: (value: T) => void;
  year: number; month: number; onPeriodChange: (year: number, month: number) => void; hidePeriod?: boolean;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const now = new Date();
  const max = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-31`;
  const selected = `${year}-${String(month).padStart(2, "0")}`;
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [value]);
  function shift(delta: number) { const date = new Date(year, month - 1 + delta, 1); onPeriodChange(date.getFullYear(), date.getMonth() + 1); }
  return <div className="fin-nav">
    <nav className="fin-tabs" aria-label={label}>{tabs.map(tab => <button ref={tab.id === value ? activeRef : undefined} key={tab.id} type="button" aria-current={tab.id === value ? "page" : undefined} onClick={() => onChange(tab.id)}>{tab.icon}{tab.label}</button>)}</nav>
    <div className="fin-period-row">
      {!hidePeriod && <><button type="button" aria-label="Mês anterior" onClick={() => shift(-1)}><ChevronLeft size={15} /></button>
        <label><span>Período</span><DateInput aria-label="Mês de referência" value={`${selected}-01`} max={max} onChange={event => { const date = new Date(`${event.target.value}T12:00:00`); if (!Number.isNaN(date.getTime())) onPeriodChange(date.getFullYear(), date.getMonth() + 1); }} /></label>
        <button type="button" aria-label="Próximo mês" disabled={selected >= max.slice(0, 7)} onClick={() => shift(1)}><ChevronRight size={15} /></button></>}
      <div className="fin-period-private"><FinancialPrivacyButton compact /></div>
    </div>
  </div>;
}
