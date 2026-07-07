"use client";

import { useState, useCallback, useMemo } from "react";
import { Check, AlertCircle, Loader2 } from "lucide-react";
import type { FormStep, FormTheme } from "@/types";
import type { AdminSlot, CreatePublicBookingPayload, PublicBookingResult } from "@/types/appointments";
import { useBookingWidget } from "@/hooks/useBookingWidget";
import { BookingDayStrip } from "@/components/shared/calendar/BookingDayStrip";
import { BookingSlotsPanel } from "@/components/shared/calendar/BookingSlotsPanel";
import { extractContactFromAnswers } from "@/lib/forms/extract-contact";
import { formatDuration, formatLocationLabel, formatDate, collectBookingAttribution } from "@/lib/booking-widget/format";
import { resolveThemeColors } from "@/lib/forms/theme-colors";
import { LeadScoreEngine } from "@/lib/crm/lead-score-engine";

// ─────────────────────────────────────────────────────────────────────────────
// CalendarStepField — o bloco "Calendário" do construtor de Formulários.
//
// Reaproveita o mesmo hook (useBookingWidget) e os mesmos componentes de UI
// (BookingDayStrip/BookingSlotsPanel) já usados em /agendar/[slug], e chama o
// mesmo endpoint público POST /api/agendar/{slug}/book, inalterado —
// disponibilidade, buffers, Google Calendar, concorrência e o evento de
// conversão do agendamento continuam 100% do lado da Agenda.
//
// Layout em quadrante único (faixa de dias → horários → o que faltar → botão),
// sem alternância de telas por breakpoint — mesmo visual em qualquer largura.
//
// Diferente da página standalone: não repete "seus dados" quando já foram
// coletados em blocos anteriores do formulário, nem a tela de sucesso própria
// — confirma e avança o formulário automaticamente. Nome e e-mail são
// exigidos pelo endpoint de booking; se algum não veio de um step anterior,
// um campo mínimo aparece só depois de escolher o horário (não antes).
// ─────────────────────────────────────────────────────────────────────────────

export interface CalendarStepFieldProps {
  step:        FormStep;
  formSteps:   FormStep[];
  formAnswers: Record<string, unknown>;
  /** Tema do formulário — o bloco segue as mesmas cores dos demais blocos
   *  (fundo, texto, cor principal), não um esquema de cores próprio. */
  theme?:      Partial<FormTheme>;
  onChange:    (value: unknown) => void;
  onNext:      () => void;
}

