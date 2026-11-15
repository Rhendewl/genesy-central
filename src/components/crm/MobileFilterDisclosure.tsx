"use client";
import { useId, useState, type ReactNode } from "react";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
/** Keep filters mounted so closing the mobile panel never clears their state. */
export function MobileFilterDisclosure({ children, summary, label = "Filtros", active = false }: {
  children: ReactNode; summary: string; label?: string; active?: boolean;
}) {
  const [open,setOpen]=useState(false);
  const id=useId();
  return <div className="crm-mobile-filter-disclosure">
    <div className="crm-mobile-filter-heading md:hidden"><span title={summary} className="min-w-0 flex-1 truncate text-xs text-[var(--muted-foreground)]">{summary}</span>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(value=>!value)} className={`crm-mobile-icon-button crm-mobile-filter-trigger ${active?"is-active":""}`}><SlidersHorizontal size={15}/><span>{label}</span><ChevronDown size={12} className={open?"rotate-180":""}/></button>
    </div>
    <div id={id} className={`crm-mobile-filter-content ${open?"is-open":""}`}>{children}</div>
  </div>;
}
