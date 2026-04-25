"use client";

import { useDraggable } from "@dnd-kit/core";
import { Calendar, Mail, Phone } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import type { Lead } from "@/types";
import { cn } from "@/lib/utils";
import { useTags } from "@/hooks/useTags";

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

interface LeadCardProps {
  lead: Lead;
  isDragOverlay?: boolean;
  onEdit: () => void;
}

export function LeadCard({ lead, isDragOverlay = false, onEdit }: LeadCardProps) {
  const { tags: allTags } = useTags();

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
        background: "linear-gradient(to right, rgba(255,255,255,0.07) 0%, rgba(255,255,255,0.02) 100%)",
        boxShadow: isDragOverlay
          ? "0 28px 64px var(--shadow-lg), 0 0 0 1px var(--border-card-drag)"
          : "0 2px 14px var(--shadow-sm)",
        // Obrigatório para dnd-kit funcionar corretamente no mobile
        touchAction: "none",
      }}
    >
      {/* Header: nome + badge Meta */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug" style={{ color: "var(--text-card-primary)" }}>
          {lead.name}
        </p>
        {lead.source === "meta_lead_ads" && (
          <span
            className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none uppercase tracking-wide"
            style={{ background: "rgba(24,119,242,0.15)", color: "#4a8fd4", border: "1px solid rgba(74,143,212,0.25)" }}
          >
            Meta
          </span>
        )}
      </div>

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
              className="rounded-full px-2 py-0.5 text-[10px] font-medium leading-none"
              style={{
                background: `${tag.color}18`,
                color: tag.color,
                border: `1px solid ${tag.color}28`,
              }}
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
            {format(
              new Date(lead.entered_at + "T00:00:00"),
              "dd MMM yyyy",
              { locale: ptBR }
            )}
          </span>
        </div>
        {(lead.deal_value ?? 0) > 0 && (
          <span>
            {(lead.deal_value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        )}
      </div>
    </div>
  );
}
