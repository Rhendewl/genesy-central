import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusEvent } from "@/lib/event-bus/types";
import type { LeadStageEnteredPayload } from "@/lib/event-bus/domain-events";
import { buildIdentitySignals, type IdentitySignals, type LeadIdentityInput, type SessionIdentityInput } from "./identity-signals";

// ─────────────────────────────────────────────────────────────────────────────
// Conversion Engine — EventContext
//
// Single enrichment point for all conversion providers. buildEventContext()
// loads lead + submission + session in two parallel queries, assembles
// Attribution and MatchKeys, and returns a complete, self-contained object.
//
// After this point, providers receive only EventContext and their own
// platform credentials. No provider queries the database for event data,
// performs joins, or touches PII directly.
// ─────────────────────────────────────────────────────────────────────────────

// ── Attribution ──────────────────────────────────────────────────────────────

export interface Attribution {
  utm_source?:       string;
  utm_medium?:       string;
  utm_campaign?:     string;
  utm_term?:         string;
  utm_content?:      string;
  fbclid?:           string;
  gclid?:            string;
  referrer?:         string;
  event_source_url?: string;
}

// ── EventContext ──────────────────────────────────────────────────────────────

export interface EventContext {
  // ── Event identifiers ───────────────────────────────────────────────────
  eventId:        string;
  eventTimestamp: number;
  correlationId:  string;

  // ── CRM positioning ─────────────────────────────────────────────────────
  leadId:      string;
  pipelineId:  string;
  stageId:     string;
  fromStageId: string | null;
  userId:      string;

  // ── Contact (from leads table) ───────────────────────────────────────────
  lead: {
    name:          string;
    contact:       string;
    email:         string | null;
    source:        string;
    campaign_name: string | null;
    ad_name:       string | null;
    deal_value:    number;
  };

  // ── Form submission (null for leads not originating from a form) ─────────
  submission: {
    id:      string;
    answers: Record<string, unknown>;
  } | null;

  // ── Navigation session (null for leads not originating from a form) ──────
  session: {
    ip:               string | null;
    fbp:              string | null;
    fbc:              string | null;
    user_agent:       string | null;
    event_source_url: string | null;
  } | null;

  // ── Marketing attribution (all signals from the originating session) ─────
  attribution: Attribution;

  // ── Pre-built identity signals ready for any conversion provider ──────────
  identity: IdentitySignals;
}

// ── Internal DB row types ─────────────────────────────────────────────────────

type LeadRow = {
  id:            string;
  name:          string;
  contact:       string;
  email:         string | null;
  source:        string;
  campaign_name: string | null;
  ad_name:       string | null;
  deal_value:    number;
};

type SessionRow = {
  ip:               string | null;
  fbp:              string | null;
  fbc:              string | null;
  user_agent:       string | null;
  event_source_url: string | null;
  country:          string | null;
  city:             string | null;
  utm_source:       string | null;
  utm_medium:       string | null;
  utm_campaign:     string | null;
  utm_term:         string | null;
  utm_content:      string | null;
  fbclid:           string | null;
  gclid:            string | null;
  referrer:         string | null;
};

type SubmissionRow = {
  id:           string;
  answers:      Record<string, unknown>;
  form_sessions: SessionRow | null;
};

// ── Attribution builder ───────────────────────────────────────────────────────

/**
 * Converts a flat attribution record (from EventBus payloads) into the
 * typed Attribution contract used by the Conversion Engine.
 *
 * Centralises all field mappings so resolvers never build Attribution inline:
 *   page_url   → event_source_url   (BookingAttribution canonical mapping)
 *   All other fields map 1-to-1.
 *
 * To add a new tracking parameter (msclkid, ttclid, li_fat_id …),
 * extend only this function — no resolver changes required.
 */
