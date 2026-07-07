"use client";

import { useState, useEffect } from "react";
import { Loader2, Globe, Clock, Link2, MapPin, MessageCircle, Video } from "lucide-react";
import type {
  AppointmentCalendar,
  UpdateAppointmentCalendar,
  AppointmentMeetingProvider,
  AppointmentLocationType,
} from "@/types/appointments";

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEZONES = [
  { value: "America/Sao_Paulo",   label: "Brasília (BRT / UTC-3)" },
  { value: "America/Manaus",      label: "Manaus (AMT / UTC-4)" },
  { value: "America/Belem",       label: "Belém (BRT / UTC-3)" },
  { value: "America/Fortaleza",   label: "Fortaleza (BRT / UTC-3)" },
  { value: "America/Recife",      label: "Recife (BRT / UTC-3)" },
  { value: "America/Maceio",      label: "Maceió (BRT / UTC-3)" },
  { value: "America/Bahia",       label: "Salvador (BRT / UTC-3)" },
  { value: "America/Cuiaba",      label: "Cuiabá (AMT / UTC-4)" },
  { value: "America/Porto_Velho", label: "Porto Velho (AMT / UTC-4)" },
  { value: "America/Boa_Vista",   label: "Boa Vista (AMT / UTC-4)" },
  { value: "America/Rio_Branco",  label: "Rio Branco (ACT / UTC-5)" },
  { value: "America/Noronha",     label: "Fernando de Noronha (FNT / UTC-2)" },
  { value: "UTC",                 label: "UTC" },
];

const DURATIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240];

// ── Location mode type ────────────────────────────────────────────────────────

type LocationMode =
  | "none"
  | "in_person"
  | "google_meet"
  | "zoom"
  | "teams"
  | "whatsapp"
  | "custom";

const LOCATION_OPTIONS: { value: LocationMode; label: string; icon: React.ReactNode; soon?: boolean }[] = [
  { value: "none",        label: "Sem local definido",   icon: <Globe size={14} /> },
  { value: "in_person",   label: "Presencial",           icon: <MapPin size={14} /> },
  { value: "google_meet", label: "Google Meet",          icon: <Video size={14} />, soon: true },
  { value: "zoom",        label: "Zoom",                 icon: <Video size={14} />, soon: true },
  { value: "teams",       label: "Microsoft Teams",      icon: <Video size={14} />, soon: true },
  { value: "whatsapp",    label: "WhatsApp",             icon: <MessageCircle size={14} />, soon: true },
  { value: "custom",      label: "Link personalizado",   icon: <Link2 size={14} /> },
];

function detectLocationMode(cal: AppointmentCalendar): LocationMode {
  if (cal.meeting_provider === "google_meet") return "google_meet";
  if (cal.meeting_provider === "zoom")        return "zoom";
  if (cal.meeting_provider === "teams")       return "teams";
  if (cal.meeting_provider === "whatsapp")    return "whatsapp";
  if (cal.meeting_provider === "custom")      return "custom";
  if (cal.location_type    === "in_person")   return "in_person";
  return "none";
}

function locationModeToFields(
  mode:      LocationMode,
  address:   string,
  customUrl: string,
): Pick<UpdateAppointmentCalendar, "meeting_provider" | "location_type" | "location" | "custom_meeting_url"> {
  switch (mode) {
    case "google_meet": return { meeting_provider: "google_meet", location_type: "online",    location: null,    custom_meeting_url: null };
    case "zoom":        return { meeting_provider: "zoom",        location_type: "online",    location: null,    custom_meeting_url: null };
    case "teams":       return { meeting_provider: "teams",       location_type: "online",    location: null,    custom_meeting_url: null };
    case "whatsapp":    return { meeting_provider: "whatsapp",    location_type: "phone",     location: null,    custom_meeting_url: null };
    case "custom":      return { meeting_provider: "custom",      location_type: "online",    location: null,    custom_meeting_url: customUrl.trim() || null };
    case "in_person":   return { meeting_provider: "none",        location_type: "in_person", location: address.trim() || null, custom_meeting_url: null };
    default:            return { meeting_provider: "none",        location_type: null,         location: null,    custom_meeting_url: null };
  }
}

// ── Shared input style ────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-2 rounded-xl text-sm outline-none";
const inputStyle = {
  background: "var(--input)",
  border:     "1px solid var(--border)",
  color:      "var(--text-title)",
};
const labelCls = "block text-xs mb-1.5 font-medium";
const labelStyle = { color: "var(--muted-foreground)" };

