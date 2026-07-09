import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { ConversationFlowNodeType } from "@/types/conversations";

type RouteContext = {
  params: Promise<{ flowId: string }>;
};

type FlowRow = {
  id: string;
  user_id: string;
};

type NodeRow = {
  id: string;
  flow_id: string;
  node_key: string;
  node_type: ConversationFlowNodeType;
  label: string;
  position: { x?: number; y?: number };
};

const allowedNodeTypes: ConversationFlowNodeType[] = ["condition", "wait", "action"];

function makeNodeKey(type: ConversationFlowNodeType) {
  return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function fallbackLabel(type: ConversationFlowNodeType) {
  if (type === "condition") return "Nova condição";
  if (type === "wait") return "Nova espera";
  if (type === "action") return "Nova ação";
  return "Novo bloco";
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { flowId } = await context.params;
  const body = await request.json().catch(() => null);
  const nodeType = typeof body?.node_type === "string" ? body.node_type as ConversationFlowNodeType : "action";
  const label = typeof body?.label === "string" && body.label.trim()
    ? body.label.trim()
    : fallbackLabel(nodeType);
  const config = body?.config && typeof body.config === "object" ? body.config : {};

  if (!allowedNodeTypes.includes(nodeType)) {
    return NextResponse.json({ error: "Tipo de bloco inválido para inserção manual." }, { status: 400 });
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
    .select("id,user_id")
    .eq("id", flowId)
    .maybeSingle<FlowRow>();

  if (flowError) {
    return NextResponse.json({ error: flowError.message }, { status: 500 });
  }

  if (!flow) {
    return NextResponse.json({ error: "Fluxo não encontrado ou sem permissão." }, { status: 404 });
  }

  const admin = createAdminSupabaseClient();
  const { data: nodes, error: nodesError } = await admin
    .from("conversation_flow_nodes")
    .select("id,flow_id,node_key,node_type,label,position")
    .eq("flow_id", flow.id)
    .order("created_at", { ascending: true });

  if (nodesError) {
    return NextResponse.json({ error: nodesError.message }, { status: 500 });
  }

  const currentNodes = (nodes ?? []) as NodeRow[];
  const endNode = currentNodes.find((node) => node.node_key === "end");
  const beforeEndNode = [...currentNodes].reverse().find((node) => node.node_key !== "end");
  const y = Math.max(120, currentNodes.length * 150);
  const nodeKey = makeNodeKey(nodeType);

  const { data: newNode, error: insertNodeError } = await admin
    .from("conversation_flow_nodes")
    .insert({
      user_id: flow.user_id,
      flow_id: flow.id,
      node_key: nodeKey,
      node_type: nodeType,
      label,
      config,
      position: { x: 80, y },
    })
    .select("*")
    .single();

  if (insertNodeError || !newNode) {
    return NextResponse.json({ error: insertNodeError?.message ?? "Erro ao criar bloco." }, { status: 500 });
  }

  if (endNode && beforeEndNode) {
    await admin
      .from("conversation_flow_edges")
      .delete()
      .eq("flow_id", flow.id)
      .eq("source_key", beforeEndNode.node_key)
      .eq("target_key", endNode.node_key);

    const { error: firstEdgeError } = await admin
      .from("conversation_flow_edges")
      .insert({
        user_id: flow.user_id,
        flow_id: flow.id,
        source_key: beforeEndNode.node_key,
        target_key: nodeKey,
        label: null,
        config: {},
      });

    if (firstEdgeError) {
      return NextResponse.json({ error: firstEdgeError.message }, { status: 500 });
    }

    const { error: secondEdgeError } = await admin
      .from("conversation_flow_edges")
      .insert({
        user_id: flow.user_id,
        flow_id: flow.id,
        source_key: nodeKey,
        target_key: endNode.node_key,
        label: null,
        config: {},
      });

    if (secondEdgeError) {
      return NextResponse.json({ error: secondEdgeError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ node: newNode });
}
