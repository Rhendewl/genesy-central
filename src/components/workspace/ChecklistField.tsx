"use client";

import { useState } from "react";
import { Check, Plus, X } from "lucide-react";

// Compartilhado entre TaskDetailPanel (checklist da tarefa) e ObjectiveDetailPanel
// (etapas do objetivo) — mesma forma estrutural em ambos os domínios.
export interface ChecklistItemLike {
  id:           string;
  label:        string;
  is_completed: boolean;
}

interface ChecklistFieldProps {
  items:       ChecklistItemLike[];
  onAdd:       (label: string) => void;
  onToggle:    (itemId: string, isCompleted: boolean) => void;
  onDelete:    (itemId: string) => void;
  placeholder?: string;
  readOnly?:    boolean;
  canToggle?:   boolean;
  canManage?:   boolean;
}

export function ChecklistField({
  items, onAdd, onToggle, onDelete, placeholder = "Adicionar item...",
  readOnly = false, canToggle, canManage,
}: ChecklistFieldProps) {
  const [newLabel, setNewLabel] = useState("");
  const mayToggle = canToggle ?? !readOnly;
  const mayManage = canManage ?? !readOnly;

  function submit() {
    const label = newLabel.trim();
    if (!label) return;
    onAdd(label);
    setNewLabel("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      {items.map((item) => (
        <div key={item.id} className="group flex items-center gap-2 rounded-lg px-1 py-1 hover:bg-[var(--hover)]">
          <button
            onClick={() => onToggle(item.id, !item.is_completed)}
            disabled={!mayToggle}
            className="flex flex-shrink-0 items-center justify-center rounded-full border transition-colors"
            style={{
              width:       "18px",
              height:      "18px",
              borderColor: item.is_completed ? "var(--primary)" : "color-mix(in srgb, var(--text-title) 48%, transparent)",
              background:  item.is_completed ? "var(--primary)" : "color-mix(in srgb, var(--text-title) 9%, transparent)",
              boxShadow:   item.is_completed ? "0 0 0 2px color-mix(in srgb, var(--primary) 18%, transparent)" : "inset 0 0 0 1px color-mix(in srgb, var(--text-title) 8%, transparent)",
            }}
          >
            {item.is_completed && <Check size={10} color="#fff" strokeWidth={3} />}
          </button>
          <span
            className="flex-1 text-sm"
            style={{
              color:          item.is_completed ? "var(--muted-foreground)" : "var(--text-title)",
              textDecoration: item.is_completed ? "line-through" : "none",
            }}
          >
            {item.label}
          </span>
          {mayManage && (
            <button
              onClick={() => onDelete(item.id)}
              className="opacity-0 transition-opacity group-hover:opacity-100"
              style={{ color: "var(--muted-foreground)" }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      ))}

      {mayManage && (
        <div className="mt-1 flex items-center gap-2">
          <Plus size={14} style={{ color: "var(--muted-foreground)" }} />
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted-foreground)]"
            style={{ color: "var(--text-title)" }}
          />
        </div>
      )}
    </div>
  );
}
