import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { ConversationFlow, ConversationFlowStatus } from "@/types/conversations";

type RouteContext = {
  params: Promise<{ flowId: string }>;
};

type FlowRow = {
  id: string;
  user_id: string;
  status: ConversationFlowStatus;
};

const allowedStatuses: ConversationFlowStatus[] = ["draft", "active", "paused", "archived"];

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { flowId } = await context.params;
  const body = await request.json().catch(() => null);
  const status = typeof body?.status === "string" ? body.status as ConversationFlowStatus : null;

  if (!status || !allowedStatuses.includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: flow, error: flowError } = await supabase
    .from("conversation_flows")
    .select("id,user_id,status")
    .eq("id", flowId)
    .maybeSingle<FlowRow>();

  if (flowError) {
    return NextResponse.json({ error: flowError.message }, { status: 500 });
  }

  if (!flow) {
    return NextResponse.json({ error: "Fluxo não encontrado ou sem permissão." }, { status: 404 });
  }

  const admin = createAdminSupabaseClient();
  const { data: updated, error: updateError } = await admin
    .from("conversation_flows")
    .update({ status })
    .eq("id", flow.id)
    .select("*")
    .single<ConversationFlow>();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Erro ao atualizar fluxo." }, { status: 500 });
  }

  return NextResponse.json({ flow: updated });
}
