"use client";

import { Plus, Trash2 } from "lucide-react";
import { useUsers } from "@/hooks/useUsers";
import { ACTION_DEFINITIONS, RECIPIENT_TYPE_LABELS, WORKFLOW_VARIABLES } from "./catalog";
import type { NotificationActionConfig } from "@/lib/workflow-engine/actions/notification-action";

export interface ActionRowValue { type: string; config: Record<string, unknown>; }

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--hover)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
};

interface ActionsEditorProps {
  actions:  ActionRowValue[];
  onChange: (actions: ActionRowValue[]) => void;
}

export function ActionsEditor({ actions, onChange }: ActionsEditorProps) {
  const { profiles } = useUsers();

  function addAction() {
    onChange([...actions, {
      type: "core.notification.create",
      config: { title: "", body: "", recipientType: "lead_owner" } satisfies NotificationActionConfig,
    }]);
  }

  function updateConfig(index: number, patch: Partial<NotificationActionConfig>) {
    onChange(actions.map((a, i) => i === index ? { ...a, config: { ...a.config, ...patch } } : a));
  }

  function removeAction(index: number) {
    onChange(actions.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-3">
      {actions.map((action, index) => {
        const config = action.config as unknown as NotificationActionConfig;
        const def = ACTION_DEFINITIONS.find(a => a.type === action.type);
        return (
          <div key={index} className="rounded-lg p-3 flex flex-col gap-2" style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold" style={{ color: "var(--text-title)" }}>{def?.label ?? action.type}</p>
              <button
                type="button"
                onClick={() => removeAction(index)}
                className="p-1 rounded hover:bg-[var(--hover)] transition-colors"
                style={{ color: "var(--muted-foreground)" }}
                aria-label="Remover ação"
              >
                <Trash2 size={13} />
              </button>
            </div>

            <input
              value={config.title ?? ""}
              onChange={e => updateConfig(index, { title: e.target.value })}
              placeholder="Título — aceita {{lead.nome}}, {{etapa.nome}}…"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={INPUT_STYLE}
            />
            <textarea
              value={config.body ?? ""}
              onChange={e => updateConfig(index, { body: e.target.value })}
              placeholder="Descrição"
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={INPUT_STYLE}
            />

            <select
              value={config.recipientType ?? "lead_owner"}
              onChange={e => updateConfig(index, { recipientType: e.target.value as NotificationActionConfig["recipientType"] })}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={INPUT_STYLE}
            >
              {Object.entries(RECIPIENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {config.recipientType === "specific_user" && (
              <select
                value={config.recipientUserId ?? ""}
                onChange={e => updateConfig(index, { recipientUserId: e.target.value || undefined })}
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={INPUT_STYLE}
              >
                <option value="">Selecione o usuário</option>
                {profiles.map(u => <option key={u.id} value={u.id}>{u.full_name}</option>)}
              </select>
            )}

            <p className="text-[10px]" style={{ color: "var(--text-placeholder)" }}>
              Variáveis: {WORKFLOW_VARIABLES.map(v => `{{${v}}}`).join(", ")}
            </p>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addAction}
        className="flex items-center gap-1.5 self-start px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--hover)]"
        style={{ color: "var(--muted-foreground)", border: "1px dashed var(--border)" }}
      >
        <Plus size={12} />
        Adicionar ação
      </button>
    </div>
  );
}
