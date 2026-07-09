import { NextRequest, NextResponse } from "next/server";
import { ConversationFlowExecutor } from "@/lib/conversations/flow-executor";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminSupabaseClient();
  const executor = new ConversationFlowExecutor(db);
  const result = await executor.runDueJobs(20);

  return NextResponse.json(result);
}
