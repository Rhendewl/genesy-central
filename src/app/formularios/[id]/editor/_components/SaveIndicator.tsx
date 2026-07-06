"use client";

import { Loader2, Check, Save } from "lucide-react";

interface SaveIndicatorProps {
  isDirty: boolean;
  isSaving: boolean;
  onSave?: () => void;
}

export function SaveIndicator({ isDirty, isSaving, onSave }: SaveIndicatorProps) {
  if (isSaving) {
    return (
      <div
        className="flex items-center gap-1.5 text-xs"
        style={{ color: "var(--muted-foreground)" }}
        aria-live="polite"
        aria-label="Salvando..."
      >
        <Loader2 size={12} className="animate-spin" aria-hidden="true" />
        Salvando...
      </div>
    );
  }

  if (isDirty) {
    return (
      <button
        onClick={onSave}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:opacity-90 active:scale-95"
        style={{ background: "#b0b8c1", color: "#000000" }}
        aria-label="Salvar alterações (Ctrl+S)"
        title="Salvar (Ctrl+S)"
      >
        <Save size={11} aria-hidden="true" />
        Salvar
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-1.5 text-xs"
      style={{ color: "var(--muted-foreground)" }}
      aria-label="Todas as alterações salvas"
    >
      <Check size={12} aria-hidden="true" />
      Salvo
    </div>
  );
}
