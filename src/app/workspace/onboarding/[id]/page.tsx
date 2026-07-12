"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Building2, Calendar, ChevronDown, ChevronUp, GripVertical, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useCurrentMember } from "@/context/CurrentMemberContext";
import { useOnboardingProject } from "@/hooks/useOnboardingProject";
import { OnboardingTaskPanel } from "@/components/workspace/onboarding/OnboardingTaskPanel";
import { OnboardingHistoryTab } from "@/components/workspace/onboarding/OnboardingHistoryTab";
import { PriorityBadge } from "@/components/workspace/PriorityBadge";
import { ProgressBar } from "@/components/workspace/ProgressBar";
import { ONBOARDING_PROJECT_STATUSES, ONBOARDING_TASK_STATUSES } from "@/types/onboarding";

type Tab = "projeto" | "historico";

export default function OnboardingProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { member } = useCurrentMember();
  const isAdmin = member?.role === "admin";

  const { detail, isLoading, updateProject, deleteProject, addStage, updateStage, deleteStage, addTask } = useOnboardingProject(id);
  const [tab, setTab] = useState<Tab>("projeto");
  const [panel, setPanel] = useState<{ taskId: string | null; stageId: string | null } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [stageModal, setStageModal] = useState<{ mode: "create" | "edit"; stageId?: string } | null>(null);
  const [stageDelete, setStageDelete] = useState<{ id: string; name: string } | null>(null);
  const [projectName, setProjectName] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [manualStatus, setManualStatus] = useState<"aguardando_cliente" | "cancelado" | "">("");
  const [isProjectSaving, setIsProjectSaving] = useState(false);
  const [stageName, setStageName] = useState("");
  const [stageDueDate, setStageDueDate] = useState("");
  const [stageColor, setStageColor] = useState("#4a8fd4");
  const [isStageSaving, setIsStageSaving] = useState(false);
  const [dragStageId, setDragStageId] = useState<string | null>(null);

  function openEditModal() {
    if (!detail) return;
    setProjectName(detail.name);
    setTargetDate(detail.target_date ?? "");
    setManualStatus(detail.manual_status ?? "");
    setEditOpen(true);
  }

  async function handleSaveProject() {
    if (!projectName.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    setIsProjectSaving(true);
    const result = await updateProject({
      name: projectName.trim(),
      target_date: targetDate || null,
      manual_status: manualStatus || null,
    });
    setIsProjectSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setEditOpen(false);
  }

  async function handleDeleteProject() {
    setIsProjectSaving(true);
    const result = await deleteProject();
    setIsProjectSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    router.push("/workspace/onboarding");
  }

  function openCreateStageModal() {
    setStageName("");
    setStageDueDate("");
    setStageColor("#4a8fd4");
    setStageModal({ mode: "create" });
  }

  function openEditStageModal(stage: { id: string; name: string; due_date: string | null; color: string }) {
    setStageName(stage.name);
    setStageDueDate(stage.due_date ?? "");
    setStageColor(stage.color);
    setStageModal({ mode: "edit", stageId: stage.id });
  }

  async function handleSaveStage() {
    if (!stageModal) return;
    if (!stageName.trim()) {
      toast.error("Nome da etapa é obrigatório");
      return;
    }

    setIsStageSaving(true);
    const payload = {
      name: stageName.trim(),
      due_date: stageDueDate || null,
      color: stageColor || "#4a8fd4",
    };
    const result = stageModal.mode === "create"
      ? await addStage(payload)
      : await updateStage(stageModal.stageId!, payload);
    setIsStageSaving(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    setStageModal(null);
  }

  async function handleDeleteStage() {
    if (!stageDelete) return;
    setIsStageSaving(true);
    const result = await deleteStage(stageDelete.id);
    setIsStageSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setStageDelete(null);
  }

  async function moveStage(stageIndex: number, direction: -1 | 1) {
    if (!detail) return;
    const current = detail.stages[stageIndex];
    const target = detail.stages[stageIndex + direction];
    if (!current || !target) return;

    const first = await updateStage(current.id, { order_index: target.order_index });
    if (first.error) {
      toast.error(first.error);
      return;
    }
    const second = await updateStage(target.id, { order_index: current.order_index });
    if (second.error) toast.error(second.error);
  }

  async function reorderStageByDrop(targetStageId: string) {
    if (!detail || !dragStageId || dragStageId === targetStageId) {
      setDragStageId(null);
      return;
    }

    const sourceIndex = detail.stages.findIndex((stage) => stage.id === dragStageId);
    const targetIndex = detail.stages.findIndex((stage) => stage.id === targetStageId);
    if (sourceIndex < 0 || targetIndex < 0) {
      setDragStageId(null);
      return;
    }

    const next = [...detail.stages];
    const [source] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, source);
    setDragStageId(null);

    for (let index = 0; index < next.length; index++) {
      if (next[index].order_index === index) continue;
      const result = await updateStage(next[index].id, { order_index: index });
      if (result.error) {
        toast.error(result.error);
        return;
      }
    }
  }

  if (isLoading || !detail) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded-lg" style={{ background: "var(--card)" }} />
        <div className="h-40 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
      </div>
    );
  }

  const statusMeta = ONBOARDING_PROJECT_STATUSES.find((s) => s.id === detail.status);
  const allTasks = detail.stages.flatMap((s) => s.tasks);
  const nonCancelled = allTasks.filter((t) => t.status !== "cancelado");
  const doneTasks = nonCancelled.filter((t) => t.status === "concluido").length;
  const progress = nonCancelled.length > 0 ? Math.round((doneTasks / nonCancelled.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-5 px-4 pb-24 pt-4 sm:px-6">
      <button
        onClick={() => router.push("/workspace/onboarding")}
        className="flex w-fit items-center gap-1.5 text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        <ArrowLeft size={15} />
        Onboardings
      </button>

      <div className="flex flex-col gap-3 lc-card p-4" style={{ borderTop: `2px solid ${statusMeta?.color ?? "#7c878e"}` }}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>{detail.name}</h1>
            {detail.client_name && (
              <p className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <Building2 size={12} />{detail.client_name}
              </p>
            )}
          </div>
          {statusMeta && (
            <div className="flex items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-xs font-medium"
                style={{ background: `${statusMeta.color}18`, color: statusMeta.color, border: `1px solid ${statusMeta.color}28` }}
              >
                {statusMeta.label}
              </span>
              {isAdmin && (
                <>
                  <button
                    onClick={openEditModal}
                    className="rounded-full p-2 transition-all hover:scale-105"
                    style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
                    aria-label="Editar onboarding"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => setDeleteOpen(true)}
                    className="rounded-full p-2 transition-all hover:scale-105"
                    style={{ background: "#e05c5c14", color: "#e05c5c", border: "1px solid #e05c5c30" }}
                    aria-label="Excluir onboarding"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <ProgressBar percent={progress} />
        <div className="flex items-center gap-4 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <span className="flex items-center gap-1"><Calendar size={12} />Início: {new Date(detail.start_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
          {detail.target_date && (
            <span className="flex items-center gap-1"><Calendar size={12} />Meta: {new Date(detail.target_date + "T00:00:00").toLocaleDateString("pt-BR")}</span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        {([["projeto", "Projeto"], ["historico", "Histórico"]] as [Tab, string][]).map(([id2, label]) => (
          <button
            key={id2}
            onClick={() => setTab(id2)}
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{ background: tab === id2 ? "var(--hover)" : "transparent", color: tab === id2 ? "var(--text-title)" : "var(--muted-foreground)" }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "projeto" && (
        <div className="flex flex-col gap-4">
          {isAdmin && (
            <button
              onClick={openCreateStageModal}
              className="flex w-fit items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all active:scale-95"
              style={{ background: "var(--hover)", color: "var(--text-title)", border: "1px solid var(--glass-border)" }}
            >
              <Plus size={13} />
              Nova etapa
            </button>
          )}

          {detail.stages.length === 0 && (
            <p className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhuma etapa ainda.</p>
          )}
          {detail.stages.map((stage, idx) => (
            <div
              key={stage.id}
              onDragOver={(event) => { if (isAdmin && dragStageId) event.preventDefault(); }}
              onDrop={() => { if (isAdmin) void reorderStageByDrop(stage.id); }}
              className="lc-card p-4 transition-opacity"
              style={{ borderLeft: `3px solid ${stage.color}`, opacity: dragStageId === stage.id ? 0.55 : 1 }}
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-start gap-2">
                  {isAdmin && (
                    <button
                      draggable
                      onDragStart={(event) => {
                        setDragStageId(stage.id);
                        event.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => setDragStageId(null)}
                      className="mt-0.5 cursor-grab rounded p-1 active:cursor-grabbing"
                      aria-label="Arrastar etapa para reordenar"
                      title="Arrastar etapa"
                    >
                      <GripVertical size={14} style={{ color: "var(--muted-foreground)" }} />
                    </button>
                  )}
                  <div className="min-w-0">
                  <p className="truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>{idx + 1}. {stage.name}</p>
                  {stage.due_date && (
                    <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                      Prazo: {new Date(stage.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                    </span>
                  )}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => void moveStage(idx, -1)}
                      disabled={idx === 0}
                      className="rounded-full p-1.5 disabled:opacity-30"
                      aria-label="Mover etapa para cima"
                    >
                      <ChevronUp size={13} style={{ color: "var(--muted-foreground)" }} />
                    </button>
                    <button
                      onClick={() => void moveStage(idx, 1)}
                      disabled={idx === detail.stages.length - 1}
                      className="rounded-full p-1.5 disabled:opacity-30"
                      aria-label="Mover etapa para baixo"
                    >
                      <ChevronDown size={13} style={{ color: "var(--muted-foreground)" }} />
                    </button>
                    <button
                      onClick={() => openEditStageModal(stage)}
                      className="rounded-full p-1.5 hover:bg-[var(--hover)]"
                      aria-label="Editar etapa"
                    >
                      <Pencil size={13} style={{ color: "var(--muted-foreground)" }} />
                    </button>
                    <button
                      onClick={() => setStageDelete({ id: stage.id, name: stage.name })}
                      className="rounded-full p-1.5 hover:bg-red-500/10"
                      aria-label="Excluir etapa"
                    >
                      <Trash2 size={13} style={{ color: "#e05c5c" }} />
                    </button>
                  </div>
                )}
              </div>
              <ProgressBar percent={stage.progress_percent ?? 0} showLabel={false} />

              <div className="mt-3 flex flex-col gap-1">
                {stage.tasks.map((task) => {
                  const statusMetaTask = ONBOARDING_TASK_STATUSES.find((s) => s.id === task.status);
                  const blockedDeps = (task.depends_on_task_ids ?? [])
                    .map((depId) => allTasks.find((t) => t.id === depId))
                    .filter((t) => t && t.status !== "concluido");
                  return (
                    <button
                      key={task.id}
                      onClick={() => setPanel({ taskId: task.id, stageId: task.stage_id })}
                      className="flex w-full flex-wrap items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--hover)]"
                    >
                      <span
                        className="flex-1 truncate text-sm"
                        style={{ color: task.status === "concluido" ? "var(--muted-foreground)" : "var(--text-title)", textDecoration: task.status === "concluido" ? "line-through" : "none" }}
                      >
                        {task.title}
                      </span>
                      {task.assignee_name && (
                        <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--hover)", color: "var(--muted-foreground)" }}>
                          {task.assignee_name}
                        </span>
                      )}
                      <PriorityBadge priority={task.priority} />
                      {statusMetaTask && task.status !== "a_fazer" && (
                        <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{statusMetaTask.label}</span>
                      )}
                      {blockedDeps.length > 0 && (
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: "#e0a344" }}>
                          <AlertTriangle size={11} />Aguardando {blockedDeps.length === 1 ? blockedDeps[0]!.title : `${blockedDeps.length} tarefas`}
                        </span>
                      )}
                      {(task.checklist_total ?? 0) > 0 && (
                        <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>{task.checklist_done}/{task.checklist_total}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {isAdmin && (
                <button
                  onClick={() => setPanel({ taskId: null, stageId: stage.id })}
                  className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Plus size={13} />
                  Nova tarefa
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {tab === "historico" && <OnboardingHistoryTab projectId={id} />}

      {panel && (
        <OnboardingTaskPanel
          taskId={panel.taskId}
          stageId={panel.stageId}
          isAdmin={isAdmin}
          myProfileId={member?.id ?? null}
          allProjectTasks={allTasks}
          onClose={() => setPanel(null)}
          onCreate={async (data) => {
            const result = await addTask(data);
            if (result.error) toast.error(result.error);
            return result;
          }}
        />
      )}

      {editOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 lc-scrim"
          style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
          onClick={() => setEditOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl"
            style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Editar onboarding</p>
              <button onClick={() => setEditOpen(false)} className="rounded p-1 hover:bg-[var(--hover)]" aria-label="Fechar">
                <X size={16} style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Nome</label>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Data meta</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Status manual</label>
                <select
                  value={manualStatus}
                  onChange={(e) => setManualStatus(e.target.value as typeof manualStatus)}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
                >
                  <option value="">Automático</option>
                  <option value="aguardando_cliente">Aguardando cliente</option>
                  <option value="cancelado">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
              <button
                onClick={() => setEditOpen(false)}
                className="rounded-full px-4 py-1.5 text-xs"
                style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProject}
                disabled={isProjectSaving}
                className="lc-btn flex items-center gap-1.5 px-4 py-1.5 text-xs disabled:opacity-40"
              >
                {isProjectSaving && <Loader2 size={12} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 lc-scrim"
          style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
          onClick={() => setDeleteOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl"
            style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pb-3 pt-5">
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Excluir onboarding?</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                Esta ação remove o projeto, etapas, tarefas e histórico relacionado.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
              <button
                onClick={() => setDeleteOpen(false)}
                className="rounded-full px-4 py-1.5 text-xs"
                style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteProject}
                disabled={isProjectSaving}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-40"
                style={{ background: "#e05c5c18", color: "#ff6b6b", border: "1px solid #e05c5c35" }}
              >
                {isProjectSaving && <Loader2 size={12} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {stageModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 lc-scrim"
          style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
          onClick={() => setStageModal(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl"
            style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-2 pt-5">
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
                {stageModal.mode === "create" ? "Nova etapa" : "Editar etapa"}
              </p>
              <button onClick={() => setStageModal(null)} className="rounded p-1 hover:bg-[var(--hover)]" aria-label="Fechar">
                <X size={16} style={{ color: "var(--muted-foreground)" }} />
              </button>
            </div>

            <div className="flex flex-col gap-4 px-5 py-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Nome da etapa</label>
                <input
                  value={stageName}
                  onChange={(e) => setStageName(e.target.value)}
                  className="rounded-lg px-3 py-2 text-sm outline-none"
                  style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Prazo da etapa</label>
                  <input
                    type="date"
                    value={stageDueDate}
                    onChange={(e) => setStageDueDate(e.target.value)}
                    className="rounded-lg px-3 py-2 text-sm outline-none"
                    style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Cor</label>
                  <input
                    type="color"
                    value={stageColor}
                    onChange={(e) => setStageColor(e.target.value)}
                    className="h-[38px] w-12 cursor-pointer rounded-lg p-1"
                    style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}
                    aria-label="Cor da etapa"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
              <button
                onClick={() => setStageModal(null)}
                className="rounded-full px-4 py-1.5 text-xs"
                style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveStage}
                disabled={isStageSaving}
                className="lc-btn flex items-center gap-1.5 px-4 py-1.5 text-xs disabled:opacity-40"
              >
                {isStageSaving && <Loader2 size={12} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {stageDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 lc-scrim"
          style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
          onClick={() => setStageDelete(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl"
            style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pb-3 pt-5">
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Excluir etapa?</p>
              <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                A etapa <span className="font-medium">{stageDelete.name}</span> será removida junto com as tarefas dela.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
              <button
                onClick={() => setStageDelete(null)}
                className="rounded-full px-4 py-1.5 text-xs"
                style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteStage}
                disabled={isStageSaving}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium disabled:opacity-40"
                style={{ background: "#e05c5c18", color: "#ff6b6b", border: "1px solid #e05c5c35" }}
              >
                {isStageSaving && <Loader2 size={12} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
