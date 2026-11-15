"use client";


import { useDraggable } from "@dnd-kit/core";
import { Calendar, Clock3, FileText, Mail, Phone } from "lucide-react";
import { formatArrival } from "@/lib/crm/operation-analytics";
import type { Lead } from "@/types";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";
import { useLeadOrigins } from "@/hooks/useLeadOrigins";
import { LeadScoreEngine } from "@/lib/crm/lead-score-engine";
import { semanticChipStyle } from "@/lib/semantic-chip";
import { privateFinancialValue } from "@/store/financial-privacy";

// ─────────────────────────────────────────────────────────────────────────────
// LeadCard
//
// - useDraggable: toda a superfície do card é a drag handle
//   O PointerSensor (8px threshold) no Board garante que clicks curtos
//   abrem o modal, enquanto movimentos ≥ 8px iniciam o drag
//
// - isDragOverlay: quando true (renderizado no DragOverlay do Board),
//   desabilita o useDraggable (disabled: true) para não registrar como
//   segundo draggable ativo, e aplica shadow elevado de "levitação"
//
// - Tags: buscadas via useTags (cache de módulo, um único fetch por sessão)
//   Exibe até 3 tags; "+N" para o restante
// ─────────────────────────────────────────────────────────────────────────────

import type {LeadActivity} from "@/hooks/useLeadActivityIndicators";

interface LeadCardProps {
  activity?: LeadActivity;
  lead: Lead;
  isDragOverlay?: boolean;
  onEdit: () => void;
}

export function LeadCard({ lead, isDragOverlay = false, onEdit, activity }: LeadCardProps) {
  const { tags: allTags } = useTags("crm", lead.pipeline_id);
  const { origins } = useLeadOrigins();
  const origin = origins.find(item => item.id === lead.origin_id) ?? origins.find(item => item.slug === lead.source);

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: lead.id,
    disabled: isDragOverlay,
  });

  const leadTags = allTags.filter((t) =>
    (lead.tags as string[]).includes(t.id)
  );

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={onEdit}
      className={cn(
        "lc-lead-card group relative select-none rounded-[18px] p-3.5",
        "border transition-all duration-200",
        // Original card durante drag: ghost semi-transparente
        isDragging && !isDragOverlay
          ? "cursor-grabbing opacity-30"
          : "cursor-pointer hover:-translate-y-0.5",
        // Overlay: elevado, sem hover effects
        isDragOverlay && "cursor-grabbing"
      )}
      style={{
        boxShadow: isDragOverlay
          ? "0 28px 64px var(--shadow-lg), 0 0 0 1px var(--glass-border)"
          : undefined,
        touchAction: isDragOverlay ? "none" : "pan-x pan-y",
      }}
    >
      {/* Header: nome + origem */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-card-primary)" }}>
          {lead.name}
        </p>
        {(origin || lead.source) && (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none uppercase tracking-wide"
            style={origin ? semanticChipStyle(origin.color) : { background: "var(--hover)", color: "var(--text-card-subtle)", border: "1px solid var(--border)" }}
          >
            {origin?.name ?? lead.source.replaceAll("_", " ")}
          </span>
        )}
      </div>

      {/* Badge: IG (Índice Genesy) — média de IQ/IE, resumo pro card.
          Valores individuais aparecem no card de detalhes do lead. */}
      {(() => {
        const ig = LeadScoreEngine.calculateIG(lead.iq_score, lead.ie_score);
        const hasNotes=activity?.hasNotes||Boolean(lead.notes?.trim());
        if (ig === null&&!hasNotes&&!activity?.hasReminder) return null;
        return (
          <div className="mt-1.5 flex items-center gap-1.5">
            {ig!==null&&<span
              className="rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none"
              style={{ background: "rgba(56,189,248,0.15)", color: "#72d6e4", border: "1px solid rgba(114,214,228,0.25)" }}
              title="IG — Índice Genesy (média de IQ e IE)"
            >
              IG {ig}
            </span>}
            {activity?.hasReminder&&<span className="lead-card-activity lead-card-reminder" title="Você tem um lembrete programado neste lead" aria-label="Lembrete programado"><Clock3 size={13}/></span>}
            {hasNotes&&<span className="lead-card-activity lead-card-notes" title="Este lead possui notas" aria-label="Possui notas"><FileText size={13}/></span>}
          </div>
        );
      })()}

      {/* Contato (phone) */}
      {lead.contact && (
        <div className="mt-1.5 flex items-center gap-1.5">
          <Phone size={11} className="flex-shrink-0" style={{ color: "var(--text-card-subtle)" }} />
          <span className="truncate text-xs" style={{ color: "var(--text-card-secondary)" }}>{lead.contact}</span>
        </div>
      )}

      {/* Email (se existir e diferente do contato) */}
      {lead.email && lead.email !== lead.contact && (
        <div className="mt-1 flex items-center gap-1.5">
          <Mail size={11} className="flex-shrink-0" style={{ color: "var(--text-card-subtle)" }} />
          <span className="truncate text-xs" style={{ color: "var(--text-card-secondary)" }}>{lead.email}</span>
        </div>
      )}

      {/* Tags */}
      {leadTags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {leadTags.slice(0, 3).map((tag) => (
            <span
              key={tag.id}
              className="lc-semantic-chip rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none"
              style={semanticChipStyle(tag.color)}
            >
              {tag.name}
            </span>
          ))}
          {leadTags.length > 3 && (
            <span className="rounded-full px-2 py-0.5 text-[10px] leading-none" style={{ color: "var(--text-card-subtle)" }}>
              +{leadTags.length - 3}
            </span>
          )}
        </div>
      )}

      {/* Footer: data de entrada + valor do negócio */}
      <div className="mt-2.5 flex items-center justify-between text-[10px]" style={{ color: "var(--text-card-subtle)" }}>
        <div className="flex items-center gap-1.5">
          <Calendar size={10} className="flex-shrink-0" />
          <span>
            {formatArrival(lead)}
          </span>
        </div>
        {(lead.deal_value ?? 0) > 0 && (
          <span>
            {privateFinancialValue((lead.deal_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }))}
          </span>
        )}
      </div>
    </div>
  );
}
