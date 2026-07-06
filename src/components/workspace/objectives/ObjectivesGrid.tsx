"use client";

import { Target } from "lucide-react";
import { ObjectiveCard } from "./ObjectiveCard";
import type { WorkspaceObjective } from "@/types/workspace-objectives";

interface ObjectivesGridProps {
  objectives:   WorkspaceObjective[];
  isLoading:    boolean;
  onOpen:       (id: string) => void;
  onToggleStep: (objectiveId: string, stepId: string, isCompleted: boolean) => void;
}

export function ObjectivesGrid({ objectives, isLoading, onOpen, onToggleStep }: ObjectivesGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />
        ))}
      </div>
    );
  }

  if (objectives.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24">
        <Target size={28} style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum objetivo ainda</p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>Clique em &quot;Novo Objetivo&quot; para começar.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {objectives.map((objective) => (
        <ObjectiveCard
          key={objective.id}
          objective={objective}
          onClick={() => onOpen(objective.id)}
          onToggleStep={(stepId, isCompleted) => onToggleStep(objective.id, stepId, isCompleted)}
        />
      ))}
    </div>
  );
}
