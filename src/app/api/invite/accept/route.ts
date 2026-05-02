import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";

// Rota pública — aceita o convite: cria conta Supabase Auth e vincula auth_user_id.
export async function POST(req: Request) {
  const body = await req.json();
  const { token, password } = body as { token?: string; password?: string };

  if (!token || !password) {
    return NextResponse.json({ error: "Dados obrigatórios" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "Senha deve ter no mínimo 8 caracteres" }, { status: 400 });
  }

  const admin = createAdminSupabaseClient();

  // Valida token
  const { data: invite } = await admin
    .from("user_invites")
    .select("id, owner_id, email, role, status, expires_at")
    .eq("token", token)
    .single();

  if (!invite) return NextResponse.json({ error: "Convite inválido" }, { status: 404 });
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "Convite já utilizado ou revogado" }, { status: 410 });
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Convite expirado" }, { status: 410 });
  }

  // Verifica se já existe um auth user com esse e-mail
  const { data: existingUsers } = await admin.auth.admin.listUsers();
  const alreadyExists = existingUsers?.users.some((u) => u.email === invite.email);
  if (alreadyExists) {
    return NextResponse.json(
      { error: "Já existe uma conta com este e-mail. Faça login normalmente." },
      { status: 409 }
    );
  }

  // Cria usuário no Supabase Auth
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email: invite.email,
    password,
    email_confirm: true,
  });

  if (authErr || !authData.user) {
    return NextResponse.json(
      { error: authErr?.message ?? "Erro ao criar conta" },
      { status: 500 }
    );
  }

  // Vincula auth_user_id no user_profiles
  const { error: profileErr } = await admin
    .from("user_profiles")
    .update({ auth_user_id: authData.user.id })
    .eq("owner_id", invite.owner_id)
    .eq("email", invite.email);

  if (profileErr) {
    await admin.auth.admin.deleteUser(authData.user.id);
    return NextResponse.json({ error: "Erro ao vincular perfil" }, { status: 500 });
  }

  // Marca convite como aceito
  await admin.from("user_invites").update({ status: "accepted" }).eq("id", invite.id);

  return NextResponse.json({ ok: true });
}
