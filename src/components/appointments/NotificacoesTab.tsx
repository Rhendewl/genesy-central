"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Bell, BellOff } from "lucide-react";
import type {
  AppointmentCalendar,
  AppointmentNotificationSettings,
  NotificationChannel,
  UpdateAppointmentCalendar,
} from "@/types/appointments";

// ── Constants ──────────────────────────────────────────────────────────────────

const DEFAULT_TITLE = "Novo agendamento • {{calendar_name}}";
const DEFAULT_BODY  = "{{lead_name}} agendou para {{appointment_date}} às {{appointment_time}}.";

const VARIABLES: { key: string; label: string }[] = [
  { key: "{{calendar_name}}",    label: "Nome do calendário" },
  { key: "{{lead_name}}",        label: "Nome do lead" },
  { key: "{{lead_email}}",       label: "E-mail do lead" },
  { key: "{{lead_phone}}",       label: "Telefone do lead" },
  { key: "{{appointment_date}}", label: "Data do agendamento" },
  { key: "{{appointment_time}}", label: "Hora do agendamento" },
  { key: "{{created_at}}",       label: "Criado em" },
];

const FAKE: Record<string, string> = {
  "{{calendar_name}}":    "Consulta Comercial",
  "{{lead_name}}":        "João Silva",
  "{{lead_email}}":       "joao@email.com",
  "{{lead_phone}}":       "(11) 99999-9999",
  "{{appointment_date}}": "15/07",
  "{{appointment_time}}": "14:30",
  "{{created_at}}":       "04/07/2026",
};

