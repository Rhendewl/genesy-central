"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { CrmPipeline, NewCrmPipeline } from "@/types/crm";

// ── Color palette ──────────────────────────────────────────────────────────────

const COLORS = [
  "#6366f1", "#4a8fd4", "#22c55e", "#10b981",
  "#f59e0b", "#ef4444", "#ec4899", "#8b5cf6",
  "#06b6d4", "#f97316", "#7d99ad", "#a855f7",
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:     boolean;
  pipeline: CrmPipeline | null;   // null = create mode
  onClose:  () => void;
  onSave:   (data: NewCrmPipeline) => Promise<boolean>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function PipelineFormModal({ open, pipeline, onClose, onSave }: Props) {
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [color,       setColor]       = useState(COLORS[0]);
  const [saving,      setSaving]      = useState(false);

  // Sync fields when opening
  useEffect(() => {
    if (!open) return;
    setName(pipeline?.name ?? "");
    setDescription(pipeline?.description ?? "");
    setColor(pipeline?.color ?? COLORS[0]);
  }, [open, pipeline]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const ok = await onSave({ name: name.trim(), description: description.trim() || null, color });
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <div
      className="lc-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.60)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="lc-modal-panel w-full max-w-md rounded-2xl flex flex-col gap-0 overflow-hidden"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            {pipeline ? "Editar Pipeline" : "Novo Pipeline"}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--hover)] transition-colors"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 px-5 py-5">
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
          <div className="flex justify-end gap-2 pt-1">
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
    </div>
  );
}
