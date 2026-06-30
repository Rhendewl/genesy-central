"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useModalOpen } from "@/hooks/useModalOpen";
import { AnimatePresence, motion } from "framer-motion";
import { X, Loader2, Trash2, Tag as TagIcon } from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MoneyInput } from "@/components/ui/MoneyInput";
import { useTags } from "@/hooks/useTags";
import type { KanbanColumn, Lead, NewLead, UpdateLead } from "@/types";
import { KANBAN_COLUMNS } from "@/types";
import type { CrmStage } from "@/types/crm";

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
  onClose: () => void;
  onCreate: (data: NewLead) => Promise<{ error: string | null }>;
  onUpdate: (id: string, data: UpdateLead) => Promise<{ error: string | null }>;
  onDelete: (id: string) => Promise<{ error: string | null }>;
}

const TODAY = format(new Date(), "yyyy-MM-dd");

function emptyForm() {
  return {
    name:       "",
    contact:    "",
    stage_id:   null as string | null,
    tags:       [] as string[],
    notes:      "",
    entered_at: TODAY,
  };
}

export function LeadModal({
  isOpen,
  lead,
  stages,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}: LeadModalProps) {
  const { tags } = useTags();
  const firstInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm]             = useState(emptyForm());
  const [dealValue, setDealValue]   = useState(0);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [isDeleting, setIsDeleting]       = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  useModalOpen(isOpen);
  const isEditing = lead !== null;

  // ── Preenche formulário ao abrir ───────────────────────────────────────────

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setConfirmDelete(false);
      if (lead) {
        setForm({
          name:       lead.name,
          contact:    lead.contact,
          stage_id:   lead.stage_id ?? null,
          tags:       lead.tags as string[],
          notes:      lead.notes ?? "",
          entered_at: lead.entered_at,
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
        name:       form.name.trim(),
        contact:    form.contact.trim(),
        tags:       form.tags,
        notes:      form.notes.trim() || null,
        deal_value: dealValue,
        entered_at: form.entered_at,
      };
      const result = await onUpdate(lead.id, updatePayload);
      setIsSubmitting(false);
      if (result.error) { setError(friendlyError(result.error)); return; }
    } else {
      // Criação: inclui stage_id + pipeline_id + kanban_column (compat legado)
      const selectedStage = stages.find((s) => s.id === form.stage_id);
      const kanban_column = (selectedStage?.legacy_column as KanbanColumn | null) ?? "novo_lead";

      const createPayload: NewLead = {
        name:          form.name.trim(),
        contact:       form.contact.trim(),
        kanban_column,
        stage_id:      form.stage_id,
        pipeline_id:   selectedStage?.pipeline_id ?? null,
        tags:          form.tags,
        notes:         form.notes.trim() || null,
        deal_value:    dealValue,
        entered_at:    form.entered_at,
      };
      const result = await onCreate(createPayload);
      setIsSubmitting(false);
      if (result.error) { setError(friendlyError(result.error)); return; }
    }

    onClose();
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

  return (
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
              background: "rgba(0, 0, 0, 0.03)",
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
                background: "rgba(8, 8, 12, 0.92)",
                backdropFilter: "blur(24px) saturate(160%)",
                WebkitBackdropFilter: "blur(24px) saturate(160%)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 24px 64px rgba(0,0,0,0.6), 0 1px 0 rgba(255,255,255,0.06) inset",
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
                      className="border-[var(--border)] bg-[var(--input)] text-[var(--text-title)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-[#b4b4b4]/40"
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
                      className="border-[var(--border)] bg-[var(--input)] text-[var(--text-title)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-[#b4b4b4]/40"
                    />
                  </div>

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
                        className="border-[var(--border)] bg-[var(--input)] text-[var(--text-title)] focus-visible:ring-[#b4b4b4]/40"
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
                          className="h-9 w-full rounded-md border border-[var(--border)] bg-[var(--input)] px-3 text-xs text-[var(--text-title)] focus:outline-none focus:ring-1 focus:ring-[#b4b4b4]/40"
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

                  {/* Notas */}
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
                      className="resize-none border-[var(--border)] bg-[var(--input)] text-[var(--text-title)] placeholder:text-[var(--muted-foreground)] focus-visible:ring-[#b4b4b4]/40"
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
}