const CHANNELS: { id: NotificationChannel; label: string; description: string }[] = [
  { id: "pwa", label: "Aplicativo (PWA)", description: "Notificação no navegador ou app instalado" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function renderPreview(template: string): string {
  return template.replace(/\{\{[^}]+\}\}/g, m => FAKE[m] ?? m);
}

function settingsFromCalendar(calendar: AppointmentCalendar): AppointmentNotificationSettings {
  const saved = calendar.settings?.notifications;
  return {
    enabled:  saved?.enabled  ?? false,
    channels: saved?.channels ?? ["pwa"],
    title:    saved?.title    ?? DEFAULT_TITLE,
    body:     saved?.body     ?? DEFAULT_BODY,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

interface Props {
  calendar: AppointmentCalendar;
  onSave:   (payload: UpdateAppointmentCalendar) => Promise<boolean>;
}

export function NotificacoesTab({ calendar, onSave }: Props) {
  const [form,      setForm]      = useState<AppointmentNotificationSettings>(() => settingsFromCalendar(calendar));
  const [isDirty,   setIsDirty]   = useState(false);
  const [isSaving,  setIsSaving]  = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testMsg,   setTestMsg]   = useState<string | null>(null);

  // Focused field for variable insertion: "title" | "body"
  const [focusedField, setFocusedField] = useState<"title" | "body">("title");
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef  = useRef<HTMLTextAreaElement>(null);

  // Sync when calendar prop changes (e.g. after save)
  useEffect(() => {
    const fresh = settingsFromCalendar(calendar);
    setForm(fresh);
    setIsDirty(false);
  }, [calendar.settings?.notifications]);

  // ── Patch ──────────────────────────────────────────────────────────────────

  function patch<K extends keyof AppointmentNotificationSettings>(
    key: K,
    value: AppointmentNotificationSettings[K],
  ) {
    setForm(prev => {
      const next = { ...prev, [key]: value };
      setIsDirty(JSON.stringify(next) !== JSON.stringify(settingsFromCalendar(calendar)));
      return next;
    });
  }

  function toggleChannel(channel: NotificationChannel) {
    setForm(prev => {
      const has  = prev.channels.includes(channel);
      const next = { ...prev, channels: has ? prev.channels.filter(c => c !== channel) : [...prev.channels, channel] };
      setIsDirty(JSON.stringify(next) !== JSON.stringify(settingsFromCalendar(calendar)));
      return next;
    });
  }

  // ── Variable insertion ────────────────────────────────────────────────────

  function insertVariable(varKey: string) {
    if (focusedField === "title") {
      const el = titleRef.current;
      if (!el) return;
      const start = el.selectionStart ?? form.title.length;
      const end   = el.selectionEnd   ?? form.title.length;
      const next  = form.title.slice(0, start) + varKey + form.title.slice(end);
      patch("title", next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + varKey.length, start + varKey.length);
      }, 0);
    } else {
      const el = bodyRef.current;
      if (!el) return;
      const start = el.selectionStart ?? form.body.length;
      const end   = el.selectionEnd   ?? form.body.length;
      const next  = form.body.slice(0, start) + varKey + form.body.slice(end);
      patch("body", next);
      setTimeout(() => {
        el.focus();
        el.setSelectionRange(start + varKey.length, start + varKey.length);
      }, 0);
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setIsSaving(true);
    const ok = await onSave({
      settings: {
        ...calendar.settings,
        notifications: form,
      },
    });
    setIsSaving(false);
    if (ok) setIsDirty(false);
  }

  // ── Test notification ─────────────────────────────────────────────────────

  async function handleTest() {
    setIsTesting(true);
    setTestMsg(null);

    if (!("Notification" in window)) {
      setTestMsg("Seu navegador não suporta notificações.");
      setIsTesting(false);
      return;
    }

    let permission = Notification.permission;
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") {
      setTestMsg("Permissão negada. Habilite notificações nas configurações do navegador.");
      setIsTesting(false);
      return;
    }

    const title = renderPreview(form.title || DEFAULT_TITLE);
    const body  = renderPreview(form.body  || DEFAULT_BODY);
    const opts  = { body, icon: "/favicon.png", badge: "/favicon.png" };

    try {
      // Tenta via Service Worker (necessário em mobile e para push server-side).
      // Promise.race com 3 s de timeout — se o SW ainda está instalando, não trava.
      if ("serviceWorker" in navigator) {
        const timeoutPromise = new Promise<null>(res => setTimeout(() => res(null), 3000));
        const reg = await Promise.race([navigator.serviceWorker.ready, timeoutPromise]);

        if (reg) {
          await reg.showNotification(title, opts);
          setTestMsg("Notificação enviada!");
          setIsTesting(false);
          setTimeout(() => setTestMsg(null), 4000);
          return;
        }
      }

      // Fallback: Notification API direta (desktop Chrome/Edge/Firefox).
      new Notification(title, opts);
      setTestMsg("Notificação enviada!");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido";
      setTestMsg(`Erro: ${msg}`);
    }

    setIsTesting(false);
    setTimeout(() => setTestMsg(null), 4000);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const INPUT_STYLE = {
    background: "rgba(255,255,255,0.04)",
    border:     "1px solid var(--border)",
    color:      "var(--text-title)",
  } as const;

  const previewTitle = renderPreview(form.title || DEFAULT_TITLE);
  const previewBody  = renderPreview(form.body  || DEFAULT_BODY);

  return (
    <div className="flex flex-col gap-6 max-w-xl">

      {/* Enable toggle */}
      <div
        className="flex items-center justify-between px-4 py-3 rounded-xl"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          {form.enabled
            ? <Bell size={18} style={{ color: "var(--primary)" }} />
            : <BellOff size={18} style={{ color: "var(--muted-foreground)" }} />}
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--text-title)" }}>
              Ativar notificações para novos agendamentos
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
              Quando ativado, uma notificação é enviada a cada novo agendamento.
            </p>
          </div>
        </div>
        <button
          onClick={() => patch("enabled", !form.enabled)}
          aria-pressed={form.enabled}
          className="relative rounded-full transition-colors shrink-0 ml-4"
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

      {/* Configuration — visible only when enabled */}
      <div style={{
        display:          "grid",
        gridTemplateRows: form.enabled ? "1fr" : "0fr",
        transition:       "grid-template-rows 280ms ease",
      }}>
        <div style={{ overflow: "hidden" }}>
          <div
            className="flex flex-col gap-6"
            style={{ opacity: form.enabled ? 1 : 0, transition: "opacity 220ms ease" }}
          >

            {/* Channels */}
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Destino
              </p>
              {CHANNELS.map(ch => (
                <label key={ch.id} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.channels.includes(ch.id)}
                    onChange={() => toggleChannel(ch.id)}
                    className="w-4 h-4 rounded accent-primary"
                  />
                  <div>
                    <p className="text-sm font-medium" style={{ color: "var(--text-title)" }}>{ch.label}</p>
                    <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>{ch.description}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Title + body */}
            <div
              className="rounded-xl p-4 flex flex-col gap-4"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Conteúdo
              </p>

              {/* Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                  Título
                </label>
                <input
                  ref={titleRef}
                  type="text"
                  value={form.title}
                  onChange={e => patch("title", e.target.value)}
                  onFocus={() => setFocusedField("title")}
                  placeholder={DEFAULT_TITLE}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={INPUT_STYLE}
                />
              </div>

              {/* Body */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
                  Corpo
                </label>
                <textarea
                  ref={bodyRef}
                  value={form.body}
                  onChange={e => patch("body", e.target.value)}
                  onFocus={() => setFocusedField("body")}
                  placeholder={DEFAULT_BODY}
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
                  style={INPUT_STYLE}
                />
              </div>

              {/* Variable picker */}
              <div className="flex flex-col gap-2">
                <p className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                  Inserir variável em{" "}
                  <span style={{ color: "var(--text-title)" }}>
                    {focusedField === "title" ? "Título" : "Corpo"}
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES.map(v => (
                    <button
                      key={v.key}
                      type="button"
                      onClick={() => insertVariable(v.key)}
                      title={v.label}
                      className="px-2 py-1 rounded text-xs font-mono transition-colors hover:opacity-80"
                      style={{
                        background: "rgba(255,255,255,0.07)",
                        color:      "var(--text-title)",
                        border:     "1px solid var(--border)",
                      }}
                    >
                      {v.key}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div
              className="rounded-xl p-4 flex flex-col gap-3"
              style={{ background: "var(--card)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted-foreground)" }}>
                Preview
              </p>

              <div
                className="rounded-xl px-4 py-3 flex items-start gap-3"
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border:     "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <div
                  className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-base"
                  style={{ background: "rgba(255,255,255,0.08)" }}
                >
                  🔔
                </div>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: "var(--text-title)" }}>
                    {previewTitle || DEFAULT_TITLE}
                  </p>
                  <p className="text-xs leading-relaxed" style={{ color: "var(--muted-foreground)" }}>
                    {previewBody || DEFAULT_BODY}
                  </p>
                </div>
              </div>
            </div>

            {/* Test + Save */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleTest}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
                  style={{
                    background: "rgba(255,255,255,0.07)",
                    color:      "var(--text-title)",
                    border:     "1px solid var(--border)",
                  }}
                >
                  {isTesting
                    ? <Loader2 size={14} className="animate-spin" />
                    : <Bell size={14} />}
                  Testar notificação
                </button>
                {testMsg && (
                  <p
                    className="text-xs"
                    style={{
                      color: testMsg.startsWith("Notificação")
                        ? "#22c55e"
                        : "#ef4444",
                    }}
                  >
                    {testMsg}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || !isDirty}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                {isSaving && <Loader2 size={14} className="animate-spin" />}
                Salvar
              </button>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
