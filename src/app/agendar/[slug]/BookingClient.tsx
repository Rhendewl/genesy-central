"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, Check, AlertCircle, Loader2, Calendar } from "lucide-react";
import type {
  PublicCalendar,
  AdminSlot,
  CreatePublicBookingPayload,
  PublicBookingResult,
  AppointmentCustomField,
  StandardFieldVisibility,
} from "@/types/appointments";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getPageSettings(cal: PublicCalendar) {
  return {
    title:           cal.settings?.page?.title           ?? cal.name,
    subtitle:        cal.settings?.page?.subtitle        ?? null,
    welcome_message: cal.settings?.page?.welcome_message ?? null,
    cover_image_url: cal.settings?.page?.cover_image_url ?? null,
    logo_url:        cal.settings?.page?.logo_url        ?? null,
    brand_color:     cal.settings?.page?.brand_color     ?? "#6366f1",
  };
}

function getSuccessSettings(cal: PublicCalendar) {
  return {
    title:        cal.settings?.success?.title        ?? "Agendamento confirmado!",
    message:      cal.settings?.success?.message      ?? "Em breve você receberá os detalhes por e-mail.",
    button_label: cal.settings?.success?.button_label ?? null,
    redirect_url: cal.settings?.success?.redirect_url ?? null,
  };
}

function getStandardFieldVisibility(
  cal: PublicCalendar,
  key: "phone" | "company" | "role" | "city" | "notes",
): StandardFieldVisibility {
  return (cal.settings?.form?.standard_fields?.[key] as StandardFieldVisibility | undefined) ?? "optional";
}

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

function formatLocationLabel(cal: PublicCalendar): string {
  if (cal.meeting_provider === "google_meet") return "Google Meet";
  if (cal.meeting_provider === "zoom")        return "Zoom";
  if (cal.meeting_provider === "teams")       return "Microsoft Teams";
  if (cal.meeting_provider === "whatsapp")    return "WhatsApp";
  if (cal.meeting_provider === "custom" && cal.custom_meeting_url) return "Link de reunião";
  if (cal.location_type === "in_person" && cal.location)  return cal.location;
  if (cal.location_type === "in_person")                  return "Presencial";
  return "";
}

function getDayName(d: number): string {
  return ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][d];
}

function getMonthName(m: number): string {
  return ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
          "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"][m];
}

