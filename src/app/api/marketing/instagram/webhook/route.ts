import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { driveInstagramRuns, ingestInstagramWebhook } from "@/lib/instagram-automation/engine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  const expected = process.env.INSTAGRAM_VERIFY_TOKEN ?? process.env.META_VERIFY_TOKEN;
  if (mode === "subscribe" && challenge && expected && token === expected) return new NextResponse(challenge);
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

function validSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const secret = process.env.INSTAGRAM_APP_SECRET ?? process.env.META_APP_SECRET;
  if (!secret) return NextResponse.json({ error: "Instagram app secret não configurado" }, { status: 503 });
  if (!validSignature(rawBody, req.headers.get("x-hub-signature-256"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let payload: unknown;
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const db = createAdminSupabaseClient();
    const { runIds, ...result } = await ingestInstagramWebhook(db, payload);
    // Meta only needs the acknowledgement; the flow starts right after it instead
    // of on the next worker tick. The app runs as a long-lived Node server
    // (Coolify), so this keeps going after the response is sent.
    if (runIds.length) {
      void driveInstagramRuns(db, runIds).catch(error => console.error("[instagram-automation/drive]", error));
    }
    return NextResponse.json({ acknowledged: true, ...result });
  } catch (error) {
    console.error("[instagram-automation/webhook]", error);
    return NextResponse.json({ error: "Falha ao persistir o evento" }, { status: 500 });
  }
}
