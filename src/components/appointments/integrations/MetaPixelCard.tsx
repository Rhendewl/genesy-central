"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, Eye, EyeOff }             from "lucide-react";
import type { AppointmentMetaPixelSettings } from "@/types/appointments";

interface MetaPixelPublic extends Omit<AppointmentMetaPixelSettings, "access_token"> {
  access_token_set: boolean;
}

type EventNameOption = {
  value: string;
  label: string;
};

const EVENT_NAME_OPTIONS: EventNameOption[] = [
  { value: "Chronos_Scheduled", label: "Chronos_Scheduled (Personalizado)" },
  { value: "Schedule",          label: "Schedule (Padrão Meta)" },
  { value: "Lead",              label: "Lead (Padrão Meta)" },
  { value: "CompleteRegistration", label: "CompleteRegistration (Padrão Meta)" },
];

interface Props { calendarId: string; }

export function MetaPixelCard({ calendarId }: Props) {
  const [cfg,           setCfg]           = useState<MetaPixelPublic | null>(null);
  const [isLoading,     setIsLoading]     = useState(true);
  const [isSaving,      setIsSaving]      = useState(false);
  const [saveError,     setSaveError]     = useState<string | null>(null);
  const [saveOk,        setSaveOk]        = useState(false);
  const [showToken,     setShowToken]     = useState(false);

  // Local form state
  const [enabled,        setEnabled]       = useState(false);
  const [pixelId,        setPixelId]       = useState("");
  const [eventName,      setEventName]     = useState("Chronos_Scheduled");
  const [customEventName, setCustomEventName] = useState("");
  const [eventMode,      setEventMode]     = useState<"standard" | "custom">("standard");
  const [accessToken,    setAccessToken]   = useState("");  // only set when user types a new one
  const [testEventCode,  setTestEventCode] = useState("");

  const isCustomEvent = !EVENT_NAME_OPTIONS.find(o => o.value === eventName);

  const fetchConfig = useCallback(async () => {
    try {
      const res  = await fetch(`/api/appointments/calendars/${calendarId}/integrations/meta-pixel`);
      const data = await res.json() as { meta_pixel: MetaPixelPublic | null };
      const c    = data.meta_pixel;
      setCfg(c);
      if (c) {
        setEnabled(c.enabled ?? false);
        setPixelId(c.pixel_id ?? "");
        const isKnown = EVENT_NAME_OPTIONS.find(o => o.value === c.event_name);
        if (isKnown) {
          setEventName(c.event_name);
        } else {
          setEventName("__custom__");
          setCustomEventName(c.event_name ?? "");
        }
        setEventMode(c.event_mode ?? "standard");
        setTestEventCode(c.test_event_code ?? "");
        // access_token is never returned — leave input empty
      }
    } finally {
      setIsLoading(false);
    }
  }, [calendarId]);

  useEffect(() => { void fetchConfig(); }, [fetchConfig]);

  async function handleSave() {
    setSaveError(null);
    setSaveOk(false);
    setIsSaving(true);

    const resolvedEventName = eventName === "__custom__" ? customEventName.trim() : eventName;

    const body: Record<string, unknown> = {
      enabled,
      pixel_id:       pixelId.trim(),
      event_name:     resolvedEventName,
      event_mode:     eventMode,
      test_event_code: testEventCode.trim() || null,
    };
    // Only send access_token_plain if the user actually typed a new one
    if (accessToken.trim()) body.access_token_plain = accessToken.trim();

    try {
      const res = await fetch(`/api/appointments/calendars/${calendarId}/integrations/meta-pixel`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(body),
      });
      const data = await res.json() as { ok?: boolean; error?: string; meta_pixel?: MetaPixelPublic };
      if (!res.ok) { setSaveError(data.error ?? "Erro ao salvar"); return; }
      setCfg(data.meta_pixel ?? null);
      setAccessToken(""); // clear after save
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
    } finally {
      setIsSaving(false);
    }
  }

  const resolvedEventName = eventName === "__custom__" ? customEventName.trim() : eventName;
  const cfgEventName = cfg
    ? (EVENT_NAME_OPTIONS.find(o => o.value === cfg.event_name) ? cfg.event_name : "__custom__")
    : "Chronos_Scheduled";
  const cfgCustomEventName = cfg && !EVENT_NAME_OPTIONS.find(o => o.value === cfg.event_name)
    ? cfg.event_name
    : "";

  const isDirty =
    enabled          !== (cfg?.enabled    ?? false)         ||
    pixelId          !== (cfg?.pixel_id   ?? "")            ||
    resolvedEventName !== (cfg?.event_name ?? "Chronos_Scheduled") ||
    eventMode        !== (cfg?.event_mode  ?? "standard")   ||
    testEventCode    !== (cfg?.test_event_code ?? "")       ||
    accessToken.trim() !== "";

  void cfgEventName; void cfgCustomEventName; // used for isDirty calc above

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col gap-4"
      style={{ borderColor: "var(--border)", background: "var(--card)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--accent)" }}
        >
          {/* Meta "f" logo simplified */}
          <svg viewBox="0 0 24 24" fill="none" width="22" height="22">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#1877F2"/>
            <path d="M13.5 7h-1.75C10.56 7 10 7.56 10 8.75V10H8.5v2H10v5h2v-5h1.5l.5-2H12V8.75c0-.14.11-.25.25-.25H13.5V7z" fill="white"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
            Meta Pixel (CAPI)
          </p>
          <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Envia eventos de agendamento via Conversions API (server-side)
          </p>
        </div>
        {!isLoading && (
          <div className="ml-auto shrink-0">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: cfg?.enabled ? "var(--success, #22c55e)" : "var(--muted-foreground)" }}
            />
          </div>
        )}
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 size={18} className="animate-spin" style={{ color: "var(--muted-foreground)" }} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Toggle */}
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: "var(--text-title)" }}>Ativar integração</p>
            <button
              onClick={() => setEnabled(v => !v)}
              aria-pressed={enabled}
              className="relative rounded-full transition-colors shrink-0"
              style={{ background: enabled ? "var(--primary)" : "var(--border)", width: "40px", height: "22px" }}
            >
              <span
                className="absolute top-0.5 left-0.5 rounded-full bg-white transition-transform shadow"
                style={{ width: "18px", height: "18px", transform: enabled ? "translateX(18px)" : "translateX(0)" }}
              />
            </button>
          </div>

          {/* Pixel ID */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              Pixel ID
            </label>
            <input
              type="text"
              value={pixelId}
              onChange={e => setPixelId(e.target.value)}
              placeholder="Ex: 1234567890"
              className="text-sm rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text-title)" }}
            />
          </div>

          {/* Event name */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              Nome do evento
            </label>
            <select
              value={eventName}
              onChange={e => setEventName(e.target.value)}
              className="text-sm rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text-title)" }}
            >
              {EVENT_NAME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              <option value="__custom__">Personalizado…</option>
            </select>
            {eventName === "__custom__" && (
              <input
                type="text"
                value={customEventName}
                onChange={e => setCustomEventName(e.target.value)}
                placeholder="Nome do evento personalizado"
                className="text-sm rounded-lg px-3 py-2 border outline-none mt-1"
                style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text-title)" }}
              />
            )}
          </div>

          {/* Event mode */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              Modo do evento
            </label>
            <select
              value={eventMode}
              onChange={e => setEventMode(e.target.value as "standard" | "custom")}
              className="text-sm rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text-title)" }}
            >
              <option value="standard">Standard (track)</option>
              <option value="custom">Custom (trackCustom)</option>
            </select>
          </div>

          {/* Access token */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              Access Token da Conversions API
              {cfg?.access_token_set && (
                <span className="ml-2 text-xs" style={{ color: "#22c55e" }}>✓ configurado</span>
              )}
            </label>
            <div className="relative">
              <input
                type={showToken ? "text" : "password"}
                value={accessToken}
                onChange={e => setAccessToken(e.target.value)}
                placeholder={cfg?.access_token_set ? "Deixe em branco para manter o atual" : "Cole o token aqui"}
                className="text-sm rounded-lg px-3 py-2 pr-9 border outline-none w-full"
                style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text-title)" }}
              />
              <button
                type="button"
                onClick={() => setShowToken(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: "var(--muted-foreground)" }}
              >
                {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {/* Test event code */}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
              Test Event Code <span className="font-normal">(opcional — para validação no Events Manager)</span>
            </label>
            <input
              type="text"
              value={testEventCode}
              onChange={e => setTestEventCode(e.target.value)}
              placeholder="Ex: TEST12345"
              className="text-sm rounded-lg px-3 py-2 border outline-none"
              style={{ borderColor: "var(--border)", background: "var(--card)", color: "var(--text-title)" }}
            />
          </div>

          {saveError && (
            <p className="text-xs" style={{ color: "#ef4444" }}>{saveError}</p>
          )}
          {saveOk && (
            <p className="text-xs" style={{ color: "#22c55e" }}>Salvo com sucesso.</p>
          )}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50 self-start"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            Salvar
          </button>
        </div>
      )}
    </div>
  );
}
