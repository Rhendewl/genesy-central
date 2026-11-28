"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Clock3, FileText, MessageCircle, SlidersHorizontal } from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import { useTags } from "@/hooks/useTags";
import { useLeadOrigins } from "@/hooks/useLeadOrigins";
import type { LeadActivity } from "@/hooks/useLeadActivityIndicators";
import type { CrmViewPreferences, LeadListColumn, LeadListSort } from "@/hooks/useCrmViewPreferences";
import type { Lead } from "@/types";
import { formatArrival } from "@/lib/crm/operation-analytics";
import type { CrmStage } from "@/types/crm";
import { leadContactLinks } from "@/lib/crm/contact-links";
import { LeadScoreEngine } from "@/lib/crm/lead-score-engine";
import { semanticChipStyle } from "@/lib/semantic-chip";
import { privateFinancialValue } from "@/store/financial-privacy";
import { leadPerfilInfo, leadPerfilLabel } from "@/lib/crm/lead-perfil";

const columns: { key: LeadListColumn; label: string; sort?: LeadListSort }[] = [
  { key: "perfil", label: "Perfil", sort: "perfil" },
  { key: "assignee", label: "Responsável", sort: "assignee" },
  { key: "tags", label: "Etiquetas" },
  { key: "entered_at", label: "Entrada", sort: "entered_at" },
  { key: "origin", label: "Origem", sort: "origin" },
  { key: "ig", label: "IG", sort: "ig" },
  { key: "value", label: "Valor do negócio", sort: "value" },
];
const PAGE_SIZE = 50;
interface LeadListProps {
  leads: Lead[];
  stages: CrmStage[];
  pipelineId: string | null;
  activities: Record<string, LeadActivity>;
  preferences: CrmViewPreferences;
  onPreferencesChange: (patch: Partial<CrmViewPreferences>) => void;
  onOpen: (leadId: string) => void;
  onMove: (leadId: string, stageId: string) => Promise<void>;
  moving: boolean;
}

