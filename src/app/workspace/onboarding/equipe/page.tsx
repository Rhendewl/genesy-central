"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { OnboardingSubNav } from "@/components/workspace/onboarding/OnboardingSubNav";
import type { OnboardingTeamWorkloadRow } from "@/types/onboarding";

export default function OnboardingEquipePage() {
  const [rows, setRows] = useState<OnboardingTeamWorkloadRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/workspace/onboarding/team");
      const json = await res.json() as { rows?: OnboardingTeamWorkloadRow[] };
      setRows(json.rows ?? []);
      setIsLoading(false);
    })();
  }, []);

  const maxPending = Math.max(1, ...rows.map((r) => r.tasks_pending));

  return (
    <div className="flex flex-col pb-24">
      <OnboardingSubNav />

      <div className="px-4 pb-4 pt-4 sm:px-6">
        <h1 className="text-lg font-bold" style={{ color: "var(--text-title)" }}>Equipe</h1>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Carga de trabalho por pessoa nos onboardings em andamento.</p>
      </div>

      <div className="flex-1 px-4 sm:px-6">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Users size={28} style={{ color: "var(--muted-foreground)" }} />
            <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhuma tarefa de onboarding atribuída ainda</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => (
              <div key={row.profile_id} className="lc-card flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>{row.name}</span>
                  <div className="flex items-center gap-3 text-xs" style={{ color: "var(--muted-foreground)" }}>
                    <span>{row.tasks_pending} pendente{row.tasks_pending === 1 ? "" : "s"}</span>
                    <span>{row.tasks_completed} concluída{row.tasks_completed === 1 ? "" : "s"}</span>
                    {row.tasks_overdue > 0 && (
                      <span className="flex items-center gap-1" style={{ color: "#e05c5c" }}>
                        <AlertTriangle size={12} />{row.tasks_overdue} atrasada{row.tasks_overdue === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full" style={{ background: "var(--glass-border)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(row.tasks_pending / maxPending) * 100}%`,
                      background: row.tasks_overdue > 0
                        ? "linear-gradient(90deg, #e0a344, #e05c5c)"
                        : "linear-gradient(90deg, var(--workspace-progress-from), var(--workspace-progress-to))",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
