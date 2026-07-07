// GET  /api/crm/automations?pipeline_id=... — lista automações de uma pipeline
// POST /api/crm/automations — cria uma automação (com condições/ações)

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { WorkflowService, type CreateAutomationInput } from "@/lib/workflow-engine/workflow-service";
import type { DelayType } from "@/lib/workflow-engine/types";

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const pipelineId = req.nextUrl.searchParams.get("pipeline_id");
  if (!pipelineId) return NextResponse.json({ error: "pipeline_id é obrigatório" }, { status: 400 });

  const service = new WorkflowService(supabase);
  const automations = await service.listByPipeline(pipelineId);
  return NextResponse.json({ automations });
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const body = await req.json().catch(() => null) as Partial<CreateAutomationInput> | null;
  if (!body?.pipelineId || !body?.name || !body?.triggerType || !body?.delayType) {
    return NextResponse.json({ error: "pipelineId, name, triggerType e delayType são obrigatórios" }, { status: 400 });
  }

  const input: CreateAutomationInput = {
    pipelineId:    body.pipelineId,
    name:          body.name,
    status:        body.status ?? "ativa",
    triggerType:   body.triggerType,
    triggerConfig: body.triggerConfig ?? {},
    delayType:     body.delayType as DelayType,
    delayConfig:   body.delayConfig ?? {},
    conditions:    body.conditions ?? [],
    actions:       body.actions ?? [],
  };

  const service = new WorkflowService(supabase);
  const result  = await service.create(input);

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ id: result.id }, { status: 201 });
}
