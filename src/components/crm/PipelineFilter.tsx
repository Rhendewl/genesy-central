"use client";
import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown, Check, Kanban, Search, Layers3 } from "lucide-react";
import type { CrmPipelineWithStages } from "@/types/crm";
import "./crm-analysis.css";

export interface PipelineFilterProps {
  value: string[] | null;
  onChange: (ids: string[] | null) => void;
  pipelines: CrmPipelineWithStages[];
}
export function PipelineFilter({ value, onChange, pipelines }: PipelineFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = pipelines.filter(p => value?.includes(p.id));
  const all = value === null || value.length === 0;
  const label = all ? "Todas as pipelines" : selected.length === 1 ? selected[0].name : `${selected.length} pipelines selecionadas`;
  const toggle = (id: string) => {
    const next = all ? [id] : value!.includes(id) ? value!.filter(v => v !== id) : [...value!, id];
    onChange(next.length ? next : null);
  };
  return <Popover.Root open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch(""); }}>
    <Popover.Trigger aria-label={`Selecionar pipelines: ${label}`} className="crm-analysis-filter w-full">
      <Kanban size={17} className="text-[var(--muted-foreground)]"/>
      <span className="min-w-0 flex-1 text-left"><span className="crm-analysis-filter-label">Pipelines</span><span className="block truncate text-sm font-medium">{label}</span></span>
      <span className="flex -space-x-1" aria-hidden="true">{(all ? pipelines : selected).slice(0,3).map(p=><span key={p.id} className="h-2.5 w-2.5 rounded-full ring-2 ring-[var(--background)]" style={{background:p.color}}/>)}</span><ChevronDown size={14}/>
    </Popover.Trigger>
    <Popover.Portal><Popover.Positioner sideOffset={10} className="app-date-positioner"><Popover.Popup className="crm-analysis-pipeline-popup">
      <div className="border-b border-[var(--border)] p-4"><h3 className="text-sm font-semibold">Quais pipelines analisar?</h3><p className="mt-1 text-xs text-[var(--muted-foreground)]">Selecione uma ou compare várias.</p><label className="mt-3 flex items-center gap-2 rounded-xl border border-[var(--border)] px-3"><Search size={14} className="text-[var(--muted-foreground)]"/><input aria-label="Buscar pipeline" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pipeline…" className="min-h-10 min-w-0 flex-1 bg-transparent text-sm outline-none"/></label></div>
      <div className="max-h-72 overflow-y-auto p-2"><button type="button" aria-pressed={all} className="crm-analysis-pipeline-option" onClick={()=>onChange(null)}><Layers3 size={17}/><span className="flex-1 text-left">Todas as pipelines</span>{all&&<Check size={15}/>}</button>{pipelines.filter(p=>p.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR"))).map(p=><button type="button" key={p.id} aria-pressed={!all&&value!.includes(p.id)} className="crm-analysis-pipeline-option" onClick={()=>toggle(p.id)}><span className="h-2.5 w-2.5 rounded-full" style={{background:p.color}}/><span className="flex-1 truncate text-left">{p.name}</span><span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${!all&&value!.includes(p.id)?"border-sky-400 bg-sky-400/15 text-sky-400":"border-[var(--border)]"}`}>{!all&&value!.includes(p.id)&&<Check size={13}/>}</span></button>)}{!pipelines.some(p=>p.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))&&<p className="px-3 py-5 text-xs text-[var(--muted-foreground)]">Nenhuma pipeline encontrada.</p>}</div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-4 py-3"><span className="text-xs text-[var(--muted-foreground)]">{all?`${pipelines.length} pipelines na análise`:`${selected.length} selecionada(s)`}</span><button type="button" onClick={()=>{setOpen(false);setSearch("");}} className="min-h-9 rounded-lg bg-sky-500/15 px-4 text-xs font-semibold text-sky-500">Concluir</button></div>
    </Popover.Popup></Popover.Positioner></Popover.Portal>
  </Popover.Root>;
}
