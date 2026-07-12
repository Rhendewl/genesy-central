"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, X, GripVertical, FolderInput } from "lucide-react";
import { toast } from "sonner";
import { useOnboardingTemplate } from "@/hooks/useOnboardingTemplate";
import { TemplateTaskModal } from "@/components/workspace/onboarding/TemplateTaskModal";
import { PriorityBadge } from "@/components/workspace/PriorityBadge";
import type { OnboardingTemplateTask } from "@/types/onboarding";

const COLOR_SWATCHES = ["#4a8fd4", "#6b9b6f", "#e0a344", "#e05c5c", "#9b7fe0", "#7c878e"];

export default function OnboardingTemplateBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    detail, isLoading,
    updateTemplate,
    addStage, updateStage, deleteStage,
    addTask, updateTask, deleteTask,
  } = useOnboardingTemplate(id);

  const [taskModal, setTaskModal] = useState<{ stageId: string; task: OnboardingTemplateTask | null } | null>(null);

  if (isLoading || !detail) {
    return (
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="h-8 w-48 animate-pulse rounded-lg" style={{ background: "var(--card)" }} />
        <div className="h-40 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
      </div>
    );
  }

  const allTasks = detail.stages.flatMap((s) => s.tasks);

  async function handleAddStage() {
    const result = await addStage({ name: "Nova etapa" });
    if (result.error) toast.error(result.error);
  }

  return (
    <div className="flex flex-col gap-6 px-4 pb-24 pt-4 sm:px-6">
      <button
        onClick={() => router.push("/workspace/onboarding/templates")}
        className="flex w-fit items-center gap-1.5 text-sm"
        style={{ color: "var(--muted-foreground)" }}
      >
        <ArrowLeft size={15} />
        Templates
      </button>

      <div className="flex flex-col gap-3 lc-card p-4">
        <input
          defaultValue={detail.name}
          onBlur={(e) => { if (e.target.value.trim() && e.target.value !== detail.name) void updateTemplate({ name: e.target.value.trim() }); }}
          className="bg-transparent text-lg font-bold outline-none"
          style={{ color: "var(--text-title)" }}
        />
        <textarea
          defaultValue={detail.description ?? ""}
          onBlur={(e) => { if (e.target.value !== (detail.description ?? "")) void updateTemplate({ description: e.target.value }); }}
          placeholder="Descrição do processo..."
          rows={2}
          className="resize-none bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
          style={{ color: "var(--muted-foreground)" }}
        />
        <label className="flex w-fit items-center gap-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
          <input type="checkbox" checked={detail.is_active} onChange={(e) => void updateTemplate({ is_active: e.target.checked })} />
          Template ativo (disponível para iniciar novos onboardings)
        </label>
      </div>

      <div className="flex flex-col gap-4">
        {detail.stages.map((stage, stageIdx) => (
          <div key={stage.id} className="lc-card p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <GripVertical size={14} style={{ color: "var(--muted-foreground)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--muted-foreground)" }}>{stageIdx + 1}.</span>
              <input
                defaultValue={stage.name}
                onBlur={(e) => { if (e.target.value.trim() && e.target.value !== stage.name) void updateStage(stage.id, { name: e.target.value.trim() }); }}
                className="flex-1 min-w-[140px] bg-transparent text-sm font-semibold outline-none"
                style={{ color: "var(--text-title)" }}
              />
              <div className="flex items-center gap-1">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => void updateStage(stage.id, { color: c })}
                    className="h-4 w-4 rounded-full transition-transform"
                    style={{ background: c, transform: stage.color === c ? "scale(1.25)" : "scale(1)" }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                <span>Prazo: dia</span>
                <input
                  type="number"
                  min={0}
                  defaultValue={stage.relative_due_days}
                  onBlur={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v) && v !== stage.relative_due_days) void updateStage(stage.id, { relative_due_days: v }); }}
                  className="w-14 rounded px-1.5 py-0.5 text-xs outline-none"
                  style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
                />
              </div>
              <button
                onClick={() => { if (window.confirm(`Excluir a etapa "${stage.name}" e suas tarefas?`)) void deleteStage(stage.id); }}
                className="rounded p-1 hover:bg-red-500/10"
              >
                <X size={14} style={{ color: "#e05c5c" }} />
              </button>
            </div>

            <div className="flex flex-col gap-1.5">
              {stage.tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => setTaskModal({ stageId: stage.id, task })}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-[var(--hover)]"
                >
                  <span className="flex-1 truncate text-sm" style={{ color: "var(--text-title)" }}>{task.title}</span>
                  {task.assignee_name && (
                    <span className="rounded-full px-2 py-0.5 text-[10px]" style={{ background: "var(--hover)", color: "var(--muted-foreground)" }}>
                      {task.assignee_name}
                    </span>
                  )}
                  <PriorityBadge priority={task.priority} />
                  <span className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>peso {task.weight}</span>
                  {(task.depends_on_task_ids?.length ?? 0) > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                      <FolderInput size={11} />{task.depends_on_task_ids!.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              onClick={() => setTaskModal({ stageId: stage.id, task: null })}
              className="mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Plus size={13} />
              Nova tarefa
            </button>
          </div>
        ))}

        <button
          onClick={handleAddStage}
          className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm"
          style={{ border: "1px dashed var(--glass-border)", color: "var(--muted-foreground)" }}
        >
          <Plus size={15} />
          Nova etapa
        </button>
      </div>

      {taskModal && (
        <TemplateTaskModal
          task={taskModal.task}
          otherTasks={allTasks.filter((t) => t.id !== taskModal.task?.id)}
          onClose={() => setTaskModal(null)}
          onSave={async (data) => {
            const result = taskModal.task
              ? await updateTask(taskModal.task.id, data)
              : await addTask(taskModal.stageId, data);
            return result;
          }}
          onDelete={taskModal.task ? async () => {
            const result = await deleteTask(taskModal.task!.id);
            if (result.error) toast.error(result.error);
            else setTaskModal(null);
          } : undefined}
        />
      )}
    </div>
  );
}