// Format a "YYYY-MM-DD" date in pt-BR without timezone issues
function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const names = ["janeiro", "fevereiro", "março", "abril", "maio", "junho",
                  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${d} de ${names[m - 1]} de ${y}`;
}

// Get current date in a given timezone as "YYYY-MM-DD"
function getTodayInTz(tz: string): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: tz });
}

// Build calendar grid for a given year/month
function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(d).padStart(2, "0");
    cells.push(`${year}-${mm}-${dd}`);
  }
  return cells;
}

// ── Types ─────────────────────────────────────────────────────────────────────

type Step = "date" | "time" | "form" | "success";

// ── Shared components ─────────────────────────────────────────────────────────

function Spinner() {
  return <Loader2 size={20} className="animate-spin" style={{ color: "#94a3b8" }} />;
}

// ── Custom field renderer ─────────────────────────────────────────────────────

function CustomFieldInput({
  field,
  value,
  onChange,
  color,
}: {
  field:    AppointmentCustomField;
  value:    unknown;
  onChange: (v: unknown) => void;
  color:    string;
}) {
  const cls = "w-full px-3 py-2 rounded-xl text-sm outline-none border";
  const style = {
    background: "#f8fafc",
    border:     "1px solid #e2e8f0",
    color:      "#0f172a",
  };

  if (field.type === "textarea") {
    return (
      <textarea
        value={(value as string) ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className={`${cls} resize-none`}
        style={style}
      />
    );
  }

  if (field.type === "select" || field.type === "radio") {
    const opts = field.options ?? [];
    if (field.type === "select") {
      return (
        <select
          value={(value as string) ?? ""}
          onChange={e => onChange(e.target.value)}
          className={cls}
          style={style}
        >
          <option value="">Selecione...</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    // radio
    return (
      <div className="space-y-1.5">
        {opts.map(o => (
          <label key={o} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "#334155" }}>
            <input
              type="radio"
              checked={(value as string) === o}
              onChange={() => onChange(o)}
              style={{ accentColor: color }}
            />
            {o}
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "multiselect" || field.type === "checkbox") {
    const opts = field.options ?? [];
    const selected = (value as string[]) ?? [];
    const toggle = (o: string) => {
      const next = selected.includes(o)
        ? selected.filter(x => x !== o)
        : [...selected, o];
      onChange(next);
    };
    return (
      <div className="space-y-1.5">
        {opts.map(o => (
          <label key={o} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "#334155" }}>
            <input
              type="checkbox"
              checked={selected.includes(o)}
              onChange={() => toggle(o)}
              style={{ accentColor: color }}
            />
            {o}
          </label>
        ))}
      </div>
    );
  }

  const inputType =
    field.type === "email" ? "email" :
    field.type === "number" ? "number" :
    field.type === "date" ? "date" :
    field.type === "time" ? "time" :
    field.type === "url" ? "url" :
    field.type === "phone" ? "tel" : "text";

  return (
    <input
      type={inputType}
      value={(value as string) ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={cls}
      style={style}
    />
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function BookingClient({ slug }: { slug: string }) {
  const [calendar,           setCalendar]           = useState<PublicCalendar | null>(null);
  const [availableWeekdays,  setAvailableWeekdays]  = useState<number[]>([]);
  const [isLoading,          setIsLoading]          = useState(true);
  const [loadError,          setLoadError]          = useState<string | null>(null);

  const [step,               setStep]               = useState<Step>("date");
  const [selectedDate,       setSelectedDate]       = useState<string | null>(null);
  const [slots,              setSlots]              = useState<AdminSlot[]>([]);
  const [isFetchingSlots,    setIsFetchingSlots]    = useState(false);
  const [selectedSlot,       setSelectedSlot]       = useState<AdminSlot | null>(null);

  // Calendar grid state
  const todayRef = useMemo(() => {
    if (!calendar) return new Date();
    const str = getTodayInTz(calendar.timezone);
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [calendar]);

  const [viewYear,  setViewYear]  = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  // Form state
  const [visitorName,    setVisitorName]    = useState("");
  const [visitorEmail,   setVisitorEmail]   = useState("");
  const [visitorPhone,   setVisitorPhone]   = useState("");
  const [visitorCompany, setVisitorCompany] = useState("");
  const [visitorRole,    setVisitorRole]    = useState("");
  const [visitorCity,    setVisitorCity]    = useState("");
  const [visitorNotes,   setVisitorNotes]   = useState("");
  const [customResponses, setCustomResponses] = useState<Record<string, unknown>>({});
  const [lgpdAccepted,   setLgpdAccepted]   = useState(false);

  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [submitError,    setSubmitError]    = useState<string | null>(null);
  const [bookingResult,  setBookingResult]  = useState<PublicBookingResult | null>(null);

  // Load calendar data
  useEffect(() => {
    fetch(`/api/agendar/${slug}`)
      .then(r => r.json())
      .then((data: { calendar?: PublicCalendar; available_weekdays?: number[]; error?: string }) => {
        if (data.error || !data.calendar) {
          setLoadError(data.error ?? "Calendário não encontrado");
        } else {
          setCalendar(data.calendar);
          setAvailableWeekdays(data.available_weekdays ?? []);
          const today = getTodayInTz(data.calendar.timezone);
          const [y, m] = today.split("-").map(Number);
          setViewYear(y);
          setViewMonth(m - 1);
        }
      })
      .catch(() => setLoadError("Erro ao carregar o calendário"))
      .finally(() => setIsLoading(false));
  }, [slug]);

  const page     = useMemo(() => calendar ? getPageSettings(calendar) : null, [calendar]);
  const success  = useMemo(() => calendar ? getSuccessSettings(calendar) : null, [calendar]);
  const color    = page?.brand_color ?? "#6366f1";
  const location = calendar ? formatLocationLabel(calendar) : "";

  // Month grid
  const cells  = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const today  = calendar ? getTodayInTz(calendar.timezone) : new Date().toLocaleDateString("sv-SE");
  const maxDate = useMemo(() => {
    if (!calendar) return today;
    const d = new Date(today.replace(/-/g, "/"));
    d.setDate(d.getDate() + calendar.booking_window_days);
    return d.toLocaleDateString("sv-SE");
  }, [calendar, today]);

  const isDayAvailable = useCallback((dateStr: string): boolean => {
    if (dateStr < today || dateStr > maxDate) return false;
    const dow = new Date(dateStr + "T12:00:00").getDay();
    return availableWeekdays.includes(dow);
  }, [today, maxDate, availableWeekdays]);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else                   setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else                   setViewMonth(m => m + 1);
  };

  // Fetch slots when a date is selected
  const selectDate = useCallback(async (dateStr: string) => {
    if (!isDayAvailable(dateStr)) return;
    setSelectedDate(dateStr);
    setSlots([]);
    setIsFetchingSlots(true);
    setStep("time");
    try {
      const res  = await fetch(`/api/agendar/${slug}/slots?date=${dateStr}`);
      const data = await res.json() as { slots?: AdminSlot[]; error?: string };
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setIsFetchingSlots(false);
    }
  }, [slug, isDayAvailable]);

  const selectSlot = (slot: AdminSlot) => {
    setSelectedSlot(slot);
    setStep("form");
    setSubmitError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot || !calendar) return;

    setIsSubmitting(true);
    setSubmitError(null);

    const visitorTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const payload: CreatePublicBookingPayload = {
      starts_at:        selectedSlot.startsAt,
      visitor_name:     visitorName.trim(),
      visitor_email:    visitorEmail.trim(),
      visitor_phone:    visitorPhone.trim() || undefined,
      visitor_company:  visitorCompany.trim() || undefined,
      visitor_role:     visitorRole.trim() || undefined,
      visitor_city:     visitorCity.trim() || undefined,
      visitor_notes:    visitorNotes.trim() || undefined,
      visitor_timezone: visitorTimezone,
      custom_form_responses: customResponses,
      lgpd_accepted:    lgpdAccepted || undefined,
    };

    try {
      const res  = await fetch(`/api/agendar/${slug}/book`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json() as { booking?: PublicBookingResult; error?: string };
      if (!res.ok) {
        setSubmitError(data.error ?? "Erro ao confirmar agendamento. Tente novamente.");
        if (res.status === 409) {
          // Slot was taken — go back to time selection
          setStep("time");
          setSelectedSlot(null);
          // Refresh slots
          setIsFetchingSlots(true);
          fetch(`/api/agendar/${slug}/slots?date=${selectedDate}`)
            .then(r => r.json())
            .then((d: { slots?: AdminSlot[] }) => setSlots(d.slots ?? []))
            .finally(() => setIsFetchingSlots(false));
        }
      } else {
        setBookingResult(data.booking ?? null);
        setStep("success");
        if (success?.redirect_url) {
          setTimeout(() => { window.location.href = success.redirect_url!; }, 3000);
        }
      }
    } catch {
      setSubmitError("Erro de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center" style={{ background: "#f8fafc" }}>
        <Spinner />
      </div>
    );
  }

  if (loadError || !calendar || !page) {
    return (
      <div className="min-h-dvh flex items-center justify-center flex-col gap-4" style={{ background: "#f8fafc" }}>
        <AlertCircle size={40} style={{ color: "#ef4444" }} />
        <p style={{ color: "#64748b" }}>{loadError ?? "Calendário não encontrado"}</p>
      </div>
    );
  }

  const lgpd = calendar.settings?.lgpd;
  const showLgpd = lgpd?.enabled && lgpd.title;

  const getVisibility = (key: Parameters<typeof getStandardFieldVisibility>[1]) =>
    getStandardFieldVisibility(calendar, key);

  const sortedCustomFields = [...(calendar.custom_fields ?? [])]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh" style={{ background: "#f1f5f9" }}>
      {/* Cover banner */}
      {page.cover_image_url && (
        <div
          className="w-full h-40 sm:h-56 bg-cover bg-center"
          style={{ backgroundImage: `url(${page.cover_image_url})` }}
        />
      )}

      <div className="max-w-5xl mx-auto px-4 py-8 sm:py-12">
        {/* Header card */}
        <div
          className="rounded-2xl p-6 sm:p-8 mb-6 shadow-sm"
          style={{ background: "#fff", border: "1px solid #e2e8f0" }}
        >
          {page.logo_url && (
            <img src={page.logo_url} alt="Logo" className="h-10 mb-4 object-contain" />
          )}

          <h1 className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: "#0f172a" }}>
            {page.title}
          </h1>

          {page.subtitle && (
            <p className="text-base mb-3" style={{ color: "#475569" }}>{page.subtitle}</p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-sm" style={{ color: "#64748b" }}>
            <span className="flex items-center gap-1.5">
              <Clock size={14} />
              {formatDuration(calendar.duration_minutes)}
            </span>
            {location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} />
                {location}
              </span>
            )}
          </div>

          {page.welcome_message && (
            <p className="mt-4 text-sm leading-relaxed" style={{ color: "#475569" }}>
              {page.welcome_message}
            </p>
          )}

          {calendar.description && !page.subtitle && (
            <p className="mt-3 text-sm leading-relaxed" style={{ color: "#64748b" }}>
              {calendar.description}
            </p>
          )}
        </div>

        {/* ── Step: Date ────────────────────────────────────────────────────── */}
        {step === "date" && (
          <div
            className="rounded-2xl p-6 sm:p-8 shadow-sm"
            style={{ background: "#fff", border: "1px solid #e2e8f0" }}
          >
            <h2 className="font-semibold text-base mb-5" style={{ color: "#0f172a" }}>
              Selecione uma data
            </h2>

            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={prevMonth}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft size={16} style={{ color: "#64748b" }} />
              </button>
              <span className="font-medium text-sm" style={{ color: "#0f172a" }}>
                {getMonthName(viewMonth)} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronRight size={16} style={{ color: "#64748b" }} />
              </button>
            </div>

            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(d => (
                <div key={d} className="text-center text-xs font-medium py-1.5" style={{ color: "#94a3b8" }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-0.5">
              {cells.map((dateStr, i) => {
                if (!dateStr) return <div key={`e-${i}`} />;
                const day = Number(dateStr.split("-")[2]);
                const available = isDayAvailable(dateStr);
                const isToday   = dateStr === today;
                const selected  = dateStr === selectedDate;

                return (
                  <button
                    key={dateStr}
                    type="button"
                    disabled={!available}
                    onClick={() => selectDate(dateStr)}
                    className="aspect-square flex items-center justify-center text-sm rounded-xl font-medium transition-all"
                    style={{
                      color: selected
                        ? "#fff"
                        : available
                          ? isToday ? color : "#334155"
                          : "#cbd5e1",
                      background: selected
                        ? color
                        : isToday && available
                          ? `${color}18`
                          : "transparent",
                      fontWeight: isToday ? "700" : undefined,
                      cursor: available ? "pointer" : "default",
                    }}
                    onMouseOver={e => { if (available && !selected) (e.currentTarget as HTMLButtonElement).style.background = `${color}18`; }}
                    onMouseOut={e => { if (!selected) (e.currentTarget as HTMLButtonElement).style.background = isToday && available ? `${color}18` : "transparent"; }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>

            <p className="mt-4 text-xs" style={{ color: "#94a3b8" }}>
              Fuso: {calendar.timezone}
            </p>
          </div>
        )}

        {/* ── Step: Time ────────────────────────────────────────────────────── */}
        {step === "time" && selectedDate && (
          <div
            className="rounded-2xl p-6 sm:p-8 shadow-sm"
            style={{ background: "#fff", border: "1px solid #e2e8f0" }}
          >
            <div className="flex items-center gap-3 mb-5">
              <button
                type="button"
                onClick={() => setStep("date")}
                className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <ChevronLeft size={16} style={{ color: "#64748b" }} />
              </button>
              <div>
                <h2 className="font-semibold text-base" style={{ color: "#0f172a" }}>
                  Selecione um horário
                </h2>
                <p className="text-sm capitalize" style={{ color: "#64748b" }}>
                  {formatDate(selectedDate)}
                </p>
              </div>
            </div>

            {isFetchingSlots ? (
              <div className="flex justify-center py-10"><Spinner /></div>
            ) : slots.length === 0 ? (
              <div className="text-center py-10">
                <Calendar size={32} className="mx-auto mb-3" style={{ color: "#94a3b8" }} />
                <p className="text-sm" style={{ color: "#64748b" }}>
                  Nenhum horário disponível para este dia.
                </p>
                <button
                  type="button"
                  onClick={() => setStep("date")}
                  className="mt-4 text-sm font-medium underline"
                  style={{ color: color }}
                >
                  Escolher outra data
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {slots.map(slot => (
                  <button
                    key={slot.startsAt}
                    type="button"
                    onClick={() => selectSlot(slot)}
                    className="py-2.5 rounded-xl text-sm font-medium border transition-all"
                    style={{
                      borderColor: "#e2e8f0",
                      color:       "#0f172a",
                      background:  "#f8fafc",
                    }}
                    onMouseOver={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = `${color}12`;
                      (e.currentTarget as HTMLButtonElement).style.borderColor = color;
                      (e.currentTarget as HTMLButtonElement).style.color = color;
                    }}
                    onMouseOut={e => {
                      (e.currentTarget as HTMLButtonElement).style.background = "#f8fafc";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
                      (e.currentTarget as HTMLButtonElement).style.color = "#0f172a";
                    }}
                  >
                    {slot.startsAtLocal}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step: Form ────────────────────────────────────────────────────── */}
        {step === "form" && selectedSlot && (
          <div
            className="rounded-2xl p-6 sm:p-8 shadow-sm"
            style={{ background: "#fff", border: "1px solid #e2e8f0" }}
          >
            {/* Summary bar */}
            <div
              className="flex items-center gap-3 p-3 rounded-xl mb-6"
              style={{ background: `${color}0f`, border: `1px solid ${color}30` }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: color }}
              >
                <Check size={14} color="#fff" />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: "#0f172a" }}>
                  {formatDate(selectedDate!)} · {selectedSlot.startsAtLocal}
                </p>
                <p className="text-xs" style={{ color: "#64748b" }}>
                  {formatDuration(calendar.duration_minutes)}
                  {location ? ` · ${location}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setStep("time"); setSelectedSlot(null); }}
                className="ml-auto text-xs font-medium"
                style={{ color: color }}
              >
                Alterar
              </button>
            </div>

            <h2 className="font-semibold text-base mb-5" style={{ color: "#0f172a" }}>
              Seus dados
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#64748b" }}>
                  Nome completo *
                </label>
                <input
                  type="text"
                  value={visitorName}
                  onChange={e => setVisitorName(e.target.value)}
                  required
                  placeholder="Seu nome"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a" }}
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: "#64748b" }}>
                  E-mail *
                </label>
                <input
                  type="email"
                  value={visitorEmail}
                  onChange={e => setVisitorEmail(e.target.value)}
                  required
                  placeholder="seu@email.com"
                  className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a" }}
                />
              </div>

              {/* Phone */}
              {getVisibility("phone") !== "hidden" && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#64748b" }}>
                    Telefone {getVisibility("phone") === "required" ? "*" : "(opcional)"}
                  </label>
                  <input
                    type="tel"
                    value={visitorPhone}
                    onChange={e => setVisitorPhone(e.target.value)}
                    required={getVisibility("phone") === "required"}
                    placeholder="+55 (11) 99999-9999"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a" }}
                  />
                </div>
              )}

              {/* Company */}
              {getVisibility("company") !== "hidden" && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#64748b" }}>
                    Empresa {getVisibility("company") === "required" ? "*" : "(opcional)"}
                  </label>
                  <input
                    type="text"
                    value={visitorCompany}
                    onChange={e => setVisitorCompany(e.target.value)}
                    required={getVisibility("company") === "required"}
                    placeholder="Nome da empresa"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a" }}
                  />
                </div>
              )}

              {/* Role */}
              {getVisibility("role") !== "hidden" && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#64748b" }}>
                    Cargo {getVisibility("role") === "required" ? "*" : "(opcional)"}
                  </label>
                  <input
                    type="text"
                    value={visitorRole}
                    onChange={e => setVisitorRole(e.target.value)}
                    required={getVisibility("role") === "required"}
                    placeholder="Seu cargo"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a" }}
                  />
                </div>
              )}

              {/* City */}
              {getVisibility("city") !== "hidden" && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#64748b" }}>
                    Cidade {getVisibility("city") === "required" ? "*" : "(opcional)"}
                  </label>
                  <input
                    type="text"
                    value={visitorCity}
                    onChange={e => setVisitorCity(e.target.value)}
                    required={getVisibility("city") === "required"}
                    placeholder="Sua cidade"
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border"
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a" }}
                  />
                </div>
              )}

              {/* Custom fields */}
              {sortedCustomFields.map(field => (
                <div key={field.id}>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#64748b" }}>
                    {field.label} {field.required ? "*" : "(opcional)"}
                  </label>
                  <CustomFieldInput
                    field={field}
                    value={customResponses[field.id]}
                    onChange={v => setCustomResponses(prev => ({ ...prev, [field.id]: v }))}
                    color={color}
                  />
                  {field.help && (
                    <p className="mt-1 text-xs" style={{ color: "#94a3b8" }}>{field.help}</p>
                  )}
                </div>
              ))}

              {/* Notes */}
              {getVisibility("notes") !== "hidden" && (
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: "#64748b" }}>
                    Observações {getVisibility("notes") === "required" ? "*" : "(opcional)"}
                  </label>
                  <textarea
                    value={visitorNotes}
                    onChange={e => setVisitorNotes(e.target.value)}
                    required={getVisibility("notes") === "required"}
                    placeholder="Alguma informação adicional?"
                    rows={3}
                    className="w-full px-3 py-2 rounded-xl text-sm outline-none border resize-none"
                    style={{ background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a" }}
                  />
                </div>
              )}

              {/* LGPD */}
              {showLgpd && (
                <div
                  className="p-3 rounded-xl"
                  style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}
                >
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={lgpdAccepted}
                      onChange={e => setLgpdAccepted(e.target.checked)}
                      required
                      className="mt-0.5 shrink-0"
                      style={{ accentColor: color }}
                    />
                    <span className="text-xs leading-relaxed" style={{ color: "#475569" }}>
                      {lgpd!.text || `Li e aceito a `}
                      {lgpd!.link ? (
                        <a href={lgpd!.link} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: color }}>
                          {lgpd!.title}
                        </a>
                      ) : (
                        <span style={{ color: color }}>{lgpd!.title}</span>
                      )}
                    </span>
                  </label>
                </div>
              )}

              {submitError && (
                <div
                  className="flex items-center gap-2 p-3 rounded-xl text-sm"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
                >
                  <AlertCircle size={14} className="shrink-0" />
                  {submitError}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setStep("time"); setSelectedSlot(null); setSubmitError(null); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: "#f1f5f9", color: "#64748b" }}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ background: color, color: "#fff" }}
                >
                  {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                  Confirmar agendamento
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Step: Success ─────────────────────────────────────────────────── */}
        {step === "success" && success && bookingResult && (
          <div
            className="rounded-2xl p-8 sm:p-12 text-center shadow-sm"
            style={{ background: "#fff", border: "1px solid #e2e8f0" }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: `${color}15` }}
            >
              <Check size={28} style={{ color }} />
            </div>
            <h2 className="text-2xl font-bold mb-3" style={{ color: "#0f172a" }}>
              {success.title}
            </h2>
            <p className="text-sm leading-relaxed mb-6" style={{ color: "#64748b" }}>
              {success.message}
            </p>
            <div
              className="inline-block px-4 py-2 rounded-xl text-sm mb-6"
              style={{ background: "#f1f5f9", color: "#475569" }}
            >
              {selectedDate && formatDate(selectedDate)} · {selectedSlot?.startsAtLocal}
            </div>
            {success.redirect_url && (
              <p className="text-xs" style={{ color: "#94a3b8" }}>
                Redirecionando em instantes...
              </p>
            )}
            {success.button_label && success.redirect_url && (
              <div>
                <a
                  href={success.redirect_url}
                  className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold mt-4"
                  style={{ background: color, color: "#fff" }}
                >
                  {success.button_label}
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
