"use client";

import { motion } from "framer-motion";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { Calendar as CalendarIcon, Check } from "lucide-react";
import { ProgressRing } from "@/components/workspace/ProgressRing";
import { PriorityBadge } from "@/components/workspace/PriorityBadge";
import { TagChip } from "@/components/workspace/TagChip";
import { AssigneeAvatar } from "@/components/workspace/AssigneeAvatar";
import type { WorkspaceObjective } from "@/types/workspace-objectives";

const MAX_VISIBLE_STEPS = 4;

interface ObjectiveCardProps {
  objective:    WorkspaceObjective;
  onClick:      () => void;
  onToggleStep: (stepId: string, isCompleted: boolean) => void;
}

export function ObjectiveCard({ objective, onClick, onToggleStep }: ObjectiveCardProps) {
  const steps = objective.steps ?? [];
  const total = objective.steps_total ?? steps.length;
  const done  = objective.steps_done  ?? steps.filter((s) => s.is_completed).length;
  const percent = total > 0 ? (done / total) * 100 : 0;

  const visibleSteps = steps.slice(0, MAX_VISIBLE_STEPS);
  const overflow = steps.length - visibleSteps.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
      className="cursor-pointer p-4 lc-card"
      onClick={onClick}
    >
      <div className="mb-3 flex items-start gap-3">
        <ProgressRing percent={percent} size={48} strokeWidth={4} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-sm font-semibold" style={{ color: "var(--text-title)" }}>
              {objective.title}
            </h3>
            <AssigneeAvatar assigneeId={objective.assignee_id} size={20} />
          </div>
          <p className="mt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
            {total > 0 ? `${done}/${total} etapas concluídas` : "Sem etapas"}
          </p>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="mb-3 flex flex-col gap-1 rounded-xl p-2" style={{ background: "var(--hover)" }}>
          {visibleSteps.map((step) => (
            <button
              key={step.id}
              onClick={(e) => { e.stopPropagation(); onToggleStep(step.id, !step.is_completed); }}
              className="flex items-center gap-2 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-[var(--hover)]"
            >
              <span
                className="flex flex-shrink-0 items-center justify-center rounded-full border transition-colors"
                style={{
                  width:       "14px",
                  height:      "14px",
                  borderColor: step.is_completed ? "#5fd98a" : "var(--border)",
                  background:  step.is_completed ? "#5fd98a" : "transparent",
                }}
              >
                {step.is_completed && <Check size={9} color="#0a0a0a" strokeWidth={3.5} />}
              </span>
              <span
                className="truncate text-[11px]"
                style={{
                  color:          step.is_completed ? "var(--muted-foreground)" : "var(--text-title)",
                  textDecoration: step.is_completed ? "line-through" : "none",
                }}
              >
                {step.label}
              </span>
            </button>
          ))}
          {overflow > 0 && (
            <span className="px-1 pt-0.5 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
              +{overflow} etapa{overflow !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center gap-1">
        <PriorityBadge priority={objective.priority} />
        {objective.tags.slice(0, 3).map((tagId) => <TagChip key={tagId} tagId={tagId} />)}
      </div>

      {objective.due_date && (
        <div className="flex items-center gap-1 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
          <CalendarIcon size={11} />
          {format(new Date(`${objective.due_date}T00:00:00`), "d MMM", { locale: ptBR })}
        </div>
      )}
    </motion.div>
  );
}
