"use client";

import { Zap, Clock, CheckCircle2, XCircle, AlertTriangle, History } from "lucide-react";
import type { WorkflowDashboardStats } from "@/lib/workflow-engine/workflow-service";

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl p-3.5 flex items-center gap-3" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
      <div className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0" style={{ background: `${color}18` }}>
        <Icon size={15} style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-base font-semibold leading-none" style={{ color: "var(--text-title)" }}>{value}</p>
        <p className="text-[10px] mt-1 truncate" style={{ color: "var(--muted-foreground)" }}>{label}</p>
      </div>
    </div>
  );
}

export function WorkflowDashboardCards({ stats }: { stats: WorkflowDashboardStats | null }) {
  if (!stats) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <StatCard icon={Zap}           label="Automações ativas"    value={stats.activeAutomations} color="#4a8fd4" />
        <StatCard icon={Clock}         label="Jobs pendentes"       value={stats.pendingJobs}       color="#f59e0b" />
        <StatCard icon={CheckCircle2}  label="Executados hoje"      value={stats.executedToday}     color="#22c55e" />
        <StatCard icon={XCircle}       label="Cancelados"           value={stats.cancelledJobs}     color="#7c878e" />
        <StatCard icon={AlertTriangle} label="Falhas"                value={stats.failedJobs}        color="#ef4444" />
      </div>

      {stats.lastExecution && (
        <div className="rounded-xl p-3 flex items-center gap-2.5" style={{ border: "1px solid var(--border)", background: "var(--card)" }}>
          <History size={13} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <p className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
            Última execução: <span style={{ color: "var(--text-title)" }}>{stats.lastExecution.automationName}</span> para{" "}
            <span style={{ color: "var(--text-title)" }}>{stats.lastExecution.leadName}</span> — {stats.lastExecution.status} em{" "}
            {new Date(stats.lastExecution.executedAt).toLocaleString("pt-BR")}
          </p>
        </div>
      )}
    </div>
  );
}
