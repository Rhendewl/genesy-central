"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Pencil,
  Archive,
  RotateCcw,
  Loader2,
  AlertCircle,
  GitBranch,
} from "lucide-react";
import { usePipelines } from "@/hooks/usePipelines";
import type { CrmPipelineWithStages, NewCrmPipeline, UpdateCrmStage } from "@/types/crm";
import { PipelineFormModal } from "./PipelineFormModal";
import { StageList, type DeleteStageResult } from "./StageList";
import { Button } from "@/components/ui/button";

// ── Confirm dialog ────────────────────────────────────────────────────────────
// Segue o mesmo padrão visual dos modais desta seção (overlay + var(--card)).

interface ConfirmDialogProps {
  open:        boolean;
  title:       string;
  description: string;
  confirmLabel?: string;
  onConfirm:   () => void;
  onCancel:    () => void;
}

function ConfirmDialog({
  open, title, description, confirmLabel = "Confirmar", onConfirm, onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div
      className="lc-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.60)" }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div
        className="w-full max-w-sm rounded-2xl overflow-hidden"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="px-5 py-5 flex flex-col gap-3">
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>{title}</p>
          <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>{description}</p>
        </div>
        <div
          className="flex justify-end gap-2 px-5 py-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
            style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
            style={{ background: "#ef4444", color: "#fff" }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pipeline row ──────────────────────────────────────────────────────────────

function PipelineRow({
  pipeline,
  onEdit,
  onArchive,
  onRestore,
  onUpdateStage,
  onCreateStage,
  onReorderStages,
  onDeleteStage,
}: {
  pipeline:        CrmPipelineWithStages;
  onEdit:          (p: CrmPipelineWithStages) => void;
  onArchive:       (id: string) => Promise<boolean>;
  onRestore:       (id: string) => Promise<boolean>;
  onUpdateStage:   (pipelineId: string, stageId: string, data: UpdateCrmStage) => Promise<boolean>;
  onCreateStage:   (pipelineId: string, data: { name: string } & UpdateCrmStage) => Promise<boolean>;
  onReorderStages: (pipelineId: string, orderedIds: string[]) => Promise<void>;
  onDeleteStage:   (pipelineId: string, stageId: string, force?: boolean) => Promise<DeleteStageResult>;
}) {
  const [expanded,       setExpanded]       = useState(false);
  const [acting,         setActing]         = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  const stageCount  = pipeline.crm_stages?.length ?? 0;
  const activeCount = (pipeline.crm_stages ?? []).filter(s => s.is_active).length;

  async function handleArchiveConfirmed() {
    setConfirmArchive(false);
    setActing(true);
    try {
      await onArchive(pipeline.id);
    } finally {
      setActing(false);
    }
  }

  async function handleRestore() {
    setActing(true);
    try {
      await onRestore(pipeline.id);
    } finally {
      setActing(false);
    }
  }

  return (
    <>
      <div
        className="rounded-xl overflow-hidden"
        style={{
          border:     "1px solid var(--border)",
          background: "var(--card)",
          opacity:    pipeline.is_active ? 1 : 0.6,
        }}
      >
        {/* Pipeline header */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          {/* Expand toggle */}
          <button
            type="button"
            onClick={() => setExpanded(e => !e)}
            className="flex-shrink-0 p-0.5 rounded transition-colors hover:bg-[var(--hover)]"
            style={{ color: "var(--muted-foreground)" }}
            aria-label={expanded ? "Recolher" : "Expandir"}
          >
            {expanded
              ? <ChevronDown  size={14} />
              : <ChevronRight size={14} />
            }
          </button>

          {/* Color bar */}
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: pipeline.color }}
          />

          {/* Name + meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p
                className="text-sm font-medium truncate"
                style={{ color: "var(--text-title)" }}
              >
                {pipeline.name}
              </p>
              {!pipeline.is_active && (
                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                  style={{ background: "var(--hover)", color: "var(--muted-foreground)" }}
                >
                  arquivado
                </span>
              )}
            </div>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              {activeCount} etapa{activeCount !== 1 ? "s" : ""} ativa{activeCount !== 1 ? "s" : ""}
              {stageCount > activeCount && ` · ${stageCount - activeCount} inativa${stageCount - activeCount !== 1 ? "s" : ""}`}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {acting ? (
              <Loader2 size={13} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onEdit(pipeline)}
                  className="p-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  title="Editar pipeline"
                >
                  <Pencil size={13} />
                </button>
                {pipeline.is_active ? (
                  <button
                    type="button"
                    onClick={() => setConfirmArchive(true)}
                    className="p-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors"
                    style={{ color: "var(--muted-foreground)" }}
                    title="Arquivar pipeline"
                  >
                    <Archive size={13} />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleRestore}
                    className="p-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors"
                    style={{ color: "var(--muted-foreground)" }}
                    title="Restaurar pipeline"
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Expanded stage list */}
        {expanded && (
          <div style={{ borderTop: "1px solid var(--border-card)" }}>
            <StageList
              pipelineId={pipeline.id}
              stages={[...(pipeline.crm_stages ?? [])].sort((a, b) => a.order_index - b.order_index)}
              onReorder={onReorderStages}
              onUpdate={onUpdateStage}
              onCreate={onCreateStage}
              onDelete={onDeleteStage}
            />
          </div>
        )}
      </div>

      {/* Archive confirmation — rendered outside the card to avoid z-index issues */}
      <ConfirmDialog
        open={confirmArchive}
        title="Arquivar pipeline?"
        description={`"${pipeline.name}" será ocultado do gerenciamento. As etapas e o histórico dos leads são preservados. Você pode restaurar a qualquer momento.`}
        confirmLabel="Arquivar"
        onConfirm={handleArchiveConfirmed}
        onCancel={() => setConfirmArchive(false)}
      />
    </>
  );
}

// ── PipelineAdmin ─────────────────────────────────────────────────────────────

export function PipelineAdmin() {
  const {
    pipelines,
    isLoading,
    error,
    createPipeline,
    updatePipeline,
    archivePipeline,
    restorePipeline,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
  } = usePipelines();

  const [showArchived,    setShowArchived]    = useState(false);
  const [isModalOpen,     setIsModalOpen]     = useState(false);
  const [editingPipeline, setEditingPipeline] = useState<CrmPipelineWithStages | null>(null);

  const activePipelines   = pipelines.filter(p => p.is_active);
  const archivedPipelines = pipelines.filter(p => !p.is_active);
  const visiblePipelines  = showArchived
    ? pipelines
    : activePipelines;

  function openCreate() {
    setEditingPipeline(null);
    setIsModalOpen(true);
  }

  function openEdit(p: CrmPipelineWithStages) {
    setEditingPipeline(p);
    setIsModalOpen(true);
  }

  async function handleSavePipeline(data: NewCrmPipeline): Promise<boolean> {
    if (editingPipeline) return updatePipeline(editingPipeline.id, data);
    // New pipeline: order_index = after last active
    const maxOrder = activePipelines.reduce((m, p) => Math.max(m, p.order_index), -1);
    return createPipeline({ ...data, order_index: maxOrder + 1 });
  }

  async function handleCreateStage(
    pipelineId: string,
    data: { name: string } & UpdateCrmStage,
  ): Promise<boolean> {
    return createStage(pipelineId, { pipeline_id: pipelineId, ...data });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-12 px-6" style={{ color: "var(--muted-foreground)" }}>
        <Loader2 size={15} className="animate-spin" />
        <span className="text-sm">Carregando pipelines…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 py-12 px-6" style={{ color: "#ef4444" }}>
        <AlertCircle size={15} />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  return (
    <>
      <div className="px-4 sm:px-6 pt-5 pb-10 flex flex-col gap-4 max-w-2xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>
              {activePipelines.length} pipeline{activePipelines.length !== 1 ? "s" : ""}
            </p>
            {archivedPipelines.length > 0 && (
              <button
                type="button"
                onClick={() => setShowArchived(v => !v)}
                className="text-[11px] px-2 py-0.5 rounded-full transition-colors"
                style={{
                  background: showArchived ? "var(--border-card-drag)" : "transparent",
                  color: "var(--muted-foreground)",
                  border: "1px solid var(--border)",
                }}
              >
                {showArchived ? "Ocultar arquivados" : `+${archivedPipelines.length} arquivado${archivedPipelines.length !== 1 ? "s" : ""}`}
              </button>
            )}
          </div>
          <Button
            type="button"
            onClick={openCreate}
            icon={<GitBranch size={12} />}
            signature
            size="small"
          >
            Novo Pipeline
          </Button>
        </div>

        {/* Pipeline list */}
        {visiblePipelines.length === 0 ? (
          <div
            className="rounded-xl p-8 flex flex-col items-center gap-3 text-center"
            style={{ border: "1px solid var(--border)", background: "var(--card)" }}
          >
            <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>Nenhum pipeline ainda</p>
            <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
              Crie um pipeline para começar a organizar seus leads em etapas.
            </p>
            <Button
              type="button"
              onClick={openCreate}
              icon={<GitBranch size={12} />}
              signature
              size="small"
            >
              Criar Primeiro Pipeline
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {visiblePipelines.map(pipeline => (
              <PipelineRow
                key={pipeline.id}
                pipeline={pipeline}
                onEdit={openEdit}
                onArchive={archivePipeline}
                onRestore={restorePipeline}
                onUpdateStage={updateStage}
                onCreateStage={handleCreateStage}
                onReorderStages={reorderStages}
                onDeleteStage={deleteStage}
              />
            ))}
          </div>
        )}
      </div>

      <PipelineFormModal
        open={isModalOpen}
        pipeline={editingPipeline}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePipeline}
      />
    </>
  );
}