export function LeadList({ leads, stages, pipelineId, activities, preferences, onPreferencesChange, onOpen, onMove, moving }: LeadListProps) {
  const { profiles } = useUsers();
  const { tags } = useTags("crm", pipelineId);
  const { origins } = useLeadOrigins();
  const [page, setPage] = useState(0);
  const [busyLead, setBusyLead] = useState<string | null>(null);
  const [showColumns, setShowColumns] = useState(false);
  const visibleColumns = columns.filter(column => preferences.columns.includes(column.key));
  const originName = (lead: Lead) => origins.find(origin => origin.id === lead.origin_id)?.name
    ?? origins.find(origin => origin.slug === lead.source)?.name ?? lead.source?.replaceAll("_", " ") ?? "";
  const assigneeName = (lead: Lead) => profiles.find(profile => profile.id === lead.assigned_to)?.full_name ?? "Sem responsável";
  const sorted = useMemo(() => {
    const stageOrder = new Map(stages.map(stage => [stage.id, stage.order_index]));
    function value(lead: Lead): string | number | null {
      switch (preferences.sort) {
        case "name": return lead.name;
        case "stage": return stageOrder.get(lead.stage_id ?? "") ?? null;
        case "assignee": return assigneeName(lead);
        case "origin": return originName(lead);
        case "perfil": return lead.perfil ? leadPerfilLabel(lead.perfil) : null;
        case "ig": return LeadScoreEngine.calculateIG(lead.iq_score, lead.ie_score);
        case "value": return lead.deal_value ?? 0;
        default: return lead.received_at ?? lead.entered_at;
      }
    }
    return [...leads].sort((a, b) => {
      const left = value(a), right = value(b);
      if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
      const comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "pt-BR", { numeric: true, sensitivity: "base" });
      return (preferences.direction === "asc" ? comparison : -comparison) || a.id.localeCompare(b.id);
    });
    // Catalogs supply the displayed names used for sorting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads, stages, profiles, origins, preferences.sort, preferences.direction]);
  const lastPage = Math.max(0, Math.ceil(sorted.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, lastPage);
  const pageLeads = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function sortBy(sort: LeadListSort) {
    onPreferencesChange({ sort, direction: preferences.sort === sort && preferences.direction === "asc" ? "desc" : "asc" });
    setPage(0);
  }
  function header(label: string, sort?: LeadListSort) {
    return sort ? <button type="button" onClick={() => sortBy(sort)} className="inline-flex min-h-11 items-center gap-2 text-left hover:text-[var(--text-title)]">{label}{preferences.sort === sort && (preferences.direction === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}</button> : label;
  }
  function stageSelect(lead: Lead) {
    const stage = stages.find(item => item.id === lead.stage_id);
    return <select aria-label={`Etapa de ${lead.name}`} value={stage?.id ?? ""} disabled={moving || busyLead !== null}
      onClick={event => event.stopPropagation()}
      onChange={async event => { const stageId = event.target.value; if (!stageId) return; setBusyLead(lead.id); try { await onMove(lead.id, stageId); } finally { setBusyLead(null); } }}
      className="lc-semantic-chip min-h-11 max-w-full cursor-pointer rounded-xl border px-2 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-sky-500 disabled:opacity-50"
      style={stage ? semanticChipStyle(stage.color) : { borderColor: "var(--border)", background: "var(--glass-bg-soft)" }}>
      {!stage && <option value="">Sem etapa</option>}
      {stages.map(item => <option key={item.id} value={item.id} style={{ background: "var(--bg-modal)", color: "var(--text-title)" }}>{item.name}</option>)}
    </select>;
  }
  function whatsapp(lead: Lead) {
    const links = leadContactLinks(lead.contact);
    return links ? <a href={links.whatsapp} target="_blank" rel="noopener noreferrer" aria-label={`Conversar no WhatsApp com ${lead.name}`} onClick={event => event.stopPropagation()}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 dark:text-emerald-400"><MessageCircle size={16} aria-hidden="true" />WhatsApp</a>
      : <span className="text-xs text-[var(--muted-foreground)]">Sem telefone</span>;
  }
  function leadName(lead: Lead) {
    const activity = activities[lead.id];
    return <div className="min-w-0"><button type="button" onClick={event => { event.stopPropagation(); onOpen(lead.id); }} className="block max-w-full truncate text-left text-sm font-semibold text-[var(--text-title)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500">{lead.name}</button>
      <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted-foreground)]"><span className="truncate">{lead.contact || lead.email || "Sem contato"}</span>
        {(activity?.hasNotes || Boolean(lead.notes?.trim())) && <span title="Possui notas" aria-label="Possui notas"><FileText size={13} /></span>}
        {activity?.hasReminder && <span title="Lembrete programado" aria-label="Lembrete programado"><Clock3 size={13} /></span>}
      </div></div>;
  }
  function cell(lead: Lead, column: LeadListColumn) {
    switch (column) {
      case "perfil": {
        const perfil = leadPerfilInfo(lead.perfil);
        return perfil ? <span className="lc-semantic-chip whitespace-nowrap rounded-full border px-2 py-1 text-[10px] font-semibold" style={semanticChipStyle(perfil.color)}>{perfil.label}</span> : "—";
      }
      case "assignee": return assigneeName(lead);
      case "origin": return originName(lead) || "—";
      case "ig": return LeadScoreEngine.calculateIG(lead.iq_score, lead.ie_score) ?? "—";
      case "value": return privateFinancialValue((lead.deal_value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
      case "entered_at": return formatArrival(lead);
      case "tags": {
        const items = tags.filter(tag => lead.tags?.includes(tag.id));
        return <div className="flex flex-wrap gap-1">{items.slice(0, 2).map(tag => <span key={tag.id} className="lc-semantic-chip max-w-36 truncate rounded-full border px-2 py-1 text-[10px]" style={semanticChipStyle(tag.color)}>{tag.name}</span>)}{items.length > 2 && <span title={items.slice(2).map(tag => tag.name).join(", ")}>+{items.length - 2}</span>}{!items.length && "—"}</div>;
      }
    }
  }
  return <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6">
    <div className="mb-3 flex flex-none flex-wrap items-center justify-between gap-2">
      <label className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">Ordenar por
        <select aria-label="Ordenar lista de leads" value={preferences.sort} onChange={event => { onPreferencesChange({ sort: event.target.value as LeadListSort }); setPage(0); }} className="min-h-11 rounded-xl border border-[var(--border)] bg-[var(--background)] px-2 text-[var(--text-title)]">
          <option value="name">Nome</option><option value="stage">Etapa</option><option value="entered_at">Entrada</option><option value="assignee">Responsável</option><option value="origin">Origem</option><option value="perfil">Perfil</option><option value="ig">IG</option><option value="value">Valor do negócio</option>
        </select>
        <button type="button" aria-label={preferences.direction === "asc" ? "Ordem crescente; inverter" : "Ordem decrescente; inverter"} onClick={() => onPreferencesChange({ direction: preferences.direction === "asc" ? "desc" : "asc" })} className="grid min-h-11 min-w-11 place-items-center rounded-xl hover:bg-[var(--hover)]">{preferences.direction === "asc" ? <ArrowUp size={16} /> : <ArrowDown size={16} />}</button>
      </label>
      <button type="button" aria-expanded={showColumns} aria-controls="crm-list-columns" onClick={() => setShowColumns(!showColumns)} className="hidden min-h-11 items-center gap-2 rounded-xl border border-[var(--border)] px-3 text-xs md:inline-flex"><SlidersHorizontal size={15} />Colunas</button>
    </div>
    {showColumns && <div id="crm-list-columns" className="mb-3 hidden flex-none flex-wrap gap-4 rounded-xl border border-[var(--border)] p-3 md:flex">{columns.map(column => <label key={column.key} className="flex min-h-9 cursor-pointer items-center gap-2 text-xs"><input type="checkbox" checked={preferences.columns.includes(column.key)} onChange={event => onPreferencesChange({ columns: event.target.checked ? [...preferences.columns, column.key] : preferences.columns.filter(key => key !== column.key) })} />{column.label}</label>)}</div>}
    <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)]">
      {!leads.length ? <p role="status" className="p-10 text-center text-sm text-[var(--muted-foreground)]">Nenhum lead encontrado nesta pipeline com os filtros atuais.</p> : <>
        <table className="hidden w-full border-collapse text-left md:table">
          <caption className="sr-only">Leads da pipeline. Clique no nome para abrir a ficha.</caption>
          <thead className="sticky top-0 z-10 bg-[var(--background)] text-xs text-[var(--muted-foreground)]"><tr>
            <th scope="col" aria-sort={preferences.sort === "name" ? preferences.direction === "asc" ? "ascending" : "descending" : "none"} className="min-w-56 px-4 font-medium">{header("Lead", "name")}</th>
            <th scope="col" aria-sort={preferences.sort === "stage" ? preferences.direction === "asc" ? "ascending" : "descending" : "none"} className="min-w-40 px-3 font-medium">{header("Etapa", "stage")}</th>
            <th scope="col" className="px-3 font-medium">WhatsApp</th>
            {visibleColumns.map(column => <th scope="col" key={column.key} aria-sort={column.sort && preferences.sort === column.sort ? preferences.direction === "asc" ? "ascending" : "descending" : "none"} className="whitespace-nowrap px-3 py-3 font-medium">{header(column.label, column.sort)}</th>)}
          </tr></thead>
          <tbody>{pageLeads.map(lead => <tr key={lead.id} onClick={() => onOpen(lead.id)} className="cursor-pointer border-t border-[var(--glass-border)] transition-colors hover:bg-[var(--hover)]">
            <td className="max-w-80 px-4 py-3">{leadName(lead)}</td><td className="max-w-60 px-3 py-3">{stageSelect(lead)}</td><td className="px-3 py-3">{whatsapp(lead)}</td>
            {visibleColumns.map(column => <td key={column.key} className="max-w-60 px-3 py-3 text-xs text-[var(--text-body)]"><div className="max-w-60 break-words">{cell(lead, column.key)}</div></td>)}
          </tr>)}</tbody>
        </table>
        <div className="divide-y divide-[var(--glass-border)] md:hidden">{pageLeads.map(lead => <article key={lead.id} className="p-4" onClick={() => onOpen(lead.id)}>{leadName(lead)}<div className="mt-3 flex items-center gap-2"><div className="min-w-0 flex-1">{stageSelect(lead)}</div>{whatsapp(lead)}</div></article>)}</div>
      </>}
    </div>
    {sorted.length > 0 && <div className="flex flex-none flex-wrap items-center justify-between gap-2 pt-3 text-xs text-[var(--muted-foreground)]"><span role="status">{currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, sorted.length)} de {sorted.length} leads</span><div className="flex items-center gap-2"><button type="button" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)} className="min-h-11 rounded-xl px-3 hover:bg-[var(--hover)] disabled:opacity-40">Anterior</button><span>{currentPage + 1} / {lastPage + 1}</span><button type="button" disabled={currentPage === lastPage} onClick={() => setPage(currentPage + 1)} className="min-h-11 rounded-xl px-3 hover:bg-[var(--hover)] disabled:opacity-40">Próxima</button></div></div>}
  </div>;
}
