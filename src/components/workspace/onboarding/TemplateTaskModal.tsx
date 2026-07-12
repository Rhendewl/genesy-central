"use client";

import { useState } from "react";
import { X, Loader2, Trash2 } from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import { appendClientNameToken, CLIENT_NAME_TOKEN } from "@/lib/onboarding/task-title-tokens";
import { WORKSPACE_TASK_PRIORITIES, type WorkspaceTaskPriority } from "@/types/workspace";
import type { NewOnboardingTemplateTask, OnboardingTemplateTask } from "@/types/onboarding";

interface TemplateTaskModalProps {
  task?:          OnboardingTemplateTask | null;
  otherTasks:     OnboardingTemplateTask[]; // candidatas a dependência (mesmo template, exclui a própria)
  onClose:  () => void;
  onSave:   (data: NewOnboardingTemplateTask) => Promise<{ error?: string }>;
  onDelete?: () => Promise<void>;
}

export function TemplateTaskModal({ task, otherTasks, onClose, onSave, onDelete }: TemplateTaskModalProps) {
  const { profiles } = useUsers();
  const [title,       setTitle]       = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [assigneeProfileId, setAssigneeProfileId] = useState(task?.assignee_profile_id ?? "");
  const [priority,    setPriority]    = useState<WorkspaceTaskPriority>(task?.priority ?? "media");
  const [relativeDays, setRelativeDays] = useState<string>(task?.relative_due_days != null ? String(task.relative_due_days) : "");
  const [dependsOn,    setDependsOn]    = useState<string[]>(task?.depends_on_task_ids ?? []);
  const [isSaving,   setIsSaving]   = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleDepends(id: string) {
    setDependsOn((prev) => prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]);
  }

  async function handleSave() {
    if (!title.trim()) { setError("Título é obrigatório"); return; }
    setIsSaving(true);
    setError(null);
    const result = await onSave({
      title:                     title.trim(),
      description:               description.trim() || undefined,
      role_key:                  null,
      assignee_profile_id:       assigneeProfileId || null,
      priority,
      relative_due_days:         relativeDays === "" ? undefined : Number(relativeDays),
      depends_on_task_ids:      dependsOn,
    });
    setIsSaving(false);
    if (result.error) { setError(result.error); return; }
    onClose();
  }

  async function handleDelete() {
    if (!onDelete) return;
    setIsDeleting(true);
    await onDelete();
    setIsDeleting(false);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 lc-scrim"
      style={{ background: "rgba(0,0,0,0.60)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
        style={{ background: "var(--bg-modal)", border: "1px solid var(--border-modal)", boxShadow: "0 24px 64px var(--shadow-modal)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-5">
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>{task ? "Editar tarefa" : "Nova tarefa"}</p>
          <button onClick={onClose} className="rounded p-1 hover:bg-[var(--hover)]">
            <X size={16} style={{ color: "var(--muted-foreground)" }} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Título</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
            />
            <button
              type="button"
              onClick={() => setTitle((current) => appendClientNameToken(current))}
              className="w-fit rounded-full px-2.5 py-1 text-[11px] font-medium"
              style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
            >
              Inserir {CLIENT_NAME_TOKEN}
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Descrição</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-none rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Responsável</label>
            <select
              value={assigneeProfileId}
              onChange={(e) => setAssigneeProfileId(e.target.value)}
              className="rounded-lg px-3 py-2 text-sm outline-none"
              style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
            >
              <option value="">Não atribuir agora</option>
              {profiles.filter((p) => p.is_active).map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.full_name}{profile.job_title ? ` — ${profile.job_title}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Prioridade</label>
              <div className="flex flex-wrap gap-1.5">
                {WORKSPACE_TASK_PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPriority(p.id)}
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
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Prazo relativo (dias)</label>
              <input
                type="number"
                min={0}
                value={relativeDays}
                onChange={(e) => setRelativeDays(e.target.value)}
                placeholder="usa o da etapa"
                className="rounded-lg px-3 py-2 text-sm outline-none"
                style={{ background: "var(--hover)", border: "1px solid var(--glass-border)", color: "var(--text-title)" }}
              />
            </div>
          </div>

          {otherTasks.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>Depende de</label>
              <div className="flex max-h-32 flex-col gap-1 overflow-y-auto rounded-lg p-1" style={{ background: "var(--hover)" }}>
                {otherTasks.map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-[var(--glass-border)]">
                    <input type="checkbox" checked={dependsOn.includes(t.id)} onChange={() => toggleDepends(t.id)} />
                    <span style={{ color: "var(--text-title)" }}>{t.title}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-xs" style={{ color: "#e05c5c" }}>{error}</p>}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4" style={{ borderTop: "1px solid var(--glass-border)" }}>
          {task && onDelete ? (
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs disabled:opacity-40"
              style={{ background: "transparent", color: "#e05c5c", border: "1px solid #e05c5c50" }}
            >
              {isDeleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              Excluir
            </button>
          ) : <span />}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-full px-4 py-1.5 text-xs"
              style={{ background: "var(--hover)", color: "var(--muted-foreground)", border: "1px solid var(--glass-border)" }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="lc-btn flex items-center gap-1.5 px-4 py-1.5 text-xs disabled:opacity-40"
            >
              {isSaving && <Loader2 size={12} className="animate-spin" />}
              {task ? "Salvar" : "Criar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
