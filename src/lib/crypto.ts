import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "crypto";

// ── Token encryption (AES-256-GCM) ───────────────────────────────────────────
// TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

function getEncryptionKey(): Buffer {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) throw new Error("TOKEN_ENCRYPTION_KEY not configured");
  if (key.length !== 64) throw new Error("TOKEN_ENCRYPTION_KEY must be 64 hex chars");
  return Buffer.from(key, "hex");
}

// Encoded format: iv(hex) : authTag(hex) : ciphertext(hex)
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":");
}

export function decryptToken(encoded: string): string {
  const key = getEncryptionKey();
  const parts = encoded.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted token format");
  const [ivHex, tagHex, encHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const encrypted = Buffer.from(encHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

// ── OAuth state signing (HMAC-SHA256) ─────────────────────────────────────────
// Prevents CSRF by signing state with META_APP_SECRET. Expires in 10 minutes.

export function signOAuthState(payload: Record<string, unknown>): string {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("META_APP_SECRET not configured");
  const data = Buffer.from(JSON.stringify({ ...payload, ts: Date.now() })).toString("base64url");
  const sig = createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyOAuthState<T extends Record<string, unknown>>(state: string): T {
  const secret = process.env.META_APP_SECRET;
  if (!secret) throw new Error("META_APP_SECRET not configured");
  const dotIdx = state.lastIndexOf(".");
  if (dotIdx === -1) throw new Error("Malformed state");
  const data = state.slice(0, dotIdx);
  const sig = state.slice(dotIdx + 1);
  const expected = createHmac("sha256", secret).update(data).digest("base64url");
  if (sig !== expected) throw new Error("Invalid state signature");
  const parsed = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as T & { ts: number };
  if (Date.now() - parsed.ts > 10 * 60 * 1000) throw new Error("State expired");
  return parsed;
}
