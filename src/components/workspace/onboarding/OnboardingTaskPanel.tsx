"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { X, Trash2, Loader2, Lock } from "lucide-react";
import { useModalOpen } from "@/hooks/useModalOpen";
import { useUsers } from "@/hooks/useUsers";
import { useOnboardingTask } from "@/hooks/useOnboardingTask";
import { Textarea } from "@/components/ui/textarea";
import { ChecklistField } from "@/components/workspace/ChecklistField";
import { CommentsThread } from "@/components/workspace/CommentsThread";
import { AttachmentsField } from "@/components/workspace/AttachmentsField";
import { WORKSPACE_TASK_PRIORITIES, type WorkspaceTaskPriority } from "@/types/workspace";
import { ONBOARDING_TASK_STATUSES, type OnboardingTask, type OnboardingTaskStatus } from "@/types/onboarding";

interface OnboardingTaskPanelProps {
  taskId:          string | null; // null = modo criação
  stageId:         string | null; // etapa de destino ao criar
  isAdmin:         boolean;
  myProfileId:     string | null;
  allProjectTasks: OnboardingTask[]; // candidatas a dependência
  onClose:         () => void;
  onCreate: (data: {
    title: string; stage_id: string; description?: string; assignee_profile_id?: string;
    priority?: WorkspaceTaskPriority; weight?: number; due_date?: string; depends_on_task_ids?: string[];
  }) => Promise<{ error?: string }>;
}

const MOVABLE_STATUSES: OnboardingTaskStatus[] = ["a_fazer", "em_andamento", "aguardando", "concluido"];
const ADMIN_ONLY_STATUSES: OnboardingTaskStatus[] = ["bloqueado", "aguardando_cliente", "cancelado"];

