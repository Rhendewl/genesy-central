"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Users } from "lucide-react";
import { HalfDonutGauge } from "@/components/dashboard-geral/HalfDonutGauge";
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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((row) => (
              <TeamProgressCard key={row.profile_id} row={row} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamProgressCard({ row }: { row: OnboardingTeamWorkloadRow }) {
  const percent = row.tasks_total > 0 ? Math.round((row.tasks_completed / row.tasks_total) * 100) : 0;

  return (
    <div className="lc-card flex min-h-[210px] flex-col justify-between gap-5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>{row.name}</p>
          <p className="mt-0.5 truncate text-xs" style={{ color: "var(--muted-foreground)" }}>
            {row.function_label ?? "Função não definida"}
          </p>
        </div>
        {row.tasks_overdue > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px]" style={{ color: "#e05c5c", background: "#e05c5c18", border: "1px solid #e05c5c33" }}>
            <AlertTriangle size={12} />
            {row.tasks_overdue}
          </span>
        )}
      </div>

      <div className="flex justify-center">
        <HalfDonutGauge
          percent={percent}
          label="Progresso"
          caption={`${row.tasks_completed}/${row.tasks_total} tarefas`}
          size={150}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl px-3 py-2" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
          <p className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--muted-foreground)" }}>Pendentes</p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-title)" }}>{row.tasks_pending}</p>
        </div>
        <div className="rounded-xl px-3 py-2" style={{ background: "var(--hover)", border: "1px solid var(--glass-border)" }}>
          <p className="text-[10px] uppercase tracking-[0.06em]" style={{ color: "var(--muted-foreground)" }}>Concluídas</p>
          <p className="text-sm font-semibold tabular-nums" style={{ color: "var(--text-title)" }}>{row.tasks_completed}</p>
        </div>
      </div>
    </div>
  );
}
