import type { PublicCalendar, BookingAttribution } from "@/types/appointments";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers puros do widget de agendamento — extraídos de BookingClient.tsx para
// serem compartilhados entre a página pública /agendar/[slug] e o bloco
// Calendário do construtor de Formulários. Nenhuma lógica foi alterada.
// ─────────────────────────────────────────────────────────────────────────────

export function getPageSettings(cal: PublicCalendar) {
  return {
    title:           cal.settings?.page?.title           ?? cal.name,
    subtitle:        cal.settings?.page?.subtitle        ?? null,
    welcome_message: cal.settings?.page?.welcome_message ?? null,
    cover_image_url: cal.settings?.page?.cover_image_url ?? null,
    logo_url:        cal.settings?.page?.logo_url        ?? null,
    brand_color:     cal.settings?.page?.brand_color     ?? "#6366f1",
  };
}

export function getSuccessSettings(cal: PublicCalendar) {
  return {
    title:        cal.settings?.success?.title        ?? "Agendamento confirmado!",
    message:      cal.settings?.success?.message      ?? "Em breve você receberá os detalhes por e-mail.",
    button_label: cal.settings?.success?.button_label ?? null,
    redirect_url: cal.settings?.success?.redirect_url ?? null,
  };
}

export type StandardFieldVisibilityKey = "phone" | "company" | "role" | "city" | "notes";

export function getStandardFieldVisibility(
  cal: PublicCalendar,
  key: StandardFieldVisibilityKey,
) {
  return (cal.settings?.form?.standard_fields?.[key] as "required" | "optional" | "hidden" | undefined) ?? "optional";
}

export function formatDuration(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}min`;
}

export function formatLocationLabel(cal: PublicCalendar): string {
  if (cal.meeting_provider === "google_meet") return "Google Meet";
  if (cal.meeting_provider === "zoom")        return "Zoom";
  if (cal.meeting_provider === "teams")       return "Microsoft Teams";
  if (cal.meeting_provider === "whatsapp")    return "WhatsApp";
  if (cal.meeting_provider === "custom" && cal.custom_meeting_url) return "Link de reunião";
  if (cal.location_type === "in_person" && cal.location)  return cal.location;
  if (cal.location_type === "in_person")                  return "Presencial";
  return "";
}

export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const names = ["janeiro","fevereiro","março","abril","maio","junho",
                  "julho","agosto","setembro","outubro","novembro","dezembro"];
  return `${d} de ${names[m - 1]} de ${y}`;
}

export function getTodayInTz(tz: string): string {
  return new Date().toLocaleDateString("sv-SE", { timeZone: tz });
}

/** Coleta UTMs/fbclid/gclid da URL + cookies do Meta Pixel (_fbp/_fbc) uma
 *  única vez — mesma coleta feita originalmente em BookingClient.tsx, agora
 *  compartilhada com o bloco Calendário do formulário. */
export function collectBookingAttribution(): BookingAttribution {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const attr: BookingAttribution = {};
  const qpKeys: (keyof BookingAttribution)[] = [
    "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "fbclid", "gclid",
  ];
  for (const k of qpKeys) {
    const v = params.get(k);
    if (v) (attr as Record<string, string>)[k] = v;
  }
  const cookiePairs = document.cookie.split("; ").map(c => c.split("=") as [string, string]);
  const cookieMap   = Object.fromEntries(cookiePairs);
  if (cookieMap._fbp) attr.fbp = decodeURIComponent(cookieMap._fbp);
  if (cookieMap._fbc) attr.fbc = decodeURIComponent(cookieMap._fbc);
  if (document.referrer) attr.referrer = document.referrer;
  return attr;
}

/** Soma dias a uma data "YYYY-MM-DD" (aritmética em UTC, evita bug de DST). */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

const WEEKDAY_ABBR = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SÁB"];

/** Rótulo de um cartão da faixa de dias: abreviação do dia da semana + número. */
export function formatDayStripLabel(dateStr: string): { weekday: string; day: string } {
  const [, , d] = dateStr.split("-").map(Number);
  const dow = new Date(dateStr + "T12:00:00").getDay();
  return { weekday: WEEKDAY_ABBR[dow], day: String(d) };
}
