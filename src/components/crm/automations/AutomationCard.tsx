"use client";

import { useState } from "react";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import type { AutomationWithDetails } from "@/lib/workflow-engine/workflow-service";
import { getTriggerDef, getDelayDef } from "./catalog";

interface AutomationCardProps {
  automation: AutomationWithDetails;
  onEdit:     (a: AutomationWithDetails) => void;
  onToggle:   (id: string, status: "ativa" | "pausada") => Promise<boolean>;
  onDelete:   (id: string) => Promise<boolean>;
}

export function AutomationCard({ automation, onEdit, onToggle, onDelete }: AutomationCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const triggerDef = getTriggerDef(automation.triggerType);
  const delayDef   = getDelayDef(automation.delayType);
  const isActive   = automation.status === "ativa";

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete(automation.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="rounded-xl overflow-hidden px-4 py-3.5 flex items-center gap-3"
      style={{ border: "1px solid var(--border)", background: "var(--card)", opacity: isActive ? 1 : 0.6 }}
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--text-title)" }}>{automation.name}</p>
        <p className="text-[11px] mt-0.5 truncate" style={{ color: "var(--muted-foreground)" }}>
          {triggerDef?.label ?? automation.triggerType} · {delayDef?.label ?? automation.delayType}
          {automation.conditions.length > 0 && ` · ${automation.conditions.length} condição${automation.conditions.length !== 1 ? "ões" : ""}`}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={isActive}
        onClick={() => onToggle(automation.id, isActive ? "pausada" : "ativa")}
        className="relative flex-shrink-0 w-9 h-5 rounded-full transition-colors"
        style={{ background: isActive ? "var(--primary)" : "var(--border-card-hover)" }}
        title={isActive ? "Pausar automação" : "Ativar automação"}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
          style={{ transform: isActive ? "translateX(16px)" : "translateX(0)" }}
        />
      </button>

      <div className="flex items-center gap-1 flex-shrink-0">
        {deleting ? (
          <Loader2 size={13} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
        ) : confirmDelete ? (
          <>
            <button
              type="button" onClick={() => setConfirmDelete(false)}
              className="px-2 py-1 rounded-lg text-[11px] font-medium hover:bg-[var(--hover)] transition-colors"
              style={{ color: "var(--muted-foreground)" }}
            >
              Cancelar
            </button>
            <button
              type="button" onClick={handleDelete}
              className="px-2 py-1 rounded-lg text-[11px] font-medium transition-colors"
              style={{ background: "#ef4444", color: "#fff" }}
            >
              Excluir
            </button>
          </>
        ) : (
          <>
            <button
              type="button" onClick={() => onEdit(automation)}
              className="p-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors"
              style={{ color: "var(--muted-foreground)" }}
              title="Editar automação"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button" onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg hover:bg-[var(--hover)] transition-colors"
              style={{ color: "var(--muted-foreground)" }}
              title="Excluir automação"
            >
              <Trash2 size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
