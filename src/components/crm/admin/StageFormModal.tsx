"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { CrmStage, UpdateCrmStage } from "@/types/crm";

// ── Color palette ──────────────────────────────────────────────────────────────

const COLORS = [
  "#6366f1", "#4a8fd4", "#22c55e", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6",
  "#06b6d4", "#f97316", "#7d99ad", "#a855f7",
];

// ── Toggle row ────────────────────────────────────────────────────────────────

function ToggleRow({
  label, description, checked, onChange,
}: {
  label:       string;
  description: string;
  checked:     boolean;
  onChange:    (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div>
        <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>{label}</p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors"
        style={{ background: checked ? "var(--primary)" : "rgba(255,255,255,0.12)" }}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: checked ? "translateX(16px)" : "translateX(0)" }}
        />
      </button>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:  boolean;
  stage: CrmStage | null;   // null = create mode
  onClose: () => void;
  onSave:  (data: UpdateCrmStage & { name: string }) => Promise<boolean>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function StageFormModal({ open, stage, onClose, onSave }: Props) {
  const [name,               setName]               = useState("");
  const [description,        setDescription]        = useState("");
  const [color,              setColor]              = useState(COLORS[0]);
  const [isActive,           setIsActive]           = useState(true);
  const [requireNote,        setRequireNote]        = useState(false);
  const [requireAttachment,  setRequireAttachment]  = useState(false);
  const [allowFreeMove,      setAllowFreeMove]      = useState(true);
  const [allowEdit,          setAllowEdit]          = useState(true);
  const [saving,             setSaving]             = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(stage?.name ?? "");
    setDescription(stage?.description ?? "");
    setColor(stage?.color ?? COLORS[0]);
    setIsActive(stage?.is_active ?? true);
    setRequireNote(stage?.require_note ?? false);
    setRequireAttachment(stage?.require_attachment ?? false);
    setAllowFreeMove(stage?.allow_free_move ?? true);
    setAllowEdit(stage?.allow_edit ?? true);
  }, [open, stage]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const ok = await onSave({
        name:               name.trim(),
        description:        description.trim() || null,
        color,
        is_active:          isActive,
        require_note:       requireNote,
        require_attachment: requireAttachment,
        allow_free_move:    allowFreeMove,
        allow_edit:         allowEdit,
      });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.60)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden max-h-[90vh]"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            {stage ? "Editar Etapa" : "Nova Etapa"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-5">
            {/* Name */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>
                Nome <span style={{ color: "var(--primary)" }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ex: Em Negociação"
                maxLength={80}
                required
                autoFocus
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  color: "var(--text-title)",
                }}
              />
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>
                Descrição
              </label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Descrição opcional…"
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid var(--border)",
                  color: "var(--text-title)",
                }}
              />
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

            {/* Settings */}
            <div>
              <p className="text-xs font-semibold mb-1" style={{ color: "var(--muted-foreground)" }}>
                CONFIGURAÇÕES
              </p>
              <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <div className="px-4">
                  <ToggleRow
                    label="Etapa ativa"
                    description="Etapas inativas ficam ocultas no kanban"
                    checked={isActive}
                    onChange={setIsActive}
                  />
                  <ToggleRow
                    label="Exige observação"
                    description="Lead só pode entrar nesta etapa com uma nota"
                    checked={requireNote}
                    onChange={setRequireNote}
                  />
                  <ToggleRow
                    label="Exige anexo"
                    description="Lead só pode entrar nesta etapa com um arquivo"
                    checked={requireAttachment}
                    onChange={setRequireAttachment}
                  />
                  <ToggleRow
                    label="Mover livremente"
                    description="Permite mover leads para qualquer etapa"
                    checked={allowFreeMove}
                    onChange={setAllowFreeMove}
                  />
                  <div className="flex items-start justify-between gap-4 py-3">
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--text-title)" }}>Permite edição</p>
                      <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>Leads nesta etapa podem ser editados</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={allowEdit}
                      onClick={() => setAllowEdit(v => !v)}
                      className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors"
                      style={{ background: allowEdit ? "var(--primary)" : "rgba(255,255,255,0.12)" }}
                    >
                      <span
                        className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                        style={{ transform: allowEdit ? "translateX(16px)" : "translateX(0)" }}
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div
            className="flex justify-end gap-2 px-5 py-4 flex-shrink-0"
            style={{ borderTop: "1px solid var(--border)" }}
          >
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
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              {saving && <Loader2 size={11} className="animate-spin" />}
              {saving ? "Salvando…" : stage ? "Salvar" : "Criar Etapa"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
