"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale/pt-BR";
import { History } from "lucide-react";
import type { OnboardingHistoryEntry } from "@/types/onboarding";

const EVENT_LABELS: Record<string, (p: Record<string, unknown>) => string> = {
  project_created:                 () => "Onboarding criado",
  task_created:                    (p) => `Tarefa "${p.task_title}" criada`,
  task_edited:                     (p) => `Tarefa "${p.task_title}" editada`,
  task_deleted:                    (p) => `Tarefa "${p.task_title}" excluída`,
  task_status_changed:             (p) => `Tarefa "${p.task_title}" movida de "${p.from}" para "${p.to}"`,
  task_completed:                  (p) => `Tarefa "${p.task_title}" concluída`,
  task_unblocked:                  (p) => `Tarefa "${p.task_title}" desbloqueada`,
  comment_added:                   (p) => `Comentário em "${p.task_title}"`,
  task_removed_from_personal_list: (p) => `Tarefa "${p.task_title}" removida da lista pessoal (registro mantido)`,
};

export function OnboardingHistoryTab({ projectId }: { projectId: string }) {
  const [entries, setEntries] = useState<OnboardingHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/workspace/onboarding/projects/${projectId}/history`);
      const json = await res.json() as { entries?: OnboardingHistoryEntry[] };
      setEntries(json.entries ?? []);
      setIsLoading(false);
    })();
  }, [projectId]);

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl" style={{ background: "var(--card)" }} />;

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 lc-card">
        <History size={24} style={{ color: "var(--muted-foreground)" }} />
        <p className="text-sm" style={{ color: "var(--muted-foreground)" }}>Nenhum evento registrado ainda</p>
      </div>
    );
  }

  return (
    <div className="lc-card flex flex-col gap-3 p-4">
      {entries.map((entry) => {
        const label = EVENT_LABELS[entry.event_type]?.(entry.payload) ?? entry.event_type;
        return (
          <div key={entry.id} className="flex items-start gap-3 border-b pb-3 last:border-0 last:pb-0" style={{ borderColor: "var(--glass-border)" }}>
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: "var(--accent-blue)" }} />
            <div className="flex-1">
              <p className="text-sm" style={{ color: "var(--text-title)" }}>{label}</p>
              <p className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                {entry.actor_name ?? "Sistema"} · {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
