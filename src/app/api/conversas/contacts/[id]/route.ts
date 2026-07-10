import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { createServerSupabaseClient } from "@/lib/supabase-server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type ProfileRow = {
  id: string;
  owner_id: string;
  role: string;
};

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id: contactId } = await context.params;

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

  if (profile.role !== "admin") {
    return NextResponse.json({ error: "Apenas administradores podem excluir conversas." }, { status: 403 });
  }

  const admin = createAdminSupabaseClient();
  // conversation_threads e conversation_messages referenciam contact_id com
  // ON DELETE CASCADE — apagar o contato já limpa toda a conversa e o
  // histórico de mensagens junto. A próxima mensagem desse número recria o
  // contato do zero (útil quando o telefone gravado estava corrompido).
  const { error: deleteError, count } = await admin
    .from("conversation_contacts")
    .delete({ count: "exact" })
    .eq("id", contactId)
    .eq("user_id", profile.owner_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (!count) {
    return NextResponse.json({ error: "Contato não encontrado ou sem permissão." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
