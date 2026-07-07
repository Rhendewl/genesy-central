"use client";

import { useEffect, useState } from "react";
import { Loader2, Trash2 }     from "lucide-react";
import type { MetaPixelEventName } from "@/types/crm";
import type { AppointmentConversion, ConversionTriggerEvent } from "@/types/appointments";
import { useCalendarConversions }     from "@/hooks/useCalendarConversions";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM = "meta_pixel" as const;

const TRIGGER_LABELS: Record<ConversionTriggerEvent, string> = {
  "booking.created":   "Envia ao criar agendamento",
  "booking.confirmed": "Envia ao confirmar agendamento",
  "booking.completed": "Envia ao concluir agendamento",
};

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

const SELECT_STYLE = {
  background: "var(--input)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
} as const;

// ── Form state ────────────────────────────────────────────────────────────────

interface FormState {
  source_id:         string;
  event_name:        MetaPixelEventName;
  custom_event_name: string;
  mode:              "capi" | "browser" | "both";
  value:             string;   // "" = no fixed value; numeric string = send this value
  currency:          string;
  enabled:           boolean;
}

const DEFAULT_FORM: FormState = {
  source_id:         "",
  event_name:        "Schedule",
  custom_event_name: "",
  mode:              "capi",
  value:             "",
  currency:          "BRL",
  enabled:           false,
};

type SavedSettings = {
  event_name?:        string;
  custom_event_name?: string;
  mode?:              string;
  value?:             number | null;
  currency?:          string | null;
};

