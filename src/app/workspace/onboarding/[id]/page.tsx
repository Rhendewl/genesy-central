"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Plus, AlertTriangle, Building2, Calendar } from "lucide-react";
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

  const { detail, isLoading, addTask } = useOnboardingProject(id);
  const [tab, setTab] = useState<Tab>("projeto");
  const [panel, setPanel] = useState<{ taskId: string | null; stageId: string | null } | null>(null);

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
  const totalWeight = nonCancelled.reduce((sum, t) => sum + t.weight, 0);
  const doneWeight = nonCancelled.filter((t) => t.status === "concluido").reduce((sum, t) => sum + t.weight, 0);
  const progress = totalWeight > 0 ? Math.round((doneWeight / totalWeight) * 100) : 0;

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
            <span
              className="rounded-full px-2.5 py-1 text-xs font-medium"
              style={{ background: `${statusMeta.color}18`, color: statusMeta.color, border: `1px solid ${statusMeta.color}28` }}
            >
              {statusMeta.label}
            </span>
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
          {detail.stages.length === 0 && (
            <p className="py-8 text-center text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhuma etapa ainda.</p>
          )}
          {detail.stages.map((stage, idx) => (
            <div key={stage.id} className="lc-card p-4" style={{ borderLeft: `3px solid ${stage.color}` }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>{idx + 1}. {stage.name}</p>
                {stage.due_date && (
                  <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                    Prazo: {new Date(stage.due_date + "T00:00:00").toLocaleDateString("pt-BR")}
                  </span>
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
    </div>
  );
}
