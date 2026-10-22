"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useModalOpen } from "@/hooks/useModalOpen";
import { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";
import { useWorkspaceViewing } from "@/context/WorkspaceViewingContext";
import { getSupabaseClient } from "@/lib/supabase";
import { AssigneePicker } from "@/components/workspace/AssigneePicker";
import { TagSelector } from "@/components/tags/TagSelector";
import { TaskDestinationPicker } from "./TaskDestinationPicker";
const field =
  "mt-1 w-full rounded-xl border border-[var(--border)] bg-[var(--glass-bg-soft)] p-3 text-sm";
export function BscTaskModal({
  objectiveId,
  linkedIds,
  onClose,
  onSaved,
}: {
  objectiveId: string;
  linkedIds: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  useModalOpen(true);
  const { viewingMember } = useWorkspaceViewing();
  const tasks = useWorkspaceTasks(
    viewingMember?.auth_user_id ?? undefined,
    undefined,
    objectiveId,
  );
  const [mode, setMode] = useState<"create" | "link">("create");
  const [title, setTitle] = useState(""),
    [description, setDescription] = useState(""),
    [due, setDue] = useState(""),
    [destination, setDestination] = useState<string | null>(null),
    [existing, setExisting] = useState("");
  const [people, setPeople] = useState<string[]>([]),
    [tags, setTags] = useState<string[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [createdId, setCreatedId] = useState<string | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, []);
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let id = mode === "link" ? existing : createdId;
      if (!id) {
        if (!title.trim() || !destination)
          throw new Error("Informe o nome e escolha o workspace da tarefa");
        const r = await tasks.createTask({
          title: title.trim(),
          description,
          due_date: due || null,
          board_id: destination,
          assignee_ids: people,
          tags,
        });
        if (r.error || !r.task)
          throw new Error(r.error ?? "Erro ao criar tarefa");
        id = r.task.id;
        setCreatedId(id);
      }
      if (!id) throw new Error("Selecione uma tarefa");
      const r = await getSupabaseClient()
        .from("workspace_objective_task_links")
        .upsert(
          { objective_id: objectiveId, task_id: id },
          { onConflict: "objective_id,task_id", ignoreDuplicates: true },
        );
      if (r.error)
        throw new Error(
          `Não foi possível vincular. ${mode === "create" ? "A tarefa já está salva no Workspace; tente vincular novamente. " : ""}${r.error.message}`,
        );
      toast.success(
        mode === "create" ? "Tarefa criada e vinculada" : "Tarefa vinculada",
      );
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar tarefa");
    } finally {
      setBusy(false);
    }
  }
  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Criar ou vincular tarefa"
        tabIndex={-1}
        className="lc-modal-panel flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[var(--border-modal)] bg-[var(--bg-modal)] text-[var(--text-title)]"
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) {
            e.stopPropagation();
            onClose();
          }
          if (e.key === "Tab") {
            const els = panel.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)",
            );
            if (els?.length) {
              const first = els[0],
                last = els[els.length - 1];
              if (
                e.shiftKey &&
                (document.activeElement === first ||
                  document.activeElement === panel.current)
              ) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }}
      >
        <header className="flex items-center justify-between p-5">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "Nova tarefa" : "Vincular tarefa"}
          </h2>
          <button
            aria-label="Fechar janela de tarefa"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className="flex gap-2 px-5">
          <button
            disabled={busy || !!createdId}
            aria-pressed={mode === "create"}
            onClick={() => setMode("create")}
            className="lc-btn px-4 py-2"
          >
            Criar tarefa
          </button>
          <button
            disabled={busy || !!createdId}
            aria-pressed={mode === "link"}
            onClick={() => setMode("link")}
            className="px-4 py-2"
          >
            Vincular existente
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          className="min-h-0 overflow-y-auto p-5 space-y-4"
        >
          {mode === "create" ? (
            <>
              <fieldset disabled={busy || !!createdId} className="space-y-4">
                <label className="block text-sm">
                  Nome da tarefa
                  <input
                    className={field}
                    required
                    maxLength={500}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                <label className="block text-sm">
                  Descrição
                  <textarea
                    className={field}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <TaskDestinationPicker
                  value={destination}
                  onChange={setDestination}
                />
                <label className="block text-sm">
                  Prazo
                  <input
                    type="date"
                    className={field}
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                  />
                </label>
                <div>
                  <p className="mb-2 text-sm">Responsáveis</p>
                  <AssigneePicker value={people} onChange={setPeople} />
                </div>
                <TagSelector
                  scope="workspace"
                  value={tags}
                  onChange={setTags}
                />
              </fieldset>
            </>
          ) : (
            <>
              <label className="block text-sm">
                Tarefa existente
                <select
                  className={field}
                  required
                  value={existing}
                  onChange={(e) => setExisting(e.target.value)}
                >
                  <option value="">Selecione uma tarefa</option>
                  {tasks.tasks
                    .filter((t) => !linkedIds.includes(t.id))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                </select>
              </label>
              <p className="text-xs text-[var(--muted-foreground)]">
                A tarefa mantém seu workspace e responsáveis atuais.
              </p>
              {tasks.isLoading && <p>Carregando tarefas…</p>}
              {tasks.error && <p role="alert">{tasks.error}</p>}
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={
              busy ||
              (mode === "create"
                ? !createdId && (!title.trim() || !destination)
                : !existing)
            }
            className="lc-btn w-full px-4 py-3"
          >
            {busy
              ? "Salvando…"
              : createdId
                ? "Tentar vincular novamente"
                : mode === "create"
                  ? "Criar tarefa"
                  : "Vincular tarefa"}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
