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
  config?: Record<string, unknown>;
  position: { x?: number; y?: number };
};

const allowedNodeTypes: ConversationFlowNodeType[] = ["trigger", "condition", "wait", "action"];

function makeNodeKey(type: ConversationFlowNodeType) {
  return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function fallbackLabel(type: ConversationFlowNodeType) {
  if (type === "trigger") return "Novo gatilho";
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
  const y = Math.max(120, currentNodes.length * 150);
  const hasTrigger = currentNodes.some((node) => node.node_key === "trigger");
  const nodeKey = nodeType === "trigger" && !hasTrigger ? "trigger" : makeNodeKey(nodeType);

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

  if (nodeType === "trigger" && typeof config.trigger_type === "string" && config.trigger_type) {
    const { error: triggerUpdateError } = await admin
      .from("conversation_flows")
      .update({ trigger_type: config.trigger_type, trigger_config: config })
      .eq("id", flow.id);

    if (triggerUpdateError) {
      return NextResponse.json({ error: triggerUpdateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ node: newNode });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { flowId } = await context.params;
  const body = await request.json().catch(() => null);
  const nodeId = typeof body?.node_id === "string" ? body.node_id : "";
  const label = typeof body?.label === "string" && body.label.trim() ? body.label.trim() : "";
  const config = body?.config && typeof body.config === "object" ? body.config : null;
  const position = body?.position && typeof body.position === "object" && !Array.isArray(body.position)
    ? body.position as { x?: number; y?: number }
    : null;

  if (!nodeId) {
    return NextResponse.json({ error: "node_id é obrigatório." }, { status: 400 });
  }

  if (!label && !position) {
    return NextResponse.json({ error: "Informe nome/configuração ou posição para atualizar o bloco." }, { status: 400 });
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
  const { data: currentNode, error: currentNodeError } = await admin
    .from("conversation_flow_nodes")
    .select("id,flow_id,node_key,node_type,label,config,position")
    .eq("flow_id", flow.id)
    .eq("id", nodeId)
    .maybeSingle<NodeRow>();

  if (currentNodeError) {
    return NextResponse.json({ error: currentNodeError.message }, { status: 500 });
  }

  if (!currentNode) {
    return NextResponse.json({ error: "Bloco não encontrado." }, { status: 404 });
  }

  const updatePayload: Record<string, unknown> = {};
  if (label) updatePayload.label = label;
  if (config) updatePayload.config = config;
  if (position) {
    updatePayload.position = {
      x: Number(position.x ?? currentNode.position?.x ?? 80),
      y: Number(position.y ?? currentNode.position?.y ?? 120),
    };
  }

  const { data: updatedNode, error: updateNodeError } = await admin
    .from("conversation_flow_nodes")
    .update(updatePayload)
    .eq("id", currentNode.id)
    .select("*")
    .single();

  if (updateNodeError || !updatedNode) {
    return NextResponse.json({ error: updateNodeError?.message ?? "Erro ao atualizar bloco." }, { status: 500 });
  }

  if (config && currentNode.node_type === "trigger" && typeof config.trigger_type === "string" && config.trigger_type) {
    const { error: triggerUpdateError } = await admin
      .from("conversation_flows")
      .update({ trigger_type: config.trigger_type, trigger_config: config })
      .eq("id", flow.id);

    if (triggerUpdateError) {
      return NextResponse.json({ error: triggerUpdateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ node: updatedNode });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const { flowId } = await context.params;
  const body = await request.json().catch(() => null);
  const nodeId = typeof body?.node_id === "string" ? body.node_id : "";

  if (!nodeId) {
    return NextResponse.json({ error: "node_id é obrigatório." }, { status: 400 });
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
  const node = currentNodes.find((item) => item.id === nodeId);

  if (!node) {
    return NextResponse.json({ error: "Bloco não encontrado." }, { status: 404 });
  }

  const { error: edgeDeleteError } = await admin
    .from("conversation_flow_edges")
    .delete()
    .eq("flow_id", flow.id)
    .or(`source_key.eq.${node.node_key},target_key.eq.${node.node_key}`);

  if (edgeDeleteError) {
    return NextResponse.json({ error: edgeDeleteError.message }, { status: 500 });
  }

  const { error: nodeDeleteError } = await admin
    .from("conversation_flow_nodes")
    .delete()
    .eq("id", node.id);

  if (nodeDeleteError) {
    return NextResponse.json({ error: nodeDeleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
