"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type {
  CrmConversionSource,
  CrmStage,
  CrmStageConversion,
  MetaPixelEventName,
  NewCrmStageConversion,
} from "@/types/crm";

const SELECT_STYLE = {
  background: "rgba(255,255,255,0.04)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
} as const;

const META_EVENTS: { value: MetaPixelEventName; label: string }[] = [
  { value: "Lead",                 label: "Lead"                  },
  { value: "Schedule",             label: "Schedule"              },
  { value: "Contact",              label: "Contact"               },
  { value: "SubmitApplication",    label: "Submit Application"    },
  { value: "CompleteRegistration", label: "Complete Registration" },
  { value: "Purchase",             label: "Purchase"              },
  { value: "InitiateCheckout",     label: "Initiate Checkout"     },
  { value: "StartTrial",           label: "Start Trial"           },
  { value: "CustomEvent",          label: "Custom Event"          },
];

const STAGE_EVENT_SUGGESTIONS: Partial<Record<string, MetaPixelEventName>> = {
  "Abordado":            "Lead",
  "Em Andamento":        "Contact",
  "Formulário Aplicado": "SubmitApplication",
  "Reunião Agendada":    "Schedule",
  "Reunião Realizada":   "CompleteRegistration",
  "Venda Realizada":     "Purchase",
};

// ── StageConversionRow ─────────────────────────────────────────────────────────

interface RowConfig {
  source_id:         string;
  event_name:        MetaPixelEventName;
  custom_event_name: string;
  enabled:           boolean;
}

interface RowProps {
  stage:    CrmStage;
  sources:  CrmConversionSource[];
  saved:    CrmStageConversion | undefined;
  onUpsert: (stageId: string, data: Omit<NewCrmStageConversion, "stage_id">) => Promise<boolean>;
}

