"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin, Check, AlertCircle, Loader2, Calendar } from "lucide-react";
import type {
  PublicCalendar,
  AdminSlot,
  BookingAttribution,
  CreatePublicBookingPayload,
  PublicBookingResult,
  AppointmentCustomField,
  StandardFieldVisibility,
} from "@/types/appointments";

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function getMonthName(m: number): string {
  return ["Janeiro","Fevereiro","Março","Abril","Maio","Junho",
          "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][m];
}

function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const names = ["janeiro","fevereiro","março","abril","maio","junho",
                  "julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${d} de ${names[m - 1]} de ${y}`;
}

function getTodayInTz(tz: string): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: tz });
}

function buildMonthGrid(year: number, month: number): (string | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
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

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = "date" | "time" | "form" | "success";

// ── Shared components ──────────────────────────────────────────────────────────

function Spinner({ size = 18 }: { size?: number }) {
  return <Loader2 size={size} className="animate-spin" style={{ color: "#94a3b8" }} />;
}

const INPUT_CLS  = "w-full px-3 py-2 rounded-lg text-sm outline-none border";
const INPUT_STYLE = { background: "#f8fafc", border: "1px solid #e2e8f0", color: "#0f172a" };
const LABEL_CLS  = "block text-xs font-medium mb-1";
const LABEL_STYLE = { color: "#64748b" };

// ── Custom field renderer ──────────────────────────────────────────────────────

function CustomFieldInput({ field, value, onChange, color }: {
  field:    AppointmentCustomField;
  value:    unknown;
  onChange: (v: unknown) => void;
  color:    string;
}) {
  if (field.type === "textarea") {
    return (
      <textarea
        value={(value as string) ?? ""}
        onChange={e => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        className={`${INPUT_CLS} resize-none`}
        style={INPUT_STYLE}
      />
    );
  }
  if (field.type === "select") {
    return (
      <select value={(value as string) ?? ""} onChange={e => onChange(e.target.value)} className={INPUT_CLS} style={INPUT_STYLE}>
        <option value="">Selecione...</option>
        {(field.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (field.type === "radio") {
    return (
      <div className="space-y-1.5">
        {(field.options ?? []).map(o => (
          <label key={o} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "#334155" }}>
            <input type="radio" checked={(value as string) === o} onChange={() => onChange(o)} style={{ accentColor: color }} />
            {o}
          </label>
        ))}
      </div>
    );
  }
  if (field.type === "multiselect" || field.type === "checkbox") {
    const selected = (value as string[]) ?? [];
    const toggle   = (o: string) => {
      const next = selected.includes(o) ? selected.filter(x => x !== o) : [...selected, o];
      onChange(next);
    };
    return (
      <div className="space-y-1.5">
        {(field.options ?? []).map(o => (
          <label key={o} className="flex items-center gap-2 cursor-pointer text-sm" style={{ color: "#334155" }}>
            <input type="checkbox" checked={selected.includes(o)} onChange={() => toggle(o)} style={{ accentColor: color }} />
            {o}
          </label>
        ))}
      </div>
    );
  }
  const inputType =
    field.type === "email"  ? "email"  :
    field.type === "number" ? "number" :
    field.type === "date"   ? "date"   :
    field.type === "time"   ? "time"   :
    field.type === "url"    ? "url"    :
    field.type === "phone"  ? "tel"    : "text";

  return (
    <input
      type={inputType}
      value={(value as string) ?? ""}
      onChange={e => onChange(e.target.value)}
      placeholder={field.placeholder}
      className={INPUT_CLS}
      style={INPUT_STYLE}
    />
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function BookingClient({ slug }: { slug: string }) {
  const [calendar,          setCalendar]          = useState<PublicCalendar | null>(null);
  const [availableWeekdays, setAvailableWeekdays] = useState<number[]>([]);
  const [isLoading,         setIsLoading]         = useState(true);
  const [loadError,         setLoadError]         = useState<string | null>(null);

  const [step,              setStep]              = useState<Step>("date");
  const [selectedDate,      setSelectedDate]      = useState<string | null>(null);
  const [slots,             setSlots]             = useState<AdminSlot[]>([]);
  const [isFetchingSlots,   setIsFetchingSlots]   = useState(false);
  const [selectedSlot,      setSelectedSlot]      = useState<AdminSlot | null>(null);

  const todayRef = useMemo(() => {
    if (!calendar) return new Date();
    const str = getTodayInTz(calendar.timezone);
    const [y, m, d] = str.split("-").map(Number);
    return new Date(y, m - 1, d);
  }, [calendar]);

  const [viewYear,  setViewYear]  = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  const [visitorName,     setVisitorName]     = useState("");
  const [visitorEmail,    setVisitorEmail]    = useState("");
  const [visitorPhone,    setVisitorPhone]    = useState("");
  const [visitorCompany,  setVisitorCompany]  = useState("");
  const [visitorRole,     setVisitorRole]     = useState("");
  const [visitorCity,     setVisitorCity]     = useState("");
  const [visitorNotes,    setVisitorNotes]    = useState("");
  const [customResponses, setCustomResponses] = useState<Record<string, unknown>>({});
  const [lgpdAccepted,    setLgpdAccepted]    = useState(false);
  const [isSubmitting,    setIsSubmitting]    = useState(false);
  const [submitError,     setSubmitError]     = useState<string | null>(null);
  const [bookingResult,   setBookingResult]   = useState<PublicBookingResult | null>(null);

  // Collect attribution data once on mount (UTMs, fbclid, gclid, cookies)
  const [attributionData] = useState<BookingAttribution>(() => {
    if (typeof window === "undefined") return {};
    const params   = new URLSearchParams(window.location.search);
    const attr: BookingAttribution = {};
    const qpKeys: (keyof BookingAttribution)[] = [
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid",
    ];
    for (const k of qpKeys) {
      const v = params.get(k);
      if (v) (attr as Record<string, string>)[k] = v;
    }
    // Facebook Pixel cookies
    const cookiePairs = document.cookie.split("; ").map(c => c.split("=") as [string, string]);
    const cookieMap   = Object.fromEntries(cookiePairs);
    if (cookieMap._fbp) attr.fbp = decodeURIComponent(cookieMap._fbp);
    if (cookieMap._fbc) attr.fbc = decodeURIComponent(cookieMap._fbc);
    if (document.referrer) attr.referrer = document.referrer;
    return attr;
  });

  useEffect(() => {
    fetch(`/api/agendar/${slug}`, { cache: "no-store" })
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

  const fetchSlots = useCallback(async (dateStr: string) => {
    setSlots([]);
    setIsFetchingSlots(true);
    try {
      const res  = await fetch(`/api/agendar/${slug}/slots?date=${dateStr}`, { cache: "no-store" });
      const data = await res.json() as { slots?: AdminSlot[]; error?: string };
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setIsFetchingSlots(false);
    }
  }, [slug]);

  const selectDate = useCallback(async (dateStr: string) => {
    if (!isDayAvailable(dateStr)) return;
    setSelectedDate(dateStr);
    setSelectedSlot(null);
    setStep("time");
    await fetchSlots(dateStr);
  }, [isDayAvailable, fetchSlots]);

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

    const payload: CreatePublicBookingPayload = {
      starts_at:             selectedSlot.startsAt,
      visitor_name:          visitorName.trim(),
      visitor_email:         visitorEmail.trim(),
      visitor_phone:         visitorPhone.trim()   || undefined,
      visitor_company:       visitorCompany.trim() || undefined,
      visitor_role:          visitorRole.trim()    || undefined,
      visitor_city:          visitorCity.trim()    || undefined,
      visitor_notes:         visitorNotes.trim()   || undefined,
      visitor_timezone:      Intl.DateTimeFormat().resolvedOptions().timeZone,
      custom_form_responses: customResponses,
      lgpd_accepted:         lgpdAccepted || undefined,
      attribution:           attributionData,
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
          setStep("time");
          setSelectedSlot(null);
          if (selectedDate) await fetchSlots(selectedDate);
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

  // ── Loading ────────────────────────────────────────────────────────────────

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
        <AlertCircle size={36} style={{ color: "#ef4444" }} />
        <p style={{ color: "#64748b" }}>{loadError ?? "Calendário não encontrado"}</p>
      </div>
    );
  }

  const lgpd = calendar.settings?.lgpd;
  const showLgpd = lgpd?.enabled && lgpd.title;
  const getVisibility = (key: Parameters<typeof getStandardFieldVisibility>[1]) =>
    getStandardFieldVisibility(calendar, key);
  const sortedCustomFields = [...(calendar.custom_fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // ── Calendar widget (shared between desktop left panel and mobile) ──────────

  const CalendarWidget = (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronLeft size={14} style={{ color: "#64748b" }} />
        </button>
        <span className="text-sm font-semibold" style={{ color: "#0f172a" }}>
          {getMonthName(viewMonth)} {viewYear}
        </span>
        <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronRight size={14} style={{ color: "#64748b" }} />
        </button>
      </div>

      {/* Day headers — single letter */}
      <div className="grid grid-cols-7 mb-1">
        {["D","S","T","Q","Q","S","S"].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium py-1" style={{ color: "#94a3b8" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells — compact */}
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`e-${i}`} />;
          const day       = Number(dateStr.split("-")[2]);
          const available = isDayAvailable(dateStr);
          const isToday   = dateStr === today;
          const selected  = dateStr === selectedDate;
          return (
            <button
              key={dateStr}
              type="button"
              disabled={!available}
              onClick={() => selectDate(dateStr)}
              className="w-8 h-8 mx-auto flex items-center justify-center text-xs rounded-lg font-medium transition-all"
              style={{
                color: selected ? "#fff" : available ? (isToday ? color : "#334155") : "#d1d5db",
                background: selected ? color : (isToday && available) ? `${color}18` : "transparent",
                fontWeight: isToday ? 700 : undefined,
                cursor: available ? "pointer" : "default",
              }}
              onMouseOver={e => { if (available && !selected) e.currentTarget.style.background = `${color}18`; }}
              onMouseOut={e => { if (!selected) e.currentTarget.style.background = (isToday && available) ? `${color}18` : "transparent"; }}
            >
              {day}
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[10px]" style={{ color: "#94a3b8" }}>
        Fuso: {calendar.timezone}
      </p>
    </div>
  );

  // ── Slots panel ────────────────────────────────────────────────────────────

  const SlotsPanel = (
    <div>
      {selectedDate && (
        <p className="text-xs font-semibold mb-3 capitalize" style={{ color: "#334155" }}>
          {formatDate(selectedDate)}
        </p>
      )}
      {isFetchingSlots ? (
        <div className="grid grid-cols-3 gap-1.5">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg animate-pulse" style={{ background: "#e2e8f0" }} />
          ))}
        </div>
      ) : !selectedDate ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Calendar size={24} className="mb-2" style={{ color: "#cbd5e1" }} />
          <p className="text-xs" style={{ color: "#94a3b8" }}>Selecione uma data</p>
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-8">
          <Calendar size={24} className="mx-auto mb-2" style={{ color: "#94a3b8" }} />
          <p className="text-xs" style={{ color: "#64748b" }}>Nenhum horário disponível</p>
          <button
            type="button"
            onClick={() => { setStep("date"); setSelectedDate(null); }}
            className="mt-3 text-xs font-medium underline"
            style={{ color }}
          >
            Escolher outra data
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {slots.map(slot => (
            <button
              key={slot.startsAt}
              type="button"
              onClick={() => selectSlot(slot)}
              className="py-1.5 text-xs font-medium rounded-lg border transition-all text-center"
              style={{ borderColor: "#e2e8f0", color: "#334155", background: "#f8fafc" }}
              onMouseOver={e => {
                e.currentTarget.style.background   = `${color}12`;
                e.currentTarget.style.borderColor  = color;
                e.currentTarget.style.color        = color;
              }}
              onMouseOut={e => {
                e.currentTarget.style.background   = "#f8fafc";
                e.currentTarget.style.borderColor  = "#e2e8f0";
                e.currentTarget.style.color        = "#334155";
              }}
            >
              {slot.startsAtLocal}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-dvh" style={{ background: "#f1f5f9" }}>
      {page.cover_image_url && (
        <div
          className="w-full h-24 sm:h-36 bg-cover bg-center"
          style={{ backgroundImage: `url(${page.cover_image_url})` }}
        />
      )}

      <div className="max-w-3xl mx-auto px-4 py-5 sm:py-7">
        {/* ── Compact header ──────────────────────────────────────────── */}
        <div
          className="rounded-2xl p-4 sm:p-5 mb-4 shadow-sm"
          style={{ background: "#fff", border: "1px solid #e2e8f0" }}
        >
          {page.logo_url && (
            <img src={page.logo_url} alt="Logo" className="h-7 mb-3 object-contain" />
          )}
          <h1 className="text-lg sm:text-xl font-bold mb-0.5" style={{ color: "#0f172a" }}>
            {page.title}
          </h1>
          {page.subtitle && (
            <p className="text-sm mb-2" style={{ color: "#475569" }}>{page.subtitle}</p>
          )}
          <div className="flex flex-wrap items-center gap-3 text-xs" style={{ color: "#64748b" }}>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {formatDuration(calendar.duration_minutes)}
            </span>
            {location && (
              <span className="flex items-center gap-1">
                <MapPin size={12} />
                {location}
              </span>
            )}
          </div>
          {page.welcome_message && (
            <p className="mt-3 text-xs leading-relaxed" style={{ color: "#475569" }}>
              {page.welcome_message}
            </p>
          )}
        </div>

        {/* ── Date + Time selection (2-col on desktop) ──────────────── */}
        {(step === "date" || step === "time") && (
          <div className="md:flex md:gap-4">
            {/* Calendar panel — always visible on desktop, hidden on mobile during time step */}
            <div className={`${step === "time" ? "hidden md:block" : ""} md:w-[256px] flex-shrink-0`}>
              <div
                className="rounded-2xl p-4 shadow-sm"
                style={{ background: "#fff", border: "1px solid #e2e8f0" }}
              >
                {CalendarWidget}
              </div>
            </div>

            {/* Slots panel — visible during time step, or empty hint on desktop */}
            <div className={`flex-1 mt-4 md:mt-0 ${step === "date" ? "hidden md:block" : ""}`}>
              <div
                className="rounded-2xl p-4 shadow-sm h-full"
                style={{ background: "#fff", border: "1px solid #e2e8f0", minHeight: "240px" }}
              >
                {/* Mobile back button */}
                {step === "time" && (
                  <button
                    type="button"
                    onClick={() => { setStep("date"); setSelectedSlot(null); }}
                    className="flex items-center gap-1 text-xs mb-3 md:hidden"
                    style={{ color: "#64748b" }}
                  >
                    <ChevronLeft size={14} />
                    Voltar
                  </button>
                )}
                {SlotsPanel}
              </div>
            </div>
          </div>
        )}

        {/* ── Form ──────────────────────────────────────────────────── */}
        {step === "form" && selectedSlot && (
          <div
            className="rounded-2xl p-4 sm:p-5 shadow-sm"
            style={{ background: "#fff", border: "1px solid #e2e8f0" }}
          >
            {/* Summary bar */}
            <div
              className="flex items-center gap-2.5 p-2.5 rounded-xl mb-4"
              style={{ background: `${color}0f`, border: `1px solid ${color}28` }}
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: color }}
              >
                <Check size={13} color="#fff" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: "#0f172a" }}>
                  {selectedDate && formatDate(selectedDate)} · {selectedSlot.startsAtLocal}
                </p>
                <p className="text-[10px]" style={{ color: "#64748b" }}>
                  {formatDuration(calendar.duration_minutes)}{location ? ` · ${location}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setStep("time"); setSelectedSlot(null); setSubmitError(null); }}
                className="text-xs font-medium shrink-0"
                style={{ color }}
              >
                Alterar
              </button>
            </div>

            <p className="text-sm font-semibold mb-4" style={{ color: "#0f172a" }}>Seus dados</p>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className={LABEL_CLS} style={LABEL_STYLE}>Nome completo *</label>
                <input type="text" value={visitorName} onChange={e => setVisitorName(e.target.value)}
                  required placeholder="Seu nome" className={INPUT_CLS} style={INPUT_STYLE} />
              </div>
              <div>
                <label className={LABEL_CLS} style={LABEL_STYLE}>E-mail *</label>
                <input type="email" value={visitorEmail} onChange={e => setVisitorEmail(e.target.value)}
                  required placeholder="seu@email.com" className={INPUT_CLS} style={INPUT_STYLE} />
              </div>

              {getVisibility("phone") !== "hidden" && (
                <div>
                  <label className={LABEL_CLS} style={LABEL_STYLE}>
                    Telefone {getVisibility("phone") === "required" ? "*" : "(opcional)"}
                  </label>
                  <input type="tel" value={visitorPhone} onChange={e => setVisitorPhone(e.target.value)}
                    required={getVisibility("phone") === "required"}
                    placeholder="+55 (11) 99999-9999" className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
              )}
              {getVisibility("company") !== "hidden" && (
                <div>
                  <label className={LABEL_CLS} style={LABEL_STYLE}>
                    Empresa {getVisibility("company") === "required" ? "*" : "(opcional)"}
                  </label>
                  <input type="text" value={visitorCompany} onChange={e => setVisitorCompany(e.target.value)}
                    required={getVisibility("company") === "required"}
                    placeholder="Nome da empresa" className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
              )}
              {getVisibility("role") !== "hidden" && (
                <div>
                  <label className={LABEL_CLS} style={LABEL_STYLE}>
                    Cargo {getVisibility("role") === "required" ? "*" : "(opcional)"}
                  </label>
                  <input type="text" value={visitorRole} onChange={e => setVisitorRole(e.target.value)}
                    required={getVisibility("role") === "required"}
                    placeholder="Seu cargo" className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
              )}
              {getVisibility("city") !== "hidden" && (
                <div>
                  <label className={LABEL_CLS} style={LABEL_STYLE}>
                    Cidade {getVisibility("city") === "required" ? "*" : "(opcional)"}
                  </label>
                  <input type="text" value={visitorCity} onChange={e => setVisitorCity(e.target.value)}
                    required={getVisibility("city") === "required"}
                    placeholder="Sua cidade" className={INPUT_CLS} style={INPUT_STYLE} />
                </div>
              )}

              {sortedCustomFields.map(field => (
                <div key={field.id}>
                  <label className={LABEL_CLS} style={LABEL_STYLE}>
                    {field.label} {field.required ? "*" : "(opcional)"}
                  </label>
                  <CustomFieldInput
                    field={field}
                    value={customResponses[field.id]}
                    onChange={v => setCustomResponses(prev => ({ ...prev, [field.id]: v }))}
                    color={color}
                  />
                  {field.help && <p className="mt-1 text-[10px]" style={{ color: "#94a3b8" }}>{field.help}</p>}
                </div>
              ))}

              {getVisibility("notes") !== "hidden" && (
                <div>
                  <label className={LABEL_CLS} style={LABEL_STYLE}>
                    Observações {getVisibility("notes") === "required" ? "*" : "(opcional)"}
                  </label>
                  <textarea value={visitorNotes} onChange={e => setVisitorNotes(e.target.value)}
                    required={getVisibility("notes") === "required"}
                    placeholder="Alguma informação adicional?" rows={3}
                    className={`${INPUT_CLS} resize-none`} style={INPUT_STYLE} />
                </div>
              )}

              {showLgpd && (
                <div className="p-3 rounded-xl" style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={lgpdAccepted} onChange={e => setLgpdAccepted(e.target.checked)}
                      required className="mt-0.5 shrink-0" style={{ accentColor: color }} />
                    <span className="text-xs leading-relaxed" style={{ color: "#475569" }}>
                      {lgpd!.text || "Li e aceito a "}
                      {lgpd!.link ? (
                        <a href={lgpd!.link} target="_blank" rel="noopener noreferrer" className="underline" style={{ color }}>
                          {lgpd!.title}
                        </a>
                      ) : (
                        <span style={{ color }}>{lgpd!.title}</span>
                      )}
                    </span>
                  </label>
                </div>
              )}

              {submitError && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg text-xs"
                  style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}>
                  <AlertCircle size={13} className="shrink-0" />
                  {submitError}
                </div>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep("time"); setSelectedSlot(null); setSubmitError(null); }}
                  className="px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ background: "#f1f5f9", color: "#64748b" }}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-60"
                  style={{ background: color, color: "#fff" }}
                >
                  {isSubmitting && <Loader2 size={13} className="animate-spin" />}
                  Confirmar agendamento
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Success ───────────────────────────────────────────────── */}
        {step === "success" && success && bookingResult && (
          <div
            className="rounded-2xl p-8 text-center shadow-sm"
            style={{ background: "#fff", border: "1px solid #e2e8f0" }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: `${color}15` }}
            >
              <Check size={22} style={{ color }} />
            </div>
            <h2 className="text-xl font-bold mb-2" style={{ color: "#0f172a" }}>{success.title}</h2>
            <p className="text-sm leading-relaxed mb-4" style={{ color: "#64748b" }}>{success.message}</p>
            <div
              className="inline-block px-3 py-1.5 rounded-lg text-xs mb-4"
              style={{ background: "#f1f5f9", color: "#475569" }}
            >
              {selectedDate && formatDate(selectedDate)} · {selectedSlot?.startsAtLocal}
            </div>
            {success.redirect_url && (
              <p className="text-xs" style={{ color: "#94a3b8" }}>Redirecionando em instantes...</p>
            )}
            {success.button_label && success.redirect_url && (
              <div>
                <a
                  href={success.redirect_url}
                  className="inline-block px-5 py-2 rounded-lg text-sm font-semibold mt-3"
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
