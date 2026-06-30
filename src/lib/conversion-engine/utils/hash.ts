import { createHash } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Conversion Engine — PII hashing helpers
//
// Shared by all server-side CAPI providers (Meta now; Google Enhanced
// Conversions later) — every one of them hashes email/phone/name the same
// way before sending to the platform.
// ─────────────────────────────────────────────────────────────────────────────

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hashEmail(email: string): string {
  return sha256(email.toLowerCase().trim());
}

// Normalizes to E.164 before hashing. Defaults to +55 (BR) when no country
// code is present, since the system currently targets the Brazilian market.
export function hashPhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  let e164: string;
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    e164 = `+${digits}`;
  } else if (digits.length === 10 || digits.length === 11) {
    e164 = `+55${digits}`;
  } else {
    return null;
  }
  return sha256(e164);
}

export function hashFirstName(fullName: string): string {
  return sha256(fullName.trim().split(/\s+/)[0].toLowerCase());
}

export function hashLastName(fullName: string): string | null {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return null;
  return sha256(parts.slice(1).join(" ").toLowerCase());
}