function StageConversionRow({ stage, sources, saved, onUpsert }: RowProps) {
  const savedSettings = saved?.settings as {
    pixel_integration_id?: string;
    event_name?:           string;
    custom_event_name?:    string;
    mode?:                 string;
  } | undefined;

  function savedToConfig(): RowConfig {
    return {
      source_id:         savedSettings?.pixel_integration_id ?? "",
      event_name:        (savedSettings?.event_name as MetaPixelEventName | undefined) ?? "Lead",
      custom_event_name: (savedSettings?.custom_event_name as string | undefined) ?? "",
      enabled:           saved?.enabled ?? false,
    };
  }

  const [form,    setForm]    = useState<RowConfig>(savedToConfig);
  const [isDirty, setIsDirty] = useState(false);
  const [saving,  setSaving]  = useState(false);

  // Sync when saved prop changes (after refetch).
  const savedId = saved?.id ?? "";
  useEffect(() => {
    setForm(savedToConfig());
    setIsDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedId, saved?.enabled, savedSettings?.pixel_integration_id, savedSettings?.event_name, savedSettings?.custom_event_name]);

  function patch<K extends keyof RowConfig>(key: K, value: RowConfig[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      const orig = savedToConfig();
      setIsDirty(JSON.stringify(next) !== JSON.stringify(orig));
      return next;
    });
  }

  function handleToggleEnabled() {
    const enabling = !form.enabled;
    setForm(prev => {
      const next: RowConfig = {
        ...prev,
        enabled: enabling,
        ...(enabling && !saved
          ? { event_name: STAGE_EVENT_SUGGESTIONS[stage.name] ?? prev.event_name }
          : {}),
      };
      const orig = savedToConfig();
      setIsDirty(JSON.stringify(next) !== JSON.stringify(orig));
      return next;
    });
  }

  async function handleSave() {
    if (!form.source_id) return;
    setSaving(true);
    const preservedMode = (savedSettings?.mode as string | undefined) ?? "capi";
    const settingsPayload: Record<string, unknown> = {
      pixel_integration_id: form.source_id,
      event_name:           form.event_name,
      mode:                 preservedMode,
    };
    if (form.event_name === "CustomEvent" && form.custom_event_name.trim()) {
      settingsPayload.custom_event_name = form.custom_event_name.trim();
    }
    const ok = await onUpsert(stage.id, {
      platform: "meta_pixel",
      enabled:  form.enabled,
      settings: settingsPayload,
    });
    setSaving(false);
    if (ok) setIsDirty(false);
  }

  const activeSources = sources.filter(s => s.is_active);

  return (
    <div
      className="flex flex-col gap-3 px-5 py-4"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Stage header row */}
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 flex-shrink-0 rounded-full"
          style={{ background: stage.color ?? "rgba(255,255,255,0.3)" }}
        />
        <p className="text-xs font-semibold flex-1" style={{ color: "var(--text-title)" }}>
          {stage.name}
        </p>
        {/* Enabled toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={form.enabled}
          onClick={handleToggleEnabled}
          title={form.enabled ? "Desativar conversão" : "Ativar conversão"}
          className="relative flex-shrink-0 w-8 h-4 rounded-full transition-colors"
          style={{ background: form.enabled ? "var(--primary)" : "rgba(255,255,255,0.12)" }}
        >
          <span
            className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform"
            style={{ transform: form.enabled ? "translateX(16px)" : "translateX(0)" }}
          />
        </button>
      </div>

      {/* Expandable configuration — animated via grid-template-rows + opacity */}
      <div
        style={{
          display:          "grid",
          gridTemplateRows: form.enabled ? "1fr" : "0fr",
          transition:       "grid-template-rows 260ms ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div
            style={{
              opacity:    form.enabled ? 1 : 0,
              transition: "opacity 200ms ease",
              paddingTop: "4px",
            }}
          >
            {activeSources.length === 0 ? (
              <p className="text-[11px] pb-1" style={{ color: "var(--muted-foreground)" }}>
                Configure uma Origem na aba anterior para ativar a conversão desta etapa.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                <div className="grid grid-cols-2 gap-2">
                  {/* Origem de Conversão */}
                  <div>
                    <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
                      Origem de Conversão
                    </label>
                    <select
                      value={form.source_id}
                      onChange={e => patch("source_id", e.target.value)}
                      className="w-full appearance-none rounded-lg px-2.5 py-1.5 text-xs outline-none"
                      style={SELECT_STYLE}
                    >
                      <option value="" style={{ background: "#17172a" }}>Selecionar…</option>
                      {activeSources.map(s => (
                        <option key={s.id} value={s.id} style={{ background: "#17172a" }}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Evento da Meta */}
                  <div>
                    <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
                      Evento da Meta
                    </label>
                    <select
                      value={form.event_name}
                      onChange={e => patch("event_name", e.target.value as MetaPixelEventName)}
                      className="w-full appearance-none rounded-lg px-2.5 py-1.5 text-xs outline-none"
                      style={SELECT_STYLE}
                    >
                      {META_EVENTS.map(ev => (
                        <option key={ev.value} value={ev.value} style={{ background: "#17172a" }}>
                          {ev.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Nome do Evento Personalizado — só exibido quando CustomEvent selecionado */}
                {form.event_name === "CustomEvent" && (
                  <div>
                    <label className="block text-[10px] font-medium mb-1" style={{ color: "var(--muted-foreground)" }}>
                      Nome do Evento Personalizado
                    </label>
                    <input
                      type="text"
                      value={form.custom_event_name}
                      onChange={e => patch("custom_event_name", e.target.value)}
                      placeholder="Ex: LeadQualificado"
                      maxLength={100}
                      className="w-full rounded-lg px-2.5 py-1.5 text-xs outline-none"
                      style={SELECT_STYLE}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save button — outside the animated container so it's reachable when toggling off */}
      {isDirty && form.source_id && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {saving && <Loader2 size={11} className="animate-spin" />}
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── EtapasTab ──────────────────────────────────────────────────────────────────

interface Props {
  stages:           CrmStage[];
  sources:          CrmConversionSource[];
  stageConversions: CrmStageConversion[];
  onUpsert:         (stageId: string, data: Omit<NewCrmStageConversion, "stage_id">) => Promise<boolean>;
}

export function EtapasTab({ stages, sources, stageConversions, onUpsert }: Props) {
  if (stages.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-14 px-5 text-center">
        <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>Nenhuma etapa ativa</p>
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Adicione etapas ao pipeline para configurar conversões.
        </p>
      </div>
    );
  }

  return (
    <div>
      {stages.map(stage => (
        <StageConversionRow
          key={stage.id}
          stage={stage}
          sources={sources}
          saved={stageConversions.find(c => c.stage_id === stage.id && c.platform === "meta_pixel")}
          onUpsert={onUpsert}
        />
      ))}
    </div>
  );
}
