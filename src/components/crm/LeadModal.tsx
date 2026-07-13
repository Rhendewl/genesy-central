"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useModalOpen } from "@/hooks/useModalOpen";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, Trash2, Tag as TagIcon, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ProgressBar } from "@/components/workspace/ProgressBar";
import { useTags } from "@/hooks/useTags";
import { useUsers } from "@/hooks/useUsers";
import type { KanbanColumn, Lead, NewLead, UpdateLead } from "@/types";
import { KANBAN_COLUMNS } from "@/types";
import type { CrmStage, CrmPipelineWithStages } from "@/types/crm";
import { LeadScoreEngine } from "@/lib/crm/lead-score-engine";

// ─────────────────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────────────────

function friendlyError(raw: string): string {
  if (raw.includes("column") && raw.includes("deal_value"))
    return "Campo 'Valor do Negócio' não encontrado no banco. Execute a migration 002 no Supabase Dashboard.";
  if (raw.includes("violates check constraint"))
    return "Valor inválido. Verifique os campos e tente novamente.";
  if (raw.includes("duplicate key") || raw.includes("unique"))
    return "Já existe um registro com esses dados.";
  if (raw.includes("JWT") || raw.includes("auth") || raw.includes("unauthorized"))
    return "Sessão expirada. Faça login novamente.";
  if (raw.includes("network") || raw.includes("fetch"))
    return "Sem conexão. Verifique sua internet e tente novamente.";
  return "Ocorreu um erro ao salvar. Tente novamente.";
}

// ─────────────────────────────────────────────────────────────────────────────
// LeadModal — criar e editar leads
//
// Criação: stage selecionável (stages do pipeline ativo)
// Edição:  stage é exibida como read-only — mover via drag-and-drop no Kanban
// ─────────────────────────────────────────────────────────────────────────────

interface LeadModalProps {
  isOpen: boolean;
  lead: Lead | null;
  stages: CrmStage[];   // active stages of the currently selected pipeline
  pipelines: CrmPipelineWithStages[]; // todas as pipelines — usado só pra "Transferir para outra pipeline"
  onClose: () => void;
  onCreate: (data: NewLead) => Promise<{ error: string | null }>;
  onUpdate: (id: string, data: UpdateLead) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
  onMove: (leadId: string, targetStageId: string, note?: string) => Promise<{ ok: boolean; requireNote: boolean; error: string | null }>;
}

const TODAY = format(new Date(), "yyyy-MM-dd");

function emptyForm() {
  return {
    name:        "",
    contact:     "",
    stage_id:    null as string | null,
    assigned_to: null as string | null,
    tags:        [] as string[],
    notes:       "",
    entered_at:  TODAY,
  };
}

