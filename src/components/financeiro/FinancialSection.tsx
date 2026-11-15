"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { accentBorderStyle } from "@/components/ui/accent-border";
import "./financial-workspace.css";

export function FinancialSectionHeader({ title, description, createLabel, onCreate }: {
  title: string; description: string; createLabel: string; onCreate: () => void;
}) {
  return <header className="fin-section-header">
    <div><p className="fin-eyebrow">Gestão da operação</p><h2>{title}</h2><p>{description}</p></div>
    <Button onClick={onCreate} signature icon={<Plus size={17} />} aria-label={createLabel}>{createLabel}</Button>
  </header>;
}

export function FinancialMetric({ label, value, detail, tone = "neutral", onClick, selected }: {
  label: string; value: string; detail: string; tone?: "neutral" | "blue" | "green" | "amber" | "red";
  onClick?: () => void; selected?: boolean;
}) {
  const content = <><span className="fin-metric-label"><i />{label}</span><strong>{value}</strong><small>{detail}</small></>;
  const className = `fin-metric app-accent-border fin-tone-${tone}`;
  const style = accentBorderStyle("var(--metric-accent)");
  return onClick ? <button type="button" onClick={onClick} aria-pressed={selected} className={className} style={style}>{content}</button>
    : <div className={className} style={style}>{content}</div>;
}

export function FinancialFilters({ active, children }: { active: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <div className="fin-filters">
    <button type="button" className={`fin-filter-toggle ${active ? "is-active" : ""}`} onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls={id}>
      <SlidersHorizontal size={16} />Buscar e filtrar{active && <span>Filtros ativos</span>}<ChevronDown size={14} />
    </button>
    <div id={id} className={`fin-filter-content ${open ? "is-open" : ""}`}>{children}</div>
  </div>;
}

export function FinancialAnalysis({ title = "Análise do período", children }: { title?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <section className="fin-analysis">
    <button type="button" className="fin-analysis-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>{title}<ChevronDown size={16} /></button>
    <div id={id} className={`fin-analysis-content ${open ? "is-open" : ""}`}>{children}</div>
  </section>;
}
