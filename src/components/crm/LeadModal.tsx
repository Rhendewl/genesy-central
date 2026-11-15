"use client";

import "./lead-collaboration.css";
import { splitIntegrationNotes } from "@/lib/crm/integration-attribution";
import { LeadNotesPanel } from "./LeadNotesPanel";
import { LeadRemindersPanel } from "./LeadRemindersPanel";
import { LeadStageMover } from "@/components/crm/LeadStageMover";
import { LeadStageTimeline } from "./LeadStageTimeline";
import { formatArrival } from "@/lib/crm/operation-analytics";
import { LeadContactActions } from "@/components/crm/LeadContactActions";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLeadAutosave } from "@/hooks/useLeadAutosave";
import { useModalOpen } from "@/hooks/useModalOpen";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, Trash2, RefreshCw, Check, CloudOff, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { ProgressBar } from "@/components/workspace/ProgressBar";
import { TagSelector } from "@/components/tags/TagSelector";
import { LeadOriginSelector } from "@/components/crm/LeadOriginSelector";
import { useLeadOrigins } from "@/hooks/useLeadOrigins";
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
// Edição: movimentação rápida usa o mesmo serviço de movimentação do Kanban.
// ─────────────────────────────────────────────────────────────────────────────

interface LeadModalProps {
  isOpen: boolean;
  lead: Lead | null;
  stages: CrmStage[];   // active stages of the currently selected pipeline
  pipelines: CrmPipelineWithStages[]; // todas as pipelines — usado só pra "Transferir para outra pipeline"
  onClose: () => void;
  onCreate: (data: NewLead) => Promise<{ error: string | null }>;
  onUpdate: (id: string, data: UpdateLead) => Promise<{ error: string | null }>;
  onMove: (id: string, stageId: string, note?: string) => Promise<{ ok: boolean; requireNote: boolean; error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
  onTransfer: (leadId: string, targetStageId: string, note?: string, assigneeId?: string | null) => Promise<{ ok: boolean; requireNote: boolean; alreadyExists: boolean; error: string | null }>;
}

const TODAY = format(new Date(), "yyyy-MM-dd");

function emptyForm() {
  return {
    name:        "",
    contact:     "",
    stage_id:    null as string | null,
    assigned_to: null as string | null,
    origin_id:    null as string | null,
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
  onTransfer,
}: LeadModalProps) {
  const { profiles } = useUsers();
  const { origins } = useLeadOrigins();
  const activeProfiles = profiles.filter((p) => p.auth_user_id && p.is_active);
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm]             = useState(emptyForm());
  const [autosaveSession, setAutosaveSession] = useState<string | null>(null);
  const initialDraft = useRef<UpdateLead>({});
  const [originTouched, setOriginTouched] = useState(false);
  const [hasNoteDraft,setHasNoteDraft] = useState(false);
  const [noteSending,setNoteSending] = useState(false);
  const [reminderOpen,setReminderOpen] = useState(false);
  const [mobilePane,setMobilePane] = useState<"data"|"notes">("data");
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
  const [transferAssigneeId, setTransferAssigneeId] = useState("");
  const [transferNote,       setTransferNote]       = useState("");
  const [transferNeedsNote,  setTransferNeedsNote]  = useState(false);
  const [isTransferring,     setIsTransferring]     = useState(false);
  const [mounted, setMounted] = useState(false);

  useModalOpen(isOpen);
  const integrationData = splitIntegrationNotes(lead?.integration_notes);
  const isEditing = lead !== null;

  useEffect(() => {
    setMounted(true);
  }, []);

