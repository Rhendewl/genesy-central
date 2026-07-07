"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { X, Trash2, Loader2 } from "lucide-react";
import { useModalOpen } from "@/hooks/useModalOpen";
import { useTags } from "@/hooks/useTags";
import { useUsers } from "@/hooks/useUsers";
import { useWorkspaceObjectiveDetail } from "@/hooks/useWorkspaceObjectiveDetail";
import { Textarea } from "@/components/ui/textarea";
import { DueDatePicker } from "@/components/workspace/DueDatePicker";
import { ChecklistField } from "@/components/workspace/ChecklistField";
import { CommentsThread } from "@/components/workspace/CommentsThread";
import { AttachmentsField } from "@/components/workspace/AttachmentsField";
import { ProgressBar } from "@/components/workspace/ProgressBar";
import { WORKSPACE_TASK_PRIORITIES, type WorkspaceTaskPriority } from "@/types/workspace";
import type { useWorkspaceObjectives } from "@/hooks/useWorkspaceObjectives";

interface ObjectiveDetailPanelProps {
  objectiveId: string | null; // null = modo criação
  objectivesHook: ReturnType<typeof useWorkspaceObjectives>;
  onClose:     () => void;
}

export function ObjectiveDetailPanel({ objectiveId, objectivesHook, onClose }: ObjectiveDetailPanelProps) {
  useModalOpen(true);
  const { tags } = useTags();
  const { profiles } = useUsers();
  const activeProfiles = profiles.filter((p) => p.is_active);
  const { objectives, createObjective, updateObjective, deleteObjective } = objectivesHook;
  const objectiveDetailHook = useWorkspaceObjectiveDetail(objectiveId);

  const isCreating = objectiveId === null;
  const existingObjective = objectiveId ? objectives.find((o) => o.id === objectiveId) : null;

  const [title,       setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [priority,    setPriority]    = useState<WorkspaceTaskPriority>("media");
  const [assigneeId,  setAssigneeId]  = useState<string | null>(null);
  const [dueDate,     setDueDate]     = useState<string | null>(null);
  const [objectiveTags, setObjectiveTags] = useState<string[]>([]);
  const [isSaving,    setIsSaving]    = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (existingObjective) {
      setTitle(existingObjective.title);
      setDescription(existingObjective.description ?? "");
      setPriority(existingObjective.priority);
      setAssigneeId(existingObjective.assignee_id);
      setDueDate(existingObjective.due_date);
      setObjectiveTags(existingObjective.tags);
    }
  }, [existingObjective]);

  function saveField(patch: Partial<{
    title: string; description: string; priority: WorkspaceTaskPriority;
    assignee_id: string | null; due_date: string | null; tags: string[];
  }>) {
    if (!objectiveId) return;
    void updateObjective(objectiveId, patch);
  }

  async function handleCreate() {
    if (!title.trim()) { toast.error("Título é obrigatório"); return; }
    setIsSaving(true);
    const result = await createObjective({
      title: title.trim(), description: description || undefined, priority,
      assignee_id: assigneeId ?? undefined, due_date: dueDate ?? undefined, tags: objectiveTags,
    });
    setIsSaving(false);
    if (result.error) { toast.error(result.error); return; }
    onClose();
  }

  async function handleDelete() {
    if (!objectiveId) return;
    setIsSaving(true);
    const result = await deleteObjective(objectiveId);
    setIsSaving(false);
    if (result.error) { toast.error(result.error); return; }
    onClose();
  }

  function toggleTag(tagId: string) {
    const next = objectiveTags.includes(tagId) ? objectiveTags.filter((t) => t !== tagId) : [...objectiveTags, tagId];
    setObjectiveTags(next);
    if (!isCreating) saveField({ tags: next });
  }

  const total = objectiveDetailHook.detail?.steps.length ?? 0;
  const done  = objectiveDetailHook.detail?.steps.filter((s) => s.is_completed).length ?? 0;
  const percent = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="flex-1 lc-scrim"
        style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="lc-modal-panel flex h-full w-full max-w-md flex-shrink-0 flex-col"
        style={{ borderLeft: "1px solid var(--border-modal)" }}
      >
        <div
          className="sticky top-0 z-10 flex flex-shrink-0 items-center gap-3 px-5 py-4"
          style={{ background: "var(--bg-modal)", borderBottom: "1px solid var(--border-modal)" }}
        >
          <p className="flex-1 text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            {isCreating ? "Novo objetivo" : "Detalhes do objetivo"}
          </p>
          {!isCreating && (
            <button onClick={() => setConfirmDelete(true)} aria-label="Excluir objetivo">
              <Trash2 size={16} style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
          <button onClick={onClose} aria-label="Fechar">
            <X size={18} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => !isCreating && title.trim() && title !== existingObjective?.title && saveField({ title: title.trim() })}
              placeholder="Título do objetivo"
              className="bg-transparent text-lg font-semibold outline-none placeholder:text-[var(--muted-foreground)]"
              style={{ color: "var(--text-title)" }}
              autoFocus
            />

            {!isCreating && total > 0 && (
              <div>
                <ProgressBar percent={percent} />
                <p className="mt-1 text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                  {done}/{total} etapas concluídas
                </p>
              </div>
            )}

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Descrição
              </p>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() => !isCreating && description !== (existingObjective?.description ?? "") && saveField({ description })}
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
              <select
                value={assigneeId ?? ""}
                onChange={(e) => {
                  const id = e.target.value || null;
                  setAssigneeId(id);
                  if (!isCreating) saveField({ assignee_id: id });
                }}
                className="h-9 w-full appearance-none rounded-lg border border-[var(--border)] bg-transparent px-2.5 text-sm outline-none"
                style={{ color: "var(--text-title)" }}
              >
                <option value="" style={{ background: "var(--background)" }}>Sem responsável</option>
                {activeProfiles.map((p) => (
                  <option key={p.id} value={p.id} style={{ background: "var(--background)" }}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Prazo
              </p>
              <DueDatePicker
                date={dueDate}
                time={null}
                onChangeDate={(d) => { setDueDate(d); if (!isCreating) saveField({ due_date: d }); }}
                onChangeTime={() => {}}
              />
            </div>

            {tags.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                  Etiquetas
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => {
                    const active = objectiveTags.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleTag(tag.id)}
                        className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                        style={{
                          background: active ? `${tag.color}30` : "var(--hover)",
                          color:      active ? tag.color : "var(--muted-foreground)",
                          border:     `1px solid ${active ? tag.color + "50" : "var(--glass-border)"}`,
                        }}
                      >
                        {tag.name}
                      </button>
                    );
                  })}
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
                Criar objetivo
              </button>
            ) : (
              <>
                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                    Etapas
                  </p>
                  <ChecklistField
                    items={objectiveDetailHook.detail?.steps ?? []}
                    onAdd={objectiveDetailHook.addStep}
                    onToggle={objectiveDetailHook.toggleStep}
                    onDelete={objectiveDetailHook.deleteStep}
                    placeholder="Adicionar etapa..."
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                    Anexos
                  </p>
                  <AttachmentsField
                    signEndpoint={`/api/workspace/objectives/${objectiveId}/attachments/sign`}
                    attachments={objectiveDetailHook.detail?.attachments ?? []}
                    onRegister={objectiveDetailHook.registerAttachment}
                    onDelete={objectiveDetailHook.deleteAttachment}
                  />
                </div>

                <div>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                    Comentários
                  </p>
                  <CommentsThread
                    comments={objectiveDetailHook.detail?.comments ?? []}
                    onAdd={objectiveDetailHook.addComment}
                    onDelete={objectiveDetailHook.deleteComment}
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
              <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>Excluir objetivo</p>
              <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                Esta ação não pode ser desfeita. Etapas, comentários e anexos serão removidos.
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