function formFromConversion(saved: AppointmentConversion | undefined): FormState {
  if (!saved) return DEFAULT_FORM;
  const s = saved.settings as SavedSettings;
  return {
    source_id:         saved.platform_integration_id                                   ?? "",
    event_name:        (s.event_name as MetaPixelEventName | undefined)                ?? "Schedule",
    custom_event_name: s.custom_event_name                                             ?? "",
    mode:              (s.mode as "capi" | "browser" | "both" | undefined)             ?? "capi",
    value:             s.value !== null && s.value !== undefined ? String(s.value)     : "",
    currency:          s.currency                                                      ?? "BRL",
    enabled:           saved.enabled,
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface Props {
  calendarId:   string;
  triggerEvent: ConversionTriggerEvent;
}

export function MetaPixelConversionCard({ calendarId, triggerEvent }: Props) {
  const { conversions, sources, isLoading, upsertConversion, updateConversion, deleteConversion } =
    useCalendarConversions(calendarId);

  const saved = conversions.find(c => c.trigger_event === triggerEvent && c.platform === PLATFORM);

  const [form,       setForm]       = useState<FormState>(formFromConversion(saved));
  const [isDirty,    setIsDirty]    = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sync form when the conversion loads or changes after a save.
  const savedSettings = saved?.settings as SavedSettings | undefined;
  useEffect(() => {
    setForm(formFromConversion(saved));
    setIsDirty(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    saved?.id,
    saved?.enabled,
    saved?.platform_integration_id,
    savedSettings?.event_name,
    savedSettings?.custom_event_name,
    savedSettings?.mode,
    savedSettings?.value,
    savedSettings?.currency,
  ]);

  function patch<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      setIsDirty(JSON.stringify(next) !== JSON.stringify(formFromConversion(saved)));
      return next;
    });
  }

  function buildSettings(): Record<string, unknown> {
    const s: Record<string, unknown> = {
      event_name: form.event_name,
      mode:       form.mode,
    };
    if (form.event_name === "CustomEvent" && form.custom_event_name.trim()) {
      s.custom_event_name = form.custom_event_name.trim();
    }
    if (form.value !== "") {
      const n = parseFloat(form.value);
      if (!isNaN(n)) {
        s.value    = n;
        s.currency = form.currency || "BRL";
      }
    }
    return s;
  }

  async function handleSave() {
    if (!form.source_id) return;
    setIsSaving(true);
    const settings = buildSettings();
    const ok = saved
      ? await updateConversion(saved.id, { platform_integration_id: form.source_id, enabled: form.enabled, settings })
      : await upsertConversion({ trigger_event: triggerEvent, platform: PLATFORM, platform_integration_id: form.source_id, enabled: form.enabled, settings });
    setIsSaving(false);
    if (ok) setIsDirty(false);
  }

  async function handleDelete() {
    if (!saved) return;
    setIsDeleting(true);
    await deleteConversion(saved.id);
    setIsDeleting(false);
  }

  const activeSources = sources.filter(s => s.is_active);
  const isActive      = !!saved?.enabled;

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-lg font-bold select-none"
          style={{ background: "rgba(24,119,242,0.15)", color: "#1877f2" }}
        >
          f
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            Meta — Conversões
          </p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {TRIGGER_LABELS[triggerEvent]}
          </p>
        </div>
        {!isLoading && (
          <div className="ml-auto shrink-0">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: isActive ? "#22c55e" : "var(--muted-foreground)" }}
            />
          </div>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
        </div>
      ) : activeSources.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Configure uma Origem de Conversão no CRM (Configurações → Origens) para ativar aqui.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Enable toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--text-title)" }}>Ativar conversão</p>
            <button
              onClick={() => patch("enabled", !form.enabled)}
              aria-pressed={form.enabled}
              className="relative rounded-full transition-colors shrink-0"
              style={{
                background: form.enabled ? "var(--primary)" : "var(--border)",
                width: "40px", height: "22px",
              }}
            >
              <span
                className="absolute top-0.5 left-0.5 rounded-full bg-white transition-transform shadow"
                style={{
                  width: "18px", height: "18px",
                  transform: form.enabled ? "translateX(18px)" : "translateX(0)",
                }}
              />
            </button>
          </div>

          {/* Expandable configuration — animated via grid-rows */}
          <div style={{
            display:          "grid",
            gridTemplateRows: form.enabled ? "1fr" : "0fr",
            transition:       "grid-template-rows 260ms ease",
          }}>
            <div style={{ overflow: "hidden" }}>
              <div style={{ opacity: form.enabled ? 1 : 0, transition: "opacity 200ms ease" }}>
                <div className="flex flex-col gap-3">
                  {/* Source */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                      Origem de Conversão (Pixel)
                    </label>
                    <select
                      value={form.source_id}
                      onChange={e => patch("source_id", e.target.value)}
                      className="w-full appearance-none rounded-lg px-3 py-2 text-sm outline-none"
                      style={SELECT_STYLE}
                    >
                      <option value="" style={{ background: "var(--popover)" }}>Selecionar…</option>
                      {activeSources.map(s => (
                        <option key={s.id} value={s.id} style={{ background: "var(--popover)" }}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Event + mode */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                        Evento da Meta
                      </label>
                      <select
                        value={form.event_name}
                        onChange={e => patch("event_name", e.target.value as MetaPixelEventName)}
                        className="w-full appearance-none rounded-lg px-3 py-2 text-sm outline-none"
                        style={SELECT_STYLE}
                      >
                        {META_EVENTS.map(ev => (
                          <option key={ev.value} value={ev.value} style={{ background: "var(--popover)" }}>
                            {ev.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                        Modo
                      </label>
                      <select
                        value={form.mode}
                        onChange={e => patch("mode", e.target.value as "capi" | "browser" | "both")}
                        className="w-full appearance-none rounded-lg px-3 py-2 text-sm outline-none"
                        style={SELECT_STYLE}
                      >
                        <option value="capi"    style={{ background: "var(--popover)" }}>Apenas CAPI</option>
                        <option value="browser" style={{ background: "var(--popover)" }}>Apenas Pixel</option>
                        <option value="both"    style={{ background: "var(--popover)" }}>CAPI + Pixel</option>
                      </select>
                    </div>
                  </div>

                  {/* Custom event name */}
                  {form.event_name === "CustomEvent" && (
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                        Nome do Evento Personalizado
                      </label>
                      <input
                        type="text"
                        value={form.custom_event_name}
                        onChange={e => patch("custom_event_name", e.target.value)}
                        placeholder="Ex: AgendamentoRealizado"
                        maxLength={100}
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={SELECT_STYLE}
                      />
                    </div>
                  )}

                  {/* Value rules */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                        Valor Fixo
                        <span className="ml-1 font-normal text-[10px]">(opcional)</span>
                      </label>
                      <input
                        type="number"
                        value={form.value}
                        onChange={e => patch("value", e.target.value)}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                        className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                        style={SELECT_STYLE}
                      />
                    </div>
                    {form.value !== "" && (
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                          Moeda
                        </label>
                        <input
                          type="text"
                          value={form.currency}
                          onChange={e => patch("currency", e.target.value.toUpperCase())}
                          placeholder="BRL"
                          maxLength={3}
                          className="w-full rounded-lg px-3 py-2 text-sm outline-none font-mono uppercase"
                          style={SELECT_STYLE}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-1">
            {saved ? (
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                style={{ color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)" }}
              >
                {isDeleting
                  ? <Loader2 size={11} className="animate-spin" />
                  : <Trash2   size={11} />}
                {isDeleting ? "Removendo…" : "Remover"}
              </button>
            ) : (
              <span />
            )}

            <button
              onClick={handleSave}
              disabled={isSaving || !isDirty || (form.enabled && !form.source_id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
              style={{ background: "#b0b8c1", color: "#000000" }}
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
