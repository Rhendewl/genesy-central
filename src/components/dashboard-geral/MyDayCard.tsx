"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { format, startOfDay } from "date-fns";
import { Sparkles } from "lucide-react";
import { useGoogleCalendarEvents } from "@/hooks/useGoogleCalendarEvents";
import { useUpcomingCollection } from "@/hooks/useUpcomingCollection";
import type { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import type { Lead } from "@/types";

interface MyDayCardProps {
  tasksHook:         ReturnType<typeof useWorkspaceTasks>;
  leads:             Lead[];
  height:            number;
  delay?:            number;
  // Suprime o insight de cobrança pra quem não tem permissão de financeiro —
  // continuamos chamando useUpcomingCollection() de qualquer forma (regra
  // dos hooks não permite condicionar a chamada em si), só não usamos o resultado.
  financeiroEnabled?: boolean;
}

function buildInsights(params: {
  todayTasksCount: number;
  urgentCount: number;
  awaitingCount: number;
  eventCount: number;
  firstEventTime: string | null;
  newLeadsCount: number;
  collection: { clientName: string; dueInDays: number } | null;
  hasTodayTasks: boolean;
}): string[] {
  const insights: string[] = [];

  if (params.hasTodayTasks) {
    insights.push(
      params.urgentCount > 0
        ? `Você possui ${params.todayTasksCount} tarefa${params.todayTasksCount !== 1 ? "s" : ""} para hoje, sendo ${params.urgentCount} urgente${params.urgentCount !== 1 ? "s" : ""}.`
        : `Você possui ${params.todayTasksCount} tarefa${params.todayTasksCount !== 1 ? "s" : ""} para hoje.`
    );
  }

  if (params.awaitingCount > 0) {
    insights.push(`Você possui ${params.awaitingCount} tarefa${params.awaitingCount !== 1 ? "s" : ""} aguardando retorno.`);
  }

  if (params.eventCount === 0) {
    insights.push("Hoje não existem reuniões agendadas.");
  } else if (params.eventCount === 1) {
    insights.push(`Você possui uma reunião às ${params.firstEventTime}.`);
  } else {
    insights.push(`Você possui ${params.eventCount} compromissos hoje, o próximo às ${params.firstEventTime}.`);
  }

  if (params.collection) {
    const { clientName, dueInDays } = params.collection;
    insights.push(
      dueInDays === 0
        ? `Próximo pagamento: Cliente ${clientName} vence hoje.`
        : `Próximo pagamento: Cliente ${clientName} vence em ${dueInDays} dia${dueInDays !== 1 ? "s" : ""}.`
    );
  }

  if (params.newLeadsCount > 0) {
    insights.push(`Existem ${params.newLeadsCount} lead${params.newLeadsCount !== 1 ? "s" : ""} aguardando primeiro contato.`);
  }

  return insights;
}

export function MyDayCard({ tasksHook, leads, height, delay = 0, financeiroEnabled = true }: MyDayCardProps) {
  const today = useMemo(() => startOfDay(new Date()), []);
  const todayKey = format(today, "yyyy-MM-dd");

  const { events, isLoading: agendaLoading } = useGoogleCalendarEvents(today, today);
  const { collection } = useUpcomingCollection();

  const todayTasks   = tasksHook.tasks.filter((t) => t.due_date === todayKey);
  const urgentTasks  = todayTasks.filter((t) => t.priority === "urgente");
  const awaitingTasks = tasksHook.tasks.filter((t) => t.status === "aguardando");
  const newLeadsCount = leads.filter((l) => l.kanban_column === "novo_lead").length;

  const sortedEvents = [...events].sort((a, b) => a.start.localeCompare(b.start));
  const firstEventTime = sortedEvents[0] ? (sortedEvents[0].isAllDay ? "todo dia" : format(new Date(sortedEvents[0].start), "HH:mm")) : null;

  const isLoading = agendaLoading || tasksHook.isLoading;

  const insights = isLoading ? [] : buildInsights({
    todayTasksCount: todayTasks.length,
    urgentCount:     urgentTasks.length,
    awaitingCount:   awaitingTasks.length,
    eventCount:      events.length,
    firstEventTime,
    newLeadsCount,
    collection: financeiroEnabled ? collection : null,
    hasTodayTasks:   todayTasks.length > 0,
  });

  return (
    <motion.div
      className="lc-card myday-card flex flex-col p-6"
      style={{ background: "var(--glass-bg-soft)", height }}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <div className="mb-4 flex flex-shrink-0 items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl">
          <Sparkles size={17} style={{ color: "var(--text-title)" }} />
        </div>
        <div>
          <p className="text-[13px] font-semibold leading-tight" style={{ color: "var(--silver)" }}>Minha atenção hoje</p>
          <p className="text-[10px] text-[var(--muted-foreground)] capitalize">
            {format(today, "EEEE, d 'de' MMMM")}
          </p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg" style={{ background: "var(--shimmer-base)" }} />)}
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {insights.map((insight, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: delay + i * 0.05 }}
                className="flex items-start gap-2 text-[13px] leading-snug"
                style={{ color: "var(--text-title)" }}
              >
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full" style={{ background: "var(--primary)" }} />
                {insight}
              </motion.li>
            ))}
          </ul>
        )}
      </div>
    </motion.div>
  );
}
