import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { processMetaLeadEvent, type MetaLeadEvent } from "@/lib/meta-lead-capture";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  const secret = process.env.META_VERIFY_TOKEN;
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  if (secret && req.nextUrl.searchParams.get("hub.mode") === "subscribe" && challenge && req.nextUrl.searchParams.get("hub.verify_token") === secret) return new NextResponse(challenge);
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const secret = process.env.META_APP_SECRET;
  const signature = req.headers.get("x-hub-signature-256") ?? "";
  if (!secret) return NextResponse.json({ error: "Webhook unavailable" }, { status: 503 });
  const expected = `sha256=${createHmac("sha256", secret).update(raw).digest("hex")}`;
  if (!/^sha256=[a-f0-9]{64}$/.test(signature) || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let body;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (body?.object !== "page") return NextResponse.json({ received: true });
  if (!Array.isArray(body.entry)) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  const db = createAdminSupabaseClient();
  const started = Date.now();
  let failed = false;
  try {
    for (const entry of body.entry) {
      if (!Array.isArray(entry.changes)) continue;
      for (const change of entry.changes) {
        if (change.field !== "leadgen") continue;
        const event = change.value as MetaLeadEvent;
        if (![event?.page_id, event?.leadgen_id, event?.form_id].every((id) => typeof id === "string" && /^\d+$/.test(id))) return NextResponse.json({ error: "Invalid event" }, { status: 400 });
        const pages = await db.from("meta_page_subscriptions").select("user_id").eq("meta_page_id", event.page_id).eq("is_active", true);
        if (pages.error) throw new Error(pages.error.message);
        for (const page of pages.data ?? []) {
          if (Date.now() - started > 10000) return NextResponse.json({ received: false, retry: true }, { status: 503 });
          try { await processMetaLeadEvent(db, event, page.user_id); }
          catch { failed = true; }
        }
      }
    }
  } catch { failed = true; }
  // Await persistence. A failure requests Meta redelivery; successful events are idempotent.
  return NextResponse.json({ received: !failed }, { status: failed ? 503 : 200 });
}
