"use client";

import type { DelayType } from "@/lib/workflow-engine/types";
import { getDelayDef } from "./catalog";

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--hover)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
};

interface DelayConfigFieldsProps {
  delayType:   DelayType;
  delayConfig: Record<string, unknown>;
  onChange:    (config: Record<string, unknown>) => void;
}

export function DelayConfigFields({ delayType, delayConfig, onChange }: DelayConfigFieldsProps) {
  const def = getDelayDef(delayType);
  if (!def || def.configFields.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {def.configFields.includes("minutes") && (
        <input
          type="number" min={1}
          value={(delayConfig.minutes as number) ?? ""}
          onChange={e => onChange({ ...delayConfig, minutes: Number(e.target.value) })}
          placeholder="Minutos"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={INPUT_STYLE}
        />
      )}
      {def.configFields.includes("hours") && (
        <input
          type="number" min={1}
          value={(delayConfig.hours as number) ?? ""}
          onChange={e => onChange({ ...delayConfig, hours: Number(e.target.value) })}
          placeholder="Horas"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={INPUT_STYLE}
        />
      )}
      {def.configFields.includes("days") && (
        <input
          type="number" min={1}
          value={(delayConfig.days as number) ?? ""}
          onChange={e => onChange({ ...delayConfig, days: Number(e.target.value) })}
          placeholder="Dias"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={INPUT_STYLE}
        />
      )}
      {def.configFields.includes("time") && (
        <input
          type="time"
          value={(delayConfig.time as string) ?? "09:00"}
          onChange={e => onChange({ ...delayConfig, time: e.target.value })}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={INPUT_STYLE}
        />
      )}
    </div>
  );
}
