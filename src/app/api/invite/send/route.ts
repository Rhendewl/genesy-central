import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { getResendClient, buildInviteEmail } from "@/lib/resend";
import { ROLE_LABELS } from "@/lib/roles";

export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

    const { invite_id } = await req.json();
    if (!invite_id) return NextResponse.json({ error: "invite_id obrigatório" }, { status: 400 });

    const admin = createAdminSupabaseClient();

    const { data: invite, error: invErr } = await admin
      .from("user_invites")
      .select("id, email, role, token, status, expires_at")
      .eq("id", invite_id)
      .eq("owner_id", user.id)
      .eq("status", "pending")
      .single();

    if (invErr || !invite) {
      return NextResponse.json(
        { error: `Convite não encontrado${invErr ? `: ${invErr.message}` : ""}` },
        { status: 404 }
      );
    }

    if (!invite.token) {
      return NextResponse.json(
        { error: "Token do convite ausente — execute a migration 008 no Supabase" },
        { status: 500 }
      );
    }

    const { data: profile } = await admin
      .from("user_profiles")
      .select("full_name")
      .eq("owner_id", user.id)
      .eq("email", invite.email)
      .single();

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const inviteLink = `${appUrl}/convite/${invite.token}`;
    const recipientName = profile?.full_name ?? invite.email.split("@")[0];
    const roleName = ROLE_LABELS[invite.role as keyof typeof ROLE_LABELS] ?? invite.role;

    const { error: emailErr } = await getResendClient().emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev",
      to: invite.email,
      subject: "Você foi convidado para o Lancaster",
      html: buildInviteEmail({ recipientName, inviteLink, roleName }),
    });

    if (emailErr) {
      const detail = (emailErr as { message?: string })?.message ?? JSON.stringify(emailErr);
      return NextResponse.json({ error: `Resend: ${detail}` }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = (err as { message?: string })?.message ?? "Erro interno no servidor";
    console.error("[invite/send] unhandled error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
