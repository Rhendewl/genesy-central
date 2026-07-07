"use client";

import { Plus, Trash2 } from "lucide-react";
import { CONDITION_DEFINITIONS } from "./catalog";

export interface ConditionRowValue { type: string; config: Record<string, unknown>; }

interface ConditionsEditorProps {
  conditions: ConditionRowValue[];
  onChange:   (conditions: ConditionRowValue[]) => void;
}

export function ConditionsEditor({ conditions, onChange }: ConditionsEditorProps) {
  const availableTypes = CONDITION_DEFINITIONS.filter(c => !conditions.some(cond => cond.type === c.type));

  function addCondition() {
    if (availableTypes.length === 0) return;
    onChange([...conditions, { type: availableTypes[0].type, config: {} }]);
  }

  function updateType(index: number, type: string) {
    onChange(conditions.map((c, i) => i === index ? { type, config: {} } : c));
  }

  function removeCondition(index: number) {
    onChange(conditions.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-2">
      {conditions.map((condition, index) => (
        <div key={index} className="flex items-center gap-2">
          <select
            value={condition.type}
            onChange={e => updateType(index, e.target.value)}
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ background: "var(--hover)", border: "1px solid var(--border)", color: "var(--text-title)" }}
          >
            <option value={condition.type}>
              {CONDITION_DEFINITIONS.find(c => c.type === condition.type)?.label ?? condition.type}
            </option>
            {availableTypes.map(c => <option key={c.type} value={c.type}>{c.label}</option>)}
          </select>
          <button
            type="button"
            onClick={() => removeCondition(index)}
            className="flex-shrink-0 p-2 rounded-lg transition-colors hover:bg-[var(--hover)]"
            style={{ color: "var(--muted-foreground)" }}
            aria-label="Remover condição"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      {availableTypes.length > 0 && (
        <button
          type="button"
          onClick={addCondition}
          className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--hover)]"
          style={{ color: "var(--muted-foreground)", border: "1px dashed var(--border)" }}
        >
          <Plus size={12} />
          Adicionar condição
        </button>
      )}
    </div>
  );
}
