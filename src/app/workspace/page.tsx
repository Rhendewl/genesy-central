"use client";

import { Header } from "@/components/layout/Header";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { useWorkspaceNotes } from "@/hooks/useWorkspaceNotes";
import { useWorkspaceObjectives } from "@/hooks/useWorkspaceObjectives";
import { PercentageGaugeCard } from "@/components/workspace/dashboard/PercentageGaugeCard";
import { TodoListCard } from "@/components/workspace/dashboard/TodoListCard";
import { TodayAgendaCard } from "@/components/workspace/dashboard/TodayAgendaCard";
import { UpcomingDeadlinesCard } from "@/components/workspace/dashboard/UpcomingDeadlinesCard";
import { RecentNotesCard } from "@/components/workspace/dashboard/RecentNotesCard";

export default function WorkspaceDashboardPage() {
  // Cada hook é instanciado uma única vez aqui e compartilhado pelos cards que
  // precisam dos mesmos dados — evita múltiplos fetches/canais realtime
  // duplicados na mesma página (ex: To-do List e Próximas Entregas usam a
  // mesma lista de tarefas).
  const tasksHook      = useWorkspaceTasks();
  const notesHook      = useWorkspaceNotes();
  const objectivesHook = useWorkspaceObjectives();

  const totalTasks = tasksHook.tasks.length;
  const doneTasks  = tasksHook.tasks.filter((t) => t.status === "concluido").length;
  const tasksPercent = totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0;

  // Objetivos sem etapa nenhuma não entram na média — não é 0% nem 100%,
  // só não têm progresso mensurável ainda.
  const measurableObjectives = objectivesHook.objectives.filter((o) => (o.steps_total ?? 0) > 0);
  const objectivesPercent = measurableObjectives.length > 0
    ? measurableObjectives.reduce((sum, o) => sum + ((o.steps_done ?? 0) / (o.steps_total ?? 1)) * 100, 0) / measurableObjectives.length
    : 0;

  return (
    <div className="flex min-h-screen flex-col gap-4 px-4 pb-24 pt-4 sm:px-6">
      <Header title="Workspace" subtitle="Visão geral da sua produtividade" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PercentageGaugeCard
          title="Progresso das Tarefas"
          percent={tasksPercent}
          caption={totalTasks > 0 ? `${doneTasks} de ${totalTasks} concluídas` : "Nenhuma tarefa ainda"}
          delay={0}
        />
        <PercentageGaugeCard
          title="Objetivos"
          percent={objectivesPercent}
          caption={measurableObjectives.length > 0 ? `Média de ${measurableObjectives.length} objetivo${measurableObjectives.length !== 1 ? "s" : ""}` : "Nenhum objetivo com etapas ainda"}
          delay={0.05}
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
