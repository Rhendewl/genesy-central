import { NextRequest, NextResponse } from "next/server";
import { enqueueConversationTrigger } from "@/lib/conversations/trigger-service";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import type {
  ConversationContact,
  ConversationMessage,
  ConversationThread,
} from "@/types/conversations";

type AccountRow = {
  id: string;
  user_id: string;
  owner_profile_id: string;
};

type ThreadRow = ConversationThread & {
  unread_count: number;
};

function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

function isAuthorized(request: NextRequest) {
  const configured = process.env.CONVERSATIONS_WORKER_SECRET || process.env.CRON_SECRET;
  if (!configured) return false;
  return request.headers.get("x-conversations-secret") === configured;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const whatsappAccountId = typeof body?.whatsapp_account_id === "string" ? body.whatsapp_account_id : "";
  const from = typeof body?.from === "string" ? normalizePhone(body.from) : "";
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const providerMessageId = typeof body?.provider_message_id === "string" ? body.provider_message_id : null;
  const receivedAt = typeof body?.received_at === "string" ? body.received_at : new Date().toISOString();

  if (!whatsappAccountId || !from || !text) {
    return NextResponse.json({ error: "whatsapp_account_id, from e body são obrigatórios." }, { status: 400 });
  }

  const db = createAdminSupabaseClient();
  const { data: account, error: accountError } = await db
    .from("conversation_whatsapp_accounts")
    .select("id,user_id,owner_profile_id")
    .eq("id", whatsappAccountId)
    .maybeSingle<AccountRow>();

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  if (!account) {
    return NextResponse.json({ error: "Conta WhatsApp não encontrada." }, { status: 404 });
  }

  const { data: contact, error: contactError } = await db
    .from("conversation_contacts")
    .upsert({
      user_id: account.user_id,
      phone: from,
      name: name || null,
    }, { onConflict: "user_id,phone" })
    .select("*")
    .single<ConversationContact>();

  if (contactError || !contact) {
    return NextResponse.json({ error: contactError?.message ?? "Erro ao salvar contato." }, { status: 500 });
  }

  const { data: existingThread, error: threadLookupError } = await db
    .from("conversation_threads")
    .select("*")
    .eq("user_id", account.user_id)
    .eq("contact_id", contact.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ThreadRow>();

  if (threadLookupError) {
    return NextResponse.json({ error: threadLookupError.message }, { status: 500 });
  }

  let thread = existingThread;
  if (!thread) {
    const { data: createdThread, error: createThreadError } = await db
      .from("conversation_threads")
      .insert({
        user_id: account.user_id,
        whatsapp_account_id: account.id,
        contact_id: contact.id,
        owner_profile_id: account.owner_profile_id,
        lead_id: contact.lead_id,
        status: "open",
        last_message_preview: text,
        last_message_at: receivedAt,
        last_inbound_at: receivedAt,
        unread_count: 0,
        needs_response: true,
      })
      .select("*")
      .single<ThreadRow>();

    if (createThreadError || !createdThread) {
      return NextResponse.json({ error: createThreadError?.message ?? "Erro ao criar conversa." }, { status: 500 });
    }

    thread = createdThread;
  }

  const { data: message, error: messageError } = await db
    .from("conversation_messages")
    .insert({
      user_id: account.user_id,
      thread_id: thread.id,
      whatsapp_account_id: account.id,
      contact_id: contact.id,
      owner_profile_id: thread.owner_profile_id,
      lead_id: thread.lead_id,
      direction: "inbound",
      source: "manual",
      body: text,
      status: "received",
      provider_message_id: providerMessageId,
      received_at: receivedAt,
    })
    .select("*")
    .single<ConversationMessage>();

  if (messageError || !message) {
    return NextResponse.json({ error: messageError?.message ?? "Erro ao registrar mensagem." }, { status: 500 });
  }

  const { error: threadUpdateError } = await db
    .from("conversation_threads")
    .update({
      whatsapp_account_id: account.id,
      last_message_preview: text,
      last_message_at: receivedAt,
      last_inbound_at: receivedAt,
      unread_count: (thread.unread_count ?? 0) + 1,
      needs_response: true,
    })
    .eq("id", thread.id);

  if (threadUpdateError) {
    return NextResponse.json({ error: threadUpdateError.message }, { status: 500 });
  }

  const trigger = await enqueueConversationTrigger(db, {
    userId: account.user_id,
    triggerType: "message_received",
    threadId: thread.id,
    whatsappAccountId: account.id,
    ownerProfileId: thread.owner_profile_id,
    leadId: thread.lead_id,
    snapshot: {
      message_id: message.id,
      provider_message_id: providerMessageId,
      body: text,
      message_body: text,
      from,
      contact_id: contact.id,
      thread_id: thread.id,
      received_at: receivedAt,
    },
  });

  if (trigger.error) {
    return NextResponse.json({ error: trigger.error }, { status: 500 });
  }

  return NextResponse.json({
    received: true,
    contact,
    thread_id: thread.id,
    message,
    queued_jobs: trigger.queued,
  });
}
