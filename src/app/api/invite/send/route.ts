import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { resend, buildInviteEmail } from "@/lib/resend";
import { ROLE_LABELS } from "@/hooks/useUsers";

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { invite_id } = await req.json();
  if (!invite_id) return NextResponse.json({ error: "invite_id obrigatório" }, { status: 400 });

  const admin = createAdminSupabaseClient();

  // Busca o convite (pertencente ao owner autenticado)
  const { data: invite, error: invErr } = await admin
    .from("user_invites")
    .select("id, email, role, token, status, expires_at")
    .eq("id", invite_id)
    .eq("owner_id", user.id)
    .eq("status", "pending")
    .single();

  if (invErr || !invite) {
    return NextResponse.json({ error: "Convite não encontrado" }, { status: 404 });
  }

  // Busca o nome do perfil para personalizar o e-mail
  const { data: profile } = await admin
    .from("user_profiles")
    .select("full_name")
    .eq("owner_id", user.id)
    .eq("email", invite.email)
    .single();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteLink = `${appUrl}/convite/${invite.token}`;
  const recipientName = profile?.full_name ?? invite.email.split("@")[0];
  const roleName = ROLE_LABELS[invite.role as keyof typeof ROLE_LABELS] ?? invite.role;

  const { error: emailErr } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
    to: invite.email,
    subject: "Você foi convidado para o Lancaster",
    html: buildInviteEmail({ recipientName, inviteLink, roleName }),
  });

  if (emailErr) {
    console.error("[invite/send] resend error:", emailErr);
    return NextResponse.json({ error: "Falha ao enviar e-mail" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
