"use client";

import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DueDatePicker } from "@/components/workspace/DueDatePicker";
import { TagSelector } from "@/components/tags/TagSelector";
import { useMarketing } from "@/context/MarketingContext";
import { useTags } from "@/hooks/useTags";
import {
  CONTENT_STATUS_LABELS,
  FORMAT_LABELS,
  MARKETING_CONTENT_STATUSES,
  MARKETING_FORMATS,
  MARKETING_PLATFORMS,
  PLATFORM_LABELS,
  type MarketingContent,
  type MarketingContentInput,
  type MarketingIdea,
  type MarketingPriority,
} from "@/types/marketing";
import { WORKSPACE_TASK_PRIORITIES } from "@/types/workspace";

const inputClass = "w-full rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-sm text-[var(--text-title)] outline-none transition-shadow focus:ring-1 focus:ring-[var(--glass-border)]";

const PRIORITY_TO_WORKSPACE = {
  low: "baixa",
  medium: "media",
  high: "alta",
  urgent: "urgente",
} as const satisfies Record<MarketingPriority, string>;

function splitDateTime(iso: string | null | undefined, fallback?: Date | null) {
  const date = iso ? new Date(iso) : fallback ?? null;
  if (!date || Number.isNaN(date.getTime())) return { date: null as string | null, time: null as string | null };
  return { date: format(date, "yyyy-MM-dd"), time: format(date, "HH:mm") };
}

