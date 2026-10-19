"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { X, Trash2, Loader2 } from "lucide-react";
import { useModalOpen } from "@/hooks/useModalOpen";
import { TagSelector } from "@/components/tags/TagSelector";
import { AssigneePicker } from "@/components/workspace/AssigneePicker";
import { ObjectivePlanning } from "./ObjectivePlanning";
import { descendants } from "@/lib/workspace/objective-progress";
import type { UpdateWorkspaceObjective } from "@/types/workspace-objectives";

import { useWorkspaceObjectiveDetail } from "@/hooks/useWorkspaceObjectiveDetail";
import { Textarea } from "@/components/ui/textarea";
import { DueDatePicker } from "@/components/workspace/DueDatePicker";
import { ChecklistField } from "@/components/workspace/ChecklistField";
import { CommentsThread } from "@/components/workspace/CommentsThread";
import { AttachmentsField } from "@/components/workspace/AttachmentsField";
import { ProgressBar } from "@/components/workspace/ProgressBar";
import {
  WORKSPACE_TASK_PRIORITIES,
  type WorkspaceTaskPriority,
} from "@/types/workspace";
import type { useWorkspaceObjectives } from "@/hooks/useWorkspaceObjectives";

interface ObjectiveDetailPanelProps {
  objectiveId: string | null; // null = modo criação
  objectivesHook: ReturnType<typeof useWorkspaceObjectives>;
  onClose: () => void;
  onOpenObjective?: (id: string) => void;
  presentation?: "drawer" | "modal";
}

