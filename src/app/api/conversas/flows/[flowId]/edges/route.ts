import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ flowId: string }>;
};

type FlowRow = {
  id: string;
  user_id: string;
};

type NodeRow = {
  node_key: string;
};

async function resolveFlow(flowId: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Não autenticado." }, { status: 401 }), flow: null };
  }

  const { data: flow, error } = await supabase
    .from("conversation_flows")
    .select("id,user_id")
    .eq("id", flowId)
    .maybeSingle<FlowRow>();

  if (error) {
    return { error: NextResponse.json({ error: error.message }, { status: 500 }), flow: null };
  }

  if (!flow) {
    return { error: NextResponse.json({ error: "Fluxo não encontrado ou sem permissão." }, { status: 404 }), flow: null };
  }

  return { error: null, flow };
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { flowId } = await context.params;
  const body = await request.json().catch(() => null);
  const sourceKey = typeof body?.source_key === "string" ? body.source_key : "";
  const targetKey = typeof body?.target_key === "string" ? body.target_key : "";

  if (!sourceKey || !targetKey || sourceKey === targetKey) {
    return NextResponse.json({ error: "Conexão inválida." }, { status: 400 });
  }

  const resolved = await resolveFlow(flowId);
  if (resolved.error || !resolved.flow) return resolved.error;

  const admin = createAdminSupabaseClient();
  const { data: nodes, error: nodesError } = await admin
    .from("conversation_flow_nodes")
    .select("node_key")
    .eq("flow_id", resolved.flow.id)
    .in("node_key", [sourceKey, targetKey]);

  if (nodesError) {
    return NextResponse.json({ error: nodesError.message }, { status: 500 });
  }

  if (((nodes ?? []) as NodeRow[]).length !== 2) {
    return NextResponse.json({ error: "Blocos da conexão não encontrados." }, { status: 404 });
  }

  await admin
    .from("conversation_flow_edges")
    .delete()
    .eq("flow_id", resolved.flow.id)
    .eq("source_key", sourceKey)
    .eq("target_key", targetKey);

  const { data: edge, error: insertError } = await admin
    .from("conversation_flow_edges")
    .insert({
      user_id: resolved.flow.user_id,
      flow_id: resolved.flow.id,
      source_key: sourceKey,
      target_key: targetKey,
      label: null,
      config: {},
    })
    .select("*")
    .single();

  if (insertError || !edge) {
    return NextResponse.json({ error: insertError?.message ?? "Erro ao criar conexão." }, { status: 500 });
  }

  return NextResponse.json({ edge });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { flowId } = await context.params;
  const body = await request.json().catch(() => null);
  const edgeId = typeof body?.edge_id === "string" ? body.edge_id : "";

  if (!edgeId) {
    return NextResponse.json({ error: "edge_id é obrigatório." }, { status: 400 });
  }

  const resolved = await resolveFlow(flowId);
  if (resolved.error || !resolved.flow) return resolved.error;

  const admin = createAdminSupabaseClient();
  const { error } = await admin
    .from("conversation_flow_edges")
    .delete()
    .eq("flow_id", resolved.flow.id)
    .eq("id", edgeId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
