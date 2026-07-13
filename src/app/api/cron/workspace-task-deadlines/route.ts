import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { runWorkspaceTaskDeadlineReminders } from "@/lib/workspace/task-deadline-reminders";

// GET/POST /api/cron/workspace-task-deadlines
// Chamada por cron com Authorization Bearer ou X-Cron-Secret. Usa service-role
// porque precisa ler preferências pessoais e subscriptions dos destinatários.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function handleCron(req: NextRequest) {
  const headerSecret = req.headers.get("x-cron-secret");
  const bearerSecret = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || (headerSecret !== expectedSecret && bearerSecret !== expectedSecret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminSupabaseClient();
  const result = await runWorkspaceTaskDeadlineReminders(db);

  return NextResponse.json(result);
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
