import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { WorkflowService } from "@/lib/workflow-engine/workflow-service";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const status = params.get("status") as "executada" | "cancelada" | "falhou" | null;

  const service = new WorkflowService(supabase);
  const { rows, total } = await service.getHistory({
    automationId: params.get("automation_id") ?? undefined,
    pipelineId:   params.get("pipeline_id") ?? undefined,
    status:       status ?? undefined,
    page:         Number(params.get("page") ?? "1"),
    pageSize:     Number(params.get("page_size") ?? "20"),
  });

  return NextResponse.json({ rows, total });
}

export async function DELETE(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const automationId = params.get("automation_id") ?? undefined;
  const pipelineId   = params.get("pipeline_id") ?? undefined;

  if (!automationId && !pipelineId) {
    return NextResponse.json({ error: "Informe automation_id ou pipeline_id" }, { status: 400 });
  }

  const service = new WorkflowService(supabase);
  const { deleted, error } = await service.clearHistory({ automationId, pipelineId });
  if (error) return NextResponse.json({ error }, { status: 500 });

  return NextResponse.json({ ok: true, deleted });
}
