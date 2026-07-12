"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, Calendar } from "lucide-react";
import { ProgressBar } from "@/components/workspace/ProgressBar";
import { ONBOARDING_PROJECT_STATUSES } from "@/types/onboarding";
import type { OnboardingProjectSummary } from "@/types/onboarding";

export function OnboardingProjectCard({ project }: { project: OnboardingProjectSummary }) {
  const router = useRouter();
  const statusMeta = ONBOARDING_PROJECT_STATUSES.find((s) => s.id === project.status);

  return (
    <div
      onClick={() => router.push(`/workspace/onboarding/${project.id}`)}
      className="flex cursor-pointer flex-col gap-3 p-4 lc-card"
      style={{ borderTop: `2px solid ${statusMeta?.color ?? "#7c878e"}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>{project.name}</h3>
          {project.client_name && (
            <p className="truncate text-xs" style={{ color: "var(--muted-foreground)" }}>{project.client_name}</p>
          )}
        </div>
        {statusMeta && (
          <span
            className="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{ background: `${statusMeta.color}18`, color: statusMeta.color, border: `1px solid ${statusMeta.color}28` }}
          >
            {statusMeta.label}
          </span>
        )}
      </div>

      <ProgressBar percent={project.progress_percent} colorMode="progress-band" />

      {project.current_stage_name && (
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Etapa atual: {project.current_stage_name}</p>
      )}

      <div className="flex items-center justify-between text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {project.target_date ? new Date(project.target_date + "T00:00:00").toLocaleDateString("pt-BR") : "Sem prazo"}
        </span>
        <span>{project.tasks_pending} pendente{project.tasks_pending === 1 ? "" : "s"}</span>
        {project.tasks_overdue > 0 && (
          <span className="flex items-center gap-1" style={{ color: "#e05c5c" }}>
            <AlertTriangle size={12} />{project.tasks_overdue} atrasada{project.tasks_overdue === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
