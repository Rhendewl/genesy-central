"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";

// A strategic task is the same Workspace task, linked to one or more objectives.
export function TaskObjectiveLinks({
  taskId,
  canEdit,
}: {
  taskId: string;
  canEdit: boolean;
}) {
  const [objectives, setObjectives] = useState<{ id: string; title: string }[]>(
    [],
  );
  const [links, setLinks] = useState<{ id: string; objective_id: string }[]>(
    [],
  );
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const db = getSupabaseClient();
    void Promise.all([
      db.from("workspace_objectives").select("id,title").order("title"),
      db
        .from("workspace_objective_task_links")
        .select("id,objective_id")
        .eq("task_id", taskId),
    ]).then(([o, l]) => {
      if (!active) return;
      setError(o.error?.message ?? l.error?.message ?? "");
      setObjectives(o.data ?? []);
      setLinks(l.data ?? []);
    });
    return () => {
      active = false;
    };
  }, [taskId]);
  return (
    <section className="space-y-2 rounded-xl border p-3">
      <h3 className="text-sm font-semibold">
        {links.length ? "Tarefa estratégica" : "Vincular a um objetivo"}
      </h3>
      <p className="text-xs text-[var(--muted-foreground)]">
        Tarefas vinculadas ficam preservadas no histórico dos objetivos, mesmo
        depois de concluídas.
      </p>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
      {links.map((link) => (
        <div key={link.id} className="flex items-center gap-2 text-xs">
          <span className="flex-1">
            {objectives.find((o) => o.id === link.objective_id)?.title ??
              "Objetivo vinculado"}
          </span>
          {canEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={async () => {
                if (
                  !window.confirm(
                    "Desvincular tarefa? Sem vínculos, tarefas concluídas voltam à limpeza automática do Workspace.",
                  )
                )
                  return;
                setBusy(true);
                const result = await getSupabaseClient()
                  .from("workspace_objective_task_links")
                  .delete()
                  .eq("id", link.id)
                  .select("id")
                  .single();
                setBusy(false);
                if (result.error) toast.error(result.error.message);
                else setLinks((rows) => rows.filter((l) => l.id !== link.id));
              }}
            >
              Desvincular
            </button>
          )}
        </div>
      ))}
      {canEdit && (
        <div className="flex gap-2">
          <select
            aria-label="Objetivo estratégico"
            className="min-w-0 flex-1 rounded-lg border bg-[var(--background)] p-2 text-xs"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">Escolha um objetivo</option>
            {objectives
              .filter((o) => !links.some((l) => l.objective_id === o.id))
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
          </select>
          <button
            type="button"
            className="lc-btn px-3 text-xs"
            disabled={busy || !selected}
            onClick={async () => {
              setBusy(true);
              const result = await getSupabaseClient()
                .from("workspace_objective_task_links")
                .insert({ objective_id: selected, task_id: taskId })
                .select("id,objective_id")
                .single();
              setBusy(false);
              if (result.error) toast.error(result.error.message);
              else {
                setLinks((rows) => [...rows, result.data]);
                setSelected("");
              }
            }}
          >
            Vincular
          </button>
        </div>
      )}
    </section>
  );
}
