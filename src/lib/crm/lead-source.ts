// ─────────────────────────────────────────────────────────────────────────────
// CRM — Lead Source
//
// Canonical lead.source values and their mapping to platform-agnostic
// ActionSource. Add new entries to LeadSource and ACTION_SOURCE_MAP when
// new lead origins are introduced — all providers inherit the mapping
// automatically without knowing the raw string values.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Platform-agnostic classification of how a conversion event was originated.
 * Maps to the equivalent field on each platform's CAPI:
 *   Meta CAPI  → action_source
 *   TikTok     → event_category
 *   Google Ads → (carried in custom data)
 */
export type ActionSource =
  | "website"           // form submission, landing page, web chat
  | "system_generated"  // CRM manual creation, automated workflow
  | "phone_call"        // reserved — future inbound call tracking
  | "chat"              // reserved — future chat / WhatsApp tracking
  | "email"             // reserved — future email campaign tracking
  | "other";            // external webhook, unknown origin

/** Canonical lead.source values persisted in leads.source. */
export const LeadSource = {
  FORMULARIO_GENESY: "formulario_genesy",
  META_LEAD_ADS:     "meta_lead_ads",
  MANUAL:            "manual",
  EXTERNAL_WEBHOOK:  "external_webhook",
  INSTAGRAM_AUTOMATION: "instagram_automation",
  YOUTUBE:           "youtube",
  WHATSAPP:          "whatsapp",
  SITE:              "site",
  INDICACAO:         "indicacao",
  EMAIL_MARKETING:   "email_marketing",
  EVENTO:            "evento",
} as const;

export type LeadSourceValue = typeof LeadSource[keyof typeof LeadSource];

const ACTION_SOURCE_MAP: Partial<Record<string, ActionSource>> = {
  [LeadSource.FORMULARIO_GENESY]: "website",
  [LeadSource.META_LEAD_ADS]:     "website",
  [LeadSource.MANUAL]:            "system_generated",
  [LeadSource.EXTERNAL_WEBHOOK]:  "other",
  [LeadSource.INSTAGRAM_AUTOMATION]: "chat",
  [LeadSource.YOUTUBE]:           "website",
  [LeadSource.WHATSAPP]:          "chat",
  [LeadSource.SITE]:              "website",
  [LeadSource.INDICACAO]:         "other",
  [LeadSource.EMAIL_MARKETING]:   "email",
  [LeadSource.EVENTO]:            "other",
};

/** Derives the platform-agnostic ActionSource from a lead's origin string. */
export function deriveActionSource(leadSource: string): ActionSource {
  if (!leadSource) return "system_generated";
  return ACTION_SOURCE_MAP[leadSource] ?? "other";
}
