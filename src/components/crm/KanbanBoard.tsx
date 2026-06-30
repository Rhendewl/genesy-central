"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import { ChevronDown, Loader2, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";

import { useLeads, UNASSIGNED_STAGE_KEY } from "@/hooks/useLeads";
import { usePipelines } from "@/hooks/usePipelines";
import type { Lead } from "@/types";
import type { CrmStage } from "@/types/crm";
import { KanbanColumn } from "./KanbanColumn";
import { LeadCard } from "./LeadCard";
import { LeadModal } from "./LeadModal";
import { PeriodFilter, type DateFilter } from "./PeriodFilter";
import { CrmSettingsModal } from "./settings/CrmSettingsModal";

// ─────────────────────────────────────────────────────────────────────────────
// KanbanBoard
//
// Camada de orquestração do CRM:
//  - Renderiza colunas a partir das stages do pipeline selecionado
//  - Seletor de pipeline quando há mais de um ativo
//  - DndContext: PointerSensor (threshold 8px) + KeyboardSensor
//  - handleDragEnd: resolve stage de destino (stage UUID), chama moveLead
//    Toda movimentação passa por PATCH /api/crm/leads/[id]/move → LeadService
//  - Dialog de observação obrigatória: se stage.require_note, exige nota
//    antes de confirmar a movimentação
//  - PeriodFilter: filtra leads por data (client-side, instantâneo)
// ─────────────────────────────────────────────────────────────────────────────

interface PendingMove {
  leadId:        string;
  targetStageId: string;
}