// ── Field groups ──────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className={labelCls} style={labelStyle}>{children}</label>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-xs font-semibold uppercase tracking-wider mb-3"
      style={{ color: "var(--muted-foreground)", letterSpacing: "0.08em" }}
    >
      {children}
    </h3>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface BasicInfoTabProps {
  calendar:  AppointmentCalendar;
  onSave:    (payload: UpdateAppointmentCalendar) => Promise<boolean>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BasicInfoTab({ calendar, onSave }: BasicInfoTabProps) {
  const [name,             setName]             = useState(calendar.name);
  const [slug,             setSlug]             = useState(calendar.slug);
  const [description,      setDescription]      = useState(calendar.description ?? "");
  const [status,           setStatus]           = useState(calendar.status);
  const [durationMinutes,  setDurationMinutes]  = useState(calendar.duration_minutes);
  const [timezone,         setTimezone]         = useState(calendar.timezone);
  const [bookingWindowDays,setBookingWindowDays]= useState(calendar.booking_window_days);
  const [minNoticeHours,   setMinNoticeHours]   = useState(calendar.min_notice_hours);
  const [capacityPerSlot,  setCapacityPerSlot]  = useState(calendar.capacity_per_slot);
  const [bufferBefore,     setBufferBefore]     = useState(calendar.buffer_before_minutes);
  const [bufferAfter,      setBufferAfter]      = useState(calendar.buffer_after_minutes);
  const [dailyLimit,       setDailyLimit]       = useState<number | "">(calendar.daily_limit ?? "");
  const [locationMode,     setLocationMode]     = useState<LocationMode>(() => detectLocationMode(calendar));
  const [address,          setAddress]          = useState(calendar.location ?? "");
  const [customUrl,        setCustomUrl]        = useState(calendar.custom_meeting_url ?? "");
  const [isSaving,         setIsSaving]         = useState(false);

  // Sync when parent refetches
  useEffect(() => {
    setName(calendar.name);
    setSlug(calendar.slug);
    setDescription(calendar.description ?? "");
    setStatus(calendar.status);
    setDurationMinutes(calendar.duration_minutes);
    setTimezone(calendar.timezone);
    setBookingWindowDays(calendar.booking_window_days);
    setMinNoticeHours(calendar.min_notice_hours);
    setCapacityPerSlot(calendar.capacity_per_slot);
    setBufferBefore(calendar.buffer_before_minutes);
    setBufferAfter(calendar.buffer_after_minutes);
    setDailyLimit(calendar.daily_limit ?? "");
    setLocationMode(detectLocationMode(calendar));
    setAddress(calendar.location ?? "");
    setCustomUrl(calendar.custom_meeting_url ?? "");
  }, [calendar]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    const payload: UpdateAppointmentCalendar = {
      name:                  name.trim(),
      slug:                  slug.trim(),
      description:           description.trim() || null,
      status,
      duration_minutes:      durationMinutes,
      timezone,
      booking_window_days:   bookingWindowDays,
      min_notice_hours:      minNoticeHours,
      capacity_per_slot:     capacityPerSlot,
      buffer_before_minutes: bufferBefore,
      buffer_after_minutes:  bufferAfter,
      daily_limit:           dailyLimit === "" ? null : Number(dailyLimit),
      ...locationModeToFields(locationMode, address, customUrl),
    };
    await onSave(payload);
    setIsSaving(false);
  };

  return (
    <form onSubmit={handleSave} className="space-y-8 max-w-xl pb-8">

      {/* ── Informações ─────────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Informações</SectionTitle>
        <div className="space-y-4">
          {/* Name + Status */}
          <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
            <div>
              <FieldLabel>Nome *</FieldLabel>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                required
                placeholder="Ex: Reunião de Onboarding"
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as "active" | "archived")}
                className="px-3 py-2 rounded-xl text-sm outline-none"
                style={inputStyle}
              >
                <option value="active">Ativo</option>
                <option value="archived">Arquivado</option>
              </select>
            </div>
          </div>

          {/* Slug */}
          <div>
            <FieldLabel>Slug</FieldLabel>
            <input
              type="text"
              value={slug}
              onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
              placeholder="meu-calendario"
              className={inputCls}
              style={inputStyle}
            />
            <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              Identificador único na URL pública
            </p>
          </div>

          {/* Description */}
          <div>
            <FieldLabel>Descrição</FieldLabel>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Breve descrição exibida para o visitante"
              className={`${inputCls} resize-none`}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* ── Configurações ───────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Configurações</SectionTitle>
        <div className="space-y-4">
          {/* Duration + Timezone */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Duração</FieldLabel>
              <select
                value={durationMinutes}
                onChange={e => setDurationMinutes(Number(e.target.value))}
                className={inputCls}
                style={inputStyle}
              >
                {DURATIONS.map(v => (
                  <option key={v} value={v}>{v} min</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Fuso horário</FieldLabel>
              <select
                value={timezone}
                onChange={e => setTimezone(e.target.value)}
                className={inputCls}
                style={inputStyle}
              >
                {TIMEZONES.map(tz => (
                  <option key={tz.value} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Window + Notice */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FieldLabel>Janela de reserva (dias)</FieldLabel>
              <input
                type="number" min={1} max={365}
                value={bookingWindowDays}
                onChange={e => setBookingWindowDays(Math.max(1, Number(e.target.value)))}
                className={inputCls}
                style={inputStyle}
              />
              <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                Até quantos dias à frente o visitante pode agendar
              </p>
            </div>
            <div>
              <FieldLabel>Antecedência mínima (horas)</FieldLabel>
              <input
                type="number" min={0}
                value={minNoticeHours}
                onChange={e => setMinNoticeHours(Math.max(0, Number(e.target.value)))}
                className={inputCls}
                style={inputStyle}
              />
              <p className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                Tempo mínimo antes do agendamento
              </p>
            </div>
          </div>

          {/* Buffers + Capacity */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <FieldLabel>Prep. antes (min)</FieldLabel>
              <input
                type="number" min={0}
                value={bufferBefore}
                onChange={e => setBufferBefore(Math.max(0, Number(e.target.value)))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <FieldLabel>Prep. depois (min)</FieldLabel>
              <input
                type="number" min={0}
                value={bufferAfter}
                onChange={e => setBufferAfter(Math.max(0, Number(e.target.value)))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
            <div>
              <FieldLabel>Capacidade por horário</FieldLabel>
              <input
                type="number" min={1}
                value={capacityPerSlot}
                onChange={e => setCapacityPerSlot(Math.max(1, Number(e.target.value)))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Daily limit */}
          <div className="max-w-[calc(33%_-_6px)]">
            <FieldLabel>Slots máx. por dia</FieldLabel>
            <input
              type="number" min={1}
              value={dailyLimit}
              onChange={e => setDailyLimit(e.target.value === "" ? "" : Math.max(1, Number(e.target.value)))}
              placeholder="Sem limite"
              className={inputCls}
              style={inputStyle}
            />
          </div>
        </div>
      </div>

      {/* ── Local da reunião ─────────────────────────────────────────────────── */}
      <div>
        <SectionTitle>Local da reunião</SectionTitle>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {LOCATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.soon}
                onClick={() => !opt.soon && setLocationMode(opt.value)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm text-left transition-colors disabled:opacity-40"
                style={{
                  background: locationMode === opt.value
                    ? "rgba(var(--primary-rgb, 99 102 241) / 0.15)"
                    : "var(--hover)",
                  border: locationMode === opt.value
                    ? "1px solid var(--primary)"
                    : "1px solid var(--border)",
                  color: locationMode === opt.value
                    ? "var(--text-title)"
                    : "var(--muted-foreground)",
                }}
              >
                <span style={{ color: locationMode === opt.value ? "var(--primary)" : undefined }}>
                  {opt.icon}
                </span>
                <span className="flex-1">{opt.label}</span>
                {opt.soon && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded-md font-medium"
                    style={{ background: "var(--border)", color: "var(--muted-foreground)" }}
                  >
                    Em breve
                  </span>
                )}
              </button>
            ))}
          </div>

          {locationMode === "in_person" && (
            <div>
              <FieldLabel>Endereço</FieldLabel>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder="Rua, número, cidade — exibido ao visitante"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          )}

          {locationMode === "custom" && (
            <div>
              <FieldLabel>URL do link de reunião</FieldLabel>
              <input
                type="url"
                value={customUrl}
                onChange={e => setCustomUrl(e.target.value)}
                placeholder="https://meet.example.com/seu-link"
                className={inputCls}
                style={inputStyle}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Save ──────────────────────────────────────────────────────────────── */}
      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={isSaving || !name.trim()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 disabled:opacity-50"
          style={{ background: "#b0b8c1", color: "#000000" }}
        >
          {isSaving && <Loader2 size={13} className="animate-spin" />}
          Salvar alterações
        </button>
      </div>
    </form>
  );
}
