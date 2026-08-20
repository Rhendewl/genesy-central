import { COMMERCIAL_PRODUCT_LABELS, type CommercialAnalysisInput } from "@/types/commercial-analysis";

const NUMBER_FIELDS = [
  "leads_received", "leads_contacted", "leads_responded", "leads_no_response", "qualified_leads",
  "disqualified_leads", "hot_leads", "warm_leads", "cold_leads", "meetings_scheduled", "meetings_held",
  "no_shows", "rescheduled_meetings", "qualified_meetings", "proposals_sent", "sales_closed", "revenue", "lost_sales",
] as const;
const TEXT_FIELDS = [
  "participants", "development_name", "response_notes", "lead_profile_notes", "meeting_notes", "loss_reasons",
  "wins", "blockers", "decisions", "next_actions",
] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseCommercialAnalysisInput(body: Record<string, unknown>): CommercialAnalysisInput {
  const clientId = typeof body.client_id === "string" ? body.client_id : "";
  const meetingDate = typeof body.meeting_date === "string" ? body.meeting_date : "";
  const periodStart = typeof body.period_start === "string" ? body.period_start : "";
  const periodEnd = typeof body.period_end === "string" ? body.period_end : "";
  const productType = typeof body.product_type === "string" ? body.product_type : "";
  if (!clientId) throw new Error("Selecione um cliente");
  if (![meetingDate, periodStart, periodEnd].every((value) => DATE_RE.test(value)) || periodEnd < periodStart) throw new Error("Período inválido");
  if (!(productType in COMMERCIAL_PRODUCT_LABELS)) throw new Error("Selecione a tipologia do produto");

  const parsed: Record<string, unknown> = {
    client_id: clientId, meeting_date: meetingDate, period_start: periodStart, period_end: periodEnd, product_type: productType,
  };
  for (const field of NUMBER_FIELDS) {
    const value = Number(body[field] ?? 0);
    if (!Number.isFinite(value) || value < 0) throw new Error("Os indicadores devem ser números positivos");
    parsed[field] = value;
  }
  for (const field of TEXT_FIELDS) parsed[field] = typeof body[field] === "string" && body[field].trim() ? body[field].trim() : null;
  return parsed as unknown as CommercialAnalysisInput;
}
