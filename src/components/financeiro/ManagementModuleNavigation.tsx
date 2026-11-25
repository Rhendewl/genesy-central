"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useSegmentIndicator } from "@/components/ui/useSegmentIndicator";
import { FinancialPrivacyButton } from "@/components/ui/FinancialPrivacyButton";
import { FinancialPeriodPicker } from "./FinancialPeriodPicker";
import type { FinancialPeriod } from "@/lib/financeiro/period";
import "./financial-workspace.css";

export function ManagementModuleNavigation<T extends string>({ label, tabs, value, onChange, period, onPeriodChange, hidePeriod = false }: {
  label: string; tabs: { id: T; label: string; icon: ReactNode }[]; value: T; onChange: (value: T) => void;
  period: FinancialPeriod; onPeriodChange: (period: FinancialPeriod) => void; hidePeriod?: boolean;
}) {
  const activeRef = useRef<HTMLButtonElement>(null);
  const tabSeg = useSegmentIndicator({ background: "var(--segment-active-bg)", boxShadow: "var(--segment-active-shadow)" }, { activeSelector: '[aria-current="page"]' });
  useEffect(() => { activeRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [value]);
  return <div className="fin-nav">
    <nav ref={tabSeg.trackRef} className="fin-tabs" aria-label={label}>{tabSeg.indicator}{tabs.map(tab => <button ref={tab.id === value ? activeRef : undefined} key={tab.id} type="button" aria-current={tab.id === value ? "page" : undefined} onClick={() => onChange(tab.id)}>{tab.icon}{tab.label}</button>)}</nav>
    <div className="fin-period-row">
      {!hidePeriod && <FinancialPeriodPicker value={period} onChange={onPeriodChange} />}
      <div className="fin-period-private"><FinancialPrivacyButton compact /></div>
    </div>
  </div>;
}
