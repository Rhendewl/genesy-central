"use client";

import { useEffect, useState } from "react";
import { X, Loader2 } from "lucide-react";
import type { CrmPipelineWithStages } from "@/types/crm";
import type { AutomationWithDetails, CreateAutomationInput } from "@/lib/workflow-engine/workflow-service";
import type { DelayType } from "@/lib/workflow-engine/types";
import { TRIGGER_DEFINITIONS, DELAY_DEFINITIONS } from "./catalog";
import { TriggerConfigFields } from "./TriggerConfigFields";
import { DelayConfigFields } from "./DelayConfigFields";
import { ConditionsEditor, type ConditionRowValue } from "./ConditionsEditor";
import { ActionsEditor, type ActionRowValue } from "./ActionsEditor";
import { AutomationSelect } from "./AutomationSelect";

const SELECT_STYLE: React.CSSProperties = {
  background: "var(--hover)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
};

interface Props {
  open:       boolean;
  pipeline:   CrmPipelineWithStages | null;
  automation: AutomationWithDetails | null; // null = create mode
  onClose:    () => void;
  onSave:     (data: CreateAutomationInput) => Promise<boolean>;
}

export function AutomationFormModal({ open, pipeline, automation, onClose, onSave }: Props) {
  const [name,          setName]          = useState("");
  const [triggerType,   setTriggerType]   = useState(TRIGGER_DEFINITIONS[0].type);
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>({});
  const [delayType,     setDelayType]     = useState<DelayType>("immediate");
  const [delayConfig,   setDelayConfig]   = useState<Record<string, unknown>>({});
  const [conditions,    setConditions]    = useState<ConditionRowValue[]>([]);
  const [actions,       setActions]       = useState<ActionRowValue[]>([]);
  const [saving,        setSaving]        = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(automation?.name ?? "");
    setTriggerType(automation?.triggerType ?? TRIGGER_DEFINITIONS[0].type);
    setTriggerConfig(automation?.triggerConfig ?? {});
    setDelayType(automation?.delayType ?? "immediate");
    setDelayConfig(automation?.delayConfig ?? {});
    setConditions(automation?.conditions.map(c => ({ type: c.type, config: c.config })) ?? []);
    setActions(automation?.actions.map(a => ({ type: a.type, config: a.config })) ?? []);
  }, [open, automation]);

  if (!open || !pipeline) return null;

  const canSave = name.trim().length > 0 && actions.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSave || !pipeline) return;
    setSaving(true);
    try {
      const ok = await onSave({
        pipelineId: pipeline.id,
        name: name.trim(),
        status: automation?.status ?? "ativa",
        triggerType, triggerConfig,
        delayType, delayConfig,
        conditions, actions,
      });
      if (ok) onClose();
    } finally {
      setSaving(false);
    }
  }

  const stages = [...(pipeline.crm_stages ?? [])].sort((a, b) => a.order_index - b.order_index);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 lc-scrim"
      style={{ background: "rgba(0,0,0,0.60)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="lc-modal-panel w-full max-w-lg rounded-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        <div className="flex items-center justify-between px-5 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--border)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            {automation ? "Editar Automação" : "Nova Automação"}
          </p>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--hover)] transition-colors" style={{ color: "var(--muted-foreground)" }}>
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col overflow-y-auto">
          <div className="flex flex-col gap-4 px-5 py-5">
            {/* Nome */}
            <div>
              <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-title)" }}>
                Nome <span style={{ color: "var(--primary)" }}>*</span>
              </label>
              <input
                type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Ex: Lembrete Novo Lead" maxLength={80} required autoFocus
                className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                style={SELECT_STYLE}
              />
            </div>

            {/* Gatilho */}
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--muted-foreground)" }}>GATILHO</p>
              <AutomationSelect
                value={triggerType}
                onChange={value => { setTriggerType(value); setTriggerConfig({}); }}
                className="mb-2"
                options={TRIGGER_DEFINITIONS.map(t => ({ value: t.type, label: t.label }))}
              />
              <TriggerConfigFields
                triggerType={triggerType}
                triggerConfig={triggerConfig}
                stages={stages}
                onChange={setTriggerConfig}
              />
            </div>

            {/* Espera */}
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--muted-foreground)" }}>ESPERA</p>
              <AutomationSelect
                value={delayType}
                onChange={value => { setDelayType(value as DelayType); setDelayConfig({}); }}
                className="mb-2"
                options={DELAY_DEFINITIONS.map(d => ({ value: d.type, label: d.label }))}
              />
              <DelayConfigFields delayType={delayType} delayConfig={delayConfig} onChange={setDelayConfig} />
            </div>

            {/* Condições */}
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--muted-foreground)" }}>CONDIÇÕES (OPCIONAL)</p>
              <ConditionsEditor conditions={conditions} onChange={setConditions} />
            </div>

            {/* Ações */}
            <div>
              <p className="text-xs font-semibold mb-1.5" style={{ color: "var(--muted-foreground)" }}>AÇÕES</p>
              <ActionsEditor actions={actions} onChange={setActions} />
            </div>
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 flex-shrink-0" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              type="button" onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-80"
              style={{ border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={!canSave || saving}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "#b0b8c1", color: "#000000" }}
            >
              {saving && <Loader2 size={11} className="animate-spin" />}
              {saving ? "Salvando…" : automation ? "Salvar" : "Criar Automação"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
