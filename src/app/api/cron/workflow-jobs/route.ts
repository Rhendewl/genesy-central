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
// Dá margem para processar um lote de jobs atrasados sem estourar o timeout
// padrão da função serverless (10s). Requer plano da Vercel que suporte
// maxDuration > 10s (Pro ou superior) — em Hobby, o limite real da
// plataforma prevalece mesmo com este valor mais alto.
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const db = createAdminSupabaseClient();
  const executor = new JobExecutor(db);
  // Lote menor por tick — com 1 execução/minuto, um atraso acumulado é
  // absorvido em poucos ticks; processar 200 de uma vez arrisca estourar
  // o tempo de resposta que o pg_net aguarda.
  const result = await executor.runDueJobs(20);

  return NextResponse.json(result);
}