export function ObjectiveDetailPanel({
  objectiveId,
  objectivesHook,
  onClose,
  onOpenObjective,
  presentation = "drawer",
}: ObjectiveDetailPanelProps) {
  useModalOpen(true);

  const { objectives, createObjective, updateObjective, deleteObjective } =
    objectivesHook;
  const objectiveDetailHook = useWorkspaceObjectiveDetail(objectiveId);

  const isCreating = objectiveId === null;
  const existingObjective = objectiveId
    ? objectives.find((o) => o.id === objectiveId)
    : null;
  const isModal = presentation === "modal";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<WorkspaceTaskPriority>("media");
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [planning, setPlanning] = useState<UpdateWorkspaceObjective>({
    horizon: "medio",
    status: "planejado",
    parent_id: null,
    start_date: null,
  });
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [objectiveTags, setObjectiveTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => setPortalReady(true), []);

  useEffect(() => {
    if (!portalReady) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirmDelete) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [confirmDelete, onClose, portalReady]);

  useEffect(() => {
    if (existingObjective) {
      setTitle(existingObjective.title);
      setDescription(existingObjective.description ?? "");
      setPriority(existingObjective.priority);
      setAssigneeIds(existingObjective.assignee_ids ?? []);
      setPlanning({
        horizon: existingObjective.horizon,
        status: existingObjective.status,
        parent_id: existingObjective.parent_id,
        start_date: existingObjective.start_date,
      });
      setDueDate(existingObjective.due_date);
      setObjectiveTags(existingObjective.tags);
    }
  }, [existingObjective]);

  function saveField(patch: UpdateWorkspaceObjective) {
    if (!objectiveId) return;
    void updateObjective(objectiveId, patch).then((result) => {
      if (result.error) toast.error(result.error);
    });
  }
  function plan(patch: UpdateWorkspaceObjective) {
    setPlanning((current) => ({ ...current, ...patch }));
    if (!isCreating) saveField(patch);
  }

  async function handleCreate() {
    if (!title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    setIsSaving(true);
    const result = await createObjective({
      title: title.trim(),
      description: description || undefined,
      priority,
      ...planning,
      assignee_ids: assigneeIds,
      due_date: dueDate ?? undefined,
      tags: objectiveTags,
    });
    setIsSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onClose();
  }

  async function handleDelete() {
    if (!objectiveId) return;
    setIsSaving(true);
    const result = await deleteObjective(objectiveId);
    setIsSaving(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    onClose();
  }

  const total = existingObjective?.execution_total ?? 0;
  const done = existingObjective?.execution_done ?? 0;
  const percent = total > 0 ? (done / total) * 100 : 0;

  if (!portalReady) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] isolate flex ${isModal ? "items-center justify-center p-3 sm:p-4" : ""}`}
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={
          isModal ? "lc-modal-backdrop absolute inset-0" : "flex-1 lc-scrim"
        }
        style={
          isModal
            ? undefined
            : { background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }
        }
        onClick={onClose}
      />

      <motion.div
        initial={isModal ? { opacity: 0, scale: 0.93, y: 14 } : { x: "100%" }}
        animate={isModal ? { opacity: 1, scale: 1, y: 0 } : { x: 0 }}
        exit={isModal ? { opacity: 0, scale: 0.96, y: 8 } : { x: "100%" }}
        transition={{
          type: "spring",
          damping: isModal ? 34 : 28,
          stiffness: isModal ? 420 : 280,
        }}
        className={
          isModal
            ? "lc-modal-panel relative z-10 flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl sm:max-h-[min(90dvh,860px)]"
            : "lc-modal-panel flex h-full w-full max-w-md flex-shrink-0 flex-col"
        }
        style={
          isModal ? undefined : { borderLeft: "1px solid var(--border-modal)" }
        }
        role="dialog"
        aria-modal="true"
        aria-label={isCreating ? "Novo objetivo" : "Detalhes do objetivo"}
      >
        <div
          className="sticky top-0 z-10 flex flex-shrink-0 items-center gap-3 px-5 py-4"
          style={{
            background: "var(--bg-modal)",
            borderBottom: "1px solid var(--border-modal)",
          }}
        >
          <p
            className="flex-1 text-sm font-semibold"
            style={{ color: "var(--text-title)" }}
          >
            {isCreating ? "Novo objetivo" : "Detalhes do objetivo"}
          </p>
          {!isCreating && (
            <button
              onClick={() => setConfirmDelete(true)}
              aria-label="Excluir objetivo"
            >
              <Trash2 size={16} style={{ color: "var(--muted-foreground)" }} />
            </button>
          )}
          <button onClick={onClose} aria-label="Fechar">
            <X size={18} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="flex flex-col gap-5">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() =>
                !isCreating &&
                title.trim() &&
                title !== existingObjective?.title &&
                saveField({ title: title.trim() })
              }
              placeholder="Título do objetivo"
              className="bg-transparent text-lg font-semibold outline-none placeholder:text-[var(--muted-foreground)]"
              style={{ color: "var(--text-title)" }}
              autoFocus
            />

            {!isCreating && total > 0 && (
              <div>
                <ProgressBar percent={percent} />
                <p
                  className="mt-1 text-[10px]"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {done}/{total} tarefas e etapas concluídas (inclui
                  subobjetivos)
                </p>
              </div>
            )}

            <div>
              <p
                className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                Descrição
              </p>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onBlur={() =>
                  !isCreating &&
                  description !== (existingObjective?.description ?? "") &&
                  saveField({ description })
                }
                placeholder="Adicionar descrição..."
                rows={3}
              />
            </div>

            <div>
              <p
                className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                Prioridade
              </p>
              <div className="flex flex-wrap gap-1.5">
                {WORKSPACE_TASK_PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setPriority(p.id);
                      if (!isCreating) saveField({ priority: p.id });
                    }}
                    className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-all"
                    style={{
                      background:
                        priority === p.id ? `${p.color}30` : "var(--hover)",
                      color:
                        priority === p.id ? p.color : "var(--muted-foreground)",
                      border: `1px solid ${priority === p.id ? p.color + "50" : "var(--glass-border)"}`,
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p
                className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                Responsável
              </p>
              <AssigneePicker
                value={assigneeIds}
                onChange={(ids) => {
                  setAssigneeIds(ids);
                  if (!isCreating) saveField({ assignee_ids: ids });
                }}
              />
            </div>

            <div>
              <p
                className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--muted-foreground)" }}
              >
                Prazo
              </p>
              <DueDatePicker
                date={dueDate}
                time={null}
                onChangeDate={(d) => {
                  setDueDate(d);
                  if (!isCreating) saveField({ due_date: d });
                }}
                onChangeTime={() => {}}
              />
            </div>

            <TagSelector
              scope="workspace"
              value={objectiveTags}
              onChange={(ids) => {
                setObjectiveTags(ids);
                if (!isCreating) saveField({ tags: ids });
              }}
            />
            <label className="text-xs">
              Horizonte
              <select
                aria-label="Horizonte"
                className="mt-1 w-full rounded-lg border bg-[var(--background)] p-2"
                value={planning.horizon}
                onChange={(e) =>
                  plan({
                    horizon: e.target.value as "curto" | "medio" | "longo",
                  })
                }
              >
                <option value="curto">Curto prazo</option>
                <option value="medio">Médio prazo</option>
                <option value="longo">Longo prazo</option>
              </select>
            </label>
            <label className="text-xs">
              Status
              <select
                aria-label="Status do objetivo"
                className="mt-1 w-full rounded-lg border bg-[var(--background)] p-2"
                value={planning.status}
                onChange={(e) =>
                  plan({
                    status: e.target
                      .value as UpdateWorkspaceObjective["status"],
                  })
                }
              >
                {Object.entries({
                  planejado: "Planejado",
                  em_andamento: "Em andamento",
                  pausado: "Pausado",
                  concluido: "Concluído",
                  cancelado: "Cancelado",
                }).map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              Data de início
              <input
                aria-label="Data de início"
                type="date"
                className="mt-1 w-full rounded-lg border bg-[var(--background)] p-2"
                value={planning.start_date ?? ""}
                onChange={(e) => plan({ start_date: e.target.value || null })}
              />
            </label>
            <label className="text-xs">
              Objetivo principal
              <select
                aria-label="Objetivo principal"
                className="mt-1 w-full rounded-lg border bg-[var(--background)] p-2"
                value={planning.parent_id ?? ""}
                onChange={(e) => plan({ parent_id: e.target.value || null })}
              >
                <option value="">Objetivo independente</option>
                {objectives
                  .filter(
                    (o) =>
                      !objectiveId ||
                      !descendants(objectiveId, objectives).has(o.id),
                  )
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
              </select>
            </label>
            {!isCreating && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">Subobjetivos</h3>
                {objectives
                  .filter((o) => o.parent_id === objectiveId)
                  .map((o) => (
                    <button
                      key={o.id}
                      className="block w-full rounded-lg border p-2 text-left text-sm"
                      onClick={() => onOpenObjective?.(o.id)}
                    >
                      {o.title} · {o.execution_done ?? 0}/
                      {o.execution_total ?? 0}
                    </button>
                  ))}
                {!objectives.some((o) => o.parent_id === objectiveId) && (
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Crie um objetivo e selecione este como objetivo principal.
                  </p>
                )}
              </div>
            )}
            {!isCreating && existingObjective && (
              <ObjectivePlanning
                id={existingObjective.id}
                onChange={() => void objectivesHook.refetch()}
              />
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
                  <p
                    className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted-foreground)" }}
                  >
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
                  <p
                    className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted-foreground)" }}
                  >
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
                  <p
                    className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide"
                    style={{ color: "var(--muted-foreground)" }}
                  >
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
          className="lc-modal-backdrop fixed inset-0 z-[60] flex items-center justify-center p-4"
          style={{
            background: "rgba(0,0,0,0.60)",
            backdropFilter: "blur(6px)",
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 440, damping: 34 }}
            className="w-full max-w-sm overflow-hidden rounded-2xl"
            style={{
              background: "var(--bg-modal)",
              border: "1px solid var(--border-modal)",
              boxShadow: "0 24px 64px var(--shadow-modal)",
            }}
          >
            <div className="flex flex-col gap-2 px-5 pb-4 pt-5">
              <p
                className="text-sm font-semibold"
                style={{ color: "var(--text-title)" }}
              >
                Excluir objetivo
              </p>
              <p
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                Esta ação não pode ser desfeita. Etapas, metas, blocos,
                comentários e anexos serão removidos. Tarefas e subobjetivos
                serão preservados.
              </p>
            </div>
            <div
              className="flex justify-end gap-2 px-5 py-4"
              style={{ borderTop: "1px solid var(--glass-border)" }}
            >
              <button
                onClick={() => setConfirmDelete(false)}
                disabled={isSaving}
                className="rounded-full px-4 py-1.5 text-xs disabled:opacity-40"
                style={{
                  background: "var(--hover)",
                  color: "var(--muted-foreground)",
                  border: "1px solid var(--glass-border)",
                }}
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
