"use client";
import { useEffect, useState } from "react";
import { Check, Pencil, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { TaskDetailPanel } from "@/components/workspace/TaskDetailPanel";
import { AssigneeAvatarGroup } from "@/components/workspace/AssigneeAvatarGroup";
import { useGlobalStore } from "@/store";
import { progressColor, progressGradientFrom } from "@/lib/progress-color";
import { BscTaskModal } from "./BscTaskModal";
import { TagChip } from "@/components/workspace/TagChip";

export function BscTasks({
  objectiveId,
  onChange,
}: {
  objectiveId: string;
  onChange?: () => void;
}) {
  const [creating, setCreating] = useState(false);
  const theme = useGlobalStore((s) => s.theme);
  const { viewingMember } = useWorkspaceViewing();
  const hook = useWorkspaceTasks(
    viewingMember?.auth_user_id ?? undefined,
    undefined,
    objectiveId,
    true,
  );
  const db = getSupabaseClient();
  const refetchTasks = hook.refetch;
  const links = hook.objectiveLinks;

  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unlinkId, setUnlinkId] = useState<string | null>(null);
  const load = refetchTasks;
  useEffect(() => {
    const channel = db
      .channel(`bsc-links-${objectiveId}-${crypto.randomUUID()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "workspace_objective_task_links",
          filter: `objective_id=eq.${objectiveId}`,
        },
        () => {
          void refetchTasks();
        },
      )
      .subscribe();
    return () => {
      void db.removeChannel(channel);
    };
  }, [db, objectiveId, load, refetchTasks]);
  const tasks = hook.tasks.filter((t) => links.some((l) => l.task_id === t.id));
  const done = tasks.filter((t) => t.status === "concluido").length;
  const progress = tasks.length ? (done / tasks.length) * 100 : 0;
  return (
    <div className="space-y-5">
      {hook.error && (
        <p role="alert" className="text-xs text-red-400">
          {hook.error}
        </p>
      )}
      {hook.isLoading && !hook.error ? (
        <p role="status" className="text-xs text-white/60">
          Carregando tarefas…
        </p>
      ) : (
        <>
          {[false, true].map((completed) => (
            <div
              key={String(completed)}
              className={`space-y-2 ${completed ? "border-t border-white/15 pt-4" : ""}`}
            >
              {completed && done > 0 && (
                <p className="text-[10px] uppercase tracking-wide text-white/40">
                  Concluídas
                </p>
              )}
              {tasks
                .filter((t) => (t.status === "concluido") === completed)
                .map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-[#315b3770] bg-[color-mix(in_srgb,#326b42_15%,var(--glass-bg))] px-2 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <button
                        disabled={busy || !hook.canExecuteTask(t)}
                        aria-label={`${completed ? "Reabrir" : "Concluir"} tarefa ${t.title}`}
                        aria-pressed={completed}
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#4a9858] disabled:opacity-40 ${completed ? "bg-[#326b42]" : ""}`}
                        onClick={async () => {
                          setBusy(true);
                          try {
                            const r = await hook.toggleComplete(t.id);
                            if (r.error) toast.error(r.error);
                            else onChange?.();
                          } finally {
                            setBusy(false);
                          }
                        }}
                      >
                        {completed && <Check size={12} />}
                      </button>
                      <button
                        onClick={() => setOpen(t.id)}
                        className="min-w-0 flex-1 break-words text-left text-xs"
                      >
                        {t.title}
                      </button>
                      <AssigneeAvatarGroup
                        assigneeIds={t.assignee_ids ?? []}
                        size={18}
                      />
                      <button
                        aria-label={`Abrir tarefa ${t.title}`}
                        onClick={() => setOpen(t.id)}
                        className="p-1"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        disabled={busy}
                        aria-label={`Desvincular tarefa ${t.title}`}
                        className="p-1"
                        onClick={() => setUnlinkId(t.id)}
                      >
                        <X size={13} />
                      </button>
                    </div>
                    {t.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1 pl-7">
                        {t.tags.map((id) => (
                          <TagChip key={id} tagId={id} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          ))}
          {!tasks.length && (
            <p className="py-5 text-sm text-white/50">
              Nenhuma tarefa vinculada.
            </p>
          )}
          {links.length > tasks.length && (
            <p className="text-xs text-white/50">
              Há tarefas sem acesso nesta visualização. O progresso abaixo
              considera apenas as tarefas visíveis.
            </p>
          )}
        </>
      )}
      <button
        onClick={() => setCreating(true)}
        className="flex items-center gap-2 text-xs text-white/70"
      >
        <Plus size={14} />
        Criar ou vincular tarefa
      </button>
      {unlinkId && (
        <div
          role="alert"
          className="rounded-xl border border-white/15 p-3 text-xs"
        >
          <p>
            Desvincular esta tarefa? Ela permanece no Workspace. Concluídas sem
            vínculos voltam à limpeza automática após 24 horas.
          </p>
          <div className="mt-3 flex gap-4">
            <button disabled={busy} onClick={() => setUnlinkId(null)}>
              Cancelar
            </button>
            <button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const link = links.find((l) => l.task_id === unlinkId);
                  if (!link) return;
                  const r = await db
                    .from("workspace_objective_task_links")
                    .delete()
                    .eq("id", link.id);
                  if (r.error) throw new Error(r.error.message);
                  setUnlinkId(null);
                  await load();
                  onChange?.();
                } catch (e) {
                  toast.error(
                    e instanceof Error ? e.message : "Erro ao desvincular",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Desvincular
            </button>
          </div>
        </div>
      )}
      <footer className="pt-4">
        <div className="mb-2 flex justify-between text-xs">
          <span className="text-[10px] uppercase text-white/65">
            Progresso das tarefas · {done}/{tasks.length}
          </span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div
          role="progressbar"
          aria-label="Progresso das tarefas"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-3 overflow-hidden rounded-full bg-white/15"
        >
          <div
            className="h-full rounded-full transition-[width]"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg,${progressGradientFrom(progress, theme)},${progressColor(progress)})`,
            }}
          />
        </div>
      </footer>
      {creating && (
        <BscTaskModal
          objectiveId={objectiveId}
          linkedIds={links.map((l) => l.task_id)}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void hook.refetch();
            onChange?.();
          }}
        />
      )}
      {open && (
        <TaskDetailPanel
          presentation="modal"
          taskId={open}
          tasksHook={hook}
          onClose={() => {
            setOpen(null);
            void hook.refetch();
            onChange?.();
          }}
        />
      )}
    </div>
  );
}
