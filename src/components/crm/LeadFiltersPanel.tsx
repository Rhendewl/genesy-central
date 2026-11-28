"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Filter, X } from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import { useTags } from "@/hooks/useTags";
import { useLeadOrigins } from "@/hooks/useLeadOrigins";
import type { Lead } from "@/types";
import { LEAD_PERFIS, SEM_PERFIL_LABEL } from "@/lib/crm/lead-perfil";
import {
  EMPTY_LEAD_FILTERS, NONE, countActiveFilters, filterOptionCounts,
  type LeadFilterKey, type LeadFilters,
} from "@/lib/crm/lead-filters";
import { semanticChipStyle } from "@/lib/semantic-chip";

interface LeadFiltersPanelProps {
  /** Leads da pipeline antes de busca e filtros — de onde saem as opções. */
  leads: Lead[];
  pipelineId: string | null;
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
}

interface Option { value: string; label: string; count: number; color?: string }

const SECTIONS: { key: LeadFilterKey; title: string; none: string }[] = [
  { key: "perfis", title: "Perfil", none: SEM_PERFIL_LABEL },
  { key: "responsaveis", title: "Responsável", none: "Sem responsável" },
  { key: "origens", title: "Origem", none: "Sem origem" },
  { key: "formularios", title: "Formulário", none: "Sem formulário" },
  { key: "campanhas", title: "Campanha", none: "Sem campanha" },
  { key: "tags", title: "Etiquetas", none: "Sem etiqueta" },
];

export function LeadFiltersPanel({ leads, pipelineId, filters, onChange }: LeadFiltersPanelProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const { profiles } = useUsers();
  const { origins } = useLeadOrigins();
  const { tags } = useTags("crm", pipelineId);
  const active = countActiveFilters(filters);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  const options = useMemo(() => {
    const label = (key: LeadFilterKey, value: string): Pick<Option, "label" | "color"> => {
      switch (key) {
        case "perfis": { const perfil = LEAD_PERFIS.find(item => item.value === value); return { label: perfil?.label ?? value, color: perfil?.color }; }
        case "responsaveis": return { label: profiles.find(profile => profile.id === value)?.full_name ?? "Responsável removido" };
        case "origens": {
          const separator = value.indexOf(":");
          const kind = value.slice(0, separator), id = value.slice(separator + 1);
          const origin = kind === "origin" ? origins.find(item => item.id === id) : origins.find(item => item.slug === id);
          return { label: origin?.name ?? id.replaceAll("_", " "), color: origin?.color };
        }
        case "tags": { const tag = tags.find(item => item.id === value); return { label: tag?.name ?? "Etiqueta removida", color: tag?.color }; }
        default: return { label: value };
      }
    };
    return Object.fromEntries(SECTIONS.map(({ key, none }) => {
      const counts = filterOptionCounts(leads, key);
      const list: Option[] = counts.map(({ value, count }) => value === NONE ? { value, count, label: none } : { value, count, ...label(key, value) });
      if (key === "perfis") {
        // Os três perfis sempre aparecem, na ordem fixa; "Sem perfil" por último.
        const byValue = new Map(list.map(option => [option.value, option]));
        const fixed = LEAD_PERFIS.map(perfil => byValue.get(perfil.value) ?? { value: perfil.value, label: perfil.label, color: perfil.color, count: 0 });
        return [key, byValue.has(NONE) ? [...fixed, byValue.get(NONE)!] : fixed];
      }
      return [key, list.sort((a, b) => Number(a.value === NONE) - Number(b.value === NONE) || b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))];
    })) as Record<LeadFilterKey, Option[]>;
  }, [leads, profiles, origins, tags]);

  function toggle(key: LeadFilterKey, value: string) {
    const selected = filters[key];
    onChange({ ...filters, [key]: selected.includes(value) ? selected.filter(item => item !== value) : [...selected, value] });
  }

  // Campanha/formulário/etiqueta só aparecem quando algum lead da pipeline tem esse dado.
  const visibleSections = SECTIONS.filter(({ key }) =>
    key === "perfis" || key === "responsaveis" || options[key].some(option => option.value !== NONE) || filters[key].length > 0);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
        className={`flex min-h-11 items-center gap-2 rounded-2xl border px-3 text-sm transition-colors hover:bg-[var(--hover)] ${active ? "border-sky-400/60 bg-sky-400/10 text-[var(--text-title)]" : "border-[var(--glass-border)] bg-[var(--glass-bg-soft)] text-[var(--muted-foreground)]"}`}
      >
        <Filter size={16} aria-hidden="true" />
        <span className="hidden sm:inline">Filtros</span>
        {active > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-sky-500 px-1 text-[10px] font-bold text-white" aria-label={`${active} filtros ativos`}>{active}</span>}
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Filtros de leads"
          className="absolute right-0 top-full z-40 mt-2 max-h-[70vh] w-[min(92vw,380px)] overflow-y-auto rounded-2xl border border-[var(--glass-border)] p-4 shadow-2xl"
          style={{ background: "var(--bg-modal, var(--background))" }}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-title)]">Filtrar leads</h3>
            <div className="flex items-center gap-1">
              {active > 0 && <button type="button" onClick={() => onChange(EMPTY_LEAD_FILTERS)} className="min-h-9 rounded-lg px-2 text-xs text-sky-500 hover:bg-[var(--hover)]">Limpar filtros</button>}
              <button type="button" aria-label="Fechar filtros" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[var(--hover)]"><X size={15} /></button>
            </div>
          </div>
          <div className="space-y-4">
            {visibleSections.map(({ key, title }) => (
              <fieldset key={key}>
                <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">{title}</legend>
                <div className="flex flex-wrap gap-1.5">
                  {options[key].map(option => {
                    const checked = filters[key].includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={`lc-semantic-chip flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-xs transition ${checked ? "font-semibold" : "opacity-80 hover:opacity-100"}`}
                        style={checked && option.color ? semanticChipStyle(option.color) : checked ? { borderColor: "rgb(56 189 248 / .6)", background: "rgb(56 189 248 / .12)" } : { borderColor: "var(--border)" }}
                      >
                        <input type="checkbox" className="sr-only" checked={checked} onChange={() => toggle(key, option.value)} />
                        {option.color && !checked && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: option.color }} aria-hidden="true" />}
                        <span className="max-w-48 truncate">{option.label}</span>
                        <span className="text-[10px] text-[var(--muted-foreground)]">{option.count}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