export function KanbanBoard() {
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);

  const {
    leads,
    totalLeads,
    leadsByStage,
    isLoading: leadsLoading,
    error,
    moveLead,
    createLead,
    updateLead,
    deleteLead,
    getLeadById,
  } = useLeads(dateFilter);

  const {
    pipelines,
    isLoading: pipelinesLoading,
  } = usePipelines();

  // ── Pipeline selection ─────────────────────────────────────────────────────

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  const activePipelines = pipelines.filter((p) => p.is_active);

  // Auto-seleciona o primeiro pipeline ativo na montagem
  useEffect(() => {
    if (!selectedPipelineId && activePipelines.length > 0) {
      setSelectedPipelineId(activePipelines[0].id);
    }
  }, [activePipelines, selectedPipelineId]);

  const selectedPipeline = activePipelines.find((p) => p.id === selectedPipelineId) ?? null;

  // Stages ativas do pipeline selecionado, ordenadas por order_index
  const stages: CrmStage[] = (selectedPipeline?.crm_stages ?? [])
    .filter((s) => s.is_active)
    .sort((a, b) => a.order_index - b.order_index);

  // ── Drag-and-drop state ────────────────────────────────────────────────────

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // ── require_note dialog state ──────────────────────────────────────────────

  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [pendingNote, setPendingNote] = useState("");
  const [isMoveSubmitting, setIsMoveSubmitting] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

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
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const leadId = active.id as string;
      const draggedLead = leads.find((l) => l.id === leadId);
      if (!draggedLead) return;

      // over.id pode ser o UUID de uma stage OU o UUID de outro lead (card)
      const isStageId = stages.some((s) => s.id === over.id);
      let targetStageId: string;

      if (isStageId) {
        targetStageId = over.id as string;
      } else {
        // over é um lead card — resolve a stage pelo lead alvo
        const overLead = leads.find((l) => l.id === over.id);
        if (!overLead?.stage_id) return;
        targetStageId = overLead.stage_id;
      }

      if (draggedLead.stage_id === targetStageId) return;

      // Verifica require_note da stage alvo (usando dado local já carregado)
      const targetStage = stages.find((s) => s.id === targetStageId);
      if (targetStage?.require_note) {
        // Exibe dialog antes de mover — sem update otimista
        setPendingMove({ leadId, targetStageId });
        setPendingNote("");
        setTimeout(() => noteInputRef.current?.focus(), 80);
        return;
      }

      const result = await moveLead(leadId, targetStageId);
      if (!result.ok && !result.requireNote) {
        toast.error(result.error ?? "Erro ao mover lead");
      }
    },
    [leads, stages, moveLead]
  );

  const handleDragCancel = useCallback(() => setActiveId(null), []);

  // ── Note dialog handlers ───────────────────────────────────────────────────

  async function handleNoteSubmit() {
    if (!pendingMove || !pendingNote.trim()) return;
    setIsMoveSubmitting(true);
    const result = await moveLead(pendingMove.leadId, pendingMove.targetStageId, pendingNote.trim());
    setIsMoveSubmitting(false);
    setPendingMove(null);
    setPendingNote("");
    if (!result.ok) {
      toast.error(result.error ?? "Erro ao mover lead");
    }
  }

  function handleNoteCancel() {
    setPendingMove(null);
    setPendingNote("");
  }

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

  const activeLead    = activeId ? getLeadById(activeId) : null;
  const isFiltered    = dateFilter !== null;
  const filteredCount = leads.length;
  const isLoading     = leadsLoading || pipelinesLoading;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex gap-4 overflow-hidden px-4 py-2 sm:px-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-72 flex-shrink-0 animate-pulse rounded-3xl p-4"
            style={{ height: 420, background: "var(--card)" }}
          >
            <div className="mb-4 h-5 w-32 rounded-full" style={{ background: "var(--shimmer-base)" }} />
            {[1, 2, 3].map((j) => (
              <div key={j} className="mb-3 h-24 rounded-2xl" style={{ background: "var(--shimmer-light)" }} />
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

  // ── No active pipeline ─────────────────────────────────────────────────────

  if (activePipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <p className="text-sm text-[var(--muted-foreground)]">Nenhum pipeline ativo.</p>
        <p className="text-xs text-[var(--muted-foreground)]/60">
          Crie ou ative um pipeline em Configurações → CRM.
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap px-4 sm:px-6">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Lead count */}
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

          {/* Pipeline selector — só exibe quando há mais de um pipeline ativo */}
          {activePipelines.length > 1 && (
            <div className="relative">
              <select
                value={selectedPipelineId ?? ""}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
                className="h-8 appearance-none rounded-full border border-[var(--border)] bg-[var(--card)] pl-3 pr-8 text-xs text-[var(--text-title)] focus:outline-none focus:ring-1 focus:ring-[#b4b4b4]/40 cursor-pointer"
                style={{ background: "var(--card)" }}
              >
                {activePipelines.map((p) => (
                  <option key={p.id} value={p.id} style={{ background: "var(--background)" }}>
                    {p.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={12}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted-foreground)]"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Period filter */}
          <PeriodFilter onChange={setDateFilter} />

          {/* CRM settings */}
          {selectedPipeline && (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Configurações do CRM"
              className="flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium transition-colors hover:bg-white/[0.05]"
              style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
            >
              <Settings2 size={13} />
              Configurações
            </button>
          )}

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
          {stages.map((stage, i) => (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
              style={{ scrollSnapAlign: "start" }}
              className="flex-shrink-0"
            >
              <KanbanColumn
                stage={stage}
                leads={leadsByStage[stage.id] ?? []}
                totalValue={(leadsByStage[stage.id] ?? []).reduce(
                  (sum, l) => sum + (l.deal_value ?? 0),
                  0
                )}
                onEditLead={openEditModal}
              />
            </motion.div>
          ))}

          {/* Coluna "Sem etapa" — exibe leads legados sem stage_id */}
          {(leadsByStage[UNASSIGNED_STAGE_KEY] ?? []).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: stages.length * 0.06, ease: "easeOut" }}
              style={{ scrollSnapAlign: "start" }}
              className="flex-shrink-0"
            >
              <KanbanColumn
                stage={{
                  id:                 UNASSIGNED_STAGE_KEY,
                  pipeline_id:        selectedPipelineId ?? "",
                  user_id:            "",
                  name:               "Sem Etapa",
                  description:        null,
                  color:              "rgba(255,255,255,0.20)",
                  icon:               null,
                  order_index:        9999,
                  is_active:          true,
                  allow_free_move:    false,
                  require_note:       false,
                  require_attachment: false,
                  allow_edit:         false,
                  legacy_column:      null,
                  created_at:         "",
                  updated_at:         "",
                }}
                leads={leadsByStage[UNASSIGNED_STAGE_KEY] ?? []}
                totalValue={(leadsByStage[UNASSIGNED_STAGE_KEY] ?? []).reduce(
                  (sum, l) => sum + (l.deal_value ?? 0),
                  0
                )}
                onEditLead={openEditModal}
              />
            </motion.div>
          )}
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

      {/* ── Observação obrigatória dialog ──────────────────────────────────── */}
      {pendingMove && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 440, damping: 34 }}
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: "rgba(8,8,12,0.96)",
              border: "1px solid rgba(255,255,255,0.09)",
              boxShadow: "0 24px 64px rgba(0,0,0,0.65)",
            }}
          >
            <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
                Observação obrigatória
              </p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Esta etapa exige uma observação para registrar a movimentação do lead.
              </p>
              <textarea
                ref={noteInputRef}
                value={pendingNote}
                onChange={(e) => setPendingNote(e.target.value)}
                placeholder="Descreva o motivo da movimentação..."
                rows={3}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  color: "var(--text-title)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                    void handleNoteSubmit();
                  }
                  if (e.key === "Escape") handleNoteCancel();
                }}
              />
            </div>
            <div
              className="flex justify-end gap-2 px-5 py-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}
            >
              <button
                type="button"
                onClick={handleNoteCancel}
                disabled={isMoveSubmitting}
                className="rounded-full px-4 py-1.5 text-xs transition-colors disabled:opacity-40"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  color: "var(--muted-foreground)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleNoteSubmit()}
                disabled={!pendingNote.trim() || isMoveSubmitting}
                className="lc-btn flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs disabled:opacity-40"
              >
                {isMoveSubmitting && <Loader2 size={12} className="animate-spin" />}
                Confirmar
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal criar / editar */}
      <LeadModal
        isOpen={isModalOpen}
        lead={editingLead}
        stages={stages}
        onClose={closeModal}
        onCreate={createLead}
        onUpdate={updateLead}
        onDelete={deleteLead}
      />

      {/* CRM Settings modal */}
      {isSettingsOpen && selectedPipeline && (
        <CrmSettingsModal
          pipelineId={selectedPipeline.id}
          pipelineName={selectedPipeline.name}
          stages={stages}
          onClose={() => setIsSettingsOpen(false)}
        />
      )}
    </>
  );
}
