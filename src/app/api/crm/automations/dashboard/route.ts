import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { WorkflowService } from "@/lib/workflow-engine/workflow-service";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const pipelineId = req.nextUrl.searchParams.get("pipeline_id") ?? undefined;
  const service = new WorkflowService(supabase);
  const stats = await service.getDashboardStats(pipelineId);
  return NextResponse.json({ stats });
}