export function OnboardingTaskPanel({ taskId, stageId, isAdmin, myProfileId, allProjectTasks, onClose, onCreate }: OnboardingTaskPanelProps) {
  useModalOpen(true);
  const { profiles } = useUsers();
  const taskHook = useOnboardingTask(taskId);
  const isCreating = taskId === null;
  const task = taskHook.detail;

  const isAssignee = !!task && !!myProfileId && task.assignee_profile_id === myProfileId;
  const canChangeStatus = isAdmin || isAssignee;

  const [title,        setTitle]        = useState("");
  const [description,  setDescription]  = useState("");
  const [assigneeId,   setAssigneeId]   = useState("");
  const [priority,     setPriority]     = useState<WorkspaceTaskPriority>("media");
  const [weight,        setWeight]        = useState(1);
  const [dueDate,      setDueDate]      = useState("");
  const [dependsOn,    setDependsOn]    = useState<string[]>([]);
  const [isSaving,     setIsSaving]     = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? "");
      setAssigneeId(task.assignee_profile_id ?? "");
      setPriority(task.priority);
      setWeight(task.weight);
      setDueDate(task.due_date ?? "");
      setDependsOn(task.depends_on_task_ids ?? []);
    }
  }, [task]);

  function saveField(patch: Record<string, unknown>) {
    if (!taskId || !isAdmin) return;
    void taskHook.updateTask(patch);
  }

  async function handleCreate() {
    if (!title.trim() || !stageId) { toast.error("Título é obrigatório"); return; }
    setIsSaving(true);
    const result = await onCreate({
      title: title.trim(), stage_id: stageId, description: description || undefined,
      assignee_profile_id: assigneeId || undefined, priority, weight,
      due_date: dueDate || undefined, depends_on_task_ids: dependsOn,
    });
    setIsSaving(false);
    if (result.error) { toast.error(result.error); return; }
    onClose();
  }

  async function handleDelete() {
    setIsSaving(true);
    const result = await taskHook.deleteTask();
    setIsSaving(false);
    if (result.error) { toast.error(result.error); return; }
    onClose();
  }

  async function handleMove(status: OnboardingTaskStatus) {
    const result = await taskHook.moveTask(status);
    if (result.error) toast.error(result.error);
  }

  const otherTasks = allProjectTasks.filter((t) => t.id !== taskId);

  return (
    <div className="fixed inset-0 z-50 flex">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="flex-1 lc-scrim"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      <motion.div
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="lc-modal-panel flex h-full w-full max-w-md flex-shrink-0 flex-col"
        style={{ borderLeft: "1px solid var(--border-modal)" }}
      >
        <div
          className="sticky top-0 z-10 flex flex-shrink-0 items-center gap-3 px-5 py-4"
          style={{ background: "var(--bg-modal)", borderBottom: "1px solid var(--border-modal)" }}
        >
          <p className="flex-1 text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            {isCreating ? "Nova tarefa" : "Detalhes da tarefa"}
          </p>
          {!isCreating && isAdmin && (
            <button onClick={() => setConfirmDelete(true)} aria-label="Excluir tarefa">
              <Trash2 size={16} style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
          <button onClick={onClose} aria-label="Fechar">
            <X size={18} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-5">
            {!isCreating && !isAdmin && (
              <div className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px]" style={{ background: "var(--hover)", color: "var(--muted-foreground)" }}>
                <Lock size={11} />
                Só administradores editam título, responsável e prazo
              </div>
            )}

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !isCreating && isAdmin && title.trim() && title !== task?.title && saveField({ title: title.trim() })}
              placeholder="Título da tarefa"
              readOnly={!isCreating && !isAdmin}
              className="bg-transparent text-lg font-semibold outline-none placeholder:text-[var(--muted-foreground)]"
              style={{ color: "var(--text-title)" }}
              autoFocus={isCreating}
            />

            {!isCreating && task && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Status</p>
                <div className="flex flex-wrap gap-1.5">
                  {MOVABLE_STATUSES.map((s) => {
                    const meta = ONBOARDING_TASK_STATUSES.find((m) => m.id === s)!;
                    return (
                      <button
                        key={s}
                        disabled={!canChangeStatus}
                        onClick={() => void handleMove(s)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-40"
                        style={{
                          background: task.status === s ? "var(--accent-blue)30" : "var(--hover)",
                          color:      task.status === s ? "var(--accent-blue)" : "var(--muted-foreground)",
                          border:     `1px solid ${task.status === s ? "var(--accent-blue)50" : "var(--glass-border)"}`,
                        }}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                  {isAdmin && ADMIN_ONLY_STATUSES.map((s) => {
                    const meta = ONBOARDING_TASK_STATUSES.find((m) => m.id === s)!;
                    return (
                      <button
                        key={s}
                        onClick={() => void handleMove(s)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                        style={{
                          background: task.status === s ? "#e0a34430" : "var(--hover)",
                          color:      task.status === s ? "#e0a344" : "var(--muted-foreground)",
                          border:     `1px solid ${task.status === s ? "#e0a34450" : "var(--glass-border)"}`,
                        }}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Descrição</p>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => !isCreating && isAdmin && description !== (task?.description ?? "") && saveField({ description })}
                placeholder="Adicionar descrição..."
                rows={3}
                readOnly={!isCreating && !isAdmin}
              />
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Responsável</p>
              <select
                value={assigneeId}
                disabled={!isCreating && !isAdmin}
                onChange={(e) => { setAssigneeId(e.target.value); if (!isCreating) saveField({ assignee_profile_id: e.target.value || null }); }}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-60"
                style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
              >
                <option value="">Sem responsável</option>
                {profiles.filter((p) => p.is_active).map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
              </select>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Prioridade</p>
              <div className="flex flex-wrap gap-1.5">
                {WORKSPACE_TASK_PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    disabled={!isCreating && !isAdmin}
                    onClick={() => { setPriority(p.id); if (!isCreating) saveField({ priority: p.id }); }}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all disabled:opacity-40"
                    style={{
                      background: priority === p.id ? `${p.color}30` : "var(--hover)",
                      color:      priority === p.id ? p.color : "var(--muted-foreground)",
                      border:     `1px solid ${priority === p.id ? p.color + "50" : "var(--glass-border)"}`,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Peso</p>
                <input
                  type="number" min={1} value={weight}
                  disabled={!isCreating && !isAdmin}
                  onChange={(e) => { const v = Math.max(1, Number(e.target.value) || 1); setWeight(v); if (!isCreating) saveField({ weight: v }); }}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-60"
                  style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
                />
              </div>
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Prazo</p>
                <input
                  type="date" value={dueDate}
                  disabled={!isCreating && !isAdmin}
                  onChange={(e) => { setDueDate(e.target.value); if (!isCreating) saveField({ due_date: e.target.value || null }); }}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none disabled:opacity-60"
                  style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
                />
              </div>
            </div>

            {otherTasks.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Depende de</p>
                <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg p-1" style={{ background: "var(--hover)" }}>
                  {otherTasks.map((t) => (
                    <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-[var(--glass-border)]">
                      <input
                        type="checkbox"
                        disabled={!isCreating && !isAdmin}
                        checked={dependsOn.includes(t.id)}
                        onChange={() => {
                          const next = dependsOn.includes(t.id) ? dependsOn.filter((d) => d !== t.id) : [...dependsOn, t.id];
                          setDependsOn(next);
                          if (!isCreating) saveField({ depends_on_task_ids: next });
                        }}
                      />
                      <span style={{ color: t.status === "concluido" ? "var(--muted-foreground)" : "var(--text-title)" }}>{t.title}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {isCreating ? (
              <button
                onClick={handleCreate}
                disabled={isSaving}
                className="flex items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-all active:scale-95 disabled:opacity-60"
                style={{ background: "#b0b8c1", color: "#000000" }}
              >
                {isSaving && <Loader2 size={14} className="animate-spin" />}
                Criar tarefa
              </button>
            ) : (
              <>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Checklist</p>
                  <ChecklistField
                    items={taskHook.detail?.checklist_items ?? []}
                    onAdd={taskHook.addChecklistItem}
                    onToggle={taskHook.toggleChecklistItem}
                    onDelete={taskHook.deleteChecklistItem}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Anexos</p>
                  <AttachmentsField
                    signEndpoint={`/api/workspace/onboarding/tasks/${taskId}/attachments/sign`}
                    attachments={taskHook.detail?.attachments ?? []}
                    onRegister={taskHook.registerAttachment}
                    onDelete={taskHook.deleteAttachment}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>Comentários</p>
                  <CommentsThread
                    comments={taskHook.detail?.comments ?? []}
                    onAdd={taskHook.addComment}
                    onDelete={taskHook.deleteComment}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 lc-scrim"
          style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 440, damping: 34 }}
            className="w-full max-w-sm overflow-hidden rounded-2xl"
            style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
          >
            <div className="flex flex-col gap-2 px-5 pb-4 pt-5">
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Excluir tarefa</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                O registro do onboarding e o histórico não são afetados por esta ação em outras tarefas — mas esta tarefa em si (checklist, comentários e anexos) será removida permanentemente, do projeto e da lista pessoal do responsável.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isSaving}
                className="rounded-full px-4 py-1.5 text-xs disabled:opacity-40"
                style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs disabled:opacity-40"
                style={{ background: "#e05c5c", color: "#fff" }}
              >
                {isSaving && <Loader2 size={12} className="animate-spin" />}
                Excluir
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
