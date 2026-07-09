import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type { ConversationContact, ConversationThread } from "@/types/conversations";

type ProfileRow = {
  id: string;
  owner_id: string;
};

type AccountRow = {
  id: string;
  user_id: string;
  owner_profile_id: string;
  session_name: string;
  status: string;
  phone: string | null;
};

function normalizePhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : "";
  const whatsappAccountId = typeof body?.whatsapp_account_id === "string" && body.whatsapp_account_id
    ? body.whatsapp_account_id
    : null;

  if (!phone || phone.length < 8) {
    return NextResponse.json({ error: "Informe um telefone válido." }, { status: 400 });
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
    .select("id,owner_id")
    .eq("auth_user_id", user.id)
    .maybeSingle<ProfileRow>();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  if (!profile) {
    return NextResponse.json({ error: "Perfil do usuário não encontrado." }, { status: 404 });
  }

  let selectedAccount: AccountRow | null = null;
  if (whatsappAccountId) {
    const { data: account, error: accountError } = await supabase
      .from("conversation_whatsapp_accounts")
      .select("id,user_id,owner_profile_id,session_name,status,phone")
      .eq("id", whatsappAccountId)
      .maybeSingle<AccountRow>();

    if (accountError) {
      return NextResponse.json({ error: accountError.message }, { status: 500 });
    }

    if (!account) {
      return NextResponse.json({ error: "Conta WhatsApp não encontrada ou sem permissão." }, { status: 404 });
    }

    selectedAccount = account;
  }

  const admin = createAdminSupabaseClient();

  const { data: contact, error: contactError } = await admin
    .from("conversation_contacts")
    .upsert({
      user_id: profile.owner_id,
      name: name || null,
      phone,
    }, { onConflict: "user_id,phone" })
    .select("*")
    .single<ConversationContact>();

  if (contactError || !contact) {
    return NextResponse.json({ error: contactError?.message ?? "Erro ao criar contato." }, { status: 500 });
  }

  const { data: existingThread, error: existingThreadError } = await admin
    .from("conversation_threads")
    .select("*")
    .eq("user_id", profile.owner_id)
    .eq("contact_id", contact.id)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle<ConversationThread>();

  if (existingThreadError) {
    return NextResponse.json({ error: existingThreadError.message }, { status: 500 });
  }

  if (existingThread) {
    return NextResponse.json({ thread: existingThread, contact, account: selectedAccount });
  }

  const now = new Date().toISOString();
  const { data: thread, error: threadError } = await admin
    .from("conversation_threads")
    .insert({
      user_id: profile.owner_id,
      whatsapp_account_id: selectedAccount?.id ?? null,
      contact_id: contact.id,
      owner_profile_id: profile.id,
      status: "open",
      last_message_preview: "Conversa iniciada manualmente",
      last_message_at: now,
      needs_response: false,
    })
    .select("*")
    .single<ConversationThread>();

  if (threadError || !thread) {
    return NextResponse.json({ error: threadError?.message ?? "Erro ao criar conversa." }, { status: 500 });
  }

  return NextResponse.json({ thread, contact, account: selectedAccount });
}
