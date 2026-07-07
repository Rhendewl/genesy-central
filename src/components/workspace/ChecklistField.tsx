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
}

export function ChecklistField({ items, onAdd, onToggle, onDelete, placeholder = "Adicionar item..." }: ChecklistFieldProps) {
  const [newLabel, setNewLabel] = useState("");

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
            className="flex flex-shrink-0 items-center justify-center rounded-full border transition-colors"
            style={{
              width:       "18px",
              height:      "18px",
              borderColor: item.is_completed ? "var(--primary)" : "var(--border)",
              background:  item.is_completed ? "var(--primary)" : "transparent",
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
          <button
            onClick={() => onDelete(item.id)}
            className="opacity-0 transition-opacity group-hover:opacity-100"
            style={{ color: "var(--muted-foreground)" }}
          >
            <X size={13} />
          </button>
        </div>
      ))}

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
    </div>
  );
}
