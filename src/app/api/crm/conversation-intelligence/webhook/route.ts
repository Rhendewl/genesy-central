import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { encryptToken } from "@/lib/crypto";
import {
  contactHash,
  parseWebhook,
  validSignature,
} from "@/lib/conversation-intelligence/domain";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  if (
    !process.env.WHATSAPP_VERIFY_TOKEN ||
    q.get("hub.mode") !== "subscribe" ||
    q.get("hub.verify_token") !== process.env.WHATSAPP_VERIFY_TOKEN
  )
    return new NextResponse("Forbidden", { status: 403 });
  return new NextResponse(q.get("hub.challenge") ?? "", { status: 200 });
}
export async function POST(req: NextRequest) {
  // Cap actual streamed bytes as well as Content-Length, before parsing JSON.
  if (Number(req.headers.get("content-length")) > 1048576)
    return new NextResponse(null, { status: 413 });
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (!reader) return new NextResponse(null, { status: 400 });
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1048576) {
      await reader.cancel();
      return new NextResponse(null, { status: 413 });
    }
    chunks.push(value);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  if (
    !validSignature(
      raw,
      req.headers.get("x-hub-signature-256"),
      process.env.META_APP_SECRET ?? "",
    )
  )
    return new NextResponse(null, { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  try {
    const messages = parseWebhook(payload);
    const db = createAdminSupabaseClient();
    for (const m of messages) {
      const { error } = await db.rpc("ci_ingest", {
        p_phone: m.phone,
        p_waba: m.waba,
        p_contact: contactHash(m.contact),
        p_provider: m.provider,
        p_direction: m.direction,
        p_sent: m.sent,
        p_kind: m.kind,
        p_body: m.body ? encryptToken(m.body) : null,
      });
      if (error) return new NextResponse(null, { status: 503 }); // Meta retries; provider IDs are idempotent.
    }
    return NextResponse.json({ received: true });
  } catch {
    return new NextResponse(null, { status: 503 });
  }
}
