"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { CheckCircle2, RotateCcw, X, Trash2, Loader2, Lock, Megaphone } from "lucide-react";
import { useModalOpen } from "@/hooks/useModalOpen";
import { useWorkspaceTaskDetail } from "@/hooks/useWorkspaceTaskDetail";
import { Textarea } from "@/components/ui/textarea";
import { AssigneePicker } from "./AssigneePicker";
import { DueDatePicker } from "./DueDatePicker";
import { ChecklistField, type ChecklistItemLike } from "./ChecklistField";
import { CommentsThread } from "./CommentsThread";
import { AttachmentsField, uploadAttachmentFile, type AttachmentRegistrationPayload } from "./AttachmentsField";
import { DescriptionEditorDialog, DescriptionPreviewButton } from "./DescriptionEditorDialog";
import { TagSelector } from "@/components/tags/TagSelector";
import { WORKSPACE_TASK_PRIORITIES, type WorkspaceTaskPriority } from "@/types/workspace";
import type { useWorkspaceTasks } from "@/hooks/useWorkspaceTasks";

const COLOR_SWATCHES = ["#4a8fd4", "#6b9b6f", "#e0a344", "#e05c5c", "#9b7fe0", "#7c878e"];

interface TaskDetailPanelProps {
  taskId:     string | null;   // null = modo criação
  tasksHook:  ReturnType<typeof useWorkspaceTasks>;
  onClose:    () => void;
  presentation?: "drawer" | "modal";
}

