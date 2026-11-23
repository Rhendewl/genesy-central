"use client";

import { useEffect, useState } from "react";
import { useUsers } from "@/hooks/useUsers";
import { createPortal } from "react-dom";
import { useModalOpen } from "@/hooks/useModalOpen";
import { X, Loader2 } from "lucide-react";
import type { CrmPipeline, CrmPipelineWithStages, NewCrmPipeline } from "@/types/crm";

// ── Color palette ──────────────────────────────────────────────────────────────

const COLORS = [
  "#4a8fd4", "#6366f1", "#22c55e", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6",
  "#06b6d4", "#f97316", "#7d99ad", "#a855f7",
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:     boolean;
  pipeline: CrmPipeline | null;   // null = create mode
  onClose:  () => void;
  onSave:   (data: NewCrmPipeline & { template_pipeline_id?: string }) => Promise<boolean>;
  /** Pipelines existentes que podem servir de modelo na criação. */
  templates?: CrmPipelineWithStages[];
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PipelineFormModal({ open, pipeline, onClose, onSave, templates = [] }: Props) {
  const { profiles, isLoading: loadingUsers } = useUsers();
  const [defaultAssignee, setDefaultAssignee] = useState("");
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [color,       setColor]       = useState(COLORS[0]);
  const [saving,      setSaving]      = useState(false);
  const [templateId,  setTemplateId]  = useState("");

  // Sync fields when opening
  useEffect(() => {
    if (!open) return;
    setDefaultAssignee(pipeline?.default_assignee_id ?? "");
    setName(pipeline?.name ?? "");
    setDescription(pipeline?.description ?? "");
    setColor(pipeline?.color ?? COLORS[0]);
    setTemplateId("");
  }, [open, pipeline]);

  useModalOpen(open);
  useEffect(()=>{if(!open)return;const previous=document.body.style.overflow;document.body.style.overflow="hidden";const close=(e:KeyboardEvent)=>{if(e.key==="Escape"&&!saving)onClose();};document.addEventListener("keydown",close);return()=>{document.body.style.overflow=previous;document.removeEventListener("keydown",close);};},[open,saving,onClose]);
  if (!open || typeof document === "undefined") return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const ok = await onSave({ name: name.trim(), description: description.trim() || null, color, default_assignee_id: defaultAssignee || null,
      ...(!pipeline && templateId ? { template_pipeline_id: templateId } : {}) });
    setSaving(false);
    if (ok) onClose();
  };

  return createPortal(
    <div
      className="lc-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.60)" }}
      onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}
    >
      <div
        role="dialog" aria-modal="true" aria-labelledby="pipeline-form-title"
        className="lc-modal-panel h-[650px] max-h-[90dvh] w-full max-w-lg rounded-2xl flex flex-col gap-0 overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <p id="pipeline-form-title" className="text-base font-semibold" style={{ color: "var(--text-title)" }}>
            {pipeline ? "Editar Pipeline" : "Novo Pipeline"}
          </p>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar pipeline"
            className="p-1 rounded-lg hover:bg-[var(--hover)] transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-5 py-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>
              Nome <span style={{ color: "var(--primary)" }}>*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Funil Comercial"
              maxLength={80}
              required
              autoFocus
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{
                background: "var(--hover)",
                border: "1px solid var(--border)",
                color: "var(--text-title)",
              }}
            />
          </div>

          {/* Modelo: criar igual a uma pipeline existente */}
          {!pipeline && templates.length > 0 && <div className="rounded-xl border border-[var(--border)] p-3">
            <label htmlFor="pipeline-template" className="mb-2 block text-sm font-semibold" style={{ color: "var(--text-title)" }}>Usar outra pipeline como modelo</label>
            <select id="pipeline-template" value={templateId} disabled={saving} onChange={(event) => setTemplateId(event.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm">
              <option value="">Começar do zero</option>
              {templates.map(template => {
                const owner = profiles.find(profile => profile.id === template.default_assignee_id)?.full_name;
                const count = template.crm_stages.length;
                return <option key={template.id} value={template.id}>{template.name}{owner ? ` (${owner})` : ""} · {count} etapa{count === 1 ? "" : "s"}</option>;
              })}
            </select>
            {templateId && (() => { const template = templates.find(item => item.id === templateId); return template ? <div className="mt-3 flex flex-wrap gap-1.5">{[...template.crm_stages].sort((a, b) => a.order_index - b.order_index).map(stage => <span key={stage.id} className="rounded-md px-2 py-1 text-[11px]" style={{ background: `${stage.color}22`, color: "var(--text-title)", border: `1px solid ${stage.color}55` }}>{stage.name}</span>)}</div> : null; })()}
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">A nova pipeline nasce com as mesmas etapas, cores e regras do modelo. Os leads não são copiados.</p>
          </div>}

          {/* Description */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>
              Descrição
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Descrição opcional…"
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{
                background: "var(--hover)",
                border: "1px solid var(--border)",
                color: "var(--text-title)",
              }}
            />
          </div>

          <div className="rounded-xl border border-sky-500/30 bg-sky-500/10 p-3">
            <label htmlFor="pipeline-default-assignee" className="mb-2 block text-sm font-semibold">Proprietário da pipeline / responsável padrão</label>
            <select id="pipeline-default-assignee" value={defaultAssignee} disabled={loadingUsers || saving} onChange={(event) => setDefaultAssignee(event.target.value)} className="min-h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--input)] px-3 text-sm">
              <option value="">Sem atribuição automática</option>
              {profiles.filter(profile => profile.is_active && profile.auth_user_id).map(profile => <option key={profile.id} value={profile.id}>{profile.full_name}</option>)}
              {defaultAssignee && !profiles.some(profile => profile.id === defaultAssignee && profile.is_active && profile.auth_user_id) && <option value={defaultAssignee}>Responsável indisponível · escolha outro</option>}
            </select>
            <p className="mt-2 text-xs text-[var(--muted-foreground)]">Novos leads recebem este responsável antes das notificações. Uma escolha manual de responsável tem prioridade. O proprietário também recebe acesso à pipeline. Na roleta, ele é sempre o responsável pelos leads destinados a esta pipeline.</p>
            {pipeline && <p className="mt-2 text-xs text-[var(--muted-foreground)]">Alterar o padrão vale para novos leads; os responsáveis dos leads existentes são preservados.</p>}
          </div>

          {/* Color */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-title)" }}>
              Cor
            </label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className="w-7 h-7 rounded-lg transition-all"
                  style={{
                    background: c,
                    outline: color === c ? `2px solid ${c}` : "none",
                    outlineOffset: "2px",
                    opacity: color === c ? 1 : 0.5,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="sticky -bottom-5 -mx-5 -mb-5 mt-auto flex shrink-0 justify-end gap-2 border-t border-[var(--border)] bg-[var(--bg-modal)] px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!name.trim() || saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#b0b8c1", color: "#000000" }}
            >
              {saving && <Loader2 size={11} className="animate-spin" />}
              {saving ? "Salvando…" : pipeline ? "Salvar" : "Criar Pipeline"}
            </button>
          </div>
        </form>
      </div>
    </div>, document.body
  );
}
