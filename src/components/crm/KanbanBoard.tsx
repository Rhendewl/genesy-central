"use client";
import "./crm-mobile.css";
import {useLeadActivityIndicators} from "@/hooks/useLeadActivityIndicators";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSegmentIndicator } from "@/components/ui/useSegmentIndicator";
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
import { ChevronDown, Cog, LayoutGrid, List, Loader2, Search, X, UserPlus, SlidersHorizontal, Plus } from "lucide-react";
import { toast } from "sonner";

import { matchesLeadSearch } from "@/lib/crm/lead-search";
import { EMPTY_LEAD_FILTERS, countActiveFilters, matchesLeadFilters, type LeadFilters } from "@/lib/crm/lead-filters";
import { LeadFiltersPanel } from "./LeadFiltersPanel";
import { leadPerfilLabel, perfilFromSearch } from "@/lib/crm/lead-perfil";
import { useLeads, UNASSIGNED_STAGE_KEY } from "@/hooks/useLeads";
import { usePipelines } from "@/hooks/usePipelines";
import type { Lead } from "@/types";
import type { CrmStage } from "@/types/crm";
import { KanbanColumn } from "./KanbanColumn";
import { LeadCard } from "./LeadCard";
import { LeadList } from "./LeadList";
import { useCrmViewPreferences } from "@/hooks/useCrmViewPreferences";
import { LeadModal } from "./LeadModal";
import { PeriodFilter, type DateFilter } from "./PeriodFilter";
import { CrmSettingsModal } from "./settings/CrmSettingsModal";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import { isAdministrativeMember } from "@/lib/user-access";
import { Button } from "@/components/ui/button";

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
  const [search, setSearch] = useState("");
  const [leadFilters, setLeadFilters] = useState<LeadFilters>(EMPTY_LEAD_FILTERS);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const viewSeg = useSegmentIndicator({ background: "var(--segment-active-bg)", boxShadow: "var(--segment-active-shadow)" });
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (mobileSearchOpen) searchInputRef.current?.focus(); }, [mobileSearchOpen]);
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null);
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  const {
    leads,
    totalLeads,
    isLoading: leadsLoading,
    error,
    moveLead,
    transferLead,
    createLead,
    updateLead,
    deleteLead,
    getLeadById,
  } = useLeads(dateFilter);

  const {
    pipelines,
    isLoading: pipelinesLoading,
  } = usePipelines();
  const { member, isOwner } = useCurrentMember();
  const hasFullCrmAccess = isAdministrativeMember(member, isOwner === true);
  const { preferences, updatePreferences } = useCrmViewPreferences(member?.id);
  const moveLock = useRef(false);

  // ── Pipeline selection ─────────────────────────────────────────────────────

  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  const visiblePipelines = hasFullCrmAccess
    ? pipelines
    : pipelines.filter((p) => p.id === member?.crm_pipeline_id);
  const activePipelines = visiblePipelines.filter((p) => p.is_active);

  // Auto-seleciona o primeiro pipeline ativo na montagem
  useEffect(() => {
    if (!selectedPipelineId && activePipelines.length > 0) {
      const requested = new URLSearchParams(window.location.search).get("pipeline");
      setSelectedPipelineId(activePipelines.find(p=>p.id===requested)?.id ?? activePipelines[0].id);
    }
  }, [activePipelines, selectedPipelineId]);

  const selectedPipeline = activePipelines.find((p) => p.id === selectedPipelineId) ?? null;

  // Etiquetas, responsáveis e formulários mudam de uma pipeline para outra.
  useEffect(() => { setLeadFilters(EMPTY_LEAD_FILTERS); }, [selectedPipelineId]);

  // Stages ativas do pipeline selecionado, ordenadas por order_index
  const stages: CrmStage[] = (selectedPipeline?.crm_stages ?? [])
    .filter((s) => s.is_active)
    .sort((a, b) => a.order_index - b.order_index);

  // ── Drag-and-drop state ────────────────────────────────────────────────────

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const openedFromLink = useRef<string | null>(null);
  useEffect(() => {
    const leadId = new URLSearchParams(window.location.search).get("lead");
    if (!leadId || openedFromLink.current === leadId || leadsLoading || pipelinesLoading) return;
    const lead = leads.find(item => item.id === leadId);
    if (!lead || !activePipelines.some(p => p.id === lead.pipeline_id)) return;
    openedFromLink.current = leadId;
    setSelectedPipelineId(lead.pipeline_id ?? null);
    setEditingLead(lead); setIsModalOpen(true);
  }, [leads, leadsLoading, pipelinesLoading, activePipelines]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // ── require_note dialog state ──────────────────────────────────────────────

  const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
  const [pendingNote, setPendingNote] = useState("");
  const [isMoveSubmitting, setIsMoveSubmitting] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(pointer: coarse)");
    const syncPointerMode = () => setIsTouchDevice(media.matches);

    syncPointerMode();
    media.addEventListener("change", syncPointerMode);
    return () => media.removeEventListener("change", syncPointerMode);
  }, []);

  // ── dnd-kit sensors ────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // Desktop: drag rápido por distância.
      // Touch: exige pressionar antes de arrastar, preservando swipe lateral do Kanban.
      activationConstraint: isTouchDevice
        ? { delay: 220, tolerance: 8 }
        : { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const requestMove = useCallback(async (leadId: string, targetStageId: string) => {
    if (moveLock.current || pendingMove) return;
    const lead = getLeadById(leadId);
    if (!lead || lead.stage_id === targetStageId) return;
    const target = stages.find(stage => stage.id === targetStageId);
    if (!target) return;
    if (target.require_note) {
      setPendingMove({ leadId, targetStageId });
      setPendingNote("");
      setTimeout(() => noteInputRef.current?.focus(), 80);
      return;
    }
    moveLock.current = true;
    setIsMoveSubmitting(true);
    try {
      const result = await moveLead(leadId, targetStageId);
      if (result.requireNote) {
        setPendingMove({ leadId, targetStageId });
        setPendingNote("");
        setTimeout(() => noteInputRef.current?.focus(), 80);
      } else if (!result.ok) toast.error(result.error ?? "Erro ao mover lead");
    } catch { toast.error("Erro ao mover lead. Tente novamente."); }
    finally { moveLock.current = false; setIsMoveSubmitting(false); }
  }, [getLeadById, stages, moveLead, pendingMove]);

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

      await requestMove(leadId, targetStageId);
    },
    [leads, stages, requestMove]
  );

  const handleDragCancel = useCallback(() => setActiveId(null), []);

  // ── Note dialog handlers ───────────────────────────────────────────────────

  async function handleNoteSubmit() {
    if (!pendingMove || !pendingNote.trim() || moveLock.current) return;
    moveLock.current = true;
    setIsMoveSubmitting(true);
    try {
      const result = await moveLead(pendingMove.leadId, pendingMove.targetStageId, pendingNote.trim());
      if (result.ok) { setPendingMove(null); setPendingNote(""); }
      else toast.error(result.error ?? "Erro ao mover lead");
    } catch { toast.error("Erro ao mover lead. Tente novamente."); }
    finally { moveLock.current = false; setIsMoveSubmitting(false); }
  }

  function handleNoteCancel() {
    if (moveLock.current) return;
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

  const leadActivities=useLeadActivityIndicators(leads.map(lead=>lead.id));
  const activeLead    = activeId ? getLeadById(activeId) : null;
  const isFiltered    = dateFilter !== null;
  const pipelineLeads = leads.filter((lead) => lead.pipeline_id === selectedPipelineId || (!lead.pipeline_id && !lead.stage_id));
  const visibleLeads = pipelineLeads.filter((lead) => matchesLeadSearch(lead, search) && matchesLeadFilters(lead, leadFilters));
  const activeFilterCount = countActiveFilters(leadFilters);
  const leadsByStage = visibleLeads.reduce<Record<string, Lead[]>>((groups, lead) => {
    const key = lead.stage_id ?? UNASSIGNED_STAGE_KEY;
    (groups[key] ??= []).push(lead); return groups;
  }, {});
  const filteredCount = visibleLeads.length;
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
          {hasFullCrmAccess
            ? "Crie ou ative um pipeline em Configurações → CRM."
            : "Solicite a um administrador que defina sua pipeline de acesso."}
        </p>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="crm-kanban-toolbar mb-4 flex flex-none items-center justify-between gap-3 flex-wrap px-4 sm:px-6">
        <div className="crm-kanban-context flex items-center gap-3 flex-wrap">
          {/* Lead count */}
          <p className="crm-kanban-count text-sm text-[var(--text-body)]"><span className="md:hidden" aria-label={`${filteredCount} leads nesta pipeline`}>{filteredCount}</span><span className="hidden md:inline">
            {isFiltered ? (
              <>
                <span className="font-semibold text-[var(--text-title)]">{filteredCount}</span>
                <span className="text-[var(--text-body)]"> / {totalLeads}</span>
                {" "}
                {filteredCount === 1 ? "lead" : "leads"} no período
              </>
            ) : (
              <>
                <span className="font-semibold text-[var(--text-title)]">{filteredCount}</span>
                {" "}
                {filteredCount === 1 ? "lead" : "leads"} no funil
              </>
            )}</span>
          </p>

          {/* Pipeline selector — só exibe quando há mais de um pipeline ativo */}
          {hasFullCrmAccess && activePipelines.length > 1 && (
            <div className="crm-kanban-pipeline relative">
              <select
                aria-label="Pipeline do funil"
                value={selectedPipelineId ?? ""}
                onChange={(e) => setSelectedPipelineId(e.target.value)}
                className="h-8 appearance-none rounded-full pl-3 pr-8 text-xs text-[var(--text-title)] focus:outline-none cursor-pointer"
                style={{
                  background: "var(--glass-bg-soft)",
                  backdropFilter: "blur(24px)",
                  WebkitBackdropFilter: "blur(24px)",
                  border: "1px solid var(--glass-border)",
                }}
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
          {(!hasFullCrmAccess || activePipelines.length <= 1) && <p className="crm-kanban-single-pipeline md:hidden">{selectedPipeline?.name ?? "Funil"}</p>}
          <div className="crm-kanban-mobile-actions md:hidden">
            <button type="button" aria-label={mobileSearchOpen?"Ocultar busca de leads":"Buscar leads"} aria-expanded={mobileSearchOpen} aria-controls="crm-kanban-search" onClick={()=>setMobileSearchOpen(value=>!value)} className={`crm-mobile-icon-button ${search||activeFilterCount?"is-active":""}`}><Search size={17}/></button>
            <button type="button" aria-label={mobileToolsOpen?"Ocultar filtros e opções":"Filtros e opções do funil"} aria-expanded={mobileToolsOpen} aria-controls="crm-kanban-options" onClick={()=>setMobileToolsOpen(value=>!value)} className={`crm-mobile-icon-button ${isFiltered?"is-active":""}`}><SlidersHorizontal size={17}/>{isFiltered&&<span className="crm-mobile-active-dot"/>}</button>
            <button type="button" aria-label="Adicionar novo lead" title="Novo lead" onClick={openCreateModal} className="crm-mobile-icon-button crm-mobile-add"><Plus size={19}/></button>
          </div>
        </div>

        <div id="crm-kanban-options" className={`crm-kanban-actions flex items-center gap-2 flex-wrap ${mobileToolsOpen?"is-open":""}`}>
          <div ref={viewSeg.trackRef} role="group" aria-label="Visualização do funil" className="relative flex h-[38.08px] items-stretch rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] p-1">
            {viewSeg.indicator}
            {([{ id: "kanban", label: "Kanban", icon: LayoutGrid }, { id: "list", label: "Lista", icon: List }] as const).map(view => (
              <button key={view.id} type="button" aria-label={view.label} title={view.label} aria-pressed={preferences.view === view.id} data-active={preferences.view === view.id} onClick={() => updatePreferences({ view: view.id })}
                className="relative z-[1] flex h-full min-h-0 items-center gap-2 rounded-lg px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                style={preferences.view === view.id ? { color: "var(--text-title)" } : { color: "var(--muted-foreground)" }}>
                <view.icon size={15} /><span className="hidden md:inline">{view.label}</span>
              </button>
            ))}
          </div>
          {/* CRM settings */}
          {hasFullCrmAccess && selectedPipeline && (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              title="Configurações do CRM"
              aria-label="Configurações do CRM"
              className="flex items-center justify-center w-8 h-8 rounded-full transition-all hover:brightness-125"
              style={{
                background: "var(--glass-bg-soft)",
                backdropFilter: "blur(24px)",
                WebkitBackdropFilter: "blur(24px)",
                border: "1px solid var(--glass-border)",
                color: "var(--muted-foreground)",
              }}
            >
              <Cog size={14} />
            </button>
          )}

          {/* Period filter */}
          <PeriodFilter onChange={setDateFilter} />

          <Button
            onClick={openCreateModal}
            icon={<UserPlus />}
            size="medium"
            signature
          >
            Novo Lead
          </Button>
        </div>
      </div>

      <div id="crm-kanban-search" className={`crm-kanban-search flex-none px-4 pb-3 sm:px-6 ${mobileSearchOpen?"is-open":""}`}>
        <div className="flex items-center gap-2">
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] px-4 focus-within:ring-2 focus-within:ring-sky-500/40">
          <Search size={18} className="shrink-0 text-[var(--muted-foreground)]" aria-hidden="true" />
          <input ref={searchInputRef} type="search" aria-label="Pesquisar lead por nome, telefone ou perfil" placeholder="Pesquisar por nome, telefone ou perfil (ex.: Corretor)…" value={search} onChange={(event) => setSearch(event.target.value)} className="min-h-11 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-title)] outline-none placeholder:text-[var(--muted-foreground)]" />
          {search && <button type="button" aria-label="Limpar pesquisa" onClick={() => setSearch("")} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg hover:bg-[var(--hover)]"><X size={16} /></button>}
        </label>
        <LeadFiltersPanel leads={pipelineLeads} pipelineId={selectedPipelineId} filters={leadFilters} onChange={setLeadFilters} />
        </div>
        {(search || activeFilterCount > 0) && <p role="status" className="mt-2 text-xs text-[var(--muted-foreground)]">{filteredCount ? `${filteredCount} ${filteredCount === 1 ? "lead encontrado" : "leads encontrados"}${perfilFromSearch(search) ? ` com perfil ${leadPerfilLabel(perfilFromSearch(search))}` : ""}` : "Nenhum lead encontrado nesta pipeline com os filtros atuais."}</p>}
      </div>
      {preferences.view === "list" ? (
        <LeadList leads={visibleLeads} stages={stages} pipelineId={selectedPipelineId} activities={leadActivities}
          preferences={preferences} onPreferencesChange={updatePreferences} onOpen={openEditModal}
          onMove={requestMove} moving={isMoveSubmitting || pendingMove !== null} />
      ) : (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        {/* Scroll horizontal — snap por coluna no mobile.
            scroll-snap-type fica desligado durante o drag: com ele ativo, o
            snap do CSS briga com o auto-scroll do dnd-kit (que também tenta
            mover este mesmo container enquanto o card é arrastado perto da
            borda) — na prática isso travava a rolagem e às vezes fazia ela
            "pular" pra última coluna assim que o snap vencia a disputa. */}
        <div
          className="flex min-h-0 flex-1 items-stretch gap-4 overflow-x-auto overflow-y-hidden scroll-px-4 px-4 pb-4 sm:scroll-px-6 sm:px-6"
          style={{
            scrollSnapType: activeId ? "none" : "x mandatory",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {stages.map((stage, i) => (
            <motion.div
              key={stage.id}
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.06, ease: "easeOut" }}
              style={{ scrollSnapAlign: "start" }}
              className="h-full flex-shrink-0"
            >
              <KanbanColumn
                activities={leadActivities}
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
              initial={{ y: 20 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.4, delay: stages.length * 0.06, ease: "easeOut" }}
              style={{ scrollSnapAlign: "start" }}
              className="h-full flex-shrink-0"
            >
              <KanbanColumn
                activities={leadActivities}
                stage={{
                  id:                 UNASSIGNED_STAGE_KEY,
                  pipeline_id:        selectedPipelineId ?? "",
                  user_id:            "",
                  name:               "Sem Etapa",
                  description:        null,
                  color:              "var(--text-empty)",
                  icon:               null,
                  order_index:        9999,
                  is_active:          true,
                  allow_free_move:    false,
                  require_note:       false,
                  require_attachment: false,
                  allow_edit:         false,
                  legacy_column:      null,
                  is_won:             false,
                is_lost:            false,
                metric_type:        null,
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
              <LeadCard lead={activeLead} activity={leadActivities[activeLead.id]} isDragOverlay onEdit={() => {}} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      )}

      {/* ── Observação obrigatória dialog ──────────────────────────────────── */}
      {pendingMove && (
        <div
          role="dialog" aria-modal="true" aria-labelledby="crm-move-note-title"
          className="lc-modal-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 440, damping: 34 }}
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              background: "var(--bg-modal)",
              border: "1px solid var(--border-modal)",
              boxShadow: "0 24px 64px var(--shadow-modal)",
            }}
          >
            <div className="px-5 pt-5 pb-4 flex flex-col gap-3">
              <p id="crm-move-note-title" className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
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
                  background: "var(--hover)",
                  border: "1px solid var(--glass-border)",
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
              style={{ borderTop: "1px solid var(--glass-border)" }}
            >
              <button
                type="button"
                onClick={handleNoteCancel}
                disabled={isMoveSubmitting}
                className="rounded-full px-4 py-1.5 text-xs transition-colors disabled:opacity-40"
                style={{
                  background: "var(--hover)",
                  color: "var(--muted-foreground)",
                  border: "1px solid var(--glass-border)",
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
        lead={editingLead ? getLeadById(editingLead.id) ?? editingLead : null}
        stages={stages}
        pipelines={visiblePipelines}
        onClose={closeModal}
        onCreate={createLead}
        onUpdate={updateLead}
        onMove={moveLead}
        onDelete={deleteLead}
        onTransfer={transferLead}
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
    </div>
  );
}
