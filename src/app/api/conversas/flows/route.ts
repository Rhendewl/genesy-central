import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { ConversationFlow } from "@/types/conversations";

type ProfileRow = {
  id: string;
  owner_id: string;
  role: string;
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const triggerType = typeof body?.trigger_type === "string" ? body.trigger_type.trim() : "manual_start";
  const scope = body?.scope === "personal" ? "personal" : "team";

  if (!name) {
    return NextResponse.json({ error: "Nome do fluxo é obrigatório." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profiles")
    .select("id,owner_id,role")
    .eq("auth_user_id", user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Perfil do usuário não encontrado." }, { status: 404 });
  }

  const effectiveScope = profile.role === "admin" ? scope : "personal";
  const admin = createAdminSupabaseClient();

  const { data: flow, error: flowError } = await admin
    .from("conversation_flows")
    .insert({
      user_id: profile.owner_id,
      owner_profile_id: effectiveScope === "personal" ? profile.id : null,
      name,
      description: description || null,
      status: "draft",
      trigger_type: triggerType,
      trigger_config: {},
      scope: effectiveScope,
      viewport: { zoom: 1, x: 0, y: 0 },
    })
    .select("*")
    .single<ConversationFlow>();

  if (flowError || !flow) {
    return NextResponse.json({ error: flowError?.message ?? "Erro ao criar fluxo." }, { status: 500 });
  }

  const nodes = [
    {
      user_id: profile.owner_id,
      flow_id: flow.id,
      node_key: "trigger",
      node_type: "trigger",
      label: "Gatilho inicial",
      config: { trigger_type: triggerType },
      position: { x: 80, y: 120 },
    },
    {
      user_id: profile.owner_id,
      flow_id: flow.id,
      node_key: "end",
      node_type: "end",
      label: "Fim do fluxo",
      config: {},
      position: { x: 80, y: 280 },
    },
  ];

  const { error: nodesError } = await admin
    .from("conversation_flow_nodes")
    .insert(nodes);

  if (nodesError) {
    return NextResponse.json({ error: nodesError.message }, { status: 500 });
  }

  const { error: edgeError } = await admin
    .from("conversation_flow_edges")
    .insert({
      user_id: profile.owner_id,
      flow_id: flow.id,
      source_key: "trigger",
      target_key: "end",
      label: null,
      config: {},
    });

  if (edgeError) {
    return NextResponse.json({ error: edgeError.message }, { status: 500 });
  }

  return NextResponse.json({ flow });
}
