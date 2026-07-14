"use client";

import { useTags } from "@/hooks/useTags";
import type { CrmStage } from "@/types/crm";
import { getTriggerDef } from "./catalog";
import { AutomationSelect } from "./AutomationSelect";

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
        <AutomationSelect
          value={(triggerConfig.stageId as string) ?? ""}
          onChange={value => onChange({ ...triggerConfig, stageId: value || undefined })}
          options={[
            { value: "", label: "Selecione a etapa" },
            ...stages.map(s => ({ value: s.id, label: s.name })),
          ]}
        />
      )}

      {def.configFields.includes("tag") && (
        <AutomationSelect
          value={(triggerConfig.tagId as string) ?? ""}
          onChange={value => onChange({ ...triggerConfig, tagId: value || undefined })}
          options={[
            { value: "", label: "Qualquer tag" },
            ...tags.map(t => ({ value: t.id, label: t.name })),
          ]}
        />
      )}
    </div>
  );
}
