"use client";

import { Header } from "@/components/layout/Header";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { useWorkspaceNotes } from "@/hooks/useWorkspaceNotes";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { PercentageGaugeCard } from "@/components/workspace/dashboard/PercentageGaugeCard";
import { TodoListCard } from "@/components/workspace/dashboard/TodoListCard";
import { TodayAgendaCard } from "@/components/workspace/dashboard/TodayAgendaCard";
import { UpcomingDeadlinesCard } from "@/components/workspace/dashboard/UpcomingDeadlinesCard";
import { RecentNotesCard } from "@/components/workspace/dashboard/RecentNotesCard";

export default function WorkspaceDashboardPage() {
  const { viewingMember } = useWorkspaceViewing();
  const asUserId = viewingMember?.auth_user_id ?? undefined;

  // Cada hook é instanciado uma única vez aqui e compartilhado pelos cards que
  // precisam dos mesmos dados — evita múltiplos fetches/canais realtime
  // duplicados na mesma página (ex: To-do List e Próximas Entregas usam a
  // mesma lista de tarefas).
  const tasksHook      = useWorkspaceTasks(asUserId);
  const notesHook      = useWorkspaceNotes(asUserId);

  const { total: totalTasks, completed: doneTasks, percent: tasksPercent } = tasksHook.completionStats;

  return (
    <div className="flex flex-col gap-4 px-4 pb-24 pt-4 sm:px-6">
      <Header title="Workspace" subtitle="Visão geral da sua produtividade" />

      <div className="grid grid-cols-1 gap-3">
        <PercentageGaugeCard
          title="Progresso das Tarefas"
          percent={tasksPercent}
          caption={totalTasks > 0 ? `${doneTasks} de ${totalTasks} concluídas` : "Nenhuma tarefa ainda"}
          delay={0}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TodoListCard tasksHook={tasksHook} delay={0.1} />
        <TodayAgendaCard delay={0.15} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UpcomingDeadlinesCard tasksHook={tasksHook} delay={0.2} />
        <RecentNotesCard notes={notesHook.notes} delay={0.25} />
      </div>
    </div>
  );
}