  // ── Preenche formulário ao abrir ───────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) { setAutosaveSession(null); return; }
    if (isOpen) {
      setError(null);
      setConfirmDelete(false);
      setOriginTouched(false);
      setHasNoteDraft(false); setNoteSending(false); setReminderOpen(false); setMobilePane("data");
      setRecalculatedIq(undefined);
      setTransferPipelineId("");
      setTransferAssigneeId("");
      setTransferNote("");
      setTransferNeedsNote(false);
      if (lead) {
        setForm({
          name:        lead.name,
          contact:     lead.contact,
          stage_id:    lead.stage_id ?? null,
          assigned_to: lead.assigned_to ?? null,
          origin_id:    lead.origin_id ?? origins.find(origin => origin.slug === lead.source)?.id ?? null,
          tags:        lead.tags as string[],
          notes:       lead.notes ?? "",
          entered_at:  lead.entered_at,
        });
        initialDraft.current = {
          name: lead.name.trim(), contact: lead.contact.trim(), tags: lead.tags,
          notes: lead.notes?.trim() || null, deal_value: lead.deal_value ?? 0,
          entered_at: lead.entered_at, assigned_to: lead.assigned_to ?? null,
          origin_id: lead.origin_id ?? null,
          source: lead.source,
        };
        setDealValue(lead.deal_value ?? 0);
        setAutosaveSession(lead.id);
      } else {
        // Usa a primeira stage ativa como padrão ao criar
        setForm({ ...emptyForm(), stage_id: stages[0]?.id ?? null });
        setDealValue(0);
      }
      setTimeout(() => firstInputRef.current?.focus(), 180);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, lead?.id]);

  useEffect(() => {
    if (!isOpen || form.origin_id || origins.length === 0) return;
    const fallback = lead
      ? origins.find(origin => origin.slug === lead.source)
      : origins.find(origin => origin.is_default) ?? origins.find(origin => origin.slug === "manual");
    if (fallback) setForm(current => ({ ...current, origin_id: fallback.id }));
  }, [form.origin_id, isOpen, lead, origins]);

  const draft = useMemo<UpdateLead>(() => ({
    name: form.name.trim(), contact: form.contact.trim(), tags: form.tags,
    notes: form.notes.trim() || null, deal_value: dealValue,
    entered_at: form.entered_at, assigned_to: form.assigned_to, origin_id: originTouched ? form.origin_id : lead?.origin_id ?? null,
    source: originTouched ? origins.find(origin => origin.id === form.origin_id)?.slug ?? lead?.source : lead?.source,
  }), [form, dealValue, origins, lead?.source, lead?.origin_id, originTouched]);
  const autosave = useLeadAutosave(isOpen && lead && autosaveSession === lead.id ? lead.id : null,
    initialDraft.current, draft, Boolean(form.name.trim() && form.contact.trim() && form.entered_at && Number.isFinite(dealValue) && dealValue >= 0), onUpdate);
  const flushDraft = async () => {
    const saved = await autosave.flush();
    if (!saved) setError("Suas alterações ainda não foram salvas. Confira os campos e tente novamente antes de fechar.");
    else setError(null);
    return saved;
  };
  const closeWithSave = async () => {
    if(reminderOpen||noteSending)return;
    if(hasNoteDraft&&!window.confirm("Há uma nota ainda não enviada. Fechar e descartar esse rascunho?"))return;
    if(!isEditing||await flushDraft())onClose();
  };
  const closeRef = useRef(closeWithSave);
  closeRef.current = closeWithSave;
  useEffect(() => {
    function handleKey(event: KeyboardEvent) { if (event.key === "Escape") { event.preventDefault(); void closeRef.current(); } }
    if (isOpen) window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen]);

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
  const transferProfiles = useMemo(
    () => activeProfiles.filter((profile) => profile.crm_pipeline_id === transferPipelineId || profile.id === pipelines.find(pipeline => pipeline.id === transferPipelineId)?.default_assignee_id),
    [activeProfiles, transferPipelineId, pipelines],
  );

  // ── Transferir para outra pipeline ──────────────────────────────────────────
  // Cria um novo card operacional na primeira etapa ativa do destino. O card
  // atual permanece nesta pipeline e ambos compartilham a identidade canônica.
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

    if (!await flushDraft()) return;
    setIsTransferring(true);
    const result = await onTransfer(
      lead.id,
      firstStage.id,
      transferNote.trim() || undefined,
      transferAssigneeId || null,
    );
    setIsTransferring(false);

    if (!result.ok) {
      toast.error(result.error ?? "Erro ao transferir lead");
      return;
    }

    toast.success(result.alreadyExists
      ? `Este lead já está em "${targetPipeline.name}"`
      : `Cópia do lead criada em "${targetPipeline.name}"`);
    onClose();
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.contact.trim()) return;

    setError(null);
    setIsSubmitting(true);

    if (isEditing) {
      const saved = await flushDraft();
      setIsSubmitting(false);
      if (!saved) return;
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
        origin_id:     form.origin_id,
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
    if (!await flushDraft()) return;
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
            className="lc-modal-backdrop fixed inset-0 z-40"
            style={{
              background: "var(--dock-bg)",
              backdropFilter: "blur(12px) saturate(140%)",
              WebkitBackdropFilter: "blur(12px) saturate(140%)",
            }}
            onClick={() => void closeWithSave()}
          />

          {/* ── Centering wrapper ── */}
          <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none ${!isEditing ? "crm-lead-create-position" : ""}`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.93, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
              className={`pointer-events-auto w-full rounded-3xl ${isEditing ? "lead-collaboration-modal" : "max-w-md"}`}
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
              <div className={isEditing ? "lead-collaboration-shell" : "crm-lead-create-scroll max-h-[90dvh] overflow-y-auto overscroll-contain rounded-3xl p-6"}>

                {/* Header */}
                <div className={isEditing ? "lead-collaboration-header" : "sticky -top-6 z-10 -mx-6 -mt-6 mb-5 flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4"} style={{ background: "var(--bg-modal)" }}>
                  <div>
                    <h2 className="text-[15px] font-semibold text-[var(--text-title)]">
                      {isEditing ? form.name || "Editar lead" : "Novo lead"}
                    </h2>
                    <p className="mt-0.5 text-[11px] text-[var(--muted-foreground)]">
                      {isEditing ? ({saved:"Todas as alterações salvas",pending:"Aguardando salvamento…",saving:"Salvando…",invalid:"Confira os campos para salvar",error:"Alterações não salvas · tente novamente"})[autosave.status] : "Preencha os dados do lead"}
                    </p>
                  </div>
                  <button
                    onClick={() => void closeWithSave()}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--text-title)]"
                    aria-label="Fechar"
                  >
                    <X size={16} />
                  </button>
                </div>

                {isEditing && <nav className="lead-collab-mobile-tabs" aria-label="Áreas do card do lead"><button type="button" aria-pressed={mobilePane==="data"} onClick={()=>setMobilePane("data")}>Dados e lembretes</button><button type="button" aria-pressed={mobilePane==="notes"} onClick={()=>setMobilePane("notes")}>Notas {hasNoteDraft&&"· rascunho"}</button></nav>}
                <div className={isEditing ? "lead-collaboration-columns" : ""} data-mobile-pane={mobilePane}>
                  <div className={isEditing ? "lead-collab-data-column" : ""}>
                  {isEditing && (
                  <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] px-3 py-2 text-xs" role="status" aria-live="polite">
                    {autosave.status === "saving" ? <Loader2 size={13} className="animate-spin" /> : autosave.status === "error" ? <CloudOff size={13} className="text-amber-400" /> : <Check size={13} className={autosave.status === "saved" ? "text-emerald-400" : "text-[var(--muted-foreground)]"} />}
                    <span>{({ saved: "Todas as alterações salvas", pending: "Alterações aguardando salvamento…", saving: "Salvando alterações…", invalid: "Preencha nome, contato e data válidos para salvar", error: "Não foi possível salvar. Suas alterações estão neste card." })[autosave.status]}</span>
                    {autosave.status === "error" && <button type="button" onClick={() => void flushDraft()} className="underline">Tentar novamente</button>}
                  </div>
                )}

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
                    <LeadContactActions contact={form.contact} />
                  </div>

                  {isEditing && lead && <div className="space-y-2"><p className="text-xs text-[var(--muted-foreground)]">Chegada registrada: <span className="text-[var(--text-title)]">{formatArrival(lead)}</span></p><LeadStageTimeline lead={lead} /></div>}

                  {/* Dados de Formulário/Agendamento — preenchido automaticamente pelas
                      integrações (resposta de formulário, agendamento de calendário).
                      Somente leitura: quem escreve aqui são essas rotas, não o usuário. */}
                  {integrationData.answers && (
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                        Dados de Formulário/Agendamento
                      </Label>
                      <div className="max-h-40 overflow-y-auto whitespace-pre-line rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-2 text-xs text-[var(--muted-foreground)]">
                        {integrationData.answers}
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
                          title="Use Mover lead abaixo para alterar a etapa"
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

                  {isEditing && lead && <LeadStageMover key={`stage-mover-${lead.id}`} currentStageId={lead.stage_id ?? null} stages={[...(pipelines.find((pipeline) => pipeline.id === lead.pipeline_id)?.crm_stages ?? stages)].filter((stage) => stage.is_active).sort((a, b) => a.order_index - b.order_index)} onMove={(stageId, note) => onMove(lead.id, stageId, note)} />}
                  {isEditing && lead && <LeadRemindersPanel key={`reminders-${lead.id}`} leadId={lead.id} leadName={form.name || lead.name} onDialogChange={setReminderOpen}/>}

                  {!isEditing && <div className="space-y-1.5"><Label htmlFor="lead-notes">Nota inicial</Label><Textarea id="lead-notes" rows={3} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Contexto inicial sobre o lead"/></div>}

                  <TagSelector
                    key={lead?.pipeline_id ?? stages.find(stage => stage.id === form.stage_id)?.pipeline_id ?? "no-pipeline"}
                    scope="crm"
                    pipelineId={lead?.pipeline_id ?? stages.find(stage => stage.id === form.stage_id)?.pipeline_id}
                    value={form.tags}
                    onChange={(tags) => setForm((current) => ({ ...current, tags }))}
                    helperText={process.env.NEXT_PUBLIC_CRM_PIPELINE_TAGS_ENABLED === "true" ? "As etiquetas pertencem somente a esta pipeline." : "As etiquetas são compartilhadas com o Marketing e o Workspace."}
                  />

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
                      <option value="">{!isEditing && pipelines.find(pipeline => pipeline.id === stages.find(stage => stage.id === form.stage_id)?.pipeline_id)?.default_assignee_id ? `Padrão da pipeline · ${activeProfiles.find(profile => profile.id === pipelines.find(pipeline => pipeline.id === stages.find(stage => stage.id === form.stage_id)?.pipeline_id)?.default_assignee_id)?.full_name ?? "Responsável configurado"}` : "Sem responsável"}</option>
                      {activeProfiles.map((p) => (
                        <option key={p.id} value={p.id} style={{ background: "var(--background)" }}>
                          {p.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[11px] font-medium text-[var(--muted-foreground)]">Origem</Label>
                    <LeadOriginSelector value={form.origin_id} onChange={(originId) => { setOriginTouched(true); setForm(current => ({ ...current, origin_id: originId })); }} />
                  </div>

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

                  {/* Criar representação em outra pipeline (ex.: SDR → Closer) */}
                  {isEditing && lead && transferablePipelines.length > 0 && (
                    <div
                      className="space-y-2 rounded-2xl p-3"
                      style={{ background: "var(--hover)", border: "1px solid var(--border)" }}
                    >
                      <Label className="text-[11px] font-medium text-[var(--muted-foreground)]">
                        Criar cópia em outra pipeline
                      </Label>
                      <div className="flex items-center gap-2">
                        <select
                          value={transferPipelineId}
                          onChange={(e) => {
                            const nextPipelineId = e.target.value;
                            setTransferPipelineId(nextPipelineId);
                            const candidates = activeProfiles.filter((profile) => profile.crm_pipeline_id === nextPipelineId);
                            setTransferAssigneeId(pipelines.find(pipeline => pipeline.id === nextPipelineId)?.default_assignee_id ?? candidates[0]?.id ?? "");
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
                          Criar cópia
                        </button>
                      </div>
                      {transferPipelineId && (
                        <select
                          value={transferAssigneeId}
                          onChange={(event) => setTransferAssigneeId(event.target.value)}
                          className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-xs text-[var(--text-title)] focus:outline-none focus:ring-1 focus:ring-[var(--silver)]/40"
                          aria-label="Responsável pelo lead na pipeline de destino"
                        >
                          <option value="">Definir automaticamente</option>
                          {transferProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id} style={{ background: "var(--background)" }}>
                              {profile.full_name}
                            </option>
                          ))}
                        </select>
                      )}
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
                        O card atual permanece aqui. Uma cópia operacional vai para a primeira etapa ativa do destino, sem duplicar o lead nas métricas.
                      </p>
                    </div>
                  )}

                  {isEditing && <details className="group rounded-xl border border-[var(--border)] bg-[var(--input)] px-3 py-3">
                    <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium text-[var(--text-title)] [&::-webkit-details-marker]:hidden"><span>UTMs rastreadas{integrationData.attribution.length ? ` (${integrationData.attribution.length})` : ""}</span><ChevronDown size={16} className="transition-transform group-open:rotate-180" /></summary>
                    {integrationData.attribution.length ? <dl className="mt-3 space-y-3">{integrationData.attribution.map((item,i)=><div key={`${item.key}-${i}`}><dt className="text-[10px] text-[var(--muted-foreground)]">{item.key}</dt><dd className="mt-1 break-words text-xs text-[var(--text-title)]">{item.value}</dd></div>)}</dl> : <p className="mt-3 text-xs text-[var(--muted-foreground)]">Nenhuma UTM registrada para este lead.</p>}
                  </details>}
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
                      {isEditing ? "Concluir" : "Criar lead"}
                    </button>
                  </div>
                </form>
                  </div>
                  {isEditing && lead && <div className="lead-collab-notes-column"><LeadNotesPanel key={lead.id} leadId={lead.id} legacyNotes={form.notes} onLegacyChange={notes=>setForm(p=>({...p,notes}))} onDraftChange={setHasNoteDraft} onSendingChange={setNoteSending}/></div>}
                </div>
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