export function buildAttribution(record: Record<string, unknown>): Attribution {
  const str = (key: string): string | undefined => {
    const v = record[key];
    return typeof v === "string" && v !== "" ? v : undefined;
  };

  const attribution: Attribution = {};
  const utm_source   = str("utm_source");   if (utm_source)   attribution.utm_source   = utm_source;
  const utm_medium   = str("utm_medium");   if (utm_medium)   attribution.utm_medium   = utm_medium;
  const utm_campaign = str("utm_campaign"); if (utm_campaign) attribution.utm_campaign = utm_campaign;
  const utm_term     = str("utm_term");     if (utm_term)     attribution.utm_term     = utm_term;
  const utm_content  = str("utm_content");  if (utm_content)  attribution.utm_content  = utm_content;
  const fbclid       = str("fbclid");       if (fbclid)       attribution.fbclid       = fbclid;
  const gclid        = str("gclid");        if (gclid)        attribution.gclid        = gclid;
  const referrer     = str("referrer");     if (referrer)     attribution.referrer     = referrer;
  // Accept both the canonical name and the BookingAttribution alias.
  const esu = str("event_source_url") ?? str("page_url");
  if (esu) attribution.event_source_url = esu;

  return attribution;
}

// ── EventContext builder ──────────────────────────────────────────────────────

export async function buildEventContext(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db:      SupabaseClient<any, any, any>,
  event:   BusEvent,
  payload: LeadStageEnteredPayload,
): Promise<EventContext | null> {
  const [leadResult, subResult] = await Promise.all([
    db
      .from("leads")
      .select("id, name, contact, email, source, campaign_name, ad_name, deal_value")
      .eq("id", payload.leadId)
      .maybeSingle(),

    db
      .from("form_submissions")
      .select(`
        id,
        answers,
        form_sessions!session_id (
          ip, fbp, fbc, user_agent, event_source_url,
          country, city,
          utm_source, utm_medium, utm_campaign, utm_term, utm_content,
          fbclid, gclid, referrer
        )
      `)
      .eq("lead_id", payload.leadId)
      .not("session_id", "is", null)
      .limit(1)
      .maybeSingle(),
  ]);

  const lead = leadResult.data as LeadRow | null;
  if (!lead) {
    console.warn("[conversion-engine] buildEventContext: lead not found", { leadId: payload.leadId });
    return null;
  }

  const sub     = subResult.data as SubmissionRow | null;
  const session = sub?.form_sessions ?? null;

  // ── Attribution block ────────────────────────────────────────────────────
  // buildAttribution ignores non-attribution keys (ip, fbp, fbc …) safely.
  const attribution = buildAttribution(session ?? {});

  // ── Identity signals ─────────────────────────────────────────────────────
  const leadIdentity: LeadIdentityInput = {
    id:      lead.id,
    name:    lead.name,
    contact: lead.contact,
    email:   lead.email,
  };

  const sessionIdentity: SessionIdentityInput | null = session
    ? {
        ip:         session.ip,
        fbp:        session.fbp,
        fbc:        session.fbc,
        user_agent: session.user_agent,
        country:    session.country,
        city:       session.city,
      }
    : null;

  return {
    eventId:        event.id,
    eventTimestamp: event.timestamp,
    correlationId:  event.correlationId,

    leadId:      payload.leadId,
    pipelineId:  payload.pipelineId,
    stageId:     payload.stageId,
    fromStageId: payload.fromStageId,
    userId:      payload.userId,

    lead: {
      name:          lead.name,
      contact:       lead.contact,
      email:         lead.email,
      source:        lead.source,
      campaign_name: lead.campaign_name,
      ad_name:       lead.ad_name,
      deal_value:    lead.deal_value,
    },

    submission: sub ? { id: sub.id, answers: sub.answers } : null,

    session: session
      ? {
          ip:               session.ip,
          fbp:              session.fbp,
          fbc:              session.fbc,
          user_agent:       session.user_agent,
          event_source_url: session.event_source_url,
        }
      : null,

    attribution,

    identity: buildIdentitySignals(leadIdentity, sessionIdentity),
  };
}