export function LeadModal({
  isOpen,
  lead,
  stages,
  pipelines,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
  onMove,
}: LeadModalProps) {
  const { tags } = useTags();
  const { profiles } = useUsers();
  const activeProfiles = profiles.filter((p) => p.auth_user_id && p.is_active);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm]             = useState(emptyForm());
  const [dealValue, setDealValue]   = useState(0);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [isDeleting, setIsDeleting]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  // Override otimista: reflete o novo IQ na hora, sem esperar o realtime
  // (que também vai atualizar `lead.iq_score` em breve).
  const [recalculatedIq, setRecalculatedIq] = useState<number | null | undefined>(undefined);

  // ── Transferir para outra pipeline ──────────────────────────────────────────
  const [transferPipelineId, setTransferPipelineId] = useState("");
  const [transferNote,       setTransferNote]       = useState("");
  const [transferNeedsNote,  setTransferNeedsNote]  = useState(false);
  const [isTransferring,     setIsTransferring]     = useState(false);
  const [mounted, setMounted] = useState(false);

  useModalOpen(isOpen);
  const isEditing = lead !== null;

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Preenche formulário ao abrir ───────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setConfirmDelete(false);
      setRecalculatedIq(undefined);
      setTransferPipelineId("");
      setTransferNote("");
      setTransferNeedsNote(false);
      if (lead) {
        setForm({
          name:        lead.name,
          contact:     lead.contact,
          stage_id:    lead.stage_id ?? null,
          assigned_to: lead.assigned_to ?? null,
          tags:        lead.tags as string[],
          notes:       lead.notes ?? "",
          entered_at:  lead.entered_at,
        });
        setDealValue(lead.deal_value ?? 0);
      } else {
        // Usa a primeira stage ativa como padrão ao criar
        setForm({ ...emptyForm(), stage_id: stages[0]?.id ?? null });
        setDealValue(0);
      }
      setTimeout(() => firstInputRef.current?.focus(), 180);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lead]);

  // ── Escape para fechar ─────────────────────────────────────────────────────

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // ── Derived: nome da stage atual (para exibição em modo edição) ────────────

  const currentStageName = useMemo(() => {
    if (!lead) return "";
    if (lead.stage_id) {
      const s = stages.find((s) => s.id === lead.stage_id);
      if (s) return s.name;
    }
    // Fallback legado: usa label da kanban_column
    return KANBAN_COLUMNS.find((c) => c.id === lead.kanban_column)?.label ?? lead.kanban_column;
  }, [lead, stages]);

  // Pipelines elegíveis como destino: ativas e diferentes da atual do lead.
  const transferablePipelines = useMemo(
    () => pipelines.filter((p) => p.is_active && p.id !== lead?.pipeline_id),
    [pipelines, lead],
  );

  // ── Transferir para outra pipeline ──────────────────────────────────────────
  // O lead vai sempre para a primeira etapa ATIVA da pipeline de destino —
  // mesmo endpoint de mover (PATCH /api/crm/leads/[id]/move) já usado pelo
  // drag-and-drop do Kanban; a RPC crm_move_lead já resolve o pipeline_id a
  // partir da própria etapa de destino, então mover pra uma etapa de outra
  // pipeline já "transfere" o lead sem nenhuma mudança no backend.
  async function handleTransfer() {
    if (!lead || !transferPipelineId) return;
    const targetPipeline = pipelines.find((p) => p.id === transferPipelineId);
    if (!targetPipeline) return;

    const firstStage = [...(targetPipeline.crm_stages ?? [])]
      .filter((s) => s.is_active)
      .sort((a, b) => a.order_index - b.order_index)[0];

    if (!firstStage) {
      toast.error(`"${targetPipeline.name}" não tem etapas ativas`);
      return;
    }

    if (firstStage.require_note && !transferNeedsNote) {
      setTransferNeedsNote(true);
      return;
    }

    setIsTransferring(true);
    const result = await onMove(lead.id, firstStage.id, transferNote.trim() || undefined);
    setIsTransferring(false);

    if (!result.ok) {
      toast.error(result.error ?? "Erro ao transferir lead");
      return;
    }

    toast.success(`Lead transferido para "${targetPipeline.name}"`);
    onClose();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function toggleTag(tagId: string) {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter((id) => id !== tagId)
        : [...prev.tags, tagId],
    }));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.contact.trim()) return;

    setError(null);
    setIsSubmitting(true);

    if (isEditing) {
      // Atualização: NÃO inclui stage_id — movimentos passam exclusivamente
      // pelo LeadService via PATCH /api/crm/leads/[id]/move
      const updatePayload: UpdateLead = {
        name:        form.name.trim(),
        contact:     form.contact.trim(),
        tags:        form.tags,
        notes:       form.notes.trim() || null,
        deal_value:  dealValue,
        entered_at:  form.entered_at,
        assigned_to: form.assigned_to,
      };
      const result = await onUpdate(lead.id, updatePayload);
      setIsSubmitting(false);
      if (result.error) { setError(friendlyError(result.error)); return; }
    } else {
      // Criação: inclui stage_id + pipeline_id + kanban_column (compat legado)
      const selectedStage = stages.find((s) => s.id === form.stage_id);
      const kanban_column = (selectedStage?.legacy_column as KanbanColumn | null) ?? "novo_lead";

      // IE (Índice de Evolução) — `stages` já é só as etapas ATIVAS do
      // pipeline selecionado, então seu length já é o total certo pra
      // fórmula (ver LeadScoreEngine.calculateIE). Único caminho de criação
      // de lead que define stage_id fora do LeadService — por isso calculado
      // aqui em vez de num fetch redundante.
      const ieScore = selectedStage
        ? LeadScoreEngine.calculateIE(selectedStage.order_index, stages.length)
        : null;

      const createPayload: NewLead = {
        name:          form.name.trim(),
        contact:       form.contact.trim(),
        kanban_column,
        stage_id:      form.stage_id,
        pipeline_id:   selectedStage?.pipeline_id ?? null,
        assigned_to:   form.assigned_to,
        tags:          form.tags,
        notes:         form.notes.trim() || null,
        deal_value:    dealValue,
        entered_at:    form.entered_at,
        ie_score:      ieScore,
      };
      const result = await onCreate(createPayload);
      setIsSubmitting(false);
      if (result.error) { setError(friendlyError(result.error)); return; }
    }

    onClose();
  }

  // ── Recalcular IQ (manual, um lead por vez — nunca em lote) ────────────────

  async function handleRecalculate() {
    if (!lead) return;
    setIsRecalculating(true);
    try {
      const res  = await fetch(`/api/crm/leads/${lead.id}/recalculate-iq`, { method: "POST" });
      const json = await res.json() as { iq_score?: number | null; error?: string };
      if (!res.ok) {
        toast.error("Não foi possível recalcular", { description: json.error });
        return;
      }
      setRecalculatedIq(json.iq_score ?? null);
      toast.success("IQ recalculado");
    } catch {
      toast.error("Erro ao recalcular IQ");
    } finally {
      setIsRecalculating(false);
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!isEditing) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setIsDeleting(true);
    const result = await onDelete(lead.id);
    setIsDeleting(false);
    if (result.error) {
      setError(friendlyError(result.error));
      return;
    }
    onClose();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* ── Backdrop glassmorphism ── */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40"
            style={{
              background: "var(--dock-bg)",
              backdropFilter: "blur(12px) saturate(140%)",
              WebkitBackdropFilter: "blur(12px) saturate(140%)",
            }}
            onClick={onClose}
          />

          {/* ── Centering wrapper ── */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className="pointer-events-auto w-full max-w-md rounded-3xl"
              style={{
                background: "var(--bg-modal)",
                backdropFilter: "blur(24px) saturate(160%)",
                WebkitBackdropFilter: "blur(24px) saturate(160%)",
                border: "1px solid var(--border-modal)",
                boxShadow: "0 24px 64px var(--shadow-modal), 0 1px 0 var(--hover) inset",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Scroll interno para telas pequenas */}
              <div className="max-h-[90dvh] overflow-y-auto overscroll-contain rounded-3xl p-6">

                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                  <div>
                    <h2 className="text-[15px] font-semibold text-[var(--text-title)]">
                      {isEditing ? "Editar lead" : "Novo lead"}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                      {isEditing ? "Atualize as informações do lead" : "Preencha os dados do lead"}
                    </p>
                  </div>
                  <button
                    onClick={onClose}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-title)]"
                    aria-label="Fechar"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Separador */}
                <div className="mb-5 h-px bg-[var(--border)]" />

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* Nome */}
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-name" className="text-[11px] font-medium text-[var(--muted-foreground)]">
                      Nome completo <span className="text-red-400/80">*</span>
                    </Label>
                    <Input
                      id="lead-name"
                      ref={firstInputRef}
                      required
                      value={form.name}
                      onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="João Silva"
                      className="border-[var(--border)] bg-[var(--input)] text-[var(--text-title)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-[var(--silver)]/40"
                    />
                  </div>

                  {/* Contato */}
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-contact" className="text-[11px] font-medium text-[var(--muted-foreground)]">
                      WhatsApp / E-mail <span className="text-red-400/80">*</span>
                    </Label>
                    <Input
                      id="lead-contact"
                      required
                      value={form.contact}
                      onChange={(e) => setForm((p) => ({ ...p, contact: e.target.value }))}
                      placeholder="+55 11 99999-9999"
                      className="border-[var(--border)] bg-[var(--input)] text-[var(--text-title)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-[var(--silver)]/40"
                    />
                  </div>

                  {/* Dados de Formulário/Agendamento — preenchido automaticamente pelas
                      integrações (resposta de formulário, agendamento de calendário).
                      Somente leitura: quem escreve aqui são essas rotas, não o usuário. */}
                  {lead?.integration_notes && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                        Dados de Formulário/Agendamento
                      </Label>
                      <div className="max-h-40 overflow-y-auto whitespace-pre-line rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
                        {lead.integration_notes}
                      </div>
                    </div>
                  )}

                  {/* Valor do Negócio */}
                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                      Valor do Negócio
                    </Label>
                    <MoneyInput
                      value={dealValue}
                      onChange={setDealValue}
                      className="bg-[var(--input)]"
                    />
                  </div>

                  {/* Linha: Data + Etapa */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="lead-date" className="text-[11px] font-medium text-[var(--muted-foreground)]">
                        Data de entrada
                      </Label>
                      <Input
                        id="lead-date"
                        type="date"
                        value={form.entered_at}
                        onChange={(e) => setForm((p) => ({ ...p, entered_at: e.target.value }))}
                        className="border-[var(--border)] bg-[var(--input)] text-[var(--text-title)] focus-visible:ring-[var(--silver)]/40"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="lead-stage" className="text-[11px] font-medium text-[var(--muted-foreground)]">
                        Etapa
                      </Label>
                      {isEditing ? (
                        /* Edição: exibição somente leitura — mover via drag-and-drop */
                        <div
                          className="flex h-9 w-full items-center rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-xs"
                          style={{ color: "var(--muted-foreground)" }}
                          title="Para mover, arraste o card no Kanban"
                        >
                          <span className="truncate">{currentStageName || "—"}</span>
                        </div>
                      ) : (
                        /* Criação: seletor de stage do pipeline ativo */
                        <select
                          id="lead-stage"
                          value={form.stage_id ?? ""}
                          onChange={(e) =>
                            setForm((p) => ({ ...p, stage_id: e.target.value || null }))
                          }
                          className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-xs text-[var(--text-title)] focus:outline-none focus:ring-1 focus:ring-[var(--silver)]/40"
                        >
                          {stages.length === 0 && (
                            <option value="">Nenhuma etapa</option>
                          )}
                          {stages.map((s) => (
                            <option key={s.id} value={s.id} style={{ background: "var(--background)" }}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Transferir para outra pipeline (ex.: SDR → Closer) */}
                  {isEditing && lead && transferablePipelines.length > 0 && (
                    <div
                      className="space-y-2 rounded-2xl p-3"
                      style={{ background: "var(--hover)", border: "1px solid var(--border)" }}
                    >
                      <Label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                        Transferir para outra pipeline
                      </Label>
                      <div className="flex items-center gap-2">
                        <select
                          value={transferPipelineId}
                          onChange={(e) => {
                            setTransferPipelineId(e.target.value);
                            setTransferNeedsNote(false);
                            setTransferNote("");
                          }}
                          className="h-9 flex-1 rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-xs text-[var(--text-title)] focus:outline-none focus:ring-1 focus:ring-[var(--silver)]/40"
                        >
                          <option value="">Selecionar pipeline...</option>
                          {transferablePipelines.map((p) => (
                            <option key={p.id} value={p.id} style={{ background: "var(--background)" }}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => void handleTransfer()}
                          disabled={!transferPipelineId || isTransferring || (transferNeedsNote && !transferNote.trim())}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all disabled:opacity-40"
                          style={{ background: "var(--hover)", color: "var(--text-title)" }}
                        >
                          {isTransferring && <Loader2 size={11} className="animate-spin" />}
                          Transferir
                        </button>
                      </div>
                      {transferNeedsNote && (
                        <Textarea
                          value={transferNote}
                          onChange={(e) => setTransferNote(e.target.value)}
                          placeholder="Observação obrigatória para a etapa de destino..."
                          rows={2}
                          className="resize-none border-[var(--border)] bg-[var(--input)] text-[var(--text-title)] placeholder:text-[var(--muted-foreground)] text-xs"
                        />
                      )}
                      <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                        O lead vai para a primeira etapa ativa da pipeline escolhida.
                      </p>
                    </div>
                  )}

                  {/* Responsável */}
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-assigned-to" className="text-[11px] font-medium text-[var(--muted-foreground)]">
                      Responsável
                    </Label>
                    <select
                      id="lead-assigned-to"
                      value={form.assigned_to ?? ""}
                      onChange={(e) => setForm((p) => ({ ...p, assigned_to: e.target.value || null }))}
                      className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-xs text-[var(--text-title)] focus:outline-none focus:ring-1 focus:ring-[var(--silver)]/40"
                    >
                      <option value="">Sem responsável</option>
                      {activeProfiles.map((p) => (
                        <option key={p.id} value={p.id} style={{ background: "var(--background)" }}>
                          {p.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="space-y-2">
                      <Label className="flex items-center gap-1.5 text-[11px] font-medium text-[var(--muted-foreground)]">
                        <TagIcon size={11} />
                        Etiquetas
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {tags.map((tag) => {
                          const selected = form.tags.includes(tag.id);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              className="rounded-full px-3 py-1 text-[11px] font-medium transition-all duration-150"
                              style={{
                                background: selected ? `${tag.color}28` : "var(--glass-bg)",
                                color: selected ? tag.color : "var(--muted-foreground)",
                                border: selected
                                  ? `1px solid ${tag.color}40`
                                  : "1px solid var(--border)",
                              }}
                            >
                              {tag.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Qualificação — IQ / IE (só em edição, lead recém-criado ainda não tem) */}
                  {isEditing && lead && (
                    <div
                      className="space-y-3 rounded-2xl p-3"
                      style={{ background: "var(--hover)", border: "1px solid var(--border)" }}
                    >
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                          Qualificação
                        </Label>
                        {lead.form_id && (
                          <button
                            type="button"
                            onClick={handleRecalculate}
                            disabled={isRecalculating}
                            className="flex items-center gap-1 text-[10px] text-[var(--muted-foreground)] transition-colors hover:text-[var(--text-title)] disabled:opacity-50"
                          >
                            <RefreshCw size={10} className={isRecalculating ? "animate-spin" : ""} />
                            Recalcular IQ
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                          <span>IQ — Inteligência de Qualificação</span>
                        </div>
                        {(recalculatedIq ?? lead.iq_score) !== null ? (
                          <ProgressBar percent={recalculatedIq ?? lead.iq_score ?? 0} />
                        ) : (
                          <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Não aplicável</p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]" style={{ color: "var(--muted-foreground)" }}>
                          <span>IE — Índice de Evolução</span>
                        </div>
                        {lead.ie_score !== null ? (
                          <ProgressBar percent={lead.ie_score} />
                        ) : (
                          <p className="text-[10px]" style={{ color: "var(--muted-foreground)" }}>Sem etapa atribuída</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notas — observações manuais (CRM e módulo Conversas) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="lead-notes" className="text-[11px] font-medium text-[var(--muted-foreground)]">
                      Notas
                    </Label>
                    <Textarea
                      id="lead-notes"
                      rows={3}
                      value={form.notes}
                      onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                      placeholder="Observações sobre o lead..."
                      className="resize-none border-[var(--border)] bg-[var(--input)] text-[var(--text-title)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-[var(--silver)]/40"
                    />
                  </div>

                  {/* Erro */}
                  {error && (
                    <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-400">
                      {error}
                    </p>
                  )}

                  {/* Separador */}
                  <div className="h-px bg-[var(--border)]" />

                  {/* Ações */}
                  <div className="flex items-center justify-between">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-all ${
                          confirmDelete
                            ? "bg-red-500/15 text-red-400 hover:bg-red-500/25"
                            : "text-[var(--muted-foreground)] hover:text-red-400"
                        }`}
                      >
                        {isDeleting ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        {confirmDelete ? "Confirmar exclusão" : "Excluir"}
                      </button>
                    ) : (
                      <span />
                    )}

                    <button
                      type="submit"
                      disabled={isSubmitting || !form.name.trim() || !form.contact.trim()}
                      className="lc-btn flex items-center gap-2 px-5 py-2 text-sm disabled:opacity-40"
                    >
                      {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                      {isEditing ? "Salvar alterações" : "Criar lead"}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;

  return createPortal(modal, document.body);
}
