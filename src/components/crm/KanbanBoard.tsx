"use client";

import { useCallback, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { Plus, Plug } from "lucide-react";
import Link from "next/link";

import { useLeads } from "@/hooks/useLeads";
import { KANBAN_COLUMNS, type KanbanColumn as KanbanColumnType, type Lead } from "@/types";
import { KanbanColumn } from "./KanbanColumn";
import { LeadCard } from "./LeadCard";
import { LeadModal } from "./LeadModal";
import { PeriodFilter, type DateFilter } from "./PeriodFilter";

// ─────────────────────────────────────────────────────────────────────────────
// KanbanBoard
//
// Camada de orquestração do CRM:
//  - DndContext com PointerSensor (threshold 8px para não conflitar com click)
//  - Drag state: activeId → mostra DragOverlay flutuante
//  - handleDragEnd: resolve coluna de destino (pode ser id de coluna OU id de
//    outro lead — nesse caso busca a coluna do lead alvo) e chama moveLead
//  - Scroll horizontal com snap por coluna no mobile
//  - Botão "Novo Lead" → abre LeadModal em modo criação
//  - PeriodFilter → filtra leads por data de criação (client-side, instantâneo)
// ─────────────────────────────────────────────────────────────────────────────

export function KanbanBoard() {
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);

  const {
    leads,
    totalLeads,
    leadsByColumn,
    isLoading,
    error,
    moveLead,
    createLead,
    updateLead,
    deleteLead,
    getLeadById,
  } = useLeads(dateFilter);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // ── dnd-kit sensors ────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 8px threshold: distingue click (abre modal) de drag (move card)
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ── Drag handlers ──────────────────────────────────────────────────────────

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const leadId = active.id as string;
      const draggedLead = leads.find((l) => l.id === leadId);
      if (!draggedLead) return;

      // over.id pode ser o id de uma coluna OU o id de outro lead (card)
      const isColumnId = KANBAN_COLUMNS.some((c) => c.id === over.id);
      let targetColumn: KanbanColumnType;

      if (isColumnId) {
        targetColumn = over.id as KanbanColumnType;
      } else {
        const overLead = leads.find((l) => l.id === over.id);
        if (!overLead) return;
        targetColumn = overLead.kanban_column;
      }

      if (draggedLead.kanban_column === targetColumn) return;
      moveLead(leadId, draggedLead.kanban_column, targetColumn);
    },
    [leads, moveLead]
  );

  const handleDragCancel = useCallback(() => setActiveId(null), []);

  // ── Modal handlers ─────────────────────────────────────────────────────────

  function openCreateModal() {
    setEditingLead(null);
    setIsModalOpen(true);
  }

  function openEditModal(leadId: string) {
    setEditingLead(getLeadById(leadId) ?? null);
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
    setEditingLead(null);
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const activeLead      = activeId ? getLeadById(activeId) : null;
  const isFiltered      = dateFilter !== null;
  const filteredCount   = leads.length;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden px-4 py-2 sm:px-6">
        {KANBAN_COLUMNS.map((col) => (
          <div
            key={col.id}
            className="w-72 flex-shrink-0 animate-pulse rounded-3xl p-4"
            style={{ height: 420, background: "var(--card)" }}
          >
            <div className="mb-4 h-5 w-32 rounded-full" style={{ background: "var(--shimmer-base)" }} />
            {[1, 2, 3].map((i) => (
              <div key={i} className="mb-3 h-24 rounded-2xl" style={{ background: "var(--shimmer-light)" }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap px-4 sm:px-6">
        {/* Lead count — shows filtered vs total when filter is active */}
        <p className="text-sm text-[var(--text-body)]">
          {isFiltered ? (
            <>
              <span className="font-semibold text-[var(--text-title)]">{filteredCount}</span>
              <span className="text-[#5a5a5a]"> / {totalLeads}</span>
              {" "}
              {filteredCount === 1 ? "lead" : "leads"} no período
            </>
          ) : (
            <>
              <span className="font-semibold text-[var(--text-title)]">{totalLeads}</span>
              {" "}
              {totalLeads === 1 ? "lead" : "leads"} no funil
            </>
          )}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period filter */}
          <PeriodFilter onChange={setDateFilter} />

          <Link
            href="/crm/integracoes"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all hover:scale-[1.02] active:scale-95 backdrop-blur-md"
            style={{
              background: "rgba(74,143,212,0.08)",
              border: "1px solid rgba(74,143,212,0.2)",
              color: "#4a8fd4",
            }}
          >
            <Plug size={14} />
            <span className="hidden sm:inline">Integrações</span>
          </Link>

          <motion.button
            onClick={openCreateModal}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="lc-btn flex items-center gap-2 px-4 py-2 text-sm"
          >
            <Plus size={16} strokeWidth={2.5} />
            Novo Lead
          </motion.button>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Scroll horizontal — snap por coluna no mobile */}
        <div
          className="flex gap-4 overflow-x-auto px-4 pb-4 sm:px-6"
          style={{
            scrollSnapType: "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {KANBAN_COLUMNS.map((col, i) => (
            <motion.div
              key={col.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
              style={{ scrollSnapAlign: "start" }}
              className="flex-shrink-0"
            >
              <KanbanColumn
                column={col}
                leads={leadsByColumn[col.id]}
                totalValue={leadsByColumn[col.id].reduce(
                  (sum, l) => sum + (l.deal_value ?? 0),
                  0
                )}
                onEditLead={openEditModal}
              />
            </motion.div>
          ))}
        </div>

        {/* DragOverlay — card flutuante com rotação enquanto arrasta */}
        <DragOverlay dropAnimation={{ duration: 200, easing: "ease" }}>
          {activeLead ? (
            <div style={{ transform: "rotate(2deg)" }}>
              <LeadCard lead={activeLead} isDragOverlay onEdit={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Modal criar / editar */}
      <LeadModal
        isOpen={isModalOpen}
        lead={editingLead}
        onClose={closeModal}
        onCreate={createLead}
        onUpdate={updateLead}
        onDelete={deleteLead}
      />
    </>
  );
}
