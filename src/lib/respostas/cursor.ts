import type { Cursor } from "./types";

export function encodeCursor(created_at: string, id: string): string {
  const payload = JSON.stringify({ ca: created_at, id } satisfies Cursor);
  return Buffer.from(payload).toString("base64url");
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const decoded = JSON.parse(Buffer.from(raw, "base64url").toString("utf-8"));
    if (
      typeof decoded === "object" &&
      decoded !== null &&
      typeof decoded.ca === "string" &&
      typeof decoded.id === "string"
    ) {
      return decoded as Cursor;
    }
    return null;
  } catch {
    return null;
  }
}
