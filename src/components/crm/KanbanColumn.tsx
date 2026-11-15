"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import type { Lead } from "@/types";
import type { CrmStage } from "@/types/crm";
import { LeadCard } from "./LeadCard";
import { privateFinancialValue } from "@/store/financial-privacy";

// ─────────────────────────────────────────────────────────────────────────────
// KanbanColumn
//
// - useDroppable: registra a coluna como zona de drop do dnd-kit (id = stage.id)
// - isOver: highlight visual quando um card está sendo arrastado sobre ela
// - Glassmorphism no header com cor da stage
// - Contador animado de leads
// - AnimatePresence: entrada/saída suave dos cards
// - Empty state com dashed border que reage ao isOver
// ─────────────────────────────────────────────────────────────────────────────

import type {LeadActivity} from "@/hooks/useLeadActivityIndicators";

interface KanbanColumnProps {
  activities?: Record<string,LeadActivity>;
  stage: CrmStage;
  leads: Lead[];
  totalValue: number;
  onEditLead: (leadId: string) => void;
}

function fmtBRL(v: number): string {
  if (v === 0) return "—";
  return privateFinancialValue(v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));
}

export function KanbanColumn({ stage, leads, totalValue, onEditLead, activities }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className="crm-kanban-column relative isolate flex h-full min-h-0 w-72 flex-shrink-0 flex-col overflow-hidden rounded-[20px] transition-all duration-200"
      style={{
        background: isOver
          ? "var(--hover)"
          : "var(--glass-bg-soft)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: isOver
          ? "1px solid var(--border-card-hover)"
          : "1px solid var(--border-card)",
        boxShadow: isOver
          ? "0 8px 32px var(--shadow-md), inset 0 1px 0 var(--glass-border)"
          : "0 4px 20px var(--shadow-sm), inset 0 1px 0 var(--hover)",
      }}
    >
      {/* Stage-colored light stays behind content and never captures drag events. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
        <div className="absolute inset-0 rounded-[inherit]" style={{ background: `radial-gradient(ellipse 180px 200px at top left, color-mix(in srgb, ${stage.color ?? "#7c83ff"} 13%, transparent), transparent 80%)` }} />
        <div className="absolute inset-0 rounded-[inherit] p-px" style={{
          background: `radial-gradient(ellipse 200px 360px at top left, ${stage.color ?? "#7c83ff"}, transparent 80%)`,
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          WebkitMaskComposite: "xor",
          opacity: 0.75,
        }} />
      </div>
      {/* ── Header ── */}
      <div className="crm-kanban-column-header px-4 pt-4 pb-3">
        {/* Linha 1: dot colorido + label + badge */}
        <div className="flex items-center gap-2.5">
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: stage.color ?? "var(--icon)" }}
          />
          <span
            className="flex-1 truncate text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-card-secondary)" }}
          >
            {stage.name}
          </span>
          <motion.span
            key={leads.length}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="min-w-[22px] rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums"
            style={{
              background: "var(--hover)",
              color: "var(--text-card-subtle)",
            }}
          >
            {leads.length}
          </motion.span>
        </div>

        {/* Linha 2: valor total do negócio */}
        <motion.p
          key={totalValue}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="mt-1.5 text-[11px] font-semibold tabular-nums"
          style={{ color: totalValue > 0 ? "var(--text-card-subtle)" : "var(--text-empty)" }}
        >
          {fmtBRL(totalValue)}
        </motion.p>
      </div>

      {/* ── Cards area ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden overscroll-y-contain overscroll-x-auto p-3">
        <AnimatePresence initial={false}>
          {leads.map((lead) => (
            <motion.div
              key={lead.id}
              layout
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{
                opacity: 0,
                scale: 0.94,
                transition: { duration: 0.15 },
              }}
              transition={{ duration: 0.22, ease: "easeOut" }}
            >
              <LeadCard
                lead={lead}
                activity={activities?.[lead.id]}
                onEdit={() => onEditLead(lead.id)}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Empty state */}
        {leads.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 items-center justify-center rounded-2xl py-10 text-xs transition-all duration-200"
            style={{
              border: "1.5px dashed var(--border-card-drag)",
              color: isOver ? "var(--text-card-secondary)" : "var(--text-empty)",
              background: isOver ? "var(--hover)" : "transparent",
            }}
          >
            {isOver ? "↓ Soltar aqui" : "Sem leads"}
          </motion.div>
        )}
      </div>
    </div>
  );
}
