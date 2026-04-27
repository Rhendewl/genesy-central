"use client";

import { useDroppable } from "@dnd-kit/core";
import { AnimatePresence, motion } from "framer-motion";
import type { Lead, KANBAN_COLUMNS } from "@/types";
import { LeadCard } from "./LeadCard";

// ─────────────────────────────────────────────────────────────────────────────
// KanbanColumn
//
// - useDroppable: registra a coluna como zona de drop do dnd-kit
// - isOver: highlight visual quando um card está sendo arrastado sobre ela
// - Glassmorphism no header com cor da coluna
// - Contador animado de leads
// - AnimatePresence: entrada/saída suave dos cards
// - Empty state com dashed border que reage ao isOver
// ─────────────────────────────────────────────────────────────────────────────

type ColumnDef = (typeof KANBAN_COLUMNS)[number];

interface KanbanColumnProps {
  column: ColumnDef;
  leads: Lead[];
  totalValue: number;
  onEditLead: (leadId: string) => void;
}

function fmtBRL(v: number): string {
  if (v === 0) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function KanbanColumn({ column, leads, totalValue, onEditLead }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className="flex w-72 flex-shrink-0 flex-col rounded-[20px] transition-all duration-200"
      style={{
        background: isOver
          ? "rgba(255, 255, 255, 0.06)"
          : "rgba(0, 0, 0, 0.32)",
        backdropFilter: "blur(14px) saturate(140%)",
        WebkitBackdropFilter: "blur(14px) saturate(140%)",
        border: isOver
          ? "1px solid rgba(255, 255, 255, 0.14)"
          : "1px solid rgba(255, 255, 255, 0.07)",
        boxShadow: isOver
          ? "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)"
          : "0 4px 20px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.04)",
        minHeight: 660,
      }}
    >
      {/* ── Header ── */}
      <div className="px-4 pt-4 pb-3">
        {/* Linha 1: dot + label + badge */}
        <div className="flex items-center gap-2.5">
          <span
            className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
            style={{ background: "rgba(255,255,255,0.35)" }}
          />
          <span
            className="flex-1 truncate text-[11px] font-semibold uppercase tracking-widest"
            style={{ color: "rgba(255,255,255,0.55)" }}
          >
            {column.label}
          </span>
          <motion.span
            key={leads.length}
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 25 }}
            className="min-w-[22px] rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.45)",
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
          style={{ color: totalValue > 0 ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.18)" }}
        >
          {fmtBRL(totalValue)}
        </motion.p>
      </div>

      {/* ── Cards area ── */}
      <div className="flex flex-1 flex-col gap-2 p-3">
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
              border: "1.5px dashed rgba(255,255,255,0.10)",
              color: isOver ? "rgba(255,255,255,0.65)" : "rgba(255,255,255,0.25)",
              background: isOver ? "rgba(255,255,255,0.04)" : "transparent",
            }}
          >
            {isOver ? "↓ Soltar aqui" : "Sem leads"}
          </motion.div>
        )}
      </div>
    </div>
  );
}
