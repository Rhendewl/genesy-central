import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { runDueWebhookJobs } from "@/lib/forms/webhook-delivery";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handle(req: NextRequest) {
  const headerSecret = req.headers.get("x-cron-secret");
  const bearerSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret || (headerSecret !== expectedSecret && bearerSecret !== expectedSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runDueWebhookJobs(createAdminSupabaseClient(), 20);
  return NextResponse.json(result);
}

export async function GET(req: NextRequest) { return handle(req); }
export async function POST(req: NextRequest) { return handle(req); }
