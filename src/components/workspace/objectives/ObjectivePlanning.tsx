"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { TaskDetailPanel } from "@/components/workspace/TaskDetailPanel";
import { TagChip } from "@/components/workspace/TagChip";
import { HalfDonutGauge } from "@/components/dashboard-geral/HalfDonutGauge";
import { metricProgress } from "@/lib/workspace/objective-progress";
import type { WorkspaceTask } from "@/types/workspace";
export interface ObjectiveMetric {
  id: string;
  objective_id: string;
  title: string;
  unit: string;
  baseline: number;
  target: number;
  current_value: number;
}
type Block = { id: string; title: string };
type TaskLink = { id: string; task_id: string; block_id: string | null };
const field =
  "w-full rounded-lg border border-[var(--border)] bg-[var(--background)] p-2 text-sm";
export function ObjectivePlanning({
  id,
  onChange,
}: {
  id: string;
  onChange: () => void;
}) {
  const db = getSupabaseClient();
  const { viewingMember } = useWorkspaceViewing();
  const tasksHook = useWorkspaceTasks(
    viewingMember?.auth_user_id ?? undefined,
    undefined,
    id,
  );
  const [blocks, setBlocks] = useState<Block[]>([]),
    [links, setLinks] = useState<TaskLink[]>([]),
    [tasks, setTasks] = useState<WorkspaceTask[]>([]),
    [metrics, setMetrics] = useState<ObjectiveMetric[]>([]);
  const [blockTitle, setBlockTitle] = useState(""),
    [taskTitle, setTaskTitle] = useState(""),
    [taskId, setTaskId] = useState(""),
    [blockId, setBlockId] = useState("");
  const [openTask, setOpenTask] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState({
    title: "",
    unit: "",
    baseline: 0,
    target: 100,
    current_value: 0,
  });
  const load = useCallback(async () => {
    const results = await Promise.all([
      db
        .from("workspace_objective_blocks")
        .select("*")
        .eq("objective_id", id)
        .order("position"),
      db
        .from("workspace_objective_task_links")
        .select("*")
        .eq("objective_id", id),
      db.from("workspace_objective_metrics").select("*").eq("objective_id", id),
    ]);
    const failure = results.find((r) => r.error)?.error;
    if (failure) {
      setError(failure.message);
      return;
    }
    setError(null);
    setBlocks(results[0].data ?? []);
    setLinks(results[1].data ?? []);
    setMetrics(results[2].data ?? []);
    const ids = (results[1].data ?? []).map((l) => l.task_id);
    if (ids.length) {
      const r = await db.from("workspace_tasks").select("*").in("id", ids);
      if (r.error) setError(r.error.message);
      else setTasks(r.data ?? []);
    } else setTasks([]);
  }, [db, id]);
  useEffect(() => {
    void load();
  }, [load]);
  async function mutate(
    action: () => PromiseLike<{ error: { message: string } | null }>,
  ) {
    setBusy(true);
    try {
      const r = await action();
      if (r.error) throw new Error(r.error.message);
      await load();
      onChange();
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function linkTask(newId: string) {
    return mutate(() =>
      db.from("workspace_objective_task_links").insert({
        objective_id: id,
        task_id: newId,
        block_id: blockId || null,
      }),
    );
  }
  return (
    <div className="space-y-5">
      {error && (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      )}
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Blocos e tarefas</h3>
        <p className="text-xs text-[var(--muted-foreground)]">
          As tarefas são as mesmas do Workspace. Permissões e responsáveis são
          preservados.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (blockTitle.trim())
              void mutate(() =>
                db.from("workspace_objective_blocks").insert({
                  objective_id: id,
                  title: blockTitle.trim(),
                  position: blocks.length,
                }),
              ).then(() => setBlockTitle(""));
          }}
        >
          <input
            aria-label="Nome do bloco"
            value={blockTitle}
            onChange={(e) => setBlockTitle(e.target.value)}
            className={field}
            placeholder="Novo bloco"
            maxLength={200}
            required
          />
          <button disabled={busy} className="lc-btn px-3">
            Adicionar
          </button>
        </form>
        {[{ id: "", title: "Sem bloco" }, ...blocks].map((block) => (
          <div key={block.id} className="rounded-xl border p-3 space-y-2">
            <div className="flex items-center gap-2">
              <strong className="flex-1 text-xs">{block.title}</strong>
              {block.id && (
                <>
                  <button
                    className="text-xs"
                    onClick={() => {
                      const title = window.prompt("Nome do bloco", block.title);
                      if (title?.trim())
                        void mutate(() =>
                          db
                            .from("workspace_objective_blocks")
                            .update({ title: title.trim() })
                            .eq("id", block.id),
                        );
                    }}
                  >
                    Renomear
                  </button>
                  <button
                    className="text-xs"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Excluir bloco? As tarefas serão mantidas sem bloco.",
                        )
                      )
                        void mutate(() =>
                          db
                            .from("workspace_objective_blocks")
                            .delete()
                            .eq("id", block.id),
                        );
                    }}
                  >
                    Excluir
                  </button>
                </>
              )}
            </div>
            {links
              .filter((l) => (l.block_id ?? "") === block.id)
              .map((link) => {
                const task = tasks.find((t) => t.id === link.task_id);
                return (
                  <div key={link.id} className="space-y-1 border-t pt-2">
                    <div className="flex items-center gap-2">
                      <button
                        className="flex-1 text-left text-sm"
                        onClick={() => setOpenTask(link.task_id)}
                      >
                        {task
                          ? `${task.status === "concluido" ? "✓ " : ""}${task.title}`
                          : "Tarefa sem acesso"}
                      </button>
                      <button
                        aria-label="Desvincular tarefa"
                        className="text-xs"
                        onClick={() =>
                          void mutate(() =>
                            db
                              .from("workspace_objective_task_links")
                              .delete()
                              .eq("id", link.id),
                          )
                        }
                      >
                        Desvincular
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {task?.tags.map((tag) => (
                        <TagChip key={tag} tagId={tag} />
                      ))}
                    </div>
                    <select
                      aria-label="Mover tarefa para bloco"
                      className={field}
                      value={link.block_id ?? ""}
                      onChange={(e) =>
                        void mutate(() =>
                          db
                            .from("workspace_objective_task_links")
                            .update({ block_id: e.target.value || null })
                            .eq("id", link.id),
                        )
                      }
                    >
                      <option value="">Sem bloco</option>
                      {blocks.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.title}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
          </div>
        ))}
        <select
          aria-label="Bloco de destino"
          value={blockId}
          onChange={(e) => setBlockId(e.target.value)}
          className={field}
        >
          <option value="">Sem bloco</option>
          {blocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.title}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            aria-label="Tarefa existente"
            className={field}
            value={taskId}
            onChange={(e) => setTaskId(e.target.value)}
          >
            <option value="">Selecionar tarefa existente</option>
            {tasksHook.tasks
              .filter((t) => !links.some((l) => l.task_id === t.id))
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
          </select>
          <button
            disabled={busy || !taskId}
            className="lc-btn px-3"
            onClick={() => void linkTask(taskId)}
          >
            Vincular
          </button>
        </div>
        {tasksHook.error && (
          <p className="text-xs text-red-400">{tasksHook.error}</p>
        )}
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const r = await tasksHook.createTask({ title: taskTitle.trim() });
            setBusy(false);
            if (r.error || !r.task)
              return toast.error(r.error ?? "Erro ao criar tarefa");
            const linked = await linkTask(r.task.id);
            if (!linked) {
              setTaskId(r.task.id);
              toast.warning(
                "Tarefa criada no Workspace. Selecione Vincular para tentar novamente.",
              );
              return;
            }
            setTaskTitle("");
            setOpenTask(r.task.id);
          }}
        >
          <input
            aria-label="Título da nova tarefa"
            className={field}
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            placeholder="Criar tarefa neste objetivo"
            required
          />
          <button disabled={busy || !taskTitle.trim()} className="lc-btn px-3">
            Criar
          </button>
        </form>
      </section>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Metas mensuráveis</h3>
        <p className="text-xs text-[var(--muted-foreground)]">
          Resultados independentes das tarefas. Ex.: faturamento em R$ ou
          quantidade de clientes.
        </p>
        {metrics.map((m) => (
          <form
            key={m.id}
            className="lc-card p-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void mutate(() =>
                db
                  .from("workspace_objective_metrics")
                  .update({
                    title: m.title,
                    unit: m.unit,
                    baseline: m.baseline,
                    target: m.target,
                    current_value: m.current_value,
                  })
                  .eq("id", m.id),
              );
            }}
          >
            <HalfDonutGauge
              percent={metricProgress(
                Number(m.baseline),
                Number(m.target),
                Number(m.current_value),
              )}
              label={m.title}
              caption={`${m.current_value} / ${m.target} ${m.unit}`}
            />
            {(
              ["title", "unit", "baseline", "target", "current_value"] as const
            ).map((key) => (
              <label key={key} className="block text-xs">
                {
                  {
                    title: "Nome",
                    unit: "Unidade",
                    baseline: "Valor inicial",
                    target: "Meta",
                    current_value: "Atual",
                  }[key]
                }
                <input
                  className={field}
                  type={key === "title" || key === "unit" ? "text" : "number"}
                  step="any"
                  value={m[key]}
                  required={key !== "unit"}
                  onChange={(e) =>
                    setMetrics((rows) =>
                      rows.map((row) =>
                        row.id === m.id
                          ? {
                              ...row,
                              [key]:
                                key === "title" || key === "unit"
                                  ? e.target.value
                                  : Number(e.target.value),
                            }
                          : row,
                      ),
                    )
                  }
                />
              </label>
            ))}
            <div className="flex justify-between">
              <button className="lc-btn px-3 py-1" disabled={busy}>
                Salvar meta
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Excluir esta meta?"))
                    void mutate(() =>
                      db
                        .from("workspace_objective_metrics")
                        .delete()
                        .eq("id", m.id),
                    );
                }}
              >
                Excluir
              </button>
            </div>
          </form>
        ))}
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            void mutate(() =>
              db
                .from("workspace_objective_metrics")
                .insert({ ...metric, objective_id: id }),
            );
          }}
        >
          <input
            aria-label="Nome da meta"
            className={field}
            placeholder="Nome da meta"
            required
            value={metric.title}
            onChange={(e) => setMetric({ ...metric, title: e.target.value })}
          />
          <input
            aria-label="Unidade"
            className={field}
            placeholder="Unidade (R$, clientes...)"
            value={metric.unit}
            onChange={(e) => setMetric({ ...metric, unit: e.target.value })}
          />
          <div className="grid grid-cols-3 gap-2">
            {(["baseline", "target", "current_value"] as const).map((key) => (
              <label key={key} className="text-xs">
                {
                  {
                    baseline: "Inicial",
                    target: "Meta",
                    current_value: "Atual",
                  }[key]
                }
                <input
                  className={field}
                  type="number"
                  step="any"
                  required
                  value={metric[key]}
                  onChange={(e) =>
                    setMetric({ ...metric, [key]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          <button
            disabled={busy || metric.target === metric.baseline}
            className="lc-btn px-3 py-2 text-sm"
          >
            Adicionar meta
          </button>
        </form>
      </section>
      {openTask && (
        <TaskDetailPanel
          presentation="modal"
          taskId={openTask}
          tasksHook={tasksHook}
          onClose={() => {
            setOpenTask(null);
            void load();
            onChange();
          }}
        />
      )}
    </div>
  );
}
