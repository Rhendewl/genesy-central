import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { JobExecutor } from "@/lib/workflow-engine/job-executor";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/cron/workflow-jobs
//
// Chamada pelo pg_cron do Supabase a cada 1 minuto (ver
// supabase/migrations/20260726_workflow_jobs_cron.sql). Autenticação via
// header compartilhado — não é uma rota de usuário, roda com service-role.
// ─────────────────────────────────────────────────────────────────────────────

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminSupabaseClient();
  const executor = new JobExecutor(db);
  const result = await executor.runDueJobs(200);

  return NextResponse.json(result);
}
