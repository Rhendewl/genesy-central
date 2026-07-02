import { sha256, hashEmail, hashPhone, hashFirstName, hashLastName } from "./utils/hash";

// ─────────────────────────────────────────────────────────────────────────────
// Conversion Engine — IdentitySignals
//
// Domain model for user identity signals used in conversion tracking.
// All PII is SHA-256 hashed before storage; raw signals (ip, userAgent,
// fbp, fbc) are stored as-is per platform requirements.
//
// Providers translate this into their platform-specific user data format:
//   Meta CAPI  → user_data         (em, ph, fn, ln, external_id, …)
//   Google Ads → user_identifiers   (hashed_email, hashed_phone_number, …)
//   TikTok     → context.user       (email, phone_number, …)
//
// No provider should reference field names from this interface directly —
// each provider is responsible for its own translation layer.
// ─────────────────────────────────────────────────────────────────────────────

export interface IdentitySignals {
  email?:      string;   // SHA-256(email.toLowerCase().trim())
  phone?:      string;   // SHA-256(E.164-normalised phone)
  firstName?:  string;   // SHA-256(first word of name, lowercased)
  lastName?:   string;   // SHA-256(remaining words of name, lowercased)
  fbp?:        string;   // _fbp browser cookie (raw, cross-platform)
  fbc?:        string;   // _fbc click cookie (raw, cross-platform)
  externalId?: string;   // SHA-256(lead.id) — stable deduplication key
  ip?:         string;   // raw IP address
  userAgent?:  string;   // raw User-Agent string
  country?:    string;   // SHA-256(ISO 3166-1 alpha-2, lowercased)
  city?:       string;   // SHA-256(city name, lowercased + trimmed)
  state?:      string;   // SHA-256(state/province, lowercased + trimmed) — reserved
  zip?:        string;   // SHA-256(postal code, lowercased + trimmed) — reserved
}

export interface LeadIdentityInput {
  id:      string;
  name:    string;
  contact: string;
  email:   string | null;
}

export interface SessionIdentityInput {
  ip:         string | null;
  fbp:        string | null;
  fbc:        string | null;
  user_agent: string | null;
  country:    string | null;
  city:       string | null;
}

export function buildIdentitySignals(
  lead:    LeadIdentityInput,
  session?: SessionIdentityInput | null,
): IdentitySignals {
  const signals: IdentitySignals = { externalId: sha256(lead.id) };

  if (lead.email) signals.email = hashEmail(lead.email);

  const ph = lead.contact ? hashPhone(lead.contact) : null;
  if (ph) signals.phone = ph;

  if (lead.name) {
    signals.firstName = hashFirstName(lead.name);
    const ln = hashLastName(lead.name);
    if (ln) signals.lastName = ln;
  }

  if (session?.fbp)        signals.fbp       = session.fbp;
  if (session?.fbc)        signals.fbc       = session.fbc;
  if (session?.ip)         signals.ip        = session.ip;
  if (session?.user_agent) signals.userAgent = session.user_agent;
  if (session?.country)    signals.country   = sha256(session.country.toLowerCase().trim());
  if (session?.city)       signals.city      = sha256(session.city.toLowerCase().trim());

  return signals;
}
