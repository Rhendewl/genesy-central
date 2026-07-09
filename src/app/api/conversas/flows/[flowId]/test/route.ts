import { NextRequest, NextResponse } from "next/server";
import { ConversationFlowExecutor } from "@/lib/conversations/flow-executor";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ flowId: string }>;
};

type FlowRow = {
  id: string;
  user_id: string;
  owner_profile_id: string | null;
  trigger_type: string;
};

type ThreadRow = {
  id: string;
  user_id: string;
  whatsapp_account_id: string | null;
  contact_id: string;
  owner_profile_id: string;
  lead_id: string | null;
};

type ContactRow = {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
};

export async function POST(request: NextRequest, context: RouteContext) {
  const { flowId } = await context.params;
  const body = await request.json().catch(() => null);
  const threadId = typeof body?.thread_id === "string" && body.thread_id ? body.thread_id : null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: flow, error: flowError } = await supabase
    .from("conversation_flows")
    .select("id,user_id,owner_profile_id,trigger_type")
    .eq("id", flowId)
    .maybeSingle<FlowRow>();

  if (flowError) {
    return NextResponse.json({ error: flowError.message }, { status: 500 });
  }

  if (!flow) {
    return NextResponse.json({ error: "Fluxo não encontrado ou sem permissão." }, { status: 404 });
  }

  let thread: ThreadRow | null = null;
  let contact: ContactRow | null = null;

  if (threadId) {
    const { data: threadRow, error: threadError } = await supabase
      .from("conversation_threads")
      .select("id,user_id,whatsapp_account_id,contact_id,owner_profile_id,lead_id")
      .eq("id", threadId)
      .maybeSingle<ThreadRow>();

    if (threadError) {
      return NextResponse.json({ error: threadError.message }, { status: 500 });
    }

    if (!threadRow) {
      return NextResponse.json({ error: "Conversa de teste não encontrada ou sem permissão." }, { status: 404 });
    }

    thread = threadRow;

    const { data: contactRow, error: contactError } = await supabase
      .from("conversation_contacts")
      .select("id,name,phone,email")
      .eq("id", thread.contact_id)
      .maybeSingle<ContactRow>();

    if (contactError) {
      return NextResponse.json({ error: contactError.message }, { status: 500 });
    }

    contact = contactRow ?? null;
  }

  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { data: job, error: jobError } = await admin
    .from("conversation_flow_jobs")
    .insert({
      user_id: flow.user_id,
      flow_id: flow.id,
      lead_id: thread?.lead_id ?? null,
      thread_id: thread?.id ?? null,
      whatsapp_account_id: thread?.whatsapp_account_id ?? null,
      owner_profile_id: thread?.owner_profile_id ?? flow.owner_profile_id,
      status: "pending",
      scheduled_for: now,
      trigger_event_type: "manual_test",
      trigger_snapshot: {
        test: true,
        trigger_type: flow.trigger_type,
        thread_id: thread?.id ?? null,
        contact_id: contact?.id ?? null,
        lead_id: thread?.lead_id ?? null,
        lead_name: contact?.name ?? "",
        lead_phone: contact?.phone ?? "",
        lead_email: contact?.email ?? "",
        message_body: "Teste manual do fluxo",
        body: "Teste manual do fluxo",
      },
    })
    .select("id,status,scheduled_for")
    .single();

  if (jobError || !job) {
    return NextResponse.json({ error: jobError?.message ?? "Erro ao criar job de teste." }, { status: 500 });
  }

  const executor = new ConversationFlowExecutor(admin);
  const execution = await executor.runDueJobs(5);

  return NextResponse.json({ job, execution });
}