export function TaskDetailPanel({ taskId, tasksHook, onClose, presentation = "drawer" }: TaskDetailPanelProps) {
  useModalOpen(true);
  const { getTaskById, updateTask, deleteTask, createTask, canEditTask, canExecuteTask } = tasksHook;
  const taskDetailHook = useWorkspaceTaskDetail(taskId);

  const isCreating = taskId === null;
  const existingTask = taskId ? getTaskById(taskId) : null;
  const canEdit = isCreating || canEditTask(existingTask);
  const canExecute = isCreating || canExecuteTask(existingTask);
  const isModal = presentation === "modal";

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
  const [isTogglingCompletion, setIsTogglingCompletion] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [draftChecklist, setDraftChecklist] = useState<ChecklistItemLike[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!portalReady) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !descriptionOpen && !confirmDelete) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmDelete, descriptionOpen, onClose, portalReady]);

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
    if (!taskId || !canEdit) return;
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
    if (result.error || !result.task) {
      setIsSaving(false);
      toast.error(result.error ?? "Erro ao criar tarefa");
      return;
    }

    const createdTask = result.task;
    let createdChecklistTotal = 0;
    let createdChecklistDone = 0;
    let setupFailures = 0;

    for (const item of draftChecklist) {
      try {
        const response = await fetch(`/api/workspace/tasks/${createdTask.id}/checklist`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ label: item.label, is_completed: item.is_completed }),
        });
        if (!response.ok) throw new Error("Erro ao criar item");
        createdChecklistTotal += 1;
        if (item.is_completed) createdChecklistDone += 1;
      } catch {
        setupFailures += 1;
      }
    }
    tasksHook.updateChecklistProgress(createdTask.id, createdChecklistTotal, createdChecklistDone);

    const registerAttachment = async (payload: AttachmentRegistrationPayload) => {
      const response = await fetch(`/api/workspace/tasks/${createdTask.id}/attachments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return response.json().catch(() => ({ error: "Erro ao registrar anexo" }));
    };

    for (const file of pendingFiles) {
      try {
        await uploadAttachmentFile(
          file,
          `/api/workspace/tasks/${createdTask.id}/attachments/sign`,
          registerAttachment,
        );
      } catch {
        setupFailures += 1;
      }
    }

    setIsSaving(false);
    if (setupFailures > 0) {
      toast.warning(`Tarefa criada, mas ${setupFailures} item(ns) não puderam ser salvos.`);
    }
    onClose();
  }

  function addChecklistItem(label: string) {
    if (isCreating) {
      setDraftChecklist((current) => [...current, {
        id: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        label,
        is_completed: false,
      }]);
      return;
    }
    void taskDetailHook.addChecklistItem(label).then((result) => {
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (!result?.item || !taskId) return;
      const nextItems = [...(taskDetailHook.detail?.checklist_items ?? []), result.item];
      tasksHook.updateChecklistProgress(taskId, nextItems.length, nextItems.filter((item) => item.is_completed).length);
    }).catch(() => toast.error("Erro ao adicionar item ao checklist"));
  }

  function toggleChecklistItem(itemId: string, isCompleted: boolean) {
    if (isCreating) {
      setDraftChecklist((current) => current.map((item) => item.id === itemId ? { ...item, is_completed: isCompleted } : item));
      return;
    }
    if (!taskId) return;
    const nextItems = (taskDetailHook.detail?.checklist_items ?? []).map((item) =>
      item.id === itemId ? { ...item, is_completed: isCompleted } : item
    );
    tasksHook.updateChecklistProgress(taskId, nextItems.length, nextItems.filter((item) => item.is_completed).length);
    void taskDetailHook.toggleChecklistItem(itemId, isCompleted).then((result) => {
      if (result?.error) {
        toast.error(result.error);
        void tasksHook.refetch();
      }
    }).catch(() => {
      toast.error("Erro ao atualizar checklist");
      void tasksHook.refetch();
    });
  }

  function deleteChecklistItem(itemId: string) {
    if (isCreating) {
      setDraftChecklist((current) => current.filter((item) => item.id !== itemId));
      return;
    }
    if (!taskId) return;
    const nextItems = (taskDetailHook.detail?.checklist_items ?? []).filter((item) => item.id !== itemId);
    tasksHook.updateChecklistProgress(taskId, nextItems.length, nextItems.filter((item) => item.is_completed).length);
    void taskDetailHook.deleteChecklistItem(itemId).then((result) => {
      if (result?.error) {
        toast.error(result.error);
        void tasksHook.refetch();
      }
    }).catch(() => {
      toast.error("Erro ao remover item do checklist");
      void tasksHook.refetch();
    });
  }

  async function handleDelete() {
    if (!taskId) return;
    setIsSaving(true);
    const result = await deleteTask(taskId);
    setIsSaving(false);
    if (result.error) { toast.error(result.error); return; }
    onClose();
  }

  async function handleToggleCompletion() {
    if (!taskId || !canExecute) return;
    setIsTogglingCompletion(true);
    const result = await tasksHook.toggleComplete(taskId);
    setIsTogglingCompletion(false);
    if (result.error) toast.error(result.error);
  }

  function handleDescriptionOpenChange(open: boolean) {
    setDescriptionOpen(open);
    if (!open && !isCreating && canEdit && description !== (existingTask?.description ?? "")) {
      saveField({ description });
    }
  }

  if (!portalReady) return null;

  return createPortal(
    <div className={`fixed inset-0 z-[100] isolate flex ${isModal ? "items-center justify-center p-3 sm:p-4" : ""}`}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={isModal ? "lc-modal-backdrop absolute inset-0" : "flex-1 lc-scrim"}
        style={isModal ? undefined : {
          background: "rgba(0,0,0,0.58)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
        onClick={onClose}
      />

      <motion.div
        initial={isModal ? { opacity: 0, scale: 0.96, y: 18 } : { x: "100%" }}
        animate={isModal ? { opacity: 1, scale: 1, y: 0 } : { x: 0 }}
        exit={isModal ? { opacity: 0, scale: 0.97, y: 12 } : { x: "100%" }}
        transition={{ type: "spring", damping: isModal ? 34 : 28, stiffness: isModal ? 420 : 280 }}
        className={isModal
          ? "lc-modal-panel relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl sm:max-h-[min(90dvh,860px)]"
          : "lc-modal-panel flex h-full w-full max-w-md flex-shrink-0 flex-col"
        }
        style={isModal ? {
          background: "var(--bg-modal)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid var(--border-modal)",
          boxShadow: "0 24px 64px var(--shadow-modal), inset 0 1px 0 var(--hover)",
        } : { borderLeft: "1px solid var(--border-modal)" }}
        role="dialog"
        aria-modal="true"
        aria-label={isCreating ? "Nova tarefa" : "Detalhes da tarefa"}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 flex flex-shrink-0 items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4"
          style={{ background: "var(--bg-modal)", borderBottom: "1px solid var(--border-modal)" }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
              {isCreating ? "Nova tarefa" : "Detalhes da tarefa"}
            </p>
            {isCreating && isModal && (
              <p className="mt-0.5 text-[11px]" style={{ color: "var(--muted-foreground)" }}>
                Preencha os dados e organize a nova tarefa
              </p>
            )}
          </div>
          {!isCreating && canEdit && (
            <button onClick={() => setConfirmDelete(true)} aria-label="Excluir tarefa">
              <Trash2 size={16} style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
          <button onClick={onClose} aria-label="Fechar">
            <X size={18} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        {/* Body */}
        <div
          className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-4 py-4 sm:px-5 sm:py-5"
          style={{ scrollbarGutter: "stable", paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex flex-col gap-5">
            {!isCreating && !canEdit && (
              <div
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "var(--hover)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--muted-foreground)",
                }}
              >
                <Lock size={13} className="flex-shrink-0" />
                {canExecute
                  ? "Você pode concluir a tarefa e marcar o checklist. Os demais campos só podem ser alterados pelo criador."
                  : "Somente o criador pode editar esta tarefa. Você possui acesso de visualização."
                }
              </div>
            )}

            {!isCreating && canExecute && (
              <button
                onClick={handleToggleCompletion}
                disabled={isTogglingCompletion}
                className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.98] disabled:opacity-60"
                style={existingTask?.status === "concluido" ? {
                  background: "var(--hover)",
                  border: "1px solid var(--glass-border)",
                  color: "var(--text-title)",
                } : {
                  background: "color-mix(in srgb, #22c55e 18%, var(--glass-bg-soft))",
                  border: "1px solid color-mix(in srgb, #22c55e 42%, var(--glass-border))",
                  color: "color-mix(in srgb, #22c55e 78%, var(--text-title))",
                }}
              >
                {isTogglingCompletion ? <Loader2 size={15} className="animate-spin" /> : existingTask?.status === "concluido" ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />}
                {existingTask?.status === "concluido" ? "Reabrir tarefa" : "Marcar tarefa como concluída"}
              </button>
            )}

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !isCreating && canEdit && title.trim() && title !== existingTask?.title && saveField({ title: title.trim() })}
              placeholder="Título da tarefa"
              className="bg-transparent text-lg font-semibold outline-none placeholder:text-[var(--muted-foreground)]"
              style={{ color: "var(--text-title)" }}
              readOnly={!canEdit}
              autoFocus={canEdit}
            />

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Descrição
              </p>
              <p className="mb-2 text-xs" style={{ color: "var(--muted-foreground)" }}>
                Abra os links diretamente ou expanda para visualizar a descrição completa.
              </p>
              <DescriptionPreviewButton
                value={description}
                onClick={() => setDescriptionOpen(true)}
                readOnly={!canEdit}
              />
            </div>

            {!isCreating && (taskDetailHook.detail?.linked_marketing_contents.length ?? 0) > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                  Conteúdo de Marketing
                </p>
                <div className="space-y-2">
                  {taskDetailHook.detail!.linked_marketing_contents.map((content) => (
                    <a
                      key={content.id}
                      href={`/marketing/calendario?content=${content.id}`}
                      className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors hover:bg-[var(--hover)]"
                      style={{ borderColor: "var(--glass-border)", background: "var(--glass-bg-soft)", color: "var(--text-title)" }}
                    >
                      <Megaphone size={14} className="shrink-0 text-[var(--accent-blue)]" />
                      <span className="min-w-0 flex-1 truncate">{content.title}</span>
                      <span className="text-[10px] text-[var(--muted-foreground)]">Abrir ↗</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Prioridade
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WORKSPACE_TASK_PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setPriority(p.id); if (!isCreating) saveField({ priority: p.id }); }}
                    disabled={!canEdit}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all disabled:cursor-default"
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

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Responsável
              </p>
              <div className={!canEdit ? "pointer-events-none opacity-70" : undefined}>
                <AssigneePicker
                  value={assigneeIds}
                  onChange={(ids) => { setAssigneeIds(ids); if (!isCreating) saveField({ assignee_ids: ids }); }}
                />
              </div>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Prazo
              </p>
              <div className={!canEdit ? "pointer-events-none opacity-70" : undefined}>
                <DueDatePicker
                  date={dueDate}
                  time={dueTime}
                  onChangeDate={(d) => { setDueDate(d); if (!isCreating) saveField({ due_date: d }); }}
                  onChangeTime={(t) => { setDueTime(t); if (!isCreating) saveField({ due_time: t }); }}
                />
              </div>
            </div>

            <TagSelector
              value={taskTags}
              disabled={!canEdit}
              onChange={(next) => {
                setTaskTags(next);
                if (!isCreating && canEdit) saveField({ tags: next });
              }}
              helperText="As etiquetas são compartilhadas com o CRM e o Marketing."
            />

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Cor
              </p>
              <div className="flex flex-wrap gap-2">
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    onClick={() => { const next = color === c ? null : c; setColor(next); if (!isCreating) saveField({ color: next }); }}
                    disabled={!canEdit}
                    className="h-6 w-6 rounded-full transition-transform disabled:cursor-default"
                    style={{
                      background: c,
                      transform:  color === c ? "scale(1.2)" : "scale(1)",
                      boxShadow:  color === c ? `0 0 0 2px var(--bg-modal), 0 0 0 3px ${c}` : undefined,
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
                onBlur={() => !isCreating && canEdit && notes !== (existingTask?.notes ?? "") && saveField({ notes })}
                placeholder="Observações adicionais..."
                rows={2}
                readOnly={!canEdit}
              />
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Checklist
              </p>
              <ChecklistField
                items={isCreating ? draftChecklist : taskDetailHook.detail?.checklist_items ?? []}
                onAdd={addChecklistItem}
                onToggle={toggleChecklistItem}
                onDelete={deleteChecklistItem}
                readOnly={!canEdit}
                canToggle={canExecute}
                canManage={canEdit}
              />
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Anexos
              </p>
              <AttachmentsField
                signEndpoint={isCreating ? undefined : `/api/workspace/tasks/${taskId}/attachments/sign`}
                attachments={isCreating ? [] : taskDetailHook.detail?.attachments ?? []}
                onRegister={taskDetailHook.registerAttachment}
                onDelete={taskDetailHook.deleteAttachment}
                pendingFiles={isCreating ? pendingFiles : []}
                onStageFiles={isCreating ? (files) => setPendingFiles((current) => [...current, ...files]) : undefined}
                onRemovePending={isCreating ? (index) => setPendingFiles((current) => current.filter((_, itemIndex) => itemIndex !== index)) : undefined}
                readOnly={!canEdit}
              />
            </div>

            {!isCreating && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                  Comentários
                </p>
                <CommentsThread
                  comments={taskDetailHook.detail?.comments ?? []}
                  onAdd={taskDetailHook.addComment}
                  onDelete={taskDetailHook.deleteComment}
                  readOnly={!canEdit}
                />
              </div>
            )}

            {isCreating && (
              <button
                onClick={handleCreate}
                disabled={isSaving}
                className="lc-btn flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
              >
                {isSaving && <Loader2 size={14} className="animate-spin" />}
                {isSaving ? "Criando e salvando itens..." : "Criar tarefa"}
              </button>
            )}
          </div>
        </div>
      </motion.div>

      <DescriptionEditorDialog
        open={descriptionOpen}
        value={description}
        onOpenChange={handleDescriptionOpenChange}
        onChange={setDescription}
        readOnly={!canEdit}
      />

      {/* Confirmação de exclusão */}
      {confirmDelete && (
        <div
          className="lc-modal-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4"
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
                Esta ação não pode ser desfeita. Checklist, comentários e anexos serão removidos.
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
    </div>,
    document.body,
  );
}
