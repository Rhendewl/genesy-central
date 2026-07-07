import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { WorkflowService, type AutomationConditionInput } from "@/lib/workflow-engine/workflow-service";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as { conditions?: AutomationConditionInput[] } | null;
  if (!body?.conditions) return NextResponse.json({ error: "conditions é obrigatório" }, { status: 400 });

  const service = new WorkflowService(supabase);
  const result  = await service.replaceConditions(id, body.conditions);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
