"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { X, Trash2, Loader2 } from "lucide-react";
import { useModalOpen } from "@/hooks/useModalOpen";
import { useTags } from "@/hooks/useTags";
import { useWorkspaceTaskDetail } from "@/hooks/useWorkspaceTaskDetail";
import { Textarea } from "@/components/ui/textarea";
import { AssigneePicker } from "./AssigneePicker";
import { DueDatePicker } from "./DueDatePicker";
import { ChecklistField } from "./ChecklistField";
import { CommentsThread } from "./CommentsThread";
import { AttachmentsField } from "./AttachmentsField";
import { WORKSPACE_TASK_PRIORITIES, type WorkspaceTaskPriority } from "@/types/workspace";
import type { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";

const COLOR_SWATCHES = ["#4a8fd4", "#6b9b6f", "#e0a344", "#e05c5c", "#9b7fe0", "#7c878e"];

interface TaskDetailPanelProps {
  taskId:     string | null;   // null = modo criação
  tasksHook:  ReturnType<typeof useWorkspaceTasks>;
  onClose:    () => void;
}

export function TaskDetailPanel({ taskId, tasksHook, onClose }: TaskDetailPanelProps) {
  useModalOpen(true);
  const { tags } = useTags();
  const { getTaskById, updateTask, deleteTask, createTask } = tasksHook;
  const taskDetailHook = useWorkspaceTaskDetail(taskId);

  const isCreating = taskId === null;
  const existingTask = taskId ? getTaskById(taskId) : null;

  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [priority,    setPriority]    = useState<WorkspaceTaskPriority>("media");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [dueDate,     setDueDate]     = useState<string | null>(null);
  const [dueTime,     setDueTime]     = useState<string | null>(null);
  const [color,       setColor]       = useState<string | null>(null);
  const [notes,       setNotes]       = useState("");
  const [taskTags,    setTaskTags]    = useState<string[]>([]);
  const [isSaving,    setIsSaving]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (existingTask) {
      setTitle(existingTask.title);
      setDescription(existingTask.description ?? "");
      setPriority(existingTask.priority);
      setAssigneeIds(existingTask.assignee_ids);
      setDueDate(existingTask.due_date);
      setDueTime(existingTask.due_time);
      setColor(existingTask.color);
      setNotes(existingTask.notes ?? "");
      setTaskTags(existingTask.tags);
    }
  }, [existingTask]);

  function saveField(patch: Partial<{
    title: string; description: string; priority: WorkspaceTaskPriority; assignee_ids: string[];
    due_date: string | null; due_time: string | null; color: string | null; notes: string; tags: string[];
  }>) {
    if (!taskId) return;
    void updateTask(taskId, patch);
  }

  async function handleCreate() {
    if (!title.trim()) { toast.error("Título é obrigatório"); return; }
    setIsSaving(true);
    const result = await createTask({
      title: title.trim(), description: description || undefined, priority,
      assignee_ids: assigneeIds, due_date: dueDate ?? undefined, due_time: dueTime ?? undefined,
      color: color ?? undefined, notes: notes || undefined, tags: taskTags,
    });
    setIsSaving(false);
    if (result.error) { toast.error(result.error); return; }
    onClose();
  }

  async function handleDelete() {
    if (!taskId) return;
    setIsSaving(true);
    const result = await deleteTask(taskId);
    setIsSaving(false);
    if (result.error) { toast.error(result.error); return; }
    onClose();
  }

  function toggleTag(tagId: string) {
    const next = taskTags.includes(tagId) ? taskTags.filter((t) => t !== tagId) : [...taskTags, tagId];
    setTaskTags(next);
    if (!isCreating) saveField({ tags: next });
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="lc-modal-panel flex h-full w-full max-w-md flex-shrink-0 flex-col"
        style={{ borderLeft: "1px solid rgba(255,255,255,0.08)" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex flex-shrink-0 items-center gap-3 px-5 py-4"
          style={{ background: "rgba(0,0,0,0.78)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="flex-1 text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            {isCreating ? "Nova tarefa" : "Detalhes da tarefa"}
          </p>
          {!isCreating && (
            <button onClick={() => setConfirmDelete(true)} aria-label="Excluir tarefa">
              <Trash2 size={16} style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
          <button onClick={onClose} aria-label="Fechar">
            <X size={18} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !isCreating && title.trim() && title !== existingTask?.title && saveField({ title: title.trim() })}
              placeholder="Título da tarefa"
              className="bg-transparent text-lg font-semibold outline-none placeholder:text-[var(--muted-foreground)]"
              style={{ color: "var(--text-title)" }}
              autoFocus
            />

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Descrição
              </p>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => !isCreating && description !== (existingTask?.description ?? "") && saveField({ description })}
                placeholder="Adicionar descrição..."
                rows={3}
              />
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Prioridade
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WORKSPACE_TASK_PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setPriority(p.id); if (!isCreating) saveField({ priority: p.id }); }}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                    style={{
                      background: priority === p.id ? `${p.color}30` : "rgba(255,255,255,0.04)",
                      color:      priority === p.id ? p.color : "var(--muted-foreground)",
                      border:     `1px solid ${priority === p.id ? p.color + "50" : "rgba(255,255,255,0.08)"}`,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Responsável
              </p>
              <AssigneePicker
                value={assigneeIds}
                onChange={(ids) => { setAssigneeIds(ids); if (!isCreating) saveField({ assignee_ids: ids }); }}
              />
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Prazo
              </p>
              <DueDatePicker
                date={dueDate}
                time={dueTime}
                onChangeDate={(d) => { setDueDate(d); if (!isCreating) saveField({ due_date: d }); }}
                onChangeTime={(t) => { setDueTime(t); if (!isCreating) saveField({ due_time: t }); }}
              />
            </div>

            {tags.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                  Etiquetas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const active = taskTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                        style={{
                          background: active ? `${tag.color}30` : "rgba(255,255,255,0.04)",
                          color:      active ? tag.color : "var(--muted-foreground)",
                          border:     `1px solid ${active ? tag.color + "50" : "rgba(255,255,255,0.08)"}`,
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Cor
              </p>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => { const next = color === c ? null : c; setColor(next); if (!isCreating) saveField({ color: next }); }}
                    className="h-6 w-6 rounded-full transition-transform"
                    style={{
                      background: c,
                      transform:  color === c ? "scale(1.2)" : "scale(1)",
                      boxShadow:  color === c ? `0 0 0 2px rgba(0,0,0,0.6), 0 0 0 3px ${c}` : undefined,
                    }}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Observações
              </p>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onBlur={() => !isCreating && notes !== (existingTask?.notes ?? "") && saveField({ notes })}
                placeholder="Observações adicionais..."
                rows={2}
              />
            </div>

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
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                    Checklist
                  </p>
                  <ChecklistField
                    items={taskDetailHook.detail?.checklist_items ?? []}
                    onAdd={taskDetailHook.addChecklistItem}
                    onToggle={taskDetailHook.toggleChecklistItem}
                    onDelete={taskDetailHook.deleteChecklistItem}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                    Anexos
                  </p>
                  <AttachmentsField
                    signEndpoint={`/api/workspace/tasks/${taskId}/attachments/sign`}
                    attachments={taskDetailHook.detail?.attachments ?? []}
                    onRegister={taskDetailHook.registerAttachment}
                    onDelete={taskDetailHook.deleteAttachment}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                    Comentários
                  </p>
                  <CommentsThread
                    comments={taskDetailHook.detail?.comments ?? []}
                    onAdd={taskDetailHook.addComment}
                    onDelete={taskDetailHook.deleteComment}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </motion.div>

      {/* Confirmação de exclusão */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 440, damping: 34 }}
            className="w-full max-w-sm overflow-hidden rounded-2xl"
            style={{ background: "rgba(8,8,12,0.96)", border: "1px solid rgba(255,255,255,0.09)", boxShadow: "0 24px 64px rgba(0,0,0,0.65)" }}
          >
            <div className="flex flex-col gap-2 px-5 pb-4 pt-5">
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Excluir tarefa</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Esta ação não pode ser desfeita. Checklist, comentários e anexos serão removidos.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.07)" }}>
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isSaving}
                className="rounded-full px-4 py-1.5 text-xs disabled:opacity-40"
                style={{ background: "rgba(255,255,255,0.05)", color: "var(--muted-foreground)", border: "1px solid rgba(255,255,255,0.08)" }}
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
