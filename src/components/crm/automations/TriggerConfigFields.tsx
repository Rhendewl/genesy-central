"use client";

import { useTags } from "@/hooks/useTags";
import type { CrmStage } from "@/types/crm";
import { getTriggerDef } from "./catalog";

const SELECT_STYLE: React.CSSProperties = {
  background: "var(--hover)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
};

interface TriggerConfigFieldsProps {
  triggerType:   string;
  triggerConfig: Record<string, unknown>;
  stages:        CrmStage[];
  onChange:      (config: Record<string, unknown>) => void;
}

export function TriggerConfigFields({ triggerType, triggerConfig, stages, onChange }: TriggerConfigFieldsProps) {
  const def = getTriggerDef(triggerType);
  const { tags } = useTags();

  if (!def || def.configFields.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {def.configFields.includes("stage") && (
        <select
          value={(triggerConfig.stageId as string) ?? ""}
          onChange={e => onChange({ ...triggerConfig, stageId: e.target.value || undefined })}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={SELECT_STYLE}
        >
          <option value="">Selecione a etapa</option>
          {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      )}

      {def.configFields.includes("tag") && (
        <select
          value={(triggerConfig.tagId as string) ?? ""}
          onChange={e => onChange({ ...triggerConfig, tagId: e.target.value || undefined })}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={SELECT_STYLE}
        >
          <option value="">Qualquer tag</option>
          {tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}
    </div>
  );
}
