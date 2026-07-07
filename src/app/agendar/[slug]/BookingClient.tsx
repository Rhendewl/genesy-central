"use client";

import { useState, useCallback } from "react";
import { Clock, MapPin, Check, AlertCircle, Loader2 } from "lucide-react";
import type {
  AdminSlot,
  CreatePublicBookingPayload,
  PublicBookingResult,
  AppointmentCustomField,
} from "@/types/appointments";
import { useBookingWidget } from "@/hooks/useBookingWidget";
import { BookingDayStrip } from "@/components/shared/calendar/BookingDayStrip";
import { BookingSlotsPanel } from "@/components/shared/calendar/BookingSlotsPanel";
import {
  getPageSettings, getSuccessSettings, getStandardFieldVisibility,
  formatDuration, formatLocationLabel, formatDate, collectBookingAttribution,
  type StandardFieldVisibilityKey,
} from "@/lib/booking-widget/format";

// ── Types ──────────────────────────────────────────────────────────────────────

type Step = "picking" | "form" | "success";

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
  const {
    calendar, isLoading, loadError,
    visibleDays, today,
    selectedDate, selectDate,
    slots, isFetchingSlots, fetchSlots,
  } = useBookingWidget(slug);

  const [step,              setStep]              = useState<Step>("picking");
  const [selectedSlot,      setSelectedSlot]      = useState<AdminSlot | null>(null);

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
  const [attributionData] = useState(collectBookingAttribution);

  const page     = calendar ? getPageSettings(calendar) : null;
  const success  = calendar ? getSuccessSettings(calendar) : null;
  const color    = page?.brand_color ?? "#6366f1";
  const location = calendar ? formatLocationLabel(calendar) : "";

  const handleSelectDate = useCallback((dateStr: string) => {
    setSelectedSlot(null);
    void selectDate(dateStr);
  }, [selectDate]);

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
          setStep("picking");
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
  const getVisibility = (key: StandardFieldVisibilityKey) =>
    getStandardFieldVisibility(calendar, key);
  const sortedCustomFields = [...(calendar.custom_fields ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

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

        {/* ── Escolha de data/horário — quadrante único ───────────────── */}
        {step === "picking" && (
          <div className="rounded-2xl p-4 sm:p-5 shadow-sm" style={{ background: "#fff", border: "1px solid #e2e8f0" }}>
            <p className="text-base font-bold mb-4" style={{ color: "#0f172a" }}>Escolha um horário</p>

            <BookingDayStrip
              visibleDays={visibleDays}
              selectedDate={selectedDate}
              today={today}
              color={color}
              cardBg="#f8fafc"
              borderC="#e2e8f0"
              textColor="#0f172a"
              muted="#94a3b8"
              onSelectDate={handleSelectDate}
            />

            <div className="mt-4">
              <BookingSlotsPanel
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                isFetchingSlots={isFetchingSlots}
                slots={slots}
                color={color}
                cardBg="#f8fafc"
                borderC="#e2e8f0"
                textColor="#334155"
                muted="#94a3b8"
                onSelectSlot={selectSlot}
              />
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
                onClick={() => { setStep("picking"); setSelectedSlot(null); setSubmitError(null); }}
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
                  onClick={() => { setStep("picking"); setSelectedSlot(null); setSubmitError(null); }}
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