export function CalendarStepField({ step, formSteps, formAnswers, theme, onChange, onNext }: CalendarStepFieldProps) {
  const { primary, textColor, muted, cardBg, borderC, widgetBg } = resolveThemeColors(theme);
  // "var(--primary)" não pode ser usado com sufixo de alpha hex (ex. `${cor}18`)
  // — cai num fallback sólido só nesse caso-limite; fora isso, é a cor do tema.
  const safeColor = primary && !primary.startsWith("var(") ? primary : "#22c55e";
  const {
    calendar, isLoading, loadError,
    visibleDays, today,
    selectedDate, selectDate,
    slots, isFetchingSlots,
  } = useBookingWidget(step.calendarSlug);

  const [selectedSlot, setSelectedSlot] = useState<AdminSlot | null>(null);
  const [manualName,   setManualName]   = useState("");
  const [manualEmail,  setManualEmail]  = useState("");
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError,  setSubmitError]  = useState<string | null>(null);
  const [confirmed,    setConfirmed]    = useState(false);
  const [attributionData] = useState(collectBookingAttribution);

  const contact = useMemo(
    () => extractContactFromAnswers(formSteps, formAnswers),
    [formSteps, formAnswers],
  );

  // IQ já calculável neste ponto (mesmas perguntas/respostas que o próprio
  // formulário usa em createCrmLead) — enviado junto no booking pra que o
  // lead criado do lado da Agenda (booking-crm-sync-service, integração
  // separada da do formulário) também carregue o mesmo IQ, em vez de ficar
  // "não aplicável" só por ter sido criado por outra integração.
  const sourceIqScore = useMemo(
    () => LeadScoreEngine.calculateIQ(formSteps, formAnswers),
    [formSteps, formAnswers],
  );

  const location  = calendar ? formatLocationLabel(calendar) : "";
  const lgpd      = calendar?.settings?.lgpd;
  const needsLgpd = !!(lgpd?.enabled && lgpd.title);

  // Nome/e-mail já coletados em steps anteriores não são pedidos de novo —
  // só aparece um campo mínimo para o que faltar (obrigatório pro booking).
  const needsName    = !contact.name;
  const needsEmail   = !contact.email;
  const needsDetails = needsName || needsEmail || needsLgpd;
  const finalName    = (contact.name  ?? manualName).trim();
  const finalEmail   = (contact.email ?? manualEmail).trim();
  const emailValid   = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail);
  const canConfirm   = !!finalName && emailValid && (!needsLgpd || lgpdAccepted);

  const handleSelectDate = useCallback((dateStr: string) => {
    setSelectedSlot(null);
    void selectDate(dateStr);
  }, [selectDate]);

  const confirmBooking = useCallback(async (slot: AdminSlot) => {
    if (!step.calendarSlug) return;
    setIsSubmitting(true);
    setSubmitError(null);

    const payload: CreatePublicBookingPayload = {
      starts_at:             slot.startsAt,
      visitor_name:          finalName,
      visitor_email:         finalEmail,
      visitor_phone:         contact.phone || undefined,
      visitor_timezone:      Intl.DateTimeFormat().resolvedOptions().timeZone,
      custom_form_responses: { _source: "form", _form_step_id: step.id, _source_iq_score: sourceIqScore },
      lgpd_accepted:         lgpdAccepted || undefined,
      attribution:           attributionData,
    };

    try {
      const res  = await fetch(`/api/agendar/${step.calendarSlug}/book`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
      });
      const data = await res.json() as { booking?: PublicBookingResult; error?: string };
      if (!res.ok) {
        setSubmitError(data.error ?? "Erro ao confirmar agendamento. Tente novamente.");
        if (res.status === 409) {
          setSelectedSlot(null);
          if (selectedDate) await selectDate(selectedDate);
        }
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
      setConfirmed(true);
      onChange({
        bookingId:  data.booking?.booking_id ?? null,
        startsAt:   slot.startsAt,
        endsAt:     slot.endsAt,
        calendarId: step.calendarId ?? null,
      });
      setTimeout(() => onNext(), 700);
    } catch {
      setSubmitError("Erro de conexão. Verifique sua internet e tente novamente.");
      setIsSubmitting(false);
    }
  }, [step.calendarSlug, step.calendarId, step.id, finalName, finalEmail, contact.phone, lgpdAccepted, attributionData, sourceIqScore, selectedDate, selectDate, onChange, onNext]);

  const selectSlot = useCallback((slot: AdminSlot) => {
    setSelectedSlot(slot);
    setSubmitError(null);
    if (needsDetails) return; // aguarda nome/e-mail/LGPD antes de confirmar
    void confirmBooking(slot);
  }, [needsDetails, confirmBooking]);

  if (!step.calendarSlug) {
    return (
      <div
        className="rounded-xl p-4 text-sm"
        style={{ background: "var(--card)", border: "1px solid var(--border)", color: "var(--muted-foreground)" }}
      >
        Nenhum calendário configurado neste bloco.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl p-8 flex items-center justify-center" style={{ background: widgetBg, border: `1px solid ${borderC}` }}>
        <Loader2 size={20} className="animate-spin" style={{ color: muted }} />
      </div>
    );
  }

  if (loadError || !calendar) {
    return (
      <div className="rounded-2xl p-6 flex items-center gap-2 text-sm" style={{ background: widgetBg, border: `1px solid ${borderC}`, color: muted }}>
        <AlertCircle size={16} style={{ color: "#ef4444" }} />
        {loadError ?? "Calendário não encontrado"}
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="rounded-2xl p-6" style={{ background: `${safeColor}14`, border: `1px solid ${safeColor}40` }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${safeColor}25` }}>
            <Check size={18} style={{ color: safeColor }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: textColor }}>
              {selectedDate && selectedSlot ? `${formatDate(selectedDate)} · ${selectedSlot.startsAtLocal}` : "Agendamento"}, confirmado
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 sm:p-5" style={{ background: widgetBg, border: `1px solid ${borderC}` }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-base font-bold" style={{ color: textColor }}>Escolha um horário</p>
        <div className="flex items-center gap-2 text-xs" style={{ color: muted }}>
          <span>{formatDuration(calendar.duration_minutes)}</span>
          {location && <span>· {location}</span>}
        </div>
      </div>

      <BookingDayStrip
        visibleDays={visibleDays}
        selectedDate={selectedDate}
        today={today}
        color={safeColor}
        cardBg={cardBg}
        borderC={borderC}
        textColor={textColor}
        muted={muted}
        onSelectDate={handleSelectDate}
      />

      <div className="mt-4">
        <BookingSlotsPanel
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          isFetchingSlots={isFetchingSlots}
          slots={slots}
          color={safeColor}
          cardBg={cardBg}
          borderC={borderC}
          textColor={textColor}
          muted={muted}
          onSelectSlot={selectSlot}
        />
      </div>

      {selectedSlot && needsDetails && (
        <div className="mt-4 p-3 rounded-xl space-y-2.5" style={{ background: cardBg, border: `1px solid ${borderC}` }}>
          {needsName && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Nome completo *</label>
              <input
                type="text"
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="Seu nome"
                autoFocus
                className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                style={{ background: cardBg, border: `1px solid ${borderC}`, color: textColor }}
              />
            </div>
          )}
          {needsEmail && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: muted }}>Digite o e-mail que você mais usa 👇🏻</label>
              <input
                type="email"
                value={manualEmail}
                onChange={e => setManualEmail(e.target.value)}
                placeholder="seu@email.com"
                autoFocus={!needsName}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                style={{ background: cardBg, border: `1px solid ${borderC}`, color: textColor }}
              />
            </div>
          )}
          {needsLgpd && (
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={lgpdAccepted}
                onChange={e => setLgpdAccepted(e.target.checked)}
                className="mt-0.5 shrink-0"
                style={{ accentColor: safeColor }}
              />
              <span className="text-xs leading-relaxed" style={{ color: muted }}>
                {lgpd!.text || "Li e aceito a "}
                {lgpd!.link ? (
                  <a href={lgpd!.link} target="_blank" rel="noopener noreferrer" className="underline" style={{ color: safeColor }}>
                    {lgpd!.title}
                  </a>
                ) : (
                  <span style={{ color: safeColor }}>{lgpd!.title}</span>
                )}
              </span>
            </label>
          )}
          <button
            type="button"
            disabled={!canConfirm || isSubmitting}
            onClick={() => void confirmBooking(selectedSlot)}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{ background: safeColor, color: "#fff" }}
          >
            {isSubmitting && <Loader2 size={13} className="animate-spin" />}
            Confirmar agendamento
          </button>
        </div>
      )}

      {!needsDetails && selectedSlot && isSubmitting && (
        <div className="mt-4 flex items-center justify-center gap-2 text-xs" style={{ color: muted }}>
          <Loader2 size={13} className="animate-spin" />
          Confirmando agendamento...
        </div>
      )}

      {submitError && (
        <div
          className="mt-4 flex items-center gap-2 p-2.5 rounded-lg text-xs"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}
        >
          <AlertCircle size={13} className="shrink-0" />
          {submitError}
        </div>
      )}
    </div>
  );
}
