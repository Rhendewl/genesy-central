"use client";

import { Zap } from "lucide-react";
import type { AutomationWithDetails } from "@/lib/workflow-engine/workflow-service";
import { AutomationCard } from "./AutomationCard";

interface AutomationListProps {
  automations: AutomationWithDetails[];
  onEdit:      (a: AutomationWithDetails) => void;
  onToggle:    (id: string, status: "ativa" | "pausada") => Promise<boolean>;
  onDelete:    (id: string) => Promise<boolean>;
  onCreate:    () => void;
}

export function AutomationList({ automations, onEdit, onToggle, onDelete, onCreate }: AutomationListProps) {
  if (automations.length === 0) {
    return (
      <div
        className="rounded-xl p-8 flex flex-col items-center gap-3 text-center"
        style={{ border: "1px solid var(--border)", background: "var(--card)" }}
      >
        <Zap size={22} style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>Nenhuma automação ainda</p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Crie uma automação para reagir a mudanças de etapa, tags e mais — sem precisar acompanhar manualmente.
        </p>
        <button
          type="button" onClick={onCreate}
          className="px-4 py-2 rounded-lg text-xs font-medium mt-1 transition-all hover:opacity-90"
          style={{ background: "#b0b8c1", color: "#000000" }}
        >
          Criar Primeira Automação
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {automations.map(automation => (
        <AutomationCard
          key={automation.id}
          automation={automation}
          onEdit={onEdit}
          onToggle={onToggle}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
