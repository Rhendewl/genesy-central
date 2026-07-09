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

type FlowNodeRow = {
  node_key: string;
  node_type: "trigger" | "condition" | "wait" | "action" | "end";
};

type FlowEdgeRow = {
  source_key: string;
  target_key: string;
};

const allowedStatuses: ConversationFlowStatus[] = ["draft", "active", "paused", "archived"];

function validatePublishableFlow(nodes: FlowNodeRow[], edges: FlowEdgeRow[]) {
  const trigger = nodes.find((node) => node.node_key === "trigger" && node.node_type === "trigger");
  if (!trigger) {
    return "Adicione um bloco de gatilho antes de publicar o fluxo.";
  }

  const nodesByKey = new Map(nodes.map((node) => [node.node_key, node]));
  const outgoing = new Map<string, string[]>();
  for (const edge of edges) {
    if (!nodesByKey.has(edge.source_key) || !nodesByKey.has(edge.target_key)) continue;
    const next = outgoing.get(edge.source_key) ?? [];
    next.push(edge.target_key);
    outgoing.set(edge.source_key, next);
  }

  const queue = [trigger.node_key];
  const visited = new Set<string>();

  while (queue.length > 0) {
    const key = queue.shift()!;
    if (visited.has(key)) continue;
    visited.add(key);

    const node = nodesByKey.get(key);
    if (node?.node_type === "action") return null;

    for (const nextKey of outgoing.get(key) ?? []) {
      if (!visited.has(nextKey)) queue.push(nextKey);
    }
  }

  return "Conecte o gatilho a pelo menos uma ação antes de publicar o fluxo.";
}

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

  if (status === "active") {
    const [{ data: nodes, error: nodesError }, { data: edges, error: edgesError }] = await Promise.all([
      admin
        .from("conversation_flow_nodes")
        .select("node_key,node_type")
        .eq("flow_id", flow.id),
      admin
        .from("conversation_flow_edges")
        .select("source_key,target_key")
        .eq("flow_id", flow.id),
    ]);

    if (nodesError) {
      return NextResponse.json({ error: nodesError.message }, { status: 500 });
    }

    if (edgesError) {
      return NextResponse.json({ error: edgesError.message }, { status: 500 });
    }

    const validationError = validatePublishableFlow(
      (nodes ?? []) as FlowNodeRow[],
      (edges ?? []) as FlowEdgeRow[],
    );

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 422 });
    }
  }

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

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { flowId } = await context.params;
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
  const { error: deleteError } = await admin
    .from("conversation_flows")
    .delete()
    .eq("id", flow.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
