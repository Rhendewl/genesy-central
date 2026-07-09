import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/conversations/providers";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { ConversationMessage } from "@/types/conversations";

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
  phone: string;
};

type AccountRow = {
  id: string;
  provider: "qr_code" | "cloud_api";
  status: string;
};

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const threadId = typeof body?.thread_id === "string" ? body.thread_id : "";
  const messageBody = typeof body?.body === "string" ? body.body.trim() : "";

  if (!threadId || !messageBody) {
    return NextResponse.json({ error: "thread_id e body são obrigatórios." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: thread, error: threadError } = await supabase
    .from("conversation_threads")
    .select("id,user_id,whatsapp_account_id,contact_id,owner_profile_id,lead_id")
    .eq("id", threadId)
    .maybeSingle<ThreadRow>();

  if (threadError) {
    return NextResponse.json({ error: threadError.message }, { status: 500 });
  }

  if (!thread) {
    return NextResponse.json({ error: "Conversa não encontrada ou sem permissão." }, { status: 404 });
  }

  const [{ data: contact, error: contactError }, { data: account, error: accountError }] = await Promise.all([
    supabase
      .from("conversation_contacts")
      .select("id,phone")
      .eq("id", thread.contact_id)
      .maybeSingle<ContactRow>(),
    thread.whatsapp_account_id
      ? supabase
          .from("conversation_whatsapp_accounts")
          .select("id,provider,status")
          .eq("id", thread.whatsapp_account_id)
          .maybeSingle<AccountRow>()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (contactError) {
    return NextResponse.json({ error: contactError.message }, { status: 500 });
  }

  if (accountError) {
    return NextResponse.json({ error: accountError.message }, { status: 500 });
  }

  if (!contact) {
    return NextResponse.json({ error: "Contato da conversa não encontrado." }, { status: 404 });
  }

  const admin = createAdminSupabaseClient();
  const now = new Date().toISOString();

  const { data: queuedMessage, error: insertError } = await admin
    .from("conversation_messages")
    .insert({
      user_id: thread.user_id,
      thread_id: thread.id,
      whatsapp_account_id: thread.whatsapp_account_id,
      contact_id: thread.contact_id,
      owner_profile_id: thread.owner_profile_id,
      lead_id: thread.lead_id,
      direction: "outbound",
      source: "manual",
      body: messageBody,
      status: "queued",
      sent_at: now,
    })
    .select("*")
    .single<ConversationMessage>();

  if (insertError || !queuedMessage) {
    return NextResponse.json({ error: insertError?.message ?? "Erro ao registrar mensagem." }, { status: 500 });
  }

  let finalStatus: ConversationMessage["status"] = "failed";
  let providerMessageId: string | null = null;
  let providerError = "Nenhuma conta WhatsApp vinculada a esta conversa.";

  if (account) {
    const provider = getWhatsAppProvider(account.provider);
    const result = await provider.sendMessage({
      accountId: account.id,
      to: contact.phone,
      body: messageBody,
      idempotencyKey: queuedMessage.id,
    });

    finalStatus = result.ok ? "sent" : "failed";
    providerMessageId = result.providerMessageId ?? null;
    providerError = result.error ?? (result.ok ? "" : "Falha ao enviar mensagem.");
  }

  const { data: finalMessage, error: updateMessageError } = await admin
    .from("conversation_messages")
    .update({
      status: finalStatus,
      provider_message_id: providerMessageId,
      error: providerError || null,
      sent_at: now,
    })
    .eq("id", queuedMessage.id)
    .select("*")
    .single<ConversationMessage>();

  if (updateMessageError || !finalMessage) {
    return NextResponse.json({ error: updateMessageError?.message ?? "Erro ao atualizar mensagem." }, { status: 500 });
  }

  const { error: threadUpdateError } = await admin
    .from("conversation_threads")
    .update({
      last_message_preview: messageBody,
      last_message_at: now,
      last_outbound_at: now,
      needs_response: false,
    })
    .eq("id", thread.id);

  if (threadUpdateError) {
    return NextResponse.json({ error: threadUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({ message: finalMessage });
}
