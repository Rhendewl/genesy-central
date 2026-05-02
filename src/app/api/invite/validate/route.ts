import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { ROLE_LABELS } from "@/hooks/useUsers";

// Rota pública — valida token de convite antes do usuário criar a senha.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Token obrigatório" }, { status: 400 });

  const admin = createAdminSupabaseClient();

  const { data: invite } = await admin
    .from("user_invites")
    .select("id, owner_id, email, role, status, expires_at")
    .eq("token", token)
    .single();

  if (!invite) return NextResponse.json({ error: "Convite inválido" }, { status: 404 });
  if (invite.status !== "pending") {
    return NextResponse.json({ error: "Este convite já foi utilizado ou revogado" }, { status: 410 });
  }
  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "Este convite expirou" }, { status: 410 });
  }

  const { data: profile } = await admin
    .from("user_profiles")
    .select("full_name")
    .eq("owner_id", invite.owner_id)
    .eq("email", invite.email)
    .single();

  return NextResponse.json({
    email: invite.email,
    role: invite.role,
    role_label: ROLE_LABELS[invite.role as keyof typeof ROLE_LABELS] ?? invite.role,
    full_name: profile?.full_name ?? null,
  });
}