function joinDateTime(date: string | null, time: string | null) {
  if (!date) return null;
  const value = new Date(`${date}T${time ?? "12:00"}:00`);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

export function MarketingContentDialog({
  open,
  onOpenChange,
  content = null,
  initialDate,
  planIdea,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content?: MarketingContent | null;
  initialDate?: Date | null;
  planIdea?: MarketingIdea | null;
}) {
  const marketing = useMarketing();
  const { tags } = useTags();
  const [saving, setSaving] = useState(false);

  const defaults = useMemo(() => {
    const posting = splitDateTime(content?.scheduled_at, initialDate);
    const delivery = splitDateTime(content?.delivery_at);
    return {
      title: content?.title ?? planIdea?.title ?? "",
      description: content?.description ?? planIdea?.description ?? "",
      status: content?.status ?? "planned",
      priority: content?.priority ?? planIdea?.priority ?? "medium",
      platform: content?.platform ?? planIdea?.suggested_platform ?? "instagram",
      contentFormat: content?.format ?? planIdea?.suggested_format ?? "static_post",
      postingDate: posting.date,
      postingTime: posting.time,
      deliveryDate: delivery.date,
      deliveryTime: delivery.time,
      primaryAssigneeId: content?.primary_assignee_id ?? planIdea?.suggested_assignee_id ?? "",
      assignToWorkspace: !!content?.workspace_task_id,
      workspaceTagIds: content?.workspace_tag_ids ?? [],
    };
  }, [content, initialDate, planIdea]);

  const [form, setForm] = useState(defaults);
  useEffect(() => { if (open) setForm(defaults); }, [defaults, open]);

  const canEdit = !content || content.can_edit;
  const workspacePriority = WORKSPACE_TASK_PRIORITIES.find((item) => item.id === PRIORITY_TO_WORKSPACE[form.priority as MarketingPriority]);

  function payload(): MarketingContentInput {
    const selectedTagNames = tags.filter((tag) => form.workspaceTagIds.includes(tag.id)).map((tag) => tag.name);
    return {
      title: form.title.trim(),
      description: form.description.trim() || null,
      status: form.status as MarketingContent["status"],
      priority: form.priority as MarketingPriority,
      platform: form.platform as MarketingContent["platform"],
      format: form.contentFormat as MarketingContent["format"],
      scheduled_at: joinDateTime(form.postingDate, form.postingTime),
      delivery_at: joinDateTime(form.deliveryDate, form.deliveryTime),
      primary_assignee_id: form.primaryAssigneeId || null,
      assignee_ids: form.primaryAssigneeId ? [form.primaryAssigneeId] : [],
      workspace_task_id: form.assignToWorkspace ? content?.workspace_task_id ?? null : null,
      create_workspace_task: form.assignToWorkspace && !content?.workspace_task_id,
      workspace_tag_ids: form.workspaceTagIds,
      tag_names: selectedTagNames,
      // Mantém os campos avançados antigos ao editar, embora eles não ocupem
      // mais espaço no fluxo principal de criação do calendário.
      caption: content?.caption ?? null,
      script: content?.script ?? null,
      cta: content?.cta ?? null,
      notes: content?.notes ?? null,
      thumbnail_url: content?.thumbnail_url ?? null,
      reference_links: content?.reference_links ?? planIdea?.reference_links ?? [],
      publication_url: content?.publication_url ?? null,
      published_at: content?.published_at ?? null,
      manual_publication: content?.manual_publication ?? false,
      post_publication_notes: content?.post_publication_notes ?? null,
      asset_ids: content?.asset_ids ?? [],
    };
  }

  async function submit() {
    if (!form.title.trim()) return toast.error("Título é obrigatório");
    setSaving(true);
    const result = content
      ? await marketing.updateContent(content.id, payload())
      : planIdea
        ? await marketing.planIdea(planIdea.id, payload())
        : await marketing.createContent(payload());
    setSaving(false);
    if (result) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[110]"
        className="z-[120] flex h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-none flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:h-[86dvh] sm:max-h-[900px] sm:w-[calc(100%-3rem)] sm:max-w-5xl sm:rounded-3xl"
      >
        <DialogHeader className="shrink-0 border-b border-[var(--border)] px-5 py-4 pr-14 sm:px-7 sm:py-5">
          <DialogTitle>{content ? "Editar conteúdo" : planIdea ? "Planejar conteúdo" : "Novo conteúdo"}</DialogTitle>
          <DialogDescription className="max-w-2xl">Organize o post e, se desejar, envie a execução diretamente para o Workspace.</DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-3 py-3 sm:px-7 sm:py-6">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,.88fr)] lg:gap-6">
            <section className="min-w-0 space-y-5 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] p-3.5 sm:p-5">
              <div>
                <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Conteúdo</p>
                <input
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Título do conteúdo"
                  className="w-full bg-transparent text-lg font-semibold text-[var(--text-title)] outline-none placeholder:text-[var(--muted-foreground)] sm:text-xl"
                  readOnly={!canEdit}
                  autoFocus={canEdit}
                />
              </div>

              <label className="block space-y-1.5 text-xs text-[var(--muted-foreground)]">
                Briefing
                <textarea
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  className={`${inputClass} min-h-36 resize-y sm:min-h-44`}
                  placeholder="Descreva o que precisa ser produzido..."
                  readOnly={!canEdit}
                />
              </label>

              <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Prioridade</p>
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(PRIORITY_TO_WORKSPACE) as MarketingPriority[]).map((priority) => {
                const workspace = WORKSPACE_TASK_PRIORITIES.find((item) => item.id === PRIORITY_TO_WORKSPACE[priority])!;
                const active = form.priority === priority;
                return (
                  <button key={priority} type="button" disabled={!canEdit} onClick={() => setForm((current) => ({ ...current, priority }))} className="rounded-full px-2.5 py-1 text-[11px] font-medium disabled:cursor-default" style={{ background: active ? `${workspace.color}30` : "var(--hover)", color: active ? workspace.color : "var(--muted-foreground)", border: `1px solid ${active ? workspace.color + "55" : "var(--glass-border)"}` }}>
                    {workspace.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[10px] text-[var(--muted-foreground)]">A tarefa do Workspace usará a mesma prioridade{workspacePriority ? ` (${workspacePriority.label})` : ""}.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Select label="Status" value={form.status} onChange={(status) => setForm((current) => ({ ...current, status: status as MarketingContent["status"] }))} options={MARKETING_CONTENT_STATUSES.map((value) => [value, CONTENT_STATUS_LABELS[value]])} disabled={!canEdit} />
                <Select label="Plataforma" value={form.platform} onChange={(platform) => setForm((current) => ({ ...current, platform: platform as MarketingContent["platform"] }))} options={MARKETING_PLATFORMS.map((value) => [value, PLATFORM_LABELS[value]])} disabled={!canEdit} />
                <Select label="Formato" value={form.contentFormat} onChange={(contentFormat) => setForm((current) => ({ ...current, contentFormat: contentFormat as MarketingContent["format"] }))} options={MARKETING_FORMATS.map((value) => [value, FORMAT_LABELS[value]])} disabled={!canEdit} />
              </div>

              <TagSelector
                value={form.workspaceTagIds}
                disabled={!canEdit}
                onChange={(workspaceTagIds) => setForm((current) => ({ ...current, workspaceTagIds }))}
                helperText="As mesmas etiquetas serão aplicadas ao conteúdo e à tarefa criada no Workspace. Use o ícone de lixeira para apagar uma etiqueta."
              />
            </section>

            <aside className="min-w-0 space-y-5 rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg-soft)] p-3.5 sm:p-5">
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Planejamento</p>
                <div className="space-y-4">
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Data da postagem</p>
                    <div className={!canEdit ? "pointer-events-none opacity-70" : undefined}>
                      <DueDatePicker date={form.postingDate} time={form.postingTime} onChangeDate={(postingDate) => setForm((current) => ({ ...current, postingDate }))} onChangeTime={(postingTime) => setForm((current) => ({ ...current, postingTime }))} />
                    </div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">Data de entrega</p>
                    <div className={!canEdit ? "pointer-events-none opacity-70" : undefined}>
                      <DueDatePicker date={form.deliveryDate} time={form.deliveryTime} onChangeDate={(deliveryDate) => setForm((current) => ({ ...current, deliveryDate }))} onChangeTime={(deliveryTime) => setForm((current) => ({ ...current, deliveryTime }))} />
                    </div>
                  </div>
                </div>
              </div>

              <label className="block space-y-1.5 text-xs text-[var(--muted-foreground)]">
                Responsável
                <select value={form.primaryAssigneeId} onChange={(event) => setForm((current) => ({ ...current, primaryAssigneeId: event.target.value }))} className={inputClass} disabled={!canEdit}>
                  <option value="">Sem responsável</option>
                  {marketing.members.map((member) => <option key={member.id} value={member.id}>{member.full_name}</option>)}
                </select>
                {form.assignToWorkspace && <span className="block text-[10px]">Será atribuído diretamente também à tarefa do Workspace.</span>}
              </label>

              <div className="rounded-2xl border border-[var(--glass-border)] bg-[var(--bg-modal)] p-3.5">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={form.assignToWorkspace} onChange={(event) => setForm((current) => ({ ...current, assignToWorkspace: event.target.checked }))} disabled={!canEdit} className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--primary)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-[var(--text-title)]">Atribuir ao Workspace</span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--muted-foreground)]">Cria uma tarefa usando título, briefing, data de entrega, prioridade, etiquetas e responsável deste conteúdo.</span>
                  </span>
                </label>
                {content?.workspace_task_id && form.assignToWorkspace && (
                  <a href={`/workspace/kanban?task=${content.workspace_task_id}`} className="mt-3 flex items-center gap-1.5 text-xs font-medium text-[var(--accent-blue)] hover:underline">
                    Abrir tarefa vinculada <ExternalLink size={12} />
                  </a>
                )}
              </div>
            </aside>
          </div>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-[var(--border)] px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-4">
          {content?.can_delete ? <button type="button" onClick={async () => { if (await marketing.archiveContent(content.id)) onOpenChange(false); }} className="text-xs text-red-400">Arquivar conteúdo</button> : <span />}
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl px-4 py-2.5 text-sm text-[var(--text-title)] sm:py-2" style={{ background: "var(--hover)" }}>Fechar</button>
            {canEdit && <button type="button" onClick={() => void submit()} disabled={saving} className="lc-btn flex items-center justify-center gap-2 px-4 py-2.5 text-sm disabled:opacity-60 sm:py-2">{saving && <Loader2 size={14} className="animate-spin" />}Salvar</button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Select({ label, value, onChange, options, disabled }: { label: string; value: string; onChange: (value: string) => void; options: readonly (readonly [string, string])[]; disabled?: boolean }) {
  return (
    <label className="space-y-1.5 text-xs text-[var(--muted-foreground)]">
      {label}
      <select className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select>
    </label>
  );
}
