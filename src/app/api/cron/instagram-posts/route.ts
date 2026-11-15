import { syncInstagramEditorial } from "@/lib/marketing/editorial-instagram";
import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { cleanupPublishedInstagramAssets, runScheduledInstagramPost } from "@/lib/marketing/instagram-scheduler";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
async function handle(req: NextRequest) {
  const received = req.headers.get("x-cron-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const expectedHash = process.env.INSTAGRAM_SCHEDULER_SECRET_SHA256;
  const receivedHash = createHash("sha256").update(received ?? "").digest("hex");
  const vaultAuthorized = Boolean(received && expectedHash && /^[a-f0-9]{64}$/.test(expectedHash) && timingSafeEqual(Buffer.from(expectedHash), Buffer.from(receivedHash)));
  if (!vaultAuthorized && (!process.env.CRON_SECRET || received !== process.env.CRON_SECRET)) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  try {
    const db = createAdminSupabaseClient();
    const result = await runScheduledInstagramPost(db);
    const assets = await cleanupPublishedInstagramAssets(db);
    const editorialSynced = await syncInstagramEditorial(db);
    return NextResponse.json({ ...result, assets, editorialSynced });
  }
  catch { return NextResponse.json({ error: "Não foi possível consultar a fila de publicações." }, { status: 500 }); }
}
export const GET = handle;
export const POST = handle;
